import pg from 'pg';
import config from './config.js';

const { Pool, Client } = pg;

const isLocal = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');

const dbConfig = {
  connectionString: config.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

function startListener(onNotification) {
  let client = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;

  async function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (client) {
      try {
        client.removeAllListeners();
        await client.end();
      } catch (err) {}
      client = null;
    }

    try {
      client = new Client(dbConfig);
      await client.connect();
      await client.query(`LISTEN ${config.notifyChannel}`);
      console.log(`[DB] Listening on channel "${config.notifyChannel}"`);
      reconnectDelay = 1000;

      client.on('notification', (msg) => {
        try {
          const payload = JSON.parse(msg.payload);
          onNotification(payload);
        } catch (err) {
          console.error('[DB] Failed to parse notification payload:', err.message);
        }
      });

      client.on('error', (err) => {
        console.error('[DB] Listener connection error:', err.message);
        cleanupAndReconnect();
      });

      client.on('end', () => {
        console.warn('[DB] Listener connection ended.');
        cleanupAndReconnect();
      });
    } catch (err) {
      console.error('[DB] Failed to connect listener:', err.message);
      cleanupAndReconnect();
    }
  }

  function cleanupAndReconnect() {
    if (client) {
      try {
        client.removeAllListeners();
        client.end().catch(() => {});
      } catch (e) {}
      client = null;
    }
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;

    console.log(`[DB] Reconnecting in ${reconnectDelay / 1000}s...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      connect();
    }, reconnectDelay);
  }

  connect();
}

export { pool, startListener };
