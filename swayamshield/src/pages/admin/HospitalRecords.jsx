import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, Filter, Bed, Ambulance, Stethoscope, Activity, MapPin } from 'lucide-react';

const mockHospitals = [
  { id: 'H001', name: 'Cosmo Hospital Mohali', location: 'Mohali, Sector 62', doctors: 45, beds: 120, ambulances: 8, er: '85%' },
  { id: 'H002', name: 'Max Super Speciality', location: 'Chandigarh, Phase 6', doctors: 82, beds: 250, ambulances: 12, er: '92%' },
  { id: 'H003', name: 'Fortis Healthcare', location: 'Mohali, Sector 60', doctors: 60, beds: 180, ambulances: 10, er: '60%' },
  { id: 'H004', name: 'Civil Hospital Ooty', location: 'Ooty Central', doctors: 18, beds: 80, ambulances: 3, er: '45%' },
  { id: 'H005', name: 'Eden Critical Care', location: 'Chandigarh, Sector 17', doctors: 25, beds: 45, ambulances: 5, er: '98%' },
];

export default function HospitalRecords() {
  const [search, setSearch] = useState('');
  
  const filteredHospitals = mockHospitals.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-3xl border bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Building2 size={28} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Hospital Records</h1>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Manage and monitor all {mockHospitals.length} registered facilities in the network.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 min-w-[280px]" style={{ borderColor: 'var(--border-default)' }}>
            <Search size={18} className="text-zinc-400" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search hospitals or locations..." 
              className="flex-1 bg-transparent outline-none text-sm font-medium" 
              style={{ color: 'var(--text-primary)' }} 
            />
          </div>
          <button className="p-3 rounded-xl border bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition" style={{ borderColor: 'var(--border-default)' }}>
            <Filter size={18} className="text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Hospital Cards List */}
      <div className="flex flex-col gap-4">
        {filteredHospitals.map((hospital, i) => (
          <motion.div 
            key={hospital.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex flex-col lg:flex-row items-stretch gap-0 bg-white dark:bg-zinc-900 border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {/* Context Info */}
            <div className="p-6 lg:w-[40%] flex flex-col justify-center border-b lg:border-b-0 lg:border-r bg-zinc-50/50 dark:bg-zinc-950/20 group-hover:bg-transparent transition-colors" style={{ borderColor: 'var(--border-default)' }}>
               <div className="flex items-center gap-3 mb-3">
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full">
                    {hospital.id}
                 </span>
                 <span className="flex items-center gap-1 text-xs font-bold text-zinc-500">
                    <MapPin size={12} /> {hospital.location}
                 </span>
               </div>
               <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 leading-tight">
                 {hospital.name}
               </h3>
            </div>

            {/* Metrics Grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: 'var(--border-default)' }}>
               {/* Metric: Doctors */}
               <div className="p-5 flex flex-col items-center justify-center text-center gap-2">
                 <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1">
                   <Stethoscope size={18} />
                 </div>
                 <span className="text-3xl font-black text-zinc-900 dark:text-white leading-none">{hospital.doctors}</span>
                 <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Total Doctors</span>
               </div>

               {/* Metric: Beds */}
               <div className="p-5 flex flex-col items-center justify-center text-center gap-2 border-t-0">
                 <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-1">
                   <Bed size={18} />
                 </div>
                 <span className="text-3xl font-black text-zinc-900 dark:text-white leading-none">{hospital.beds}</span>
                 <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Available Beds</span>
               </div>

               {/* Metric: Ambulances */}
               <div className="p-5 flex flex-col items-center justify-center text-center gap-2">
                 <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center mb-1">
                   <Ambulance size={18} />
                 </div>
                 <span className="text-3xl font-black text-zinc-900 dark:text-white leading-none">{hospital.ambulances}</span>
                 <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Ambulances</span>
               </div>

               {/* Metric: ER Capacity */}
               <div className="p-5 flex flex-col items-center justify-center text-center gap-2">
                 <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1">
                   <Activity size={18} />
                 </div>
                 <span className="text-3xl font-black text-zinc-900 dark:text-white leading-none">{hospital.er}</span>
                 <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">ER Capacity</span>
               </div>
            </div>
          </motion.div>
        ))}

        {filteredHospitals.length === 0 && (
          <div className="p-12 text-center rounded-3xl border border-dashed flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <Building2 size={48} className="text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-lg font-bold text-zinc-400">No Hospitals Found</h3>
            <p className="text-sm font-medium text-zinc-500">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
