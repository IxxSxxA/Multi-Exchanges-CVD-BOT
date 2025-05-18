// strategy/atr.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Calcolo dell'ATR (Average True Range)
export function calculateATR(candles, period) {
    if (!Array.isArray(candles) || candles.length < period) {
        if (GENERAL_CONFIG.debug) {
            console.log(chalk.blue(`[ATR.JS] Candele insufficienti per ATR: ${candles.length}/${period}`));
        }
        return 0;
    }

    // Usa solo le ultime period candele
    const recentCandles = candles.slice(-period);

    // Calcola il True Range (TR) per ogni candela
    const trueRanges = recentCandles.map((candle, index) => {
        if (index === 0) return candle.high - candle.low; // Prima candela
        const prevCandle = recentCandles[index - 1];
        return Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - prevCandle.close),
            Math.abs(candle.low - prevCandle.close)            
        );
        
    });

    // Calcola la media dei TR
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / period;

    if (GENERAL_CONFIG.debug) {
        
        console.log(chalk.blue(`[ATR.JS] ATR ${atr.toFixed(2)} Periods ${period}`));
    }

    return atr;
}