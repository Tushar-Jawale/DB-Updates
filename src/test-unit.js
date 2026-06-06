import assert from 'assert';
import express from 'express';
import http from 'http';
import { WebSocket } from 'ws';
import { pool } from './db.js';
import { createWebSocketServer, broadcast } from './ws.js';
import ordersRouter from './routes/orders.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn()
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((err) => { failed++; console.error(`  ✗ ${name}\n    ${err.message}`); });
}

async function runTests() {
  console.log('Starting unit tests (mocked DB)...\n');

  // ── Mock pool.query ──────────────────────────────────────────────
  pool.query = async (text, values) => {
    if (text.includes('SELECT')) {
      return {
        rows: [
          {
            id: 1,
            customer_name: 'Alice',
            product_name: 'Keyboard',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    if (text.includes('INSERT')) {
      return {
        rows: [
          {
            id: 99,
            customer_name: values[0],
            product_name: values[1],
            status: values[2],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    if (text.includes('UPDATE')) {
      if (values[3] === '999') return { rows: [] }; 
      return {
        rows: [
          {
            id: values[3],
            customer_name: values[0] || 'Alice',
            product_name: values[1] || 'Keyboard',
            status: values[2] || 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    if (text.includes('DELETE')) {
      if (values[0] === '999') return { rows: [] }; 
      return {
        rows: [
          {
            id: values[0],
            customer_name: 'Alice',
            product_name: 'Keyboard',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    return { rows: [] };
  };

  // ── Boot test server ─────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use('/api/orders', ordersRouter);

  const server = http.createServer(app);
  createWebSocketServer(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Server] Running on port ${port}\n`);

  const baseUrl = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${port}`;

  // ── Connect a WebSocket client ───────────────────────────────────
  const wsClient = new WebSocket(wsUrl);
  const receivedMessages = [];
  wsClient.on('message', (data) => {
    receivedMessages.push(JSON.parse(data.toString()));
  });

  await new Promise((resolve, reject) => {
    wsClient.on('open', resolve);
    wsClient.on('error', reject);
  });

  // ── REST API Tests ───────────────────────────────────────────────
  console.log('REST API');

  await test('GET /api/orders returns an array', async () => {
    const res = await fetch(`${baseUrl}/api/orders`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    assert.ok(data[0].id !== undefined);
    assert.ok(data[0].customer_name !== undefined);
    assert.ok(data[0].product_name !== undefined);
    assert.ok(data[0].status !== undefined);
    assert.ok(data[0].updated_at !== undefined);
  });

  await test('POST /api/orders creates an order', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test', product_name: 'Widget' }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.customer_name, 'Test');
    assert.strictEqual(data.status, 'pending');
  });

  await test('POST /api/orders rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('required'));
  });

  await test('POST /api/orders rejects invalid status', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: 'Test', product_name: 'Widget', status: 'invalid' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid status'));
  });

  await test('PUT /api/orders/:id updates with partial data', async () => {
    const res = await fetch(`${baseUrl}/api/orders/42`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'delivered');
  });

  await test('PUT /api/orders/:id rejects invalid status', async () => {
    const res = await fetch(`${baseUrl}/api/orders/42`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bogus' }),
    });
    assert.strictEqual(res.status, 400);
  });

  await test('PUT /api/orders/:id returns 404 for missing order', async () => {
    const res = await fetch(`${baseUrl}/api/orders/999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });
    assert.strictEqual(res.status, 404);
  });

  await test('DELETE /api/orders/:id deletes an order', async () => {
    const res = await fetch(`${baseUrl}/api/orders/1`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.message.includes('deleted'));
  });

  await test('DELETE /api/orders/:id returns 404 for missing order', async () => {
    const res = await fetch(`${baseUrl}/api/orders/999`, { method: 'DELETE' });
    assert.strictEqual(res.status, 404);
  });

  // ── WebSocket Tests ──────────────────────────────────────────────
  console.log('\nWebSocket');

  await test('receives welcome message on connect', async () => {
    assert.ok(receivedMessages.length >= 1);
    assert.strictEqual(receivedMessages[0].type, 'connection');
    assert.ok(receivedMessages[0].message.includes('Connected'));
  });

  await test('receives broadcast for db_change', async () => {
    const before = receivedMessages.length;

    const mockPayload = {
      operation: 'UPDATE',
      id: 42,
      customer_name: 'Alice',
      product_name: 'Keyboard',
      status: 'delivered',
      updated_at: new Date().toISOString(),
    };

    broadcast(mockPayload);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const latest = receivedMessages[receivedMessages.length - 1];
    assert.strictEqual(latest.type, 'db_change');
    assert.strictEqual(latest.operation, 'UPDATE');
    assert.strictEqual(latest.id, 42);
    assert.strictEqual(latest.status, 'delivered');
  });

  // ── Summary ──────────────────────────────────────────────────────
  wsClient.close();
  server.close();
  await pool.end();

  console.log(`\n──────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`──────────────────────────────────`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
