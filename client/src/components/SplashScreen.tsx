import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Branded splash — ring draws itself, leaf springs in, wordmark + tagline rise.
 * Shown once per session (gated by the caller via sessionStorage), skippable by
 * click / any key, and instant under prefers-reduced-motion.
 */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();

  // Auto-advance, and let any key skip.
  useEffect(() => {
    const hold = reduce ? 0 : 2200;
    const timer = setTimeout(onDone, hold);
    const onKey = () => onDone();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone, reduce]);

  return (
    <motion.div
      role="presentation"
      onClick={onDone}
      className="fixed inset-0 z-[100] grid place-items-center bg-canvas cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* soft radial glow behind the mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--color-brand-tint), transparent)' }}
      />

      <div className="relative flex flex-col items-center gap-6">
        <svg viewBox="0 0 64 64" className="h-48 w-48">
          <circle
            cx="32"
            cy="32"
            r="15"
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="4.5"
            pathLength={1}
            className={reduce ? undefined : 'splash-ring'}
          />
          <motion.path
            d="M32 22.5c-6 5-6 12 0 17 6-5 6-12 0-17Z"
            fill="var(--color-brand)"
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.55, type: 'spring', stiffness: 220, damping: 14 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
          <motion.path
            d="M32 25v12"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          />
        </svg>

        <motion.div
          className="text-center"
          initial={reduce ? false : { y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="text-4xl font-bold tracking-tight text-ink">MacroLeaf</div>
          <div className="mt-2 text-lg text-muted">Fuel, balanced.</div>
        </motion.div>
      </div>

      <button
        onClick={onDone}
        className="absolute bottom-6 right-6 text-xs font-medium text-faint hover:text-muted transition-colors"
      >
        Skip
      </button>
    </motion.div>
  );
}
