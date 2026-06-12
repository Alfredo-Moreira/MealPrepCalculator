import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchPlan, syncFoods, createCheckin, deleteCheckin, deletePlan } from '../api';
import type { Profile, MealPlan, CheckIn, PlanStatus } from '../types';
import { ACTIVITY_FACTORS, computeSubstitute, STATUS_LABELS } from '../types';
import BudgetBar from '../components/BudgetBar';
import MacroRing from '../components/MacroRing';
import CheckInPanel from '../components/CheckInPanel';
import { exportPDF, previewPDFUrl } from '../pdf';
import { buildPlanExport, download } from '../lib/planIO';
import { Button, Card, Chip, Stat } from '../components/ui';
import {
  EditIcon, DownloadIcon, ChevronRightIcon, ChevronLeftIcon, CloseIcon, ScaleIcon, TargetIcon, DumbbellIcon, CalendarIcon,
} from '../components/icons';

const STATUS_TONE: Record<PlanStatus, 'brand' | 'neutral' | 'warning'> = {
  active: 'brand', completed: 'neutral', planned: 'warning', archived: 'neutral',
};
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null);

function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-sunken hover:text-ink [&::-webkit-details-marker]:hidden">
        More
        <ChevronRightIcon className="h-3.5 w-3.5 rotate-90" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-52 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lift)]">
        {children}
      </div>
    </details>
  );
}

function MenuItem({ onClick, to, state, danger, children }: {
  onClick?: () => void; to?: string; state?: unknown; danger?: boolean; children: React.ReactNode;
}) {
  const cls =
    `flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm no-underline transition-colors cursor-pointer ${
      danger ? 'text-danger hover:bg-danger/5' : 'text-ink hover:bg-surface-sunken'
    }`;
  if (to) return <Link to={to} state={state} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

export default function ViewPlan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'non_workout' | 'workout'>('non_workout');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [expandedSubs, setExpandedSubs] = useState<Set<number>>(new Set());

  const toggleSubs = (idx: number) =>
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  useEffect(() => {
    if (!id) return;
    fetchPlan(id)
      .then(({ profile, plans, checkins }) => {
        setProfile(profile);
        setPlans(plans);
        setCheckins(checkins ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddCheckin = async (data: Partial<CheckIn>) => {
    if (!id) return;
    const created = await createCheckin(id, data);
    setCheckins((prev) => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  };

  const handleDeleteCheckin = async (checkinId: string) => {
    await deleteCheckin(checkinId);
    setCheckins((prev) => prev.filter((c) => c.id !== checkinId));
  };

  const handleSyncToDb = async () => {
    if (!plans.length) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const allItems = plans.flatMap((p) => p.items);
      const { added } = await syncFoods(allItems);
      setSyncMsg(added === 0 ? 'All items already in database.' : `${added} new item${added !== 1 ? 's' : ''} added to database.`);
    } catch {
      setSyncMsg('Failed to sync items.');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportJson = () => {
    if (!profile) return;
    const cleanProfile = {
      name: profile.name, age: profile.age, gender: profile.gender,
      weight_kg: profile.weight_kg, height_cm: profile.height_cm,
      activity_level: profile.activity_level, goal: profile.goal, tdee: profile.tdee,
      calorie_deficit: profile.calorie_deficit, start_date: profile.start_date,
      end_date: profile.end_date, status: profile.status,
    };
    download(`${profile.name.replace(/\s+/g, '_')}_meal_plan.json`, buildPlanExport(cleanProfile, plans));
  };

  const handleDeletePlan = async () => {
    if (!profile) return;
    if (!confirm(`Delete plan "${profile.name}"? This removes its meals and check-ins. This cannot be undone.`)) return;
    await deletePlan(id!);
    navigate(profile.user_id ? `/user/${profile.user_id}` : '/');
  };

  if (loading) return <p className="mt-8 text-muted">Loading…</p>;
  if (!profile) return <p className="mt-8 text-danger">Plan not found.</p>;

  const activePlan = plans.find((p) => p.plan_type === activeTab);
  const mealLabels = [...new Set(activePlan?.items.map((i) => i.meal_label) ?? [])];

  const totals = (activePlan?.items ?? []).reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const tabBtn = (tab: 'non_workout' | 'workout', label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
        activeTab === tab ? 'bg-surface text-brand-strong shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Profile summary */}
      <Card className="mb-4 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {profile.user_id && (
              <Link to={`/user/${profile.user_id}`} className="mb-1 inline-flex items-center gap-1 text-xs text-muted no-underline transition-colors hover:text-ink">
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Back to plans
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {profile.sequence != null && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{profile.sequence}</span>
              )}
              <h2 className="text-xl font-semibold tracking-tight text-ink">{profile.name}</h2>
              {profile.status && <Chip tone={STATUS_TONE[profile.status]}>{STATUS_LABELS[profile.status]}</Chip>}
            </div>
            {(profile.start_date || profile.end_date) && (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
                <CalendarIcon className="h-3.5 w-3.5" />
                {[fmtDate(profile.start_date), fmtDate(profile.end_date)].filter(Boolean).join(' → ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/create"
              state={{ editId: profile.id, profile, plans }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white no-underline shadow-sm transition-colors hover:bg-brand-strong"
            >
              <EditIcon className="h-4 w-4" /> Edit
            </Link>
            <Button variant="secondary" onClick={() => exportPDF(profile, plans)}>
              <DownloadIcon className="h-4 w-4" /> Export PDF
            </Button>
            <MoreMenu>
              <MenuItem onClick={() => setPreviewUrl(previewPDFUrl(profile, plans))}>Preview PDF</MenuItem>
              <MenuItem to="/create" state={{ profile: { ...profile, name: `Copy of ${profile.name}` }, plans }}>
                Duplicate
              </MenuItem>
              <MenuItem onClick={handleExportJson}>Export as JSON</MenuItem>
              <MenuItem onClick={handleSyncToDb}>{syncing ? 'Uploading…' : 'Upload to DB'}</MenuItem>
              <div className="my-1 border-t border-border" />
              <MenuItem danger onClick={handleDeletePlan}>Delete plan</MenuItem>
            </MoreMenu>
            <Link
              to={profile.user_id ? `/user/${profile.user_id}` : '/'}
              className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted no-underline transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              Back
            </Link>
          </div>
        </div>
        {syncMsg && <p className="mb-3 text-sm font-medium text-brand-strong">{syncMsg}</p>}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat icon={<ScaleIcon className="h-4 w-4" />} label="Age" value={profile.age} />
          <Stat label="Gender" value={<span className="capitalize">{profile.gender}</span>} />
          <Stat label="Weight" value={`${profile.weight_kg} kg`} />
          <Stat label="Height" value={`${profile.height_cm} cm`} />
          <Stat
            icon={<DumbbellIcon className="h-4 w-4" />}
            label="Activity"
            value={ACTIVITY_FACTORS[profile.activity_level]?.label?.split(' (')[0] ?? profile.activity_level}
          />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3">
          <TargetIcon className="h-5 w-5 text-brand" />
          <span className="font-medium text-brand-strong">TDEE</span>
          <span className="ml-auto text-2xl font-bold text-brand-strong">{profile.tdee} kcal/day</span>
        </div>
      </Card>

      {/* Day tabs */}
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-surface-sunken p-1">
        {tabBtn('non_workout', 'Non-Workout Day')}
        {tabBtn('workout', 'Workout Day')}
      </div>

      {activePlan && (
        <>
          {/* Budgets + macro ring */}
          <Card className="mb-4 flex flex-col items-center gap-6 p-5 sm:flex-row">
            <div className="shrink-0">
              <MacroRing protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
              <div className="mt-3 flex justify-center gap-3 text-xs">
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-protein" /> Protein</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-carbs" /> Carbs</span>
                <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-fat" /> Fat</span>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
              <BudgetBar label="Calories" current={totals.calories} target={activePlan.calorie_target} unit="kcal" tone="calories" />
              <BudgetBar label="Protein" current={totals.protein} target={activePlan.protein_target} unit="g" tone="protein" />
              <BudgetBar label="Carbs" current={totals.carbs} target={activePlan.carbs_target} unit="g" tone="carbs" />
              <BudgetBar label="Fat" current={totals.fat} target={activePlan.fat_target} unit="g" tone="fat" />
            </div>
          </Card>

          {/* Meals */}
          {mealLabels.map((label) => {
            const items = activePlan.items.filter((i) => i.meal_label === label);
            const sub = items.reduce(
              (acc, i) => ({ cal: acc.cal + i.calories, p: acc.p + i.protein, c: acc.c + i.carbs, f: acc.f + i.fat }),
              { cal: 0, p: 0, c: 0, f: 0 }
            );
            return (
              <Card key={label} className="mb-3 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold text-ink">{label}</h4>
                  <span className="text-xs text-muted">
                    {sub.cal} kcal · <span className="text-protein">P {sub.p}g</span> ·{' '}
                    <span className="text-carbs">C {sub.c}g</span> · <span className="text-fat">F {sub.f}g</span>
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-faint">
                      <th className="pb-1 font-medium">Food</th>
                      <th className="pb-1 text-right font-medium">Serving</th>
                      <th className="pb-1 text-right font-medium">Qty</th>
                      <th className="pb-1 text-right font-bold">Total</th>
                      <th className="pb-1 text-right font-medium">Cal</th>
                      <th className="pb-1 text-right font-medium text-protein">P</th>
                      <th className="pb-1 text-right font-medium text-carbs">C</th>
                      <th className="pb-1 text-right font-medium text-fat">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const match = item.serving_size.match(/^([\d.]+)\s*(.*)$/);
                      const totalServing = match
                        ? `${Math.round(parseFloat(match[1]) * item.multiplier * 10) / 10}${match[2]}`
                        : item.serving_size;
                      const even = idx % 2 === 0;
                      const hasSubs = (item.substitutes?.length ?? 0) > 0;
                      const subsOpen = expandedSubs.has(idx);
                      return (
                        <>
                          <tr key={idx} className={even ? 'bg-surface' : 'bg-surface-sunken/50'}>
                            <td className="px-1 py-1.5 text-ink">
                              <div className="flex items-center gap-1">
                                {hasSubs && (
                                  <button onClick={() => toggleSubs(idx)} className="shrink-0 cursor-pointer text-faint hover:text-muted" title="Show substitutes">
                                    <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${subsOpen ? 'rotate-90' : ''}`} />
                                  </button>
                                )}
                                {item.food_name}
                              </div>
                            </td>
                            <td className="px-1 py-1.5 text-right text-muted">{item.serving_size}</td>
                            <td className="px-1 py-1.5 text-right text-faint">{item.multiplier}x</td>
                            <td className="px-1 py-1.5 text-right font-bold text-ink">{totalServing}</td>
                            <td className="px-1 py-1.5 text-right text-muted">{item.calories}</td>
                            <td className="px-1 py-1.5 text-right text-muted">{item.protein}g</td>
                            <td className="px-1 py-1.5 text-right text-muted">{item.carbs}g</td>
                            <td className="px-1 py-1.5 text-right text-muted">{item.fat}g</td>
                          </tr>
                          {hasSubs && subsOpen && item.substitutes!.map((sub, si) => {
                            const c = computeSubstitute(sub, item.calories);
                            return (
                              <tr key={`sub-${idx}-${si}`} className="bg-brand-tint/40">
                                <td className="py-1 pl-5 pr-1 text-xs italic text-muted" colSpan={3}>↳ {sub.food_name}</td>
                                <td className="px-1 py-1 text-right text-xs text-faint">{c.totalServing}</td>
                                <td className="px-1 py-1 text-right text-xs font-bold text-ink">{c.calories}</td>
                                <td colSpan={3} />
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            );
          })}

          {mealLabels.length === 0 && <p className="mt-8 text-center text-muted">No items in this plan.</p>}
        </>
      )}

      <CheckInPanel
        checkins={checkins}
        startingWeight={profile.weight_kg}
        onAdd={handleAddCheckin}
        onDelete={handleDeleteCheckin}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/60" onClick={() => setPreviewUrl(null)}>
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <span className="font-semibold text-ink">PDF Preview — {profile.name}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => exportPDF(profile, plans)}>
                <DownloadIcon className="h-3.5 w-3.5" /> Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>
                <CloseIcon className="h-3.5 w-3.5" /> Close
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <iframe src={previewUrl} className="h-full w-full border-0" title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
