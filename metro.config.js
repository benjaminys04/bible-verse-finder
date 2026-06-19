// Metro config (Expo defaults + a production-minifier tweak).
//
// IMPORTANT: Expo's web production minifier (terser) mangles class and function
// names by default. Expo Modules register their web implementations with
// `registerWebModule`, which validates `implementation.prototype instanceof
// NativeModule`. When terser renames those classes, that check fails at runtime
// with "Module implementation must be a class", which crashes the app AFTER it
// hydrates (the page flashes its content, then goes blank). Preserving class and
// function names during minification fixes it. This only affects production web
// builds; dev is unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const base = config.transformer.minifierConfig || {};
config.transformer.minifierConfig = {
  ...base,
  keep_classnames: true,
  keep_fnames: true,
  mangle: {
    ...(base.mangle || {}),
    keep_classnames: true,
    keep_fnames: true,
  },
  compress: {
    ...(base.compress || {}),
    keep_classnames: true,
    keep_fnames: true,
  },
};

module.exports = config;
