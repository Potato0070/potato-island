import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function MarketScreen() {
  const router = useRouter();
  
  // 核心数据状态
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchMarketData(); }, []));

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      
      // 1. 获取所有分区类别
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (catData) setCategories(catData);

      // 2. 获取大盘藏品 (直接享受底层触发器算好的 on_sale_count 和 floor_price_cache)
      const { data: colData, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_tradeable', true)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCollections(colData || []);

    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  // 根据当前选中的分区过滤数据
  const filteredCollections = activeCategory === 'all' 
    ? collections 
    : collections.filter(c => c.category_id === activeCategory);

  const renderItem = ({ item }: { item: any }) => {
    // 核心退市判定：依赖底层精确数据
    const isDelisted = item.on_sale_count === 0 || item.on_sale_count == null;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8} 
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
          
          {/* 🌟 霸气退市黑膜印章 */}
          {isDelisted && (
            <View style={styles.delistedOverlay}>
               <View style={styles.delistedStamp}>
                  <Text style={styles.delistedText}>已退市</Text>
                  <Text style={styles.delistedSub}>DELISTED</Text>
               </View>
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
            <Text style={[styles.price, isDelisted && {color: '#888'}]}>
               ¥{item.floor_price_cache?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>交易集市</Text>
      </View>

      {/* 🌟 顶部横向滑动的分区导航 */}
      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity 
            style={[styles.catTab, activeCategory === 'all' && styles.catTabActive]}
            onPress={() => setActiveCategory('all')}
          >
            <Text style={[styles.catText, activeCategory === 'all' && styles.catTextActive]}>全部藏品</Text>
          </TouchableOpacity>
          
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              style={[styles.catTab, activeCategory === cat.id && styles.catTabActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <Text style={[styles.catText, activeCategory === cat.id && styles.catTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={filteredCollections} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          numColumns={2} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          columnWrapperStyle={{ justifyContent: 'space-between' }} 
          ListEmptyComponent={<Text style={{textAlign:'center', color:'#999', marginTop:50}}>该分区暂无藏品</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  
  // 分区导航样式
  categoryWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0', paddingVertical: 8 },
  categoryScroll: { paddingHorizontal: 16 },
  catTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: '#F5F5F5' },
  catTabActive: { backgroundColor: '#4A2E1B' },
  catText: { fontSize: 13, color: '#666', fontWeight: '600' },
  catTextActive: { color: '#FFD700', fontWeight: '900' },

  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  delistedSub: { color: '#CCC', fontSize: 8, marginTop: 2, fontFamily: 'monospace' },

  info: { padding: 12 },
  name: { fontSize: 14, fontWeight: '800', color: '#4A2E1B', marginBottom: 6 },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#888', marginRight: 4 },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 8 },
  priceLabel: { fontSize: 11, color: '#666' },
  price: { fontSize: 16, fontWeight: '900', color: '#FF3B30' }
});