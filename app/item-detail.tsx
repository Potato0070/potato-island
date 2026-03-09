import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url, description), profiles(nickname)').eq('id', id).single();
    setNft(data);
  };

  const handleBuy = async () => {
    Alert.alert('确认购买', `即将花费 ¥${nft.consign_price} 买入此藏品，是否继续？`, [
      { text: '取消', style: 'cancel' },
      { text: '确认付款', onPress: async () => {
          setBuying(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.rpc('execute_trade', { p_nft_id: nft.id, p_buyer_id: user?.id });
            if (error) throw error;
            Alert.alert('✅ 交易成功', '藏品已打入您的金库！', [{ text: '查看金库', onPress: () => router.replace('/(tabs)/profile') }]);
          } catch (err: any) { Alert.alert('交易失败', err.message); setBuying(false); }
      }}
    ]);
  };

  if (!nft) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>资产查验</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.imgBox}>
          <Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} />
          <View style={styles.serialTag}>
             <Text style={styles.serialText}>ID: #{String(nft.serial_number).padStart(6, '0')}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
           <Text style={styles.title}>{nft.collections?.name}</Text>
           <Text style={styles.desc}>{nft.collections?.description || '土豆宇宙原生数字资产。'}</Text>
           
           <View style={styles.dataCard}>
             <Text style={styles.dataLabel}>当前持有者</Text>
             <Text style={styles.dataValue}>{nft.profiles?.nickname || '神秘岛民'}</Text>
           </View>
           
           <View style={styles.dataCard}>
             <Text style={styles.dataLabel}>资产状态</Text>
             <Text style={[styles.dataValue, nft.status === 'listed' ? {color: '#FF3B30'} : {color: '#4CD964'}]}>
                {nft.status === 'listed' ? `寄售中 (¥${nft.consign_price})` : '金库锁定'}
             </Text>
           </View>
        </View>
      </ScrollView>

      {nft.status === 'listed' && (
        <View style={styles.bottomBar}>
           <View>
              <Text style={{color: '#999', fontSize: 12}}>卖家开价</Text>
              <Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥{nft.consign_price}</Text>
           </View>
           <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} disabled={buying}>
              {buying ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buyText}>立即买入</Text>}
           </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  imgBox: { padding: 20, alignItems: 'center' },
  mainImg: { width: 300, height: 300, borderRadius: 20, borderWidth: 4, borderColor: '#FFF', shadowColor: '#D49A36', shadowOpacity: 0.2, shadowRadius: 20 },
  serialTag: { position: 'absolute', bottom: 10, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  serialText: { color: '#FFF', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  infoBox: { paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginBottom: 10 },
  desc: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 20 },
  dataCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  dataLabel: { fontSize: 14, color: '#888', fontWeight: '600' },
  dataValue: { fontSize: 16, color: '#4A2E1B', fontWeight: '900' },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05 },
  buyBtn: { backgroundColor: '#D49A36', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buyText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});