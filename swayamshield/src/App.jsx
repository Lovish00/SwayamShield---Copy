import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Ambulance, MapPin, FileText, Bot, Stethoscope, Users, Activity, Pill, Heart, Brain, Bone, Baby } from 'lucide-react';
import './index.css';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const PortalLayout = lazy(() => import('./pages/layout/PortalLayout'));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const Appointments = lazy(() => import('./pages/patient/Appointments'));
const Emergency = lazy(() => import('./pages/patient/Emergency'));
const NearbyHospitals = lazy(() => import('./pages/patient/NearbyHospitals'));
const HealthRecords = lazy(() => import('./pages/patient/HealthRecords'));
const SymptomChecker = lazy(() => import('./pages/patient/SymptomChecker'));
const Prescriptions = lazy(() => import('./pages/patient/Prescriptions'));
const HospitalDashboard = lazy(() => import('./pages/hospital/HospitalDashboard'));
const TodaysAppointments = lazy(() => import('./pages/hospital/TodaysAppointments'));
const HospitalCentreDashboard = lazy(() => import('./pages/hospitalCentre/HospitalCentreDashboard'));
const HospitalDepartment = lazy(() => import('./pages/hospitalCentre/HospitalDepartment'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const HospitalRecords = lazy(() => import('./pages/admin/HospitalRecords'));

const patientNav = [
  { path: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patient/appointments', label: 'Appointments', icon: Calendar },
  { path: '/patient/emergency', label: 'Ambulance', icon: Ambulance },
  { path: '/patient/nearby', label: 'Nearby Hospitals', icon: MapPin },
  { path: '/patient/records', label: 'Health Records', icon: FileText },
  { path: '/patient/symptoms', label: 'AI Symptom Checker', icon: Bot },
  { path: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
];

const doctorNav = [
  { path: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/doctor/appointments', label: "Today's Appointments", icon: Stethoscope },
];

const hospitalCentreNav = [
  { path: '/hospital-centre/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/hospital-centre/cardiology', label: 'Cardiology', icon: Heart },
  { path: '/hospital-centre/neurology', label: 'Neurology', icon: Brain },
  { path: '/hospital-centre/orthopedics', label: 'Orthopedics', icon: Bone },
  { path: '/hospital-centre/pediatrics', label: 'Pediatrics', icon: Baby },
];

const adminNav = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: Users },
  { path: '/admin/records', label: 'Hospital Records', icon: Activity },
];

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="skeleton w-12 h-12 rounded-full mx-auto mb-4" />
        <div className="skeleton w-24 h-3 rounded mx-auto" />
      </div>
    </div>
  );
}

function PatientLayout() { return <PortalLayout navItems={patientNav} accentColor="blue" portalLabel="Patient Portal" />; }
function DoctorLayout() { return <PortalLayout navItems={doctorNav} accentColor="green" portalLabel="Doctor Portal" />; }
function HospitalCentreLayout() { return <PortalLayout navItems={hospitalCentreNav} accentColor="green" portalLabel="Hospital Centre" />; }
function AdminLayout() { return <PortalLayout navItems={adminNav} accentColor="purple" portalLabel="Admin Portal" />; }

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/:role/login" element={<Auth />} />

          <Route path="/patient" element={<PatientLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PatientDashboard />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="emergency" element={<Emergency />} />
            <Route path="nearby" element={<NearbyHospitals />} />
            <Route path="records" element={<HealthRecords />} />
            <Route path="symptoms" element={<SymptomChecker />} />
            <Route path="prescriptions" element={<Prescriptions />} />
          </Route>

          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HospitalDashboard />} />
            <Route path="appointments" element={<TodaysAppointments />} />
          </Route>

          <Route path="/hospital-centre" element={<HospitalCentreLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HospitalCentreDashboard />} />
            <Route path=":departmentId" element={<HospitalDepartment />} />
          </Route>

          <Route path="/hospital/*" element={<Navigate to="/hospital-centre/dashboard" replace />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="records" element={<HospitalRecords />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
