// utils.js
import { config } from './configGrid.js';
import fs from 'fs';
import path from 'path';

export class TradingUtils {
    static ensureDirectory(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    static watchFile(filePath, callback, interval = 5000) {
        let lastCheckTime = 0;
        
        const check = async () => {
          try {
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs > lastCheckTime) {
              lastCheckTime = stats.mtimeMs;
              await callback();
            }
          } catch (err) {
            console.error('Error watching file:', err);
          }
        };
        
        setInterval(check, interval);
        return check;
    }

    static initCSVLog() {
        this.ensureDirectory(config.csvLogPath);
        const header = [
            'timestamp', 'price', 'signal', 'fvg_present', 'fvg_type', 'fvg_size',
            'volume_delta', 'atr', 'atr_cvds', 'action', 'entry_price', 
            'sl_price', 'tp_price', 'capital', 'position_size'
        ].join(',') + '\n';
        fs.writeFileSync(config.csvLogPath, header);
    }

    static logToCSV(data) {
        this.ensureDirectory(config.csvLogPath);
        const line = [
            data.timestamp,
            data.price,
            data.signal || '',
            data.fvg_present || false,
            data.fvg_type || '',
            data.fvg_size || 0,
            data.volume_delta || 0,
            data.atr || 0,
            data.atr_cvds || 0,
            data.action || '',
            data.entry_price || 0,
            data.sl_price || 0,
            data.tp_price || 0,
            data.capital || config.initialCapital,
            data.position_size || 0
        ].join(',') + '\n';
        
        fs.appendFileSync(config.csvLogPath, line);
    }

    static logToFile(message, data = null) {
        this.ensureDirectory(config.csvLogPath);
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, data };
        
        fs.appendFileSync(config.logFilePath, JSON.stringify(logEntry) + '\n');
    }

    static calculateCVD(candles) {
        const result = candles.map(c => ({
            ...c,
            cvd: c.volumeBuy - c.volumeSell
        }));
        
        if (config.logLevel === "detailed") {
            this.logToFile("Calculated CVD for candles", {
                count: candles.length,
                firstCandle: result[0],
                lastCandle: result[result.length - 1]
            });
        }
        
        return result;
    }

    static aggregateTimeframe(candles, fromTF, toTF) {
        const toMinutes = tf => parseInt(tf.replace('m', '')) || 1;
        const fromMin = toMinutes(fromTF);
        const toMin = toMinutes(toTF);
        
        if (fromMin >= toMin) return candles;
        
        const ratio = toMin / fromMin;
        const aggregated = [];
        
        for (let i = 0; i < candles.length; i += ratio) {
            const group = candles.slice(i, i + ratio);
            if (group.length === 0) continue;
            
            const first = group[0];
            const last = group[group.length - 1];
            
            // Calcola il volume delta cumulativo
            let volumeBuy = 0;
            let volumeSell = 0;
            let cvd = 0;
            let maxCVD = -Infinity;
            let minCVD = Infinity;
            
            group.forEach(candle => {
                volumeBuy += candle.volumeBuy;
                volumeSell += candle.volumeSell;
                cvd += (candle.volumeBuy - candle.volumeSell);
                maxCVD = Math.max(maxCVD, cvd);
                minCVD = Math.min(minCVD, cvd);
            });
            
            aggregated.push({
                timestamp: first.timestamp,
                open: first.open,
                high: Math.max(...group.map(c => c.high)),
                low: Math.min(...group.map(c => c.low)),
                close: last.close,
                volumeBuy,
                volumeSell,
                openVolume: group[0].volumeBuy - group[0].volumeSell, // Delta alla prima barra
                maxVolume: maxCVD, // Massimo CVD durante il periodo
                minVolume: minCVD, // Minimo CVD durante il periodo
                lastVolume: cvd, // CVD finale
                cvd
            });
        }
        
        return aggregated;
    }

    static calculateATR(candles, period) {
        const trValues = [];
        for (let i = 1; i < candles.length; i++) {
            const prevClose = candles[i-1].close;
            const highLow = candles[i].high - candles[i].low;
            const highPrevClose = Math.abs(candles[i].high - prevClose);
            const lowPrevClose = Math.abs(candles[i].low - prevClose);
            trValues.push(Math.max(highLow, highPrevClose, lowPrevClose));
        }
        
        const atr = [];
        for (let i = period; i <= trValues.length; i++) {
            const window = trValues.slice(i - period, i);
            atr.push(window.reduce((sum, val) => sum + val, 0) / period);
        }
        
        if (config.logLevel === "detailed") {
            this.logToFile(`Calculated ATR with period ${period}`, {
                candlesCount: candles.length,
                atrValues: atr.length,
                lastATRValue: atr[atr.length - 1]
            });
        }
        
        return atr;
    }

    static saveBacktestResults(results) {
        this.ensureDirectory(config.csvLogPath);
        fs.writeFileSync(config.backtestResultsPath, JSON.stringify(results, null, 2));
    }
}