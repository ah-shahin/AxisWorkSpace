// One-time seed: gives the app a staff user, room types, and rooms to work with.
// Safe to re-run — it skips if room_types already has data.
require('dotenv').config();
const pool = require('./db');

async function seed() {
  // Staff user with a fixed id=1, since check-in currently sends created_by: 1.
  // password_hash is a placeholder until auth is added.
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES (1, 'Front Desk', 'staff@axis.local', 'placeholder', 'staff')
     ON CONFLICT (id) DO NOTHING`
  );
  // Keep the users id sequence ahead of our manual id=1 insert.
  await pool.query(`SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1))`);

  const existing = await pool.query('SELECT COUNT(*) FROM room_types');
  if (parseInt(existing.rows[0].count, 10) > 0) {
    console.log('room_types already seeded — skipping room/type inserts.');
    await pool.end();
    return;
  }

  // room_types: (name, hourly, daily, threshold_hours, pricing_mode, max_capacity)
  const types = await pool.query(
    `INSERT INTO room_types (name, hourly_rate, daily_rate, threshold_hours, pricing_mode, max_capacity)
     VALUES
       ('Private Office', 60, 250, 5, 'per_room',   4),
       ('Shared Desk',    25, 100, 5, 'per_person', 10),
       ('Meeting Room',  100, 500, 5, 'per_room',   8)
     RETURNING id, name`
  );
  const typeId = Object.fromEntries(types.rows.map((t) => [t.name, t.id]));

  await pool.query(
    `INSERT INTO rooms (name, room_type_id) VALUES
       ('Office A',       $1),
       ('Office B',       $1),
       ('Open Area',      $2),
       ('Meeting Room 1', $3)`,
    [typeId['Private Office'], typeId['Shared Desk'], typeId['Meeting Room']]
  );

  console.log('Seeded: 1 user, 3 room types, 4 rooms.');
  await pool.end();
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
