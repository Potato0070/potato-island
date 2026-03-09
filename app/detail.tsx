import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// ✅ 核心修复：确保 SafeAreaView 是从这个库引入的，支持 edges 属性
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function DetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell'); 
  
  const [sellListings, setSellListings] = useState<any[]>([]);
  const [buyOrders, setBuyOrders] = useState<any[]>([]);

  // 🎯 核心逻辑：拉取大盘实时数据
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      // 1. 获取藏品主档
      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollectionData(colData);

      // 2. 获取寄售盘 (挂在市场上的单子)
      const { data: sells } = await supabase
        .from('nfts')
        .select('id, serial_number, price, owner_id, profiles!owner_id(username)')
        .eq('collection_id', id)
        .eq('status', 'listed')
        .order('price', { ascending: true }); 
      setSellListings(sells || []);

      // 3. 获取狙击盘 (暗池求购单)
      const { data: buys } = await supabase
        .from('buy_orders')
        .select('*, buyer:profiles!user_id(username)')
        .eq('collection_id', id)
        .eq('status', 'active')
        .order('price', { ascending: false }); 
      setBuyOrders(buys || []);

    } catch (err: any) {
      console.error('Fetch Detail Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // 🎯 核心逻辑：一键砸盘 (对标一岛丝滑体验)
  const handleFlashSell = async (order: any) => {
    if (!currentUser) return router.push('/login');

    try {
      // 1. 自动寻货：找出用户手里该系列编号最靠后的一张卡 (自动装填弹药)
      const { data: myNft } = await supabase
        .from('nfts')
        .select('id, serial_number')
        .eq('owner_id', currentUser.id)
        .eq('collection_id', collectionData.id)
        .eq('status', 'idle') 
        .order('serial_number', { ascending: false })
        .limit(1)
        .single();

      if (!myNft) {
        return Alert.alert('货源不足', '你的仓库里没有该系列的闲置资产可以出货。');
      }

      // 2. 签署砸盘确认
      Alert.alert(
        '⚡ 确认一键砸盘？',
        `将编号 #${myNft.serial_number} 的资产以 ¥${order.price} 的价格瞬间卖给狙击手？`,
        [
          { text: '撤回', style: 'cancel' },
          { 
            text: '立即出货', 
            style: 'destructive', 
            onPress: async () => {
              // 调用后端原子交易 v3 存储过程
              const { error } = await supabase.rpc('execute_match_trade_v3', {
                p_buy_order_id: order.id,
                p_seller_id: currentUser.id,
                p_nft_id: myNft.id
              });
              if (error) throw error;
              Alert.alert('✅ 砸盘成功', '资金已打入钱包，门票已被系统销毁。');
              fetchData();
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('砸盘失败', err.message);
    }
  };

  const renderSellItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.orderRow}
      onPress={() => router.push({ pathname: '/item-detail', params: { listingId: item.id } })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowUser}>{item.profiles?.username || '岛民'}</Text>
        <Text style={styles.rowSerial}>编号 #{item.serial_number}</Text>
      </View>
      <Text style={styles.rowPrice}>¥{item.price}</Text>
      <TouchableOpacity 
        style={[styles.miniBtn, { backgroundColor: '#007AFF' }]}
        onPress={() => router.push({ pathname: '/item-detail', params: { listingId: item.id } })}
      >
        <Text style={styles.miniBtnText}>买入</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderBuyItem = ({ item }: { item: any }) => (
    <View style={styles.orderRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowUser}>{item.buyer?.username || '大户狙击'}</Text>
        <Text style={styles.rowSerial}>求购数量: {item.quantity || 1}</Text>
      </View>
      <Text style={[styles.rowPrice, { color: '#FF3B30' }]}>¥{item.price}</Text>
      <TouchableOpacity 
        style={[styles.miniBtn, { backgroundColor: '#111' }]}
        onPress={() => handleFlashSell(item)}
      >
        <Text style={styles.miniBtnText}>一键砸盘</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading || !collectionData) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF3B30" /></View>;
  }

  const isDelisted = !collectionData.is_tradeable; // 是否触发退市锁死

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 1. 顶部视觉大图区 */}
      <View style={styles.header}>
        <Image source={{ uri: collectionData.image_url }} style={styles.headerImg} />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>〈</Text>
        </TouchableOpacity>
        
        {/* 🔥 退市死亡遮罩 */}
        {isDelisted && (
          <View style={styles.delistedOverlay}>
            <Text style={styles.delistedStamp}>已退市</Text>
            <View style={styles.delistedBadge}><Text style={styles.delistedBadgeText}>OFFICIAL DELISTED</Text></View>
          </View>
        )}
      </View>

      {/* 2. 数据看板 */}
      <View style={styles.infoSection}>
        <View style={styles.titleRow}>
          <Text style={styles.colName}>{collectionData.name}</Text>
          <View style={styles.tag}><Text style={styles.tagText}>土豆岛特供</Text></View>
        </View>
        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>地板价</Text>
            <Text style={styles.dataValue}>¥{collectionData.floor_price || '---'}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>流通量</Text>
            <Text style={styles.dataValue}>{collectionData.supply || 0}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>已销毁</Text>
            <Text style={styles.dataValue}>{collectionData.burned_count || 0}</Text>
          </View>
        </View>
      </View>

      {/* 3. 盘口切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sell' && styles.tabActive]} 
          onPress={() => setActiveTab('sell')}
        >
          <Text style={[styles.tabText, activeTab === 'sell' && styles.tabTextActive]}>寄售盘 ({sellListings.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'buy' && styles.tabActive]} 
          onPress={() => setActiveTab('buy')}
        >
          <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>狙击盘 ({buyOrders.length})</Text>
        </TouchableOpacity>
      </View>

      {/* 4. 列表展示 */}
      <FlatList
        data={activeTab === 'sell' ? sellListings : buyOrders}
        renderItem={activeTab === 'sell' ? renderSellItem : renderBuyItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>当前{activeTab === 'sell' ? '寄售' : '暗池'}空空如也</Text>
          </View>
        }
      />

      {/* 5. 底部固定按钮区 */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.footerBtn, { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#DDD' }]}
          onPress={() => router.push({ pathname: '/consign', params: { collectionId: id } })}
        >
          <Text style={[styles.footerBtnText, { color: '#333' }]}>上架寄售</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.footerBtn, { backgroundColor: '#FF3B30' }]}
          onPress={() => router.push({ pathname: '/create-buy-order', params: { collectionId: id } })}
        >
          <Text style={styles.footerBtnText}>下达狙击</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { width: '100%', height: width, backgroundColor: '#000' },
  headerImg: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 20, fontWeight: '300' },
  delistedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  delistedStamp: { color: '#FFF', fontSize: 40, fontWeight: '900', transform: [{ rotate: '-15deg' }], borderWidth: 4, borderColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, letterSpacing: 8 },
  delistedBadge: { marginTop: 20, backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  delistedBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  infoSection: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  colName: { fontSize: 24, fontWeight: '900', color: '#111', marginRight: 10 },
  tag: { backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, color: '#666', fontWeight: '800' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12 },
  dataItem: { alignItems: 'center' },
  dataLabel: { fontSize: 11, color: '#999', marginBottom: 4, fontWeight: '600' },
  dataValue: { fontSize: 16, fontWeight: '900', color: '#111' },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  tab: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderColor: '#FF3B30' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '700' },
  tabTextActive: { color: '#111', fontWeight: '900' },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  rowUser: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 2 },
  rowSerial: { fontSize: 12, color: '#999', fontWeight: '600' },
  rowPrice: { fontSize: 20, fontWeight: '900', color: '#111', marginRight: 15 },
  miniBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  miniBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { color: '#CCC', fontSize: 14, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, width: '100%', height: 90, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  footerBtn: { flex: 0.48, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  footerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});