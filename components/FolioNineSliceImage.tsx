import React, { useState } from 'react';
import { Asset } from 'expo-asset';
import { Image, Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

export type SliceInsets = { top: number; right: number; bottom: number; left: number };

type Props = {
  source: number;
  insets: SliceInsets;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Keeps generated frame corners at their original proportions while allowing
 * the paper/button center to expand to the control's actual size.
 */
export default function FolioNineSliceImage({ source, insets, style, accessibilityLabel }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const asset = Asset.fromModule(source);
  const scaleX = size.width > 0 && asset?.width ? size.width / asset.width : 1;
  const scaleY = size.height > 0 && asset?.height ? size.height / asset.height : 1;
  const top = Math.max(1, insets.top * scaleY);
  const right = Math.max(1, insets.right * scaleX);
  const bottom = Math.max(1, insets.bottom * scaleY);
  const left = Math.max(1, insets.left * scaleX);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (Math.abs(width - size.width) > 0.5 || Math.abs(height - size.height) > 0.5) {
      setSize({ width, height });
    }
  };

  const webNineSliceStyle = {
    ...StyleSheet.absoluteFillObject,
    borderStyle: 'solid',
    borderTopWidth: top,
    borderRightWidth: right,
    borderBottomWidth: bottom,
    borderLeftWidth: left,
    borderImageSource: asset?.uri ? `url("${asset.uri}")` : undefined,
    borderImageSlice: `${insets.top} ${insets.right} ${insets.bottom} ${insets.left} fill`,
    borderImageWidth: `${top}px ${right}px ${bottom}px ${left}px`,
    borderImageRepeat: 'stretch',
  } as ViewStyle;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, style]}
      onLayout={handleLayout}
    >
      {Platform.OS === 'web' && asset?.uri ? (
        <View style={webNineSliceStyle} />
      ) : (
        <Image
          source={source}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
          {...({ capInsets: insets } as object)}
          accessible={false}
          accessibilityLabel={accessibilityLabel}
        />
      )}
    </View>
  );
}
