module.exports = {
    // Timeframes in minuti
    timeframes: [1, 5, 15, 60], 
    
    // Numero massimo di candele da conservare per timeframe
    maxCandlesToStore: 1000,
    
    // Configurazione degli exchange
    exchanges: {
        bybit: {
            enabled: true,
            symbols: ['BTCUSDT']
        },
        binance: {
            enabled: false,
            symbols: ['BTCUSDT']
        },
        coinbase: {
            enabled: false,
            symbols: ['BTC-USDT']
        },
        okex: {
            enabled: false,
            symbols: ['BTC-USDT']
        }
    }
};