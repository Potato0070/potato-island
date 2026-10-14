import { BlurView } from 'expo-blur'; // 🌟 引入官方毛玻璃
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8FAFC8',
        tabBarInactiveTintColor: '#95877F',
        tabBarBackground: () => (
          <BlurView
            tint="light"
            intensity={72}
            style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          borderWidth: 1,
          borderColor: 'rgba(234, 230, 223, 0.9)',
          borderRadius: 28,
          borderTopWidth: 1,
          borderTopColor: 'rgba(234, 230, 223, 0.9)',
          height: Platform.OS === 'ios' ? 82 : 70,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          shadowColor: '#51443C',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.09,
          shadowRadius: 14,
          elevation: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginBottom: 0, 
        },
        tabBarIconStyle: {
          marginBottom: -2,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: '集市',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚖️</Text>,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '旨意',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📜</Text>,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '消息',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '金库',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💰</Text>,
        }}
      />
    </Tabs>
  );
}
