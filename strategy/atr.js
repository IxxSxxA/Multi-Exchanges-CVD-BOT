// strategy/atr.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Calcola la RMA (Running Moving Average) come in Pine Script
function calculateRMA(values, period) {
    if (values.length < period) return 0;
    const alpha = 1 / period;
    let rma = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period; // Sma iniziale
    for (let i = period; i < values.length; i++) {
        rma = alpha * values[i] + (1 - alpha) * rma;
    }
    return rma;
}

// Calcolo ATR fedele a TradingView
export function calculateATR(candles, period) {
    if (!Array.isArray(candles) || candles.length < period) {
        if (GENERAL_CONFIG.debug) {
            console.log(chalk.blue(`[ATR.JS] Candele insufficienti per ATR: ${candles.length}/${period}`));
        }
        return 0;
    }

    // Calcola True Range per ogni candela
    const trueRanges = candles.map((candle, i) => {
        if (i === 0) return candle.high - candle.low;
        const prevCandle = candles[i - 1];
        return Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - prevCandle.close),
            Math.abs(candle.low - prevCandle.close)
        );
    });

    // Calcola ATR come RMA dei True Range
    const atr = calculateRMA(trueRanges, period);

    if (GENERAL_CONFIG.debug) {
        console.log(chalk.blue(`[ATR.JS] ATR (RMA) ${atr.toFixed(2)} Periods ${period}`));
    }

    return atr;
}