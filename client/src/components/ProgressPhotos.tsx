import { useEffect, useState } from 'react';
import { fetchUserPhotos } from '../api';
import type { ProgressPhoto, PhotoAngle } from '../types';
import { Card } from './ui';
import { ChevronLeftIcon, ChevronRightIcon, CameraIcon } from './icons';

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const ANGLES: Array<{ key: PhotoAngle; label: string }> = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
];

function Carousel({ title, items }: { title: string; items: Array<{ date: string; src: string }> }) {
  const [i, setI] = useState(0);
  const idx = Math.min(i, Math.max(0, items.length - 1));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {items.length > 0 && <span className="text-xs text-faint">{idx + 1} / {items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs text-faint">
          <span><CameraIcon className="mx-auto mb-1 h-5 w-5" />No {title.toLowerCase()} photos yet</span>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-xl bg-surface-sunken">
            <img src={items[idx].src} alt={`${title} ${fmt(items[idx].date)}`} className="aspect-[3/4] w-full object-cover" />
            {items.length > 1 && (
              <>
                <button
                  onClick={() => setI(Math.max(0, idx - 1))}
                  disabled={idx === 0}
                  className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink shadow-sm disabled:opacity-30"
                  title="Previous"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setI(Math.min(items.length - 1, idx + 1))}
                  disabled={idx === items.length - 1}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink shadow-sm disabled:opacity-30"
                  title="Next"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <div className="mt-1.5 text-center text-xs text-muted">{fmt(items[idx].date)}</div>
        </>
      )}
    </div>
  );
}

export default function ProgressPhotos({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);

  useEffect(() => {
    fetchUserPhotos(userId).then(setPhotos).catch(() => setPhotos([]));
  }, [userId]);

  if (!photos || photos.length === 0) return null; // hide section until there are photos

  const series = (key: PhotoAngle) =>
    photos.filter((p) => p[key]).map((p) => ({ date: p.date, src: p[key] as string }));

  return (
    <Card className="p-5">
      <h3 className="mb-1 font-semibold text-ink">Progress photos</h3>
      <p className="mb-4 text-sm text-muted">Swipe through each angle over time.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        {ANGLES.map((a) => (
          <Carousel key={a.key} title={a.label} items={series(a.key)} />
        ))}
      </div>
    </Card>
  );
}
