import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

const MENU_ITEMS = [
  { name: '基因合成', icon: '🧬', route: '/synthesis-list' }, 
  { name: '皇家金库', icon: '💰', route: '/(tabs)/profile' },
  { name: '交易集市', icon: '⚖️', route: '/(tabs)/market' },
  { name: '王国旨意', icon: '📜', route: '/(tabs)/community' },
  { name: '挖宝盲盒', icon: '🎰', route: '' }, 
  { name: '岛民签到', icon: '📅', route: '' }, 
  { name: '领主权益', icon: '👑', route: '' }, 
  { name: '新手指南', icon: '🧭', route: '' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [hotCollections, setHotCollections] = useState<any[]>([]);
  const [launchEvent, setLaunchEvent] = useState<any>(null);
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isUrgent, setIsUrgent] = useState(false); 
  const [latestAnnounce, setLatestAnnounce] = useState<any>(null);

  const fetchHomeData = async () => {
    try {
      const { data: hotData } = await supabase.from('collections').select('*').eq('is_tradeable', true).order('total_minted', { ascending: false }).limit(4);
      if (hotData) setHotCollections(hotData);

      const { data: annData } = await supabase.from('announcements').select('title, is_featured').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(1).single();
      if (annData) setLatestAnnounce(annData);

      const { data: launchData } = await supabase.from('launch_events').select('*, collection:collection_id(name, image_url)').eq('is_active', true).order('start_time', { ascending: true }).limit(1).single();
      if (launchData) setLaunchEvent(launchData);
      else setLaunchEvent(null);

    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchHomeData(); }, []));

  useEffect(() => {
    if (!launchEvent) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(launchEvent.start_time).getTime();
      const diff = start - now;

      if (diff <= 0) {
        if (launchEvent.remaining_supply <= 0) {
           setTimeLeftStr('已全部售罄'); setIsUrgent(false);
        } else {
           setTimeLeftStr('抢购已开启！⚡'); setIsUrgent(true);
        }
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        if (d === 0 && h === 0 && m < 10) {
            setIsUrgent(true);
            setTimeLeftStr(`🚨 倒计时 00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
            setIsUrgent(false);
            setTimeLeftStr(`预热中: ${d}天 ${h}时 ${m}分`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [launchEvent]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTabs}>
          <View style={styles.activeTabContainer}>
            <Text style={styles.tabActiveText}>首 页</Text>
            <View style={styles.activeLine} />
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/community')}><Text style={styles.tabInactiveText}>社区公告</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/synthesis-list')}><Text style={styles.tabInactiveText}>进化大厅</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchIconBox}><Text style={styles.searchIcon}>🔍</Text></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchHomeData();}} tintColor="#D49A36" />}>
        
        <TouchableOpacity style={styles.marqueeBox} activeOpacity={0.8} onPress={() => router.push('/(tabs)/community')}>
          <View style={[styles.marqueeTag, latestAnnounce?.is_featured && {backgroundColor: '#FF3B30'}]}>
             <Text style={[styles.marqueeTagText, latestAnnounce?.is_featured && {color: '#FFF'}]}>{latestAnnounce?.is_featured ? '🔥 精华' : '最新'}</Text>
          </View>
          <Text style={styles.marqueeText} numberOfLines={1}>{latestAnnounce?.title || '土豆宇宙正在孕育新生命...'}</Text>
          <Text style={styles.marqueeArrow}>〉</Text>
        </TouchableOpacity>

        <View style={styles.gridContainer}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity key={index} style={styles.gridItem} activeOpacity={0.7} onPress={() => item.route ? router.push(item.route as any) : null}>
              <View style={styles.iconWrapper}><Text style={styles.iconEmoji}>{item.icon}</Text></View>
              <Text style={styles.gridText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionContainer}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
             <Text style={styles.sectionTitle}>🚀 创世首发 (Launchpad)</Text>
             <Text style={{color: '#999', fontSize: 12, fontWeight: '600'}}>进入大厅 〉</Text>
          </View>

          {launchEvent ? (
            <TouchableOpacity style={styles.launchCard} activeOpacity={0.9} onPress={() => router.push({ pathname: '/launch-detail', params: { id: launchEvent.id } })}>
              <ImageBackground source={{ uri: launchEvent.collection?.image_url }} style={styles.launchBg} blurRadius={10}>
                <View style={styles.launchOverlay}>
                  <Image source={{ uri: launchEvent.collection?.image_url }} style={styles.launchMainImg} />
                  <View style={styles.launchInfo}>
                    <Text style={styles.launchTitle} numberOfLines={1}>{launchEvent.collection?.name}</Text>
                    <View style={styles.launchPriceRow}>
                       <Text style={styles.launchPriceLabel}>首发价</Text>
                       <Text style={styles.launchPrice}>¥{launchEvent.price.toFixed(2)}</Text>
                    </View>
                    <View style={styles.launchProgressBox}>
                       <Text style={styles.launchProgressText}>限量 {launchEvent.total_supply} 份</Text>
                    </View>
                  </View>
                </View>
                
                <View style={[styles.timerBar, isUrgent ? styles.timerBarUrgent : styles.timerBarNormal]}>
                  <Text style={[styles.timerText, isUrgent && {color: '#FFF'}]}>{timeLeftStr}</Text>
                  <Text style={[styles.timerBtn, isUrgent && {color: '#000', backgroundColor: '#FFF'}]}>
                    {launchEvent.remaining_supply <= 0 ? '已售罄' : '查看抢购'}
                  </Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyLaunch}>
              <Text style={{fontSize: 30, marginBottom: 10}}>🥔</Text>
              <Text style={{color: '#888', fontWeight: '600'}}>当前暂无发新计划，请留意跑马灯公告</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🔥 二级市场热门</Text>
          <View style={styles.hotList}>
            {hotCollections.map(col => (
              <TouchableOpacity key={col.id} style={styles.hotCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/detail', params: { id: col.id } })}>
                <Image source={{ uri: col.image_url || `https://via.placeholder.com/150` }} style={styles.hotImage} />
                <View style={styles.hotInfo}>
                  <Text style={styles.hotName} numberOfLines={1}>{col.name}</Text>
                  <View style={styles.hotBottom}>
                    <Text style={styles.hotPrice}>¥{col.floor_price_cache?.toFixed(0) || '0'}</Text>
                    <Text style={styles.hotSupply}>流通: {col.circulating_supply}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{height: 100}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, backgroundColor: '#FFF' },
  headerTabs: { flexDirection: 'row', alignItems: 'center' },
  activeTabContainer: { alignItems: 'center', marginRight: 24 },
  tabActiveText: { fontSize: 20, fontWeight: '900', color: '#4A2E1B' },
  activeLine: { width: 16, height: 4, backgroundColor: '#D49A36', borderRadius: 2, marginTop: 4 },
  tabInactiveText: { fontSize: 16, fontWeight: '600', color: '#999', marginRight: 24 },
  searchIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  searchIcon: { fontSize: 16 },
  marqueeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, elevation: 1 },
  marqueeTag: { backgroundColor: '#EFEFEF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  marqueeTagText: { color: '#333', fontSize: 10, fontWeight: '900' },
  marqueeText: { flex: 1, fontSize: 13, color: '#4A2E1B', fontWeight: '600' },
  marqueeArrow: { fontSize: 14, color: '#CCC', marginLeft: 8 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginTop: 20, marginBottom: 10 },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  iconWrapper: { width: 50, height: 50, borderRadius: 20, backgroundColor: '#FDF9F1', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#D49A36', shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  iconEmoji: { fontSize: 24 },
  gridText: { fontSize: 12, color: '#4A2E1B', fontWeight: '600' },
  sectionContainer: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  launchCard: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#D49A36', shadowOffset: {width:0, height:6}, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  launchBg: { width: '100%', minHeight: 180, backgroundColor: '#111' },
  launchOverlay: { flexDirection: 'row', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)', flex: 1 },
  launchMainImg: { width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderColor: '#D49A36' },
  launchInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  launchTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 8, textShadowColor: '#000', textShadowOffset: {width:1,height:1}, textShadowRadius: 2 },
  launchPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  launchPriceLabel: { color: '#CCC', fontSize: 12, marginRight: 6 },
  launchPrice: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  launchProgressBox: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  launchProgressText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  timerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  timerBarNormal: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  timerBarUrgent: { backgroundColor: '#FF3B30' },
  timerText: { fontSize: 14, fontWeight: '900', color: '#111', fontFamily: 'monospace' },
  timerBtn: { fontSize: 12, fontWeight: '800', color: '#FFF', backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden' },
  emptyLaunch: { width: '100%', height: 120, backgroundColor: '#EFEFEF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed' },
  hotList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  hotCard: { width: (width - 48) / 2, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  hotImage: { width: '100%', aspectRatio: 1, backgroundColor: '#FDF9F1' },
  hotInfo: { padding: 12 },
  hotName: { fontSize: 14, fontWeight: '800', color: '#4A2E1B', marginBottom: 8 },
  hotBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hotPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  hotSupply: { fontSize: 11, color: '#999', fontWeight: '500' },
});