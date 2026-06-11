// Module-level callback so AppDrawer can trigger an immediate fade-out
// on the layout wrapper before the route changes.
let _onFadeOut: (() => void) | null = null;

export const navSignal = {
  register: (cb: () => void) => { _onFadeOut = cb; },
  trigger:  () => _onFadeOut?.(),
};
