import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [confirmModal, setConfirmModal] = useState(false); // 单抽确认
  
  // 🌟 批量购买专属状态机
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState('1'); 
  const [maxCanBuy, setMaxCanBuy] = useState(1); // 结合库存和余额，动态计算最大可购买

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

  // ⏱️ 倒计时计时器
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

  // 🗂️ 打开批量购买弹窗，先计算能买多少
  const openBatchModal = async () => {
      try {
         const { data: { user } } = await supabase.auth.getUser();
         if (!user) return Alert.alert('提示', '请先登录账号');

         // 1. 查余额
         const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
         if (!profile) return;

         // 2. 结合数据库剩余库存，计算最大能买多少 (余额能买 N 张，网络库存剩余 M 张，取最小值)
         const balanceCanBuy = Math.floor(profile.potato_coin_balance / launch.price);
         const stockMax = launch.remaining_supply;
         const finalMax = Math.min(balanceCanBuy, stockMax);

         setMaxCanBuy(finalMax);
         setBuyQuantity('1'); // 初始设为1

         if (finalMax <= 0) {
             Alert.alert('提示', '土豆币余额不足购买一份，或者库存已空！');
         } else {
             setBatchModalVisible(true);
         }
      } catch (e: any) { console.error(e); }
  };

  // 🌟 单抽抢购逻辑 (保留原有逻辑，优化报错体验)
  const executeSingleMint = async () => {
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('账号未登录');

      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance, total_consumed').eq('id', user.id).single();
      if (!profile || profile.potato_coin_balance < launch.price) throw new Error('土豆币钱包余额不足！');

      const { data: colData } = await supabase.from('collections').select('total_minted').eq('id', launch.collection_id).single();
      const newSerial = (colData?.total_minted || 0) + 1;

      // 强行铸造，数据库 constraints 会确保不生成重复编号，race condition 会在此报错
      const { data: newNft, error: mintErr } = await supabase.from('nfts').insert([{
          collection_id: launch.collection_id,
          owner_id: user.id,
          serial_number: newSerial.toString(),
          status: 'idle'
      }]).select('id').single();
      
      if (mintErr || !newNft) throw new Error('手慢了，没抢到！已经被别人秒了。'); 

      // 扣钱
      await supabase.from('profiles').update({ 
          potato_coin_balance: profile.potato_coin_balance - launch.price,
          total_consumed: (profile.total_consumed || 0) + launch.price
      }).eq('id', user.id);

      // 减库存
      await supabase.from('launch_events').update({ remaining_supply: Math.max(0, launch.remaining_supply - 1) }).eq('id', id);
      await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', launch.collection_id);

      // 写流水
      await supabase.from('transfer_logs').insert([{
          nft_id: newNft.id,
          collection_id: launch.collection_id,
          buyer_id: user.id,
          seller_id: null,
          price: launch.price,
          transfer_type: 'launch_mint'
      }]);

      setConfirmModal(false);
      showToast('🎉 抢购成功！藏品已发放到金库！');
      fetchLaunchData();
      
    } catch (err: any) { 
        setConfirmModal(false);
        Alert.alert('抢购未成功', err.message);
    } finally { setBuying(false); }
  };

  // 🌟 核心战斗单元：性能级全网批量通缩进货引擎 (梭哈扫货逻辑)
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

          // 🌟 1. 团战模式：性能优化Bulk Insert
          const nftsToInsert = Array.from({ length: qty }).map((_, i) => ({
              collection_id: launch.collection_id,
              owner_id: user.id,
              serial_number: (currentTotalMinted + i + 1).toString(), // 顺序编号，数据库有联合唯一约束，race condition 会失败
              status: 'idle'
          }));

          const { data: insertedNfts, error: mintErr } = await supabase.from('nfts').insert(nftsToInsert).select('id');
          if (mintErr || !insertedNfts || insertedNfts.length !== qty) throw new Error('全网网络拥堵，梭哈失败！没抢到这么多藏品，数据库约束已出发防御，资产无损。');

          // 🌟 2. 批量扣除资金和同步消费进度
          await supabase.from('profiles').update({ 
              potato_coin_balance: profile.potato_coin_balance - totalPrice,
              total_consumed: (profile.total_consumed || 0) + totalPrice
          }).eq('id', user.id);

          // 🌟 3. 更新系统库存和发行总量
          const newTotalCirculating = currentTotalMinted + qty;
          await supabase.from('launch_events').update({ remaining_supply: launch.remaining_supply - qty }).eq('id', id);
          await supabase.from('collections').update({ total_minted: newTotalCirculating, circulating_supply: newTotalCirculating }).eq('id', launch.collection_id);

          // 🌟 4. 批量写入钱包账单日志Bulk Insert
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
          showToast(`🎉 批量抢购成功！${qty} 份藏品已送入您的金库！`);
          fetchLaunchData(); // 重新拉取库存和发行量
          
      } catch (err: any) { 
          setBatchModalVisible(false);
          Alert.alert('抢购未完全完成', err.message);
      } finally { setBuying(false); }
  };

  // 🌟 数量增减和梭哈
  const changeQty = (type: '+' | '-') => {
      const current = parseInt(buyQuantity) || 1;
      if (type === '+' && current < maxCanBuy) setBuyQuantity((current + 1).toString());
      if (type === '-' && current > 1) setBuyQuantity((current - 1).toString());
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
            <Text style={styles.ruleText}>3. 支持单次抢购和梭哈扫货模式。</Text>
            <Text style={styles.ruleText}>4. 抢购行为不可逆，请确保余额充足。</Text>
          </View>
      </ScrollView>

      {/* 🌟 修改后的底部动作栏 (左侧批量，右侧立即抢购) */}
      <View style={styles.bottomBar}>
          {/* 左侧：🛒 批量抢购 */}
          <TouchableOpacity 
             style={[styles.buyBtnSplit, styles.btnGray, (!isStarted || isSoldOut) && styles.btnDisabled]} 
             onPress={openBatchModal} 
             disabled={!isStarted || isSoldOut || buying}
          >
              <Text style={[styles.buyBtnText, {fontSize: 15, color: '#FFF'}, (!isStarted || isSoldOut) && {color: '#999'}]}>🛒 批量进货</Text>
          </TouchableOpacity>
          
          {/* 右侧：⚡ 立即单抽 */}
          <TouchableOpacity 
             style={[styles.buyBtnSplit, (!isStarted || isSoldOut) && styles.btnDisabled]} 
             onPress={() => setConfirmModal(true)} 
             disabled={!isStarted || isSoldOut || buying}
          >
            {buying ? <ActivityIndicator color="#111" /> : <Text style={[styles.buyBtnText, (!isStarted || isSoldOut) && {color: '#999'}]}>{isSoldOut ? '已被抢空' : (isStarted ? '⚡ 立即单抽' : '等待开售')}</Text>}
          </TouchableOpacity>
      </View>

      {/* Single抽确认弹窗 */}
      <Modal visible={confirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>⚡ 确认立即抢购 (单抽)</Text>
                <Text style={styles.confirmDesc}>抢购涉及资金变动，将从土豆币余额中扣除 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{launch.price.toFixed(2)}</Text> 購買 [ {launch.collection?.name} ] 一份，请确保余额充足！</Text>
                <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#FFD700'}]} onPress={executeSingleMint} disabled={buying}>
                      {buying ? <ActivityIndicator color="#111" /> : <Text style={[styles.confirmBtnText, {color: '#111'}]}>确认支付</Text>}
                  </TouchableOpacity>
                </View>
            </View>
          </View>
      </Modal>

      {/* 🌟 梭哈扫货批量购买极客输入弹窗 */}
      <Modal visible={batchModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.confirmBox, { width: '85%' }]}>
                  <Text style={[styles.confirmTitle, {color: '#111'}]}>🛒 梭哈进货引擎 (当前限购 {maxCanBuy})</Text>
                  
                  {/* 输入扫货数量 */}
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
                      <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#111', marginLeft: 10}]} onPress={() => setBuyQuantity(maxCanBuy.toString())}>
                          <Text style={{color: '#FFD700', fontWeight: '900'}}>一键梭哈</Text>
                      </TouchableOpacity>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  {/* 总价估算 */}
                  <View style={styles.priceEstimationRow}>
                      <Text style={{color: '#666', fontSize: 13}}>预计扫货总价</Text>
                      <Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {(launch.price * (parseInt(buyQuantity) || 0)).toFixed(2)}</Text>
                  </View>

                  <View style={styles.confirmBtnRow}>
                      <TouchableOpacity style={[styles.cancelBtn]} onPress={() => setBatchModalVisible(false)}><Text style={styles.cancelBtnText}>取消扫货</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#111'}]} onPress={executeBatchMint} disabled={buying || parseInt(buyQuantity) <= 0}>
                           {buying ? <ActivityIndicator color="#FFD700" /> : <Text style={[styles.confirmBtnText, {color: '#FFD700'}]}>⚡ 开机扫货</Text>}
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
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30, borderTopWidth: 1, borderColor: '#F0F0F0', flexDirection: 'row', justifyContent: 'space-between' },
  buyBtnSplit: { backgroundColor: '#FFD700', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', width: '48%' }, // 分割按钮样式
  btnGray: { backgroundColor: '#2C2C2E' }, // 灰底黑字 (批量)
  btnDisabled: { backgroundColor: '#555' },
  buyBtnText: { color: '#111', fontSize: 18, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16, textAlign: 'center' },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#111', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  
  // 🌟 批量输入专属样式
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, alignSelf: 'center' },
  qtyInput: { width: 70, height: 44, backgroundColor: '#F5F5F5', borderRadius: 8, color: '#111', fontSize: 20, fontWeight: '900', textAlign: 'center', marginHorizontal: 6 },
  stepBtn: { width: 44, height: 44, backgroundColor: '#111', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { color: '#FFD700', fontSize: 24, fontWeight: '900' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, width: '100%', backgroundColor: '#F0F0F0', marginVertical: 16 },
  priceEstimationRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, backgroundColor: '#FFF9E6', padding: 12, borderRadius: 12 }
});