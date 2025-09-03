import dotenv from 'dotenv';
import pool from './db.js';


dotenv.config();
const months = parseInt(process.env.RETENTION_MONTHS || '6', 10);


(async () => {
const sql = `DELETE FROM reservations WHERE date < (CURRENT_DATE - INTERVAL '${months} months')`;
const res = await pool.query(sql);
console.log(`Deleted ${res.rowCount} old reservations`);
process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });