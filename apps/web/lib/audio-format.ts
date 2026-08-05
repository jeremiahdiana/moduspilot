// Audio container → file extension, for Whisper uploads.
//
// 🪤 WHY THIS EXISTS AS ONE SHARED MAP. Whisper decides how to decode an upload
// from its FILE EXTENSION, not its mime type, so the extension is not cosmetic —
// get it wrong and the API refuses the file outright. Voice input was dead on web
// and desktop for exactly this reason: the client appended a raw Blob to FormData,
// which arrives named "blob" with no extension at all.
//
// The client picks the name and the server sanitises it, which is two places that
// must agree about the same mapping. This codebase has been bitten repeatedly by
// that shape (the tier gate vs the catalog, change-plan's duplicate price map),
// so there is exactly one map and both sides import it.
const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/oga': 'oga',
  'audio/mp4': 'm4a',   // Safari's MediaRecorder
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/opus': 'opus',
};

// Verified against the live API 2026-08-05 — Groq rejects anything else with
// "file must be one of the following types: [flac mp3 mp4 mpeg mpga m4a ogg opus
// wav webm]". A file named "blob" 400s; the same bytes named "audio.wav" return 200.

/**
 * The extension Whisper needs for a given container type.
 *
 * Falls back to `webm` because that is what Chromium's MediaRecorder produces and
 * it is on Whisper's supported list — an unknown type is far likelier to be a
 * codec parameter we failed to strip than a genuinely exotic container.
 */
export function extForAudioType(mime: string | null | undefined): string {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[base] ?? 'webm';
}

/** Whisper's accepted extensions, used to decide whether a filename is usable. */
const KNOWN_EXTS = new Set(Object.values(EXT_BY_MIME).concat(['mpeg', 'mpga']));

/**
 * A filename Whisper will accept, given whatever the client sent.
 *
 * Trusts an incoming name ONLY when it already carries a known audio extension.
 * A raw Blob arrives as "blob", which is truthy and therefore defeats any plain
 * `name || 'audio.webm'` fallback — that exact expression is what shipped, and
 * why the fallback never once fired.
 */
export function whisperFilename(name: string | null | undefined, mime: string | null | undefined): string {
  const ext = (name ?? '').toLowerCase().match(/\.([a-z0-9]{2,4})$/)?.[1];
  if (ext && KNOWN_EXTS.has(ext)) return name as string;
  return `audio.${extForAudioType(mime)}`;
}
