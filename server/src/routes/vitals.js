import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate, vitalSchema } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

// Get vitals history
router.get('/', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const result = await pool.query(
      'SELECT * FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT $2',
      [req.user.id, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
});

// Log new vital
router.post('/', validate(vitalSchema), async (req, res) => {
  try {
    const { bp_systolic, bp_diastolic, heart_rate, blood_sugar, weight, temperature, spo2, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO vitals (patient_id, bp_systolic, bp_diastolic, heart_rate, blood_sugar, weight, temperature, spo2, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, bp_systolic, bp_diastolic, heart_rate, blood_sugar, weight, temperature, spo2, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to log vitals' });
  }
});

// Get vitals summary (latest + averages)
router.get('/summary', async (req, res) => {
  try {
    const latest = await pool.query(
      'SELECT * FROM vitals WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [req.user.id]
    );
    const avg = await pool.query(`
      SELECT
        ROUND(AVG(bp_systolic)) as avg_bp_systolic,
        ROUND(AVG(bp_diastolic)) as avg_bp_diastolic,
        ROUND(AVG(heart_rate)) as avg_heart_rate,
        ROUND(AVG(blood_sugar)::numeric, 1) as avg_blood_sugar,
        ROUND(AVG(weight)::numeric, 1) as avg_weight
      FROM vitals
      WHERE patient_id = $1 AND recorded_at > NOW() - INTERVAL '30 days'
    `, [req.user.id]);

    res.json({ latest: latest.rows[0] || null, averages: avg.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vitals summary' });
  }
});

export default router;
