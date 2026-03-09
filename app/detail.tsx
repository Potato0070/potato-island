import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabase';

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

      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollectionData(colData);

      // 获取寄售盘
      const { data: sells } = await supabase
        .from('nfts')
        .select('*, seller:profiles!owner_id(username)')
        .eq('collection_id', id)
        .eq('status', 'listed') 
        .order('price', { ascending: true });
      setSellListings(sells || []);

      // 获取求购盘
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

  // 卖家主动砸盘（一键卖给最高求购者）
  const handleSellToBuyer = async (order: any) => {
    if (order.user_id === currentUser?.id) return Alert.alert('提示', '不能接自己的求购单哦！');

    const { data: availableNfts } = await supabase
      .from('nfts').select('id').eq('owner_id', currentUser.id).eq('collection_id', order.collection_id).eq('status', 'idle').limit(1);

    if (!availableNfts || availableNfts.length === 0) {
      return Alert.alert('库存不足', '您的金库中没有处于“闲置”状态的该藏品，无法砸盘出货。');
    }

    Alert.alert('⚡ 极速出货', `确认以 ¥${order.offer_price} 卖给 ${order.profiles?.username || '暗池买家'} 吗？\n\n一键成交，对方质押的门票将被永久销毁！`, [
      { text: '取消', style: 'cancel' },
      { text: '确认卖出', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('accept_buy_order_with_burn', { 
            p_order_id: order.id, p_seller_id: currentUser.id, p_nft_id: availableNfts[0].id 
          });
          if (error) Alert.alert('交易失败', error.message);
          else { Alert.alert('🎉 交易成功', '资金已入账，对方的门票已在宇宙中蒸发！'); fetchData(); }
      }}
    ]);
  };

  const isDelisted = sellListings.length === 0; // 是否断货退市

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroBox}>
         <View style={styles.imgWrapper}>
            <Image source={{ uri: collectionData?.image_url }} style={[styles.heroImg, isDelisted && styles.delistedImg]} />
            {/* 🚀 核心：断货时的“已退市”血红印章 */}
            {isDelisted && (
              <View style={styles.stamp}>
                <Text style={styles.stampText}>CLOSED</Text>
                <Text style={styles.stampSubText}>已退市</Text>
              </View>
            )}
         </View>
         <Text style={styles.title}>{collectionData?.name}</Text>
         
         {/* 🚀 核心：断货显示最高限价，有货显示地板价 */}
         {isDelisted ? (
            <View style={styles.priceBoxRed}>
               <Text style={styles.priceLabelRed}>官方退市价 (最高限价)</Text>
               <Text style={styles.priceValueRed}>¥{collectionData?.max_price || '---'}</Text>
            </View>
         ) : (
            <View style={styles.tagRow}>
              <Text style={styles.tagText}>发行 {collectionData?.total_minted || 0}份</Text>
              <Text style={styles.tagText}>流通 {collectionData?.circulating_supply || 0}份</Text>
            </View>
         )}
      </View>

      <View style={styles.tabBar}>
         <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('sell')}>
            <Text style={[styles.tabText, activeTab === 'sell' && styles.tabTextActiveSell]}>寄售盘 ({sellListings.length})</Text>
            {activeTab === 'sell' && <View style={[styles.activeLine, {backgroundColor: '#28A745'}]} />}
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('buy')}>
            <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActiveBuy]}>求购暗池 ({buyOrders.length})</Text>
            {activeTab === 'buy' && <View style={[styles.activeLine, {backgroundColor: '#FF3B30'}]} />}
         </TouchableOpacity>
      </View>

      <View style={styles.listHeader}>
         <Text style={styles.listHeaderText}>用户</Text>
         <View style={{flexDirection: 'row'}}>
            <Text style={styles.listHeaderText}>{activeTab === 'sell' ? '编号' : '状态'}</Text>
            <Text style={[styles.listHeaderText, {marginLeft: 30}]}>价格</Text>
         </View>
      </View>
    </View>
  );

  // 寄售盘：绿色高亮，秒杀
  const renderSellItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={() => router.push({ pathname: '/item-detail', params: { listingId: item.id } })}>
      <Text style={styles.rowUser} numberOfLines={1}>{item.seller?.username || '岛民'}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={styles.rowSerial}>#{item.serial_number}</Text>
        <Text style={[styles.rowPrice, {color: '#28A745'}]}>¥{item.price?.toFixed(2)}</Text>
        <View style={[styles.actionBtn, {backgroundColor: '#28A745'}]}><Text style={styles.actionBtnText}>秒杀</Text></View>
      </View>
    </TouchableOpacity>
  );

  // 求购盘：红色高亮，砸盘出货
  const renderBuyItem = ({ item }: { item: any }) => (
    <View style={styles.rowItem}>
      <Text style={styles.rowUser} numberOfLines={1}>{item.profiles?.username || '暗客'}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={styles.rowTag}>🔒已质押</Text>
        <Text style={[styles.rowPrice, {color: '#FF3B30'}]}>¥{item.offer_price?.toFixed(2)}</Text>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#111'}]} onPress={() => handleSellToBuyer(item)}>
          <Text style={styles.actionBtnText}>出货</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading || !collectionData) return <View style={styles.center}><ActivityIndicator color="#111" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>大盘博弈</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={activeTab === 'sell' ? sellListings : buyOrders}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={activeTab === 'sell' ? renderSellItem : renderBuyItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
             <Text style={styles.emptyTitle}>{activeTab === 'sell' ? '📉 货源已枯竭' : '📈 暂无暗池买家'}</Text>
             <Text style={styles.emptyDesc}>{activeTab === 'sell' ? '当前藏品无人寄售，已触发退市保护' : '成为第一个下注的人，狙击下方的抛盘'}</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        {activeTab === 'sell' ? (
          isDelisted ? (
            <View style={[styles.mainBtn, {backgroundColor: '#EEE'}]}><Text style={[styles.mainBtnText, {color:'#999'}]}>已断货，请去求购区碰运气</Text></View>
          ) : (
            <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#28A745'}]} onPress={() => Alert.alert('提示', '批量购买对接中')}><Text style={styles.mainBtnText}>批量扫货</Text></TouchableOpacity>
          )
        ) : (
          <TouchableOpacity style={[styles.mainBtn, {backgroundColor: '#FF3B30'}]} onPress={() => router.push({ pathname: '/create-buy-order', params: { collectionId: id } })}><Text style={styles.mainBtnText}>发起暗池求购</Text></TouchableOpacity>
        )}
      </View>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: '#FFF', zIndex: 10 },
  backBtn: { fontSize: 24, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '900' },
  headerContainer: { backgroundColor: '#FFF', paddingBottom: 10 },
  heroBox: { alignItems: 'center', paddingTop: 20 },
  imgWrapper: { position: 'relative', marginBottom: 16 },
  heroImg: { width: 140, height: 140, borderRadius: 20, borderWidth: 1, borderColor: '#EEE' },
  delistedImg: { opacity: 0.5, tintColor: 'gray' },
  stamp: { position: 'absolute', top: 30, left: -10, transform: [{ rotate: '-20deg' }], borderWidth: 4, borderColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  stampText: { color: '#FF3B30', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  stampSubText: { color: '#FF3B30', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 10 },
  tagRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, color: '#666', marginHorizontal: 6 },
  priceBoxRed: { backgroundColor: '#FFEBEE', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  priceLabelRed: { fontSize: 12, color: '#FF3B30', fontWeight: '800' },
  priceValueRed: { fontSize: 24, color: '#FF3B30', fontWeight: '900' },
  tabBar: { flexDirection: 'row', marginTop: 30, borderBottomWidth: 1, borderColor: '#EEE', paddingHorizontal: 20 },
  tabBtn: { marginRight: 30, paddingBottom: 10, position: 'relative' },
  tabText: { fontSize: 16, color: '#999', fontWeight: '600' },
  tabTextActiveSell: { color: '#28A745', fontWeight: '900' },
  tabTextActiveBuy: { color: '#FF3B30', fontWeight: '900' },
  activeLine: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, borderRadius: 2 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  listHeaderText: { fontSize: 12, color: '#999' },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE' },
  rowUser: { fontSize: 14, fontWeight: '700', color: '#333', flex: 1 },
  rowSerial: { fontSize: 12, color: '#999', width: 50, textAlign: 'right' },
  rowTag: { fontSize: 12, color: '#D49A36', width: 60, textAlign: 'right' },
  rowPrice: { fontSize: 18, fontWeight: '900', width: 80, textAlign: 'right' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 10 },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#111', marginTop: 10, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', padding: 16, paddingBottom: 34, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE', zIndex: 100 },
  mainBtn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
});