import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import SeasideFrame from './SeasideFrame';
import { WEB_TEXT_INPUT_RESET } from './webTextInputStyle';

type Props = TextInputProps & { label: string; unit?: string; hint?: string; error?: string; containerStyle?: StyleProp<ViewStyle> };
export default function SeasideTextInput({ label, unit, hint, error, containerStyle, style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return <View style={containerStyle}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.field, focused && styles.focused, !!error && styles.invalid]}>
      <SeasideFrame skin="field-input" />
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} accessibilityHint={error || hint || props.accessibilityHint}
        onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
        underlineColorAndroid="transparent" placeholderTextColor="#92887A" style={[styles.input, Platform.OS === 'web' && WEB_TEXT_INPUT_RESET, style, { fontSize: 16 }]}/>
      {!!unit && <Text style={styles.unit}>{unit}</Text>}
    </View>
    {!!error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : !!hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  label: { fontSize: 15, lineHeight: 22, color: '#493D35', fontWeight: '700', marginBottom: 8 },
  field: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 58, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 2, borderColor: 'transparent', borderRadius: 9 },
  focused: { borderColor: '#8B622E' }, invalid: { borderColor: '#9B4030' },
  input: { position: 'relative', zIndex: 1, flex: 1, minWidth: 0, color: '#493D35', fontSize: 16, lineHeight: 26, paddingVertical: 4, paddingHorizontal: 0, backgroundColor: 'transparent' },
  unit: { color: '#74695E', fontSize: 14, flexShrink: 0 }, hint: { color: '#74695E', fontSize: 13, lineHeight: 21, marginTop: 8 }, error: { color: '#9B4030', fontSize: 14, lineHeight: 22, marginTop: 8 },
});
