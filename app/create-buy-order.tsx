import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FolioArtwork } from '../components/FolioArtwork';
import PageReadState from '../components/PageReadState';
import SeasideButton from '../components/SeasideButton';
import SeasideResultDialog from '../components/SeasideResultDialog';
import SeasideSheet from '../components/SeasideSheet';
import SeasideSurface from '../components/SeasideSurface';
import SeasideTextInput from '../components/SeasideTextInput';
import TradeConfirmDialog from '../components/TradeConfirmDialog';
import { orderError, orderMoney, orderPrice, orderQuantity, orderTotal } from '../constants/order-ui';
import { supabase } from '../supabase';

type Collection = { id: string; name: string; image_url?: string; on_sale_count?: number; floor_price_cache?: number; max_consign_price?: number };
export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colId } = useLocalSearchParams<{ colId?: string | string[] }>();
  const initialId = Array.isArray(colId) ? colId[0] : colId;
  const [activeId, setActiveId] = useState(initialId || '');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [potatoIds, setPotatoIds] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [priceError, setPriceError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [result, setResult] = useState(false);
  const lock = useRef(false);
  const readVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    setLoading(true); setReadError(''); setAccountError(''); setBalance(null);
    try {
      const [list, selected, auth] = await Promise.all([
        supabase.from('collections').select('*').eq('is_tradeable', true),
        activeId ? supabase.from('collections').select('*').eq('id', activeId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        supabase.auth.getUser(),
      ]);
      if (version !== readVersion.current) return;
      if (list.error) throw list.error;
      if (selected.error) throw selected.error;
      if (activeId && !selected.data) throw new Error('该藏品系列暂时无法查看，请返回后重新选择。');
      setCollections(list.data || []); setCollection(selected.data); setUserId(auth.data.user?.id || ''); setPotatoIds([]);
      if (auth.error && auth.error.name !== 'AuthSessionMissingError') setAccountError('登录状态暂时无法读取，请重新加载。');
      if (auth.data.user) {
        const [profile, nfts] = await Promise.all([
          supabase.from('profiles').select('potato_coin_balance').eq('id', auth.data.user.id).single(),
          supabase.from('nfts').select('id, collections(name)').eq('owner_id', auth.data.user.id).eq('status', 'idle'),
        ]);
        if (version !== readVersion.current) return;
        if (profile.error || nfts.error || !profile.data) setAccountError('余额或 Potato卡暂时无法读取，请重新加载。');
        else {
          setBalance(Number(profile.data.potato_coin_balance || 0));
          setPotatoIds((nfts.data || []).filter(n => (Array.isArray(n.collections) ? n.collections[0]?.name : (n.collections as { name?: string })?.name) === 'Potato卡').map(n => n.id));
        }
      }
    } catch (error) { if (version === readVersion.current) setReadError(orderError(error, '藏品系列暂时无法读取。')); }
    finally { if (version === readVersion.current) setLoading(false); }
  }, [activeId]);
  useEffect(() => { void load(); return () => { readVersion.current += 1; }; }, [load]);
  // Existing mode/limit rules retained; this UI pass does not redefine delisting.
  const mode = collection && (collection.on_sale_count || 0) > 0 ? 'buy' : 'bid';
  const action = mode === 'bid' ? '竞价' : '求购';
  const min = mode === 'buy' ? (collection?.floor_price_cache || 0) * .7 : collection?.max_consign_price || 0;
  const max = mode === 'buy' ? collection?.max_consign_price || 999999 : Infinity;
  const parsedPrice = orderPrice(price), parsedQuantity = orderQuantity(quantity);
  const total = orderTotal(parsedPrice, parsedQuantity);
  const insufficient = total !== null && balance !== null && total > balance;
  const check = () => {
    setPriceError(''); setQuantityError(''); setFormError('');
    if (!userId) { router.push('/login'); return; }
    if (!collection) { setFormError('请先选择藏品系列。'); return; }
    if (accountError || balance === null) { setFormError('账户信息尚未读完，请重新加载。'); return; }
    let invalid = false;
    if (parsedPrice === null) { setPriceError('请输入大于 0 的单价，最多保留两位小数。'); invalid = true; }
    else if (parsedPrice < min || parsedPrice > max) { setPriceError(`单价不得低于 ${orderMoney(min)} 土豆币${Number.isFinite(max) ? `，不得高于 ${orderMoney(max)} 土豆币` : ''}。`); invalid = true; }
    if (parsedQuantity === null) { setQuantityError('请输入至少 1 件的整数数量。'); invalid = true; }
    if (invalid) return;
    if (total === null) { setFormError('订单金额过大，请减少数量或单价。'); return; }
    if (insufficient) { setFormError('可用余额不足，请调整价格或数量。'); return; }
    if (!potatoIds.length) { setFormError('发起订单需要 1 张在库的 Potato卡。'); return; }
    setSubmitError(''); setConfirm(true);
  };
  const publish = async () => {
    if (lock.current || needsReview || !collection || parsedPrice === null || parsedQuantity === null || total === null || balance === null) return;
    lock.current = true; setPublishing(true); setSubmitError('');
    let writeStarted = false;
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user || auth.data.user.id !== userId) throw new Error('登录状态已变化，请重新登录后继续。');
      if (balance < total || !potatoIds.length) throw new Error('余额或 Potato卡不足，请返回核对。');
      writeStarted = true;
      const debit = await supabase.from('profiles').update({ potato_coin_balance: balance - total }).eq('id', userId).select('id').maybeSingle();
      if (debit.error) throw debit.error;
      if (!debit.data) throw new Error('未收到处理确认');
      const card = await supabase.from('nfts').update({ status: 'burned' }).eq('id', potatoIds[0]).select('id').maybeSingle();
      if (card.error) throw card.error;
      if (!card.data) throw new Error('未收到处理确认');
      const order = await supabase.from('buy_orders').insert([{ collection_id: collection.id, buyer_id: userId, price: parsedPrice, quantity: parsedQuantity, order_type: mode }]).select('id').maybeSingle();
      if (order.error) throw order.error;
      if (!order.data) throw new Error('未收到处理确认');
      setConfirm(false); setResult(true);
    } catch (error) {
      setNeedsReview(writeStarted);
      setSubmitError(writeStarted ? '订单处理结果暂未确认，请到订单管理核对，暂勿重复提交。' : orderError(error, '发布未完成，填写内容已保留。'));
    } finally { lock.current = false; setPublishing(false); }
  };
  const goOrders = () => { setConfirm(false); setResult(false); router.replace('/my-orders'); };
  const closeConfirm = () => { if (!lock.current) { setConfirm(false); setFormError(needsReview ? submitError : ''); } };
  if (loading || readError) return <PageReadState pageTitle="发起订单" subject="藏品系列" status={loading ? 'loading' : 'error'} fallback="/market" backLabel="返回集市" onRetry={() => void load()} />;
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.nav}><Pressable accessibilityRole="button" accessibilityLabel="返回集市" style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/market')}><Ionicons name="chevron-back" size={26} color="#493D35" /></Pressable><Text accessibilityRole="header" style={styles.title}>{collection ? `发起${action}` : '发起订单'}</Text><View style={styles.back} /></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="选择藏品系列" disabled={publishing || needsReview} onPress={() => { setSearch(''); setPicker(true); }} style={styles.collection}>
        <FolioArtwork uri={collection?.image_url || null} framed={false} style={styles.art} accessibilityLabel="藏品封面" />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name}>{collection?.name || '选择藏品系列'}</Text><Text style={styles.muted}>{collection ? `当前为${action}模式` : '选择后查看出价范围'}</Text></View><Ionicons name="chevron-forward" size={20} color="#789DB4" />
      </Pressable>
      <SeasideTextInput label={collection ? `${action}单价` : '出价单价'} unit="土豆币" placeholder="请输入单件价格" value={price} keyboardType="decimal-pad" editable={!!collection && !publishing && !needsReview} maxLength={14}
        onChangeText={v => { setPrice(v); setPriceError(''); setFormError(''); }} error={priceError} hint={collection ? `最低 ${orderMoney(min)} 土豆币${Number.isFinite(max) ? `，最高 ${orderMoney(max)} 土豆币` : ''}` : '请先选择藏品系列'} />
      <SeasideTextInput label="需求数量" unit="件" placeholder="至少 1 件" value={quantity} keyboardType="number-pad" editable={!!collection && !publishing && !needsReview} maxLength={9}
        onChangeText={v => { setQuantity(v); setQuantityError(''); setFormError(''); }} error={quantityError} hint="成交数量以订单实际记录为准" />
      <View style={styles.summary}><Text style={styles.muted}>预计冻结金额</Text><Text style={styles.amount}>{total === null ? '—' : orderMoney(total)} 土豆币</Text><Text style={styles.muted}>可用余额：{balance === null ? '尚未读取' : `${orderMoney(balance)} 土豆币`}</Text><Text style={styles.muted}>发起消耗：1 张 Potato卡 · 当前在库 {potatoIds.length} 张</Text></View>
      <SeasideSurface kind="notice"><Text style={styles.copy}>确认后将冻结订单金额，并消耗 1 张 Potato卡。提交前请核对藏品、单价和数量。</Text></SeasideSurface>
      {!!accountError && <><Text accessibilityRole="alert" style={styles.error}>{accountError}</Text><SeasideButton label="重新加载" tone="secondary" onPress={() => void load()} /></>}
      {!!formError && <Text accessibilityRole="alert" style={styles.error}>{formError}</Text>}
      {insufficient && <Text accessibilityRole="alert" style={styles.error}>可用余额不足，请调整价格或数量。</Text>}
      {!!userId && !accountError && !potatoIds.length && <SeasideButton label="去集市补齐" tone="secondary" onPress={() => router.push('/market')} />}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom) }]}><SeasideButton label={needsReview ? '查看订单' : !userId ? '登录后继续' : collection ? `核对${action}` : '选择藏品'} tone="transaction" onPress={needsReview ? goOrders : !collection && userId ? () => setPicker(true) : check} disabled={publishing || (!!userId && (!!accountError || insufficient))} /></View>
    <SeasideSheet visible={picker} title="选择藏品系列" onClose={() => setPicker(false)}>
      <SeasideTextInput label="搜索藏品" placeholder="输入藏品名称" value={search} onChangeText={setSearch} />
      {collections.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase())).map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`选择${c.name}`} style={styles.pickRow} onPress={() => { setActiveId(c.id); setPicker(false); setPrice(''); setPriceError(''); setFormError(''); }}><FolioArtwork uri={c.image_url || null} framed={false} style={styles.thumb} accessibilityLabel={`${c.name}封面`} /><View style={{ flex: 1 }}><Text style={styles.name}>{c.name}</Text><Text style={styles.muted}>{(c.on_sale_count || 0) > 0 ? '求购' : '竞价'}</Text></View></Pressable>)}
      {!collections.some(c => c.name.toLowerCase().includes(search.trim().toLowerCase())) && <Text style={styles.muted}>没有找到符合条件的藏品系列</Text>}
    </SeasideSheet>
    <TradeConfirmDialog visible={confirm} title={`确认${action}`} description={`${collection?.name || ''}\n单价 ${orderMoney(parsedPrice)} 土豆币 × ${parsedQuantity || 0} 件\n预计冻结 ${orderMoney(total)} 土豆币，并消耗 1 张 Potato卡。`}
      cancelLabel={needsReview ? '关闭提示' : '返回修改'} confirmLabel={needsReview ? '查看订单' : '确认发布'} busy={publishing} error={submitError} onCancel={closeConfirm} onConfirm={needsReview ? goOrders : publish} />
    <SeasideResultDialog visible={result} title={`${action}已发布`} description={`${collection?.name || ''}\n请在订单管理查看成交进度与处理结果。`} primaryLabel="查看订单" onClose={goOrders} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#FFFDF8' }, nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 12 }, back: { width: 44, height: 44, justifyContent: 'center' }, title: { color: '#493D35', fontSize: 21, fontWeight: '700' }, content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, gap: 22 }, collection: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#F5F0E7', borderRadius: 14 }, art: { width: 64, height: 64 }, name: { color: '#493D35', fontSize: 16, lineHeight: 24, fontWeight: '700' }, muted: { color: '#84786B', fontSize: 14, lineHeight: 23 }, copy: { color: '#74695E', fontSize: 14, lineHeight: 24 }, summary: { gap: 7 }, amount: { color: '#70522D', fontSize: 23, lineHeight: 32, fontWeight: '700' }, error: { color: '#9B4030', fontSize: 14, lineHeight: 23 }, footer: { padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#FFFDF8', borderTopWidth: 1, borderColor: '#E8E1D5' }, pickRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E8E1D5' }, thumb: { width: 52, height: 52 } });
