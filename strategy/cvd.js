// strategy/cvd.js
import chalk from 'chalk';
import { GENERAL_CONFIG, CVD_CONFIG } from './configStrategy.js';
import { STRATEGY } from './configStrategy.js';

// Calcola il delta volume per ogni candela
function getLastVolume(candle) {
    return candle.vBuy - candle.vSell;
}

// Funzioni di utilità per crossover/crossunder
function crossover(arr, threshold = 0) {
    if (arr.length < 2) return false;
    return arr[arr.length - 2] < threshold && arr[arr.length - 1] >= threshold;
}

function crossunder(arr, threshold = 0) {
    if (arr.length < 2) return false;
    return arr[arr.length - 2] > threshold && arr[arr.length - 1] <= threshold;
}

function getPolarizedDelta(candle, prevCandle, prevIsBuyVolume) {
    let isBuyVolume = true;
    if (!prevCandle) {
        // Prima candela: considera buy di default
        isBuyVolume = true;
    } else if (candle.close > candle.open) {
        isBuyVolume = true;
    } else if (candle.close < candle.open) {
        isBuyVolume = false;
    } else if (candle.close === candle.open && candle.close > prevCandle.close) {
        isBuyVolume = true;
    } else if (candle.close === candle.open && candle.close < prevCandle.close) {
        isBuyVolume = false;
    } else {
        isBuyVolume = prevIsBuyVolume;
    }
    // Usa il volume totale della candela (o vBuy/vSell se vuoi)
    const volume = candle.volume || ((candle.vBuy || 0) + (candle.vSell || 0));
    return {
        delta: isBuyVolume ? volume : -volume,
        isBuyVolume
    };
}

// Funzione principale per segnali CVD
export function getCVDSignals(candle, prevCandles) {
    // Array dei lastVolume (delta volume) delle ultime due candele
    const lastVolumes = [
        prevCandles.length > 0 ? getLastVolume(prevCandles[prevCandles.length - 1]) : 0,
        getLastVolume(candle)
    ];

    let bullishSignal = false;
    let bearishSignal = false;
    const signalType = CVD_CONFIG.signalType || 'Raw'; // "Advanced" o "Raw"

    if (signalType === 'Advanced') {
        if (
            candle.close > candle.open &&
            crossunder(lastVolumes, 0)
        ) {
            bearishSignal = true;
        }
        if (
            candle.close < candle.open &&
            crossover(lastVolumes, 0)
        ) {
            bullishSignal = true;
        }
    } else {
        if (crossunder(lastVolumes, 0)) {
            bearishSignal = true;
        }
        if (crossover(lastVolumes, 0)) {
            bullishSignal = true;
        }
    }

    return {
        isBullishSignal: bullishSignal,
        isBearishSignal: bearishSignal,
    };
}

// candles: array di candele 1m ordinate per timestamp crescente
// Restituisce un array di oggetti, uno per ogni barra chartTF
export function computeCVDByAnchorPeriod(candles) {
    const chartTF = STRATEGY.getChartTF(); // es: 3
    const anchorPeriod = STRATEGY.getAnchorPeriod(); // es: 5
    const chartTFMillis = chartTF * 60 * 1000;
    const anchorMillis = anchorPeriod * 60 * 1000;

    let result = [];
    let anchorStart = null;
    let cvd = 0;
    let hiVolume = 0;
    let loVolume = 0;
    let openVolume = 0;
    let prevCandle = null;
    let prevIsBuyVolume = true;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const ts = c.timestamp;

        // Inizia nuovo anchor period se serve
        if (anchorStart === null || ts >= anchorStart + anchorMillis) {
            anchorStart = ts - (ts % anchorMillis);
            openVolume = 0;
            cvd = 0;
            hiVolume = 0;
            loVolume = 0;
        }

        // Calcola delta polarizzato
        const { delta, isBuyVolume } = getPolarizedDelta(c, prevCandle, prevIsBuyVolume);
        prevIsBuyVolume = isBuyVolume;
        prevCandle = c;

        cvd += delta;
        hiVolume = Math.max(hiVolume, cvd);
        loVolume = Math.min(loVolume, cvd);

        // Se questa candela è la fine di una barra chartTF, salva i dati
        if ((ts - anchorStart) % chartTFMillis === chartTFMillis - 60 * 1000) {
            result.push({
                timestamp: ts,
                openVolume,
                hiVolume,
                loVolume,
                lastVolume: cvd
            });
        }
    }
    return result;
}