// ../strategy/fvg.js
import { FVG_CONFIG, CVD_CONFIG } from './configStrategy.js';
import { calculateATR, calculateSMA } from './utils.js';

// Type definitions
class FVGInfo {
    constructor() {
        this.max = null;
        this.min = null;
        this.isBull = null;
        this.t = null;
        this.totalVolume = null;
        this.startBarIndex = null;
        this.endBarIndex = null;
        this.startTime = null;
        this.endTime = null;
        this.extendInfinite = false;
        this.combined = false;
        this.combinedTimeframesStr = null;
        this.disabled = false;
        this.timeframeStr = null;
        this.lowVolume = null;
        this.highVolume = null;
        this.isInverse = false;
        this.lastTouched = null;
        this.lastTouchedIFVG = null;
        this.inverseEndIndex = null;
        this.inverseEndTime = null;
        this.inverseVolume = null;
    }
}

class FVG {
    constructor(info) {
        this.info = info;
        this.isRendered = false;
        this.fvgBox = null;
        this.ifvgBox = null;
        this.fvgBoxText = null;
        this.fvgBoxPositive = null;
        this.fvgBoxNegative = null;
        this.fvgSeperator = null;
        this.fvgTextSeperator = null;
    }
}

// Helper functions
function createFVGInfo(h, l, bull, t, tv) {
    const newFVGInfo = new FVGInfo();
    newFVGInfo.max = h;
    newFVGInfo.min = l;
    newFVGInfo.isBull = bull;
    newFVGInfo.t = t;
    newFVGInfo.totalVolume = tv;
    return newFVGInfo;
}

function createFVG(FVGInfoF) {
    return new FVG(FVGInfoF);
}

function safeDeleteFVG(fvg) {
    fvg.isRendered = false;
}

// Main FVG detection logic
export class FVGDetector {
    constructor() {
        this.FVGInfoList = [];
        this.allFVGList = [];
        this.atr = null;
        this.atrLength = CVD_CONFIG.atrLen;
        this.lastProcessedTimestamp = null;
    }

    // Metodo principale per processare le candele
    processCandles(candles, prevCandles = []) {
        if (!candles || candles.length < 3) {
            console.warn('Not enough candles to check for FVGs (need at least 3)');
            return [];
        }

        // Evita di processare più volte le stesse candele
        const newestCandle = candles[candles.length - 1];
        if (this.lastProcessedTimestamp === newestCandle.timestamp) {
            return [];
        }
        this.lastProcessedTimestamp = newestCandle.timestamp;

        // Calcola ATR
        this.atr = calculateATR(candles, this.atrLength);

        // Prendi le ultime 3 candele (più recente per prima)
        const [current, prev1, prev2] = candles.slice(-3).reverse();

        // Calcola il volume totale (buy + sell)
        const volumes = [
            current.vBuy + current.vSell,
            prev1.vBuy + prev1.vSell,
            prev2.vBuy + prev2.vSell
        ];

        return this.detectFVGs(
            [current.open, prev1.open, prev2.open],
            [current.high, prev1.high, prev2.high],
            [current.low, prev1.low, prev2.low],
            [current.close, prev1.close, prev2.close],
            volumes,
            current.timestamp,
            candles.length - 1, // barIndex
            prevCandles
        );
    }

    // Detect FVGs from price data
    detectFVGs(open, high, low, close, volume, time, barIndex, prevCandles) {
        const bearCondition = this.checkBearCondition(open, high, low, close, volume);
        const bullCondition = this.checkBullCondition(open, high, low, close, volume);

        const bearFVG = high[0] < low[2] && close[1] < low[2] && bearCondition;
        const bullFVG = low[0] > high[2] && close[1] > high[2] && bullCondition;

        const volSum3 = volume[0] + volume[1] + volume[2];
        const totalVolume = volSum3;

        let newFVGInfo = null;
        if (bearFVG) {
            newFVGInfo = createFVGInfo(low[2], high[0], false, time, totalVolume);
            newFVGInfo.lowVolume = volume[0] + volume[1];
            newFVGInfo.highVolume = volume[2];
        } else if (bullFVG) {
            newFVGInfo = createFVGInfo(low[0], high[2], true, time, totalVolume);
            newFVGInfo.lowVolume = volume[2];
            newFVGInfo.highVolume = volume[0] + volume[1];
        }

        if (newFVGInfo) {
            const FVGSize = bearFVG ? Math.abs(low[2] - high[0]) : Math.abs(low[0] - high[2]);
            const FVGSizeEnough = FVGSize * FVG_CONFIG.getFvgSensitivityValue() > this.atr;

            if (FVGSizeEnough) {
                // Gestione di startZoneFrom
                const startTimeOffset = FVG_CONFIG.startZoneFrom === "First Bar" && prevCandles.length >= 2
                    ? prevCandles[prevCandles.length - 2].timestamp
                    : time;
                newFVGInfo.startTime = startTimeOffset;
                newFVGInfo.startBarIndex = barIndex - (FVG_CONFIG.startZoneFrom === "First Bar" ? 2 : 0);
                newFVGInfo.lastTouched = barIndex;

                this.FVGInfoList.unshift(newFVGInfo);
                while (this.FVGInfoList.length > FVG_CONFIG.showLastXFVGs) {
                    this.FVGInfoList.pop();
                }
            }
        }

        this.updateFVGTouches(high[0], low[0], barIndex, time, close[0]);
        this.cleanupOldFVGs(barIndex);

        return this.FVGInfoList;
    }

    checkBearCondition(open, high, low, close, volume) {
        const firstBarSize = Math.max(open[0], close[0]) - Math.min(open[0], close[0]);
        const secondBarSize = Math.max(open[1], close[1]) - Math.min(open[1], close[1]);
        const thirdBarSize = Math.max(open[2], close[2]) - Math.min(open[2], close[2]);
        const barSizeSum = firstBarSize + secondBarSize + thirdBarSize;

        const maxCODiff = Math.max(Math.abs(close[2] - open[1]), Math.abs(close[1] - open[0]));

        // Verifica fvgBars
        let fvgBarsCheck = true;
        if (FVG_CONFIG.barsType === "Same Type") {
            fvgBarsCheck = (open[0] > close[0] && open[1] > close[1] && open[2] > close[2]) ||
                           (open[0] <= close[0] && open[1] <= close[1] && open[2] <= close[2]);
        }

        // Nota: barSizeCheck è commentato nel PineScript, quindi lo ignoro
        // const barSizeCheck = secondBarSize >= Math.max(firstBarSize, thirdBarSize);

        if (!fvgBarsCheck) return false;

        if (FVG_CONFIG.filterMethod === "Average Range") {
            return (barSizeSum * FVG_CONFIG.getFvgSensitivityValue() > this.atr / 1.5) &&
                   (FVG_CONFIG.allowGaps || maxCODiff <= this.atr);
        } else if (FVG_CONFIG.filterMethod === "Volume Threshold") {
            const thresholdMultiplier = FVG_CONFIG.volumeThresholdPercent / 100.0;
            const shortVol = calculateSMA(volume, 5);
            const longVol = calculateSMA(volume, 15);
            return shortVol > longVol * thresholdMultiplier && (FVG_CONFIG.allowGaps || maxCODiff <= this.atr);
        }
        return false;
    }

    checkBullCondition(open, high, low, close, volume) {
        return this.checkBearCondition(open, high, low, close, volume);
    }

    getFvgSensitivityValue() {
        return FVG_CONFIG.getFvgSensitivityValue();
    }

    updateFVGTouches(high, low, barIndex, time, close) {
        for (const curFVG of this.FVGInfoList) {
            // Is Touched FVG
            if ((curFVG.isBull && low <= curFVG.max) || (!curFVG.isBull && high >= curFVG.min)) {
                curFVG.lastTouched = barIndex;
            }

            if ((!curFVG.isBull && low <= curFVG.max) || (curFVG.isBull && high >= curFVG.min)) {
                curFVG.lastTouchedIFVG = barIndex;
            }

            // IFVG Close
            if (curFVG.isInverse && curFVG.inverseEndIndex === null) {
                if (!curFVG.isBull && (FVG_CONFIG.ifvgEndMethod === "Wick" ? low < curFVG.min : close < curFVG.min)) {
                    curFVG.inverseEndIndex = barIndex;
                    curFVG.inverseEndTime = time;
                }
                if (curFVG.isBull && (FVG_CONFIG.ifvgEndMethod === "Wick" ? high > curFVG.max : close > curFVG.max)) {
                    curFVG.inverseEndIndex = barIndex;
                    curFVG.inverseEndTime = time;
                }
            }

            if (curFVG.endBarIndex === null) {
                // FVG End
                if (curFVG.isBull && (FVG_CONFIG.endMethod === "Wick" ? low < curFVG.min : close < curFVG.min)) {
                    curFVG.endBarIndex = barIndex;
                    curFVG.endTime = time;
                    curFVG.isInverse = true;
                    curFVG.inverseVolume = volume[0] || 0;
                    curFVG.lastTouchedIFVG = barIndex; // Correzione: sostituito last–––––––––––TouchedIFVG
                }
                if (!curFVG.isBull && (FVG_CONFIG.endMethod === "Wick" ? high > curFVG.max : close > curFVG.max)) {
                    curFVG.endBarIndex = barIndex;
                    curFVG.endTime = time;
                    curFVG.isInverse = true;
                    curFVG.inverseVolume = volume[0] || 0;
                    curFVG.lastTouchedIFVG = barIndex;
                }
            }
        }
    }

    cleanupOldFVGs(barIndex) {
        this.FVGInfoList = this.FVGInfoList.filter(curFVGInfo => {
            if (!curFVGInfo.isInverse) {
                return this.isFVGValidInTimeframe(curFVGInfo, barIndex);
            } else {
                return this.isIFVGValidInTimeframe(curFVGInfo, barIndex);
            }
        });
    }

    isFVGValidInTimeframe(curFVGInfo, barIndex) {
        if (curFVGInfo.endTime !== null) {
            return false;
        }
        if (curFVGInfo.disabled) {
            return false;
        }
        if (curFVGInfo.endBarIndex !== null && (curFVGInfo.endBarIndex - curFVGInfo.startBarIndex) < FVG_CONFIG.minimumFVGSize) {
            return false;
        }
        if (curFVGInfo.endBarIndex === null && FVG_CONFIG.deleteUntouched && (barIndex - curFVGInfo.lastTouched) > FVG_CONFIG.deleteUntouchedAfterXBars) {
            return false;
        }
        return true;
    }

    isIFVGValidInTimeframe(curFVGInfo, barIndex) {
        if (!FVG_CONFIG.ifvgEnabled) {
            return false;
        }
        if (curFVGInfo.inverseEndIndex !== null) {
            return false;
        }
        if (curFVGInfo.inverseEndIndex !== null && (curFVGInfo.inverseEndIndex - curFVGInfo.endBarIndex) < FVG_CONFIG.minimumIFVGSize) {
            return false;
        }
        if (curFVGInfo.inverseEndIndex === null && FVG_CONFIG.deleteUntouched && (barIndex - curFVGInfo.lastTouchedIFVG) > FVG_CONFIG.deleteUntouchedAfterXBars) {
            return false;
        }
        return true;
    }
}