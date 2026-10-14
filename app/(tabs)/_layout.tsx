import { Tabs } from 'expo-router';
import LiquidGlassTabBar from '../../components/LiquidGlassTabBar';

const tabTitles: Record<string, string> = {
  index: '首页',
  market: '集市',
  community: '旨意',
  messages: '消息',
  profile: '金库',
};

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {Object.entries(tabTitles).map(([name, title]) => (
        <Tabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </Tabs>
  );
}
