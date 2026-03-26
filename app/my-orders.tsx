import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const TABS = ['寄售中', '求购中', '竞价中', '已买入', '已卖出'];

// 💰 千分位金额格式化
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// 🌟 核心图片组件：防止白边和加载失败
const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0', overflow: 'hidden' }]}>
      {loading && !hasError && <ActivityIndicator color="#D49A36" style={{ position: 'absolute' }} />}
      {!hasError ? (
        <Image
          source={{ uri: uri || 'invalid_url' }}
          style={[{ position: 'absolute', width: '100%', height: '100%' }]}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
          onError={() => { setHasError(true); setLoading(false); }}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
           <Text style={{ fontSize: 24 }}>🥔</Text>
        </View>
      )}
    </View>
  );
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cancelModal, setCancelModal] = useState<{visible: boolean, orderId: string, amount: number} | null>(null);
  const [addPriceModal, setAddPriceModal] = useState<{visible: boolean, order: any} | null>(null);
  const [cancelSaleModal, setCancelSaleModal] = useState<{visible: boolean, nftId: string} | null>(null);
  
  const [newPrice, setNewPrice] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useFocusEffect(useCallback(() => { fetchDataByTab(activeTab); }, [activeTab]));

  const showToast = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchDataByTab(activeTab);
  }, [activeTab]);

  const fetchDataByTab = async (tab: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cols } = await supabase.from('collections').select('id, name, image_url');
      const colMap: any = {};
      if (cols) cols.forEach(c => colMap[c.id] = c);

      let rawData: any[] = [];

      if (tab === '寄售中') {
        const { data } = await supabase.from('nfts').select('*').eq('owner_id', user.id).eq('status', 'listed').order('created_at', { ascending: false });
        rawData = data || [];
      } 
      else if (tab === '求购中') {
        const { data } = await supabase.from('buy_orders').select('*').eq('buyer_id', user.id).eq('status', 'active').neq('order_type', 'bid').order('created_at', { ascending: false });
        rawData = data || [];
      }
      else if (tab === '竞价中') {
        const { data } = await supabase.from('buy_orders').select('*').eq('buyer_id', user.id).eq('status', 'active').eq('order_type', 'bid').order('created_at', { ascending: false });
        rawData = data || [];
      }
      else if (tab === '已买入') {
        const { data } = await supabase.from('transfer_logs').select('*').eq('buyer_id', user.id).order('transfer_time', { ascending: false });
        rawData = data || [];
      } 
      else if (tab === '已卖出') {
        const { data } = await supabase.from('transfer_logs').select('*').eq('seller_id', user.id).order('transfer_time', { ascending: false });
        rawData = data || [];
      }

      const enrichedData = rawData.map(item => ({
         ...item,
         collections: colMap[item.collection_id] || { name: '神秘藏品', image_url: 'https://via.placeholder.com/150' }
      }));

      setListData(enrichedData);
    } catch (err: any) { 
       Alert.alert("加载失败", err.message); 
    } finally { 
       setLoading(false); 
       setRefreshing(false);
    }
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
      showToast('✅ 撤销成功，冻结资金已退回钱包');
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
    } catch (err: any) { Alert.alert('取消寄售失败', err.message); } finally { setProcessing(false); }
  };

  const handleIncreasePrice = async () => {
    if (!addPriceModal) return;
    const order = addPriceModal.order;
    const p = parseFloat(newPrice);
    if (isNaN(p) || p <= order.price) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return showToast(`加价必须高于当前出价 ¥${formatMoney(order.price)}`);
    }
    
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
      showToast(`✅ 加价成功！您已重新抢占排队高位`);
      fetchDataByTab(activeTab);
    } catch (err: any) { Alert.alert('加价失败', err.message); } finally { setProcessing(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelling = activeTab === '寄售中';
    const isBuying = activeTab === '求购中' || activeTab === '竞价中'; 
    const isHistory = activeTab === '已买入' || activeTab === '已卖出';
    
    const name = item.collections?.name;
    const imgUrl = item.collections?.image_url;
    
    const serial = (isSelling || isBuying) ? (item.serial_number || '智能排队中') : item.nft_id?.substring(0,6);
    const price = isSelling ? item.consign_price : item.price;
    const timeStr = isSelling || isBuying ? '有效挂单中...' : new Date(item.transfer_time || item.created_at).toLocaleString();

    let typeTag = activeTab;
    let typeColor = '#4E342E';
    if (isHistory) {
       switch(item.transfer_type) {
          case 'launch_mint': typeTag = '首发抢购'; typeColor = '#D49A36'; break;
          case 'direct_buy': typeTag = '大盘扫单'; typeColor = '#0066FF'; break;
          case 'bid_match': typeTag = '委托撮合'; typeColor = '#FF3B30'; break;
          case '好友转赠': typeTag = '跨区转赠'; typeColor = '#8A2BE2'; break;
          default: typeTag = '交易流转'; typeColor = '#8D6E63';
       }
    } else {
       typeColor = '#FF3B30'; // 挂单中统一用醒目红
    }

    return (
      <View style={styles.card}>
        {/* 🌟 严格复刻截图里的头部排版 */}
        <View style={styles.cardHeader}>
           <Text style={styles.timeText}>{timeStr}</Text>
           <Text style={[styles.statusText, {color: typeColor}]}>{typeTag}</Text>
        </View>

        <View style={styles.cardBody}>
           <FallbackImage uri={imgUrl} style={styles.img} />
           <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.serial}>{isBuying ? `${activeTab === '竞价中' ? '需求数量' : '求购数量'}: ${item.quantity}` : (isHistory && item.transfer_type === 'launch_mint' ? '首发原石' : `#${serial}`)}</Text>
           </View>
           <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{isSelling || isBuying ? (isSelling ? '一口价' : '当前出价') : (item.transfer_type === '好友转赠' ? '介质消耗' : '成交价')}</Text>
              <Text style={styles.price}>{item.transfer_type === '好友转赠' ? '1 张' : `¥ ${formatMoney(price)}`}</Text>
           </View>
        </View>

        {/* 🌟 严格复刻截图里的操作按钮布局 */}
        {isSelling && (
           <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCancelSaleModal({visible: true, nftId: item.id}); }}>
                 <Text style={styles.actionBtnOutlineText}>取消寄售</Text>
              </TouchableOpacity>
           </View>
        )}

        {isBuying && (
           <View style={styles.cardFooter}>
              <TouchableOpacity style={[styles.actionBtnOutline, {borderColor: '#D49A36', marginRight: 12}]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddPriceModal({visible: true, order: item}); }}>
                 <Text style={[styles.actionBtnOutlineText, {color: '#D49A36'}]}>加价竞拍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCancelModal({visible: true, orderId: item.id, amount: item.price * item.quantity}); }}>
                 <Text style={styles.actionBtnOutlineText}>撤单解冻</Text>
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

      {/* 🌟 顶部 Tab 也融合进了复古琥珀金的主题中 */}
      <View style={styles.tabsWrapper}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
           {TABS.map(tab => (
             <TouchableOpacity 
                key={tab} 
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
                onPress={() => {
                   Haptics.selectionAsync();
                   setLoading(true);
                   setActiveTab(tab);
                }}
             >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
             </TouchableOpacity>
           ))}
         </ScrollView>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={listData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />}
          ListEmptyComponent={
             <View style={styles.emptyBox}>
                <Text style={{fontSize: 60, marginBottom: 10}}>📭</Text>
                <Text style={{color: '#8D6E63', fontWeight: '800'}}>未找到 {activeTab} 的大盘记录</Text>
             </View>
          }
        />
      )}

      {/* 取消寄售模态框 */}
      <Modal visible={!!cancelSaleModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📦 取消寄售</Text>
               <Text style={styles.confirmDesc}>确定要将该藏品从大盘中撤下吗？撤下后资产将退回至您的金库。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelSaleModal(null)}><Text style={styles.cancelBtnText}>再挂一会</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#FF3B30'}]} onPress={handleCancelSale} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认撤回</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 加价竞拍模态框 */}
      <Modal visible={!!addPriceModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📈 抢占大盘排队</Text>
               <Text style={styles.confirmDesc}>您当前排队的出价为: <Text style={{color: '#FF3B30', fontWeight: '900'}}>¥{formatMoney(addPriceModal?.order?.price)}</Text></Text>
               <TextInput 
                  style={styles.inputField} 
                  placeholder="请输入更高的一口价" 
                  placeholderTextColor="#A1887F"
                  keyboardType="decimal-pad" 
                  value={newPrice} 
                  onChangeText={(val) => setNewPrice(val.replace(/[^0-9.]/g, ''))} 
                  textAlign="center"
               />
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => {setAddPriceModal(null); setNewPrice('');}}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={handleIncreasePrice} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认加价</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 撤回求购单模态框 */}
      <Modal visible={!!cancelModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>⚠️ 确认撤回求购/竞价</Text>
               <Text style={styles.confirmDesc}>撤单后，系统冻结的 <Text style={{color: '#FF3B30', fontWeight: '900'}}>¥{formatMoney(cancelModal?.amount)}</Text> 货款将立即原路退回至您的钱包余额。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelModal(null)}><Text style={styles.cancelBtnText}>保持排队</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#4E342E'}]} onPress={handleCancelBuyOrder} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认撤单</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' }, // 全局米白背景
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(44,30,22,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100, shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 10 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  
  tabsWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FDF8F0', marginRight: 10, borderWidth: 1, borderColor: '#EAE0D5' },
  tabBtnActive: { backgroundColor: '#FFFDF5', borderColor: '#D49A36' },
  tabText: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  tabTextActive: { color: '#D49A36', fontWeight: '900' },
  
  // 🌟 核心卡片重构区 (像素级对照截图)
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  timeText: { fontSize: 12, color: '#A1887F', fontWeight: '600' },
  statusText: { fontSize: 13, fontWeight: '900' },
  
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  img: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#FDF8F0', marginRight: 14, borderWidth: 1, borderColor: '#EAE0D5' },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  serial: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace', fontWeight: '600' },
  
  priceBox: { alignItems: 'flex-end', justifyContent: 'center' },
  priceLabel: { fontSize: 11, color: '#A1887F', marginBottom: 6, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '900', color: '#111', fontFamily: 'monospace' },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  actionBtnOutline: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#A1887F', backgroundColor: '#FFF' },
  actionBtnOutlineText: { color: '#4E342E', fontSize: 13, fontWeight: '800' },
  
  emptyBox: { alignItems: 'center', marginTop: 120 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 20, fontWeight: '600' },
  inputField: { width: '100%', backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, fontSize: 24, fontWeight: '900', color: '#D49A36', marginBottom: 20, borderWidth: 1, borderColor: '#EAE0D5' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});