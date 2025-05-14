// ../strategy/candleAggregator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const aggregateCandles = (timeframeMinutes, candles = null) => {
    // Add validation for timeframeMinutes
    if (!timeframeMinutes || timeframeMinutes < 1) {
        logger.error(`Timeframe non valido: ${timeframeMinutes}`);
        throw new Error('Timeframe deve essere maggiore di 0');
    }

    const sourceFile = path.resolve(__dirname, 'data', 'candles_1m.json');
    const targetFile = path.resolve(__dirname, 'data', `candles_${timeframeMinutes}m.json`);

    // Carica candele se non fornite
    let rawCandles = candles;
    if (!rawCandles) {
        if (!fs.existsSync(sourceFile)) {
            logger.error(`File sorgente ${sourceFile} non trovato per aggregazione.`);
            throw new Error(`File sorgente ${sourceFile} non trovato.`);
        }
        rawCandles = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    }

    // Add validation for rawCandles
    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
        logger.error('Nessuna candela da aggregare');
        throw new Error('Nessuna candela da aggregare');
    }

    // Sort candles by timestamp before aggregating
    rawCandles.sort((a, b) => a.timestamp - b.timestamp);

    // Aggrega candele
    const timeframeMs = timeframeMinutes * 60 * 1000;
    const aggregatedCandles = [];
    let currentCandle = null;
    let startTime = null;

    rawCandles.forEach(candle => {
        const candleTime = Math.floor(candle.timestamp / timeframeMs) * timeframeMs;

        if (!startTime || candleTime >= startTime + timeframeMs) {
            if (currentCandle) {
                aggregatedCandles.push(currentCandle);
            }
            currentCandle = {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                vBuy: candle.vBuy,
                vSell: candle.vSell,
                timestamp: candleTime
            };
            startTime = candleTime;
        } else {
            currentCandle.high = Math.max(currentCandle.high, candle.high);
            currentCandle.low = Math.min(currentCandle.low, candle.low);
            currentCandle.close = candle.close;
            currentCandle.vBuy += candle.vBuy;
            currentCandle.vSell += candle.vSell;
        }
    });

    if (currentCandle) {
        aggregatedCandles.push(currentCandle);
    }

    // Salva candele aggregate
    fs.writeFileSync(targetFile, JSON.stringify(aggregatedCandles, null, 2));
    logger.info(`Aggregate ${aggregatedCandles.length} candele per ${timeframeMinutes}m, salvate in ${targetFile}`);

    return aggregatedCandles;
};