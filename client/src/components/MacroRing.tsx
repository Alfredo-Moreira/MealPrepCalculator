import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  /** px diameter */
  size?: number;
  thickness?: number;
  /** big number in the middle; defaults to total kcal from macros */
  centerValue?: string | number;
  centerLabel?: string;
}

const COLORS = {
  protein: 'var(--color-protein)',
  carbs: 'var(--color-carbs)',
  fat: 'var(--color-fat)',
};

/**
 * Donut showing the protein/carbs/fat calorie split — the brand's hero element.
 * Segments are sized by each macro's calorie contribution (P·4, C·4, F·9).
 */
export default function MacroRing({
  protein,
  carbs,
  fat,
  size = 132,
  thickness = 14,
  centerValue,
  centerLabel = 'kcal',
}: Props) {
  const reduce = useReducedMotion();

  const pCal = Math.max(0, protein) * 4;
  const cCal = Math.max(0, carbs) * 4;
  const fCal = Math.max(0, fat) * 9;
  const total = pCal + cCal + fCal;

  const r = (size - thickness) / 2;
  const cx = size / 2;
  const C = 2 * Math.PI * r;
  const gap = total > 0 ? 1.5 : 0; // visual separation between segments

  const segments =
    total > 0
      ? [
          { color: COLORS.protein, value: pCal },
          { color: COLORS.carbs, value: cCal },
          { color: COLORS.fat, value: fCal },
        ]
      : [];

  let acc = 0;
  const display = centerValue ?? Math.round(total);

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = Math.max(0, (seg.value / total) * C - gap);
          const offset = -acc;
          acc += (seg.value / total) * C;
          return (
            <motion.circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={offset}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            />
          );
        })}
      </svg>
      <div className="absolute text-center leading-none">
        <div className="text-xl font-bold text-ink">{display}</div>
        <div className="mt-0.5 text-[11px] uppercase tracking-wide text-faint">{centerLabel}</div>
      </div>
    </div>
  );
}
