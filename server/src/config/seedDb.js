import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './env.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swayamshield',
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'seed_hospitals.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Hospitals, specialties, and doctors seeded!');

    // Verify
    const hospitals = await pool.query('SELECT COUNT(*) FROM hospitals');
    const doctors = await pool.query('SELECT COUNT(*) FROM doctors');
    console.log(`  Hospitals: ${hospitals.rows[0].count}`);
    console.log(`  Doctors: ${doctors.rows[0].count}`);
  } catch (err) {
    console.error('Seed error:', err.message);
  }
  await pool.end();
}

seed();
