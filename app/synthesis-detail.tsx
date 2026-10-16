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
type Stage = 1 | 2 | 3;

const COLORS = {
  ink: '#27313A',
  muted: '#7B8490',
  line: '#E8E9E8',
  white: '#FFFFFF',
  cream: '#FBF7F0',
  creamDeep: '#F6EFE4',
  blue: '#6598C6',
  blueDark: '#467EAF',
  bluePale: '#EAF3FA',
  red: '#D96A62',
  redPale: '#FBF0EF',
  green: '#4E9B68',
  greenPale: '#EDF6EF',
  gold: '#98754A',
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
  const [stage, setStage] = useState<Stage>(1);
  const [showPicker, setShowPicker] = useState(false);
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
      setStage(2);
    } else if (preview === 'complete') {
      setStage(3);
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

  const goToMarket = () => {
    setShowPicker(false);
    router.push('/(tabs)/market');
  };

  const startReview = () => {
    if (!allMaterialsSelected) {
      const firstIncomplete = requirements.findIndex((req, index) => (selectedNfts[index]?.length || 0) < Number(req.req_count));
      if (firstIncomplete >= 0) openMaterialPicker(firstIncomplete);
      else showToast('请先选择全部合成材料');
      return;
    }
    setStage(2);
  };

  const executeSynthesis = async () => {
    if (isDemoPreview) {
      setStage(3);
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
      setStage(3);
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
    return shortage > 0 ? [{ name: req.collection?.name || '合成材料', count: shortage }] : [];
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

      {stage === 3 ? (
        <View style={styles.successState}>
          <View style={styles.successMark}><Ionicons name="checkmark" size={42} color={COLORS.white} /></View>
          <Text style={styles.successTitle}>合成完成</Text>
          <Text style={styles.successDesc}>{isDemoPreview ? '这是完成页效果预览，没有执行合成，也没有消耗材料。' : `${eventData.target_collection?.name || eventData.name} 已放入金库。`}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => isDemoPreview ? router.replace({ pathname: '/synthesis-detail', params: { id } }) : router.replace('/(tabs)/profile')}>
            <Text style={styles.primaryButtonText}>{isDemoPreview ? '返回合成详情' : '前往金库'}</Text><Ionicons name="arrow-forward" size={19} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.textButton} onPress={() => router.back()}><Text style={styles.textButtonLabel}>{isDemoPreview ? '完成页预览模式' : '返回合成列表'}</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: stage === 1 ? 28 : 34 }]}
            showsVerticalScrollIndicator={false}
          >
            <StepProgress stage={stage} />

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

            {stage === 1 ? (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>选择合成材料</Text>
                  <Text style={styles.sectionHint}>集齐以下材料即可进行合成</Text>
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
                    <TouchableOpacity style={styles.marketButton} onPress={goToMarket}>
                      <Text style={styles.marketButtonText}>去集市补齐</Text><Ionicons name="chevron-forward" size={17} color={COLORS.gold} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>核对合成配方</Text>
                  <Text style={styles.sectionHint}>请确认材料与目标藏品</Text>
                </View>
                <View style={styles.reviewList}>
                  {requirements.map((req, index) => (
                    <View key={req.id} style={styles.reviewRow}>
                      {req.collection?.image_url ? <Image source={{ uri: req.collection.image_url }} style={styles.reviewImage} /> : <View style={[styles.reviewImage, styles.materialImagePlaceholder]} />}
                      <Text style={styles.reviewName} numberOfLines={1}>{req.collection?.name || '未知材料'}</Text>
                      <Text style={styles.reviewAmount}>已选 {selectedNfts[index]?.length || 0} / {req.req_count}</Text>
                      <TouchableOpacity onPress={() => openMaterialPicker(index)}><Text style={styles.reviewEdit}>调整</Text></TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.warningCard}>
                  <Ionicons name="information-circle-outline" size={24} color={COLORS.gold} />
                  <Text style={styles.warningText}>确认合成后，所选材料将被消耗且无法返还。请确认选择无误。</Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.progressBlock}>
              <Text style={styles.progressLabel}>{stage === 1 ? '合成进度' : '材料已核对'}</Text>
              <Text style={styles.progressValue}>{stage === 1 ? `${totalSelected} / ${totalRequired || 0}` : `${totalRequired} / ${totalRequired}`}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${totalRequired ? Math.min(100, (totalSelected / totalRequired) * 100) : 0}%` }]} /></View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, stage === 1 && !allMaterialsSelected && styles.primaryButtonMuted]}
              activeOpacity={0.85}
              onPress={stage === 1 ? startReview : executeSynthesis}
              disabled={synthesizing}
            >
              {synthesizing ? <ActivityIndicator color={COLORS.white} /> : <>
                <Text style={styles.primaryButtonText}>{stage === 1 ? (allMaterialsSelected ? '核对配方' : '选择材料') : (isDemoPreview ? '预览完成页' : '确认并开始合成')}</Text>
                <Ionicons name="arrow-forward" size={19} color={COLORS.white} />
              </>}
            </TouchableOpacity>
          </View>
          {stage === 2 ? <TouchableOpacity style={styles.backToMaterials} onPress={() => setStage(1)}><Text style={styles.backToMaterialsText}>返回调整材料</Text></TouchableOpacity> : null}
        </>
      )}

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
                  <TouchableOpacity style={styles.emptyMarketButton} onPress={goToMarket}><Text style={styles.emptyMarketText}>去集市补齐</Text><Ionicons name="arrow-forward" size={17} color={COLORS.blueDark} /></TouchableOpacity>
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
    </SafeAreaView>
  );
}

function StepProgress({ stage }: { stage: Stage }) {
  const labels = ['选材料', '核对配方', '完成合成'];
  return (
    <View style={styles.steps}>
      {labels.map((label, index) => {
        const step = index + 1;
        const active = step <= stage;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
                {step < stage ? <Ionicons name="checkmark" size={16} color={COLORS.white} /> : <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{step}</Text>}
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {index < labels.length - 1 ? <View style={[styles.stepConnector, step < stage && styles.stepConnectorActive]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, padding: 28 },
  loadingText: { color: COLORS.muted, marginTop: 12, fontSize: 14 },
  errorTitle: { marginTop: 14, fontSize: 18, fontWeight: '800', color: COLORS.ink },
  errorMessage: { color: COLORS.muted, marginTop: 8, textAlign: 'center' },
  retryButton: { marginTop: 20, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.bluePale },
  retryText: { color: COLORS.blueDark, fontWeight: '800' },
  container: { flex: 1, backgroundColor: COLORS.white },
  navBar: { height: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white },
  backButton: { width: 42, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 13 },
  toast: { position: 'absolute', zIndex: 20, top: 58, alignSelf: 'center', maxWidth: '90%', backgroundColor: 'rgba(39,49,58,0.94)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 11 },
  toastText: { color: COLORS.white, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 18, marginBottom: 22 },
  stepItem: { width: 78, alignItems: 'center' },
  stepCircle: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#F0F1F2', borderWidth: 1, borderColor: '#E4E7E9', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  stepNumber: { color: '#9299A1', fontSize: 15, fontWeight: '800' },
  stepNumberActive: { color: COLORS.white },
  stepLabel: { color: '#9299A1', fontSize: 12, fontWeight: '600', marginTop: 7 },
  stepLabelActive: { color: COLORS.blueDark, fontWeight: '800' },
  stepConnector: { height: 3, borderRadius: 2, backgroundColor: '#E8EAEC', flex: 1, marginHorizontal: 3, marginTop: 16 },
  stepConnectorActive: { backgroundColor: '#A9C9E4' },
  targetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: 22, padding: 13, borderWidth: 1, borderColor: '#F2EBDD', gap: 14, minHeight: 150 },
  targetImage: { borderRadius: 17, backgroundColor: COLORS.creamDeep },
  targetImagePlaceholder: { borderRadius: 17, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  targetInfo: { flex: 1, paddingVertical: 3 },
  targetEyebrow: { color: COLORS.gold, backgroundColor: COLORS.creamDeep, alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  targetName: { color: COLORS.ink, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  targetSeries: { color: COLORS.blueDark, backgroundColor: COLORS.bluePale, alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, marginTop: 7, fontSize: 11, fontWeight: '700' },
  targetStory: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 25, marginBottom: 13, gap: 8 },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: COLORS.muted, fontSize: 11, flexShrink: 1, textAlign: 'right' },
  materialList: { gap: 10 },
  materialRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, padding: 10, gap: 9 },
  materialImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.creamDeep },
  materialImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bluePale },
  materialInfo: { flex: 1, minWidth: 0 },
  materialName: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  materialDesc: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  materialCount: { fontSize: 16, fontWeight: '900' },
  countReady: { color: COLORS.green },
  countPartial: { color: COLORS.blueDark },
  countMissing: { color: COLORS.red },
  materialTotal: { color: COLORS.muted, fontSize: 13, fontWeight: '700', marginLeft: -7, marginRight: 2 },
  addMaterialButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  addMaterialButtonReady: { backgroundColor: COLORS.greenPale },
  shortageCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.redPale, borderRadius: 18, padding: 12, marginTop: 13 },
  shortageIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  shortageInfo: { flex: 1, minWidth: 0 },
  shortageTitle: { color: '#B84F49', fontSize: 13, fontWeight: '900' },
  shortageSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  marketButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8E8CE', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, gap: 2 },
  marketButtonText: { color: COLORS.gold, fontSize: 11, fontWeight: '800' },
  reviewList: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, paddingHorizontal: 13 },
  reviewRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, gap: 10 },
  reviewImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.creamDeep },
  reviewName: { flex: 1, color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  reviewAmount: { color: COLORS.muted, fontSize: 11 },
  reviewEdit: { color: COLORS.blueDark, fontSize: 12, fontWeight: '800', padding: 5 },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cream, borderRadius: 16, padding: 14, marginTop: 14 },
  warningText: { flex: 1, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#F1F1EF', paddingHorizontal: 18, paddingTop: 13, shadowColor: '#34414A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 8 },
  progressBlock: { flex: 1, minWidth: 0 },
  progressLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  progressValue: { color: COLORS.blueDark, fontSize: 22, fontWeight: '900', marginTop: 2 },
  progressTrack: { height: 7, backgroundColor: '#E9EAEC', borderRadius: 5, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#83B4DD' },
  primaryButton: { minHeight: 58, borderRadius: 19, paddingHorizontal: 17, backgroundColor: COLORS.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 166 },
  primaryButtonMuted: { backgroundColor: '#7FA8C9' },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  backToMaterials: { alignItems: 'center', paddingVertical: 5, backgroundColor: COLORS.white },
  backToMaterialsText: { color: COLORS.blueDark, fontSize: 12, fontWeight: '700' },
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  successMark: { width: 82, height: 82, borderRadius: 41, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: COLORS.ink, fontSize: 25, fontWeight: '900', marginTop: 20 },
  successDesc: { color: COLORS.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },
  textButton: { padding: 14, marginTop: 5 },
  textButtonLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(33,43,51,0.42)' },
  sheet: { height: '72%', backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, overflow: 'hidden' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#D9DDE0', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F1F1' },
  sheetTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '900' },
  sheetSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllButton: { minWidth: 54, height: 36, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bluePale },
  selectAllButtonDisabled: { backgroundColor: '#F2F3F3' },
  selectAllText: { color: COLORS.blueDark, fontSize: 12, fontWeight: '800' },
  sheetClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6F6' },
  nftScroll: { flex: 1 },
  nftGrid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  nftCard: { width: '31%', borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.line, backgroundColor: COLORS.white, padding: 7, alignItems: 'center' },
  nftCardChosen: { borderColor: COLORS.blue, backgroundColor: COLORS.bluePale },
  checkbox: { position: 'absolute', top: 12, left: 12, zIndex: 2, width: 21, height: 21, borderRadius: 11, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: '#CED4D8', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  nftImage: { width: '100%', aspectRatio: 1, borderRadius: 9, backgroundColor: COLORS.creamDeep },
  nftSerial: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 7 },
  emptyInventory: { width: '100%', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 35 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: COLORS.bluePale, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '800', marginTop: 14 },
  emptyDescription: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 7 },
  emptyMarketButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: COLORS.bluePale, paddingHorizontal: 18, paddingVertical: 12, marginTop: 18 },
  emptyMarketText: { color: COLORS.blueDark, fontSize: 13, fontWeight: '800' },
  sheetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F1F1' },
  sheetSelectionCount: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  sheetConfirmButton: { backgroundColor: COLORS.blue, minWidth: 156, minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetConfirmDisabled: { backgroundColor: '#D8E0E6' },
  sheetConfirmText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
});
