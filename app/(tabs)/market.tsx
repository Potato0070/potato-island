import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type SortOption = 'latest' | 'price_asc' | 'price_desc';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🌟 初始化时读取用户的偏好记忆
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedSort = await AsyncStorage.getItem('@market_sort');
        const savedCat = await AsyncStorage.getItem('@market_category');
        if (savedSort) setActiveSort(savedSort as SortOption);
        if (savedCat) setActiveCategory(savedCat);
      } catch (e) {}
    };
    loadPreferences();
  }, []);

  const fetchMarketData = async () => {
    try {
      const { data: catData } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (catData) setCategories(catData);

      const { data: colData, error } = await supabase.from('collections').select('*').eq('is_tradeable', true);
      if (error) throw error;
      setCollections(colData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
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
    try { await AsyncStorage.setItem('@market_sort', sort); } catch (e) {}
  };

  // 🌟 处理分类切换并记忆
  const handleCategoryChange = async (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveCategory(cat);
    try { await AsyncStorage.setItem('@market_category', cat); } catch (e) {}
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
      return matchCat && matchSearch;
  });

  processedData.sort((a, b) => {
      const aHasStock = (a.on_sale_count || 0) > 0;
      const bHasStock = (b.on_sale_count || 0) > 0;
      
      if (aHasStock && !bHasStock) return -1;
      if (!aHasStock && bHasStock) return 1;

      if (activeSort === 'price_asc') return (a.floor_price_cache || 0) - (b.floor_price_cache || 0);
      if (activeSort === 'price_desc') return (b.floor_price_cache || 0) - (a.floor_price_cache || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const renderItem = ({ item }: { item: any }) => {
    const isDelisted = item.on_sale_count === 0 || item.on_sale_count == null;
    const displayPrice = isDelisted ? (item.max_consign_price || 0) : (item.floor_price_cache || 0);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/collection', params: { id: item.id } }); }}>
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
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>交易集市</Text></View>

      <View style={styles.searchSection}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索藏品..."
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
         <View style={styles.sortSection}>
             <TouchableOpacity style={[styles.sortButton, activeSort === 'latest' && styles.sortButtonActive]} onPress={() => handleSortChange('latest')}>
                <Text style={[styles.sortText, activeSort === 'latest' && styles.sortTextActive]}>最新上架</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.sortButton, styles.sortPriceBtn, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortButtonActive]} onPress={() => handleSortChange(activeSort === 'price_asc' ? 'price_desc' : 'price_asc')}>
                <Text style={[styles.sortText, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortTextActive]}>
                    价格排序 {activeSort === 'price_asc' ? '↑' : (activeSort === 'price_desc' ? '↓' : '')}
                </Text>
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
                <Text style={styles.emptyText}>集市里还没有这种藏品哦</Text>
             </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: '#FFFFFF', alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#3F484D', letterSpacing: 0.2 },
  
  searchSection: { height: 46, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5EAED' },
  searchIcon: { width: 25, color: '#789DB4', fontSize: 24, lineHeight: 27, textAlign: 'center', marginRight: 5 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', paddingHorizontal: 2, fontSize: 14, color: '#3F484D', fontWeight: '500' },

  categoryWrapper: { backgroundColor: '#FFFFFF', paddingTop: 8, paddingBottom: 10 },
  categoryScroll: { paddingHorizontal: 16 },
  catTab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 18, marginRight: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5EAED' },
  catTabActive: { backgroundColor: '#EAF2F7', borderColor: '#D3E1E9' },
  catText: { fontSize: 13, color: '#707D84', fontWeight: '700' },
  catTextActive: { color: '#547C96', fontWeight: '800' },

  filterBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#EEF1F3' },
  sortSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sortButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, marginRight: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E8ECEF', backgroundColor: '#FFFFFF' },
  sortButtonActive: { backgroundColor: '#EEF4F8', borderColor: '#DCE8EF' },
  sortText: { fontSize: 12, color: '#707D84', fontWeight: '700' },
  sortTextActive: { color: '#547C96', fontWeight: '800' },
  sortPriceBtn: { flexDirection: 'row', alignItems: 'center' },
  
  card: { width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14, overflow: 'hidden', shadowColor: '#34434D', shadowOpacity: 0.035, shadowRadius: 7, elevation: 1, borderWidth: 1, borderColor: '#E8ECEF' },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F7F9FA', borderBottomWidth: 1, borderColor: '#EEF1F3' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.42)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { minWidth: 72, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(94,112,123,0.48)', backgroundColor: 'rgba(255,255,255,0.88)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-8deg'}] },
  delistedText: { color: '#697982', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  
  info: { paddingHorizontal: 11, paddingTop: 11, paddingBottom: 12 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: '#3F484D', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  supplyText: { fontSize: 10, color: '#7D898F', marginRight: 5, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#EEF1F3', paddingTop: 8 },
  priceLabel: { fontSize: 10, color: '#87939A', fontWeight: '600' },
  price: { fontSize: 15, fontWeight: '800', color: '#668FA8' },
  emptyState: { alignItems: 'center', marginTop: 72, paddingHorizontal: 24 },
  emptyIllustration: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F3F7F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: '#67777F', fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
