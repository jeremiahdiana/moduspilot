/**
 * Does watch mode ACTUALLY work against a real screen?
 *
 * verify-watch-diff.ts proves the maths on synthetic bitmaps. That is necessary
 * and not sufficient: it never touches desktopCapturer, so it cannot tell you
 * whether the probe reads the real screen, whether the baseline tick works, or
 * whether the timer survives being started. All of those could be broken with the
 * diff maths perfect, and the mode would silently never fire — indistinguishable
 * from "the screen didn't change enough".
 *
 * 🪤 TWO THINGS THIS SCRIPT LEARNED THE HARD WAY, both of which made an earlier
 * version of it report a WORKING detector as broken:
 *
 *   1. A DEV MACHINE IS NEVER STILL. A terminal printing output, a clock, a
 *      notification — the diff correctly calls all of those change. Asserting
 *      "nothing triggers on an idle screen" against a live desktop tests the room,
 *      not the code. Stillness is therefore measured against a KNOWN-static image
 *      pair, and the real screen is only used to prove change is detected.
 *   2. THE SPEND CEILING OUTLIVES THE TEST. With a 30s floor between triggers, a
 *      short run is guaranteed to be refused — the first tick eats the quota and
 *      every real change afterwards logs "ignored (too-soon)". The trigger path is
 *      therefore driven with an explicit test ceiling.
 *
 *   cd apps/desktop && npm run build && npx electron scripts/verify-watch-live.js
 *
 * A large window flashes on screen for a few seconds. That is the test.
 */
const { app, BrowserWindow, screen } = require('electron');

// 🪤 WITHOUT THIS THE TEST LIES. Destroying the last BrowserWindow fires
// 'window-all-closed', whose DEFAULT handler quits the app — so the moment the
// probe window was destroyed, Electron exited mid-run with status 0 and the
// remaining assertions never executed. A silent early exit that reports success
// is the worst possible outcome for a verification script. (index.ts carries the
// same guard for the same reason: MODUS is a tray app and must outlive its window.)
app.on('window-all-closed', () => { /* keep the test process alive */ });

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const {
    startWatch, stopWatch, isWatching, probeSignature, difference, TriggerCeiling,
  } = require('../dist/main/screen/watch');
  const { screenPermission } = require('../dist/main/screen/capture');

  const permission = screenPermission();
  console.log(`\n  screen recording permission: ${permission}\n`);
  if (permission !== 'granted') {
    console.log('  ⚠️  Screen Recording not granted — watch mode cannot be tested.\n');
    app.exit(2);
    return;
  }

  const THRESHOLD = 0.045; // must match CHANGE_THRESHOLD in watch.ts

  // ── The probe reads the REAL screen ──────────────────────────────────────
  console.log('  Reading the real screen\n');
  const a = await probeSignature();
  check('probeSignature returns a signature', !!a && a.length === 160, a ? `${a.length} blocks` : 'null');
  check('the signature is not all zeros (a black/failed grab)',
    !!a && a.some((v) => v > 0.01), a ? `max ${Math.max(...a).toFixed(3)}` : '');

  // Identical input must be identical output — this is the "still" assertion,
  // made against known-static data rather than against a live desktop.
  check('the same signature differences to zero', difference(a, a) === 0);

  // ── A real change is detected ────────────────────────────────────────────
  console.log('\n  Making a real screen change\n');
  const display = screen.getPrimaryDisplay();
  const probeWin = new BrowserWindow({
    x: display.bounds.x + 40,
    y: display.bounds.y + 60,
    width: Math.round(display.bounds.width * 0.6),
    height: Math.round(display.bounds.height * 0.6),
    frame: false, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#ffffff', show: false,
  });
  probeWin.setAlwaysOnTop(true, 'screen-saver');
  await probeWin.loadURL(
    'data:text/html,' + encodeURIComponent(
      '<body style="margin:0;background:#fff">'
      + '<div style="font:700 90px system-ui;color:#000;padding:60px">SCREEN CHANGED</div>'
      + '<div style="height:40vh;background:#000"></div></body>',
    ),
  );
  probeWin.show();
  await wait(1200); // let the compositor actually present it

  const b = await probeSignature();
  const delta = difference(a, b);
  check('a real screen change is over the trigger threshold', delta >= THRESHOLD,
    `delta=${delta.toFixed(4)} vs threshold ${THRESHOLD}`);

  probeWin.hide();
  await wait(1200);
  const c = await probeSignature();
  check('reverting the change is detected too', difference(b, c) >= THRESHOLD,
    `delta=${difference(b, c).toFixed(4)}`);
  probeWin.destroy();

  // ── The full loop fires onChange ─────────────────────────────────────────
  // Test ceiling: no floor, high cap, so this measures the WATCH LOOP rather
  // than the spend brake (which verify-watch-diff.ts covers exhaustively).
  console.log('\n  The watch loop end to end\n');
  let triggers = 0;
  startWatch(600, async () => { triggers++; }, new TriggerCeiling(99, 0));
  check('startWatch starts a timer', isWatching() === true);

  await wait(1500); // first tick establishes the baseline and must NOT fire
  const afterBaseline = triggers;

  const flash = new BrowserWindow({
    x: display.bounds.x + 40, y: display.bounds.y + 60,
    width: Math.round(display.bounds.width * 0.6),
    height: Math.round(display.bounds.height * 0.6),
    frame: false, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#ffffff', show: false,
  });
  flash.setAlwaysOnTop(true, 'screen-saver');
  await flash.loadURL('data:text/html,' + encodeURIComponent(
    '<body style="margin:0;background:#fff"><div style="height:100vh;background:#000"></div></body>'));
  flash.show();
  await wait(3000);

  check('onChange fires on a real screen change', triggers > afterBaseline,
    `${triggers - afterBaseline} trigger(s)`);
  flash.destroy();

  // ── Teardown ─────────────────────────────────────────────────────────────
  console.log('\n  Teardown\n');
  const atStop = triggers;
  stopWatch();
  check('stopWatch clears the timer', isWatching() === false);
  await wait(2000);
  check('nothing fires after stopWatch', triggers === atStop, `${triggers - atStop} late trigger(s)`);

  startWatch(600, async () => { triggers++; }, new TriggerCeiling(99, 0));
  check('watch can be restarted in the same session', isWatching() === true);
  stopWatch();
  check('and stopped again', isWatching() === false);

  console.log(`\n${failures === 0 ? '✅ PASS — watch mode works end to end' : `❌ ${failures} FAILED`}\n`);
  app.exit(failures === 0 ? 0 : 1);
}).catch((err) => {
  console.error('verify-watch-live failed to start', err);
  app.exit(1);
});
