import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../supabase';
import BuyOrderModal from './components/BuyOrderModal';

export default function DetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [isBuyModalVisible, setBuyModalVisible] = useState(false);
  const [buyOrders, setBuyOrders] = useState<any[]>([]);

  const fetchDetailData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      // 1. 获取藏品信息
      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();

      // 2. 获取当前地板价
      const { data: floorData } = await supabase
        .from('nfts')
        .select('price')
        .eq('collection_id', id)
        .eq('status', 'listed')
        .order('price', { ascending: true })
        .limit(1);

      // 3. 获取全服求购单 (用于撮合)
      const { data: activeBuys } = await supabase
        .from('buy_orders')
        .select('*, profiles(username, avatar_url)')
        .eq('collection_id', id)
        .eq('status', 'active')
        .order('offer_price', { ascending: false });

      setCollectionData({
        ...colData,
        floor_price: floorData?.[0]?.price || null,
        max_price: colData.max_price || 999
      });
      setBuyOrders(activeBuys || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDetailData(); }, [fetchDetailData]));

  // 核心：卖家主动撮合逻辑
  const handleSellToBuyer = (order: any) => {
    Alert.alert('撮合成交', `确认以 ¥${order.offer_price} 卖给 ${order.profiles?.username} 吗？成交后对方质押的Potato卡将被销毁。`, [
      { text: '取消', style: 'cancel' },
      { text: '确认成交', onPress: async () => {
          // 这里调用后端存储过程 accept_buy_order_with_burn
          const { error } = await supabase.rpc('accept_buy_order_with_burn', {
            p_order_id: order.id,
            p_seller_id: currentUser.id
          });
          if (error) return Alert.alert('交易失败', error.message);
          Alert.alert('交易成功', '资金已入账，对方材料已销毁！');
          fetchDetailData();
      }}
    ]);
  };

  if (loading || !collectionData) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>资产看板</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Image source={{ uri: collectionData.image_url }} style={styles.mainImg} />
        
        <View style={styles.infoContent}>
          <Text style={styles.title}>{collectionData.name}</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>市场地板</Text>
              <Text style={styles.priceValue}>{collectionData.floor_price ? `¥${collectionData.floor_price}` : '暂无'}</Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>最高限价</Text>
              <Text style={styles.priceValue}>¥{collectionData.max_price}</Text>
            </View>
          </View>

          {/* 求购列表墙 */}
          <Text style={styles.sectionTitle}>全服求购指令</Text>
          {buyOrders.length > 0 ? buyOrders.map(order => (
            <View key={order.id} style={styles.orderItem}>
              <Image source={{ uri: order.profiles?.avatar_url }} style={styles.userAvt} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.userName}>{order.profiles?.username}</Text>
                <Text style={styles.orderTag}>🔥 质押 Potato卡 待销毁</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.offerPrice}>¥{order.offer_price}</Text>
                <TouchableOpacity 
                  style={styles.sellBtn} 
                  onPress={() => handleSellToBuyer(order)}
                >
                  <Text style={styles.sellBtnText}>卖给TA</Text>
                </TouchableOpacity>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>当前暂无求购指令</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.mainBuyBtn} onPress={() => setBuyModalVisible(true)}>
          <Text style={styles.mainBuyBtnText}>发布求购 (消耗材料)</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isBuyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setBuyModalVisible(false)} />
          <View style={styles.modalContent}>
            <BuyOrderModal 
              currentUser={currentUser} 
              collectionData={collectionData} 
              onClose={() => setBuyModalVisible(false)}
              onRefresh={fetchDetailData}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  mainImg: { width: '100%', aspectRatio: 1, backgroundColor: '#F8F8F8' },
  infoContent: { padding: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#111', marginBottom: 20 },
  priceRow: { flexDirection: 'row', backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16, marginBottom: 24 },
  priceItem: { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  priceValue: { fontSize: 18, fontWeight: '900', color: '#333' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  orderItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  userAvt: { width: 40, height: 40, borderRadius: 20 },
  userName: { fontSize: 14, fontWeight: '700' },
  orderTag: { fontSize: 10, color: '#D49A36', marginTop: 2 },
  offerPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  sellBtn: { backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginTop: 4 },
  sellBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingBottom: 35, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE' },
  mainBuyBtn: { backgroundColor: '#111', height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  mainBuyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
  emptyText: { color: '#CCC', textAlign: 'center', marginTop: 20 }
});