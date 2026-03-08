import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Ambulance, MapPin, Bot, UserRound, RefreshCcw, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ambulanceAPI } from '../../lib/api';
import { getNearbyHospitals } from '../../lib/hospitals';
import { detectCurrentLocation, mapLocationError } from '../../lib/location';

const quickActions = [
  { title: 'Ambulance', desc: 'Urgent care booking', icon: Ambulance, color: 'bg-red-500/10 text-red-500', path: '/patient/emergency' },
  { title: 'Book Appointment', desc: 'Schedule a doctor visit', icon: Calendar, color: 'bg-blue-500/10 text-blue-500', path: '/patient/appointments' },
  { title: 'Symptom Checker', desc: 'AI-powered analysis', icon: Bot, color: 'bg-amber-500/10 text-amber-500', path: '/patient/symptoms' },
  { title: 'Nearby Hospitals', desc: 'Find hospitals near you', icon: MapPin, color: 'bg-emerald-500/10 text-emerald-500', path: '/patient/nearby' },
];

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [nearbyCoords, setNearbyCoords] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestingHospitalId, setRequestingHospitalId] = useState('');

  const loadNearbyHospitals = async () => {
    setNearbyLoading(true);
    setNearbyError('');
    setRequestMessage('');

    try {
      const location = await detectCurrentLocation();
      setNearbyCoords({ latitude: location.latitude, longitude: location.longitude });

      if (location.isFallback && location.message) {
        setNearbyError(location.message);
      }

      const hospitals = await getNearbyHospitals(location.latitude, location.longitude, { limit: 8 });
      
      // Calculate a mock "treatment success probability" based on distance + randomly skewed metric
      const hospitalsWithProb = hospitals.map(h => {
        // Mock probability calculation (higher distance = slightly less probability, base is 80-99%)
        const baseProb = 95 - (h.distance * 1.5);
        // add slight randomness based on ID length or string
        const randomFactor = (h.id.length % 5) - 2; 
        const probability = Math.min(Math.max(baseProb + randomFactor, 45), 99); 
        return {
          ...h,
          probability
        };
      });

      // Sort by best probability and closest distance
      hospitalsWithProb.sort((a, b) => {
        // Higher probability is better, shorter distance is better
        const scoreA = a.probability - (a.distance * 2);
        const scoreB = b.probability - (b.distance * 2);
        return scoreB - scoreA;
      });

      setNearbyHospitals(hospitalsWithProb);
      if (hospitalsWithProb.length === 0) {
        setNearbyError('No nearby hospitals are available for ambulance requests right now.');
      }
    } catch (err) {
      setNearbyHospitals([]);
      setNearbyError(err.response?.data?.error || mapLocationError(err));
    }

    setNearbyLoading(false);
  };

  const handleRequestAmbulance = async (hospital) => {
    if (!nearbyCoords) return;

    setRequestingHospitalId(hospital.id);
    setNearbyError('');
    setRequestMessage('');

    try {
      const response = await ambulanceAPI.request({
        patient_id: user?.id,
        latitude: nearbyCoords.latitude,
        longitude: nearbyCoords.longitude,
        preferred_hospital_id: hospital.id,
      });

      const etaMinutes = response.data.hospitals?.[0]?.eta_minutes || hospital.eta_minutes;
      setRequestMessage(`Ambulance requested from ${hospital.name}. ETA: ${etaMinutes} min.`);
    } catch (err) {
      setNearbyError(err.response?.data?.error || 'Failed to request ambulance.');
    }

    setRequestingHospitalId('');
  };

  useEffect(() => {
    loadNearbyHospitals();
  }, []);

  return (
    <motion.div className="flex flex-col lg:flex-row gap-6 w-full h-full" variants={container} initial="hidden" animate="visible">
      
      {/* Main Content Area (Left) */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        
        {/* Hero Section */}
        <motion.div className="p-8 rounded-3xl border relative overflow-hidden flex flex-col justify-center" variants={item} style={{ background: 'var(--gradient-hero)', borderColor: 'var(--border-default)', minHeight: '160px' }}>
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              Welcome back, {user?.full_name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-sm font-medium opacity-90 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              Your healthcare dashboard is ready. Quickly find a nearby hospital, book an appointment, or request an emergency ambulance with just one tap.
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 pointer-events-none opacity-20">
             <Activity size={240} className="text-blue-500 translate-x-1/3 translate-y-1/4" />
          </div>
        </motion.div>

        {/* Horizontal Scroll Nearby Hospitals */}
        <motion.div variants={item} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Recommended Hospitals</h2>
            <button
              onClick={loadNearbyHospitals}
              disabled={nearbyLoading}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
          </div>

          {nearbyCoords && (
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              Current location: {nearbyCoords.latitude.toFixed(3)}, {nearbyCoords.longitude.toFixed(3)}
            </p>
          )}

          {nearbyError && (
            <div className="text-sm px-4 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
              {nearbyError}
            </div>
          )}

          {requestMessage && (
            <div className="text-sm px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {requestMessage}
            </div>
          )}

          {nearbyLoading ? (
            <div className="p-10 border rounded-2xl flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card-solid)' }}>
              <RefreshCcw size={24} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Analyzing location & nearby hospitals...</p>
            </div>
          ) : nearbyHospitals.length > 0 ? (
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {nearbyHospitals.map((hospital) => (
                <div key={hospital.id} className="snap-start flex-none w-[280px] sm:w-[320px] rounded-2xl border p-5 flex flex-col gap-3 transition-transform hover:-translate-y-1 bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--border-default)' }}>
                  
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{hospital.name}</h3>
                    <div className="flex flex-col items-end">
                       <span className={`text-lg font-extrabold ${hospital.probability > 85 ? 'text-emerald-500' : hospital.probability > 70 ? 'text-amber-500' : 'text-red-500'}`}>
                         {hospital.probability.toFixed(0)}%
                       </span>
                       <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>Success Match</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin size={16} className="text-blue-500" />
                      {hospital.distance.toFixed(1)} km
                    </div>
                    {hospital.eta_minutes && (
                      <div className="flex items-center gap-1.5 font-medium">
                        <Ambulance size={16} className="text-red-500" />
                        ~{hospital.eta_minutes} min
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{hospital.available_beds}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Regular Beds</span>
                    </div>
                    <div className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{hospital.available_icu_beds}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>ICU Beds</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRequestAmbulance(hospital)}
                    disabled={requestingHospitalId === hospital.id}
                    className="mt-2 py-3 w-full rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-60 shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Ambulance size={18} />
                    {requestingHospitalId === hospital.id ? 'Requesting...' : 'Request Ambulance'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
             <div className="p-10 border rounded-2xl flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card-solid)' }}>
               <MapPin size={24} className="text-zinc-400" />
               <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No nearby hospitals found for your current location.</p>
             </div>
          )}
        </motion.div>
        
        {/* Personal details (Optional, keeping it simple) */}
        <motion.div variants={item} className="card-base mt-2">
          <div className="flex items-center gap-2 mb-5">
            <UserRound size={20} className="text-blue-500" />
            <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Personal Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <InfoRow label="Full Name" value={user?.full_name || '--'} />
            <InfoRow label="Email" value={user?.email || '--'} />
            <InfoRow label="Phone" value={user?.phone || '--'} />
            <InfoRow label="Role" value={user?.role || 'Patient'} />
          </div>
        </motion.div>

      </div>

      {/* Quick Actions Right Panel */}
      <motion.div variants={item} className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col gap-4">
        <div className="p-6 rounded-3xl border shadow-sm sticky top-6 bg-white dark:bg-zinc-900" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="text-xl font-bold mb-6 tracking-tight" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
          
          <div className="flex flex-col gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.title}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${action.color}`}>
                    <Icon size={28} />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{action.title}</span>
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>{action.desc}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-8 p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-start gap-3">
              <Bot size={24} className="text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">Not feeling well?</h4>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Use our AI Symptom Checker to get instant medical advice and know if you need to see a doctor.</p>
                <button 
                  onClick={() => navigate('/patient/symptoms')}
                  className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try Symptom Checker →
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50">
      <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
