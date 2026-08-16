-- Coworking Space MVP — Database Schema

CREATE TABLE room_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  threshold_hours INT NOT NULL DEFAULT 5,
  pricing_mode VARCHAR(20) NOT NULL DEFAULT 'per_room' CHECK (pricing_mode IN ('per_room','per_person')),
  max_capacity INT NOT NULL DEFAULT 1
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  room_type_id INT NOT NULL REFERENCES room_types(id)
);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('staff','owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE visits (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  room_id INT NOT NULL REFERENCES rooms(id),
  created_by INT NOT NULL REFERENCES users(id),
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  main_check_out TIMESTAMPTZ,           -- when the host left (may be before the visit closes)
  check_out TIMESTAMPTZ,                -- when the whole visit closed (everyone out)
  group_size INT NOT NULL DEFAULT 1,
  total_price DECIMAL(10,2),
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash','card','online')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid'))
);

-- Extra people in a group check-in, beyond the main (paying) customer.
-- Each member is also a customer (customer_id) and can be checked out and billed
-- individually. Belong to one visit; removed automatically if the visit is deleted.
CREATE TABLE visit_members (
  id SERIAL PRIMARY KEY,
  visit_id INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  customer_id INT REFERENCES customers(id),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  check_out TIMESTAMPTZ,
  total_price DECIMAL(10,2),
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash','card','online')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid','unpaid'))
);

-- Speeds up the "who's currently in" query (check_out IS NULL)
CREATE INDEX idx_visits_active ON visits(check_out) WHERE check_out IS NULL;
CREATE INDEX idx_visits_customer ON visits(customer_id);
CREATE INDEX idx_visit_members_visit ON visit_members(visit_id);
