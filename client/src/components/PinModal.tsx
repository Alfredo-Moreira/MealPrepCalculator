import { useState } from 'react';
import { Button } from './ui';
import { BrandMark, CloseIcon } from './icons';

/**
 * Soft PIN gate. Calls onVerify(pin) → boolean; on success calls onSuccess.
 * Not a hard security boundary (personal/local app) — just keeps profiles separate.
 */
export default function PinModal({
  title = 'Enter PIN', subtitle, onVerify, onSuccess, onClose,
}: {
  title?: string;
  subtitle?: string;
  onVerify: (pin: string) => Promise<boolean>;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!pin) return;
    setChecking(true);
    const ok = await onVerify(pin);
    setChecking(false);
    if (ok) onSuccess();
    else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex flex-col items-center text-center">
          <BrandMark className="h-9 w-9 text-brand" />
          <h3 className="mt-2 font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder="••••"
          className={`w-full rounded-xl border bg-surface px-3 py-2 text-center text-lg tracking-[0.4em] text-ink outline-none focus:ring-2 ${
            error ? 'border-danger focus:ring-danger/30' : 'border-border focus:border-brand focus:ring-brand/30'
          }`}
        />
        {error && <p className="mt-2 text-center text-sm text-danger">Incorrect PIN</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}><CloseIcon className="h-4 w-4" /> Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={checking || !pin}>{checking ? 'Checking…' : 'Unlock'}</Button>
        </div>
      </div>
    </div>
  );
}
