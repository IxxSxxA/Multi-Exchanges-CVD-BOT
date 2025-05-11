// ../strategy/cvd.js
import { CVD_CONFIG } from './configStrategy.js';
import logger from './logger.js';
import { calculateATR } from './utils.js';

export const requestVolumeDelta = (candles, lowerTimeframe) => {
    try {
        // Validate input
        if (!candles || !Array.isArray(candles) || candles.length === 0) {
            logger.error('Invalid candle data input');
            return getDefaultResponse();
        }

        // Calculate ATR
        const atr = calculateATR(candles, CVD_CONFIG.atrLen);
        
        // Use sliding window
        const windowSize = Math.min(CVD_CONFIG.atrLenCVDS, candles.length);
        const recentCandles = candles.slice(-windowSize);
        
        logger.debug(`Volume window: size=${recentCandles.length}`);
        
        // Calculate volumes
        const [posVol, negVol, totalVol, maxVol, minVol] = calculateVolumes(recentCandles);
        
        return {
            delta: totalVol,
            cumulative: posVol + negVol,
            atr: atr,
            metrics: {
                positive: posVol,
                negative: negVol,
                max: maxVol,
                min: minVol
            }
        };
    } catch (error) {
        logger.error(`Error in requestVolumeDelta: ${error.message}`);
        return getDefaultResponse();
    }
};

// Helper functions
const calculateVolumes = (candles) => {
    return candles.reduce((acc, candle) => {
        const volume = candle.vBuy - candle.vSell;
        return [
            volume > 0 ? acc[0] + volume : acc[0],        // posVol
            volume < 0 ? acc[1] + volume : acc[1],        // negVol
            acc[2] + volume,                              // totalVol
            Math.max(acc[3], volume),                     // maxVolume
            Math.min(acc[4], volume)                      // minVolume
        ];
    }, [0, 0, 0, -Infinity, Infinity]);
};

const getDefaultResponse = () => ({
    delta: 0,
    cumulative: 0,
    atr: 0,
    metrics: {
        positive: 0,
        negative: 0,
        max: 0,
        min: 0
    }
});