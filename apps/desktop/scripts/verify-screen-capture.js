/**
 * Does screen capture actually produce a picture of the screen?
 *
 * 🪤 THE FAILURE THIS EXISTS TO CATCH: denied Screen Recording permission does
 * NOT throw and does NOT return an empty list. macOS hands back a perfectly
 * well-formed, entirely BLACK image. So every naive check — "did we get an
 * image?", "is the buffer non-empty?", "did it not throw?" — passes on a
 * permission failure, and the first sign of trouble is a vision model confidently
 * describing a black rectangle to a paying customer.
 *
 * Runs inside a real Electron process because desktopCapturer, NativeImage and
 * the TCC status only exist there. A mock would prove nothing at all here.
 *
 *   cd apps/desktop && npm run build && npx electron scripts/verify-screen-capture.js
 *
 * Exit 0 = pass. Exit 2 = permission not granted (not a code failure — the
 * message tells you what to do).
 */
const { app, nativeImage } = require('electron');

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

app.whenReady().then(async () => {
  const {
    captureActiveScreen,
    screenPermission,
    isBlankImage,
    ScreenPermissionError,
    MAX_EDGE,
  } = require('../dist/main/screen/capture');

  console.log('\nBlank detection (synthetic images — no permission needed)\n');

  {
    // All-black is exactly what macOS returns when Screen Recording is denied.
    const black = nativeImage.createFromBitmap(Buffer.alloc(64 * 64 * 4, 0), { width: 64, height: 64 });
    check('an all-black frame is detected as blank', isBlankImage(black) === true);
  }

  {
    const white = nativeImage.createFromBitmap(Buffer.alloc(64 * 64 * 4, 255), { width: 64, height: 64 });
    check('an all-white frame is detected as blank', isBlankImage(white) === true);
  }

  {
    // Real content: a single differing region. The sampling stride must not skip it.
    const buf = Buffer.alloc(64 * 64 * 4, 0);
    for (let y = 20; y < 44; y++) {
      for (let x = 20; x < 44; x++) {
        const i = (y * 64 + x) * 4;
        buf[i] = 200; buf[i + 1] = 120; buf[i + 2] = 40; buf[i + 3] = 255;
      }
    }
    const content = nativeImage.createFromBitmap(buf, { width: 64, height: 64 });
    check('a frame with content is NOT blank', isBlankImage(content) === false);
  }

  {
    const empty = nativeImage.createEmpty();
    check('an empty image is blank', isBlankImage(empty) === true);
  }

  console.log('\nLive capture\n');

  const permission = screenPermission();
  console.log(`  screen recording permission: ${permission}`);

  if (permission !== 'granted') {
    console.log('\n  ⚠️  Not granted, so the live capture cannot run.');
    console.log('     System Settings → Privacy & Security → Screen Recording → enable for');
    console.log('     Electron (dev) or MODUS Desktop (release), then RELAUNCH. macOS only');
    console.log('     applies the grant to a fresh launch.\n');
    // Also prove the code reports this rather than returning a black frame.
    try {
      await captureActiveScreen();
      check('capture refuses without permission', false, 'it returned a frame anyway');
    } catch (err) {
      check('capture throws ScreenPermissionError instead of returning black',
        err instanceof ScreenPermissionError, err && err.name);
    }
    console.log(`\n${failures === 0 ? '⚠️  PERMISSION NEEDED (no code failures)' : `❌ ${failures} FAILED`}\n`);
    app.exit(failures === 0 ? 2 : 1);
    return;
  }

  try {
    const t0 = Date.now();
    const shot = await captureActiveScreen();
    const ms = Date.now() - t0;

    check('capture returns a frame', shot.width > 0 && shot.height > 0, `${shot.width}x${shot.height} in ${ms}ms`);
    check('the long edge respects MAX_EDGE', Math.max(shot.width, shot.height) <= MAX_EDGE,
      `long edge ${Math.max(shot.width, shot.height)}, max ${MAX_EDGE}`);
    check('it is a real JPEG payload', shot.bytes > 2000, `${(shot.bytes / 1024).toFixed(0)}KB`);

    // The one that matters: a black frame would sail through every check above.
    const decoded = nativeImage.createFromBuffer(Buffer.from(shot.jpegBase64, 'base64'));
    check('the captured frame is NOT blank', isBlankImage(decoded) === false,
      'a uniform frame here means permission is granted but the app was not relaunched');

    const size = decoded.getSize();
    check('the encoded frame decodes to the reported size',
      size.width === shot.width && size.height === shot.height,
      `decoded ${size.width}x${size.height}`);

    // Cost sanity: this is billed as input tokens on every single ask.
    check('the frame is small enough to send repeatedly', shot.bytes < 600_000,
      `${(shot.bytes / 1024).toFixed(0)}KB`);
  } catch (err) {
    check('live capture', false, String((err && err.message) || err));
  }

  console.log(`\n${failures === 0 ? '✅ PASS' : `❌ ${failures} FAILED`}\n`);
  app.exit(failures === 0 ? 0 : 1);
}).catch((err) => {
  console.error('verify-screen-capture failed to start', err);
  app.exit(1);
});
