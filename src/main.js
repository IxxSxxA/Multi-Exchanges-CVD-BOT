const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { aggregateData } = require('./dataAggregator');
const config = require('./config');

// Carica dinamicamente tutti gli exchange dalla cartella exchanges
const exchanges = {};
const exchangeFiles = fs.readdirSync(path.join(__dirname, '../exchanges'));

exchangeFiles.forEach(file => {
    if (file.endsWith('.js')) {
        const exchangeName = file.replace('.js', '');
        exchanges[exchangeName] = require(`../exchanges/${file}`);
    }
});

class CVDBot {
    constructor() {
        this.candles = {};
        this.websockets = {};
        this.initializeTimeframes();
    }

    initializeTimeframes() {
        // Inizializza la struttura dati per i timeframe
        config.timeframes.forEach(tf => {
            this.candles[tf] = {
                open: 0,
                high: 0,
                low: 0,
                close: 0,
                vBuy: 0,
                vSell: 0,
                timestamp: null
            };
        });
    }

    async start() {
        console.log('Starting CVD Bot...');
        
        // Connetti a tutti gli exchange configurati
        for (const [exchangeName, exchangeModule] of Object.entries(exchanges)) {
            if (config.exchanges[exchangeName] && config.exchanges[exchangeName].enabled) {
                console.log(`Connecting to ${exchangeName}...`);
                await this.connectToExchange(exchangeName, exchangeModule);
            }
        }
    }

    async connectToExchange(exchangeName, exchangeModule) {
        try {
            const ws = new WebSocket(exchangeModule.getWebSocketUrl());
            this.websockets[exchangeName] = ws;

            ws.on('open', () => {
                console.log(`Connected to ${exchangeName} WebSocket`);
                ws.send(exchangeModule.subscribeToTrades());
            });

            ws.on('message', (data) => {
                const trade = exchangeModule.parseTradeData(data);
                if (trade) {
                    this.processTrade(trade, exchangeName);
                }
            });

            ws.on('error', (err) => {
                console.error(`${exchangeName} WebSocket error:`, err);
            });

            ws.on('close', () => {
                console.log(`${exchangeName} WebSocket disconnected. Reconnecting...`);
                setTimeout(() => this.connectToExchange(exchangeName, exchangeModule), 5000);
            });

        } catch (err) {
            console.error(`Error connecting to ${exchangeName}:`, err);
        }
    }

    processTrade(trade, exchangeName) {
        // Aggiorna i dati delle candele per ogni timeframe
        config.timeframes.forEach(tf => {
            this.updateCandleData(trade, tf, exchangeName);
        });
    }

    updateCandleData(trade, timeframe, exchangeName) {
        const now = Math.floor(Date.now() / 1000);
        const candleTime = Math.floor(now / (timeframe * 60)) * timeframe * 60;
        
        if (!this.candles[timeframe].timestamp || this.candles[timeframe].timestamp < candleTime) {
            // Nuova candela
            if (this.candles[timeframe].timestamp) {
                // Salva la candela completata
                this.saveCandle(timeframe);
            }
            
            // Inizializza nuova candela
            this.candles[timeframe] = {
                open: trade.price,
                high: trade.price,
                low: trade.price,
                close: trade.price,
                vBuy: trade.side === 'buy' ? trade.volume : 0,
                vSell: trade.side === 'sell' ? trade.volume : 0,
                timestamp: candleTime,
                exchanges: { [exchangeName]: true }
            };
        } else {
            // Aggiorna candela esistente
            const candle = this.candles[timeframe];
            candle.high = Math.max(candle.high, trade.price);
            candle.low = Math.min(candle.low, trade.price);
            candle.close = trade.price;
            
            if (trade.side === 'buy') {
                candle.vBuy += trade.volume;
            } else {
                candle.vSell += trade.volume;
            }
            
            candle.exchanges[exchangeName] = true;
        }
    }

    saveCandle(timeframe) {
        const candle = this.candles[timeframe];
        const fileName = `candles_${timeframe}m.json`;
        const filePath = path.join(__dirname, '../data', fileName);
        
        // Calcola CVD
        candle.cvd = candle.vBuy - candle.vSell;
        
        // Leggi i dati esistenti o inizializza un nuovo array
        let existingData = [];
        try {
            existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(`Error reading ${fileName}:`, err);
            }
        }
        
        // Aggiungi la nuova candela e mantieni solo le ultime N candele
        existingData.push(candle);
        if (existingData.length > config.maxCandlesToStore) {
            existingData = existingData.slice(-config.maxCandlesToStore);
        }
        
        // Salva il file
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        console.log(`Saved ${timeframe}m candle at ${new Date(candle.timestamp * 1000).toISOString()}`);
    }
}

// Avvia il bot
const bot = new CVDBot();
bot.start();