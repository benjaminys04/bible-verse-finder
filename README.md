# Verse Finder

A warm, chatbot-style Bible verse finder — **a website**. Type anything: a theme
("forgiveness"), a situation ("I just lost my job"), a feeling, or a half-formed
thought, and get **3–7 real, correctly-cited verses**, each with a one-line note
on why it fits, in the translation you choose.

It's fully responsive, so it looks right on a phone browser and a desktop alike.

> **For everyone** — any faith or none, any age, first-time readers and lifelong
> ones. Plain language, no assumed background, no preachiness.

---

## Why the quotes are always real (anti-hallucination)

The language model **never writes verse text.** On each search it returns
*structured references only* (`book / chapter / verse / reason`) through forced
tool use. The **server** then looks up the exact wording from a trusted, bundled,
public-domain dataset and uses *that* for display. If a returned reference
doesn't resolve (wrong book, non-existent verse, a verse missing from a range),
it is **dropped** and the server makes one more round to backfill toward the 3–7
target. Result: every citation on screen is backed by real text — zero
hallucinated references. (Verified against live model output: a "feeling anxious"
search returned 7 references and all 7 resolved to exact bundled text.)

The API key never reaches the browser: all model calls go through server-side API
routes (`app/*+api.ts`).

---

## Tech, in one line

Expo Router (web output) + React Native Web + TypeScript. That renders a normal
website with built-in server API routes, which is what lets the API key and the
verse lookup stay on the server. It deploys as a standard web app (static client
+ serverless functions) to Vercel or Expo hosting, and attaches to any domain.

---

## Assumptions

- **Bundled translations:** King James (KJV), World English Bible (WEB), and
  American Standard Version (ASV) — all public domain, included as JSON so the
  app works out of the box. WEB is the default (reads most naturally).
- **Copyrighted translations (NIV/ESV/NLT):** supported only through a licensed
  Bible-API adapter that activates **if** you provide a key. Their text is *not*
  bundled because it is under copyright. See "Copyrighted translations" below.
- **Default model:** `claude-haiku-4-5` (fast, inexpensive, strong enough for
  relevance ranking). Override with `LLM_MODEL`. Provider defaults to Anthropic;
  set `LLM_PROVIDER=openai` to swap.

---

## Run it locally

### Prerequisites
- Node.js 18+ and npm
- One LLM key (Anthropic by default). The bundled translations need no key, but
  relevance ranking does.

### Steps
```bash
cd verse-finder
npm install

cp .env.example .env          # then set ANTHROPIC_API_KEY in .env
npm run dev                   # = expo start --web
```
Open the printed `http://localhost:8081`. Try: **forgiveness**, **I feel
anxious**, **the story of David and Goliath**. Switch translations (KJV ↔ WEB ↔
ASV) and the wording changes. Save a verse and reload — it persists
(localStorage). Tap **Context** to expand surrounding verses.

---

## Deploy to a domain

The app uses server output (`web.output: "server"` in `app.json`) because the API
routes run server-side. Pick one host:

### Option A — Vercel (recommended for a custom domain)

This repo is **pre-wired for Vercel**: `vercel.json` sets the build/output and an
`api/index.js` serverless entry hands every request to the Expo server build
(via `@expo/server/adapter/vercel`). Vercel runs the build for you — you don't
need to `expo export` manually.

```bash
npm i -g vercel
vercel            # first run: links/creates the project, then builds & deploys
vercel --prod     # promote to production
```
1. In the **Vercel dashboard → your project → Settings → Environment Variables**,
   add `ANTHROPIC_API_KEY` (and any optional keys). Redeploy after adding.
2. **Settings → Domains → Add** your domain (e.g. `versefinder.com`).
3. Point DNS at Vercel as the dashboard instructs — typically:
   - Apex/root domain: an `A` record to Vercel's IP (shown in the dashboard), or
     use Vercel's nameservers.
   - `www` (or any subdomain): a `CNAME` to `cname.vercel-dns.com`.
4. Vercel issues HTTPS automatically once DNS verifies (a few minutes).

> The verse JSON is bundled into the server build and included with the function
> via the `includeFiles` glob in `vercel.json`, so no extra data wiring is
> needed.

### Option B — Expo hosting (EAS)
```bash
npm i -g eas-cli && eas login
npm run export
eas deploy                # deploys dist/; prints a *.expo.app URL
```
Set `ANTHROPIC_API_KEY` as an environment variable for the deployment, then add
a custom domain from the EAS hosting dashboard and follow its DNS instructions.

Either way: **set your API key in the host's environment variables** — don't rely
on the local `.env` in production.

---

## Bundled verse data

`assets/bibles/{kjv,web,asv}.json` ship in the repo, so there's nothing to fetch
on first run. To rebuild/refresh from source (getbible.net v2, all public
domain):
```bash
npm run build:bible       # needs Node 18+
```
Compact nested shape for O(1) lookup:
```jsonc
{ "id": "web", "name": "World English Bible", "abbreviation": "WEB",
  "license": "Public Domain",
  "books": { "John": { "3": { "16": "For God so loved the world, ..." } } } }
```

---

## Copyrighted translations (NIV / ESV / NLT …)

Off by default; require **your own license + API key**. The adapter
(`src/lib/translations/bibleApiAdapter.ts`) targets
[API.Bible](https://scripture.api.bible/). To enable:
```bash
# in .env (and in your host's env vars for production)
BIBLE_API_KEY=your-api-bible-key
BIBLE_API_TRANSLATIONS=niv:New International Version:de4e12af7f28f599-02
```
Listed translations then appear in the picker. With no key, only the
public-domain translations are offered. **Distributing copyrighted scripture
text requires an agreement with the rights holder** — this adapter only wires up
access you're licensed to use.

---

## How it works

```
Browser (responsive web)
  app/index.tsx ── chat UI, result cards, recents, translation + text-size + theme
  app/favorites.tsx
        │  fetch /search, /context, /translations  (same origin)
        ▼
Server API routes (key stays here)
  app/search+api.ts   rate-limit → LLM (structured refs) → resolve in dataset → drop+backfill
  app/context+api.ts  surrounding verses for "tap to expand"
  app/translations+api.ts  picker options (bundled + licensed)
        │
        ▼
  src/lib/llm/*        provider-agnostic; Anthropic (default) / OpenAI; forced JSON
  src/lib/bible/*      book-name normalization + grounded lookup
  assets/bibles/*.json trusted text
```

- **State / persistence:** a small [Zustand](https://github.com/pmndrs/zustand)
  store with `localStorage` holds search history, favorites, chosen translation,
  font scale, and theme.
- **Why `fetch` instead of an SDK in the LLM adapters:** one tiny code path per
  provider, minimal dependencies, trivial Anthropic↔OpenAI swap. Forced tool use
  guarantees structured output; sampling params are omitted so it works on every
  current model.

---

## Accessibility

- Screen-reader labels and ARIA roles throughout, with live regions for
  loading / results / errors; full keyboard navigation.
- Respects the browser/OS font scaling **and** offers an in-app text-size control
  (85%–160%).
- WCAG-AA color contrast in both themes, 44px+ tap targets, dark mode, and a
  `system / light / dark` toggle.

---

## States covered

Every async path has loading, empty, and error states — including a gentle
**"No strong match — try rephrasing"** and a friendly rate-limit message. Context
expansion has its own loading/error handling.

---

## Project layout

```
app/                  pages + server API routes (+api.ts)
src/components/        ChatInput, VerseCard, TranslationPicker, FontSizeControl, States
src/store/            Zustand store (history, favorites, settings)
src/lib/bible/        types, lazy JSON loader, ref parsing + grounded lookup
src/lib/llm/          provider-agnostic grounded search (Anthropic / OpenAI)
src/lib/translations/ bundled + licensed routing, client-safe shared list
assets/bibles/        bundled public-domain text (KJV / WEB / ASV)
scripts/build-bible.js  rebuild the bundled data
.env.example          every key (LLM + optional Bible API)
```

---

## Production notes

- Set a **monthly spend limit** on the Anthropic console as a safety net.
- The built-in rate limiter is in-memory (per server instance). On a
  multi-instance / serverless host it's best-effort; back it with Redis/Upstash
  for hard limits at scale.
- A custom favicon/social-preview image is worth adding before launch.
