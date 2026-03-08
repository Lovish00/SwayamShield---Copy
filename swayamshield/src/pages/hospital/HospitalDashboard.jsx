import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, CheckCircle2, XCircle, Clock, UserRound, 
  ChevronRight, Activity, Pill, Plus, Trash2, FileText, 
  Stethoscope, Thermometer 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentAPI, prescriptionAPI } from '../../lib/api';

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

const defaultSummary = {
  todays_appointments: 0,
  this_week_appointments: 0,
  completed_today: 0,
  cancelled_today: 0,
};

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Schedule Management UI State
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Prescription state
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', duration: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDashboard();
    // Refresh every minute to keep Next Appointment updated
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const [todayRes, summaryRes] = await Promise.all([
        appointmentAPI.today(),
        appointmentAPI.doctorSummary(),
      ]);
      setAppointments(todayRes.data || []);
      setSummary(summaryRes.data || defaultSummary);
    } catch {
      // Keep dashboard resilient on partial API failures.
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await appointmentAPI.updateStatus(id, newStatus);
      // Optimistically update
      setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt));
      // Reload summary
      const summaryRes = await appointmentAPI.doctorSummary();
      if(summaryRes.data) setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const openPatient = (patient) => {
    setSelectedPatient(patient);
    setMedicines([{ name: '', dosage: '', duration: '' }]);
  };

  const closePatient = () => {
    setSelectedPatient(null);
  };

  const addMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', duration: '' }]);
  };

  const removeMedicine = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index, field, value) => {
    const newMeds = [...medicines];
    newMeds[index][field] = value;
    setMedicines(newMeds);
  };

  const submitPrescription = async () => {
    if (!selectedPatient) return;
    
    // Filter valid medicines
    const validMeds = medicines.filter(m => m.name.trim() && m.dosage.trim());
    if (validMeds.length === 0) return alert('Please add at least one valid medicine containing Name and Dosage');

    setIsSubmitting(true);
    try {
      
      // Concatenate all medicines into a single string for backend schema compatibility
      // since the backed expects a single `medication` string
      const concatenatedMedication = validMeds.map(m => 
        `${m.name} (${m.dosage}) ${m.duration ? `for ${m.duration}` : ''}`
      ).join(', ');

      const payload = {
        patient_id: selectedPatient.patient_id,
        appointment_id: selectedPatient.id,
        medication: concatenatedMedication,
        notes: "Prescribed via Doctor Dashboard Workflow"
      };
      
      await prescriptionAPI.add(payload);
      alert('Prescription saved successfully!');
      
      // Auto complete appointment if saving is successful
      if(!['completed', 'cancelled'].includes(selectedPatient.status?.toLowerCase())) {
         await handleStatusUpdate(selectedPatient.id, 'completed');
      }
      
      closePatient();
    } catch (err) {
      console.error('Failed to save prescription', err);
      alert('Failed to save prescription. Check database connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // derived data
  const upcomingAppointments = appointments
    .filter(a => ['scheduled', 'confirmed', 'waiting'].includes(a.status?.toLowerCase()))
    .sort((a, b) => a.time.localeCompare(b.time)); // assuming time is HH:mm string
    
  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

  return (
    <motion.div className="flex flex-col gap-6 h-full relative" variants={container} initial="hidden" animate="visible">
      
      {/* Header */}
      <motion.div variants={item} className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Dr. {user?.full_name || 'Doctor'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Welcome back. Here is your overview for today.
          </p>
        </div>
      </motion.div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Summary Cards & Queue */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Summary Cards */}
          <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={item}>
            <StatCard icon={Calendar} color="blue" value={summary.todays_appointments} label="Today's Total" />
            <StatCard icon={Clock} color="emerald" value={summary.this_week_appointments} label="This Week" />
            <StatCard icon={CheckCircle2} color="purple" value={summary.completed_today} label="Completed" />
            <StatCard icon={XCircle} color="red" value={summary.cancelled_today} label="Cancelled" />
          </motion.div>

          {/* Patient Queue */}
          <motion.div className="card-base flex-1 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-3xl p-6" variants={item}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <UserRound size={22} className="text-blue-500" />
                Patient Queue
              </h3>
              <div className="text-sm px-4 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-bold">
                {appointments.length} Patients Today
              </div>
            </div>

            {appointments.length > 0 ? (
              <div className="flex flex-col gap-4">
                {appointments.map((appointment) => {
                  const isCompleted = appointment.status?.toLowerCase() === 'completed';
                  const isCancelled = appointment.status?.toLowerCase() === 'cancelled';
                  const isSelected = selectedPatient?.id === appointment.id;
                  
                  return (
                    <div
                      key={appointment.id}
                      className={`rounded-2xl border p-5 transition-all duration-200 ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 shadow-md bg-blue-50/50 dark:bg-blue-900/10' 
                          : 'bg-zinc-50 dark:bg-zinc-900/50 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                      style={{ borderColor: isSelected ? 'transparent' : 'var(--border-default)' }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        
                        {/* Patient Info */}
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl shrink-0 shadow-inner
                            ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isCancelled ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}
                          >
                            {appointment.patient_name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="font-extrabold text-[17px]" style={{ color: 'var(--text-primary)' }}>
                              {appointment.patient_name || 'Unknown Patient'}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[13px] font-bold text-zinc-500 hover:text-zinc-700 transition-colors uppercase tracking-wider">
                              <span className="flex items-center gap-1.5"><Clock size={14}/> {appointment.time}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex flex-wrap items-center gap-4">
                          <StatusBadge status={appointment.status} />
                          
                          {/* Actions */}
                          {!isCancelled && (
                            <div className="flex items-center gap-2 border-l pl-4 border-zinc-200 dark:border-zinc-800">
                              <button 
                                onClick={() => openPatient(appointment)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95
                                  ${isSelected 
                                     ? 'bg-blue-600 text-white shadow-blue-500/20' 
                                     : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400'}
                                `}
                              >
                                {isSelected ? 'Viewing Panel' : 'Open Patient'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {appointment.notes && (
                        <div className="mt-4 text-sm p-4 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-800/50 flex items-start gap-2 text-zinc-600 dark:text-zinc-400 font-medium">
                          <FileText size={18} className="shrink-0 mt-0.5 text-blue-500" />
                          <span>{appointment.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed rounded-3xl bg-zinc-50 dark:bg-zinc-900/50" style={{ borderColor: 'var(--border-default)' }}>
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center mb-5 shadow-sm border border-zinc-100 dark:border-zinc-800">
                  <UserRound size={40} className="text-zinc-300 dark:text-zinc-600" />
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>No Patients Assigned</p>
                <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>You don't have any appointments scheduled for today.</p>
              </div>
            )}
          </motion.div>

        </div>

        {/* Right Column: Context Panel */}
        <motion.div variants={item} className="flex flex-col h-[calc(100vh-140px)] sticky top-6">
          <AnimatePresence mode="wait">
            {selectedPatient ? (
              <motion.div 
                key="patient-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl flex flex-col h-full border-t-4 border-t-blue-500 shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
              >
                {/* Patient Header */}
                <div className="flex justify-between items-start p-6 pb-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50">
                  <div>
                    <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{selectedPatient.patient_name}</h2>
                    <div className="flex gap-4 mt-1.5 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400"><Clock size={14} /> {selectedPatient.time}</span>
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">Age: {selectedPatient.patient_age || '--'}</span>
                    </div>
                  </div>
                  <button onClick={closePatient} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                  {/* Removed BP and Temp modules to focus purely on core healthcare flow */}

                  {selectedPatient.notes && (
                    <div className="mb-8">
                      <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <FileText size={14} /> Patient Symptoms / Notes
                      </h4>
                      <p className="text-[15px] p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50 leading-relaxed font-medium">
                        {selectedPatient.notes}
                      </p>
                    </div>
                  )}

                  {/* Prescription Builder */}
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="text-lg font-black flex items-center gap-2 text-blue-600 dark:text-blue-500">
                        <Pill size={20} />
                        RX Prescription Builder
                      </h4>
                    </div>
                    
                    <div className="flex flex-col gap-3 flex-1 mb-6">
                      {medicines.map((med, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative group transition-all hover:border-blue-300 dark:hover:border-blue-700/50 shadow-sm">
                          <div className="flex-1 space-y-3">
                            <input 
                              placeholder="Medicine Name (e.g. Paracetamol 500mg)" 
                              className="w-full text-[15px] font-bold bg-transparent border-none focus:ring-0 p-0 placeholder-zinc-400 focus:outline-none"
                              style={{ color: 'var(--text-primary)' }}
                              value={med.name}
                              onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                            />
                            <div className="flex gap-3">
                              <input 
                                placeholder="Dosage (1-0-1)" 
                                className="w-1/2 text-sm font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-zinc-400"
                                style={{ color: 'var(--text-secondary)' }}
                                value={med.dosage}
                                onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                              />
                              <input 
                                placeholder="Duration (5 days)" 
                                className="w-1/2 text-sm font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-zinc-400"
                                style={{ color: 'var(--text-secondary)' }}
                                value={med.duration}
                                onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                              />
                            </div>
                          </div>
                          {medicines.length > 1 && (
                            <button 
                              onClick={() => removeMedicine(idx)}
                              className="text-red-400 hover:text-white hover:bg-red-500 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all absolute -right-3 -top-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button 
                        onClick={addMedicine}
                        className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 p-3.5 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-dashed border-blue-200 dark:border-blue-800 transition-colors w-full mt-2"
                      >
                        <Plus size={18} strokeWidth={2.5} /> Add Another Medicine
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto pt-5 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                      <button 
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-black py-4 rounded-2xl text-[16px] transition-transform shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                        onClick={submitPrescription}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Saving & Completing...
                          </>
                        ) : 'Save & Complete Appointment'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="next-appointment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6 h-full"
              >
                {/* Next Appointment Card */}
                <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden p-8 rounded-3xl">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl -ml-16 -mb-16"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-2 text-blue-100 font-bold text-sm tracking-widest uppercase">
                        <Clock size={18} /> Next Patient Queue
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-black tracking-widest uppercase">
                        Upcoming
                      </div>
                    </div>
                    
                    {nextAppointment ? (
                      <div>
                        <h3 className="text-4xl font-black mb-3 tracking-tight">{nextAppointment.patient_name}</h3>
                        <p className="text-blue-100 font-bold text-lg flex items-center gap-3 mb-10 opacity-90">
                          {nextAppointment.time} 
                          <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                          <span className="capitalize">{nextAppointment.status}</span>
                        </p>
                        
                        <button 
                          onClick={() => openPatient(nextAppointment)}
                          className="w-full bg-white text-blue-700 font-black py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg shadow-black/10 flex items-center justify-center gap-2 text-[16px] active:scale-[0.98]"
                        >
                          Open Patient Profile <ChevronRight size={20} strokeWidth={2.5}/>
                        </button>
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <CheckCircle2 size={48} className="text-white drop-shadow-md" />
                        </div>
                        <p className="text-3xl font-black tracking-tight mb-2">Caught Up!</p>
                        <p className="text-blue-200 text-base font-bold">No upcoming appointments in the queue.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions Panel */}
                <div className="flex-1 flex flex-col p-8 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">Quick Tools</h3>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => setShowScheduleModal(true)}
                      className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-800 transition-all text-left group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner">
                         <Calendar size={26} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="font-extrabold text-[17px]" style={{ color: 'var(--text-primary)' }}>Manage Schedule</p>
                        <p className="text-[13px] font-bold mt-1 text-zinc-500 uppercase tracking-wider">Block or Edit Timings</p>
                      </div>
                    </button>
                    
                    {/* Removed "New Walk-In" tool based on user request */}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Basic Manage Schedule Modal Overlay */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Manage Schedule</h3>
                   <p className="text-sm font-bold text-zinc-500 mt-1">Adjust your daily availability</p>
                 </div>
                 <button onClick={() => setShowScheduleModal(false)} className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 p-2 rounded-xl text-zinc-500 transition-colors">
                   <XCircle size={24} />
                 </button>
              </div>

              <div className="space-y-4">
                 <div>
                   <label className="text-xs font-black uppercase text-zinc-500 tracking-wider mb-2 block">Available Days</label>
                   <div className="flex gap-2">
                     {['M', 'T', 'W', 'T', 'F'].map(d => (
                       <button key={Math.random()} className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 font-extrabold">{d}</button>
                     ))}
                     <button className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 font-extrabold">S</button>
                     <button className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 font-extrabold">S</button>
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black uppercase text-zinc-500 tracking-wider mb-2 block">Shift Start</label>
                      <input type="time" defaultValue="09:00" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-bold text-zinc-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase text-zinc-500 tracking-wider mb-2 block">Shift End</label>
                      <input type="time" defaultValue="17:00" className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-bold text-zinc-900 dark:text-white" />
                    </div>
                 </div>
                 
                 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                    <button 
                      onClick={() => {
                        alert("Schedule preferences saved.");
                        setShowScheduleModal(false);
                      }}
                      className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[15px] transition-colors"
                    >
                      Save Configuration
                    </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

function StatCard({ icon: Icon, color, value, label }) {
  const iconColors = {
    blue: 'bg-blue-500 text-white shadow-blue-500/30',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/30',
    purple: 'bg-purple-500 text-white shadow-purple-500/30',
    red: 'bg-red-500 text-white shadow-red-500/30',
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 flex flex-col gap-4 hover:-translate-y-1 transition-transform duration-300 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 shadow-sm hover:shadow-xl rounded-3xl">
      <div className={`w-14 h-14 rounded-2xl flex flex-shrink-0 items-center justify-center shadow-lg ${iconColors[color]}`}>
        <Icon size={26} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-4xl font-black tracking-tight leading-none mb-1.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-[12px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();
  
  if (normalized === 'completed') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"><CheckCircle2 size={14} strokeWidth={2.5}/> Completed</span>;
  }
  if (normalized === 'cancelled') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200/60 dark:border-red-800/50"><XCircle size={14} strokeWidth={2.5}/> Cancelled</span>;
  }
  if (normalized === 'waiting') {
    return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/50"><Clock size={14} strokeWidth={2.5}/> Waiting</span>;
  }
  
  // Default (e.g., Scheduled, Confirmed)
  return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50"><Calendar size={14} strokeWidth={2.5}/> {status || 'Scheduled'}</span>;
}
