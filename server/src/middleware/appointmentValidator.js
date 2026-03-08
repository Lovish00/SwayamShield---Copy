import pool from '../config/db.js';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DOCTOR_DAILY_APPOINTMENT_LIMIT = parseInt(process.env.DOCTOR_DAILY_APPOINTMENT_LIMIT || '20', 10);

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reusable booking validator to enforce core scheduling business rules.
export async function validateAppointmentBooking(req, res, next) {
  try {
    const { doctor_id, date, time } = req.body;
    const patientId = req.user.id;

    if (!DATE_ONLY_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid appointment date format. Use YYYY-MM-DD.' });
    }

    if (date < getTodayDateString()) {
      return res.status(400).json({ error: 'Appointments cannot be booked for past dates.' });
    }

    const existingPatientSlot = await pool.query(
      `
        SELECT id
        FROM appointments
        WHERE patient_id = $1
          AND date = $2
          AND time = $3
          AND status != 'cancelled'
        LIMIT 1
      `,
      [patientId, date, time]
    );

    if (existingPatientSlot.rows.length > 0) {
      return res.status(409).json({ error: 'You already have an appointment scheduled at this time.' });
    }

    const dailyCount = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM appointments
        WHERE doctor_id = $1
          AND date = $2
          AND status != 'cancelled'
      `,
      [doctor_id, date]
    );

    if (dailyCount.rows[0].count >= DOCTOR_DAILY_APPOINTMENT_LIMIT) {
      return res.status(409).json({ error: 'Doctor is fully booked for this date. Please select another date.' });
    }

    next();
  } catch (err) {
    console.error('Appointment validation error:', err);
    res.status(500).json({ error: 'Failed to validate appointment.' });
  }
}
