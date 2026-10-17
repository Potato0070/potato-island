import { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';

// Keep the official font files available to pages that use them, but register
// them after hydration. Expo's useFonts injects preload links into every
// exported route, which makes unrelated screens download both 5 MB files.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const REGULAR_FONT = require('../assets/fonts/misans/MiSans-Regular.woff2');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SEMIBOLD_FONT = require('../assets/fonts/misans/MiSans-Semibold.woff2');

export function useIslandFonts() {
  const [registered, setRegistered] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const regular = Image.resolveAssetSource(REGULAR_FONT)?.uri;
    const semibold = Image.resolveAssetSource(SEMIBOLD_FONT)?.uri;
    if (!regular || !semibold) return;

    const styleId = 'podao-island-font-faces';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @font-face {
          font-family: Island-Regular;
          src: url("${regular}") format("woff2");
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: Island-Semibold;
          src: url("${semibold}") format("woff2");
          font-weight: 600;
          font-display: swap;
        }
      `;
      document.head.appendChild(style);
    }

    setRegistered(true);
  }, []);

  return {
    regular: registered && Platform.OS === 'web' ? 'Island-Regular' : undefined,
    semibold: registered && Platform.OS === 'web' ? 'Island-Semibold' : undefined,
  };
}
