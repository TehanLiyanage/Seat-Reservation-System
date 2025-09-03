import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

import authRoutes from './routes/auth.js';
import seatRoutes from './routes/seats.js';
import reservationRoutes from './routes/reservations.js';
import adminRoutes from './routes/admin.js';
import pool from './db.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cookieParser());

// ✅ Serve static files but prevent Express from auto-serving index.html
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ---------------- API ROUTES ----------------
app.use('/api/auth', authRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);

// ---------------- DEFAULT ROUTE ----------------
// Always load login.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// ---------------- HEALTH CHECK ----------------
app.get('/health', (req, res) => res.json({ ok: true }));

// ---------------- ENSURE ADMIN ----------------
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email) return;

  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (!rows.length) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'admin')",
      [name, email.toLowerCase(), hash]
    );
    console.log(`Admin user created: ${email}`);
  }
}

// ---------------- START SERVER ----------------
ensureAdmin()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
