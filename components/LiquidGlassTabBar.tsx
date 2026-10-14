import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const INK = '#756252';
const BLUE = '#6E98B5';
const PAPER = '#F5E9D5';
const SAGE = '#92A985';

export default function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const barWidth = Math.max(screenWidth - 24, 280);
  const slotWidth = barWidth / routes.length;
  const lensWidth = Math.max(slotWidth - 8, 48);
  const lensX = useRef(new Animated.Value(state.index * slotWidth + 4)).current;
  const lensScaleX = useRef(new Animated.Value(1)).current;
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const placeLens = useCallback((index: number, immediate = false) => {
    const nextX = Math.max(4, Math.min(index * slotWidth + 4, barWidth - lensWidth - 4));
    if (immediate) {
      lensX.setValue(nextX);
      return;
    }
    Animated.spring(lensX, {
      toValue: nextX,
      stiffness: 310,
      damping: 25,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [barWidth, lensWidth, lensX, slotWidth]);

  useEffect(() => {
    placeLens(state.index);
  }, [placeLens, state.index]);

  const indexAtPageX = useCallback((pageX: number) => {
    const localX = pageX - 12;
    return Math.max(0, Math.min(routes.length - 1, Math.floor(localX / slotWidth)));
  }, [routes.length, slotWidth]);

  const setFingerPosition = useCallback((pageX: number) => {
    const localX = Math.max(0, Math.min(barWidth, pageX - 12));
    const nextX = Math.max(4, Math.min(localX - lensWidth / 2, barWidth - lensWidth - 4));
    lensX.setValue(nextX);
  }, [barWidth, lensWidth, lensX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (_, gesture) => {
          setPressedIndex(indexAtPageX(gesture.x0));
          setFingerPosition(gesture.x0);
          Animated.spring(lensScaleX, {
            toValue: 1.14,
            stiffness: 380,
            damping: 20,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          setFingerPosition(gesture.moveX);
          setPressedIndex(indexAtPageX(gesture.moveX));
        },
        onPanResponderRelease: (_, gesture) => {
          const index = indexAtPageX(gesture.moveX || gesture.x0);
          const route = routes[index];
          const descriptor = descriptors[route.key];
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (state.index !== index && !event.defaultPrevented && descriptor) {
            navigation.navigate(route.name, route.params);
          }
          setPressedIndex(null);
          Animated.spring(lensScaleX, {
            toValue: 1,
            stiffness: 300,
            damping: 24,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          setPressedIndex(null);
          placeLens(state.index);
          Animated.spring(lensScaleX, { toValue: 1, useNativeDriver: true }).start();
        },
      }),
    [descriptors, indexAtPageX, lensScaleX, navigation, placeLens, routes, setFingerPosition, state.index],
  );

  const pressTab = (index: number) => {
    const route = routes[index];
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.positioner, { bottom: Math.max(insets.bottom, 8) + 4 }]}
    >
      <View
        style={[styles.bar, { width: barWidth }]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={Platform.OS === 'web' ? 42 : 72} tint="light" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassWash} />

        <View style={styles.items}>
          {routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key].options;
            const label = options.title ?? route.name;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? String(label)}
                testID={options.tabBarButtonTestID}
                onPress={() => pressTab(index)}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                onPressIn={() => {
                  setPressedIndex(index);
                  placeLens(index);
                  Animated.spring(lensScaleX, {
                    toValue: 1.08,
                    stiffness: 360,
                    damping: 22,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  setPressedIndex(null);
                  Animated.spring(lensScaleX, {
                    toValue: 1,
                    stiffness: 300,
                    damping: 24,
                    useNativeDriver: true,
                  }).start();
                }}
                style={[styles.item, { width: slotWidth }]}
              >
                <Animated.View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressedIndex === index || (focused && pressedIndex === null) ? 1.1 : 1 }],
                  }}
                >
                  <IslandTabIcon name={route.name} color={focused ? BLUE : INK} />
                  <Text style={[styles.label, { color: focused ? '#557D9A' : '#76695F' }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lens,
            {
              width: lensWidth,
              transform: [{ translateX: lensX }, { scaleX: lensScaleX }],
            },
          ]}
        >
          <BlurView intensity={Platform.OS === 'web' ? 22 : 36} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.lensFill} />
          <View style={styles.lensTopSheen} />
          <View style={styles.lensBottomRim} />
          <View style={styles.lensContent}>
            <IslandTabIcon name={routes[pressedIndex ?? state.index]?.name ?? 'index'} color={BLUE} />
            <Text style={[styles.label, styles.lensLabel]} numberOfLines={1}>
              {descriptors[routes[pressedIndex ?? state.index]?.key]?.options.title ?? '首页'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function IslandTabIcon({ name, color }: { name: string; color: string }) {
  switch (name) {
    case 'index':
      return <IslandHome color={color} />;
    case 'market':
      return <IslandMarket color={color} />;
    case 'community':
      return <IslandFriends color={color} />;
    case 'messages':
      return <IslandMessage color={color} />;
    default:
      return <IslandTreasury color={color} />;
  }
}

function IslandHome({ color }: { color: string }) {
  return (
    <View style={icon.canvas}>
      <View style={[icon.leafLeft, { backgroundColor: SAGE }]} />
      <View style={[icon.leafRight, { backgroundColor: '#A5B58D' }]} />
      <View style={[icon.homeRoof, { borderBottomColor: color }]} />
      <View style={[icon.homeBody, { borderColor: color }]}>
        <View style={[icon.door, { borderColor: color }]} />
      </View>
      <View style={[icon.homeGround, { backgroundColor: SAGE }]} />
    </View>
  );
}

function IslandMarket({ color }: { color: string }) {
  return (
    <View style={icon.canvas}>
      <View style={[icon.card, { borderColor: color }]}>
        <View style={icon.cardSky} />
        <View style={icon.cardIsland} />
        <View style={icon.cardDot} />
      </View>
      <View style={[icon.bagHandle, { borderColor: color }]} />
      <View style={[icon.bag, { borderColor: color, backgroundColor: '#F0E4D1' }]}>
        <View style={[icon.bagSprout, { backgroundColor: SAGE }]} />
      </View>
    </View>
  );
}

function IslandFriends({ color }: { color: string }) {
  return (
    <View style={icon.canvas}>
      <View style={[icon.friendBack, { backgroundColor: '#E7B38F', borderColor: color }]}>
        <View style={icon.eyeLeft} /><View style={icon.eyeRight} />
      </View>
      <View style={[icon.friendFront, { backgroundColor: '#E8C99D', borderColor: color }]}>
        <View style={icon.eyeLeft} /><View style={icon.eyeRight} />
        <View style={[icon.friendLeaf, { backgroundColor: SAGE }]} />
      </View>
      <View style={[icon.friendGround, { backgroundColor: SAGE }]} />
    </View>
  );
}

function IslandMessage({ color }: { color: string }) {
  return (
    <View style={icon.canvas}>
      <View style={[icon.messageBubble, { borderColor: color, backgroundColor: '#FFF9EF' }]}>
        <View style={icon.messageDot} /><View style={icon.messageDot} /><View style={icon.messageDot} />
      </View>
      <Text style={icon.sparkle}>✦</Text>
      <View style={[icon.messageLeaf, { backgroundColor: SAGE }]} />
    </View>
  );
}

function IslandTreasury({ color }: { color: string }) {
  return (
    <View style={icon.canvas}>
      <View style={[icon.avatarFace, { borderColor: color }]}>
        <View style={[icon.avatarEye, { left: 6 }]} /><View style={[icon.avatarEye, { right: 6 }]} />
        <View style={[icon.avatarSmile, { borderColor: color }]} />
      </View>
      <View style={[icon.avatarHat, { backgroundColor: '#A9B69A', borderColor: color }]} />
      <View style={[icon.avatarLeaf, { backgroundColor: SAGE }]} />
      <View style={[icon.avatarCheek, { left: 3 }]} /><View style={[icon.avatarCheek, { right: 3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  bar: {
    height: 78,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#53463C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
  },
  glassWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,252,247,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    borderRadius: 34,
  },
  lens: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#7EA2BA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  lensFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242,248,251,0.18)',
    borderRadius: 32,
  },
  lensTopSheen: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  lensBottomRim: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 1,
    height: 1,
    backgroundColor: 'rgba(112,151,180,0.3)',
  },
  lensContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingTop: 5 },
  lensLabel: { color: '#557D9A' },
  items: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { height: 76, alignItems: 'center', justifyContent: 'center', paddingTop: 5 },
  label: { marginTop: 2, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.3 },
});

const icon = StyleSheet.create({
  canvas: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  leafLeft: { position: 'absolute', top: 0, left: 10, width: 7, height: 4, borderRadius: 7, transform: [{ rotate: '-35deg' }] },
  leafRight: { position: 'absolute', top: 0, left: 15, width: 7, height: 4, borderRadius: 7, transform: [{ rotate: '32deg' }] },
  homeRoof: { position: 'absolute', top: 7, width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  homeBody: { position: 'absolute', top: 16, width: 20, height: 11, borderWidth: 1.3, borderTopWidth: 0, borderRadius: 3, backgroundColor: '#F7EBD8', alignItems: 'center', justifyContent: 'flex-end' },
  door: { width: 5, height: 7, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#C9A982' },
  homeGround: { position: 'absolute', bottom: 1, width: 24, height: 2, borderRadius: 3 },
  card: { position: 'absolute', top: 1, left: 9, width: 14, height: 18, borderWidth: 1, borderRadius: 2, backgroundColor: '#FFF8EB', transform: [{ rotate: '5deg' }], overflow: 'hidden' },
  cardSky: { position: 'absolute', top: 2, left: 2, right: 2, height: 6, borderRadius: 2, backgroundColor: '#BED4DF' },
  cardIsland: { position: 'absolute', bottom: 3, left: 3, width: 8, height: 5, borderRadius: 5, backgroundColor: SAGE },
  cardDot: { position: 'absolute', top: 5, right: 4, width: 2, height: 2, borderRadius: 2, backgroundColor: '#E4BD79' },
  bagHandle: { position: 'absolute', top: 10, left: 5, width: 20, height: 14, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  bag: { position: 'absolute', bottom: 1, width: 23, height: 15, borderWidth: 1.3, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  bagSprout: { width: 5, height: 3, borderRadius: 4, transform: [{ rotate: '-22deg' }] },
  friendBack: { position: 'absolute', left: 3, top: 8, width: 16, height: 16, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  friendFront: { position: 'absolute', right: 2, top: 10, width: 17, height: 15, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  eyeLeft: { position: 'absolute', top: 5, left: 4, width: 1.7, height: 2.5, borderRadius: 2, backgroundColor: INK },
  eyeRight: { position: 'absolute', top: 5, right: 4, width: 1.7, height: 2.5, borderRadius: 2, backgroundColor: INK },
  friendLeaf: { position: 'absolute', top: -3, left: 7, width: 6, height: 3, borderRadius: 5, transform: [{ rotate: '-25deg' }] },
  friendGround: { position: 'absolute', bottom: 1, width: 25, height: 2, borderRadius: 3 },
  messageBubble: { position: 'absolute', top: 4, width: 23, height: 19, borderWidth: 1.2, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  messageDot: { width: 2, height: 2, borderRadius: 2, backgroundColor: INK },
  sparkle: { position: 'absolute', right: 0, top: -3, fontSize: 10, color: '#D3A968', fontWeight: '800' },
  messageLeaf: { position: 'absolute', bottom: 2, left: 3, width: 5, height: 3, borderRadius: 5, transform: [{ rotate: '-25deg' }] },
  avatarFace: { position: 'absolute', top: 7, width: 23, height: 20, borderWidth: 1.2, borderRadius: 13, backgroundColor: PAPER },
  avatarEye: { position: 'absolute', top: 8, width: 2, height: 2.5, borderRadius: 2, backgroundColor: INK },
  avatarSmile: { position: 'absolute', top: 12, left: 9, width: 5, height: 3, borderBottomWidth: 1, borderRadius: 4 },
  avatarHat: { position: 'absolute', top: 5, width: 21, height: 6, borderWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12, transform: [{ rotate: '-4deg' }] },
  avatarLeaf: { position: 'absolute', top: 2, right: 5, width: 5, height: 3, borderRadius: 4, transform: [{ rotate: '-35deg' }] },
  avatarCheek: { position: 'absolute', top: 20, width: 3, height: 2, borderRadius: 3, backgroundColor: '#D99A83' },
});
