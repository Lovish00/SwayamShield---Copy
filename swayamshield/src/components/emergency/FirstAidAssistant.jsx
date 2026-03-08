import { PhoneCall, Building2, Phone } from 'lucide-react';

export default function FirstAidAssistant({ hospitalName = 'Cosmo Hospital Mohali', hospitalPhone = '+91 98765 43210' }) {
  return (
    <div className="card-base flex flex-col gap-5 p-6 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-3xl relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none" />

      {/* Header section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <PhoneCall size={20} className="text-red-600 dark:text-red-500" />
          <h3 className="text-xl font-black tracking-tight text-red-600 dark:text-red-500">
            Emergency Call
          </h3>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Instantly connect with the dispatching hospital for critical first-aid guidance.
        </p>
      </div>

      {/* Hospital Details Card */}
      <div className="flex flex-col gap-3 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Building2 size={24} />
          </div>
          <div className="flex flex-col">
            <h4 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {hospitalName}
            </h4>
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-500 mt-1">
              Dispatch Center
            </span>
          </div>
        </div>

        <div className="mt-2 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center gap-3 text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          <Phone size={18} className="text-zinc-400" />
          {hospitalPhone}
        </div>
      </div>

      {/* Call Action */}
      <div className="pt-2">
        <a
          href={`tel:${hospitalPhone}`}
          className="w-full py-4 rounded-2xl font-black text-lg text-white bg-red-600 hover:bg-red-700 hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-60 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          <PhoneCall size={22} className="animate-pulse" />
          Call Hospital Now
        </a>
        <p className="text-[11px] text-center font-bold mt-3 uppercase tracking-wider text-zinc-400">
          Direct secure line to emergency staff
        </p>
      </div>
    </div>
  );
}
