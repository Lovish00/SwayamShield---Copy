-- ============================================
-- SwayamShield — Database Schema
-- Run this in pgAdmin Query Tool after creating
-- the 'swayamshield' database
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'hospital', 'hospital_centre', 'admin')),
  phone VARCHAR(20),
  age INTEGER,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- HOSPITALS
-- ============================================
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  total_beds INTEGER,
  icu_beds INTEGER DEFAULT 0,
  phone VARCHAR(20),
  beds INTEGER DEFAULT 0,
  emergency BOOLEAN DEFAULT true,
  ambulance BOOLEAN DEFAULT true,
  rating NUMERIC(2,1) DEFAULT 0.0,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SPECIALTIES
-- ============================================
CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(10),
  color VARCHAR(20)
);

-- ============================================
-- HOSPITAL <-> SPECIALTY (many-to-many)
-- ============================================
CREATE TABLE hospital_specialties (
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (hospital_id, specialty_id)
);

-- ============================================
-- DOCTORS
-- ============================================
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES specialties(id),
  full_name VARCHAR(255) NOT NULL,
  experience INTEGER DEFAULT 0,
  fee INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  rating NUMERIC(2,1) DEFAULT 0.0,
  license_number VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'waiting', 'in-progress', 'completed', 'cancelled')),
  type VARCHAR(30) DEFAULT 'consultation'
    CHECK (type IN ('consultation', 'follow-up', 'checkup', 'telemedicine')),
  notes TEXT,
  telemedicine_link TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EMERGENCY BOOKINGS
-- ============================================
CREATE TABLE emergency_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status VARCHAR(20) DEFAULT 'dispatched'
    CHECK (status IN ('dispatched', 'en-route', 'arrived', 'completed', 'cancelled')),
  eta_minutes INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AMBULANCE REQUESTS (multi-hospital queue)
-- ============================================
CREATE TABLE ambulance_requests (
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
);

CREATE TABLE ambulance_request_hospitals (
  request_id UUID REFERENCES ambulance_requests(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  distance_km NUMERIC(8,2) NOT NULL,
  eta_minutes INTEGER NOT NULL,
  decision_status VARCHAR(20) DEFAULT 'pending'
    CHECK (decision_status IN ('pending', 'accepted', 'rejected', 'closed')),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (request_id, hospital_id)
);

-- ============================================
-- HEALTH RECORDS
-- ============================================
CREATE TABLE health_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('visit', 'lab', 'prescription', 'imaging', 'vaccination')),
  title VARCHAR(255) NOT NULL,
  doctor_name VARCHAR(255),
  date DATE NOT NULL,
  notes TEXT,
  attachments TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VITALS (new feature)
-- ============================================
CREATE TABLE vitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  heart_rate INTEGER,
  blood_sugar NUMERIC(5,1),
  weight NUMERIC(5,1),
  temperature NUMERIC(4,1),
  spo2 INTEGER,
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PRESCRIPTIONS (new feature)
-- ============================================
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  medication VARCHAR(255) NOT NULL,
  medicine VARCHAR(255),
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  start_date DATE NOT NULL,
  prescription_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  review_status VARCHAR(20) DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'verified', 'updated')),
  review_notes TEXT,
  verified_by_hospital_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- REVIEWS (new feature)
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOGS (admin)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  details TEXT,
  type VARCHAR(30) DEFAULT 'general'
    CHECK (type IN ('registration', 'appointment', 'emergency', 'record', 'alert', 'login', 'general')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS (new feature)
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'info'
    CHECK (type IN ('info', 'success', 'warning', 'alert', 'appointment', 'emergency')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_doctors_specialty ON doctors(specialty_id);
CREATE INDEX idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_health_records_patient ON health_records(patient_id);
CREATE INDEX idx_vitals_patient ON vitals(patient_id);
CREATE INDEX idx_vitals_recorded ON vitals(recorded_at);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_hospitals_location ON hospitals(lat, lng);
CREATE INDEX idx_hospitals_icu ON hospitals(icu_beds);
CREATE INDEX idx_ambulance_requests_status ON ambulance_requests(status);
CREATE INDEX idx_ambulance_requests_patient ON ambulance_requests(patient_id);
CREATE INDEX idx_ambulance_request_hospitals_hospital ON ambulance_request_hospitals(hospital_id);
CREATE INDEX idx_prescriptions_hospital ON prescriptions(hospital_id);

-- ============================================
-- SEED DATA: Specialties
-- ============================================
INSERT INTO specialties (name, icon, color) VALUES
  ('Dermatology', '🧴', '#f59e0b'),
  ('Neurology', '🧠', '#8b5cf6'),
  ('Cardiology', '❤️', '#ef4444'),
  ('Orthopedics', '🦴', '#06b6d4'),
  ('Pediatrics', '👶', '#ec4899'),
  ('Ophthalmology', '👁️', '#10b981'),
  ('ENT', '👂', '#f97316'),
  ('General Medicine', '🩺', '#3b82f6'),
  ('Gynecology', '🩷', '#e11d48'),
  ('Psychiatry', '🧩', '#6366f1'),
  ('Dentistry', '🦷', '#14b8a6'),
  ('Urology', '💧', '#0ea5e9');

-- ============================================
-- SEED DATA: Default Admin Account
-- password: admin123 (bcrypt hash)
-- ============================================
INSERT INTO users (email, password_hash, full_name, role)
VALUES ('admin@swayamshield.com', '$2b$10$XtW5YVZ5v5v5v5v5v5v5vOKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'System Admin', 'admin');
