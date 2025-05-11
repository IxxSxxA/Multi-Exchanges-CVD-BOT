// fvgUtils.js

// === Struttura FVG (base per ogni oggetto FVG) ===
export function createFVGInfo(low, high, isBullish, timestamp, timeframe) {
    return {
      high,
      low,
      isBullish,
      timestamp,
      timeframe,
      state: 'waiting',
      lastTouched: null,
      startBarIndex: null,
      startTime: timestamp,
      endBarIndex: null,
      endTime: null,
      totalVolume: 0,
      lowVolume: 0,
      highVolume: 0,
  
      isInverse: false,
      inverseVolume: 0,
      inverseEndTime: null,
      inverseEndIndex: null,
      lastTouchedIFVG: null,
  
      disabled: false,
      extendInfinite: false,
  
      index: null,     // utile per identificare il barIndex
      tfIndex: null,   // utile se lavori con timeframe multipli
      isInvalid: false,
      isInvalidIFVG: false
    };
  }
  
  // === Wrapper opzionale per elementi grafici (non usato in logica FVG core) ===
  export function createFVG(fvgInfo) {
    return {
      info: fvgInfo,
      isRendered: false,
  
      fvgBox: null,
      ifvgBox: null,
      fvgBoxText: null,
      fvgBoxPositive: null,
      fvgBoxNegative: null,
      fvgSeparator: null,
      fvgTextSeparator: null
    };
  }
  
  // === Verifiche validità FVG ===
  export function isFVGValid(fvg) {
    return !fvg.isInvalid;
  }
  
  export function isIFVGValid(fvg) {
    return !fvg.isInvalidIFVG;
  }
  
  export function isFVGValidInTimeframe(fvg) {
    return isFVGValid(fvg) && fvg.lastTouched === 0;
  }
  
  export function isIFVGValidInTimeframe(fvg) {
    return isIFVGValid(fvg) && fvg.lastTouchedIFVG === 0;
  }
  
  // === Utility geometriche ===
  export function areaOfFVG(fvg) {
    return Math.abs(fvg.high - fvg.low);
  }
  
  export function doFVGsTouch(fvg1, fvg2) {
    return (
      fvg1.low <= fvg2.high && fvg1.high >= fvg2.low
    );
  }
  
  // === Verifiche presenza in array (per evitare duplicati) ===
  export function arrHasFVG(arr, fvg) {
    return arr.some(item =>
      item.index === fvg.index &&
      item.tfIndex === fvg.tfIndex &&
      item.high === fvg.high &&
      item.low === fvg.low
    );
  }
  
  export function arrHasIFVG(arr, fvg) {
    return arr.some(item =>
      item.inverseEndIndex === fvg.index &&
      item.tfIndex === fvg.tfIndex &&
      item.high === fvg.high &&
      item.low === fvg.low
    );
  }
  
  // === Combinazione FVGs ===
  export function combineFVGsFunc(fvgList) {
    if (fvgList.length === 0) return [];
  
    const sorted = [...fvgList].sort((a, b) => a.timestamp - b.timestamp);
    const combined = [];
  
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (!isFVGValid(current)) continue;
  
      let merged = { ...current };
      let mergedAny = false;
  
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        if (!isFVGValid(next)) continue;
  
        if (merged.tfIndex !== next.tfIndex) continue;
        if (merged.isBullish !== next.isBullish) continue;
  
        if (doFVGsTouch(merged, next)) {
          merged = {
            ...merged,
            high: Math.max(merged.high, next.high),
            low: Math.min(merged.low, next.low),
            index: Math.min(merged.index ?? Infinity, next.index ?? Infinity),
            timestamp: Math.min(merged.timestamp, next.timestamp),
            combined: true,
            combinedTimeframesStr: [
              ...(merged.combinedTimeframesStr || []),
              ...(next.combinedTimeframesStr || [])
            ]
          };
  
          mergedAny = true;
          next.isInvalid = true;
        }
      }
  
      combined.push(mergedAny ? merged : current);
    }
  
    return combined;
  }
  
  export function combineAllFVGs(fvgInfos) {
    const grouped = new Map();
  
    for (const fvg of fvgInfos) {
      if (!isFVGValid(fvg)) continue;
      const key = `${fvg.tfIndex ?? 'tf'}-${fvg.isBullish ? 'bull' : 'bear'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(fvg);
    }
  
    const allCombined = [];
    for (const group of grouped.values()) {
      const combined = combineFVGsFunc(group);
      allCombined.push(...combined);
    }
  
    return allCombined;
  }
  