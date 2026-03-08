import { Ambulance, Clock, MapPin, UserRound, Phone } from 'lucide-react';

export default function AmbulanceRequestCard({ request, onAccept, onReject, onDispatch, actionLoading }) {
  const loadingAction = actionLoading?.requestId === request.request_id ? actionLoading.action : null;

  return (
    <div className="card-base flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {request.patient_name || 'Unknown patient'}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Request ID: {request.request_id}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-500">
          {request.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <Info icon={Clock} value={`${request.eta_minutes || '--'} min ETA`} />
        <Info icon={MapPin} value={`${request.distance_km || '--'} km`} />
        <Info icon={Phone} value={request.patient_phone || 'No phone'} />
      </div>

      <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
        <p className="text-[11px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Patient Data</p>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <UserRound size={14} className="inline mr-1 text-blue-500" />
          {request.patient_name || 'Unknown'} {request.patient_age ? `(${request.patient_age} yrs)` : ''}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Symptoms: {request.symptoms || 'Not specified'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Medical history: {request.medical_history || 'Not specified'}
        </p>
      </div>

      {Array.isArray(request.current_prescriptions) && request.current_prescriptions.length > 0 && (
        <div>
          <p className="text-[11px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Current Prescriptions</p>
          <div className="flex flex-wrap gap-2">
            {request.current_prescriptions.slice(0, 3).map((p, idx) => (
              <span key={`${request.request_id}-rx-${idx}`} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {p.medicine || 'Medicine'} {p.dosage ? `- ${p.dosage}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(request.doctor_data) && request.doctor_data.length > 0 && (
        <div>
          <p className="text-[11px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Doctor Data</p>
          <div className="flex flex-col gap-1">
            {request.doctor_data.slice(0, 2).map((d, idx) => (
              <p key={`${request.request_id}-doc-${idx}`} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {d.doctor_name || 'Doctor'} - {d.specialization || 'General'} ({d.appointment_date || 'N/A'} {d.appointment_time || ''})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => onAccept(request.request_id)}
          disabled={Boolean(loadingAction)}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:opacity-90 disabled:opacity-60"
        >
          {loadingAction === 'accept' ? 'Accepting...' : 'Accept'}
        </button>
        <button
          onClick={() => onReject(request.request_id)}
          disabled={Boolean(loadingAction)}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-500 text-white hover:opacity-90 disabled:opacity-60"
        >
          {loadingAction === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
        {onDispatch && request.status !== 'pending' && (
          <button
            onClick={() => onDispatch(request.request_id)}
            disabled={Boolean(loadingAction)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1"
          >
            <Ambulance size={12} />
            {loadingAction === 'dispatch' ? 'Dispatching...' : 'Dispatch'}
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ icon: Icon, value }) {
  return (
    <div className="px-2 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: 'var(--bg-secondary)' }}>
      <Icon size={12} className="text-blue-500" />
      <span>{value}</span>
    </div>
  );
}
