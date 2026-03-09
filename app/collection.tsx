import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function CollectionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listed' | 'all'>('listed');

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollection(colData);

      const { data: nftData } = await supabase.from('nfts')
        .select('*, profiles(nickname)')
        .eq('collection_id', id)
        .neq('status', 'burned')
        .order('consign_price', { ascending: true, nullsFirst: false }); // 价格从低到高排列
      
      setNfts(nftData || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const displayedNfts = activeTab === 'listed' ? nfts.filter(n => n.status === 'listed') : nfts;

  const renderNft = ({ item }: { item: any }) => {
    const isListed = item.status === 'listed';
    return (
      <TouchableOpacity style={styles.nftCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/item-detail', params: { id: item.id } })}>
        <View style={styles.imgBox}>
           <Image source={{ uri: collection?.image_url }} style={styles.nftImg} />
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#4CD964'}]}>
              <Text style={styles.statusText}>{isListed ? '寄售中' : '金库锁定'}</Text>
           </View>
        </View>
        <View style={styles.nftInfo}>
          <Text style={styles.serial}>#{String(item.serial_number).padStart(6, '0')}</Text>
          <Text style={styles.owner} numberOfLines={1}>持有者: {item.profiles?.nickname || '神秘藏友'}</Text>
          {isListed ? (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>一口价</Text>
                <Text style={styles.priceValue}>¥{item.consign_price}</Text>
             </View>
          ) : (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>状态</Text>
                <Text style={[styles.priceValue, {color: '#888', fontSize: 12}]}>非卖品</Text>
             </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: collection?.image_url }} style={styles.headerBg} blurRadius={15}>
         <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']} style={{width: '100%'}}>
               <View style={styles.navBar}>
                 <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
                 <Text style={styles.navTitle}>系列详情</Text>
                 <View style={styles.navBtn} />
               </View>

               <View style={styles.heroContent}>
                  <Image source={{ uri: collection?.image_url }} style={styles.heroImg} />
                  <Text style={styles.heroTitle}>{collection?.name}</Text>
                  
                  <View style={styles.statsMatrix}>
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>¥{collection?.floor_price_cache || 0}</Text>
                        <Text style={styles.statLabel}>地板价</Text>
                     </View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>{collection?.on_sale_count || 0}</Text>
                        <Text style={styles.statLabel}>在售数量</Text>
                     </View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>{collection?.circulating_supply}</Text>
                        <Text style={styles.statLabel}>全网流通</Text>
                     </View>
                  </View>
               </View>
            </SafeAreaView>
         </View>
      </ImageBackground>

      <View style={styles.listSection}>
         {/* 双击切换 Tabs */}
         <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'listed' && styles.tabBtnActive]} onPress={() => setActiveTab('listed')}>
               <Text style={[styles.tabText, activeTab === 'listed' && styles.tabTextActive]}>在售现货 ({collection?.on_sale_count || 0})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]} onPress={() => setActiveTab('all')}>
               <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>全部图鉴 ({nfts.length})</Text>
            </TouchableOpacity>
         </View>

         {/* 🌟 核心优化：一岛同款的“煽动性求购横幅” */}
         <TouchableOpacity 
            style={styles.fomoBanner} 
            activeOpacity={0.8}
            onPress={() => router.push({pathname: '/create-buy-order', params: {colId: collection?.id}})}
         >
            <Text style={styles.fomoText}>寄售价不够合适？点此去发布求购单，抢先拿下心仪藏品 〉</Text>
         </TouchableOpacity>

         <FlatList 
           data={displayedNfts} 
           renderItem={renderNft} 
           keyExtractor={item => item.id} 
           numColumns={2}
           contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
           columnWrapperStyle={{ justifyContent: 'space-between' }}
           showsVerticalScrollIndicator={false}
           ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 40}}>暂无数据</Text>}
         />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  headerBg: { width: '100%', minHeight: 320 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },

  heroContent: { alignItems: 'center', paddingVertical: 20 },
  heroImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#FFF', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 20 },
  statsMatrix: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, width: '90%', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#FFD700', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#CCC' },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },

  listSection: { flex: 1, backgroundColor: '#F5F6F8', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, overflow: 'hidden' },
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, backgroundColor: '#FFF' },
  tabBtn: { paddingBottom: 8, marginRight: 24, borderBottomWidth: 2, borderColor: 'transparent' },
  tabBtnActive: { borderColor: '#111' },
  tabText: { fontSize: 15, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#111', fontWeight: '900' },

  fomoBanner: { backgroundColor: '#FFF5E6', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#FFE4B5' },
  fomoText: { color: '#D49A36', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  nftCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  imgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  nftImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  nftInfo: { flex: 1 },
  serial: { fontSize: 14, fontWeight: '900', color: '#111', fontFamily: 'monospace', marginBottom: 2 },
  owner: { fontSize: 10, color: '#888', marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 6 },
  priceLabel: { fontSize: 10, color: '#999' },
  priceValue: { fontSize: 14, fontWeight: '900', color: '#FF3B30' }
});