import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import PageReadState from '../components/PageReadState';
import TradeConfirmDialog from '../components/TradeConfirmDialog';
import SeasideButton from '../components/SeasideButton';
import SeasideSheet from '../components/SeasideSheet';
import SeasideTextInput from '../components/SeasideTextInput';
import SeasideResultDialog from '../components/SeasideResultDialog';
import { readFailureFrom, validPageId, type ReadFailure } from '../components/pageReadStatus';

const { width } = Dimensions.get('window');

// 💰 千分位金额
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const TYPE_MAP: Record<string, string> = {
  'direct_buy': '现货扫单',
  'bid_match': '求购撮合',
  'launch_mint': '首发盲盒',
  'system_airdrop': '系统空投',
  '好友转赠': '私下转赠',
  'genesis_mint': '创世发行'
};

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
           <Text style={{ fontSize: 32 }}>🥔</Text>
        </View>
      )}
    </View>
  );
};

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [nft, setNft] = useState<any>(null);
  const [readFailure, setReadFailure] = useState<ReadFailure | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');

  const [currentHistory, setCurrentHistory] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [historyMode, setHistoryMode] = useState<'current' | 'all'>('current');

  const [showPayModal, setShowPayModal] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [balanceReady, setBalanceReady] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const mutationLock = useRef(false);

  const [listModalVisible, setListModalVisible] = useState(false);
  const [listStep, setListStep] = useState<1 | 2>(1);
  const [listPrice, setListPrice] = useState('');

  const [cancelListModal, setCancelListModal] = useState(false);
  const [transferTipModal, setTransferTipModal] = useState(false);

  const [listing, setListing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);

  const showToast = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchData = useCallback(async () => {
    if (!validPageId(id)) { setNft(null); setReadFailure('missing'); setLoading(false); return; }
    try {
      setLoading(true);
      setReadFailure(null);
      const { data: { user } } = await supabase.auth.getUser();
      setMyUserId(user?.id || '');
      setBalanceReady(false);
      if (user) {
         setMyUserId(user.id);
         const { data: prof } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
         if (prof) { setUserBalance(prof.potato_coin_balance); setBalanceReady(true); }
      }

      const { data: nftData, error: nftErr } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).maybeSingle();
      if (nftErr) throw nftErr;
      if (!nftData) { setNft(null); setReadFailure('missing'); return; }
      setNft(nftData);

      // 1. 当前卡片的流水 + 创世出生记录
      const { data: currHist } = await supabase.from('transfer_logs')
        .select('*')
        .eq('nft_id', id)
        .order('transfer_time', { ascending: false });

      const genesisLog = {
         id: 'genesis_' + nftData.id,
         buyer_id: 'system',
         transfer_type: 'genesis_mint',
         transfer_time: nftData.created_at,
         price: 0,
         nft_id: nftData.id
      };
      setCurrentHistory([...(currHist || []), genesisLog]);

      // 2. 整个系列的流水 + 创世记录混编
      if (nftData?.collection_id) {
         const { data: realAllHist } = await supabase.from('transfer_logs')
           .select('*')
           .eq('collection_id', nftData.collection_id)
           .order('transfer_time', { ascending: false })
           .limit(30);

         const { data: allNfts } = await supabase.from('nfts')
           .select('id, created_at')
           .eq('collection_id', nftData.collection_id)
           .order('created_at', { ascending: false })
           .limit(30);

         const genesisAllHist = (allNfts || []).map(n => ({
            id: 'genesis_' + n.id,
            buyer_id: 'system',
            transfer_type: 'genesis_mint',
            transfer_time: n.created_at,
            price: 0,
            nft_id: n.id
         }));

         const combinedAll = [...(realAllHist || []), ...genesisAllHist]
            .sort((a, b) => new Date(b.transfer_time).getTime() - new Date(a.transfer_time).getTime())
            .slice(0, 30);

         setAllHistory(combinedAll);
      }
    } catch(e: any) {
      setReadFailure(readFailureFrom(e));
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const executeBuy = async () => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setTradeError('');
    setBuying(true);
    try {
      if (userBalance < nft.consign_price) throw new Error('您的钱包余额不足，请先充值！');
      const { error } = await supabase.rpc('execute_trade', { p_nft_id: nft.id, p_buyer_id: myUserId });
      if (error) throw error;
      setShowPayModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
         setSuccessModal({ title: '购买成功', msg: '藏品已加入金库，可前往查看。' });
      }, 400);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTradeError(err?.message || '交易未能完成，请核对订单后重试。');
    } finally { mutationLock.current = false; setBuying(false); }
  };

  const handleListNextStep = () => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
     const p = Number(listPrice);
     if (!Number.isFinite(p) || p <= 0 || !/^\d+(\.\d{1,2})?$/.test(listPrice)) return setTradeError('请输入大于 0 的金额，最多保留两位小数。');
     const maxLimit = nft.collections?.max_consign_price;
     if (maxLimit && p > maxLimit) {
        return setTradeError(`该系列最高寄售价为 ${formatMoney(maxLimit)} 土豆币。`);
     }
     setTradeError('');
     setListStep(2);
  };

  const executeList = async () => {
     if (mutationLock.current) return;
     mutationLock.current = true;
     setTradeError('');
     setListing(true);
     try {
        const { error } = await supabase.from('nfts').update({ status: 'listed', consign_price: parseFloat(listPrice) }).eq('id', nft.id);
        if (error) throw error;
        setListModalVisible(false);
        setListPrice('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
           setSuccessModal({ title: '上架成功', msg: '藏品已加入土豆岛集市。' });
           fetchData();
        }, 400);
     } catch(e: any) { setTradeError(e?.message || '上架未能完成，价格已保留。'); } finally { mutationLock.current = false; setListing(false); }
  };

  const executeCancelList = async () => {
     if (mutationLock.current) return;
     mutationLock.current = true;
     setTradeError('');
     setListing(true);
     try {
       const { error } = await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', nft.id);
       if (error) throw error;
       setCancelListModal(false);
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
       setTimeout(() => {
          setSuccessModal({ title: '撤回成功', msg: '寄售已撤回，藏品已回到金库。' });
          fetchData();
       }, 400);
     } catch (e: any) { setTradeError(e?.message || '撤回未能完成，请重试。'); } finally { mutationLock.current = false; setListing(false); }
  };

  const handleTransfer = () => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
     try { router.push({ pathname: '/transfer', params: { nftId: nft.id } }); } catch (e: any) { showToast(e?.message || '转赠页面暂时无法打开，请重试。'); }
  };

  const getAnonymousName = (uid: string) => {
     if (uid === 'system') return '创世中枢网络';
     if (!uid) return '神秘岛民';
     if (uid === myUserId) return '您自己';
     return `匿名藏友_${uid.substring(0, 4).toUpperCase()}`;
  };

  if (loading || readFailure || !nft) return <PageReadState pageTitle="藏品详情" subject="这件藏品" status={loading ? 'loading' : readFailure || 'missing'} fallback="/(tabs)/market" backLabel="返回集市" onRetry={fetchData} />;

  const hashString = (nft.id || '').replace(/-/g, '').toUpperCase();
  const displayHistory = historyMode === 'current' ? currentHistory : allHistory;

  // 🌟 核心：四大状态全方位研判
  const isOwner = myUserId === nft.owner_id;
  const isListed = nft.status === 'listed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回集市" onPress={() => router.canGoBack() ? router.back() : router.replace('/market')} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>藏品档案</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}><FallbackImage uri={nft.collections?.image_url} style={styles.mainImg} /></View>
           <View style={styles.shadowOval} />

           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#D49A36'}]}>
               <Text style={styles.statusBadgeText}>{isListed ? `大盘寄售中 (¥${formatMoney(nft.consign_price)})` : '金库锁定状态'}</Text>
           </View>
        </View>

        <View style={styles.infoSection}>
           <Text style={styles.colName}>{nft.collections?.name}</Text>
           <Text style={styles.supplyText}>发行 {formatMoney(nft.collections?.total_minted).replace('.00','')} | 流通 {formatMoney(nft.collections?.circulating_supply).replace('.00','')}</Text>
           <View style={styles.infoRow}><Text style={styles.infoLabel}>唯一编码</Text><Text style={styles.infoValueHigh}>#{String(nft.serial_number).padStart(6, '0')}</Text></View>
           <View style={styles.infoRow}><Text style={styles.infoLabel}>持有人</Text><Text style={[styles.infoValue, isOwner && {color: '#D49A36'}]}>{isOwner ? '👑 您自己' : '🔒 其他藏友'}</Text></View>
           <View style={styles.infoRow}><Text style={styles.infoLabel}>底层哈希</Text><Text style={styles.infoHash} numberOfLines={1}>{hashString.substring(0, 10)}...{hashString.substring(hashString.length - 10)}</Text></View>
        </View>

        <View style={styles.historySection}>
           <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>流转溯源</Text>
              <TouchableOpacity style={styles.historySwitch} onPress={() => { Haptics.selectionAsync(); setHistoryMode(historyMode === 'current' ? 'all' : 'current'); }}>
                 <Text style={styles.historySwitchText}>{historyMode === 'current' ? '当前单卡溯源 ⇌' : '全系列大盘溯源 ⇌'}</Text>
              </TouchableOpacity>
           </View>

           {displayHistory.length === 0 ? (
             <Text style={{textAlign: 'center', color: '#A1887F', paddingVertical: 20, fontWeight: '700'}}>暂无流转记录</Text>
           ) : (
             displayHistory.map((log) => (
                <View key={log.id} style={styles.historyRow}>
                   <View style={styles.historyLeft}>
                      <Text style={[styles.historyUser, log.buyer_id === 'system' && {color: '#D49A36'}, log.buyer_id === myUserId && {color: '#FF3B30'}]}>
                          {getAnonymousName(log.buyer_id)}
                      </Text>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                         <View style={[styles.historyTypeTag, log.transfer_type === 'genesis_mint' && {backgroundColor: '#FFFDF5', borderColor: '#D49A36'}]}>
                            <Text style={[styles.historyTypeText, log.transfer_type === 'genesis_mint' && {color: '#D49A36'}]}>
                               {TYPE_MAP[log.transfer_type] || '交易流转'}
                            </Text>
                         </View>
                         <Text style={styles.historyTime}>{new Date(log.transfer_time).toLocaleString()}</Text>
                      </View>
                   </View>
                   <View style={{alignItems: 'flex-end'}}>
                      <Text style={[styles.historyPrice, log.price === 0 && {color: '#A1887F', fontSize: 14}]}>
                         {log.price > 0 ? `¥ ${formatMoney(log.price)}` : '-'}
                      </Text>
                      {historyMode === 'all' && (
                         <Text style={{fontSize: 10, color: '#A1887F', fontFamily: 'monospace', marginTop: 2, fontWeight: '600'}}>
                            #{log.nft_id.substring(0,6).toUpperCase()}
                         </Text>
                      )}
                   </View>
                </View>
             ))
           )}
        </View>
      </ScrollView>

      {/* ================= 🌟 核心：四大状态自适应动作栏 ================= */}

      {/* 状态 1：别人的卡 + 正在寄售 -> 显示购买 */}
      {(!isOwner && isListed) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
           <View><Text style={{color: '#8D6E63', fontSize: 12, fontWeight: '800'}}>寄售一口价</Text><Text style={{color: '#FF3B30', fontSize: 24, fontWeight: '900'}}>¥ {formatMoney(nft.consign_price)}</Text></View>
           <SeasideButton label="立即购买" tone="transaction" style={{ flexGrow: 1 }} onPress={() => { setTradeError(''); setShowPayModal(true); }} />
        </View>
      )}

      {/* 状态 2：别人的卡 + 不在寄售 -> 显示求购 */}
      {(!isOwner && !isListed) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
           <View><Text style={{color: '#8D6E63', fontSize: 12, fontWeight: '800'}}>当前状态</Text><Text style={{color: '#4E342E', fontSize: 18, fontWeight: '900'}}>暂不出售</Text></View>
           <SeasideButton label="发起求购" style={{ flexGrow: 1 }} onPress={() => router.push({pathname: '/create-buy-order', params: {colId: nft.collection_id}})} />
        </View>
      )}

      {/* 状态 3：我的卡 + 闲置中 -> 显示转赠和挂单 */}
      {(isOwner && !isListed) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
           <SeasideButton label="转赠" tone="secondary" style={{ flexGrow: 1 }} onPress={() => setTransferTipModal(true)} />
           <SeasideButton label="发布寄售" tone="transaction" style={{ flexGrow: 1 }} onPress={() => { setTradeError(''); setListStep(1); setListPrice(''); setListModalVisible(true); }} />
        </View>
      )}

      {/* 状态 4：我的卡 + 正在寄售 -> 显示撤销 */}
      {(isOwner && isListed) && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
           <View><Text style={{color: '#8D6E63', fontSize: 12, fontWeight: '800'}}>大盘展示价</Text><Text style={{color: '#D49A36', fontSize: 24, fontWeight: '900'}}>¥ {formatMoney(nft.consign_price)}</Text></View>
           {/* 🌟 这里的 processing 已经完美替换为 listing */}
           <SeasideButton label="撤回寄售" tone="danger" style={{ flexGrow: 1 }} onPress={() => { setTradeError(''); setCancelListModal(true); }} loading={listing} />
        </View>
      )}

      {/* ================= 💎 所有关联模态框 ================= */}

      <SeasideSheet visible={listModalVisible && listStep === 1} title="发布寄售" busy={listing}
        onClose={() => { if (!mutationLock.current) setListModalVisible(false); }}
        footer={<SeasideButton label="核对寄售" tone="transaction" onPress={handleListNextStep} disabled={listing} />}>
        <SeasideTextInput label="寄售价格" unit="土豆币" value={listPrice} editable={!listing}
          onChangeText={value => { setListPrice(value.replace(/[^0-9.]/g, '')); setTradeError(''); }}
          keyboardType="decimal-pad" placeholder="请输入寄售价格" error={tradeError}
          hint={nft.collections?.max_consign_price ? `该系列最高寄售价为 ${formatMoney(nft.collections.max_consign_price)} 土豆币。` : '请输入大于 0 的金额，最多保留两位小数。'} />
      </SeasideSheet>
      <TradeConfirmDialog visible={listModalVisible && listStep === 2} title="确认寄售" confirmLabel="确认上架" cancelLabel="修改价格"
        description={`${nft.collections?.name || '藏品'} #${String(nft.serial_number).padStart(6, '0')}\n寄售价格：${formatMoney(listPrice)} 土豆币。上架后暂不能转赠，撤回寄售后恢复。`}
        busy={listing} error={tradeError} onCancel={() => { if (!mutationLock.current) { setTradeError(''); setListStep(1); } }} onConfirm={executeList} />
      <TradeConfirmDialog visible={showPayModal} title="确认购买"
        description={`${nft.collections?.name || '藏品'} #${String(nft.serial_number).padStart(6, '0')}\n支付金额：${formatMoney(nft.consign_price)} 土豆币。\n${!myUserId ? '请登录后继续购买。' : balanceReady ? `可用余额：${formatMoney(userBalance)} 土豆币。` : '余额暂时无法读取，请关闭后重新加载页面。'}`}
        confirmLabel={!myUserId ? '登录后购买' : balanceReady && userBalance < nft.consign_price ? '余额不足' : '确认购买'}
        confirmDisabled={!!myUserId && (!balanceReady || userBalance < nft.consign_price)} busy={buying} error={tradeError}
        onCancel={() => { if (!mutationLock.current) setShowPayModal(false); }}
        onConfirm={() => { if (!myUserId) { setShowPayModal(false); router.push('/login'); } else void executeBuy(); }} />
      <TradeConfirmDialog visible={cancelListModal} title="撤回寄售" cancelLabel="保留寄售" confirmLabel="确认撤回" tone="danger"
        description={`${nft.collections?.name || '藏品'} #${String(nft.serial_number).padStart(6, '0')}\n撤回后藏品保留在金库，当前寄售价将取消，并恢复转赠。`}
        busy={listing} error={tradeError} onCancel={() => { if (!mutationLock.current) setCancelListModal(false); }} onConfirm={executeCancelList} />
      <TradeConfirmDialog visible={transferTipModal} title="前往转赠" confirmLabel="继续填写" tone="primary"
        description="转赠需要 1 张转赠卡。下一页填写接收人并核对藏品，确认后才会执行转赠。"
        onCancel={() => setTransferTipModal(false)} onConfirm={() => { setTransferTipModal(false); handleTransfer(); }} />
      <SeasideResultDialog visible={!!successModal} title={successModal?.title || ''} description={successModal?.msg || ''} primaryLabel="返回金库"
        onClose={() => { setSuccessModal(null); router.replace('/(tabs)/profile'); }} />
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

  stageContainer: { alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#EAE0D5', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  floatBox: { padding: 10, backgroundColor: '#FDF8F0', borderRadius: 16, shadowColor: '#4E342E', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: {width: 0, height: 10}, elevation: 10, zIndex: 2, borderWidth: 1, borderColor: '#D49A36' },
  mainImg: { width: width * 0.45, height: width * 0.45, borderRadius: 8, overflow: 'hidden' },
  shadowOval: { width: width * 0.35, height: 15, backgroundColor: 'rgba(78,52,46,0.1)', borderRadius: '50%', marginTop: 20, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  infoSection: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EAE0D5', marginBottom: 20 },
  colName: { fontSize: 20, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  supplyText: { fontSize: 12, color: '#8D6E63', marginBottom: 16, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: '#F5EFE6' },
  infoLabel: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  infoValue: { fontSize: 14, color: '#4E342E', fontWeight: '900' },
  infoValueHigh: { fontSize: 16, color: '#D49A36', fontWeight: '900', fontFamily: 'monospace' },
  infoHash: { fontSize: 11, color: '#A1887F', fontFamily: 'monospace', width: 180, textAlign: 'right', fontWeight: '600' },

  historySection: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#4E342E' },
  historySwitch: { backgroundColor: '#FDF8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  historySwitchText: { fontSize: 11, color: '#D49A36', fontWeight: '900' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  historyLeft: { flex: 1 },
  historyUser: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  historyTypeTag: { backgroundColor: '#F5EFE6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8, borderWidth: 1, borderColor: '#EAE0D5' },
  historyTypeText: { fontSize: 9, color: '#8D6E63', fontWeight: '900' },
  historyTime: { fontSize: 11, color: '#A1887F', fontWeight: '600' },
  historyPrice: { fontSize: 16, fontWeight: '900', color: '#FF3B30', fontFamily: 'monospace' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', shadowColor: '#4E342E', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05, elevation: 10, borderTopWidth: 1, borderColor: '#EAE0D5' },
  buyBtn: { flex: 1, backgroundColor: '#D49A36', paddingVertical: 14, borderRadius: 25, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  buyText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  actionBtn: { paddingVertical: 14, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  listSheet: { backgroundColor: '#FDF8F0', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomSheet: { backgroundColor: '#FDF8F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: 400 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  sheetContent: { padding: 20 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#F0E6D2' },
  orderImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12, overflow: 'hidden' },
  orderName: { fontSize: 15, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  orderSerial: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace', fontWeight: '700' },
  orderPrice: { fontSize: 18, fontWeight: '900', color: '#FF3B30' },
  payMethodTitle: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 12 },
  payMethodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: '#D49A36', padding: 16, borderRadius: 12, backgroundColor: '#FFFDF5' },
  payMethodName: { fontSize: 15, fontWeight: '900', color: '#D49A36', marginBottom: 4 },
  payMethodSub: { fontSize: 12, color: '#8D6E63', fontWeight: '700' },
  radioChecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D49A36', justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D49A36' },
  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  confirmPayBtn: { backgroundColor: '#D49A36', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  inputField: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 24, fontWeight: '900', color: '#FF3B30', borderWidth: 1, borderColor: '#EAE0D5' },

  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtnOutline: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnOutlineText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#D49A36' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});
