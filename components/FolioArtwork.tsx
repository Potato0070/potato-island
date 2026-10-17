import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// Exact card frame archived with the approved F concept board.
const FRAME = require('../assets/owned-collection/f-card-v1/runtime/album-card-frame-v2.webp');
const SERIAL_TAG = require('../assets/owned-collection/f-card-v1/runtime/serial-number-tag.webp');
const STATE_TAGS = {
  idle: require('../assets/owned-collection/f-card-v1/runtime/status-in-vault.webp'),
  listed: require('../assets/owned-collection/f-card-v1/runtime/status-listed.webp'),
  other: require('../assets/owned-collection/f-card-v1/runtime/status-unavailable.webp'),
};

// These generated assets are portrait paper tabs (about 1:2), so keep their
// natural silhouette instead of squeezing them into the old 1:3 dimensions.
const SERIAL_TAG_SIZE = { width: 32, height: 66 } as const;
const STATE_TAG_SIZE = { width: 34, height: 68 } as const;

type ArtworkProps = {
  uri: string | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Use the layered scrapbook frame from the approved F album concept. */
  framed?: boolean;
  /** Tilt the photo and its frame as one mount, keeping the complete square art visible. */
  tiltArtwork?: boolean;
};

export function FolioArtwork({ uri, style, accessibilityLabel = '藏品封面', framed = false, tiltArtwork = false }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const artwork = uri && !failed ? (
    <Image accessibilityLabel={accessibilityLabel} source={{ uri }} resizeMode="contain" style={styles.imageFill} onError={() => setFailed(true)} />
  ) : (
    <View style={styles.fallback}>
      <Ionicons name="image-outline" size={24} color="#537895" />
      <Text style={styles.fallbackText}>藏品图暂缺</Text>
    </View>
  );

  return (
    <View style={[styles.artwork, style]}>
      {framed ? <View testID="folio-photo-mount" style={[styles.photoMount, tiltArtwork && styles.photoMountTilted]}>
        <Image source={FRAME} resizeMode="contain" style={styles.imageFill} accessible={false} />
        <View testID="folio-photo-window" style={styles.aperture}>{artwork}</View>
      </View> : artwork}
    </View>
  );
}

type SerialTagProps = { value: string; style?: StyleProp<ViewStyle>; fontFamily?: string };

export function FolioSerialTag({ value, style, fontFamily }: SerialTagProps) {
  return (
    <View accessible accessibilityLabel={`藏品编号 ${value}`} style={[styles.serialTag, style, SERIAL_TAG_SIZE]}>
      <Image source={SERIAL_TAG} resizeMode="contain" style={styles.imageFill} accessible={false} />
      <View testID="folio-serial-label" style={styles.serialLabelStage}>
        <Text numberOfLines={1} style={[styles.serialText, { fontSize: Math.min(9, 46 / Math.max(1, value.length * 0.65)) }, fontFamily ? { fontFamily } : null]}>{value}</Text>
      </View>
    </View>
  );
}

type StateTagProps = { state: 'idle' | 'listed' | 'other'; label: string; style?: StyleProp<ViewStyle>; fontFamily?: string };

export function FolioStateTag({ state, label, style, fontFamily }: StateTagProps) {
  return (
    <View accessible accessibilityLabel={`藏品状态 ${label}`} style={[styles.stateTag, style, STATE_TAG_SIZE]}>
      <Image source={STATE_TAGS[state]} resizeMode="contain" style={styles.imageFill} accessible={false} />
      <View style={styles.stateLabel}>
        {Array.from(label).map((character, index) => <Text key={`${character}-${index}`} style={[styles.stateCharacter, label.length > 4 && styles.stateCharacterCompact, fontFamily ? { fontFamily } : null]}>{character}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // RN Web adds the bundled asset's intrinsic dimensions to Image. Insets alone
  // do not override them: a 1254px frame would overflow a 350px card. Explicit
  // percentages keep every local frame/tab inside its measured container.
  imageFill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  // The frame is a transparent PNG/WebP with a transparent center aperture.
  // Keep both layers transparent so the square collectible art shows through
  // the opening instead of a beige square leaking behind the frame.
  artwork: { position: 'relative', width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  photoMount: { ...StyleSheet.absoluteFillObject },
  photoMountTilted: { width: '96%', height: '96%', left: '2%', top: '2%', transform: [{ rotate: '-2deg' }] },
  aperture: { position: 'absolute', left: '15.5%', top: '16.7%', width: '70.2%', height: '66.8%', overflow: 'hidden', borderRadius: 5, backgroundColor: '#F5EAD1' },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden', backgroundColor: '#F5F0E7' },
  fallbackText: { color: '#8D8175', fontSize: 9, lineHeight: 12 },
  serialTag: { alignItems: 'center', justifyContent: 'center' },
  serialLabelStage: { width: 46, height: 14, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '90deg' }] },
  serialText: { width: '100%', textAlign: 'center', color: '#493D35', fontSize: 9, lineHeight: 14, includeFontPadding: false },
  stateTag: { alignItems: 'center', justifyContent: 'center' },
  stateLabel: { width: 22, maxHeight: 50, alignItems: 'center', justifyContent: 'center' },
  stateCharacter: { color: '#493D35', fontSize: 9, lineHeight: 11, fontWeight: '600' },
  stateCharacterCompact: { fontSize: 8, lineHeight: 9 },
});
