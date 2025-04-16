// configGrid.js

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));



export const config = {
  initialCapital: 10000,   // Capitale iniziale
  
  // General Configuration
  entryMode: "FVGs", // Only FVGs mode as requested
  signalType: "Raw", // Raw signal type as requested

  // FVG Settings
  fvgSensitivity: 6, // All=100, Extreme=6, High=2, Normal=1.5, Low=1
  minimumFVGSize: 2, // Minimum bars for valid FVG
  fvgEndMethod: "Close", // ["Wick", "Close"]
  fvgFilterMethod: "AverageRange", // ["AverageRange", "VolumeThreshold"]
  volumeThresholdPercent: 50, // Only if fvgFilterMethod = "VolumeThreshold"
  fvgBars: "SameType", // ["SameType", "All"]
  allowGaps: false, // Allow gaps between bars

  // TP/SL Settings
  tpslMethod: "Dynamic", // ["Dynamic", "Fixed"]
  riskAmount: 6.5, // Highest=10, High=8.5, Normal=6.5, Low=5, Lowest=3
  dynamicRR: 0.57, // Risk:Reward ratio
  tpPercent: 0.3, // For Fixed method
  slPercent: 0.4, // For Fixed method

  // Timeframes
  chartTF: "3m", // Current chart timeframe (example)
  anchorTF: "15m", // Anchor timeframe for volume delta
  

  // ATR Settings
  atrLen: 10, // ATR period length
  atrLenCVDS: 50, // ATR period for CVDS calculations

  // Other Settings
  maxDistanceToLastBar: 100000, // Max bars to process
  showLastXFVGs: 2, // Number of FVGs to show
  maxCVDS: 100, // Max CVDS entries to track
  
  // Logging Settings
logLevel: "detailed", // ["minimal", "normal", "detailed"]
logFilePath: "./logs/strategy_logs.json",
csvLogPath: "./logs/strategy_trace.csv", // Nuovo percorso per il log CSV
backtestResultsPath: "./logs/backtest_results.json",


dataPaths: {
  candles: path.join(__dirname, '../candles'), // Path assoluto
  results: path.join(__dirname, './results')
},
candleFile: 'candles_1m.json',
checkInterval: 10000,   // Controlla ogni 10 secondi



currentTimeframe: "3m",  // Aggiungi questo
  anchorTimeframe: "15m",  // Aggiungi questo
  dataPaths: {
    candles: path.join(__dirname, '../candles'),
    dataTraining: path.join(__dirname, './dataTraining'),  // Nuova cartella
    results: path.join(__dirname, './results')
  }



};
