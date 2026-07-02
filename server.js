const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// Serve static files
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const file = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket relay
const wss = new WebSocketServer({ server });
const clients = new Set();
let layerHistory = []; // all layers ever added

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  // Send full history to new client
  ws.send(JSON.stringify({ type: 'init', layers: layerHistory }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'add-layer') {
        const layer = {
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          vizName: msg.vizName,
          vizCode: msg.vizCode,
          addedBy: msg.addedBy || 'anon',
          timestamp: Date.now(),
        };
        layerHistory.push(layer);

        // Keep last 50 layers
        if (layerHistory.length > 50) layerHistory = layerHistory.slice(-50);

        // Broadcast to ALL clients
        const broadcast = JSON.stringify({ type: 'new-layer', layer });
        for (const client of clients) {
          if (client.readyState === 1) client.send(broadcast);
        }
      }

      if (msg.type === 'clear-all') {
        layerHistory = [];
        const broadcast = JSON.stringify({ type: 'clear-all' });
        for (const client of clients) {
          if (client.readyState === 1) client.send(broadcast);
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (${clients.size} total)`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
