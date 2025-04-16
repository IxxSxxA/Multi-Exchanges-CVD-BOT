// cvdStrategy.js
import { config } from './configGrid.js';
import { TradingUtils } from './utils.js';

export class CVDStrategy {
    constructor() {
        this.cvdsList = [];
        this.lastCVDS = null;
        this.atr = [];
        this.atrCVDS = [];
        this.fvgList = [];
        this.currentTimeframeCandles = [];
        this.anchorTimeframeCandles = [];
        this.portfolio = {
            capital: config.initialCapital,
            positions: [],
            equityCurve: []
        };
        this.currentVolumeDelta = 0;
        this.currentCapital = config.initialCapital;
        TradingUtils.initCSVLog();
        this.logConfig();
    }

    logConfig() {
        console.log('\n=== STRATEGY CONFIGURATION ===');
        console.log(`Timeframe: ${config.currentTimeframe}`);
        console.log(`Anchor TF: ${config.anchorTimeframe}`);
        console.log(`Entry Mode: ${config.entryMode}`);
        console.log(`Signal Type: ${config.signalType}`);
        console.log(`FVG Sensitivity: ${config.fvgSensitivity}`);
        console.log(`TP/SL Method: ${config.tpslMethod}`);
        console.log(`Risk Amount: ${config.riskAmount}`);
        console.log(`Initial Capital: $${config.initialCapital}`);
        console.log('=============================\n');
    }

    async initialize(candles1m) {
        TradingUtils.logToFile("Initializing strategy", {
            initialCapital: config.initialCapital,
            config
        });

        const candlesWithCVD = TradingUtils.calculateCVD(candles1m);
        
        this.currentTimeframeCandles = TradingUtils.aggregateTimeframe(
            candlesWithCVD, 
            '1m', 
            config.currentTimeframe
        );
        
        this.anchorTimeframeCandles = TradingUtils.aggregateTimeframe(
            candlesWithCVD, 
            '1m', 
            config.anchorTimeframe
        );
        
        this.atr = TradingUtils.calculateATR(this.currentTimeframeCandles, config.atrLen);
        this.atrCVDS = TradingUtils.calculateATR(this.currentTimeframeCandles, config.atrLenCVDS);

        TradingUtils.logToFile("Strategy initialized", {
            currentTimeframeCandles: this.currentTimeframeCandles.length,
            anchorTimeframeCandles: this.anchorTimeframeCandles.length,
            firstCandle: this.currentTimeframeCandles[0],
            lastCandle: this.currentTimeframeCandles[this.currentTimeframeCandles.length - 1]
        });
    }

    getVolumeDelta(anchorCandleIndex) {
        if (!this.anchorTimeframeCandles[anchorCandleIndex]) {
            return { openVolume: 0, maxVolume: 0, minVolume: 0, lastVolume: 0 };
        }
        
        const anchorCandle = this.anchorTimeframeCandles[anchorCandleIndex];
        return {
            openVolume: anchorCandle.openVolume,
            maxVolume: anchorCandle.maxVolume,
            minVolume: anchorCandle.minVolume,
            lastVolume: anchorCandle.lastVolume
        };
    }

    processSignal(currentCandleIndex) {
        const anchorIndex = Math.floor(currentCandleIndex / (15/3)); // 3m→15m
        const { lastVolume, openVolume } = this.getVolumeDelta(anchorIndex);
        const currentCandle = this.currentTimeframeCandles[currentCandleIndex];
        
        // Log dettagliato del volume delta
        TradingUtils.logToCSV({
            timestamp: currentCandle.timestamp,
            price: currentCandle.close,
            volume_delta: lastVolume,
            atr: this.atr[currentCandleIndex],
            atr_cvds: this.atrCVDS[currentCandleIndex]
        });
        
        // Exact RAW signal logic from PineScript
        let signal = null;
        
        
        // Bullish signal condition
        if (lastVolume > 0 && (currentCandleIndex === 0 || openVolume <= 0)) {
            signal = { 
                type: 'Bullish', 
                timestamp: currentCandle.timestamp,
                candleIndex: currentCandleIndex
            };
        } 
        // Bearish signal condition
        else if (lastVolume < 0 && (currentCandleIndex === 0 || openVolume >= 0)) {
            signal = { 
                type: 'Bearish', 
                timestamp: currentCandle.timestamp,
                candleIndex: currentCandleIndex
            };
        }
        
        return signal;
    }

    detectFVGs(currentCandleIndex) {
        const candles = this.currentTimeframeCandles;
        if (currentCandleIndex < 2) return [];
        
        const candle = candles[currentCandleIndex];
        const prev1 = candles[currentCandleIndex - 1];
        const prev2 = candles[currentCandleIndex - 2];
        
        const atrValue = this.atr[currentCandleIndex] || 1;
        const fvgs = [];
        
        // Calculate maxCODiff as in PineScript
        const maxCODiff = Math.max(
            Math.abs(prev2.close - prev1.open),
            Math.abs(prev1.close - candle.open)
        );
        
        // Bullish FVG condition
        if (candle.low > prev2.high && prev1.close > prev2.high) {
            const fvgSize = Math.abs(candle.low - prev2.high);
            const barSizeSum = Math.abs(candle.open - candle.close) + 
                              Math.abs(prev1.open - prev1.close) + 
                              Math.abs(prev2.open - prev2.close);
            
            // Exact PineScript condition with extreme sensitivity (6)
            if ((!config.fvgSensEnabled || barSizeSum * config.fvgSensitivity > atrValue / 1.5) &&
                (config.allowGaps || maxCODiff <= atrValue)) {
                
                if (config.fvgBars === "SameType") {
                    const allBullish = candle.open <= candle.close && 
                                     prev1.open <= prev1.close && 
                                     prev2.open <= prev2.close;
                    const allBearish = candle.open > candle.close && 
                                     prev1.open > prev1.close && 
                                     prev2.open > prev2.close;
                    
                    if (allBullish || allBearish) {
                        fvgs.push({
                            max: candle.low,
                            min: prev2.high,
                            isBull: true,
                            startTime: prev2.timestamp,
                            startBarIndex: currentCandleIndex - 2,
                            totalVolume: candle.volume + prev1.volume + prev2.volume
                        });
                    }
                } else {
                    fvgs.push({
                        max: candle.low,
                        min: prev2.high,
                        isBull: true,
                        startTime: prev2.timestamp,
                        startBarIndex: currentCandleIndex - 2,
                        totalVolume: candle.volume + prev1.volume + prev2.volume
                    });
                }
            }
        }
        
        // Bearish FVG condition (symmetric)
        if (candle.high < prev2.low && prev1.close < prev2.low) {
            const fvgSize = Math.abs(prev2.low - candle.high);
            const barSizeSum = Math.abs(candle.open - candle.close) + 
                              Math.abs(prev1.open - prev1.close) + 
                              Math.abs(prev2.open - prev2.close);
            
            if ((!config.fvgSensEnabled || barSizeSum * config.fvgSensitivity > atrValue / 1.5) &&
                (config.allowGaps || maxCODiff <= atrValue)) {
                
                if (config.fvgBars === "SameType") {
                    const allBullish = candle.open <= candle.close && 
                                     prev1.open <= prev1.close && 
                                     prev2.open <= prev2.close;
                    const allBearish = candle.open > candle.close && 
                                     prev1.open > prev1.close && 
                                     prev2.open > prev2.close;
                    
                    if (allBullish || allBearish) {
                        fvgs.push({
                            max: prev2.low,
                            min: candle.high,
                            isBull: false,
                            startTime: prev2.timestamp,
                            startBarIndex: currentCandleIndex - 2,
                            totalVolume: candle.volume + prev1.volume + prev2.volume
                        });
                    }
                } else {
                    fvgs.push({
                        max: prev2.low,
                        min: candle.high,
                        isBull: false,
                        startTime: prev2.timestamp,
                        startBarIndex: currentCandleIndex - 2,
                        totalVolume: candle.volume + prev1.volume + prev2.volume
                    });
                }
            }
        }

        // Log FVG detection
        if (fvgs.length > 0) {
            TradingUtils.logToCSV({
                timestamp: this.currentTimeframeCandles[currentCandleIndex].timestamp,
                fvg_present: true,
                fvg_type: fvgs[0].isBull ? 'Bullish' : 'Bearish',
                fvg_size: fvgs[0].isBull ? 
                    (fvgs[0].max - fvgs[0].min) : 
                    (fvgs[0].min - fvgs[0].max)
            });
        }
        
        return fvgs;
    }

    runStrategy() {
        
        console.log('\n=== STRATEGY EXECUTION STARTED ===');
        console.log(`Processing ${this.currentTimeframeCandles.length} candles`);
        
        const results = []; // Aggiungi questa linea per definire results
        let currentCapital = config.initialCapital;
        
        for (let i = 0; i < this.currentTimeframeCandles.length; i++) {
            const candle = this.currentTimeframeCandles[i];
            const signal = this.processSignal(i);
            const fvgs = this.detectFVGs(i);
            
            if (signal && fvgs.length > 0) {
                const matchingFvg = fvgs.find(fvg => 
                    (signal.type === 'Bullish' && fvg.isBull) || 
                    (signal.type === 'Bearish' && !fvg.isBull)
                );
                
                if (matchingFvg) {
                    const entryPrice = candle.close;
                    let slTarget, tpTarget;
                    
                    if (config.tpslMethod === 'Fixed') {
                        const percent = signal.type === 'Bullish' ? 1 : -1;
                        slTarget = entryPrice * (1 - percent * config.slPercent / 100);
                        tpTarget = entryPrice * (1 + percent * config.tpPercent / 100);
                    } else {
                        const atr = this.atrCVDS[i] || 1;
                        const mult = signal.type === 'Bullish' ? 1 : -1;
                        slTarget = entryPrice - mult * atr * config.riskAmount;
                        tpTarget = entryPrice + mult * Math.abs(entryPrice - slTarget) * config.dynamicRR;
                    }
                    
                    const trade = {
                        timestamp: candle.timestamp,
                        type: signal.type,
                        entryPrice,
                        slTarget,
                        tpTarget,
                        fvg: matchingFvg,
                        atr: this.atr[i],
                        status: 'open',
                        exitPrice: null,
                        exitTime: null,
                        exitReason: null,
                        pnl: null,
                        pnlPercent: null
                    };
                    
                    // Simulate trade execution
                    const positionSize = currentCapital * 0.1;
                    const isLong = signal.type === 'Bullish';
                    
                    // Check for exit conditions
                    for (let j = i + 1; j < this.currentTimeframeCandles.length; j++) {
                        const exitCandle = this.currentTimeframeCandles[j];
                        
                        if ((isLong && exitCandle.high >= tpTarget) || 
                            (!isLong && exitCandle.low <= tpTarget)) {
                            trade.exitPrice = tpTarget;
                            trade.exitTime = exitCandle.timestamp;
                            trade.exitReason = 'TP';
                            break;
                        }
                        
                        if ((isLong && exitCandle.low <= slTarget) || 
                            (!isLong && exitCandle.high >= slTarget)) {
                            trade.exitPrice = slTarget;
                            trade.exitTime = exitCandle.timestamp;
                            trade.exitReason = 'SL';
                            break;
                        }
                    }
                    
                    if (trade.exitPrice) {
                        trade.status = 'closed';
                        trade.pnl = isLong ? 
                            (trade.exitPrice - trade.entryPrice) * (positionSize / trade.entryPrice) :
                            (trade.entryPrice - trade.exitPrice) * (positionSize / trade.entryPrice);
                        trade.pnlPercent = (trade.pnl / positionSize) * 100;
                        currentCapital += trade.pnl;
                        
                        this.portfolio.equityCurve.push({
                            timestamp: trade.exitTime,
                            capital: currentCapital,
                            tradeId: results.length
                        });
                    }
                    
                    results.push(trade);
                    this.lastCVDS = trade;
                    this.cvdsList.push(trade);
                    
                    TradingUtils.logToCSV({
                        timestamp: candle.timestamp,
                        action: 'ENTRY',
                        entry_price: entryPrice,
                        sl_price: slTarget,
                        tp_price: tpTarget,
                        capital: currentCapital,
                        position_size: positionSize
                    });
                }
            }
        }
        
        const summary = this.generateBacktestSummary(results, currentCapital);
        TradingUtils.saveBacktestResults({ trades: results, summary });
        

        console.log('\n=== STRATEGY EXECUTION COMPLETED ===');
        console.log(`Total trades: ${results.length}`);
        console.log(`First trade: ${results[0]?.timestamp || 'N/A'}`);
        console.log(`Last trade: ${results[results.length-1]?.timestamp || 'N/A'}`);




        return { trades: results, summary };
    }

    generateBacktestSummary(trades, finalCapital) {
        const closedTrades = trades.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl <= 0);
        
        const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
        const winRate = closedTrades.length > 0 ? 
            (winningTrades.length / closedTrades.length) * 100 : 0;
        
        const avgWin = winningTrades.length > 0 ? 
            winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
        
        const avgLoss = losingTrades.length > 0 ? 
            losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;
        
        const profitFactor = losingTrades.length > 0 ? 
            Math.abs(winningTrades.reduce((sum, t) => sum + t.pnl, 0) / 
                   losingTrades.reduce((sum, t) => sum + t.pnl, 0)) : Infinity;
        
        return {
            initialCapital: config.initialCapital,
            finalCapital,
            totalPnL,
            pnlPercent: ((finalCapital - config.initialCapital) / config.initialCapital) * 100,
            totalTrades: closedTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            maxConsecutiveWins: this.calculateMaxConsecutive(closedTrades, true),
            maxConsecutiveLosses: this.calculateMaxConsecutive(closedTrades, false)
        };
    }

    calculateMaxConsecutive(trades, countWins) {
        let max = 0;
        let current = 0;
        
        for (const trade of trades) {
            if ((countWins && trade.pnl > 0) || (!countWins && trade.pnl <= 0)) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 0;
            }
        }
        
        return max;
    }

    updateFVGsStatus(currentCandleIndex, candle) {
        for (const fvg of this.fvgList) {
            // Check if FVG is touched
            if ((fvg.isBull && candle.low <= fvg.max) || 
                (!fvg.isBull && candle.high >= fvg.min)) {
                fvg.lastTouched = currentCandleIndex;
            }
            
            // Check FVG invalidation
            if (config.fvgEndMethod === 'Close') {
                if ((fvg.isBull && candle.close < fvg.min) || 
                    (!fvg.isBull && candle.close > fvg.max)) {
                    fvg.endTime = candle.timestamp;
                    fvg.endBarIndex = currentCandleIndex;
                }
            } else { // Wick method
                if ((fvg.isBull && candle.low < fvg.min) || 
                    (!fvg.isBull && candle.high > fvg.max)) {
                    fvg.endTime = candle.timestamp;
                    fvg.endBarIndex = currentCandleIndex;
                }
            }
        }
        
        // Remove invalid FVGs
        this.fvgList = this.fvgList.filter(fvg => 
            !fvg.endTime || 
            (currentCandleIndex - fvg.endBarIndex) <= config.deleteUntouchedAfterXBars
        );
    }
}