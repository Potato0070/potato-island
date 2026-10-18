import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import PageReadState from '../components/PageReadState';
import { readFailureFrom, validPageId, type ReadFailure } from '../components/pageReadStatus';
import TradeConfirmDialog from '../components/TradeConfirmDialog';
import SeasideButton from '../components/SeasideButton';
import SeasideTextInput from '../components/SeasideTextInput';
import SeasideSurface from '../components/SeasideSurface';
import SeasideResultDialog from '../components/SeasideResultDialog';

// 💰 千分位金钱格式化
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 24 }}>🥔</Text>
      )}
    </View>
  );
};

export default function PublishConsignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const [nft, setNft] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [readFailure, setReadFailure] = useState<ReadFailure | null>(null);
  const [publishing, setPublishing] = useState(false);
  const mutationLock = useRef(false);
  const [publishError, setPublishError] = useState('');

  const [toastMsg, setToastMsg] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);

  const PLATFORM_FEE_RATE = 0.05; 

  const fetchNft = useCallback(async () => {
    if (!validPageId(id)) { setNft(null); setReadFailure('missing'); setLoading(false); return; }
    setLoading(true);
    setReadFailure(null);
    try {
      const { data, error } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).maybeSingle();
      if (error) throw error;
      setNft(data);
      if (!data) setReadFailure('missing');
    } catch (error) { setReadFailure(readFailureFrom(error)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { fetchNft(); }, [fetchNft]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handlePublishClick = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0 || !/^\d+(\.\d{1,2})?$/.test(price)) return showToast('请输入有效价格，最多保留两位小数');
    
    const maxPrice = nft?.collections?.max_consign_price;
    if (maxPrice && p > maxPrice) {
       return showToast(`该系列最高寄售价为 ${formatMoney(maxPrice)} 土豆币`);
    }
    setPublishError('');
    setConfirmModalVisible(true);
  };

  const executePublish = async () => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPublishing(true);
    setPublishError('');
    try {
      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0 || !/^\d+(\.\d{1,2})?$/.test(price)) throw new Error('请输入有效价格。');
      if (nft.collections?.max_consign_price && p > nft.collections.max_consign_price) throw new Error('价格超过该系列最高寄售价。');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('请重新登录后上架。');
      if (nft.owner_id !== user.id) throw new Error('只能上架自己的藏品。');
      const { data, error } = await supabase.from('nfts').update({ status: 'listed', consign_price: p })
        .eq('id', id).eq('owner_id', user.id).eq('status', 'idle').select('id, status, consign_price').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('藏品状态已变化，请返回金库核对后再试。');
      
      setConfirmModalVisible(false);
      setSuccessModal({ title: '上架成功', msg: '藏品已发布到集市，可在金库查看寄售状态。' });

    } catch (err: unknown) {
       setPublishError(err instanceof Error ? err.message : '上架未能完成，价格已保留。请核对藏品状态后重试。');
    } finally {
       mutationLock.current = false;
       setPublishing(false); 
    }
  };

  if (loading || readFailure || !nft) return <PageReadState pageTitle="发布寄售" subject="这件藏品" status={loading ? 'loading' : readFailure || 'missing'} fallback="/(tabs)/profile" backLabel="返回金库" onRetry={fetchNft} />;

  const parsedPrice = /^\d+(\.\d{1,2})?$/.test(price) && Number.isFinite(Number(price)) ? Number(price) : 0;
  const fee = parsedPrice * PLATFORM_FEE_RATE;
  const income = parsedPrice - fee;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布寄售</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
        <View style={styles.targetHeader}>
           <FallbackImage uri={nft.collections?.image_url} style={styles.targetImg} />
           <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{nft.collections?.name}</Text>
              <Text style={styles.targetSub}>唯一编号: #{String(nft.serial_number).padStart(6, '0')}</Text>
              <Text style={styles.targetSubHighlight}>最高寄售价：{nft.collections?.max_consign_price ? `${formatMoney(nft.collections.max_consign_price)} 土豆币` : '无限制'}</Text>
           </View>
        </View>

        <View style={styles.inputBox}>
           <SeasideTextInput label="寄售价格" unit="土豆币" editable={!publishing} hint="请输入大于 0 的金额，最多保留两位小数。"
              placeholder="请输入寄售价格" keyboardType="decimal-pad" value={price}
              onChangeText={(val) => setPrice(val.replace(/[^0-9.]/g, ''))} />
        </View>

        <View style={styles.feeBox}>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>挂单金额</Text>
              <Text style={styles.feeValue}>{formatMoney(parsedPrice)} 土豆币</Text>
           </View>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>创作者版税 (5%)</Text>
              {/* 🌟 红色预警版税，并加上负号 */}
              <Text style={[styles.feeValue, {color: '#FF3B30'}]}>- {formatMoney(fee)} 土豆币</Text>
           </View>
           <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeLabelTotal}>预计到手收益</Text>
              <Text style={styles.feeValueTotal}>{formatMoney(income)} 土豆币</Text>
           </View>
        </View>

        <SeasideSurface kind="notice" style={{ marginBottom: 20 }}><Text style={{ color: '#74695E', fontSize: 14, lineHeight: 23 }}>上架后暂不能转赠；撤回寄售后可继续转赠。成交后收益进入您的土豆币金库。</Text></SeasideSurface>
        <SeasideButton label="核对寄售" tone="transaction" onPress={handlePublishClick} disabled={publishing || parsedPrice <= 0} />
      </ScrollView>

      <TradeConfirmDialog visible={confirmModalVisible} title="确认寄售" confirmLabel="确认上架"
        description={`寄售价格：${formatMoney(parsedPrice)} 土豆币\n扣除版税后预计到手：${formatMoney(income)} 土豆币。\n上架后暂不能转赠，撤回寄售后恢复。`}
        error={publishError} busy={publishing} onCancel={() => { if (!mutationLock.current) setConfirmModalVisible(false); }} onConfirm={executePublish} />

      <SeasideResultDialog visible={!!successModal} title={successModal?.title || ''} description={successModal?.msg || ''}
        primaryLabel="返回金库" onClose={() => { setSuccessModal(null); router.replace('/(tabs)/profile'); }} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  targetHeader: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#FDF8F0', marginRight: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  targetSub: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace', marginBottom: 6, fontWeight: '700' },
  targetSubHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '900' },

  inputBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.02, shadowRadius: 5 },
  inputLabel: { fontSize: 14, fontWeight: '900', color: '#4E342E' },
  inputField: { fontSize: 32, fontWeight: '900', color: '#D49A36', borderBottomWidth: 1, borderColor: '#EAE0D5', paddingBottom: 10 },

  feeBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#EAE0D5' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  feeLabel: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  feeValue: { fontSize: 13, fontWeight: '900', color: '#4E342E' },
  feeTotalRow: { borderTopWidth: 1, borderColor: '#F5EFE6', paddingTop: 12, marginBottom: 0, alignItems: 'center' },
  feeLabelTotal: { fontSize: 14, fontWeight: '900', color: '#4E342E' },
  feeValueTotal: { fontSize: 20, fontWeight: '900', color: '#D49A36' },

  hintText: { fontSize: 12, color: '#A1887F', lineHeight: 18, marginBottom: 30, fontWeight: '600' },

  submitBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});
