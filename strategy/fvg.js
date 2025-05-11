// ../strategy/fvg.js
import { calculateATR, calculateSMA } from './utils.js';
import { FVG_CONFIG, STRATEGY } from './configStrategy.js';
import logger from './logger.js';

export class FVGDetector {
    #fvgs;
    #fvgBars;
    #atrLen;
    #filterMethod;
    #volumeThreshold;
    #showLastXFVGs;

    constructor() {
        this.#fvgs = [];
        this.#fvgBars = FVG_CONFIG.fvgBars || 2;
        this.#atrLen = FVG_CONFIG.atrLen || 10;
        this.#filterMethod = FVG_CONFIG.filterMethod;
        this.#volumeThreshold = FVG_CONFIG.volumeThreshold;
        this.#showLastXFVGs = FVG_CONFIG.showLastXFVGs;
    }

    processCandles(candles, anchorPeriodCandles = []) {
        if (!Array.isArray(candles) || !Array.isArray(anchorPeriodCandles)) {
            logger.error('Input non valido per processCandles');
            return [];
        }

        candles.forEach((candle, index) => {
            try {
                const barIndex = this.#calculateBarIndex(index, candles.length);
                this.#detectAndProcessFVG(candle, barIndex, anchorPeriodCandles);
                this.#updateFVGTouches(candle, barIndex);
                this.#cleanupOldFVGs(barIndex);
            } catch (error) {
                logger.error(`Errore nel processamento candela ${index}: ${error.message}`);
            }
        });

        return this.#fvgs;
    }

    #calculateBarIndex(index, totalLength) {
        return STRATEGY.getChartTF() === 1 ? index : index + totalLength;
    }

    #detectAndProcessFVG(candle, barIndex, anchorPeriodCandles) {
        if (barIndex < this.#fvgBars) return;

        const prevCandle = anchorPeriodCandles[barIndex - this.#fvgBars];
        if (!prevCandle) {
            logger.debug(`Candela precedente non trovata per barIndex ${barIndex}`);
            return;
        }

        const atr = calculateATR(anchorPeriodCandles, this.#atrLen);
        const fvg = this.#detectFVG(candle, prevCandle, atr);

        if (fvg) {
            const fvgData = this.#createFVGData(fvg, candle, barIndex);
            if (this.#filterFVG(fvgData, anchorPeriodCandles)) {
                this.#fvgs.push(fvgData);
                logger.info(`FVG ${fvgData.isBull ? 'Bull' : 'Bear'} rilevato: min=${fvgData.min}, max=${fvgData.max}`);
            }
        }
    }

    #detectFVG(candle, prevCandle, atr) {
        const sensitivity = FVG_CONFIG.getFvgSensitivityValue();
        const minimumGapSize = atr * sensitivity;

        // Bull FVG
        if (this.#isBullFVG(candle, prevCandle, minimumGapSize)) {
            return {
                type: 'bull',
                size: candle.low - prevCandle.high,
                top: candle.low,
                bottom: prevCandle.high
            };
        }

        // Bear FVG
        if (this.#isBearFVG(candle, prevCandle, minimumGapSize)) {
            return {
                type: 'bear',
                size: prevCandle.low - candle.high,
                top: prevCandle.low,
                bottom: candle.high
            };
        }

        return null;
    }

    #isBullFVG(candle, prevCandle, minimumGapSize) {
        const gap = prevCandle.high < candle.low;
        const size = candle.low - prevCandle.high;
        return gap && size >= minimumGapSize && size >= FVG_CONFIG.minimumFVGSize;
    }

    #isBearFVG(candle, prevCandle, minimumGapSize) {
        const gap = prevCandle.low > candle.high;
        const size = prevCandle.low - candle.high;
        return gap && size >= minimumGapSize && size >= FVG_CONFIG.minimumFVGSize;
    }

    #createFVGData(fvg, candle, barIndex) {
        return {
            isBull: fvg.type === 'bull',
            startBarIndex: barIndex,
            startTime: candle.timestamp,
            endBarIndex: null,
            endTime: null,
            max: fvg.top,
            min: fvg.bottom,
            size: fvg.size,
            isInverse: false,
            inverseVolume: 0,
            lastTouchedIFVG: null,
            volume: candle.vBuy + candle.vSell
        };
    }

    #filterFVG(fvg, anchorPeriod) {
        if (this.#filterMethod === "ATR") {
            const atr = calculateATR(anchorPeriod, this.#atrLen);
            return atr && Math.abs(fvg.max - fvg.min) > atr;
        } else if (this.#filterMethod === "Volume Threshold") {
            return fvg.volume > this.#volumeThreshold;
        }
        return true;
    }

    #updateFVGTouches(candle, barIndex) {
        this.#fvgs.forEach(curFVG => {
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

    #cleanupOldFVGs(barIndex) {
        if (this.#showLastXFVGs > 0) {
            this.#fvgs = this.#fvgs.filter(fvg => 
                barIndex - fvg.startBarIndex <= this.#showLastXFVGs || 
                fvg.endBarIndex === null
            );
            logger.debug(`Pulizia FVG: Rimasti ${this.#fvgs.length} FVG`);
        }
    }
}