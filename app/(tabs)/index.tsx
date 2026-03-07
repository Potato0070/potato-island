import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [announcement, setAnnouncement] = useState<any>(null);
  const [launchEvent, setLaunchEvent] = useState<any>(null);
  const [hotCollections, setHotCollections] = useState<any[]>([]);

  const fetchHomeData = async () => {
    try {
      // 1. 获取最新置顶公告
      const { data: annData } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (annData) setAnnouncement(annData);

      // 2. 获取最新抢购发新
      const { data: launchData } = await supabase
        .from('launch_events')
        .select('*, collection:collection_id(*)')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (launchData) setLaunchEvent(launchData);

      // 3. 获取热门藏品
      const { data: colData } = await supabase
        .from('collections')
        .select('*')
        .eq('is_tradeable', true)
        .order('created_at', { ascending: false })
        .limit(4);

      // 🔥 4. 史诗级同步：在首页挂载“实时盘口探测雷达”！
      const { data: listedNfts } = await supabase
        .from('nfts')
        .select('collection_id, price')
        .in('status', ['listed', 'consigning']);

      const marketStats: Record<string, { count: number, minPrice: number }> = {};
      if (listedNfts) {
         listedNfts.forEach(nft => {
            const p = parseFloat(nft.price);
            if (isNaN(p)) return;
            if (!marketStats[nft.collection_id]) {
                marketStats[nft.collection_id] = { count: 0, minPrice: p };
            }
            marketStats[nft.collection_id].count += 1;
            if (p < marketStats[nft.collection_id].minPrice) {
                marketStats[nft.collection_id].minPrice = p;
            }
         });
      }

      // 将实时数据注入热门列表
      const enrichedCols = (colData || []).map(col => {
         const stats = marketStats[col.id];
         const isDelisted = !stats || stats.count === 0;
         const realFloorPrice = isDelisted ? (col.max_consign_price || 0) : stats.minPrice;

         return {
            ...col,
            is_delisted: isDelisted,
            real_floor_price: realFloorPrice
         };
      });

      setHotCollections(enrichedCols);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchHomeData(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchHomeData();
  };

  // 首页八宫格导航
  const homeMenus = [
    { name: '基因合成', icon: '🧬', action: () => router.push('/synthesis-list') },
    { name: '皇家金库', icon: '💰', action: () => router.push('/(tabs)/profile') },
    { name: '交易集市', icon: '⚖️', action: () => router.push('/(tabs)/market') },
    { name: '王国旨意', icon: '📜', action: () => router.push('/(tabs)/community') },
    { name: '挖宝盲盒', icon: '🎰', action: () => alert('敬请期待：盲盒系统建设中') },
    { name: '岛民签到', icon: '📅', action: () => alert('敬请期待：签到系统建设中') },
    { name: '领主权益', icon: '👑', action: () => router.push('/(tabs)/profile') },
    { name: '新手指南', icon: '🧭', action: () => alert('敬请期待：新手指南编写中') },
  ];

  if (loading && !hotCollections.length) {
      return (
          <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#D49A36" />
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部简易 Header */}
      <View style={styles.header}>
         <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
            <Text style={styles.headerLogo}>首 页</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/community')}><Text style={styles.headerSub}>社区公告</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/synthesis-list')}><Text style={styles.headerSub}>进化大厅</Text></TouchableOpacity>
         </View>
         <TouchableOpacity style={styles.searchBtn}><Text style={{fontSize: 18}}>🔍</Text></TouchableOpacity>
      </View>

      <ScrollView 
         showsVerticalScrollIndicator={false}
         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />}
      >
        {/* 精华公告跑马灯 */}
        {announcement && (
           <TouchableOpacity style={styles.announcementBar} onPress={() => router.push('/(tabs)/community')}>
              <View style={styles.hotBadge}><Text style={styles.hotBadgeText}>🔥 精华</Text></View>
              <Text style={styles.announcementText} numberOfLines={1}>
                 {announcement.title}
              </Text>
              <Text style={{color: '#999'}}>〉</Text>
           </TouchableOpacity>
        )}

        {/* 金刚八宫格 */}
        <View style={styles.gridBox}>
           {homeMenus.map((menu, idx) => (
              <TouchableOpacity key={idx} style={styles.gridItem} onPress={menu.action}>
                 <View style={styles.iconCircle}><Text style={{fontSize: 26}}>{menu.icon}</Text></View>
                 <Text style={styles.gridText}>{menu.name}</Text>
              </TouchableOpacity>
           ))}
        </View>

        {/* 🚀 创世首发区 */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>🚀 创世首发 (Launchpad)</Text>
           <TouchableOpacity><Text style={styles.sectionLink}>进入大厅 〉</Text></TouchableOpacity>
        </View>
        
        {launchEvent && launchEvent.collection ? (
           <TouchableOpacity 
              style={styles.launchCard} 
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/launch-detail', params: { id: launchEvent.id } })}
           >
              <Image source={{ uri: launchEvent.collection.image_url }} style={styles.launchImgBg} />
              <View style={styles.launchOverlay}>
                 <Image source={{ uri: launchEvent.collection.image_url }} style={styles.launchThumb} />
                 <View style={styles.launchInfo}>
                    <Text style={styles.launchName} numberOfLines={1}>{launchEvent.collection.name}</Text>
                    <View style={styles.launchPriceRow}>
                       <Text style={{color: '#FFF', fontSize: 12}}>首发价 </Text>
                       <Text style={{color: '#FFD700', fontSize: 22, fontWeight: '900'}}>¥{launchEvent.price}</Text>
                    </View>
                    <View style={styles.launchLimitBox}>
                       <Text style={{color: '#FFF', fontSize: 10, fontWeight: '700'}}>限量 {launchEvent.total_supply} 份</Text>
                    </View>
                 </View>
              </View>
              <View style={styles.launchBottomBar}>
                 <Text style={{color: '#FFF', fontSize: 16, fontWeight: '900', fontStyle: 'italic'}}>抢购已开启！⚡</Text>
                 <View style={styles.launchActionBtn}><Text style={{color: '#4A2E1B', fontWeight: '800'}}>查看抢购</Text></View>
              </View>
           </TouchableOpacity>
        ) : (
           <View style={styles.emptyBox}><Text style={styles.emptyText}>当前暂无首发活动</Text></View>
        )}

        {/* 🔥 二级市场热门 (同步市场组件！) */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>🔥 二级市场热门</Text>
           <TouchableOpacity onPress={() => router.push('/(tabs)/market')}><Text style={styles.sectionLink}>查看大盘 〉</Text></TouchableOpacity>
        </View>

        <View style={styles.hotGrid}>
           {hotCollections.map(item => (
              <TouchableOpacity 
                 key={item.id}
                 style={[styles.hotCard, item.is_delisted && styles.hotCardDelisted]} 
                 activeOpacity={0.8}
                 onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
              >
                <View style={styles.hotImageBox}>
                   <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.hotImage} />
                   
                   {/* 退市死亡遮罩同步 */}
                   {item.is_delisted && (
                       <View style={styles.delistedOverlay}>
                           <Text style={styles.delistedStamp}>CLOSED</Text>
                           <Text style={styles.delistedSubStamp}>已退市</Text>
                       </View>
                   )}
                </View>
                
                <View style={[styles.hotInfoBox, item.is_delisted && styles.hotInfoBoxDelisted]}>
                  <Text style={[styles.hotName, item.is_delisted && {color: '#999'}]} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.hotPriceContainer}>
                     <Text style={styles.hotPriceLabel}>{item.is_delisted ? '最高限价' : '底价'}</Text>
                     <Text style={[styles.hotPriceValue, item.is_delisted && styles.hotPriceValueDelisted]}>
                        ¥{item.real_floor_price?.toFixed(2)}
                     </Text>
                  </View>
                  <View style={styles.hotSupplyRow}>
                     <Text style={styles.hotSupplyLabel}>全网流通</Text>
                     <Text style={[styles.hotSupplyValue, item.is_delisted && {color: '#888'}]}>{item.circulating_supply}</Text>
                  </View>
                </View>
              </TouchableOpacity>
           ))}
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' }, // 土豆原浆白底色
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  headerLogo: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginRight: 20 },
  headerSub: { fontSize: 16, color: '#999', fontWeight: '700', marginRight: 16 },
  searchBtn: { width: 40, height: 40, backgroundColor: '#FFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#4A2E1B', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },

  // 公告栏
  announcementBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, padding: 12, borderRadius: 12, shadowColor: '#4A2E1B', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 20 },
  hotBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  hotBadgeText: { color: '#FF3B30', fontSize: 10, fontWeight: '900' },
  announcementText: { flex: 1, fontSize: 14, color: '#4A2E1B', fontWeight: '600' },

  // 八宫格
  gridBox: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginBottom: 20 },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#4A2E1B', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, marginBottom: 8 },
  gridText: { fontSize: 12, color: '#4A2E1B', fontWeight: '700' },

  // 通用标题
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  sectionLink: { fontSize: 13, color: '#999', fontWeight: '600' },

  // 发新卡片
  launchCard: { marginHorizontal: 16, height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#222', marginBottom: 30, shadowColor: '#4A2E1B', shadowOffset: {width:0, height:6}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  launchImgBg: { position: 'absolute', width: '100%', height: '100%', opacity: 0.4 },
  launchOverlay: { flex: 1, flexDirection: 'row', padding: 20, alignItems: 'center' },
  launchThumb: { width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderColor: '#D49A36' },
  launchInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  launchName: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 8, textShadowColor: '#000', textShadowOffset: {width:1,height:1}, textShadowRadius: 3 },
  launchPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  launchLimitBox: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  launchBottomBar: { height: 50, backgroundColor: '#FF3B30', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  launchActionBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },

  // 🔥 热门大盘 (完美复刻市场组件样式)
  hotGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  hotCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#4A2E1B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  hotCardDelisted: { opacity: 0.7 }, 
  hotImageBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', position: 'relative' },
  hotImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  // 退市遮罩
  delistedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 4, transform: [{rotate: '-10deg'}], marginBottom: 4 },
  delistedSubStamp: { color: '#FFF', fontSize: 12, fontWeight: '900', borderWidth: 1, borderColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

  hotInfoBox: { padding: 14 },
  hotInfoBoxDelisted: { backgroundColor: '#F5F5F5' }, 
  hotName: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 12 },
  hotPriceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  hotPriceLabel: { fontSize: 11, color: '#999', marginRight: 6, fontWeight: '700' },
  hotPriceValue: { fontSize: 18, fontWeight: '900', color: '#FF3B30' },
  hotPriceValueDelisted: { color: '#888', fontSize: 16 }, 
  hotSupplyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 10 },
  hotSupplyLabel: { fontSize: 11, color: '#AAA', fontWeight: '600' },
  hotSupplyValue: { fontSize: 11, color: '#777', fontWeight: '800' },

  emptyBox: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  emptyText: { color: '#999', fontSize: 14, fontWeight: '600' }
});