module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    // Reanimated 4 / Worklets Babel plugin is applied automatically by
    // babel-preset-expo (SDK 54+); the manual 'react-native-reanimated/plugin'
    // is deprecated and was removed.
  };
};
