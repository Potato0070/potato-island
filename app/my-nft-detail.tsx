import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FolioButton from '../components/FolioButton';
import FolioPaperSurface from '../components/FolioPaperSurface';
import { FolioArtwork, FolioSerialTag, FolioStateTag } from '../components/FolioArtwork';
import { OWNED_COLORS, formatIslandTime, itemStatus, money, serialLabel, validateConsignPrice, type OwnedHistory, type OwnedItem } from '../constants/owned-collection';
import { useIslandFonts } from '../hooks/use-island-fonts';
import { supabase } from '../supabase';

const HISTORY_LABELS: Record<string, string> = {
  direct_buy: '集市成交',
  bid_match: '求购撮合',
  launch_mint: '首发获得',
  system_airdrop: '岛屿赠礼',
  '好友转赠': '岛民转赠',
  genesis_mint: '藏品生成',
};

type ResultKind = 'listed' | 'withdrawn';
type ResultState = { kind: ResultKind; price: number };
const EMPTY_NETWORK_ART = require('../assets/owned-collection/f-card-v1/runtime/empty-network-lighthouse.webp');
const CONSIGN_NOTICE_ART = require('../assets/owned-collection/f-card-v1/runtime/consignment-vault-ticket.png');

function artUri(item: OwnedItem) {
  const record = item as OwnedItem & { image_url?: string | null };
  const collection = Array.isArray(item.collections) ? item.collections[0] : item.collections;
  return record.image_url || collection?.image_url || null;
}

function collectionRecord(item: OwnedItem) {
  return Array.isArray(item.collections) ? item.collections[0] : item.collections;
}

export default function MyNftDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fonts = useIslandFonts();
  const [item, setItem] = useState<OwnedItem | null>(null);
  const [logs, setLogs] = useState<OwnedHistory[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const mutationLock = useRef(false);

  const fetchData = useCallback(async () => {
    if (!id) {
      setPageError('没有找到这张藏品的编号');
      setLoading(false);
      return;
    }
    setLoading(true);
    setPageError('');
    try {
      const [{ data: { user }, error: authError }, { data, error: itemError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('nfts').select('*, collections(id, name, image_url, max_consign_price, total_minted, circulating_supply)').eq('id', id).maybeSingle(),
      ]);
      if (authError) throw authError;
      if (itemError) throw itemError;
      setUserId(user?.id || '');
      if (!data) throw new Error('这张藏品档案暂时无法读取');
      setItem(data as unknown as OwnedItem);
      const { data: transferLogs, error: historyError } = await supabase.from('transfer_logs')
        .select('id, nft_id, buyer_id, transfer_type, transfer_time, price')
        .eq('nft_id', id)
        .order('transfer_time', { ascending: false })
        .limit(30);
      if (historyError) console.warn('流转记录暂不可用', historyError.message);
      const events: OwnedHistory[] = [...((transferLogs || []) as OwnedHistory[])];
      if (data.created_at && !events.some((event) => event.transfer_type === 'genesis_mint')) {
        events.push({
          id: 'origin-' + data.id,
          nft_id: data.id,
          buyer_id: null,
          transfer_type: 'genesis_mint',
          transfer_time: data.created_at,
          price: 0,
        });
      }
      setLogs(events.sort((left, right) => new Date(right.transfer_time).getTime() - new Date(left.transfer_time).getTime()));
    } catch (cause) {
      console.error('藏品档案读取失败', cause);
      setPageError(cause instanceof Error ? cause.message : '藏品档案暂时无法打开');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const closePriceSheet = () => {
    if (busy) return;
    setPriceSheetOpen(false);
    setInlineError('');
  };

  const publishConsign = async () => {
    if (!item || mutationLock.current || busy) return;
    const problem = validateConsignPrice(price, collectionRecord(item)?.max_consign_price);
    if (problem) {
      setInlineError(problem);
      return;
    }
    mutationLock.current = true;
    setBusy(true);
    setInlineError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user || user.id !== userId) throw new Error('登录状态已变化，请重新载入档案');
      const { data: updated, error: updateError } = await supabase.from('nfts')
        .update({ status: 'listed', consign_price: Number(price) })
        .eq('id', item.id)
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .select('id, status, consign_price')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error('这张藏品的状态已变化，请重新载入后再试');
      setItem((current) => current ? { ...current, status: 'listed', consign_price: Number(price) } : current);
      setPriceSheetOpen(false);
      setResult({ kind: 'listed', price: Number(price) });
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : '上架没有完成，请重试');
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };

  const withdrawConsign = async () => {
    if (!item || mutationLock.current || busy) return;
    mutationLock.current = true;
    setBusy(true);
    setInlineError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user || user.id !== userId) throw new Error('登录状态已变化，请重新载入档案');
      const { data: updated, error: updateError } = await supabase.from('nfts')
        .update({ status: 'idle', consign_price: null })
        .eq('id', item.id)
        .eq('owner_id', user.id)
        .eq('status', 'listed')
        .select('id, status')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error('寄售状态已变化，请重新载入后再试');
      setItem((current) => current ? { ...current, status: 'idle', consign_price: null } : current);
      setWithdrawOpen(false);
      setResult({ kind: 'withdrawn', price: Number(item.consign_price || 0) });
    } catch (cause) {
      setInlineError(cause instanceof Error ? cause.message : '撤回没有完成，请重试');
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };

  const openConsign = () => {
    setPrice('');
    setInlineError('');
    setPriceSheetOpen(true);
  };

  const isOwner = Boolean(item && userId && item.owner_id === userId);
  const isIdle = item?.status === 'idle';
  const isListed = item?.status === 'listed';
  const statusKey = isIdle ? 'idle' : isListed ? 'listed' : 'other';
  const collection = item ? collectionRecord(item) : null;
  const collectionTitle = collection?.name || '藏品档案';
  const serial = item ? serialLabel(item.serial_number) : '';
  const imageUri = item ? artUri(item) : null;
  const currencyValue = Number(item?.consign_price || 0);
  const history = logs.length ? logs : [];
  const contentWidth = Math.min(width, 760);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={[styles.page, { maxWidth: 760 }]}>
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回藏品册" onPress={() => router.back()} style={styles.backButton}><Ionicons name="chevron-back" size={25} color={OWNED_COLORS.ink} /></Pressable>
          <Text accessibilityRole="header" style={[styles.navTitle, { fontFamily: fonts.semibold }]}>藏品详情</Text>
          <View style={styles.navSpacer} />
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={OWNED_COLORS.blue} /><Text style={styles.loadingText}>正在整理藏品档案…</Text></View> : pageError || !item ? (
          <View style={styles.loading}>
            <Image source={EMPTY_NETWORK_ART} resizeMode="contain" style={styles.errorArt} accessible={false} />
            <Text style={[styles.errorText, { fontFamily: fonts.semibold }]}>{pageError || '藏品档案未找到'}</Text>
            <FolioButton label="重新载入" tone="paper" onPress={() => void fetchData()} style={styles.retryButton} fontFamily={fonts.semibold} />
          </View>
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 30 }]}>
              {!isOwner ? <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={OWNED_COLORS.gold} /><Text style={styles.noticeText}>这张藏品已不在当前金库，操作入口已关闭。</Text></View> : null}
              <View style={[styles.cardStage, { width: Math.min(contentWidth - 38, 540) }]}>
                <FolioPaperSurface kind="paper" style={styles.detailCard}>
                  <FolioArtwork uri={imageUri} framed={false} style={styles.detailArtFrame} accessibilityLabel={`${collectionTitle}封面`} />
                  <View style={styles.detailCardCopy}>
                    <Text style={[styles.detailName, { fontFamily: fonts.semibold }]}>{collectionTitle}</Text>
                    <Text style={styles.detailSerial}>{serial}</Text>
                    <View style={styles.ruleLine} />
                    <View style={styles.cardDataRow}><Text style={styles.dataLabel}>当前状态</Text><Text style={[styles.dataValue, { color: isListed ? OWNED_COLORS.gold : OWNED_COLORS.blue }]}>{itemStatus(item.status)}</Text></View>
                    <View style={styles.cardDataRow}><Text style={styles.dataLabel}>持有人</Text><Text style={styles.dataValue}>{isOwner ? '您自己' : '已转出'}</Text></View>
                    {item.created_at ? <View style={styles.cardDataRow}><Text style={styles.dataLabel}>生成时间</Text><Text style={styles.dataValue}>{formatIslandTime(item.created_at)}</Text></View> : null}
                  </View>
                  {isListed ? <View style={styles.listedPrice}><Text style={styles.listedPriceLabel}>当前寄售价格</Text><Text style={[styles.listedPriceValue, { fontFamily: fonts.semibold }]}>{money(currencyValue)} <Text style={styles.coinUnit}>土豆币</Text></Text></View> : null}
                </FolioPaperSurface>
                <FolioSerialTag value={serial} style={styles.serialTab} fontFamily={fonts.semibold} />
                <FolioStateTag state={statusKey} label={isListed ? '在售' : itemStatus(item.status)} style={styles.detailStateTag} fontFamily={fonts.semibold} />
              </View>

              <View style={styles.provenance}>
                <View style={styles.sectionHeading}>
                  <View><Text style={[styles.sectionTitle, { fontFamily: fonts.semibold }]}>流转记录</Text><Text style={styles.sectionSubtitle}>这张藏品在岛上的足迹</Text></View>
                  <View style={styles.recordCount}><Text style={styles.recordCountText}>{history.length} 条</Text></View>
                </View>
                {history.length === 0 ? <View style={styles.emptyHistory}><Ionicons name="time-outline" size={18} color="#9A8E82" /><Text style={styles.emptyHistoryText}>暂时还没有流转记录</Text></View> : history.map((entry, index) => {
                  const origin = entry.transfer_type === 'genesis_mint';
                  const label = HISTORY_LABELS[entry.transfer_type || ''] || '藏品流转';
                  return (
                    <View key={entry.id} style={styles.historyItem}>
                      <View style={styles.timelineColumn}><View style={[styles.timelineDot, origin && styles.timelineDotOrigin, index === history.length - 1 && styles.timelineDotLast]} />{index < history.length - 1 ? <View style={styles.timelineLine} /> : null}</View>
                      <View style={styles.historyCopy}>
                        <View style={styles.historyTitleRow}><Text style={[styles.historyTitle, { fontFamily: fonts.semibold }]}>{label}</Text>{Number(entry.price || 0) > 0 ? <Text style={[styles.historyPrice, { fontFamily: fonts.semibold }]}>{money(entry.price)} 土豆币</Text> : null}</View>
                        <Text style={styles.historyDate}>{formatIslandTime(entry.transfer_time)}</Text>
                        {origin ? <Text style={styles.historyHint}>在土豆岛生成</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {isOwner ? (
              <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                {isIdle ? (
                  <>
                    <FolioButton label="转赠" tone="paper" pencilIcon="transfer" onPress={() => router.push({ pathname: '/transfer', params: { nftId: item.id } })} style={styles.actionButton} fontFamily={fonts.semibold} />
                    <FolioButton label="寄售" tone="blue" pencilIcon="consign" onPress={openConsign} style={styles.actionButton} fontFamily={fonts.semibold} />
                  </>
                ) : isListed ? (
                  <FolioButton label="撤回寄售" tone="gold" pencilIcon="withdraw" onPress={() => { setInlineError(''); setWithdrawOpen(true); }} style={styles.fullAction} fontFamily={fonts.semibold} />
                ) : (
                  <View style={styles.unavailableAction}><Ionicons name="lock-closed-outline" size={16} color="#93877D" /><Text style={styles.unavailableText}>当前状态暂不支持操作</Text></View>
                )}
              </View>
            ) : null}
          </>
        )}
      </View>

      <Modal visible={priceSheetOpen} transparent animationType="slide" onRequestClose={closePriceSheet}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable accessibilityLabel="关闭寄售面板" style={styles.scrim} onPress={closePriceSheet} />
          <FolioPaperSurface kind="paper" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={[styles.sheetTitle, { fontFamily: fonts.semibold }]}>发布寄售</Text><Text style={styles.sheetSubtitle}>将这张藏品放入土豆岛集市</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭寄售面板" onPress={closePriceSheet} disabled={busy} style={styles.sheetClose}><Ionicons name="close" size={20} color={OWNED_COLORS.ink} /></Pressable>
            </View>
            {item ? <View style={styles.sheetItem}>
              <FolioArtwork uri={imageUri} framed={false} style={styles.sheetArt} accessibilityLabel={`${collectionTitle}封面`} />
              <View style={styles.sheetItemCopy}><Text numberOfLines={1} style={[styles.sheetItemName, { fontFamily: fonts.semibold }]}>{collectionTitle}</Text><Text style={styles.sheetItemSerial}>{serial}</Text><Text style={styles.sheetItemStatus}>{itemStatus(item.status)}</Text></View>
            </View> : null}
            <Text style={[styles.inputLabel, { fontFamily: fonts.semibold }]}>寄售价格 <Text style={styles.inputUnit}>土豆币</Text></Text>
            <View style={[styles.inputWrap, Boolean(inlineError) && styles.inputWrapError]}>
              <TextInput accessibilityLabel="寄售价格" value={price} onChangeText={(value) => { setPrice(value); setInlineError(''); }} placeholder="填写藏品价格" placeholderTextColor="#B0A497" keyboardType="decimal-pad" maxLength={14} style={[styles.priceInput, { fontFamily: fonts.semibold }]} underlineColorAndroid="transparent" selectionColor={OWNED_COLORS.blue} />
              <Text style={styles.inputUnit}>土豆币</Text>
            </View>
            {inlineError ? <Text accessibilityLiveRegion="polite" style={styles.inlineError}>{inlineError}</Text> : collection?.max_consign_price ? <Text style={styles.priceCap}>该系列最高寄售价为 {money(collection.max_consign_price)} 土豆币</Text> : null}
            <View style={styles.listingNotice}><Image source={CONSIGN_NOTICE_ART} resizeMode="contain" style={styles.listingNoticeArt} accessible={false} /><Text style={styles.listingNoticeText}>上架后暂时不能转赠；撤回寄售后会回到金库。</Text></View>
            <FolioButton label="确认上架" tone="blue" pencilIcon="consign" onPress={publishConsign} loading={busy} style={styles.submitButton} fontFamily={fonts.semibold} />
          </FolioPaperSurface>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={withdrawOpen} transparent animationType="fade" onRequestClose={() => !busy && setWithdrawOpen(false)}>
        <View style={styles.centerOverlay}>
          <FolioPaperSurface kind="confirm" style={styles.confirmCard}>
            <Image source={require('../assets/owned-collection/f-card-v1/runtime/icon-withdraw-pencil.webp')} resizeMode="contain" style={styles.confirmIllustration} accessible={false} />
            <Text style={[styles.confirmTitle, { fontFamily: fonts.semibold }]}>撤回这张寄售藏品？</Text>
            <Text style={styles.confirmDescription}>撤回后，藏品会回到金库并恢复转赠。当前寄售价将一并取消。</Text>
            {item ? <View style={styles.confirmItem}>
              <FolioArtwork uri={imageUri} framed={false} style={styles.confirmArt} accessibilityLabel={`${collectionTitle}封面`} />
              <View style={styles.confirmItemCopy}><Text numberOfLines={1} style={[styles.confirmItemName, { fontFamily: fonts.semibold }]}>{collectionTitle}</Text><Text style={styles.confirmItemSerial}>{serial}</Text></View>
              <Text style={[styles.confirmItemPrice, { fontFamily: fonts.semibold }]}>{money(currencyValue)}</Text>
            </View> : null}
            {inlineError ? <Text accessibilityLiveRegion="polite" style={styles.inlineError}>{inlineError}</Text> : null}
            <View style={styles.confirmActions}>
              <FolioButton label="保留寄售" tone="paper" onPress={() => setWithdrawOpen(false)} disabled={busy} style={styles.confirmButton} fontFamily={fonts.semibold} />
              <FolioButton label="确认撤回" tone="gold" pencilIcon="withdraw" onPress={withdrawConsign} loading={busy} style={styles.confirmButton} fontFamily={fonts.semibold} />
            </View>
          </FolioPaperSurface>
        </View>
      </Modal>

      <Modal visible={Boolean(result)} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={styles.centerOverlay}>
          <FolioPaperSurface kind="result" style={styles.resultCard}>
            <Image source={result?.kind === 'listed' ? require('../assets/owned-collection/f-card-v1/runtime/island-market-stall.webp') : require('../assets/owned-collection/f-card-v1/runtime/island-archive-tray.webp')} resizeMode="contain" style={styles.resultArt} accessible={false} />
            <Text style={[styles.resultTitle, { fontFamily: fonts.semibold }]}>{result?.kind === 'listed' ? '上架成功' : '已收回金库'}</Text>
            <Text style={styles.resultSubtitle}>{result?.kind === 'listed' ? '这张藏品已经加入土豆岛集市' : '寄售已撤回，藏品回到了你的金库'}</Text>
            {item ? <View style={styles.resultSummary}>
              <FolioArtwork uri={imageUri} framed={false} style={styles.resultThumb} accessibilityLabel={`${collectionTitle}封面`} />
              <View style={styles.resultCopy}><Text numberOfLines={1} style={[styles.resultName, { fontFamily: fonts.semibold }]}>{collectionTitle} · {serial}</Text><Text style={styles.resultMeta}>{result?.kind === 'listed' ? '寄售价格' : '原寄售价'}</Text></View>
              <Text style={[styles.resultPrice, { fontFamily: fonts.semibold }]}>{money(result?.price || 0)}</Text>
            </View> : null}
            <View style={styles.resultActions}>
              <FolioButton label="继续查看" tone="paper" pencilIcon="album" onPress={() => setResult(null)} style={styles.resultButton} fontFamily={fonts.semibold} />
              <FolioButton label="返回藏品册" tone="blue" pencilIcon="collection" onPress={() => { setResult(null); router.back(); }} style={styles.resultButton} fontFamily={fonts.semibold} />
            </View>
          </FolioPaperSurface>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  page: { flex: 1, alignSelf: 'center', width: '100%', backgroundColor: '#FFFFFF' },
  navBar: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { color: OWNED_COLORS.ink, fontSize: 19, lineHeight: 26 },
  navSpacer: { width: 44, height: 44 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  loadingText: { color: '#8D8175', fontSize: 13, lineHeight: 18 },
  errorText: { color: OWNED_COLORS.ink, fontSize: 16, textAlign: 'center' },
  errorArt: { width: 194, height: 145 },
  retryButton: { width: 146, minHeight: 46, marginTop: 6 },
  scrollContent: { alignItems: 'center', paddingTop: 5, paddingHorizontal: 20 },
  notice: { width: '100%', maxWidth: 540, minHeight: 42, padding: 10, borderRadius: 11, backgroundColor: '#FCF6E9', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  noticeText: { color: '#7F6C4F', flex: 1, fontSize: 12, lineHeight: 17 },
  cardStage: { alignSelf: 'center', minHeight: 500, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 15, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  detailCard: { width: '100%', paddingHorizontal: 21, paddingVertical: 22 },
  detailArtFrame: { width: '100%', marginBottom: 9 },
  detailCardCopy: { paddingHorizontal: 7, paddingTop: 4 },
  detailName: { color: OWNED_COLORS.ink, fontSize: 19, lineHeight: 26 },
  detailSerial: { color: OWNED_COLORS.blue, fontSize: 13, lineHeight: 19, marginTop: 2 },
  ruleLine: { height: 1, backgroundColor: '#ECE5DC', marginVertical: 10 },
  cardDataRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataLabel: { color: '#95887B', fontSize: 12 },
  dataValue: { color: OWNED_COLORS.ink, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  listedPrice: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderColor: '#ECE5DC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listedPriceLabel: { color: '#8D8175', fontSize: 12 },
  listedPriceValue: { color: OWNED_COLORS.gold, fontSize: 19 },
  coinUnit: { color: '#8D8175', fontSize: 11 },
  serialTab: { position: 'absolute', right: 0, top: '22%', zIndex: 3 },
  detailStateTag: { position: 'absolute', right: 1, top: '48%', zIndex: 3 },
  provenance: { width: '100%', maxWidth: 540, paddingHorizontal: 6, paddingTop: 15, paddingBottom: 11 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sectionTitle: { color: OWNED_COLORS.ink, fontSize: 18, lineHeight: 24 },
  sectionSubtitle: { color: '#968A7D', fontSize: 12, lineHeight: 17, marginTop: 2 },
  recordCount: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F4F0EA' },
  recordCountText: { color: '#8D8175', fontSize: 11 },
  emptyHistory: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 11, backgroundColor: '#FAF8F4' },
  emptyHistoryText: { color: '#95887B', fontSize: 12 },
  historyItem: { minHeight: 53, flexDirection: 'row' },
  timelineColumn: { width: 22, alignItems: 'center' },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: OWNED_COLORS.blue, borderWidth: 1, borderColor: '#FFFFFF', zIndex: 1 },
  timelineDotOrigin: { backgroundColor: OWNED_COLORS.gold },
  timelineDotLast: { borderColor: '#EAE4DC' },
  timelineLine: { position: 'absolute', top: 11, bottom: -2, width: 1, backgroundColor: '#E3DACE' },
  historyCopy: { flex: 1, paddingBottom: 12, paddingLeft: 2 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyTitle: { color: OWNED_COLORS.ink, fontSize: 13, lineHeight: 18 },
  historyPrice: { color: OWNED_COLORS.gold, fontSize: 12, lineHeight: 17 },
  historyDate: { color: '#988B7D', fontSize: 11, lineHeight: 16, marginTop: 2 },
  historyHint: { color: '#9A8E82', fontSize: 11, lineHeight: 16 },
  bottomBar: { minHeight: 68, paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderColor: '#EBE5DD', backgroundColor: 'rgba(255,255,255,0.98)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionButton: { flex: 1, minHeight: 48 },
  fullAction: { flex: 1, minHeight: 48 },
  unavailableAction: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  unavailableText: { color: '#93877D', fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,37,31,0.28)' },
  sheet: { width: '100%', maxHeight: '90%', paddingHorizontal: 31, paddingTop: 16 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: '#D9D1C6', marginBottom: 15 },
  sheetHeader: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderColor: '#F0EBE4' },
  sheetTitle: { color: OWNED_COLORS.ink, fontSize: 19, lineHeight: 26 },
  sheetSubtitle: { color: '#8E8175', fontSize: 12, lineHeight: 18, marginTop: 3 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F4EF', alignItems: 'center', justifyContent: 'center' },
  sheetItem: { minHeight: 68, marginVertical: 17, padding: 8, borderRadius: 13, borderWidth: 1, borderColor: '#EAE3D9', backgroundColor: '#FCFAF6', flexDirection: 'row', alignItems: 'center' },
  sheetArt: { width: 51, height: 51, borderRadius: 8 },
  sheetItemCopy: { flex: 1, paddingHorizontal: 11 },
  sheetItemName: { color: OWNED_COLORS.ink, fontSize: 14, lineHeight: 19 },
  sheetItemSerial: { color: OWNED_COLORS.blue, fontSize: 11, lineHeight: 16, marginTop: 1 },
  sheetItemStatus: { color: '#988B7D', fontSize: 10, lineHeight: 14, marginTop: 1 },
  inputLabel: { color: OWNED_COLORS.ink, fontSize: 14, lineHeight: 20, marginBottom: 9 },
  inputUnit: { color: '#95887B', fontSize: 12 },
  inputWrap: { minHeight: 55, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D8CBBB', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' },
  inputWrapError: { borderColor: '#C8907D', backgroundColor: '#FFFBF9' },
  priceInput: { flex: 1, minWidth: 0, height: 52, padding: 0, borderWidth: 0, outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', color: OWNED_COLORS.ink, fontSize: 22 },
  inlineError: { color: '#A65349', fontSize: 12, lineHeight: 18, marginTop: 8 },
  priceCap: { color: OWNED_COLORS.blue, fontSize: 12, lineHeight: 18, marginTop: 8 },
  listingNotice: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15, marginBottom: 15, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, borderWidth: 1, borderColor: '#E9E0D4', backgroundColor: '#FCFAF6' },
  listingNoticeArt: { width: 39, height: 39, flexShrink: 0 },
  listingNoticeText: { flex: 1, color: '#74685E', fontSize: 12, lineHeight: 17 },
  submitButton: { width: '100%', minHeight: 50 },
  centerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(42,37,31,0.30)' },
  confirmCard: { width: '100%', maxWidth: 440, paddingHorizontal: 29, paddingVertical: 26, alignItems: 'stretch' },
  confirmIllustration: { width: 56, height: 56, alignSelf: 'center', marginBottom: 10 },
  confirmTitle: { color: OWNED_COLORS.ink, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  confirmDescription: { color: '#8C8074', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 15 },
  confirmItem: { minHeight: 67, padding: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#EAE3D9', backgroundColor: '#FCFAF6' },
  confirmArt: { width: 49, height: 49, borderRadius: 7 },
  confirmItemCopy: { flex: 1, paddingHorizontal: 10 },
  confirmItemName: { color: OWNED_COLORS.ink, fontSize: 13, lineHeight: 18 },
  confirmItemSerial: { color: '#95887B', fontSize: 11, lineHeight: 16 },
  confirmItemPrice: { color: OWNED_COLORS.gold, fontSize: 13 },
  confirmActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  confirmButton: { flex: 1, minHeight: 46, minWidth: 0 },
  resultCard: { width: '100%', maxWidth: 440, paddingHorizontal: 26, paddingVertical: 23, alignItems: 'center' },
  resultArt: { width: 174, height: 146, marginTop: 2 },
  resultTitle: { color: OWNED_COLORS.ink, fontSize: 22, lineHeight: 29, marginTop: 1 },
  resultSubtitle: { color: '#8B7E72', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 2, marginBottom: 15 },
  resultSummary: { width: '100%', minHeight: 68, padding: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#EAE3D9', backgroundColor: '#FCFAF6' },
  resultThumb: { width: 50, height: 50, borderRadius: 8 },
  resultCopy: { flex: 1, paddingHorizontal: 9 },
  resultName: { color: OWNED_COLORS.ink, fontSize: 12, lineHeight: 17 },
  resultMeta: { color: '#93877D', fontSize: 11, lineHeight: 15, marginTop: 2 },
  resultPrice: { color: OWNED_COLORS.gold, fontSize: 13 },
  resultActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 18 },
  resultButton: { flex: 1, minWidth: 0, minHeight: 46 },
});
