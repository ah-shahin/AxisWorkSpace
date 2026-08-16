const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/reports/today
//  - revenue: money collected today = sum of total_price for visits CHECKED OUT today.
//  - visit_count: number of check-ins today (each group counts as one check-in).
//  - visitor_count: number of PEOPLE today = sum of group_size for check-ins today,
//    so a group of 3 counts as 3 visitors, not 1.
// FILTER lets us compute all three in a single table scan.
router.get('/today', async (req, res) => {
  try {
    // Revenue = host payments (collected at main_check_out) + member payments
    // (collected at their own check_out). Sum both for today.
    const result = await pool.query(
      `SELECT
         (
           COALESCE((SELECT SUM(total_price) FROM visits
                       WHERE main_check_out::date = CURRENT_DATE), 0)
           +
           COALESCE((SELECT SUM(total_price) FROM visit_members
                       WHERE check_out::date = CURRENT_DATE), 0)
         ) AS revenue,
         (SELECT COUNT(*) FROM visits
            WHERE check_in::date = CURRENT_DATE) AS visit_count,
         COALESCE((SELECT SUM(group_size) FROM visits
                     WHERE check_in::date = CURRENT_DATE), 0) AS visitor_count`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/history — every completed payment (host + members), newest
// first. The client groups these by day for the calendar-style history view.
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT paid_at, name, role, room_name, amount, payment_method
       FROM (
         SELECT v.main_check_out AS paid_at, c.name AS name, 'host' AS role,
                r.name AS room_name, v.total_price AS amount, v.payment_method
         FROM visits v
         JOIN customers c ON c.id = v.customer_id
         JOIN rooms r     ON r.id = v.room_id
         WHERE v.main_check_out IS NOT NULL

         UNION ALL

         SELECT vm.check_out AS paid_at, vm.name AS name, 'member' AS role,
                r.name AS room_name, vm.total_price AS amount, vm.payment_method
         FROM visit_members vm
         JOIN visits v ON v.id = vm.visit_id
         JOIN rooms r  ON r.id = v.room_id
         WHERE vm.check_out IS NOT NULL
       ) t
       ORDER BY paid_at DESC
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
