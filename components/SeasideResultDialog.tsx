import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text } from 'react-native';
import SeasideButton from './SeasideButton';
import SeasideSurface from './SeasideSurface';

type Props = { visible: boolean; title: string; description: string; onClose: () => void; primaryLabel?: string; onPrimary?: () => void; children?: React.ReactNode };
export default function SeasideResultDialog({ visible, title, description, onClose, primaryLabel = '完成', onPrimary, children }: Props) {
  if (!visible) return null;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overlay}>
      <SeasideSurface style={styles.paper}>
        <Image source={require('../assets/ui-kit/seaside-a-v1/runtime/checkbox-checked.webp')} style={styles.mark} accessible={false} />
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
        <SeasideButton label={primaryLabel} onPress={onPrimary || onClose} style={styles.button} />
      </SeasideSurface>
    </ScrollView>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(35,30,25,.42)' }, paper: { width: '100%', maxWidth: 420 }, mark: { width: 48, height: 48, alignSelf: 'center', marginBottom: 12 }, title: { color: '#493D35', textAlign: 'center', fontSize: 23, lineHeight: 31, fontWeight: '700' }, description: { color: '#74695E', fontSize: 16, lineHeight: 25, textAlign: 'center', marginVertical: 18 }, button: { width: '100%', marginTop: 8 } });
