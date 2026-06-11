// Module-level store for navigation direction. Set by AppDrawer before
// router.replace() fires so the layout's entering animation reads the
// correct direction when the keyed Animated.View remounts.
let _dir: 'forward' | 'back' = 'forward';

export const navDir = {
  set: (d: 'forward' | 'back') => { _dir = d; },
  get: (): 'forward' | 'back' => _dir,
};
