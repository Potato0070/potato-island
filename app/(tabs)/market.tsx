import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function MarketScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchCollections(); }, []));

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('collections').select('*').eq('is_tradeable', true).order('created_at', { ascending: false });
      if (error) throw error;
      setCollections(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}>
      <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.supply}>大盘流通量: {item.circulating_supply}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>地板价</Text>
          <Text style={styles.price}>¥{item.floor_price_cache?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>交易集市</Text></View>
      {loading ? <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} /> : (
        <FlatList data={collections} renderItem={renderItem} keyExtractor={item => item.id} numColumns={2} contentContainerStyle={{ padding: 16 }} columnWrapperStyle={{ justifyContent: 'space-between' }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { width: '48%', backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#F5E8D4' },
  info: { marginTop: 8 },
  name: { fontSize: 14, fontWeight: '800', color: '#4A2E1B', marginBottom: 4 },
  supply: { fontSize: 10, color: '#888', marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  priceLabel: { fontSize: 10, color: '#999' },
  price: { fontSize: 14, fontWeight: '900', color: '#FF3B30' }
});