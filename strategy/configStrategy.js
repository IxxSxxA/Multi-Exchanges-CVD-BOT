// strategy/configStrategy.js
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..'); // root del progetto


// Strategy Configuration
export const STRATEGY = {
    chartTF: "5", // Timeframe del grafico in minuti (es. "3" per 3m)
    anchorPeriod: "15", // Timeframe per Volume Delta in minuti
    initialAmount: "10000", // Capitale iniziale per il backtest
    getChartTF: () => parseInt(STRATEGY.chartTF),
    getAnchorPeriod: () => parseInt(STRATEGY.anchorPeriod),
    getInitialAmount: () => parseFloat(STRATEGY.initialAmount),
    getChartTFSeconds: () => STRATEGY.getChartTF() * 60, // Converti in secondi
    getAnchorPeriodSeconds: () => STRATEGY.getAnchorPeriod() * 60,
};

// General Configuration
export const GENERAL_CONFIG = {
    debug: true, // Abilitato per log dettagliati
    entryMode: "FVGs",
    lowerTimeframe: "1",
    maxCVDS: 100,
    getLowerTimeframe: () => parseInt(GENERAL_CONFIG.lowerTimeframe),
    getLowerTimeframeSeconds: () => GENERAL_CONFIG.getLowerTimeframe() * 60,
};

// FVG Configuration
export const FVG_CONFIG = {
    enabled: true,
    sensitivity: "Extreme", // "All", "Extreme", "High", "Normal", "Low"
    showLastXFVGs: 2, // Numero di FVG da mantenere in memoria
    minimumFVGSize: 2, // Dimensione minima del FVG (in barre)
    overlapThresholdPercentage: 0, // Percentuale di sovrapposizione per combinare FVG
    endMethod: "Close", // Metodo di invalidazione ("Wick" o "Close")
    filterMethod: "Average Range", // Metodo di filtro ("Average Range" o "Volume Threshold")
    barsType: "Same Type", // Tipo di barre per FVG ("Same Type" o "All")
    combineFVGs: false, // Combinare FVG sovrapposti
    allowGaps: false, // Consentire gap tra barre
    deleteUntouched: true, // Eliminare FVG non toccati
    deleteUntouchedAfterXBars: 200, // Barre dopo cui eliminare FVG non toccati
    volumeThresholdPercent: 50, // Soglia per filtro volume
    getFvgSensitivityValue: () => {
        switch (FVG_CONFIG.sensitivity) {
            case "All": return 100;
            case "Extreme": return 6;
            case "High": return 2;
            case "Normal": return 1.5;
            case "Low": return 1;
            default: return 1.5;
        }
    },
};

// CVD Configuration
export const CVD_CONFIG = {
    atrLen: 10,         // Periodo ATR per FVG
    atrLenCVDS: 50,     // Periodo ATR per TP/SL
    dynamicRR: 0.57,    // Rapporto rischio/rendimento dinamico
    signalType: "Raw", // Tipo di segnale ("Advanced" o "Raw")
};

// Risk Management Configuration
export const RISK_CONFIG = {
    tpslMethod: "Dynamic", // Solo "Dynamic" per ora
    riskAmount: "Normal", // "Highest", "High", "Normal", "Low", "Lowest"
    customSLATRMult: 6.5, // Moltiplicatore personalizzato per SL
    getSLATRMult: () => {
        return RISK_CONFIG.riskAmount === "Highest" ? 10 :
               RISK_CONFIG.riskAmount === "High" ? 8.5 :
               RISK_CONFIG.riskAmount === "Normal" ? 6.5 :
               RISK_CONFIG.riskAmount === "Low" ? 5 :
               RISK_CONFIG.riskAmount === "Lowest" ? 3 :
               RISK_CONFIG.customSLATRMult;
    },
};

// File Manager Configuration
/* export const FILE_MANAGER_CONFIG = {
    sourceCandleFile: '../candles/candles_1m.json',
    targetDataDir: '../strategy/data/',
    targetCandleFile: 'candles_1m.json',
}; */

export const FILE_MANAGER_CONFIG = {
    sourceCandleFile: path.join(PROJECT_ROOT, 'candles', 'candles_1m.json'),
    targetDataDir: path.join(PROJECT_ROOT, 'strategy', 'data'),
    targetCandleFile: 'candles_1m.json',
};

// Funzione di validazione
export const validateConfig = () => {
    const errors = [];

    // Validazione timeframes
    if (STRATEGY.getChartTF() < GENERAL_CONFIG.getLowerTimeframe()) {
        errors.push('chartTF deve essere maggiore di lowerTimeframe');
    }
    if (STRATEGY.getAnchorPeriod() < STRATEGY.getChartTF()) {
        errors.push('anchorPeriod deve essere maggiore di chartTF');
    }

    // Validazione FVG
    if (!FVG_CONFIG.enabled && GENERAL_CONFIG.entryMode === "FVGs") {
        errors.push('FVG è disabilitato ma entryMode è impostato su FVGs');
    }

    // Validazione rischio
    if (CVD_CONFIG.dynamicRR <= 0) {
        errors.push('dynamicRR deve essere maggiore di 0');
    }

    if (errors.length > 0) {
        console.error(chalk.red(`Errore di validazione configurazione:\n${errors.join('\n')}`));
        throw new Error('Configurazione non valida');
    }

    console.log(chalk.green('Configurazione valida'));
    return true;
};