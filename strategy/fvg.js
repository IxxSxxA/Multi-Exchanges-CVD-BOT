// ../strategy/fvg.js
import { calculateATR, calculateSMA } from './utils.js';
import { FVG_CONFIG, STRATEGY } from './configStrategy.js';
import logger from './logger.js';

export class FVGDetector {
    constructor() {
        this.fvgs = [];
        this.fvgBars = FVG_CONFIG.fvgBars;
        this.startZoneFrom = FVG_CONFIG.startZoneFrom;
        this.atrLen = FVG_CONFIG.atrLen;
        this.filterMethod = FVG_CONFIG.filterMethod;
        this.volumeThreshold = FVG_CONFIG.volumeThreshold;
        this.showLastXFVGs = FVG_CONFIG.showLastXFVGs;
    }

    processCandles(candles, anchorCandles = []) {
        candles.forEach((candle, index) => {
            const barIndex = STRATEGY.chartTF === "1" ? index : index + candles.length;
            this.detectFVG(candle, barIndex, anchorCandles);
            this.updateFVGTouches(candle, barIndex, anchorCandles);
            this.cleanupOldFVGs(barIndex);
        });
        return this.fvgs;
    }

    detectFVG(candle, barIndex, anchorCandles) {
        if (barIndex < this.fvgBars) return;

        const prevCandle = anchorCandles[barIndex - this.fvgBars] || candle;
        const bearFVG = prevCandle.low > candle.high;
        const bullFVG = prevCandle.high < candle.low;

        if (bearFVG || bullFVG) {
            const fvg = {
                isBull: bullFVG,
                startBarIndex: barIndex,
                startTime: candle.timestamp,
                endBarIndex: null,
                endTime: null,
                max: bullFVG ? prevCandle.high : candle.high,
                min: bullFVG ? candle.low : prevCandle.low,
                isInverse: false,
                inverseVolume: 0,
                lastTouchedIFVG: null,
                volume: candle.vBuy + candle.vSell
            };

            const isValidFVG = this.filterFVG(fvg, anchorCandles);
            if (isValidFVG) {
                this.fvgs.push(fvg);
                logger.info(`Rilevato FVG: ${fvg.isBull ? 'Bull' : 'Bear'}, min=${fvg.min}, max=${fvg.max}, barIndex=${barIndex}`);
            }
        }
    }

    filterFVG(fvg, anchorCandles) {
        if (this.filterMethod === "ATR") {
            const atr = calculateATR(anchorCandles, this.atrLen);
            return atr && Math.abs(fvg.max - fvg.min) > atr;
        } else if (this.filterMethod === "Volume Threshold") {
            return fvg.volume > this.volumeThreshold;
        }
        return true;
    }

    updateFVGTouches(candle, barIndex, anchorCandles) {
        this.fvgs.forEach(curFVG => {
            if (curFVG.endBarIndex === null) {
                if (curFVG.isBull && (FVG_CONFIG.endMethod === "Wick" ? candle.low < curFVG.min : candle.close < curFVG.min)) {
                    curFVG.endBarIndex = barIndex;
                    curFVG.endTime = candle.timestamp;
                    curFVG.isInverse = true;
                    curFVG.inverseVolume = (candle.vBuy + candle.vSell) || 0;
                    curFVG.lastTouchedIFVG = barIndex;
                    logger.debug(`FVG Bull terminato: barIndex=${barIndex}, min=${curFVG.min}`);
                }
                if (!curFVG.isBull && (FVG_CONFIG.endMethod === "Wick" ? candle.high > curFVG.max : candle.close > curFVG.max)) {
                    curFVG.endBarIndex = barIndex;
                    curFVG.endTime = candle.timestamp;
                    curFVG.isInverse = true;
                    curFVG.inverseVolume = (candle.vBuy + candle.vSell) || 0;
                    curFVG.lastTouchedIFVG = barIndex;
                    logger.debug(`FVG Bear terminato: barIndex=${barIndex}, max=${curFVG.max}`);
                }
            }
        });
    }

    cleanupOldFVGs(barIndex) {
        if (this.showLastXFVGs > 0) {
            this.fvgs = this.fvgs.filter(fvg => 
                barIndex - fvg.startBarIndex <= this.showLastXFVGs || 
                fvg.endBarIndex === null
            );
            logger.debug(`Pulizia FVG: Rimasti ${this.fvgs.length} FVG`);
        }
    }
}