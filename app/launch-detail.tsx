import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 💰 千分位金钱格式化
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

export default function LaunchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [launch, setLaunch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isStarted, setIsStarted] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false); 
  
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState('1'); 
  const [maxCanBuy, setMaxCanBuy] = useState(1); 

  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchLaunchData(); }, [id]);

  const showToast = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const fetchLaunchData = async () => {
    try {
      const { data, error } = await supabase.from('launch_events').select('*, collection:collection_id(*)').eq('id', id).single();
      if (error) throw error;
      setLaunch(data);
      if (data.remaining_supply <= 0) setIsSoldOut(true);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!launch) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(launch.start_time).getTime();
      const diff = start - now;
      if (launch.remaining_supply <= 0) {
          setTimeLeftStr('已全部售罄'); setIsStarted(true); setIsSoldOut(true);
      } else if (diff <= 0) {
          setTimeLeftStr('🔥 抢购进行中！'); setIsStarted(true);
      } else {
          setIsStarted(false);
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const m = Math.floor((diff / 1000 / 60) % 60);
          const s = Math.floor((diff / 1000) % 60);
          if (d === 0 && h === 0 && m < 10) {
              setTimeLeftStr(`🚨 倒计时 00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
          } else {
              setTimeLeftStr(`⏳ 距开售: ${d}天 ${h}时 ${m}分 ${s}秒`);
          }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [launch]);

  const openBatchModal = async () => {
      Haptics.selectionAsync();
      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) return Alert.alert('提示', '请先登录账号');

         const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
         if (!profile) return;

         const balanceCanBuy = Math.floor(profile.potato_coin_balance / launch.price);
         const stockMax = launch.remaining_supply;
         const finalMax = Math.min(balanceCanBuy, stockMax);

         setMaxCanBuy(finalMax);
         setBuyQuantity('1'); 

         if (finalMax <= 0) {
             Alert.alert('提示', '土豆币余额不足购买一份，或者库存已空！');
         } else {
             setBatchModalVisible(true);
         }
      } catch (e: any) { console.error(e); }
  };

  const executeSingleMint = async () => {
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('账号未登录');

      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance, total_consumed').eq('id', user.id).single();
      if (!profile || profile.potato_coin_balance < launch.price) throw new Error('土豆币钱包余额不足！');

      const { data: colData } = await supabase.from('collections').select('total_minted').eq('id', launch.collection_id).single();
      const newSerial = (colData?.total_minted || 0) + 1;

      const { data: newNft, error: mintErr } = await supabase.from('nfts').insert([{
          collection_id: launch.collection_id,
          owner_id: user.id,
          serial_number: newSerial.toString(),
          status: 'idle'
      }]).select('id').single();
      
      if (mintErr || !newNft) throw new Error('手慢了，没抢到！已经被别人秒了。'); 

      await supabase.from('profiles').update({ 
          potato_coin_balance: profile.potato_coin_balance - launch.price,
          total_consumed: (profile.total_consumed || 0) + launch.price
      }).eq('id', user.id);

      await supabase.from('launch_events').update({ remaining_supply: Math.max(0, launch.remaining_supply - 1) }).eq('id', id);
      await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', launch.collection_id);

      await supabase.from('transfer_logs').insert([{
          nft_id: newNft.id,
          collection_id: launch.collection_id,
          buyer_id: user.id,
          seller_id: null,
          price: launch.price,
          transfer_type: 'launch_mint'
      }]);

      setConfirmModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('🎉 抢购成功！藏品已发放到金库！');
      fetchLaunchData();
      
    } catch (err: any) { 
        setConfirmModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('抢购未成功', err.message);
    } finally { setBuying(false); }
  };

  const executeBatchMint = async () => {
      const qty = parseInt(buyQuantity);
      if (isNaN(qty) || qty <= 0) return Alert.alert('提示', '请输入有效的扫货数量');
      if (qty > launch.remaining_supply) return Alert.alert('抢购失败', '库存已不足，输入数量过多');

      setBuying(true);
      const totalPrice = launch.price * qty;

      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('账号未登录');

          const { data: profile } = await supabase.from('profiles').select('potato_coin_balance, total_consumed').eq('id', user.id).single();
          if (!profile || profile.potato_coin_balance < totalPrice) throw new Error('土豆币余额不足梭哈！');

          const { data: colData } = await supabase.from('collections').select('total_minted').eq('id', launch.collection_id).single();
          const currentTotalMinted = colData?.total_minted || 0;

          const nftsToInsert = Array.from({ length: qty }).map((_, i) => ({
              collection_id: launch.collection_id,
              owner_id: user.id,
              serial_number: (currentTotalMinted + i + 1).toString(), 
              status: 'idle'
          }));

          const { data: insertedNfts, error: mintErr } = await supabase.from('nfts').insert(nftsToInsert).select('id');
          if (mintErr || !insertedNfts || insertedNfts.length !== qty) throw new Error('全网网络拥堵，梭哈失败！没抢到这么多藏品，数据库约束已出发防御，资产无损。');

          await supabase.from('profiles').update({ 
              potato_coin_balance: profile.potato_coin_balance - totalPrice,
              total_consumed: (profile.total_consumed || 0) + totalPrice
          }).eq('id', user.id);

          const newTotalCirculating = currentTotalMinted + qty;
          await supabase.from('launch_events').update({ remaining_supply: launch.remaining_supply - qty }).eq('id', id);
          await supabase.from('collections').update({ total_minted: newTotalCirculating, circulating_supply: newTotalCirculating }).eq('id', launch.collection_id);

          const transferLogs = insertedNfts.map(nft => ({
              nft_id: nft.id,
              collection_id: launch.collection_id,
              buyer_id: user.id,
              seller_id: null,
              price: launch.price,
              transfer_type: 'launch_mint'
          }));
          await supabase.from('transfer_logs').insert(transferLogs);

          setBatchModalVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(`🎉 批量抢购成功！${qty} 份藏品已送入您的金库！`);
          fetchLaunchData(); 
          
      } catch (err: any) { 
          setBatchModalVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('抢购未完全完成', err.message);
      } finally { setBuying(false); }
  };

  const changeQty = (type: '+' | '-') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const current = parseInt(buyQuantity) || 1;
      if (type === '+' && current < maxCanBuy) setBuyQuantity((current + 1).toString());
      if (type === '-' && current > 1) setBuyQuantity((current - 1).toString());
  };

  if (loading || !launch) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;
  const progress = ((launch.total_supply - launch.remaining_supply) / launch.total_supply) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}
      
      {/* 🌟 视觉升级：更大的背景，更深的渐变遮罩 */}
      <ImageBackground source={{ uri: launch.collection?.image_url }} style={styles.headerBg} blurRadius={15}>
          <View style={styles.headerOverlay}>
             <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
                <Text style={styles.navTitle}>发售中心</Text>
                <View style={styles.navBtn} />
             </View>
             <View style={styles.heroBox}>
                <Image source={{ uri: launch.collection?.image_url }} style={styles.heroImg} />
                <View style={[styles.timerBadge, isStarted && !isSoldOut ? {backgroundColor: '#FF3B30'} : {backgroundColor: 'rgba(44,30,22,0.8)'}]}>
                   <Text style={styles.timerText}>{timeLeftStr}</Text>
                </View>
             </View>
          </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.infoCard}>
            <Text style={styles.title}>{launch.collection?.name}</Text>
            <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>全岛首发价</Text>
                <Text style={styles.priceValue}>¥ {formatMoney(launch.price)}</Text>
            </View>
            <View style={styles.progressSection}>
                <View style={styles.progressLabels}>
                   <Text style={styles.progressText}>已抢注 {formatMoney(launch.total_supply - launch.remaining_supply).replace('.00','')} 份</Text>
                   <Text style={styles.progressText}>全球限量 {formatMoney(launch.total_supply).replace('.00','')} 份</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {width: `${progress}%`}]} />
                </View>
            </View>
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>👑 发售规则</Text>
            <Text style={styles.ruleText}>1. 采用先到先得模式，全球限量发行，抢完即止。</Text>
            <Text style={styles.ruleText}>2. 抢购成功后，数字资产将实时发放至您的专属金库。</Text>
            <Text style={styles.ruleText}>3. 支持单次抢购和最高性能的一键梭哈扫货模式。</Text>
            <Text style={styles.ruleText}>4. 资产上链行为不可逆，请确保土豆币余额充足。</Text>
          </View>
      </ScrollView>

      {/* 🌟 动作栏升级 */}
      <View style={styles.bottomBar}>
          <TouchableOpacity 
             style={[styles.buyBtnSplit, styles.btnGray, (!isStarted || isSoldOut) && styles.btnDisabled]} 
             onPress={openBatchModal} 
             disabled={!isStarted || isSoldOut || buying}
          >
              <Text style={[styles.buyBtnText, {fontSize: 15, color: '#FFF'}, (!isStarted || isSoldOut) && {color: '#A1887F'}]}>🛒 批量进货</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
             style={[styles.buyBtnSplit, (!isStarted || isSoldOut) && styles.btnDisabled]} 
             onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setConfirmModal(true); }} 
             disabled={!isStarted || isSoldOut || buying}
          >
             {buying ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.buyBtnText, (!isStarted || isSoldOut) && {color: '#A1887F'}]}>{isSoldOut ? '已被抢空' : (isStarted ? '⚡ 立即单抽' : '等待开售')}</Text>}
          </TouchableOpacity>
      </View>

      <Modal visible={confirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>⚡ 确认立即抢购</Text>
                <Text style={styles.confirmDesc}>抢购将从土豆币余额中扣除 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{formatMoney(launch.price)}</Text>。若手速够快，[ {launch.collection?.name} ] 将立刻发放到您的金库，请确认！</Text>
                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>再看看</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={executeSingleMint} disabled={buying}>
                      {buying ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.confirmBtnText, {color: '#FFF'}]}>确认支付</Text>}
                  </TouchableOpacity>
                </View>
            </View>
          </View>
      </Modal>

      <Modal visible={batchModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.confirmBox, { width: '85%' }]}>
                  <Text style={[styles.confirmTitle, {color: '#4E342E'}]}>🛒 梭哈进货引擎 (限购 {maxCanBuy})</Text>
                  
                  <View style={styles.inputGroup}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => changeQty('-')}><Text style={styles.stepBtnText}>-</Text></TouchableOpacity>
                      <TextInput 
                          style={styles.qtyInput}
                          keyboardType="number-pad"
                          value={buyQuantity}
                          onChangeText={(v) => {
                              const num = parseInt(v);
                              if (!num || num <= 0) setBuyQuantity('1');
                              else if (num > maxCanBuy) setBuyQuantity(maxCanBuy.toString());
                              else setBuyQuantity(num.toString());
                          }}
                      />
                      <TouchableOpacity style={styles.stepBtn} onPress={() => changeQty('+')}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#D49A36', marginLeft: 10}]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setBuyQuantity(maxCanBuy.toString()); }}>
                          <Text style={{color: '#FFF', fontWeight: '900'}}>一键梭哈</Text>
                      </TouchableOpacity>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  <View style={styles.priceEstimationRow}>
                      <Text style={{color: '#8D6E63', fontSize: 13, fontWeight: '700'}}>预计扫货总价</Text>
                      <Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {formatMoney(launch.price * (parseInt(buyQuantity) || 0))}</Text>
                  </View>

                  <View style={styles.confirmBtnRow}>
                      <TouchableOpacity style={[styles.cancelBtn]} onPress={() => setBatchModalVisible(false)}><Text style={styles.cancelBtnText}>取消扫货</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#FF3B30'}]} onPress={executeBatchMint} disabled={buying || parseInt(buyQuantity) <= 0}>
                           {buying ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.confirmBtnText, {color: '#FFF'}]}>⚡ 开机扫货</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  headerBg: { width: '100%', height: 380 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, marginTop: 10 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  
  heroBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 20 },
  heroImg: { width: 180, height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#D49A36', marginBottom: 20 },
  timerBadge: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  timerText: { color: '#FFF', fontSize: 15, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  
  scrollContent: { padding: 16, paddingBottom: 100, marginTop: -30 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, marginBottom: 16, shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, borderWidth: 1, borderColor: '#F0E6D2' },
  title: { fontSize: 22, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20, borderBottomWidth: 1, borderColor: '#F5EFE6', paddingBottom: 16 },
  priceLabel: { fontSize: 14, color: '#8D6E63', marginRight: 10, fontWeight: '700' },
  priceValue: { fontSize: 32, fontWeight: '900', color: '#FF3B30' },
  
  progressSection: { width: '100%' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressText: { fontSize: 12, color: '#A1887F', fontWeight: '800' },
  progressBarBg: { height: 10, backgroundColor: '#F5EFE6', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#D49A36', borderRadius: 5 },
  
  ruleCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F0E6D2' },
  ruleTitle: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  ruleText: { fontSize: 13, color: '#8D6E63', lineHeight: 24, marginBottom: 8, fontWeight: '600' },
  
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34, borderTopWidth: 1, borderColor: '#EAE0D5', flexDirection: 'row', justifyContent: 'space-between' },
  buyBtnSplit: { backgroundColor: '#D49A36', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', width: '48%', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 }, 
  btnGray: { backgroundColor: '#4E342E', shadowColor: '#4E342E' }, 
  btnDisabled: { backgroundColor: '#EAE0D5', shadowOpacity: 0 },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16, textAlign: 'center' },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 24, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#111', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, alignSelf: 'center' },
  qtyInput: { width: 70, height: 44, backgroundColor: '#FDF8F0', borderRadius: 8, color: '#4E342E', fontSize: 20, fontWeight: '900', textAlign: 'center', marginHorizontal: 6, borderWidth: 1, borderColor: '#EAE0D5' },
  stepBtn: { width: 44, height: 44, backgroundColor: '#4E342E', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, width: '100%', backgroundColor: '#EAE0D5', marginVertical: 20 },
  priceEstimationRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAE0D5' }
});