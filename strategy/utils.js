// ../strategy/utils.js

// Calcola l'ATR (Average True Range) per un dato periodo
export const calculateATR = (candles, period) => {
    if (candles.length < period) return null;

    const trueRanges = candles.slice(-period).map((c, i) => {
        if (i === 0) return c.high - c.low;
        const prevClose = candles[candles.length - period + i - 1].close;
        return Math.max(
            c.high - c.low,
            Math.abs(c.high - prevClose),
            Math.abs(c.low - prevClose)
        );
    });

    return trueRanges.reduce((sum, val) => sum + val, 0) / period;
};

// Calcola la SMA (Simple Moving Average) per un dato periodo
export const calculateSMA = (values, period) => {
    if (values.length < period) return 0;
    const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
    return sum / period;
};