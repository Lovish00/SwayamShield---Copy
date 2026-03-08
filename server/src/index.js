import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth.js';
import { loadEnv } from './config/env.js';

// Route imports
import authRoutes from './routes/auth.js';
import hospitalRoutes from './routes/hospitals.js';
import appointmentRoutes from './routes/appointments.js';
import emergencyRoutes from './routes/emergency.js';
import ambulanceRoutes from './routes/ambulance.js';
import patientRoutes from './routes/patients.js';
import vitalRoutes from './routes/vitals.js';
import prescriptionRoutes from './routes/prescriptions.js';
import reviewRoutes from './routes/reviews.js';
import symptomRoutes from './routes/symptoms.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';

loadEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/ambulance', ambulanceRoutes);
app.use('/api/health-records', patientRoutes);
app.use('/api/vitals', vitalRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/symptoms', symptomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Auth-protected profile route (uses auth route's /me)
app.get('/api/auth/me', authenticate, async (req, res, next) => {
  // Forward to auth route handler
  req.url = '/me';
  authRoutes(req, res, next);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🛡️  SwayamShield API running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
