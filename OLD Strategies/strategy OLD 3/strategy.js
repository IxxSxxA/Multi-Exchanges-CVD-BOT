// ../strategy/strategy.js
import { FVGDetector } from './fvg.js';
import { requestVolumeDelta } from './cvd.js';
import { calculateATR } from './utils.js';
import { STRATEGY, CVD_CONFIG, RISK_CONFIG } from './configStrategy.js';
import logger from './logger.js';

export class Strategy {
    #fvgDetector;
    #state;
    #position;
    #balance;
    #trades;
    #signalThreshold;
    #atrPeriod;
    #lastCumulative;
    #pendingSignal;

    constructor() {
        this.#fvgDetector = new FVGDetector();
        this.#state = 'waiting_for_signal';
        this.#position = null;
        this.#balance = parseFloat(STRATEGY.initialAmount);
        this.#trades = [];
        this.#signalThreshold = CVD_CONFIG.signalThreshold || 0;
        this.#atrPeriod = CVD_CONFIG.atrLen || 14;
        this.#lastCumulative = 0;
        this.#pendingSignal = null;
    }

    processCandles(candle, anchorPeriodCandles) {
        try {
            if (!this.#validateInput(candle, anchorPeriodCandles)) {
                return this.#getDefaultResponse();
            }

            // Get CVD signals using the imported function
            const cvdData = requestVolumeDelta(anchorPeriodCandles, STRATEGY.getChartTF());
            
            // Get FVG signals using atr from cvdData
            const fvg = this.#fvgDetector.detectFVG(
                candle, 
                anchorPeriodCandles[anchorPeriodCandles.length - 2], 
                cvdData.atr
            );
            
            this.#processSignals(candle, fvg, cvdData);

            return {
                state: this.#state,
                position: this.#position,
                cvd: cvdData,
                fvg: fvg,
                trades: this.#trades,
                balance: this.#balance
            };
        } catch (error) {
            logger.error(`Error in processCandles: ${error.message}`);
            return this.#getDefaultResponse();
        }
    }

    #processSignals(candle, fvg, cvdData) {
        switch(this.#state) {
            case 'waiting_for_signal':
                if (this.#isCVDSignalValid(cvdData)) {
                    this.#state = 'waiting_for_fvg';
                    this.#pendingSignal = cvdData.delta > 0 ? 'bull' : 'bear';
                    logger.debug(`CVD Signal detected: ${this.#pendingSignal}`);
                }
                break;
                
            case 'waiting_for_fvg':
                if (fvg && fvg.type === this.#pendingSignal) {
                    this.#enterPosition(candle, fvg, cvdData);
                    this.#state = 'in_position';
                }
                break;
                
            case 'in_position':
                if (this.#shouldExitPosition(candle, cvdData)) {
                    this.#exitPosition(candle);
                    this.#state = 'waiting_for_signal';
                }
                break;
        }
    }

    #validateInput(candle, anchorPeriodCandles) {
        if (!candle || !anchorPeriodCandles || !Array.isArray(anchorPeriodCandles)) {
            logger.error('Invalid input parameters in processCandles');
            return false;
        }
        return true;
    }

    #getDefaultResponse() {
        return {
            state: this.#state,
            position: null,
            cvd: null,
            fvg: null,
            trades: [],
            balance: this.#balance
        };
    }

    #isCVDSignalValid(cvdData) {
        // Zero cross detection
        const prevCumulative = this.#lastCumulative || 0;
        const currentCumulative = cvdData.cumulative;
        
        this.#lastCumulative = currentCumulative;
        
        return (prevCumulative <= 0 && currentCumulative > 0) || 
               (prevCumulative >= 0 && currentCumulative < 0);
    }

    #isBullishSignal(volumeChange) {
        return volumeChange > this.#signalThreshold;
    }

    #isBearishSignal(volumeChange) {
        return volumeChange < -this.#signalThreshold;
    }

    #enterPosition(candle, fvg, cvdData) {
        const side = this.#isBullishSignal(cvdData.delta) ? 'long' : 'short';
        const entryPrice = candle.close;
        const size = this.#calculatePositionSize();

        // Calcola ATR per SL/TP dinamico
        const atr = calculateATR(anchorPeriod, this.#atrPeriod) || 0;
        const atrMultiplier = RISK_CONFIG.getSLATRMult(RISK_CONFIG.riskAmount, RISK_CONFIG.customSLATRMult);
        const slDistance = atr * atrMultiplier;
        const tpDistance = slDistance * 2; // TP è il doppio di SL (rapporto rischio/rendimento 1:2)

        const stopLossPrice = side === 'long' 
            ? entryPrice - slDistance
            : entryPrice + slDistance;
        const takeProfitPrice = side === 'long'
            ? entryPrice + tpDistance
            : entryPrice - tpDistance;

        this.#position = {
            side,
            entryPrice,
            size,
            entryTime: candle.timestamp,
            fvg,
            stopLossPrice,
            takeProfitPrice,
            atrUsed: atr
        };

        this.#trades.push({
            entryTime: candle.timestamp,
            entryPrice,
            side,
            status: 'open',
            stopLossPrice,
            takeProfitPrice,
            atrUsed: atr,
            atrMultiplier
        });

        logger.info(`Entrata ${side} a ${entryPrice} (FVG ${fvg.isBull ? 'Bull' : 'Bear'}, SL=${stopLossPrice}, TP=${takeProfitPrice}, ATR=${atr}, Multiplier=${atrMultiplier})`);
    }

    #exitPosition(candle, reason = 'FVG Invalidation') {
        if (!this.#position) return;

        const exitPrice = candle.close;
        const profit = this.#calculateProfitLoss(exitPrice);
        this.#balance += profit;

        const trade = this.#trades[this.#trades.length - 1];
        trade.exitTime = candle.timestamp;
        trade.exitPrice = exitPrice;
        trade.profit = profit;
        trade.status = 'closed';
        trade.exitReason = reason;

        logger.info(`Uscita ${this.#position.side} a ${exitPrice}, Profitto: ${profit}, Motivo: ${reason}`);

        this.#position = null;
    }

    #calculatePositionSize() {
        // Semplificazione: usa 1% del balance
        return this.#balance * 0.01 / 100; // Adatta in base al mercato
    }

    #calculateProfitLoss(exitPrice) {
        if (!this.#position) return 0;
        const { side, entryPrice, size } = this.#position;
        const priceDiff = side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
        return priceDiff * size;
    }

    #shouldExitPosition(candle) {
        if (!this.#position || !this.#position.fvg) return false;
        const { side, stopLossPrice, takeProfitPrice, fvg } = this.#position;

        // Stop-Loss
        if (side === 'long' && candle.low <= stopLossPrice) {
            this.#exitPosition(candle, 'Stop-Loss');
            return true;
        }
        if (side === 'short' && candle.high >= stopLossPrice) {
            this.#exitPosition(candle, 'Stop-Loss');
            return true;
        }

        // Take-Profit
        if (side === 'long' && candle.high >= takeProfitPrice) {
            this.#exitPosition(candle, 'Take-Profit');
            return true;
        }
        if (side === 'short' && candle.low <= takeProfitPrice) {
            this.#exitPosition(candle, 'Take-Profit');
            return true;
        }

        // FVG Invalidation
        if (side === 'long' && candle.low < fvg.min) {
            this.#exitPosition(candle, 'FVG Invalidation');
            return true;
        }
        if (side === 'short' && candle.high > fvg.max) {
            this.#exitPosition(candle, 'FVG Invalidation');
            return true;
        }

        return false;
    }

    calculateDynamicTPSL(entry, atr, side) {
        const slMult = RISK_CONFIG.getSLATRMult(RISK_CONFIG.riskAmount, RISK_CONFIG.customSLATRMult);
        const tpMult = slMult * CVD_CONFIG.dynamicRR;
        
        return {
            tp: side === 'long' ? entry + (atr * tpMult) : entry - (atr * tpMult),
            sl: side === 'long' ? entry - (atr * slMult) : entry + (atr * slMult)
        };
    }
}