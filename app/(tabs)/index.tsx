import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

// 🌟 一岛化：重构高频金刚区 (替换掉元宇宙等无用功能)
const MENU_ITEMS = [
  { name: '基因合成', icon: '🧬', route: '/synthesis-list', bgColor: '#F0F6FF' }, 
  { name: '领主权益', icon: '👑', route: '/vip-privilege', bgColor: '#FFF5E6' },
  { name: '每日朝圣', icon: '📅', route: '', bgColor: '#F5F0FF' }, // 预留签到
  { name: '命运抽签', icon: '🎰', route: '', bgColor: '#FFF0F5' }, // 预留盲盒抽签
  { name: '创世发新', icon: '🚀', route: '/(tabs)/market', bgColor: '#E6FAFF' },
  { name: '黑洞废墟', icon: '🕳️', route: '', bgColor: '#F0F0F0' }, // 替代元宇宙：查看全网销毁量
  { name: '特权兑换', icon: '💳', route: '', bgColor: '#E6FFE6' }, // 替代酒世界：用基础卡兑换转赠卡/批量卡
  { name: '资产转赠', icon: '🎁', route: '/transfer', bgColor: '#FFE6E6' }, 
];

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [hotCollections, setHotCollections] = useState<any[]>([]);
  const [latestAnnounce, setLatestAnnounce] = useState<any>(null);
  
  // 创世发新状态
  const [launchEvent, setLaunchEvent] = useState<any>(null);
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isUrgent, setIsUrgent] = useState(false);

  const fetchHomeData = async () => {
    try {
      // 1. 抓取热门现货 (享受底层触发器的 on_sale_count)
      const { data: hotData } = await supabase.from('collections').select('*').eq('is_tradeable', true).order('floor_price_cache', { ascending: false }).limit(4);
      if (hotData) setHotCollections(hotData);

      // 2. 抓取最新跑马灯公告
      const { data: annData } = await supabase.from('announcements').select('title, is_featured').order('created_at', { ascending: false }).limit(1).single();
      if (annData) setLatestAnnounce(annData);

      // 3. 抓取发新大厅
      const { data: launchData } = await supabase.from('launch_events').select('*, collection:collection_id(name, image_url)').eq('is_active', true).order('start_time', { ascending: true }).limit(1).single();
      if (launchData) setLaunchEvent(launchData); else setLaunchEvent(null);

    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchHomeData(); }, []));

  // 倒计时引擎
  useEffect(() => {
    if (!launchEvent) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(launchEvent.start_time).getTime();
      const diff = start - now;

      if (diff <= 0) {
        if (launchEvent.remaining_supply <= 0) { setTimeLeftStr('已全部售罄'); setIsUrgent(false); } 
        else { setTimeLeftStr('抢购已开启！⚡'); setIsUrgent(true); }
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        if (d === 0 && h === 0 && m < 10) { setIsUrgent(true); setTimeLeftStr(`🚨 倒计时 00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`); } 
        else { setIsUrgent(false); setTimeLeftStr(`预热中: ${d}天 ${h}时 ${m}分`); }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [launchEvent]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部搜索与消息 (一岛化风格) */}
      <View style={styles.header}>
         <View style={styles.logoBox}>
            <Text style={styles.logoText}>🥔 土豆岛</Text>
         </View>
         <TouchableOpacity style={styles.searchBox} onPress={() => router.push('/(tabs)/market')}>
            <Text style={{fontSize: 14, marginRight: 6}}>🔍</Text>
            <Text style={{color: '#999', fontSize: 13}}>搜索基因藏品或编号...</Text>
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchHomeData();}} tintColor="#D49A36" />}>
        
        {/* 🌟 一岛化：顶部高频金刚区 (两排8个) */}
        <View style={styles.gridContainer}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity key={index} style={styles.gridItem} activeOpacity={0.7} onPress={() => item.route ? router.push(item.route as any) : null}>
              <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
                 <Text style={styles.iconEmoji}>{item.icon}</Text>
              </View>
              <Text style={styles.gridText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🌟 一岛化：王国大喇叭 (悬浮跑马灯) */}
        <TouchableOpacity style={styles.marqueeBox} activeOpacity={0.8} onPress={() => router.push('/(tabs)/community')}>
          <View style={styles.marqueeTag}><Text style={styles.marqueeTagText}>📢 播报</Text></View>
          <Text style={styles.marqueeText} numberOfLines={1}>
            {latestAnnounce?.is_featured ? '🔥 ' : ''}{latestAnnounce?.title || '土豆宇宙正在孕育新生命...'}
          </Text>
          <Text style={styles.marqueeArrow}>〉</Text>
        </TouchableOpacity>

        {/* 精品推荐 / 创世发新 */}
        {launchEvent && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>精品推荐</Text>
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
                    <Text style={styles.launchProgressText}>限量 {launchEvent.total_supply} 份</Text>
                  </View>
                </View>
                <View style={[styles.timerBar, isUrgent ? styles.timerBarUrgent : styles.timerBarNormal]}>
                  <Text style={[styles.timerText, isUrgent && {color: '#FFF'}]}>{timeLeftStr}</Text>
                  <Text style={[styles.timerBtn, isUrgent && {color: '#000', backgroundColor: '#FFF'}]}>立即前往</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </View>
        )}

        {/* 🌟 一岛化：热门藏品 (增加在售/流通量显示，接入退市印章) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>热门藏品</Text>
          <View style={styles.hotList}>
            {hotCollections.map(col => {
              const isDelisted = col.on_sale_count === 0 || col.on_sale_count == null;
              return (
                <TouchableOpacity key={col.id} style={styles.hotCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/detail', params: { id: col.id } })}>
                  <View style={styles.hotImageContainer}>
                    <Image source={{ uri: col.image_url || `https://via.placeholder.com/150` }} style={styles.hotImage} />
                    {isDelisted && (
                      <View style={styles.delistedOverlay}>
                         <View style={styles.delistedStamp}>
                            <Text style={styles.delistedText}>已退市</Text>
                         </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.hotInfo}>
                    <Text style={styles.hotName} numberOfLines={1}>{col.name}</Text>
                    <View style={styles.statsRow}>
                      <Text style={styles.supplyText}>在售 {col.on_sale_count || 0}</Text>
                      <Text style={styles.supplyText}>|</Text>
                      <Text style={styles.supplyText}>流通 {col.circulating_supply}</Text>
                    </View>
                    <View style={styles.hotBottom}>
                      <Text style={[styles.hotPrice, isDelisted && {color: '#888'}]}>¥{col.floor_price_cache?.toFixed(0) || '0'}</Text>
                      <Text style={styles.likeIcon}>🤍</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
        <View style={{height: 100}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFF' },
  logoBox: { marginRight: 16 },
  logoText: { fontSize: 20, fontWeight: '900', color: '#111' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 20, paddingBottom: 10, backgroundColor: '#FFF' },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  iconWrapper: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  iconEmoji: { fontSize: 24 },
  gridText: { fontSize: 12, color: '#333', fontWeight: '600' },

  marqueeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, elevation: 1 },
  marqueeTag: { backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  marqueeTagText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  marqueeText: { flex: 1, fontSize: 13, color: '#111', fontWeight: '600' },
  marqueeArrow: { fontSize: 14, color: '#CCC', marginLeft: 8 },

  sectionContainer: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },

  launchCard: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  launchBg: { width: '100%', minHeight: 160, backgroundColor: '#111' },
  launchOverlay: { flexDirection: 'row', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)', flex: 1 },
  launchMainImg: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#D49A36' },
  launchInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  launchTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  launchPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  launchPriceLabel: { color: '#CCC', fontSize: 12, marginRight: 6 },
  launchPrice: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
  launchProgressText: { color: '#CCC', fontSize: 11, fontWeight: '600' },
  timerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  timerBarNormal: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  timerBarUrgent: { backgroundColor: '#FF3B30' },
  timerText: { fontSize: 14, fontWeight: '900', color: '#111', fontFamily: 'monospace' },
  timerBtn: { fontSize: 12, fontWeight: '800', color: '#FFF', backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden' },

  hotList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  hotCard: { width: (width - 40) / 2, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  hotImageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5' },
  hotImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  hotInfo: { padding: 12 },
  hotName: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#888', marginRight: 4 },
  hotBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 8 },
  hotPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  likeIcon: { fontSize: 12, color: '#CCC' }
});