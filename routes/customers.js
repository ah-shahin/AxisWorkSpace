const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/customers/search?q=xxx  (also accepts ?phone= for older callers)
// Partial match on EITHER name or phone, so staff can look someone up by typing
// a few digits of the number or part of the name.
router.get('/search', async (req, res) => {
  const q = req.query.q || req.query.phone;
  if (!q) {
    return res.status(400).json({ error: 'q (name or phone) query param is required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, phone, created_at
       FROM customers
       WHERE name ILIKE $1 OR phone ILIKE $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers — all customers (newest first) with their total visit count.
// A visit counts whether the person was the main customer OR a group member,
// so everyone in a group gets credit for the visit — not just the host.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.phone, c.created_at,
              (
                (SELECT COUNT(*) FROM visits v WHERE v.customer_id = c.id)
                +
                (SELECT COUNT(*) FROM visit_members vm WHERE vm.customer_id = c.id)
              )::int AS visit_count
       FROM customers c
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id { name, phone } — edit a customer's details.
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  try {
    const result = await pool.query(
      `UPDATE customers SET name = $1, phone = $2
       WHERE id = $3
       RETURNING id, name, phone, created_at`,
      [name, phone, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    // Unique-violation on phone (another customer already uses it).
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Another customer already uses that phone.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers { name, phone }
// Find-or-create on phone: front desk just types a phone number and doesn't
// need to know whether the customer is new or returning.
router.post('/', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT id, name, phone, created_at FROM customers WHERE phone = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json(existing.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO customers (name, phone)
       VALUES ($1, $2)
       RETURNING id, name, phone, created_at`,
      [name, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
// Refuse if the customer is tied to any visit (as the main customer or a group
// member) — deleting would orphan visit history. Staff must keep them instead.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const refs = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM visits WHERE customer_id = $1)         AS as_main,
         (SELECT COUNT(*) FROM visit_members WHERE customer_id = $1)  AS as_member`,
      [id]
    );
    const { as_main, as_member } = refs.rows[0];
    if (Number(as_main) > 0 || Number(as_member) > 0) {
      return res.status(409).json({
        error: 'Cannot delete: this customer has visit history.',
      });
    }

    const del = await pool.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [id]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json({ deleted: del.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
