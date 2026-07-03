const express = require('express');
const pool = require('../db');

const router = express.Router();

// Courtesy buffer: the first 10 minutes into any new hour are free, so a stay
// of 3h09m still bills as 3 hours but 3h11m bills as 4.
const GRACE_HOURS = 10 / 60;
const PAYMENT_METHODS = ['cash', 'card', 'online'];

const round2 = (n) => Number(n.toFixed(2));

// Occupancy of a single active visit = group size, minus members who already
// left, minus the host if they already checked out.
const OCCUPIED_EXPR = `
  v.group_size
  - (SELECT COUNT(*) FROM visit_members vm WHERE vm.visit_id = v.id AND vm.check_out IS NOT NULL)
  - (CASE WHEN v.main_check_out IS NOT NULL THEN 1 ELSE 0 END)
`;

function groupBill(pricing, checkIn, checkOut, groupSize) {
  const hourly    = parseFloat(pricing.hourly_rate);
  const daily     = parseFloat(pricing.daily_rate);
  const threshold = pricing.threshold_hours;

  const rawHours    = (checkOut - checkIn) / (1000 * 60 * 60);
  const billedHours = Math.max(1, Math.ceil(rawHours - GRACE_HOURS));

  const base = billedHours <= threshold ? hourly * billedHours : daily;
  return pricing.pricing_mode === 'per_person' ? base * groupSize : base;
}

// One person's share = group bill for THEIR time, split evenly by group size.
function perPersonShare(pricing, checkIn, checkOut, groupSize) {
  return round2(groupBill(pricing, checkIn, checkOut, groupSize) / groupSize);
}

async function findOrCreateCustomer(client, name, phone) {
  if (!phone) return null;
  const existing = await client.query('SELECT id FROM customers WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) return existing.rows[0].id;
  const ins = await client.query(
    'INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id',
    [name || phone, phone]
  );
  return ins.rows[0].id;
}

// Close the visit (free the room) once the host AND every member have left.
async function closeVisitIfEmpty(db, visitId) {
  const r = await db.query(
    `SELECT (main_check_out IS NOT NULL) AS main_out,
            (SELECT COUNT(*) FROM visit_members
               WHERE visit_id = $1 AND check_out IS NULL)::int AS members_in
     FROM visits WHERE id = $1`,
    [visitId]
  );
  const row = r.rows[0];
  if (row && row.main_out && row.members_in === 0) {
    await db.query(
      'UPDATE visits SET check_out = NOW() WHERE id = $1 AND check_out IS NULL',
      [visitId]
    );
    return true;
  }
  return false;
}

// GET /api/visits/active — everyone still inside, with room pricing and each
// participant's checkout state (host + members).
router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id,
              v.check_in,
              v.group_size,
              (v.main_check_out IS NOT NULL) AS main_checked_out,
              c.name  AS customer_name,
              c.phone AS customer_phone,
              r.name  AS room_name,
              rt.hourly_rate, rt.daily_rate, rt.threshold_hours, rt.pricing_mode,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', vm.id, 'name', vm.name, 'phone', vm.phone,
                    'checked_out', (vm.check_out IS NOT NULL),
                    'total_price', vm.total_price
                  ) ORDER BY vm.id
                ) FILTER (WHERE vm.id IS NOT NULL),
                '[]'
              ) AS members
       FROM visits v
       JOIN customers c       ON c.id = v.customer_id
       JOIN rooms r           ON r.id = v.room_id
       JOIN room_types rt     ON rt.id = r.room_type_id
       LEFT JOIN visit_members vm ON vm.visit_id = v.id
       WHERE v.check_out IS NULL
       GROUP BY v.id, c.name, c.phone, r.name,
                rt.hourly_rate, rt.daily_rate, rt.threshold_hours, rt.pricing_mode
       ORDER BY v.check_in DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/visits — check-in
router.post('/', async (req, res) => {
  const { customer_id, room_id, created_by, group_size, members } = req.body;
  if (!customer_id || !room_id || !created_by) {
    return res
      .status(400)
      .json({ error: 'customer_id, room_id and created_by are required' });
  }
  const size = group_size || 1;

  const cleanMembers = Array.isArray(members)
    ? members
        .filter((m) => m && m.name && m.name.trim())
        .map((m) => ({ name: m.name.trim(), phone: (m.phone || '').trim() || null }))
    : [];

  const client = await pool.connect();
  try {
    const cap = await client.query(
      `SELECT rt.pricing_mode,
              rt.max_capacity,
              (SELECT COUNT(*) FROM visits v
                 WHERE v.room_id = r.id AND v.check_out IS NULL)::int AS active_visits,
              (SELECT COALESCE(SUM(${OCCUPIED_EXPR}), 0)
                 FROM visits v
                 WHERE v.room_id = r.id AND v.check_out IS NULL)::int AS occupied
       FROM rooms r
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE r.id = $1`,
      [room_id]
    );
    if (cap.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    const { pricing_mode, max_capacity, active_visits, occupied } = cap.rows[0];

    if (pricing_mode === 'per_room') {
      if (active_visits > 0) {
        return res.status(409).json({ error: 'That room is already occupied.' });
      }
      if (size > max_capacity) {
        return res
          .status(409)
          .json({ error: `Group too large: room holds up to ${max_capacity}.` });
      }
    } else {
      const free = max_capacity - occupied;
      if (size > free) {
        return res
          .status(409)
          .json({ error: `Not enough space: only ${free} seat(s) free.` });
      }
    }

    await client.query('BEGIN');

    const visitRes = await client.query(
      `INSERT INTO visits (customer_id, room_id, created_by, group_size)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customer_id, room_id, created_by, size]
    );
    const visit = visitRes.rows[0];

    for (const m of cleanMembers) {
      const memberCustomerId = await findOrCreateCustomer(client, m.name, m.phone);
      await client.query(
        'INSERT INTO visit_members (visit_id, customer_id, name, phone) VALUES ($1, $2, $3, $4)',
        [visit.id, memberCustomerId, m.name, m.phone]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...visit, members: cleanMembers });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/visits/:id/members/:memberId/checkout — one member leaves alone.
router.patch('/:id/members/:memberId/checkout', async (req, res) => {
  const { id, memberId } = req.params;
  const { payment_method } = req.body;
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
  }

  try {
    const found = await pool.query(
      `SELECT vm.check_out AS member_check_out,
              v.check_in, v.group_size, v.check_out AS visit_check_out,
              rt.hourly_rate, rt.daily_rate, rt.threshold_hours, rt.pricing_mode
       FROM visit_members vm
       JOIN visits v      ON v.id = vm.visit_id
       JOIN rooms r       ON r.id = v.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE vm.id = $1 AND vm.visit_id = $2`,
      [memberId, id]
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Group member not found for this visit.' });
    }
    const row = found.rows[0];
    if (row.visit_check_out) return res.status(400).json({ error: 'This visit is already closed.' });
    if (row.member_check_out) return res.status(400).json({ error: 'This member is already checked out.' });

    const now = new Date();
    const amount = perPersonShare(row, new Date(row.check_in), now, row.group_size);

    const updated = await pool.query(
      `UPDATE visit_members
       SET check_out = $1, total_price = $2, payment_method = $3, payment_status = 'paid'
       WHERE id = $4
       RETURNING id, name, phone, total_price, payment_method`,
      [now, amount, payment_method, memberId]
    );
    const closed = await closeVisitIfEmpty(pool, id);
    res.json({ ...updated.rows[0], amount, visit_closed: closed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/visits/:id/main/checkout — the HOST leaves alone; the group stays.
router.patch('/:id/main/checkout', async (req, res) => {
  const { id } = req.params;
  const { payment_method } = req.body;
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
  }

  try {
    const found = await pool.query(
      `SELECT v.check_in, v.group_size, v.check_out, v.main_check_out,
              rt.hourly_rate, rt.daily_rate, rt.threshold_hours, rt.pricing_mode
       FROM visits v
       JOIN rooms r       ON r.id = v.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE v.id = $1`,
      [id]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'Visit not found.' });
    const visit = found.rows[0];
    if (visit.check_out) return res.status(400).json({ error: 'This visit is already closed.' });
    if (visit.main_check_out) return res.status(400).json({ error: 'The host is already checked out.' });

    const now = new Date();
    const amount = perPersonShare(visit, new Date(visit.check_in), now, visit.group_size);

    await pool.query(
      `UPDATE visits
       SET main_check_out = $1, total_price = $2, payment_method = $3, payment_status = 'paid'
       WHERE id = $4`,
      [now, amount, payment_method, id]
    );
    const closed = await closeVisitIfEmpty(pool, id);
    res.json({ main_amount: amount, visit_closed: closed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/visits/:id/checkout — check out the WHOLE group at once.
// Settles the host (if still in) and every member still inside, then closes.
router.patch('/:id/checkout', async (req, res) => {
  const { id } = req.params;
  const { payment_method } = req.body;
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    const found = await client.query(
      `SELECT v.check_in, v.group_size, v.check_out, v.main_check_out,
              c.name AS customer_name,
              rt.hourly_rate, rt.daily_rate, rt.threshold_hours, rt.pricing_mode
       FROM visits v
       JOIN customers c   ON c.id = v.customer_id
       JOIN rooms r       ON r.id = v.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE v.id = $1`,
      [id]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'Visit not found.' });
    const visit = found.rows[0];
    if (visit.check_out) return res.status(400).json({ error: 'This visit is already checked out.' });

    const now = new Date();
    const checkIn = new Date(visit.check_in);
    const share = () => perPersonShare(visit, checkIn, now, visit.group_size);

    await client.query('BEGIN');

    // Host pays now only if they hadn't already left earlier.
    let mainAmount = 0;
    if (!visit.main_check_out) {
      mainAmount = share();
      await client.query(
        `UPDATE visits
         SET main_check_out = $1, total_price = $2, payment_method = $3, payment_status = 'paid'
         WHERE id = $4`,
        [now, mainAmount, payment_method, id]
      );
    }

    const remaining = await client.query(
      `SELECT id, name FROM visit_members WHERE visit_id = $1 AND check_out IS NULL`,
      [id]
    );
    const settledMembers = [];
    for (const m of remaining.rows) {
      const amount = share();
      await client.query(
        `UPDATE visit_members
         SET check_out = $1, total_price = $2, payment_method = $3, payment_status = 'paid'
         WHERE id = $4`,
        [now, amount, payment_method, m.id]
      );
      settledMembers.push({ name: m.name, amount });
    }

    await client.query('UPDATE visits SET check_out = $1 WHERE id = $2', [now, id]);
    await client.query('COMMIT');

    const grandTotal = round2(mainAmount + settledMembers.reduce((s, m) => s + m.amount, 0));
    res.json({
      main_name: visit.customer_name,
      main_amount: mainAmount,
      main_already_out: !!visit.main_check_out,
      settled_members: settledMembers,
      grand_total: grandTotal,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
