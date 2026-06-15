import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function getContactsPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS !== 'ios') return 'denied';
  const { status } = await Contacts.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export interface SimpleContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export async function getContacts(): Promise<SimpleContact[]> {
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') return [];
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
    sort: Contacts.SortTypes.FirstName,
  });
  return data
    .filter(c => c.name)
    .map(c => ({
      id: c.id ?? `${c.name}-${Math.random()}`,
      name: c.name!,
      email: c.emails?.[0]?.email,
      phone: c.phoneNumbers?.[0]?.number,
    }));
}

// ── Photos / Media Library ────────────────────────────────────────────────────

export async function requestPhotosPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function getPhotosPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS !== 'ios') return 'denied';
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
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
  const { status } = await MediaLibrary.getPermissionsAsync();
  if (status !== 'granted') return [];
  const { assets } = await MediaLibrary.getAssetsAsync({
    first: limit,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: MediaLibrary.SortBy.creationTime,
  });
  return assets.map(a => ({
    id: a.id,
    uri: a.uri,
    filename: a.filename,
    createdAt: a.creationTime,
    width: a.width,
    height: a.height,
  }));
}

// ── Document / File Picker ────────────────────────────────────────────────────

export interface PickedFile {
  name: string;
  uri: string;
  mimeType: string | null;
  size?: number;
}

export async function pickFile(types: string[] = ['*/*']): Promise<PickedFile | null> {
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

export interface HealthData {
  steps: number | null;
  sleep: { hours: number; minutes: number } | null;
  heartRate: number | null;
}

let healthInitialized = false;

export async function initHealth(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (healthInitialized) return true;
  try {
    // Dynamic import so this module doesn't crash on Android
    const AppleHealthKit = (await import('react-native-health')).default;
    const { Permissions } = AppleHealthKit.Constants;
    return new Promise(resolve => {
      AppleHealthKit.initHealthKit(
        {
          permissions: {
            read: [Permissions.StepCount, Permissions.SleepAnalysis, Permissions.HeartRate],
            write: [],
          },
        },
        (err: Error | null) => {
          if (!err) healthInitialized = true;
          resolve(!err);
        },
      );
    });
  } catch {
    return false;
  }
}

export async function getHealthData(): Promise<HealthData> {
  const empty: HealthData = { steps: null, sleep: null, heartRate: null };
  if (Platform.OS !== 'ios') return empty;
  try {
    const AppleHealthKit = (await import('react-native-health')).default;
    const now = new Date().toISOString();

    const steps: number | null = await new Promise(resolve => {
      AppleHealthKit.getStepCount({ date: now, includeManuallyAdded: true }, (err: Error | null, r: { value: number }) => {
        resolve(err ? null : r.value);
      });
    });

    const sleep: { hours: number; minutes: number } | null = await new Promise(resolve => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(18, 0, 0, 0);
      AppleHealthKit.getSleepSamples(
        { startDate: yesterday.toISOString(), endDate: now },
        (err: Error | null, results: { value: string; startDate: string; endDate: string }[]) => {
          if (err || !results?.length) { resolve(null); return; }
          const asleepMs = results
            .filter(r => r.value !== 'INBED' && r.value !== 'AWAKE')
            .reduce((sum, r) => sum + (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()), 0);
          if (!asleepMs) { resolve(null); return; }
          const totalMins = Math.round(asleepMs / 60000);
          resolve({ hours: Math.floor(totalMins / 60), minutes: totalMins % 60 });
        },
      );
    });

    const heartRate: number | null = await new Promise(resolve => {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      AppleHealthKit.getHeartRateSamples(
        { startDate: start.toISOString(), endDate: now, limit: 1, ascending: false },
        (err: Error | null, results: { value: number }[]) => {
          resolve(err || !results?.length ? null : Math.round(results[0].value));
        },
      );
    });

    return { steps, sleep, heartRate };
  } catch {
    return empty;
  }
}
