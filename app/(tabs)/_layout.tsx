import { BlurView } from 'expo-blur'; // 🌟 引入官方毛玻璃
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D49A36', // 土豆岛专属金
        tabBarInactiveTintColor: '#A1887F', // 颜色微调，更复古
        // 🌟 核心：开启透明毛玻璃沉浸式体验
        tabBarBackground: () => (
          <BlurView tint="light" intensity={80} style={StyleSheet.absoluteFill} />
        ),
        tabBarStyle: {
          position: 'absolute', // 🌟 绝对定位，彻底解决遮挡！
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.6)', // 配合毛玻璃的半透明底色
          borderTopWidth: 1,
          borderTopColor: 'rgba(234, 224, 213, 0.5)',
          height: Platform.OS === 'ios' ? 88 : 70, 
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 8,
          shadowColor: '#4E342E',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.05,
          shadowRadius: 15,
          elevation: 0, // 安卓端关掉默认黑边阴影，用透明层
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '900', 
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