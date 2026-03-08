import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

function normalizeCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateEtaMinutes(distanceKm) {
  return Math.max(5, Math.round(distanceKm * 3 + 2));
}

async function getNearbyEmergencyProviders(lat, lng, limit = 5) {
  const clampedLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
  const result = await pool.query(
    `
      SELECT h.id, h.name, h.phone,
        (6371 * acos(
          cos(radians($1)) * cos(radians(h.lat)) *
          cos(radians(h.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(h.lat))
        )) AS distance
      FROM hospitals h
      WHERE h.emergency = true
      ORDER BY distance ASC
      LIMIT $3
    `,
    [lat, lng, clampedLimit]
  );

  return result.rows.map((row) => {
    const distanceKm = Number.parseFloat(Number(row.distance).toFixed(1));
    return {
      hospital_id: row.id,
      provider_name: row.name,
      contact_number: row.phone || '112',
      distance_km: distanceKm,
      eta_minutes: estimateEtaMinutes(distanceKm),
    };
  });
}

async function createEmergencyBooking({ patientId = null, hospitalId, lat, lng }) {
  const providerResult = await pool.query(
    `
      SELECT h.id, h.name, h.phone,
        (6371 * acos(
          cos(radians($1)) * cos(radians(h.lat)) *
          cos(radians(h.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(h.lat))
        )) AS distance
      FROM hospitals h
      WHERE h.emergency = true
        AND ($3::uuid IS NULL OR h.id = $3::uuid)
      ORDER BY distance ASC
      LIMIT 1
    `,
    [lat, lng, hospitalId || null]
  );

  const provider = providerResult.rows[0];
  if (!provider) {
    return null;
  }

  const distanceKm = Number.parseFloat(Number(provider.distance).toFixed(1));
  const etaMinutes = estimateEtaMinutes(distanceKm);

  const bookingResult = await pool.query(
    `INSERT INTO emergency_bookings (patient_id, hospital_id, lat, lng, eta_minutes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [patientId, provider.id, lat, lng, etaMinutes]
  );

  if (patientId) {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [patientId, 'Emergency booking created', 'emergency']
    );
  }

  const hospUser = await pool.query('SELECT user_id FROM hospitals WHERE id = $1', [provider.id]);
  if (hospUser.rows[0]?.user_id) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [hospUser.rows[0].user_id, 'Emergency Alert', 'A patient has requested emergency assistance.', 'emergency']
    );
  }

  return {
    message: 'Ambulance booked successfully',
    booking: bookingResult.rows[0],
    ambulance: {
      hospital_id: provider.id,
      provider_name: provider.name,
      contact_number: provider.phone || '112',
      distance_km: distanceKm,
      eta_minutes: etaMinutes,
      status: 'dispatched',
    },
    eta_minutes: etaMinutes,
    distance_km: distanceKm,
    status: 'dispatched',
  };
}

// Public nearby ambulance list for emergency use without authentication.
router.get('/public/ambulances', async (req, res) => {
  try {
    const lat = normalizeCoordinate(req.query.lat, DEFAULT_LAT);
    const lng = normalizeCoordinate(req.query.lng, DEFAULT_LNG);
    const providers = await getNearbyEmergencyProviders(lat, lng, req.query.limit);
    res.json({ providers, coordinates: { lat, lng } });
  } catch (err) {
    console.error('Emergency nearby error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby ambulance services' });
  }
});

// Public ambulance booking for guests on the landing page.
router.post('/public/book', async (req, res) => {
  try {
    const lat = normalizeCoordinate(req.body.lat, DEFAULT_LAT);
    const lng = normalizeCoordinate(req.body.lng, DEFAULT_LNG);
    const booking = await createEmergencyBooking({
      patientId: null,
      hospitalId: req.body.hospital_id || null,
      lat,
      lng,
    });

    if (!booking) {
      return res.status(404).json({ error: 'No emergency hospitals found nearby' });
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('Public emergency booking error:', err);
    res.status(500).json({ error: 'Failed to book emergency' });
  }
});

// Authenticated emergency booking for patient portal.
router.post('/', authenticate, async (req, res) => {
  try {
    const lat = normalizeCoordinate(req.body.lat, DEFAULT_LAT);
    const lng = normalizeCoordinate(req.body.lng, DEFAULT_LNG);
    const booking = await createEmergencyBooking({
      patientId: req.user.id,
      hospitalId: req.body.hospital_id || null,
      lat,
      lng,
    });

    if (!booking) {
      return res.status(404).json({ error: 'No emergency hospitals found nearby' });
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error('Emergency error:', err);
    res.status(500).json({ error: 'Failed to book emergency' });
  }
});

// Get patient's emergency bookings
router.get('/my', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT eb.*, h.name as hospital_name, h.phone as hospital_phone
      FROM emergency_bookings eb
      LEFT JOIN hospitals h ON eb.hospital_id = h.id
      WHERE eb.patient_id = $1
      ORDER BY eb.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emergencies' });
  }
});

export default router;
