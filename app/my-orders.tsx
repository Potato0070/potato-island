import { Ionicons } from '@expo/vector-icons';
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
      
      // 2. 获取求购单 (带上质押卡信息)
      const { data: buys } = await supabase
        .from('buy_orders')
        .select('*, collection:collection_id(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'active');

      setSellOrders(sells || []);
      setBuyOrders(buys || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleCancelBuy = (orderId: string) => {
    Alert.alert('确认撤销', '撤销后系统将退回预付资金及质押的 Potato卡。', [
      { text: '再想想', style: 'cancel' },
      { text: '确认撤销', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('cancel_buy_order_and_refund', { p_order_id: orderId });
          if (error) return Alert.alert('错误', error.message);
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
          <Ionicons name="lock-closed" size={10} color="#8B5A2B" />
          <Text style={styles.freezeBadgeText}> 质押材料: Potato卡 (成交即销毁)</Text>
        </View>
        <Text style={styles.orderPrice}>求购价: ¥{item.offer_price}</Text>
      </View>
      <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelBuy(item.id)}>
        <Text style={styles.cancelBtnText}>撤单</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSellItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <Image source={{ uri: item.collection?.image_url }} style={styles.orderImg} />
      <View style={styles.orderInfo}>
        <Text style={styles.orderName}>{item.collection?.name}</Text>
        <Text style={styles.serialNo}>编号: #{item.serial_number}</Text>
        <Text style={styles.orderPrice}>售价: ¥{item.price}</Text>
      </View>
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{item.status === 'listed' ? '寄售中' : '审核中'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.title}>交易指令台</Text>
        <View style={{ width: 24 }} />
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
        <ActivityIndicator style={{ marginTop: 50 }} color="#111" />
      ) : (
        <FlatList
          data={activeTab === 'sell' ? sellOrders : buyOrders}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'sell' ? renderSellItem : renderBuyItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>暂无活跃指令</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: '#111' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderColor: '#111' },
  tabText: { color: '#999', fontWeight: '700' },
  tabTextActive: { color: '#111', fontWeight: '900' },
  orderCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center' },
  orderImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F5F5F5' },
  orderInfo: { flex: 1, marginLeft: 15 },
  orderName: { fontSize: 15, fontWeight: '800', color: '#111' },
  serialNo: { fontSize: 12, color: '#999', marginTop: 2 },
  freezeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF6EC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
  freezeBadgeText: { fontSize: 10, color: '#8B5A2B', fontWeight: '700' },
  orderPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30', marginTop: 4 },
  cancelBtn: { backgroundColor: '#FDECEC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  cancelBtnText: { color: '#FF3B30', fontWeight: '800', fontSize: 12 },
  statusBox: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F0F0F0' },
  statusText: { fontSize: 12, color: '#666', fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#CCC', fontWeight: '700' }
});