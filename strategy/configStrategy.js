// ../strategy/configStrategy.js

// Strategy Configuration
export const STRATEGY = {
    chartTF: "1",      // TF della Chart
    anchorPeriod: "3", // Timeframe per Volume Delta (default: 15 minuti)
    // entryMode: "FVGs", // Modalità di ingresso (solo FVGs, come specificato)
    // signalType: "Raw", // Tipo di segnale (solo Raw, come specificato)
    initialAmount: "10000",     // Initial Amount for the strategy
};

// General Configuration
export const GENERAL_CONFIG = {
    debug: false,
    // debugOBFVG: false,
    maxDistanceToLastBar: 100000, // Affects performance
    // entryMode: "FVGs", // Only FVGs since Order Blocks are removed
    // requireRetracement: false, // Require retracement for entry confirmation
    lowerTimeframe: "1", // Lower timeframe for calculations
    maxCVDS: 100 // Maximum number of CVDS signals to track
};

// FVG Configuration
export const FVG_CONFIG = {
    enabled: true,
    sensitivity: "Extreme", // "All", "Extreme", "High", "Normal", "Low"
    showLastXFVGs: 2,
    minimumFVGSize: 2,
    minimumIFVGSize: 2,
    overlapThresholdPercentage: 0,
    extendZonesBy: 15,
    extendZonesDynamic: true,
    extendLastFVGs: true,
    extendLastXFVGsCount: 20,
    volumeBarsPlace: "Left", // "Left" or "Right" (retained for volumetric logic, not display)
    mirrorVolumeBars: true,
    startZoneFrom: "Last Bar", // "First Bar" or "Last Bar"
    endMethod: "Close", // "Wick" or "Close"
    filterMethod: "Average Range", // "Average Range" or "Volume Threshold"
    barsType: "Same Type", // "Same Type" or "All"
    combineFVGs: false,
    allowGaps: false,
    deleteUntouched: true,
    deleteUntouchedAfterXBars: 200,
    volumetricInfo: false,
    volumeThresholdPercent: 50,
    ifvgEnabled: false,
    ifvgEndMethod: "Wick",
    ifvgFull: true,
    ifvgVolumetricInfo: false,
    getFvgSensitivityValue: () => {
        switch (FVG_CONFIG.sensitivity) {
            case "All": return 100;
            case "Extreme": return 6;
            case "High": return 2;
            case "Normal": return 1.5;
            case "Low": return 1;
            default: return 1.5;
        }
    }
};

// CVD Configuration
export const CVD_CONFIG = {
    atrLen: 10,
    atrLenCVDS: 50,
    dynamicRR: 0.57,
    // signalType: "Raw" // "Advanced" or "Raw"
};

// Risk Management Configuration
export const RISK_CONFIG = {
    // tpslMethod: "Dynamic", // "Dynamic" or "Fixed"
    // riskAmount: "Normal", // "Highest", "High", "Normal", "Low", "Lowest"
    customSLATRMult: 6.5,
    getSLATRMult: (riskAmount, customSLATRMult) => {
        return riskAmount === "Highest" ? 10 :
               riskAmount === "High" ? 8.5 :
               riskAmount === "Normal" ? 6.5 :
               riskAmount === "Low" ? 5 :
               riskAmount === "Lowest" ? 3 : customSLATRMult;
    },
    // tpPercent: 0.3, // Used for Fixed TP/SL
    // slPercent: 0.4 // Used for Fixed TP/SL
};

// File Manager Configuration
export const FILE_MANAGER_CONFIG = {
    checkInterval: 10000, // 10 seconds in milliseconds
    sourceCandleFile: '../candles/candles_1m.json',
    targetDataDir: '../strategy/data/',
    targetCandleFile: 'candles_1m.json'
};