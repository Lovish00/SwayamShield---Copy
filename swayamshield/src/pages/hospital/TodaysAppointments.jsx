import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, Play, User, Phone, Mail, CalendarDays, FileText, XCircle, Pill } from 'lucide-react';
import { appointmentAPI, prescriptionAPI } from '../../lib/api';

const statusConfig = {
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/10 text-blue-500', icon: Clock },
  waiting: { label: 'Waiting', color: 'bg-amber-500/10 text-amber-500', icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-emerald-500/10 text-emerald-500', icon: Play },
  completed: { label: 'Completed', color: 'bg-purple-500/10 text-purple-500', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-500', icon: XCircle },
};

function createDefaultPrescription(patientId) {
  return {
    patient_id: patientId,
    medication: '',
    dosage: '',
    frequency: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    notes: '',
  };
}

export default function TodaysAppointments() {
  const [list, setList] = useState([]);
  const [statusLoadingId, setStatusLoadingId] = useState('');
  const [activePrescriptionFor, setActivePrescriptionFor] = useState('');
  const [prescriptionForms, setPrescriptionForms] = useState({});
  const [prescriptionLoadingFor, setPrescriptionLoadingFor] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    appointmentAPI.today().then((r) => setList(r.data || [])).catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    setStatusLoadingId(id);
    setError('');
    setFeedback('');

    try {
      await appointmentAPI.updateStatus(id, status);
      setList((prev) => prev.map((appointment) => (
        appointment.id === id ? { ...appointment, status } : appointment
      )));
      setFeedback(`Appointment marked as ${status}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update appointment status.');
    }

    setStatusLoadingId('');
  };

  const togglePrescriptionForm = (appointment) => {
    setError('');
    setFeedback('');
    setActivePrescriptionFor((prev) => (prev === appointment.id ? '' : appointment.id));
    setPrescriptionForms((prev) => (
      prev[appointment.id]
        ? prev
        : { ...prev, [appointment.id]: createDefaultPrescription(appointment.patient_id) }
    ));
  };

  const handlePrescriptionChange = (appointmentId, field, value) => {
    setPrescriptionForms((prev) => ({
      ...prev,
      [appointmentId]: {
        ...prev[appointmentId],
        [field]: value,
      },
    }));
  };

  const submitPrescription = async (appointment) => {
    const draft = prescriptionForms[appointment.id];
    if (!draft?.medication?.trim()) {
      setError('Medication name is required to add prescription.');
      return;
    }

    setPrescriptionLoadingFor(appointment.id);
    setError('');
    setFeedback('');

    try {
      await prescriptionAPI.add({
        ...draft,
        patient_id: appointment.patient_id,
      });

      setFeedback(`Prescription added for ${appointment.patient_name || 'patient'}.`);
      setActivePrescriptionFor('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add prescription.');
    }

    setPrescriptionLoadingFor('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Today's Appointments</h1>
      <p className="-mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{list.length} appointments today</p>

      {feedback && (
        <p className="text-sm px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {feedback}
        </p>
      )}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {list.map((appointment, index) => {
          const status = statusConfig[appointment.status] || statusConfig.confirmed;
          const StatusIcon = status.icon;
          const isStatusLoading = statusLoadingId === appointment.id;
          const isPrescriptionOpen = activePrescriptionFor === appointment.id;
          const prescription = prescriptionForms[appointment.id] || createDefaultPrescription(appointment.patient_id);

          return (
            <motion.div
              key={appointment.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-base flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {appointment.patient_name || 'Patient'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {appointment.patient_age ? `${appointment.patient_age} yrs` : 'Age not provided'}
                      {' - '}
                      {appointment.type || 'consultation'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    <Clock size={12} />
                    {appointment.time}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Info icon={Phone} text={appointment.patient_phone || 'Phone not available'} />
                <Info icon={Mail} text={appointment.patient_email || 'Email not available'} />
                <Info icon={CalendarDays} text={new Date(appointment.date).toLocaleDateString()} />
                <Info icon={FileText} text={appointment.notes || 'No patient notes'} />
              </div>

              <div className="flex flex-wrap gap-2">
                {(appointment.status === 'confirmed' || appointment.status === 'waiting') && (
                  <ActionButton onClick={() => updateStatus(appointment.id, 'in-progress')} disabled={isStatusLoading}>
                    {isStatusLoading ? 'Updating...' : 'Start'}
                  </ActionButton>
                )}
                {appointment.status === 'in-progress' && (
                  <ActionButton onClick={() => updateStatus(appointment.id, 'completed')} disabled={isStatusLoading}>
                    {isStatusLoading ? 'Updating...' : 'Complete'}
                  </ActionButton>
                )}
                {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                  <ActionButton danger onClick={() => updateStatus(appointment.id, 'cancelled')} disabled={isStatusLoading}>
                    {isStatusLoading ? 'Updating...' : 'Cancel'}
                  </ActionButton>
                )}

                {appointment.status !== 'cancelled' && (
                  <button
                    onClick={() => togglePrescriptionForm(appointment)}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    <Pill size={12} />
                    {isPrescriptionOpen ? 'Close Prescription' : 'Add Prescription'}
                  </button>
                )}
              </div>

              {isPrescriptionOpen && (
                <div className="rounded-xl border p-3 grid grid-cols-1 md:grid-cols-2 gap-2" style={{ borderColor: 'var(--border-default)' }}>
                  <Input
                    placeholder="Medicine name"
                    value={prescription.medication}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'medication', event.target.value)}
                  />
                  <Input
                    placeholder="Dosage (e.g. 1 tablet)"
                    value={prescription.dosage}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'dosage', event.target.value)}
                  />
                  <Input
                    placeholder="Frequency (e.g. Twice daily)"
                    value={prescription.frequency}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'frequency', event.target.value)}
                  />
                  <Input
                    type="date"
                    value={prescription.start_date}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'start_date', event.target.value)}
                  />
                  <Input
                    type="date"
                    value={prescription.end_date || ''}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'end_date', event.target.value)}
                  />
                  <textarea
                    rows={2}
                    placeholder="Prescription notes"
                    value={prescription.notes}
                    onChange={(event) => handlePrescriptionChange(appointment.id, 'notes', event.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={() => submitPrescription(appointment)}
                      disabled={prescriptionLoadingFor === appointment.id}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 disabled:opacity-60"
                    >
                      {prescriptionLoadingFor === appointment.id ? 'Saving...' : 'Save Prescription'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {list.length === 0 && (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          No appointments scheduled for today.
        </p>
      )}
    </motion.div>
  );
}

function ActionButton({ children, onClick, disabled, danger = false }) {
  const cls = danger
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-emerald-500 hover:bg-emerald-600';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white ${cls} disabled:opacity-60`}
    >
      {children}
    </button>
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

function Input(props) {
  return (
    <input
      {...props}
      className="px-3 py-2 rounded-lg border text-sm"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
    />
  );
}
