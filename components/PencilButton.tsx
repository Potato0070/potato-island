import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const BACKGROUNDS = {
  primary: require('../assets/buttons/colored-pencil-v1/runtime/primary-blue.webp'),
  transaction: require('../assets/buttons/colored-pencil-v1/runtime/transaction-gold.webp'),
  secondary: require('../assets/buttons/colored-pencil-v1/runtime/secondary-ivory.webp'),
  danger: require('../assets/buttons/colored-pencil-v1/runtime/danger-terracotta.webp'),
};
type Props = { label: string; onPress: () => void; variant?: keyof typeof BACKGROUNDS; disabled?: boolean; loading?: boolean; fontFamily?: string; style?: ViewStyle };

export default function PencilButton({ label, onPress, variant = 'primary', disabled = false, loading = false, fontFamily, style }: Props) {
  const inactive = disabled || loading;
  const color = variant === 'primary' ? '#FFFFFF' : '#493D35';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
      style={({ pressed }) => [styles.button, style, inactive && styles.disabled, pressed && styles.pressed]}>
      <Image testID="pencil-button-art" source={BACKGROUNDS[variant]} resizeMode="stretch" style={[StyleSheet.absoluteFill, styles.background]} accessible={false} />
      {loading ? <ActivityIndicator color={color} size="small" /> : null}
      <Text style={[styles.label, { color, fontFamily }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 46, minWidth: 144, paddingHorizontal: 20, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  label: { fontSize: 15, lineHeight: 22 },
  background: { width: '100%', height: '100%' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.87 },
  disabled: { opacity: 0.45 },
});
