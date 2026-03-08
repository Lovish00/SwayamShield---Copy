import { Phone, Clock, MapPin, Ambulance } from 'lucide-react';

export default function AmbulanceCard({ provider, onBook, bookingLoading }) {
  return (
    <div className="card-base flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{provider.provider_name}</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Emergency ambulance support</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-500">Emergency</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Info icon={MapPin} text={`${provider.distance_km} km`} />
        <Info icon={Clock} text={`${provider.eta_minutes} min ETA`} />
        <Info icon={Phone} text={provider.contact_number} />
      </div>

      <button
        onClick={() => onBook(provider)}
        disabled={bookingLoading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-500 to-red-700 text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {bookingLoading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Ambulance size={16} />
        )}
        Book Ambulance
      </button>
    </div>
  );
}

function Info({ icon: Icon, text }) {
  return (
    <div className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
      <Icon size={12} className="text-blue-500" />
      <span>{text}</span>
    </div>
  );
}
