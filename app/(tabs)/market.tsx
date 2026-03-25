import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type SortOption = 'latest' | 'price_asc' | 'price_desc';

// 🌟 终极防御型图片组件（自动处理裂图，无缝降级，不打断心流）
const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EFE6' }]}>
      {loading && !hasError && <ActivityIndicator color="#D49A36" style={{ position: 'absolute' }} />}
      {!hasError ? (
        <Image
          source={{ uri: uri || 'invalid_url' }}
          style={[style, { position: 'absolute', width: '100%', height: '100%' }]}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setHasError(true);
            setLoading(false);
          }}
        />
      ) : (
        // 🌟 优雅降级：图裂了自动变成这颗尊贵的土豆占位符
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

  useFocusEffect(useCallback(() => { fetchMarketData(); }, []));

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const { data: catData } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (catData) setCategories(catData);

      const { data: colData, error } = await supabase.from('collections').select('*').eq('is_tradeable', true);
      if (error) throw error;
      setCollections(colData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
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
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => router.push({ pathname: '/collection', params: { id: item.id } })}>
        <View style={styles.imageContainer}>
          {/* 🌟 引入防御型图片组件 */}
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
            <Text style={styles.supplyText}>在售 {item.on_sale_count || 0}</Text>
            <Text style={styles.supplyText}>|</Text>
            <Text style={styles.supplyText}>流通 {item.circulating_supply}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{isDelisted ? '求购参考价' : '地板价'}</Text>
            <Text style={[styles.price, isDelisted && {color: '#8D6E63'}]}>¥{displayPrice.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>交易集市</Text></View>

      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity style={[styles.catTab, activeCategory === 'all' && styles.catTabActive]} onPress={() => setActiveCategory('all')}>
            <Text style={[styles.catText, activeCategory === 'all' && styles.catTextActive]}>全部藏品</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} style={[styles.catTab, activeCategory === cat.id && styles.catTabActive]} onPress={() => setActiveCategory(cat.id)}>
              <Text style={[styles.catText, activeCategory === cat.id && styles.catTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <View style={styles.filterBar}>
         <View style={styles.sortSection}>
             <TouchableOpacity onPress={() => setActiveSort('latest')}>
                <Text style={[styles.sortText, activeSort === 'latest' && styles.sortTextActive]}>最新上架</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.sortPriceBtn} onPress={() => setActiveSort(activeSort === 'price_asc' ? 'price_desc' : 'price_asc')}>
                <Text style={[styles.sortText, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortTextActive]}>
                    价格排序 {activeSort === 'price_asc' ? '↑' : (activeSort === 'price_desc' ? '↓' : '')}
                </Text>
             </TouchableOpacity>
         </View>
         
         <View style={styles.searchSection}>
            <TextInput 
               style={styles.searchInput} 
               placeholder="🔍 搜索藏品..." 
               placeholderTextColor="#A1887F"
               value={searchQuery}
               onChangeText={setSearchQuery}
            />
         </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={processedData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          numColumns={2} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          columnWrapperStyle={{ justifyContent: 'space-between' }} 
          ListEmptyComponent={
             <View style={{alignItems:'center', marginTop: 50}}>
                <Text style={{fontSize: 40, marginBottom: 10}}>🪹</Text>
                <Text style={{color:'#8D6E63', fontWeight: '600'}}>集市暂无此类藏品</Text>
             </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 统一复古米白
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  header: { padding: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  
  categoryWrapper: { backgroundColor: '#FDF8F0', paddingVertical: 10 },
  categoryScroll: { paddingHorizontal: 16 },
  catTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAE0D5' },
  catTabActive: { backgroundColor: '#D49A36', borderColor: '#D49A36' },
  catText: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  catTextActive: { color: '#FFF', fontWeight: '900' },

  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FDF8F0', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#EAE0D5' },
  sortSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sortText: { fontSize: 13, color: '#8D6E63', marginRight: 20, fontWeight: '700' },
  sortTextActive: { color: '#D49A36', fontWeight: '900' }, // 🌟 排序高亮为琥珀金
  sortPriceBtn: { flexDirection: 'row', alignItems: 'center' },
  
  searchSection: { width: 120 },
  searchInput: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, color: '#4E342E', borderWidth: 1, borderColor: '#EAE0D5' },

  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#F0E6D2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(78, 52, 46, 0.6)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#D49A36', backgroundColor: 'rgba(44, 30, 22, 0.8)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#D49A36', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  
  info: { padding: 12 },
  name: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#8D6E63', marginRight: 4, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#EAE0D5', paddingTop: 8 },
  priceLabel: { fontSize: 11, color: '#A1887F', fontWeight: '700' },
  price: { fontSize: 16, fontWeight: '900', color: '#D49A36' } // 🌟 价格也换成了琥珀金
});