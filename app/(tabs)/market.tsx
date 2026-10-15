import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

type SortOption = 'hot' | 'latest' | 'price_asc' | 'price_desc' | 'followed';
type MarketKind = 'nft' | 'pfp';
type MarketCollection = Record<string, any> & { id: string; name: string };
type MarketTrade = {
  id: string;
  collection_id: string | null;
  transfer_type: string | null;
  seller_id: string | null;
  buyer_id: string | null;
  price: number | string | null;
  transfer_time: string;
};

const FOLLOWED_STORAGE_KEY = '@market_followed_collection_ids';
const HOT_WINDOW_DAYS = 30;
const LIST_LIMIT = 1000;
const CONTENT_MAX_WIDTH = 1200;
const CARD_GAP = 12;
const NAV_BAR_HEIGHT = 78;
const NON_SALE_TYPES = new Set(['好友转赠', 'launch_mint', 'genesis_mint']);

const formatMoney = (value: number | string | null | undefined) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0.00';
  const parts = amount.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return Math.floor(elapsed / 60_000) + ' 分钟前';
  if (elapsed < 86_400_000) return Math.floor(elapsed / 3_600_000) + ' 小时前';
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

const isSaleTrade = (trade: Partial<MarketTrade>) =>
  Number(trade.price) > 0 &&
  Boolean(trade.seller_id) &&
  !NON_SALE_TYPES.has(trade.transfer_type || '');

const getCollectionCategoryIds = (collection: MarketCollection) =>
  Array.isArray(collection.category_ids)
    ? collection.category_ids
    : collection.category_id
      ? [collection.category_id]
      : [];

const getMarketKind = (collection: MarketCollection, categories: any[]): MarketKind => {
  const categoryIds = getCollectionCategoryIds(collection);
  const categoryNames = categories
    .filter((category) => categoryIds.includes(category.id))
    .map((category) => category.name);
  const hints = [
    collection.collection_type,
    collection.collection_kind,
    collection.kind,
    collection.type,
    collection.series,
    collection.series_name,
    collection.name,
    ...categoryNames,
  ].filter(Boolean).join(' ').toLowerCase();
  return /pfp|居民图鉴|岛民图鉴|头像/.test(hints) ? 'pfp' : 'nft';
};

const FallbackImage = ({ uri, style }: { uri?: string; style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));

  useEffect(() => {
    setHasError(false);
    setLoading(Boolean(uri));
  }, [uri]);

  return (
    <View style={[style, styles.imageFallback]}>
      {loading && !hasError && <ActivityIndicator color="#789DB4" style={StyleSheet.absoluteFill} />}
      {!hasError && uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
          onError={() => { setHasError(true); setLoading(false); }}
        />
      ) : (
        <View style={styles.fallbackIconWrap}>
          <Text style={styles.fallbackIcon}>🥔</Text>
        </View>
      )}
    </View>
  );
};

export default function MarketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const [categories, setCategories] = useState<any[]>([]);
  const [collections, setCollections] = useState<MarketCollection[]>([]);
  const [activeKind, setActiveKind] = useState<MarketKind>('nft');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<SortOption>('hot');
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [hotCounts, setHotCounts] = useState<Record<string, number>>({});
  const [recentTrades, setRecentTrades] = useState<MarketTrade[]>([]);
  const [trendTrades, setTrendTrades] = useState<MarketTrade[]>([]);
  const [trendCollectionId, setTrendCollectionId] = useState<string | null>(null);
  const [trendFilterKind, setTrendFilterKind] = useState<MarketKind>('nft');
  const [trendFilterCategoryId, setTrendFilterCategoryId] = useState<string | null>(null);
  const [trendSearchQuery, setTrendSearchQuery] = useState('');
  const [tickerIndex, setTickerIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const [feedTab, setFeedTab] = useState<'trades' | 'trends'>('trades');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const searchProgress = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const contentWidth = Math.min(viewport.width, CONTENT_MAX_WIDTH);
  const columnCount = viewport.width >= 1100 ? 4 : viewport.width >= 720 ? 3 : 2;
  const cardWidth = Math.max(0, (contentWidth - 32 - CARD_GAP * (columnCount - 1)) / columnCount);
  const listBottomPadding = Math.max(insets.bottom, 8) + NAV_BAR_HEIGHT + 24;
  const expandedSearchWidth = Math.max(44, contentWidth - 32);
  const compactFilters = viewport.width < 360;

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedSort, savedCategory, savedFollows, savedKind] = await Promise.all([
          AsyncStorage.getItem('@market_sort'),
          AsyncStorage.getItem('@market_category'),
          AsyncStorage.getItem(FOLLOWED_STORAGE_KEY),
          AsyncStorage.getItem('@market_kind'),
        ]);
        if (savedSort && ['hot', 'latest', 'price_asc', 'price_desc', 'followed'].includes(savedSort)) {
          setActiveSort(savedSort as SortOption);
        }
        if (savedCategory && savedCategory !== 'all') setActiveCategory(savedCategory);
        if (savedKind === 'nft' || savedKind === 'pfp') setActiveKind(savedKind);
        if (savedFollows) {
          const parsedFollows: unknown = JSON.parse(savedFollows);
          if (Array.isArray(parsedFollows)) setFollowedIds(parsedFollows.filter((id): id is string => typeof id === 'string'));
        }
      } catch {
        // Keep safe defaults when saved preferences are unavailable.
      } finally {
        setPreferencesReady(true);
      }
    };
    void loadPreferences();
  }, []);

  useEffect(() => {
    Animated.spring(searchProgress, {
      toValue: searchOpen ? 1 : 0,
      stiffness: 320,
      damping: 28,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && searchOpen) searchInputRef.current?.focus();
    });
  }, [expandedSearchWidth, searchOpen, searchProgress]);

  useEffect(() => {
    if (recentTrades.length < 2) {
      setTickerIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setTickerIndex((current) => (current + 1) % recentTrades.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [recentTrades.length]);

  const fetchMarketData = useCallback(async () => {
    try {
      const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [categoryResult, collectionResult, trendResult, latestResult] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('collections').select('*').eq('is_tradeable', true),
        supabase.from('transfer_logs')
          .select('id, collection_id, transfer_type, seller_id, buyer_id, price, transfer_time:created_at')
          .gte('created_at', since)
          .not('seller_id', 'is', null)
          .gt('price', 0)
          .order('created_at', { ascending: false })
          .limit(LIST_LIMIT),
        supabase.from('transfer_logs')
          .select('id, collection_id, transfer_type, seller_id, buyer_id, price, transfer_time:created_at')
          .not('seller_id', 'is', null)
          .gt('price', 0)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (categoryResult.data) setCategories(categoryResult.data);
      if (collectionResult.error) throw collectionResult.error;
      setCollections((collectionResult.data || []) as MarketCollection[]);

      if (trendResult.error) {
        console.warn('近30天成交记录读取失败，热度与走势暂不可用：', trendResult.error);
        setTrendTrades([]);
        setHotCounts({});
      } else {
        const sales = ((trendResult.data || []) as MarketTrade[]).filter(isSaleTrade);
        setTrendTrades(sales);
        setHotCounts(sales.reduce<Record<string, number>>((counts, trade) => {
          if (trade.collection_id) counts[trade.collection_id] = (counts[trade.collection_id] || 0) + 1;
          return counts;
        }, {}));
      }

      if (latestResult.error) {
        console.warn('最近成交记录读取失败：', latestResult.error);
        setRecentTrades([]);
      } else {
        setRecentTrades(((latestResult.data || []) as MarketTrade[]).filter(isSaleTrade).slice(0, 20));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchMarketData();
    const channel = supabase
      .channel('market-live-transaction-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_logs' }, () => {
        void fetchMarketData();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchMarketData]));

  const onRefresh = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    void fetchMarketData();
  }, [fetchMarketData]);

  const handleSortChange = async (sort: SortOption) => {
    void Haptics.selectionAsync();
    setActiveSort(sort);
    try { await AsyncStorage.setItem('@market_sort', sort); } catch {}
  };

  const handleKindChange = async (kind: MarketKind) => {
    if (kind === activeKind) return;
    void Haptics.selectionAsync();
    setActiveKind(kind);
    setActiveCategory(null);
    setTrendCollectionId(null);
    setTrendFilterKind(kind);
    setTrendFilterCategoryId(null);
    try {
      await AsyncStorage.setItem('@market_kind', kind);
    } catch {}
  };

  const handleCategoryChange = async (categoryId: string) => {
    void Haptics.selectionAsync();
    setActiveCategory(categoryId);
    try { await AsyncStorage.setItem('@market_category', categoryId); } catch {}
  };

  const toggleFollowed = async (collectionId: string) => {
    void Haptics.selectionAsync();
    const nextFollowed = followedIds.includes(collectionId)
      ? followedIds.filter((id) => id !== collectionId)
      : [...followedIds, collectionId];
    setFollowedIds(nextFollowed);
    try { await AsyncStorage.setItem(FOLLOWED_STORAGE_KEY, JSON.stringify(nextFollowed)); } catch {}
  };

  const marketCollections = useMemo(
    () => collections.filter((collection) => getMarketKind(collection, categories) === activeKind),
    [activeKind, categories, collections],
  );

  const availableCategories = useMemo(
    () => categories.filter((category) =>
      marketCollections.some((collection) => getCollectionCategoryIds(collection).includes(category.id)),
    ),
    [categories, marketCollections],
  );

  useEffect(() => {
    if (!preferencesReady || loading) return;
    const nextCategory = availableCategories.some((category) => category.id === activeCategory)
      ? activeCategory
      : availableCategories[0]?.id || null;
    if (nextCategory !== activeCategory) setActiveCategory(nextCategory);
    void AsyncStorage.setItem('@market_category', nextCategory || 'all').catch(() => {});
  }, [activeCategory, availableCategories, loading, preferencesReady]);

  useEffect(() => {
    setTrendFilterKind(activeKind);
    setTrendFilterCategoryId(null);
    setTrendCollectionId(null);
  }, [activeKind]);

  const processedData = useMemo(() => {
    const filtered = marketCollections.filter((collection) => {
      const categoryIds = getCollectionCategoryIds(collection);
      const matchesCategory = !activeCategory || categoryIds.includes(activeCategory);
      const matchesSearch = String(collection.name || '').toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase());
      const matchesFollowed = activeSort !== 'followed' || followedIds.includes(collection.id);
      return matchesCategory && matchesSearch && matchesFollowed;
    });

    return filtered.sort((a, b) => {
      if (activeSort === 'hot') {
        const difference = (hotCounts[b.id] || 0) - (hotCounts[a.id] || 0);
        if (difference !== 0) return difference;
      }
      if (activeSort === 'price_asc') return Number(a.floor_price_cache || 0) - Number(b.floor_price_cache || 0);
      if (activeSort === 'price_desc') return Number(b.floor_price_cache || 0) - Number(a.floor_price_cache || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [activeCategory, activeSort, followedIds, hotCounts, marketCollections, searchQuery]);

  const collectionById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const currentTickerTrade = recentTrades[tickerIndex % Math.max(recentTrades.length, 1)];
  const tickerCollectionName = currentTickerTrade
    ? collectionById.get(currentTickerTrade.collection_id || '')?.name || '某件藏品'
    : '';
  const tickerMessage = currentTickerTrade
    ? '匿名藏友_' + String(currentTickerTrade.buyer_id || '岛民').slice(0, 4).toUpperCase() +
      ' 购买了 ' + tickerCollectionName + ' · ¥' + formatMoney(currentTickerTrade.price)
    : '点击查看近期成交播报与藏品走势';

  const trendScopeCollections = useMemo(
    () => collections.filter((collection) => getMarketKind(collection, categories) === trendFilterKind),
    [categories, collections, trendFilterKind],
  );
  const trendCategories = useMemo(
    () => categories.filter((category) =>
      trendScopeCollections.some((collection) => getCollectionCategoryIds(collection).includes(category.id)),
    ),
    [categories, trendScopeCollections],
  );
  const trendCollections = useMemo(
    () => trendScopeCollections.filter((collection) =>
      !trendFilterCategoryId || getCollectionCategoryIds(collection).includes(trendFilterCategoryId),
    ),
    [trendFilterCategoryId, trendScopeCollections],
  );
  const filteredTrendCollections = useMemo(
    () => trendCollections.filter((collection) =>
      String(collection.name || '').toLocaleLowerCase().includes(trendSearchQuery.trim().toLocaleLowerCase()),
    ),
    [trendCollections, trendSearchQuery],
  );
  const selectedTrendCollection = trendCollections.find((collection) => collection.id === trendCollectionId) || trendCollections[0];
  const trendCategoryName = categories.find((category) => category.id === trendFilterCategoryId)?.name;
  const selectedCollectionTrades = selectedTrendCollection
    ? trendTrades.filter((trade) => trade.collection_id === selectedTrendCollection.id)
    : [];
  const now = Date.now();
  const lastHourTrades = selectedCollectionTrades.filter((trade) => now - new Date(trade.transfer_time).getTime() <= 60 * 60 * 1000);
  const lastDayTrades = selectedCollectionTrades.filter((trade) => now - new Date(trade.transfer_time).getTime() <= 24 * 60 * 60 * 1000);
  const averagePrice = lastDayTrades.length
    ? lastDayTrades.reduce((sum, trade) => sum + Number(trade.price || 0), 0) / lastDayTrades.length
    : null;
  const currentFloor = Number(selectedTrendCollection?.floor_price_cache || 0);
  const floorLabel = currentFloor > 0 && Number(selectedTrendCollection?.on_sale_count || 0) > 0
    ? '¥' + formatMoney(currentFloor)
    : '暂无';

  const dayBuckets = new Map<string, { total: number; count: number }>();
  selectedCollectionTrades.forEach((trade) => {
    const day = new Date(trade.transfer_time).toISOString().slice(0, 10);
    const bucket = dayBuckets.get(day) || { total: 0, count: 0 };
    bucket.total += Number(trade.price || 0);
    bucket.count += 1;
    dayBuckets.set(day, bucket);
  });
  const chartDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now - (29 - index) * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    return { key, average: bucket ? bucket.total / bucket.count : null };
  });
  const chartValues = chartDays.map((day) => day.average).filter((value): value is number => value !== null);
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length ? Math.max(...chartValues) : 0;

  const renderItem = ({ item }: { item: MarketCollection }) => {
    const isDelisted = Number(item.on_sale_count || 0) === 0;
    const displayPrice = isDelisted ? Number(item.max_consign_price || 0) : Number(item.floor_price_cache || 0);

    return (
      <View style={[styles.card, { width: cardWidth }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={'查看藏品 ' + item.name}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/collection', params: { id: item.id } });
          }}
        >
          <View style={styles.imageContainer}>
            <FallbackImage uri={item.image_url} style={styles.image} />
            {isDelisted && (
              <View pointerEvents="none" style={styles.delistedOverlay}>
                <BlurView intensity={7} tint="light" style={StyleSheet.absoluteFill} />
                <View style={styles.delistedFrost} />
                <Image
                  source={require('../../assets/market/delisted-potato-plaque-v2.png')}
                  style={styles.delistedPlaque}
                  resizeMode="contain"
                />
                <Text style={styles.delistedText}>已退市</Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.supplyText}>在售 {formatMoney(item.on_sale_count || 0).replace('.00', '')}</Text>
              <Text style={styles.supplyText}>·</Text>
              <Text style={styles.supplyText}>流通 {formatMoney(item.circulating_supply).replace('.00', '')}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{isDelisted ? '退市价' : '地板价'}</Text>
              <Text style={[styles.price, isDelisted && styles.delistedPrice]}>¥{formatMoney(displayPrice)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={followedIds.includes(item.id) ? '取消关注' + item.name : '关注' + item.name}
          accessibilityState={{ selected: followedIds.includes(item.id) }}
          style={styles.followButton}
          onPress={() => { void toggleFollowed(item.id); }}
          activeOpacity={0.78}
        >
          <Ionicons
            name={followedIds.includes(item.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={followedIds.includes(item.id) ? '#D87572' : '#596A73'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const searchWidth = searchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [44, expandedSearchWidth],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerOuter}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="查看藏品实时交易播报"
            style={styles.broadcastButton}
            activeOpacity={0.82}
            onPress={() => { setFeedTab('trades'); setFeedVisible(true); }}
          >
            <View style={styles.liveBadge}>
              <Ionicons name="megaphone-outline" size={14} color="#69808C" />
              <Text style={styles.liveBadgeText}>成交播报</Text>
            </View>
            <View style={styles.tickerTextWindow}>
              <Text numberOfLines={1} style={styles.tickerText}>{tickerMessage}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9A8B7D" />
          </TouchableOpacity>
          <Animated.View style={[styles.searchOverlay, { width: searchWidth }]}>
            {searchOpen ? (
              <View style={styles.expandedSearch}>
                <Ionicons name="search-outline" size={19} color="#8C8177" />
                <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInput, viewport.width < 768 && styles.searchInputMobile]}
                  placeholder="搜索藏品名称"
                  placeholderTextColor="#A59A90"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  returnKeyType="search"
                  selectionColor="#B68E54"
                  accessibilityLabel="搜索藏品名称"
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="收起搜索"
                  hitSlop={8}
                  onPress={() => { setSearchOpen(false); Keyboard.dismiss(); }}
                  style={styles.searchClose}
                >
                  <Ionicons name="close" size={19} color="#796D64" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="展开搜索"
                style={styles.searchToggle}
                onPress={() => setSearchOpen(true)}
              >
                <Ionicons name="search-outline" size={21} color="#6E6258" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </View>

      <View style={styles.filterOuter}>
        <View style={[styles.filterBar, compactFilters && styles.filterBarNarrow]}>
          <View style={styles.marketKindSwitcher} accessibilityRole="tablist">
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: activeKind === 'nft' }}
              style={[styles.marketKindTab, activeKind === 'nft' && styles.marketKindTabActive]}
              onPress={() => { void handleKindChange('nft'); }}
            >
              <Text numberOfLines={1} style={[styles.marketKindText, compactFilters && styles.marketKindTextCompact, activeKind === 'nft' && styles.marketKindTextActive]}>土豆王国</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: activeKind === 'pfp' }}
              style={[styles.marketKindTab, styles.pfpKindTab, activeKind === 'pfp' && styles.marketKindTabActive]}
              onPress={() => { void handleKindChange('pfp'); }}
            >
              <Text numberOfLines={1} style={[styles.marketKindText, compactFilters && styles.marketKindTextCompact, activeKind === 'pfp' && styles.marketKindTextActive]}>居民图鉴</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.sortSection, compactFilters && styles.sortSectionNarrow]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: activeSort === 'hot' }}
              style={[styles.sortButton, compactFilters && styles.sortButtonNarrow, activeSort === 'hot' && styles.sortButtonActive]}
              onPress={() => { void handleSortChange('hot'); }}
            >
              <Text numberOfLines={1} style={[styles.sortText, activeSort === 'hot' && styles.sortTextActive]}>最热</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: activeSort === 'latest' }}
              style={[styles.sortButton, compactFilters && styles.sortButtonNarrow, activeSort === 'latest' && styles.sortButtonActive]}
              onPress={() => { void handleSortChange('latest'); }}
            >
              <Text numberOfLines={1} style={[styles.sortText, activeSort === 'latest' && styles.sortTextActive]}>最新</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: activeSort === 'price_asc' || activeSort === 'price_desc' }}
              style={[styles.sortButton, compactFilters && styles.sortButtonNarrow, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortButtonActive]}
              onPress={() => { void handleSortChange(activeSort === 'price_asc' ? 'price_desc' : 'price_asc'); }}
            >
              <Text style={[styles.sortText, (activeSort === 'price_asc' || activeSort === 'price_desc') && styles.sortTextActive]} numberOfLines={1}>
                价格{activeSort === 'price_asc' ? '↑' : activeSort === 'price_desc' ? '↓' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: activeSort === 'followed' }}
              style={[styles.sortButton, styles.followSortButton, compactFilters && styles.sortButtonNarrow, compactFilters && styles.followSortButtonNarrow, activeSort === 'followed' && styles.sortButtonActive]}
              onPress={() => { void handleSortChange('followed'); }}
            >
              <Ionicons name={activeSort === 'followed' ? 'heart' : 'heart-outline'} size={12} color={activeSort === 'followed' ? '#D87572' : '#948A80'} />
              <Text numberOfLines={1} style={[styles.sortText, activeSort === 'followed' && styles.sortTextActive]}>关注</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.categoryOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {availableCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected: activeCategory === category.id }}
              style={[styles.categoryChip, activeCategory === category.id && styles.categoryChipActive]}
              onPress={() => { void handleCategoryChange(category.id); }}
            >
              <Text style={[styles.categoryText, activeCategory === category.id && styles.categoryTextActive]}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>{loading ? '正在整理藏品' : '共 ' + processedData.length + ' 件藏品'}</Text>
        {activeSort === 'hot' && <Text style={styles.sortHint}>近 30 日成交排序</Text>}
      </View>

      {loading ? (
        <View style={styles.listOuter}>
          <View style={styles.skeletonGrid}>
            {Array.from({ length: columnCount * 2 }).map((_, index) => (
              <View key={index} style={[styles.card, styles.skeletonCard, { width: cardWidth }]}>
                <View style={styles.skeletonImage} />
                <View style={styles.skeletonInfo}>
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineShort} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          key={'market-grid-' + columnCount}
          data={processedData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={columnCount}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          columnWrapperStyle={styles.cardRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#789DB4" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIllustration}><Text style={styles.emptyIcon}>🥔</Text></View>
              <Text style={styles.emptyTitle}>
                {activeKind === 'pfp' ? '居民图鉴正在准备中' : '这里还没有藏品'}
              </Text>
              <Text style={styles.emptyText}>
                {activeSort === 'followed' && followedIds.length === 0
                  ? '把喜欢的藏品收进图鉴，就能在关注里快速找到它们。'
                  : activeKind === 'pfp'
                    ? '岛民头像专区的藏品上架后，会出现在这里。'
                    : '试试切换分区，或清除当前筛选条件。'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={feedVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFeedVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="关闭成交播报"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={() => setFeedVisible(false)}
          />
          <View style={[styles.feedPanel, { paddingBottom: Math.max(insets.bottom, 16), minHeight: Math.min(420, viewport.height * 0.7), maxHeight: viewport.height * 0.9 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.feedHeader}>
              <View>
                <Text style={styles.feedTitle}>藏品实时交易情况</Text>
                <Text style={styles.feedSubtitle}>成交播报与藏品走势</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="关闭"
                style={styles.modalClose}
                onPress={() => setFeedVisible(false)}
              >
                <Ionicons name="close" size={21} color="#6D625A" />
              </TouchableOpacity>
            </View>

            <View style={styles.feedTabs}>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: feedTab === 'trades' }}
                style={[styles.feedTab, feedTab === 'trades' && styles.feedTabActive]}
                onPress={() => setFeedTab('trades')}
              >
                <Text style={[styles.feedTabText, feedTab === 'trades' && styles.feedTabTextActive]}>成交播报</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: feedTab === 'trends' }}
                style={[styles.feedTab, feedTab === 'trends' && styles.feedTabActive]}
                onPress={() => setFeedTab('trends')}
              >
                <Text style={[styles.feedTabText, feedTab === 'trends' && styles.feedTabTextActive]}>藏品走势</Text>
              </TouchableOpacity>
            </View>

            {feedTab === 'trades' ? (
              <ScrollView style={styles.feedScroll} contentContainerStyle={styles.feedScrollContent}>
                <Text style={styles.panelHint}>最近 20 笔成交</Text>
                {recentTrades.length ? recentTrades.map((trade, index) => {
                  const collectionName = collectionById.get(trade.collection_id || '')?.name || '某件藏品';
                  const buyerName = trade.buyer_id === 'system'
                    ? '创世中枢网络'
                    : '匿名藏友_' + String(trade.buyer_id || '岛民').slice(0, 4).toUpperCase();
                  return (
                    <View key={trade.id || String(index)} style={styles.tradeRow}>
                      <View style={styles.tradeAvatar}><Ionicons name="person-outline" size={16} color="#8A796B" /></View>
                      <View style={styles.tradeCopy}>
                        <Text style={styles.tradeName} numberOfLines={1}>{buyerName}</Text>
                        <Text style={styles.tradeDescription} numberOfLines={1}>购买了 {collectionName} · {formatRelativeTime(trade.transfer_time)}</Text>
                      </View>
                      <Text style={styles.tradePrice}>¥{formatMoney(trade.price)}</Text>
                    </View>
                  );
                }) : (
                  <View style={styles.feedEmpty}>
                    <Ionicons name="receipt-outline" size={25} color="#B5A99D" />
                    <Text style={styles.feedEmptyText}>暂时还没有成交记录</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.feedScroll} contentContainerStyle={styles.trendContent}>
                <View style={styles.trendPicker}>
                  <Text style={styles.trendPickerLabel}>分区</Text>
                  <View style={styles.trendScopeChoices}>
                    {([
                      { id: 'nft' as const, label: '土豆王国' },
                      { id: 'pfp' as const, label: '居民图鉴' },
                    ]).map((scope) => (
                      <TouchableOpacity
                        key={scope.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: trendFilterKind === scope.id }}
                        style={[styles.trendScopeChoice, trendFilterKind === scope.id && styles.trendScopeChoiceActive]}
                        onPress={() => {
                          setTrendFilterKind(scope.id);
                          setTrendFilterCategoryId(null);
                          setTrendCollectionId(null);
                          setTrendSearchQuery('');
                        }}
                      >
                        <Text style={[styles.trendScopeChoiceText, trendFilterKind === scope.id && styles.trendScopeChoiceTextActive]}>
                          {scope.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.trendPickerLabel}>分类</Text>
                  {trendCategories.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendCategoryChoices}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ selected: trendFilterCategoryId === null }}
                        style={[styles.trendCategoryChoice, trendFilterCategoryId === null && styles.trendCategoryChoiceActive]}
                        onPress={() => { setTrendFilterCategoryId(null); setTrendCollectionId(null); }}
                      >
                        <Text style={[styles.trendCategoryChoiceText, trendFilterCategoryId === null && styles.trendCategoryChoiceTextActive]}>全部分类</Text>
                      </TouchableOpacity>
                      {trendCategories.map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: trendFilterCategoryId === category.id }}
                          style={[styles.trendCategoryChoice, trendFilterCategoryId === category.id && styles.trendCategoryChoiceActive]}
                          onPress={() => { setTrendFilterCategoryId(category.id); setTrendCollectionId(null); }}
                        >
                          <Text style={[styles.trendCategoryChoiceText, trendFilterCategoryId === category.id && styles.trendCategoryChoiceTextActive]}>{category.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.trendNoCategories}>{trendFilterKind === 'pfp' ? '居民图鉴暂未开放分类' : '当前没有可用分类'}</Text>
                  )}

                  <View style={styles.trendSearchField}>
                    <Ionicons name="search-outline" size={17} color="#96897E" />
                    <TextInput
                      style={[styles.trendSearchInput, viewport.width < 768 && styles.searchInputMobile]}
                      placeholder="搜索藏品名称"
                      placeholderTextColor="#A59A90"
                      value={trendSearchQuery}
                      onChangeText={setTrendSearchQuery}
                      returnKeyType="search"
                      selectionColor="#B68E54"
                      accessibilityLabel="搜索走势藏品名称"
                    />
                    {trendSearchQuery.length > 0 && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="清空藏品搜索"
                        onPress={() => setTrendSearchQuery('')}
                        style={styles.trendSearchClear}
                      >
                        <Ionicons name="close-circle" size={17} color="#A3968B" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {trendScopeCollections.length > 0 && (
                    <ScrollView style={styles.trendResults} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredTrendCollections.slice(0, 25).map((collection) => {
                        const categoryName = categories
                          .filter((category) => getCollectionCategoryIds(collection).includes(category.id))
                          .map((category) => category.name)
                          .join(' · ');
                        const selected = selectedTrendCollection?.id === collection.id;
                        return (
                          <TouchableOpacity
                            key={collection.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            style={[styles.trendResultRow, selected && styles.trendResultRowActive]}
                            onPress={() => setTrendCollectionId(collection.id)}
                          >
                            <View style={styles.trendResultCopy}>
                              <Text style={[styles.trendResultName, selected && styles.trendResultNameActive]} numberOfLines={1}>{collection.name}</Text>
                              <Text style={styles.trendResultCategory} numberOfLines={1}>{categoryName || '未分类'}</Text>
                            </View>
                            {selected && <Ionicons name="checkmark" size={18} color="#66859A" />}
                          </TouchableOpacity>
                        );
                      })}
                      {filteredTrendCollections.length === 0 && (
                        <Text style={styles.trendResultEmpty}>没有找到匹配藏品</Text>
                      )}
                      {filteredTrendCollections.length > 25 && (
                        <Text style={styles.trendResultHint}>匹配到 {filteredTrendCollections.length} 件，请输入名称缩小范围</Text>
                      )}
                    </ScrollView>
                  )}
                </View>

                {selectedTrendCollection ? (
                  <>
                    <View style={styles.trendCurrentSelection}>
                      <Text style={styles.panelHint}>
                        {trendFilterKind === 'nft' ? '土豆王国' : '居民图鉴'}
                        {trendCategoryName ? ' · ' + trendCategoryName : ''}
                      </Text>
                      <Text style={styles.trendCollectionName} numberOfLines={1}>{selectedTrendCollection.name}</Text>
                    </View>

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>近 1 小时成交</Text>
                        <Text style={styles.metricValue}>{lastHourTrades.length} 笔</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>近 24 小时成交</Text>
                        <Text style={styles.metricValue}>{lastDayTrades.length} 笔</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>成交均价</Text>
                        <Text style={styles.metricValue}>{averagePrice === null ? '暂无' : '¥' + formatMoney(averagePrice)}</Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>当前地板价</Text>
                        <Text style={styles.metricValue}>{floorLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.chartHeader}>
                      <Text style={styles.chartTitle}>近 30 日成交均价</Text>
                      <Text style={styles.chartUnit}>土豆币</Text>
                    </View>
                    {chartValues.length ? (
                      <>
                        <View style={styles.chartArea}>
                          <View style={[styles.chartGuide, { top: '25%' }]} />
                          <View style={[styles.chartGuide, { top: '60%' }]} />
                          <View style={styles.chartBars}>
                            {chartDays.map((day) => {
                              const ratio = day.average === null
                                ? 0
                                : (day.average - chartMin) / (chartMax - chartMin || 1);
                              return (
                                <View key={day.key} style={styles.chartBarSlot}>
                                  <View style={[styles.chartBar, { height: day.average === null ? 2 : 18 + ratio * 62, opacity: day.average === null ? 0.14 : 0.92 }]} />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                        <View style={styles.chartLabels}>
                          <Text style={styles.chartLabel}>30 天前</Text>
                          <Text style={styles.chartLabel}>今天</Text>
                        </View>
                        <Text style={styles.chartFootnote}>成交均价按近 24 小时记录计算；图表按每日成交均价汇总。</Text>
                      </>
                    ) : (
                      <View style={styles.chartEmpty}>
                        <Text style={styles.chartEmptyText}>近 30 日暂无成交记录</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.trendNoCollections}>
                    <Ionicons name="leaf-outline" size={24} color="#8BA4AC" />
                    <Text style={styles.trendNoCollectionsTitle}>
                      {trendFilterKind === 'pfp' ? '居民图鉴暂未上架藏品' : '当前分类暂无可查看走势的藏品'}
                    </Text>
                    <Text style={styles.feedEmptyText}>分区与搜索筛选仍可使用，选择其他分区继续查看。</Text>
                    {trendFilterKind === 'pfp' && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.trendSwitchButton}
                        onPress={() => {
                          setTrendFilterKind('nft');
                          setTrendFilterCategoryId(null);
                          setTrendCollectionId(null);
                          setTrendSearchQuery('');
                        }}
                      >
                        <Text style={styles.trendSwitchButtonText}>切换到土豆王国</Text>
                        <Ionicons name="arrow-forward" size={15} color="#537895" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerOuter: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, zIndex: 2 },
  headerRow: { height: 46, flexDirection: 'row', alignItems: 'center', position: 'relative' },
  broadcastButton: { flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingRight: 45, backgroundColor: '#FBFAF8', borderRadius: 14, borderWidth: 1, borderColor: '#ECE7E0' },
  liveBadge: { height: 26, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#F0F3F3' },
  liveBadgeText: { color: '#607985', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  tickerTextWindow: { flex: 1, minWidth: 0, overflow: 'hidden' },
  tickerText: { color: '#695D53', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  searchOverlay: { position: 'absolute', right: 0, top: 1, bottom: 1, height: 44, zIndex: 5, overflow: 'hidden', borderRadius: 14 },
  searchToggle: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFAF8', borderWidth: 1, borderColor: '#ECE7E0', borderRadius: 14 },
  expandedSearch: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: '#FBFAF8', borderWidth: 1, borderColor: '#ECE7E0', borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', fontSize: 14, color: '#493D35', paddingVertical: 0 },
  searchInputMobile: { fontSize: 16, lineHeight: 20 },
  searchClose: { width: 26, height: 34, alignItems: 'center', justifyContent: 'center' },

  filterOuter: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  filterBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  filterBarNarrow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  marketKindSwitcher: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 2, padding: 2, borderRadius: 13, backgroundColor: '#F8F7F4', borderWidth: 1, borderColor: '#EFEAE4' },
  marketKindTab: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: 7, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pfpKindTab: { paddingHorizontal: 7 },
  marketKindTabActive: { backgroundColor: '#F2E8D6', borderWidth: 1, borderColor: '#E4D4B7' },
  marketKindText: { color: '#82766D', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  marketKindTextCompact: { fontSize: 10, lineHeight: 14 },
  marketKindTextActive: { color: '#71552F', fontWeight: '800' },
  sortSection: { flexShrink: 1, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  sortSectionNarrow: { flex: 1, width: undefined, flexShrink: 1, justifyContent: 'space-between', gap: 0 },
  sortButton: { minWidth: 42, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 6, borderRadius: 10 },
  sortButtonNarrow: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 2 },
  followSortButton: { paddingHorizontal: 4 },
  followSortButtonNarrow: { flex: 1.35 },
  sortButtonActive: { backgroundColor: '#EEF3F7' },
  sortText: { color: '#82766D', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  sortTextActive: { color: '#537895', fontWeight: '700' },

  categoryOuter: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', backgroundColor: '#FFFFFF' },
  categoryScroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 8 },
  categoryChip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#FBFCFC', borderWidth: 1, borderColor: '#EEF1F2', alignItems: 'center', justifyContent: 'center' },
  categoryChipActive: { backgroundColor: '#EEF3F6', borderColor: '#D7E2E8' },
  categoryText: { color: '#75685D', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  categoryTextActive: { color: '#537895', fontWeight: '700' },
  resultRow: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', minHeight: 28, paddingHorizontal: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: '#94877C', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  sortHint: { color: '#A89A8E', fontSize: 11, lineHeight: 14 },

  listOuter: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH + 32, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: CARD_GAP },
  skeletonCard: { marginBottom: 0, opacity: 0.62 },
  skeletonImage: { width: '100%', aspectRatio: 1, backgroundColor: '#EEF2F4' },
  skeletonInfo: { padding: 12 },
  skeletonLineWide: { width: '78%', height: 14, marginBottom: 8, borderRadius: 4, backgroundColor: '#E5EAED' },
  skeletonLineShort: { width: '48%', height: 10, borderRadius: 4, backgroundColor: '#E5EAED' },
  listContent: { width: '100%', maxWidth: CONTENT_MAX_WIDTH + 32, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  cardRow: { gap: CARD_GAP, justifyContent: 'flex-start' },
  card: { position: 'relative', marginBottom: 14, overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEE9E3', shadowColor: '#493D35', shadowOpacity: 0.035, shadowRadius: 7, elevation: 1 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FBFAF8', borderBottomWidth: 1, borderColor: '#F1ECE5', overflow: 'hidden' },
  imageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FA', overflow: 'hidden' },
  fallbackIconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackIcon: { fontSize: 32 },
  image: { width: '100%', height: '100%' },
  delistedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(238,243,239,0.10)' },
  delistedFrost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(236,242,237,0.08)' },
  delistedPlaque: { position: 'absolute', width: '91%', height: '91%' },
  delistedText: { position: 'absolute', left: '22%', right: '22%', top: '70%', textAlign: 'center', color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontWeight: '900', letterSpacing: 3, textShadowColor: 'rgba(56,81,79,0.72)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  followButton: { position: 'absolute', top: 9, right: 9, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: 'rgba(224,230,232,0.9)', shadowColor: '#38464D', shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  info: { paddingHorizontal: 11, paddingTop: 11, paddingBottom: 12 },
  name: { color: '#493D35', fontSize: 15, lineHeight: 20, fontWeight: '700', marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  supplyText: { color: '#94877C', fontSize: 11, lineHeight: 14, marginRight: 5, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#EEE9E3', paddingTop: 8 },
  priceLabel: { color: '#94877C', fontSize: 11, lineHeight: 14, fontWeight: '500' },
  price: { color: '#9A6A33', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  delistedPrice: { color: '#8D6E63' },
  emptyState: { alignItems: 'center', marginTop: 58, paddingHorizontal: 24 },
  emptyIllustration: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F3F7F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { marginBottom: 8, color: '#493D35', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#67777F', fontWeight: '500', fontSize: 13, lineHeight: 19, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(48,39,32,0.30)', justifyContent: 'flex-end', paddingTop: 48 },
  feedPanel: { width: '100%', maxWidth: 720, maxHeight: '90%', minHeight: 420, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 10, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 14, borderRadius: 2, backgroundColor: '#E8E1D9' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  feedTitle: { color: '#493D35', fontSize: 18, lineHeight: 24, fontWeight: '800' },
  feedSubtitle: { marginTop: 2, color: '#94877C', fontSize: 12, lineHeight: 16 },
  modalClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#F7F5F1' },
  feedTabs: { flexDirection: 'row', padding: 3, marginBottom: 12, borderRadius: 12, backgroundColor: '#F7F5F1' },
  feedTab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  feedTabActive: { backgroundColor: '#E7F0F5' },
  feedTabText: { color: '#84776D', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  feedTabTextActive: { color: '#466E88', fontWeight: '800' },
  feedScroll: { flex: 1 },
  feedScrollContent: { paddingBottom: 12 },
  panelHint: { marginBottom: 4, color: '#9B8E83', fontSize: 11, lineHeight: 15 },
  tradeRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1ECE6' },
  tradeAvatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#F7F4EF' },
  tradeCopy: { flex: 1, minWidth: 0 },
  tradeName: { color: '#493D35', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  tradeDescription: { marginTop: 2, color: '#94877C', fontSize: 11, lineHeight: 15 },
  tradePrice: { color: '#9A6A33', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  feedEmpty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  feedEmptyText: { color: '#8F8176', fontSize: 13, lineHeight: 19, textAlign: 'center' },

  trendContent: { paddingBottom: 16 },
  trendCurrentSelection: { marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E8EDF0', backgroundColor: '#F8FAFB' },
  trendCollectionName: { marginTop: 2, color: '#493D35', fontSize: 16, lineHeight: 22, fontWeight: '800' },
  trendPicker: { marginBottom: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E8EDF0', backgroundColor: '#FFFFFF' },
  trendPickerLabel: { marginTop: 2, marginBottom: 7, color: '#8C8075', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  trendScopeChoices: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  trendScopeChoice: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#FAFAF8', borderWidth: 1, borderColor: '#EAE6DF' },
  trendScopeChoiceActive: { backgroundColor: '#F2E8D6', borderColor: '#E4D4B7' },
  trendScopeChoiceText: { color: '#82766D', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  trendScopeChoiceTextActive: { color: '#71552F', fontWeight: '800' },
  trendCategoryChoices: { gap: 7, paddingBottom: 11 },
  trendCategoryChoice: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: '#EEF1F2', backgroundColor: '#FBFCFC' },
  trendCategoryChoiceActive: { borderColor: '#D7E2E8', backgroundColor: '#EEF3F6' },
  trendCategoryChoiceText: { color: '#80746A', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  trendCategoryChoiceTextActive: { color: '#537895', fontWeight: '700' },
  trendNoCategories: { paddingBottom: 10, color: '#94877C', fontSize: 12, lineHeight: 17 },
  trendSearchField: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#ECE7E0', backgroundColor: '#FBFAF8' },
  trendSearchInput: { flex: 1, minWidth: 0, height: 40, fontSize: 14, color: '#493D35', paddingVertical: 0 },
  trendSearchClear: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  trendResults: { maxHeight: 150, marginTop: 7 },
  trendResultRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 9, borderRadius: 9, borderBottomWidth: 1, borderColor: '#F1ECE6' },
  trendResultRowActive: { backgroundColor: '#F3F7F9' },
  trendResultCopy: { flex: 1, minWidth: 0, paddingVertical: 6 },
  trendResultName: { color: '#554A41', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  trendResultNameActive: { color: '#466E88', fontWeight: '800' },
  trendResultCategory: { marginTop: 1, color: '#A3968B', fontSize: 10, lineHeight: 14 },
  trendResultEmpty: { paddingVertical: 18, color: '#94877C', textAlign: 'center', fontSize: 12, lineHeight: 17 },
  trendResultHint: { paddingVertical: 8, color: '#94877C', textAlign: 'center', fontSize: 11, lineHeight: 15 },
  trendNoCollections: { minHeight: 148, alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2, paddingHorizontal: 18, paddingVertical: 20, borderRadius: 16, backgroundColor: '#F8FAFB', borderWidth: 1, borderColor: '#E8EDF0' },
  trendNoCollectionsTitle: { color: '#493D35', fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  trendSwitchButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2, paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#EAF1F5' },
  trendSwitchButtonText: { color: '#537895', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '48%', minHeight: 70, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#EEE9E3', backgroundColor: '#FCFBF9' },
  metricLabel: { color: '#91857A', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  metricValue: { marginTop: 5, color: '#493D35', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  chartTitle: { color: '#493D35', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  chartUnit: { color: '#A3968B', fontSize: 11, lineHeight: 15 },
  chartArea: { height: 100, justifyContent: 'flex-end', overflow: 'hidden', paddingHorizontal: 4 },
  chartGuide: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EFEAE4' },
  chartBars: { height: 84, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  chartBarSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: '52%', minWidth: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#9DB9CC' },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  chartLabel: { color: '#A3968B', fontSize: 10, lineHeight: 14 },
  chartFootnote: { marginTop: 10, color: '#94877C', fontSize: 11, lineHeight: 16 },
  chartEmpty: { height: 110, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FAF8F5' },
  chartEmptyText: { color: '#94877C', fontSize: 12, lineHeight: 17 },
});
