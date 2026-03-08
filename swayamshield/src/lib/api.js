import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ss_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ss_token');
      localStorage.removeItem('ss_user');
      // Don't redirect if already on auth or landing page
      if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

const fetchNearbyHospitals = (latitude, longitude, options = {}) =>
  api.post('/hospitals/nearby', { latitude, longitude, ...options });

// Hospitals & Doctors
export const hospitalAPI = {
  list: (params) => api.get('/hospitals', { params }),
  nearby: (latitude, longitude, options = {}) => fetchNearbyHospitals(latitude, longitude, options),
  getNearbyHospitals: (latitude, longitude, options = {}) => fetchNearbyHospitals(latitude, longitude, options),
  doctors: (params) => api.get('/hospitals/doctors', { params }),
  doctorDetail: (id) => api.get(`/hospitals/doctors/${id}`),
  specialties: () => api.get('/hospitals/specialties'),
};

// Appointments
export const appointmentAPI = {
  book: (data) => api.post('/appointments', data),
  my: () => api.get('/appointments/my'),
  today: () => api.get('/appointments/today'),
  doctorSummary: () => api.get('/appointments/doctor/summary'),
  updateStatus: (id, status) => api.patch(`/appointments/${id}/status`, { status }),
  cancel: (id) => api.delete(`/appointments/${id}`),
};

// Emergency
export const emergencyAPI = {
  book: (data) => api.post('/emergency', data),
  my: () => api.get('/emergency/my'),
  nearbyPublic: (params = {}) => api.get('/emergency/public/ambulances', { params }),
  bookPublic: (data) => api.post('/emergency/public/book', data),
};

// Ambulance workflow
export const ambulanceAPI = {
  request: (data) => api.post('/ambulance/request', data),
  myRequests: () => api.get('/ambulance/request/my'),
  options: (requestId) => api.get(`/ambulance/request/${requestId}/options`),
  queue: () => api.get('/ambulance/queue'),
  hospitalOverview: () => api.get('/ambulance/hospital/overview'),
  updateBlood: (data) => api.patch('/ambulance/hospital/blood', data),
  incomingPatients: () => api.get('/ambulance/incoming-patients'),
  accept: (requestId) => api.patch(`/ambulance/request/${requestId}/accept`),
  reject: (requestId) => api.patch(`/ambulance/request/${requestId}/reject`),
  dispatch: (requestId) => api.patch(`/ambulance/request/${requestId}/dispatch`),
};

// Health Records
export const healthRecordAPI = {
  list: () => api.get('/health-records'),
  add: (data) => api.post('/health-records', data),
  uploadForPatient: (data) => api.post('/health-records/hospital/upload', data),
  delete: (id) => api.delete(`/health-records/${id}`),
};

// Prescriptions
export const prescriptionAPI = {
  list: (patientId) => api.get('/prescriptions', { params: patientId ? { patient_id: patientId } : {} }),
  add: (data) => api.post('/prescriptions', data),
  toggle: (id) => api.patch(`/prescriptions/${id}/toggle`),
  hospitalQueue: () => api.get('/prescriptions/hospital/queue'),
  hospitalReview: (id, data) => api.patch(`/prescriptions/${id}/hospital-review`, data),
};

// Reviews
export const reviewAPI = {
  submit: (data) => api.post('/reviews', data),
  forDoctor: (id) => api.get(`/reviews/doctor/${id}`),
};

// Symptoms (Gemini AI)
export const symptomAPI = {
  analyze: (messages, options = {}) => api.post('/symptoms/analyze', { messages, ...options }),
  guidedQuestions: (categories = []) =>
    api.get('/symptoms/guided', {
      params: categories.length > 0 ? { categories: categories.join(',') } : {},
    }),
  modelSymptoms: () => api.get('/symptoms/model/symptoms'),
  guidedPredict: (symptoms, categories = []) => api.post('/symptoms/model/predict', { symptoms, categories }),
};

// Admin
export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  activity: (params) => api.get('/admin/activity', { params }),
  users: (params) => api.get('/admin/users', { params }),
};

// Notifications
export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export default api;
