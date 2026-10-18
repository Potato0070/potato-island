import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SeasideSurface from './SeasideSurface';

type Props = { visible: boolean; title: string; busy?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode };
export default function SeasideSheet({ visible, title, busy = false, onClose, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SeasideSurface kind="drawer" style={[styles.paper, { paddingBottom: Math.max(26, insets.bottom) }]}>
        <View style={styles.handle} accessible={false} />
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`关闭${title}`} disabled={busy} onPress={onClose} style={styles.close}><Ionicons name="close" size={23} color="#74695E" /></Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {!!footer && <View style={styles.footer}>{footer}</View>}
      </SeasideSurface>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(35,30,25,.42)' }, paper: { width: '100%', maxWidth: 520, maxHeight: '90%', flexShrink: 1 }, handle: { width: 36, height: 4, borderRadius: 4, backgroundColor: '#B4C6CC', alignSelf: 'center', marginBottom: 12 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }, title: { flex: 1, color: '#493D35', fontSize: 21, lineHeight: 30, fontWeight: '700' }, close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, scroll: { flexShrink: 1 }, body: { gap: 16, paddingBottom: 8 }, footer: { paddingTop: 16 } });
