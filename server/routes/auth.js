import { Router } from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';
import { setAuthCookie, clearAuthCookies, authRequired } from '../middleware/auth.js';

const router = Router();
const allowedDomains = (process.env.OFFICE_EMAIL_DOMAINS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// ---------------- REGISTER (Intern only) ----------------
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const emailLower = email.toLowerCase().trim();
  if (allowedDomains.length) {
    const domain = emailLower.split('@')[1];
    if (!domain || !allowedDomains.includes(domain)) {
      return res.status(400).json({ error: 'Registration restricted to office email domains' });
    }
  }

  const exists = await pool.query('SELECT id FROM users WHERE email=$1', [emailLower]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'intern') RETURNING id,name,email,role",
    [name.trim(), emailLower, hash]
  );

  setAuthCookie(res, rows[0]); // role = intern
  res.json(rows[0]);
});

// ---------------- LOGIN ----------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const emailLower = email.toLowerCase().trim();
  const { rows } = await pool.query(
    'SELECT id,name,email,password_hash,role FROM users WHERE email=$1',
    [emailLower]
  );
  if (!rows.length) return res.status(400).json({ error: 'Invalid credentials' });

  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

  setAuthCookie(res, user);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// ---------------- LOGOUT ----------------
router.post('/logout', (req, res) => {
  clearAuthCookies(res); // ✅ clear both intern and admin cookies
  res.json({ ok: true });
});

// ---------------- GET CURRENT USER ----------------
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

export default router;
