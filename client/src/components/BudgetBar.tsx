export type BudgetTone = 'calories' | 'protein' | 'carbs' | 'fat';

interface Props {
  label: string;
  current: number;
  target: number;
  unit: string;
  tone?: BudgetTone;
}

// Brand fill per macro; over/near-budget signals still override.
const TONE_FILL: Record<BudgetTone, string> = {
  calories: 'bg-ink',
  protein: 'bg-protein',
  carbs: 'bg-carbs',
  fat: 'bg-fat',
};

export default function BudgetBar({ label, current, target, unit, tone = 'calories' }: Props) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;
  const near = pct > 90 && !over;
  const remaining = target - current;

  const fill = over ? 'bg-danger' : near ? 'bg-warning' : TONE_FILL[tone];

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className={over ? 'font-medium text-danger' : 'text-muted'}>
          {Math.round(current)} / {target} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-0.5 text-xs ${over ? 'text-danger' : 'text-faint'}`}>
        {over ? `${Math.round(-remaining)} ${unit} over` : `${Math.round(remaining)} ${unit} remaining`}
      </p>
    </div>
  );
}
