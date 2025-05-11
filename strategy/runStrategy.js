// ../strategy/runStrategy.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkData, readCandles } from './checkData.js';
import { aggregateCandles } from './candleAggregator.js';
import { Strategy } from './strategy.js';
import { STRATEGY, FILE_MANAGER_CONFIG } from './configStrategy.js';
import logger from './logger.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runStrategy = async () => {
    try {
        // Leggi chartTF, anchorPeriod e checkInterval
        const { chartTF, anchorPeriod } = STRATEGY;
        const { checkInterval, targetDataDir } = FILE_MANAGER_CONFIG;

        // Validazione timeframe
        if (parseInt(anchorPeriod) <= parseInt(chartTF)) {
            logger.error('anchorPeriod deve essere maggiore di chartTF.');
            throw new Error('anchorPeriod deve essere maggiore di chartTF.');
        }

        // Esegui checkData per copiare e aggregare candele
        const { chartTFFile, anchorPeriodFile, targetFile } = checkData();

        // Carica i dati delle candele
        let chartTFCandles = await readCandles(chartTFFile);
        let anchorPeriodCandles = await readCandles(anchorPeriodFile);

        // Inizializza la strategia
        const strategy = new Strategy();
        const backtestResults = [];

        // Backtest: loop su tutte le candele
        if (chartTFCandles.length > 0) {
            logger.info(`Inizio backtest con ${chartTFCandles.length} candele (chartTF: ${chartTF}m)`);
            chartTFCandles.forEach((candle, index) => {
                console.log('')
                console.log('****************************************************************')
                logger.info(`Processing index candle number ${index}`);
                const result = strategy.processCandles(candle, anchorPeriodCandles);
                backtestResults.push({
                    timestamp: candle.timestamp,
                    state: result.state,
                    balance: result.balance,
                    position: result.position,
                    trades: result.trades.slice(-1)
                });
            });

            // Salva i risultati del backtest
            const backtestOutputFile = path.resolve(targetDataDir, 'backtest_results.json');
            fs.writeFileSync(backtestOutputFile, JSON.stringify(backtestResults, null, 2));
            logger.info(`Backtest completato. Risultati salvati in ${backtestOutputFile}`);
            logger.info(`Bilancio finale backtest: ${strategy.balance}`);
        } else {
            logger.info('Nessuna candela storica trovata, passaggio diretto alla modalità live.');
        }

        // Modalità live: controlla nuove candele ogni checkInterval
        logger.info('Passaggio alla modalità live...');
        let lastProcessedTimestamp = chartTFCandles.length > 0 ? chartTFCandles[chartTFCandles.length - 1].timestamp : 0;
        let liveCandleIndex = chartTFCandles.length; // Continua l'indice dal backtest

        setInterval(async () => {
            try {
                // Ricarica candele a 1m
                const newCandles1m = await readCandles(targetFile);

                // Filtra nuove candele
                const newCandles = newCandles1m.filter(candle => candle.timestamp > lastProcessedTimestamp);
                if (newCandles.length === 0) {
                    return;
                }

                logger.info(`Rilevate ${newCandles.length} nuove candele...`);

                // Aggiorna candele aggregate
                chartTFCandles = aggregateCandles(parseInt(chartTF), newCandles1m);
                anchorPeriodCandles = aggregateCandles(parseInt(anchorPeriod), newCandles1m);

                // Salva candele aggregate aggiornate
                fs.writeFileSync(chartTFFile, JSON.stringify(chartTFCandles, null, 2));
                fs.writeFileSync(anchorPeriodFile, JSON.stringify(anchorPeriodCandles, null, 2));

                // Processa nuove candele
                for (const candle of chartTFCandles.filter(c => c.timestamp > lastProcessedTimestamp)) {
                    logger.info(`\nIndex candle number ${liveCandleIndex}`);
                    const result = strategy.processCandles(candle, anchorPeriodCandles);
                    logger.info(`Live - Stato: ${result.state}, Bilancio: ${result.balance}`);

                    // Salva trade live
                    if (result.trades.length > 0 && result.trades[result.trades.length - 1].status === 'open') {
                        const liveTradesFile = path.resolve(targetDataDir, 'live_trades.json');
                        fs.appendFileSync(liveTradesFile, JSON.stringify(result.trades.slice(-1), null, 2) + '\n');
                    }
                    liveCandleIndex++;
                }

                // Aggiorna l'ultimo timestamp processato
                lastProcessedTimestamp = chartTFCandles[chartTFCandles.length - 1]?.timestamp || lastProcessedTimestamp;
            } catch (error) {
                logger.error(`Errore in modalità live: ${error.message}`);
            }
        }, checkInterval);

        logger.info(`In ascolto per nuove candele ogni ${checkInterval / 1000} secondi...`);

        // Mantieni il processo attivo
        await new Promise(resolve => {});
    } catch (error) {
        logger.error(`Errore nell'esecuzione della strategia: ${error.message}`);
    }
};

// Avvia la strategia
runStrategy().catch(error => logger.error(error.message));