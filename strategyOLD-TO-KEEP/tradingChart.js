import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

// Configurazione del grafico
const chartConfig = {
  layout: {
    background: { type: 'solid', color: '#131722' },
    textColor: '#D9D9D9',
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { color: '#2B2B43' }
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#758696', width: 1 },
    horzLine: { color: '#758696', width: 1 }
  },
  rightPriceScale: {
    borderColor: '#2B2B43',
    scaleMargins: { top: 0.1, bottom: 0.1 }
  },
  timeScale: {
    borderColor: '#2B2B43',
    timeVisible: true,
    secondsVisible: false
  }
};

// Stili per i trade
const tradeStyles = {
  bull: {
    entry: { color: '#26A69A', lineWidth: 1 },
    tp: { color: '#2196F3', lineWidth: 1, lineStyle: LineStyle.Dashed },
    sl: { color: '#F44336', lineWidth: 1, lineStyle: LineStyle.Dashed }
  },
  bear: {
    entry: { color: '#EF5350', lineWidth: 1 },
    tp: { color: '#2196F3', lineWidth: 1, lineStyle: LineStyle.Dashed },
    sl: { color: '#26A69A', lineWidth: 1, lineStyle: LineStyle.Dashed }
  }
};

// Variabile globale per i dati delle candele
let candleData = [];

export async function initCleanTradingChart() {
  const container = document.getElementById('chart-container');
  if (!container) {
    console.error('Container non trovato');
    return;
  }

  container.innerHTML = '';

  try {
    // Caricamento dati
    const [candles, trades] = await Promise.all([
      loadCandles(),
      loadTrades()
    ]);
    
    candleData = candles; // Salva i dati delle candele

    // Inizializzazione del grafico
    const chart = createChart(container, {
      ...chartConfig,
      width: container.clientWidth,
      height: container.clientHeight
    });

    const series = chart.addCandlestickSeries();
    series.setData(candleData);

    // Processamento trades
    processTrades(chart, series, trades);

    // Adattamento e gestione resize
    chart.timeScale().fitContent();
    window.addEventListener('resize', () => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });

  } catch (error) {
    console.error('Errore nell\'inizializzazione del grafico:', error);
  }
}

// Funzione per caricare i dati delle candele
async function loadCandles() {
  try {
    const response = await fetch('/strategy/candlesStrategy/candlesStrategy_3m.json');
    if (!response.ok) throw new Error('Errore nel caricamento delle candele');
    
    const data = await response.json();
    return data.map(c => ({
      time: Math.floor(c.timestamp / 1000),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }))
    .filter(c => !isNaN(c.time))
    .sort((a, b) => a.time - b.time);
    
  } catch (error) {
    console.error('Errore nel caricamento delle candele:', error);
    return [];
  }
}

// Funzione per caricare i dati dei trade
async function loadTrades() {
  try {
    const response = await fetch('/strategy/candlesStrategy/trades.json');
    if (!response.ok) throw new Error('Errore nel caricamento dei trade');
    
    const data = await response.json();
    return data.map(t => ({
      ...t,
      entryPrice: parseFloat(t.entryPrice),
      tpTarget: parseFloat(t.tpTarget),
      slTarget: parseFloat(t.slTarget),
      entryTime: Math.floor(t.candleTimestamp / 1000),
      exitTime: t.exitTimestamp ? Math.floor(t.exitTimestamp / 1000) : null,
      positionType: t.positionType || 'Bull' // Default a Bull se non specificato
    }))
    .filter(t => !isNaN(t.entryPrice));
    
  } catch (error) {
    console.error('Errore nel caricamento dei trade:', error);
    return [];
  }
}

// Funzione per processare i trade
function processTrades(chart, series, trades) {
  const priceLevels = new Map(); // Tracciamento livelli di prezzo
  
  // Ordina i trade per tempo
  trades.sort((a, b) => a.entryTime - b.entryTime).forEach(trade => {
    const style = tradeStyles[trade.positionType.toLowerCase()];
    const exitTime = trade.exitTime || candleData[candleData.length - 1]?.time || trade.entryTime + 86400;

    // 1. Disegna la linea di entry
    drawTradeLine(chart, {
      price: trade.entryPrice,
      startTime: trade.entryTime,
      endTime: exitTime,
      ...style.entry,
      id: `entry-${trade.entryTime}`
    });

    // 2. Gestione TP/SL con offset per evitare sovrapposizioni
    const tpOffset = calculateOffset(trade.tpTarget, priceLevels);
    const slOffset = calculateOffset(trade.slTarget, priceLevels);

    // 3. Disegna TP con offset
    drawTradeLine(chart, {
      price: trade.tpTarget + tpOffset,
      startTime: trade.entryTime,
      endTime: exitTime,
      ...style.tp,
      id: `tp-${trade.entryTime}`,
      label: `TP ${trade.tpTarget.toFixed(2)}`
    });

    // 4. Disegna SL con offset
    drawTradeLine(chart, {
      price: trade.slTarget + slOffset,
      startTime: trade.entryTime,
      endTime: exitTime,
      ...style.sl,
      id: `sl-${trade.entryTime}`,
      label: `SL ${trade.slTarget.toFixed(2)}`
    });
  });
}

// Calcola l'offset per evitare sovrapposizioni
function calculateOffset(price, priceLevels) {
  const precision = 2; // 2 decimali
  const roundedPrice = parseFloat(price.toFixed(precision));
  const levelCount = priceLevels.get(roundedPrice) || 0;
  const offset = levelCount * 0.0005; // Piccolo offset incrementale
  
  priceLevels.set(roundedPrice, levelCount + 1);
  return offset;
}

// Disegna una linea di trade
function drawTradeLine(chart, { price, startTime, endTime, color, lineWidth, lineStyle, id, label }) {
  const line = chart.addLineSeries({
    color: `${color}80`, // 50% trasparenza
    lineWidth,
    lineStyle,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  });

  line.setData([
    { time: startTime, value: price },
    { time: endTime, value: price }
  ]);

  if (label) {
    line.setMarkers([{
      time: startTime,
      position: 'belowBar',
      color: color,
      shape: 'circle',
      text: label,
      size: 1
    }]);
  }

  return line;
}

// Avvia il grafico
document.addEventListener('DOMContentLoaded', () => {
  initCleanTradingChart().catch(error => {
    console.error('Errore nell\'inizializzazione del grafico:', error);
  });
});