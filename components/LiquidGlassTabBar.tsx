import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const HORIZONTAL_INSET = 12;

const TAB_ICON_SOURCES: Record<string, number> = {
  index: require('../assets/navigation/set-c/home-island.png'),
  market: require('../assets/navigation/set-c/market-stall.png'),
  community: require('../assets/navigation/set-c/decree-map.png'),
  messages: require('../assets/navigation/set-c/message-courier.png'),
  profile: require('../assets/navigation/set-c/treasury-chest.png'),
};

export default function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const [barWidth, setBarWidth] = useState(0);
  const slotWidth = routes.length > 0 ? barWidth / routes.length : 0;
  const lensWidth = slotWidth > 0 ? Math.max(slotWidth - 8, 48) : 48;
  const lensX = useRef(new Animated.Value(4)).current;
  const lensScaleX = useRef(new Animated.Value(1)).current;
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const placeLens = useCallback((index: number, immediate = false) => {
    if (barWidth <= 0) return;
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
    if (slotWidth <= 0) return 0;
    const localX = pageX - HORIZONTAL_INSET;
    return Math.max(0, Math.min(routes.length - 1, Math.floor(localX / slotWidth)));
  }, [routes.length, slotWidth]);

  const setFingerPosition = useCallback((pageX: number) => {
    if (barWidth <= 0) return;
    const localX = Math.max(0, Math.min(barWidth, pageX - HORIZONTAL_INSET));
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
        onLayout={({ nativeEvent }) => {
          const measuredWidth = nativeEvent.layout.width;
          setBarWidth((currentWidth) => currentWidth === measuredWidth ? currentWidth : measuredWidth);
        }}
        style={styles.bar}
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
                style={[styles.item, { flex: 1 }]}
              >
                <Animated.View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressedIndex === index || (focused && pressedIndex === null) ? 1.1 : 1 }],
                  }}
                >
                  <IslandTabIcon name={route.name} />
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
              opacity: barWidth > 0 ? 1 : 0,
              transform: [{ translateX: lensX }, { scaleX: lensScaleX }],
            },
          ]}
        >
          <BlurView intensity={Platform.OS === 'web' ? 22 : 36} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.lensFill} />
          <View style={styles.lensTopSheen} />
          <View style={styles.lensBottomRim} />
          <View style={styles.lensContent}>
            <IslandTabIcon name={routes[pressedIndex ?? state.index]?.name ?? 'index'} />
            <Text style={[styles.label, styles.lensLabel]} numberOfLines={1}>
              {descriptors[routes[pressedIndex ?? state.index]?.key]?.options.title ?? '首页'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function IslandTabIcon({ name }: { name: string }) {
  return <Image source={TAB_ICON_SOURCES[name] ?? TAB_ICON_SOURCES.index} style={styles.tabIcon} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  positioner: { position: 'absolute', left: HORIZONTAL_INSET, right: HORIZONTAL_INSET, alignItems: 'stretch', zIndex: 100 },
  bar: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
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
  tabIcon: { width: 36, height: 36 },
  label: { marginTop: 0, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.1 },
});
