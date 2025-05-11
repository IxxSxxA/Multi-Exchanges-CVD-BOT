// ../strategy/runStrategy.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkData } from './checkData.js';
import { aggregateCandles } from './candleAggregator.js';
import { Strategy } from './strategy.js';
import {
    STRATEGY,
    GENERAL_CONFIG,
    FVG_CONFIG,
    CVD_CONFIG,
    RISK_CONFIG,
    FILE_MANAGER_CONFIG
} from './configStrategy.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runStrategy = () => {
    try {
        // Leggi chartTF e anchorPeriod
        const { chartTF, anchorPeriod } = STRATEGY;

        // Validazione timeframe
        if (parseInt(anchorPeriod) <= parseInt(chartTF)) {
            throw new Error("anchorPeriod deve essere maggiore di chartTF.");
        }

        // Definisci i file di candele necessari
        const chartTFFile = path.resolve(__dirname, 'data', `candles_${chartTF}m.json`);
        const anchorPeriodFile = path.resolve(__dirname, 'data', `candles_${anchorPeriod}m.json`);

        // Verifica e aggrega candele se necessario
        if (!fs.existsSync(chartTFFile)) {
            console.log(`File ${chartTFFile} non trovato, aggregazione in corso...`);
            aggregateCandles(parseInt(chartTF));
        }
        if (!fs.existsSync(anchorPeriodFile)) {
            console.log(`File ${anchorPeriodFile} non trovato, aggregazione in corso...`);
            aggregateCandles(parseInt(anchorPeriod));
        }

        // Carica i dati delle candele
        const chartTFCandles = checkData(chartTFFile);
        const anchorPeriodCandles = checkData(anchorPeriodFile);

        // Inizializza e esegue la strategia
        const strategy = new Strategy();
        const result = strategy.processCandles(chartTFCandles); // Nota: anchorPeriodCandles sarà usato con requestVolumeDelta

        console.log(`Strategia eseguita. Processate ${chartTFCandles.length} candele (chartTF: ${chartTF}m).`);
    } catch (error) {
        console.error("Errore nell'esecuzione della strategia:", error.message);
    }
};

// Avvia la strategia
runStrategy();