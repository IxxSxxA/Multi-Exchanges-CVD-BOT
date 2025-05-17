// strategy/fvg.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Stub per rilevare FVG
export function detectFVG(candle, prevCandles) {
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.magenta(`[FVG.JS] (TEST SIGNALS) Segnale FVG per candela @ ${new Date(candle.timestamp).toISOString()} generato in fvg.js`));
    }

    // Simula un FVG con probabilità del 70%
    const random = Math.random();
    if (random < 0.7) {
        const isBull = Math.random() < 0.5;
        const priceRange = candle.high - candle.low;
        const fvg = {
            max: isBull ? candle.low + priceRange * 0.6 : candle.high,
            min: isBull ? candle.low : candle.high - priceRange * 0.6,
            startTime: candle.timestamp,
            isBull,
        };
        if (GENERAL_CONFIG.debug) {
            // console.log(chalk.magenta(`[FVG.JS] (TEST SIGNALS) FVG generato @ ${new Date(candle.timestamp).toISOString()} ${JSON.stringify(fvg)}`));
            console.log(chalk.magenta(`[FVG.JS] (TEST SIGNALS) FVG ${JSON.stringify(fvg)}`));
        }
        return isBull ? { bullishFVG: fvg, bearishFVG: null } : { bullishFVG: null, bearishFVG: fvg };
    }

    return { bullishFVG: null, bearishFVG: null };
}