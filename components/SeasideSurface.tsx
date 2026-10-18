import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import SeasideFrame from './SeasideFrame';

type Props = { children: React.ReactNode; kind?: 'confirm' | 'drawer' | 'notice'; style?: StyleProp<ViewStyle> };
export default function SeasideSurface({ children, kind = 'confirm', style }: Props) {
  const skin = kind === 'drawer' ? 'panel-drawer' : kind === 'notice' ? 'banner-notice' : 'panel-confirm';
  return <View testID={`seaside-surface-${kind}`} style={[styles.surface, kind === 'notice' && styles.notice, style]}>
    <SeasideFrame skin={skin} />{children}
  </View>;
}
const styles = StyleSheet.create({ surface: { position: 'relative', padding: 26 }, notice: { paddingHorizontal: 22, paddingVertical: 16 } });
