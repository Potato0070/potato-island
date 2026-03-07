import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [loading, setLoading] = useState(true);
  const [sellOrders, setSellOrders] = useState<any[]>([]);
  const [buyOrders, setBuyOrders] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.back();

      // 1. 获取寄售单
      const { data: sells } = await supabase
        .from('nfts')
        .select('*, collection:collection_id(*)')
        .eq('owner_id', session.user.id)
        .in('status', ['listed', 'consigning']);
      setSellOrders(sells || []);

      // 2. 获取求购单 (带上冻结卡片信息)
      const { data: buys } = await supabase
        .from('buy_orders')
        .select('*, collection:collection_id(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'active');
      setBuyOrders(buys || []);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleCancelBuy = (orderId: string) => {
    Alert.alert('确认撤销', '撤销后将返还冻结的 ¥ 和 Potato卡，是否继续？', [
      { text: '再想想', style: 'cancel' },
      { text: '确认撤销', style: 'destructive', onPress: async () => {
          setLoading(true);
          const { error } = await supabase.rpc('cancel_buy_order_and_refund', { p_order_id: orderId });
          if (error) Alert.alert('错误', error.message);
          fetchData();
      }}
    ]);
  };

  const renderBuyItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <Image source={{ uri: item.collection?.image_url }} style={styles.orderImg} />
      <View style={styles.orderInfo}>
         <Text style={styles.orderName}>{item.collection?.name}</Text>
         <View style={styles.freezeBadge}>
            <Text style={styles.freezeBadgeText}>🔒 已冻结 1 张 Potato卡</Text>
         </View>
         <Text style={styles.orderPrice}>求购价: ¥{item.offer_price}</Text>
      </View>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelBuy(item.id)}>
         <Text style={styles.cancelBtnText}>撤销</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>〈</Text></TouchableOpacity>
        <Text style={styles.title}>我的交易指令台</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'sell' && styles.tabActive]} onPress={() => setActiveTab('sell')}>
           <Text style={[styles.tabText, activeTab === 'sell' && styles.tabTextActive]}>正在寄售</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'buy' && styles.tabActive]} onPress={() => setActiveTab('buy')}>
           <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>正在求购</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>
      ) : (
        <FlatList
           data={activeTab === 'sell' ? sellOrders : buyOrders}
           keyExtractor={(item) => item.id}
           renderItem={activeTab === 'sell' ? null : renderBuyItem} // 寄售列表样式可复用之前的
           contentContainerStyle={{ padding: 16 }}
           ListEmptyComponent={<Text style={styles.emptyText}>暂无活跃订单</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  backBtn: { fontSize: 24, fontWeight: 'bold' },
  title: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderColor: '#D49A36' },
  tabText: { color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#D49A36', fontWeight: '900' },
  orderCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 15, alignItems: 'center', elevation: 2 },
  orderImg: { width: 60, height: 60, borderRadius: 10 },
  orderInfo: { flex: 1, marginLeft: 15 },
  orderName: { fontSize: 15, fontWeight: '800', color: '#4A2E1B' },
  freezeBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  freezeBadgeText: { fontSize: 10, color: '#888', fontWeight: '700' },
  orderPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30', marginTop: 5 },
  cancelBtn: { backgroundColor: '#FFEBEE', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  cancelBtnText: { color: '#FF3B30', fontWeight: '800', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#CCC', fontWeight: '600' }
});