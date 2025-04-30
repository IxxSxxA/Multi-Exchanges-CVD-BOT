// runStrategy.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import configStrategy from './configStrategy.js';



// ------------------- Configurazione e Inizializzazione -------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Calcolo dinamico del buffer size
function calculateOptimalBufferSize(config) {
  if (!config.enableDynamicBuffer) {
    return 100; // Default
  }
  const minBuffer = Math.max(
    config.atrLen * config.memoryBufferMultiplier,
    config.atrLenCVDS * 2,
    config.maxBarsBack * 1.5
  );
  return Math.min(Math.ceil(minBuffer), 1000); // Limite superiore a 1000
}

const maxCandlesInMemory = calculateOptimalBufferSize(configStrategy);

// Directory e file (nessuna modifica qui)
const candlesDir = path.join(rootDir, 'candles');
const candlesFile = path.join(candlesDir, 'candles_1m.json');
const strategyDir = path.join(rootDir, 'strategy/candlesStrategy');
const candlesStrategyDir = path.join(rootDir, 'strategy/candlesStrategy');
const tradesFile = path.join(strategyDir, 'trades.csv');
const tradesJsonFile = path.join(strategyDir, 'trades.json');


// Normalizza i timeframe (nessuna modifica qui)
const chartTFMinutes = parseInt(configStrategy.chartTF?.replace(/m$/, '') || 1);
const anchorTFMinutes = parseInt(configStrategy.anchorInput?.replace(/m$/, '') || 3);


// File delle candele (nessuna modifica qui)
const candlesStrategy1mFile = path.join(candlesStrategyDir, 'candlesStrategy_1m.json');
const candlesChartTFFile = chartTFMinutes === 1
  ? candlesStrategy1mFile
  : path.join(candlesStrategyDir, `candlesStrategy_${chartTFMinutes}m.json`);
const candlesAnchorFile = path.join(candlesStrategyDir, `candlesStrategy_${anchorTFMinutes}m.json`);


// Stato della strategia (modificato per usare i parametri config)
let strategyState = {
  // state: 'Waiting For CVDS',
  state: 'Neutral',
  lastSignal: null,
  entryPrice: null,
  slTarget: null,
  tpTarget: null,
  fvgWaiting: null,
  positionSize: null,
  capital: parseFloat(configStrategy.initialAmount) || 10000
};

// Buffer e stato (ora usa maxCandlesInMemory calcolato)
let candles1mBuffer = [];
let candlesChartTFBuffer = [];
let candlesAnchorBuffer = [];
let lastProcessed3mTimestamp = 0;
let lastProcessed15mTimestamp = 0;
let lastProcessedCandleTimestamp = 0;

// Intervallo di polling (ora da config)
const POLLING_INTERVAL = configStrategy.pollingInterval || 60;

// ------------------- Funzioni Ausiliarie -------------------

function trackTradesToJson(event, details, capital, candleTimestamp) {
  try {
    // const tradesJsonFile = path.join(candlesStrategyDir, 'trades.json');
    
    // salvo timestamp evento come millisecondi numerici
    // salvo anche timestamp candela separato per sincronizzazione nella chart
    const tradeData = {
      timestamp: candleTimestamp ?? Date.now(),
      candleTimestamp: candleTimestamp ?? Date.now(),
      event,
      details,
      capital: Number.isFinite(capital) ? capital.toFixed(2) : 'NaN',
      entryPrice: strategyState.entryPrice ? strategyState.entryPrice.toFixed(2) : null,
      tpTarget: strategyState.tpTarget ? strategyState.tpTarget.toFixed(2) : null,
      slTarget: strategyState.slTarget ? strategyState.slTarget.toFixed(2) : null,
      positionSize: strategyState.positionSize ? strategyState.positionSize.toFixed(6) : null,
      positionType: strategyState.lastSignal || null
    };

    let existingData = [];
    if (fs.existsSync(tradesJsonFile)) {
      existingData = JSON.parse(fs.readFileSync(tradesJsonFile, 'utf8'));
    }

    existingData.push(tradeData);
    fs.writeFileSync(tradesJsonFile, JSON.stringify(existingData, null, 2));
    
  } catch (error) {
    console.error(`Errore scrittura JSON trade: ${error.message}`);
  }
}


function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    printToConsole(`Creata directory: ${dirPath}`);
    writeToCSV('Start', `Creata directory ${dirPath}`, strategyState.capital);
    return true;
  }
  return false;
}


function writeToCSV(event, details, capital) {
  try {
    const timestamp = new Date().toISOString();
    const row = `${timestamp},${event},"${details}",${Number.isFinite(capital) ? capital.toFixed(2) : 'NaN'}\n`;
    const header = 'Timestamp,Event,Details,Capital\n';
    if (!fs.existsSync(tradesFile)) {
      fs.writeFileSync(tradesFile, header);
    }
    fs.appendFileSync(tradesFile, row);
  } catch (error) {
    console.error(`Errore scrittura CSV: ${error.message}`);
  }
}

function printToConsole(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

function aggregateCandles(candles, targetTFMinutes, lastProcessedTimestamp = 0) {
  const targetTFMs = targetTFMinutes * 60 * 1000;
  const aggregated = [];

  let currentWindow = null;
  let volumeDeltaSum = 0;

  candles.sort((a, b) => a.timestamp - b.timestamp);

  for (const candle of candles) {
    if (candle.timestamp <= lastProcessedTimestamp) continue;

    // const windowStart = Math.floor(candle.timestamp / targetTFMs) * targetTFMs;
    const windowStart = candle.timestamp;

    if (!currentWindow || currentWindow.start !== windowStart) {
      
      
      
      if (currentWindow) {
        aggregated.push({
          timestamp: currentWindow.start,
          open: currentWindow.open,
          high: currentWindow.high,
          low: currentWindow.low,
          close: currentWindow.close,
          volume: currentWindow.volume,
          vBuy: currentWindow.vBuy,
          vSell: currentWindow.vSell,
          openVolume: currentWindow.openVolume,
          maxVolume: currentWindow.maxVolume,
          minVolume: currentWindow.minVolume,
          lastVolume: volumeDeltaSum
        });
      }
      currentWindow = {
        start: windowStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.vBuy + candle.vSell,
        vBuy: candle.vBuy,
        vSell: candle.vSell,
        openVolume: candle.vBuy - candle.vSell,
        maxVolume: -Infinity,
        minVolume: Infinity
      };
      volumeDeltaSum = 0;
    } else {
      currentWindow.high = Math.max(currentWindow.high, candle.high);
      currentWindow.low = Math.min(currentWindow.low, candle.low);
      currentWindow.close = candle.close;
      currentWindow.volume += candle.vBuy + candle.vSell;
      currentWindow.vBuy += candle.vBuy;
      currentWindow.vSell += candle.vSell;
    }

    const candleVolumeDelta = candle.vBuy - candle.vSell;
    volumeDeltaSum += candleVolumeDelta;
    currentWindow.maxVolume = Math.max(currentWindow.maxVolume, volumeDeltaSum);
    currentWindow.minVolume = Math.min(currentWindow.minVolume, volumeDeltaSum);
  }

  if (currentWindow && candles[candles.length - 1].timestamp >= currentWindow.start + targetTFMs) {
    aggregated.push({
      timestamp: currentWindow.start,
      open: currentWindow.open,
      high: currentWindow.high,
      low: currentWindow.low,
      close: currentWindow.close,
      volume: currentWindow.volume,
      vBuy: currentWindow.vBuy,
      vSell: currentWindow.vSell,
      openVolume: currentWindow.openVolume,
      maxVolume: currentWindow.maxVolume,
      minVolume: currentWindow.minVolume,
      lastVolume: volumeDeltaSum
    });
  }

  return aggregated;
}

function saveCandles(file, newCandles) {
  try {
    let existingCandles = [];
    if (fs.existsSync(file)) {
      existingCandles = JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    const existingTimestamps = new Set(existingCandles.map(c => c.timestamp));
    const updatedCandles = [
      ...existingCandles,
      ...newCandles.filter(c => !existingTimestamps.has(c.timestamp))
    ];

    updatedCandles.sort((a, b) => a.timestamp - b.timestamp);

    fs.writeFileSync(file, JSON.stringify(updatedCandles, null, 2));
    printToConsole(`📂 Salvate ${newCandles.length} nuove candele -> Totale: ${updatedCandles.length}`);  // Usa -> in ${file} per vedere dir salvataggio
    writeToCSV('SaveCandles', `Salvate ${newCandles.length} candele in ${file}`, strategyState.capital);
  } catch (error) {
    printToConsole(`⚠️  Errore salvataggio candele ${file}: ${error.message}`);
    writeToCSV('Error', `Salvataggio candele ${file}: ${error.message}`, strategyState.capital);
  }
}

function calculateATR(candles, period) {
  if (!candles || candles.length < period + 1) {
    printToConsole(`⚠️  ATR Insufficienti candele (${candles ? candles.length : 0}) per periodo ${period}`);
    return 0;
  }
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const curr = candles[candles.length - i];
    const prev = candles[candles.length - i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trSum += tr;
  }
  return trSum / period;
}

function calculateSMA(values, period) {
  if (!values || values.length < period) {
    printToConsole(`⚠️  SMA Insufficienti valori (${values ? values.length : 0}) per periodo ${period}`);
    return 0;
  }
  const sum = values.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRMA(values, period) {
  if (!values || values.length < period) {
    printToConsole(`⚠️  RMA Insufficienti valori (${values ? values.length : 0}) per periodo ${period}`);
    return 0;
  }
  let rma = values[0];
  const alpha = 1 / period;
  for (let i = 1; i < values.length; i++) {
    rma = alpha * values[i] + (1 - alpha) * rma;
  }
  return rma;
}

function detectFVG(candles, index) {
  if (!candles || index < 2) {
    printToConsole(`🔍 FVG Non rilevato, indice insufficiente (${index})`);
    writeToCSV('FVG', `Non rilevato, indice insufficiente (${index})`, strategyState.capital);
    return null;
  }

  const curr = candles[index];
  const prev1 = candles[index - 1];
  const prev2 = candles[index - 2];
  const atr = calculateATR(candles.slice(0, index + 1), configStrategy.atrLen || 14);
  const fvgSensitivity = parseFloat(configStrategy.fvgSensitivity) || 0.2;
  const atrThreshold = atr * fvgSensitivity;

  printToConsole(`🔍 FVG ATR=${atr.toFixed(2)}, fvgSensitivity=${fvgSensitivity.toFixed(2)}, Threshold=${atrThreshold.toFixed(2)}`);
  writeToCSV('FVG', `Check: ATR=${atr.toFixed(2)}, fvgSensitivity=${fvgSensitivity.toFixed(2)}, Threshold=${atrThreshold.toFixed(2)}`, strategyState.capital);

  if (curr.low > prev2.high && prev1.close > prev2.high) {
    const fvgSize = curr.low - prev2.high;
    printToConsole(`🔍 FVG Bullish candidato: size=${fvgSize.toFixed(2)}, curr.low=${curr.low.toFixed(2)}, prev2.high=${prev2.high.toFixed(2)}`);
    if (fvgSize > atrThreshold && Number.isFinite(atrThreshold)) {
      printToConsole(`✅ FVG Bullish confermato: top=${curr.low.toFixed(2)}, bottom=${prev2.high.toFixed(2)}`);
      writeToCSV('FVG', `Bullish confermato, top=${curr.low.toFixed(2)}, bottom=${prev2.high.toFixed(2)}, size=${fvgSize.toFixed(2)}`, strategyState.capital);
      return { type: 'Bullish', top: curr.low, bottom: prev2.high, size: fvgSize };
    } else {
      printToConsole(`❌ FVG Bullish scartato: size=${fvgSize.toFixed(2)} < threshold=${atrThreshold.toFixed(2)} ${isNaN(atrThreshold) ? '(NaN)' : ''}`);
      writeToCSV('FVG', `Bullish scartato, size=${fvgSize.toFixed(2)} < threshold=${atrThreshold.toFixed(2)} ${isNaN(atrThreshold) ? '(NaN)' : ''}`, strategyState.capital);
    }
  } else if (curr.high < prev2.low && prev1.close < prev2.low) {
    const fvgSize = prev2.low - curr.high;
    printToConsole(`🔍 FVG Bearish candidato: size=${fvgSize.toFixed(2)}, prev2.low=${prev2.low.toFixed(2)}, curr.high=${curr.high.toFixed(2)}`);
    if (fvgSize > atrThreshold && Number.isFinite(atrThreshold)) {
      printToConsole(`✅ FVG Bearish confermato: top=${prev2.low.toFixed(2)}, bottom=${curr.high.toFixed(2)}`);
      writeToCSV('FVG', `Bearish confermato, top=${prev2.low.toFixed(2)}, bottom=${curr.high.toFixed(2)}, size=${fvgSize.toFixed(2)}`, strategyState.capital);
      return { type: 'Bearish', top: prev2.low, bottom: curr.high, size: fvgSize };
    } else {
      printToConsole(`❌ FVG Bearish scartato: size=${fvgSize.toFixed(2)} < threshold=${atrThreshold.toFixed(2)} ${isNaN(atrThreshold) ? '(NaN)' : ''}`);
      writeToCSV('FVG', `Bearish scartato, size=${fvgSize.toFixed(2)} < threshold=${atrThreshold.toFixed(2)} ${isNaN(atrThreshold) ? '(NaN)' : ''}`, strategyState.capital);
    }
  }

  printToConsole(`🔍 FVG Non rilevato, condizioni non soddisfatte`);
  writeToCSV('FVG', `Non rilevato, condizioni non soddisfatte`, strategyState.capital);
  return null;
}

// ------------------- Logica della Strategia -------------------


function processCandle(candle, index, allCandles, isBacktest = false) {
  try {

    console.log("")
    console.log("*******************************************************")
    // console.log(`************* Processed *************`) 
    console.log("*************  Waiting for New Candle *****************")
    console.log("*******************************************************")
    console.log("")


    // Verifica capitale valido (modificato per usare config.capitalGrowthLimit)
    const initialAmount = parseFloat(configStrategy.initialAmount) || 10000;
    if (strategyState.capital > initialAmount * configStrategy.capitalGrowthLimit) {
      printToConsole(`🛑 ERRORE: Capitale (${strategyState.capital.toFixed(2)}) supera il limite massimo (${initialAmount * configStrategy.capitalGrowthLimit}). Arresto strategia.`);
      writeToCSV('Error', `Capitale supera limite massimo (${initialAmount * configStrategy.capitalGrowthLimit})`, strategyState.capital);
      process.exit(1);
    }

    // Salta candele già processate
    if (candle.timestamp <= lastProcessedCandleTimestamp) {
      printToConsole(`⏩ Candela saltata: timestamp=${new Date(candle.timestamp).toISOString()} già processato`);
      return;
    }

    // Aggiorna timestamp processato
    lastProcessedCandleTimestamp = candle.timestamp;

    // Aggiungi candela al buffer
    candles1mBuffer.push(candle);
    if (candles1mBuffer.length > maxCandlesInMemory) {
      candles1mBuffer.shift();
    }

    // Usa candele fino alla corrente (backtest) o tutte (live)
    let tempCandles = isBacktest ? allCandles.slice(0, index + 1) : allCandles;

    // Gestisci chartTF
    if (chartTFMinutes === 1) {
      candlesChartTFBuffer = tempCandles.slice(-maxCandlesInMemory);
    } else {
      const candlesChartTF = aggregateCandles(tempCandles, chartTFMinutes, lastProcessed3mTimestamp);
      if (candlesChartTF.length > 0) {
        lastProcessed3mTimestamp = Math.max(...candlesChartTF.map(c => c.timestamp));
        candlesChartTFBuffer = candlesChartTF.slice(-maxCandlesInMemory);
        saveCandles(candlesChartTFFile, candlesChartTF);
      }
    }

    // Aggrega a anchorInput
    /* const candlesAnchor = aggregateCandles(tempCandles, anchorTFMinutes, lastProcessed15mTimestamp);
    if (candlesAnchor.length > 0) {
      lastProcessed15mTimestamp = Math.max(...candlesAnchor.map(c => c.timestamp));
      candlesAnchorBuffer.push(...candlesAnchor);
      if (candlesAnchorBuffer.length > maxCandlesInMemory) {
        candlesAnchorBuffer = candlesAnchorBuffer.slice(-maxCandlesInMemory);
      }
      saveCandles(candlesAnchorFile, candlesAnchor);
    } */


      const candlesAnchor = aggregateCandles(tempCandles, anchorTFMinutes, 0);  // Usa 0 per elaborare tutte sempre

      if (candlesAnchor.length > 0) {
        // Filtra e aggiungi solo nuove candele (come nel suggerimento precedente)
        const existingTimestamps = new Set(candlesAnchorBuffer.map(c => c.timestamp));
        const newCandles = candlesAnchor.filter(c => !existingTimestamps.has(c.timestamp));
      
        if (newCandles.length > 0) {
          candlesAnchorBuffer.push(...newCandles);
      
          if (candlesAnchorBuffer.length > maxCandlesInMemory) {
            candlesAnchorBuffer = candlesAnchorBuffer.slice(-maxCandlesInMemory);
          }
      
          // Aggiorna lastProcessed15mTimestamp per futuro uso
          lastProcessed15mTimestamp = Math.max(...newCandles.map(c => c.timestamp));
      
          saveCandles(candlesAnchorFile, newCandles);
        }
      }
      


    // Sincronizza con file candele 3m
    if (!isBacktest && fs.existsSync(candlesAnchorFile)) {
      const fileCandles = JSON.parse(fs.readFileSync(candlesAnchorFile, 'utf8'));
      const recentFileCandles = fileCandles.filter(c => c.timestamp >= lastProcessedCandleTimestamp - maxCandlesInMemory * anchorTFMinutes * 60 * 1000);
      if (recentFileCandles.length > 0) {
        candlesAnchorBuffer = recentFileCandles.slice(-maxCandlesInMemory);
        lastProcessed15mTimestamp = Math.max(lastProcessed15mTimestamp, ...recentFileCandles.map(c => c.timestamp));
        printToConsole(`🔄 Sincronizzato buffer anchor con ${candlesAnchorFile}: ${candlesAnchorBuffer.length} candele`);
        writeToCSV('Buffer', `Sincronizzato anchor, candele=${candlesAnchorBuffer.length}`, strategyState.capital);
      }
    }

    // Log stato buffer
    printToConsole(`📊 Buffer 1m=${candles1mBuffer.length}, chartTF=${candlesChartTFBuffer.length}, anchor=${candlesAnchorBuffer.length}`);

    const lastCandleIndex = candlesChartTFBuffer.length - 1;
    if (lastCandleIndex < 0) {
      printToConsole(`⚠️ Nessuna candela chartTF disponibile`);
      writeToCSV('Error', `Nessuna candela chartTF disponibile`, strategyState.capital);
      return;
    }

    const atr = calculateATR(candlesChartTFBuffer, configStrategy.atrLen || 14);
    const volumeValues = candlesChartTFBuffer.map(c => c.volume);
    const shortVol = calculateSMA(volumeValues, 5);
    const longVol = calculateSMA(volumeValues, 15);
    const curRange = candlesAnchorBuffer.length > 0 ? candlesAnchorBuffer[candlesAnchorBuffer.length - 1].maxVolume - candlesAnchorBuffer[candlesAnchorBuffer.length - 1].minVolume : 0;
    const vdAtr = calculateRMA(candlesAnchorBuffer.map(c => c.maxVolume - c.minVolume), configStrategy.atrLen || 14);

    // Stato attuale
    printToConsole(`📈 Stato ${strategyState.state} | Capitale: ${strategyState.capital.toFixed(2)} | ATR=${atr.toFixed(2)}`);


    // *********************** INIZIO STRATEGIA *****************


    // Controllo CVD
      
    
    if (candlesAnchorBuffer.length >= configStrategy.chartTF) {
        const prevVolume = candlesAnchorBuffer[candlesAnchorBuffer.length - 2].lastVolume;
        const currVolume = candlesAnchorBuffer[candlesAnchorBuffer.length - 1].lastVolume;

        printToConsole(`🔎 CVD Previous Volume = ${prevVolume.toFixed(2)}, Current Volume = ${currVolume.toFixed(2)}`);
        writeToCSV('Signal', `CVD check, prevVolume=${prevVolume.toFixed(2)}, currVolume=${currVolume.toFixed(2)}`, strategyState.capital);

      if (strategyState.state === 'Entry Taken') {printToConsole(`🔎 CVD Skipped -> Entry Taken`) }

      if (strategyState.state != 'Entry Taken') {

        if (prevVolume <= 0 && currVolume > 0) {
          strategyState.lastSignal = 'Bull';
          strategyState.state = 'Waiting For FVG';
          printToConsole(`📈 Segnale Bullish CVD su TF ${anchorTFMinutes}m (lastVolume: ${currVolume.toFixed(2)})`);
          writeToCSV('Signal', `Bullish CVD su TF ${anchorTFMinutes}m, lastVolume=${currVolume.toFixed(2)}`, strategyState.capital);
        } else if (prevVolume >= 0 && currVolume < 0) {
          strategyState.lastSignal = 'Bear';
          strategyState.state = 'Waiting For FVG';
          printToConsole(`📉 Segnale Bearish CVD su TF ${anchorTFMinutes}m (lastVolume: ${currVolume.toFixed(2)})`);
          writeToCSV('Signal', `Bearish CVD su TF ${anchorTFMinutes}m, lastVolume=${currVolume.toFixed(2)}`, strategyState.capital);
        } else {
          printToConsole(`🔎 Nessun segnale CVD Previous Volume = ${prevVolume.toFixed(2)}, Current Volume = ${currVolume.toFixed(2)}`);
          writeToCSV('Signal', `Nessun CVD, prevVolume=${prevVolume.toFixed(2)}, currVolume=${currVolume.toFixed(2)}`, strategyState.capital);
        }
      } else {
        printToConsole(`⚠️  Insufficienti candele anchor (${candlesAnchorBuffer.length}) per CVD`);
        writeToCSV('Signal', `Insufficienti candele anchor (${candlesAnchorBuffer.length})`, strategyState.capital);
      }
    }

    // Controllo FVG

      if (strategyState.state === 'Waiting For FVG') {
        const fvg = detectFVG(candlesChartTFBuffer, lastCandleIndex);
        if (fvg && fvg.type === strategyState.lastSignal + 'ish') {
          strategyState.fvgWaiting = fvg;
          strategyState.state = 'Enter Position';
          printToConsole(`🔍 FVG ${fvg.type} confermato su TF ${chartTFMinutes}m: top=${fvg.top.toFixed(2)}, bottom=${fvg.bottom.toFixed(2)}`);
          writeToCSV('FVG', `${fvg.type} confermato, top=${fvg.top.toFixed(2)}, bottom=${fvg.bottom.toFixed(2)}, size=${fvg.size.toFixed(2)}`, strategyState.capital);
        }
      }


    // Entrata posizione
    if (strategyState.state === 'Enter Position') {
      const entryPrice = candlesChartTFBuffer[lastCandleIndex].close;
      const atrCVDS = calculateATR(candlesChartTFBuffer, configStrategy.atrLenCVDS || 14);
      const maxATRMult = parseFloat(configStrategy.maxATRMult) || 2;
      const slDistance = atrCVDS * maxATRMult;
      const riskPerTrade = strategyState.capital * configStrategy.riskPerTrade; // Ora da config

      printToConsole(`🚪 Preparazione entrata: entryPrice=${entryPrice.toFixed(2)}, atrCVDS=${atrCVDS.toFixed(2)}, maxATRMult=${maxATRMult.toFixed(2)}, slDistance=${slDistance.toFixed(2)}`);

      if (slDistance <= 0 || !Number.isFinite(slDistance)) {
        printToConsole(`⚠️  Entrata saltata: slDistance non valido (${slDistance})`);
        writeToCSV('Error', `Entrata saltata: slDistance non valido (${slDistance})`, strategyState.capital);
        strategyState.state = 'Waiting For FVG';
        return;
      }

      // Calcola positionSize in unità di asset (es. BTC)
      strategyState.positionSize = (riskPerTrade / slDistance) / entryPrice;

      if (!Number.isFinite(strategyState.positionSize) || strategyState.positionSize <= 0) {
        printToConsole(`⚠️  Entrata saltata: positionSize non valido (${strategyState.positionSize})`);
        writeToCSV('Error', `Entrata saltata: positionSize non valido (${strategyState.positionSize})`, strategyState.capital);
        strategyState.state = 'Waiting For FVG';
        return;
      }

      // Limita positionSize a maxPositionSizePercent del capitale in valore
      const maxPositionValue = strategyState.capital * (configStrategy.maxPositionSizePercent / 100);
      strategyState.positionSize = Math.min(strategyState.positionSize, maxPositionValue / entryPrice);

      printToConsole(`📏 PositionSize calcolato: ${strategyState.positionSize.toFixed(6)} unità`);

      if (strategyState.lastSignal === 'Bull') {
        strategyState.entryPrice = entryPrice;
        strategyState.slTarget = entryPrice - slDistance;
        strategyState.tpTarget = entryPrice + Math.abs(entryPrice - strategyState.slTarget) * (parseFloat(configStrategy.DynamicRR) || 2);
        strategyState.state = 'Entry Taken';
        printToConsole(`🚀 Entrata Long: prezzo=${entryPrice.toFixed(2)}, size=${strategyState.positionSize.toFixed(6)}, SL=${strategyState.slTarget.toFixed(2)}, TP=${strategyState.tpTarget.toFixed(2)}`);
    //     trackTradesToJson('Entry', `Long trade`, strategyState.capital); // <-- Aggiungi questa riga
      
    const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Long trade`, strategyState.capital, candleTS);
    
        writeToCSV('Entry', `Long, prezzo=${entryPrice.toFixed(2)}, size=${strategyState.positionSize.toFixed(6)}, SL=${strategyState.slTarget.toFixed(2)}, TP=${strategyState.tpTarget.toFixed(2)}`, strategyState.capital);
      } else if (strategyState.lastSignal === 'Bear') {
        strategyState.entryPrice = entryPrice;
        strategyState.slTarget = entryPrice + slDistance;
        strategyState.tpTarget = entryPrice - Math.abs(entryPrice - strategyState.slTarget) * (parseFloat(configStrategy.DynamicRR) || 2);
        strategyState.state = 'Entry Taken';
        printToConsole(`🚀 Entrata Short: prezzo=${entryPrice.toFixed(2)}, size=${strategyState.positionSize.toFixed(6)}, SL=${strategyState.slTarget.toFixed(2)}, TP=${strategyState.tpTarget.toFixed(2)}`);
 //       trackTradesToJson('Entry', `Short trade`, strategyState.capital); // <-- Aggiungi questa riga

 const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Short trade`, strategyState.capital, candleTS);


        writeToCSV('Entry', `Short, prezzo=${entryPrice.toFixed(2)}, size=${strategyState.positionSize.toFixed(6)}, SL=${strategyState.slTarget.toFixed(2)}, TP=${strategyState.tpTarget.toFixed(2)}`, strategyState.capital);
      }
    }

    // Gestione posizione aperta
    if (strategyState.state === 'Entry Taken') {
      const currCandle = candlesChartTFBuffer[lastCandleIndex];
      printToConsole(`🔄 Posizione aperta High = ${currCandle.high.toFixed(2)}, Low = ${currCandle.low.toFixed(2)}`);
      printToConsole(`🔄 Posizione aperta TP = ${strategyState.tpTarget.toFixed(2)}, SL = ${strategyState.slTarget.toFixed(2)}`);

      if (strategyState.lastSignal === 'Bull') {
        if (currCandle.low <= strategyState.slTarget) {
          const loss = strategyState.positionSize * (strategyState.entryPrice - currCandle.low);
          strategyState.capital -= loss;
          printToConsole(`❌ Stop Loss colpito: prezzo=${currCandle.low.toFixed(2)}, perdita=${loss.toFixed(2)}, capitale=${strategyState.capital.toFixed(2)}`);
  //        trackTradesToJson('SL', `Stop Loss hit`, strategyState.capital); // <-- Aggiungi questa riga

  const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Stop Loss hit`, strategyState.capital, candleTS);



          writeToCSV('SL', `Prezzo=${currCandle.low.toFixed(2)}, perdita=${loss.toFixed(2)}`, strategyState.capital);
          strategyState = { state: 'Waiting For CVDS', lastSignal: null, entryPrice: null, slTarget: null, tpTarget: null, fvgWaiting: null, positionSize: null, capital: strategyState.capital };
        } else if (currCandle.high >= strategyState.tpTarget) {
          let profit = strategyState.positionSize * (currCandle.high - strategyState.entryPrice);
          // Limita profitto a maxProfitPercentPerTrade del capitale
          const maxProfit = strategyState.capital * (configStrategy.maxProfitPercentPerTrade / 100);
          profit = Math.min(profit, maxProfit);
          strategyState.capital += profit;
          printToConsole(`✅ Take Profit colpito: prezzo=${currCandle.high.toFixed(2)}, profitto=${profit.toFixed(2)}, capitale=${strategyState.capital.toFixed(2)}`);
  //        trackTradesToJson('TP', `Take Profit hit`, strategyState.capital); // <-- Aggiungi questa riga

  const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Take Profit hit`, strategyState.capital, candleTS);





          writeToCSV('TP', `Prezzo=${currCandle.high.toFixed(2)}, profitto=${profit.toFixed(2)}`, strategyState.capital);
          strategyState = { state: 'Waiting For CVDS', lastSignal: null, entryPrice: null, slTarget: null, tpTarget: null, fvgWaiting: null, positionSize: null, capital: strategyState.capital };
        }
      } else if (strategyState.lastSignal === 'Bear') {
        if (currCandle.high >= strategyState.slTarget) {
          const loss = strategyState.positionSize * (currCandle.high - strategyState.entryPrice);
          strategyState.capital -= loss;
          printToConsole(`❌ Stop Loss colpito: prezzo=${currCandle.high.toFixed(2)}, perdita=${loss.toFixed(2)}, capitale=${strategyState.capital.toFixed(2)}`);
  //        trackTradesToJson('SL', `Stop Loss hit`, strategyState.capital); // <-- Aggiungi questa riga


  const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Stop Loss hit`, strategyState.capital, candleTS);





          writeToCSV('SL', `Prezzo=${currCandle.high.toFixed(2)}, perdita=${loss.toFixed(2)}`, strategyState.capital);
          strategyState = { state: 'Waiting For CVDS', lastSignal: null, entryPrice: null, slTarget: null, tpTarget: null, fvgWaiting: null, positionSize: null, capital: strategyState.capital };
        } else if (currCandle.low <= strategyState.tpTarget) {
          let profit = strategyState.positionSize * (strategyState.entryPrice - currCandle.low);
          // Limita profitto a 10% del capitale
          const maxProfit = strategyState.capital * 0.10;
          profit = Math.min(profit, maxProfit);
          strategyState.capital += profit;
          printToConsole(`✅ Take Profit colpito: prezzo=${currCandle.low.toFixed(2)}, profitto=${profit.toFixed(2)}, capitale=${strategyState.capital.toFixed(2)}`);
   //       trackTradesToJson('TP', `Take Profit hit`, strategyState.capital); // <-- Aggiungi questa riga
     
   const candleTS = candlesChartTFBuffer.length > 0 
  ? candlesChartTFBuffer[candlesChartTFBuffer.length - 1].timestamp 
  : Date.now();

trackTradesToJson('Entry', `Take Profit hit`, strategyState.capital, candleTS);
   
          writeToCSV('TP', `Prezzo=${currCandle.low.toFixed(2)}, profitto=${profit.toFixed(2)}`, strategyState.capital);
          strategyState = { state: 'Waiting For CVDS', lastSignal: null, entryPrice: null, slTarget: null, tpTarget: null, fvgWaiting: null, positionSize: null, capital: strategyState.capital };
        }
      }
    }
  } catch (error) {
    printToConsole(`⚠️  Errore strategia: ${error.message}`);
    writeToCSV('Error', `Strategia: ${error.message}`, strategyState.capital);
  }
}

// ------------------- Flusso Principale -------------------

async function runStrategy() {
  try {
    // Verifica e crea directory
    ensureDirectoryExists(candlesDir);
    ensureDirectoryExists(candlesStrategyDir);

    // Verifica esistenza file candles_1m.json
    if (!fs.existsSync(candlesFile)) {
      fs.writeFileSync(candlesFile, JSON.stringify([]));
      printToConsole(`📄 Creato file ${candlesFile}`);
      writeToCSV('Start', `Creato file ${candlesFile}`, strategyState.capital);
    }

    // Inizializza file candele strategia
    if (fs.existsSync(candlesStrategy1mFile)) {
      fs.unlinkSync(candlesStrategy1mFile);
      printToConsole(`🗑️  Eliminato file esistente ${candlesStrategy1mFile}`);
      writeToCSV('Start', `Eliminato file ${candlesStrategy1mFile}`, strategyState.capital);
    }
    fs.writeFileSync(candlesStrategy1mFile, JSON.stringify([]));
    printToConsole(`📄 Creato file ${candlesStrategy1mFile}`);
    writeToCSV('Start', `Creato file ${candlesStrategy1mFile}`, strategyState.capital);

    // Carica candele esistenti per il backtest
    let candles = [];
    if (fs.existsSync(candlesFile)) {
      candles = JSON.parse(fs.readFileSync(candlesFile, 'utf8'));
    }
    printToConsole(`📊 Caricate ${candles.length} candele 1m dallo storico`);
    writeToCSV('Start', `Caricate ${candles.length} candele 1m`, strategyState.capital);

    // Esegui backtest
    if (candles.length > 0) {
      printToConsole(`🚀 Avvio backtest | Capitale iniziale: ${strategyState.capital.toFixed(2)}`);
      writeToCSV('Start', `Avvio backtest`, strategyState.capital);

      // Copia storico
      fs.writeFileSync(candlesStrategy1mFile, JSON.stringify(candles, null, 2));
      printToConsole(`📄 Copiato storico in ${candlesStrategy1mFile}`);
      writeToCSV('Start', `Copiato storico in ${candlesStrategy1mFile}`, strategyState.capital);

      // Elabora candele
      for (let i = 0; i < candles.length; i++) {        
        printToConsole(`📅 Elaborazione candela ${i + 1}/${candles.length} Timestamp ${new Date(candles[i].timestamp).toISOString()}`);
        processCandle(candles[i], i, candles, true);
      }

      printToConsole(`🏁 Backtest completato | Capitale dopo backtest: ${strategyState.capital.toFixed(2)}`);
      writeToCSV('End', `Backtest completato, capitale=${strategyState.capital.toFixed(2)}`, strategyState.capital);
    }

    // Avvia modalità live
    printToConsole(`🔍 Avvio modalità live: controllo ${candlesFile} ogni ${POLLING_INTERVAL} secondi`);
    writeToCSV('Start', `Avvio modalità live`, strategyState.capital);

    setInterval(() => {
      try {
        const newCandles = JSON.parse(fs.readFileSync(candlesFile, 'utf8'));
        if (newCandles.length === 0) return;

        // Copia candele
        fs.writeFileSync(candlesStrategy1mFile, JSON.stringify(newCandles, null, 2));

        // Processa candele nuove
        const candlesToProcess = newCandles.filter(c => c.timestamp > lastProcessedCandleTimestamp);
        if (candlesToProcess.length > 0) {
          printToConsole(`🔔 Rilevate ${candlesToProcess.length} nuove candele`);
          writeToCSV('Monitor', `Rilevate ${candlesToProcess.length} nuove candele`, strategyState.capital);

          for (let i = 0; i < candlesToProcess.length; i++) {
            printToConsole(`📅 Elaborazione candela live (timestamp: ${new Date(candlesToProcess[i].timestamp).toISOString()})`);
            processCandle(candlesToProcess[i], newCandles.indexOf(candlesToProcess[i]), newCandles, false);
          }
        }
      } catch (error) {
        printToConsole(`⚠️  Errore modalità live: ${error.message}`);
        writeToCSV('Error', `Modalità live: ${error.message}`, strategyState.capital);
      }
    }, POLLING_INTERVAL * 1000);

    printToConsole(`🌟 Sistema pronto | Capitale attuale: ${strategyState.capital.toFixed(2)}`);
    writeToCSV('Start', `Sistema pronto`, strategyState.capital);

  } catch (error) {
    printToConsole(`⚠️  Errore iniziale: ${error.message}`);
    writeToCSV('Error', `Inizializzazione: ${error.message}`, strategyState.capital);
    process.exit(1);
  }

}


// Avvia la strategia
runStrategy();