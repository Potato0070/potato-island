import React, { memo, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SEASIDE_SKINS, type SeasideSkin } from '../constants/seaside-ui';

type Props = { skin: SeasideSkin; style?: StyleProp<ViewStyle> };

/** Nine measured viewports of the original bitmap; corners retain their proportions. */
export default memo(function SeasideFrame({ skin, style }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const asset = SEASIDE_SKINS[skin];
  const cells = useMemo(() => {
    const { crop: c, slice: s } = asset;
    if (!size.width || !size.height) return [];
    const scale = Math.min(1, size.width / c.width, size.height / c.height);
    const dx = [0, s.left * scale, size.width - s.right * scale, size.width];
    const dy = [0, s.top * scale, size.height - s.bottom * scale, size.height];
    const sx = [c.x, c.x + s.left, c.right - s.right, c.right];
    const sy = [c.y, c.y + s.top, c.bottom - s.bottom, c.bottom];
    return Array.from({ length: 9 }, (_, index) => {
      const row = Math.floor(index / 3), col = index % 3;
      const width = dx[col + 1] - dx[col], height = dy[row + 1] - dy[row];
      const scaleX = width / (sx[col + 1] - sx[col]), scaleY = height / (sy[row + 1] - sy[row]);
      return { box: { left: dx[col], top: dy[row], width, height }, image: {
        left: -sx[col] * scaleX, top: -sy[row] * scaleY,
        width: asset.width * scaleX, height: asset.height * scaleY,
      } };
    });
  }, [asset, size]);
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, style]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setSize(current => Math.abs(current.width - width) > .5 || Math.abs(current.height - height) > .5 ? { width, height } : current);
  }}>
    {cells.map((cell, index) => <View key={index} style={[styles.cell, cell.box]}>
      <Image accessible={false} source={asset.source} resizeMode="stretch" style={[styles.image, cell.image]} />
    </View>)}
  </View>;
});

const styles = StyleSheet.create({ cell: { position: 'absolute', overflow: 'hidden' }, image: { position: 'absolute' } });
