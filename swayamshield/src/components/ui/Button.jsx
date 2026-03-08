import { motion } from 'framer-motion';

export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:opacity-90',
    secondary: 'border text-sm hover:bg-black/5',
    ghost: 'hover:bg-black/5',
    danger: 'bg-gradient-to-r from-red-500 to-red-700 text-white hover:opacity-90',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={variant === 'secondary' ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : variant === 'ghost' ? { color: 'var(--text-secondary)' } : {}}
      {...props}
    >
      {children}
    </motion.button>
  );
}
