const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK ships its React Native build as CommonJS (.cjs). Metro's
// package-exports resolution (enabled by default since Expo SDK 53) skips that
// build, which makes Firebase Auth crash with
// "Component auth has not been registered yet". Disabling package exports and
// adding the cjs source extension restores correct module resolution.
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './global.css' });
