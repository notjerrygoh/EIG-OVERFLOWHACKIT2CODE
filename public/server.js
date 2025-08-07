// server.js USING WEBSOCKETS
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
console.log('WebSocket server running on ws://localhost:8080');

const seatIds = Array.from({ length: 10 }, (_, i) => `seat-${i + 1}`);

function getRandomSeatUpdate() {
    const randomSeat = seatIds[Math.floor(Math.random() * seatIds.length)];
    const status = Math.random() > 0.5 ? 'taken' : 'empty';
    return JSON.stringify({ seatId: randomSeat, status });
}

wss.on('connection', (ws) => {
    console.log('[Server] Client connected');

    // TEST: Send random seat updates every 5 seconds
    const interval = setInterval(() => {
        const update = getRandomSeatUpdate();
        console.log('[Server OUTGOING]', update);
        ws.send(update);
    }, 1000);

    // Listen to messages from client
    ws.on('message', (msg) => {
        const messageString = msg.toString();  // Convert buffer to string
        console.log('[Server INCOMING]', messageString);

        try {
            const data = JSON.parse(messageString);
            console.log('[Parsed Message]', data);

        } catch (err) {
            console.error('Failed to parse incoming message:', err);
        }
    });


    ws.on('close', () => {
        console.log('[Server] Client disconnected');
        clearInterval(interval);
    });
});
