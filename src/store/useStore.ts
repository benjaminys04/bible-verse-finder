import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SearchResult } from '../lib/api';
import { DEFAULT_TRANSLATION_ID } from '../lib/translations/shared';

export interface FavoriteVerse extends SearchResult {
  savedAt: number;
}

type ThemePref = 'light' | 'dark';

interface AppState {
  // Settings
  translationId: string;
  fontScale: number; // multiplier, 0.85 .. 1.6
  themePref: ThemePref;

  // Data
  history: string[]; // recent search queries, most-recent first
  favorites: FavoriteVerse[];

  // Actions
  setTranslation: (id: string) => void;
  setFontScale: (scale: number) => void;
  setThemePref: (pref: ThemePref) => void;

  addHistory: (query: string) => void;
  clearHistory: () => void;

  toggleFavorite: (verse: SearchResult) => void;
  isFavorite: (citation: string, translationId: string) => boolean;
  removeFavorite: (citation: string, translationId: string) => void;

  hydrated: boolean;
  setHydrated: () => void;
}

const MAX_HISTORY = 20;

function favKey(citation: string, translationId: string) {
  return `${translationId}::${citation}`;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      translationId: DEFAULT_TRANSLATION_ID,
      fontScale: 1,
      themePref: 'light',
      history: [],
      favorites: [],
      hydrated: false,

      setTranslation: (id) => set({ translationId: id }),
      setFontScale: (scale) => set({ fontScale: Math.min(1.6, Math.max(0.85, scale)) }),
      setThemePref: (pref) => set({ themePref: pref }),

      addHistory: (query) => {
        const q = query.trim();
        if (!q) return;
        const existing = get().history.filter((h) => h.toLowerCase() !== q.toLowerCase());
        set({ history: [q, ...existing].slice(0, MAX_HISTORY) });
      },
      clearHistory: () => set({ history: [] }),

      toggleFavorite: (verse) => {
        const key = favKey(verse.citation, verse.translationId);
        const exists = get().favorites.some((f) => favKey(f.citation, f.translationId) === key);
        if (exists) {
          set({
            favorites: get().favorites.filter((f) => favKey(f.citation, f.translationId) !== key),
          });
        } else {
          set({ favorites: [{ ...verse, savedAt: Date.now() }, ...get().favorites] });
        }
      },
      isFavorite: (citation, translationId) =>
        get().favorites.some((f) => favKey(f.citation, f.translationId) === favKey(citation, translationId)),
      removeFavorite: (citation, translationId) =>
        set({
          favorites: get().favorites.filter(
            (f) => favKey(f.citation, f.translationId) !== favKey(citation, translationId),
          ),
        }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'verse-finder-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        translationId: s.translationId,
        fontScale: s.fontScale,
        themePref: s.themePref,
        history: s.history,
        favorites: s.favorites,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
