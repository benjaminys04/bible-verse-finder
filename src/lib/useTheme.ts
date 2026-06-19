import { useStore } from '../store/useStore';
import { getTheme, type Theme } from './theme';

// Resolve the active theme purely from the user's explicit choice (light/dark) —
// no system / time-of-day switching. `fontScale` is kept at 1 (the in-app size
// control was removed) so existing size multipliers stay a harmless no-op.
export function useTheme(): { theme: Theme; fontScale: number } {
  const themePref = useStore((s) => s.themePref);
  const fontScale = useStore((s) => s.fontScale);
  return { theme: getTheme(themePref === 'dark' ? 'dark' : 'light'), fontScale };
}
