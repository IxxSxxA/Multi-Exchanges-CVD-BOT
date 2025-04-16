const fs = require('fs');
const path = require('path');
const config = require('./config');

module.exports = {
    aggregateData(trades, timeframe) {
        if (trades.length === 0) return null;
        
        const candleTime = Math.floor(trades[0].timestamp / (timeframe * 60)) * timeframe * 60;
        
        const candle = {
            timestamp: candleTime,
            open: trades[0].price,
            high: trades[0].price,
            low: trades[0].price,
            close: trades[trades.length - 1].price,
            vBuy: 0,
            vSell: 0,
            exchanges: {}
        };
        
        trades.forEach(trade => {
            candle.high = Math.max(candle.high, trade.price);
            candle.low = Math.min(candle.low, trade.price);
            
            if (trade.side === 'buy') {
                candle.vBuy += trade.volume;
            } else {
                candle.vSell += trade.volume;
            }
            
            if (trade.exchange) {
                candle.exchanges[trade.exchange] = true;
            }
        });
        
        return candle;
    },
    
    saveLastTrade(trade) {
        const filePath = path.join(__dirname, '../data/last_aggregated_trade.json');
        fs.writeFileSync(filePath, JSON.stringify(trade, null, 2));
    }
};