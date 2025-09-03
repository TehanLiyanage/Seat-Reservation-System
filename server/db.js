import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // ✅ required for Render’s managed Postgres
  },
});

pool.on('error', (err) => {
  console.error('Unexpected PG error', err);
  process.exit(-1);
});

export default pool;

export async function query(text, params) {
  return pool.query(text, params);
}
