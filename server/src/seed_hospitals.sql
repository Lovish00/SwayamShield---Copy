-- Chandigarh Tricity hospital dataset (25 records)
-- Stored in PostgreSQL hospitals table with ICU + ambulance metadata

-- Backward-compatible schema alignment for older hospitals table versions.
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS total_beds INTEGER;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS icu_beds INTEGER DEFAULT 0;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS ambulance BOOLEAN DEFAULT TRUE;

UPDATE hospitals
SET
  latitude = COALESCE(latitude, lat),
  longitude = COALESCE(longitude, lng),
  lat = COALESCE(lat, latitude::double precision),
  lng = COALESCE(lng, longitude::double precision),
  total_beds = COALESCE(total_beds, beds, 0),
  beds = COALESCE(beds, total_beds, 0),
  icu_beds = COALESCE(icu_beds, 0),
  emergency = COALESCE(emergency, true),
  ambulance = COALESCE(ambulance, true);

-- Remove stale non-user hospitals outside Chandigarh Tricity bounds
-- to avoid far-distance results (for example 200+ km entries).
DELETE FROM hospitals h
WHERE h.user_id IS NULL
  AND (
    COALESCE(h.latitude::double precision, h.lat) IS NULL
    OR COALESCE(h.longitude::double precision, h.lng) IS NULL
    OR COALESCE(h.latitude::double precision, h.lat) NOT BETWEEN 30.60 AND 30.82
    OR COALESCE(h.longitude::double precision, h.lng) NOT BETWEEN 76.65 AND 76.90
  );

WITH hospitals_data(name, address, phone, latitude, longitude, total_beds, icu_beds, emergency, ambulance, rating) AS (
  VALUES
    ('PGIMER Chandigarh', 'Sector 12, Chandigarh 160012', '0172-2747585', 30.762970, 76.775482, 1960, 210, true, true, 4.9),
    ('Government Medical College and Hospital Sector 32', 'Sector 32, Chandigarh 160030', '0172-2601023', 30.708710, 76.779420, 840, 110, true, true, 4.6),
    ('Government Multi Specialty Hospital Sector 16', 'Sector 16, Chandigarh 160015', '0172-2782458', 30.739560, 76.787180, 520, 62, true, true, 4.3),
    ('Government Multi Specialty Hospital Sector 22', 'Sector 22, Chandigarh 160022', '0172-2700016', 30.730230, 76.778140, 310, 38, true, true, 4.1),
    ('Government Multi Specialty Hospital Sector 45', 'Sector 45, Chandigarh 160047', '0172-2609200', 30.688190, 76.758280, 280, 34, true, true, 4.0),
    ('Civil Hospital Sector 6 Panchkula', 'Sector 6, Panchkula 134109', '0172-2581500', 30.700080, 76.855240, 390, 44, true, true, 4.2),
    ('Command Hospital Chandimandir', 'Chandimandir Cantonment, Panchkula 134107', '0172-2746401', 30.711110, 76.886710, 340, 42, true, true, 4.5),
    ('Alchemist Hospital Panchkula', 'Sector 21, Panchkula 134112', '0172-4500000', 30.704950, 76.846970, 260, 36, true, true, 4.3),
    ('Paras Hospitals Panchkula', 'Sector 22, Panchkula 134109', '0172-4505000', 30.686820, 76.852970, 300, 46, true, true, 4.4),
    ('Ojas Hospital Panchkula', 'Sector 26, Panchkula 134116', '0172-2799900', 30.733860, 76.841910, 180, 22, true, true, 4.1),
    ('Dhawan Hospital Panchkula', 'Sector 7, Panchkula 134109', '0172-2595000', 30.701410, 76.860190, 170, 20, true, true, 4.0),
    ('Fortis Hospital Mohali', 'Sector 62, Mohali 160062', '0172-4692222', 30.700780, 76.716580, 380, 54, true, true, 4.7),
    ('Max Super Speciality Hospital Mohali', 'Phase 6, Mohali 160055', '0172-6652000', 30.709420, 76.720510, 330, 48, true, true, 4.6),
    ('Ivy Hospital Mohali', 'Sector 71, Mohali 160071', '0172-7170000', 30.685520, 76.725940, 290, 40, true, true, 4.3),
    ('Grecian Super Speciality Hospital', 'Sector 69, Mohali 160062', '0172-5090909', 30.688940, 76.717420, 240, 34, true, true, 4.2),
    ('Cosmo Hospital Mohali', 'Sector 62, Mohali 160062', '0172-3933333', 30.706470, 76.713940, 220, 30, true, true, 4.1),
    ('Civil Hospital Phase 6 Mohali', 'Phase 6, Mohali 160055', '0172-2265566', 30.711390, 76.719430, 210, 28, true, true, 4.0),
    ('Silver Oaks Hospital Mohali', 'Phase 9, Mohali 160062', '0172-2211300', 30.720290, 76.731620, 160, 18, true, true, 3.9),
    ('Healing Hospital Chandigarh', 'Sector 34A, Chandigarh 160022', '0172-5088888', 30.721320, 76.769160, 280, 42, true, true, 4.4),
    ('Landmark Hospital Chandigarh', 'Sector 33C, Chandigarh 160020', '0172-4600600', 30.715120, 76.761450, 210, 26, true, true, 4.1),
    ('Eden Critical Care Hospital Chandigarh', 'Industrial Area Phase 1, Chandigarh 160002', '0172-4666600', 30.705470, 76.798040, 130, 24, true, true, 4.0),
    ('Inscol Hospital Chandigarh', 'Sector 34A, Chandigarh 160022', '0172-5088888', 30.720220, 76.767940, 180, 20, true, true, 4.0),
    ('Mukat Hospital Chandigarh', 'Sector 34A, Chandigarh 160022', '0172-4344444', 30.724210, 76.772770, 220, 26, true, true, 4.2),
    ('Omni Hospital Chandigarh', 'Sector 27, Chandigarh 160019', '0172-5060606', 30.735440, 76.786260, 140, 16, true, true, 3.9),
    ('Chaitanya Hospital Chandigarh', 'Sector 44C, Chandigarh 160047', '0172-4605000', 30.691360, 76.761120, 170, 22, true, true, 4.0)
)
INSERT INTO hospitals (name, address, phone, lat, lng, latitude, longitude, beds, total_beds, icu_beds, emergency, ambulance, rating)
SELECT
  hd.name,
  hd.address,
  hd.phone,
  hd.latitude::double precision,
  hd.longitude::double precision,
  hd.latitude,
  hd.longitude,
  hd.total_beds,
  hd.total_beds,
  hd.icu_beds,
  hd.emergency,
  hd.ambulance,
  hd.rating
FROM hospitals_data hd
WHERE NOT EXISTS (
  SELECT 1
  FROM hospitals h
  WHERE h.name = hd.name
);

-- Map commonly available specialties for Chandigarh hospitals
INSERT INTO hospital_specialties (hospital_id, specialty_id)
SELECT h.id, s.id
FROM hospitals h
JOIN specialties s ON s.name IN ('General Medicine', 'Cardiology', 'Orthopedics', 'Neurology', 'Pediatrics')
WHERE h.name IN (
  'PGIMER Chandigarh',
  'Government Medical College and Hospital Sector 32',
  'Fortis Hospital Mohali',
  'Max Super Speciality Hospital Mohali',
  'Healing Hospital Chandigarh'
)
ON CONFLICT DO NOTHING;

INSERT INTO hospital_specialties (hospital_id, specialty_id)
SELECT h.id, s.id
FROM hospitals h
JOIN specialties s ON s.name IN ('General Medicine', 'Dermatology', 'ENT')
WHERE h.name IN (
  'Government Multi Specialty Hospital Sector 16',
  'Government Multi Specialty Hospital Sector 22',
  'Government Multi Specialty Hospital Sector 45',
  'Civil Hospital Sector 6 Panchkula',
  'Civil Hospital Phase 6 Mohali'
)
ON CONFLICT DO NOTHING;

-- Seed doctors for Chandigarh network (idempotent)
INSERT INTO doctors (user_id, hospital_id, specialty_id, full_name, experience, fee, rating, available)
SELECT
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  h.id,
  s.id,
  d.name,
  d.exp,
  d.fee,
  d.rating,
  true
FROM (VALUES
  ('Dr. Neha Sharma', 18, 900, 4.8, 'PGIMER Chandigarh', 'Cardiology'),
  ('Dr. Vikram Ahuja', 20, 800, 4.7, 'Government Medical College and Hospital Sector 32', 'General Medicine'),
  ('Dr. Ritu Malhotra', 14, 700, 4.5, 'Healing Hospital Chandigarh', 'Neurology'),
  ('Dr. Arjun Bedi', 16, 750, 4.6, 'Fortis Hospital Mohali', 'Orthopedics'),
  ('Dr. Meenal Kaur', 12, 650, 4.4, 'Max Super Speciality Hospital Mohali', 'Pediatrics'),
  ('Dr. Rahul Sethi', 11, 600, 4.3, 'Grecian Super Speciality Hospital', 'ENT'),
  ('Dr. Parul Jain', 15, 680, 4.4, 'Ivy Hospital Mohali', 'Dermatology'),
  ('Dr. Karan Verma', 13, 620, 4.2, 'Civil Hospital Sector 6 Panchkula', 'General Medicine'),
  ('Dr. Sameera Joshi', 10, 590, 4.1, 'Mukat Hospital Chandigarh', 'General Medicine'),
  ('Dr. Gaurav Bansal', 17, 820, 4.6, 'PGIMER Chandigarh', 'Neurology')
) AS d(name, exp, fee, rating, hospital, specialty)
JOIN hospitals h ON h.name = d.hospital
JOIN specialties s ON s.name = d.specialty
WHERE NOT EXISTS (
  SELECT 1
  FROM doctors d2
  WHERE d2.full_name = d.name AND d2.hospital_id = h.id
);
