// strategy/candleAggregator.js
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { STRATEGY, GENERAL_CONFIG } from './configStrategy.js';

// Funzione per aggregare candele
export async function aggregateCandles(sourcePath, targetPath, chartTF) {
    
    console.log(chalk.yellow('***************************************************************************'));
    console.log(chalk.cyan(`Aggregazione candele da 1m a ${chartTF}m...`));

    try {
        // Leggi le candele da 1m
        const rawData = await fs.readFile(sourcePath, 'utf-8');
        const candles1m = JSON.parse(rawData);

        if (!Array.isArray(candles1m) || candles1m.length === 0) {
            console.error(chalk.red('Nessuna candela valida trovata nel file sorgente.'));
            return;
        }

        // Aggrega candele
        const candlesAggregated = [];
        const tfMs = chartTF * 60 * 1000; // Timeframe in millisecondi

        for (let i = 0; i < candles1m.length; i += chartTF) {
            const chunk = candles1m.slice(i, i + chartTF);
            if (chunk.length === 0) break;

            const aggregatedCandle = {
                open: chunk[0].open,
                high: Math.max(...chunk.map(c => c.high)),
                low: Math.min(...chunk.map(c => c.low)),
                close: chunk[chunk.length - 1].close,
                vBuy: chunk.reduce((sum, c) => sum + c.vBuy, 0),
                vSell: chunk.reduce((sum, c) => sum + c.vSell, 0),
                timestamp: Math.floor(chunk[0].timestamp / tfMs) * tfMs,
            };

            candlesAggregated.push(aggregatedCandle);
        }

        // Log di debug per le prime 3 candele aggregate
        if (GENERAL_CONFIG.debug && candlesAggregated.length > 0) {
            console.log(chalk.gray('[DEBUG] Prime 3 candele aggregate:'));
            candlesAggregated.slice(0, 3).forEach((candle, index) => {
                console.log(chalk.gray(`Candela ${index + 1}: ${JSON.stringify({
                    timestamp: new Date(candle.timestamp).toISOString(),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    vBuy: candle.vBuy,
                    vSell: candle.vSell
                }, null, 2)}`));
            });
        }

        // Salva le candele aggregate
        await fs.writeFile(targetPath, JSON.stringify(candlesAggregated, null, 2));
        console.log(chalk.green(`Candele aggregate salvate in ${targetPath} (${candlesAggregated.length} candele)`));
        console.log(chalk.yellow('***************************************************************************'));
    } catch (error) {
        console.error(chalk.red(`Errore nell'aggregazione delle candele: ${error.message}`));
        throw error;
    }
}