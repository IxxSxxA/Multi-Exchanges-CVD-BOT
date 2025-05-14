import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aggregateCandles } from './candleAggregator.js';
import { STRATEGY, FILE_MANAGER_CONFIG } from './configStrategy.js';
import logger from './logger.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const checkData = async () => {
    try {
        logger.info('Starting checkData...');  // Add initial log

        // Resolve absolute paths
        const sourceFile = path.resolve(__dirname, '..', 'candles', 'candles_1m.json');
        const targetDir = path.resolve(__dirname, 'data');
        const targetFile = path.resolve(targetDir, 'candles_1m.json');

        logger.info('Path resolution:');
        logger.info(`Source file: ${sourceFile}`);
        logger.info(`Target directory: ${targetDir}`);
        logger.info(`Target file: ${targetFile}`);

        // Verify source exists
        if (!fs.existsSync(sourceFile)) {
            logger.error(`Source file not found: ${sourceFile}`);
            throw new Error(`Source file not found: ${sourceFile}`);
        }
        logger.info('Source file found');

        // Create target directory
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            logger.info(`Created directory: ${targetDir}`);
        }

        // Copy file with verification
        try {
            fs.copyFileSync(sourceFile, targetFile);
            const copySuccess = fs.existsSync(targetFile);
            logger.info(`File copy ${copySuccess ? 'successful' : 'failed'}`);
        } catch (error) {
            logger.error(`Copy failed: ${error.message}`);
            throw error;
        }

        // Aggregate candles
        const chartTF = STRATEGY.chartTF;
        const anchorPeriod = STRATEGY.anchorPeriod;
        
        const chartTFFile = path.resolve(targetDir, `candles_${chartTF}m.json`);
        const anchorPeriodFile = path.resolve(targetDir, `candles_${anchorPeriod}m.json`);

        logger.info('Starting candle aggregation...');
        await aggregateCandles(parseInt(chartTF));
        await aggregateCandles(parseInt(anchorPeriod));
        logger.info('Candle aggregation completed');

        return { chartTFFile, anchorPeriodFile, targetFile };
    } catch (error) {
        logger.error(`CheckData failed: ${error.stack}`);
        throw error;
    }
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