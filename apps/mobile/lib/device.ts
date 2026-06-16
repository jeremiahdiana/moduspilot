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

// health is unavailable until react-native-health is replaced with a
// new-architecture compatible HealthKit library
export const nativeAvailable = {
  contacts: _contacts !== null,
  photos: _media !== null,
  files: _docs !== null,
  health: false,
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
}

export async function getContacts(): Promise<SimpleContact[]> {
  if (!nativeAvailable.contacts) return [];
  try {
    const Contacts = await import('expo-contacts');
    const { status } = await Contacts.getPermissionsAsync();
    if (status !== 'granted') return [];
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      sort: Contacts.SortTypes.FirstName,
    });
    return data
      .filter(c => c.name)
      .map(c => ({
        id: c.id ?? `${c.name.replace(/\s+/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: c.name!,
        email: c.emails?.[0]?.email,
        phone: c.phoneNumbers?.[0]?.number,
      }));
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
// react-native-health is incompatible with React Native new architecture (Expo SDK 56+).
// Stubbed out until replaced with a new-arch compatible library.

export interface HealthData {
  steps: number | null;
  sleep: { hours: number; minutes: number } | null;
  heartRate: number | null;
}

export async function initHealth(): Promise<boolean> { return false; }
export async function getHealthData(): Promise<HealthData> {
  return { steps: null, sleep: null, heartRate: null };
}
