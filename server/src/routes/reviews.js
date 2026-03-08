import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate, reviewSchema } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

// Submit review
router.post('/', validate(reviewSchema), async (req, res) => {
  try {
    const { doctor_id, rating, comment } = req.body;
    const result = await pool.query(
      `INSERT INTO reviews (patient_id, doctor_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, doctor_id, rating, comment || null]
    );

    // Update doctor average rating
    const avg = await pool.query(
      'SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating FROM reviews WHERE doctor_id = $1',
      [doctor_id]
    );
    await pool.query(
      'UPDATE doctors SET rating = $1 WHERE id = $2',
      [avg.rows[0].avg_rating, doctor_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Get reviews for a doctor
router.get('/doctor/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.full_name as patient_name
      FROM reviews r
      JOIN users u ON r.patient_id = u.id
      WHERE r.doctor_id = $1
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
