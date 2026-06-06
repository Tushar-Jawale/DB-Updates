import WebSocket from 'ws';

const url = process.argv[2] || 'ws://localhost:3000';
const ws = new WebSocket(url);

console.log(`Connecting to ${url}...\n`);

ws.on('open', () => {
  console.log(`✓ Connected to ${url}`);
  console.log('Waiting for real-time updates...\n');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'connection') {
    console.log(`[Server] ${msg.message}\n`);
    return;
  }

  const time = new Date(msg.updated_at).toLocaleTimeString();
  console.log(`┌── ${msg.operation} ──────────────────────`);
  console.log(`│ Order #${msg.id}`);
  console.log(`│ Customer : ${msg.customer_name}`);
  console.log(`│ Product  : ${msg.product_name}`);
  console.log(`│ Status   : ${msg.status}`);
  console.log(`│ Time     : ${time}`);
  console.log(`└──────────────────────────────────\n`);
});

ws.on('close', () => {
  console.log('Disconnected from server.');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  ws.close();
});
