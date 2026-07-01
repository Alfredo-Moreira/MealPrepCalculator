import { useEffect, useRef, useState } from 'react';
import type { ExternalFood } from '../api';
import { searchExternalFoods, lookupBarcode } from '../api';
import { Button } from './ui';
import { SearchIcon, BarcodeIcon, CloseIcon, CameraIcon } from './icons';

/**
 * Find a food from Open Food Facts — by name search or by scanning/entering a barcode.
 * Calls onPick with the chosen food (per-100g macros). Barcode scanning uses the native
 * BarcodeDetector when available, with a manual-entry fallback for unsupported browsers.
 */
export default function FoodSearchModal({ onPick, onClose }: { onPick: (f: ExternalFood) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'search' | 'scan'>('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ExternalFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchExternalFoods(q));
      } catch {
        setError('Search failed.');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const handleBarcode = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      onPick(await lookupBarcode(code));
    } catch {
      setError(`No product found for ${code}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold text-ink">Find a food</h3>
          <button onClick={onClose} className="cursor-pointer text-faint hover:text-ink"><CloseIcon className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 p-3">
          <button onClick={() => setMode('search')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${mode === 'search' ? 'bg-brand text-white' : 'bg-surface-sunken text-muted hover:text-ink'}`}>
            <SearchIcon className="mr-1 inline h-4 w-4 align-text-bottom" /> Search
          </button>
          <button onClick={() => setMode('scan')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${mode === 'scan' ? 'bg-brand text-white' : 'bg-surface-sunken text-muted hover:text-ink'}`}>
            <BarcodeIcon className="mr-1 inline h-4 w-4 align-text-bottom" /> Barcode
          </button>
        </div>

        {error && <p className="mx-3 mb-2 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

        {mode === 'search' ? (
          <div className="flex min-h-0 flex-col px-3 pb-3">
            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. greek yogurt"
                className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && <p className="p-3 text-sm text-faint">Searching Open Food Facts…</p>}
              {!loading && q.trim() && results.length === 0 && <p className="p-3 text-sm text-faint">No matches.</p>}
              <ul className="space-y-1">
                {results.map((f, i) => (
                  <li key={i}>
                    <button onClick={() => onPick(f)} className="w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-tint">
                      <div className="text-sm font-medium text-ink">{f.food_name}</div>
                      <div className="text-xs text-faint">
                        {f.serving_size} · {f.base_calories} kcal · <span className="text-protein">P {f.base_protein}</span> · <span className="text-carbs">C {f.base_carbs}</span> · <span className="text-fat">F {f.base_fat}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <BarcodeScan onCode={handleBarcode} loading={loading} />
        )}
      </div>
    </div>
  );
}

function BarcodeScan({ onCode, loading }: { onCode: (code: string) => void; loading: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState('');
  const [camError, setCamError] = useState<string | null>(null);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) { stopped = true; onCode(codes[0].rawValue); return; }
          } catch { /* frame not ready */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamError('Camera unavailable — enter the barcode manually.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [supported, onCode]);

  return (
    <div className="px-3 pb-4">
      {supported && !camError ? (
        <div className="relative mb-3 overflow-hidden rounded-xl bg-ink">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-brand/80" />
        </div>
      ) : (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-3 text-sm text-muted">
          <CameraIcon className="h-4 w-4" /> {camError ?? 'Barcode scanning is not supported in this browser — enter it manually.'}
        </p>
      )}
      <label className="mb-1 block text-xs font-medium text-muted">Barcode</label>
      <div className="flex gap-2">
        <input
          value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric" placeholder="e.g. 737628064502"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <Button onClick={() => manual && onCode(manual)} disabled={loading || manual.length < 6}>{loading ? 'Looking…' : 'Look up'}</Button>
      </div>
    </div>
  );
}
