import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function MyNftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [nft, setNft] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyMode, setHistoryMode] = useState<'current' | 'all'>('current');
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // 熔炉状态
  const [showFurnaceModal, setShowFurnaceModal] = useState(false);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchNftData();
  }, [id]);

  const fetchNftData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nfts')
        .select(`id, serial_number, status, collections (id, name, total_minted, circulating_supply, image_url, floor_price_cache, is_tradeable)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      const collection = Array.isArray(data.collections) ? data.collections[0] : data.collections;
      setNft({ ...data, collections: collection });

      if (collection?.id) {
        const { data: logsData } = await supabase
          .from('transfer_logs')
          .select(`id, price, transfer_type, created_at, nft_id, buyer:profiles!transfer_logs_buyer_id_fkey(username), seller:profiles!transfer_logs_seller_id_fkey(username)`)
          .eq('collection_id', collection.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (logsData) setHistoryLogs(logsData as any);
      }
    } catch (err: any) {
      Alert.alert('获取藏品失败', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const executeCancelListing = async () => {
    setShowCancelModal(false);
    setCanceling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      const { error } = await supabase.rpc('cancel_listing', { p_nft_id: nft.id, p_seller_id: user.id });
      if (error) throw error;
      
      Alert.alert('✅ 撤单成功', '藏品已从大盘下架，恢复空闲状态。');
      fetchNftData(); 
    } catch (err: any) {
      Alert.alert('❌ 撤单失败', err.message);
    } finally {
      setCanceling(false);
    }
  };

  // 🚀 执行熔炉销毁（更新了文案，提示获得 Potato 卡）
  const executeFurnaceBurn = async () => {
    setShowFurnaceModal(false);
    setBurning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      
      const { error } = await supabase.rpc('burn_in_furnace', { p_nft_id: nft.id, p_user_id: user.id });
      if (error) throw error;
      
      Alert.alert('🔥 销毁成功', '该藏品已化为灰烬，大盘流通量永久-1！\n系统已为您发放了全新的 Potato 卡补偿。', [
        { text: '返回金库', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('❌ 熔炼失败', err.message);
    } finally {
      setBurning(false);
    }
  };

  if (loading || !nft) {
    return <SafeAreaView style={styles.centerContainer} edges={['top']}><ActivityIndicator size="large" color="#0066FF" /></SafeAreaView>;
  }

  const displayLogs = historyMode === 'all' ? historyLogs : historyLogs.filter(log => log.nft_id === nft.id);
  const coverImage = nft.collections.image_url || `https://via.placeholder.com/600/1A1A1A/FFD700?text=${encodeURIComponent(nft.collections.name.substring(0,2))}`;
  
  const isListed = nft.status === 'listed';
  const isTradeable = nft.collections.is_tradeable !== false; 
  const isPotatoCard = nft.collections.name === 'Potato卡';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} onPress={fetchNftData}><Text style={styles.iconText}>↻</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.heroSection}>
          <View style={styles.cardContainer}><Image source={{ uri: coverImage }} style={styles.heroImage} /></View>
          <View style={styles.pedestalContainer}>
            <View style={styles.pedestal} />
          </View>
          <Text style={styles.heroTitle}>{nft.collections.name}</Text>
          <Text style={styles.heroSub}>发行 {nft.collections.total_minted} | 流通 {nft.collections.circulating_supply}</Text>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoHeader}>
            <Text style={styles.blockTitle}>藏品信息</Text>
          </View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>当前编号</Text><View style={styles.serialRight}><Text style={styles.infoValueBlack}>{nft.serial_number} / {nft.collections.total_minted}</Text></View></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>发行社区</Text><Text style={styles.infoValueBlack}>土豆岛官方</Text></View>
          <View style={[styles.infoRow, {borderBottomWidth: 0}]}><Text style={styles.infoLabel}>认证网络</Text><Text style={styles.infoValueBlack}>Potato Chain</Text></View>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.historyHeader}>
            <Text style={styles.blockTitle}>流转记录</Text>
            <TouchableOpacity style={styles.toggleBtn} activeOpacity={0.7} onPress={() => setHistoryMode(historyMode === 'all' ? 'current' : 'all')}><Text style={styles.toggleText}>{historyMode === 'all' ? '全部编号 ⇌' : '当前编号 ⇌'}</Text></TouchableOpacity>
          </View>
          {displayLogs.length === 0 ? (
             <Text style={styles.emptyText}>{historyMode === 'all' ? '该系列暂无流转记录' : '您是该藏品的首位开拓者！'}</Text>
          ) : (
            displayLogs.map((log) => {
               const timeStr = new Date(log.created_at).toLocaleString();
               const buyerName = Array.isArray(log.buyer) ? log.buyer[0]?.username : (log.buyer?.username || '黑洞/系统');
               return (
                 <View key={log.id} style={styles.logItem}>
                   <View style={styles.logLeft}><Text style={styles.logUsername}>{buyerName}</Text><Text style={styles.logTime}>{timeStr}</Text></View>
                   <View style={styles.logRight}>
                     <Text style={[styles.logAction, log.transfer_type === '熔炉销毁' && {color: '#FF3B30', fontWeight: '800'}]}>{log.transfer_type}</Text>
                     <Text style={styles.logPrice}>¥ {log.price.toFixed(0)}</Text>
                   </View>
                 </View>
               );
            })
          )}
        </View>
      </ScrollView>

      {/* 底部控制栏 */}
      <View style={styles.bottomBar}>
        
        {/* 熔炉入口 (如果是Potato卡或者正在寄售，则不显示) */}
        {!isListed && !isPotatoCard ? (
          <TouchableOpacity 
            style={styles.furnaceBtn} 
            activeOpacity={0.8}
            disabled={burning}
            onPress={() => setShowFurnaceModal(true)}
          >
            {burning ? <ActivityIndicator color="#FF3B30" /> : <Text style={styles.furnaceBtnText}>🔥 熔炉</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{flex: 1}} /> // 占位
        )}
        
        {/* 右侧：寄售/取消寄售/不可寄售 逻辑 */}
        {!isTradeable ? (
          <View style={[styles.consignBtn, {backgroundColor: '#333'}]}><Text style={styles.consignBtnText}>不可寄售</Text></View>
        ) : isListed ? (
          <TouchableOpacity style={[styles.consignBtn, {backgroundColor: '#0066FF'}]} activeOpacity={0.8} disabled={canceling} onPress={() => setShowCancelModal(true)}>
            {canceling ? <ActivityIndicator color="#FFF" /> : <Text style={styles.consignBtnText}>取消寄售</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.consignBtn, {backgroundColor: '#FF5722'}]} activeOpacity={0.8} onPress={() => router.push({ pathname: '/publish-consign', params: { nftId: nft.id } })}>
            <Text style={styles.consignBtnText}>发布寄售</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 撤单弹窗 */}
      <Modal visible={showCancelModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>取消寄售</Text>
            <Text style={styles.modalMessage}>是否确认将该藏品从大盘撤回？</Text>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCancelModal(false)}><Text style={styles.modalCancelText}>暂不取消</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={executeCancelListing}><Text style={styles.modalConfirmText}>确认撤单</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🚀 熔炉警告弹窗（已更新文案） */}
      <Modal visible={showFurnaceModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, {color: '#FF3B30'}]}>⚠️ 投入熔炉</Text>
            <Text style={styles.modalMessage}>物理销毁是不可逆转的！{'\n'}该藏品将被永久烧毁，但您将获得系统补偿的「Potato卡」。</Text>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowFurnaceModal(false)}><Text style={styles.modalCancelText}>我再想想</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, {backgroundColor: '#FF3B30'}]} onPress={executeFurnaceBurn}><Text style={styles.modalConfirmText}>确认焚毁</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 40 },
  navRight: { flexDirection: 'row' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  iconText: { fontSize: 18, color: '#333' },
  heroSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 20, backgroundColor: '#FFF' },
  cardContainer: { width: width * 0.7, height: width * 0.7, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 4, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 10, zIndex: 2 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  pedestalContainer: { alignItems: 'center', marginTop: -20, zIndex: 1, marginBottom: 20 },
  pedestal: { width: width * 0.8, height: 80, backgroundColor: '#1C1C1E', borderRadius: 40, transform: [{ scaleY: 0.25 }], shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 10 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginTop: 10, marginBottom: 6 },
  heroSub: { fontSize: 13, color: '#888' },
  infoBlock: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16 },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  blockTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValueBlack: { fontSize: 15, fontWeight: '800', color: '#111' },
  serialRight: { flexDirection: 'row', alignItems: 'center' },
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
  
  furnaceBtn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFD1D1', paddingHorizontal: 16, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  furnaceBtnText: { color: '#FF3B30', fontSize: 14, fontWeight: '800' },
  
  consignBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  consignBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 16 },
  modalMessage: { fontSize: 14, color: '#444', marginBottom: 30, textAlign: 'center', lineHeight: 22 },
  modalBtnGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});