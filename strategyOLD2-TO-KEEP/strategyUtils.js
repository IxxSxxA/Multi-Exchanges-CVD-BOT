// strategyUtils.js

/**
 * Calcola la media mobile semplice su un array
 */
export function calculateSMA(arr, period) {
    const sma = [];
    for (let i = 0; i < arr.length; i++) {
      const slice = arr.slice(Math.max(0, i - period + 1), i + 1);
      if (slice.length < period) {
        sma.push(NaN); // Dati insufficienti per calcolo completo
      } else {
        const sum = slice.reduce((a, b) => a + b, 0);
        sma.push(sum / slice.length);
      }
    }
    return sma;
  }
  
  
  /**
   * Calcola l'ATR su un array di candele
   */
  export function calculateATR(candles, period = 14) {
    const trList = [];
  
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
  
      const highLow = curr.high - curr.low;
      const highClose = Math.abs(curr.high - prev.close);
      const lowClose = Math.abs(curr.low - prev.close);
      const trueRange = Math.max(highLow, highClose, lowClose);
  
      trList.push(trueRange);
    }
  
    const atrList = [];
  
    for (let i = 0; i < trList.length; i++) {
        if (i < period - 1) {
          atrList.push(NaN); // o null, o 0 se vuoi comunque un valore
          continue;
        }
        const slice = trList.slice(i - period + 1, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / period;
        atrList.push(avg);
      }
      
  
    // L'array ha una lunghezza pari a candles.length - 1 (perché parte da i=1)
    // Per allinearlo con le candele, aggiungiamo un valore iniziale (es. 0)
    atrList.unshift(0);
  
    return atrList;
  }
  
  
  /**
   * Traduzione config di estensione zone FVG
   */
  export function getExtendMilliseconds(count, tfStr) {
    const ms = parseTFtoMs(tfStr);
    return count * ms;
  }
  
  function parseTFtoMs(tf) {
    const match = tf.match(/^(\d+)([mhdw])$/);
    const n = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'm': return n * 60 * 1000;
      case 'h': return n * 60 * 60 * 1000;
      case 'd': return n * 24 * 60 * 60 * 1000;
      case 'w': return n * 7 * 24 * 60 * 60 * 1000;
      default: throw new Error('Invalid TF');
    }
  }
  