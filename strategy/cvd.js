// strategy/cvd.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Stub per segnali CVD
export function getCVDSignals(candle, prevCandles) {
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] Simulazione segnali CVD per candela @ ${new Date(candle.timestamp).toISOString()}`));
    }

    // Simula segnali con probabilità del 60%
    const random = Math.random();
    const signals = {
        isBullishSignal: random < 0.3, // 30%
        isBearishSignal: random >= 0.3 && random < 0.6, // 30%
    };
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] Segnali generati: bullish=${signals.isBullishSignal}, bearish=${signals.isBearishSignal}`));
    }
    return signals;
}