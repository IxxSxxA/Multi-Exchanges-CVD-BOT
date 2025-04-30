/**
 * Calculates the volume delta and cumulative volume delta (CVD) for a given dataset of OHLCV data.
 * Simulates the behavior of PineScript's requestVolumeDelta function.
 * 
 * @param {Array<Object>} historicalData - Array of OHLCV data for the lower timeframe.
 * @param {string} lowerTimeframe - The lower timeframe for intrabar data (e.g., "5", "15", "1D").
 * @param {string} cumulativePeriod - The period for CVD calculation (e.g., "1D"). Default is empty string.
 * @param {string} mainTimeframe - The main timeframe of the chart (from config).
 * @returns {Array<Array<number>>} - Array of tuples [openVolume, hiVolume, loVolume, currentVolume] for each bar in main timeframe.
 */
export default function requestVolumeDelta(historicalData, lowerTimeframe, cumulativePeriod = "", mainTimeframe) {
  // Validate timeframe compatibility (lowerTimeframe must be smaller than mainTimeframe)
  const validateTimeframe = (ltf, mtf) => {
      const ltfMinutes = convertToMinutes(ltf);
      const mtfMinutes = convertToMinutes(mtf);
      if (ltfMinutes >= mtfMinutes) {
          throw new Error("Lower timeframe must be smaller than main timeframe.");
      }
  };

  // Helper to convert timeframe string to minutes for comparison
  const convertToMinutes = (tf) => {
      if (tf.includes("D")) return parseInt(tf) * 24 * 60;
      if (tf.includes("H")) return parseInt(tf) * 60;
      return parseInt(tf);
  };

  validateTimeframe(lowerTimeframe, mainTimeframe);

  // Group historical data into main timeframe bars (simplified logic)
  const groupedData = groupByMainTimeframe(historicalData, lowerTimeframe, mainTimeframe);

  let lastVolume = 0.0;
  let results = [];
  let anchorChangeTimestamp = null;

  groupedData.forEach((barData, index) => {
      // Calculate volume delta for the bar (up vs down volume)
      let delta = 0.0;
      let maxVolume = 0.0;
      let minVolume = 0.0;

      barData.forEach(candle => {
          const isUp = candle.close > candle.open;
          const volumeContribution = isUp ? candle.volume : -candle.volume;
          delta += volumeContribution;
          maxVolume = Math.max(maxVolume, delta);
          minVolume = Math.min(minVolume, delta);
      });

      // Determine if a new cumulative period starts
      const anchorChange = cumulativePeriod === "" || 
          hasTimeframeChange(barData[0].timestamp, cumulativePeriod, anchorChangeTimestamp);
      if (anchorChange) {
          anchorChangeTimestamp = barData[0].timestamp;
      }

      const openVolume = anchorChange ? 0.0 : lastVolume;
      const hiVolume = openVolume + maxVolume;
      const loVolume = openVolume + minVolume;
      lastVolume = openVolume + delta;

      results.push([openVolume, hiVolume, loVolume, lastVolume]);
  });

  return results;
}

// Helper to group lower timeframe data into main timeframe bars (simplified)
function groupByMainTimeframe(data, lowerTF, mainTF) {
  // This is a placeholder. In a real implementation, you would group lower timeframe candles
  // into main timeframe bars based on timestamps and timeframe duration.
  // For now, assume data is already grouped or implement your own logic based on timestamps.
  return [data]; // Simplified: treat all data as one bar (to be replaced with real grouping)
}

// Helper to detect timeframe change for cumulative period reset
function hasTimeframeChange(timestamp, period, lastAnchor) {
  if (!lastAnchor) return true;
  // Simplified logic: check if timestamp crosses the period boundary (e.g., new day for "1D").
  // In a real implementation, use date libraries like moment.js or date-fns to handle periods.
  return false; // Placeholder
}
