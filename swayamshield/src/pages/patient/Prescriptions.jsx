import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pill, Check, X } from 'lucide-react';
import { prescriptionAPI } from '../../lib/api';

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => { prescriptionAPI.list().then(r => setPrescriptions(r.data)).catch(() => {}); }, []);

  const active = prescriptions.filter(p => p.active);
  const inactive = prescriptions.filter(p => !p.active);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Pill size={24} className="text-pink-500" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>My Prescriptions</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{active.length} active, {inactive.length} past prescriptions</p>
        </div>
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Medications
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map(p => <PrescriptionCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-muted)' }} /> Past Medications
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60">
            {inactive.map(p => <PrescriptionCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {prescriptions.length === 0 && <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No prescriptions yet</p>}
    </motion.div>
  );
}

function PrescriptionCard({ p }) {
  return (
    <div className="card-base flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{p.medication}</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>by {p.doctor_name || 'Unknown'}</p>
        </div>
        <span className={`w-6 h-6 rounded-full flex items-center justify-center ${p.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-200 text-gray-400'}`}>
          {p.active ? <Check size={12} /> : <X size={12} />}
        </span>
      </div>
      <div className="flex gap-4 flex-wrap">
        {p.dosage && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{p.dosage}</span>}
        {p.frequency && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{p.frequency}</span>}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {new Date(p.start_date).toLocaleDateString()} {p.end_date ? `→ ${new Date(p.end_date).toLocaleDateString()}` : '→ ongoing'}
      </p>
      {p.notes && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.notes}</p>}
    </div>
  );
}
