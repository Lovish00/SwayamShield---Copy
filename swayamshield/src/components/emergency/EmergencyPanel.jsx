import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, LocateFixed, RefreshCw, X } from 'lucide-react';
import { emergencyAPI } from '../../lib/api';
import AmbulanceCard from './AmbulanceCard';
import FirstAidAssistant from './FirstAidAssistant';

const FALLBACK_LOCATION = { lat: 28.6139, lng: 77.2090 };

export default function EmergencyPanel({ open, onClose, onBookingCreated }) {
  const [coordinates, setCoordinates] = useState(FALLBACK_LOCATION);
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [bookingProviderId, setBookingProviderId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      detectLocationAndLoadProviders();
    }
  }, [open]);

  const detectLocationAndLoadProviders = async () => {
    setError('');
    let nextCoordinates = FALLBACK_LOCATION;

    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          });
        });

        nextCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      } catch {
        setError('Unable to fetch exact location. Showing nearest emergency providers from default location.');
      }
    }

    setCoordinates(nextCoordinates);
    await loadProviders(nextCoordinates);
  };

  const loadProviders = async (coords = coordinates) => {
    setLoadingProviders(true);
    try {
      const response = await emergencyAPI.nearbyPublic({
        lat: coords.lat,
        lng: coords.lng,
        limit: 5,
      });
      setProviders(response.data.providers || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load nearby ambulance services.');
    }
    setLoadingProviders(false);
  };

  const handleBook = async (provider) => {
    const shouldProceed = window.confirm(`Book ambulance from ${provider.provider_name}?`);
    if (!shouldProceed) return;

    setError('');
    setBookingProviderId(provider.hospital_id);
    try {
      const response = await emergencyAPI.bookPublic({
        hospital_id: provider.hospital_id,
        lat: coordinates.lat,
        lng: coordinates.lng,
      });

      onBookingCreated?.(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book ambulance.');
    }
    setBookingProviderId('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 p-4 md:p-8 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-6xl mx-auto rounded-2xl p-4 md:p-6 border"
            style={{ background: 'var(--bg-card-solid)', borderColor: 'var(--border-default)' }}
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Emergency Assistance Panel</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Use this instantly without login for urgent situations.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr,1fr] gap-4">
              <div className="card-base flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Nearby Ambulance Services</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Location: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                    </p>
                  </div>

                  <button
                    onClick={detectLocationAndLoadProviders}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    <LocateFixed size={13} />
                    Refresh Location
                  </button>
                </div>

                {error && (
                  <p className="text-xs px-2.5 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">{error}</p>
                )}

                {loadingProviders ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <RefreshCw size={16} className="animate-spin" />
                    Loading nearby emergency providers...
                  </div>
                ) : providers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {providers.map((provider) => (
                      <AmbulanceCard
                        key={provider.hospital_id}
                        provider={provider}
                        onBook={handleBook}
                        bookingLoading={bookingProviderId === provider.hospital_id}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No emergency ambulance providers found nearby.
                  </p>
                )}
              </div>

              <FirstAidAssistant />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
