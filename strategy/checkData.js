// ../strategy/checkData.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aggregateCandles } from './candleAggregator.js';
import { STRATEGY, FILE_MANAGER_CONFIG } from './configStrategy.js';
import logger from './logger.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const checkData = () => {
    const sourceFile = path.resolve(__dirname, FILE_MANAGER_CONFIG.sourceCandleFile);
    const targetDir = path.resolve(__dirname, FILE_MANAGER_CONFIG.targetDataDir);
    const targetFile = path.resolve(targetDir, FILE_MANAGER_CONFIG.targetCandleFile);

    // Controlla se il file sorgente esiste
    if (!fs.existsSync(sourceFile)) {
        logger.error(`File sorgente ${sourceFile} non trovato.`);
        throw new Error(`File sorgente ${sourceFile} non trovato.`);
    }

    // Crea la directory di destinazione se non esiste
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        logger.info(`Creata directory ${targetDir}`);
    }

    // Copia il file nella directory di destinazione
    fs.copyFileSync(sourceFile, targetFile);
    logger.info(`File copiato da ${sourceFile} a ${targetFile}`);

    // Aggrega candele per chartTF e anchorPeriod
    const { chartTF, anchorPeriod } = STRATEGY;
    const chartTFFile = path.resolve(targetDir, `candles_${chartTF}m.json`);
    const anchorPeriodFile = path.resolve(targetDir, `candles_${anchorPeriod}m.json`);

    if (!fs.existsSync(chartTFFile)) {
        logger.info(`Aggregazione candele per chartTF (${chartTF}m)...`);
        aggregateCandles(parseInt(chartTF));
    }
    if (!fs.existsSync(anchorPeriodFile)) {
        logger.info(`Aggregazione candele per anchorPeriod (${anchorPeriod}m)...`);
        aggregateCandles(parseInt(anchorPeriod));
    }

    return { chartTFFile, anchorPeriodFile, targetFile };
};

export const readCandles = (filePath) => {
    if (!fs.existsSync(filePath)) {
        logger.error(`File ${filePath} non trovato.`);
        throw new Error(`File ${filePath} non trovato.`);
    }
    const candleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    logger.info(`Caricate ${candleData.length} candele dal file ${filePath}`);
    return candleData;
};