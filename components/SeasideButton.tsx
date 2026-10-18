import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import SeasideFrame from './SeasideFrame';

const SKINS = { primary: 'button-primary-blue', transaction: 'button-transaction-gold', secondary: 'button-secondary-ivory', danger: 'button-danger-clay' } as const;
type Props = { label: string; onPress: () => void; tone?: keyof typeof SKINS; loading?: boolean; disabled?: boolean; fontFamily?: string; style?: StyleProp<ViewStyle> };

export default function SeasideButton({ label, onPress, tone = 'primary', loading = false, disabled = false, fontFamily, style }: Props) {
  const [focused, setFocused] = useState(false);
  const inactive = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy: loading }}
    disabled={inactive} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.button, style, focused && styles.focused, pressed && !inactive && styles.pressed]}>
    <SeasideFrame skin={SKINS[tone]} style={disabled && !loading ? styles.disabledArt : undefined} />
    <Text accessibilityElementsHidden={loading} style={[styles.label, { fontFamily }, disabled && styles.disabledLabel, loading && styles.hiddenLabel]}>{label}</Text>
    {loading && <View pointerEvents="none" style={styles.loading}><ActivityIndicator size="small" color="#21180F" /><Text style={[styles.label, { fontFamily }]}>提交中</Text></View>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { position: 'relative', minHeight: 56, minWidth: 128, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  label: { color: '#21180F', fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  focused: { borderColor: '#8B622E', borderRadius: 9 }, pressed: { opacity: .9, transform: [{ scale: .98 }] },
  disabledArt: { opacity: .58 }, disabledLabel: { color: '#74695E' }, hiddenLabel: { opacity: 0 },
  loading: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
