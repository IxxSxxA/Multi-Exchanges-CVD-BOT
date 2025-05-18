// strategy/runStrategy.js
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'fs';
import chalk from 'chalk';
import { initializeFileManager } from './fileManager.js';
import { aggregateCandles } from './candleAggregator.js';
import { executeStrategy } from './strategyLogic.js';
import { FILE_MANAGER_CONFIG, STRATEGY, CVD_CONFIG, validateConfig } from './configStrategy.js';

// Funzione per leggere le candele
async function readCandles(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(chalk.red(`Errore nella lettura di ${filePath}: ${error.message}`));
        return [];
    }
}

// Funzione per salvare un trade in trades.json
async function saveTrade(trade) {
    const tradesPath = path.resolve(FILE_MANAGER_CONFIG.targetDataDir, 'trades.json');
    let trades = [];
    try {
        const data = await fs.readFile(tradesPath, 'utf-8');
        trades = JSON.parse(data);
    } catch (error) {
        // File non esiste o vuoto, inizializziamo array vuoto
        console.log(chalk.cyan(`[RUN STRATEGY] [INFO] Creazione nuovo file ${tradesPath}`));
    }
    trades.push(trade);
    await fs.writeFile(tradesPath, JSON.stringify(trades, null, 2));
    console.log(chalk.cyan(`[RUN STRATEGY] Trade salvato in ${tradesPath}`));
    
}

// Funzione per eseguire il backtest
async function runBacktest(candles, cvdsList) {
    console.log(chalk.yellow(`[RUN STRATEGY] Avvio backtest con ${candles.length} candele...`));
    
    let balance = STRATEGY.getInitialAmount();
    let trades = 0;
    let wins = 0;

    for (let i = Math.max(1, CVD_CONFIG.atrLenCVDS); i < candles.length; i++) {

        const candle = candles[i];
        const prevCandles = candles.slice(0, i);
        const { buyAlertTick, sellAlertTick, tpAlertTick, slAlertTick, cvdsList: updatedCvdsList } = executeStrategy(candle, prevCandles, cvdsList);

        // Aggiorna il bilancio e statistiche
        if (tpAlertTick || slAlertTick) {
            const lastCVDS = cvdsList[0];
            const profit = lastCVDS.entryType === 'Long'
                ? (lastCVDS.exitPrice - lastCVDS.entryPrice)
                : (lastCVDS.entryPrice - lastCVDS.exitPrice);
            balance += profit;
            trades++;
            if (tpAlertTick) wins++;
            console.log(chalk.cyan(`[RUN STRATEGY] Trade #${trades} ${lastCVDS.entryType} chiuso PNL @ (${profit.toFixed(2)}) -> New Balance ${balance.toFixed(2)}`));




            // console.log(chalk.cyan(`[RUN STRATEGY] Trade #${trades}: ${lastCVDS.entryType} chiuso con profitto ${profit.toFixed(2)}. Bilancio: ${balance.toFixed(2)}`));

/*          LOG A VIDEO DEL TRADE // NON NECESSARIO GIA' GESTITO IN strategyLogic

            if (tpAlertTick) {
                wins++;
                console.log(chalk.cyan(`[RUN STRATEGY] Trade #${trades}: ${lastCVDS.entryType} chiuso in TAKE PROFIT (${profit.toFixed(2)}). Bilancio: ${balance.toFixed(2)}`));
            } else if (slAlertTick) {
                console.log(chalk.red(`[RUN STRATEGY] Trade #${trades}: ${lastCVDS.entryType} chiuso in STOP LOSS (${profit.toFixed(2)}). Bilancio: ${balance.toFixed(2)}`));
            }
*/

            // Salva il trade
            const trade = {
                tradeNumber: trades,
                entryType: lastCVDS.entryType,
                entryPrice: lastCVDS.entryPrice,
                entryTime: new Date(lastCVDS.entryTime).toISOString(),
                exitPrice: lastCVDS.exitPrice,
                exitTime: new Date(lastCVDS.exitTime).toISOString(),
                profit: profit,
                outcome: tpAlertTick ? 'Take Profit' : 'Stop Loss',
                newBalance: balance.toFixed(2),
            };
            await saveTrade(trade);
        }

/*         // Log Segnale
        if (buyAlertTick) console.log(chalk.green(`[RUN STRATEGY] Segnale Buy @ ${new Date(candle.timestamp).toISOString()}`));
        if (sellAlertTick) console.log(chalk.green(`[RUN STRATEGY] Segnale Sell @ ${new Date(candle.timestamp).toISOString()}`));
        if (tpAlertTick) console.log(chalk.blue(`[RUN STRATEGY] Segnale TP @ ${new Date(candle.timestamp).toISOString()}`));
        if (slAlertTick) console.log(chalk.red(`[RUN STRATEGY] Segnale SL @ ${new Date(candle.timestamp).toISOString()}`));
     */
    
    }

    // Report finale
    const winRate = trades > 0 ? (wins / trades * 100).toFixed(2) : 0;

    console.log('');
    console.log(chalk.yellow('*************************************************************************'));
    console.log(chalk.yellow('***************************** BACKTEST DONE *****************************'));
    console.log(chalk.yellow('*************************************************************************'));
    console.log('');

   
    console.log(chalk.cyan(`- Bilancio finale: ${balance.toFixed(2)}`));
    console.log(chalk.cyan(`- Trade totali: ${trades}`));
    console.log(chalk.cyan(`- Trade vincenti: ${wins}`));
    console.log(chalk.cyan(`- Win rate: ${winRate}%`));

    return { balance, trades, wins };
}

// Funzione principale
async function runStrategy() {

    console.log(chalk.yellow('**************************************************************************'));
    console.log(chalk.yellow('*************************** CVD BACKTEST START ***************************'));
    console.log(chalk.yellow('**************************************************************************'));
    console.log('');

    // Valida la configurazione
    try {
        validateConfig();
        console.log(chalk.green('Configurazione validata con successo.'));
    } catch (error) {
        console.error(chalk.red(`Errore di configurazione: ${error.message}`));
        process.exit(1);
    }

    // Inizializza il file manager
    await initializeFileManager();

    // Aggrega le candele al timeframe desiderato
    const chartTF = STRATEGY.getChartTF();
    const sourceCandlePath = path.resolve(FILE_MANAGER_CONFIG.targetDataDir, FILE_MANAGER_CONFIG.targetCandleFile);
    const targetCandlePath = path.resolve(FILE_MANAGER_CONFIG.targetDataDir, `candles_${chartTF}m.json`);
    await aggregateCandles(sourceCandlePath, targetCandlePath, chartTF);

    // Verifica le candele disponibili
    const candles = await readCandles(targetCandlePath);
    const minCandlesForBacktest = 100;

    // Inizializza CDVS
    const cvdsList = [];

    if (candles.length >= minCandlesForBacktest) {
        let { balance, trades, wins } = await runBacktest(candles, cvdsList);

        // await runBacktest(candles, cvdsList);

        // --- CHIUSURA TRADE APERTO PRIMA DELLA LIVE ---
        const lastCVDS = cvdsList[0];
        if (lastCVDS && lastCVDS.state !== 'Done' && lastCVDS.entryPrice !== null) {
            // Forza la chiusura al prezzo di close dell'ultima candela
            lastCVDS.exitPrice = candles[candles.length - 1].close;
            lastCVDS.exitTime = candles[candles.length - 1].timestamp;
            lastCVDS.state = 'Forzato Fine Backtest';
            const profit = lastCVDS.entryType === 'Long'
                ? (lastCVDS.exitPrice - lastCVDS.entryPrice)
                : (lastCVDS.entryPrice - lastCVDS.exitPrice);
            
            // Aggiorno balance
            balance += profit;

            // Leggi il numero di trade già salvati
            let tradesCount = 0;
            try {
                const tradesData = await fs.readFile(path.resolve(FILE_MANAGER_CONFIG.targetDataDir, 'trades.json'), 'utf-8');
                const tradesArr = JSON.parse(tradesData);
                tradesCount = tradesArr.length;
            } catch (e) {
                tradesCount = 0;
            }

            

            const trade = {
                tradeNumber: tradesCount + 1,
                entryType: lastCVDS.entryType,
                entryPrice: lastCVDS.entryPrice,
                entryTime: new Date(lastCVDS.entryTime).toISOString(),
                exitPrice: lastCVDS.exitPrice,
                exitTime: new Date(lastCVDS.exitTime).toISOString(),
                profit: profit,
                outcome: 'Chiusura Forzata',
                newBalance: balance.toFixed(2),
            };
            await saveTrade(trade);

            console.log('');
    // console.log(chalk.yellow('**************************************************************************'));
    console.log(chalk.yellow('************************* ALL TRADES CLOSED NOW **************************'));
    // console.log(chalk.yellow('**************************************************************************'));
    console.log('');

            console.log(chalk.yellow(`[RUN STRATEGY] ALL OPEN POSITIONS CLOSED NOW -> Final Balance ${balance.toFixed(2)}`));
        }
    } else {
        console.log(chalk.yellow(`Candele insufficienti (${candles.length}/${minCandlesForBacktest}). Passaggio a modalità live...`));
    }

    // Modalità live: monitora nuove candele
    console.log('');
    console.log(chalk.yellow('**************************************************************************'));
    console.log(chalk.yellow('***************************** CVD LIVE TRADE *****************************'));
    console.log(chalk.yellow('**************************************************************************'));
    console.log('');

    console.log(chalk.cyan(`Avvio modalità live su ${targetCandlePath}...`));
    
    watch(targetCandlePath, async (eventType) => {
        if (eventType === 'change') {
            console.log(chalk.blue(`Modifica rilevata in ${targetCandlePath}. Elaborazione nuova candela...`));
            const updatedCandles = await readCandles(targetCandlePath);
            if (updatedCandles.length > 0) {
                const latestCandle = updatedCandles[updatedCandles.length - 1];
                const prevCandles = updatedCandles.slice(0, -1);
                const { buyAlertTick, sellAlertTick, tpAlertTick, slAlertTick } = executeStrategy(latestCandle, prevCandles, cvdsList);

/*
                if (buyAlertTick) console.log(chalk.green(`Segnale Buy @ ${new Date(latestCandle.timestamp).toISOString()}`));
                if (sellAlertTick) console.log(chalk.green(`Segnale Sell @ ${new Date(latestCandle.timestamp).toISOString()}`));
                if (tpAlertTick) console.log(chalk.blue(`Segnale TP @ ${new Date(latestCandle.timestamp).toISOString()}`));
                if (slAlertTick) console.log(chalk.red(`Segnale SL @ ${new Date(latestCandle.timestamp).toISOString()}`));
 */

                // Salva il trade in modalità live
                if (tpAlertTick || slAlertTick) {
                    const lastCVDS = cvdsList[0];
                    const profit = lastCVDS.entryType === 'Long'
                        ? (lastCVDS.exitPrice - lastCVDS.entryPrice)
                        : (lastCVDS.entryPrice - lastCVDS.exitPrice);

                    // Leggi il numero di trade già salvati
                    let tradesCount = 0;
                    try {
                        const tradesData = await fs.readFile(path.resolve(FILE_MANAGER_CONFIG.targetDataDir, 'trades.json'), 'utf-8');
                        const tradesArr = JSON.parse(tradesData);
                        tradesCount = tradesArr.length;
                    } catch (e) {
                        tradesCount = 0;
                    }

                    const trade = {
                        tradeNumber: tradesCount + 1,
                        entryType: lastCVDS.entryType,
                        entryPrice: lastCVDS.entryPrice,
                        entryTime: new Date(lastCVDS.entryTime).toISOString(),
                        exitPrice: lastCVDS.exitPrice,
                        exitTime: new Date(lastCVDS.exitTime).toISOString(),
                        profit: profit,
                        outcome: tpAlertTick ? 'Take Profit' : 'Stop Loss',
                    };
                    await saveTrade(trade);
                }
            }
        }
    });
}

runStrategy().catch((error) => {
    console.error(chalk.red(`Errore nell'esecuzione della strategia: ${error.message}`));
    process.exit(1);
});