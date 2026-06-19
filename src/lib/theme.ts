// Color tokens for light and dark mode. Chosen for WCAG AA contrast against
// their backgrounds. A warm, calm palette to suit the app's gentle tone.

export interface Theme {
  name: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  danger: string;
  highlight: string; // background for the highlighted verse in context view
  shadow: string;
}

export const lightTheme: Theme = {
  name: 'light',
  bg: '#DCEAF5', // soft sky blue
  surface: '#FBFDFF', // cool near-white card
  surfaceAlt: '#EAF1F8', // pale blue tint for chips
  border: '#C5D8E6',
  text: '#1E2A33', // deep slate, ~14:1 on surface
  textMuted: '#4F5E6A', // ~6.5:1 on surface (AA)
  accent: '#2F6457', // deep teal — AA on card, page bg, and soft pills
  accentText: '#FFFFFF',
  accentSoft: '#D6E7E0', // soft teal pill
  danger: '#B23A2E',
  highlight: '#DDEBF8', // gentle blue highlight for the focused verse
  shadow: 'rgba(30, 42, 51, 0.10)',
};

export const darkTheme: Theme = {
  name: 'dark',
  bg: '#101722', // cool navy slate
  surface: '#1A2430',
  surfaceAlt: '#212E3B',
  border: '#2C3A48',
  text: '#EAF1F7', // ~14:1 on surface
  textMuted: '#A8B6C3', // ~7.5:1 on surface (AA)
  accent: '#84BCAC', // soft sage-teal, high contrast on dark
  accentText: '#101722',
  accentSoft: '#233140',
  danger: '#E2796B',
  highlight: '#243243',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export function getTheme(name: 'light' | 'dark'): Theme {
  return name === 'dark' ? darkTheme : lightTheme;
}
