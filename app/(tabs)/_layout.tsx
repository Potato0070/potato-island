import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D49A36', // 土豆岛专属金
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          // 🌟 核心调整：根据平台动态调整高度
          height: Platform.OS === 'ios' ? 88 : 70, 
          // 🌟 增加底部安全边距，确保文字不落地
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 8,
          // 🌟 阴影加强，让底部栏更有悬浮感，防止底部穿透
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '900', // 字体加粗一点更清晰
          // 🌟 移除可能会导致裁切的 marginTop，改用绝对居中感
          marginBottom: 0, 
        },
        // 🌟 强制让图标和文字在垂直方向上有更好的分布
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