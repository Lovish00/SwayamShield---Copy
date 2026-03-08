import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Calendar, Pill, FlaskConical, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { healthRecordAPI } from '../../lib/api';

const typeConfig = { visit: { icon: Calendar, color: 'blue' }, lab: { icon: FlaskConical, color: 'purple' }, prescription: { icon: Pill, color: 'emerald' }, imaging: { icon: FileText, color: 'amber' }, vaccination: { icon: FileText, color: 'cyan' } };

export default function HealthRecords() {
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'visit', title: '', doctor_name: '', date: '', notes: '' });

  useEffect(() => { healthRecordAPI.list().then(r => setRecords(r.data)).catch(() => {}); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await healthRecordAPI.add(form);
      setRecords(prev => [res.data, ...prev]);
      setShowAdd(false);
      setForm({ type: 'visit', title: '', doctor_name: '', date: '', notes: '' });
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Health Records</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your complete medical history</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 text-white text-sm font-semibold hover:opacity-90">
          <Plus size={16} /> Add Record
        </button>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)}>
            <motion.form onSubmit={handleAdd} className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--bg-card-solid)' }} initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Health Record</h3>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                <option value="visit">Visit</option><option value="lab">Lab</option><option value="prescription">Prescription</option><option value="imaging">Imaging</option><option value="vaccination">Vaccination</option>
              </select>
              <input required placeholder="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
              <input placeholder="Doctor Name" value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} className="px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
              <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
              <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
              <button type="submit" className="py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-purple-700">Save Record</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="flex flex-col max-w-2xl">
        {records.map((r, i) => {
          const cfg = typeConfig[r.type] || typeConfig.visit;
          const Icon = cfg.icon;
          const isOpen = expanded === r.id;
          return (
            <div key={r.id} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0 w-8">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${cfg.color === 'blue' ? 'bg-blue-500/10 text-blue-500' : cfg.color === 'purple' ? 'bg-purple-500/10 text-purple-500' : cfg.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  <Icon size={14} />
                </div>
                {i < records.length - 1 && <div className="w-0.5 flex-1" style={{ background: 'var(--border-default)' }} />}
              </div>
              <div className="card-base flex-1 mb-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${cfg.color === 'blue' ? 'bg-blue-500/10 text-blue-500' : cfg.color === 'purple' ? 'bg-purple-500/10 text-purple-500' : cfg.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{r.type}</span>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{r.title}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.doctor_name} · {new Date(r.date).toLocaleDateString()}</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <AnimatePresence>
                  {isOpen && r.notes && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="mt-3 pt-3 text-sm leading-relaxed border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>{r.notes}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {records.length === 0 && <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No health records yet. Add your first record above!</p>}
    </motion.div>
  );
}
