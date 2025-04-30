import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';

console.log('File JavaScript caricato');

window.debugData = {};

export async function initTradingChart() {
  console.log('Inizio initTradingChart');

  // Trova il container
  const container = document.getElementById('chart-container');
  if (!container) {
    console.error('Container del grafico non trovato!');
    return;
  }
  console.log('Container trovato:', container);
  container.innerHTML = '';

  // Crea il grafico
  const chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: 'solid', color: '#2A2E39' },
      textColor: '#D9D9D9',
    },
    grid: {
      vertLines: { color: '#3D3D5C' },
      horzLines: { color: '#3D3D5C' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: '#758696' },
      horzLine: { color: '#758696' },
    },
    rightPriceScale: {
      borderColor: '#3D3D5C',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderColor: '#3D3D5C',
      timeVisible: true,
      secondsVisible: false,
    },
  });
  console.log('Grafico creato:', chart);

  // Crea la serie delle candele
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#4CAF50',
    downColor: '#F44336',
    borderVisible: false,
    wickUpColor: '#4CAF50',
    wickDownColor: '#F44336',
  });
  console.log('Serie candele creata:', candleSeries);

  // Caricamento dei dati delle candele
  let candlesData;
  try {
    console.log('Inizio caricamento candele');
    const candlesRes = await fetch('/strategy/candlesStrategy/candlesStrategy_3m.json');
    console.log('Risposta candele:', candlesRes);
    if (!candlesRes.ok) {
      throw new Error('Errore nel caricamento del file candele JSON');
    }
    candlesData = await candlesRes.json();
    console.log('Dati candele caricati:', candlesData);
    console.log('Prime 2 candele:', candlesData.slice(0, 2));

    window.debugData.candlesData = candlesData;
  } catch (error) {
    console.error('Errore caricamento file candele JSON:', error);
    return;
  }

  // Trasforma i dati delle candele
  console.log('Inizio trasformazione dati candele');
  const candleData = candlesData.map(c => {
    const transformed = {
      time: Math.floor(c.timestamp / 1000),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    };
    if (isNaN(transformed.time) || isNaN(transformed.open) || isNaN(transformed.high) || 
        isNaN(transformed.low) || isNaN(transformed.close)) {
      console.warn('Dati candele non validi:', c, transformed);
    }
    return transformed;
  });
  console.log('Prime 2 candele trasformate:', candleData.slice(0, 2));

  window.debugData.candleData = candleData;

  // Imposta i dati delle candele
  try {
    candleSeries.setData(candleData);
    console.log('Dati impostati per candele:', candleSeries.data().slice(0, 2));
  } catch (error) {
    console.error('Errore durante l\'impostazione dei dati candele:', error);
    return;
  }

  // Funzione per aggiungere i trades
  async function addTrades() {
    // Caricamento dei dati dei trades
    let tradesData;
    try {
      console.log('Inizio caricamento trades');
      const tradesRes = await fetch('/strategy/candlesStrategy/trades.json');
      console.log('Risposta trades:', tradesRes);
      if (!tradesRes.ok) {
        throw new Error('Errore nel caricamento del file trades JSON');
      }
      tradesData = await tradesRes.json();
      console.log('Dati trades caricati:', tradesData);
      console.log('Primi 2 trades:', tradesData.slice(0, 2));

      window.debugData.tradesData = tradesData;
    } catch (error) {
      console.error('Errore caricamento file trades JSON:', error);
      return;
    }

    // Funzione per creare una linea orizzontale limitata nel tempo
    function createHorizontalLineSeries(price, startTime, endTime, color, width = 2, lineStyle = LineStyle.Solid, isRecent = false, label = '') {
      const lineSeries = chart.addLineSeries({
        color: isRecent ? color + 'CC' : color + '66',
        lineWidth: width,
        lineStyle: isRecent ? LineStyle.Solid : LineStyle.Dashed,
        priceLineVisible: false,
      });

      // Aggiungi un marker per il label
      if (label) {
        lineSeries.setMarkers([
          {
            time: startTime,
            position: 'aboveBar',
            color: color,
            shape: 'circle',
            text: label,
            size: 2,
          },
        ]);
      }

      lineSeries.setData([
        { time: startTime, value: price },
        { time: endTime, value: price },
      ]);
      return lineSeries;
    }

    // Processa i trades
    console.log('Inizio processamento trades');
    const maxTradesToShow = 5; // Ridotto per evitare sovrapposizioni
    const recentTrades = tradesData.slice(-maxTradesToShow);

    // Mantieni traccia dei trades già processati per evitare duplicati
    const processedEntries = new Set();

    recentTrades.forEach((trade, index) => {
      // Verifica che i dati del trade siano validi
      if (!trade.entryPrice || !trade.tpTarget || !trade.slTarget || !trade.candleTimestamp || !trade.positionType) {
        console.warn('Trade con dati mancanti:', trade);
        return;
      }

      const entryPrice = parseFloat(trade.entryPrice);
      const tpPrice = parseFloat(trade.tpTarget);
      const slPrice = parseFloat(trade.slTarget);
      if (isNaN(entryPrice) || isNaN(tpPrice) || isNaN(slPrice)) {
        console.warn('Trade con dati non validi:', trade);
        return;
      }

      const entryTime = Math.floor(trade.candleTimestamp / 1000);
      if (isNaN(entryTime)) {
        console.warn('Trade con timestamp non valido:', trade);
        return;
      }

      // Crea un identificatore unico per il trade
      const tradeKey = `${entryPrice}-${entryTime}`;
      if (processedEntries.has(tradeKey)) {
        console.warn('Trade duplicato:', trade);
        return;
      }
      processedEntries.add(tradeKey);

      let endTime;
      if (trade.exitTimestamp) {
        endTime = Math.floor(trade.exitTimestamp / 1000);
      } else if (index < recentTrades.length - 1) {
        const nextTrade = recentTrades[index + 1];
        if (nextTrade && nextTrade.candleTimestamp) {
          const nextTradeTime = Math.floor(nextTrade.candleTimestamp / 1000);
          const timeToNextTrade = nextTradeTime - entryTime;
          endTime = entryTime + Math.min(timeToNextTrade, 3600);
        } else {
          endTime = entryTime + 3600;
        }
      } else {
        endTime = entryTime + 3600;
      }

      if (isNaN(endTime)) {
        console.warn('Trade con endTime non valido:', trade);
        return;
      }

      const entryColor = trade.positionType === 'Bull' ? '#00C853' : '#D81B60';
      const tpColor = '#2196F3';
      const slColor = '#FF9800';

      const isRecent = index === recentTrades.length - 1;

      // Aggiungi la linea di entry price
      try {
        console.log(`Aggiunta linea di entry per trade ${index}: ${trade.positionType}, Prezzo: ${entryPrice}`);
        createHorizontalLineSeries(
          entryPrice,
          entryTime,
          endTime,
          entryColor,
          2,
          LineStyle.Solid,
          isRecent,
          `Entry (${trade.positionType}) ${entryPrice.toFixed(2)}`
        );
      } catch (error) {
        console.error('Errore durante l\'aggiunta della linea di entry price:', error, trade);
        return;
      }

      // Aggiungi le linee di TP e SL
      try {
        console.log(`Aggiunta linea TP per trade ${index}: Prezzo: ${tpPrice}`);
        createHorizontalLineSeries(tpPrice, entryTime, endTime, tpColor, 2, LineStyle.Solid, isRecent);
        console.log(`Aggiunta linea SL per trade ${index}: Prezzo: ${slPrice}`);
        createHorizontalLineSeries(slPrice, entryTime, endTime, slColor, 2, LineStyle.Solid, isRecent);
      } catch (error) {
        console.error('Errore durante l\'aggiunta delle linee di TP/SL:', error, trade);
        return;
      }
    });
  }

  // Aggiungi i trades
  try {
    await addTrades();
  } catch (error) {
    console.error('Errore durante l\'aggiunta dei trades:', error);
  }

  chart.timeScale().fitContent();
  console.log('Time scale adattato');

  chart.applyOptions({});
  console.log('Grafico aggiornato');

  window.addEventListener('resize', () => {
    chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  });
  console.log('Fine initTradingChart');
}

// Esegui la funzione immediatamente
initTradingChart().catch(error => {
  console.error('Errore durante l\'esecuzione di initTradingChart:', error);
});