import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { validate, appointmentSchema } from '../middleware/validate.js';
import { validateAppointmentBooking } from '../middleware/appointmentValidator.js';

const router = Router();
router.use(authenticate);

let usersColumnsCache = null;
let usersColumnsCacheAt = 0;
const USERS_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;

async function getDoctorIdForUser(userId) {
  const result = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

async function getHospitalIdForUser(userId) {
  const result = await pool.query('SELECT id FROM hospitals WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

async function hasUsersAgeColumn() {
  const now = Date.now();
  if (usersColumnsCache && (now - usersColumnsCacheAt) < USERS_COLUMNS_CACHE_TTL_MS) {
    return usersColumnsCache.has('age');
  }

  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
    `
  );

  usersColumnsCache = new Set(result.rows.map((row) => row.column_name));
  usersColumnsCacheAt = now;
  return usersColumnsCache.has('age');
}

// Book appointment (patient)
router.post('/', validate(appointmentSchema), validateAppointmentBooking, async (req, res) => {
  try {
    const { doctor_id, hospital_id, date, time, type, notes, telemedicine_link } = req.body;
    const patient_id = req.user.id;
    const appointmentType = type || 'consultation';

    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, hospital_id, date, time, type, notes, telemedicine_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [patient_id, doctor_id, hospital_id, date, time, appointmentType, notes || null, telemedicine_link || null]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [patient_id, 'Appointment booked', 'appointment']
    );

    const doctorUser = await pool.query('SELECT user_id FROM doctors WHERE id = $1', [doctor_id]);
    if (doctorUser.rows[0]?.user_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
        [doctorUser.rows[0].user_id, 'New Appointment', `A new ${appointmentType} appointment has been booked for ${date} at ${time}`, 'appointment']
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Book appointment error:', err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Doctor dashboard metrics
router.get('/doctor/summary', async (req, res) => {
  try {
    const doctorId = await getDoctorIdForUser(req.user.id);
    if (!doctorId) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const summary = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE date = CURRENT_DATE
              AND status != 'cancelled'
          )::int AS todays_appointments,
          COUNT(*) FILTER (
            WHERE date = CURRENT_DATE
              AND status = 'completed'
          )::int AS completed_today,
          COUNT(*) FILTER (
            WHERE date = CURRENT_DATE
              AND status = 'cancelled'
          )::int AS cancelled_today,
          COUNT(*) FILTER (
            WHERE date >= DATE_TRUNC('week', CURRENT_DATE)::date
              AND date < (DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '7 day')
              AND status != 'cancelled'
          )::int AS this_week_appointments
        FROM appointments
        WHERE doctor_id = $1
      `,
      [doctorId]
    );

    res.json(summary.rows[0]);
  } catch (err) {
    console.error('Doctor summary error:', err);
    res.status(500).json({ error: 'Failed to fetch doctor summary' });
  }
});

// Get patient's appointments
router.get('/my', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT a.*, d.full_name as doctor_name, s.name as specialty_name,
               h.name as hospital_name, d.avatar_url as doctor_avatar
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN specialties s ON d.specialty_id = s.id
        LEFT JOIN hospitals h ON a.hospital_id = h.id
        WHERE a.patient_id = $1
        ORDER BY a.date DESC, a.time ASC
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get today's appointments (for doctor/hospital)
router.get('/today', async (req, res) => {
  try {
    const includePatientAge = await hasUsersAgeColumn();
    const patientAgeSelect = includePatientAge ? 'u.age AS patient_age,' : 'NULL::int AS patient_age,';
    const doctorId = await getDoctorIdForUser(req.user.id);
    let appointments;

    if (doctorId) {
      appointments = await pool.query(
        `
          SELECT a.*, u.full_name AS patient_name, u.phone AS patient_phone,
                 u.email AS patient_email, ${patientAgeSelect}
                 s.name AS specialty_name, h.name AS hospital_name
          FROM appointments a
          JOIN users u ON a.patient_id = u.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          LEFT JOIN specialties s ON d.specialty_id = s.id
          LEFT JOIN hospitals h ON a.hospital_id = h.id
          WHERE a.doctor_id = $1
            AND a.date = CURRENT_DATE
          ORDER BY a.time ASC
        `,
        [doctorId]
      );
    } else {
      const hospitalId = await getHospitalIdForUser(req.user.id);
      if (hospitalId) {
        appointments = await pool.query(
          `
            SELECT a.*, u.full_name AS patient_name, u.phone AS patient_phone,
                   u.email AS patient_email, ${patientAgeSelect}
                   d.full_name AS doctor_name, s.name AS specialty_name
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN specialties s ON d.specialty_id = s.id
            WHERE a.hospital_id = $1
              AND a.date = CURRENT_DATE
            ORDER BY a.time ASC
          `,
          [hospitalId]
        );
      } else {
        appointments = { rows: [] };
      }
    }

    res.json(appointments.rows);
  } catch (err) {
    console.error('Today appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s appointments' });
  }
});

// Update appointment status (doctor/hospital only)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'waiting', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const doctorId = await getDoctorIdForUser(req.user.id);
    const hospitalId = doctorId ? null : await getHospitalIdForUser(req.user.id);
    if (!doctorId && !hospitalId) {
      return res.status(403).json({ error: 'Only doctors or hospital users can update appointment status' });
    }

    const params = [status, req.params.id];
    let ownerFilter = '';
    if (doctorId) {
      params.push(doctorId);
      ownerFilter = ` AND doctor_id = $${params.length}`;
    } else if (hospitalId) {
      params.push(hospitalId);
      ownerFilter = ` AND hospital_id = $${params.length}`;
    }

    const result = await pool.query(
      `UPDATE appointments SET status = $1 WHERE id = $2${ownerFilter} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, type) VALUES ($1, $2, $3)',
      [req.user.id, `Appointment ${status}`, 'appointment']
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Cancel appointment (patient side)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND patient_id = $3 RETURNING *',
      ['cancelled', req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment cancelled', appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

export default router;
