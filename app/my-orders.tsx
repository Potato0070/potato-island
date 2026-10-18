import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import SeasideButton from '../components/SeasideButton';
import SeasideSheet from '../components/SeasideSheet';
import SeasideTextInput from '../components/SeasideTextInput';
import SeasideResultDialog from '../components/SeasideResultDialog';
import TradeConfirmDialog from '../components/TradeConfirmDialog';
import PageReadState from '../components/PageReadState';
import { FolioArtwork } from '../components/FolioArtwork';
import { orderError, orderMoney, orderPrice, orderTotal } from '../constants/order-ui';

const TABS = ['寄售中', '求购中', '竞价中', '已买入', '已卖出'];

// 💰 千分位金额格式化
const formatMoney = (num: unknown) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readFailure, setReadFailure] = useState<'login' | 'error' | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [cancelModal, setCancelModal] = useState<{orderId: string; amount: number; name: string} | null>(null);
  const [addPriceModal, setAddPriceModal] = useState<{order: any} | null>(null);
  const [cancelSaleModal, setCancelSaleModal] = useState<{nftId: string; name: string} | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [addStep, setAddStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reviewNeeded, setReviewNeeded] = useState(false);
  const [result, setResult] = useState<{title: string; description: string} | null>(null);
  const lock = useRef(false);
  const readVersion = useRef(0);
  const userId = useRef('');
  const fetchDataByTab = useCallback(async (tab: string) => {
    const version = ++readVersion.current;
    setReadFailure(null);
    try {
      const auth = await supabase.auth.getUser();
      if (version !== readVersion.current) return;
      if (!auth.data.user && (!auth.error || auth.error.name === 'AuthSessionMissingError')) { setListData([]); setReadFailure('login'); return; }
      if (auth.error) throw auth.error;
      if (!auth.data.user) throw new Error('登录状态暂时无法读取');
      userId.current = auth.data.user.id;
      let query;
      if (tab === '寄售中') query = supabase.from('nfts').select('*').eq('owner_id', auth.data.user.id).eq('status', 'listed').order('created_at', { ascending: false });
      else if (tab === '求购中') query = supabase.from('buy_orders').select('*').eq('buyer_id', auth.data.user.id).eq('status', 'active').neq('order_type', 'bid').order('created_at', { ascending: false });
      else if (tab === '竞价中') query = supabase.from('buy_orders').select('*').eq('buyer_id', auth.data.user.id).eq('status', 'active').eq('order_type', 'bid').order('created_at', { ascending: false });
      else query = supabase.from('transfer_logs').select('*').eq(tab === '已买入' ? 'buyer_id' : 'seller_id', auth.data.user.id).order('transfer_time', { ascending: false });
      const [cols, orders, profile] = await Promise.all([
        supabase.from('collections').select('id, name, image_url'), query,
        supabase.from('profiles').select('potato_coin_balance').eq('id', auth.data.user.id).single(),
      ]);
      if (version !== readVersion.current) return;
      if (cols.error) throw cols.error;
      if (orders.error) throw orders.error;
      const colMap = new Map((cols.data || []).map(c => [c.id, c]));
      setListData((orders.data || []).map(item => ({ ...item, collections: colMap.get(item.collection_id) || { name: '藏品信息暂缺', image_url: '' } })));
      setBalance(profile.error || !profile.data ? null : Number(profile.data.potato_coin_balance || 0));
    } catch { if (version === readVersion.current) setReadFailure('error'); }
    finally { if (version === readVersion.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); void fetchDataByTab(activeTab); return () => { readVersion.current += 1; }; }, [activeTab, fetchDataByTab]));
  const onRefresh = () => { setRefreshing(true); void fetchDataByTab(activeTab); };
  const beginAction = () => { if (lock.current || reviewNeeded) return false; setActionError(''); return true; };
  const checkedUser = async () => {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user || auth.data.user.id !== userId.current) throw new Error('登录状态已变化，请重新登录后继续。');
    return auth.data.user;
  };
  // Retains existing write sequence. Unknown partial outcomes block same-page retries.
  const runAction = async (work: (markWrite: () => void) => Promise<void>, title: string, description: string) => {
    if (lock.current || reviewNeeded) return;
    lock.current = true; setProcessing(true); setActionError('');
    let wrote = false;
    try {
      await work(() => { wrote = true; });
      setCancelModal(null); setCancelSaleModal(null); setAddPriceModal(null); setNewPrice('');
      setResult({ title, description }); void fetchDataByTab(activeTab);
    } catch (error) {
      setReviewNeeded(wrote);
      setActionError(wrote ? '处理结果暂未确认，请核对订单和余额，暂勿重复提交。' : orderError(error, '操作未完成，填写内容已保留。'));
    } finally { lock.current = false; setProcessing(false); }
  };
  const handleCancelBuyOrder = () => {
    if (!cancelModal) return;
    const selected = cancelModal;
    if (!Number.isFinite(selected.amount) || selected.amount <= 0) { setActionError('订单金额异常，请刷新列表核对。'); return; }
    void runAction(async markWrite => {
      const user = await checkedUser();
      const profile = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
      if (profile.error || !profile.data) throw new Error('余额暂时无法读取，请稍后再试。');
      markWrite();
      const order = await supabase.from('buy_orders').update({ status: 'cancelled' }).eq('id', selected.orderId).select('id').maybeSingle();
      if (order.error) throw order.error;
      if (!order.data) throw new Error('未收到处理确认');
      const credit = await supabase.from('profiles').update({ potato_coin_balance: Number(profile.data.potato_coin_balance || 0) + selected.amount }).eq('id', user.id).select('id').maybeSingle();
      if (credit.error) throw credit.error;
      if (!credit.data) throw new Error('未收到处理确认');
    }, '撤单请求已处理', '请核对订单状态及余额变动。');
  };
  const handleCancelSale = () => {
    if (!cancelSaleModal) return;
    const selected = cancelSaleModal;
    void runAction(async markWrite => {
      await checkedUser(); markWrite();
      const updated = await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', selected.nftId).select('id').maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) throw new Error('未收到处理确认');
    }, '寄售已撤回', '请在金库查看藏品的当前状态。');
  };
  const increasedPrice = orderPrice(newPrice);
  const extra = addPriceModal && increasedPrice !== null ? orderTotal(increasedPrice - Number(addPriceModal.order.price), Number(addPriceModal.order.quantity)) : null;
  const checkIncrease = () => {
    if (!addPriceModal) return;
    if (increasedPrice === null || increasedPrice <= Number(addPriceModal.order.price)) { setActionError(`新单价须高于 ${orderMoney(addPriceModal.order.price)} 土豆币，最多两位小数。`); return; }
    if (extra === null || extra <= 0) { setActionError('订单数量或金额异常，请刷新后核对。'); return; }
    if (balance === null) { setActionError('余额暂时无法读取，请关闭面板后刷新列表。'); return; }
    if (extra > balance) { setActionError('可用余额不足以支付本次加价差额。'); return; }
    setActionError(''); setAddStep(2);
  };
  const handleIncreasePrice = () => {
    if (!addPriceModal || increasedPrice === null || extra === null || extra <= 0) return;
    const selected = addPriceModal.order;
    void runAction(async markWrite => {
      const user = await checkedUser();
      const profile = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
      if (profile.error || !profile.data) throw new Error('余额暂时无法读取，请稍后再试。');
      if (Number(profile.data.potato_coin_balance || 0) < extra) throw new Error('可用余额不足以支付本次加价差额。');
      markWrite();
      const debit = await supabase.from('profiles').update({ potato_coin_balance: Number(profile.data.potato_coin_balance || 0) - extra }).eq('id', user.id).select('id').maybeSingle();
      if (debit.error) throw debit.error;
      if (!debit.data) throw new Error('未收到处理确认');
      const updated = await supabase.from('buy_orders').update({ price: increasedPrice, created_at: new Date().toISOString() }).eq('id', selected.id).select('id').maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) throw new Error('未收到处理确认');
    }, '加价请求已处理', '请在订单管理查看最新出价与成交进度。');
  };
  const renderItem = ({ item }: { item: any }) => {
    const isSelling = activeTab === '寄售中';
    const isBuying = activeTab === '求购中' || activeTab === '竞价中'; 
    const isHistory = activeTab === '已买入' || activeTab === '已卖出';
    
    const name = item.collections?.name;
    const imgUrl = item.collections?.image_url;
    
    const serial = (isSelling || isBuying) ? (item.serial_number || '智能排队中') : item.nft_id?.substring(0,6);
    const price = isSelling ? item.consign_price : item.price;
    const timeStr = isSelling || isBuying ? '等待成交' : new Date(item.transfer_time || item.created_at).toLocaleString();

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
           <FolioArtwork uri={imgUrl || null} framed={false} style={styles.img} accessibilityLabel={`${name}封面`} />
           <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.serial}>{isBuying ? `${activeTab === '竞价中' ? '需求数量' : '求购数量'}: ${item.quantity}` : (isHistory && item.transfer_type === 'launch_mint' ? '首发原石' : `#${serial}`)}</Text>
           </View>
           <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{isSelling || isBuying ? (isSelling ? '一口价' : '当前出价') : (item.transfer_type === '好友转赠' ? '介质消耗' : '成交价')}</Text>
              <Text style={styles.price}>{item.transfer_type === '好友转赠' ? '1 张' : `${formatMoney(price)} 土豆币`}</Text>
           </View>
        </View>

        {isSelling && <View style={styles.cardFooter}><SeasideButton label="撤回寄售" tone="secondary" disabled={processing || reviewNeeded} onPress={() => { if (beginAction()) setCancelSaleModal({ nftId: item.id, name }); }} /></View>}
        {isBuying && <View style={styles.cardFooter}>
          <SeasideButton label="调整出价" tone="secondary" disabled={processing || reviewNeeded} style={styles.orderAction} onPress={() => { if (beginAction()) { setNewPrice(''); setAddStep(1); setAddPriceModal({ order: item }); } }} />
          <SeasideButton label="撤回订单" tone="danger" disabled={processing || reviewNeeded} style={styles.orderAction} onPress={() => { if (beginAction()) setCancelModal({ orderId: item.id, amount: Number(item.price) * Number(item.quantity), name }); }} />
        </View>}
      </View>
    );
  };

  if (readFailure) return <PageReadState pageTitle="订单管理" subject="订单" status={readFailure} fallback="/profile" backLabel="返回金库" onRetry={() => { setLoading(true); void fetchDataByTab(activeTab); }} />;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回金库" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>订单管理</Text>
        <View style={styles.navBtn} />
      </View>

      {reviewNeeded && <Text accessibilityRole="alert" style={styles.reviewNotice}>处理结果暂未确认，请核对订单和余额，暂勿重复提交。</Text>}

      {/* 🌟 顶部 Tab 也融合进了复古琥珀金的主题中 */}
      <View style={styles.tabsWrapper}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
           {TABS.map(tab => (
             <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }}
                key={tab} 
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
                onPress={() => {
                   if (tab === activeTab) return;
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
                <Image source={require('../assets/empty-states/storybook-pencil-v1/runtime/empty-inventory.webp')} resizeMode="contain" style={{ width: 150, height: 115, marginBottom: 14 }} accessible={false} />
                <Text style={{color: '#8D6E63', fontWeight: '800'}}>暂无{activeTab}订单</Text>
             </View>
          }
        />
      )}

      <TradeConfirmDialog visible={!!cancelSaleModal} title="撤回寄售" description={`${cancelSaleModal?.name || ''}\n撤回后，该藏品将回到金库。`} cancelLabel="保留寄售" confirmLabel="确认撤回" tone="danger" busy={processing} error={actionError} confirmDisabled={reviewNeeded} onCancel={() => { if (!lock.current) setCancelSaleModal(null); }} onConfirm={handleCancelSale} />
      <SeasideSheet visible={!!addPriceModal && addStep === 1} title="调整出价" busy={processing} onClose={() => { if (!lock.current) setAddPriceModal(null); }} footer={<SeasideButton label="核对加价" tone="transaction" onPress={checkIncrease} disabled={reviewNeeded} />}>
        <Text style={styles.dialogCopy}>{addPriceModal?.order.collections?.name} · 需求 {addPriceModal?.order.quantity} 件</Text>
        <Text style={styles.dialogCopy}>当前单价：{orderMoney(addPriceModal?.order.price)} 土豆币</Text>
        <SeasideTextInput label="新的单价" unit="土豆币" placeholder="请输入更高的单价" keyboardType="decimal-pad" maxLength={14} value={newPrice} onChangeText={value => { setNewPrice(value); setActionError(''); }} editable={!processing && !reviewNeeded} error={actionError} />
        <Text style={styles.dialogCopy}>需补充冻结：{extra !== null && extra > 0 ? orderMoney(extra) : '—'} 土豆币</Text>
        <Text style={styles.dialogCopy}>可用余额：{balance === null ? '暂时无法读取' : `${orderMoney(balance)} 土豆币`}</Text>
      </SeasideSheet>
      <TradeConfirmDialog visible={!!addPriceModal && addStep === 2} title="确认加价" description={`${addPriceModal?.order.collections?.name || ''}\n当前单价 ${orderMoney(addPriceModal?.order.price)} → 新单价 ${orderMoney(increasedPrice)} 土豆币\n本次补充冻结 ${orderMoney(extra)} 土豆币。`} cancelLabel={reviewNeeded ? "返回查看" : "返回修改"} confirmLabel="确认加价" busy={processing} error={actionError} confirmDisabled={reviewNeeded} onCancel={() => { if (!lock.current) setAddStep(1); }} onConfirm={handleIncreasePrice} />
      <TradeConfirmDialog visible={!!cancelModal} title="确认撤单" description={`${cancelModal?.name || ''}\n撤回后不再参与后续撮合。预计解冻 ${orderMoney(cancelModal?.amount)} 土豆币，实际结果请核对订单与余额。`} cancelLabel="保留订单" confirmLabel="确认撤单" tone="danger" busy={processing} error={actionError} confirmDisabled={reviewNeeded} onCancel={() => { if (!lock.current) setCancelModal(null); }} onConfirm={handleCancelBuyOrder} />
      <SeasideResultDialog visible={!!result} title={result?.title || ''} description={result?.description || ''} primaryLabel="查看订单" onClose={() => setResult(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' }, // 全局米白背景
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  
  
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
  
  cardBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  img: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#FDF8F0', marginRight: 14, borderWidth: 1, borderColor: '#EAE0D5' },
  info: { flex: 1, minWidth: 100, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  serial: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace', fontWeight: '600' },
  
  priceBox: { alignItems: 'flex-end', justifyContent: 'center' },
  priceLabel: { fontSize: 11, color: '#A1887F', marginBottom: 6, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '900', color: '#111', fontFamily: 'monospace' },
  
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  orderAction: { flexGrow: 1, flexBasis: 144, minWidth: 144 },
  dialogCopy: { color: '#74695E', fontSize: 15, lineHeight: 24 },
  reviewNotice: { color: '#9B4030', fontSize: 14, lineHeight: 23, padding: 16 },
  
  emptyBox: { alignItems: 'center', marginTop: 120 },
  
});