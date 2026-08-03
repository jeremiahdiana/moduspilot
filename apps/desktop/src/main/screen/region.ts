import { BrowserWindow, ipcMain, screen, desktopCapturer, type NativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';
import { screenPermission, isBlankImage, ScreenPermissionError, MAX_EDGE, type Capture } from './capture';

/**
 * "Drag a box around the bit you care about."
 *
 * 🚨 THE ORDER IS THE WHOLE DESIGN, AND THE FIRST VERSION HAD IT BACKWARDS.
 *
 * It used to screenshot the display FIRST, then show that image full-screen and
 * let the user drag on top of the photo. That is wrong in every way that matters:
 *
 *   - It doesn't look like your screen, it looks like a PICTURE of your screen,
 *     and the difference is instantly obvious because nothing moves. A playing
 *     video freezes, a spinner stops, the clock stops.
 *   - Any mismatch between the window and the display (macOS refusing to let an
 *     ordinary window cover the menu bar, say) stretches that photo, so what you
 *     see is offset from the real pixels underneath and the selection lands
 *     somewhere other than where you dragged. That is what produced the
 *     double menu bar.
 *   - It ships a multi-megabyte data URL into a renderer to draw something the
 *     compositor is already drawing perfectly well.
 *
 * The right way, and what this does now: the selector is a TRANSPARENT window. You
 * see your actual live screen because you ARE seeing your actual live screen —
 * there is nothing between you and it but a crosshair. Only once you release the
 * mouse does anything get captured, and then only the rectangle you drew.
 *
 * Capturing afterwards also means the selector can never appear in its own
 * screenshot: it is closed before the grab.
 */

const REGION_CAPTURE_EDGE = 2600;

let regionWin: BrowserWindow | null = null;
let wired = false;
let pending: ((rect: NormalizedRect | null) => void) | null = null;

/** Fractions of the selector window, 0–1. Resolution-independent by construction. */
interface NormalizedRect { x: number; y: number; w: number; h: number }

/**
 * The compositor needs a beat to actually stop drawing a window that was just
 * closed. Capturing on the same tick catches the selector's own dimming and
 * selection border in the shot — the same self-capture problem the main panel
 * already had, arriving by a different route.
 */
const HIDE_SETTLE_MS = 130;
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Grab the active display at high resolution, ready to be cropped. */
async function captureDisplay(display: Electron.Display): Promise<NativeImage> {
  const physW = Math.round(display.size.width * display.scaleFactor);
  const physH = Math.round(display.size.height * display.scaleFactor);
  const scale = Math.min(1, REGION_CAPTURE_EDGE / Math.max(physW, physH));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(physW * scale), height: Math.round(physH * scale) },
    fetchWindowIcons: false,
  });
  if (sources.length === 0) throw new Error('no screen sources available');
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
  const image = source.thumbnail;
  if (image.isEmpty()) throw new Error('captured an empty frame');
  return image;
}

function wire(): void {
  if (wired) return;
  wired = true;

  // Resolved exactly once per selection. `pending` is nulled before calling so a
  // duplicate message from the renderer (double mouseup, Esc racing a click)
  // cannot resolve the same promise twice and start two captures.
  const settle = (rect: NormalizedRect | null): void => {
    const resolve = pending;
    pending = null;
    if (resolve) resolve(rect);
  };

  ipcMain.on('region:done', (_e, rect: unknown) => {
    if (
      !rect || typeof rect !== 'object'
      || typeof (rect as NormalizedRect).x !== 'number'
      || typeof (rect as NormalizedRect).w !== 'number'
    ) { settle(null); return; }
    settle(rect as NormalizedRect);
  });

  ipcMain.on('region:cancel', () => settle(null));
}

function close(): void {
  if (regionWin && !regionWin.isDestroyed()) regionWin.destroy();
  regionWin = null;
}

/**
 * Show the selector and resolve with the cropped frame, or null if cancelled.
 *
 * Cancelling is a first-class outcome, not an error: pressing Escape with the
 * crosshair up is the most normal thing in the world and must not surface as
 * "capture failed".
 */
export async function selectRegion(): Promise<Capture | null> {
  // Checked BEFORE showing anything. Putting a full-screen selector up and only
  // then discovering we may not read the screen wastes the user's gesture.
  const permission = screenPermission();
  if (permission !== 'granted') throw new ScreenPermissionError(permission);

  wire();
  close();

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

  const win = new BrowserWindow({
    // display.bounds, NOT workArea: the selector has to cover the menu bar and the
    // dock, or you cannot select anything that overlaps them.
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    // The point of the whole thing: you are looking at your real screen.
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    // fullscreen:true would animate into a new Space and take the user with it.
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/region.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  regionWin = win;

  // Raise the level BEFORE re-applying bounds: macOS will not let an ordinary
  // window cover the menu bar, so a window asked for display.bounds at creation
  // gets quietly shoved down and shortened. At screen-saver level it can.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setBounds(display.bounds);

  await win.loadFile(path.join(__dirname, '../../../assets/region.html')).catch((err) => {
    log.error('[region] failed to load region.html', err);
  });
  if (win.isDestroyed()) return null;

  win.show();
  win.focus();
  // Re-applied after show(): some macOS versions only honour menu-bar-covering
  // bounds once the window is actually on screen at this level.
  win.setBounds(display.bounds);

  const actual = win.getBounds();
  if (actual.width !== display.bounds.width || actual.height !== display.bounds.height) {
    // Not fatal — the mapping below corrects for it — but it means the selector is
    // not covering the whole screen, which is worth knowing about.
    log.warn(`[region] window is ${actual.width}x${actual.height}, display is ${display.bounds.width}x${display.bounds.height} — mapping will compensate`);
  }

  const rect = await new Promise<NormalizedRect | null>((resolve) => {
    pending = resolve;
    // A selector that can get stuck covering the entire screen with no way out is
    // far worse than one that gives up: if the renderer never reports (a failed
    // load, a crash), this releases the screen rather than trapping the user.
    win.once('closed', () => { if (pending) { pending = null; resolve(null); } });
  });

  // Get out of the way BEFORE capturing — see HIDE_SETTLE_MS.
  close();
  if (!rect) return null;
  await wait(HIDE_SETTLE_MS);

  const image = await captureDisplay(display);
  if (isBlankImage(image)) throw new ScreenPermissionError('denied');
  const imageSize = image.getSize();

  // Fraction-of-window → fraction-of-display → pixels in the captured image. The
  // window/display correction matters whenever macOS clamped the bounds above.
  const fx = actual.width / display.bounds.width;
  const fy = actual.height / display.bounds.height;
  const ox = (actual.x - display.bounds.x) / display.bounds.width;
  const oy = (actual.y - display.bounds.y) / display.bounds.height;
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));

  const x = Math.round(clamp(ox + rect.x * fx) * imageSize.width);
  const y = Math.round(clamp(oy + rect.y * fy) * imageSize.height);
  const w = Math.round(clamp(rect.w * fx) * imageSize.width);
  const h = Math.round(clamp(rect.h * fy) * imageSize.height);

  // A click without a drag is a cancel, not a 1-pixel crop.
  if (w < 12 || h < 12) {
    log.info(`[region] selection too small (${w}x${h}) — treated as cancel`);
    return null;
  }

  let cropped = image.crop({
    x, y,
    width: Math.min(w, imageSize.width - x),
    height: Math.min(h, imageSize.height - y),
  });

  // Only shrink an oversized crop. Upscaling a small selection to MAX_EDGE would
  // add pixels with no information and bill the user for them.
  const cs = cropped.getSize();
  const longest = Math.max(cs.width, cs.height);
  if (longest > MAX_EDGE) {
    const s = MAX_EDGE / longest;
    cropped = cropped.resize({ width: Math.round(cs.width * s), height: Math.round(cs.height * s) });
  }

  const size = cropped.getSize();
  const jpeg = cropped.toJPEG(78); // a crop is small; spend a little more on quality
  log.info(`[region] selected ${size.width}x${size.height} (${(jpeg.length / 1024).toFixed(0)}KB)`);
  return {
    jpegBase64: jpeg.toString('base64'),
    width: size.width,
    height: size.height,
    bytes: jpeg.length,
  };
}

export function isRegionOpen(): boolean {
  return !!regionWin && !regionWin.isDestroyed();
}

export function cancelRegion(): void {
  close();
}
