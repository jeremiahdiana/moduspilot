import { desktopCapturer, screen, systemPreferences, shell, type NativeImage } from 'electron';
import log from 'electron-log';

/**
 * Grabbing the screen for Screen Assist.
 *
 * Runs entirely in the MAIN process via desktopCapturer — no renderer, no
 * getUserMedia, no MediaStream. That matters: the alternative (a hidden window
 * calling getUserMedia with a chromeMediaSourceId) needs a renderer with media
 * permissions, and this app deliberately gives remote content no privileges at
 * all (see windows.ts). A main-process grab keeps that boundary intact.
 *
 * NOTHING here writes to disk. The frame exists as a Buffer, becomes a base64
 * JPEG, goes to the API, and is dropped. A screenshot tool that leaves the user's
 * screen lying around in a temp directory is a liability, not a feature.
 */

export type ScreenPermission = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

/**
 * macOS gates screen capture behind TCC (System Settings → Privacy & Security →
 * Screen Recording).
 *
 * 🪤 THE PART THAT SURPRISES PEOPLE: granting it does NOT take effect in the
 * running process. macOS hands the app its screen-recording verdict at launch, so
 * after the user flips the toggle the app must be RELAUNCHED. Without saying so,
 * the user grants permission, presses the hotkey, gets a black frame, and
 * concludes the feature is broken. Every caller of this must be able to tell them.
 */
export function screenPermission(): ScreenPermission {
  if (process.platform !== 'darwin') return 'granted';
  try {
    return systemPreferences.getMediaAccessStatus('screen') as ScreenPermission;
  } catch (err) {
    log.error('[screen] could not read screen permission', err);
    return 'unknown';
  }
}

/** Deep-link straight to the Screen Recording pane — nobody should have to hunt for it. */
export function openScreenRecordingSettings(): void {
  shell
    .openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    .catch((err) => log.error('[screen] could not open Screen Recording settings', err));
}

export interface Capture {
  /** Raw base64 (no data: prefix) — what the chat API's image part wants. */
  jpegBase64: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Is this frame all one colour?
 *
 * Denied screen recording does NOT throw and does not return an empty list — it
 * returns a perfectly well-formed BLACK image. Any check of the form "did we get
 * an image back" passes on it. Sampling the pixels is the only way to tell a real
 * screen from a permission failure, and it is also what stops us billing a vision
 * model to describe a black rectangle.
 *
 * Sampled on a stride rather than pixel-by-pixel: a 3000x2000 bitmap is 24MB and
 * this runs on every capture, including every tick of watch mode.
 */
export function isBlankImage(image: NativeImage): boolean {
  const { width, height } = image.getSize();
  if (width === 0 || height === 0) return true;
  const bmp = image.toBitmap(); // BGRA
  if (bmp.length < 4) return true;
  const first = [bmp[0], bmp[1], bmp[2]];
  const stride = Math.max(4, Math.floor(bmp.length / 4 / 500) * 4);
  for (let i = 0; i < bmp.length - 3; i += stride) {
    if (bmp[i] !== first[0] || bmp[i + 1] !== first[1] || bmp[i + 2] !== first[2]) return false;
  }
  return true;
}

/**
 * The capture worked and the screen really is one flat colour.
 *
 * Separate from ScreenPermissionError so the UI can say "the screen looks blank"
 * instead of accusing a correctly-configured permission. It is still refused
 * rather than sent: paying a vision model to describe a blank rectangle produces
 * a confident answer about nothing.
 */
export class BlankScreenError extends Error {
  constructor() {
    super('the captured screen is a single flat colour');
    this.name = 'BlankScreenError';
  }
}

export class ScreenPermissionError extends Error {
  readonly status: ScreenPermission;
  constructor(status: ScreenPermission) {
    super(`screen recording permission is "${status}"`);
    this.name = 'ScreenPermissionError';
    this.status = status;
  }
}

/**
 * Long edge of what we send. NOT the display's real resolution.
 *
 * Two reasons, both money. Every vision provider downsamples server-side anyway
 * (Anthropic works to ~1092px on the long edge), so a 5K retina grab buys zero
 * extra legibility — and images are billed as input tokens against
 * enforcePaidTokenLimit, so an oversized frame charges the user for detail the
 * model then throws away. 1400 keeps body text readable while staying near what
 * the providers actually use.
 */
export const MAX_EDGE = 1400;
const JPEG_QUALITY = 70;

/** The display the user is actually looking at — the one the cursor is on. */
function activeDisplay(): Electron.Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function targetSize(display: Electron.Display, maxEdge: number): { width: number; height: number } {
  // scaleFactor matters: size is in DIPs, so a retina display reports 1470x956
  // for a 2940x1912 panel. Ask the compositor for the physical pixels and let it
  // do the downscale in one step.
  const w = Math.round(display.size.width * display.scaleFactor);
  const h = Math.round(display.size.height * display.scaleFactor);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Capture the display under the cursor as a downscaled JPEG.
 *
 * Throws ScreenPermissionError when macOS has not granted screen recording, so
 * the caller can show the permission panel instead of a broken answer. Every
 * other failure throws a plain Error — a capture failure must be visible, never
 * a silent black frame handed to a model.
 */
export async function captureActiveScreen(maxEdge = MAX_EDGE): Promise<Capture> {
  const permission = screenPermission();
  if (permission !== 'granted') throw new ScreenPermissionError(permission);

  const display = activeDisplay();
  const thumbnailSize = targetSize(display, maxEdge);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false,
  });
  if (sources.length === 0) throw new Error('no screen sources available');

  // Match the cursor's display. display_id is documented as possibly empty, so
  // falling back to the first source is required, not defensive noise — on a
  // single-display Mac that fallback IS the normal path.
  const source =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0];

  const image = source.thumbnail;
  if (image.isEmpty()) throw new Error('captured an empty frame');
  if (isBlankImage(image)) {
    // 🪤 A uniform frame has TWO causes and they need different messages.
    //
    // This used to unconditionally throw ScreenPermissionError('denied'), which
    // meant anyone whose screen legitimately WAS one colour — a maximised blank
    // document, a solid-colour wallpaper on an empty desktop, a dark editor with
    // nothing open — was told their Screen Recording permission was broken and
    // sent to System Settings to fix a setting that was already correct. Telling
    // someone to repair something that is not broken is worse than saying nothing.
    //
    // Permission is genuinely the likely cause only when macOS ALSO reports it as
    // not granted, or when it was granted so recently that this process has not
    // been relaunched — and the second case is indistinguishable from the first
    // from in here, so it is grouped with it.
    if (screenPermission() !== 'granted') throw new ScreenPermissionError('denied');
    throw new BlankScreenError();
  }

  const { width, height } = image.getSize();
  const jpeg = image.toJPEG(JPEG_QUALITY);
  return {
    jpegBase64: jpeg.toString('base64'),
    width,
    height,
    bytes: jpeg.length,
  };
}
