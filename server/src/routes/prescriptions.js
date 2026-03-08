import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, prescriptionSchema } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

let prescriptionSchemaReadyPromise = null;

async function ensurePrescriptionSchema() {
  if (prescriptionSchemaReadyPromise) return prescriptionSchemaReadyPromise;

  prescriptionSchemaReadyPromise = (async () => {
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medicine VARCHAR(255)');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_date DATE');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT \'pending\'');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS review_notes TEXT');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_by_hospital_id UUID REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP');
    await pool.query('UPDATE prescriptions SET medicine = COALESCE(medicine, medication)');
  })().catch((error) => {
    prescriptionSchemaReadyPromise = null;
    throw error;
  });

  return prescriptionSchemaReadyPromise;
}

// Get patient's prescriptions
router.get('/', async (req, res) => {
  try {
    await ensurePrescriptionSchema();

    const patientId = req.query.patient_id || req.user.id;
    const result = await pool.query(`
      SELECT p.*, d.full_name as doctor_name, h.name as hospital_name
      FROM prescriptions p
      LEFT JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN hospitals h ON p.hospital_id = h.id
      WHERE p.patient_id = $1
      ORDER BY p.active DESC, COALESCE(p.prescription_date, p.start_date) DESC
    `, [patientId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// Add prescription (doctor/hospital only)
router.post('/', authorize('doctor', 'hospital'), validate(prescriptionSchema), async (req, res) => {
  try {
    await ensurePrescriptionSchema();

    const { patient_id, medication, dosage, frequency, start_date, end_date, notes } = req.body;
    
    // Find doctor record for current user
    const doctorResult = await pool.query('SELECT id, hospital_id FROM doctors WHERE user_id = $1', [req.user.id]);
    const doctor_id = doctorResult.rows[0]?.id || null;
    const hospital_id = doctorResult.rows[0]?.hospital_id || null;

    const result = await pool.query(
      `INSERT INTO prescriptions (
         patient_id, doctor_id, hospital_id, medication, medicine, dosage, frequency,
         start_date, prescription_date, end_date, notes, review_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING *`,
      [
        patient_id,
        doctor_id,
        hospital_id,
        medication,
        medication,
        dosage || null,
        frequency || null,
        start_date,
        start_date,
        end_date || null,
        notes || null,
      ]
    );

    // Notify patient
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [patient_id, 'New Prescription', `You have been prescribed ${medication} — ${dosage}`, 'info']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add prescription' });
  }
});

// Hospital centre receives prescriptions for verification/update.
router.get('/hospital/queue', authorize('hospital_centre', 'hospital'), async (req, res) => {
  try {
    await ensurePrescriptionSchema();

    const hospital = await pool.query('SELECT id FROM hospitals WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const hospitalId = hospital.rows[0]?.id;
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found' });
    }

    const result = await pool.query(
      `
        SELECT p.*, u.full_name AS patient_name, d.full_name AS doctor_name, s.name AS specialization
        FROM prescriptions p
        LEFT JOIN users u ON u.id = p.patient_id
        LEFT JOIN doctors d ON d.id = p.doctor_id
        LEFT JOIN specialties s ON s.id = d.specialty_id
        WHERE p.hospital_id = $1
        ORDER BY p.review_status ASC, p.created_at DESC
      `,
      [hospitalId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hospital prescription queue' });
  }
});

// Hospital centre verifies/updates prescription and attaches it to patient records.
router.patch('/:id/hospital-review', authorize('hospital_centre', 'hospital'), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensurePrescriptionSchema();

    const hospital = await client.query('SELECT id FROM hospitals WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const hospitalId = hospital.rows[0]?.id;
    if (!hospitalId) {
      return res.status(404).json({ error: 'Hospital centre profile not found' });
    }

    const { medicine, dosage, notes, review_status } = req.body;
    const normalizedStatus = ['verified', 'updated'].includes(review_status) ? review_status : 'verified';

    await client.query('BEGIN');

    const updated = await client.query(
      `
        UPDATE prescriptions
        SET medicine = COALESCE($1, medicine, medication),
            medication = COALESCE($1, medication),
            dosage = COALESCE($2, dosage),
            notes = COALESCE($3, notes),
            hospital_id = $4,
            review_status = $5,
            review_notes = $3,
            verified_by_hospital_id = $6,
            reviewed_at = NOW(),
            prescription_date = COALESCE(prescription_date, start_date)
        WHERE id = $7
        RETURNING *
      `,
      [medicine || null, dosage || null, notes || null, hospitalId, normalizedStatus, req.user.id, req.params.id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = updated.rows[0];

    // Attach the reviewed prescription into patient health records timeline.
    await client.query(
      `
        INSERT INTO health_records (patient_id, type, title, doctor_name, date, notes)
        VALUES ($1, 'prescription', $2, $3, $4, $5)
      `,
      [
        prescription.patient_id,
        medicine || prescription.medicine || prescription.medication,
        'Hospital Centre Review',
        new Date().toISOString().slice(0, 10),
        notes || 'Prescription reviewed by hospital centre.',
      ]
    );

    await client.query('COMMIT');
    res.json(prescription);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to review prescription' });
  } finally {
    client.release();
  }
});

// Toggle prescription active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE prescriptions SET active = NOT active WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prescription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update prescription' });
  }
});

export default router;
