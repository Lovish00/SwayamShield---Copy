import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { validate, registerSchema, loginSchema } from '../middleware/validate.js';

const router = Router();

let hospitalColumnsCache = null;
let hospitalColumnsCacheAt = 0;
const HOSPITAL_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;
let userColumnsCache = null;
let userColumnsCacheAt = 0;
const USER_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;

async function getHospitalColumns(client) {
  const now = Date.now();
  if (hospitalColumnsCache && (now - hospitalColumnsCacheAt) < HOSPITAL_COLUMNS_CACHE_TTL_MS) {
    return hospitalColumnsCache;
  }

  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hospitals'
    `
  );

  hospitalColumnsCache = new Set(result.rows.map((row) => row.column_name));
  hospitalColumnsCacheAt = now;
  return hospitalColumnsCache;
}

async function getUserColumns(client) {
  const now = Date.now();
  if (userColumnsCache && (now - userColumnsCacheAt) < USER_COLUMNS_CACHE_TTL_MS) {
    return userColumnsCache;
  }

  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
    `
  );

  userColumnsCache = new Set(result.rows.map((row) => row.column_name));
  userColumnsCacheAt = now;
  return userColumnsCache;
}

async function findHospitalByName(client, hospitalName) {
  const normalized = String(hospitalName || '').trim();
  if (!normalized) return null;

  const result = await client.query(
    'SELECT id FROM hospitals WHERE name ILIKE $1 ORDER BY created_at DESC NULLS LAST LIMIT 1',
    [normalized]
  );
  return result.rows[0]?.id || null;
}

async function createHospitalProfile(client, options) {
  const {
    userId = null,
    name,
    address = 'Chandigarh',
    phone = null,
    lat = 30.7333,
    lng = 76.7794,
    totalBeds = 100,
    icuBeds = 15,
  } = options;

  const columns = await getHospitalColumns(client);
  const insertColumns = [];
  const insertValues = [];

  const addValue = (column, value) => {
    if (columns.has(column)) {
      insertColumns.push(column);
      insertValues.push(value);
    }
  };

  addValue('user_id', userId);
  addValue('name', name);
  addValue('address', address);
  addValue('phone', phone);

  const latitude = Number.isFinite(Number(lat)) ? Number(lat) : 30.7333;
  const longitude = Number.isFinite(Number(lng)) ? Number(lng) : 76.7794;

  addValue('lat', latitude);
  addValue('lng', longitude);
  addValue('latitude', latitude);
  addValue('longitude', longitude);

  addValue('beds', totalBeds);
  addValue('total_beds', totalBeds);
  addValue('icu_beds', icuBeds);
  addValue('emergency', true);
  addValue('ambulance', true);

  if (!insertColumns.includes('name')) {
    throw new Error('Hospitals table is missing required "name" column.');
  }

  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
  const query = `
    INSERT INTO hospitals (${insertColumns.join(', ')})
    VALUES (${placeholders})
    RETURNING id
  `;

  const result = await client.query(query, insertValues);
  return result.rows[0]?.id || null;
}

// Register
router.post('/register', validate(registerSchema), async (req, res) => {
  const client = await pool.connect();
  let txStarted = false;

  try {
    const {
      email,
      password,
      full_name,
      role,
      phone,
      age,
      hospital_name,
      specialty,
      address,
      lat,
      lng,
    } = req.body;

    // Check if user exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');
    txStarted = true;

    const password_hash = await bcrypt.hash(password, 10);

    const userColumns = await getUserColumns(client);
    const insertColumns = ['email', 'password_hash', 'full_name', 'role'];
    const insertValues = [email, password_hash, full_name, role];

    if (userColumns.has('phone')) {
      insertColumns.push('phone');
      insertValues.push(phone || null);
    }

    if (userColumns.has('age')) {
      insertColumns.push('age');
      insertValues.push(age || null);
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
    const returnAgeExpr = userColumns.has('age') ? 'age' : 'NULL::int AS age';

    // Create user using available columns in current schema.
    const userResult = await client.query(
      `
        INSERT INTO users (${insertColumns.join(', ')})
        VALUES (${placeholders})
        RETURNING id, email, full_name, role, ${returnAgeExpr}, created_at
      `,
      insertValues
    );

    const user = userResult.rows[0];

    const defaultLat = Number.isFinite(Number(lat)) ? Number(lat) : 30.7333;
    const defaultLng = Number.isFinite(Number(lng)) ? Number(lng) : 76.7794;

    let linkedHospitalId = null;

    // Hospital centre signup creates a hospital profile.
    if (role === 'hospital_centre') {
      linkedHospitalId = await createHospitalProfile(client, {
        userId: user.id,
        name: hospital_name || `${full_name} Hospital Centre`,
        address: address || 'Chandigarh',
        lat: defaultLat,
        lng: defaultLng,
        phone: phone || null,
        totalBeds: 100,
        icuBeds: 15,
      });
    }

    // Legacy "hospital" signup keeps backward compatibility and creates both records.
    if (role === 'hospital') {
      linkedHospitalId = await createHospitalProfile(client, {
        userId: user.id,
        name: hospital_name || full_name,
        address: address || 'Chandigarh',
        lat: defaultLat,
        lng: defaultLng,
        phone: phone || null,
        totalBeds: 120,
        icuBeds: 20,
      });
    }

    // Doctor signup links to an existing hospital (or creates one fallback).
    if (role === 'doctor' || role === 'hospital') {
      if (!linkedHospitalId) {
        linkedHospitalId = await findHospitalByName(client, hospital_name);

        if (!linkedHospitalId) {
          linkedHospitalId = await createHospitalProfile(client, {
            name: hospital_name || `${full_name} Medical Centre`,
            address: address || 'Chandigarh',
            lat: defaultLat,
            lng: defaultLng,
            phone: phone || null,
            totalBeds: 80,
            icuBeds: 10,
          });
        }
      }

      const specResult = specialty
        ? await client.query('SELECT id FROM specialties WHERE name ILIKE $1 LIMIT 1', [specialty])
        : { rows: [] };
      const specId = specResult.rows[0]?.id || null;

      await client.query(
        `INSERT INTO doctors (user_id, hospital_id, specialty_id, full_name, experience, fee)
         VALUES ($1, $2, $3, $4, 0, 500)`,
        [user.id, linkedHospitalId, specId, full_name]
      );

      if (linkedHospitalId && specId) {
        await client.query(
          'INSERT INTO hospital_specialties (hospital_id, specialty_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [linkedHospitalId, specId]
        );
      }
    }

    // Log activity
    await client.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [user.id, `New ${role} registered: ${full_name}`, 'registration']
    );

    await client.query('COMMIT');
    txStarted = false;

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    if (txStarted) {
      await client.query('ROLLBACK');
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, email, password_hash, full_name, role, phone, avatar_url, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [user.id, `User logged in: ${user.full_name}`, 'login']
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  // This route requires auth middleware to be applied externally
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

export default router;
