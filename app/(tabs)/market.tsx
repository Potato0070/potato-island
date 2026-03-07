import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function MarketScreen() {
  const router = useRouter();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | 'all'>('all');
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marqueeText, setMarqueeText] = useState('土豆岛大盘正在火热交易中...');

  const fetchMarketData = async () => {
    try {
      // 1. 获取分类
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (catData) setCategories(catData);

      // 2. 拉取所有【允许流通】的藏品主档
      const { data: colData } = await supabase
        .from('collections')
        .select('*')
        .eq('is_tradeable', true)
        .order('created_at', { ascending: false });

      // 3. 🔥 核弹级修复：扩大雷达侦测频段，同时兼容 listed 和 consigning 状态！
      const { data: listedNfts } = await supabase
        .from('nfts')
        .select('collection_id, price')
        .in('status', ['listed', 'consigning']); // 这次绝不漏掉寄售状态！

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

      // 4. 动态注入实时数据
      const enrichedCols = (colData || []).map(col => {
         const stats = marketStats[col.id];
         const isDelisted = !stats || stats.count === 0; // 挂单数为0即为退市
         
         // 核心：退市显示最高限价；否则显示挂单最低价
         const realFloorPrice = isDelisted ? (col.max_consign_price || 0) : stats.minPrice;

         return {
            ...col,
            is_delisted: isDelisted,
            real_floor_price: realFloorPrice
         };
      });

      setCollections(enrichedCols);

      // 5. 拉取流转记录做跑马灯 (修复 TS 红线报错)
      const { data: logData } = await supabase
        .from('transaction_logs')
        .select('collection:collection_id(name), price')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (logData && logData.collection) {
         const c: any = logData.collection;
         const collectionName = Array.isArray(c) ? c[0]?.name : c?.name;
         if (collectionName) {
             setMarqueeText(`一岛藏友 刚刚花了 ¥${logData.price} 扫货了《${collectionName}》`);
         }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchMarketData(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
  };

  // 分类过滤
  const filteredCollections = selectedCatId === 'all' 
    ? collections 
    : collections.filter(c => c.category_id === selectedCatId);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
       style={styles.card} 
       activeOpacity={0.8}
       onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
    >
      <View style={styles.imageBox}>
         <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
         
         {/* 🔥 退市死亡遮罩：整卡置暗 + 霸气红印 */}
         {item.is_delisted && (
             <View style={styles.delistedOverlay}>
                 <Text style={styles.delistedStamp}>CLOSED</Text>
                 <Text style={styles.delistedSubStamp}>已退市</Text>
             </View>
         )}
      </View>
      
      {/* 🔥 重置布局：极简主义，价格至上 */}
      <View style={[styles.infoBox, item.is_delisted && styles.infoBoxDelisted]}>
        <Text style={[styles.name, item.is_delisted && {color: '#999'}]} numberOfLines={1}>{item.name}</Text>
        
        <View style={styles.priceContainer}>
           <Text style={styles.priceLabel}>{item.is_delisted ? '最高限价' : '底价'}</Text>
           <Text style={[styles.priceValue, item.is_delisted && styles.priceValueDelisted]}>
              ¥{item.real_floor_price?.toFixed(2)}
           </Text>
        </View>

        {/* 流通量独立排版，更精致 */}
        <View style={styles.supplyRow}>
           <Text style={styles.supplyLabel}>全网流通</Text>
           <Text style={[styles.supplyValue, item.is_delisted && {color: '#888'}]}>{item.circulating_supply}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {/* 1. 顶部跑马灯与搜索 */}
      <View style={styles.topBar}>
         <View style={styles.marqueeBox}>
            <Text style={styles.marqueeText} numberOfLines={1}>{marqueeText}</Text>
         </View>
         <TouchableOpacity style={styles.searchBtn}>
            <Text style={{fontSize: 16}}>🔍</Text>
         </TouchableOpacity>
      </View>

      {/* 2. 标题与排序 */}
      <View style={styles.filterHeader}>
         <Text style={styles.headerTitle}>大盘全景 ▾</Text>
         <View style={styles.sortBox}>
            <Text style={[styles.sortText, {color: '#00E5FF'}]}>最热</Text>
            <Text style={styles.sortText}>最新</Text>
            <Text style={styles.sortText}>价格 ↕</Text>
         </View>
      </View>

      {/* 3. 动态分类 Tabs */}
      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: '全部' }, ...categories]}
          keyExtractor={(item) => item.id.toString()}
          style={styles.tabList}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => {
            const isActive = selectedCatId === item.id;
            return (
              <TouchableOpacity 
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setSelectedCatId(item.id)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 4. 藏品网格 */}
      {loading ? (
        <ActivityIndicator size="large" color="#111" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredCollections}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.rowWrapper}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Text style={styles.emptyText}>该区域暂无资产</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EBE3' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 10, marginBottom: 20 },
  marqueeBox: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  marqueeText: { color: '#888', fontSize: 13, fontWeight: '600' },
  searchBtn: { width: 40, height: 40, backgroundColor: '#FFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },

  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111', letterSpacing: 1 },
  sortBox: { flexDirection: 'row', alignItems: 'center' },
  sortText: { fontSize: 12, color: '#999', fontWeight: '700', marginLeft: 14 },

  tabList: { maxHeight: 40, marginBottom: 16 },
  tabItem: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#E0DACE', borderRadius: 20, marginRight: 10, justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#111' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFF', fontWeight: '900' },

  gridContent: { paddingHorizontal: 16, paddingBottom: 100 },
  rowWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  
  card: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  
  imageBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  // 🔥 退市专属死亡遮罩
  delistedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 4, transform: [{rotate: '-10deg'}], marginBottom: 4 },
  delistedSubStamp: { color: '#FFF', fontSize: 12, fontWeight: '900', borderWidth: 1, borderColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

  infoBox: { padding: 14 },
  infoBoxDelisted: { backgroundColor: '#F5F5F5' }, // 退市时底部背景变灰
  
  name: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 12 },
  
  // 🔥 重置价格区域：底价+数值在一行
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 },
  priceLabel: { fontSize: 11, color: '#999', marginRight: 6, fontWeight: '700' },
  priceValue: { fontSize: 18, fontWeight: '900', color: '#FF3B30' },
  priceValueDelisted: { color: '#888', fontSize: 16 }, // 退市限价，低调处理

  // 🔥 精致流通量：在底部一条横线， justify-between
  supplyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 10 },
  supplyLabel: { fontSize: 11, color: '#AAA', fontWeight: '600' },
  supplyValue: { fontSize: 11, color: '#777', fontWeight: '800' },

  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#999', fontSize: 15, fontWeight: '600' }
});