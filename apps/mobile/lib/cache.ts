import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'modus.cache.';

// In-memory layer: populated by writeCache and warmed by readCache.
// readCacheSync returns data in 0ms — no async gap on re-visits.
const mem = new Map<string, unknown>();

/** Synchronous read from the in-memory layer. Returns null if not yet populated. */
export function readCacheSync<T>(key: string): T | null {
  const v = mem.get(PREFIX + key);
  return v !== undefined ? (v as T) : null;
}

/** Read cached value. Checks memory first (0ms), falls back to AsyncStorage. */
export async function readCache<T>(key: string): Promise<T | null> {
  const sync = readCacheSync<T>(key);
  if (sync !== null) return sync;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    mem.set(PREFIX + key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Write `value` for `key`. Updates memory immediately, persists to AsyncStorage. */
export function writeCache<T>(key: string, value: T): void {
  mem.set(PREFIX + key, value);
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
}
