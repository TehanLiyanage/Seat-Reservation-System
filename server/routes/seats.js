import { Router } from 'express';
import pool from '../db.js';
import { authRequired, requireAdmin } from '../middleware/auth.js';


const router = Router();


// Get seats; if date + time_slot provided, also include availability
router.get('/', authRequired, async (req, res) => {
const { date, time_slot } = req.query;
if (date && time_slot) {
const sql = `
SELECT s.*,
NOT EXISTS (
SELECT 1 FROM reservations r
WHERE r.seat_id = s.id AND r.date = $1 AND r.time_slot = $2 AND r.status='active'
) AS is_available
FROM seats s
WHERE s.status='available'
ORDER BY s.seat_number;`;
const { rows } = await pool.query(sql, [date, time_slot]);
return res.json(rows);
}
const { rows } = await pool.query('SELECT * FROM seats ORDER BY seat_number');
res.json(rows);
});


router.post('/', authRequired, requireAdmin, async (req, res) => {
const { seat_number, location, status = 'available', branch = 'HQ' } = req.body;
if (!seat_number) return res.status(400).json({ error: 'seat_number required' });
try {
const { rows } = await pool.query(
'INSERT INTO seats(seat_number,location,status,branch) VALUES ($1,$2,$3,$4) RETURNING *',
[seat_number, location || null, status, branch]
);
res.json(rows[0]);
} catch (e) {
if (e.code === '23505') return res.status(409).json({ error: 'Seat number must be unique' });
throw e;
}
});


router.put('/:id', authRequired, requireAdmin, async (req, res) => {
const { id } = req.params;
const { seat_number, location, status, branch } = req.body;
const { rows } = await pool.query(
'UPDATE seats SET seat_number=COALESCE($1,seat_number), location=COALESCE($2,location), status=COALESCE($3,status), branch=COALESCE($4,branch) WHERE id=$5 RETURNING *',
[seat_number, location, status, branch, id]
);
if (!rows.length) return res.status(404).json({ error: 'Not found' });
res.json(rows[0]);
});


router.delete('/:id', authRequired, requireAdmin, async (req, res) => {
const { id } = req.params;
await pool.query('DELETE FROM seats WHERE id=$1', [id]);
res.json({ ok: true });
});


export default router;