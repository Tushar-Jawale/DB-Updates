# Real-Time Database Updates System (Backend)

A backend service that propagates database changes to connected clients in real time, without polling. Built with **PostgreSQL LISTEN/NOTIFY** and **WebSockets**, using **Supabase** as the hosted PostgreSQL database.

---

## Architecture

```text
┌─────────────────┐     NOTIFY      ┌──────────────────┐    WebSocket     ┌──────────────┐
│                 │ ──────────────► │                  │ ──────────────►  │  Connected   │
│   Supabase      │                 │   Node.js Server │                  │  WebSocket   │
│   PostgreSQL    │                 │   (Express + WS) │ ◄──────────────  │  Clients     │
│                 │                 │                  │    REST API      │  (CLI/Test)  │
│   Trigger →     │                 │   LISTEN channel │                  │              │
│   pg_notify()   │                 │   REST routes    │                  │              │
└─────────────────┘                 └──────────────────┘                  └──────────────┘
```

### How It Works

1. **Database Trigger** — A PostgreSQL trigger fires on every `INSERT`, `UPDATE`, or `DELETE` on the `orders` table. It calls `pg_notify()` with a JSON payload containing the operation type and row data.
2. **Backend Listener** — A dedicated PostgreSQL client connection runs `LISTEN orders_channel`. When a notification arrives, the payload is parsed and broadcast to all connected WebSocket clients.
3. **WebSocket Broadcast** — The server maintains a registry of active WebSocket connections. Each notification is pushed to every connected client instantly.
4. **WebSocket Clients** — Connected clients (such as the provided CLI tool) receive the change payload instantly and handle updates in real time.

**Key design win: The REST API and WebSocket layers are completely decoupled.** The REST routes just write to the database. The database trigger handles notification. This means even raw SQL changes (e.g., via Supabase SQL Editor or external scripts) propagate to clients automatically.

---

## Quick Start

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com/) project (already configured)

### Setup

1. Clone the repository and install dependencies:
```bash
npm install
```

2. The `.env` file contains the Supabase connection string:
```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
PORT=3000
```

3. Run the database schema setup. Go to the **Supabase SQL Editor** and execute the contents of `db/init.sql` to create the `orders` table, triggers, and seed data.

4. Start the server:
```bash
npm run dev
```

### Connect a Client

This is a backend-only project. To see the live feed, you can use the included CLI client. In a separate terminal run:

```bash
npm run client
# or with a custom URL:
node src/client.js ws://localhost:3000
```
This script will connect to the WebSocket server and print real-time updates as they occur.

---

## Testing & Validation Scenarios

### 1. Automated Unit Tests
A testing script is included that mocks database queries and verifies REST endpoints and WebSocket broadcasts.
Run the tests locally:
```bash
# Install dependencies
npm install

# Run the test suite
npm test
```

### 2. Raw SQL Test — Proves DB-Level Triggers Work
1. Open the **Supabase SQL Editor** for your project.
2. In a separate terminal tab/window, connect a WebSocket client using the CLI tool:
```bash
npm run client
```
3. Execute SQL operations in the Supabase SQL Editor:
```sql
-- Insert via raw SQL (bypasses the REST API entirely)
INSERT INTO orders (customer_name, product_name, status) VALUES ('Raw SQL User', 'Gadget', 'shipped');

-- Update via raw SQL
UPDATE orders SET status='delivered' WHERE customer_name='Raw SQL User';

-- Delete via raw SQL
DELETE FROM orders WHERE customer_name='Raw SQL User';
```
Verify that the CLI WebSocket client immediately logs these events as they occur in real time.

---

## Project Structure

```
DB_updates/
├── package.json              # Dependencies: express, pg, ws
├── .env                      # Supabase DATABASE_URL + PORT
├── db/
│   └── init.sql              # Schema, triggers, seed data
└── src/
    ├── server.js             # Entry point (HTTP + WS)
    ├── config.js             # Environment-based config
    ├── db.js                 # PG pool + LISTEN client
    ├── ws.js                 # WebSocket server + broadcast
    ├── client.js             # CLI WebSocket client
    ├── test-unit.js          # Unit test suite
    └── routes/
        └── orders.js         # REST CRUD endpoints
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/orders` | List all orders |
| `POST` | `/api/orders` | Create an order (`{ customer_name, product_name, status? }`) |
| `PUT` | `/api/orders/:id` | Update an order (partial update supported) |
| `DELETE` | `/api/orders/:id` | Delete an order |
| `GET` | `/health` | Health check |

---

## Tech Stack

| Component | Choice | Rationale |
|---|---|---|
| **Database** | Supabase (PostgreSQL) | Hosted PostgreSQL with native LISTEN/NOTIFY, robust triggers, ACID compliance |
| **Backend** | Node.js 20 + Express | Event-driven model ideal for real-time; lightweight |
| **WebSocket** | `ws` library | Zero-dependency, production-grade WebSocket implementation |
| **DB Client** | `pg` (node-postgres) | Mature, supports LISTEN, parameterized queries |
