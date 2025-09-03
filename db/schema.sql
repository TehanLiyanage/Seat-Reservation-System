BEGIN;


-- USERS
CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
email TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
role TEXT NOT NULL CHECK (role IN ('intern','admin')),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- SEATS
CREATE TABLE IF NOT EXISTS seats (
id SERIAL PRIMARY KEY,
seat_number TEXT NOT NULL UNIQUE,
location TEXT,
status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','unavailable')),
branch TEXT DEFAULT 'HQ'
);


-- RESERVATIONS
CREATE TABLE IF NOT EXISTS reservations (
id SERIAL PRIMARY KEY,
intern_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
date DATE NOT NULL,
time_slot TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Prevent double booking/overbooking: one active reservation per seat/date/slot
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_seat_unique
ON reservations(seat_id, date, time_slot)
WHERE status='active';


-- One active seat per intern per day
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_intern_per_day
ON reservations(intern_id, date)
WHERE status='active';


-- Helpful indexes
CREATE INDEX IF NOT EXISTS ix_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS ix_reservations_intern ON reservations(intern_id);
CREATE INDEX IF NOT EXISTS ix_reservations_seat ON reservations(seat_id);


COMMIT;