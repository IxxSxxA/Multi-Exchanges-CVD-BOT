// strategy/strategyLogic.js
import chalk from 'chalk';
import { STRATEGY, GENERAL_CONFIG, FVG_CONFIG, CVD_CONFIG, RISK_CONFIG } from './configStrategy.js';
import { getCVDSignals } from './cvd.js';
import { detectFVG } from './fvg.js';
import { calculateATR } from './atr.js';

// Definizione della classe CVDS
class CVDS {
    constructor() {
        this.state = 'Waiting For CVDS';
        this.startTime = null;
        this.overlapDirection = null;
        this.cvdsTime = null;
        this.cvdsClose = null;
        this.breakTime = null;
        this.fvg = null;
        this.fvgEndTime = null;
        this.entryType = null;
        this.entryTime = null;
        this.entryPrice = null;
        this.exitTime = null;
        this.exitPrice = null;
        this.slTarget = null;
        this.tpTarget = null;
    }
}

// Funzione per stampare la candela corrente
function logCandle(candle) {
    console.log(
        chalk.cyan(`[CANDLE] ${new Date(candle.timestamp).toISOString()}`) +
        chalk.yellow(` O: ${candle.open.toFixed(2)}`) +
        chalk.yellow(` H: ${candle.high.toFixed(2)}`) +
        chalk.yellow(` L: ${candle.low.toFixed(2)}`) +
        chalk.yellow(` C: ${candle.close.toFixed(2)}`) +
        chalk.green(` vBuy: ${candle.vBuy.toFixed(2)}`) +
        chalk.red(` vSell: ${candle.vSell.toFixed(2)}`)
    );
}

// Funzione per segnali CVD
function getCVDSignalsWrapper(candle, prevCandles) {
    const signals = getCVDSignals(candle, prevCandles);
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] Segnali CVD: bullish=${signals.isBullishSignal}, bearish=${signals.isBearishSignal}`));
    }
    return signals;
}

// Funzione per rilevare FVG
function detectFVGWrapper(candle, prevCandles) {
    const fvg = detectFVG(candle, prevCandles);
    if (GENERAL_CONFIG.debug && (fvg.bullishFVG || fvg.bearishFVG)) {
        // Calcola ATR corto per filtrare FVG
        const atrShort = calculateATR(prevCandles, FVG_CONFIG.atrLen);
        console.log(chalk.gray(`[DEBUG] ATR corto: ${atrShort.toFixed(2)} (periodi: ${FVG_CONFIG.atrLen})`));
        const fvgSize = fvg.bullishFVG ? (fvg.bullishFVG.max - fvg.bullishFVG.min) : (fvg.bearishFVG ? (fvg.bearishFVG.max - fvg.bearishFVG.min) : 0);
        if (fvgSize < atrShort) {
            console.log(chalk.yellow(`[DEBUG] FVG scartato: dimensione ${fvgSize.toFixed(2)} < ATR corto ${atrShort.toFixed(2)}`));
            return { bullishFVG: null, bearishFVG: null };
        }
        console.log(chalk.gray(`[DEBUG] FVG rilevato: ${JSON.stringify(fvg)}`));
    }
    return fvg;
}

// Funzione per calcolare ATR (wrapper principale)
function calculateATRWrapper(candles, atrLen) {
    const atr = calculateATR(candles, atrLen);
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] ATR calcolato: ${atr.toFixed(2)} (periodi: ${atrLen})`));
    }
    return atr;
}

// Funzione di test per verificare ATR con atrLenCVDS
function calculateATRcvds(candles, atrLenCVDS) {
    const atr = calculateATR(candles, atrLenCVDS);
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.gray(`[DEBUG] ATR di test: ${atr.toFixed(2)} (periodi: ${atrLenCVDS}) in strategyLogic`));
    }
    return atr;
}

// Calcolo TP/SL dinamici
function calculateTPSL(entryPrice, atrCVDS, isLong) {
    const slATRMult = RISK_CONFIG.getSLATRMult();
    const dynamicRR = CVD_CONFIG.dynamicRR;

    let slTarget, tpTarget;
    if (isLong) {
        slTarget = entryPrice - atrCVDS * slATRMult;
        tpTarget = entryPrice + Math.abs(entryPrice - slTarget) * dynamicRR;
    } else {
        slTarget = entryPrice + atrCVDS * slATRMult;
        tpTarget = entryPrice - Math.abs(entryPrice - slTarget) * dynamicRR;
    }

    return { slTarget, tpTarget };
}

// Funzione principale per eseguire la strategia
export function executeStrategy(candle, prevCandles, cvdsList = []) {
    // Stampa la candela corrente se debug è attivo
    if (GENERAL_CONFIG.debug) {
        logCandle(candle);
    }

    let lastCVDS = cvdsList.length > 0 ? cvdsList[0] : null;
    let buyAlertTick = false;
    let sellAlertTick = false;
    let tpAlertTick = false;
    let slAlertTick = false;

    // Crea un nuovo CVDS se necessario
    const createNewCVDS = !lastCVDS || (lastCVDS.exitPrice || lastCVDS.state === 'Aborted' || lastCVDS.state === 'Done');
    if (createNewCVDS) {
        lastCVDS = new CVDS();
        lastCVDS.startTime = candle.timestamp;
        cvdsList.unshift(lastCVDS);
        console.log(chalk.cyan(`Nuovo CVDS creato: Waiting For CVDS @ ${new Date(candle.timestamp).toISOString()}`));
    }

    // Macchina a stadi
    if (lastCVDS.state === 'Waiting For CVDS') {
        const { isBullishSignal, isBearishSignal } = getCVDSignalsWrapper(candle, prevCandles);
        if (isBullishSignal || isBearishSignal) {
            lastCVDS.cvdsTime = candle.timestamp;
            lastCVDS.cvdsClose = candle.close;
            lastCVDS.breakTime = candle.timestamp;
            if (isBullishSignal) {
                lastCVDS.overlapDirection = 'Bull';
                lastCVDS.state = 'Waiting For FVG';
                console.log(chalk.blue(`Segnale Bullish CVD rilevato @ ${new Date(candle.timestamp).toISOString()}. Waiting For FVG...`));
            } else if (isBearishSignal) {
                lastCVDS.overlapDirection = 'Bear';
                lastCVDS.state = 'Waiting For FVG';
                console.log(chalk.blue(`Segnale Bearish CVD rilevato @ ${new Date(candle.timestamp).toISOString()}. Waiting For FVG...`));
            }
        }
    }

    if (lastCVDS.state === 'Waiting For FVG') {
        const { bullishFVG, bearishFVG } = detectFVGWrapper(candle, prevCandles);
        if (lastCVDS.overlapDirection === 'Bull' && bullishFVG) {
            lastCVDS.fvg = bullishFVG;
            lastCVDS.state = 'Enter Position';
            console.log(chalk.green(`Bullish FVG rilevato @ ${new Date(candle.timestamp).toISOString()}. Preparazione ingresso...`));
        } else if (lastCVDS.overlapDirection === 'Bear' && bearishFVG) {
            lastCVDS.fvg = bearishFVG;
            lastCVDS.state = 'Enter Position';
            console.log(chalk.green(`Bearish FVG rilevato @ ${new Date(candle.timestamp).toISOString()}. Preparazione ingresso...`));
        } else {
            const { isBullishSignal, isBearishSignal } = getCVDSignalsWrapper(candle, prevCandles);
            if ((lastCVDS.overlapDirection === 'Bull' && isBearishSignal) || (lastCVDS.overlapDirection === 'Bear' && isBullishSignal)) {
                lastCVDS.state = 'Aborted';
                console.log(chalk.yellow(`Segnale opposto rilevato. CVDS abortito @ ${new Date(candle.timestamp).toISOString()}`));
            }
        }
    }

    if (lastCVDS.state === 'Enter Position') {
        lastCVDS.state = 'Entry Taken';
        lastCVDS.entryTime = candle.timestamp;
        lastCVDS.entryPrice = candle.close;
        lastCVDS.entryType = lastCVDS.overlapDirection === 'Bull' ? 'Long' : 'Short';

        // Calcola ATR per TP/SL
        const atrCVDS = calculateATRWrapper(prevCandles, CVD_CONFIG.atrLenCVDS);
        // Test: Calcola ATR con la funzione di verifica
        if (GENERAL_CONFIG.debug) {
            const atrTest = calculateATRcvds(prevCandles, CVD_CONFIG.atrLenCVDS);
            console.log(chalk.gray(`[DEBUG] Confronto ATR: principale=${atrCVDS.toFixed(2)}, test=${atrTest.toFixed(2)}`));
            // Test con un altro periodo (es. FVG_CONFIG.atrLen)
            const atrOther = calculateATRcvds(prevCandles, FVG_CONFIG.atrLen);
            console.log(chalk.gray(`[DEBUG] ATR con altro periodo: ${atrOther.toFixed(2)} (periodi: ${FVG_CONFIG.atrLen})`));
        }
        const { slTarget, tpTarget } = calculateTPSL(lastCVDS.entryPrice, atrCVDS, lastCVDS.entryType === 'Long');

        lastCVDS.slTarget = slTarget;
        lastCVDS.tpTarget = tpTarget;

        if (lastCVDS.entryType === 'Long') {
            buyAlertTick = true;
            console.log(chalk.greenBright(`Ingresso Long @ ${lastCVDS.entryPrice}, TP: ${lastCVDS.tpTarget}, SL: ${lastCVDS.slTarget}`));
        } else {
            sellAlertTick = true;
            console.log(chalk.greenBright(`Ingresso Short @ ${lastCVDS.entryPrice}, TP: ${lastCVDS.tpTarget}, SL: ${lastCVDS.slTarget}`));
        }
    }

    if (lastCVDS.state === 'Entry Taken' && candle.timestamp > lastCVDS.entryTime) {
        // Controlla TP/SL
        if (lastCVDS.entryType === 'Long') {
            if (candle.high >= lastCVDS.tpTarget) {
                tpAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.tpTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Take Profit';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                console.log(chalk.blueBright(`Take Profit Long raggiunto @ ${lastCVDS.exitPrice}`));
            } else if (candle.low <= lastCVDS.slTarget) {
                slAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.slTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Stop Loss';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                console.log(chalk.redBright(`Stop Loss Long raggiunto @ ${lastCVDS.exitPrice}`));
            }
        } else {
            if (candle.low <= lastCVDS.tpTarget) {
                tpAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.tpTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Take Profit';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                console.log(chalk.blueBright(`Take Profit Short raggiunto @ ${lastCVDS.exitPrice}`));
            } else if (candle.high >= lastCVDS.slTarget) {
                slAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.slTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Stop Loss';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                console.log(chalk.redBright(`Stop Loss Short raggiunto @ ${lastCVDS.exitPrice}`));
            }
        }

        // Controlla invalidazione FVG
        if (lastCVDS.fvg && !lastCVDS.fvgEndTime) {
            if (lastCVDS.fvg.isBull && candle.low < lastCVDS.fvg.min) {
                lastCVDS.fvgEndTime = candle.timestamp;
            } else if (!lastCVDS.fvg.isBull && candle.high > lastCVDS.fvg.max) {
                lastCVDS.fvgEndTime = candle.timestamp;
            }
        }
    }

    if (lastCVDS.state === 'Take Profit' || lastCVDS.state === 'Stop Loss') {
        lastCVDS.state = 'Done';
        console.log(chalk.gray(`Trade completato @ ${new Date(candle.timestamp).toISOString()}`));
    }

    // Mantieni solo un numero massimo di CVDS
    while (cvdsList.length > GENERAL_CONFIG.maxCVDS) {
        cvdsList.pop();
    }

    return { buyAlertTick, sellAlertTick, tpAlertTick, slAlertTick, cvdsList };
}