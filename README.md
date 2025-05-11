# Multi-Exchanges-CVD-BOT
Multi-Exchanges-CVD-BOT//
├── candles/                # Folder for Candles with different timeframes
│   ├── candles_YYm.json    # Aggregated candle data // One file per timeframe -> candles_1m candles_5m etc..
│   ├── candles_XXm.json    # Aggregated candle data // One file per timeframe -> candles_1m candles_5m etc..
│   └── current_candle.json # Live candle data for TradingView-style chart plotting
├── exchanges/              # Exchange connection logic OK
│   ├── bybit.js            # To do
│   ├── binance.js          # To do
│   ├── coinbase.js         # To do
│   └── okex.js             # To do
├── src/
│   ├── main.js             # Main coordinator - takes all exchanges from src/exchanges
│   ├── config.js           # Bot configuration parameters for entry point
│   └── dataAggregator.js   # Aggregates candles from all websockets // Price average but volume sum
├── strategy/
│   ├── runStrategy.js      # Run CVD Strategy
│   ├── calcFVG.js
│   └── calcCVD.js
<!--        # All To Do   
    ├── charts/           
│   ├── index.html          # Web page for the chart // To do
│   ├── index.js            # Live chart logic // To do
│   └── vite.config.js      # Vite configuration // To do if using Vite otherwise not needed... -->
├── .env                    # Exchange connection keys for trading // Not needed at the moment
├── package.json
<!--        # All To Do
    ├── tensorflow/
│   └── runTS.js            # Test playground for Tensorflow -->
└── README.md               # this file