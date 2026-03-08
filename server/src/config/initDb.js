import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './env.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDb() {
  // First connect to default 'postgres' database to create our database
  const adminPool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres', // connect to default DB first
  });

  try {
    // Check if swayamshield database exists
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1", [process.env.DB_NAME || 'swayamshield']
    );

    if (dbCheck.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME || 'swayamshield'}`);
      console.log('✅ Database "swayamshield" created!');
    } else {
      console.log('ℹ️  Database "swayamshield" already exists');
    }
  } catch (err) {
    console.error('❌ Could not create database:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }

  // Now connect to our database and run schema
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swayamshield',
  });

  try {
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);
    console.log('✅ Schema applied successfully!');

    // Create admin with proper bcrypt hash
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('admin123', 10);

    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = 'admin@swayamshield.com'`,
      [hash]
    );
    console.log('✅ Admin account ready (admin@swayamshield.com / admin123)');
    console.log('\n🎉 All done! Run "npm run dev" to start the server.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Schema init failed:', err.message);
    process.exit(1);
  }
}

initDb();
