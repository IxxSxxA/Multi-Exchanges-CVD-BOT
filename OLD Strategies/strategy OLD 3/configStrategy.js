// ../strategy/configStrategy.js

// Strategy Configuration
export const STRATEGY = {
    chartTF: "3",      // TF della Chart
    anchorPeriod: "5", // Timeframe per Volume Delta
    initialAmount: "10000",
    // Convert strings to numbers where used for calculations
    getChartTF: () => parseInt(STRATEGY.chartTF),
    getAnchorPeriod: () => parseInt(STRATEGY.anchorPeriod),
    getInitialAmount: () => parseFloat(STRATEGY.initialAmount)
};

// General Configuration
export const GENERAL_CONFIG = {
    debug: false,
    maxDistanceToLastBar: 100000,
    entryMode: "FVGs",
    lowerTimeframe: "1",
    maxCVDS: 100,
    // Add helper for timeframe conversion
    getLowerTimeframe: () => parseInt(GENERAL_CONFIG.lowerTimeframe)
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
    tpslMethod: "Dynamic", // "Dynamic" or "Fixed"
    riskAmount: "Normal", // "Highest", "High", "Normal", "Low", "Lowest"
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

// Add validation function
export const validateConfig = () => {
    const errors = [];
    
    // Validate timeframes
    if (STRATEGY.getAnchorPeriod() <= STRATEGY.getChartTF()) {
        errors.push('anchorPeriod deve essere maggiore di chartTF');
    }
    
    if (STRATEGY.getChartTF() <= GENERAL_CONFIG.getLowerTimeframe()) {
        errors.push('chartTF deve essere maggiore di lowerTimeframe');
    }
    
    // Validate FVG settings
    if (!FVG_CONFIG.enabled && GENERAL_CONFIG.entryMode === "FVGs") {
        errors.push('FVG è disabilitato ma entryMode è impostato su FVGs');
    }
    
    // Validate risk settings
    if (CVD_CONFIG.dynamicRR <= 0) {
        errors.push('dynamicRR deve essere maggiore di 0');
    }
    
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
};