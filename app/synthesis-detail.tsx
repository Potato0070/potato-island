import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

type Requirement = Record<string, any> & {
  id: string;
  req_collection_id: string;
  req_count: number;
  collection?: { name?: string | null; image_url?: string | null } | null;
};

type SynthesisEvent = Record<string, any> & {
  id: string;
  name: string;
  target_collection?: { name?: string | null; image_url?: string | null } | null;
};

type Nft = { id: string; serial_number: number | string };
const COLORS = {
  ink: '#493D35',
  muted: '#94877C',
  line: '#EEE9E3',
  white: '#FFFFFF',
  cream: '#FBFAF8',
  creamDeep: '#F4EEE5',
  blue: '#789DB4',
  blueDark: '#537895',
  bluePale: '#EEF3F7',
  red: '#A77868',
  redPale: '#F7F2EE',
  green: '#6D8872',
  greenPale: '#EEF2ED',
  gold: '#9A6A33',
};

export default function SynthesisDetailScreen() {
  const router = useRouter();
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const isDemoPreview = __DEV__ && (preview === 'review' || preview === 'complete');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [eventData, setEventData] = useState<SynthesisEvent | null>(null);
  const [targetImageFailed, setTargetImageFailed] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [ownedCounts, setOwnedCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);
  const [myIdleNfts, setMyIdleNfts] = useState<Nft[]>([]);
  const [tempSelectedNfts, setTempSelectedNfts] = useState<string[]>([]);
  const [selectedNfts, setSelectedNfts] = useState<Record<number, string[]>>({});
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(''), 2400);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const { data: event, error: eventError } = await supabase
        .from('synthesis_events')
        .select('*, target_collection:target_collection_id(name, image_url)')
        .eq('id', id)
        .single();
      if (eventError) throw eventError;

      const { data: reqRows, error: reqError } = await supabase
        .from('synthesis_requirements')
        .select('*, collection:req_collection_id(name, image_url)')
        .eq('event_id', id);
      if (reqError) throw reqError;

      const normalizedRequirements = (reqRows || []) as Requirement[];
      setEventData(event as SynthesisEvent);
      setTargetImageFailed(false);
      setRequirements(normalizedRequirements);

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user && normalizedRequirements.length) {
        const countEntries = await Promise.all(normalizedRequirements.map(async (req, index) => {
          const { data, error } = await supabase
            .from('nfts')
            .select('id')
            .eq('collection_id', req.req_collection_id)
            .eq('owner_id', authData.user!.id)
            .eq('status', 'idle');
          if (error) return [index, 0] as const;
          return [index, data?.length || 0] as const;
        }));
        setOwnedCounts(Object.fromEntries(countEntries));
      } else {
        setOwnedCounts({});
      }
    } catch (error: any) {
      setErrorMsg(error?.message || '暂时无法加载合成信息');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  useEffect(() => {
    if (!__DEV__ || !requirements.length) return;
    if (preview === 'review') {
      setSelectedNfts(Object.fromEntries(requirements.map((req, index) => [
        index,
        Array.from({ length: Number(req.req_count) || 0 }, (_, nftIndex) => `preview-${req.id}-${nftIndex}`),
      ])));
      setShowConfirm(true);
    } else if (preview === 'complete') {
      setShowSuccess(true);
    }
  }, [preview, requirements]);

  const totalRequired = useMemo(
    () => requirements.reduce((sum, req) => sum + Math.max(0, Number(req.req_count) || 0), 0),
    [requirements],
  );
  const totalSelected = useMemo(
    () => requirements.reduce((sum, _req, index) => sum + (selectedNfts[index]?.length || 0), 0),
    [requirements, selectedNfts],
  );
  const allMaterialsSelected = totalRequired > 0 && totalSelected >= totalRequired;
  const targetImageSize = Math.min(Math.max(width * 0.36, 116), 168);

  const openMaterialPicker = async (reqIndex: number) => {
    setActiveReqIndex(reqIndex);
    setShowPicker(true);
    setMyIdleNfts([]);
    setTempSelectedNfts(selectedNfts[reqIndex] || []);

    const requirement = requirements[reqIndex];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('nfts')
        .select('id, serial_number')
        .eq('collection_id', requirement.req_collection_id)
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .order('serial_number', { ascending: true });
      if (error) throw error;
      setMyIdleNfts((data || []) as Nft[]);
      setOwnedCounts((current) => ({ ...current, [reqIndex]: data?.length || 0 }));
    } catch (error: any) {
      showToast(error?.message || '读取金库藏品失败');
    }
  };

  const toggleTempSelection = (nftId: string) => {
    if (activeReqIndex === null) return;
    const requirement = requirements[activeReqIndex];
    if (tempSelectedNfts.includes(nftId)) {
      setTempSelectedNfts((current) => current.filter((selectedId) => selectedId !== nftId));
      return;
    }
    if (tempSelectedNfts.length >= Number(requirement.req_count)) {
      showToast(`这项材料最多选择 ${requirement.req_count} 个`);
      return;
    }
    setTempSelectedNfts((current) => [...current, nftId]);
  };

  const confirmSelection = () => {
    if (activeReqIndex === null) return;
    setSelectedNfts((current) => ({ ...current, [activeReqIndex]: tempSelectedNfts }));
    setShowPicker(false);
  };

  const selectAllAvailable = () => {
    if (activeReqIndex === null) return;
    const required = Number(requirements[activeReqIndex]?.req_count) || 0;
    setTempSelectedNfts(myIdleNfts.slice(0, required).map((nft) => nft.id));
  };

  const goToMarket = (searchTerm?: string) => {
    setShowPicker(false);
    router.push({ pathname: '/(tabs)/market', params: searchTerm ? { search: searchTerm } : undefined });
  };

  const startSynthesis = () => {
    if (!allMaterialsSelected) {
      const firstIncomplete = requirements.findIndex((req, index) => (selectedNfts[index]?.length || 0) < Number(req.req_count));
      if (firstIncomplete >= 0) openMaterialPicker(firstIncomplete);
      else showToast('请先选择全部合成材料');
      return;
    }
    setShowConfirm(true);
  };

  const executeSynthesis = async () => {
    if (isDemoPreview) {
      setShowConfirm(false);
      setShowSuccess(true);
      return;
    }
    const materialNftIds = requirements.flatMap((_req, index) => selectedNfts[index] || []);
    setSynthesizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录后再合成');
      const { error } = await supabase.rpc('execute_synthesis', {
        p_user_id: user.id,
        p_event_id: id,
        p_material_nft_ids: materialNftIds,
      });
      if (error) throw error;
      setShowConfirm(false);
      setShowSuccess(true);
    } catch (error: any) {
      showToast(`合成未完成：${error?.message || '请稍后重试'}`);
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color={COLORS.blue} /><Text style={styles.loadingText}>正在读取合成配方…</Text></SafeAreaView>;
  }

  if (errorMsg || !eventData) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Ionicons name="cloud-offline-outline" size={36} color={COLORS.muted} />
        <Text style={styles.errorTitle}>合成信息暂时无法显示</Text>
        <Text style={styles.errorMessage}>{errorMsg || '请稍后重试'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDetail}><Text style={styles.retryText}>重新加载</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const shortageItems = requirements.flatMap((req, index) => {
    const shortage = Math.max(0, Number(req.req_count) - (ownedCounts[index] || 0));
    return shortage > 0 ? [{ name: req.collection?.name || '合成材料', count: shortage, reqIndex: index }] : [];
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={25} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>合成详情</Text>
        <View style={styles.backButton} />
      </View>

      {toastMsg ? <View style={styles.toast}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.targetCard}>
              {eventData.target_collection?.image_url && !targetImageFailed ? (
                <Image source={{ uri: eventData.target_collection.image_url }} style={[styles.targetImage, { width: targetImageSize, height: targetImageSize }]} resizeMode="cover" onError={() => setTargetImageFailed(true)} />
              ) : (
                <View style={[styles.targetImagePlaceholder, { width: targetImageSize, height: targetImageSize }]}><Ionicons name="sparkles-outline" size={34} color={COLORS.blue} /></View>
              )}
              <View style={styles.targetInfo}>
                <Text style={styles.targetEyebrow}>目标藏品</Text>
                <Text style={styles.targetName} numberOfLines={2}>{eventData.target_collection?.name || eventData.name}</Text>
                <Text style={styles.targetSeries} numberOfLines={1}>{eventData.name || '土豆岛合成计划'}</Text>
                <Text style={styles.targetStory} numberOfLines={4}>{eventData.description || '收集所需材料，按照配方完成合成。'}</Text>
              </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>所需材料</Text>
          <Text style={styles.sectionHint}>集齐指定材料即可合成</Text>
        </View>
        <View style={styles.materialList}>
          {requirements.map((req, index) => {
                    const chosen = selectedNfts[index]?.length || 0;
                    const required = Number(req.req_count) || 0;
                    const isFull = chosen >= required;
                    return (
                      <TouchableOpacity key={req.id} style={styles.materialRow} activeOpacity={0.82} onPress={() => openMaterialPicker(index)}>
                        {req.collection?.image_url ? (
                          <Image source={{ uri: req.collection.image_url }} style={styles.materialImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.materialImage, styles.materialImagePlaceholder]}><Ionicons name="leaf-outline" size={25} color={COLORS.blue} /></View>
                        )}
                        <View style={styles.materialInfo}>
                          <Text style={styles.materialName} numberOfLines={1}>{req.collection?.name || '未知材料'}</Text>
                          <Text style={styles.materialDesc} numberOfLines={1}>{isFull ? '材料已备齐' : '选择金库中的藏品作为材料'}</Text>
                        </View>
                        <Text style={[styles.materialCount, isFull ? styles.countReady : chosen > 0 ? styles.countPartial : styles.countMissing]}>{chosen}</Text>
                        <Text style={styles.materialTotal}>/ {required}</Text>
                        <View style={[styles.addMaterialButton, isFull && styles.addMaterialButtonReady]}>
                          <Ionicons name={isFull ? 'checkmark' : 'add'} size={27} color={isFull ? COLORS.green : COLORS.blue} />
                        </View>
                      </TouchableOpacity>
                    );
          })}
        </View>

        {shortageItems.length > 0 ? (
          <View style={styles.shortageCard}>
                    <View style={styles.shortageIcon}><Ionicons name="alert" size={19} color={COLORS.white} /></View>
                    <View style={styles.shortageInfo}>
                      <Text style={styles.shortageTitle}>材料还差 {shortageItems.reduce((sum, item) => sum + item.count, 0)} 个</Text>
                      <Text style={styles.shortageSubtitle} numberOfLines={2}>{shortageItems.map((item) => `${item.name} ×${item.count}`).join('、')}</Text>
                    </View>
                    <TouchableOpacity style={styles.marketButton} onPress={() => goToMarket(shortageItems[0]?.name)}>
                      <Text style={styles.marketButtonText}>去集市补齐</Text><Ionicons name="chevron-forward" size={17} color={COLORS.gold} />
                    </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.progressBlock}>
          <View style={styles.progressSummary}>
            <Text style={styles.progressLabel}>材料进度</Text>
            <Text style={styles.progressValue}>{totalSelected} / {totalRequired || 0}</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${totalRequired ? Math.min(100, (totalSelected / totalRequired) * 100) : 0}%` }]} /></View>
        </View>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => {
          const firstIncomplete = requirements.findIndex((req, index) => (selectedNfts[index]?.length || 0) < Number(req.req_count));
          if (firstIncomplete >= 0) openMaterialPicker(firstIncomplete);
          else if (requirements.length) openMaterialPicker(0);
          else showToast('当前配方尚未配置材料');
        }}>
          <Ionicons name="albums-outline" size={19} color={COLORS.white} />
          <Text style={styles.primaryButtonText}>选择材料</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, (!allMaterialsSelected || synthesizing) && styles.secondaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={startSynthesis}
          disabled={!allMaterialsSelected || synthesizing}
        >
          {synthesizing ? <ActivityIndicator color={COLORS.blueDark} /> : <>
            <Ionicons name="hammer-outline" size={19} color={allMaterialsSelected ? COLORS.gold : COLORS.muted} />
            <Text style={[styles.secondaryButtonText, !allMaterialsSelected && styles.secondaryButtonTextDisabled]}>开始合成</Text>
          </>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.textButton} onPress={() => showToast('合成材料可通过集市购买或参与活动获得。')}>
          <Text style={styles.textButtonLabel}>查看材料获取方式</Text><Ionicons name="chevron-forward" size={17} color={COLORS.blueDark} />
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>选择合成材料</Text>
                {activeReqIndex !== null ? <Text style={styles.sheetSubtitle}>请选择 {requirements[activeReqIndex]?.req_count || 0} 个「{requirements[activeReqIndex]?.collection?.name || '材料'}」</Text> : null}
              </View>
              <View style={styles.sheetHeaderActions}>
                <TouchableOpacity
                  style={[styles.selectAllButton, (!myIdleNfts.length || (activeReqIndex !== null && tempSelectedNfts.length >= Math.min(myIdleNfts.length, Number(requirements[activeReqIndex]?.req_count) || 0))) && styles.selectAllButtonDisabled]}
                  onPress={selectAllAvailable}
                  disabled={!myIdleNfts.length || activeReqIndex === null || tempSelectedNfts.length >= Math.min(myIdleNfts.length, Number(activeReqIndex === null ? 0 : requirements[activeReqIndex]?.req_count) || 0)}
                ><Text style={styles.selectAllText}>全选</Text></TouchableOpacity>
                <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPicker(false)} accessibilityLabel="关闭材料选择"><Ionicons name="close" size={23} color={COLORS.muted} /></TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.nftScroll} contentContainerStyle={styles.nftGrid} showsVerticalScrollIndicator={false}>
              {myIdleNfts.length === 0 ? (
                <View style={styles.emptyInventory}>
                  <View style={styles.emptyIcon}><Ionicons name="file-tray-outline" size={30} color={COLORS.blue} /></View>
                  <Text style={styles.emptyTitle}>金库里还没有这项材料</Text>
                  <Text style={styles.emptyDescription}>前往集市补齐后，再回来继续合成。</Text>
                  <TouchableOpacity style={styles.emptyMarketButton} onPress={() => goToMarket(requirements[activeReqIndex ?? 0]?.collection?.name || undefined)}><Text style={styles.emptyMarketText}>去集市补齐</Text><Ionicons name="arrow-forward" size={17} color={COLORS.blueDark} /></TouchableOpacity>
                </View>
              ) : myIdleNfts.map((nft) => {
                const chosen = tempSelectedNfts.includes(nft.id);
                const reqImage = activeReqIndex === null ? null : requirements[activeReqIndex]?.collection?.image_url;
                return (
                  <TouchableOpacity key={nft.id} style={[styles.nftCard, chosen && styles.nftCardChosen]} onPress={() => toggleTempSelection(nft.id)} activeOpacity={0.84}>
                    <View style={[styles.checkbox, chosen && styles.checkboxSelected]}>{chosen ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}</View>
                    {reqImage ? <Image source={{ uri: reqImage }} style={styles.nftImage} /> : <View style={[styles.nftImage, styles.materialImagePlaceholder]} />}
                    <Text style={styles.nftSerial}>#{String(nft.serial_number).padStart(6, '0')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {myIdleNfts.length > 0 ? (
              <View style={styles.sheetFooter}>
                <Text style={styles.sheetSelectionCount}>已选择 {tempSelectedNfts.length} / {activeReqIndex === null ? 0 : requirements[activeReqIndex]?.req_count || 0}</Text>
                <TouchableOpacity
                  style={[styles.sheetConfirmButton, !tempSelectedNfts.length && styles.sheetConfirmDisabled]}
                  onPress={confirmSelection}
                  disabled={activeReqIndex === null || !tempSelectedNfts.length}
                >
                  <Text style={styles.sheetConfirmText}>确认选择（{tempSelectedNfts.length}/{activeReqIndex === null ? 0 : requirements[activeReqIndex]?.req_count || 0}）</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.confirmDialog}>
            <TouchableOpacity style={styles.dialogClose} onPress={() => setShowConfirm(false)} accessibilityLabel="关闭确认弹窗">
              <Ionicons name="close" size={22} color={COLORS.muted} />
            </TouchableOpacity>
            <Text style={styles.dialogTitle}>确认合成</Text>
            <View style={styles.dialogTarget}>
              {eventData.target_collection?.image_url && !targetImageFailed ? (
                <Image source={{ uri: eventData.target_collection.image_url }} style={styles.dialogTargetImage} resizeMode="cover" />
              ) : <View style={[styles.dialogTargetImage, styles.targetImagePlaceholder]}><Ionicons name="sparkles-outline" size={26} color={COLORS.blue} /></View>}
              <Text style={styles.dialogTargetName} numberOfLines={2}>{eventData.target_collection?.name || eventData.name}</Text>
            </View>
            <View style={styles.dialogMaterials}>
              {requirements.map((req) => (
                <View key={req.id} style={styles.dialogMaterialRow}>
                  {req.collection?.image_url ? <Image source={{ uri: req.collection.image_url }} style={styles.dialogMaterialImage} resizeMode="cover" /> : <View style={[styles.dialogMaterialImage, styles.materialImagePlaceholder]} />}
                  <Text style={styles.dialogMaterialName} numberOfLines={1}>{req.collection?.name || '合成材料'}</Text>
                  <Text style={styles.dialogMaterialCount}>× {req.req_count}</Text>
                </View>
              ))}
            </View>
            <View style={styles.dialogWarning}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.gold} />
              <Text style={styles.dialogWarningText}>材料提交后不可撤回，请确认配方无误。</Text>
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogSecondaryButton} onPress={() => setShowConfirm(false)}>
                <Text style={styles.dialogSecondaryText}>返回修改</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogPrimaryButton} onPress={executeSynthesis} disabled={synthesizing}>
                {synthesizing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.dialogPrimaryText}>确认合成</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={() => setShowSuccess(false)}>
        <View style={styles.dialogBackdrop}>
          <View style={styles.successDialog}>
            <View style={styles.successImageWrap}>
              {eventData.target_collection?.image_url && !targetImageFailed ? (
                <Image source={{ uri: eventData.target_collection.image_url }} style={styles.successImage} resizeMode="cover" />
              ) : <View style={[styles.successImage, styles.targetImagePlaceholder]}><Ionicons name="sparkles-outline" size={32} color={COLORS.blue} /></View>}
              <Ionicons name="sparkles" size={18} color={COLORS.gold} style={styles.successSparkle} />
            </View>
            <Text style={styles.successTitle}>合成完成</Text>
            <Text style={styles.successDesc}>{isDemoPreview ? '预览完成，未消耗材料。' : `${eventData.target_collection?.name || eventData.name} 已收入金库。`}</Text>
            <TouchableOpacity style={styles.dialogPrimaryButtonWide} onPress={() => {
              setShowSuccess(false);
              if (isDemoPreview) router.replace({ pathname: '/synthesis-detail', params: { id } });
              else router.replace('/(tabs)/profile');
            }}>
              <Text style={styles.dialogPrimaryText}>{isDemoPreview ? '返回合成详情' : '去金库'}</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.successContinue} onPress={() => setShowSuccess(false)}>
              <Text style={styles.successContinueText}>继续浏览</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, padding: 28 },
  loadingText: { color: COLORS.muted, marginTop: 12, fontSize: 14, lineHeight: 20 },
  errorTitle: { marginTop: 14, fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink },
  errorMessage: { color: COLORS.muted, marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  retryButton: { marginTop: 20, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.bluePale },
  retryText: { color: COLORS.blueDark, fontSize: 14, fontWeight: '700' },
  container: { flex: 1, backgroundColor: COLORS.white },
  navBar: { height: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white },
  backButton: { width: 42, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { color: COLORS.ink, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.2 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  toast: { position: 'absolute', zIndex: 20, top: 58, alignSelf: 'center', maxWidth: '90%', backgroundColor: 'rgba(73,61,53,0.94)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 },
  toastText: { color: COLORS.white, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  targetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: COLORS.line, gap: 14, minHeight: 150 },
  targetImage: { borderRadius: 14, backgroundColor: COLORS.creamDeep },
  targetImagePlaceholder: { borderRadius: 14, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  targetInfo: { flex: 1, paddingVertical: 3 },
  targetEyebrow: { color: COLORS.gold, backgroundColor: COLORS.creamDeep, alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, lineHeight: 14, fontWeight: '600', marginBottom: 6 },
  targetName: { color: COLORS.ink, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  targetSeries: { color: COLORS.blueDark, backgroundColor: COLORS.bluePale, alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  targetStory: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 7 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 2, gap: 8 },
  sectionTitle: { color: COLORS.ink, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  sectionHint: { color: COLORS.muted, fontSize: 11, lineHeight: 14, flexShrink: 1, textAlign: 'right' },
  materialList: { gap: 10 },
  materialRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 10, gap: 9 },
  materialImage: { width: 64, height: 64, borderRadius: 11, backgroundColor: COLORS.creamDeep },
  materialImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bluePale },
  materialInfo: { flex: 1, minWidth: 0 },
  materialName: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  materialDesc: { color: COLORS.muted, fontSize: 11, lineHeight: 14, marginTop: 4 },
  materialCount: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  countReady: { color: COLORS.green },
  countPartial: { color: COLORS.blueDark },
  countMissing: { color: COLORS.red },
  materialTotal: { color: COLORS.muted, fontSize: 14, lineHeight: 20, fontWeight: '600', marginLeft: -7, marginRight: 2 },
  addMaterialButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  addMaterialButtonReady: { backgroundColor: COLORS.greenPale },
  shortageCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bluePale, borderRadius: 16, padding: 12, marginTop: 2 },
  shortageIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  shortageInfo: { flex: 1, minWidth: 0 },
  shortageTitle: { color: COLORS.blueDark, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  shortageSubtitle: { color: COLORS.muted, fontSize: 11, lineHeight: 14, marginTop: 4 },
  marketButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  marketButtonText: { color: COLORS.blueDark, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  progressBlock: { backgroundColor: COLORS.cream, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.line },
  progressSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: COLORS.muted, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  progressValue: { color: COLORS.blueDark, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: '#E7E5E2', borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.blue },
  primaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: 17, backgroundColor: COLORS.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: COLORS.white, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  secondaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: 17, backgroundColor: '#F7EFE2', borderWidth: 1, borderColor: '#E9DCC5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonDisabled: { backgroundColor: '#F5F3F0', borderColor: '#EEE9E3' },
  secondaryButtonText: { color: COLORS.gold, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  secondaryButtonTextDisabled: { color: COLORS.muted },
  textButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12 },
  textButtonLabel: { color: COLORS.blueDark, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(33,43,51,0.42)' },
  dialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(43,37,32,0.48)', padding: 20 },
  confirmDialog: { width: '100%', maxWidth: 440, maxHeight: '88%', backgroundColor: COLORS.white, borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F2EBDD' },
  dialogClose: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { color: COLORS.ink, fontSize: 20, lineHeight: 26, fontWeight: '700', marginBottom: 14 },
  dialogTarget: { alignItems: 'center', gap: 8, marginBottom: 14 },
  dialogTargetImage: { width: 76, height: 76, borderRadius: 14, backgroundColor: COLORS.creamDeep },
  dialogTargetName: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  dialogMaterials: { width: '100%', maxHeight: 144, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, paddingVertical: 6 },
  dialogMaterialRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  dialogMaterialImage: { width: 38, height: 38, borderRadius: 9, backgroundColor: COLORS.creamDeep },
  dialogMaterialName: { flex: 1, color: COLORS.ink, fontSize: 14, lineHeight: 20 },
  dialogMaterialCount: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  dialogWarning: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F7F2EA', borderRadius: 11, padding: 10, marginTop: 12 },
  dialogWarningText: { flex: 1, color: COLORS.gold, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  dialogActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  dialogSecondaryButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  dialogSecondaryText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  dialogPrimaryButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue },
  dialogPrimaryButtonWide: { width: '100%', minHeight: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.blue, marginTop: 20 },
  dialogPrimaryText: { color: COLORS.white, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  successDialog: { width: '100%', maxWidth: 440, backgroundColor: COLORS.white, borderRadius: 24, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#F2EBDD' },
  successImageWrap: { position: 'relative', marginBottom: 12 },
  successImage: { width: 96, height: 96, borderRadius: 18, backgroundColor: COLORS.creamDeep },
  successSparkle: { position: 'absolute', right: -7, top: -6 },
  successTitle: { color: COLORS.ink, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  successDesc: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  successContinue: { minHeight: 44, minWidth: 140, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  successContinueText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sheet: { height: '72%', backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, overflow: 'hidden' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#D9DDE0', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F1F1' },
  sheetTitle: { color: COLORS.ink, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  sheetSubtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllButton: { minWidth: 54, height: 36, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bluePale },
  selectAllButtonDisabled: { backgroundColor: '#F2F3F3' },
  selectAllText: { color: COLORS.blueDark, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sheetClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6F6' },
  nftScroll: { flex: 1 },
  nftGrid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  nftCard: { width: '31%', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 7, alignItems: 'center' },
  nftCardChosen: { borderColor: COLORS.blue, backgroundColor: COLORS.bluePale },
  checkbox: { position: 'absolute', top: 12, left: 12, zIndex: 2, width: 21, height: 21, borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: '#CED4D8', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  nftImage: { width: '100%', aspectRatio: 1, borderRadius: 9, backgroundColor: COLORS.creamDeep },
  nftSerial: { color: COLORS.muted, fontSize: 11, lineHeight: 14, fontWeight: '600', marginTop: 7 },
  emptyInventory: { width: '100%', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 35 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 14 },
  emptyDescription: { color: COLORS.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  emptyMarketButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: COLORS.bluePale, paddingHorizontal: 18, paddingVertical: 12, marginTop: 18 },
  emptyMarketText: { color: COLORS.blueDark, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sheetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F1F1' },
  sheetSelectionCount: { color: COLORS.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sheetConfirmButton: { backgroundColor: COLORS.blue, minWidth: 156, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetConfirmDisabled: { backgroundColor: '#D8E0E6' },
  sheetConfirmText: { color: COLORS.white, fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
