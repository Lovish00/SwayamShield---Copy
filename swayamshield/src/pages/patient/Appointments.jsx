import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, Clock, IndianRupee, X, CalendarDays, CheckCircle2 } from 'lucide-react';
import { hospitalAPI, appointmentAPI } from '../../lib/api';

const PAST_DATE_ERROR = 'Appointments cannot be booked for past dates.';

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Appointments() {
  const today = useMemo(() => getTodayDateString(), []);

  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [booking, setBooking] = useState(null);
  const [bookDate, setBookDate] = useState(today);
  const [bookTime, setBookTime] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    hospitalAPI.specialties().then((r) => setSpecialties(r.data)).catch(() => {});
    loadDoctors(null, today);
  }, [today]);

  const loadDoctors = (spec = selectedSpec, date = selectedDate) => {
    const params = { date };
    if (spec) params.specialty = spec;
    hospitalAPI.doctors(params).then((r) => setDoctors(r.data)).catch(() => {});
  };

  const handleSpecClick = (name) => {
    const newSpec = selectedSpec === name ? null : name;
    setSelectedSpec(newSpec);
    loadDoctors(newSpec, selectedDate);
  };

  const handleDateFilterChange = (value) => {
    if (value < today) {
      setErrorMessage(PAST_DATE_ERROR);
      return;
    }

    setErrorMessage('');
    setSelectedDate(value);
    setBookDate(value);
    loadDoctors(selectedSpec, value);
  };

  const filtered = doctors.filter(
    (d) =>
      !search ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.hospital_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBook = async () => {
    if (!bookDate || !bookTime || !booking) return;

    if (bookDate < today) {
      setErrorMessage(PAST_DATE_ERROR);
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await appointmentAPI.book({
        doctor_id: booking.id,
        hospital_id: booking.hospital_id,
        date: bookDate,
        time: bookTime,
        type: 'consultation',
        notes: '',
        telemedicine_link: ''
      });
      setSuccess(true);
      loadDoctors(selectedSpec, selectedDate);
      setTimeout(() => {
        setBooking(null);
        setSuccess(false);
        setBookTime('');
      }, 1800);
    } catch (err) {
      const message = err.response?.data?.error || 'Booking failed';
      if (message === 'You already have an appointment scheduled at this time.') {
        window.alert('You already have an appointment scheduled at this time.');
      }
      setErrorMessage(message);
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Book an Appointment</h1>
      <p className="text-sm -mt-3" style={{ color: 'var(--text-secondary)' }}>Choose a specialty, pick a date, and find the right doctor</p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,220px] gap-3">
        <div className="flex items-center gap-3 px-4 rounded-xl border h-11" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search doctors, hospitals..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        <label className="flex items-center gap-2 px-3 rounded-xl border h-11" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            min={today}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
        </label>
      </div>

      {errorMessage && (
        <p className="text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {specialties.map((s) => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSpecClick(s.name)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedSpec === s.name ? 'bg-blue-500/10 border-blue-500 text-blue-500 font-semibold' : ''
            }`}
            style={selectedSpec !== s.name ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-card)' } : {}}
          >
            <span>{s.icon}</span>
            {s.name}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((doc) => {
            const isAvailableForDate = doc.is_available_for_date ?? doc.available;
            const slotsLeft = doc.daily_limit ? Math.max(doc.daily_limit - doc.appointment_count, 0) : null;

            return (
              <motion.div key={doc.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <div className="card-base flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                      {doc.full_name?.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isAvailableForDate ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {isAvailableForDate ? 'Available' : 'Fully Booked'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{doc.full_name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{doc.hospital_name}</p>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}><Star size={12} /> {doc.rating}</span>
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}><Clock size={12} /> {doc.experience}y</span>
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}><IndianRupee size={12} /> {doc.fee}</span>
                  </div>

                  {doc.daily_limit ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {doc.appointment_count}/{doc.daily_limit} booked{slotsLeft !== null ? ` - ${slotsLeft} slots left` : ''}
                    </p>
                  ) : null}

                  {!isAvailableForDate && (
                    <p className="text-xs text-red-500">Doctor is fully booked for this date. Please select another date.</p>
                  )}

                  <button
                    disabled={!isAvailableForDate}
                    onClick={() => {
                      setErrorMessage('');
                      setBookDate(selectedDate);
                      setBookTime('');
                      setBooking(doc);
                    }}
                    className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${isAvailableForDate ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:opacity-90' : 'border text-gray-400 cursor-not-allowed'}`}
                    style={!isAvailableForDate ? { borderColor: 'var(--border-default)' } : {}}
                  >
                    {isAvailableForDate ? 'Book Appointment' : 'Not Available'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No doctors found</p>}

      <AnimatePresence>
        {booking && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setBooking(null);
              setSuccess(false);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--bg-card-solid)' }}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              {success ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={42} className="text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-emerald-500 mb-2">Appointment Booked</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Your appointment with {booking.full_name} is confirmed.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Book Appointment</h3>
                    <button onClick={() => setBooking(null)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                      {booking.full_name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{booking.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{booking.hospital_name}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Select Date</label>
                      <input
                        type="date"
                        value={bookDate}
                        min={today}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value < today) {
                            setErrorMessage(PAST_DATE_ERROR);
                            return;
                          }
                          setErrorMessage('');
                          setBookDate(value);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Select Time</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setBookTime(t)}
                            className={`py-2 rounded-xl text-xs font-medium border transition-colors ${bookTime === t ? 'bg-blue-500/10 border-blue-500 text-blue-500' : ''}`}
                            style={bookTime !== t ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : {}}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleBook}
                      disabled={!bookDate || !bookTime || loading}
                      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Confirm Booking - Rs {booking.fee}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
