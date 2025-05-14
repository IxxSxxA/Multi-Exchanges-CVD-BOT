// ../strategy/runStrategy.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkData, readCandles } from './checkData.js';
import { aggregateCandles } from './candleAggregator.js';
import { Strategy } from './strategy.js';
import { STRATEGY, FILE_MANAGER_CONFIG, validateConfig } from './configStrategy.js';
import logger from './logger.js';

// Ottieni __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runStrategy = async () => {
    try {
        console.log('Starting strategy execution...');
        console.log('sourceCandleFile:', FILE_MANAGER_CONFIG.sourceCandleFile);
        console.log('targetDataDir:', FILE_MANAGER_CONFIG.targetDataDir);
        console.log('targetCandleFile:', FILE_MANAGER_CONFIG.targetCandleFile);

        // Validate configuration
        validateConfig();
        
        logger.info('Running checkData...');
        const { chartTFFile, anchorPeriodFile, targetFile } = await checkData();
        logger.info('CheckData completed');

        // Debug paths
        logger.info('Files prepared:');
        logger.info(`- Chart TF file: ${chartTFFile}`);
        logger.info(`- Anchor period file: ${anchorPeriodFile}`);
        logger.info(`- Target file: ${targetFile}`);

        // Initialize strategy components
        let chartTFCandles = await readCandles(chartTFFile);
        let anchorPeriodCandles = await readCandles(anchorPeriodFile);
        const strategy = new Strategy();
        const backtestResults = [];

        // Run initial backtest
        if (chartTFCandles.length > 0) {
            logger.info(`Starting backtest with ${chartTFCandles.length} candles`);
            for (const [index, candle] of chartTFCandles.entries()) {
                const result = await processCandle(strategy, candle, anchorPeriodCandles, index, 'backtest');
                backtestResults.push(result);
            }
            logger.info('Backtest completed');
        }

        // Start continuous monitoring
        logger.info('Starting live monitoring mode...');
        let lastProcessedTime = chartTFCandles[chartTFCandles.length - 1]?.timestamp || 0;

        // Use setInterval for continuous monitoring
        setInterval(async () => {
            try {
                // Copy latest data
                fs.copyFileSync(targetFile, targetFile); // Already handled by checkData
                logger.debug('Updated candle data copied');

                // Read and filter new candles
                const newCandles = await readCandles(targetFile);
                const newCandlesFiltered = newCandles.filter(c => c.timestamp > lastProcessedTime);

                if (newCandlesFiltered.length > 0) {
                    logger.info(`Processing ${newCandlesFiltered.length} new candles`);

                    // Update aggregated timeframes
                    await aggregateCandles(STRATEGY.getChartTF());
                    await aggregateCandles(STRATEGY.getAnchorPeriod());

                    // Reload aggregated candles
                    chartTFCandles = await readCandles(chartTFFile);
                    anchorPeriodCandles = await readCandles(anchorPeriodFile);

                    // Process new candles
                    for (const candle of newCandlesFiltered) {
                        const result = await processCandle(strategy, candle, anchorPeriodCandles, null, 'live');
                        if (result.trades.length > 0) {
                            logger.info(`New trade: ${JSON.stringify(result.trades[0])}`);
                        }
                    }

                    lastProcessedTime = newCandlesFiltered[newCandlesFiltered.length - 1].timestamp;
                }
            } catch (error) {
                logger.error(`Live processing error: ${error.message}`);
                // Don't throw here to keep the interval running
            }
        }, FILE_MANAGER_CONFIG.checkInterval);

    } catch (error) {
        logger.error(`Strategy execution failed: ${error.stack}`);
        process.exit(1);
    }
};

const runBacktest = async (strategy, chartTFCandles, anchorPeriodCandles, results) => {
    logger.info(`Starting backtest with ${chartTFCandles.length} candles`);
    
    for (const [index, candle] of chartTFCandles.entries()) {
        const result = await processCandle(strategy, candle, anchorPeriodCandles, index, 'backtest');
        results.push(result);
    }
    
    await saveBacktestResults(results);
};

const runLiveTrading = async (strategy, chartTFCandles, anchorPeriodCandles, targetFile, chartTFFile, anchorPeriodFile, checkInterval) => {
    logger.info('Switching to live mode...');
    let lastProcessedTimestamp = getLastProcessedTimestamp(chartTFCandles);

    return setInterval(async () => {
        try {
            const newCandles = await loadAndFilterNewCandles(targetFile, lastProcessedTimestamp);
            if (newCandles.length === 0) return;

            const updatedCandles = await updateAggregatedCandles(newCandles, chartTFFile, anchorPeriodFile);
            await processNewCandles(strategy, updatedCandles, lastProcessedTimestamp);
            
            lastProcessedTimestamp = getLastProcessedTimestamp(updatedCandles.chartTFCandles);
        } catch (error) {
            logger.error(`Live trading error: ${error.message}`);
        }
    }, checkInterval);
};

async function processCandle(strategy, candle, anchorCandles, index, mode) {
    logger.debug(`Processing ${mode} candle ${index}: ${JSON.stringify(candle)}`);
    
    const result = await strategy.processCandles(candle, anchorCandles);
    
    if (result?.trades?.length > 0) {
        await saveTrade(result.trades[result.trades.length - 1], mode);
    }
    
    return {
        timestamp: candle.timestamp,
        state: result?.state || 'unknown',
        balance: result?.balance || 0,
        position: result?.position || null,
        trades: result?.trades?.slice(-1) || []
    };
}

// Execute the async function
runStrategy().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

export default runStrategy;