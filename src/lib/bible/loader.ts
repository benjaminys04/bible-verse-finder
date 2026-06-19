import type { BibleData } from './types';

// Lazy, cached loaders for each bundled public-domain translation.
//
// This module is imported ONLY from server API routes, so the ~4 MB/translation
// JSON is bundled into the server target and never reaches the client. Each
// translation is loaded on first use and then memoized for the process lifetime.
//
// The import() specifiers are static string literals so Metro/bundlers can
// resolve them at build time.
const loaders: Record<string, () => Promise<{ default: BibleData }>> = {
  kjv: () => import('../../../assets/bibles/kjv.json'),
  web: () => import('../../../assets/bibles/web.json'),
  asv: () => import('../../../assets/bibles/asv.json'),
};

const cache = new Map<string, BibleData>();

export const BUNDLED_TRANSLATION_IDS = Object.keys(loaders);

export function isBundledTranslation(id: string): boolean {
  return id in loaders;
}

export async function loadTranslation(id: string): Promise<BibleData> {
  const key = id.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const loader = loaders[key];
  if (!loader) {
    throw new Error(`Unknown bundled translation: ${id}`);
  }
  const mod = await loader();
  // JSON imported as a module exposes the parsed object on `default`.
  const data = (mod.default ?? (mod as unknown)) as BibleData;
  cache.set(key, data);
  return data;
}
