import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Safe module-level availability checks — requireOptionalNativeModule returns null
// without throwing when a native module isn't compiled into the binary.
let _contacts: unknown = null;
let _media: unknown = null;
let _docs: unknown = null;
try {
  _contacts = Platform.OS === 'ios' ? requireOptionalNativeModule('ExpoContactsNext') : null;
  _media = Platform.OS === 'ios' ? requireOptionalNativeModule('ExpoMediaLibraryNext') : null;
  _docs = requireOptionalNativeModule('ExpoDocumentPicker');
} catch {
  // keep all null — features gracefully disabled
}

// HealthKit is a Nitro module (@kingstinct/react-native-healthkit) — there's no
// requireOptionalNativeModule for it, so we probe by calling the sync
// isHealthDataAvailable(). If the native side isn't compiled into this binary
// (e.g. running an OTA update on an older build, or Expo Go), the call throws
// and we treat health as unavailable. Wrapped so a throw never breaks app boot.
let _health = false;
try {
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const HK = require('@kingstinct/react-native-healthkit');
    _health = typeof HK.isHealthDataAvailable === 'function' && HK.isHealthDataAvailable() === true;
  }
} catch {
  _health = false;
}

export const nativeAvailable = {
  contacts: _contacts !== null,
  photos: _media !== null,
  files: _docs !== null,
  health: _health,
};

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function requestContactsPermission(): Promise<boolean> {
  if (!nativeAvailable.contacts) return false;
  try {
    const Contacts = await import('expo-contacts');
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function getContactsPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!nativeAvailable.contacts) return 'undetermined';
  try {
    const Contacts = await import('expo-contacts');
    const { status } = await Contacts.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch { return 'undetermined'; }
}

export interface SimpleContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  birthday?: { month: number; day: number; year?: number };
}

export async function getContacts(): Promise<SimpleContact[]> {
  if (!nativeAvailable.contacts) return [];
  try {
    const { Contact, ContactField, getPermissionsAsync } = await import('expo-contacts');
    const { status } = await getPermissionsAsync();
    if (status !== 'granted') return [];
    // getContactsAsync was removed in expo-contacts SDK 56 — use Contact.getAllDetails instead
    type RawContact = {
      id?: string;
      fullName?: string; givenName?: string; familyName?: string;
      emails?: Array<{ address?: string }>;
      phones?: Array<{ number?: string }>;
      company?: string;
      jobTitle?: string;
      birthday?: { month: number; day: number; year?: number };
    };
    const data = await Contact.getAllDetails(
      [ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.FULL_NAME,
       ContactField.EMAILS, ContactField.PHONES,
       ContactField.COMPANY, ContactField.JOB_TITLE, ContactField.BIRTHDAY],
    ) as RawContact[];
    const results: SimpleContact[] = [];
    for (const c of data) {
      const name = c.fullName ?? [c.givenName, c.familyName].filter(Boolean).join(' ');
      if (!name) continue;
      const contact: SimpleContact = {
        id: c.id ?? `${name.replace(/\s+/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
      };
      const email = c.emails?.[0]?.address;
      const phone = c.phones?.[0]?.number;
      if (email) contact.email = email;
      if (phone) contact.phone = phone;
      if (c.company) contact.company = c.company;
      if (c.jobTitle) contact.jobTitle = c.jobTitle;
      if (c.birthday?.month && c.birthday?.day) contact.birthday = { month: c.birthday.month, day: c.birthday.day, year: c.birthday.year };
      results.push(contact);
    }
    return results;
  } catch { return []; }
}

// ── Photos / Media Library ────────────────────────────────────────────────────

export async function requestPhotosPermission(): Promise<boolean> {
  if (!nativeAvailable.photos) return false;
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function getPhotosPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!nativeAvailable.photos) return 'undetermined';
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch { return 'undetermined'; }
}

export interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  createdAt?: number;
  width: number;
  height: number;
}

export async function getRecentPhotos(limit = 20): Promise<PhotoAsset[]> {
  if (!nativeAvailable.photos) return [];
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') return [];
    const { assets } = await MediaLibrary.getAssetsAsync({
      first: limit,
      mediaType: 'photo',
      sortBy: 'creationTime',
    });
    return assets.map(a => ({
      id: a.id,
      uri: a.uri,
      filename: a.filename,
      createdAt: a.creationTime,
      width: a.width,
      height: a.height,
    }));
  } catch { return []; }
}

// ── Document / File Picker ────────────────────────────────────────────────────

export interface PickedFile {
  name: string;
  uri: string;
  mimeType: string | null;
  size?: number;
}

export async function pickFile(types: string[] = ['*/*']): Promise<PickedFile | null> {
  if (!nativeAvailable.files) return null;
  try {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: types,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    return {
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      size: asset.size,
    };
  } catch { return null; }
}

export async function pickTextFile(): Promise<{ name: string; content: string } | null> {
  const file = await pickFile(['text/*', 'application/json', 'text/markdown', 'text/plain']);
  if (!file) return null;
  try {
    const { readAsStringAsync } = await import('expo-file-system');
    const content = await readAsStringAsync(file.uri);
    return { name: file.name, content };
  } catch {
    return { name: file.name, content: '' };
  }
}

// ── HealthKit ─────────────────────────────────────────────────────────────────
// Reads steps (daily cumulative), last-night sleep, and most-recent heart rate
// via @kingstinct/react-native-healthkit (new-arch / Nitro). Every native call is
// individually guarded so a single missing permission degrades one field to null
// rather than failing the whole briefing.

export interface HealthData {
  steps: number | null;
  sleep: { hours: number; minutes: number } | null;
  heartRate: number | null;
}

export async function initHealth(): Promise<boolean> {
  if (!nativeAvailable.health) return false;
  try {
    const HK = await import('@kingstinct/react-native-healthkit');
    const ok = await HK.isHealthDataAvailableAsync();
    if (!ok) return false;
    return await HK.requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierHeartRate',
        'HKCategoryTypeIdentifierSleepAnalysis',
      ],
    });
  } catch {
    return false;
  }
}

export async function getHealthData(): Promise<HealthData> {
  const empty: HealthData = { steps: null, sleep: null, heartRate: null };
  if (!nativeAvailable.health) return empty;
  try {
    const HK = await import('@kingstinct/react-native-healthkit');
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Steps — cumulative sum since midnight
    let steps: number | null = null;
    try {
      const stat = await HK.queryStatisticsForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        { filter: { date: { startDate: startOfDay, endDate: now } } },
      );
      if (stat.sumQuantity) steps = Math.round(stat.sumQuantity.quantity);
    } catch { /* leave null */ }

    // Heart rate — most recent sample
    let heartRate: number | null = null;
    try {
      const hr = await HK.getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate');
      if (hr) heartRate = Math.round(hr.quantity);
    } catch { /* leave null */ }

    // Sleep — sum asleep intervals from the last 24h
    let sleep: { hours: number; minutes: number } | null = null;
    try {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const samples = await HK.queryCategorySamples(
        'HKCategoryTypeIdentifierSleepAnalysis',
        { filter: { date: { startDate: since, endDate: now } }, limit: 200, ascending: false },
      );
      // 1=asleepUnspecified, 3=asleepCore, 4=asleepDeep, 5=asleepREM (exclude 0=inBed, 2=awake)
      const asleep = new Set([1, 3, 4, 5]);
      let ms = 0;
      for (const s of samples) {
        if (asleep.has(s.value as number)) {
          ms += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        }
      }
      if (ms > 0) {
        const totalMin = Math.round(ms / 60000);
        sleep = { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
      }
    } catch { /* leave null */ }

    return { steps, sleep, heartRate };
  } catch {
    return empty;
  }
}
