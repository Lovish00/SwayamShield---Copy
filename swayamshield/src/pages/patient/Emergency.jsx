import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Ambulance, AlertTriangle, Phone, Loader2, Bed, Video, Bot, ChevronRight, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ambulanceAPI } from '../../lib/api';
import { getNearbyHospitals } from '../../lib/hospitals';
import { detectCurrentLocation, mapLocationError } from '../../lib/location';

export default function Emergency() {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [symptoms, setSymptoms] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState('');
  
  // Active emergency state
  const [requestStatus, setRequestStatus] = useState(null);
  const [trackingData, setTrackingData] = useState({ lat: 0, lng: 0, distance: 0 });
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [error, setError] = useState('');

  // Simulate ambulance moving towards patient
  useEffect(() => {
    if (requestStatus && location) {
      // Start ambulance approx 2km away
      const startLat = location.latitude + (Math.random() - 0.5) * 0.04;
      const startLng = location.longitude + (Math.random() - 0.5) * 0.04;
      
      setTrackingData({
        lat: startLat,
        lng: startLng,
        distance: 2.1
      });

      const interval = setInterval(() => {
        setTrackingData(prev => {
          if (prev.distance <= 0.1) return prev; // Arrived
          
          // Move 5% closer each tick
          const newLat = prev.lat + (location.latitude - prev.lat) * 0.05;
          const newLng = prev.lng + (location.longitude - prev.lng) * 0.05;
          const newDist = prev.distance - 0.1;
          
          return {
            lat: newLat,
            lng: newLng,
            distance: Math.max(0, newDist)
          };
        });
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [requestStatus, location]);

  const handleGetAmbulanceOptions = async () => {
    setLoading(true);
    setError('');
    setRequestStatus(null);

    try {
      const coords = await detectCurrentLocation();
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });

      if (coords.isFallback && coords.message) {
        setError(coords.message);
      }

      const nearbyHospitals = await getNearbyHospitals(coords.latitude, coords.longitude, { limit: 5 });
      setHospitals(nearbyHospitals.slice(0, 5));
      if (nearbyHospitals.length === 0) {
        setError('No nearby hospitals available for ambulance support right now.');
      }
    } catch (err) {
      setError(err.response?.data?.error || mapLocationError(err));
    }

    setLoading(false);
  };

  const handleRequestAmbulance = async (hospital) => {
    if (!location) return;

    setRequestingId(hospital.id);
    setError('');
    try {
      const response = await ambulanceAPI.request({
        patient_id: user?.id,
        latitude: location.latitude,
        longitude: location.longitude,
        preferred_hospital_id: hospital.id,
        symptoms,
        medical_history: medicalHistory,
      });

      setRequestStatus({
        requestId: response.data.request?.id,
        hospital: hospital.name,
        eta: response.data.hospitals?.[0]?.eta_minutes || hospital.eta_minutes || 8,
        phone: hospital.phone || '911'
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send ambulance request.');
    }
    setRequestingId('');
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
               <AlertTriangle size={30} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Emergency Response</h1>
              <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
                Dispatch a priority ambulance and get real-time hospital assistance.
              </p>
            </div>
          </div>
        </div>

        {/* Active Emergency View */}
        <AnimatePresence mode="wait">
          {requestStatus ? (
            <motion.div 
              key="active-emergency"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border-2 border-red-500 relative"
            >
              {/* Pulsing overlay */}
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                {/* Left Side: Ambulance Status & Tracking */}
                <div className="lg:col-span-2 flex flex-col border-r border-zinc-100 dark:border-zinc-800">
                  <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center md:items-start justify-between border-b border-zinc-100 dark:border-zinc-800 bg-red-50/50 dark:bg-red-900/10 h-full">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                      <div className="relative">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-zinc-900 z-10 relative">
                          <Ambulance size={48} className="animate-pulse" />
                        </div>
                        {trackingData.distance > 0.1 && (
                          <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md border-2 border-white dark:border-zinc-900">
                          ON WAY
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-left">
                        <h2 className="text-3xl font-black text-red-600 dark:text-red-500 tracking-tight uppercase">Ambulance On Route</h2>
                        <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mt-1">Dispatched from {requestStatus.hospital}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl">
                            <Clock size={18} /> {trackingData.distance <= 0.1 ? 'Arrived' : `~${requestStatus.eta} mins away`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Tracking Map UI (Simulated) */}
                  <div className="bg-zinc-100 dark:bg-zinc-950 p-6 md:p-8 flex flex-col gap-4">
                     <div className="flex items-center justify-between font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-xs">
                       <span>Live Tracking Radar</span>
                       <span>Distance: {trackingData.distance.toFixed(1)} km</span>
                     </div>
                     
                     <div className="h-64 bg-zinc-200 dark:bg-zinc-900 rounded-3xl overflow-hidden relative border-4 border-white dark:border-zinc-800 shadow-inner flex items-center justify-center bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=30.7333,76.7794&zoom=14&size=800x400&sensor=false')] bg-cover bg-center opacity-80 mix-blend-multiply dark:mix-blend-screen">
                        {/* Simulated Path Line */}
                        <div className="absolute top-1/2 left-1/4 right-1/4 h-1 bg-red-500/30 rounded-full border border-red-500/50 border-dashed"></div>
                        
                        {/* Destination (Patient) */}
                        <div className="absolute right-1/4 flex flex-col items-center">
                           <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg z-10 animate-ping absolute"></div>
                           <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg z-20"></div>
                           <span className="mt-2 text-xs font-black bg-white dark:bg-zinc-800 px-2 py-0.5 rounded shadow">You</span>
                        </div>

                        {/* Ambulance Model moving */}
                        <motion.div 
                          key={trackingData.distance} // Triggers re-render positioning
                          className="absolute flex flex-col items-center z-30 transition-all duration-1000 ease-linear"
                          style={{ 
                            left: `${25 + (1 - trackingData.distance/2.1) * 50}%`,
                          }}
                        >
                          <div className="bg-white dark:bg-zinc-800 p-2 rounded-xl shadow-xl shadow-red-500/20 border-2 border-red-500 flex items-center gap-2">
                            <Navigation size={16} className="text-red-500 animate-pulse" />
                            <span className="font-bold text-xs">AMB-1</span>
                          </div>
                        </motion.div>
                     </div>
                     
                     <div className="flex justify-between font-mono text-[10px] text-zinc-400">
                        <span>LAT: {trackingData.lat.toFixed(5)}</span>
                        <span>LNG: {trackingData.lng.toFixed(5)}</span>
                     </div>
                  </div>

                  {/* Emergency Direct Call Feature (Replaces old AI Assistant slot) */}
                  <div className="p-6 md:p-8 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800">
                     <h3 className="text-xl font-black text-red-600 dark:text-red-500 mb-5 flex items-center gap-2">
                       <Phone size={22} className="text-red-500" /> Emergency Direct Call
                     </h3>
                     <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-6 max-w-lg leading-relaxed">
                       Connect instantly with the dispatching hospital staff for immediate assistance, priority routing, or condition updates while the ambulance arrives.
                     </p>

                     <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none" />
                       
                       <div className="flex items-center gap-4 z-10 w-full">
                         <div className="w-14 h-14 rounded-[1rem] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 border border-red-100 dark:border-red-900/50">
                           <Bed size={28} />
                         </div>
                         <div className="flex-1 min-w-0 pr-4">
                           <h4 className="text-lg font-extrabold leading-tight text-zinc-900 dark:text-white truncate">
                             {requestStatus.hospital}
                           </h4>
                           <div className="flex items-center gap-2 mt-1">
                             <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 rounded-full">
                               Dispatch Center
                             </span>
                             <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 truncate">
                               {requestStatus.phone}
                             </span>
                           </div>
                         </div>
                         <a
                           href={`tel:${requestStatus.phone}`}
                           className="flex-shrink-0 w-12 h-12 md:w-auto md:h-auto md:px-5 md:py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                         >
                           <Phone size={20} className="animate-pulse" />
                           <span className="hidden md:inline font-bold text-sm">Call Hospital</span>
                         </a>
                       </div>
                     </div>
                  </div>
                </div>

                {/* Right Side: Doctor Contact Card */}
                <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-widest mb-6">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Assigned Emergency Doctor
                    </div>
                    
                    <div className="flex flex-col items-center text-center">
                      <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-blue-700 p-1 shadow-lg mb-4">
                        <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-[1.3rem] flex items-center justify-center text-blue-600 dark:text-blue-500 font-black text-3xl">
                          DR
                        </div>
                      </div>
                      <h3 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Dr. Rajesh Sharma</h3>
                      <p className="text-sm font-bold text-blue-500 mt-1">Senior Emergency Physician</p>
                      <p className="text-xs font-semibold mt-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
                        MBBS, MD (Emergency Medicine)
                      </p>
                    </div>

                    <div className="mt-8 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl p-4">
                       <span className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Direct Contact</span>
                       <a href="tel:+919876543210" className="flex items-center gap-3 text-lg font-black text-zinc-800 dark:text-zinc-200">
                         <Phone size={20} className="text-blue-500" /> +91 98765 43210
                       </a>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3">
                     <a 
                       href="tel:+919876543210"
                       className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-[15px] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95"
                     >
                       <Phone size={22} /> Call Doctor Now
                     </a>
                     <button 
                       onClick={() => setShowCallOverlay(true)}
                       className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-6 py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-3 transition-colors border border-red-200 dark:border-red-900/50"
                     >
                       <Video size={20} /> AI Video Assist
                     </button>
                  </div>
                </div>
              </div>

            </motion.div>
          ) : (
            <motion.div key="request-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
              
              <div className="card-base grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-secondary)' }}>Current Symptoms</label>
                  <textarea
                    rows={3}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="E.g., Severe chest pain, shortness of breath, sudden unresponsiveness..."
                    className="w-full px-4 py-3 rounded-2xl border text-[15px] focus:ring-2 focus:ring-red-500/20 outline-none transition-all placeholder-zinc-400"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-secondary)' }}>Known Medical History</label>
                  <textarea
                    rows={3}
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="E.g., Pacemaker, diabetes, penicillin allergy..."
                    className="w-full px-4 py-3 rounded-2xl border text-[15px] focus:ring-2 focus:ring-red-500/20 outline-none transition-all placeholder-zinc-400"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <button
                onClick={handleGetAmbulanceOptions}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white bg-red-600 hover:bg-red-700 hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-60 disabled:hover:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <MapPin size={24} />}
                {loading ? 'Locating User & Nearest Medical Centres...' : 'Find Nearest Emergency Assistance'}
              </button>

              {location && (
                <p className="text-xs text-center font-medium" style={{ color: 'var(--text-muted)' }}>
                  GPS Location Locked: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </p>
              )}

              {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm text-center">{error}</div>}

              {/* Hospital Options */}
              {hospitals.length > 0 && (
                <div className="mt-4">
                   <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Available Dispatch Centers</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hospitals.map((hospital) => (
                      <div key={hospital.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-red-300 dark:hover:border-red-800 hover:shadow-lg transition-all flex flex-col justify-between">
                        <div className="mb-4">
                          <h3 className="text-xl font-black text-zinc-900 dark:text-white leading-tight mb-1">{hospital.name}</h3>
                          <p className="text-sm font-medium text-zinc-500 flex items-center gap-1.5"><MapPin size={14}/> {hospital.address}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm font-bold bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl mb-4 text-zinc-700 dark:text-zinc-300">
                          <span className="flex items-center gap-2"><Navigation size={16} className="text-blue-500"/> {hospital.distance?.toFixed?.(1) || hospital.distance} km</span>
                          <span className="flex items-center gap-2 text-red-600 dark:text-red-400"><Clock size={16}/> {hospital.eta_minutes} min ETA</span>
                          <span className="flex items-center gap-2"><Bed size={16} className="text-emerald-500"/> {hospital.available_beds} Beds</span>
                          <span className="flex items-center gap-2"><Phone size={16} className="text-purple-500"/> {hospital.phone || '911'}</span>
                        </div>

                        <button
                          onClick={() => handleRequestAmbulance(hospital)}
                          disabled={requestingId === hospital.id}
                          className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors flex items-center justify-center gap-2"
                        >
                          {requestingId === hospital.id ? <Loader2 size={18} className="animate-spin" /> : <Ambulance size={18} />}
                          {requestingId === hospital.id ? 'Dispatching...' : 'Dispatch Request Here'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Doctor Call / First Aid Overlay Simulation */}
      <AnimatePresence>
        {showCallOverlay && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 rounded-3xl w-full max-w-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Fake Video Header */}
              <div className="bg-black p-4 flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white font-bold tracking-widest text-sm uppercase">Secure Live Call</span>
                </div>
                <span className="font-mono text-zinc-400">00:04</span>
              </div>
              
              <div className="p-8 flex flex-col items-center justify-center text-center gap-6 relative min-h-[300px]">
                {/* AI / Doctor avatar */}
                <div className="w-32 h-32 rounded-full border-4 border-emerald-500 relative flex items-center justify-center bg-zinc-800 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                   <Bot size={50} className="text-emerald-400" />
                   <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full">
                     CONNECTED
                   </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-black text-white">SwayamShield AI First-Responder</h3>
                  <p className="text-emerald-400 font-bold mt-1">Analyzing condition...</p>
                </div>
                
                <div className="w-full max-w-md bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700 text-left">
                  <p className="text-zinc-300 font-medium">
                    "Hello {user?.full_name}. I can see your ambulance is 2.1km away. While you wait, please ensure the patient is seated upright if they are experiencing chest pain. Loosen any tight clothing. A human doctor is joining this channel..."
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-zinc-950 p-6 flex items-center justify-center gap-6 border-t border-zinc-800">
                 <button className="w-14 h-14 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors">
                   <Video size={24} />
                 </button>
                 <button 
                   onClick={() => setShowCallOverlay(false)}
                   className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-transform hover:scale-105"
                 >
                   <Phone size={36} className="rotate-[135deg]" />
                 </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
