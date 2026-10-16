import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import FolioNineSliceImage, { type SliceInsets } from './FolioNineSliceImage';

const SURFACES = {
  paper: {
    source: require('../assets/owned-collection/f-card-v1/runtime/archive-paper-panel.webp'),
    insets: { top: 48, right: 42, bottom: 48, left: 42 },
  },
  plaque: {
    source: require('../assets/owned-collection/f-card-v1/runtime/paper-plaque.webp'),
    insets: { top: 32, right: 34, bottom: 32, left: 34 },
  },
  texture: {
    source: require('../assets/owned-collection/f-card-v1/runtime/paper-texture.webp'),
    insets: { top: 42, right: 42, bottom: 42, left: 42 },
  },
  confirm: {
    source: require('../assets/owned-collection/f-card-v1/runtime/withdraw-confirm-panel.webp'),
    insets: { top: 72, right: 72, bottom: 72, left: 72 },
  },
  result: {
    source: require('../assets/owned-collection/f-card-v1/runtime/result-paper-panel.webp'),
    insets: { top: 68, right: 68, bottom: 68, left: 68 },
  },
};

type Props = {
  children: React.ReactNode;
  kind?: keyof typeof SURFACES;
  style?: StyleProp<ViewStyle>;
};

export default function FolioPaperSurface({ children, kind = 'paper', style }: Props) {
  const surface = SURFACES[kind] as { source: number; insets: SliceInsets };
  return (
    <View style={[styles.surface, style]}>
      {kind === 'texture'
        ? <Image source={surface.source} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} />
        : <FolioNineSliceImage source={surface.source} insets={surface.insets} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ surface: { position: 'relative', overflow: 'hidden' } });
