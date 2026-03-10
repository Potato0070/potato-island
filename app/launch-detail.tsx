import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

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
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchLaunchData(); }, [id]);

  const showToast = (msg: string) => {
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
         setTimeLeftStr('抢购进行中！'); setIsStarted(true);
      } else {
         setIsStarted(false);
         const d = Math.floor(diff / (1000 * 60 * 60 * 24));
         const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
         const m = Math.floor((diff / 1000 / 60) % 60);
         const s = Math.floor((diff / 1000) % 60);
         setTimeLeftStr(`距离开售还剩: ${d}天 ${h}时 ${m}分 ${s}秒`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [launch]);

  // 🌟 核心修复：先发货，再扣钱，最后写流水加VIP进度！
  const executeMint = async () => {
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('账号未登录');

      // 1. 查余额和当前的 VIP 消费总额
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance, total_consumed').eq('id', user.id).single();
      if (!profile || profile.potato_coin_balance < launch.price) throw new Error('土豆币钱包余额不足！');

      // 2. 查库存和总发行量
      const { data: colData } = await supabase.from('collections').select('total_minted').eq('id', launch.collection_id).single();
      const newSerial = (colData?.total_minted || 0) + 1;

      // 3. 先尝试强行铸造 NFT 并获取插入后的 ID (用于写流水)
      const { data: newNft, error: mintErr } = await supabase.from('nfts').insert([{
         collection_id: launch.collection_id,
         owner_id: user.id,
         serial_number: newSerial.toString(),
         status: 'idle'
      }]).select('id').single();
      
      if (mintErr || !newNft) {
         throw new Error('抢购人数过多，网络拥堵，请再试一次！'); 
      }

      // 4. 🌟 发货成功！扣钱，并同步增加 VIP 的 total_consumed 消费进度！
      await supabase.from('profiles').update({ 
         potato_coin_balance: profile.potato_coin_balance - launch.price,
         total_consumed: (profile.total_consumed || 0) + launch.price
      }).eq('id', user.id);

      // 5. 减库存，增大盘发行量
      await supabase.from('launch_events').update({ remaining_supply: Math.max(0, launch.remaining_supply - 1) }).eq('id', id);
      await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', launch.collection_id);

      // 6. 🌟 写入钱包流水账单！
      await supabase.from('transfer_logs').insert([{
         nft_id: newNft.id,
         collection_id: launch.collection_id,
         buyer_id: user.id,
         seller_id: null, // 首发系统发货没有个人卖家
         price: launch.price,
         transfer_type: 'launch_mint'
      }]);

      setConfirmModal(false);
      showToast('🎉 抢购成功！藏品已发放到金库！');
      fetchLaunchData();
      setTimeout(() => { router.replace('/(tabs)/profile'); }, 1500);
      
    } catch (err: any) { 
       setConfirmModal(false);
       showToast(`抢购失败: ${err.message}`); 
    } finally { setBuying(false); }
  };

  if (loading || !launch) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;
  const progress = ((launch.total_supply - launch.remaining_supply) / launch.total_supply) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}
      <ImageBackground source={{ uri: launch.collection?.image_url }} style={styles.headerBg} blurRadius={20}>
         <View style={styles.headerOverlay}>
            <View style={styles.navBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
               <Text style={styles.navTitle}>发售详情</Text>
               <View style={styles.navBtn} />
            </View>
            <View style={styles.heroBox}>
               <Image source={{ uri: launch.collection?.image_url }} style={styles.heroImg} />
               <View style={styles.timerBadge}><Text style={styles.timerText}>{timeLeftStr}</Text></View>
            </View>
         </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.scrollContent}>
         <View style={styles.infoCard}>
            <Text style={styles.title}>{launch.collection?.name}</Text>
            <View style={styles.priceRow}>
               <Text style={styles.priceLabel}>首发价</Text><Text style={styles.priceValue}>¥ {launch.price.toFixed(2)}</Text>
            </View>
            <View style={styles.progressSection}>
               <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>已抢 {launch.total_supply - launch.remaining_supply} 份</Text>
                  <Text style={styles.progressText}>限量 {launch.total_supply} 份</Text>
               </View>
               <View style={styles.progressBarBg}><View style={[styles.progressBarFill, {width: `${progress}%`}]} /></View>
            </View>
         </View>

         <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>发售规则</Text>
            <Text style={styles.ruleText}>1. 先到先得模式，抢完即止。</Text>
            <Text style={styles.ruleText}>2. 抢购成功后资产将自动发放至您的金库。</Text>
            <Text style={styles.ruleText}>3. 抢购行为不可逆，请确保余额充足。</Text>
         </View>
      </ScrollView>

      <View style={styles.bottomBar}>
         <TouchableOpacity style={[styles.buyBtn, (!isStarted || isSoldOut) && {backgroundColor: '#555'}]} onPress={() => setConfirmModal(true)} disabled={!isStarted || isSoldOut || buying}>
            {buying ? <ActivityIndicator color="#111" /> : <Text style={[styles.buyBtnText, (!isStarted || isSoldOut) && {color: '#999'}]}>{isSoldOut ? '已被抢空' : (isStarted ? '立即抢购' : '等待开售')}</Text>}
         </TouchableOpacity>
      </View>

      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🚀 确认抢购</Text>
               <Text style={styles.confirmDesc}>系统将从您的钱包中扣除 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{launch.price}</Text> 购买现货，是否确认？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  {/* 🌟 就是这里少了个 }，现在补上了！ */}
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#FFD700'}]} onPress={executeMint} disabled={buying}>
                     {buying ? <ActivityIndicator color="#111" /> : <Text style={[styles.confirmBtnText, {color: '#111'}]}>确认支付</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  headerBg: { width: '100%', height: 350 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, marginTop: 10 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  heroBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImg: { width: 180, height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#FFD700', marginBottom: 20 },
  timerBadge: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  timerText: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  scrollContent: { padding: 16, paddingBottom: 100, marginTop: -20 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  title: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20, borderBottomWidth: 1, borderColor: '#F0F0F0', paddingBottom: 16 },
  priceLabel: { fontSize: 13, color: '#666', marginRight: 8 },
  priceValue: { fontSize: 28, fontWeight: '900', color: '#FF3B30' },
  progressSection: { width: '100%' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 12, color: '#888', fontWeight: '600' },
  progressBarBg: { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 4 },
  ruleCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  ruleTitle: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 12 },
  ruleText: { fontSize: 13, color: '#666', lineHeight: 22, marginBottom: 6 },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderTopWidth: 1, borderColor: '#F0F0F0' },
  buyBtn: { backgroundColor: '#FFD700', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  buyBtnText: { color: '#111', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#111', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});