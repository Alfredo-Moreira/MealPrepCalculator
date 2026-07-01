import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { fetchUser, fetchProgress, fetchPlan, updateUser, deleteUser, deletePlan, verifyPin, createCheckin } from '../api';
import type { User, Profile, ProgressData, PlanStatus } from '../types';
import { STATUS_LABELS } from '../types';
import { isUnlocked, setUnlocked } from '../lib/pin';
import { Button, Card, Chip, Stat } from '../components/ui';
import PinModal from '../components/PinModal';
import ProgressPhotos from '../components/ProgressPhotos';
import LineChart from '../components/LineChart';
import type { ChartLine } from '../components/LineChart';
import {
  PlusIcon, ArrowRightIcon, EditIcon, TrashIcon, ChevronLeftIcon, MacroRingIcon, CalendarIcon, TargetIcon, ScaleIcon,
} from '../components/icons';

const COLORS = { brand: '#2E7D5B', protein: '#2E7D5B', carbs: '#E0A33C', fat: '#5B7C8D', slate: '#5B7C8D', faint: '#8A958C' };
const STATUS_TONE: Record<PlanStatus, 'brand' | 'neutral' | 'warning'> = {
  active: 'brand', completed: 'neutral', planned: 'warning', archived: 'neutral',
};

const ms = (d: string | null) => (d ? new Date(d).getTime() : NaN);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null);
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Profile[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [tab, setTab] = useState<'plans' | 'progress'>('plans');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [logging, setLogging] = useState(false);
  const [wWeight, setWWeight] = useState('');
  const [wDate, setWDate] = useState(todayISO());

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return Promise.all([fetchUser(id), fetchProgress(id)])
      .then(([u, prog]) => {
        setUser(u.user);
        setPlans(u.plans);
        setProgress(prog);
        setNeedsPin(Boolean(u.user.has_pin) && !isUnlocked(id));
      })
      .catch(() => setUser(null));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleDeletePlan = async (planId: string, name: string) => {
    if (!confirm(`Delete plan "${name}"? This removes its meals and check-ins. This cannot be undone.`)) return;
    await deletePlan(planId);
    load();
  };

  const saveName = async () => {
    if (!id || !editName.trim()) return setEditing(false);
    const u = await updateUser(id, { name: editName.trim() });
    setUser(u);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(`Delete "${user.name}" and all their plans, check-ins and progress?`)) return;
    await deleteUser(id!);
    navigate('/');
  };

  // Blank new plan for this user.
  const newPlan = () => navigate('/create', { state: { userId: id, status: 'active' } });

  // Next plan: template from the latest plan, dates continuing on.
  const createNext = async () => {
    if (!plans.length) return newPlan();
    setBusy(true);
    try {
      const latest = plans[plans.length - 1];
      const detail = await fetchPlan(latest.id!);
      const start = latest.end_date
        ? new Date(new Date(latest.end_date).getTime() + 86400000).toISOString().slice(0, 10)
        : todayISO();
      navigate('/create', {
        state: {
          userId: id,
          previousPlanId: latest.id,
          status: 'planned',
          profile: { ...detail.profile, start_date: start, end_date: undefined, status: 'planned' },
          plans: detail.plans,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  // Quick weight log — attaches a weight-only check-in to the active (else latest) plan.
  const logTargetPlan = () => plans.find((p) => p.status === 'active') ?? plans[plans.length - 1];
  const logWeight = async () => {
    const target = logTargetPlan();
    if (!target?.id || !wWeight) return;
    await createCheckin(target.id, { date: wDate, weight_kg: Number(wWeight) });
    setLogging(false);
    setWWeight('');
    setWDate(todayISO());
    load();
  };

  if (loading) return <p className="mt-8 text-muted">Loading…</p>;
  if (!user) return <p className="mt-8 text-danger">User not found.</p>;

  if (needsPin) {
    return (
      <PinModal
        title={`Unlock ${user.name}`}
        subtitle="Enter this profile's PIN"
        onVerify={(p) => verifyPin(id!, p)}
        onSuccess={() => { setUnlocked(id!); setNeedsPin(false); }}
        onClose={() => navigate('/')}
      />
    );
  }

  const targetsById = new Map(progress?.plans.map((p) => [p.id, p.targets]) ?? []);

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted no-underline transition-colors hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" /> All users
      </Link>

      {/* Header */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-tint text-lg font-bold text-brand">
            {user.name.charAt(0).toUpperCase()}
          </span>
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={saveName}
              className="rounded-xl border border-brand px-3 py-1.5 text-xl font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/30"
            />
          ) : (
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{user.name}</h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditName(user.name); }}>
            <EditIcon className="h-3.5 w-3.5" /> Rename
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex gap-1 rounded-xl bg-surface-sunken p-1">
          {(['plans', 'progress'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors cursor-pointer ${
                tab === t ? 'bg-surface text-brand-strong shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'plans' ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={newPlan}><PlusIcon className="h-3.5 w-3.5" /> New plan</Button>
            <Button size="sm" onClick={createNext} disabled={busy}>
              {busy ? 'Loading…' : <>Create next plan <ArrowRightIcon className="h-3.5 w-3.5" /></>}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setWWeight(''); setWDate(todayISO()); setLogging(true); }}
            disabled={plans.length === 0}
            title={plans.length === 0 ? 'Create a plan first' : undefined}
          >
            <ScaleIcon className="h-3.5 w-3.5" /> Log weight
          </Button>
        )}
      </div>

      {tab === 'plans' ? (
        <PlansSequence plans={plans} targetsById={targetsById} reduce={!!reduce} onNew={newPlan} onDelete={handleDeletePlan} />
      ) : (
        <ProgressView progress={progress} userId={id!} />
      )}

      {logging && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-4" onClick={() => setLogging(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold text-ink">Log weight</h3>
            <p className="mb-3 text-xs text-faint">Recorded against “{logTargetPlan()?.name}”.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Date</label>
                <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Weight (kg)</label>
                <input autoFocus type="number" step="0.1" value={wWeight}
                  onChange={(e) => setWWeight(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') logWeight(); }}
                  placeholder="e.g. 72.5"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setLogging(false)}>Cancel</Button>
              <Button className="flex-1" onClick={logWeight} disabled={!wWeight}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- plan sequence */

function PlansSequence({
  plans, targetsById, reduce, onNew, onDelete,
}: {
  plans: Profile[];
  targetsById: Map<string, ProgressData['plans'][number]['targets']>;
  reduce: boolean;
  onNew: () => void;
  onDelete: (id: string, name: string) => void;
}) {
  if (plans.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <MacroRingIcon className="h-10 w-10 text-brand/40" />
        <h3 className="mt-3 text-lg font-semibold text-ink">No plans yet</h3>
        <p className="mt-1 mb-5 text-muted">Build the first meal plan for this user.</p>
        <Button onClick={onNew}><PlusIcon className="h-4 w-4" /> New plan</Button>
      </Card>
    );
  }

  return (
    <ol className="relative ml-3 border-l-2 border-border">
      {plans.map((p, i) => {
        const targets = p.id ? targetsById.get(p.id) : null;
        const cals = targets?.non_workout?.calories ?? null;
        const range = [fmtDate(p.start_date), fmtDate(p.end_date)].filter(Boolean).join(' → ');
        return (
          <motion.li
            key={p.id}
            className="mb-3 ml-6"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
          >
            <span className="absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full bg-brand text-[11px] font-bold text-white ring-4 ring-canvas">
              {p.sequence ?? i + 1}
            </span>
            <Link to={`/plan/${p.id}`} className="no-underline">
              <Card interactive className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-ink">{p.name}</h3>
                    {p.status && <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</Chip>}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                    {range && <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{range}</span>}
                    <span className="inline-flex items-center gap-1"><TargetIcon className="h-3.5 w-3.5" />{p.tdee} kcal TDEE</span>
                    {cals != null && <span>· {cals} kcal target</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-faint hover:text-danger"
                    title="Delete plan"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id!, p.name); }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                  <ArrowRightIcon className="h-5 w-5 text-faint" />
                </div>
              </Card>
            </Link>
          </motion.li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- progress */

function ProgressView({ progress, userId }: { progress: ProgressData | null; userId: string }) {
  if (!progress || progress.summary.plan_count === 0) {
    return <Card className="px-6 py-14 text-center text-muted">No progress data yet. Create a plan and log a check-in.</Card>;
  }
  const s = progress.summary;

  const weightLine: ChartLine[] = [{
    label: 'Weight',
    color: COLORS.brand,
    points: progress.weight_series.filter((w) => w.weight_kg != null).map((w) => ({ x: ms(w.date), y: w.weight_kg })),
  }];

  const calLine: ChartLine[] = [{
    label: 'Calorie target',
    color: COLORS.brand,
    points: progress.macro_series.filter((m) => m.calories != null && m.start_date).map((m) => ({ x: ms(m.start_date), y: m.calories! })),
  }];

  const macroLines: ChartLine[] = (['protein', 'carbs', 'fat'] as const).map((k) => ({
    label: k[0].toUpperCase() + k.slice(1),
    color: COLORS[k],
    points: progress.macro_series.filter((m) => m[k] != null && m.start_date).map((m) => ({ x: ms(m.start_date), y: m[k]! })),
  }));

  const ci = progress.checkin_series;
  const checkinLines: ChartLine[] = [
    { label: 'Energy', color: COLORS.brand, points: ci.filter((c) => c.energy != null).map((c) => ({ x: ms(c.date), y: c.energy! })) },
    { label: 'Adherence', color: COLORS.carbs, points: ci.filter((c) => c.adherence != null).map((c) => ({ x: ms(c.date), y: c.adherence! })) },
    { label: 'Hunger', color: COLORS.fat, points: ci.filter((c) => c.hunger != null).map((c) => ({ x: ms(c.date), y: c.hunger! })) },
    { label: 'Progress', color: COLORS.faint, points: ci.filter((c) => c.progress_rating != null).map((c) => ({ x: ms(c.date), y: c.progress_rating! })) },
  ].filter((l) => l.points.length > 0);

  const delta = s.weight_change_kg;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><Stat label="Plans" value={s.plan_count} /></Card>
        <Card className="p-4"><Stat label="Check-ins" value={s.checkin_count} /></Card>
        <Card className="p-4"><Stat label="Latest weight" value={s.latest_weight_kg != null ? `${s.latest_weight_kg} kg` : '—'} /></Card>
        <Card className="p-4">
          <Stat
            label="Weight change"
            value={
              delta == null ? '—' : (
                <span className={delta < 0 ? 'text-brand' : delta > 0 ? 'text-carbs' : 'text-ink'}>
                  {delta > 0 ? '+' : ''}{delta} kg
                </span>
              )
            }
          />
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold text-ink">Weight trend</h3>
        <LineChart lines={weightLine} yUnit="kg" formatY={(v) => v.toFixed(1)} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-ink">Calorie target by plan</h3>
          <LineChart lines={calLine} yUnit="kcal" />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-ink">Macro targets by plan</h3>
          <LineChart lines={macroLines} yUnit="grams" />
        </Card>
      </div>

      {checkinLines.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-ink">Check-in ratings (1–5)</h3>
          <LineChart lines={checkinLines} formatY={(v) => v.toFixed(0)} />
        </Card>
      )}

      <ProgressPhotos userId={userId} />
    </div>
  );
}
