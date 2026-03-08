import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

let schemaReadyPromise = null;

function parseCoordinate(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateEta(distanceKm) {
  return Math.max(5, Math.round(distanceKm * 3 + 2));
}

async function ensureHospitalCentreSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER');
    await pool.query('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6)');
    await pool.query('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6)');
    await pool.query('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_beds INTEGER');
    await pool.query('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS icu_beds INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ambulance BOOLEAN DEFAULT TRUE');

    await pool.query(
      `
        UPDATE hospitals
        SET
          latitude = COALESCE(latitude, lat),
          longitude = COALESCE(longitude, lng),
          lat = COALESCE(lat, latitude::double precision),
          lng = COALESCE(lng, longitude::double precision),
          total_beds = COALESCE(total_beds, beds, 0),
          beds = COALESCE(beds, total_beds, 0),
          icu_beds = COALESCE(icu_beds, 0),
          ambulance = COALESCE(ambulance, true),
          emergency = COALESCE(emergency, true)
      `
    );

    // Prescription schema compatibility for hospital centre queue/review workflow.
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medicine VARCHAR(255)');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_date DATE');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT \'pending\'');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_by_hospital_id UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP');
    await pool.query('UPDATE prescriptions SET medicine = COALESCE(medicine, medication)');

    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS ambulance_requests (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
          latitude DECIMAL(9,6) NOT NULL,
          longitude DECIMAL(9,6) NOT NULL,
          symptoms TEXT,
          medical_history TEXT,
          status VARCHAR(20) DEFAULT 'pending'
            CHECK (status IN ('pending', 'assigned', 'dispatched', 'arrived', 'cancelled', 'rejected')),
          assigned_hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
    );

    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS ambulance_request_hospitals (
          request_id UUID REFERENCES ambulance_requests(id) ON DELETE CASCADE,
          hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
          distance_km NUMERIC(8,2) NOT NULL,
          eta_minutes INTEGER NOT NULL,
          decision_status VARCHAR(20) DEFAULT 'pending'
            CHECK (decision_status IN ('pending', 'accepted', 'rejected', 'closed')),
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (request_id, hospital_id)
        )
      `
    );

    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS hospital_blood_inventory (
          hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
          blood_type VARCHAR(5) NOT NULL,
          units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (hospital_id, blood_type)
        )
      `
    );

    await pool.query('CREATE INDEX IF NOT EXISTS idx_ambulance_requests_status ON ambulance_requests(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ambulance_requests_patient ON ambulance_requests(patient_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ambulance_request_hospitals_hospital ON ambulance_request_hospitals(hospital_id)');
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

async function getOrCreateHospitalIdForUser(userId) {
  const existing = await pool.query('SELECT id FROM hospitals WHERE user_id = $1 LIMIT 1', [userId]);
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const userResult = await pool.query('SELECT full_name, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (userResult.rows.length === 0) return null;

  const user = userResult.rows[0];
  const created = await pool.query(
    `
      INSERT INTO hospitals (user_id, name, address, lat, lng, latitude, longitude, phone, beds, total_beds, icu_beds, emergency, ambulance)
      VALUES ($1, $2, $3, 30.7333, 76.7794, 30.7333, 76.7794, $4, 100, 100, 15, true, true)
      RETURNING id
    `,
    [userId, `${user.full_name || 'Hospital'} Centre`, 'Chandigarh', user.phone || null]
  );

  return created.rows[0]?.id || null;
}

async function ensureBloodRowsForHospital(hospitalId) {
  await pool.query(
    `
      INSERT INTO hospital_blood_inventory (hospital_id, blood_type, units_available)
      SELECT $1, blood_type, 0
      FROM unnest($2::text[]) AS blood_type
      ON CONFLICT (hospital_id, blood_type) DO NOTHING
    `,
    [hospitalId, BLOOD_TYPES]
  );
}

async function findNearestHospitals(latitude, longitude, limit = 5, needsIcu = false) {
  const result = await pool.query(
    `
      SELECT h.id, h.name, h.phone, h.address,
        COALESCE(h.latitude::double precision, h.lat) AS latitude,
        COALESCE(h.longitude::double precision, h.lng) AS longitude,
        COALESCE(h.total_beds, h.beds, 0) AS total_beds,
        COALESCE(h.icu_beds, 0) AS icu_beds,
        (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1)) *
              cos(radians(COALESCE(h.latitude::double precision, h.lat))) *
              cos(radians(COALESCE(h.longitude::double precision, h.lng)) - radians($2)) +
              sin(radians($1)) *
              sin(radians(COALESCE(h.latitude::double precision, h.lat)))
            ))
          )
        ) AS distance_km
      FROM hospitals h
      WHERE h.emergency = true
        AND COALESCE(h.ambulance, true) = true
        AND COALESCE(h.latitude::double precision, h.lat) IS NOT NULL
        AND COALESCE(h.longitude::double precision, h.lng) IS NOT NULL
        AND ($4::boolean = false OR COALESCE(h.icu_beds, 0) > 0)
      ORDER BY distance_km ASC
      LIMIT $3
    `,
    [latitude, longitude, limit, needsIcu]
  );

  return result.rows.map((hospital) => {
    const distance = Number.parseFloat(Number(hospital.distance_km).toFixed(2));
    return {
      hospital_id: hospital.id,
      name: hospital.name,
      phone: hospital.phone,
      address: hospital.address,
      distance_km: distance,
      eta_minutes: estimateEta(distance),
      total_beds: Number(hospital.total_beds || 0),
      icu_beds: Number(hospital.icu_beds || 0),
    };
  });
}

router.get('/hospital/overview', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    await ensureBloodRowsForHospital(hospitalId);

    const [hospitalResult, doctorsResult, bloodResult] = await Promise.all([
      pool.query(
        `
          SELECT id, name,
                 COALESCE(ambulance, true) AS ambulance_available,
                 COALESCE(total_beds, beds, 0)::int AS beds_available,
                 COALESCE(icu_beds, 0)::int AS icu_beds_available
          FROM hospitals
          WHERE id = $1
          LIMIT 1
        `,
        [hospitalId]
      ),
      pool.query(
        `
          SELECT d.id, d.full_name, d.experience, d.available, d.fee,
                 COALESCE(s.name, 'General') AS specialization
          FROM doctors d
          LEFT JOIN specialties s ON s.id = d.specialty_id
          WHERE d.hospital_id = $1
          ORDER BY d.full_name ASC
        `,
        [hospitalId]
      ),
      pool.query(
        `
          SELECT blood_type, units_available
          FROM hospital_blood_inventory
          WHERE hospital_id = $1
          ORDER BY blood_type
        `,
        [hospitalId]
      ),
    ]);

    const hospital = hospitalResult.rows[0] || null;
    const doctors = doctorsResult.rows || [];
    const blood_inventory = bloodResult.rows || [];
    const blood_units_total = blood_inventory.reduce((sum, item) => sum + Number(item.units_available || 0), 0);

    res.json({
      hospital,
      inventory: {
        ambulance: hospital?.ambulance_available ? 1 : 0,
        beds: hospital?.beds_available || 0,
        icu_beds: hospital?.icu_beds_available || 0,
        doctors: doctors.length,
        blood_units_total,
      },
      blood_inventory,
      doctors,
    });
  } catch (err) {
    console.error('Hospital overview error:', err);
    res.status(500).json({ error: 'Failed to fetch hospital overview.' });
  }
});

router.patch('/hospital/blood', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const { blood_type, units_available } = req.body || {};
    if (!BLOOD_TYPES.includes(blood_type)) {
      return res.status(400).json({ error: `Invalid blood type. Use one of: ${BLOOD_TYPES.join(', ')}` });
    }
    const units = Number.parseInt(units_available, 10);
    if (!Number.isFinite(units) || units < 0) {
      return res.status(400).json({ error: 'units_available must be a non-negative integer.' });
    }

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    await ensureBloodRowsForHospital(hospitalId);
    const result = await pool.query(
      `
        UPDATE hospital_blood_inventory
        SET units_available = $1, updated_at = NOW()
        WHERE hospital_id = $2 AND blood_type = $3
        RETURNING *
      `,
      [units, hospitalId, blood_type]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update blood inventory.' });
  }
});

// Patient creates ambulance request with real-time coordinates.
router.post('/request', async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHospitalCentreSchema();

    const latitude = parseCoordinate(req.body.latitude);
    const longitude = parseCoordinate(req.body.longitude);
    const needsIcu = Boolean(req.body.needs_icu);
    const preview = Boolean(req.body.preview);
    const preferredHospitalId = req.body.preferred_hospital_id || null;

    if (latitude === null || longitude === null) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    const patientId = req.user.role === 'patient' ? req.user.id : (req.body.patient_id || req.user.id);
    const nearestHospitalsRaw = await findNearestHospitals(latitude, longitude, 5, needsIcu);
    const nearestHospitals = preferredHospitalId
      ? [...nearestHospitalsRaw].sort((a, b) => {
          if (a.hospital_id === preferredHospitalId) return -1;
          if (b.hospital_id === preferredHospitalId) return 1;
          return a.distance_km - b.distance_km;
        })
      : nearestHospitalsRaw;

    if (nearestHospitals.length === 0) {
      return res.status(404).json({ error: 'No nearby hospitals available for ambulance dispatch.' });
    }

    if (preview) {
      return res.json({
        hospitals: nearestHospitals,
        message: 'Nearest hospitals fetched successfully.',
      });
    }

    await client.query('BEGIN');

    const requestResult = await client.query(
      `INSERT INTO ambulance_requests (patient_id, latitude, longitude, symptoms, medical_history, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [patientId, latitude, longitude, req.body.symptoms || null, req.body.medical_history || null]
    );

    for (const hospital of nearestHospitals) {
      await client.query(
        `
          INSERT INTO ambulance_request_hospitals (request_id, hospital_id, distance_km, eta_minutes, decision_status)
          VALUES ($1, $2, $3, $4, 'pending')
        `,
        [requestResult.rows[0].id, hospital.hospital_id, hospital.distance_km, hospital.eta_minutes]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      request: requestResult.rows[0],
      hospitals: nearestHospitals,
      message: 'Ambulance request created successfully.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ambulance request error:', err);
    res.status(500).json({ error: 'Failed to create ambulance request.' });
  } finally {
    client.release();
  }
});

router.get('/request/:id/options', async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const result = await pool.query(
      `
        SELECT arh.request_id, arh.hospital_id, arh.distance_km, arh.eta_minutes, arh.decision_status,
               h.name, h.phone, h.address
        FROM ambulance_request_hospitals arh
        JOIN hospitals h ON h.id = arh.hospital_id
        WHERE arh.request_id = $1
        ORDER BY arh.distance_km ASC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ambulance request options.' });
  }
});

router.get('/request/my', async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const result = await pool.query(
      `SELECT * FROM ambulance_requests WHERE patient_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ambulance requests.' });
  }
});

// Hospital Centre queue: pending requests visible to this centre.
router.get('/queue', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    const queue = await pool.query(
      `
        SELECT
          ar.id AS request_id,
          ar.status,
          ar.created_at,
          ar.symptoms,
          ar.medical_history,
          arh.distance_km,
          arh.eta_minutes,
          p.id AS patient_id,
          p.full_name AS patient_name,
          p.age AS patient_age,
          p.phone AS patient_phone,
          COALESCE(rx.current_prescriptions, '[]'::json) AS current_prescriptions,
          COALESCE(doc.doctor_data, '[]'::json) AS doctor_data
        FROM ambulance_request_hospitals arh
        JOIN ambulance_requests ar ON ar.id = arh.request_id
        LEFT JOIN users p ON p.id = ar.patient_id
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object(
            'medicine', COALESCE(p2.medicine, p2.medication),
            'dosage', p2.dosage,
            'notes', p2.notes,
            'date', COALESCE(p2.prescription_date, p2.start_date)
          ) ORDER BY COALESCE(p2.prescription_date, p2.start_date) DESC) AS current_prescriptions
          FROM prescriptions p2
          WHERE p2.patient_id = ar.patient_id
            AND p2.active = true
        ) rx ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object(
            'doctor_name', latest.full_name,
            'specialization', latest.specialization,
            'appointment_date', latest.appointment_date,
            'appointment_time', latest.appointment_time
          )) AS doctor_data
          FROM (
            SELECT d.full_name,
                   s.name AS specialization,
                   a.date AS appointment_date,
                   a.time AS appointment_time
            FROM appointments a
            LEFT JOIN doctors d ON d.id = a.doctor_id
            LEFT JOIN specialties s ON s.id = d.specialty_id
            WHERE a.patient_id = ar.patient_id
            ORDER BY a.date DESC, a.time DESC
            LIMIT 10
          ) latest
        ) doc ON true
        WHERE arh.hospital_id = $1
          AND arh.decision_status = 'pending'
          AND ar.status = 'pending'
        ORDER BY ar.created_at DESC
      `,
      [hospitalId]
    );

    res.json(queue.rows);
  } catch (err) {
    console.error('Hospital queue error:', err);
    res.status(500).json({ error: 'Failed to fetch hospital request queue.' });
  }
});

// Patients heading to the hospital centre.
router.get('/incoming-patients', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    const incoming = await pool.query(
      `
        SELECT ar.id AS request_id,
               ar.status,
               ar.created_at,
               ar.symptoms,
               ar.medical_history,
               p.id AS patient_id,
               p.full_name AS patient_name,
               p.age AS patient_age,
               p.phone AS patient_phone
        FROM ambulance_requests ar
        LEFT JOIN users p ON p.id = ar.patient_id
        WHERE ar.assigned_hospital_id = $1
          AND ar.status IN ('assigned', 'dispatched', 'arrived')
        ORDER BY ar.created_at DESC
      `,
      [hospitalId]
    );

    res.json(incoming.rows);
  } catch (err) {
    console.error('Incoming patients error:', err);
    res.status(500).json({ error: 'Failed to fetch incoming patients.' });
  }
});

router.patch('/request/:id/accept', authorize('hospital_centre', 'hospital'), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    await client.query('BEGIN');

    const requestCheck = await client.query(
      `
        SELECT ar.id, ar.status
        FROM ambulance_requests ar
        JOIN ambulance_request_hospitals arh
          ON arh.request_id = ar.id
         AND arh.hospital_id = $2
        WHERE ar.id = $1
        FOR UPDATE
      `,
      [req.params.id, hospitalId]
    );

    if (requestCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ambulance request not found for this hospital.' });
    }

    if (requestCheck.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This ambulance request has already been assigned.' });
    }

    const assigned = await client.query(
      `
        UPDATE ambulance_requests
        SET status = 'assigned', assigned_hospital_id = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `,
      [req.params.id, hospitalId]
    );

    if (assigned.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This ambulance request was accepted by another hospital.' });
    }

    await client.query(
      `
        UPDATE ambulance_request_hospitals
        SET decision_status = 'accepted'
        WHERE request_id = $1 AND hospital_id = $2
      `,
      [req.params.id, hospitalId]
    );

    await client.query(
      `
        UPDATE ambulance_request_hospitals
        SET decision_status = 'closed'
        WHERE request_id = $1
          AND hospital_id != $2
          AND decision_status = 'pending'
      `,
      [req.params.id, hospitalId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Request accepted and assigned to hospital.', request: assigned.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Accept ambulance request error:', err);
    res.status(500).json({ error: 'Failed to accept ambulance request.' });
  } finally {
    client.release();
  }
});

router.patch('/request/:id/reject', authorize('hospital_centre', 'hospital'), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    await client.query('BEGIN');

    const rejected = await client.query(
      `
        UPDATE ambulance_request_hospitals
        SET decision_status = 'rejected'
        WHERE request_id = $1
          AND hospital_id = $2
          AND decision_status = 'pending'
        RETURNING *
      `,
      [req.params.id, hospitalId]
    );

    if (rejected.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending request not found for this hospital.' });
    }

    const pendingCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM ambulance_request_hospitals WHERE request_id = $1 AND decision_status = 'pending'`,
      [req.params.id]
    );

    if (pendingCount.rows[0].count === 0) {
      await client.query(
        `
          UPDATE ambulance_requests
          SET status = 'rejected', updated_at = NOW()
          WHERE id = $1 AND status = 'pending'
        `,
        [req.params.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Ambulance request rejected for this hospital.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject ambulance request error:', err);
    res.status(500).json({ error: 'Failed to reject ambulance request.' });
  } finally {
    client.release();
  }
});

router.patch('/request/:id/dispatch', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensureHospitalCentreSchema();

    const hospitalId = await getOrCreateHospitalIdForUser(req.user.id);
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found.' });
    }

    const result = await pool.query(
      `
        UPDATE ambulance_requests
        SET status = 'dispatched', updated_at = NOW()
        WHERE id = $1
          AND assigned_hospital_id = $2
          AND status IN ('assigned', 'dispatched')
        RETURNING *
      `,
      [req.params.id, hospitalId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assigned ambulance request not found.' });
    }

    res.json({ message: 'Ambulance marked as dispatched.', request: result.rows[0] });
  } catch (err) {
    console.error('Dispatch ambulance error:', err);
    res.status(500).json({ error: 'Failed to dispatch ambulance.' });
  }
});

export default router;
