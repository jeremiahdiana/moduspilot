/**
 * Does `win.loadURL('data:text/html,...')` still resolve on Electron 42?
 *
 * windows.ts:134 does `await win.loadURL(splashUrl('Connecting…'))` with no
 * .catch(), inside an app.whenReady().then(async () => …) that also has no
 * .catch(). If that loadURL rejects, createMainWindow() never returns — no
 * tray, no sync, no "[main] MODUS Desktop ready" — and the rejection is
 * swallowed silently, which is exactly what the log shows since 2026-07-16.
 *
 * Isolated: its own userData dir, so it cannot touch the installed app's
 * session or fight its single-instance lock.
 *
 *   cd apps/desktop && npx electron scripts/probe-splash.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), `modus-splash-probe-${Date.now()}`));

// Byte-for-byte the same construction as windows.ts splashUrl().
function splashUrl(message) {
  return (
    'data:text/html;charset=utf-8,' +
    encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;height:100%;background:#0A0A0F;color:#E8E8F0;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
      .logo{font-weight:800;letter-spacing:.32em;font-size:15px;color:#A78BFA}
      .ring{width:26px;height:26px;border-radius:50%;border:2.5px solid #26263a;
        border-top-color:#7C3AED;animation:spin .8s linear infinite}
      .msg{font-size:12px;color:#6B6B80}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style></head><body><div class="wrap">
      <div class="logo">MODUS</div><div class="ring"></div><div class="msg">${message}</div>
    </div></body></html>`)
  );
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, backgroundColor: '#0A0A0F', webPreferences: {} });

  let readyToShow = false;
  win.once('ready-to-show', () => { readyToShow = true; console.log('EVENT ready-to-show fired'); });
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
    console.log(`EVENT did-fail-load  code=${code} desc=${desc} isMainFrame=${isMain} url=${String(url).slice(0, 40)}`);
  });
  win.webContents.on('did-finish-load', () => console.log('EVENT did-finish-load'));

  const url = splashUrl('Connecting…');
  console.log(`\ndata: URL length = ${url.length} bytes`);
  console.log('awaiting win.loadURL(splash) …\n');

  const started = Date.now();
  const verdict = await Promise.race([
    win.loadURL(url).then(
      () => ({ outcome: 'RESOLVED' }),
      (err) => ({ outcome: 'REJECTED', err: String(err && err.message || err) }),
    ),
    new Promise((r) => setTimeout(() => r({ outcome: 'HUNG (never settled in 8s)' }), 8000)),
  ]);

  console.log(`\n${'='.repeat(58)}`);
  console.log(`loadURL(data:) -> ${verdict.outcome}  after ${Date.now() - started}ms`);
  if (verdict.err) console.log(`  error: ${verdict.err}`);
  console.log(`ready-to-show fired: ${readyToShow}`);
  console.log(`window would be: ${readyToShow ? 'SHOWN (branded splash)' : 'NEVER SHOWN — show:false and ready-to-show never fired'}`);
  if (verdict.outcome !== 'RESOLVED') {
    console.log('\n=> createMainWindow() never returns past line 134.');
    console.log('=> createTray(), initAutoUpdate() and "[main] ready" never run.');
  }
  console.log('='.repeat(58));
  app.exit(0);
});
