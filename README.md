# Multi-Exchanges-CVD-BOT

A JavaScript-based trading bot that aggregates live market data from multiple cryptocurrency exchanges (Bybit, Binance, Coinbase, OKX) via WebSocket, calculates Cumulative Volume Delta (CVD) and Fair Value Gap (FVG) indicators, and stores aggregated candlestick data for charting. This project is a port of a PineScript strategy (`CVD Strategy.pinescript`) from TradingView.

## How it works
- Connects to multiple exchanges using WebSocket for real-time data.
- Aggregates candlestick data (price averaging, volume summing) across exchanges.
- Implements CVD and FVG trading strategies.
- Correctly using lower TF for ta.requestVolumeDelta -> Check TradingView code
- Stores candlestick data in JSON format for analysis and visualization.

## Project is divided into 2 main folders.

1) main.js -> Folder src/ contains the main program. It connects to multiple exchanges (found in exchanges/) to retrieve live data via websoket. Aggregated candles are stored in candles/candles_1m.json and in candles/current_candle.json

Saved candles in /candles/candles_1m.json structure example:

{
    "open": 96704.5,
    "high": 96749.5,
    "low": 96700.1,
    "close": 96700.2,
    "vBuy": 5.792999999999994,
    "vSell": 11.236999999999988,
    "timestamp": 1746151560000
  }

2) runStrategy.js -> Folder strategy/ contains the strategy logic. It copies candles/candles_1m.json in strategy/data/candles_1m.json and apply the strategy. If candles are found a backtest is executed before switching LIVE.


## References
- PineScript CVD Strategy source code can be found in PineScript-CVDStrategy.pinescript
- For convenience a copy of pinescript ta library used is here PineScript-TALibray.pinescript
- Other functions used in pinescript can be found here PineScrip-tUtils.pinescript // ATR RMA ecc.. pinescript source code
- PineScript source for CVD logic: [ta.requestVolumeDelta on TradingView](https://www.tradingview.com/script/BICzyhq0-ta/)


## Project Structure

```plaintext

Multi-Exchanges-CVD-BOT/
├── candles/                # Folder for Candles with different timeframes
│   ├── candles_YYm.json    # Aggregated candle data // One file per timeframe -> candles_YYm candles_5m etc..
│   ├── candles_XXm.json    # Aggregated candle data // One file per timeframe -> candles_XXm candles_5m etc..
│   └── current_candle.json # Live candle data for TradingView-style chart plotting
├── exchanges/              # Exchange connection logic Websocket -> volume Buy/Sell needed
│   ├── bybit.js            # Done
│   ├── binance.js          # To do
│   ├── coinbase.js         # To do
│   └── okex.js             # To do
├── src/
│   ├── main.js             # Main coordinator - takes all exchanges from src/exchanges
│   ├── config.js           # Bot configuration parameters for entry point
│   └── dataAggregator.js   # Aggregates candles from all websockets // Price average but volume sum
├── strategy/
│   ├── runStrategy.js      # Entry Point for the strategy
│   ├── atr.js              # ATR calcs
│   ├── fvg.js              # FVG cals
│   ├── cvd.js              # CVD calcs
│   ├── candleAggregator.js # Aggregate 1m candles in different TF -> check configStrategy
│   ├── configStrategy.js   # Config files for input params
│   ├── fileManager.js      # Check folders/files existence
│   └── strategyLogic.js    # FVG/CDV Strategy Logic
<!--        # All To Do   
├── charts/                 # Chart folder // Plot code/logic
│   ├── index.html          # Web page for the chart // To do
│   ├── index.js            # Live chart logic // To do
│   └── vite.config.js      # Vite configuration // To do if using Vite otherwise not needed...-->
├── .env                    # Exchanges connection keys for trading // Not needed at the moment
├── package.json            # Project dependencies and scripts
<!--        # All To Do
├── tensorflow/             # tensorflow folder 
│   └── runTS.js            # Test playground for Tensorflow 
└── README.md               # this file -->
```

## Coding Guidelines
- Use camelCase for variable and function names.
- Prefer async/await over Promise.then for WebSocket and API calls.
- Include JSDoc comments for all major functions.
- Handle errors explicitly with try/catch.
- File naming: Use `.js` for JavaScript files, avoid abbreviations (e.g., `dataAggregator.js` instead of `dataAgg.js`).

## GitHub Copilot Instructions
- **Code Generation**:
  - For `exchanges/binance.js`, `coinbase.js`, and `okex.js`, generate WebSocket connection logic similar to `bybit.js`.
  - Use the `ws` library for WebSocket connections.
  - Ensure all functions include try/catch for error handling.
- **Strategy Logic**:
  - Follow the PineScript logic in `ta.requestVolumeDelta` (linked above) for `cvd.js`.
  - Generate TypeScript-compatible code if possible (consider migrating to TypeScript later).
- **Charts**:
  - For `charts/index.js`, generate code to plot candles from `current_candle.json` using a library like Chart.js or Lightweight Charts. Check chartTF in strategy/configStrategy.js
- **Tech Stack**:
    - Language: JavaScript (Node.js)
    - Dependencies: WebSocket (`ws`), others TBD (see `package.json`)
    - Target: TradingView-style charting and strategy execution


## Setup
1. Install Node.js (v16 or higher).
2. Run `npm install` to install dependencies.
3. Configure API keys in `.env` (not required yet).
4. Run the bot: `node src/main.js`.

## Dependencies
- `ws`: WebSocket library for exchange connections.
- (TBD) Charting library for `charts/` (e.g., Chart.js or Lightweight Charts).
- (TBD) Tensorflow tensorflow/ analisys and trading bot