// main.js
import { CVDStrategy } from './cvdStrategy.js';
import { config } from './configGrid.js';
import fs from 'fs';
import path from 'path';

async function main() {
    try {
        // Load candle data
        const rawData = fs.readFileSync('./gridSearch/dataTraining/candles_1m.json');
        const candles1m = JSON.parse(rawData);
        
        // Initialize strategy
        const strategy = new CVDStrategy();
        await strategy.initialize(candles1m);
        
        // Run strategy
        const { trades, summary } = strategy.runStrategy();
        
        // Output summary
        console.log('\n=== BACKTEST SUMMARY ===');
        console.log(`Initial Capital: $${summary.initialCapital.toFixed(2)}`);
        console.log(`Final Capital: $${summary.finalCapital.toFixed(2)}`);
        console.log(`Total PnL: $${summary.totalPnL.toFixed(2)} (${summary.pnlPercent.toFixed(2)}%)`);
        console.log(`Total Trades: ${summary.totalTrades}`);
        console.log(`Winning Trades: ${summary.winningTrades} (${summary.winRate.toFixed(2)}%)`);
        console.log(`Average Win: $${summary.avgWin.toFixed(2)}`);
        console.log(`Average Loss: $${summary.avgLoss.toFixed(2)}`);
        console.log(`Profit Factor: ${summary.profitFactor.toFixed(2)}`);
        console.log(`Max Consecutive Wins: ${summary.maxConsecutiveWins}`);
        console.log(`Max Consecutive Losses: ${summary.maxConsecutiveLosses}`);
        
        // Save detailed results
        const resultsDir = path.dirname(config.backtestResultsPath);
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        fs.writeFileSync(config.backtestResultsPath, JSON.stringify({ trades, summary }, null, 2));
        console.log(`\nDetailed results saved to ${config.backtestResultsPath}`);
        
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main();