import { useRef, useState } from 'react';
import type { CheckIn } from '../types';
import { CHECKIN_QUESTIONS } from '../types';
import { Button, Card } from './ui';
import { PlusIcon, TrashIcon, CalendarIcon, ScaleIcon, CameraIcon, CloseIcon } from './icons';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Downscale + re-encode an image to a small JPEG data URL so photos stay light. */
function resizeImage(file: File, max = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unsupported'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Rating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-8 w-8 cursor-pointer rounded-lg text-sm font-medium transition-colors ${
            value === n ? 'bg-brand text-white' : 'bg-surface-sunken text-muted hover:bg-border'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

type Photos = { front?: string; back?: string; side?: string };
const ANGLES: Array<{ key: keyof Photos; label: string }> = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
];

type FormState = {
  date: string;
  weight_kg: string;
  energy?: number;
  adherence?: number;
  hunger?: number;
  progress_rating?: number;
  notes: string;
  photos: Photos;
};

const emptyForm = (): FormState => ({ date: todayISO(), weight_kg: '', notes: '', photos: {} });

function PhotoSlot({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { onChange(await resizeImage(file)); } catch { /* ignore */ }
  };
  return (
    <div className="text-center">
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-24 w-24 rounded-xl object-cover" />
          <button
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-ink text-white"
            title={`Remove ${label}`}
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-faint transition-colors hover:border-brand hover:text-brand"
        >
          <CameraIcon className="h-6 w-6" />
        </button>
      )}
      <div className="mt-1 text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

export default function CheckInPanel({
  checkins, startingWeight, onAdd, onDelete,
}: {
  checkins: CheckIn[];
  startingWeight?: number;
  onAdd: (data: Partial<CheckIn>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setPhoto = (angle: keyof Photos, v?: string) => setForm((f) => ({ ...f, photos: { ...f.photos, [angle]: v } }));

  const submit = async () => {
    setSaving(true);
    try {
      await onAdd({
        date: form.date,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
        energy: form.energy,
        adherence: form.adherence,
        hunger: form.hunger,
        progress_rating: form.progress_rating,
        notes: form.notes || undefined,
        photos: form.photos,
      });
      setForm(emptyForm());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-tint text-brand">
            <ScaleIcon className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-ink">Progress check-ins</h3>
          <span className="text-sm text-faint">({checkins.length})</span>
        </div>
        {!open && (
          <Button size="sm" onClick={() => { setForm({ ...emptyForm(), weight_kg: startingWeight ? String(startingWeight) : '' }); setOpen(true); }}>
            <PlusIcon className="h-3.5 w-3.5" /> Log check-in
          </Button>
        )}
      </div>

      {/* Existing check-ins */}
      {checkins.length > 0 ? (
        <div className="mb-2 space-y-2">
          {checkins.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface-sunken/40 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                  <CalendarIcon className="h-3.5 w-3.5 text-faint" /> {fmtDate(c.date)}
                  {c.weight_kg != null && <span className="ml-1 text-muted">· {c.weight_kg} kg</span>}
                </span>
                <button onClick={() => c.id && onDelete(c.id)} className="cursor-pointer text-faint hover:text-danger" title="Delete check-in">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {CHECKIN_QUESTIONS.map((q) =>
                  c[q.key] != null ? (
                    <span key={q.key as string}>{q.label}: <strong className="text-ink">{String(c[q.key])}/5</strong></span>
                  ) : null
                )}
              </div>
              {c.notes && <p className="mt-1.5 text-sm italic text-muted">“{c.notes}”</p>}
              {(() => {
                const shots: Array<[string, string | undefined]> = [
                  ['Front', c.photos?.front ?? c.photo],
                  ['Back', c.photos?.back],
                  ['Side', c.photos?.side],
                ];
                return shots.some(([, src]) => src) ? (
                  <div className="mt-2 flex gap-2">
                    {shots.map(([label, src]) =>
                      src ? (
                        <a key={label} href={src} target="_blank" rel="noreferrer" className="text-center">
                          <img src={src} alt={label} className="h-20 w-20 rounded-lg object-cover" />
                          <div className="text-[10px] text-faint">{label}</div>
                        </a>
                      ) : null
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      ) : (
        !open && <p className="text-sm text-faint">No check-ins yet. Log one at the end of the plan to track progress.</p>
      )}

      {/* New check-in form */}
      {open && (
        <div className="mt-2 space-y-4 rounded-xl border border-border p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Date</label>
              <input
                type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Weight (kg)</label>
              <input
                type="number" step="0.1" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)}
                placeholder="e.g. 72.5"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {CHECKIN_QUESTIONS.map((q) => (
              <div key={q.key as string}>
                <label className="mb-1 block text-sm font-medium text-muted" title={q.help}>{q.label}</label>
                <Rating value={form[q.key as keyof FormState] as number | undefined} onChange={(v) => set(q.key as keyof FormState, v as never)} />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Notes</label>
            <textarea
              value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              placeholder="How did this plan go? Anything to change next time?"
              className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Progress photos</label>
            <div className="flex flex-wrap gap-4">
              {ANGLES.map((a) => (
                <PhotoSlot key={a.key} label={a.label} value={form.photos[a.key]} onChange={(v) => setPhoto(a.key, v)} />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setForm(emptyForm()); }}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save check-in'}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
