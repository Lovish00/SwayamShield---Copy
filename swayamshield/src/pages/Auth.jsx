import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Building2, ShieldCheck, Mail, Lock, User, Phone, MapPin, Stethoscope as StethIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../lib/api';
import ThemeToggle from '../components/ui/ThemeToggle';

const roleConfig = {
  patient: { icon: Heart, label: 'Patient', gradient: 'from-blue-500 to-blue-700', hasSignup: true },
  doctor: { icon: StethIcon, label: 'Doctor', gradient: 'from-emerald-500 to-emerald-700', hasSignup: true },
  hospital_centre: { icon: Building2, label: 'Hospital Centre', gradient: 'from-cyan-500 to-cyan-700', hasSignup: true },
  hospital: { icon: Building2, label: 'Hospital (Legacy)', gradient: 'from-cyan-500 to-cyan-700', hasSignup: true },
  admin: { icon: ShieldCheck, label: 'Admin', gradient: 'from-purple-500 to-purple-700', hasSignup: false },
};

export default function Auth() {
  const { role } = useParams();
  const normalizedRole = String(role || 'patient').replace('-', '_');
  const navigate = useNavigate();
  const { login } = useAuth();
  const config = roleConfig[normalizedRole] || roleConfig.patient;
  const Icon = config.icon;

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', hospital_name: '', specialty: '', address: '' });

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res;
      if (isLogin) {
        res = await authAPI.login({ email: form.email, password: form.password });
        
        // Strict Role Validation Check (Requested Feature)
        const loggedInRole = res.data.user.role;
        // The backend handles 'hospital' and 'hospital_centre' similarly in some legacy scenarios,
        // but for doctor vs patient vs hospital, we must strictly check.
        if (normalizedRole !== loggedInRole && 
           !(normalizedRole === 'hospital' && loggedInRole === 'hospital_centre') &&
           !(normalizedRole === 'hospital_centre' && loggedInRole === 'hospital')
        ) {
          setError('Wrong ID registered');
          setLoading(false);
          return;
        }
      } else {
        res = await authAPI.register({ ...form, role: normalizedRole });
      }

      const { user: userData, token } = res.data;
      login(userData, token);

      // Force navigation with window.location for reliability
      const roleDest = {
        patient: '/patient/dashboard',
        doctor: '/doctor/dashboard',
        hospital: '/hospital-centre/dashboard',
        hospital_centre: '/hospital-centre/dashboard',
        admin: '/admin/dashboard',
      };
      const dest = roleDest[userData.role] || '/';
      window.location.href = dest;
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.join(', ') || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute top-6 right-6"><ThemeToggle /></div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-base w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            <Icon size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{isLogin ? 'Sign In' : 'Create Account'}</h1>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{config.label}</span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm font-medium border" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <InputField icon={User} name="full_name" placeholder="Full Name" value={form.full_name} onChange={handleChange} required />
              <InputField icon={Phone} name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} />
              {(normalizedRole === 'hospital_centre' || normalizedRole === 'hospital') && (
                <>
                  <InputField icon={Building2} name="hospital_name" placeholder="Hospital / Clinic Name" value={form.hospital_name} onChange={handleChange} required />
                  <InputField icon={MapPin} name="address" placeholder="Address" value={form.address} onChange={handleChange} />
                </>
              )}
              {normalizedRole === 'doctor' && (
                <>
                  <InputField icon={Building2} name="hospital_name" placeholder="Hospital Name" value={form.hospital_name} onChange={handleChange} required />
                  <InputField icon={StethIcon} name="specialty" placeholder="Specialization" value={form.specialty} onChange={handleChange} required />
                  <InputField icon={MapPin} name="address" placeholder="Address (optional)" value={form.address} onChange={handleChange} />
                </>
              )}
            </>
          )}
          <InputField icon={Mail} name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <InputField icon={Lock} name="password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={handleChange} required />

          <button type="submit" disabled={loading}
            className={`mt-2 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${config.gradient} hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}>
            {loading && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {config.hasSignup && (
          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-semibold text-blue-500 hover:underline">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        )}

        <Link to="/" className="block text-center mt-4 text-sm font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
          ← Back to home
        </Link>
      </motion.div>
    </div>
  );
}

function InputField({ icon: Icon, ...props }) {
  return (
    <div className="flex items-center gap-3 px-4 rounded-xl border min-h-[48px]" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
      <Icon size={18} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
      <input {...props} className="flex-1 bg-transparent outline-none text-sm py-3" style={{ color: 'var(--text-primary)' }} />
    </div>
  );
}
