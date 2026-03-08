import Joi from 'joi';

export function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    next();
  };
}

// Schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().min(2).max(255).required(),
  role: Joi.string().valid('patient', 'doctor', 'hospital', 'hospital_centre').required(),
  phone: Joi.string().allow('', null),
  age: Joi.number().integer().min(0).max(130).allow(null),
  // Hospital-specific (all optional for patients)
  hospital_name: Joi.string().allow('', null),
  specialty: Joi.string().allow('', null),
  address: Joi.string().allow('', null),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const appointmentSchema = Joi.object({
  doctor_id: Joi.string().uuid().required(),
  hospital_id: Joi.string().uuid().required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': 'Date must be in YYYY-MM-DD format' }),
  time: Joi.string().required(),
  type: Joi.string().valid('consultation', 'follow-up', 'checkup', 'telemedicine').default('consultation'),
  notes: Joi.string().allow(''),
  telemedicine_link: Joi.string().uri().allow(''),
});

export const vitalSchema = Joi.object({
  bp_systolic: Joi.number().integer().min(60).max(250),
  bp_diastolic: Joi.number().integer().min(40).max(150),
  heart_rate: Joi.number().integer().min(30).max(220),
  blood_sugar: Joi.number().min(20).max(600),
  weight: Joi.number().min(1).max(500),
  temperature: Joi.number().min(90).max(110),
  spo2: Joi.number().integer().min(50).max(100),
  notes: Joi.string().allow(''),
});

export const prescriptionSchema = Joi.object({
  patient_id: Joi.string().uuid().required(),
  medication: Joi.string().required(),
  dosage: Joi.string().allow(''),
  frequency: Joi.string().allow(''),
  start_date: Joi.string().required(),
  end_date: Joi.string().allow(''),
  notes: Joi.string().allow(''),
});

export const reviewSchema = Joi.object({
  doctor_id: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow(''),
});

export const healthRecordSchema = Joi.object({
  type: Joi.string().valid('visit', 'lab', 'prescription', 'imaging', 'vaccination').required(),
  title: Joi.string().required(),
  doctor_name: Joi.string().allow(''),
  date: Joi.string().required(),
  notes: Joi.string().allow(''),
});

export const symptomSchema = Joi.object({
  messages: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required(),
    })
  ).required(),
  disable_fallback: Joi.boolean().optional(),
  selected_symptoms: Joi.array().items(Joi.string().min(2)).optional(),
});

export const modelPredictSchema = Joi.object({
  symptoms: Joi.array().items(Joi.string().min(2)).min(1).required(),
  categories: Joi.array().items(Joi.string().min(2)).optional(),
});
