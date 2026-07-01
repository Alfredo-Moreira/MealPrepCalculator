/** Per-session unlock cache for the soft PIN gate. */
const key = (id: string) => `mlf:unlocked:${id}`;

export function isUnlocked(id: string): boolean {
  try { return sessionStorage.getItem(key(id)) === '1'; } catch { return false; }
}

export function setUnlocked(id: string): void {
  try { sessionStorage.setItem(key(id), '1'); } catch { /* ignore */ }
}
