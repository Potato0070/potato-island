import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const FRAME = require('../assets/owned-collection/f-card-v1/runtime/album-card-frame-v3.webp');
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
  /** Use the layered scrapbook frame only when the artwork is large enough to carry it. */
  framed?: boolean;
};

export function FolioArtwork({ uri, style, accessibilityLabel = '藏品封面', framed = false }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const artwork = uri && !failed ? (
    <Image accessibilityLabel={accessibilityLabel} source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
  ) : (
    <View style={styles.fallback}>
      <Ionicons name="image-outline" size={24} color="#537895" />
      <Text style={styles.fallbackText}>藏品图暂缺</Text>
    </View>
  );

  return (
    <View style={[styles.artwork, style]}>
      {framed ? <>
        <Image source={FRAME} resizeMode="contain" style={StyleSheet.absoluteFill} accessible={false} />
        <View style={styles.aperture}>{artwork}</View>
      </> : artwork}
    </View>
  );
}

type SerialTagProps = { value: string; style?: StyleProp<ViewStyle>; fontFamily?: string };

export function FolioSerialTag({ value, style, fontFamily }: SerialTagProps) {
  return (
    <View accessible accessibilityLabel={`藏品编号 ${value}`} style={[styles.serialTag, style, SERIAL_TAG_SIZE]}>
      <Image source={SERIAL_TAG} resizeMode="contain" style={StyleSheet.absoluteFill} accessible={false} />
      <Text numberOfLines={1} style={[styles.serialText, fontFamily ? { fontFamily } : null]}>{value}</Text>
    </View>
  );
}

type StateTagProps = { state: 'idle' | 'listed' | 'other'; label: string; style?: StyleProp<ViewStyle>; fontFamily?: string };

export function FolioStateTag({ state, label, style, fontFamily }: StateTagProps) {
  return (
    <View accessible accessibilityLabel={`藏品状态 ${label}`} style={[styles.stateTag, style, STATE_TAG_SIZE]}>
      <Image source={STATE_TAGS[state]} resizeMode="contain" style={StyleSheet.absoluteFill} accessible={false} />
      <View style={styles.stateLabel}>
        {Array.from(label).map((character, index) => <Text key={`${character}-${index}`} style={[styles.stateCharacter, fontFamily ? { fontFamily } : null]}>{character}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { position: 'relative', width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: '#F5F0E7' },
  aperture: { position: 'absolute', left: '15.5%', top: '16.7%', width: '70.2%', height: '66.8%', overflow: 'hidden', borderRadius: 8, backgroundColor: '#F5F0E7' },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden', backgroundColor: '#F5F0E7' },
  fallbackText: { color: '#8D8175', fontSize: 9, lineHeight: 12 },
  serialTag: { alignItems: 'center', justifyContent: 'center' },
  serialText: { position: 'absolute', width: 62, height: 14, left: -15, top: 26, textAlign: 'center', color: '#493D35', fontSize: 8, lineHeight: 12, letterSpacing: 0.2, transform: [{ rotate: '90deg' }] },
  stateTag: { alignItems: 'center', justifyContent: 'center' },
  stateLabel: { alignItems: 'center', justifyContent: 'center' },
  stateCharacter: { color: '#493D35', fontSize: 9, lineHeight: 11, fontWeight: '600' },
});
