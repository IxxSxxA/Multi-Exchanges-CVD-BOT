const axios = require('axios');

module.exports = {
    getWebSocketUrl() {
        return 'wss://stream.bybit.com/v5/public/linear';
    },
    
    subscribeToTrades() {
        return JSON.stringify({
            op: 'subscribe',
            args: ['publicTrade.BTCUSDT']
        });
    },
    
    parseTradeData(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.topic && message.topic.startsWith('publicTrade')) {
                const trades = message.data;
                if (trades && trades.length > 0) {
                    // Prendiamo l'ultimo trade
                    const trade = trades[trades.length - 1];
                    return {
                        price: parseFloat(trade.p),
                        volume: parseFloat(trade.v),
                        side: trade.S === 'Buy' ? 'buy' : 'sell',
                        timestamp: trade.T
                    };
                }
            }
        } catch (err) {
            console.error('Error parsing Bybit trade data:', err);
        }
        return null;
    },
    
    async getHistoricalData(symbol, interval, limit) {
        try {
            const response = await axios.get('https://api.bybit.com/v5/market/kline', {
                params: {
                    category: 'linear',
                    symbol: symbol,
                    interval: interval,
                    limit: limit
                }
            });
            
            return response.data.result.list.map(item => ({
                timestamp: parseInt(item[0]),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } catch (err) {
            console.error('Error fetching Bybit historical data:', err);
            return [];
        }
    }
};