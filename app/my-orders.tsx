import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const TABS = ['寄售中', '求购中', '已买入', '已卖出'];

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 定制撤单弹窗
  const [cancelModal, setCancelModal] = useState<{visible: boolean, orderId: string, amount: number} | null>(null);
  const [processing, setProcessing] = useState(false);

  useFocusEffect(useCallback(() => { fetchDataByTab(activeTab); }, [activeTab]));

  const fetchDataByTab = async (tab: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (tab === '寄售中') {
        const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user.id).eq('status', 'listed').order('created_at', { ascending: false });
        setListData(data || []);
      } 
      else if (tab === '求购中') {
        // 🌟 新增：拉取求购大厅的数据
        const { data } = await supabase.from('buy_orders').select('*, collections(name, image_url)').eq('buyer_id', user.id).eq('status', 'active').order('created_at', { ascending: false });
        setListData(data || []);
      }
      else if (tab === '已买入') {
        const { data } = await supabase.from('transfer_logs').select('*, collections(name, image_url), seller:seller_id(nickname)').eq('buyer_id', user.id).order('transfer_time', { ascending: false });
        setListData(data || []);
      } 
      else if (tab === '已卖出') {
        const { data } = await supabase.from('transfer_logs').select('*, collections(name, image_url), buyer:buyer_id(nickname)').eq('seller_id', user.id).order('transfer_time', { ascending: false });
        setListData(data || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleCancelBuyOrder = async () => {
    if (!cancelModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. 废弃订单
      await supabase.from('buy_orders').update({ status: 'cancelled' }).eq('id', cancelModal.orderId);
      
      // 2. 解冻资金 (退回土豆币，材料卡不退)
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      await supabase.from('profiles').update({ potato_coin_balance: profile.potato_coin_balance + cancelModal.amount }).eq('id', user?.id);

      setCancelModal(null);
      fetchDataByTab('求购中'); // 刷新列表
    } catch (err) { console.error(err); } finally { setProcessing(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelling = activeTab === '寄售中';
    const isBuying = activeTab === '求购中';
    const isBought = activeTab === '已买入';
    
    const imgUrl = item.collections?.image_url || 'https://via.placeholder.com/150';
    const name = item.collections?.name || '未知藏品';
    const serial = (isSelling || isBuying) ? (item.serial_number || '排队中') : item.nft_id?.substring(0,6);
    const price = isSelling ? item.consign_price : item.price;
    const timeStr = isSelling || isBuying ? '有效挂单中...' : new Date(item.transfer_time).toLocaleString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
           <Text style={styles.timeText}>{timeStr}</Text>
           <Text style={[styles.statusText, isSelling || isBuying ? {color: '#FF3B30'} : {color: '#4CD964'}]}>
              {activeTab}
           </Text>
        </View>

        <View style={styles.cardBody}>
           <Image source={{ uri: imgUrl }} style={styles.img} />
           <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.serial}>{isBuying ? `求购数量: ${item.quantity}` : `#${serial}`}</Text>
           </View>
           <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{isSelling || isBuying ? '挂单价' : '成交价'}</Text>
              <Text style={styles.price}>¥ {price}</Text>
           </View>
        </View>

        {/* 🌟 求购专属操作栏 */}
        {isBuying && (
           <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => alert('请直接撤单并重新发布以实现加价竞拍')}>
                 <Text style={styles.actionBtnOutlineText}>加价竞拍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setCancelModal({visible: true, orderId: item.id, amount: item.price * item.quantity})}>
                 <Text style={styles.actionBtnText}>撤销解冻</Text>
              </TouchableOpacity>
           </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>订单管理</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
             <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={listData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={{fontSize: 40, marginBottom: 10}}>📭</Text><Text style={{color: '#999'}}>暂无{activeTab}数据</Text></View>}
        />
      )}

      {/* 🌟 撤销求购确认弹窗 */}
      <Modal visible={!!cancelModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>⚠️ 确认撤回求购</Text>
               <Text style={styles.confirmDesc}>撤单后，冻结的 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{cancelModal?.amount}</Text> 将立即退回您的钱包。注意：发布求购时消耗的 Potato卡 <Text style={{fontWeight:'900'}}>不会退还</Text>！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelModal(null)}>
                     <Text style={styles.cancelBtnText}>保持排队</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleCancelBuyOrder} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认撤销</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

// 样式（同上，省略多余部分）
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 8 },
  tabBtnActive: { backgroundColor: '#E6F0FF' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#0066FF', fontWeight: '900' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F9F9F9' },
  timeText: { fontSize: 12, color: '#999' },
  statusText: { fontSize: 12, fontWeight: '800' },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  img: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F0F0F0', marginRight: 12 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 4 },
  serial: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
  priceBox: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, color: '#999', marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '900', color: '#111' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: '#F0F0F0' },
  actionBtnOutline: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#0066FF', marginRight: 12 },
  actionBtnOutlineText: { color: '#0066FF', fontSize: 12, fontWeight: '800' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FF3B30' },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});