// ../strategy/candleAggregator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const aggregateCandles = (timeframeMinutes) => {
    const sourceFile = path.resolve(__dirname, '../candles/candles_1m.json');
    const targetDir = path.resolve(__dirname, 'data');
    const targetFile = path.resolve(targetDir, `candles_${timeframeMinutes}m.json`);

    // Controlla se il file sorgente esiste
    if (!fs.existsSync(sourceFile)) {
        throw new Error(`File ${sourceFile} non trovato.`);
    }

    // Carica le candele di 1m
    const candleData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    console.log(`Caricate ${candleData.length} candele di 1m per aggregazione a ${timeframeMinutes}m`);

    // Aggrega le candele
    const aggregatedCandles = [];
    let currentGroup = [];
    const timeframeMs = timeframeMinutes * 60 * 1000; // Timeframe in millisecondi

    for (const candle of candleData) {
        currentGroup.push(candle);

        // Controlla se il gruppo copre il timeframe richiesto
        if (currentGroup.length > 0) {
            const startTime = currentGroup[0].timestamp;
            const endTime = currentGroup[currentGroup.length - 1].timestamp;
            if (endTime - startTime >= timeframeMs) {
                const aggregated = aggregateGroup(currentGroup);
                aggregatedCandles.push(aggregated);
                currentGroup = [];
            }
        }
    }

    // Aggrega eventuali candele rimanenti
    if (currentGroup.length > 0) {
        const aggregated = aggregateGroup(currentGroup);
        aggregatedCandles.push(aggregated);
    }

    // Crea la directory di destinazione se non esiste
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Salva le candele aggregate
    fs.writeFileSync(targetFile, JSON.stringify(aggregatedCandles, null, 2));
    console.log(`Salvate ${aggregatedCandles.length} candele aggregate a ${timeframeMinutes}m in ${targetFile}`);

    return aggregatedCandles;
};

// Aggrega un gruppo di candele in una singola candela
const aggregateGroup = (group) => {
    if (group.length === 0) return null;

    return {
        open: group[0].open,
        high: Math.max(...group.map(c => c.high)),
        low: Math.min(...group.map(c => c.low)),
        close: group[group.length - 1].close,
        vBuy: group.reduce((sum, c) => sum + c.vBuy, 0),
        vSell: group.reduce((sum, c) => sum + c.vSell, 0),
        timestamp: group[0].timestamp // Timestamp della prima candela del gruppo
    };
};