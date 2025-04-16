import { CVDStrategy } from './cvdStrategy.js';
import { config } from './configGrid.js';
import fs from 'fs';
import path from 'path';

class StrategyRunner {
  constructor() {
    this.strategy = new CVDStrategy();
    this.lastProcessedTime = 0;
    this.setupFilesystem();
    this.verifyPaths();
  }

  setupFilesystem() {
    if (!fs.existsSync(config.dataPaths.results)) {
      fs.mkdirSync(config.dataPaths.results, { recursive: true });
    }
  }

  verifyPaths() {
    const candlePath = path.join(config.dataPaths.candles, config.candleFile);
    if (!fs.existsSync(candlePath)) {
      console.error(`[ERROR] Candle file not found at: ${candlePath}`);
      console.log('[INFO] Waiting for file to be created...');
    } else {
      console.log(`[INFO] Monitoring candle file at: ${candlePath}`);
    }
  }

  async watchAndProcess() {
    console.log('[StrategyRunner] Starting candle data watcher...');
    setInterval(() => this.checkForNewData(), config.checkInterval);
  }

  async checkForNewData() {
    try {
      const candlePath = path.join(config.dataPaths.candles, config.candleFile);
      
      if (!fs.existsSync(candlePath)) {
        return; // Aspetta che il file venga creato
      }

      const stats = fs.statSync(candlePath);
      
      if (stats.mtimeMs > this.lastProcessedTime) {
        console.log('[StrategyRunner] New candle data detected, processing...');
        await this.processData(candlePath);
        this.lastProcessedTime = stats.mtimeMs;
      }
    } catch (err) {
      console.error('[StrategyRunner] Error checking data:', err.message);
    }
  }

  async processData(filePath) {
    try {
        // 1. Copia i dati
        const trainingPath = path.join(config.dataPaths.dataTraining, 'candles_1m.json');
        fs.copyFileSync(filePath, trainingPath);
        
        // 2. Carica i dati
        const rawData = fs.readFileSync(trainingPath);
        const candles1m = JSON.parse(rawData);
        const lastCandleTimestamp = candles1m[candles1m.length - 1].timestamp;
        
        console.log(`\n[STRATEGY] Processing data up to ${new Date(lastCandleTimestamp).toISOString()}`);
        
        // 3. Esegui strategia
        await this.strategy.initialize(candles1m);
        const { trades, summary } = this.strategy.runStrategy();
        
        // 4. Salva risultati (sovrascrive sempre lo stesso file)
        const resultPath = path.join(config.dataPaths.results, 'last_results.json');
        fs.writeFileSync(resultPath, JSON.stringify({
            timestamp: lastCandleTimestamp,
            trades,
            summary
        }, null, 2));
        
        console.log(`[STRATEGY] Results updated for timestamp: ${lastCandleTimestamp}`);
        
    } catch (err) {
        console.error('[STRATEGY] Processing error:', err);
    }
}
}

// Avvia il runner
const runner = new StrategyRunner();
runner.watchAndProcess();