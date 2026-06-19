# Open Source Bible: Build Plan

A chatbot-style Bible verse finder **website**, built on Expo Router (web output)
+ React Native Web + TypeScript so it renders a responsive site with built-in
server API routes. Type anything ("forgiveness", "I just lost my job") and get
3–7 real, correctly-cited verses with a one-line reason each, in your chosen
translation. (Originally scaffolded to also target native iOS; that target was
removed — this is now web-only.)

## Key architectural decisions

1. **Anti-hallucination by construction.** The LLM never writes verse text. It
   returns *structured references only* (`book / chapter / verses / reason`) via
   forced tool use. The **server** looks up the exact text from bundled,
   public-domain JSON and uses THAT for display. Unresolved references are
   dropped and (optionally) backfilled. Every quote on screen is real.

2. **Key never touches the client.** All LLM calls go through Expo Router API
   routes (`app/*+api.ts`) — server-only code. The client calls `/search` and
   `/context`; the server holds `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`.

3. **Model-agnostic via a thin adapter.** `src/lib/llm` dispatches to Anthropic
   (default) or OpenAI based on env. Both adapters use `fetch` (raw HTTP) rather
   than an SDK — deliberately, to (a) keep one tiny code path per provider, (b)
   keep dependencies minimal, and (c) avoid bundling a Node SDK into a RN/Metro
   server target. Forced JSON uses Anthropic **tool use** / OpenAI
   **function calling** so the model can't free-type.

4. **Verse data is real and bundled.** KJV, WEB, and ASV are normalized to a
   compact JSON shape under `assets/bibles/` (sourced from getbible.net v2,
   all public domain) so the app works offline/out-of-the-box for free. A
   `scripts/build-bible.js` reproduces the data. Copyrighted translations
   (NIV/ESV/NLT) are supported only through a licensed Bible-API adapter that
   activates *if* a key is provided — documented as requiring a license.

5. **Lookup runs server-side**, so the ~4 MB/translation JSON never ships in the
   client bundle. The client stays light; history/favorites/settings live in
   AsyncStorage (localStorage on web) via a small Zustand store.

## File tree

```
verse-finder/
  app.json, package.json, tsconfig.json, babel.config.js, .env.example, README.md
  app/
    _layout.tsx           Root layout: theme + safe area + header
    index.tsx             Home: chat-style search, results, recents, pickers
    favorites.tsx         Saved verses
    search+api.ts         POST /search  → LLM refs → grounded lookup → results
    context+api.ts        GET  /context → surrounding verses for a reference
  src/
    components/
      ChatInput.tsx, MessageList.tsx, VerseCard.tsx,
      TranslationPicker.tsx, FontSizeControl.tsx, States.tsx
    store/useStore.ts     Zustand: history, favorites, translation, fontScale, theme
    lib/
      bible/{types,loader,index}.ts   Data types, lazy JSON loader, ref parsing + lookup
      llm/{types,prompt,index,anthropic,openai}.ts   Provider-agnostic grounded search
      translations/{registry,bibleApiAdapter}.ts     PD + licensed-API translations
      api.ts              Client fetch helpers + origin resolution
      theme.ts            Light/dark tokens, WCAG-AA colors
      rateLimit.ts        In-memory token-bucket per IP for the server route
  assets/bibles/{kjv,web,asv}.json    Bundled public-domain text (real)
  scripts/build-bible.js              Rebuild/refresh the bundled data
```

## Build order (each layer testable)

(a) scaffold → (b) verse data + lookup → (c) grounded LLM route → (d) search UI +
cards → (e) translation picker + history/favorites → (f) a11y + dark mode → (g) docs.

## Assumptions (also surfaced in the README)

- Bundled translations: KJV, WEB, ASV (all public domain). NIV/ESV/NLT require a
  licensed API key and are off by default.
- Default model is `claude-haiku-4-5` (fast + inexpensive, strong enough for
  relevance ranking); override with `LLM_MODEL`. Provider defaults to Anthropic.
- Could not run `expo start` in the authoring environment (no Node installed),
  so the app is delivered fully assembled with exact run/verify steps. The
  bundled verse data is real (verified lookups), guaranteeing grounded output.
