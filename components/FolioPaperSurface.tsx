import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const SURFACES = {
  paper: require('../assets/owned-collection/f-card-v1/runtime/archive-paper-panel.webp'),
  plaque: require('../assets/owned-collection/f-card-v1/runtime/paper-plaque.webp'),
  texture: require('../assets/owned-collection/f-card-v1/runtime/paper-texture.webp'),
  confirm: require('../assets/owned-collection/f-card-v1/runtime/withdraw-confirm-panel.webp'),
  result: require('../assets/owned-collection/f-card-v1/runtime/result-paper-panel.webp'),
};

type Props = {
  children: React.ReactNode;
  kind?: keyof typeof SURFACES;
  style?: StyleProp<ViewStyle>;
};

export default function FolioPaperSurface({ children, kind = 'paper', style }: Props) {
  return (
    <View style={[styles.surface, style]}>
      <Image source={SURFACES[kind]} resizeMode="stretch" style={StyleSheet.absoluteFill} accessible={false} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ surface: { position: 'relative', overflow: 'hidden' } });
