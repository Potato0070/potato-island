import type { TextStyle } from 'react-native';

// RN Web's TextInput styles allow a focused browser outline unless explicitly reset.
export const WEB_TEXT_INPUT_RESET = {
  outlineStyle: 'none',
  outlineWidth: 0,
  outlineColor: 'transparent',
  boxShadow: 'none',
} as unknown as TextStyle;
