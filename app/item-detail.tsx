import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

interface ListingDetail {
  id: string;
  price: number;
  nfts: { id: string; serial_number: string; };
  collections: {
    id: string;
    name: string;
    total_minted: number;
    circulating_supply: number;
    image_url: string; 
  };
}

interface TransferLog {
  id: string;
  price: number;
  transfer_type: string;
  created_at: string;
  nft_id: string;
  buyer: { username: string };
  seller: { username: string };
}

export default function ItemDetailScreen() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [historyLogs, setHistoryLogs] = useState<TransferLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [historyMode, setHistoryMode] = useState<'all' | 'current'>('all');
  
  // 🚀 新增：控制沉浸式二次确认弹窗的显示状态
  const [showBuyModal, setShowBuyModal] = useState(false);

  const fetchItemData = async () => {
    if (!listingId) return;
    try {
      setLoading(true);
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select(`
          id, price,
          nfts ( id, serial_number ),
          collections ( id, name, total_minted, circulating_supply, image_url ) 
        `)
        .eq('id', listingId)
        .single();

      if (listingError) throw listingError;
      
      const parsedListing = listingData as any;
      const nft = Array.isArray(parsedListing.nfts) ? parsedListing.nfts[0] : parsedListing.nfts;
      const collection = Array.isArray(parsedListing.collections) ? parsedListing.collections[0] : parsedListing.collections;
      
      setListing({ ...parsedListing, nfts: nft, collections: collection });

      if (collection?.id) {
        const { data: logsData } = await supabase
          .from('transfer_logs')
          .select(`id, price, transfer_type, created_at, nft_id, buyer:profiles!transfer_logs_buyer_id_fkey(username), seller:profiles!transfer_logs_seller_id_fkey(username)`)
          .eq('collection_id', collection.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setHistoryLogs((logsData as any) || []);
      }
    } catch (err: any) {
      console.error('获取详情失败', err);
      Alert.alert('数据异常', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemData();
  }, [listingId]);

  // 🚀 核心：真正的购买执行函数
  const executeBuy = async () => {
    setShowBuyModal(false); // 先关弹窗
    if (!listing) return;
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录身份！');
      const { error: rpcError } = await supabase.rpc('buy_nft_market', { p_buyer_id: user.id, p_listing_id: listing.id });
      if (rpcError) throw new Error(rpcError.message);
      
      Alert.alert('🎉 购买成功', '藏品已过户到您的数字金库！', [
        { text: '去查看', onPress: () => router.replace('/(tabs)/profile') }
      ]);
    } catch (err: any) {
      Alert.alert('❌ 交易失败', err.message || '手慢了，已被抢走！');
    } finally {
      setBuying(false);
    }
  };

  if (loading || !listing) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#FF5722" />
      </SafeAreaView>
    );
  }

  const displayLogs = historyMode === 'all' ? historyLogs : historyLogs.filter(log => log.nft_id === listing.nfts.id);
  const colImage = listing.collections.image_url || `https://via.placeholder.com/600/1A1A1A/FFD700?text=${encodeURIComponent(listing.collections.name.substring(0,2))}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} onPress={fetchItemData}><Text style={styles.iconText}>↻</Text></TouchableOpacity>
          <TouchableOpacity style={styles.navBtn}><Text style={styles.iconText}>♡</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* 1:1 正方形卡片 + 黑色悬浮展台 */}
        <View style={styles.heroSection}>
          <View style={styles.cardContainer}>
             <Image source={{ uri: colImage }} style={styles.heroImage} />
          </View>
          <View style={styles.pedestalContainer}>
            <View style={styles.pedestal} />
            <TouchableOpacity style={styles.expandBtn} activeOpacity={0.8}>
              <Text style={styles.expandIcon}>⤡</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{listing.collections.name}</Text>
          <Text style={styles.heroSub}>发行 {listing.collections.total_minted} | 流通 {listing.collections.circulating_supply}</Text>
        </View>

        {/* 藏品信息 */}
        <View style={styles.infoBlock}>
          <View style={styles.infoHeader}>
            <Text style={styles.blockTitle}>藏品信息</Text>
            <TouchableOpacity style={styles.noticeBadge}>
              <Text style={styles.noticeText}>📢 藏品公告</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>当前编号</Text><View style={styles.serialRight}><Text style={styles.infoValueBlack}>{listing.nfts.serial_number} / {listing.collections.total_minted}</Text><Text style={styles.viewAllText}>全部编号 ▾</Text></View></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>发行社区</Text><Text style={styles.infoValueBlack}>土豆岛官方</Text></View>
          <View style={[styles.infoRow, {borderBottomWidth: 0}]}><Text style={styles.infoLabel}>认证网络</Text><Text style={styles.infoValueBlack}>Potato Chain</Text></View>
        </View>

        {/* 流转记录 */}
        <View style={styles.infoBlock}>
          <View style={styles.historyHeader}>
            <Text style={styles.blockTitle}>流转记录</Text>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => setHistoryMode(historyMode === 'all' ? 'current' : 'all')}>
              <Text style={styles.toggleText}>{historyMode === 'all' ? '全部编号 ⇌' : '当前编号 ⇌'}</Text>
            </TouchableOpacity>
          </View>
          {displayLogs.length === 0 ? (
             <Text style={styles.emptyText}>{historyMode === 'all' ? '暂无成交记录' : '暂无相关流转记录'}</Text>
          ) : (
            displayLogs.map((log) => {
               const timeStr = new Date(log.created_at).toLocaleString();
               const buyerName = Array.isArray(log.buyer) ? log.buyer[0]?.username : (log.buyer?.username || '岛民');
               return (
                 <View key={log.id} style={styles.logItem}>
                   <View style={styles.logLeft}><Text style={styles.logUsername}>{buyerName}</Text><Text style={styles.logTime}>{timeStr}</Text></View>
                   <View style={styles.logRight}><Text style={styles.logAction}>{log.transfer_type}</Text><Text style={styles.logPrice}>¥ {log.price.toFixed(0)}</Text></View>
                 </View>
               );
            })
          )}
        </View>

        {/* 购买须知 */}
        <View style={styles.infoBlock}>
          <Text style={styles.blockTitle}>购买须知</Text>
          <Text style={styles.descText}>1. 依照我国法律要求，特定条件下的数字藏品的二次交易不支持任何形式的变相炒作。{'\n'}2. 数字藏品为虚拟数字商品，仅限 18 周岁以上用户购买。{'\n'}3. 本商品一经售出不支持退货。</Text>
        </View>
      </ScrollView>

      {/* 底部购买栏 */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}><Text style={styles.currencySymbol}>¥</Text><Text style={styles.priceBig}>{listing.price.toFixed(0)}</Text></View>
        <TouchableOpacity 
          style={[styles.buyBtn, buying && {opacity: 0.7}]} 
          activeOpacity={0.8} 
          onPress={() => setShowBuyModal(true)} 
          disabled={buying}
        >
          {buying ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buyBtnText}>立即购买</Text>}
        </TouchableOpacity>
      </View>

      {/* 🚀 高级二次确认弹窗：我要购买 */}
      <Modal visible={showBuyModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>我要购买</Text>
            <Text style={styles.modalMessage}>是否确认支付 ¥{listing?.price.toFixed(0)} 购买该藏品？</Text>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} activeOpacity={0.7} onPress={() => setShowBuyModal(false)}>
                <Text style={styles.modalCancelText}>再想想</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, {backgroundColor: '#FF5722'}]} activeOpacity={0.7} onPress={executeBuy}>
                <Text style={styles.modalConfirmText}>确认支付</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  
  navBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 40 },
  navRight: { flexDirection: 'row' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  iconText: { fontSize: 18, color: '#333' },

  heroSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 20, backgroundColor: '#FFF' },
  cardContainer: { width: width * 0.7, height: width * 0.7, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 4, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10, zIndex: 2 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  pedestalContainer: { alignItems: 'center', marginTop: -20, zIndex: 1, marginBottom: 20 },
  pedestal: { width: width * 0.8, height: 80, backgroundColor: '#1C1C1E', borderRadius: 40, transform: [{ scaleY: 0.25 }], shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10 },
  expandBtn: { position: 'absolute', bottom: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#333', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6 },
  expandIcon: { color: '#FFF', fontSize: 18 },

  heroTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 6 },
  heroSub: { fontSize: 13, color: '#888' },

  infoBlock: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16 },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  blockTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  noticeBadge: { backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noticeText: { fontSize: 12, fontWeight: '700', color: '#333' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValueBlack: { fontSize: 15, fontWeight: '800', color: '#111' },
  serialRight: { flexDirection: 'row', alignItems: 'center' },
  viewAllText: { fontSize: 12, color: '#666', marginLeft: 10, backgroundColor: '#F5F5F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  descText: { fontSize: 14, color: '#666', lineHeight: 24 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toggleBtn: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  toggleText: { fontSize: 12, color: '#666', fontWeight: '600' },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logLeft: { flex: 1 },
  logUsername: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  logTime: { fontSize: 12, color: '#999' },
  logRight: { alignItems: 'flex-end' },
  logAction: { fontSize: 13, color: '#333', marginBottom: 4 },
  logPrice: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptyText: { color: '#999', fontSize: 13, textAlign: 'center', marginVertical: 10 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, borderColor: '#EEE' },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySymbol: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4, marginRight: 2 },
  priceBig: { fontSize: 28, fontWeight: '900', color: '#111' },
  buyBtn: { backgroundColor: '#FF5722', width: 140, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // 弹窗样式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 16 },
  modalMessage: { fontSize: 15, color: '#333', marginBottom: 30, textAlign: 'center' },
  modalBtnGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});