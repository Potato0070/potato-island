import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);
  
  // 🌟 当前登录用户信息
  const [myUserId, setMyUserId] = useState<string>('');
  
  // 双轨账本数据
  const [currentHistory, setCurrentHistory] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [historyMode, setHistoryMode] = useState<'current' | 'all'>('current');
  
  // 底部支付面板状态
  const [showPayModal, setShowPayModal] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  
  // 🌟 挂单寄售状态
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [confirmListModal, setConfirmListModal] = useState(false);
  const [listing, setListing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         setMyUserId(user.id);
         const { data: prof } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
         if (prof) setUserBalance(prof.potato_coin_balance);
      }

      // 1. 获取核心资产数据
      const { data: nftData } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).single();
      setNft(nftData);

      // 2. 获取【当前编号】的流转历史
      const { data: currHist } = await supabase.from('transfer_logs')
        .select('*, buyer:buyer_id(nickname)')
        .eq('nft_id', id)
        .order('transfer_time', { ascending: false });
      setCurrentHistory(currHist || []);

      // 3. 获取【大盘全网】的流转历史 (制造FOMO)
      if (nftData?.collection_id) {
         const { data: allHist } = await supabase.from('transfer_logs')
           .select('*, buyer:buyer_id(nickname)')
           .eq('collection_id', nftData.collection_id)
           .order('transfer_time', { ascending: false })
           .limit(30);
         setAllHistory(allHist || []);
      }
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // 🛡️ 强制二次弹窗确认 (买入)
  const confirmAndPay = () => {
    Alert.alert(
      '🔒 支付防误触确认',
      `您即将花费 ¥${nft.consign_price} 购买【${nft.collections?.name}】#${String(nft.serial_number).padStart(6, '0')}。\n支付后资产将立刻划转且不可逆，是否确认执行？`,
      [
        { text: '我再想想', style: 'cancel' },
        { 
          text: '确认支付', 
          style: 'destructive', 
          onPress: executeBuy 
        }
      ]
    );
  };

  const executeBuy = async () => {
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (userBalance < nft.consign_price) throw new Error('您的钱包余额不足，请先充值！');

      const { error } = await supabase.rpc('execute_trade', { p_nft_id: nft.id, p_buyer_id: user?.id });
      if (error) throw error;
      
      setShowPayModal(false);
      Alert.alert('✅ 交易成功', '藏品已打入您的金库！', [{ text: '查看金库', onPress: () => router.replace('/(tabs)/profile') }]);
    } catch (err: any) { Alert.alert('交易失败', err.message); } finally { setBuying(false); }
  };

  // 🌟 挂单寄售的初步拦截
  const handleListClick = () => {
     const p = parseFloat(listPrice);
     if (isNaN(p) || p <= 0) return showToast('请输入有效的寄售价格！');
     setShowListModal(false);
     setConfirmListModal(true); // 唤起二次确认防坑弹窗
  };

  // 🌟 核心：执行挂单寄售
  const executeList = async () => {
     setListing(true);
     try {
        await supabase.from('nfts').update({ status: 'listed', consign_price: parseFloat(listPrice) }).eq('id', nft.id);
        setConfirmListModal(false);
        setListPrice('');
        showToast('✅ 挂单寄售成功！已进入大盘');
        fetchData(); // 刷新状态
     } catch(e: any) {
        setConfirmListModal(false);
        showToast(`挂单失败: ${e.message}`);
     } finally {
        setListing(false);
     }
  };

  if (!nft) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  const hashString = nft.id.replace(/-/g, '').toUpperCase();
  const displayHistory = historyMode === 'current' ? currentHistory : allHistory;
  const isOwner = myUserId === nft.owner_id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>藏品详情</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* 悬浮 3D 展台设计 */}
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}>
              <Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} />
           </View>
           <View style={styles.shadowOval} />
        </View>

        <View style={styles.infoSection}>
           <Text style={styles.colName}>{nft.collections?.name}</Text>
           <Text style={styles.supplyText}>发行 {nft.collections?.total_minted} | 流通 {nft.collections?.circulating_supply}</Text>
           
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>当前编号</Text>
              <Text style={styles.infoValueHigh}>#{String(nft.serial_number).padStart(6, '0')} <Text style={{color:'#CCC', fontSize: 12}}>/ {nft.collections?.total_minted}</Text></Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>底层哈希</Text>
              <Text style={styles.infoHash} numberOfLines={1}>{hashString.substring(0, 10)}...{hashString.substring(hashString.length - 10)}</Text>
           </View>
        </View>

        {/* 双轨流转账本 (一岛同款) */}
        <View style={styles.historySection}>
           <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>流转记录</Text>
              <TouchableOpacity 
                 style={styles.historySwitch} 
                 onPress={() => setHistoryMode(historyMode === 'current' ? 'all' : 'current')}
              >
                 <Text style={styles.historySwitchText}>{historyMode === 'current' ? '当前编号 ⇌' : '全部编号 ⇌'}</Text>
              </TouchableOpacity>
           </View>

           {displayHistory.length === 0 ? (
             <Text style={{textAlign: 'center', color: '#999', paddingVertical: 20}}>暂无流转记录</Text>
           ) : (
             displayHistory.map((log) => (
                <View key={log.id} style={styles.historyRow}>
                   <View>
                      <Text style={styles.historyUser}>{log.buyer?.nickname || '神秘岛民'}</Text>
                      <Text style={styles.historyTime}>{new Date(log.transfer_time).toLocaleString()}</Text>
                   </View>
                   <Text style={styles.historyPrice}>买入 ¥ {log.price}</Text>
                </View>
             ))
           )}
        </View>
      </ScrollView>

      {/* 🌟 智能底部操作栏 */}
      {(!isOwner && nft.status === 'listed') && (
        <View style={styles.bottomBar}>
           <View>
              <Text style={{color: '#999', fontSize: 12}}>寄售价格</Text>
              <Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {nft.consign_price}</Text>
           </View>
           <TouchableOpacity style={styles.buyBtn} onPress={() => setShowPayModal(true)}>
              <Text style={styles.buyText}>立即购买</Text>
           </TouchableOpacity>
        </View>
      )}

      {(isOwner && nft.status === 'idle') && (
        <View style={styles.bottomBar}>
           <View>
              <Text style={{color: '#999', fontSize: 12}}>我的藏品</Text>
              <Text style={{color: '#111', fontSize: 16, fontWeight: '900'}}>状态: 金库锁定</Text>
           </View>
           <TouchableOpacity style={[styles.buyBtn, {backgroundColor: '#0066FF'}]} onPress={() => setShowListModal(true)}>
              <Text style={styles.buyText}>发布寄售</Text>
           </TouchableOpacity>
        </View>
      )}

      {(isOwner && nft.status === 'listed') && (
        <View style={styles.bottomBar}>
           <View>
              <Text style={{color: '#999', fontSize: 12}}>正在寄售中</Text>
              <Text style={{color: '#FF3B30', fontSize: 20, fontWeight: '900'}}>¥ {nft.consign_price}</Text>
           </View>
           <TouchableOpacity style={[styles.buyBtn, {backgroundColor: '#888'}]} onPress={() => router.push('/my-orders')}>
              <Text style={styles.buyText}>管理订单</Text>
           </TouchableOpacity>
        </View>
      )}

      {/* 🌟 挂单输入价格抽屉 */}
      <Modal visible={showListModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.listSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>发布寄售</Text>
                <TouchableOpacity onPress={() => setShowListModal(false)}><Text style={{color: '#999', fontSize: 24}}>×</Text></TouchableOpacity>
             </View>
             <View style={{padding: 20}}>
                <Text style={{fontSize: 14, color: '#666', marginBottom: 12}}>请输入您的寄售一口价 (¥)</Text>
                <TextInput style={styles.inputField} keyboardType="decimal-pad" value={listPrice} onChangeText={setListPrice} placeholder="例如: 199.00" textAlign="center" />
                <TouchableOpacity style={[styles.confirmPayBtn, {backgroundColor: '#0066FF', marginTop: 24}]} onPress={handleListClick}>
                   <Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>下一步</Text>
                </TouchableOpacity>
             </View>
          </View>
        </View>
      </Modal>

      {/* 🌟 防坑二次确认弹窗 (寄售) */}
      <Modal visible={confirmListModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📝 寄售确认</Text>
               <Text style={styles.confirmDesc}>您即将以 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{listPrice}</Text> 的一口价将此藏品挂单至大盘。挂单期间藏品将被冻结，是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmListModal(false)}><Text style={styles.cancelBtnText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0066FF'}]} onPress={executeList} disabled={listing}>
                     {listing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认上架</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 底部支付收银台 (买入) */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>确认订单</Text>
                <TouchableOpacity onPress={() => setShowPayModal(false)}><Text style={{color: '#999', fontSize: 24}}>×</Text></TouchableOpacity>
             </View>

             <View style={styles.sheetContent}>
                <View style={styles.orderItemRow}>
                   <Image source={{ uri: nft.collections?.image_url }} style={styles.orderImg} />
                   <View style={{flex: 1}}>
                      <Text style={styles.orderName}>{nft.collections?.name}</Text>
                      <Text style={styles.orderSerial}>#{String(nft.serial_number).padStart(6, '0')}</Text>
                   </View>
                   <Text style={styles.orderPrice}>¥ {nft.consign_price}</Text>
                </View>

                <Text style={styles.payMethodTitle}>支付方式</Text>
                <View style={styles.payMethodRow}>
                   <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={{fontSize: 24, marginRight: 10}}>💳</Text>
                      <View>
                         <Text style={styles.payMethodName}>土豆币钱包</Text>
                         <Text style={styles.payMethodSub}>当前余额: ¥ {userBalance.toFixed(2)}</Text>
                      </View>
                   </View>
                   <View style={styles.radioChecked}><View style={styles.radioInner} /></View>
                </View>
             </View>

             <View style={styles.sheetFooter}>
                <TouchableOpacity 
                  style={[styles.confirmPayBtn, userBalance < nft.consign_price && {backgroundColor: '#CCC'}]} 
                  onPress={confirmAndPay} 
                  disabled={userBalance < nft.consign_price || buying}
                >
                   {buying ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>{userBalance < nft.consign_price ? '余额不足' : `立即支付 ¥ ${nft.consign_price}`}</Text>}
                </TouchableOpacity>
             </View>
          </RNSafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  stageContainer: { alignItems: 'center', backgroundColor: '#F0F0F5', paddingVertical: 30 },
  floatBox: { padding: 10, backgroundColor: '#FFF', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: {width: 0, height: 10}, elevation: 10, zIndex: 2 },
  mainImg: { width: width * 0.45, height: width * 0.45, borderRadius: 8, resizeMode: 'cover' },
  shadowOval: { width: width * 0.35, height: 15, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '50%', marginTop: 20 },

  infoSection: { backgroundColor: '#FFF', padding: 20, marginBottom: 16 },
  colName: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 4 },
  supplyText: { fontSize: 12, color: '#888', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValueHigh: { fontSize: 16, color: '#FF3B30', fontWeight: '900', fontFamily: 'monospace' },
  infoHash: { fontSize: 12, color: '#888', fontFamily: 'monospace', width: 150, textAlign: 'right' },

  historySection: { backgroundColor: '#FFF', padding: 20, marginBottom: 20 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historySwitch: { backgroundColor: '#F0F6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  historySwitchText: { fontSize: 12, color: '#0066FF', fontWeight: '800' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  historyUser: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 4 },
  historyTime: { fontSize: 11, color: '#999' },
  historyPrice: { fontSize: 14, fontWeight: '900', color: '#111' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F0F0F0' },
  buyBtn: { backgroundColor: '#FF5722', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 25 },
  buyText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  
  listSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  bottomSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: 400 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sheetContent: { padding: 20 },
  
  orderItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 12, borderRadius: 12, marginBottom: 24 },
  orderImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  orderName: { fontSize: 14, fontWeight: '900', color: '#111', marginBottom: 4 },
  orderSerial: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  orderPrice: { fontSize: 18, fontWeight: '900', color: '#FF3B30' },

  payMethodTitle: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 12 },
  payMethodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#0066FF', padding: 16, borderRadius: 12, backgroundColor: '#F0F6FF' },
  payMethodName: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  payMethodSub: { fontSize: 12, color: '#666' },
  radioChecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0066FF' },

  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0', paddingBottom: 40 },
  confirmPayBtn: { backgroundColor: '#FF5722', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  inputField: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, fontSize: 20, fontWeight: '900', color: '#FF3B30' },

  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});