import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { requestVolumeDelta } from './requestVolumeDelta.js';
import { calculateATR, calculateSMA } from './strategyUtils.js';
import { updateFVGs } from './entryLogic.js';
import { config } from './configStrategy.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = path.join(__dirname, '../candles/candles_1m.json');
const DEST_FOLDER = path.join(__dirname, 'data');
const DEST_FILE_1M = path.join(DEST_FOLDER, 'candles_1m_copy.json');

let candles = [];

function copyInitialCandleDataIfNeeded() {
  if (!fs.existsSync(DEST_FOLDER)) fs.mkdirSync(DEST_FOLDER);
  if (config.forceRefresh || !fs.existsSync(DEST_FILE_1M)) {
    fs.copyFileSync(SOURCE_FILE, DEST_FILE_1M);
    if (config.logEnabled) console.log('[FS] File candele copiato in strategy/data');
  }
}

function loadCandles() {
  const raw = fs.readFileSync(DEST_FILE_1M);
  candles = JSON.parse(raw);
  if (config.logEnabled) console.log(`[LOAD] ${candles.length} candele caricate`);
  return candles;
}

function parseTFtoMs(tf) {
  const match = tf.match(/^(\d+)([mhdw])$/);
  const n = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    case 'w': return n * 7 * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid TF');
  }
}

function aggregateCandles(candles, tfStr) {
  const tfMs = parseTFtoMs(tfStr);
  const grouped = new Map();

  for (const c of candles) {
    const bucket = Math.floor(c.timestamp / tfMs) * tfMs;
    if (!grouped.has(bucket)) {
      grouped.set(bucket, {
        timestamp: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        vBuy: c.vBuy,
        vSell: c.vSell
      });
    } else {
      const g = grouped.get(bucket);
      g.high = Math.max(g.high, c.high);
      g.low = Math.min(g.low, c.low);
      g.close = c.timestamp > g.timestamp ? c.close : g.close;
      g.vBuy += c.vBuy;
      g.vSell += c.vSell;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function runBacktest() {
  const mainCandles = aggregateCandles(candles, config.timeframe);
  const atr = calculateATR(mainCandles, config.atrPeriod);
  const atrArray = calculateATR(mainCandles, config.atrPeriod);

  const volumeArr = mainCandles.map(c => c.vBuy + c.vSell);
  const sma5 = calculateSMA(volumeArr, 5);
  const sma15 = calculateSMA(volumeArr, 15);
  const cvd = requestVolumeDelta(candles, config.anchorPeriod, mainCandles);
  const fvgList = updateFVGs(mainCandles, config, atrArray, sma5, sma15);

//  const fvgList = updateFVGs(mainCandles, config, atr, sma5, sma15);
  console.log(`[BACKTEST] FVG attivi: ${fvgList.length}`);
}

function startLiveMonitoring() {
  fs.watchFile(SOURCE_FILE, { interval: 1000 }, () => {
    console.log('[LIVE] File sorgente aggiornato. Ricarico...');
    copyInitialCandleDataIfNeeded();
    loadCandles();
    runBacktest();
  });
}

// === INIT
console.log('[INIT] Avvio strategia con configurazione:', config);
copyInitialCandleDataIfNeeded();
loadCandles();
console.log('[ANCHOR] Anchor period impostato:', config.anchorPeriod);
console.log('[BACKTEST] Esecuzione su storico...');
runBacktest();
console.log('[LIVE] Avvio monitoraggio per dati nuovi...');
startLiveMonitoring();
