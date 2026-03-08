import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const icons = { light: Sun, dark: Moon, system: Monitor };
const labels = { light: 'Light Mode', dark: 'Dark Mode', system: 'System Default' };

export default function ThemeToggle({ compact = true }) {
  const { theme, cycleTheme } = useTheme();
  const Icon = icons[theme];

  return (
    <motion.button
      onClick={cycleTheme}
      title={labels[theme]}
      aria-label={`Switch theme — currently ${labels[theme]}`}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-colors"
      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
    >
      <AnimatePresence mode="wait">
        <motion.span key={theme} className="flex" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
          <Icon size={compact ? 16 : 18} />
        </motion.span>
      </AnimatePresence>
      {!compact && <span className="text-xs font-medium">{labels[theme]}</span>}
    </motion.button>
  );
}
