import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Ambulance, Bed, Clock, MapPin, Navigation, Phone, RefreshCcw, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ambulanceAPI } from '../../lib/api';
import { getNearbyHospitals } from '../../lib/hospitals';
import { detectCurrentLocation, mapLocationError } from '../../lib/location';

export default function NearbyHospitals() {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestingId, setRequestingId] = useState('');

  const loadHospitals = async () => {
    setLoading(true);
    setError('');
    setRequestMessage('');

    try {
      const location = await detectCurrentLocation();
      setCoords({ latitude: location.latitude, longitude: location.longitude });

      if (location.isFallback && location.message) {
        setError(location.message);
      }

      const nearby = await getNearbyHospitals(location.latitude, location.longitude, { limit: 5 });
      setHospitals(nearby);
      if (nearby.length === 0) {
        setError('No nearby hospitals are available for ambulance requests right now.');
      }
    } catch (err) {
      setError(err.response?.data?.error || mapLocationError(err));
      setHospitals([]);
    }

    setLoading(false);
  };

  const handleRequestAmbulance = async (hospital) => {
    if (!coords) return;
    setRequestingId(hospital.id);
    setError('');
    setRequestMessage('');

    try {
      const response = await ambulanceAPI.request({
        patient_id: user?.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        preferred_hospital_id: hospital.id,
      });

      const etaMinutes = response.data.hospitals?.[0]?.eta_minutes || hospital.eta_minutes;
      setRequestMessage(`Ambulance requested from ${hospital.name}. ETA: ${etaMinutes} min.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request ambulance.');
    }

    setRequestingId('');
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <MapPin size={24} className="text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nearby Hospitals</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {coords
                ? `Near (${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)})`
                : 'Location is required for nearby hospitals'}
            </p>
          </div>
        </div>

        <button
          onClick={loadHospitals}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-2 disabled:opacity-60"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Refresh Nearby
        </button>
      </div>

      {error && (
        <div className="text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          {error}
        </div>
      )}

      {requestMessage && (
        <div className="text-sm px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {requestMessage}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Detecting location and loading hospitals...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hospitals.map((hospital, index) => (
            <motion.div
              key={hospital.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-base flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{hospital.name}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hospital.address}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 inline-flex items-center gap-1">
                  <Navigation size={12} />
                  {hospital.distance.toFixed(1)} km
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Info icon={Bed} text={`Beds: ${hospital.available_beds}`} />
                <Info icon={Ambulance} text={`ICU: ${hospital.available_icu_beds}`} />
                <Info icon={Clock} text={`ETA: ${hospital.eta_minutes} min`} />
                <Info icon={Phone} text={hospital.phone || 'N/A'} />
              </div>

              <button
                onClick={() => handleRequestAmbulance(hospital)}
                disabled={requestingId === hospital.id}
                className="py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:opacity-90 disabled:opacity-60"
              >
                {requestingId === hospital.id ? 'Requesting...' : 'Request Ambulance'}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && hospitals.length === 0 && !error && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No nearby hospitals found for your current location.
        </p>
      )}
    </motion.div>
  );
}

function Info({ icon: Icon, text }) {
  return (
    <div className="px-2 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: 'var(--bg-secondary)' }}>
      <Icon size={12} className="text-blue-500" />
      <span>{text}</span>
    </div>
  );
}
