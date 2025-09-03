import { Router } from 'express';
import pool from '../db.js';
import { authRequired, requireAdmin } from '../middleware/auth.js';

const router = Router();
const SLOT_STARTS = { MORNING: '09:00', AFTERNOON: '13:00', EVENING: '17:00' };
const slotStartDate = (d, s) => new Date(`${d}T${(SLOT_STARTS[s] || '09:00')}:00`);

router.use(authRequired, requireAdmin);

// ---------------- VIEW RESERVATIONS ----------------
router.get('/reservations', async (req, res, next) => {
  try {
    const { date, intern_id } = req.query;

    let sql = `
      SELECT 
        r.id AS reservation_id,
        r.intern_id,
        TO_CHAR(r.date, 'YYYY-MM-DD') AS date,   -- ✅ clean formatted date
        r.time_slot,
        r.status,
        u.name AS intern_name,
        u.email AS intern_email,
        u.role AS intern_role,
        s.seat_number,
        s.location
      FROM reservations r
      JOIN users u ON u.id = r.intern_id
      JOIN seats s ON s.id = r.seat_id
    `;

    const params = [];
    const where = [];

    if (date) {
      params.push(date);
      where.push(`r.date = $${params.length}`);
    }
    if (intern_id) {
      params.push(intern_id);
      where.push(`r.intern_id = $${params.length}`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');

    sql += ' ORDER BY r.date DESC, r.time_slot ASC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------------- MANUAL ASSIGN ----------------
router.post('/reservations/assign', async (req, res, next) => {
  try {
    const { intern_id, seat_id, date, time_slot } = req.body;
    if (!intern_id || !seat_id || !date || !time_slot) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    if (slotStartDate(date, time_slot) - Date.now() < 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Must assign at least 1 hour in advance' });
    }

    const seat = await pool.query('SELECT status FROM seats WHERE id=$1', [seat_id]);
    if (!seat.rows.length) return res.status(404).json({ error: 'Seat not found' });
    if (seat.rows[0].status !== 'available') {
      return res.status(400).json({ error: 'Seat is not available' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reservations (intern_id, seat_id, date, time_slot) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, intern_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, time_slot, status`,
      [intern_id, seat_id, date, time_slot]
    );

    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Conflicts with existing reservation' });
    }
    next(e);
  }
});

// ---------------- USAGE REPORT ----------------
router.get('/reports/usage', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    // Count all seats (not just available)
    const totalSeatRes = await pool.query("SELECT COUNT(*)::int AS total FROM seats");
    const totalSeats = totalSeatRes.rows[0].total;

    // Generate full date range × slots, left join reservations
    const sql = `
      WITH all_dates AS (
        SELECT generate_series($1::date, $2::date, interval '1 day')::date AS d
      ),
      slots AS (
        SELECT unnest(ARRAY['MORNING','AFTERNOON','EVENING']) AS slot
      )
      SELECT 
        TO_CHAR(ad.d, 'YYYY-MM-DD') AS date,  -- ✅ clean date string
        s.slot AS time_slot,
        COUNT(r.id)::int AS reserved,
        $3::int AS total,
        CASE 
          WHEN COUNT(r.id) = 0 THEN NULL     -- ✅ mark empty as "No reservations"
          ELSE ROUND((COUNT(r.id)::numeric / NULLIF($3,0))*100, 2)
        END AS occupancy_pct
      FROM all_dates ad
      CROSS JOIN slots s
      LEFT JOIN reservations r 
        ON r.date = ad.d AND r.time_slot = s.slot AND r.status = 'active'
      GROUP BY ad.d, s.slot
      ORDER BY ad.d, 
        CASE s.slot WHEN 'MORNING' THEN 1 WHEN 'AFTERNOON' THEN 2 ELSE 3 END;
    `;

    const { rows } = await pool.query(sql, [from, to, totalSeats]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------------- LIST INTERNS (for dropdown) ----------------
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'intern' ORDER BY id"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
