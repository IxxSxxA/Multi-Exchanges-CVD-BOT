// strategy/atr.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Calcolo dell'ATR (Average True Range)
export function calculateATR(candles, atrLen) {
    if (!Array.isArray(candles) || candles.length < atrLen) {
        if (GENERAL_CONFIG.debug) {
            console.log(chalk.yellow(`[DEBUG] Candele insufficienti per ATR: ${candles.length}/${atrLen}`));
        }
        return 0;
    }

    // Usa solo le ultime atrLen candele
    const recentCandles = candles.slice(-atrLen);

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
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / atrLen;

    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] ATR calcolato: ${atr.toFixed(2)} (periodi: ${atrLen})`));
    }

    return atr;
}