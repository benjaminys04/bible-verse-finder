// Vercel serverless entry for the Expo Router server build.
//
// `expo export -p web` (run by Vercel's buildCommand) emits the server bundle to
// dist/server. This adapter, shipped with expo-router via @expo/server, turns
// that bundle into a single request handler that serves every server route —
// including the /search, /context, and /translations API routes that hold the
// API key and do the grounded verse lookup.
//
// Static client assets live in dist/client and are served directly by Vercel;
// anything that isn't a static file falls through to this handler (see the
// rewrites in vercel.json).
const path = require('path');
const { createRequestHandler } = require('@expo/server/adapter/vercel');

module.exports = createRequestHandler({
  build: path.join(process.cwd(), 'dist/server'),
});
