import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function ConsignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // 藏品ID
  const [listedNfts, setListedNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListed();
  }, [id]);

  const fetchListed = async () => {
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)')
      .eq('collection_id', id).eq('status', 'listed').order('consign_price', { ascending: true });
    setListedNfts(data || []);
    setLoading(false);
  };

  const handleBuy = async (nftId: string) => {
    Alert.alert('确认购买', '即将动用您的土豆币进行扫货，是否继续？', [
      { text: '取消', style: 'cancel' },
      { text: '确认购买', onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.rpc('execute_trade', { p_nft_id: nftId, p_buyer_id: user?.id });
          if (error) Alert.alert('交易失败', error.message);
          else { Alert.alert('成功', '藏品已收入囊中！'); fetchListed(); }
      }}
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View>
         <Text style={styles.serial}>#{String(item.serial_number).padStart(6, '0')}</Text>
         <Text style={styles.seller}>卖家: 土豆岛藏友</Text>
      </View>
      <View style={{alignItems: 'flex-end'}}>
         <Text style={styles.price}>¥{item.consign_price}</Text>
         <TouchableOpacity style={styles.buyBtn} onPress={() => handleBuy(item.id)}><Text style={styles.buyText}>购买</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>现货大盘</Text>
        <View style={styles.navBtn} />
      </View>
      {loading ? <ActivityIndicator style={{marginTop: 50}} color="#D49A36" /> : (
        <FlatList data={listedNfts} renderItem={renderItem} keyExtractor={item => item.id} contentContainerStyle={{padding: 16}}
          ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>盘口已被扫空，暂无现货</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  serial: { fontSize: 16, fontWeight: '900', color: '#333', fontFamily: 'monospace' },
  seller: { fontSize: 12, color: '#999', marginTop: 4 },
  price: { fontSize: 18, fontWeight: '900', color: '#FF3B30', marginBottom: 8 },
  buyBtn: { backgroundColor: '#4A2E1B', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  buyText: { color: '#FFF', fontWeight: '800' }
});