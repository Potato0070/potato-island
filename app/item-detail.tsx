import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams();

  const [nft, setNft] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (listingId) fetchNftDetail();
  }, [listingId]);

  const fetchNftDetail = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      const { data, error } = await supabase
        .from('nfts')
        .select('*, collections(name, image_url), seller:profiles!owner_id(username)')
        .eq('id', listingId)
        .single();
        
      if (error) throw error;
      setNft(data);
    } catch (err: any) {
      Alert.alert('获取失败', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!currentUser) return Alert.alert('请先登录');
    if (nft.owner_id === currentUser.id) return Alert.alert('提示', '不能购买自己的藏品哦');

    Alert.alert('确认购买', `即将支付 ¥${nft.price.toFixed(2)} 购买 #${nft.serial_number}，确认支付？`, [
      { text: '取消', style: 'cancel' },
      { text: '确认支付', style: 'destructive', onPress: executePurchase }
    ]);
  };

  const executePurchase = async () => {
    setBuying(true);
    try {
      // 🔥 核心调用：执行原子购买合约，钱货两清
      const { error } = await supabase.rpc('execute_nft_purchase', {
        p_nft_id: nft.id,
        p_buyer_id: currentUser.id
      });

      if (error) throw error;

      Alert.alert('🎉 购买成功！', '资产已放入您的金库', [
        { text: '去金库查看', onPress: () => router.replace('/(tabs)/profile') }
      ]);
    } catch (err: any) {
      Alert.alert('交易失败', err.message);
    } finally {
      setBuying(false);
    }
  };

  if (loading || !nft) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding: 10}}><Text style={{fontSize: 24, color: '#333'}}>〈</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>单品详情</Text>
        <View style={{width: 44}} />
      </View>

      <View style={styles.content}>
        <Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} />
        
        <View style={styles.infoCard}>
           <Text style={styles.colName}>{nft.collections?.name}</Text>
           <View style={styles.serialBadge}>
              <Text style={styles.serialText}>唯一编号: #{nft.serial_number}</Text>
           </View>
           
           <View style={styles.divider} />
           
           <View style={styles.row}>
              <Text style={styles.label}>卖家</Text>
              <Text style={styles.value}>{nft.seller?.username || '神秘岛民'}</Text>
           </View>
           <View style={styles.row}>
              <Text style={styles.label}>当前状态</Text>
              <Text style={styles.value}>{nft.status === 'listed' ? '寄售中' : '不可交易'}</Text>
           </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.priceLabel}>一口价</Text>
          <Text style={styles.priceValue}>¥{nft.price?.toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.buyBtn, nft.status !== 'listed' && {backgroundColor: '#CCC'}]} 
          onPress={handleBuyNow}
          disabled={nft.status !== 'listed' || buying}
        >
          {buying ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buyBtnText}>立即购买</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  content: { padding: 20 },
  mainImg: { width: width - 40, height: width - 40, borderRadius: 20, backgroundColor: '#EEE', marginBottom: 20 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  colName: { fontSize: 24, fontWeight: '900', color: '#111', marginBottom: 10 },
  serialBadge: { alignSelf: 'flex-start', backgroundColor: '#F0F8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 20 },
  serialText: { color: '#0066FF', fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#EEE', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#999' },
  value: { fontSize: 14, color: '#333', fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 35, borderTopWidth: 1, borderColor: '#EEE' },
  priceLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  priceValue: { fontSize: 24, fontWeight: '900', color: '#FF3B30' },
  buyBtn: { backgroundColor: '#111', width: 140, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});