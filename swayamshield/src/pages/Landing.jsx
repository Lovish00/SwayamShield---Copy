import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, Building2, ShieldCheck, AlertTriangle, Ambulance, Clock, MapPin, X, Stethoscope, RefreshCw } from 'lucide-react';
import ThemeToggle from '../components/ui/ThemeToggle';
import FirstAidAssistant from '../components/emergency/FirstAidAssistant';
import { detectCurrentLocation } from '../lib/location';
import { emergencyAPI } from '../lib/api';

const roles = [
  { id: 'patient', label: 'Patient', desc: 'Book appointments & track health', icon: Heart, gradient: 'from-blue-500 to-blue-700', shadow: 'hover:shadow-blue-500/25', iconColor: 'text-blue-500' },
  { id: 'doctor', label: 'Doctor', desc: 'Manage consultations', icon: Stethoscope, gradient: 'from-emerald-500 to-emerald-700', shadow: 'hover:shadow-emerald-500/25', iconColor: 'text-emerald-500' },
  { id: 'hospital_centre', label: 'Hospital Centre', desc: 'Emergency tracking', icon: Building2, gradient: 'from-cyan-500 to-cyan-700', shadow: 'hover:shadow-cyan-500/25', iconColor: 'text-cyan-500' },
  { id: 'admin', label: 'Admin', desc: 'Platform analytics', icon: ShieldCheck, gradient: 'from-purple-500 to-purple-700', shadow: 'hover:shadow-purple-500/25', iconColor: 'text-purple-500' },
];

const STATUS_STEPS = ['Dispatched', 'On the way', 'Arriving'];

export default function Landing() {
  const navigate = useNavigate();
  const [isLocating, setIsLocating] = useState(false);
  const [emergencyError, setEmergencyError] = useState('');
  
  const [tracking, setTracking] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(0);

  // Auto-booking Emergency Logic
  const handleEmergencyRequest = async () => {
    setIsLocating(true);
    setEmergencyError('');
    setTracking(null);

    try {
      // 1. Detect Location
      const location = await detectCurrentLocation();
      
      // 2. Fetch nearest ambulance provider automatically
      const providersResp = await emergencyAPI.nearbyPublic({
        lat: location.latitude,
        lng: location.longitude,
        limit: 1, // We only need the top 1 closest
      });

      const providers = providersResp.data.providers || [];
      if (providers.length === 0) {
        throw new Error("No available ambulances found nearby. Please call standard emergency hotline.");
      }

      const nearestProvider = providers[0];

      // 3. Auto Book the ambulance instantly
      const bookResp = await emergencyAPI.bookPublic({
        hospital_id: nearestProvider.hospital_id,
        lat: location.latitude,
        lng: location.longitude,
      });

      // 4. Set tracking view
      setTracking(bookResp.data);

    } catch (err) {
      setEmergencyError(err.response?.data?.error || err.message || "Failed to dispatch ambulance.");
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (!tracking) return;
    setStatusIndex(0);
    setDistanceRemaining(tracking.distance_km || tracking.ambulance?.distance_km || 0);
  }, [tracking]);

  useEffect(() => {
    if (!tracking || statusIndex >= STATUS_STEPS.length - 1) return;

    const initialDistance = tracking.distance_km || tracking.ambulance?.distance_km || 0;
    const distanceStep = initialDistance > 0 ? initialDistance / (STATUS_STEPS.length - 1) : 0;

    const timer = setTimeout(() => {
      setStatusIndex((prev) => Math.min(prev + 1, STATUS_STEPS.length - 1));
      setDistanceRemaining((prev) => Math.max(0, Number((prev - distanceStep).toFixed(1))));
    }, 15000); // Progresses tracking status every 15s for demo

    return () => clearTimeout(timer);
  }, [tracking, statusIndex]);

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row overflow-x-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Background Ornaments */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/5 -top-40 -left-40 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-emerald-500/5 -bottom-32 -right-32 animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-purple-500/5 top-1/3 right-1/4 animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <div className="absolute top-6 right-6 z-30"><ThemeToggle /></div>

      {/* Main Column (Center Focus) */}
      <div className={`relative z-10 flex-1 flex flex-col items-center justify-center p-6 lg:p-12 gap-12 w-full mx-auto transition-all ${tracking ? 'lg:pr-0 xl:max-w-3xl' : 'max-w-5xl'}`}>
        
        {/* Header & Main Action */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full flex flex-col items-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo.png" alt="SwayamShield logo" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
            <h1 className="text-6xl md:text-7xl font-extrabold gradient-text tracking-tight">SwayamShield</h1>
          </div>
          <p className="text-xl md:text-2xl font-medium max-w-2xl mx-auto mb-16" style={{ color: 'var(--text-secondary)' }}>
            Empowering your healthcare journey with immediate response and intelligent insights.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEmergencyRequest}
            disabled={isLocating || !!tracking}
            className="w-full max-w-2xl flex items-center justify-center gap-6 px-10 py-12 rounded-[2.5rem] text-3xl md:text-4xl font-extrabold text-white bg-gradient-to-r from-red-500 to-red-700 shadow-2xl shadow-red-500/40 hover:shadow-red-500/60 disabled:shadow-none disabled:opacity-80 transition-all border-2 border-red-400/30"
          >
            {isLocating ? (
              <>
                <RefreshCw size={56} className="animate-spin" />
                Dispatching...
              </>
            ) : tracking ? (
              <>
                <Ambulance size={56} className="text-white" />
                Ambulance On Route
              </>
            ) : (
              <>
                <AlertTriangle size={56} className="animate-pulse" />
                Request Emergency Help
              </>
            )}
          </motion.button>
          
          {emergencyError && (
             <div className="mt-8 text-lg px-6 py-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 max-w-2xl w-full">
               <span className="font-bold">Error:</span> {emergencyError}
             </div>
          )}
        </motion.div>

      </div>

      {/* Right Sidebar - Role Access logic (Hides if tracking active on mobile, shifts aside on desktop) */}
      <AnimatePresence mode="wait">
        {!tracking && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
            transition={{ delay: 0.1 }}
            className="w-full md:w-[340px] lg:w-[400px] flex-shrink-0 p-6 lg:p-10 border-t md:border-t-0 md:border-l bg-white/50 dark:bg-black/20 backdrop-blur-sm min-h-screen flex flex-col justify-center"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div className="mb-8 px-2">
              <h2 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Access Portals</h2>
              <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>Log in to your dedicated dashboard.</p>
            </div>

            <div className="flex flex-col gap-4">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <motion.button
                    key={role.id}
                    whileHover={{ scale: 1.02, x: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/${role.id}/login`)}
                    className={`flex items-center gap-5 p-5 rounded-3xl border transition-all cursor-pointer bg-white dark:bg-zinc-900 shadow-sm ${role.shadow}`}
                    style={{ borderColor: 'var(--border-default)' }}
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex flex-col items-start text-left flex-1 min-w-0">
                      <h3 className="text-lg font-bold truncate w-full" style={{ color: 'var(--text-primary)' }}>{role.label}</h3>
                      <p className="text-sm font-medium truncate w-full mt-0.5" style={{ color: 'var(--text-muted)' }}>{role.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Tracking & AI First Aid Sidebar */}
      <AnimatePresence mode="wait">
        {tracking && (
           <motion.div 
             initial={{ opacity: 0, x: 50 }} 
             animate={{ opacity: 1, x: 0 }} 
             exit={{ opacity: 0, x: 50 }}
             className="w-full lg:w-[500px] xl:w-[560px] flex-shrink-0 p-6 lg:p-8 border-t md:border-t-0 md:border-l bg-white dark:bg-zinc-950 shadow-2xl z-40 h-screen overflow-y-auto flex flex-col gap-8 custom-scrollbar"
             style={{ borderColor: 'var(--border-default)' }}
           >
             {/* Large Dismiss Button */}
             <div className="flex justify-between items-center bg-red-50 dark:bg-red-950/20 px-4 py-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                <span className="text-red-600 dark:text-red-400 font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                  <AlertTriangle size={18} /> Active Emergency
                </span>
                <button 
                  onClick={() => setTracking(null)} 
                  className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                  title="Dismiss Emergency View"
                >
                  <X size={20} style={{ color: 'var(--text-secondary)' }} />
                </button>
             </div>

             {/* Tracking Details */}
             <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Ambulance Dispatched</h2>
                  <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {tracking.ambulance?.provider_name || 'Emergency ambulance assigned'}
                  </p>
                </div>

                {/* Status Pillars */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <TrackInfo icon={Clock} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-500/10" label="ETA" value={`${tracking.eta_minutes || tracking.ambulance?.eta_minutes || '--'} min`} />
                  <TrackInfo icon={MapPin} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-500/10" label="Distance" value={`${distanceRemaining} km`} />
                  <TrackInfo icon={Ambulance} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-500/10" label="Status" value={STATUS_STEPS[statusIndex]} />
                </div>

                {/* Progress Bar */}
                <div className="mt-4 flex flex-col gap-2">
                  <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                     <div 
                       className="h-full bg-emerald-500 transition-all duration-1000 ease-in-out" 
                       style={{ width: `${((statusIndex + 1) / STATUS_STEPS.length) * 100}%` }} 
                     />
                  </div>
                  <div className="flex justify-between px-1">
                    {STATUS_STEPS.map((step, idx) => (
                      <span
                        key={step}
                        className={`text-[12px] font-bold ${idx <= statusIndex ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600'}`}
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
             </div>

             {/* Divider */}
             <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800 my-2" />

             {/* Enlarged First Aid Assistant wrapper */}
             <div className="flex-1 flex flex-col pb-6">
                <div className="scale-105 transform origin-top w-[95%] mx-auto">
                   <FirstAidAssistant />
                </div>
             </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay for Auto Book */}
      <AnimatePresence>
        {isLocating && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
           >
             <div className="p-8 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl flex flex-col items-center max-w-sm w-full border border-zinc-100 dark:border-zinc-800">
               <div className="relative">
                 <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                 <MapPin size={64} className="text-red-500 relative z-10 animate-bounce" />
               </div>
               <h3 className="text-2xl font-extrabold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>Locating You</h3>
               <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>Identifying the closest available ambulance and emergency hospital...</p>
             </div>
           </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function TrackInfo({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col items-center justify-center border border-black/5 dark:border-white/5 shadow-sm ${bg}`}>
      <Icon size={24} className={`mb-2 ${color}`} />
      <p className="text-[11px] font-extrabold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
