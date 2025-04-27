// strategy/configStrategy.js

// Configurazione degli input della strategia, rispecchiando il codice PineScript
const configStrategy = {
  // General Configuration
  chartTF: "1",      // TF della Chart
  anchorInput: "3", // Timeframe per Volume Delta (default: 15 minuti)
  entryMode: "FVGs", // Modalità di ingresso (solo FVGs, come specificato)
  signalType: "Raw", // Tipo di segnale (solo Raw, come specificato)
  initialAmount: "10000",     // Initial Amount for the strategy

  // Risk Management
  riskPerTrade: 10,            // % capitale per trade
  maxPositionSizePercent: 100,     // % max per posizione
  maxProfitPercentPerTrade: 9999,  // % profitto massimo
  capitalGrowthLimit: 9999,        // Moltiplicatore capitale massimo
  pollingInterval: 60,           // Secondi
  memoryBufferMultiplier: 5,     // Multiplo di atrLen/maxBarsBack
  enableDynamicBuffer: true,     // Calcolo automatico buffer -> Numero candele in memoria dinamico

  // Fair Value Gaps (FVG) Settings
  fvgSensitivity: 0.2, // Sensibilità rilevamento FVG (All, Extreme, High, Normal, Low)
  fvgEnabled: true, // Abilita rilevamento FVG
  fvgEndMethod: "Close", // Metodo di invalidazione FVG (Wick o Close)
  fvgFilterMethod: "Average Range", // Metodo di filtraggio FVG (Average Range o Volume Threshold)
  volumeThresholdPercent: 50, // Percentuale per filtro volume (usato se fvgFilterMethod = Volume Threshold)
  fvgBars: "Same Type", // Tipo di barre per FVG (Same Type o All)
  fvgSensEnabled: true, // Abilita filtro sensibilità FVG
  combineFVGs: false, // Combina FVG vicini
  allowGaps: false, // Permetti gap tra barre
  deleteUntouched: true, // Elimina FVG non toccati
  deleteUntouchedAfterXBars: 200, // Barre dopo cui eliminare FVG non toccati

  // TP / SL Settings (solo dinamici)
  tpslMethod: "Dynamic", // Metodo TP/SL (solo Dynamic, come specificato)
  riskAmount: "Normal", // Livello di rischio dinamico (Highest, High, Normal, Low, Lowest)
  DynamicRR: 0.57, // Rapporto rischio/rendimento per TP dinamico

  // Debug Settings
  maxATRMult: 3.5, // Moltiplicatore massimo ATR per validazione FVG
  extendZonesBy: 15, // Estensione zone FVG (in barre)
  extendZonesDynamic: true, // Estensione dinamica delle zone
  extendLastFVGs: true, // Estendi ultimi FVG

  // Costanti
  maxDistanceToLastBar: 100000, // Massimo numero di barre indietro per analisi
  showLastXFVGs: 2, // Numero di FVG da mantenere
  minimumFVGSize: 2, // Dimensione minima FVG (in barre)
  overlapThresholdPercentage: 0, // Percentuale di sovrapposizione per combinare FVG
  atrLen: 10, // Lunghezza ATR
  atrLenCVDS: 50, // Lunghezza ATR per TP/SL dinamici
  maxBarsBack: 50, // Massimo numero di barre indietro per analisi
  extendLastXFVGsCount: 20 // Numero di FVG da estendere  
};

// Esporta la configurazione
export default configStrategy;