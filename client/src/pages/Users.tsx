import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { fetchUsers, createUser, deleteUser, checkHealth, verifyPin } from '../api';
import type { User } from '../types';
import { Button, Card, Chip } from '../components/ui';
import PinModal from '../components/PinModal';
import { isUnlocked, setUnlocked } from '../lib/pin';
import { BrandMark, PlusIcon, TrashIcon, CheckIcon, CloseIcon, ChevronRightIcon, LockIcon } from '../components/icons';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<User | null>(null); // user awaiting PIN
  const reduce = useReducedMotion();
  const navigate = useNavigate();

  const load = () => fetchUsers().then(setUsers).finally(() => setLoading(false));

  useEffect(() => {
    load();
    checkHealth().then(setDbOk);
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const u = await createUser({ name: name.trim(), pin: pin.trim() || undefined });
      if (pin.trim() && u.id) setUnlocked(u.id);
      setName('');
      setPin('');
      setAdding(false);
      navigate(`/user/${u.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, u: User) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${u.name}" and all their plans, check-ins and progress? This cannot be undone.`)) return;
    await deleteUser(u.id!);
    load();
  };

  const openUser = (u: User) => {
    if (u.has_pin && !isUnlocked(u.id!)) {
      setPending(u);
    } else {
      navigate(`/user/${u.id}`);
    }
  };

  if (loading) return <p className="mt-8 text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Who's prepping?</h2>
          <p className="text-sm text-muted">Pick a profile to view plans and progress.</p>
        </div>
        <div className="flex items-center gap-3">
          {dbOk !== null && (
            <Chip tone={dbOk ? 'brand' : 'danger'} title={dbOk ? 'Database connected' : 'Database unreachable'}>
              {dbOk ? <CheckIcon className="h-3.5 w-3.5" /> : <CloseIcon className="h-3.5 w-3.5" />} DB
            </Chip>
          )}
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <PlusIcon className="h-3.5 w-3.5" /> New User
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <Card className="mb-4 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setName(''); setPin(''); } }}
              placeholder="Name (e.g. Alex)"
              className="min-w-[12rem] flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              type="password"
              inputMode="numeric"
              placeholder="PIN (optional)"
              className="w-36 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <Button onClick={handleAdd} disabled={saving || !name.trim()}>{saving ? 'Adding…' : 'Add'}</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setName(''); setPin(''); }}>Cancel</Button>
          </div>
          <p className="mt-2 text-xs text-faint">A PIN keeps this profile private on shared devices. It's a soft lock, not strong security.</p>
        </Card>
      )}

      {users.length === 0 && !adding ? (
        <Card className="mt-6 flex flex-col items-center px-6 py-16 text-center">
          <BrandMark className="h-12 w-12 text-brand/40" />
          <h3 className="mt-4 text-xl font-semibold text-ink">No users yet</h3>
          <p className="mt-1 mb-6 text-muted">Create a user to start building meal plans.</p>
          <Button onClick={() => setAdding(true)}><PlusIcon className="h-4 w-4" /> New User</Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
            >
              <Card interactive className="flex cursor-pointer items-center justify-between gap-4 p-5" onClick={() => openUser(u)}>
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-tint text-lg font-bold text-brand">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 truncate text-lg font-semibold text-ink">
                      {u.name}
                      {u.has_pin && <LockIcon className="h-3.5 w-3.5 text-faint" />}
                    </h3>
                    <p className="text-sm text-muted">{u.plan_count ?? 0} plan{u.plan_count === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={(e) => handleDelete(e, u)} className="text-faint hover:text-danger" title="Delete user">
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                  <ChevronRightIcon className="h-5 w-5 text-faint" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {pending && (
        <PinModal
          title={`Unlock ${pending.name}`}
          subtitle="Enter this profile's PIN"
          onVerify={(p) => verifyPin(pending.id!, p)}
          onSuccess={() => {
            setUnlocked(pending.id!);
            const id = pending.id;
            setPending(null);
            navigate(`/user/${id}`);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
