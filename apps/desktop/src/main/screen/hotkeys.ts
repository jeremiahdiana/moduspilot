import { globalShortcut } from 'electron';
import log from 'electron-log';
import { toggleOverlay, openRegionOverlay } from './overlay';
import { setHotkeyRegistered, setRegionHotkeyRegistered } from '../tray';
import { getScreenAssist } from '../settings';

/**
 * Register both Screen Assist shortcuts.
 *
 * Lives here rather than in index.ts so the real app and the dev runner
 * (scripts/dev-screen-assist.js) register the SAME shortcuts from the SAME code.
 * They had drifted twice already — the dev runner skipped the tray, so the tray
 * menu shipped without ever having been rendered, and then it registered only one
 * of the two hotkeys, so the region shortcut looked broken when it had simply
 * never been wired. A dev harness that differs from the app tests the harness.
 *
 * 🪤 globalShortcut.register RETURNS FALSE when the combo is already taken by
 * macOS or another app — it does not throw. Ignoring the return value ships a
 * shortcut that silently does nothing on the machines where it clashes, and the
 * user cannot tell that from the feature being broken. Both results are pushed to
 * the tray so the menu says so out loud.
 */
export function registerScreenAssistHotkeys(): void {
  const { hotkey, regionHotkey } = getScreenAssist();

  // Registered independently: a clash on one must not cost the user the other.
  try {
    const ok = globalShortcut.register(hotkey, () => toggleOverlay());
    setHotkeyRegistered(ok ? hotkey : null);
    if (ok) log.info(`[screen] hotkey registered: ${hotkey}`);
    else log.warn(`[screen] hotkey ${hotkey} is already taken by another app — Screen Assist is available from the tray menu`);
  } catch (err) {
    setHotkeyRegistered(null);
    log.error('[screen] hotkey registration threw', err);
  }

  try {
    const ok = globalShortcut.register(regionHotkey, () => { void openRegionOverlay(); });
    setRegionHotkeyRegistered(ok ? regionHotkey : null);
    if (ok) log.info(`[screen] region hotkey registered: ${regionHotkey}`);
    else log.warn(`[screen] region hotkey ${regionHotkey} is already taken by another app — use the tray menu`);
  } catch (err) {
    setRegionHotkeyRegistered(null);
    log.error('[screen] region hotkey registration threw', err);
  }
}
