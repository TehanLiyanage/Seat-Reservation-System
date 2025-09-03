import { Router } from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const SLOT_STARTS = {
  MORNING: '09:00',
  AFTERNOON: '13:00',
  EVENING: '17:00'
};

const slotStartDate = (dateStr, slot) =>
  new Date(`${dateStr}T${(SLOT_STARTS[slot] || '09:00')}:00`);

// ---------------- CREATE RESERVATION ----------------
router.post('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { seat_id, date, time_slot } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!seat_id || !date || !time_slot) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Past date check
    const today = new Date();
    const d = new Date(`${date}T00:00:00`);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return res.status(400).json({ error: 'Past dates cannot be booked' });
    }

    // 1 hour in advance
    if (slotStartDate(date, time_slot) - Date.now() < 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Reservations must be made at least 1 hour in advance' });
    }

    // Seat must exist & be available
    const seat = await pool.query('SELECT id, status FROM seats WHERE id=$1', [seat_id]);
    if (!seat.rows.length) return res.status(404).json({ error: 'Seat not found' });
    if (seat.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Seat is not available' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reservations (intern_id, seat_id, date, time_slot) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, time_slot, status`,
      [userId, seat_id, date, time_slot]
    );

    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Seat already booked or you already reserved a seat that day' });
    }
    next(e);
  }
});

// ---------------- VIEW MY RESERVATIONS ----------------
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const current = await pool.query(
      `SELECT r.id, TO_CHAR(r.date, 'YYYY-MM-DD') AS date, r.time_slot, r.status, 
              s.seat_number, s.location
       FROM reservations r
       JOIN seats s ON r.seat_id = s.id
       WHERE r.intern_id = $1 AND r.date >= $2
       ORDER BY r.date ASC, r.time_slot ASC`,
      [userId, today]
    );

    const past = await pool.query(
      `SELECT r.id, TO_CHAR(r.date, 'YYYY-MM-DD') AS date, r.time_slot, r.status, 
              s.seat_number, s.location
       FROM reservations r
       JOIN seats s ON r.seat_id = s.id
       WHERE r.intern_id = $1 AND r.date < $2
       ORDER BY r.date DESC, r.time_slot DESC`,
      [userId, today]
    );

    res.json({ current: current.rows, past: past.rows });
  } catch (e) {
    next(e);
  }
});

// ---------------- MODIFY RESERVATION ----------------
router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { seat_id, date, time_slot } = req.body;

    if (!seat_id || !date || !time_slot) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Check ownership
    const existing = await pool.query(
      `SELECT * FROM reservations WHERE id=$1 AND intern_id=$2`,
      [id, userId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Prevent editing past reservations
    const today = new Date();
    const d = new Date(`${date}T00:00:00`);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return res.status(400).json({ error: 'Cannot modify past reservations' });
    }

    // 1 hour rule
    if (slotStartDate(date, time_slot) - Date.now() < 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Reservations must be updated at least 1 hour in advance' });
    }

    // Seat must be available
    const seat = await pool.query('SELECT id, status FROM seats WHERE id=$1', [seat_id]);
    if (!seat.rows.length) return res.status(404).json({ error: 'Seat not found' });
    if (seat.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Seat is not available' });
    }

    const { rows } = await pool.query(
      `UPDATE reservations 
       SET seat_id=$1, date=$2, time_slot=$3
       WHERE id=$4 AND intern_id=$5
       RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, time_slot, status`,
      [seat_id, date, time_slot, id, userId]
    );

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ---------------- DELETE RESERVATION ----------------
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM reservations WHERE id=$1 AND intern_id=$2`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
