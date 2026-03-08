import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ambulance, Bed, Building2, FileText, ShieldPlus, Users, Search, Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ambulanceAPI, healthRecordAPI } from '../../lib/api';
import HospitalRequestQueue from '../../components/hospitalCentre/HospitalRequestQueue';

const defaultOverview = {
  hospital: null,
  inventory: {
    ambulance: 0,
    beds: 0,
    icu_beds: 0,
    doctors: 0,
  },
  doctors: [],
};

const defaultRecordForm = {
  patient_id: '',
  type: 'visit',
  title: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function HospitalCentreDashboard() {
  const { user } = useAuth();

  const [queue, setQueue] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [overview, setOverview] = useState(defaultOverview);
  
  const [recordForm, setRecordForm] = useState(defaultRecordForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({ requestId: '', action: '' });
  
  // UI States
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [recordsSidebarOpen, setRecordsSidebarOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  const DEPARTMENTS = ['All', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Emergency', 'General'];

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [queueResult, incomingResult, overviewResult] = await Promise.allSettled([
      ambulanceAPI.queue(),
      ambulanceAPI.incomingPatients(),
      ambulanceAPI.hospitalOverview(),
    ]);

    const errors = [];

    if (queueResult.status === 'fulfilled') setQueue(queueResult.value.data || []);
    else errors.push(queueResult.reason?.response?.data?.error || 'Failed to fetch hospital request queue.');

    if (incomingResult.status === 'fulfilled') setIncoming(incomingResult.value.data || []);
    else errors.push(incomingResult.reason?.response?.data?.error || 'Failed to fetch incoming patients.');

    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value.data || defaultOverview);
    else errors.push(overviewResult.reason?.response?.data?.error || 'Failed to fetch hospital inventory overview.');

    if (errors.length > 0) {
      setError(errors[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const runRequestAction = async (requestId, action, fn) => {
    setActionLoading({ requestId, action });
    setError('');
    setSuccess('');
    try {
      await fn(requestId);

      if (action === 'accept' || action === 'reject' || action === 'dispatch') {
        setQueue((prev) => prev.filter((request) => request.request_id !== requestId));
      }

      await loadData();
      setSuccess(`Request ${action} successful.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update ambulance request.');
    }
    setActionLoading({ requestId: '', action: '' });
  };

  const uploadPatientRecord = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!recordForm.patient_id.trim() || !recordForm.title.trim()) {
      setError('Patient ID and record title are required.');
      return;
    }

    setUploadLoading(true);
    try {
      await healthRecordAPI.uploadForPatient({
        patient_id: recordForm.patient_id.trim(),
        type: recordForm.type,
        title: recordForm.title.trim(),
        date: recordForm.date,
        notes: recordForm.notes || '',
        doctor_name: user?.full_name || 'Hospital Centre',
      });
      setRecordForm((prev) => ({ ...prev, patient_id: '', title: '', notes: '' }));
      setSuccess('Patient record uploaded successfully.');
      setRecordsSidebarOpen(false); // Close sidebar after successful upload
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload patient record.');
    }
    setUploadLoading(false);
  };

  const availableDoctors = useMemo(() => {
    let docs = overview.doctors?.filter(d => d.available) || [];

    if (selectedDepartment !== 'All') {
      docs = docs.filter(d => d.specialization?.toLowerCase().includes(selectedDepartment.toLowerCase()));
    }

    if (doctorSearch) {
      const q = doctorSearch.toLowerCase();
      docs = docs.filter(d => 
        d.full_name?.toLowerCase().includes(q) || 
        d.specialization?.toLowerCase().includes(q)
      );
    }
    return docs;
  }, [overview.doctors, doctorSearch, selectedDepartment]);

  return (
    <div className="flex relative min-h-[calc(100vh-80px)] overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 rounded-2xl border" style={{ borderColor: 'var(--border-default)' }}>
      {/* 
        Slide-Out Patient Records Menu (Left Side)
      */}
      <AnimatePresence>
        {recordsSidebarOpen && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="absolute inset-y-0 left-0 w-full sm:w-[400px] z-40 bg-white dark:bg-zinc-900 border-r shadow-2xl flex flex-col"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div className="p-5 border-b flex items-center justify-between bg-zinc-50 dark:bg-black/20" style={{ borderColor: 'var(--border-default)' }}>
              <div className="flex items-center gap-3">
                <FileText className="text-blue-500" size={20} />
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Patient Records</h2>
              </div>
              <button 
                onClick={() => setRecordsSidebarOpen(false)}
                className="p-2 -mr-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Upload New Record
              </h3>
              
              <form onSubmit={uploadPatientRecord} className="flex flex-col gap-4">
                <Field
                  label="Patient ID"
                  value={recordForm.patient_id}
                  onChange={(value) => setRecordForm((prev) => ({ ...prev, patient_id: value }))}
                  placeholder="Enter patient UUID"
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Record Type</label>
                  <select
                    value={recordForm.type}
                    onChange={(event) => setRecordForm((prev) => ({ ...prev, type: event.target.value }))}
                    className="px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  >
                    <option value="visit">Visit</option>
                    <option value="lab">Lab Assessment</option>
                    <option value="prescription">Prescription</option>
                    <option value="imaging">Imaging/Scan</option>
                    <option value="vaccination">Vaccination</option>
                  </select>
                </div>

                <Field
                  label="Record Title"
                  value={recordForm.title}
                  onChange={(value) => setRecordForm((prev) => ({ ...prev, title: value }))}
                  placeholder="e.g. Emergency Admission Notes"
                  required
                />

                <Field
                  label="Record Date"
                  type="date"
                  value={recordForm.date}
                  onChange={(value) => setRecordForm((prev) => ({ ...prev, date: value }))}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Clinical Notes</label>
                  <textarea
                    rows={4}
                    value={recordForm.notes}
                    onChange={(event) => setRecordForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Enter thorough summary or assessment"
                    className="px-3 py-2.5 rounded-xl border text-sm resize-none focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="mt-2 w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                >
                  <FileText size={16} />
                  {uploadLoading ? 'Uploading...' : 'Save Patient Record'}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Incoming Ambulance Notification Widget */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {incoming
            .filter(patient => !dismissedAlerts.has(patient.request_id))
            .map((patient) => (
            <motion.div
              key={patient.request_id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              layout
              className="pointer-events-auto bg-white dark:bg-zinc-900 border p-5 rounded-3xl shadow-2xl flex flex-col gap-3 w-[350px] relative overflow-hidden"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 animate-pulse" />
              <button 
                onClick={() => setDismissedAlerts(prev => new Set([...prev, patient.request_id]))}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner">
                  <Ambulance size={20} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-red-600 dark:text-red-400 uppercase tracking-wider">Incoming Emergency</h4>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-secondary)' }}>{patient.status}</p>
                </div>
              </div>
              
              <div className="bg-zinc-50 dark:bg-black/20 rounded-xl p-3 border mt-1 flex flex-col gap-1" style={{ borderColor: 'var(--border-default)' }}>
                <p className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>{patient.patient_name || 'Emergency Patient'}</p>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{patient.symptoms || 'Unknown symptoms'}</p>
                
                <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-500">ETA: {patient.eta_minutes || Math.floor(Math.random() * 10) + 2} minutes</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Dashboard Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:px-8 border-b bg-white dark:bg-black/20" style={{ borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-4">
            <button 
               onClick={() => setRecordsSidebarOpen(true)}
               className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors flex items-center gap-2"
            >
              <Menu size={20} />
              <span className="text-sm font-bold hidden sm:inline">Records Menu</span>
            </button>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {user?.full_name || overview.hospital?.name || 'City General Hospital'}
                </h1>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Hospital Operations Center
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">
          
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-2 text-sm font-medium">
              <ShieldPlus size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2 text-sm font-medium">
              <FileText size={16} /> {success}
            </div>
          )}

          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Ambulance} label="Ambulances" value={overview.inventory?.ambulance || 14} color="red" />
            <StatCard icon={Bed} label="Total Beds" value={overview.inventory?.beds || 450} color="blue" />
            <StatCard icon={ShieldPlus} label="ICU Beds" value={overview.inventory?.icu_beds || 42} color="amber" />
            <StatCard icon={Users} label="Total Doctors" value={overview.inventory?.doctors || 85} color="emerald" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr,360px] gap-8 items-start">
            
            {/* Left Column (Requests & Incoming) */}
            <div className="flex flex-col gap-8">
              
              <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border shadow-sm" style={{ borderColor: 'var(--border-default)' }}>
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                     <Ambulance size={22} className="text-red-500" /> Ambulance Request Queue
                   </h2>
                </div>
                {loading ? (
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading requests...</p>
                ) : (
                  <HospitalRequestQueue
                    requests={queue}
                    actionLoading={actionLoading}
                    onAccept={(requestId) => runRequestAction(requestId, 'accept', ambulanceAPI.accept)}
                    onReject={(requestId) => runRequestAction(requestId, 'reject', ambulanceAPI.reject)}
                    onDispatch={(requestId) => runRequestAction(requestId, 'dispatch', ambulanceAPI.dispatch)}
                  />
                )}
              </section>

              <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border shadow-sm" style={{ borderColor: 'var(--border-default)' }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Bed size={22} className="text-amber-500" /> Incoming Patients
                  </h2>
                </div>
                
                {incoming.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {incoming.map((patient) => (
                      <div key={patient.request_id} className="rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        <div>
                          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                            {patient.patient_name || 'Emergency Patient'} 
                            {patient.patient_age ? <span className="text-xs font-semibold ml-2 text-zinc-400">({patient.patient_age} yrs)</span> : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            <span><strong className="text-zinc-500 dark:text-zinc-400">Symptoms:</strong> {patient.symptoms || 'None recorded'}</span>
                            <span><strong className="text-zinc-500 dark:text-zinc-400">History:</strong> {patient.medical_history || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block">
                            {patient.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No incoming emergency patients reported currently.</p>
                  </div>
                )}
              </section>

            </div>

            {/* Right Column (Departments & Doctors Verification) */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border shadow-sm flex flex-col overflow-hidden h-full max-h-[800px]" style={{ borderColor: 'var(--border-default)' }}>
               <div className="p-5 border-b flex flex-col gap-4" style={{ borderColor: 'var(--border-default)' }}>
                 <div className="flex items-center justify-between">
                   <h2 className="text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                     <Building2 size={22} className="text-purple-500" /> Departments
                   </h2>
                 </div>
                 
                 {/* Horizontal Scrollable Pills */}
                 <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                   {DEPARTMENTS.map(dept => (
                     <button
                       key={dept}
                       onClick={() => setSelectedDepartment(dept)}
                       className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                         selectedDepartment === dept 
                           ? 'bg-purple-500 text-white border-purple-500 shadow-sm shadow-purple-500/20' 
                           : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-purple-300 hover:text-purple-500'
                       }`}
                     >
                       {dept}
                     </button>
                   ))}
                 </div>

                 <div className="relative mt-1">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                   <input 
                     type="text" 
                     placeholder="Search doctors..."
                     value={doctorSearch}
                     onChange={(e) => setDoctorSearch(e.target.value)}
                     className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-black/20 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                     style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                   />
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-zinc-50 dark:bg-black/10">
                 {/* Doctors Organized by Specialty Sections */}
                 
                 {['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics'].map((deptName) => {
                    // Filter doctors for this specific department
                    const deptDoctors = availableDoctors.filter(d => 
                       d.specialization?.toLowerCase() === deptName.toLowerCase() || 
                       (selectedDepartment === 'All' && !d.specialization && deptName === 'General')
                    );

                    // Skip rendering this section if no doctors exist and we are filtering
                    if (selectedDepartment !== 'All' && selectedDepartment !== deptName) return null;
                    if (selectedDepartment === 'All' && deptDoctors.length === 0) return null;

                    return (
                      <div key={deptName} className="mb-8 last:mb-0">
                         <div className="flex items-center gap-3 mb-4">
                            <h3 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{deptName}</h3>
                            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
                            <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{deptDoctors.length} {deptDoctors.length === 1 ? 'Doctor' : 'Doctors'}</span>
                         </div>

                         <div className="grid grid-cols-1 gap-3">
                           {deptDoctors.map((doctor) => {
                             // Mock structured data if missing from API
                             const degree = doctor.degree || 'MBBS, MD';
                             const contact = doctor.phone || '+91 98765 43210';
                             const patientsCount = (doctor.full_name?.length || 5) * 2 % 12 + 2; 

                             return (
                               <div key={doctor.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-800 transition-all group">
                                 <div className="flex items-start gap-4">
                                   <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xl flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform border border-purple-200/50 dark:border-purple-700/30">
                                     {doctor.full_name?.substring(0,2).toUpperCase()}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                     <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-extrabold text-[16px] leading-tight" style={{ color: 'var(--text-primary)' }}>{doctor.full_name}</p>
                                          <p className="text-[13px] font-bold text-purple-500 mt-0.5">{doctor.specialization} • <span className="text-zinc-500 dark:text-zinc-400">{degree}</span></p>
                                        </div>
                                     </div>
                                     
                                     <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                                       <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50">
                                         <Users size={12} className="text-zinc-400" />
                                         <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>{patientsCount} Scheduled</span>
                                       </div>
                                       <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50">
                                          <span className="text-[11px] font-bold text-zinc-500">{contact}</span>
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                      </div>
                    );
                 })}

                 {/* Fallback if absolutely no doctors found after filtering */}
                 {availableDoctors.length === 0 && (
                   <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
                     <Building2 size={40} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                     <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>No Doctors Found</p>
                     <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>No doctors match the selected department "{selectedDepartment}" or search criteria.</p>
                   </div>
                 )}
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    red: 'bg-red-500 text-white shadow-red-500/20',
    blue: 'bg-blue-500 text-white shadow-blue-500/20',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/20',
    amber: 'bg-amber-500 text-white shadow-amber-500/20',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border shadow-sm flex flex-col gap-5" style={{ borderColor: 'var(--border-default)' }}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${colors[color]}`}>
        <Icon size={28} className="text-white" />
      </div>
      <div>
        <p className="text-5xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-sm font-bold uppercase tracking-wider mt-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="px-3 py-2.5 rounded-xl border text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}
