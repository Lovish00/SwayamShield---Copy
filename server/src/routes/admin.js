import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// Platform stats
router.get('/stats', async (req, res) => {
  try {
    const [patients, doctors, hospitals, appointments, emergencies] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'patient'"),
      pool.query("SELECT COUNT(*) FROM doctors"),
      pool.query("SELECT COUNT(*) FROM hospitals"),
      pool.query("SELECT COUNT(*) FROM appointments WHERE status != 'cancelled'"),
      pool.query("SELECT COUNT(*) FROM emergency_bookings"),
    ]);

    // Weekly appointments (last 7 days)
    const weekly = await pool.query(`
      SELECT date, COUNT(*) as count
      FROM appointments
      WHERE date >= CURRENT_DATE - INTERVAL '6 days' AND date <= CURRENT_DATE
      GROUP BY date
      ORDER BY date ASC
    `);

    // Monthly growth
    const thisMonth = await pool.query("SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)");
    const lastMonth = await pool.query("SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)");
    const lastCount = parseInt(lastMonth.rows[0].count) || 1;
    const growth = (((parseInt(thisMonth.rows[0].count) - lastCount) / lastCount) * 100).toFixed(1);

    // Status distribution
    const statusDist = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM appointments
      GROUP BY status
    `);

    // Specialty distribution
    const specDist = await pool.query(`
      SELECT s.name, COUNT(d.id) as doctor_count
      FROM specialties s
      LEFT JOIN doctors d ON d.specialty_id = s.id
      GROUP BY s.name
      ORDER BY doctor_count DESC
    `);

    res.json({
      totalPatients: parseInt(patients.rows[0].count),
      totalDoctors: parseInt(doctors.rows[0].count),
      totalHospitals: parseInt(hospitals.rows[0].count),
      totalAppointments: parseInt(appointments.rows[0].count),
      totalEmergencies: parseInt(emergencies.rows[0].count),
      monthlyGrowth: parseFloat(growth),
      weeklyAppointments: weekly.rows,
      statusDistribution: statusDist.rows,
      specialtyDistribution: specDist.rows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Activity logs
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50, type, offset = 0 } = req.query;
    let query = `
      SELECT al.*, u.full_name as user_name, u.role as user_role
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params = [];

    if (type && type !== 'all') {
      params.push(type);
      query += ` WHERE al.type = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    const total = await pool.query('SELECT COUNT(*) FROM activity_logs');
    res.json({ logs: result.rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    console.error('Activity logs error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// All users (no personal data: no password, no phone)
router.get('/users', async (req, res) => {
  try {
    const { role, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT id, email, full_name, role, created_at FROM users';
    const params = [];

    if (role && role !== 'all') {
      params.push(role);
      query += ` WHERE role = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
