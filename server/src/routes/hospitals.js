import { Router } from 'express';
import pool from '../config/db.js';
import { getNearbyHospitals } from '../services/hospitalDistance.js';

const router = Router();
const DOCTOR_DAILY_APPOINTMENT_LIMIT = parseInt(process.env.DOCTOR_DAILY_APPOINTMENT_LIMIT || '20', 10);
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

router.post('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, limit = 5, icu_only = false, radius_km = null } = req.body || {};
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    // Reusable helper applies Haversine distance and returns nearest hospitals sorted by distance.
    const hospitals = await getNearbyHospitals(latitude, longitude, {
      limit,
      icuOnly: parseBoolean(icu_only),
      radiusKm: radius_km,
      emergencyOnly: true,
      ambulanceOnly: true,
    });

    res.json(hospitals);
  } catch (err) {
    console.error('Nearby hospitals error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby hospitals' });
  }
});

// Get hospitals (with optional nearby filter using haversine)
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius, specialty, emergency_only, icu_only } = req.query;

    let query = `
      SELECT h.*,
        COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '[]') as specialties,
        COUNT(DISTINCT d.id) as doctor_count
      FROM hospitals h
      LEFT JOIN hospital_specialties hs ON h.id = hs.hospital_id
      LEFT JOIN specialties s ON hs.specialty_id = s.id
      LEFT JOIN doctors d ON d.hospital_id = h.id
    `;
    const conditions = [];
    const params = [];

    if (emergency_only === 'true') {
      conditions.push('h.emergency = true');
    }

    if (icu_only === 'true') {
      conditions.push('COALESCE(h.icu_beds, 0) > 0');
    }

    if (specialty) {
      params.push(specialty);
      conditions.push(`s.name ILIKE $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY h.id';

    // Haversine distance sorting
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      params.push(latNum, lngNum);
      query += ` ORDER BY (
        6371 * acos(
          cos(radians($${params.length - 1})) *
          cos(radians(COALESCE(h.latitude::double precision, h.lat))) *
          cos(radians(COALESCE(h.longitude::double precision, h.lng)) - radians($${params.length})) +
          sin(radians($${params.length - 1})) *
          sin(radians(COALESCE(h.latitude::double precision, h.lat)))
        )
      ) ASC`;
    } else {
      query += ' ORDER BY h.rating DESC';
    }

    const result = await pool.query(query, params);

    // Add distance if coordinates provided
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      result.rows.forEach(h => {
        const hospitalLat = Number(h.latitude ?? h.lat);
        const hospitalLng = Number(h.longitude ?? h.lng);
        const dLat = ((hospitalLat - latNum) * Math.PI) / 180;
        const dLng = ((hospitalLng - lngNum) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos((latNum * Math.PI) / 180) * Math.cos((hospitalLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
        h.distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      });
    }

    const distanceRadius = radius ? parseFloat(radius) : null;
    const filtered = distanceRadius && lat && lng
      ? result.rows.filter((h) => h.distance <= distanceRadius)
      : result.rows;

    res.json(filtered);
  } catch (err) {
    console.error('Hospitals error:', err);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
});

// Get doctors (with optional specialty filter)
router.get('/doctors', async (req, res) => {
  try {
    const { specialty, available, date } = req.query;
    if (date && !DATE_ONLY_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const hasDateFilter = Boolean(date);
    const params = [];

    if (hasDateFilter) {
      params.push(date);
    }
    params.push(DOCTOR_DAILY_APPOINTMENT_LIMIT);
    const dailyLimitParam = params.length;

    const dateMetricsSelect = hasDateFilter
      ? `
        COALESCE(booked.daily_count, 0)::int AS appointment_count,
        $${dailyLimitParam}::int AS daily_limit,
        (d.available = true AND COALESCE(booked.daily_count, 0) < $${dailyLimitParam}) AS is_available_for_date
      `
      : `
        0::int AS appointment_count,
        $${dailyLimitParam}::int AS daily_limit,
        d.available AS is_available_for_date
      `;

    const dateJoin = hasDateFilter
      ? `
        LEFT JOIN (
          SELECT doctor_id, COUNT(*)::int AS daily_count
          FROM appointments
          WHERE date = $1 AND status != 'cancelled'
          GROUP BY doctor_id
        ) booked ON booked.doctor_id = d.id
      `
      : '';

    let query = `
      SELECT d.*, s.name as specialty_name, s.icon as specialty_icon,
             h.name as hospital_name, h.address as hospital_address,
             ${dateMetricsSelect}
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN hospitals h ON d.hospital_id = h.id
      ${dateJoin}
      WHERE 1=1
    `;

    if (specialty) {
      params.push(specialty);
      query += ` AND s.name ILIKE $${params.length}`;
    }

    if (available === 'true') {
      query += hasDateFilter
        ? ` AND d.available = true AND COALESCE(booked.daily_count, 0) < $${dailyLimitParam}`
        : ' AND d.available = true';
    }

    query += ' ORDER BY d.rating DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Doctors error:', err);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Get specialties
router.get('/specialties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM specialties ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// Get single doctor with reviews
router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await pool.query(`
      SELECT d.*, s.name as specialty_name, h.name as hospital_name,
             h.address as hospital_address
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN hospitals h ON d.hospital_id = h.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (doctor.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });

    const reviews = await pool.query(`
      SELECT r.*, u.full_name as patient_name
      FROM reviews r
      JOIN users u ON r.patient_id = u.id
      WHERE r.doctor_id = $1
      ORDER BY r.created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({ ...doctor.rows[0], reviews: reviews.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

export default router;
