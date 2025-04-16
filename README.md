# Multi-Exchanges-CVD-BOT
Multi-Exchanges-CVD-BOT//
├── data/                   # Cartella per CSV JSON 
│   ├── candles_YYm.json    # Dati candele aggregate // Un file per ogni TF -> candles_1m candles_5m ecc ..
│   ├── candles_XXm.json    # Dati candele aggregate // Un file per ogni TF -> candles_1m candles_5m ecc ..
│   └── last_aggregated_trade.json  # dati candela live per plot nella chart in stily tradingview
├── indicators/             # Cartella indicatori // Nessuno creato -> Tutto in cvdStrategy
│   ├── atr.js              # indicatore atr
│   ├── cvd.js              # indicatore cvd
│   └── fvg.js              # indicatore fvg
├── exchanges/              # Logiche connessione exchanges
│   ├── bybit.js            # Da fare
│   ├── binance.js          # Da fare
│   ├── coinbase.js         # Da fare
│   └── okex.js             # Da Fare
├── src/
│   ├── main.js             # Coordinatore principale prende tutti gli exchange da src/exchanges
│   ├── config.js           # parametri configurazione del bot
│   └── dataAggregator.js   # Aggrega candele da tutti i websocket // Media prezzi ma Somma volumi
├── strategy/
│   ├── cvdStrategy.js      # strategia CVD
├── charts/                 # Da Fare Tutto
│   ├── index.html          # Pagina web per il grafico  // Da fare
│   ├── index.js            # Logica del grafico live // Da fare
│   └── vite.config.js      # Configurazione Vite // Da fare se si usa vite altrimenti non serve ... 
├── .env                    # Chiavi connessione exchanges per trading // Non necessario al momento
├── package.json
├── TS-fistTest.js          # Test playground for Tensorflow
└── README.md               # questo file