import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, healthRecordSchema } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

// Get patient's health records
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM health_records WHERE patient_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

// Add health record
router.post('/', validate(healthRecordSchema), async (req, res) => {
  try {
    const { type, title, doctor_name, date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO health_records (patient_id, type, title, doctor_name, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, type, title, doctor_name || null, date, notes || null]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [req.user.id, 'Health record added', 'record']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add health record' });
  }
});

// Hospital centre / hospital can upload record for any patient.
router.post('/hospital/upload', authorize('hospital_centre', 'hospital', 'doctor'), async (req, res) => {
  try {
    const { patient_id, type, title, date, notes, doctor_name } = req.body || {};

    if (!patient_id || !type || !title) {
      return res.status(400).json({ error: 'patient_id, type and title are required.' });
    }

    const allowedTypes = ['visit', 'lab', 'prescription', 'imaging', 'vaccination'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Use one of: ${allowedTypes.join(', ')}` });
    }

    const patientCheck = await pool.query(
      'SELECT id, full_name FROM users WHERE id = $1 AND role = $2 LIMIT 1',
      [patient_id, 'patient']
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const recordDate = date || new Date().toISOString().slice(0, 10);
    const record = await pool.query(
      `
        INSERT INTO health_records (patient_id, type, title, doctor_name, date, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        patient_id,
        type,
        title,
        doctor_name || req.user.name || req.user.email || 'Hospital Centre',
        recordDate,
        notes || null,
      ]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [req.user.id, `Uploaded patient record for ${patientCheck.rows[0].full_name}`, 'record']
    );

    res.status(201).json(record.rows[0]);
  } catch (err) {
    console.error('Hospital upload patient record error:', err);
    res.status(500).json({ error: 'Failed to upload patient record' });
  }
});

// Delete health record
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM health_records WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default router;
