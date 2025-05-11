// ../strategy/cvd.js
import { STRATEGY } from './configStrategy.js';
import logger from './logger.js';

// Converte un timeframe string in secondi
export const timeframeToSeconds = (timeframe) => {
    const match = timeframe.match(/^(\d+)([SMDH]?)$/);
    if (!match) {
        logger.error(`Formato timeframe non valido: ${timeframe}`);
        throw new Error(`Invalid timeframe format: ${timeframe}`);
    }
    const value = parseInt(match[1]);
    const unit = match[2] || 'M';
    switch (unit) {
        case 'S': return value;
        case 'M': return value * 60;
        case 'H': return value * 3600;
        case 'D': return value * 86400;
        default:
            logger.error(`Unità timeframe non supportata: ${unit}`);
            throw new Error(`Unsupported timeframe unit: ${unit}`);
    }
};

// Verifica che lowerTimeframe sia inferiore o uguale al mainTimeframe
export const checkLTF = (lowerTimeframe, mainTimeframe = STRATEGY.chartTF) => {
    const lowerSeconds = timeframeToSeconds(lowerTimeframe);
    const mainSeconds = timeframeToSeconds(mainTimeframe);
    if (lowerSeconds > mainSeconds) {
        logger.error(`Timeframe inferiore non valido: '${lowerTimeframe}' > '${mainTimeframe}'`);
        throw new Error(
            `Invalid lower timeframe: '${lowerTimeframe}'. The timeframe must be lower than or equal to '${mainTimeframe}'`
        );
    }
};

// Calcola volume positivo, negativo e delta per una singola barra
export const upAndDownVolumeCalc = (candles) => {
    let posVol = 0.0;
    let negVol = 0.0;
    let hiVol = 0.0;
    let loVol = 0.0;
    let isBuyVolume = true;

    candles.forEach((candle, index) => {
        const prevCandle = index > 0 ? candles[index - 1] : null;

        if (candle.close > candle.open) {
            isBuyVolume = true;
        } else if (candle.close < candle.open) {
            isBuyVolume = false;
        } else if (prevCandle && candle.close > prevCandle.close) {
            isBuyVolume = true;
        } else if (prevCandle && candle.close < prevCandle.close) {
            isBuyVolume = false;
        }

        const volume = candle.vBuy + candle.vSell;
        if (isBuyVolume) {
            posVol += volume;
        } else {
            negVol -= volume;
        }

        const delta = posVol + negVol;
        hiVol = Math.max(delta, hiVol);
        loVol = Math.min(delta, loVol);
    });

    const delta = posVol + negVol;
    logger.debug(`upAndDownVolumeCalc: posVol=${posVol}, negVol=${negVol}, delta=${delta}, hiVol=${hiVol}, loVol=${loVol}`);
    return [posVol, negVol, delta, hiVol, loVol];
};

// Raggruppa candele per un determinato timeframe
export const groupCandlesByTimeframe = (candles, timeframeSeconds) => {
    const groups = [];
    let currentGroup = [];
    let groupStartTime = null;

    candles.forEach(candle => {
        const candleTime = Math.floor(candle.timestamp / 1000);
        if (!groupStartTime) {
            groupStartTime = candleTime - (candleTime % timeframeSeconds);
            currentGroup.push(candle);
        } else if (candleTime >= groupStartTime + timeframeSeconds) {
            groups.push(currentGroup);
            currentGroup = [candle];
            groupStartTime = candleTime - (candleTime % timeframeSeconds);
        } else {
            currentGroup.push(candle);
        }
    });

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    logger.debug(`groupCandlesByTimeframe: Creati ${groups.length} gruppi per timeframe ${timeframeSeconds}s`);
    return groups;
};

// Aggrega candele a un timeframe specificato
export const aggregateCandlesToTimeframe = (candles, timeframeSeconds) => {
    const aggregated = [];
    let currentCandle = null;
    let startTime = null;

    candles.forEach(candle => {
        const candleTime = Math.floor(candle.timestamp / 1000);
        const bucketTime = candleTime - (candleTime % timeframeSeconds);

        if (!startTime || bucketTime >= startTime + timeframeSeconds) {
            if (currentCandle) {
                aggregated.push(currentCandle);
            }
            currentCandle = {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                vBuy: candle.vBuy,
                vSell: candle.vSell,
                timestamp: bucketTime * 1000
            };
            startTime = bucketTime;
        } else {
            currentCandle.high = Math.max(currentCandle.high, candle.high);
            currentCandle.low = Math.min(currentCandle.low, candle.low);
            currentCandle.close = candle.close;
            currentCandle.vBuy += candle.vBuy;
            currentCandle.vSell += candle.vSell;
        }
    });

    if (currentCandle) {
        aggregated.push(currentCandle);
    }

    logger.debug(`aggregateCandlesToTimeframe: Aggregate ${aggregated.length} candele per timeframe ${timeframeSeconds}s`);
    return aggregated;
};

// Richiede volume delta da un timeframe inferiore
export const requestVolumeDelta = (candles, lowerTimeframe, cumulativePeriod = STRATEGY.anchorPeriod) => {
    if (!candles || candles.length === 0) {
        logger.error('Nessuna candela fornita per requestVolumeDelta');
        throw new Error('No candles provided');
    }

    const mainTimeframe = STRATEGY.chartTF;
    checkLTF(lowerTimeframe, mainTimeframe);

    const lowerTimeframeSeconds = timeframeToSeconds(lowerTimeframe);
    const cumulativePeriodSeconds = cumulativePeriod ? timeframeToSeconds(cumulativePeriod) : null;

    const lowerCandles = lowerTimeframeSeconds === 60 ? candles : aggregateCandlesToTimeframe(candles, lowerTimeframeSeconds);

    const [posVol, negVol, delta, maxVolume, minVolume] = upAndDownVolumeCalc(lowerCandles);

    let openVolume = 0.0;
    let hiVolume = 0.0;
    let loVolume = 0.0;
    let lastVolume = 0.0;

    if (cumulativePeriodSeconds) {
        const cumulativeGroups = groupCandlesByTimeframe(candles, cumulativePeriodSeconds);
        const currentCumulativeGroup = cumulativeGroups[cumulativeGroups.length - 1] || [];
        const prevCumulativeGroup = cumulativeGroups[cumulativeGroups.length - 2] || [];

        const anchorChange = currentCumulativeGroup.length === 1 && cumulativeGroups.length > 1;

        let cumulativeDelta = 0.0;
        currentCumulativeGroup.forEach(candle => {
            cumulativeDelta += (candle.vBuy - candle.vSell);
        });

        openVolume = anchorChange ? 0.0 : prevCumulativeGroup.reduce((sum, c) => sum + (c.vBuy - c.vSell), 0) || 0;
        lastVolume = openVolume + cumulativeDelta;
        hiVolume = openVolume + maxVolume;
        loVolume = openVolume + minVolume;
    } else {
        openVolume = 0.0;
        lastVolume = delta;
        hiVolume = maxVolume;
        loVolume = minVolume;
    }

    logger.debug(`requestVolumeDelta: openVolume=${openVolume}, hiVolume=${hiVolume}, loVolume=${loVolume}, lastVolume=${lastVolume}`);
    return [openVolume, hiVolume, loVolume, lastVolume];
};