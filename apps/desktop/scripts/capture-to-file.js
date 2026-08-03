/**
 * Capture the real screen and write it where a non-Electron script can read it.
 *
 * Exists so the end-to-end check (apps/web/scripts/verify-screen-assist-e2e.ts)
 * can send a GENUINE screenshot through the real API instead of a synthetic
 * swatch. A generated test image proves the plumbing; only a real screen proves
 * the model can read what the user is actually looking at.
 *
 *   npx electron scripts/capture-to-file.js /tmp/shot.b64
 */
const { app } = require('electron');
const fs = require('fs');
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const out = process.argv[process.argv.length - 1];
  const { captureActiveScreen, screenPermission } = require('../dist/main/screen/capture');
  if (screenPermission() !== 'granted') {
    console.error('screen recording not granted');
    app.exit(2);
    return;
  }
  const shot = await captureActiveScreen();
  fs.writeFileSync(out, shot.jpegBase64);
  console.log(`captured ${shot.width}x${shot.height}, ${(shot.bytes / 1024).toFixed(0)}KB → ${out}`);
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });
