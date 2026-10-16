import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PencilButton from '../../components/PencilButton';
import { useIslandFonts } from '../../hooks/use-island-fonts';
import { supabase } from '../../supabase';

const COLORS = { ink: '#493D35', muted: '#94877C', line: '#EEE9E3', blue: '#537895', gold: '#9A6A33' };
const MENU_GRID = [
  { name: '订单', icon: require('../../assets/treasury/classic-island-v1/runtime/orders.webp'), route: '/my-orders', original: false },
  { name: '邀请', icon: require('../../assets/treasury/classic-island-v1/runtime/invite.webp'), route: null, original: false },
  { name: '求购', icon: require('../../assets/treasury/classic-island-v1/runtime/buy-request.webp'), route: '/create-buy-order', original: false },
  { name: '钱包', icon: require('../../assets/treasury/classic-island-v1/runtime/wallet.webp'), route: '/wallet', original: false },
  { name: '合成', icon: require('../../assets/homepage/icons/gene.png'), route: '/synthesis-list', original: true },
  { name: '权益', icon: require('../../assets/homepage/icons/lord.png'), route: '/vip-privilege', original: true },
  { name: '转赠', icon: require('../../assets/homepage/icons/transfer.png'), route: '/transfer', original: true },
  { name: '设置', icon: require('../../assets/treasury/classic-island-v1/runtime/settings.webp'), route: '/change-avatar', original: false },
] as const;
const VIP_NAMES: Record<number, string> = { 1: '大众会员', 2: '黄金会员', 3: '铂金会员', 4: '钻石会员', 5: '黑钻会员' };
type Profile = { id: string; nickname: string | null; avatar_url: string | null; is_admin: boolean; vip_level: number | null; potato_coin_balance: number | string | null };
type Collection = { id: string; name: string; image_url: string | null };
type OwnedNft = { id: string; status: string; collections: Collection | Collection[] | null };
type Holding = Collection & { count: number };

function formatMoney(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}

export default function ProfileScreen() {
  const router = useRouter();
  const fonts = useIslandFonts();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(Math.min(width, 720));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalNfts, setTotalNfts] = useState(0);
  const [earnings, setEarnings] = useState({ today: 0, month: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const requestId = useRef(0);
  const loadedProfileId = useRef<string | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string) => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setNotice(text);
    notificationTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);
  useEffect(() => () => { if (notificationTimer.current) clearTimeout(notificationTimer.current); }, []);
  useEffect(() => setAvatarFailed(false), [profile?.avatar_url]);
  useEffect(() => { setSearchOpen(false); setSearchQuery(''); }, [profile?.id]);

  const fetchProfileData = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (currentRequest !== requestId.current) return;
      if (!user) {
        loadedProfileId.current = null;
        setProfile(null); setHoldings([]); setTotalNfts(0);
        router.replace('/login'); return;
      }
      if (loadedProfileId.current && loadedProfileId.current !== user.id) {
        setProfile(null); setHoldings([]); setTotalNfts(0);
      }
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const fetchAllNfts = async () => {
        const all: OwnedNft[] = [];
        for (let page = 0; ; page++) {
          const { data, error: nftError } = await supabase.from('nfts')
            .select('id, collection_id, status, collections(id, name, image_url, max_consign_price)')
            .eq('owner_id', user.id).neq('status', 'burned')
            .order('id', { ascending: true }).range(page * 1000, (page + 1) * 1000 - 1);
          if (nftError) throw nftError;
          if (currentRequest !== requestId.current) return null;
          const batch = (data || []) as OwnedNft[];
          all.push(...batch);
          if (batch.length < 1000) return all;
        }
      };
      const [profileResult, todayResult, monthResult, nfts] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('transfer_logs').select('price').eq('seller_id', user.id).gte('created_at', startOfToday),
        supabase.from('transfer_logs').select('price').eq('seller_id', user.id).gte('created_at', startOfMonth),
        fetchAllNfts(),
      ]);
      if (currentRequest !== requestId.current || nfts === null) return;
      for (const result of [profileResult, todayResult, monthResult]) { if (result.error) throw result.error; }
      const grouped = new Map<string, Holding>();
      for (const nft of nfts) {
        const col = Array.isArray(nft.collections) ? nft.collections[0] : nft.collections;
        if (!col) continue;
        const existing = grouped.get(col.id);
        if (existing) existing.count++;
        else grouped.set(col.id, { ...col, count: 1 });
      }
      const sum = (rows: { price: number | string | null }[] | null) => (rows || []).reduce((total, row) => total + (Number(row.price) || 0), 0);
      setProfile(profileResult.data as Profile);
      loadedProfileId.current = user.id;
      setEarnings({ today: sum(todayResult.data), month: sum(monthResult.data) });
      setTotalNfts(nfts.length);
      setHoldings([...grouped.values()]);
      setFailedImages({});
    } catch {
      if (currentRequest === requestId.current) setError('金库暂时连接不上，请稍后重试');
    } finally {
      if (currentRequest === requestId.current) setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => {
    void fetchProfileData();
    return () => { requestId.current++; };
  }, [fetchProfileData]));

  const copyId = async () => {
    if (!profile) return;
    try { await Clipboard.setStringAsync(profile.id); notify('土豆岛号已复制'); }
    catch { notify('复制失败，请重试'); }
  };

  const isCompact = contentWidth < 370;
  const columns = contentWidth >= 640 ? 3 : 2;
  const collectionWidth = (contentWidth - 64 - (columns - 1) * 12) / columns;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredHoldings = holdings.filter(col => col.name.toLocaleLowerCase().includes(normalizedQuery));
  const regular = { fontFamily: fonts.regular };
  const semibold = { fontFamily: fonts.semibold, fontWeight: fonts.semibold ? 'normal' as const : '600' as const };
  const statusName = profile?.is_admin ? '创世神' : (VIP_NAMES[profile?.vip_level || 1] || '大众会员');
  const consoleEntry = profile?.is_admin ? (
    <Pressable accessibilityRole="button" accessibilityLabel="进入创世中枢控制台" onPress={() => router.push('/admin-panel')}
      style={({ pressed }) => [styles.console, isCompact && styles.consoleCompact, pressed && styles.pressed]}>
      <Image source={require('../../assets/homepage/icons/lord.png')} style={styles.consoleIcon} accessible={false} />
      <Text style={[styles.consoleText, semibold]}>创世中枢控制台</Text>
      <Ionicons name="chevron-forward" size={14} color={COLORS.gold} />
    </Pressable>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 112 + insets.bottom }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfileData} tintColor={COLORS.blue} />}>
        <View testID="treasury-content" style={styles.content} onLayout={event => setContentWidth(event.nativeEvent.layout.width)}>
          {!profile ? (
            <View style={styles.initialState}>
              {error ? <>
                <Image source={require('../../assets/empty-states/storybook-pencil-v1/runtime/network-unavailable.webp')} style={styles.stateArt} resizeMode="contain" accessible={false} />
                <Text style={[styles.emptyText, regular]}>{error}</Text>
                <PencilButton label="重新加载" onPress={fetchProfileData} fontFamily={fonts.semibold} />
              </> : <><ActivityIndicator color={COLORS.blue} /><Text style={[styles.loadingText, regular]}>正在打开金库…</Text></>}
            </View>
          ) : <>
            <View style={styles.identity}>
              <Pressable accessibilityRole="button" accessibilityLabel="修改头像与昵称" onPress={() => router.push('/change-avatar')} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
                <Image source={profile.avatar_url && !avatarFailed ? { uri: profile.avatar_url } : require('../../assets/homepage/logo-b.png')}
                  style={styles.avatar} onError={() => setAvatarFailed(true)} />
              </Pressable>
              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={[styles.nickname, semibold]}>{profile.nickname || '土豆岛民'}</Text>
                  {!isCompact ? consoleEntry : null}
                </View>
                <View style={[styles.memberBadge, profile.is_admin && styles.creatorBadge]}><Text style={[styles.memberText, semibold]}>{statusName}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="复制土豆岛号" onPress={copyId} style={({ pressed }) => [styles.idRow, pressed && styles.pressed]}>
                  <Text numberOfLines={1} style={[styles.idText, regular]}>土豆岛号 td_{profile.id.substring(0, 8).toUpperCase()}</Text>
                  <Ionicons name="copy-outline" size={15} color={COLORS.muted} />
                </Pressable>
              </View>
            </View>
            {isCompact ? consoleEntry : null}
            <View style={styles.wealthCard}>
              {[
                { label: '今日收益', value: earnings.today },
                { label: '本月收益', value: earnings.month },
                { label: '土豆币余额', value: profile.potato_coin_balance },
              ].map((stat, index) => (
                <View key={stat.label} style={[styles.stat, index > 0 && styles.statBorder]}>
                  <Text style={[styles.statLabel, regular]}>{stat.label}</Text>
                  <Text accessibilityLabel={`${stat.label} ${formatMoney(stat.value)} 土豆币`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}
                    style={[styles.statValue, { fontSize: isCompact ? 17 : 20 }, semibold]}>{formatMoney(stat.value)}</Text>
                </View>
              ))}
            </View>
            {error ? <Pressable accessibilityRole="button" accessibilityLabel="刷新金库数据" onPress={fetchProfileData} style={styles.refreshError}>
              <Text style={[styles.errorText, regular]}>刷新失败，当前显示上次加载的数据。点击重试</Text>
            </Pressable> : null}
            <View style={styles.menu}>
              {MENU_GRID.map(item => (
                <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.route ? item.name : '邀请，暂未开放'}
                  onPress={() => item.route ? router.push(item.route) : notify('邀请功能暂未开放')}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                  <View style={styles.menuIconBox}><Image source={item.icon} style={item.original ? styles.existingMenuIcon : styles.menuIcon} resizeMode="contain" accessible={false} /></View>
                  <Text style={[styles.menuLabel, semibold]}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.collectionSection}>
              <View style={styles.collectionHeader}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, semibold]}>我的藏品 <Text style={[styles.collectionCount, regular]}>({totalNfts.toLocaleString('en-US')})</Text></Text>
                <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? '关闭藏品搜索' : '搜索我的藏品'} accessibilityState={{ expanded: searchOpen }}
                  onPress={() => { setSearchOpen(!searchOpen); setSearchQuery(''); }} style={({ pressed }) => [styles.searchToggle, pressed && styles.pressed]}>
                  <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={COLORS.blue} />
                </Pressable>
              </View>
              {searchOpen ? <View testID="treasury-collection-search" style={styles.searchField}>
                <Ionicons name="search-outline" size={19} color={COLORS.muted} />
                <TextInput accessibilityLabel="搜索持有藏品名称" placeholder="搜索藏品名称" placeholderTextColor={COLORS.muted} value={searchQuery}
                  onChangeText={setSearchQuery} autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="search"
                  style={[styles.searchInput, regular]} />
                {searchQuery ? <Pressable accessibilityRole="button" accessibilityLabel="清空藏品搜索" onPress={() => setSearchQuery('')} style={styles.searchClear}>
                  <Ionicons name="close-circle" size={18} color={COLORS.muted} />
                </Pressable> : null}
              </View> : null}
              {holdings.length && !filteredHoldings.length ? <View style={styles.emptyCollection}>
                <Image source={require('../../assets/empty-states/storybook-pencil-v1/runtime/empty-search.webp')} style={styles.emptyArt} resizeMode="contain" accessible={false} />
                <Text style={[styles.emptyText, regular]}>没有找到匹配的藏品</Text>
                <PencilButton label="清空搜索" onPress={() => setSearchQuery('')} fontFamily={fonts.semibold} style={styles.marketButton} />
              </View> : filteredHoldings.length ? (
                <View style={styles.collectionGrid}>
                  {filteredHoldings.map(col => (
                    <Pressable key={col.id} accessibilityRole="button" accessibilityLabel={`${col.name}，持有 ${col.count} 件`}
                      onPress={() => router.push({ pathname: '/my-collection-list', params: { collectionId: col.id, collectionName: col.name } })}
                      style={({ pressed }) => [styles.collectionCard, { width: collectionWidth }, pressed && styles.pressed]}>
                      <View testID="treasury-collection-image" style={styles.collectionImageBox}>
                        {col.image_url && !failedImages[col.id] ? <Image source={{ uri: col.image_url }} style={styles.collectionImage} onError={() => setFailedImages(previous => ({ ...previous, [col.id]: true }))} />
                          : <Ionicons name="image-outline" size={28} color="#B6A99C" />}
                      </View>
                      <Text numberOfLines={1} style={[styles.collectionName, semibold]}>{col.name}</Text>
                      <Text style={[styles.holdingCount, regular]}>持有 {col.count.toLocaleString('en-US')} 件</Text>
                    </Pressable>
                  ))}
                </View>
              ) : <View style={styles.emptyCollection}>
                <Image source={require('../../assets/empty-states/storybook-pencil-v1/runtime/empty-inventory.webp')} style={styles.emptyArt} resizeMode="contain" accessible={false} />
                <Text style={[styles.emptyText, regular]}>这里还没有藏品</Text>
                <PencilButton label="去集市" onPress={() => router.push('/market')} fontFamily={fonts.semibold} style={styles.marketButton} />
              </View>}
            </View>
          </>}
        </View>
      </ScrollView>
      {notice ? <View style={styles.notice} accessibilityLiveRegion="polite" pointerEvents="none"><Text style={[styles.noticeText, regular]}>{notice}</Text></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: 720, paddingHorizontal: 16, paddingTop: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  avatarButton: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: '#EBD6B8', backgroundColor: '#FBF6ED' },
  avatar: { width: '100%', height: '100%', resizeMode: 'cover' }, identityInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, nickname: { flex: 1, fontSize: 18, lineHeight: 24, color: COLORS.ink },
  memberBadge: { alignSelf: 'flex-start', backgroundColor: '#7193A7', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 2, marginTop: 5 },
  creatorBadge: { backgroundColor: '#AB813D' }, memberText: { color: '#FFFFFF', fontSize: 11, lineHeight: 16 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: -10, marginTop: -3 },
  idText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, flexShrink: 1 },
  console: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 44, paddingHorizontal: 7, borderWidth: 1, borderColor: '#DEC497', borderRadius: 10, backgroundColor: '#FFFDF8', flexShrink: 0 },
  consoleCompact: { alignSelf: 'flex-end', marginTop: -5, marginBottom: 14 }, consoleIcon: { width: 21, height: 21 }, consoleText: { fontSize: 11, lineHeight: 16, color: COLORS.gold },
  wealthCard: { flexDirection: 'row', paddingVertical: 17, backgroundColor: '#FCF9F3', borderWidth: 1, borderColor: '#EFE3D2', borderRadius: 14 },
  stat: { flex: 1, alignItems: 'center', minWidth: 0, paddingHorizontal: 7 }, statBorder: { borderLeftWidth: 1, borderColor: '#E8DECF' },
  statLabel: { color: '#897A6C', fontSize: 12, lineHeight: 18, marginBottom: 6 }, statValue: { color: COLORS.ink, lineHeight: 26, fontVariant: ['tabular-nums'], maxWidth: '100%' },
  menu: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 20, paddingBottom: 8 }, menuItem: { width: '25%', alignItems: 'center', paddingBottom: 17 },
  menuIconBox: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' }, menuIcon: { width: 66, height: 66 }, existingMenuIcon: { width: 62, height: 62, borderRadius: 31 },
  menuLabel: { color: COLORS.ink, fontSize: 13, lineHeight: 20, marginTop: 3 },
  collectionSection: { borderWidth: 1, borderColor: '#EFE7DB', borderRadius: 16, padding: 15, marginTop: 2 },
  collectionHeader: { minHeight: 44, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: COLORS.ink, fontSize: 18, lineHeight: 24, flexShrink: 1 }, collectionCount: { color: '#897A6C', fontSize: 14 },
  searchToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#FCFBF9', borderRadius: 12, paddingLeft: 12, marginBottom: 14, minHeight: 44 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, color: COLORS.ink, paddingHorizontal: 9, paddingVertical: 10, borderWidth: 0, outlineStyle: 'solid', outlineWidth: 0, outlineColor: 'transparent' },
  searchClear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, collectionCard: { minWidth: 0, marginBottom: 8 },
  collectionImageBox: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#ECE2D4', backgroundColor: '#FCF8EF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  collectionImage: { width: '100%', height: '100%', resizeMode: 'cover' }, collectionName: { color: COLORS.ink, fontSize: 15, lineHeight: 21, marginTop: 8 }, holdingCount: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  emptyCollection: { alignItems: 'center', paddingTop: 4, paddingBottom: 9 }, emptyArt: { width: 152, height: 112 }, emptyText: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 12, textAlign: 'center' },
  marketButton: { width: 160, marginBottom: 2 }, initialState: { minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, stateArt: { width: 120, height: 120 },
  loadingText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 14 }, refreshError: { padding: 12, marginTop: 12, backgroundColor: '#FBF3EE', borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  errorText: { color: '#9A6E51', fontSize: 12, lineHeight: 18 },
  notice: { position: 'absolute', bottom: 118, alignSelf: 'center', backgroundColor: '#51473F', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, maxWidth: '90%' }, noticeText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
