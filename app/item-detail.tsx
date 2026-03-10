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
  
  const [myUserId, setMyUserId] = useState<string>('');
  
  const [currentHistory, setCurrentHistory] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [historyMode, setHistoryMode] = useState<'current' | 'all'>('current');
  
  const [showPayModal, setShowPayModal] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listStep, setListStep] = useState<1 | 2>(1);
  const [listPrice, setListPrice] = useState('');
  
  const [listing, setListing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  
  const [toastMsg, setToastMsg] = useState('');
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);

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

      const { data: nftData, error: nftErr } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).single();
      if (nftErr) throw new Error(`藏品查询失败: ${nftErr.message}`);
      setNft(nftData);

      const { data: currHist, error: currErr } = await supabase.from('transfer_logs')
        .select('*, buyer:buyer_id(nickname)')
        .eq('nft_id', id)
        .order('transfer_time', { ascending: false });
      if (currErr) throw new Error(`当前流水查询失败: ${currErr.message}`);
      setCurrentHistory(currHist || []);

      if (nftData?.collection_id) {
         const { data: allHist, error: allErr } = await supabase.from('transfer_logs')
           .select('*, buyer:buyer_id(nickname)')
           .eq('collection_id', nftData.collection_id)
           .order('transfer_time', { ascending: false })
           .limit(30);
         if (allErr) throw new Error(`全盘流水查询失败: ${allErr.message}`);
         setAllHistory(allHist || []);
      }
    } catch(e: any) { 
      // 🌟 透视眼：页面加载报错直接弹脸
      Alert.alert("详情页加载异常", e.message || JSON.stringify(e));
      console.error(e); 
    } finally { setLoading(false); }
  };

  const executeBuy = async () => {
    setBuying(true);
    try {
      if (userBalance < nft.consign_price) throw new Error('您的钱包余额不足，请先充值！');
      
      const { error } = await supabase.rpc('execute_trade', { p_nft_id: nft.id, p_buyer_id: myUserId });
      if (error) throw error;
      
      setShowPayModal(false);
      setTimeout(() => {
         setSuccessModal({ title: '✅ 交易成功', msg: '您已成功买下该藏品，资产已打入您的金库！' });
      }, 400);
    } catch (err: any) { 
      // 🌟 透视眼：购买失败原样抛出
      Alert.alert('交易失败报错', err.message || JSON.stringify(err)); 
    } finally { 
      setBuying(false); 
    }
  };

  const handleListNextStep = () => {
     const p = parseFloat(listPrice);
     if (isNaN(p) || p <= 0) return showToast('请输入有效的寄售价格！');

     const maxLimit = nft.collections?.max_consign_price;
     if (maxLimit && p > maxLimit) {
        return showToast(`违规拦截：寄售价格不得高于最高限价 ¥${maxLimit}`);
     }
     setListStep(2);
  };

  const executeList = async () => {
     setListing(true);
     try {
        const { error } = await supabase.from('nfts').update({ status: 'listed', consign_price: parseFloat(listPrice) }).eq('id', nft.id);
        if (error) throw error;
        setListModalVisible(false);
        setListPrice('');
        
        setTimeout(() => {
           setSuccessModal({ title: '✅ 挂单成功', msg: '您的藏品已成功上架至交易大盘！' });
           fetchData(); 
        }, 400);
     } catch(e: any) {
        // 🌟 透视眼：寄售失败报错
        Alert.alert('挂单失败报错', e.message || JSON.stringify(e));
     } finally {
        setListing(false);
     }
  };

  const handleCancelList = async () => {
     setListing(true);
     try {
       const { error } = await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', nft.id);
       if (error) throw error;
       setSuccessModal({ title: '📦 撤销成功', msg: '已成功撤销寄售，藏品已退回您的金库锁定！' });
       fetchData();
     } catch (e: any) {
       Alert.alert('撤销失败报错', e.message || JSON.stringify(e));
     } finally {
       setListing(false);
     }
  };

  // 🌟 透视眼：转赠按钮点击测试
  const handleTransfer = () => {
     try {
        console.log("准备跳转转赠页...");
        router.push({ pathname: '/transfer', params: { nftId: nft.id } });
     } catch (e: any) {
        Alert.alert("路由跳转失败", e.message || JSON.stringify(e));
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
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}><Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} /></View>
           <View style={styles.shadowOval} />
        </View>

        <View style={styles.infoSection}>
           <Text style={styles.colName}>{nft.collections?.name}</Text>
           <Text style={styles.supplyText}>发行 {nft.collections?.total_minted} | 流通 {nft.collections?.circulating_supply}</Text>
           <View style={styles.infoRow}><Text style={styles.infoLabel}>当前编号</Text><Text style={styles.infoValueHigh}>#{String(nft.serial_number).padStart(6, '0')}</Text></View>
           <View style={styles.infoRow}><Text style={styles.infoLabel}>底层哈希</Text><Text style={styles.infoHash} numberOfLines={1}>{hashString.substring(0, 10)}...{hashString.substring(hashString.length - 10)}</Text></View>
        </View>

        <View style={styles.historySection}>
           <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>流转记录</Text>
              <TouchableOpacity style={styles.historySwitch} onPress={() => setHistoryMode(historyMode === 'current' ? 'all' : 'current')}>
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
                   <Text style={styles.historyPrice}>成交 ¥ {log.price}</Text>
                </View>
             ))
           )}
        </View>
      </ScrollView>

      {(!isOwner && nft.status === 'listed') && (
        <View style={styles.bottomBar}>
           <View><Text style={{color: '#999', fontSize: 12}}>寄售价格</Text><Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {nft.consign_price}</Text></View>
           <TouchableOpacity style={styles.buyBtn} onPress={() => setShowPayModal(true)}><Text style={styles.buyText}>立即购买</Text></TouchableOpacity>
        </View>
      )}

      {(isOwner && nft.status === 'idle') && (
        <View style={styles.bottomBar}>
           <TouchableOpacity style={[styles.actionBtn, {flex: 0.45, backgroundColor: '#F5F5F5'}]} onPress={handleTransfer}>
              <Text style={[styles.buyText, {color: '#111'}]}>🎁 转赠</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.buyBtn, {flex: 0.5, backgroundColor: '#0066FF'}]} onPress={() => { setListStep(1); setListPrice(''); setListModalVisible(true); }}>
              <Text style={styles.buyText}>发布寄售</Text>
           </TouchableOpacity>
        </View>
      )}

      {(isOwner && nft.status === 'listed') && (
        <View style={styles.bottomBar}>
           <View><Text style={{color: '#999', fontSize: 12}}>正在寄售中</Text><Text style={{color: '#FF3B30', fontSize: 20, fontWeight: '900'}}>¥ {nft.consign_price}</Text></View>
           <TouchableOpacity style={[styles.buyBtn, {backgroundColor: '#FFF', borderColor: '#FF3B30', borderWidth: 1}]} onPress={handleCancelList} disabled={listing}>
              {listing ? <ActivityIndicator color="#FF3B30" /> : <Text style={[styles.buyText, {color: '#FF3B30'}]}>撤销寄售</Text>}
           </TouchableOpacity>
        </View>
      )}

      <Modal visible={listModalVisible} transparent animationType="slide">
        {listStep === 1 ? (
           <View style={styles.modalOverlay}>
             <View style={styles.listSheet}>
                <View style={styles.sheetHeader}>
                   <Text style={styles.sheetTitle}>发布寄售</Text>
                   <TouchableOpacity onPress={() => setListModalVisible(false)}><Text style={{color: '#999', fontSize: 24}}>×</Text></TouchableOpacity>
                </View>
                <View style={{padding: 20}}>
                   <Text style={{fontSize: 14, color: '#666', marginBottom: 12}}>当前系列最高限价: ¥{nft.collections?.max_consign_price || '无'}</Text>
                   <TextInput style={styles.inputField} keyboardType="decimal-pad" value={listPrice} onChangeText={setListPrice} placeholder="请输入寄售价格" textAlign="center" />
                   <TouchableOpacity style={[styles.confirmPayBtn, {backgroundColor: '#0066FF', marginTop: 24}]} onPress={handleListNextStep}>
                      <Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>下一步</Text>
                   </TouchableOpacity>
                </View>
             </View>
           </View>
        ) : (
           <View style={styles.modalOverlayCenter}>
             <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>📝 寄售确认</Text>
                <Text style={styles.confirmDesc}>您即将以 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{listPrice}</Text> 的一口价将此藏品挂单至大盘。挂单期间藏品将被冻结，是否继续？</Text>
                <View style={styles.confirmBtnRow}>
                   <TouchableOpacity style={styles.cancelBtn} onPress={() => setListStep(1)}><Text style={styles.cancelBtnText}>修改价格</Text></TouchableOpacity>
                   <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0066FF'}]} onPress={executeList} disabled={listing}>
                      {listing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认上架</Text>}
                   </TouchableOpacity>
                </View>
             </View>
           </View>
        )}
      </Modal>

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
                <TouchableOpacity style={[styles.confirmPayBtn, userBalance < nft.consign_price && {backgroundColor: '#CCC'}]} onPress={executeBuy} disabled={userBalance < nft.consign_price || buying}>
                   {buying ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>{userBalance < nft.consign_price ? '余额不足' : `立即支付 ¥ ${nft.consign_price}`}</Text>}
                </TouchableOpacity>
             </View>
          </RNSafeAreaView>
        </View>
      </Modal>

      <Modal visible={!!successModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#0066FF', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#0066FF', fontSize: 22}]}>{successModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#111', fontWeight: '800', lineHeight: 22}]}>{successModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#0066FF'}]} onPress={() => { setSuccessModal(null); router.replace('/(tabs)/profile'); }}>
                  <Text style={styles.confirmBtnText}>知道了</Text>
               </TouchableOpacity>
            </View>
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
  actionBtn: { paddingVertical: 14, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
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
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#0066FF', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});