import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only HTML shell (Expo Router uses this to render the document <head>/<body>
// for static + server rendering). This is where we load the site font (Lora)
// and apply it globally. React Native Web's <Text> inherits font-family from the
// document when it doesn't set its own, so setting it on html/body/#root cascades
// to the whole UI. Icon glyphs (@expo/vector-icons) set their own font-family
// inline, so they are unaffected.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Open Source Bible</title>
        <meta
          name="description"
          content="Type how you feel or what you're facing and find Bible verses that speak to the moment."
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#2F6457" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
          rel="stylesheet"
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const LORA = `'Lora', Georgia, 'Times New Roman', serif`;

// React Native Web gives every <Text> a base class that sets the system font via
// the CSS \`font:\` shorthand, which beats simple inheritance. To make the whole
// UI Lora we override that with higher-specificity selectors, but we must NOT
// touch icon glyphs (@expo/vector-icons), which carry their own
// \`r-fontFamily-*\` class. So:
//   display text -> [class*="css-text-"] WITHOUT an r-fontFamily class
//   the search box -> [class*="css-textinput-"]
// Icons keep their explicit font and render correctly.
const globalStyle = `
html, body, #root { height: 100%; }
html, body, #root { font-family: ${LORA}; }
html body [class*="css-text-"]:not([class*="r-fontFamily-"]) { font-family: ${LORA}; }
html body [class*="css-textinput-"] { font-family: ${LORA}; }
input, textarea, select, button { font-family: ${LORA}; }
/* Default background to avoid a flash before the app paints. */
body { background-color: #DCEAF5; }
`;
