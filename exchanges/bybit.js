// exchanges/bybit.js
import WebSocket from 'ws';

export default class BybitExchange {
    constructor(pair, marketType, callback) {
        this.pair = pair.replace('/', '');
        this.marketType = marketType;
        this.callback = callback;
        this.ws = null;
        this.tradeCount = 0;
        this.connect();
    }

    connect() {
        const baseUrl = this.marketType === 'linear' ? 
            'wss://stream.bybit.com/v5/public/linear' : 
            'wss://stream.bybit.com/v5/public/spot';
        
        console.log(`[BYBIT] Connecting to ${baseUrl} for pair ${this.pair}`);
        
        this.ws = new WebSocket(baseUrl);

        this.ws.on('open', () => {
            const subscribeMessage = {
                op: 'subscribe',
                args: [`publicTrade.${this.pair}`]
            };
            console.log(`[BYBIT] Sending subscribe: ${JSON.stringify(subscribeMessage)}`);
            this.ws.send(JSON.stringify(subscribeMessage));
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                
                if (message.op === 'pong') {
                    console.log(`[BYBIT] Received pong`);
                    return;
                }
                
                if (message.topic && message.topic.startsWith('publicTrade')) {
                    console.log(`[BYBIT] Received trade data batch with ${message.data?.length || 0} trades`);
                    this.processTrades(message.data);
                } else if (message.success) {
                    console.log(`[BYBIT] Subscription success: ${JSON.stringify(message)}`);
                }
            } catch (err) {
                console.error('[BYBIT] Error parsing message:', err);
            }
        });

        this.ws.on('error', (err) => {
            console.error('[BYBIT] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log('[BYBIT] WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connect(), 5000);
        });

        this.heartbeatInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ op: 'ping' }));
                console.log('[BYBIT] Sent ping');
            }
        }, 30000);
    }

    processTrades(trades) {
        if (!Array.isArray(trades)) {
            console.log('[BYBIT] Received non-array trades data:', trades);
            return;
        }

        console.log(`[BYBIT] Processing ${trades.length} trades`);
        
        trades.forEach((trade) => {
            try {
                this.tradeCount++;
                const formattedData = {
                    price: parseFloat(trade.p),
                    size: parseFloat(trade.v),
                    side: trade.S === 'Buy' ? 'Buy' : 'Sell', // CORRETTO secondo docs Bybit
                    timestamp: trade.T
                };
                
                
                if (this.tradeCount <= 5 || this.tradeCount % 100 === 0) {
                    console.log(`[BYBIT] Trade #${this.tradeCount}:`, {
                        price: formattedData.price,
                        size: formattedData.size,
                        side: formattedData.side,
                        time: new Date(formattedData.timestamp).toISOString()
                    });
                }
                
                this.callback('bybit', formattedData);
            } catch (err) {
                console.error('[BYBIT] Error processing trade:', err, trade);
            }
        });
    }
}