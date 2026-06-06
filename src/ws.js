import { WebSocketServer } from 'ws';

let wss;

function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    console.log(`[WS] Client connected (total: ${wss.clients.size})`);

    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to real-time orders feed',
      timestamp: new Date().toISOString(),
    }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected (total: ${wss.clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  console.log('[WS] WebSocket server attached to HTTP server');
}

function broadcast(data) {
  const message = JSON.stringify({ type: 'db_change', ...data });
  let sent = 0;

  if (wss) {
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
        sent++;
      }
    });
  }

  console.log(`[WS] Broadcast "${data.operation}" to ${sent} client(s)`);
}

export { createWebSocketServer, broadcast };
