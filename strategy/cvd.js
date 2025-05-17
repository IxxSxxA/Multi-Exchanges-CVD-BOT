// strategy/cvd.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Stub per Segnale CVD
export function getCVDSignals(candle, prevCandles) {
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.magenta(`[CVD.JS] (TEST SIGNALS) Segnale CVD per candela @ ${new Date(candle.timestamp).toISOString()} generato in cvd.js`));
    }

    // Simula Segnale con probabilità del 60%
    const random = Math.random();
    const signals = {
        isBullishSignal: random < 0.3, // 30%
        isBearishSignal: random >= 0.3 && random < 0.6, // 30%
    };
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.magenta(`[CVD.JS] (TEST SIGNALS) Segnale generati -> bullish=${signals.isBullishSignal}, bearish=${signals.isBearishSignal}`));
    }
    return signals;
}