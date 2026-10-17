import React, { useState } from 'react';
import { Asset } from 'expo-asset';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import FolioNineSliceImage, { type SliceInsets } from './FolioNineSliceImage';

const SURFACES = {
  paper: {
    source: require('../assets/owned-collection/f-card-v1/runtime/archive-paper-panel.webp'),
    insets: { top: 70, right: 68, bottom: 100, left: 48 },
  },
  plaque: {
    source: require('../assets/owned-collection/f-card-v1/runtime/paper-plaque.webp'),
    insets: { top: 36, right: 40, bottom: 36, left: 40 },
  },
  texture: {
    source: require('../assets/owned-collection/f-card-v1/runtime/paper-texture.webp'),
    // This asset is a square sheet with torn edges, not a seamless texture.
    // Nine-slice the edge so wide cards do not scale the whole sheet to their width.
    insets: { top: 32, right: 32, bottom: 32, left: 32 },
  },
  confirm: {
    source: require('../assets/owned-collection/f-card-v1/runtime/withdraw-confirm-panel.webp'),
    insets: { top: 145, right: 130, bottom: 125, left: 130 },
  },
  result: {
    source: require('../assets/owned-collection/f-card-v1/runtime/result-paper-panel.webp'),
    insets: { top: 95, right: 90, bottom: 110, left: 90 },
  },
};

type Props = {
  children: React.ReactNode;
  kind?: keyof typeof SURFACES;
  style?: StyleProp<ViewStyle>;
};

export default function FolioPaperSurface({ children, kind = 'paper', style }: Props) {
  const surface = SURFACES[kind] as { source: number; insets: SliceInsets };
  const [width, setWidth] = useState(0);
  const asset = Asset.fromModule(surface.source);
  const scale = width && asset.width ? Math.min(1, width / asset.width) : 0;
  const requested = StyleSheet.flatten(style) || {};
  const number = (value: unknown) => typeof value === 'number' ? value : 0;
  // Keep content beyond the complete decorative slice, including folded corners.
  // The width-based minimum is stable even when text wraps and changes height.
  const safePadding = {
    paddingTop: Math.max(number(requested.paddingTop ?? requested.paddingVertical ?? requested.padding), surface.insets.top * scale + 8),
    paddingRight: Math.max(number(requested.paddingRight ?? requested.paddingHorizontal ?? requested.padding), surface.insets.right * scale + 8),
    paddingBottom: Math.max(number(requested.paddingBottom ?? requested.paddingVertical ?? requested.padding), surface.insets.bottom * scale + 8),
    paddingLeft: Math.max(number(requested.paddingLeft ?? requested.paddingHorizontal ?? requested.padding), surface.insets.left * scale + 8),
  };
  return (
    <View testID={`folio-surface-${kind}`} style={[styles.surface, style, safePadding]} onLayout={event => {
      const nextWidth = event.nativeEvent.layout.width;
      setWidth(current => Math.abs(current - nextWidth) > 0.5 ? nextWidth : current);
    }}>
      <FolioNineSliceImage source={surface.source} insets={surface.insets} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ surface: { position: 'relative', overflow: 'hidden' } });
