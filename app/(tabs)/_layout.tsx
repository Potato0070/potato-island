import { Tabs } from 'expo-router';
import { Text } from 'react-native';

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
          height: 65,             // 🌟 增加基础高度
          paddingBottom: 10,      // 🌟 增加底部内边距，把文字顶上来
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
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