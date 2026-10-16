import { useFonts, type FontSource } from 'expo-font';
import { Platform } from 'react-native';

const WEB_FONTS: Record<string, FontSource> = Platform.OS === 'web' ? {
  // Expo requires static asset references so Metro can bundle the font files.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'Island-Regular': require('../assets/fonts/misans/MiSans-Regular.woff2'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  'Island-Semibold': require('../assets/fonts/misans/MiSans-Semibold.woff2'),
} : {};

export function useIslandFonts() {
  const [loaded] = useFonts(WEB_FONTS);
  return {
    regular: loaded && Platform.OS === 'web' ? 'Island-Regular' : undefined,
    semibold: loaded && Platform.OS === 'web' ? 'Island-Semibold' : undefined,
  };
}
