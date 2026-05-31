import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lightweight last-known-data cache backed by AsyncStorage.
 *
 * The React Native Firebase JS SDK only supports an in-memory Firestore cache,
 * so on a cold start every screen would otherwise wait for the network before
 * showing anything. These helpers let a screen paint its previous data
 * immediately (within a few ms of an async read) while the live onSnapshot
 * listener revalidates in the background.
 */

const PREFIX = 'modus.cache.';

/** Read cached value for `key`, or null if absent / unparseable. */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Write `value` for `key`. Fire-and-forget — never throws. */
export function writeCache<T>(key: string, value: T): void {
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
}
