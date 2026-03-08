import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabase';
import BuyOrderModal from './components/BuyOrderModal';

export default function DetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell'); 
  
  const [sellListings, setSellListings] = useState<any[]>([]);
  const [buyOrders, setBuyOrders] = useState<any[]>([]);
  const [isBuyModalVisible, setBuyModalVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      // 1. 查藏品信息
      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollectionData(colData);

      // 2. 查全服寄售单
      const { data: sells } = await supabase
        .from('nfts')
        .select('*, seller:profiles!owner_id(username)')
        .eq('collection_id', id)
        .eq('status', 'listed')
        .order('price', { ascending: true });
      setSellListings(sells || []);

      // 3. 查全服求购单
      const { data: buys } = await supabase
        .from('buy_orders')
        .select('*, profiles(username)')
        .eq('collection_id', id)
        .eq('status', 'active')
        .order('offer_price', { ascending: false });
      setBuyOrders(buys || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // 卖家主动撮合逻辑
  const handleSellToBuyer = (order: any) => {
    Alert.alert('撮合成交', `确认以 ¥${order.offer_price} 卖给 ${order.profiles?.username} 吗？成交后对方质押的Potato卡将被销毁。`, [
      { text: '取消', style: 'cancel' },
      { text: '确认成交', onPress: async () => {
          // 这里需要调用 RPC 并传入卖家提供的一张对应 NFT 卡片 ID
          // 实际开发中应该先验证卖家金库里有没有这张卡
          Alert.alert('提示', '后端 RPC 销毁逻辑已就绪，正在对接金库检测...');
          // const { error } = await supabase.rpc('accept_buy_order_with_burn', { p_order_id: order.id, p_seller_id: currentUser.id, p_nft_id: '这里填入卖家的卡片ID' });
          // if (!error) fetchData();
      }}
    ]);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroBox}>
         <Image source={{ uri: collectionData?.image_url }} style={styles.heroImg} />
         <Text style={styles.title}>{collectionData?.name}</Text>
         <View style={styles.tagRow}>
            <Text style={styles.tagText}>发行 {collectionData?.total_minted}份</Text>
            <Text style={styles.tagText}>流通 {collectionData?.circulating_supply}份</Text>
         </View>
      </View>

      <View style={styles.tabBar}>
         <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('sell')}>
            <Text style={[styles.tabText, activeTab === 'sell' && styles.tabTextActive]}>寄售</Text>
            {activeTab === 'sell' && <View style={styles.activeLine} />}
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('buy')}>
            <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>求购</Text>
            {activeTab === 'buy' && <View style={styles.activeLine} />}
         </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
         <Text style={styles.listHeaderText}>用户</Text>
         <View style={{flexDirection: 'row'}}>
            <Text style={styles.listHeaderText}>{activeTab === 'sell' ? '编号 ↕' : '状态'}</Text>
            <Text style={[styles.listHeaderText, {marginLeft: 30}]}>价格 ↕</Text>
         </View>
      </View>
    </View>
  );

  const renderSellItem = ({ item }: { item: any }) => (
    <View style={styles.rowItem}>
      <Text style={styles.rowUser} numberOfLines={1}>{item.seller?.username || '岛民'}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={styles.rowSerial}>#{item.serial_number}</Text>
        <Text style={styles.rowPrice}>¥{item.price.toFixed(2)}</Text>
      </View>
    </View>
  );

  const renderBuyItem = ({ item }: { item: any }) => (
    <View style={styles.rowItem}>
      <Text style={styles.rowUser} numberOfLines={1}>{item.profiles?.username || '岛民'}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={styles.rowTag}>🔒已质押</Text>
        <View style={{ alignItems: 'flex-end', width: 80 }}>
          <Text style={[styles.rowPrice, {color: '#FF3B30'}]}>¥{item.offer_price.toFixed(2)}</Text>
          <TouchableOpacity style={styles.sellBtn} onPress={() => handleSellToBuyer(item)}>
            <Text style={styles.sellBtnText}>卖给TA</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading || !collectionData) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  const currentData = activeTab === 'sell' ? sellListings : buyOrders;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>藏品详情</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={currentData}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={activeTab === 'sell' ? renderSellItem : renderBuyItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
             <Text style={{fontSize: 40, color: '#0066FF', opacity: 0.5}}>📦</Text>
             <Text style={styles.emptyTitle}>暂无数据</Text>
             <Text style={styles.emptyDesc}>{activeTab === 'sell' ? '当前藏品无人寄售' : '当前藏品无人求购'}</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity 
           style={styles.mainBtn} 
           onPress={() => activeTab === 'sell' ? Alert.alert('提示', '批量购买功能开发中...') : setBuyModalVisible(true)}
        >
           <Text style={styles.mainBtnText}>{activeTab === 'sell' ? '批量购买' : '发起求购'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isBuyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setBuyModalVisible(false)} />
          <View style={styles.modalContent}>
             <BuyOrderModal currentUser={currentUser} collectionData={collectionData} onClose={() => setBuyModalVisible(false)} onRefresh={fetchData} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: '#FFF' },
  backBtn: { fontSize: 24, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800' },
  
  headerContainer: { backgroundColor: '#FFF', paddingBottom: 10 },
  heroBox: { alignItems: 'center', paddingTop: 20 },
  heroImg: { width: 140, height: 140, borderRadius: 20, borderWidth: 1, borderColor: '#EEE', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 10 },
  tagRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, color: '#666', marginHorizontal: 6 },

  tabBar: { flexDirection: 'row', marginTop: 30, borderBottomWidth: 1, borderColor: '#EEE', paddingHorizontal: 20 },
  tabBtn: { marginRight: 30, paddingBottom: 10, position: 'relative' },
  tabText: { fontSize: 16, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#0066FF', fontWeight: '900' },
  activeLine: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, backgroundColor: '#0066FF', borderRadius: 2 },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  listHeaderText: { fontSize: 12, color: '#999' },
  
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE' },
  rowUser: { fontSize: 14, fontWeight: '700', color: '#333', flex: 1 },
  rowSerial: { fontSize: 14, color: '#666', width: 60, textAlign: 'right' },
  rowTag: { fontSize: 12, color: '#D49A36', width: 60, textAlign: 'right' },
  rowPrice: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'right' },
  sellBtn: { backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  sellBtnText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginTop: 10, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: '#999' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', padding: 16, paddingBottom: 34, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE' },
  mainBtn: { backgroundColor: '#0066FF', height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
});