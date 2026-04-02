interface Props {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export default function BudgetBar({ label, current, target, unit }: Props) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;
  const remaining = target - current;

  let barColor = 'bg-emerald-500';
  if (pct > 90) barColor = 'bg-yellow-500';
  if (over) barColor = 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={over ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {Math.round(current)} / {target} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs mt-0.5 ${over ? 'text-red-500' : 'text-gray-400'}`}>
        {over ? `${Math.round(-remaining)} ${unit} over` : `${Math.round(remaining)} ${unit} remaining`}
      </p>
    </div>
  );
}
