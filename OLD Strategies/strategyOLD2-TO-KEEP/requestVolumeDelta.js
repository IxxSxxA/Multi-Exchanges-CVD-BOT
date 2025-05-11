// requestVolumeDelta.js

/**
 * Simula il comportamento di ta.requestVolumeDelta in PineScript
 * @param {Array} lowerTFcandles - candele più basse (es. 1m), contenenti { vBuy, vSell, timestamp }
 * @param {string} anchorPeriod - es: "15m", "1D", "" ("" = no reset CVD)
 * @param {Array} mainCandles - candele del TF principale su cui proiettare i valori
 * @returns {Array} - [{ timestamp, openVolume, hiVolume, loVolume, lastVolume }]
 */
export function requestVolumeDelta(lowerTFcandles, anchorPeriod, mainCandles) {
    const result = [];
    let lastVolume = 0;
    let currentAnchorStart = null;
  
    for (let i = 0; i < mainCandles.length; i++) {
      const bar = mainCandles[i];
      const barStart = bar.timestamp;
      const barEnd = i < mainCandles.length - 1
        ? mainCandles[i + 1].timestamp
        : barStart + estimateBarDuration(mainCandles);
  
      const candlesInRange = lowerTFcandles.filter(c =>
        c.timestamp >= barStart && c.timestamp < barEnd
      );
  
      const delta = candlesInRange.reduce((acc, c) =>
        acc + ((c.vBuy || 0) - (c.vSell || 0)), 0
      );
  
      const anchorChanged = anchorPeriod
        ? didAnchorChange(currentAnchorStart, barStart, anchorPeriod)
        : false;
  
      const openVolume = anchorChanged ? 0 : lastVolume;
      const lastVol = openVolume + delta;
      const hiVolume = Math.max(openVolume, lastVol);
      const loVolume = Math.min(openVolume, lastVol);
  
      lastVolume = lastVol;
      currentAnchorStart = barStart;
  
      result.push({
        timestamp: barStart,
        openVolume,
        hiVolume,
        loVolume,
        lastVolume: lastVol
      });
    }
  
    return result;
  }
  
  function didAnchorChange(prevAnchor, currentTime, anchorPeriod) {
    if (!anchorPeriod || anchorPeriod === '') return false;
  
    const anchorMs = parseAnchorPeriod(anchorPeriod);
    if (!anchorMs) return false;
  
    return prevAnchor === null ||
      Math.floor(prevAnchor / anchorMs) !== Math.floor(currentTime / anchorMs);
  }
  
  function parseAnchorPeriod(p) {
    const match = /^(\d+)([mhdw])$/i.exec(p);
    if (!match) return 0;
  
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
  
    switch (unit) {
      case 'm': return val * 60 * 1000;
      case 'h': return val * 60 * 60 * 1000;
      case 'd': return val * 24 * 60 * 60 * 1000;
      case 'w': return val * 7 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }
  
  function estimateBarDuration(candles) {
    if (candles.length < 2) return 60 * 1000;
    const last = candles.length - 1;
    return candles[last].timestamp - candles[last - 1].timestamp;
  }
  