// strategy/fvg.js
import chalk from 'chalk';
import { GENERAL_CONFIG } from './configStrategy.js';

// Rileva FVG su una candela, usando le ultime 3 candele
export function detectFVG(candle, prevCandles) {
    if (prevCandles.length < 2) {
        return { bullishFVG: null, bearishFVG: null };
    }

    const c0 = candle;
    const c1 = prevCandles[prevCandles.length - 1];
    const c2 = prevCandles[prevCandles.length - 2];

    // Calcola ATR (puoi usare una funzione esterna se già presente)
    const closes = [c2.close, c1.close, c0.close];
    const highs = [c2.high, c1.high, c0.high];
    const lows = [c2.low, c1.low, c0.low];
    const atr = Math.max(...highs) - Math.min(...lows); // Semplificato, meglio usare una funzione ATR

    // FVG Bars Check (tutte bullish o tutte bearish se richiesto)
    let fvgBarsCheck = false;
    if (GENERAL_CONFIG.fvgBars === "Same Type") {
        if (
            (c0.open > c0.close && c1.open > c1.close && c2.open > c2.close) ||
            (c0.open <= c0.close && c1.open <= c1.close && c2.open <= c2.close)
        ) {
            fvgBarsCheck = true;
        }
    } else {
        fvgBarsCheck = true;
    }

    // Dimensione barre
    const firstBarSize = Math.abs(c0.open - c0.close);
    const secondBarSize = Math.abs(c1.open - c1.close);
    const thirdBarSize = Math.abs(c2.open - c2.close);
    const barSizeSum = firstBarSize + secondBarSize + thirdBarSize;

    // Filtro dimensione FVG
    const fvgSensitivity = GENERAL_CONFIG.fvgSensitivity || 1.5;
    const FVGSizeEnough = (barSizeSum * fvgSensitivity > atr / 1.5);

    // Condizioni FVG
    const bearFVG = c0.high < c2.low && c1.close < c2.low && fvgBarsCheck && FVGSizeEnough;
    const bullFVG = c0.low > c2.high && c1.close > c2.high && fvgBarsCheck && FVGSizeEnough;

    // Esporta FVG se trovato
    if (bearFVG) {
        const fvg = {
            max: c2.low,
            min: c0.high,
            isBull: false,
            startTime: c0.timestamp,
            totalVolume: (c0.volume || 0) + (c1.volume || 0) + (c2.volume || 0),
        };
        return { bullishFVG: null, bearishFVG: fvg };
    }
    if (bullFVG) {
        const fvg = {
            max: c0.low,
            min: c2.high,
            isBull: true,
            startTime: c0.timestamp,
            totalVolume: (c0.volume || 0) + (c1.volume || 0) + (c2.volume || 0),
        };
        return { bullishFVG: fvg, bearishFVG: null };
    }

    return { bullishFVG: null, bearishFVG: null };
}