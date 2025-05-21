# Multi-Exchanges-CVD-BOT: Database and Analysis Setup

This section extends the original README for the **Multi-Exchanges-CVD-BOT** project, outlining the agreed-upon setup for managing candlestick and trade data using SQLite, synchronizing it between a Raspberry Pi 4 and a PC, and developing an analysis/visualization app on the PC. The bot aggregates live market data (BTC/USDT) from multiple exchanges (Bybit, Binance, Coinbase, OKX) via WebSocket, calculates Cumulative Volume Delta (CVD) and Fair Value Gap (FVG) indicators, and executes a trading strategy ported from PineScript.

## Database Setup
- **Switch from JSON to SQLite**:
  - Replace JSON storage (`candles/candles_1m.json`, `current_candle.json`) with a single SQLite database file (`trading.db`) to handle candlestick and trade data.
  - **Why SQLite**: More scalable than JSON for large datasets (e.g., 1-2 years of 1-minute candles), supports efficient queries for analysis, and is lightweight for the Raspberry Pi 4.
  - **Structure**:
    - **Table `candles`**: Stores aggregated 1-minute candlestick data from all exchanges (columns: `timestamp`, `open`, `high`, `low`, `close`, `vBuy`, `vSell`).
    - **Table `trades`**: Stores completed trades (columns: `tradeNumber`, `entryType`, `entryPrice`, `entryTime`, `exitPrice`, `exitTime`, `profit`, `outcome`, `newBalance`).
    - **Optional**: Add a `pair` column (e.g., `BTC/USDT`) for future multi-pair support or an `exchange` column to track volume sources.
  - **Single File**: Use one SQLite file (`trading.db`) for simplicity in synchronization, visualization, and analysis (e.g., TensorFlow). Splitting into multiple files (e.g., by month) is avoided to simplify management, with archiving of old data only if the file grows excessively (e.g., after 3-4 years, ~200 MB).
  - **Optimizations**:
    - Create an index on `timestamp` for fast queries.
    - Use SQLite’s WAL (Write-Ahead Logging) mode to support simultaneous writes (by the bot) and reads (during synchronization).
    - Back up `trading.db` daily on the Pi (e.g., to an SSD) for safety.

## Raspberry Pi 4 Setup
- **Role**: Runs the bot 24/7, collecting WebSocket data, aggregating 1-minute candles, calculating CVD/FVG, executing trades, and saving data to `trading.db`.
- **Security**: Pi is locked down, accessible only via SSH from the internal network (using password or SSH key). No additional services (e.g., web server, API) to maintain security and minimize load.
- **Minimal Load**: The bot focuses on core tasks (data collection, trading, SQLite writes). Synchronization adds negligible overhead.
- **Logging**: Add a minimal log in SQLite (e.g., table `logs` with `timestamp` and `message`) or a text file to monitor bot health (e.g., “candles saved: X, trades: Y”), checkable via SSH.

## Synchronization with PC
- **Method**: Use `rsync` over SSH to synchronize `trading.db` from the Pi to the PC every 60 seconds.
  - **Why `rsync`**: Transfers only new data (e.g., one candle every 60s, occasional trades), making it efficient (a few KB per sync). Secure via SSH, respecting the Pi’s locked-down setup.
  - **Initial Sync**: Copies the entire `trading.db` (e.g., 10 MB for a month of candles, 50-100 MB for 2 years). Subsequent syncs are incremental and fast.
  - **Implementation**: Use a separate script (e.g., Bash or Python) on the PC to run `rsync`, scheduled via cron (Linux/Mac) or Task Scheduler (Windows).
    - Example: `rsync -avz pi@raspberry:/path/to/trading.db ./data/trading.db`.
    - Configure an SSH key for passwordless access.
  - **Error Handling**: Script retries on failure (e.g., network issues) and logs sync status (e.g., “Sync at 17:30, success”). Optional Telegram notification for repeated failures.
  - **Why Separate Script**: Keeps the JavaScript app (for charts/analysis) focused on visualization and analysis, with `rsync` handled robustly by a system-level script.

## PC App for Visualization and Analysis
- **Purpose**: Develop a JavaScript web app on the PC to read the synchronized `trading.db`, display interactive charts, calculate statistics, and support future TensorFlow analysis.
- **Visualization with Lightweight Charts**:
  - **Candlesticks**: Load candles from `candles` table (e.g., “last 500 candles” or “March 2025”) to display BTC/USDT candlesticks, with volume bars (vBuy + vSell).
  - **Trades**: Add markers for trades (from `trades` table) at `entryTime`/`exitTime`, colored by `outcome` (e.g., green for Take Profit, red for Stop Loss).
  - **Features**:
    - Filters for timeframe (1m, 5m, 1h, aggregated via SQLite queries) and period (e.g., calendar or slider for “last 24 hours”).
    - Real-time updates: Refresh charts every 60s with new candles/trades from synchronized `trading.db`.
    - Display CVD/FVG indicators (from `cvd.js`/`fvg.js`) alongside candles.
    - Tooltips on trade markers showing details (e.g., “Trade #1, Long, Profit: $383”).
  - **Interface**: Build a web app (e.g., using Vite, as per the original README) with a dark theme, responsive for PC. Optional export of charts as PNG.
- **Statistics**:
  - Calculate trade metrics: total profit, win rate, max drawdown, average trade duration.
  - Analyze candles: volatility (high-low), average volume, CVD/FVG patterns.
  - Display in a dashboard alongside charts (e.g., profit curve from `newBalance`).
  - Optional export as CSV/PDF for archiving.
- **TensorFlow Playground**:
  - Use `trading.db` for AI analysis with TensorFlow (via Python’s `sqlite3`).
  - Goals: Identify patterns (e.g., “high CVD candles precede winning trades?”), optimize strategy, or predict price movements.
  - Export candles/trades as CSV or read directly for model training.
  - Optional integration of AI predictions in the web app (e.g., “Next candle: 65% bullish”).
- **Multi-Exchange Data**: Candles are aggregated from multiple exchanges (Bybit, etc.) for BTC/USDT. Optional: Add `exchange` column in `candles` to track volume sources for analysis/debug.

## Future Considerations
- **Additional Data**: Currently stores candles and completed trades. Future tables (e.g., `orders` for open orders, `logs` for debug) can be added to `trading.db` and synchronized.
- **Multi-Pair Support**: Currently focused on BTC/USDT. Add a `pair` column in `candles`/`trades` for future pairs (e.g., ETH/USD).
- **Archiving**: If `trading.db` grows large (e.g., 200 MB after 3-4 years), archive old data to a separate file (e.g., `archive_2024.db`) to keep the active file lean.
- **Notifications**: Add Telegram alerts for bot status (e.g., “Bot running, 100 candles saved today”) or sync failures.

## Key Decisions
- **Single SQLite File**: Simplifies synchronization, visualization, and AI analysis (e.g., TensorFlow). Avoids complexity of multiple files.
- **Separate Sync Script**: `rsync` managed by a Bash/Python script, not integrated in the JavaScript app, for robustness and separation of concerns.
- **Pi Security**: No additional services (e.g., API, web server). `rsync` over SSH ensures the Pi remains locked down.
- **60-Second Sync**: Enables near-real-time charts while keeping Pi load minimal.
- **Web Interface**: Prioritizes interactive charts over simple outputs (e.g., CSV), with a focus on usability and trader-friendly design.

## Next Steps
- Implement SQLite in `main.js` and `runStrategy.js` to replace JSON storage.
- Set up `rsync` script on the PC for 60-second synchronization.
- Develop the PC web app with Lightweight Charts for candlestick/trade visualization and statistics.
- Create a Python script for TensorFlow analysis, reading `trading.db`.
- Add minimal logging to `trading.db` for bot health checks via SSH.

---
*Last updated: May 21, 2025*