import { Router } from 'express';
import { pool } from '../db.js';

const VALID_STATUSES = ['pending', 'shipped', 'delivered'];
const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[API] GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', async (req, res) => {
  const { customer_name, product_name, status = 'pending' } = req.body;

  if (!customer_name || !product_name) {
    return res.status(400).json({ error: 'customer_name and product_name are required' });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_name, product_name, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customer_name, product_name, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[API] POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { customer_name, product_name, status } = req.body;

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE orders
       SET customer_name = COALESCE($1, customer_name),
           product_name  = COALESCE($2, product_name),
           status        = COALESCE($3, status)
       WHERE id = $4
       RETURNING *`,
      [customer_name ?? null, product_name ?? null, status ?? null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(`[API] PUT /orders/${id} error:`, err.message);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted', order: rows[0] });
  } catch (err) {
    console.error(`[API] DELETE /orders/${id} error:`, err.message);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

export default router;
