import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const SURFACES = {
  blue: require('../assets/owned-collection/f-card-v1/runtime/button-fog-blue.webp'),
  gold: require('../assets/owned-collection/f-card-v1/runtime/button-harvest-gold.webp'),
  paper: require('../assets/owned-collection/f-card-v1/runtime/button-ivory-paper.webp'),
};
type Props = { label: string; onPress: () => void; tone?: keyof typeof SURFACES; disabled?: boolean; loading?: boolean; fontFamily?: string; style?: ViewStyle; icon?: keyof typeof Ionicons.glyphMap };
export default function FolioButton({ label, onPress, tone = 'blue', disabled = false, loading = false, fontFamily, style, icon }: Props) {
  const inactive = disabled || loading;
  const color = tone === 'blue' ? '#FFFFFF' : tone === 'gold' ? '#493D35' : '#493D35';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.button, style, inactive && styles.disabled, pressed && styles.pressed]}>
    <Image source={SURFACES[tone]} resizeMode="stretch" style={StyleSheet.absoluteFill} accessible={false} />
    {loading ? <ActivityIndicator color={color} size="small" /> : icon ? <Ionicons name={icon} size={17} color={color} /> : null}
    <Text numberOfLines={1} style={[styles.text, { color, fontFamily }]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 48, minWidth: 84, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }, text: { fontSize: 14, lineHeight: 20 }, pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.48 } });
