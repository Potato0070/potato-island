import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FolioButton from '../components/FolioButton';
import FolioPaperSurface from '../components/FolioPaperSurface';
import { FolioArtwork, FolioSerialTag, FolioStateTag } from '../components/FolioArtwork';
import { OWNED_COLORS, itemStatus, money, serialLabel, validateConsignPrice, type OwnedItem } from '../constants/owned-collection';
import { supabase } from '../supabase';

type StatusFilter = 'all' | 'idle' | 'listed';
type CollectionSort = 'serial_asc' | 'serial_desc' | 'acquired_newest' | 'acquired_oldest';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'idle', label: '在库' },
  { key: 'listed', label: '寄售中' },
];
const SORT_OPTIONS: { key: CollectionSort; title: string; hint: string }[] = [
  { key: 'serial_asc', title: '编号从小到大', hint: '按藏品编号升序排列' },
  { key: 'serial_desc', title: '编号从大到小', hint: '按藏品编号降序排列' },
  { key: 'acquired_newest', title: '获取时间由新到旧', hint: '转入按进入金库时间；初始生成按生成时间' },
  { key: 'acquired_oldest', title: '获取时间由旧到新', hint: '转入按进入金库时间；初始生成按生成时间' },
];

function collectionOf(item: OwnedItem) {
  return Array.isArray(item.collections) ? item.collections[0] : item.collections;
}

function imageOf(item: OwnedItem) {
  const record = item as OwnedItem & { image_url?: string | null };
  return record.image_url || collectionOf(item)?.image_url || null;
}

const EMPTY_ALBUM_ART = require('../assets/owned-collection/f-card-v1/runtime/empty-collection-album.webp');
const EMPTY_SEARCH_ART = require('../assets/owned-collection/f-card-v1/runtime/empty-search-map.webp');
const EMPTY_NETWORK_ART = require('../assets/owned-collection/f-card-v1/runtime/empty-network-lighthouse.webp');
const REQUEST_TIMEOUT_MESSAGE = '连接有点慢，请检查网络后重试';

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(REQUEST_TIMEOUT_MESSAGE)), timeoutMs);
  });
  return Promise.race([Promise.resolve(operation), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export default function MyCollectionListScreen() {
  const router = useRouter();
  const { collectionId, collectionName } = useLocalSearchParams<{ collectionId?: string; collectionName?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const carouselRef = useRef<FlatList<OwnedItem>>(null);
  const filmRef = useRef<FlatList<OwnedItem>>(null);
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<CollectionSort>('serial_asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [acquiredAtById, setAcquiredAtById] = useState<Record<string, number>>({});
  const [acquisitionTimesLoaded, setAcquisitionTimesLoaded] = useState(false);
  const [acquisitionSortLoading, setAcquisitionSortLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [batchPrice, setBatchPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentWidth = Math.min(windowWidth, 760);
  const cardWidth = Math.min(contentWidth - 58, 500);
  const cardInterval = cardWidth + 18;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2300);
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user }, error: userError } = await withTimeout(supabase.auth.getUser(), 8000);
      if (userError) throw userError;
      if (!user) {
        setItems([]);
        setError('请先登录土豆岛账号');
        return;
      }
      let query = supabase.from('nfts')
        .select('*, collections(id, name, image_url, max_consign_price, total_minted, circulating_supply)')
        .eq('owner_id', user.id)
        .neq('status', 'burned')
        .order('serial_number', { ascending: true });
      if (collectionId) query = query.eq('collection_id', collectionId);
      const { data, error: queryError } = await withTimeout(query, 12000);
      if (queryError) throw queryError;
      setAcquiredAtById({});
      setAcquisitionTimesLoaded(false);
      setItems((data || []) as unknown as OwnedItem[]);
    } catch (cause) {
      console.error('读取持仓藏品失败', cause);
      setError(cause instanceof Error && cause.message === REQUEST_TIMEOUT_MESSAGE
        ? REQUEST_TIMEOUT_MESSAGE
        : '藏品暂时没有装订好，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useFocusEffect(useCallback(() => {
    void fetchItems();
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [fetchItems]));

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const result = items.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter;
      const serial = String(item.serial_number).toLocaleLowerCase();
      const name = (collectionOf(item)?.name || '').toLocaleLowerCase();
      return matchesStatus && (!needle || serial.includes(needle) || name.includes(needle));
    });
    result.sort((a, b) => {
      if (sortBy === 'serial_asc' || sortBy === 'serial_desc') {
        const left = Number(a.serial_number);
        const right = Number(b.serial_number);
        const comparison = Number.isFinite(left) && Number.isFinite(right)
          ? left - right
          : String(a.serial_number).localeCompare(String(b.serial_number), 'zh-CN', { numeric: true });
        return sortBy === 'serial_asc' ? comparison : -comparison;
      }
      const left = acquiredAtById[a.id] ?? new Date(a.created_at || 0).getTime();
      const right = acquiredAtById[b.id] ?? new Date(b.created_at || 0).getTime();
      const comparison = (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
      return sortBy === 'acquired_newest' ? -comparison : comparison;
    });
    return result;
  }, [acquiredAtById, filter, items, search, sortBy]);

  React.useEffect(() => {
    setActiveIndex(0);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
    filmRef.current?.scrollToOffset({ offset: 0, animated: false });
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id && item.status === 'idle')));
  }, [filter, search, items, sortBy]);

  React.useEffect(() => {
    const centeredOffset = activeIndex * 71 - Math.max(0, (contentWidth - 62) / 2);
    filmRef.current?.scrollToOffset({ offset: Math.max(0, centeredOffset), animated: true });
  }, [activeIndex, contentWidth]);

  const activeItem = visibleItems[activeIndex] || null;
  const activeCollection = activeItem ? collectionOf(activeItem) : items[0] ? collectionOf(items[0]) : null;
  const idleCount = items.filter((item) => item.status === 'idle').length;
  const listedCount = items.filter((item) => item.status === 'listed').length;
  const getCount = (key: StatusFilter) => key === 'all' ? items.length : key === 'idle' ? idleCount : listedCount;
  const batchAllowed = (item: OwnedItem) => item.status === 'idle';

  const chooseSort = async (nextSort: CollectionSort) => {
    if ((nextSort === 'acquired_newest' || nextSort === 'acquired_oldest') && !acquisitionTimesLoaded && items.length > 0) {
      setAcquisitionSortLoading(true);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error('请先登录后查看藏品获取时间');
        const nftIds = items.map((item) => item.id);
        const transferQueries = [];
        for (let offset = 0; offset < nftIds.length; offset += 100) {
          transferQueries.push(supabase.from('transfer_logs')
            .select('nft_id, transfer_time')
            .eq('buyer_id', user.id)
            .in('nft_id', nftIds.slice(offset, offset + 100))
            .order('transfer_time', { ascending: false }));
        }
        const transferResults = await withTimeout(Promise.all(transferQueries), 12000);
        const acquiredAt: Record<string, number> = {};
        transferResults.forEach(({ data, error: historyError }) => {
          if (historyError) throw historyError;
          (data || []).forEach((entry) => {
            const timestamp = new Date(entry.transfer_time).getTime();
            if (!(entry.nft_id in acquiredAt) && entry.transfer_time && Number.isFinite(timestamp)) acquiredAt[entry.nft_id] = timestamp;
          });
        });
        setAcquiredAtById(acquiredAt);
        setAcquisitionTimesLoaded(true);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : '获取时间记录暂时无法读取');
        setAcquisitionSortLoading(false);
        return;
      }
      setAcquisitionSortLoading(false);
    }
    setSortBy(nextSort);
    setSortOpen(false);
  };
  const selectItem = (item: OwnedItem) => {
    if (!batchMode) {
      router.push({ pathname: '/my-nft-detail', params: { id: item.id } });
      return;
    }
    if (!batchAllowed(item) && !selectedIds.includes(item.id)) {
      notify('寄售中的藏品暂不能加入批量上架');
      return;
    }
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (current.length >= 20) {
        notify('每次最多选择 20 件藏品');
        return current;
      }
      return [...current, item.id];
    });
  };

  const toggleBatchMode = () => {
    setBatchMode((current) => !current);
    setSelectedIds([]);
    setFilter('all');
  };

  const moveCarousel = (step: number) => {
    if (!visibleItems.length) return;
    const next = Math.max(0, Math.min(visibleItems.length - 1, activeIndex + step));
    setActiveIndex(next);
    carouselRef.current?.scrollToOffset({ offset: next * cardInterval, animated: true });
  };

  const openConsignSheet = () => {
    if (selectedIds.length === 0) return;
    setBatchPrice('');
    setPriceSheetOpen(true);
  };

  const submitBatchConsign = async () => {
    const currentSelection = items.filter((item) => selectedIds.includes(item.id));
    const limits = currentSelection
      .map((item) => Number(collectionOf(item)?.max_consign_price))
      .filter((limit) => Number.isFinite(limit) && limit > 0);
    const priceProblem = validateConsignPrice(batchPrice, limits.length ? Math.min(...limits) : null);
    if (priceProblem) {
      notify(priceProblem);
      return;
    }
    if (!selectedIds.length) return;
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('登录状态已失效，请重新登录');
      if (currentSelection.length !== selectedIds.length || currentSelection.some((item) => item.owner_id !== user.id || item.status !== 'idle')) {
        throw new Error('所选藏品状态已变化，请刷新后重新选择');
      }
      const { error: rpcError } = await supabase.rpc('batch_consign_nfts', {
        p_user_id: user.id,
        p_nft_ids: selectedIds,
        p_price: Number(batchPrice),
      });
      if (rpcError) {
        if (rpcError.message.includes('特权不足')) throw new Error('需要批量寄售权益后才能使用此功能');
        throw rpcError;
      }
      const successfulIds = new Set(selectedIds);
      setItems((current) => current.map((item) => successfulIds.has(item.id) ? { ...item, status: 'listed', consign_price: Number(batchPrice) } : item));
      setPriceSheetOpen(false);
      setBatchMode(false);
      setSelectedIds([]);
      notify('寄售已提交，藏品已在市场展示');
      void fetchItems();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '批量寄售没有完成，请稍后重试';
      notify(message);
    } finally {
      setBusy(false);
    }
  };

  const renderCard = ({ item, index }: { item: OwnedItem; index: number }) => {
    const isSelected = selectedIds.includes(item.id);
    const imageUri = imageOf(item);
    const status = itemStatus(item.status);
    const statusKey = item.status === 'idle' ? 'idle' : item.status === 'listed' ? 'listed' : 'other';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={(collectionOf(item)?.name || '藏品') + ' ' + serialLabel(item.serial_number) + (batchMode ? (isSelected ? ' 已选中' : ' 加入批量管理') : ' 查看详情')}
        onPress={() => selectItem(item)}
        style={[styles.cardShell, { width: cardWidth }, isSelected && styles.cardShellSelected]}
      >
        <View style={[styles.collectionCard, { width: cardWidth - 14 }]}>
          <View style={styles.coverMount}>
            <FolioArtwork uri={imageUri} framed={false} style={styles.coverArt} accessibilityLabel={`${collectionOf(item)?.name || '藏品'}封面`} />
            {batchMode ? <View style={[styles.selectionMark, isSelected && styles.selectionMarkSelected]}>{isSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View> : null}
          </View>
          <View style={styles.cardCaption}>
            <View style={styles.captionMain}>
              <Text numberOfLines={1} style={styles.cardName}>{collectionOf(item)?.name || '未命名藏品'}</Text>
              <Text style={styles.cardSerial}>{serialLabel(item.serial_number)}</Text>
            </View>
            <Ionicons name={batchMode ? (isSelected ? 'checkmark-circle' : 'ellipse-outline') : 'chevron-forward'} size={19} color={isSelected ? OWNED_COLORS.blue : '#B6A99B'} />
          </View>
        </View>
        <FolioSerialTag value={serialLabel(item.serial_number)} style={styles.sideNumber} />
        <FolioStateTag state={statusKey} label={status} style={styles.sideStatus} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={[styles.page, { maxWidth: 760 }]}>
        <View style={styles.pageHeader}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>{batchMode ? '批量管理' : '我的藏品'}</Text>
            <Text style={styles.subtitle}>持有 {items.length.toLocaleString('zh-CN')} 件{collectionName ? ' ' + collectionName : ''}</Text>
          </View>
          <FolioButton
            label={batchMode ? '退出' : '批量管理'}
            tone="paper"
            icon={batchMode ? 'close' : 'checkbox-outline'}
            onPress={toggleBatchMode}
            style={styles.batchButton}
          />
        </View>

        <View style={styles.statusRail} accessibilityRole="tablist">
          {STATUS_FILTERS.map(({ key, label }) => {
            const selected = filter === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFilter(key)} style={[styles.statusTab, selected && styles.statusTabSelected]}>
                <Text style={[styles.statusTabText, selected && styles.statusTabTextSelected]}>{label}</Text>
                <Text style={[styles.statusCount, selected && styles.statusCountSelected]}>{getCount(key)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#988B7D" />
            <TextInput
              accessibilityLabel="搜索藏品名称或编号"
              value={search}
              onChangeText={setSearch}
              placeholder="搜索藏品名称或编号"
              placeholderTextColor="#A89C8E"
              style={styles.searchInput}
              returnKeyType="search"
              maxLength={40}
              underlineColorAndroid="transparent"
              selectionColor={OWNED_COLORS.blue}
            />
            {search ? <Pressable accessibilityRole="button" accessibilityLabel="清除搜索" onPress={() => setSearch('')} style={styles.clearSearch}><Ionicons name="close-circle" size={18} color="#A89C8E" /></Pressable> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="选择排序方式" onPress={() => setSortOpen(true)} style={styles.sortButton}>
            <Ionicons name="options-outline" size={20} color={OWNED_COLORS.ink} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingState}><ActivityIndicator size="large" color={OWNED_COLORS.blue} /><Text style={styles.loadingText}>正在翻开藏品册…</Text></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Image source={EMPTY_NETWORK_ART} resizeMode="contain" style={styles.emptyNetworkArt} accessible={false} />
            <Text style={styles.emptyTitle}>{error}</Text>
            <FolioButton label="重新载入" tone="paper" onPress={() => void fetchItems()} style={styles.retryButton} />
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={search ? EMPTY_SEARCH_ART : EMPTY_ALBUM_ART} resizeMode="contain" style={search ? styles.emptySearchArt : styles.emptyAlbumArt} accessible={false} />
            <Text style={styles.emptyTitle}>{search ? '没有找到这张藏品' : filter === 'listed' ? '目前还没有寄售藏品' : '这一页藏品册还是空白'}</Text>
            <Text style={styles.emptyHint}>{search ? '试试藏品名称或完整编号的一部分' : filter === 'idle' ? '已寄售或暂不可操作的藏品不会出现在这里' : '获得藏品后，会在这里逐张归档'}</Text>
            {search ? <FolioButton label="清除搜索" tone="paper" onPress={() => setSearch('')} style={styles.retryButton} /> : null}
          </View>
        ) : (
          <>
            <View style={styles.deckHeader}>
              <View style={styles.deckLabelRow}><View style={styles.deckDot} /><Text style={styles.deckLabel}>{batchMode ? '点选要寄售的藏品' : '轻轻滑动，翻看你的藏品'}</Text></View>
              <Text style={styles.deckCount}>{activeIndex + 1} / {visibleItems.length}</Text>
            </View>
            <View style={styles.carouselFrame}>
              {visibleItems.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="上一件藏品" onPress={() => moveCarousel(-1)} style={[styles.carouselArrow, styles.carouselArrowLeft]}><Ionicons name="chevron-back" size={20} color={OWNED_COLORS.ink} /></Pressable> : null}
              <FlatList
                ref={carouselRef}
                horizontal
                data={visibleItems}
                renderItem={renderCard}
                extraData={batchMode ? selectedIds : undefined}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={cardInterval}
                snapToAlignment="start"
                disableIntervalMomentum
                contentContainerStyle={{ paddingHorizontal: Math.max(16, (contentWidth - cardWidth) / 2) }}
                ItemSeparatorComponent={() => <View style={{ width: 18 }} />}
                getItemLayout={(_, index) => ({ length: cardInterval, offset: cardInterval * index, index })}
                scrollEventThrottle={16}
                onScroll={(event) => {
                  const next = Math.max(0, Math.min(visibleItems.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardInterval)));
                  setActiveIndex((current) => current === next ? current : next);
                }}
                onMomentumScrollEnd={(event) => {
                  const next = Math.max(0, Math.min(visibleItems.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardInterval)));
                  setActiveIndex(next);
                }}
                onScrollToIndexFailed={({ index }) => setTimeout(() => carouselRef.current?.scrollToIndex({ index, animated: true }), 80)}
              />
              {visibleItems.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="下一件藏品" onPress={() => moveCarousel(1)} style={[styles.carouselArrow, styles.carouselArrowRight]}><Ionicons name="chevron-forward" size={20} color={OWNED_COLORS.ink} /></Pressable> : null}
            </View>
            <View style={styles.pageIndicator}>
              <View style={styles.dots}>{visibleItems.slice(0, Math.min(8, visibleItems.length)).map((item, index) => {
                const dotCount = Math.min(8, visibleItems.length);
                const dotIndex = Math.min(dotCount - 1, Math.floor((activeIndex / Math.max(1, visibleItems.length)) * dotCount));
                return <View key={item.id} style={[styles.dot, index === dotIndex && styles.dotActive]} />;
              })}</View>
              <Text style={styles.pageLabel}>{activeItem ? serialLabel(activeItem.serial_number) : ''}</Text>
            </View>
            <FlatList
              ref={filmRef}
              horizontal
              data={visibleItems}
              extraData={activeIndex}
              renderItem={({ item, index }) => {
                const selected = activeIndex === index;
                return (
                  <Pressable accessibilityRole="button" accessibilityLabel={'跳到' + serialLabel(item.serial_number)} onPress={() => { setActiveIndex(index); carouselRef.current?.scrollToOffset({ offset: index * cardInterval, animated: true }); }} style={[styles.filmItem, selected && styles.filmItemSelected]}>
                    <FolioArtwork uri={imageOf(item)} framed={false} style={styles.filmArt} accessibilityLabel={`${collectionOf(item)?.name || '藏品'}缩略图`} />
                    <View style={[styles.filmStatus, item.status === 'listed' && styles.filmStatusListed]} />
                  </Pressable>
                );
              }}
              keyExtractor={(item) => 'film-' + item.id}
              getItemLayout={(_, index) => ({ length: 62, offset: 71 * index, index })}
              onScrollToIndexFailed={({ index }) => setTimeout(() => filmRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 80)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filmStrip}
            />
          </>
        )}

        {batchMode && !loading && visibleItems.length > 0 ? (
          <View style={[styles.batchBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.batchSummary}><Text style={styles.batchCount}>已选 {selectedIds.length}<Text style={styles.batchLimit}> / 20</Text></Text><Text style={styles.batchNote}>仅在库藏品可上架</Text></View>
              <FolioButton label="统一标价" tone="gold" pencilIcon="consign" onPress={openConsignSheet} disabled={!selectedIds.length || busy} style={styles.batchAction} />
          </View>
        ) : null}
      </View>

      {toast ? <View accessibilityLiveRegion="polite" style={[styles.toast, { bottom: Math.max(insets.bottom, 18) + (batchMode ? 82 : 12) }]}><Text style={styles.toastText}>{toast}</Text></View> : null}

      <Modal visible={sortOpen} transparent animationType="slide" onRequestClose={() => setSortOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="关闭排序方式" style={styles.scrim} onPress={() => setSortOpen(false)} />
          <View style={[styles.sortSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>排序方式</Text><Text style={styles.sheetSubtitle}>{acquisitionSortLoading ? '正在读取藏品进入金库的时间…' : '按编号或进入金库的时间整理'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => setSortOpen(false)} style={styles.sheetClose}><Ionicons name="close" size={20} color={OWNED_COLORS.ink} /></Pressable>
            </View>
            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((option) => {
                const selected = sortBy === option.key;
                return <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: acquisitionSortLoading }} disabled={acquisitionSortLoading} onPress={() => { void chooseSort(option.key); }} style={[styles.sortOption, selected && styles.sortOptionSelected, acquisitionSortLoading && styles.sortOptionDisabled]}>
                  <View style={styles.sortOptionCopy}><Text style={[styles.sortOptionTitle, selected && styles.sortOptionTitleSelected]}>{option.title}</Text><Text style={styles.sortOptionHint}>{option.hint}</Text></View>
                  <View style={[styles.sortRadio, selected && styles.sortRadioSelected]}>{selected ? <View style={styles.sortRadioDot} /> : null}</View>
                </Pressable>;
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={priceSheetOpen} transparent animationType="slide" onRequestClose={() => !busy && setPriceSheetOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable accessibilityLabel="关闭寄售设置" style={styles.scrim} onPress={() => !busy && setPriceSheetOpen(false)} />
          <FolioPaperSurface kind="paper" style={[styles.priceSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>批量寄售</Text><Text style={styles.sheetSubtitle}>为 {selectedIds.length} 张藏品设置相同的单件价格</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => !busy && setPriceSheetOpen(false)} style={styles.sheetClose}><Ionicons name="close" size={20} color={OWNED_COLORS.ink} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <View style={styles.batchPreviewCard}>
                {activeItem ? <FolioArtwork uri={imageOf(activeItem)} framed={false} style={styles.sheetPreviewArt} accessibilityLabel={`${collectionOf(activeItem)?.name || '藏品'}缩略图`} /> : <View style={styles.sheetPreviewArt} />}
                <View style={styles.batchPreviewCopy}><Text style={styles.previewCollection}>{collectionName || activeCollection?.name || '我的藏品'}</Text><Text style={styles.previewCount}>{selectedIds.length} 件藏品 · 统一寄售价</Text></View>
                <Ionicons name="albums-outline" size={20} color={OWNED_COLORS.blue} />
              </View>
              <Text style={styles.inputLabel}>每件寄售价 <Text style={styles.currency}>(土豆币)</Text></Text>
              <View style={styles.priceInputWrap}><TextInput accessibilityLabel="每件寄售价" value={batchPrice} onChangeText={setBatchPrice} placeholder="输入价格" placeholderTextColor="#B2A79B" keyboardType="decimal-pad" style={styles.priceInput} underlineColorAndroid="transparent" selectionColor={OWNED_COLORS.blue} maxLength={14} /><Text style={styles.currencySuffix}>土豆币</Text></View>
              {activeCollection?.max_consign_price ? <Text style={styles.priceLimit}>系列最高寄售价 {money(activeCollection.max_consign_price)} 土豆币</Text> : null}
              <View style={styles.priceTotal}><Text style={styles.priceTotalLabel}>挂单总额参考</Text><Text style={styles.priceTotalValue}>{money(Number(batchPrice || 0) * selectedIds.length)} <Text style={styles.currency}>土豆币</Text></Text></View>
              <Text style={styles.noticeText}>提交后藏品会进入寄售状态。批量寄售权益由平台规则校验。</Text>
              <FolioButton label="确认批量寄售" tone="blue" pencilIcon="consign" onPress={submitBatchConsign} loading={busy} disabled={!batchPrice.trim()} style={styles.submitButton} />
              <Pressable accessibilityRole="button" onPress={() => setPriceSheetOpen(false)} disabled={busy} style={styles.sheetCancel}><Text style={styles.sheetCancelText}>再检查一下</Text></Pressable>
            </ScrollView>
          </FolioPaperSurface>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  page: { flex: 1, alignSelf: 'center', width: '100%', backgroundColor: '#FFFFFF' },
  pageHeader: { minHeight: 76, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 12 },
  title: { color: OWNED_COLORS.ink, fontSize: 22, lineHeight: 28 },
  subtitle: { color: OWNED_COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  batchButton: { minWidth: 102, minHeight: 42, paddingHorizontal: 10 },
  statusRail: { marginHorizontal: 20, padding: 4, borderRadius: 14, backgroundColor: '#F5F1EB', flexDirection: 'row', gap: 4 },
  statusTab: { minHeight: 43, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11 },
  statusTabSelected: { backgroundColor: OWNED_COLORS.blue, shadowColor: '#6C8EA2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 5, elevation: 2 },
  statusTabText: { color: '#786D63', fontSize: 13 },
  statusTabTextSelected: { color: '#FFFFFF' },
  statusCount: { minWidth: 21, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 9, overflow: 'hidden', textAlign: 'center', backgroundColor: '#E6DED3', color: '#776A5E', fontSize: 11, lineHeight: 15 },
  statusCountSelected: { backgroundColor: 'rgba(255,255,255,0.22)', color: '#FFFFFF' },
  searchRow: { marginHorizontal: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchBox: { height: 43, flex: 1, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E9E2D9', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minWidth: 0, height: 42, padding: 0, margin: 0, borderWidth: 0, outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', backgroundColor: 'transparent', color: OWNED_COLORS.ink, fontSize: 16, lineHeight: 22 },
  clearSearch: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  sortButton: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E9E2D9', backgroundColor: '#FCFAF6' },
  deckHeader: { paddingHorizontal: 25, marginTop: 22, marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deckLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deckDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: OWNED_COLORS.gold },
  deckLabel: { color: '#8D8175', fontSize: 12, lineHeight: 18 },
  deckCount: { color: '#A79A8D', fontSize: 12 },
  carouselFrame: { width: '100%', position: 'relative', height: undefined },
  cardShell: { height: undefined, alignItems: 'center', paddingTop: 8, paddingBottom: 7 },
  cardShellSelected: { opacity: 0.94 },
  collectionCard: { position: 'relative', overflow: 'hidden', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, alignSelf: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#ECE6DE', backgroundColor: '#FFFFFF', shadowColor: '#594A3D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 },
  coverMount: { width: '100%', aspectRatio: 1, position: 'relative' },
  coverArt: { width: '100%', height: '100%' },
  selectionMark: { position: 'absolute', top: 12, right: 12, width: 27, height: 27, borderRadius: 14, borderWidth: 1.5, borderColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  selectionMarkSelected: { backgroundColor: OWNED_COLORS.blue, borderColor: '#FFFFFF' },
  cardCaption: { minHeight: 58, paddingHorizontal: 5, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captionMain: { flex: 1, paddingRight: 10 },
  cardName: { color: OWNED_COLORS.ink, fontSize: 15, lineHeight: 20 },
  cardSerial: { color: '#8E8175', fontSize: 12, lineHeight: 17, marginTop: 2 },
  sideNumber: { position: 'absolute', right: 8, top: '17%', zIndex: 2 },
  sideStatus: { position: 'absolute', right: 8, top: '45%', zIndex: 2 },
  carouselArrow: { position: 'absolute', top: '44%', zIndex: 5, width: 35, height: 35, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#E7DED2', alignItems: 'center', justifyContent: 'center', shadowColor: '#4D3D31', shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  carouselArrowLeft: { left: 9 },
  carouselArrowRight: { right: 9 },
  pageIndicator: { marginTop: 1, marginBottom: 8, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DED6CA' },
  dotActive: { width: 9, height: 9, borderRadius: 5, backgroundColor: OWNED_COLORS.blue },
  pageLabel: { color: '#988B7D', fontSize: 11 },
  filmStrip: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 18, gap: 9 },
  filmItem: { width: 62, height: 62, padding: 3, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2D9CD' },
  filmItemSelected: { borderWidth: 2, borderColor: OWNED_COLORS.gold, padding: 2, backgroundColor: '#FCF4E5' },
  filmArt: { width: '100%', height: '100%', aspectRatio: 1, borderRadius: 6 },
  filmStatus: { position: 'absolute', right: 2, bottom: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: OWNED_COLORS.blue, borderWidth: 1.5, borderColor: '#FFFFFF' },
  filmStatusListed: { backgroundColor: OWNED_COLORS.gold },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 80 },
  loadingText: { color: '#8D8175', fontSize: 13 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 70, gap: 11 },
  emptyAlbumArt: { width: 190, height: 127, marginBottom: 3 },
  emptySearchArt: { width: 190, height: 155, marginBottom: 3 },
  emptyNetworkArt: { width: 190, height: 194, marginBottom: 3 },
  emptyTitle: { color: OWNED_COLORS.ink, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  emptyHint: { color: OWNED_COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { minWidth: 146, minHeight: 46, marginTop: 9 },
  batchBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: '#EAE4DC', backgroundColor: 'rgba(255,255,255,0.98)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  batchSummary: { flex: 1 },
  batchCount: { color: OWNED_COLORS.ink, fontSize: 15, lineHeight: 20 },
  batchLimit: { color: '#9C9084', fontSize: 12 },
  batchNote: { color: '#93877D', fontSize: 11, lineHeight: 16, marginTop: 2 },
  batchAction: { width: 150, minHeight: 46 },
  toast: { position: 'absolute', left: 24, right: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(73,61,53,0.94)', zIndex: 30 },
  toastText: { color: '#FFFFFF', textAlign: 'center', fontSize: 13, lineHeight: 18 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,37,31,0.28)' },
  priceSheet: { width: '100%', maxHeight: '88%', paddingHorizontal: 25, paddingTop: 17 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: '#D9D1C6', marginBottom: 15 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F0EBE4' },
  sheetTitle: { color: OWNED_COLORS.ink, fontSize: 19, lineHeight: 26 },
  sheetSubtitle: { color: '#8E8175', fontSize: 12, lineHeight: 18, marginTop: 3 },
  sheetClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F7F4EF', alignItems: 'center', justifyContent: 'center' },
  sheetContent: { paddingTop: 17, paddingBottom: 14 },
  batchPreviewCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#EAE3D9', backgroundColor: '#FCFAF6', marginBottom: 20 },
  sheetPreviewArt: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: '#EAF1F2' },
  batchPreviewCopy: { flex: 1, paddingHorizontal: 11 },
  previewCollection: { color: OWNED_COLORS.ink, fontSize: 14, lineHeight: 19 },
  previewCount: { color: OWNED_COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  inputLabel: { color: OWNED_COLORS.ink, fontSize: 14, lineHeight: 20, marginBottom: 9 },
  currency: { color: '#95887B', fontSize: 12 },
  priceInputWrap: { minHeight: 55, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D8CBBB', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' },
  priceInput: { flex: 1, minWidth: 0, height: 52, padding: 0, borderWidth: 0, outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent', boxShadow: 'none', color: OWNED_COLORS.ink, fontSize: 22 },
  currencySuffix: { color: '#8D8175', fontSize: 13 },
  priceLimit: { color: OWNED_COLORS.blue, fontSize: 12, lineHeight: 18, marginTop: 8 },
  priceTotal: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderColor: '#F0EBE4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTotalLabel: { color: '#8D8175', fontSize: 13 },
  priceTotalValue: { color: OWNED_COLORS.ink, fontSize: 18 },
  noticeText: { color: '#9A8E82', fontSize: 12, lineHeight: 18, marginTop: 11, marginBottom: 15 },
  submitButton: { width: '100%', minHeight: 50 },
  sheetCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sheetCancelText: { color: '#8D8175', fontSize: 13 },
  sortSheet: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#EAE4DC' },
  sortOptions: { paddingTop: 12, gap: 8 },
  sortOption: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#EEE8E0', backgroundColor: '#FCFAF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sortOptionSelected: { borderColor: '#B6CAD5', backgroundColor: '#F0F5F7' },
  sortOptionCopy: { flex: 1 },
  sortOptionTitle: { color: OWNED_COLORS.ink, fontSize: 14, lineHeight: 20 },
  sortOptionTitleSelected: { color: OWNED_COLORS.blue },
  sortOptionHint: { color: '#988B7D', fontSize: 11, lineHeight: 16, marginTop: 2 },
  sortOptionDisabled: { opacity: 0.6 },
  sortRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#C9BEB2', alignItems: 'center', justifyContent: 'center' },
  sortRadioSelected: { borderColor: OWNED_COLORS.blue },
  sortRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OWNED_COLORS.blue },
});
