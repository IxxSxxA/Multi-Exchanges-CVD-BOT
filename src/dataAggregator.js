// src/dataAggregator.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DataAggregator {
    constructor() {
        this.currentCandle = {
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            vBuy: 0,
            vSell: 0,
            timestamp: this.getCurrentMinuteTimestamp()
        };
        this.candles = [];
        this.candleCount = 0;
        console.log('[AGGREGATOR] Initialized new DataAggregator');
    }

    getCurrentMinuteTimestamp() {
        const now = new Date();
        return now.setSeconds(0, 0);
    }

    processTrade(exchange, trade) {
        const tradeTimestamp = new Date(trade.timestamp).setSeconds(0, 0);
        
        if (tradeTimestamp !== this.currentCandle.timestamp) {
            console.log(`[AGGREGATOR] New candle detected (${new Date(tradeTimestamp).toISOString()})`);
            this.saveCompletedCandle();
            this.initNewCandle(tradeTimestamp, trade.price);
        }

        this.updateCurrentCandle(trade);
    }

    initNewCandle(timestamp, firstPrice) {
        this.currentCandle = {
            open: firstPrice,
            high: firstPrice,
            low: firstPrice,
            close: firstPrice,
            vBuy: 0,
            vSell: 0,
            timestamp: timestamp
        };
        this.candleCount++;
        console.log(`[AGGREGATOR] Initialized new candle #${this.candleCount} at ${new Date(timestamp).toISOString()} with open price ${firstPrice}`);
    }

    updateCurrentCandle(trade) {
        this.currentCandle.high = Math.max(this.currentCandle.high, trade.price);
        this.currentCandle.low = Math.min(this.currentCandle.low, trade.price);
        this.currentCandle.close = trade.price;

        if (trade.side === 'Buy') {
            this.currentCandle.vBuy += trade.size;
        } else {
            this.currentCandle.vSell += trade.size;
        }

        if (this.currentCandle.vBuy + this.currentCandle.vSell < 10 || 
            Math.abs(trade.price - this.currentCandle.open) > this.currentCandle.open * 0.001) {
                console.log(`[AGGREGATOR] Candle update:`, {
                    price: trade.price,
                    side: trade.side,
                    vBuy: this.currentCandle.vBuy,
                    vSell: this.currentCandle.vSell
                });
        }

        this.saveCurrentCandle();
    }

    async saveCompletedCandle() {
        if (this.currentCandle.open === 0) return;

        this.candles.push({...this.currentCandle});
        
        if (this.candles.length > config.maxCandlesToStore) {
            this.candles.shift();
        }

        const candleFile = path.join(config.dataPaths.candles, `candles_${config.candleInterval}.json`);
        await fs.promises.writeFile(candleFile, JSON.stringify(this.candles, null, 2));
        
        console.log(`[AGGREGATOR] Saved completed candle:`, {
            timestamp: new Date(this.currentCandle.timestamp).toISOString(),
            open: this.currentCandle.open,
            close: this.currentCandle.close,
            vBuy: this.currentCandle.vBuy,
            vSell: this.currentCandle.vSell
        });
    }

    async saveCurrentCandle() {
        const currentCandleFile = path.join(config.dataPaths.candles, 'current_candle.json');
        await fs.promises.writeFile(currentCandleFile, JSON.stringify(this.currentCandle, null, 2));
    }
}

// Crea un'istanza singola
const dataAggregator = new DataAggregator();

// Esporta sia la classe che l'istanza
export { DataAggregator, dataAggregator };