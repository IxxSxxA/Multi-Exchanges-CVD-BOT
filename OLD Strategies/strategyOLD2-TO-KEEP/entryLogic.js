// entryLogic.js aggiornato con gestione stato FVG + log CVD, trade e salvataggio

import {
    createFVGInfo,
    isFVGValidInTimeframe,
    isIFVGValidInTimeframe
  } from './fvgUtils.js';
  
  import fs from 'fs';
  import path from 'path';
  
  let FVGInfoList = [];
  let trades = [];
  
  export function updateFVGs(candles, config, atr, volumeSMA5, volumeSMA15) {
    const {
      lookbackPeriod,
      fvgSensitivity,
      showLastXFVGs,
      logEnabled,
      symbol,
      timeframe
    } = config;
  
    const lastIndex = candles.length - 1;
  
    for (let i = 2; i <= lastIndex; i++) {
      const bar = candles[i];
      const bar1 = candles[i - 1];
      const bar2 = candles[i - 2];
  
      const firstBarSize = Math.abs(bar.close - bar.open);
      const secondBarSize = Math.abs(bar1.close - bar1.open);
      const thirdBarSize = Math.abs(bar2.close - bar2.open);
      const barSizeSum = firstBarSize + secondBarSize + thirdBarSize;
  
      const allBearish = bar.open > bar.close && bar1.open > bar1.close && bar2.open > bar2.close;
      const allBullish = bar.open <= bar.close && bar1.open <= bar1.close && bar2.open <= bar2.close;
      const fvgBarsCheck = allBullish || allBearish;
  
      const shortTerm = volumeSMA5[i];
      const longTerm = volumeSMA15[i];
      const threshold = longTerm * 0.5;
  
      const bearCondition = shortTerm > threshold;
      const bullCondition = shortTerm > threshold;
  
      const bearFVG = bar.high < bar2.low && bar1.close < bar2.low && bearCondition;
      const bullFVG = bar.low > bar2.high && bar1.close > bar2.high && bullCondition;
  
      const volSum3 = bar.vBuy + bar.vSell + bar1.vBuy + bar1.vSell + bar2.vBuy + bar2.vSell;
      const size = bearFVG ? Math.abs(bar2.low - bar.high) : bullFVG ? Math.abs(bar.low - bar2.high) : 0;
      const sizeEnough = (size * fvgSensitivity > atr[i]);
  
      if (sizeEnough && (bearFVG || bullFVG)) {
        const fvg = createFVGInfo(
          bearFVG ? bar2.low : bar.low,
          bearFVG ? bar.high : bar2.high,
          bullFVG,
          bar.timestamp,
          config.timeframe
        );
        fvg.startTime = bar2.timestamp;
        fvg.startBarIndex = i - 2;
        fvg.lastTouched = i;
        fvg.totalVolume = volSum3;
        fvg.lowVolume = bullFVG ? bar2.vBuy + bar2.vSell : bar.vBuy + bar.vSell + bar1.vBuy + bar1.vSell;
        fvg.highVolume = bullFVG ? bar.vBuy + bar.vSell + bar1.vBuy + bar1.vSell : bar2.vBuy + bar2.vSell;
        fvg.state = 'waiting';
        FVGInfoList.unshift({ fvg });
        while (FVGInfoList.length > showLastXFVGs) FVGInfoList.pop();
      }
  
      const last = candles[i];
      for (const item of FVGInfoList) {
        const fvg = item.fvg;
  
        // Stato da waiting a triggered
        if (fvg.state === 'waiting') {
          if ((fvg.isBullish && last.low <= fvg.high) || (!fvg.isBullish && last.high >= fvg.low)) {
            fvg.state = 'triggered';
            fvg.lastTouched = i;
  
            // Simulazione trade entry
            const trade = {
              direction: fvg.isBullish ? 'LONG' : 'SHORT',
              entryPrice: fvg.isBullish ? fvg.high : fvg.low,
              stopLoss: fvg.isBullish ? fvg.low - atr[i] : fvg.high + atr[i],
              takeProfit: fvg.isBullish ? fvg.high + 2 * atr[i] : fvg.low - 2 * atr[i],
              entryTime: last.timestamp,
              entryBar: i
            };
            trades.push(trade);
            last.tradeExecuted = true;
            last.tradeDirection = trade.direction;
            last.entryPrice = trade.entryPrice;
            last.stopLoss = trade.stopLoss;
            last.takeProfit = trade.takeProfit;
          }
        }
  
        // Stato da triggered a invalidated
        if (fvg.state === 'triggered') {
          const invalid = (!fvg.isBullish && last.high > fvg.low) || (fvg.isBullish && last.low < fvg.high);
          if (invalid) {
            fvg.state = 'invalidated';
            fvg.endBarIndex = i;
            fvg.endTime = last.timestamp;
          }
        }
      }
  
      // Log
      if (logEnabled) {
        const ts = new Date(bar.timestamp).toISOString();
        const cvd = bar.vBuy - bar.vSell;
  
        console.log(`\n[CANDLE ${i}/${lastIndex}] ${ts}`);
        console.log(`  Price:  O=${bar.open}, H=${bar.high}, L=${bar.low}, C=${bar.close}`);
        console.log(`  Volume: Buy=${bar.vBuy.toFixed(2)} | Sell=${bar.vSell.toFixed(2)} | CVD=${cvd.toFixed(2)}`);
        console.log(`  VolSMA: SMA5=${volumeSMA5[i]?.toFixed(2)} | SMA15=${volumeSMA15[i]?.toFixed(2)}`);
        console.log(`  ATR:    ${atr[i]?.toFixed(2)}`);
  
        const activeFVGs = FVGInfoList.filter(info => info.fvg.state !== 'invalidated');
        if (activeFVGs.length > 0) {
          console.log(`  FVGs attivi: ${activeFVGs.length}`);
          activeFVGs.forEach((info, idx) => {
            const fvg = info.fvg;
            const range = `[${fvg.low.toFixed(2)} - ${fvg.high.toFixed(2)}]`;
            const touch = fvg.lastTouched ? candles[fvg.lastTouched].timestamp : 'mai';
            console.log(`    #${idx + 1} ${fvg.isBullish ? '↑' : '↓'} | Stato: ${fvg.state} | Range: ${range} | Ultimo tocco: ${new Date(touch).toISOString()}`);
          });
        } else {
          console.log(`  Nessun FVG attivo`);
        }
  
        if (bar.tradeExecuted) {
          console.log(`  💥 TRADE: ${bar.tradeDirection} | Entry: ${bar.entryPrice.toFixed(2)} | SL: ${bar.stopLoss.toFixed(2)} | TP: ${bar.takeProfit.toFixed(2)}`);
        }
      }
    }
  
    // Salvataggio risultati
    const resultsDir = path.join('results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
//    const resultsFile = path.join(resultsDir, `trades_${symbol}_${timeframe}.json`);
    const resultsFile = path.join(resultsDir, `trades.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(trades, null, 2));
  
    return FVGInfoList.filter(info => info.fvg.state !== 'invalidated');
  }
  