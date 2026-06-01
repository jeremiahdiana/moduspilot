import { Text, TextInput } from 'react-native';

/**
 * Brand typography — 1:1 with the web app, which loads Clash Display (display)
 * + Satoshi (body) from Fontshare. We bundle the same TTF weights so iOS
 * renders the exact same wordmarks/headings/body as moduspilot.com.
 *
 * On iOS, expo-font registers each TTF under its real internal family name
 * ("Clash Display" / "Satoshi"), so `fontFamily: 'Satoshi'` + a fontWeight
 * (font-bold, font-semibold, …) auto-selects the matching face — exactly like
 * CSS font-weight on web. That's why setting the default family below makes
 * every existing weight utility "just work" with the brand font.
 */
export const FONT_MAP = {
  'ClashDisplay-Regular': require('../assets/fonts/ClashDisplay-Regular.ttf'),
  'ClashDisplay-Medium': require('../assets/fonts/ClashDisplay-Medium.ttf'),
  'ClashDisplay-Semibold': require('../assets/fonts/ClashDisplay-Semibold.ttf'),
  'ClashDisplay-Bold': require('../assets/fonts/ClashDisplay-Bold.ttf'),
  'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
  'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
  'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
  'Satoshi-Black': require('../assets/fonts/Satoshi-Black.ttf'),
};

/** The real family names usable in `fontFamily` once the faces are registered. */
export const FONT_FAMILY = {
  display: 'Clash Display',
  sans: 'Satoshi',
};

/**
 * Make Satoshi the app-wide default so all body text matches web without
 * touching every <Text>. Components keep using font-weight utilities; iOS
 * picks the right Satoshi face. Headings opt into Clash Display via
 * `font-display` (see tailwind.config.js). TextInput gets it too.
 */
export function setDefaultFontFamily() {
  const apply = (Component: typeof Text | typeof TextInput) => {
    const C = Component as unknown as { defaultProps?: { style?: unknown } };
    C.defaultProps = C.defaultProps || {};
    const existing = C.defaultProps.style;
    C.defaultProps.style = [{ fontFamily: FONT_FAMILY.sans }, existing].filter(Boolean);
  };
  apply(Text);
  apply(TextInput);
}
