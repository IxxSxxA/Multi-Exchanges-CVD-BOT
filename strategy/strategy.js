// ../strategy/strategy.js
import { FVGDetector } from './fvg.js';

export class Strategy {
    constructor() {
        this.fvgDetector = new FVGDetector();
    }

    processCandles(candles) {
        // Processa le candele per rilevare FVG
        const fvgs = this.fvgDetector.processCandles(candles);
        
        // Placeholder: logica CVDS (segnali, trade, TP/SL)
        console.log(`Rilevati ${fvgs.length} FVG`);
        
        return { fvgs };
    }
}