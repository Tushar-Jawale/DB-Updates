import http from 'http';
import express from 'express';
import config from './config.js';
import { pool, startListener } from './db.js';
import ordersRouter from './routes/orders.js';

const app = express();

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use('/api/orders', ordersRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);

startListener((payload) => {
  console.log('Received payload:', payload);
});

server.listen(config.port, () => {
  console.log(`Real-Time Orders Service`);
  console.log(`HTTP on port ${config.port}`);
});

async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down...`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
