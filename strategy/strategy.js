// ../strategy/strategy.js
import { FVGDetector } from './fvg.js';
import { requestVolumeDelta } from './cvd.js';
import { calculateATR } from './utils.js';
import { STRATEGY, CVD_CONFIG, RISK_CONFIG } from './configStrategy.js';
import logger from './logger.js';

export class Strategy {
    constructor() {
        this.fvgDetector = new FVGDetector();
        this.state = 'Waiting For CVDS';
        this.position = null;
        this.balance = parseFloat(STRATEGY.initialAmount);
        this.trades = [];
        this.signalThreshold = CVD_CONFIG.signalThreshold || 0;
        this.atrPeriod = CVD_CONFIG.atrLen || 14; // Usa atrLen da CVD_CONFIG
    }

    processCandles(chartCandle, anchorCandles) {
        if (!chartCandle || !anchorCandles) {
            logger.error('Candele non valide fornite a processCandles');
            throw new Error('Candele non valide');
        }

        // Calcola volume delta
        const [openVolume, hiVolume, loVolume, lastVolume] = requestVolumeDelta(
            anchorCandles,
            STRATEGY.chartTF,
            STRATEGY.anchorPeriod
        );

        // Rileva FVG
        const fvgs = this.fvgDetector.processCandles([chartCandle], anchorCandles);

        // Logica CVDS
        switch (this.state) {
            case 'Waiting For CVDS':
                if (this.isBullishSignal(lastVolume)) {
                    this.state = 'Waiting For FVG';
                    logger.info(`Segnale Bullish rilevato: lastVolume=${lastVolume}`);
                } else if (this.isBearishSignal(lastVolume)) {
                    this.state = 'Waiting For FVG';
                    logger.info(`Segnale Bearish rilevato: lastVolume=${lastVolume}`);
                }
                break;

            case 'Waiting For FVG':
                const validFVG = fvgs.find(fvg => 
                    (this.isBullishSignal(lastVolume) && fvg.isBull) ||
                    (this.isBearishSignal(lastVolume) && !fvg.isBull)
                );
                if (validFVG) {
                    this.enterPosition(chartCandle, validFVG, lastVolume, anchorCandles);
                    this.state = 'In Position';
                }
                break;

            case 'In Position':
                if (this.shouldExitPosition(chartCandle)) {
                    this.exitPosition(chartCandle);
                    this.state = 'Waiting For CVDS';
                }
                break;

            default:
                logger.warn(`Stato sconosciuto: ${this.state}`);
                this.state = 'Waiting For CVDS';
        }

        return {
            state: this.state,
            balance: this.balance,
            position: this.position,
            trades: this.trades
        };
    }

    isBullishSignal(lastVolume) {
        return lastVolume > this.signalThreshold;
    }

    isBearishSignal(lastVolume) {
        return lastVolume < -this.signalThreshold;
    }

    enterPosition(candle, fvg, lastVolume, anchorCandles) {
        const side = this.isBullishSignal(lastVolume) ? 'long' : 'short';
        const entryPrice = candle.close;
        const size = this.calculatePositionSize();

        // Calcola ATR per SL/TP dinamico
        const atr = calculateATR(anchorCandles, this.atrPeriod) || 0;
        const atrMultiplier = RISK_CONFIG.getSLATRMult(RISK_CONFIG.riskAmount, RISK_CONFIG.customSLATRMult);
        const slDistance = atr * atrMultiplier;
        const tpDistance = slDistance * 2; // TP è il doppio di SL (rapporto rischio/rendimento 1:2)

        const stopLossPrice = side === 'long' 
            ? entryPrice - slDistance
            : entryPrice + slDistance;
        const takeProfitPrice = side === 'long'
            ? entryPrice + tpDistance
            : entryPrice - tpDistance;

        this.position = {
            side,
            entryPrice,
            size,
            entryTime: candle.timestamp,
            fvg,
            stopLossPrice,
            takeProfitPrice,
            atrUsed: atr
        };

        this.trades.push({
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

    exitPosition(candle, reason = 'FVG Invalidation') {
        if (!this.position) return;

        const exitPrice = candle.close;
        const profit = this.calculateProfitLoss(exitPrice);
        this.balance += profit;

        const trade = this.trades[this.trades.length - 1];
        trade.exitTime = candle.timestamp;
        trade.exitPrice = exitPrice;
        trade.profit = profit;
        trade.status = 'closed';
        trade.exitReason = reason;

        logger.info(`Uscita ${this.position.side} a ${exitPrice}, Profitto: ${profit}, Motivo: ${reason}`);

        this.position = null;
    }

    calculatePositionSize() {
        // Semplificazione: usa 1% del balance
        return this.balance * 0.01 / 100; // Adatta in base al mercato
    }

    calculateProfitLoss(exitPrice) {
        if (!this.position) return 0;
        const { side, entryPrice, size } = this.position;
        const priceDiff = side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
        return priceDiff * size;
    }

    shouldExitPosition(candle) {
        if (!this.position || !this.position.fvg) return false;
        const { side, stopLossPrice, takeProfitPrice, fvg } = this.position;

        // Stop-Loss
        if (side === 'long' && candle.low <= stopLossPrice) {
            this.exitPosition(candle, 'Stop-Loss');
            return true;
        }
        if (side === 'short' && candle.high >= stopLossPrice) {
            this.exitPosition(candle, 'Stop-Loss');
            return true;
        }

        // Take-Profit
        if (side === 'long' && candle.high >= takeProfitPrice) {
            this.exitPosition(candle, 'Take-Profit');
            return true;
        }
        if (side === 'short' && candle.low <= takeProfitPrice) {
            this.exitPosition(candle, 'Take-Profit');
            return true;
        }

        // FVG Invalidation
        if (side === 'long' && candle.low < fvg.min) {
            this.exitPosition(candle, 'FVG Invalidation');
            return true;
        }
        if (side === 'short' && candle.high > fvg.max) {
            this.exitPosition(candle, 'FVG Invalidation');
            return true;
        }

        return false;
    }
}