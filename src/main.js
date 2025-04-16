// src/main.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { dataAggregator } from './dataAggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[MAIN] Starting Multi-Exchanges-CVD-BOT with ES Modules');
console.log('[MAIN] Configuration:', {
    pair: config.pair,
    marketType: config.marketType,
    candleInterval: config.candleInterval
});

class Main {
    constructor() {
        this.exchanges = {};
        this.initFilesystem();
        this.loadExchanges();
    }

    async initFilesystem() {
        try {
            // Ensure directories exist
            await this.ensureDirectory(config.dataPaths.candles);
            await this.ensureDirectory(config.dataPaths.logs);
            
            // Clean directories
            await this.cleanDirectory(config.dataPaths.candles);
            await this.cleanDirectory(config.dataPaths.logs);
            
            // Initialize fresh files
            await this.initializeCandleFile(`candles_${config.candleInterval}.json`, '[]');
            await this.initializeCandleFile('current_candle.json', JSON.stringify({
                open: 0,
                high: 0,
                low: 0,
                close: 0,
                vBuy: 0,
                vSell: 0,
                timestamp: Date.now()
            }));
            
            console.log('[MAIN] Filesystem initialized successfully');
        } catch (err) {
            console.error('[MAIN] Filesystem initialization error:', err);
            process.exit(1);
        }
    }

    async ensureDirectory(dirPath) {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
            console.log(`[MAIN] Directory ensured: ${dirPath}`);
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    async cleanDirectory(dirPath) {
        try {
            const files = await fs.promises.readdir(dirPath);
            const deletePromises = files.map(file => 
                fs.promises.unlink(path.join(dirPath, file))
            );
            await Promise.all(deletePromises);
            console.log(`[MAIN] Cleaned directory: ${dirPath} (${files.length} files removed)`);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
    }

    async initializeCandleFile(filename, defaultContent) {
        const filePath = path.join(config.dataPaths.candles, filename);
        await fs.promises.writeFile(filePath, defaultContent);
        console.log(`[MAIN] Initialized ${filename} with fresh data`);
    }

    async loadExchanges() {
        const exchangesDir = config.dataPaths.exchanges;
        
        try {
            const exchangeFiles = (await fs.promises.readdir(exchangesDir))
                .filter(file => file.endsWith('.js'));
            
            if (exchangeFiles.length === 0) {
                console.warn('[MAIN] No exchange implementations found in exchanges/ directory');
                return;
            }

            console.log(`[MAIN] Found ${exchangeFiles.length} exchange files`);
            
            for (const file of exchangeFiles) {
                const exchangeName = file.replace('.js', '');
                if (config.exchanges[exchangeName]?.enabled) {
                    try {
                        console.log(`[MAIN] Loading exchange ${exchangeName}...`);
                        const module = await import(path.join(exchangesDir, file));
                        const ExchangeClass = module.default;
                        this.exchanges[exchangeName] = new ExchangeClass(
                            config.pair,
                            config.marketType,
                            (exchange, trade) => {
                                console.log(`[MAIN] Received trade from ${exchange}`);
                                dataAggregator.processTrade(exchange, trade);
                            }
                        );
                    } catch (err) {
                        console.error(`[MAIN] Error loading exchange ${exchangeName}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error('[MAIN] Error reading exchanges directory:', err);
        }
    }
}

new Main();