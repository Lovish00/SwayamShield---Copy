import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Phone, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ambulanceAPI } from '../../lib/api';

// Mock data generator for doctors based on department (Fallback)
const MOCK_DOCTORS = {
  cardiology: [
    { id: 'm1', name: 'Dr. Sarah Jenkins', spec: 'Cardiologist', degree: 'MD, FACC', phone: '+91 98765 01011', appointments: 14 },
    { id: 'm2', name: 'Dr. Michael Chen', spec: 'Interventional Cardiology', degree: 'MBBS, MD', phone: '+91 98765 01012', appointments: 8 },
    { id: 'm3', name: 'Dr. Emily Carter', spec: 'Pediatric Cardiologist', degree: 'MD, PhD', phone: '+91 98765 01013', appointments: 11 },
    { id: 'm4', name: 'Dr. Robert Patel', spec: 'Electrophysiologist', degree: 'MD, FACC', phone: '+91 98765 01014', appointments: 5 },
    { id: 'm5', name: 'Dr. Laura Smith', spec: 'Non-Invasive Cardiologist', degree: 'DO, FACC', phone: '+91 98765 01015', appointments: 18 },
  ],
  neurology: [
    { id: 'm11', name: 'Dr. Robert Frost', spec: 'Neurologist', degree: 'MD, FAAN', phone: '+91 98765 02011', appointments: 9 },
    { id: 'm12', name: 'Dr. Anita Desai', spec: 'Neurosurgeon', degree: 'MBBS, MS', phone: '+91 98765 02012', appointments: 5 },
    { id: 'm13', name: 'Dr. James Lin', spec: 'Vascular Neurology', degree: 'MD', phone: '+91 98765 02013', appointments: 12 },
    { id: 'm14', name: 'Dr. Maria Garcia', spec: 'Neuromuscular Medicine', degree: 'MD, PhD', phone: '+91 98765 02014', appointments: 7 },
  ],
  orthopedics: [
    { id: 'm21', name: 'Dr. James Wilson', spec: 'Orthopedic Surgeon', degree: 'MD, FAAOS', phone: '+91 98765 03011', appointments: 16 },
    { id: 'm22', name: 'Dr. Lisa Wong', spec: 'Sports Medicine', degree: 'MD', phone: '+91 98765 03012', appointments: 20 },
    { id: 'm23', name: 'Dr. David Miller', spec: 'Spine Specialist', degree: 'MBBS, MS', phone: '+91 98765 03013', appointments: 7 },
    { id: 'm24', name: 'Dr. Elena Rostova', spec: 'Joint Replacement', degree: 'MD', phone: '+91 98765 03014', appointments: 10 },
  ],
  pediatrics: [
    { id: 'm31', name: 'Dr. Mary Johnson', spec: 'Pediatrician', degree: 'MD, FAAP', phone: '+91 98765 04011', appointments: 22 },
    { id: 'm32', name: 'Dr. Ahmed Khan', spec: 'Neonatologist', degree: 'MBBS, MD', phone: '+91 98765 04012', appointments: 12 },
    { id: 'm33', name: 'Dr. Susan Clark', spec: 'Pediatric Neurologist', degree: 'MD', phone: '+91 98765 04013', appointments: 6 },
    { id: 'm34', name: 'Dr. William Turner', spec: 'Pediatric Care', degree: 'DO', phone: '+91 98765 04014', appointments: 15 },
    { id: 'm35', name: 'Dr. Jessica Lee', spec: 'Adolescent Medicine', degree: 'MD, FAAP', phone: '+91 98765 04015', appointments: 19 },
  ]
};

export default function HospitalDepartment() {
  const { departmentId } = useParams();
  const navigate = useNavigate();

  const [liveDoctors, setLiveDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Validate department
  const validDepartments = ['cardiology', 'neurology', 'orthopedics', 'pediatrics'];
  const isValid = validDepartments.includes(departmentId?.toLowerCase());
  const deptTitle = isValid ? departmentId.charAt(0).toUpperCase() + departmentId.slice(1) : '';

  useEffect(() => {
    if (!isValid) {
      setLoading(false);
      return;
    }

    const fetchLiveDoctors = async () => {
      try {
        const res = await ambulanceAPI.hospitalOverview();
        if (res.data?.doctors) {
          setLiveDoctors(res.data.doctors);
        }
      } catch (err) {
        console.error("Failed to fetch live doctors", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveDoctors();
  }, [isValid]);

  const deptData = useMemo(() => {
    if (!isValid) return [];
    
    // Filter live doctors by specialization matching department
    const realDocs = liveDoctors.filter(d => d.specialization?.toLowerCase() === departmentId.toLowerCase());
    
    // Map real doctors to our UI format
    const formattedRealDocs = realDocs.map(d => {
      let phoneNum = d.phone || '98765 43210';
      if (!phoneNum.startsWith('+91')) {
        // Simple prepending of +91 if lacking any international code
        phoneNum = phoneNum.startsWith('+') ? phoneNum : `+91 ${phoneNum}`;
      }

      return {
        id: d.id,
        name: d.full_name || 'Dr. Unknown',
        spec: d.specialization || deptTitle,
        degree: d.degree || 'MBBS, MD',
        phone: phoneNum,
        appointments: (d.full_name?.length || 5) * 2 % 12 + 2 // deterministic mock counts for UI
      };
    });

    if (formattedRealDocs.length > 0) {
      return formattedRealDocs;
    }

    // Fallback if no real ones found
    return MOCK_DOCTORS[departmentId.toLowerCase()] || [];
  }, [departmentId, isValid, liveDoctors, deptTitle]);

  if (!isValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <h2 className="text-3xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>Department Not Found</h2>
        <p className="text-base font-medium mb-6" style={{ color: 'var(--text-secondary)' }}>
          The requested medical department could not be located in this hospital centre.
        </p>
        <button 
          onClick={() => navigate('/hospital-centre/dashboard')} 
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full flex flex-col">
      {/* Header Area */}
      <div className="flex items-center gap-5 mb-8">
        <button 
          onClick={() => navigate('/hospital-centre/dashboard')}
          className="p-3 rounded-2xl border bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <ArrowLeft size={22} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {deptTitle} Department
          </h1>
          <p className="text-sm md:text-base font-semibold mt-1" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Checking available specialists...' : `${deptData.length} Specialists Available Today`}
          </p>
        </div>
      </div>

      {/* Vertical Doctor List */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center pt-20">
          <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
          <p className="text-sm font-bold text-zinc-500">Syncing Live Hospital Rosters...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
          <div className="flex flex-col gap-5">
            {deptData.map((doctor, index) => {
              const initials = doctor.name.replace('Dr. ', '').substring(0, 2).toUpperCase();
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  key={doctor.id}
                  className="bg-white dark:bg-zinc-900 rounded-[24px] p-5 md:p-6 border shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group flex flex-col sm:flex-row sm:items-center gap-6"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  {/* Doctor Avatar Badge */}
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-black flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300 border border-indigo-400/50">
                    {initials}
                  </div>
                  
                  {/* Doctor Info Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl md:text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                          {doctor.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-sm md:text-base font-black text-indigo-500 dark:text-indigo-400">
                            {doctor.spec}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-600">•</span>
                          <span className="text-sm md:text-base font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg text-zinc-600 dark:text-zinc-400">
                            {doctor.degree}
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 shadow-sm">
                          <Users size={18} />
                          <span className="text-[13px] md:text-sm font-black tracking-wide uppercase">{doctor.appointments} Appointments of the Day</span>
                        </div>
                      </div>
                    </div>

                    {/* Divider and Footer Details */}
                    <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-6" style={{ borderColor: 'var(--border-default)' }}>
                      <div className="flex items-center gap-2 text-sm font-bold bg-zinc-50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800" style={{ color: 'var(--text-primary)' }}>
                        <Phone size={16} className="text-indigo-500" />
                        <span className="tracking-wide">{doctor.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-500">
                        <User size={16} />
                        <span>Accepting New Patients Today</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
