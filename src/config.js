// src/config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    pair: 'BTC/USDT',
    marketType: 'linear', // 'linear' o 'spot'
    candleInterval: '1m', // Intervallo candele (1m, 5m, 15m, etc.)
    maxCandlesToStore: 1000, // Numero massimo di candele da conservare
    dataPaths: {
        candles: path.join(__dirname, '../candles'),
        exchanges: path.join(__dirname, '../exchanges'),
        logs: path.join(__dirname, '../logs')
    },
    exchanges: {
        bybit: {
            enabled: true
        }
        // Altri exchange verranno aggiunti qui
    }
};