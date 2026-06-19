#!/usr/bin/env node
/*
 * build-bible.js — (re)generate the bundled public-domain translation files.
 *
 * Downloads KJV, WEB, and ASV from getbible.net v2 (all public domain) and
 * normalizes them into the compact shape the app expects:
 *
 *   assets/bibles/<id>.json
 *   { id, name, abbreviation, license, books: { "John": { "3": { "16": "..." } } } }
 *
 * The repo already ships these files; run this only to refresh or rebuild them:
 *   npm run build:bible
 *
 * Requires Node 18+ (global fetch).
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'bibles');

const SOURCES = [
  { id: 'kjv', url: 'https://api.getbible.net/v2/kjv.json', name: 'King James Version', abbr: 'KJV' },
  { id: 'web', url: 'https://api.getbible.net/v2/web.json', name: 'World English Bible', abbr: 'WEB' },
  { id: 'asv', url: 'https://api.getbible.net/v2/asv.json', name: 'American Standard Version', abbr: 'ASV' },
];

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

async function build() {
  if (typeof fetch !== 'function') {
    console.error('This script needs Node 18+ (global fetch).');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const src of SOURCES) {
    process.stdout.write(`Downloading ${src.abbr}… `);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`${src.url} -> HTTP ${res.status}`);
    const data = await res.json();

    const books = {};
    for (const b of data.books) {
      const chapters = {};
      for (const c of b.chapters) {
        const verses = {};
        for (const v of c.verses) verses[String(v.verse)] = clean(v.text);
        chapters[String(c.chapter)] = verses;
      }
      books[b.name] = chapters;
    }

    const out = {
      id: src.id,
      name: src.name,
      abbreviation: src.abbr,
      license: 'Public Domain',
      books,
    };
    const file = path.join(OUT_DIR, `${src.id}.json`);
    fs.writeFileSync(file, JSON.stringify(out));
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${Object.keys(books).length} books, ${kb} KB -> ${path.relative(process.cwd(), file)}`);
  }
  console.log('Done.');
}

build().catch((e) => {
  console.error('\nBuild failed:', e.message);
  process.exit(1);
});
