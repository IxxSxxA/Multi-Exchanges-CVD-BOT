import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import configStrategy from './configStrategy.js';

export async function initTradingChart() {
    // Log della versione per conferma
    console.log('Versione lightweight-charts:', window.TradingView?.version || 'unknown');

    // 1. Configurazione tema dark leggero
    const theme = {
        chart: {
            backgroundColor: '#2A2E39',
            textColor: '#D1D4DC',
            fontSize: 12,
            fontFamily: 'Arial, sans-serif'
        },
        grid: {
            vertLines: { 
                color: '#3E4455', 
                style: LineStyle.Dotted, 
                visible: true 
            },
            horzLines: { 
                color: '#3E4455', 
                style: LineStyle.Dotted, 
                visible: true 
            }
        },
        crosshair: {
            mode: CrosshairMode.Magnet,
            vertLine: { 
                color: '#6B7280',
                width: 1,
                style: LineStyle.Dashed,
                labelBackgroundColor: '#4B5563',
                labelTextColor: '#F3F4F6'
            },
            horzLine: { 
                color: '#6B7280',
                width: 1,
                style: LineStyle.Dashed,
                labelBackgroundColor: '#4B5563',
                labelTextColor: '#F3F4F6'
            }
        },
        priceScale: {
            borderColor: '#3E4455',
            textColor: '#D1D4DC',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1
            }
        },
        timeScale: {
            borderColor: '#3E4455',
            textColor: '#D1D4DC',
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000);
                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            }
        }
    };

    // 2. Caricamento dati dinamico
    const chartTF = configStrategy.chartTF || '3';
    const dataPromises = [
        fetch(`./candlesStrategy/candlesStrategy_${chartTF}m.json`).then(handleResponse),
        fetch(`./candlesStrategy/trades.json`).then(handleResponse)
    ];

    async function handleResponse(r) {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${r.url}`);
        return r.json();
    }

    let candles, trades;
    try {
        [candles, trades] = await Promise.all(dataPromises);
        console.log(`Caricati ${candles.length} candele e ${trades.length} trades`);
        console.log('Esempio candela:', candles[0]);
        console.log('Esempio trade:', trades[0]);
        console.log('Timestamp candele:', candles.slice(0, 5).map(c => c.timestamp));
        console.log('Timestamp trades:', trades.map(t => t.timestamp));
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        showError(`Errore dati: ${error.message}`);
        return;
    }

    // 3. Inizializzazione chart con gestione errori
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('Elemento #chart-container non trovato');
        return;
    }

    // Forza lo stile del contenitore per evitare conflitti CSS
    container.style.backgroundColor = '#2A2E39';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';

    const chart = createChart(container, {
        ...theme.chart,
        width: container.clientWidth,
        height: 650,
        localization: {
            locale: 'it-IT',
            dateFormat: 'dd/MM/yyyy'
        },
        rightPriceScale: {
            visible: true,
            borderColor: theme.priceScale.borderColor,
            textColor: theme.priceScale.textColor,
            mode: 1
        },
        timeScale: {
            ...theme.timeScale,
            fixLeftEdge: true,
            barSpacing: 10
        },
        layout: { // Esplicito per forzare il tema
            backgroundColor: '#2A2E39',
            textColor: '#D1D4DC'
        }
    });

    console.log('Tema chart applicato:', {
        backgroundColor: theme.chart.backgroundColor,
        textColor: theme.chart.textColor,
        gridVertLines: theme.grid.vertLines,
        gridHorzLines: theme.grid.horzLines
    });

    // 4. Serie candlestick con stili raffinati
    const candleSeries = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        wickUpColor: '#10B98180',
        wickDownColor: '#EF444480',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        priceScaleId: 'right'
    });

    // 5. Formattazione dati candele con validazione
    const formattedCandles = candles.map(c => {
        if (!c.timestamp) throw new Error('Timestamp mancante');
        return {
            time: Math.floor(c.timestamp / 1000), // Timestamp in millisecondi
            open: validateNumber(c.open),
            high: validateNumber(c.high),
            low: validateNumber(c.low),
            close: validateNumber(c.close)
        };
    });

    function validateNumber(n) {
        const num = parseFloat(n);
        if (isNaN(num)) throw new Error(`Valore non numerico: ${n}`);
        return num;
    }

    try {
        candleSeries.setData(formattedCandles);
        console.log('Candele impostate:', formattedCandles.length);
        console.log('Primi 5 timestamp candele formattati:', formattedCandles.slice(0, 5).map(c => c.time));
    } catch (error) {
        console.error('Errore impostazione candele:', error);
        showError(`Formato candele non valido`);
        return;
    }

    // 6. Aggiunta marker e linee per trades
    try {
        // Marker per Entry e SL
        const markers = trades
            .filter(t => ['Entry', 'SL'].includes(t.event))
            .map(t => {
                const isEntry = t.event === 'Entry';
                const isBull = t.positionType === 'Bull';
                const timestamp = Math.floor(new Date(t.timestamp).getTime() / 1000);
                return {
                    time: timestamp,
                    position: isEntry ? (isBull ? 'belowBar' : 'aboveBar') : 'aboveBar',
                    color: isEntry ? (isBull ? '#10B981' : '#EF4444') : '#FBBF24',
                    shape: isEntry ? (isBull ? 'arrowUp' : 'arrowDown') : 'circle',
                    text: isEntry 
                        ? `${t.positionType} @ ${validateNumber(t.entryPrice).toFixed(2)} (${t.details})`
                        : `SL @ ${validateNumber(t.slTarget).toFixed(2)}`,
                    size: isEntry ? 1.3 : 1,
                    textColor: '#F3F4F6',
                    textBackgroundColor: '#4B556380'
                };
            });
        candleSeries.setMarkers(markers);
        console.log('Marker impostati:', markers);
        console.log('Timestamp marker:', markers.map(m => m.time));

        // Linee TP/SL solo per Entry, limitate agli ultimi 5 trade
        const recentEntries = trades
            .filter(t => t.event === 'Entry')
            .slice(-5); // Limita agli ultimi 5 trade Entry
        recentEntries.forEach(t => {
            const lineOptions = {
                lineWidth: 1.5,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                titleTextColor: '#F3F4F6'
            };

            candleSeries.createPriceLine({
                ...lineOptions,
                price: validateNumber(t.tpTarget),
                color: '#10B981',
                title: `TP ${validateNumber(t.tpTarget).toFixed(2)}`
            });

            candleSeries.createPriceLine({
                ...lineOptions,
                price: validateNumber(t.slTarget),
                color: '#EF4444',
                title: `SL ${validateNumber(t.slTarget).toFixed(2)}`
            });
        });
        console.log('Linee TP/SL aggiunte per ultimi 5 trade Entry:', recentEntries.length);
    } catch (error) {
        console.error('Errore visualizzazione trades:', error);
    }

    // 7. Ottimizzazione visuale
    chart.timeScale().fitContent();
    chart.applyOptions(theme);

    // 8. Gestione responsive
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            chart.applyOptions({ 
                width: entry.contentRect.width,
                height: 650
            });
        }
    });
    resizeObserver.observe(container);

    // 9. Stile per errori
    function showError(msg) {
        container.innerHTML = `
            <div style="
                color: #F3F4F6;
                background: #EF4444;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                font-family: Arial, sans-serif;
            ">${msg}</div>
        `;
    }
}