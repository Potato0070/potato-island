import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import FolioButton from './FolioButton';
import FolioPaperSurface from './FolioPaperSurface';

type Props = {
  visible: boolean; title: string; description: string; error?: string; busy?: boolean;
  confirmLabel?: string; onCancel: () => void; onConfirm: () => void;
};

export default function TradeConfirmDialog({ visible, title, description, error, busy = false, confirmLabel = '确认购买', onCancel, onConfirm }: Props) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled">
      <FolioPaperSurface kind="confirm" style={styles.paper}>
        <View accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <FolioButton label="取消" tone="paper" onPress={onCancel} disabled={busy} style={styles.button} />
            <FolioButton label={busy ? '正在提交' : confirmLabel} onPress={onConfirm} loading={busy} style={styles.button} />
          </View>
        </View>
      </FolioPaperSurface>
    </ScrollView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(35,30,25,0.42)' },
  paper: { width: '100%', maxWidth: 420 },
  title: { fontSize: 21, lineHeight: 30, color: '#493D35', fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 25, color: '#74695E', marginVertical: 16 },
  error: { fontSize: 14, lineHeight: 22, color: '#A54935', marginBottom: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexGrow: 1, flexBasis: 100 },
});
