import React, { useState } from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

export type SliceInsets = { top: number; right: number; bottom: number; left: number };

type Props = {
  source: ImageSourcePropType;
  insets: SliceInsets;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Keeps generated frame corners at their original proportions while allowing
 * the paper/button center to expand to the control's actual size.
 */
export default function FolioNineSliceImage({ source, insets, style, accessibilityLabel }: Props) {
  const [height, setHeight] = useState(0);
  const asset = Image.resolveAssetSource(source);
  const scale = height > 0 && asset?.height ? height / asset.height : 1;
  const top = Math.max(1, insets.top * scale);
  const right = Math.max(1, insets.right * scale);
  const bottom = Math.max(1, insets.bottom * scale);
  const left = Math.max(1, insets.left * scale);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (Math.abs(nextHeight - height) > 0.5) setHeight(nextHeight);
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
