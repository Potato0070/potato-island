import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function MarketScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchCollections(); }, []));

  const fetchCollections = async () => {
    try {
      setLoading(true);
      // 获取允许交易的藏品系列
      const { data: cols, error } = await supabase
        .from('collections')
        .select('*')
        .eq('is_tradeable', true)
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      // 动态统计每个系列的“当前在售数量 (挂单数)”
      // 这里为了演示，我们查询 nfts 表里 status = 'listed' 的数量，并合并到集合数据中
      const { data: listedNfts } = await supabase
        .from('nfts')
        .select('collection_id')
        .eq('status', 'listed');

      const listedCounts: Record<string, number> = {};
      if (listedNfts) {
         listedNfts.forEach(nft => {
            listedCounts[nft.collection_id] = (listedCounts[nft.collection_id] || 0) + 1;
         });
      }

      const finalData = cols?.map(col => ({
         ...col,
         on_sale_count: listedCounts[col.id] || 0 // 0 就是“已退市”
      })) || [];

      setCollections(finalData);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // 核心逻辑判断：寄售挂单数为 0 时，判定为“已退市”
    const isDelisted = item.on_sale_count === 0;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8} 
        onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
          
          {/* 🌟 极其醒目的“已退市”黑膜印章 */}
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
          
          {/* 增加首发量与流通量对比，体现稀缺度 */}
          <View style={styles.statsRow}>
            <Text style={styles.supplyText}>在售 {item.on_sale_count}</Text>
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
      
      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={collections} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          numColumns={2} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          columnWrapperStyle={{ justifyContent: 'space-between' }} 
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  
  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  // “已退市”视觉遮罩与印章样式
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FFF', backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  delistedText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  delistedSub: { color: '#CCC', fontSize: 8, marginTop: 2, fontFamily: 'monospace' },

  info: { padding: 12 },
  name: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 6 },
  
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  supplyText: { fontSize: 10, color: '#888', marginRight: 4 },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 8 },
  priceLabel: { fontSize: 11, color: '#666' },
  price: { fontSize: 16, fontWeight: '900', color: '#FF3B30' }
});