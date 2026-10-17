import { loadAsync, type FontSource } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const WEB_FONTS: Record<string, FontSource> = Platform.OS === 'web' ? {
  // Expo requires static asset references so Metro can bundle the font files.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'Island-Regular': require('../assets/fonts/misans/MiSans-Regular.woff2'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'Island-Semibold': require('../assets/fonts/misans/MiSans-Semibold.woff2'),
} : {};

export function useIslandFonts() {
  // Loading during static rendering registers global font preloads that can
  // leak into unrelated pages. Start only when a font-using screen mounts.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let mounted = true;
    loadAsync(WEB_FONTS).then(() => {
      if (mounted) setLoaded(true);
    }).catch(() => {
      // Keep the readable system fallback if fonts cannot be downloaded.
    });
    return () => { mounted = false; };
  }, []);
  return {
    regular: loaded && Platform.OS === 'web' ? 'Island-Regular' : undefined,
    semibold: loaded && Platform.OS === 'web' ? 'Island-Semibold' : undefined,
  };
}
