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
    console.log('');
    console.log(chalk.cyan(`[STRATEGY] [CANDLE] ******** NEW CANDLE INCOMING @ ${new Date(candle.timestamp).toISOString()} ********`))
    

    console.log(
        chalk.cyan(`[STRATEGY] [CANDLE]`) +
        chalk.cyan(` O: ${candle.open.toFixed(2)}`) +
        chalk.cyan(` H: ${candle.high.toFixed(2)}`) +
        chalk.cyan(` L: ${candle.low.toFixed(2)}`) +
        chalk.cyan(` C: ${candle.close.toFixed(2)}`) +
        chalk.green(` vBuy: ${candle.vBuy.toFixed(2)}`) +
        chalk.red(` vSell: ${candle.vSell.toFixed(2)}`)
        
    );
}

// Funzione per Segnale CVD
function getCVDSignalsWrapper(candle, prevCandles) {
    const signals = getCVDSignals(candle, prevCandles);
    if (GENERAL_CONFIG.debug) {
        if (signals.isBullishSignal) {
            console.log(chalk.green('[STRATEGY] Segnale CVD Ricevuto -> BULL'));
        } else if (signals.isBearishSignal) {
            console.log(chalk.redBright('[STRATEGY] Segnale CVD Ricevuto -> BEAR'));
        }
    }
    return signals;
}

// Funzione per rilevare FVG
function detectFVGWrapper(candle, prevCandles) {
    const fvg = detectFVG(candle, prevCandles);
    if (GENERAL_CONFIG.debug && (fvg.bullishFVG || fvg.bearishFVG)) {
        // Calcola ATR atrLen da config per filtrare FVG
        const atrShort = calculateATR(prevCandles, CVD_CONFIG.atrLen);
        console.log(chalk.greenBright(`[STRATEGY] ATR ${atrShort.toFixed(2)} (periodi: ${CVD_CONFIG.atrLen}) Function in strategyLogic.js -> atrLen`));
        const fvgSize = fvg.bullishFVG ? (fvg.bullishFVG.max - fvg.bullishFVG.min) : (fvg.bearishFVG ? (fvg.bearishFVG.max - fvg.bearishFVG.min) : 0);
        if (fvgSize < atrShort) {
            console.log(chalk.redBright(`[STRATEGY] [ALERT] FVG scartato: dimensione ${fvgSize.toFixed(2)} < ATR atrLen ${atrShort.toFixed(2)}`));
            return { bullishFVG: null, bearishFVG: null };
        }
        // console.log(chalk.greenBright(`[STRATEGY] Segnale FVG Ricevuto -> ${JSON.stringify(fvg)}`));
        if (fvg.bullishFVG) {
            console.log(chalk.green('[STRATEGY] Segnale FVG Ricevuto -> BULL'));
        } else if (fvg.bearishFVG) {
            console.log(chalk.red('[STRATEGY] Segnale FVG Ricevuto -> BEAR'));
        }
    }
    return fvg;
}

// Funzione per calcolare ATR (wrapper principale)
function calculateATRWrapper(candles, atrLen) {
    const atr = calculateATR(candles, atrLen);
    if (GENERAL_CONFIG.debug) {
        console.log(chalk.yellow(`[STRATEGY] ATR ${atr.toFixed(2)} (periodi: ${atrLen}) Wrapper in strategyLogic.js`));
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
        console.log(chalk.cyan(`[STRATEGY] Waiting For CVDS @ ${new Date(candle.timestamp).toISOString()}`));
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
                console.log(chalk.blue(`[STRATEGY] Bullish CVD Signal Received @ ${new Date(candle.timestamp).toISOString()}. Waiting For FVG...`));
            } else if (isBearishSignal) {
                lastCVDS.overlapDirection = 'Bear';
                lastCVDS.state = 'Waiting For FVG';
                console.log(chalk.blue(`[STRATEGY] Bearish CVD Signal Received @ ${new Date(candle.timestamp).toISOString()}. Waiting For FVG...`));
            }
        }
    }

    if (lastCVDS.state === 'Waiting For FVG') {
        const { bullishFVG, bearishFVG } = detectFVGWrapper(candle, prevCandles);
        if (lastCVDS.overlapDirection === 'Bull' && bullishFVG) {
            lastCVDS.fvg = bullishFVG;
            lastCVDS.state = 'Enter Position';
            console.log(chalk.green(`[STRATEGY] Bullish CVD & FVG rilevato @ ${new Date(candle.timestamp).toISOString()}. Preparazione ingresso...`));
        } else if (lastCVDS.overlapDirection === 'Bear' && bearishFVG) {
            lastCVDS.fvg = bearishFVG;
            lastCVDS.state = 'Enter Position';
            console.log(chalk.green(`[STRATEGY] Bearish CVD & FVG rilevato @ ${new Date(candle.timestamp).toISOString()}. Preparazione ingresso...`));
        } else {
            console.log(chalk.yellow('[STRATEGY] No Bullish or Bearish FVG -> New CVD check for ABORT CVDS (Segnale Opposto?)'));

            const { isBullishSignal, isBearishSignal } = getCVDSignalsWrapper(candle, prevCandles);
            if ((lastCVDS.overlapDirection === 'Bull' && isBearishSignal) || (lastCVDS.overlapDirection === 'Bear' && isBullishSignal)) {
                lastCVDS.state = 'Aborted';
                console.log(chalk.redBright(`[STRATEGY] [ALERT] Segnale opposto rilevato. CVDS abortito @ ${new Date(candle.timestamp).toISOString()}`));
                
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
/*         if (GENERAL_CONFIG.debug) {
            const atrTest = calculateATR(prevCandles, CVD_CONFIG.atrLenCVDS);
            console.log(chalk.gray(`[STRATEGY] Check ATR -> atrCVDS = ${atrCVDS.toFixed(2)}, atrTest = ${atrTest.toFixed(2)} Function call in strategyLogic.js`));
            // Test con un altro periodo (es. FVG_CONFIG.atrLen)
            const atrOther = calculateATR(prevCandles, CVD_CONFIG.atrLen);
            console.log(chalk.gray(`[STRATEGY] ATR atrLen ${atrOther.toFixed(2)} (periodi: ${CVD_CONFIG.atrLen}) Function call in strategyLogic.js`));
        } */

        const { slTarget, tpTarget } = calculateTPSL(lastCVDS.entryPrice, atrCVDS, lastCVDS.entryType === 'Long');

        lastCVDS.slTarget = slTarget;
        lastCVDS.tpTarget = tpTarget;

        if (lastCVDS.entryType === 'Long') {
            buyAlertTick = true;
            console.log(chalk.greenBright(`[STRATEGY] Ingresso Long @ ${lastCVDS.entryPrice}, TP: ${lastCVDS.tpTarget}, SL: ${lastCVDS.slTarget}`));
        } else {
            sellAlertTick = true;
            console.log(chalk.greenBright(`[STRATEGY] Ingresso Short @ ${lastCVDS.entryPrice}, TP: ${lastCVDS.tpTarget}, SL: ${lastCVDS.slTarget}`));
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
                console.log(chalk.blueBright(`[STRATEGY] Take Profit Long raggiunto @ ${lastCVDS.exitPrice}`));
            } else if (candle.low <= lastCVDS.slTarget) {
                slAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.slTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Stop Loss';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                console.log(chalk.redBright(`[STRATEGY] Stop Loss Long raggiunto @ ${lastCVDS.exitPrice}`));
            }
        } else {
            if (candle.low <= lastCVDS.tpTarget) {
                tpAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.tpTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Take Profit';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                // console.log(chalk.blueBright(`[STRATEGY] Take Profit Short raggiunto @ ${lastCVDS.exitPrice}`));
            } else if (candle.high >= lastCVDS.slTarget) {
                slAlertTick = true;
                lastCVDS.exitPrice = lastCVDS.slTarget;
                lastCVDS.exitTime = candle.timestamp;
                lastCVDS.state = 'Stop Loss';
                lastCVDS.fvgEndTime = lastCVDS.fvgEndTime || candle.timestamp;
                // console.log(chalk.redBright(`[STRATEGY] Stop Loss Short raggiunto @ ${lastCVDS.exitPrice}`));
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

/*     if (lastCVDS.state === 'Take Profit' || lastCVDS.state === 'Stop Loss') {
        lastCVDS.state = 'Done';
        console.log(chalk.bgGreen.bold(`[STRATEGY] Trade completato @ ${new Date(candle.timestamp).toISOString()}`));
    } */

    if (lastCVDS.state === 'Take Profit' || lastCVDS.state === 'Stop Loss') {
            if (lastCVDS.state === 'Take Profit') {
                console.log(chalk.bgGreen.bold(`[STRATEGY] Trade completato TAKE PROFIT @ ${lastCVDS.exitPrice} ${new Date(candle.timestamp).toISOString()}`));
            } else if (lastCVDS.state === 'Stop Loss') {
                console.log(chalk.bgRed.bold(`[STRATEGY] Trade completato STOP LOSS @ ${lastCVDS.exitPrice} ${new Date(candle.timestamp).toISOString()}`));
            }
        lastCVDS.state = 'Done';
    }

    // Mantieni solo un numero massimo di CVDS
    while (cvdsList.length > GENERAL_CONFIG.maxCVDS) {
        cvdsList.pop();
    }

    // Stampa lo stato finale del CVDS
    if (GENERAL_CONFIG.debug) {

        if (lastCVDS.state === 'Entry Taken') {
            console.log(chalk.yellow(`[STRATEGY] ${new Date(candle.timestamp).toISOString()} Stato CVDS Aggiornato -> ${JSON.stringify(lastCVDS.state)} Waiting for TP/SL`));
        }

        else if (lastCVDS.state != 'Entry Taken') {
            console.log(chalk.yellow(`[STRATEGY] ${new Date(candle.timestamp).toISOString()} Stato CVDS Aggiornato -> ${JSON.stringify(lastCVDS.state)}`));
             
        }
    
    return { buyAlertTick, sellAlertTick, tpAlertTick, slAlertTick, cvdsList };
    }
}