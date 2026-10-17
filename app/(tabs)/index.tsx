import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, ImageBackground, ImageSourcePropType, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

// 💰 千分位金钱格式化工具
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// 🌟 终极防御型图片组件（防裂图神药）
const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFDF9' }]}>
      {loading && !hasError && <ActivityIndicator color="#8FAFC8" style={{ position: 'absolute' }} />}
      {!hasError ? (
        <Image
          source={{ uri: uri || 'invalid_url' }}
          style={[style, { position: 'absolute', width: '100%', height: '100%' }]}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setHasError(true); setLoading(false); }}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
           <Text style={{ fontSize: 32 }}>🥔</Text>
        </View>
      )}
    </View>
  );
};

// 🌟 宫格缩放动效组件
const AnimatedGridItem = ({ item, onPress }: { item: { name: string; icon: ImageSourcePropType; route: string }, onPress: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}>
      <Animated.View style={[styles.gridItem, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconWrapper}>
           <Image source={item.icon} style={styles.iconArt} resizeMode="cover" />
        </View>
        <Text style={styles.gridText}>{item.name}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const MENU_ITEMS = [
  { name: '基因合成', icon: require('../../assets/homepage/icons/gene.png'), route: '/synthesis-list' },
  { name: '领主权益', icon: require('../../assets/homepage/icons/lord.png'), route: '/vip-privilege' },
  { name: '每日朝圣', icon: require('../../assets/homepage/icons/pilgrimage.png'), route: '/daily-sign' },
  { name: '命运抽签', icon: require('../../assets/homepage/icons/lottery.png'), route: '/lottery' },
  { name: '创世发新', icon: require('../../assets/homepage/icons/genesis.png'), route: '/genesis-exchange' },
  { name: '黑洞废墟', icon: require('../../assets/homepage/icons/black-hole.png'), route: '/blackhole' },
  { name: '捐赠兑换', icon: require('../../assets/homepage/icons/exchange.png'), route: '/exchange' },
  { name: '资产转移', icon: require('../../assets/homepage/icons/transfer.png'), route: '/transfer' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [hotCollections, setHotCollections] = useState<any[]>([]);
  const [latestAnnounce, setLatestAnnounce] = useState<any>(null);
  
  const [launchEvent, setLaunchEvent] = useState<any>(null);
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isUrgent, setIsUrgent] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const fetchHomeData = async () => {
    try {
      // Independent public queries should share one network wait on slow links.
      const [hotResult, announcementResult, launchResult] = await Promise.all([
        supabase.from('collections').select('*').eq('is_tradeable', true).order('floor_price_cache', { ascending: false }).limit(4),
        supabase.from('announcements').select('title, is_featured').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('launch_events').select('*, collection:collection_id(name, image_url)').eq('is_active', true).order('start_time', { ascending: true }).limit(1).single(),
      ]);
      const { data: hotData } = hotResult;
      if (hotData) setHotCollections(hotData);

      const { data: annData } = announcementResult;
      if (annData) setLatestAnnounce(annData);

      const { data: launchData } = launchResult;
      if (launchData) setLaunchEvent(launchData); else setLaunchEvent(null);

    } catch (e) { console.error(e); } finally { setRefreshing(false); setInitLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchHomeData(); }, []));

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

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchHomeData();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
         <View style={styles.logoBox}>
            <Image source={require('../../assets/homepage/logo-b.png')} style={styles.logoMark} resizeMode="contain" />
            <Text style={styles.logoText}>土豆岛</Text>
         </View>
         <TouchableOpacity style={styles.searchBox} activeOpacity={0.8} onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/market'); }}>
            <Text style={{fontSize: 14, marginRight: 6}}>🔍</Text>
            <Text style={{color: '#95877F', fontSize: 13, fontWeight: '600'}}>搜索基因藏品或编号...</Text>
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8FAFC8" />}>
        
        {/* 🌟 跑马灯播报栏 (提到了顶部导航下方) */}
        <TouchableOpacity style={styles.marqueeBox} activeOpacity={0.8} onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/community'); }}>
          <View style={styles.marqueeTag}><Text style={styles.marqueeTagText}>🔥 播报</Text></View>
          <Text style={styles.marqueeText} numberOfLines={1}>
            {latestAnnounce?.is_featured ? '【精华】' : ''}{latestAnnounce?.title || '土豆宇宙正在孕育新生命...'}
          </Text>
          <Text style={styles.marqueeArrow}>〉</Text>
        </TouchableOpacity>

        {/* 🌟 8 宫格重构：完美的两行四列间距 + 点击动效 */}
        <View style={styles.gridContainer}>
          {MENU_ITEMS.map((item, index) => (
            <AnimatedGridItem key={index} item={item} onPress={() => item.route ? router.push(item.route as any) : null} />
          ))}
        </View>

        {/* 创世发新 */}
        {initLoading ? (
           <View style={[styles.sectionContainer, {opacity: 0.5}]}><View style={{height: 160, backgroundColor: '#F2EEE8', borderRadius: 16}} /></View>
        ) : launchEvent && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>精品推荐</Text>
            <TouchableOpacity style={styles.launchCard} activeOpacity={0.9} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if(launchEvent.id) router.push({ pathname: '/launch-detail', params: { id: launchEvent.id } }) }}>
              <ImageBackground source={{ uri: launchEvent.collection?.image_url }} style={styles.launchBg} blurRadius={15}>
                <View style={styles.launchOverlay}>
                  <FallbackImage uri={launchEvent.collection?.image_url} style={styles.launchMainImg} />
                  <View style={styles.launchInfo}>
                    <Text style={styles.launchTitle} numberOfLines={1}>{launchEvent.collection?.name}</Text>
                    <View style={styles.launchPriceRow}>
                       <Text style={styles.launchPriceLabel}>首发价</Text>
                       {/* 🌟 千分位金钱 */}
                       <Text style={styles.launchPrice}>¥{formatMoney(launchEvent.price)}</Text>
                    </View>
                    <Text style={styles.launchProgressText}>限量发售 {formatMoney(launchEvent.total_supply).replace('.00', '')} 份</Text>
                  </View>
                </View>
                <View style={[styles.timerBar, isUrgent ? styles.timerBarUrgent : styles.timerBarNormal]}>
                  <Text style={[styles.timerText, isUrgent && {color: '#FFF'}]}>{timeLeftStr}</Text>
          <Text style={[styles.timerBtn, isUrgent ? {color: '#51443C', backgroundColor: '#FFF'} : {backgroundColor: '#8FAFC8', color: '#FFF'}]}>立即前往</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>热门藏品</Text>
          <View style={styles.hotList}>
            {initLoading ? (
               // 🌟 骨架屏占位
               Array.from({length: 4}).map((_, i) => (
                 <View key={i} style={[styles.hotCard, { opacity: 0.5 }]}>
                    <View style={[styles.hotImageContainer, {backgroundColor: '#F2EEE8'}]} />
                    <View style={{padding: 12}}>
                       <View style={{height: 14, backgroundColor: '#F2EEE8', borderRadius: 4, marginBottom: 8, width: '80%'}} />
                       <View style={{height: 10, backgroundColor: '#F2EEE8', borderRadius: 4, width: '50%'}} />
                    </View>
                 </View>
               ))
            ) : hotCollections.map(col => {
              const isDelisted = col.on_sale_count === 0 || col.on_sale_count == null;
              const displayPrice = isDelisted ? (col.max_consign_price || 0) : (col.floor_price_cache || 0);

              return (
                <TouchableOpacity key={col.id} style={styles.hotCard} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/collection', params: { id: col.id } }); }}>
                  <View style={styles.hotImageContainer}>
                    <FallbackImage uri={col.image_url} style={styles.hotImage} />
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
                      <Text style={styles.supplyText}>在售 {formatMoney(col.on_sale_count || 0).replace('.00', '')}</Text>
                      <Text style={styles.supplyText}>|</Text>
                      <Text style={styles.supplyText}>流通 {formatMoney(col.circulating_supply).replace('.00', '')}</Text>
                    </View>
                    <View style={styles.hotBottom}>
                      <View>
                         <Text style={{fontSize: 10, color: '#8D6E63', marginBottom: 2, fontWeight: '700'}}>{isDelisted ? '求购参考价' : '全网地板价'}</Text>
                         {/* 🌟 千分位金钱 */}
                         <Text style={[styles.hotPrice, isDelisted && {color: '#95877F'}]}>¥{formatMoney(displayPrice)}</Text>
                      </View>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FFFFFF' },
  logoBox: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  logoMark: { width: 46, height: 36, marginRight: 4 },
  logoText: { fontSize: 20, fontWeight: '900', color: '#51443C' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#EAE6DF' },
  
  marqueeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, shadowColor: '#51443C', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, elevation: 1, borderWidth: 1, borderColor: '#EAE6DF' },
  marqueeTag: { backgroundColor: '#E85A48', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  marqueeTagText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  marqueeText: { flex: 1, fontSize: 13, color: '#51443C', fontWeight: '800' },
  marqueeArrow: { fontSize: 14, color: '#95877F', marginLeft: 8, fontWeight: '900' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 20, paddingBottom: 10 },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  iconWrapper: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 6, overflow: 'hidden' },
  iconArt: { width: 70, height: 70 },
  gridText: { fontSize: 12, color: '#51443C', fontWeight: '800' },

  sectionContainer: { marginTop: 10, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#51443C', marginBottom: 16 },

  launchCard: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#51443C', shadowOffset: {width:0, height:4}, shadowOpacity: 0.09, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: '#EAE6DF' },
  launchBg: { width: '100%', minHeight: 160, backgroundColor: '#FFFDF9' },
  launchOverlay: { flexDirection: 'row', padding: 20, backgroundColor: 'rgba(81, 68, 60, 0.72)', flex: 1 },
  launchMainImg: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#D4A64A' },
  launchInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  launchTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  launchPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  launchPriceLabel: { color: '#F1EDE7', fontSize: 12, marginRight: 6 },
  launchPrice: { color: '#D4A64A', fontSize: 20, fontWeight: '900' },
  launchProgressText: { color: '#F1EDE7', fontSize: 11, fontWeight: '600' },
  timerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  timerBarNormal: { backgroundColor: 'rgba(255, 255, 255, 0.96)' },
  timerBarUrgent: { backgroundColor: '#FF3B30' },
  timerText: { fontSize: 14, fontWeight: '900', color: '#51443C', fontFamily: 'monospace' },
  timerBtn: { fontSize: 12, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden' },

  hotList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  hotCard: { width: (width - 40) / 2, backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', marginBottom: 12, shadowColor: '#51443C', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1, borderWidth: 1, borderColor: '#EAE6DF' },
  hotImageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FFFDF9' },
  hotImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(44, 30, 22, 0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#D4A64A', backgroundColor: 'rgba(44, 30, 22, 0.8)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#D4A64A', fontSize: 12, fontWeight: '900' },
  hotInfo: { padding: 12 },
  hotName: { fontSize: 14, fontWeight: '900', color: '#51443C', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#95877F', marginRight: 4, fontWeight: '700' },
  hotBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F2EEE8', paddingTop: 8 },
  hotPrice: { fontSize: 16, fontWeight: '900', color: '#D4A64A' },
  likeIcon: { fontSize: 12, color: '#D98B70' }
});
