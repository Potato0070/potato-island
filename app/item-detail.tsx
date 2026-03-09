import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    // 1. 获取核心资产数据
    const { data: nftData } = await supabase.from('nfts')
      .select('*, collections(*), profiles(nickname)')
      .eq('id', id).single();
    setNft(nftData);

    // 2. 获取该单品的流转账本
    const { data: historyData } = await supabase.from('transfer_logs')
      .select('*, buyer:buyer_id(nickname)')
      .eq('nft_id', id)
      .order('transfer_time', { ascending: false });
    setHistory(historyData || []);
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

  const hashString = nft.id.replace(/-/g, '').toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>藏品详情</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* 🌟 悬浮 3D 展台设计 */}
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}>
              <Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} />
           </View>
           <View style={styles.shadowOval} />
           <Text style={styles.stageColName}>{nft.collections?.name}</Text>
           <Text style={styles.stageSupply}>发行 {nft.collections?.total_minted} | 流通 {nft.collections?.circulating_supply}</Text>
        </View>

        {/* 🌟 核心信息面板 */}
        <View style={styles.infoSection}>
           <Text style={styles.sectionTitle}>藏品信息</Text>
           
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>当前编号</Text>
              <Text style={styles.infoValueHigh}>#{String(nft.serial_number).padStart(6, '0')} <Text style={{color:'#CCC', fontSize: 12}}>/ {nft.collections?.total_minted}</Text></Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>发行社区</Text>
              <Text style={styles.infoValue}>土豆王国</Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>创作者</Text>
              <Text style={styles.infoValue}>自由岛主</Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>交易哈希</Text>
              <Text style={styles.infoHash} numberOfLines={1}>{hashString.substring(0, 10)}...{hashString.substring(hashString.length - 10)}</Text>
           </View>
        </View>

        {/* 🌟 流转记录账本 */}
        <View style={styles.historySection}>
           <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>流转记录</Text>
              <View style={styles.historyTab}><Text style={styles.historyTabText}>当前编号 ⇌</Text></View>
           </View>

           {history.length === 0 ? (
             <Text style={{textAlign: 'center', color: '#999', paddingVertical: 20}}>暂无流转记录</Text>
           ) : (
             history.map((log, index) => (
                <View key={log.id} style={styles.historyRow}>
                   <View>
                      <Text style={styles.historyUser}>{log.buyer?.nickname || '神秘岛民'}</Text>
                      <Text style={styles.historyTime}>{new Date(log.transfer_time).toLocaleString()}</Text>
                   </View>
                   <Text style={styles.historyPrice}>买入 ¥ {log.price}</Text>
                </View>
             ))
           )}
        </View>
      </ScrollView>

      {/* 底部购买栏 */}
      {nft.status === 'listed' && (
        <View style={styles.bottomBar}>
           <View>
              <Text style={{color: '#999', fontSize: 12}}>当前寄售价格</Text>
              <Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {nft.consign_price}</Text>
           </View>
           <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} disabled={buying}>
              {buying ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buyText}>立即付款</Text>}
           </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 16, fontWeight: '800', color: '#111' },

  stageContainer: { alignItems: 'center', backgroundColor: '#F0F0F5', paddingVertical: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  floatBox: { padding: 10, backgroundColor: '#FFF', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: {width: 0, height: 10}, elevation: 10, zIndex: 2 },
  mainImg: { width: width * 0.5, height: width * 0.5, borderRadius: 8, resizeMode: 'cover' },
  shadowOval: { width: width * 0.4, height: 20, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '50%', marginTop: 20, marginBottom: 20 },
  stageColName: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 4 },
  stageSupply: { fontSize: 12, color: '#888' },

  infoSection: { backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '600' },
  infoValueHigh: { fontSize: 16, color: '#FF3B30', fontWeight: '900', fontFamily: 'monospace' },
  infoHash: { fontSize: 12, color: '#888', fontFamily: 'monospace', width: 150, textAlign: 'right' },

  historySection: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 20 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyTab: { backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  historyTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  historyUser: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4 },
  historyTime: { fontSize: 11, color: '#999' },
  historyPrice: { fontSize: 14, fontWeight: '900', color: '#111' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05, elevation: 10 },
  buyBtn: { backgroundColor: '#FF5722', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 },
  buyText: { color: '#FFF', fontSize: 16, fontWeight: '900' }
});