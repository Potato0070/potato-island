import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ImageBackground, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function CollectionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [collection, setCollection] = useState<any>(null);
  const [nfts, setNfts] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]); 
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]); // 🌟 存储我的闲置现货
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listed' | 'all' | 'bids'>('listed'); 

  // 🌟 高级弹窗与撮合状态
  const [matchModal, setMatchModal] = useState<{visible: boolean, bid: any} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. 获取系列宏观数据
      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollection(colData);

      // 2. 获取所有卡片 (现货/图鉴)
      const { data: nftData } = await supabase.from('nfts')
        .select('*, profiles(nickname)')
        .eq('collection_id', id)
        .neq('status', 'burned')
        .order('consign_price', { ascending: true, nullsFirst: false });
      setNfts(nftData || []);

      // 3. 获取竞价求购榜数据 (买盘深度，按出价从高到低)
      const { data: bidData } = await supabase.from('buy_orders')
        .select('*, profiles:buyer_id(nickname)')
        .eq('collection_id', id)
        .eq('status', 'active')
        .order('price', { ascending: false });
      setBids(bidData || []);

      // 4. 获取当前用户在该系列下的闲置现货 (用于"出给TA"判定)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         const { data: myNftsData } = await supabase.from('nfts')
           .select('*')
           .eq('collection_id', id)
           .eq('owner_id', user.id)
           .eq('status', 'idle');
         setMyIdleNfts(myNftsData || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // 🌟 核心杀招：执行大盘撮合 (卖给TA)
  const executeMatchBid = async () => {
    if (!matchModal || myIdleNfts.length === 0) return;
    setProcessing(true);
    const bid = matchModal.bid;
    const nftToSell = myIdleNfts[0]; // 拿金库里的一张闲置现货砸给买家

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. NFT 移交所有权给买家
      await supabase.from('nfts').update({ owner_id: bid.buyer_id, status: 'idle' }).eq('id', nftToSell.id);

      // 2. 卖家收到货款 (买家的钱之前发求购时已经冻结，所以这里直接给卖家钱包加钱即可)
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      await supabase.from('profiles').update({ potato_coin_balance: (profile?.potato_coin_balance || 0) + bid.price }).eq('id', user?.id);

      // 3. 扣减买家的求购单需求量
      const newQuantity = bid.quantity - 1;
      if (newQuantity <= 0) {
         await supabase.from('buy_orders').update({ status: 'won', quantity: 0 }).eq('id', bid.id);
      } else {
         await supabase.from('buy_orders').update({ quantity: newQuantity }).eq('id', bid.id);
      }

      // 4. 记录流转账本
      await supabase.from('transfer_logs').insert([{
         nft_id: nftToSell.id, collection_id: bid.collection_id, seller_id: user?.id, buyer_id: bid.buyer_id, price: bid.price, transfer_type: 'bid_match'
      }]);

      setMatchModal(null);
      showToast('✅ 撮合成功！已将藏品卖给最高出价者！');
      fetchData(); // 刷新所有榜单和资产
    } catch (err: any) { 
       setMatchModal(null);
       showToast(`交易失败: ${err.message}`); 
    } finally { setProcessing(false); }
  };

  const displayedNfts = activeTab === 'listed' ? nfts.filter(n => n.status === 'listed') : nfts;

  const renderNft = ({ item }: { item: any }) => {
    const isListed = item.status === 'listed';
    return (
      <TouchableOpacity style={styles.nftCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/item-detail', params: { id: item.id } })}>
        <View style={styles.imgBox}>
           <Image source={{ uri: collection?.image_url }} style={styles.nftImg} />
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#4CD964'}]}>
              <Text style={styles.statusText}>{isListed ? '寄售中' : '金库锁定'}</Text>
           </View>
        </View>
        <View style={styles.nftInfo}>
          <Text style={styles.serial}>#{String(item.serial_number).padStart(6, '0')}</Text>
          <Text style={styles.owner} numberOfLines={1}>持有者: {item.profiles?.nickname || '神秘藏友'}</Text>
          {isListed ? (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>一口价</Text>
                <Text style={styles.priceValue}>¥{item.consign_price}</Text>
             </View>
          ) : (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>状态</Text>
                <Text style={[styles.priceValue, {color: '#888', fontSize: 12}]}>非卖品</Text>
             </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderBidItem = ({ item, index }: { item: any, index: number }) => {
    const isTop3 = index < 3;
    // 如果我手里有货，且这个买家不是我自己，我就能看到“卖给TA”的按钮
    const canSellToHim = myIdleNfts.length > 0 && item.buyer_id !== myIdleNfts[0]?.owner_id;

    return (
      <View style={styles.bidCard}>
         <View style={[styles.rankBadge, isTop3 ? {backgroundColor: '#FFD700'} : {backgroundColor: '#F0F0F0'}]}>
            <Text style={[styles.rankText, isTop3 ? {color: '#111'} : {color: '#888'}]}>{index + 1}</Text>
         </View>
         <View style={{flex: 1}}>
            <Text style={styles.bidderName}>{item.profiles?.nickname || '神秘大户'}</Text>
            <Text style={styles.bidInfo}>需求: {item.quantity} | 冻结: ¥{(item.price * item.quantity).toFixed(2)}</Text>
         </View>
         <View style={{alignItems: 'flex-end'}}>
            <Text style={styles.bidPriceLabel}>单件出价</Text>
            <Text style={styles.bidPriceValue}>¥{item.price}</Text>
            {/* 🌟 核心杀招：出供给 TA 按钮 */}
            {canSellToHim && (
               <TouchableOpacity style={styles.matchBtn} onPress={() => setMatchModal({visible: true, bid: item})}>
                  <Text style={styles.matchBtnText}>卖给TA</Text>
               </TouchableOpacity>
            )}
         </View>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: collection?.image_url }} style={styles.headerBg} blurRadius={15}>
         <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']} style={{width: '100%'}}>
               <View style={styles.navBar}>
                 <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
                 <Text style={styles.navTitle}>系列详情</Text>
                 <View style={styles.navBtn} />
               </View>

               <View style={styles.heroContent}>
                  <Image source={{ uri: collection?.image_url }} style={styles.heroImg} />
                  <Text style={styles.heroTitle}>{collection?.name}</Text>
                  
                  <View style={styles.statsMatrix}>
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>¥{collection?.floor_price_cache || 0}</Text>
                        <Text style={styles.statLabel}>地板价</Text>
                     </View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>{collection?.on_sale_count || 0}</Text>
                        <Text style={styles.statLabel}>在售数量</Text>
                     </View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}>
                        <Text style={styles.statValue}>{collection?.circulating_supply}</Text>
                        <Text style={styles.statLabel}>全网流通</Text>
                     </View>
                  </View>
               </View>
            </SafeAreaView>
         </View>
      </ImageBackground>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.listSection}>
         {/* 三栏切换 Tabs */}
         <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'listed' && styles.tabBtnActive]} onPress={() => setActiveTab('listed')}>
               <Text style={[styles.tabText, activeTab === 'listed' && styles.tabTextActive]}>现货 ({collection?.on_sale_count || 0})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]} onPress={() => setActiveTab('all')}>
               <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>图鉴 ({nfts.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'bids' && styles.tabBtnActive]} onPress={() => setActiveTab('bids')}>
               <Text style={[styles.tabText, activeTab === 'bids' && styles.tabTextActive]}>竞价榜 ({bids.length})</Text>
            </TouchableOpacity>
         </View>

         <TouchableOpacity 
            style={styles.fomoBanner} 
            activeOpacity={0.8} 
            onPress={() => router.push({pathname: '/create-buy-order', params: {colId: collection?.id}})}
         >
            <Text style={styles.fomoText}>没有心仪现货或嫌贵？点此发布求购单，抢先拿下心仪藏品 〉</Text>
         </TouchableOpacity>

         {activeTab === 'bids' ? (
            <FlatList 
               data={bids}
               keyExtractor={item => item.id}
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 40}}>当前系列暂无人出价竞拍</Text>}
               renderItem={renderBidItem}
            />
         ) : (
            <FlatList 
               data={displayedNfts} 
               renderItem={renderNft} 
               keyExtractor={item => item.id} 
               numColumns={2}
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
               columnWrapperStyle={{ justifyContent: 'space-between' }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={
                  <View style={{alignItems: 'center', marginTop: 40}}>
                     <Text style={{fontSize: 40, marginBottom: 10}}>🪹</Text>
                     <Text style={{color: '#999'}}>{activeTab === 'listed' ? '当前系列无现货，快去发布求购吧！' : '该系列尚未发行任何卡片'}</Text>
                  </View>
               }
            />
         )}
      </View>

      {/* 🌟 撮合交易确认弹窗 */}
      <Modal visible={!!matchModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🤝 确认出让藏品</Text>
               <Text style={styles.confirmDesc}>您确定要将金库中的一件闲置现货，以 <Text style={{fontWeight:'900', color:'#FF3B30'}}>¥{matchModal?.bid?.price}</Text> 的价格卖给该买家吗？交易将立即完成！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setMatchModal(null)}><Text style={styles.cancelBtnText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeMatchBid} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认卖出</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  headerBg: { width: '100%', minHeight: 320 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  heroContent: { alignItems: 'center', paddingVertical: 20 },
  heroImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#FFF', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 20 },
  statsMatrix: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, width: '90%', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#FFD700', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#CCC' },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },

  listSection: { flex: 1, backgroundColor: '#F5F6F8', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, overflow: 'hidden' },
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, backgroundColor: '#FFF' },
  tabBtn: { paddingBottom: 8, marginRight: 24, borderBottomWidth: 2, borderColor: 'transparent' },
  tabBtnActive: { borderColor: '#111' },
  tabText: { fontSize: 15, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#111', fontWeight: '900' },
  fomoBanner: { backgroundColor: '#FFF5E6', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#FFE4B5' },
  fomoText: { color: '#D49A36', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  nftCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  imgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  nftImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  nftInfo: { flex: 1 },
  serial: { fontSize: 14, fontWeight: '900', color: '#111', fontFamily: 'monospace', marginBottom: 2 },
  owner: { fontSize: 10, color: '#888', marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 6 },
  priceLabel: { fontSize: 10, color: '#999' },
  priceValue: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },

  bidCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  rankBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: '900' },
  bidderName: { fontSize: 14, fontWeight: '900', color: '#111', marginBottom: 4 },
  bidInfo: { fontSize: 11, color: '#888' },
  bidPriceLabel: { fontSize: 10, color: '#999', marginBottom: 2 },
  bidPriceValue: { fontSize: 18, fontWeight: '900', color: '#FF3B30', fontFamily: 'monospace' },
  
  matchBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  matchBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});