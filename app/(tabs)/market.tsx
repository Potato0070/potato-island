import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type SortOption = 'latest' | 'price_asc' | 'price_desc';

export default function MarketScreen() {
  const router = useRouter();
  
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('latest');
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

  let processedData = activeCategory === 'all' 
     ? collections 
     : collections.filter(c => {
         // 兼容新版的多选数组 category_ids 和 老版的单选 category_id
         if (c.category_ids && Array.isArray(c.category_ids)) {
             return c.category_ids.includes(activeCategory);
         }
         return c.category_id === activeCategory;
     });

  processedData = processedData.sort((a, b) => {
     if (activeSort === 'price_asc') {
        if (a.on_sale_count === 0 && b.on_sale_count !== 0) return 1;
        if (a.on_sale_count !== 0 && b.on_sale_count === 0) return -1;
        return (a.floor_price_cache || 0) - (b.floor_price_cache || 0);
     }
     if (activeSort === 'price_desc') {
        if (a.on_sale_count === 0 && b.on_sale_count !== 0) return 1;
        if (a.on_sale_count !== 0 && b.on_sale_count === 0) return -1;
        return (b.floor_price_cache || 0) - (a.floor_price_cache || 0);
     }
     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const renderItem = ({ item }: { item: any }) => {
    const isDelisted = item.on_sale_count === 0 || item.on_sale_count == null;
    
    // 🌟 核心：强行展示最高限价（起拍价）
    const displayPrice = isDelisted ? (item.max_consign_price || 0) : (item.floor_price_cache || 0);

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push({ pathname: '/collection', params: { id: item.id } })}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
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
            <Text style={[styles.price, isDelisted && {color: '#888'}]}>¥{displayPrice.toFixed(2)}</Text>
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
      
      <View style={styles.sortBar}>
         <TouchableOpacity onPress={() => setActiveSort('latest')}>
            <Text style={[styles.sortText, activeSort === 'latest' && styles.sortTextActive]}>最新上架</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.sortPriceBtn} onPress={() => setActiveSort(activeSort === 'price_asc' ? 'price_desc' : 'price_asc')}>
            <Text style={[styles.sortText, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortTextActive]}>
               价格排序 {activeSort === 'price_asc' ? '↑' : (activeSort === 'price_desc' ? '↓' : '')}
            </Text>
         </TouchableOpacity>
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
          ListEmptyComponent={<Text style={{textAlign:'center', color:'#999', marginTop:50}}>暂无数据</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  
  categoryWrapper: { backgroundColor: '#FFF', paddingVertical: 10 },
  categoryScroll: { paddingHorizontal: 16 },
  catTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: '#F5F5F5' },
  catTabActive: { backgroundColor: '#111' },
  catText: { fontSize: 13, color: '#666', fontWeight: '600' },
  catTextActive: { color: '#FFD700', fontWeight: '900' },

  sortBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sortText: { fontSize: 13, color: '#888', marginRight: 24, fontWeight: '600' },
  sortTextActive: { color: '#FF3B30', fontWeight: '900' },
  sortPriceBtn: { flexDirection: 'row', alignItems: 'center' },

  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  info: { padding: 12 },
  name: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#888', marginRight: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 8 },
  priceLabel: { fontSize: 11, color: '#666' },
  price: { fontSize: 16, fontWeight: '900', color: '#FF3B30' }
});