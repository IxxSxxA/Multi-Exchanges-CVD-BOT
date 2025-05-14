import logger from './logger.js';

/**
 * Calculates Average True Range (ATR) for a given period
 * @param {Array} candles Array of candles with high, low, close prices
 * @param {number} period Number of periods for ATR calculation
 * @returns {number} ATR value
 */
export const calculateATR = (candles, period) => {
    try {
        if (!candles || candles.length < period) {
            logger.debug(`ATR calculation skipped: insufficient data (${candles?.length ?? 0} < ${period})`);
            return 0;
        }

        // Calculate True Range series
        const trueRanges = candles.map((candle, index) => {
            if (index === 0) {
                return candle.high - candle.low;
            }
            
            const prevClose = candles[index - 1].close;
            return Math.max(
                candle.high - candle.low,
                Math.abs(candle.high - prevClose),
                Math.abs(candle.low - prevClose)
            );
        });

        // Use Wilder's Smoothing for ATR
        const atr = trueRanges
            .slice(-period)
            .reduce((sum, tr) => sum + tr, 0) / period;

        logger.debug(`ATR calculated: ${atr.toFixed(2)} (period: ${period})`);
        return atr;
    } catch (error) {
        logger.error(`Error calculating ATR: ${error.message}`);
        return 0;
    }
};

/**
 * Calculates Simple Moving Average (SMA) for a given period
 * @param {Array<number>} values Array of numeric values
 * @param {number} period Number of periods for SMA calculation
 * @returns {number} SMA value
 */
export const calculateSMA = (values, period) => {
    try {
        if (!Array.isArray(values) || values.length < period) {
            logger.debug(`SMA calculation skipped: insufficient data (${values?.length ?? 0} < ${period})`);
            return 0;
        }

        const sum = values
            .slice(-period)
            .reduce((acc, val) => acc + val, 0);
        
        const sma = sum / period;
        logger.debug(`SMA calculated: ${sma.toFixed(2)} (period: ${period})`);
        return sma;
    } catch (error) {
        logger.error(`Error calculating SMA: ${error.message}`);
        return 0;
    }
};

/**
 * Validates candle data structure
 * @param {Object} candle Single candle object
 * @returns {boolean} True if valid, false otherwise
 */
export const validateCandle = (candle) => {
    const requiredProps = ['timestamp', 'open', 'high', 'low', 'close', 'vBuy', 'vSell'];
    return requiredProps.every(prop => {
        const isValid = prop in candle && typeof candle[prop] === 'number';
        if (!isValid) {
            logger.error(`Invalid candle: missing or invalid ${prop}`);
        }
        return isValid;
    });
};