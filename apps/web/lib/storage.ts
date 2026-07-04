import { randomUUID } from 'crypto';
import { adminBucket } from '@/lib/firebase-admin';

/**
 * Upload a generated image to Firebase Storage and return a permanent public
 * download URL (Firebase download-token style — works without changing bucket
 * ACLs). Returns null on any failure so callers can fall back to an inline
 * data URL. Requires Storage to be enabled on the project and the bucket name
 * to resolve (see adminBucket / FIREBASE_STORAGE_BUCKET).
 */
export async function uploadGeneratedImage(uid: string, base64: string): Promise<string | null> {
  try {
    const bucket = adminBucket();
    const path = `generated/${uid}/${randomUUID()}.png`;
    const token = randomUUID();
    const file = bucket.file(path);
    await file.save(Buffer.from(base64, 'base64'), {
      resumable: false,
      contentType: 'image/png',
      metadata: {
        contentType: 'image/png',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  } catch (e) {
    console.error('[storage] image upload failed:', String(e));
    return null;
  }
}
