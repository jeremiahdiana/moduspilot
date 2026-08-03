import { contextBridge, ipcRenderer } from 'electron';

/**
 * Bridge for the region selector. Three verbs, nothing else.
 *
 * The selector covers the user's entire screen while it is up, so it is the one
 * window in this app where a bug means "you cannot use your computer". Its API is
 * kept to the minimum that can express: here is the frozen frame, here is what I
 * selected, I gave up.
 */
const api = {
  // No image channel: the selector is transparent and shows the LIVE screen, so
  // there is nothing to ship into it. The screenshot happens in main, after the
  // drag, once this window is gone.
  /** Selection as fractions of the window, 0-1, so DPI never enters the maths. */
  done: (rect: { x: number; y: number; w: number; h: number }): void => {
    ipcRenderer.send('region:done', rect);
  },
  cancel: (): void => { ipcRenderer.send('region:cancel'); },
};

contextBridge.exposeInMainWorld('region', api);
