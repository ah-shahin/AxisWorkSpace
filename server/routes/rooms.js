const express = require('express');
const pool = require('../db');

const router = express.Router();

// Every room with its type/pricing PLUS live occupancy.
//   occupied      = seats in use = (sum of active group sizes) - members who left early
//   active_visits = number of open visits in the room
// free_places is derived per pricing_mode in JS (see withFreePlaces).
const ROOMS_WITH_OCCUPANCY = `
  SELECT
    r.id,
    r.name,
    rt.name           AS type_name,
    rt.hourly_rate,
    rt.daily_rate,
    rt.threshold_hours,
    rt.pricing_mode,
    rt.max_capacity,
    (SELECT COUNT(*) FROM visits v
       WHERE v.room_id = r.id AND v.check_out IS NULL)::int AS active_visits,
    (SELECT COALESCE(SUM(
              v.group_size
              - (SELECT COUNT(*) FROM visit_members vm
                   WHERE vm.visit_id = v.id AND vm.check_out IS NOT NULL)
              - (CASE WHEN v.main_check_out IS NOT NULL THEN 1 ELSE 0 END)
            ), 0)
       FROM visits v
       WHERE v.room_id = r.id AND v.check_out IS NULL)::int AS occupied
  FROM rooms r
  JOIN room_types rt ON rt.id = r.room_type_id
  ORDER BY r.id
`;

// per_room rooms are exclusive (any active visit = full); per_person rooms are
// shared, so free = max_capacity - occupied seats.
function withFreePlaces(room) {
  const free =
    room.pricing_mode === 'per_room'
      ? (room.active_visits > 0 ? 0 : room.max_capacity)
      : room.max_capacity - room.occupied;
  return { ...room, free_places: free };
}

// GET /api/rooms — all rooms with pricing + current occupancy
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(ROOMS_WITH_OCCUPANCY);
    res.json(result.rows.map(withFreePlaces));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/free — only rooms that still have at least one free seat
router.get('/free', async (req, res) => {
  try {
    const result = await pool.query(ROOMS_WITH_OCCUPANCY);
    res.json(result.rows.map(withFreePlaces).filter((r) => r.free_places > 0));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
