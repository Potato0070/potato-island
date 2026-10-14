import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type SortOption = 'hot' | 'latest' | 'price_asc' | 'price_desc' | 'followed';

const FOLLOWED_STORAGE_KEY = '@market_followed_collection_ids';
const HOT_WINDOW_DAYS = 30;

// 💰 千分位金钱格式化工具
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FA' }]}>
      {loading && !hasError && <ActivityIndicator color="#789DB4" style={{ position: 'absolute' }} />}
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

export default function MarketScreen() {
  const router = useRouter();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('latest');
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [hotCounts, setHotCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🌟 初始化时读取用户的偏好记忆
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedSort = await AsyncStorage.getItem('@market_sort');
        const savedCat = await AsyncStorage.getItem('@market_category');
        const savedFollows = await AsyncStorage.getItem(FOLLOWED_STORAGE_KEY);
        if (savedSort && ['hot', 'latest', 'price_asc', 'price_desc', 'followed'].includes(savedSort)) {
          setActiveSort(savedSort as SortOption);
        }
        if (savedCat) setActiveCategory(savedCat);
        if (savedFollows) {
          const parsedFollows: unknown = JSON.parse(savedFollows);
          if (Array.isArray(parsedFollows)) setFollowedIds(parsedFollows.filter((id): id is string => typeof id === 'string'));
        }
      } catch {}
    };
    loadPreferences();
  }, []);

  const fetchMarketData = async () => {
    try {
      const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [categoryResult, collectionResult, tradeResult] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('collections').select('*').eq('is_tradeable', true),
        supabase.from('transfer_logs')
          .select('collection_id, transfer_type, seller_id, price, transfer_time')
          .gte('transfer_time', since)
          .not('seller_id', 'is', null)
          .gt('price', 0),
      ]);
      if (categoryResult.data) setCategories(categoryResult.data);
      if (collectionResult.error) throw collectionResult.error;
      setCollections(collectionResult.data || []);

      if (tradeResult.error) {
        console.warn('近30天成交记录读取失败，最热排序暂不可用：', tradeResult.error);
        setHotCounts({});
      } else {
        const counts = (tradeResult.data || []).reduce<Record<string, number>>((result, trade) => {
          const nonSaleTypes = ['好友转赠', 'launch_mint', 'genesis_mint'];
          if (trade.collection_id && !nonSaleTypes.includes(trade.transfer_type || '')) {
            result[trade.collection_id] = (result[trade.collection_id] || 0) + 1;
          }
          return result;
        }, {});
        setHotCounts(counts);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchMarketData(); }, []));

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchMarketData();
  }, []);

  // 🌟 处理排序切换并记忆
  const handleSortChange = async (sort: SortOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSort(sort);
    try { await AsyncStorage.setItem('@market_sort', sort); } catch {}
  };

  // 🌟 处理分类切换并记忆
  const handleCategoryChange = async (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveCategory(cat);
    try { await AsyncStorage.setItem('@market_category', cat); } catch {}
  };

  const toggleFollowed = async (collectionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextFollowed = followedIds.includes(collectionId)
      ? followedIds.filter(id => id !== collectionId)
      : [...followedIds, collectionId];
    setFollowedIds(nextFollowed);
    try { await AsyncStorage.setItem(FOLLOWED_STORAGE_KEY, JSON.stringify(nextFollowed)); } catch {}
  };

  let processedData = collections.filter(c => {
      let matchCat = true;
      if (activeCategory !== 'all') {
          if (c.category_ids && Array.isArray(c.category_ids)) {
              matchCat = c.category_ids.includes(activeCategory);
          } else {
              matchCat = c.category_id === activeCategory;
          }
      }
      let matchSearch = true;
      if (searchQuery.trim() !== '') {
          matchSearch = c.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      const matchFollowed = activeSort !== 'followed' || followedIds.includes(c.id);
      return matchCat && matchSearch && matchFollowed;
  });

  processedData.sort((a, b) => {
      if (activeSort === 'hot') {
        const hotDifference = (hotCounts[b.id] || 0) - (hotCounts[a.id] || 0);
        if (hotDifference !== 0) return hotDifference;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (activeSort === 'price_asc') return (a.floor_price_cache || 0) - (b.floor_price_cache || 0);
      if (activeSort === 'price_desc') return (b.floor_price_cache || 0) - (a.floor_price_cache || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const renderItem = ({ item }: { item: any }) => {
    const isDelisted = item.on_sale_count === 0 || item.on_sale_count == null;
    const displayPrice = isDelisted ? (item.max_consign_price || 0) : (item.floor_price_cache || 0);

    return (
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/collection', params: { id: item.id } }); }}>
          <View style={styles.imageContainer}>
            <FallbackImage uri={item.image_url} style={styles.image} />
            {isDelisted && (
              <View style={styles.delistedOverlay}>
                 <View style={styles.delistedStamp}><Text style={styles.delistedText}>已退市</Text></View>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.supplyText}>在售 {formatMoney(item.on_sale_count || 0).replace('.00', '')}</Text>
              <Text style={styles.supplyText}>|</Text>
              <Text style={styles.supplyText}>流通 {formatMoney(item.circulating_supply).replace('.00', '')}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{isDelisted ? '求购参考价' : '全网地板价'}</Text>
              <Text style={[styles.price, isDelisted && {color: '#8D6E63'}]}>¥{formatMoney(displayPrice)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={followedIds.includes(item.id) ? `取消关注${item.name}` : `关注${item.name}`}
          style={styles.followButton}
          onPress={() => toggleFollowed(item.id)}
          activeOpacity={0.78}
        >
          <Ionicons name={followedIds.includes(item.id) ? 'heart' : 'heart-outline'} size={20} color={followedIds.includes(item.id) ? '#D87572' : '#596A73'} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>交易集市</Text>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索藏品名称"
          placeholderTextColor="#98A2A8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity style={[styles.catTab, activeCategory === 'all' && styles.catTabActive]} onPress={() => handleCategoryChange('all')}>
            <Text style={[styles.catText, activeCategory === 'all' && styles.catTextActive]}>全部藏品</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} style={[styles.catTab, activeCategory === cat.id && styles.catTabActive]} onPress={() => handleCategoryChange(cat.id)}>
              <Text style={[styles.catText, activeCategory === cat.id && styles.catTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <View style={styles.filterBar}>
        <View style={styles.resultCount}>
          <Ionicons name="albums-outline" size={14} color="#A19284" />
          <Text style={styles.resultCountText} numberOfLines={1}>共 {processedData.length} 件</Text>
        </View>
        <View style={styles.sortSection}>
          <TouchableOpacity hitSlop={4} style={[styles.sortButton, activeSort === 'hot' && styles.sortButtonActive]} onPress={() => handleSortChange('hot')}>
            <Text style={[styles.sortText, activeSort === 'hot' && styles.sortTextActive]}>最热</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={4} style={[styles.sortButton, activeSort === 'latest' && styles.sortButtonActive]} onPress={() => handleSortChange('latest')}>
            <Text style={[styles.sortText, activeSort === 'latest' && styles.sortTextActive]}>最新</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={4} style={[styles.sortButton, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortButtonActive]} onPress={() => handleSortChange(activeSort === 'price_asc' ? 'price_desc' : 'price_asc')}>
            <Text style={[styles.sortText, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortTextActive]} numberOfLines={1}>
              价格排序{activeSort === 'price_asc' ? '↑' : activeSort === 'price_desc' ? '↓' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={4} style={[styles.sortButton, activeSort === 'followed' && styles.sortButtonActive]} onPress={() => handleSortChange('followed')}>
            <Ionicons name={activeSort === 'followed' ? 'heart' : 'heart-outline'} size={12} color={activeSort === 'followed' ? '#D87572' : '#77858C'} />
            <Text style={[styles.sortText, activeSort === 'followed' && styles.sortTextActive]}>关注</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        // 🌟 骨架屏占位
        <View style={{flexDirection: 'row', flexWrap: 'wrap', padding: 16, justifyContent: 'space-between'}}>
           {Array.from({length: 6}).map((_, i) => (
           <View key={i} style={[styles.card, { opacity: 0.58 }]}>
                <View style={[styles.imageContainer, {backgroundColor: '#EEF2F4'}]} />
                <View style={{padding: 12}}>
                   <View style={{height: 14, backgroundColor: '#E5EAED', borderRadius: 4, marginBottom: 8, width: '80%'}} />
                   <View style={{height: 10, backgroundColor: '#E5EAED', borderRadius: 4, width: '50%'}} />
                </View>
             </View>
           ))}
        </View>
      ) : (
        <FlatList 
          data={processedData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          numColumns={2} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          columnWrapperStyle={{ justifyContent: 'space-between' }} 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#789DB4" />}
          ListEmptyComponent={
             <View style={styles.emptyState}>
                <View style={styles.emptyIllustration}><Text style={styles.emptyIcon}>🥔</Text></View>
                <Text style={styles.emptyText}>{activeSort === 'followed' && followedIds.length === 0 ? '还没有关注的藏品，点亮卡片上的爱心收藏' : '集市里还没有这种藏品哦'}</Text>
             </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 58, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#493D35', letterSpacing: 0.2 },
  
  searchSection: { height: 46, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBFAF8', borderRadius: 14, borderWidth: 1, borderColor: '#ECE7E0' },
  searchIcon: { width: 25, color: '#9A8B7D', fontSize: 24, lineHeight: 27, textAlign: 'center', marginRight: 5 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', paddingHorizontal: 2, fontSize: 14, color: '#493D35', fontWeight: '500' },

  categoryWrapper: { backgroundColor: '#FFFFFF', paddingTop: 8, paddingBottom: 10 },
  categoryScroll: { paddingHorizontal: 16 },
  catTab: { minHeight: 40, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 13, marginRight: 8, backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#F0EAE1', justifyContent: 'center' },
  catTabActive: { backgroundColor: '#F1E3C8', borderColor: '#DFC696' },
  catText: { fontSize: 14, lineHeight: 20, color: '#75685D', fontWeight: '600' },
  catTextActive: { color: '#76542D', fontWeight: '700' },

  filterBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 10 },
  resultCount: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 72 },
  resultCountText: { fontSize: 12, lineHeight: 16, color: '#94877C', fontWeight: '500' },
  sortSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, flexShrink: 0 },
  sortButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 6, borderRadius: 9, backgroundColor: 'transparent' },
  sortButtonActive: { backgroundColor: '#EEF3F7' },
  sortText: { fontSize: 12, lineHeight: 16, color: '#948A80', fontWeight: '600', flexShrink: 0 },
  sortTextActive: { color: '#537895', fontWeight: '700' },
  
  card: { width: CARD_WIDTH, position: 'relative', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14, overflow: 'hidden', shadowColor: '#493D35', shadowOpacity: 0.035, shadowRadius: 7, elevation: 1, borderWidth: 1, borderColor: '#EEE9E3' },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FBFAF8', borderBottomWidth: 1, borderColor: '#F1ECE5' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,250,244,0.18)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { minWidth: CARD_WIDTH * 0.78, height: 50, paddingHorizontal: 14, borderRadius: 10, borderWidth: 2, borderColor: '#FFF9F1', backgroundColor: '#A84337', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-8deg'}] },
  delistedText: { color: '#FFF9F1', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  followButton: { position: 'absolute', top: 9, right: 9, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: 'rgba(224,230,232,0.9)', shadowColor: '#38464D', shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  
  info: { paddingHorizontal: 11, paddingTop: 11, paddingBottom: 12 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#493D35', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  supplyText: { fontSize: 11, lineHeight: 14, color: '#94877C', marginRight: 5, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#EEE9E3', paddingTop: 8 },
  priceLabel: { fontSize: 11, lineHeight: 14, color: '#94877C', fontWeight: '500' },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#9A6A33' },
  emptyState: { alignItems: 'center', marginTop: 72, paddingHorizontal: 24 },
  emptyIllustration: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F3F7F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: '#67777F', fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
