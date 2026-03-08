import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Bed, Ambulance, Activity, Stethoscope, RefreshCw, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { detectCurrentLocation } from '../../lib/location';

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

// Mock Data for the Smart Grid Map Nodes
const mockHospitals = [
  { id: 1, name: 'Cosmo Hospital Mohali', doctors: 45, beds: 120, ambulances: 8, x: 20, y: 30 },
  { id: 2, name: 'Max Super Speciality', doctors: 82, beds: 250, ambulances: 12, x: 60, y: 15 },
  { id: 3, name: 'Fortis Healthcare', doctors: 60, beds: 180, ambulances: 10, x: 80, y: 55 },
  { id: 4, name: 'Civil Hospital Ooty', doctors: 18, beds: 80, ambulances: 3, x: 40, y: 70 },
  { id: 5, name: 'Eden Critical Care', doctors: 25, beds: 45, ambulances: 5, x: 15, y: 80 },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Aggregated Mock Metrics for the requested design
  const [resourceMetrics] = useState({
    beds: 675,
    ambulances: 38,
    doctors: 230,
    erCapacity: '78%'
  });

  useEffect(() => {
    const initLocation = async () => {
      setLocating(true);
      try {
        const coords = await detectCurrentLocation();
        if (coords.latitude > 30 && coords.latitude < 31 && coords.longitude > 76 && coords.longitude < 77) {
            setCity('Chandigarh');
        } else {
            setCity('Chandigarh'); // Default
        }
      } catch (err) {
        setCity('Chandigarh');
      } finally {
        setLocating(false);
      }
    };
    initLocation();
  }, []);

  const statCards = [
    { title: 'Total Available Beds', value: resourceMetrics.beds, icon: Bed, color: 'blue' },
    { title: 'Available Ambulances', value: resourceMetrics.ambulances, icon: Ambulance, color: 'red' },
    { title: 'Doctors On Duty', value: resourceMetrics.doctors, icon: Stethoscope, color: 'emerald' },
    { title: 'Emergency Ward Capacity', value: resourceMetrics.erCapacity, icon: Activity, color: 'purple' },
  ];

  const cl = { 
      blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20', 
      red: 'bg-red-500/10 text-red-500 border-red-500/20',
      emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', 
      purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20' 
  };

  const adminName = user?.full_name?.split(' ')[0] || 'Administrator';

  return (
    <motion.div className="flex flex-col gap-6 w-full max-w-7xl mx-auto" variants={container} initial="hidden" animate="visible">
      
      {/* Dynamic Header Section */}
      <motion.div variants={item} className="p-8 rounded-3xl border relative overflow-hidden flex flex-col justify-center bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--border-default)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 z-10 w-full relative">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              Welcome back, {adminName}
            </h1>
            <p className="text-sm font-medium opacity-90" style={{ color: 'var(--text-secondary)' }}>
              Monitor and manage aggregated healthcare resources across your designated region.
            </p>
          </div>
          
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
             {locating ? (
                <>
                  <RefreshCw size={18} className="text-blue-500 animate-spin" />
                  <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Locating...</span>
                </>
             ) : (
                <>
                  <MapPin size={20} className="text-red-500" />
                  <div className="flex flex-col">
                     <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Current Region</span>
                     <span className="text-base font-extrabold text-zinc-800 dark:text-锌-200 leading-tight">{city} Aggregation</span>
                  </div>
                </>
             )}
          </div>
        </div>
      </motion.div>

      {/* Aggregated Resource Metrics */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" variants={item}>
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transform group-hover:scale-110 transition-transform duration-500 ${cl[s.color].split(' ')[1]}`}>
                 <Icon size={120} />
              </div>
              
              <div className="flex items-start justify-between z-10">
                 <div className={`w-14 h-14 rounded-[1rem] flex items-center justify-center border shadow-inner ${cl[s.color]}`}>
                   <Icon size={28} />
                 </div>
              </div>
              
              <div className="flex flex-col z-10 mt-2">
                <span className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
                <span className="text-xs font-bold uppercase tracking-wider mt-1 text-zinc-500 dark:text-zinc-400">{s.title}</span>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Smart Grid Hospital Network Map */}
      <motion.div variants={item} className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 lg:p-8 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
          {/* Map Grid Background */}
          <div className="absolute inset-0 pointer-events-none" style={{ 
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)', 
              backgroundSize: '40px 40px' 
            }} 
          />
          <div className="absolute inset-0 bg-blue-500/5 blur-[100px] pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 mb-8 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30">
                   <MapPin size={22} className="text-blue-400" />
                </div>
                <div>
                   <h2 className="text-2xl font-black tracking-tight text-white mb-0.5">Live Infrastructure Grid</h2>
                   <p className="text-sm font-semibold text-zinc-400">Monitoring real-time capacity across the {city} network.</p>
                </div>
             </div>
             <div className="hidden md:flex items-center gap-2 bg-zinc-900/80 backdrop-blur border border-zinc-800 px-4 py-2 rounded-xl">
                 <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                 <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Network Active</span>
             </div>
          </div>

          {/* Map Area */}
          <div className="relative flex-1 w-full bg-zinc-900/20 border border-zinc-800/50 rounded-2xl overflow-hidden group">
             {mockHospitals.map((hospital) => (
                <div 
                   key={hospital.id}
                   className="absolute group/node z-20 cursor-crosshair transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125 hover:z-30"
                   style={{ left: `${hospital.x}%`, top: `${hospital.y}%` }}
                   onMouseEnter={() => setHoveredNode(hospital)}
                   onMouseLeave={() => setHoveredNode(null)}
                >
                   {/* Glowing Pulse */}
                   <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-md animate-ping" style={{ animationDuration: '3s' }} />
                   
                   {/* Node Core */}
                   <div className="relative w-6 h-6 rounded-full bg-blue-500 border-[3px] border-zinc-950 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                   </div>
                </div>
             ))}

             {/* Hover info Panel overlaying the map securely inside the container */}
             <AnimatePresence>
                {hoveredNode && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute z-50 p-4 rounded-xl bg-zinc-900/95 backdrop-blur-md border border-zinc-700 shadow-2xl pointer-events-none"
                     style={{ 
                         left: `clamp(16px, ${hoveredNode.x}%, calc(100% - 240px))`, 
                         top: `clamp(16px, ${hoveredNode.y - 10}%, calc(100% - 140px))` 
                     }}
                   >
                     <div className="w-56 flex flex-col gap-3">
                        <div className="flex items-start gap-2 border-b border-zinc-800 pb-2">
                           <Building2 size={16} className="text-blue-400 mt-1" />
                           <h4 className="text-sm font-bold text-white leading-tight">{hoveredNode.name}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="flex flex-col">
                             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Beds</span>
                             <span className="text-sm font-extrabold text-blue-400 flex items-center gap-1.5"><Bed size={12}/> {hoveredNode.beds}</span>
                           </div>
                           <div className="flex flex-col">
                             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Paramedic</span>
                             <span className="text-sm font-extrabold text-red-400 flex items-center gap-1.5"><Ambulance size={12}/> {hoveredNode.ambulances}</span>
                           </div>
                           <div className="flex flex-col col-span-2">
                             <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Doctors Online</span>
                             <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5"><Stethoscope size={12}/> {hoveredNode.doctors} Active Personnel</span>
                           </div>
                        </div>
                     </div>
                   </motion.div>
                )}
             </AnimatePresence>
          </div>
      </motion.div>
    </motion.div>
  );
}
