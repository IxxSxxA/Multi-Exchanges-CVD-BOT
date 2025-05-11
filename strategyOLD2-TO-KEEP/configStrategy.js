// strategy/configStrategy.js

export const config = {
    // === DATI GENERALI ===
    symbol: 'BTC/USDT',         // Descrittivo
    timeframe: '1m',            // Timeframe operativo della strategia
    anchorPeriod: '3m',        // Reset logico del CVD (es: '15m', '1D', '' = mai resettare)
  
    // === FVG STRATEGY ===
    entryMode: 'FVGs',          // Solo FVGs
    fvgSensitivity: 2.5,        // Soglia delta per breakout significativo (numerico, es. 2.5)
    minimumFVGSize: 2,          // Dimensione minima della FVG in ticks
    lookbackPeriod: 20,         // Numero di candele passate da considerare
    showLastXFVGs: 2,           // Quante FVG recenti considerare
    extendLastXFVGsCount: 20,   // Estensione visiva/logica delle ultime FVGs
    overlapThresholdPercentage: 0, // Soglia di overlap tra FVG per filtrare
  
    // === RISK MANAGEMENT ===
    useATR: true,
    atrPeriod: 10,              // Periodo ATR per calcolo TP/SL dinamico
    slATRMult: 6.5,             // Moltiplicatore ATR per SL
    rrRatio: 2.0,               // Rapporto Rischio/Rendimento
  
    // === DEBUG / FILE HANDLING ===
    forceRefresh: true,         // Se true, forza copia/rigenerazione dati all'avvio
    logEnabled: true            // Se true, stampa log nel terminale
  };
  
  /*
  NOTE:
    fvgSensitivity - Delta breakout sensitivity, numerico
        - 3.0   = Extreme
        - 2.5   = High
        - 2.0   = Normal
        - 1.5   = Low
        - 1.0   = All
  
    slATRMult - Valori suggeriti per Dynamic SL
        - 10.0 = Highest
        - 8.5  = High
        - 6.5  = Normal
        - 5.0  = Low
        - 3.0  = Lowest
  */
  