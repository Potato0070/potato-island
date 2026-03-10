import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const TABS = ['寄售中', '求购中', '竞价中', '已买入', '已卖出'];

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [cancelModal, setCancelModal] = useState<{visible: boolean, orderId: string, amount: number} | null>(null);
  const [addPriceModal, setAddPriceModal] = useState<{visible: boolean, order: any} | null>(null);
  const [cancelSaleModal, setCancelSaleModal] = useState<{visible: boolean, nftId: string} | null>(null);
  
  const [newPrice, setNewPrice] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useFocusEffect(useCallback(() => { fetchDataByTab(activeTab); }, [activeTab]));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchDataByTab = async (tab: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (tab === '寄售中') {
        const { data, error } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user.id).eq('status', 'listed').order('created_at', { ascending: false });
        if(error) throw error;
        setListData(data || []);
      } 
      else if (tab === '求购中') {
        const { data, error } = await supabase.from('buy_orders').select('*, collections(name, image_url)').eq('buyer_id', user.id).eq('status', 'active').neq('order_type', 'bid').order('created_at', { ascending: false });
        if(error) throw error;
        setListData(data || []);
      }
      else if (tab === '竞价中') {
        const { data, error } = await supabase.from('buy_orders').select('*, collections(name, image_url)').eq('buyer_id', user.id).eq('status', 'active').eq('order_type', 'bid').order('created_at', { ascending: false });
        if(error) throw error;
        setListData(data || []);
      }
      else if (tab === '已买入') {
        const { data, error } = await supabase.from('transfer_logs').select('*, collections(name, image_url)').eq('buyer_id', user.id).order('transfer_time', { ascending: false });
        if(error) throw error;
        setListData(data || []);
      } 
      else if (tab === '已卖出') {
        const { data, error } = await supabase.from('transfer_logs').select('*, collections(name, image_url)').eq('seller_id', user.id).order('transfer_time', { ascending: false });
        if(error) throw error;
        setListData(data || []);
      }
    } catch (err: any) { 
       // 🌟 透视眼：抓取所有数据结构报错
       Alert.alert("订单数据读取报错", err.message || JSON.stringify(err)); 
       console.error(err); 
    } finally { setLoading(false); }
  };

  const handleCancelBuyOrder = async () => {
    if (!cancelModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('buy_orders').update({ status: 'cancelled' }).eq('id', cancelModal.orderId);
      
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      await supabase.from('profiles').update({ potato_coin_balance: (profile?.potato_coin_balance || 0) + cancelModal.amount }).eq('id', user?.id);

      setCancelModal(null);
      showToast('✅ 撤销成功，资金已退回钱包');
      fetchDataByTab(activeTab); 
    } catch (err: any) { Alert.alert('撤回失败', err.message); } finally { setProcessing(false); }
  };

  const handleCancelSale = async () => {
    if (!cancelSaleModal) return;
    setProcessing(true);
    try {
      await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', cancelSaleModal.nftId);
      setCancelSaleModal(null);
      showToast('✅ 寄售已取消，藏品已退回金库锁定');
      fetchDataByTab('寄售中'); 
    } catch (err: any) { 
      Alert.alert('取消寄售失败', err.message); 
    } finally { 
      setProcessing(false); 
    }
  };

  const handleIncreasePrice = async () => {
    if (!addPriceModal) return;
    const order = addPriceModal.order;
    const p = parseFloat(newPrice);
    
    if (isNaN(p) || p <= order.price) return showToast(`加价必须高于当前出价 ¥${order.price}`);
    
    setProcessing(true);
    try {
      const diffAmount = (p - order.price) * order.quantity; 
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      
      if ((profile?.potato_coin_balance || 0) < diffAmount) throw new Error('钱包余额不足以支付加价差额！');

      await supabase.from('profiles').update({ potato_coin_balance: (profile?.potato_coin_balance || 0) - diffAmount }).eq('id', user?.id);
      await supabase.from('buy_orders').update({ price: p, created_at: new Date().toISOString() }).eq('id', order.id);

      setAddPriceModal(null);
      setNewPrice('');
      showToast(`✅ 加价成功！成功抢占高位`);
      fetchDataByTab(activeTab);
    } catch (err: any) { Alert.alert('加价失败', err.message); } finally { setProcessing(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelling = activeTab === '寄售中';
    const isBuying = activeTab === '求购中' || activeTab === '竞价中'; 
    const isHistory = activeTab === '已买入' || activeTab === '已卖出';
    
    const colName = Array.isArray(item.collections) ? item.collections[0]?.name : item.collections?.name;
    const colImg = Array.isArray(item.collections) ? item.collections[0]?.image_url : item.collections?.image_url;
    
    const imgUrl = colImg || 'https://via.placeholder.com/150';
    const name = colName || '神秘藏品';
    const serial = (isSelling || isBuying) ? (item.serial_number || '排队中') : item.nft_id?.substring(0,6);
    const price = isSelling ? item.consign_price : item.price;
    const timeStr = isSelling || isBuying ? '有效挂单中...' : new Date(item.transfer_time || item.created_at).toLocaleString();

    let typeTag = activeTab;
    let typeColor = '#111';
    if (isHistory) {
       switch(item.transfer_type) {
          case 'launch_mint': typeTag = '首发抢购'; typeColor = '#FFD700'; break;
          case 'direct_buy': typeTag = '大盘现货'; typeColor = '#0066FF'; break;
          case 'bid_match': typeTag = '委托撮合'; typeColor = '#FF3B30'; break;
          case '好友转赠': typeTag = '好友转赠'; typeColor = '#4CD964'; break;
          default: typeTag = '交易流转'; typeColor = '#888';
       }
    } else {
       typeColor = isSelling || isBuying ? '#FF3B30' : '#4CD964';
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
           <Text style={styles.timeText}>{timeStr}</Text>
           <Text style={[styles.statusText, {color: typeColor}]}>{typeTag}</Text>
        </View>

        <View style={styles.cardBody}>
           <Image source={{ uri: imgUrl }} style={styles.img} />
           <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.serial}>{isBuying ? `${activeTab === '竞价中' ? '竞价' : '求购'}数量: ${item.quantity}` : (isHistory && item.transfer_type === 'launch_mint' ? '首发铸造' : `#${serial}`)}</Text>
           </View>
           <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{isSelling || isBuying ? (isSelling ? '一口价' : '当前出价') : (item.transfer_type === '好友转赠' ? '消耗转赠卡' : '成交价')}</Text>
              <Text style={styles.price}>{item.transfer_type === '好友转赠' ? '1 张' : `¥ ${price || 0}`}</Text>
           </View>
        </View>

        {isSelling && (
           <View style={styles.cardFooter}>
              <TouchableOpacity style={[styles.actionBtnOutline, {borderColor: '#888'}]} onPress={() => setCancelSaleModal({visible: true, nftId: item.id})}>
                 <Text style={[styles.actionBtnOutlineText, {color: '#888'}]}>取消寄售</Text>
              </TouchableOpacity>
           </View>
        )}

        {isBuying && (
           <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setAddPriceModal({visible: true, order: item})}>
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

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.tabsWrapper}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
           {TABS.map(tab => (
             <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
             </TouchableOpacity>
           ))}
         </ScrollView>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={listData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.emptyBox}><Text style={{fontSize: 40, marginBottom: 10}}>📭</Text><Text style={{color: '#999'}}>暂无{activeTab}数据</Text></View>}
        />
      )}

      {/* 取消寄售悬浮窗 */}
      <Modal visible={!!cancelSaleModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📦 取消寄售</Text>
               <Text style={styles.confirmDesc}>确定要将该藏品从大盘中撤下吗？撤下后藏品将重新在您的金库中被锁定。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelSaleModal(null)}><Text style={styles.cancelBtnText}>再挂一会</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#333'}]} onPress={handleCancelSale} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认撤回</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 加价竞拍悬浮窗 */}
      <Modal visible={!!addPriceModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📈 加价竞拍</Text>
               <Text style={styles.confirmDesc}>当前出价: <Text style={{fontWeight:'900'}}>¥{addPriceModal?.order?.price}</Text> (需求 {addPriceModal?.order?.quantity} 件)</Text>
               <TextInput 
                  style={styles.inputField} 
                  placeholder="请输入新的单件出价" 
                  keyboardType="decimal-pad" 
                  value={newPrice} 
                  onChangeText={setNewPrice} 
                  textAlign="center"
               />
               <Text style={{fontSize: 12, color: '#FF3B30', marginBottom: 20}}>* 加价将从钱包中实时冻结扣除差额资金</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => {setAddPriceModal(null); setNewPrice('');}}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0066FF'}]} onPress={handleIncreasePrice} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认加价</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 撤销求购悬浮窗 */}
      <Modal visible={!!cancelModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>⚠️ 确认撤回订单</Text>
               <Text style={styles.confirmDesc}>撤单后，冻结的 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{cancelModal?.amount}</Text> 将立即退回钱包。消耗的 Potato卡 <Text style={{fontWeight:'900'}}>不会退还</Text>！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelModal(null)}><Text style={styles.cancelBtnText}>保持排队</Text></TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  tabsWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 8 },
  tabBtnActive: { backgroundColor: '#E6F0FF' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#0066FF', fontWeight: '900' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F9F9F9' },
  timeText: { fontSize: 12, color: '#999' },
  statusText: { fontSize: 13, fontWeight: '900' },
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
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  inputField: { width: '100%', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 12 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});