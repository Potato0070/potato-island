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
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'listed' | 'my_warehouse' | 'buy_orders' | 'bids'>('listed'); 

  // 🌟 批量扫货状态 (Sweep Mode)
  const [sweepMode, setSweepMode] = useState(false);
  const [selectedNftIds, setSelectedNftIds] = useState<string[]>([]);
  const [sweepConfirmModal, setSweepConfirmModal] = useState(false);

  // 🌟 相关公告状态
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [relatedAnnouncements, setRelatedAnnouncements] = useState<any[]>([]);
  const [loadingAnnounce, setLoadingAnnounce] = useState(false);

  const [matchModal, setMatchModal] = useState<{visible: boolean, bid: any} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState<{title: string, desc: string} | null>(null);

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);

      const { data: colData } = await supabase.from('collections').select('*').eq('id', id).single();
      setCollection(colData);

      const { data: nftData } = await supabase.from('nfts')
        .select('*, profiles(nickname)')
        .eq('collection_id', id)
        .neq('status', 'burned')
        .order('consign_price', { ascending: true, nullsFirst: false });
      setNfts(nftData || []);

      const { data: bidData } = await supabase.from('buy_orders')
        .select('*, profiles:buyer_id(nickname)')
        .eq('collection_id', id)
        .eq('status', 'active')
        .order('price', { ascending: false });
      setBids(bidData || []);

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

  // ================= 📜 获取相关公告 =================
  const fetchRelatedAnnouncements = async () => {
      setShowAnnounceModal(true);
      setLoadingAnnounce(true);
      try {
          const { data } = await supabase.from('announcements')
              .select('*')
              .or(`title.ilike.%${collection.name}%,content.ilike.%${collection.name}%`)
              .order('created_at', { ascending: false });
          setRelatedAnnouncements(data || []);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingAnnounce(false);
      }
  };

  // ================= 🧹 批量扫货逻辑 =================
  const toggleSweepSelection = (nftId: string) => {
      setSelectedNftIds(prev => {
          if (prev.includes(nftId)) return prev.filter(id => id !== nftId);
          if (prev.length >= 15) { showToast('单次扫货最多 15 张'); return prev; }
          return [...prev, nftId];
      });
  };

  const selectAllCheapest = () => {
      const available = listedNfts.filter(n => n.owner_id !== myUserId); // 不能买自己的
      if (available.length === 0) return showToast('大盘已被扫空，无货可扫！');
      
      const toSelect = available.slice(0, 15).map(n => n.id);
      setSelectedNftIds(toSelect);
  };

  const calculateSweepTotal = () => {
      let total = 0;
      selectedNftIds.forEach(id => {
          const nft = nfts.find(n => n.id === id);
          if (nft) total += (nft.consign_price || 0);
      });
      return total;
  };

  const executeBatchBuy = async () => {
      setProcessing(true);
      try {
          const { error } = await supabase.rpc('batch_buy_nfts', { 
              p_nft_ids: selectedNftIds, 
              p_buyer_id: myUserId 
          });
          if (error) throw error;
          
          setSweepConfirmModal(false);
          setSweepMode(false);
          setSelectedNftIds([]);
          fetchData(); // 刷新大盘
          setSuccessMsg({title: '🧹 扫货成功', desc: `您已成功将 ${selectedNftIds.length} 件藏品收入金库！`});
      } catch (err: any) {
          setSweepConfirmModal(false);
          showToast(`扫货失败: ${err.message}`);
      } finally {
          setProcessing(false);
      }
  };


  // ================= 🤝 撮合竞价单 =================
  const executeMatchBid = async () => {
    if (!matchModal || myIdleNfts.length === 0) return;
    setProcessing(true);
    const bid = matchModal.bid;
    const nftToSell = myIdleNfts[0]; 

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('nfts').update({ owner_id: bid.buyer_id, status: 'idle' }).eq('id', nftToSell.id);
      
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      await supabase.from('profiles').update({ potato_coin_balance: (profile?.potato_coin_balance || 0) + (bid.price || 0) }).eq('id', user?.id);

      const newQuantity = (bid.quantity || 1) - 1;
      if (newQuantity <= 0) {
         await supabase.from('buy_orders').update({ status: 'won', quantity: 0 }).eq('id', bid.id);
      } else {
         await supabase.from('buy_orders').update({ quantity: newQuantity }).eq('id', bid.id);
      }

      await supabase.from('transfer_logs').insert([{
         nft_id: nftToSell.id, collection_id: bid.collection_id, seller_id: user?.id, buyer_id: bid.buyer_id, price: bid.price, transfer_type: 'bid_match'
      }]);

      setMatchModal(null);
      setSuccessMsg({title: '✅ 撮合成功', desc: '已将藏品卖出，土豆币已入账！'});
      fetchData(); 
    } catch (err: any) { 
       setMatchModal(null);
       showToast(`交易失败: ${err.message}`); 
    } finally { setProcessing(false); }
  };

  const listedNfts = nfts.filter(n => n.status === 'listed');
  const myWarehouseNfts = nfts.filter(n => n.owner_id === myUserId);
  const buyOrdersList = bids.filter(b => b.order_type !== 'bid'); 
  const bidOrdersList = bids.filter(b => b.order_type === 'bid'); 

  // ================= 渲染组件 =================
  const renderNft = ({ item }: { item: any }) => {
    const isListed = item.status === 'listed';
    const isSelected = selectedNftIds.includes(item.id);
    const isMine = item.owner_id === myUserId;

    return (
      <TouchableOpacity 
         style={[styles.nftCard, isSelected && {borderColor: '#0066FF', borderWidth: 2}]} 
         activeOpacity={0.8} 
         onPress={() => {
             if (sweepMode && isListed && !isMine) {
                 toggleSweepSelection(item.id);
             } else {
                 router.push({ pathname: '/item-detail', params: { id: item.id } });
             }
         }}
      >
        <View style={styles.imgBox}>
           <Image source={{ uri: collection?.image_url }} style={styles.nftImg} />
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#4CD964'}]}>
              <Text style={styles.statusText}>{isListed ? '寄售中' : '金库锁定'}</Text>
           </View>
           {/* 批量扫货的勾选框 */}
           {sweepMode && isListed && !isMine && (
               <View style={styles.checkboxContainer}>
                   <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                       {isSelected && <Text style={{color: '#FFF', fontSize: 12, fontWeight: '900'}}>✓</Text>}
                   </View>
               </View>
           )}
           {sweepMode && isMine && isListed && (
               <View style={styles.myOwnOverlay}><Text style={{color:'#FFF', fontSize:10, fontWeight:'800'}}>您的挂单</Text></View>
           )}
        </View>
        <View style={styles.nftInfo}>
          <Text style={styles.serial}>#{String(item.serial_number || 0).padStart(6, '0')}</Text>
          <Text style={styles.owner} numberOfLines={1}>持有者: {isMine ? '您自己' : '土豆岛藏友'}</Text>
          {isListed ? (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>一口价</Text>
                <Text style={styles.priceValue}>¥{item.consign_price || 0}</Text>
             </View>
          ) : (
             <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>状态</Text>
                <Text style={[styles.priceValue, {color: '#888', fontSize: 12}]}>暂不出售</Text>
             </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderBidItem = ({ item, index }: { item: any, index: number }) => {
    const isTop3 = activeTab === 'bids' && index < 3;
    const canSellToHim = myIdleNfts.length > 0 && item.buyer_id !== myUserId;
    
    const safePrice = Number(item.price) || 0;
    const safeQuantity = Number(item.quantity) || 0;
    const freezeAmount = (safePrice * safeQuantity).toFixed(2);

    return (
      <View style={styles.bidCard}>
         <View style={[styles.rankBadge, isTop3 ? {backgroundColor: '#FFD700'} : {backgroundColor: '#F0F0F0'}]}>
            <Text style={[styles.rankText, isTop3 ? {color: '#111'} : {color: '#888'}]}>{index + 1}</Text>
         </View>
         <View style={{flex: 1}}>
            <Text style={styles.bidderName}>{activeTab === 'bids' ? '竞价大户' : '求购大户'}</Text>
            <Text style={styles.bidInfo}>需求: {safeQuantity} | 冻结: ¥{freezeAmount}</Text>
         </View>
         <View style={{alignItems: 'flex-end'}}>
            <Text style={styles.bidPriceLabel}>单件出价</Text>
            <Text style={styles.bidPriceValue}>¥{safePrice}</Text>
            {canSellToHim && (
               <TouchableOpacity style={styles.matchBtn} onPress={() => setMatchModal({visible: true, bid: item})}>
                  <Text style={styles.matchBtnText}>出给TA</Text>
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
                  
                  {/* 📜 相关公告按钮 */}
                  <TouchableOpacity style={styles.announceBadge} onPress={fetchRelatedAnnouncements}>
                     <Text style={styles.announceBadgeText}>📜 查看该系列相关旨意 〉</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.statsMatrix}>
                     <View style={styles.statItem}><Text style={styles.statValue}>¥{collection?.floor_price_cache || 0}</Text><Text style={styles.statLabel}>地板价</Text></View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}><Text style={styles.statValue}>{collection?.on_sale_count || 0}</Text><Text style={styles.statLabel}>在售现货</Text></View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}><Text style={styles.statValue}>{collection?.circulating_supply || 0}</Text><Text style={styles.statLabel}>全网流通</Text></View>
                  </View>
               </View>
            </SafeAreaView>
         </View>
      </ImageBackground>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.listSection}>
         <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'listed' && styles.tabBtnActive]} onPress={() => setActiveTab('listed')}>
               <Text style={[styles.tabText, activeTab === 'listed' && styles.tabTextActive]}>现货</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'my_warehouse' && styles.tabBtnActive]} onPress={() => setActiveTab('my_warehouse')}>
               <Text style={[styles.tabText, activeTab === 'my_warehouse' && styles.tabTextActive]}>个人仓库</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'buy_orders' && styles.tabBtnActive]} onPress={() => setActiveTab('buy_orders')}>
               <Text style={[styles.tabText, activeTab === 'buy_orders' && styles.tabTextActive]}>求购大厅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'bids' && styles.tabBtnActive]} onPress={() => setActiveTab('bids')}>
               <Text style={[styles.tabText, activeTab === 'bids' && styles.tabTextActive]}>竞价榜单</Text>
            </TouchableOpacity>
         </View>

         <TouchableOpacity style={styles.fomoBanner} activeOpacity={0.8} onPress={() => router.push({pathname: '/create-buy-order', params: {colId: collection?.id}})}>
            <Text style={styles.fomoText}>点击此处发布求购/竞价单，抢先拿下心仪藏品 〉</Text>
         </TouchableOpacity>

         {/* 🧹 现货专属：扫货工具栏 */}
         {activeTab === 'listed' && listedNfts.length > 0 && (
             <View style={styles.sweepToolbar}>
                 <Text style={{fontSize: 12, color: '#666', fontWeight: '800'}}>在售现货明细</Text>
                 <TouchableOpacity style={[styles.sweepToggleBtn, sweepMode && {backgroundColor: '#111'}]} onPress={() => {setSweepMode(!sweepMode); setSelectedNftIds([]);}}>
                     <Text style={[styles.sweepToggleText, sweepMode && {color: '#FFD700'}]}>{sweepMode ? '取消扫货' : '🧹 批量扫货'}</Text>
                 </TouchableOpacity>
             </View>
         )}

         {activeTab === 'listed' && (
            <FlatList 
               data={listedNfts} 
               renderItem={renderNft} 
               keyExtractor={item => item.id} 
               numColumns={2}
               contentContainerStyle={{ padding: 16, paddingBottom: 150 }} 
               columnWrapperStyle={{ justifyContent: 'space-between' }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>🪹</Text><Text style={{color: '#999'}}>当前系列被大户扫空啦，快去发布求购！</Text></View>}
            />
         )}
         
         {activeTab === 'my_warehouse' && (
            <FlatList 
               data={myWarehouseNfts} 
               renderItem={renderNft} 
               keyExtractor={item => item.id} 
               numColumns={2}
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
               columnWrapperStyle={{ justifyContent: 'space-between' }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📦</Text><Text style={{color: '#999'}}>您尚未拥有该系列的藏品</Text></View>}
            />
         )}

         {activeTab === 'buy_orders' && (
            <FlatList 
               data={buyOrdersList}
               keyExtractor={item => item.id}
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📉</Text><Text style={{color: '#999'}}>暂无求购单，点击上方横幅首发求购！</Text></View>}
               renderItem={renderBidItem}
            />
         )}

         {activeTab === 'bids' && (
            <FlatList 
               data={bidOrdersList}
               keyExtractor={item => item.id}
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📉</Text><Text style={{color: '#999'}}>暂无竞价单，点击上方发起竞拍！</Text></View>}
               renderItem={renderBidItem}
            />
         )}
      </View>

      {/* 🧹 扫货模式底部结算台 */}
      {sweepMode && activeTab === 'listed' && (
         <View style={styles.sweepBottomBar}>
             <View style={{flex: 1}}>
                 <Text style={{fontSize: 12, color: '#888'}}>已选 <Text style={{color: '#0066FF', fontWeight: '900', fontSize: 16}}>{selectedNftIds.length}</Text> 张 (上限15张)</Text>
                 <Text style={{fontSize: 16, fontWeight: '900', color: '#111'}}>总计: <Text style={{color: '#FF3B30'}}>¥{calculateSweepTotal().toFixed(2)}</Text></Text>
             </View>
             <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllCheapest}>
                 <Text style={styles.selectAllBtnText}>一键全选</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.checkoutBtn, selectedNftIds.length === 0 && {backgroundColor: '#CCC'}]} disabled={selectedNftIds.length === 0} onPress={() => setSweepConfirmModal(true)}>
                 <Text style={styles.checkoutBtnText}>合并买入</Text>
             </TouchableOpacity>
         </View>
      )}

      {/* 🧹 批量买入二次确认弹窗 */}
      <Modal visible={sweepConfirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🛒 确认批量扫货</Text>
               <Text style={styles.confirmDesc}>即将一口气买入 <Text style={{fontWeight:'900', color:'#111'}}>{selectedNftIds.length}</Text> 张藏品。总金额 <Text style={{fontWeight:'900', color:'#FF3B30'}}>¥{calculateSweepTotal().toFixed(2)}</Text> 将从您的钱包中扣除。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSweepConfirmModal(false)}><Text style={styles.cancelBtnText}>再看看</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#0066FF'}]} onPress={executeBatchBuy} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>立即付款</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 🤝 撮合竞价弹窗 */}
      <Modal visible={!!matchModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🤝 确认出让藏品</Text>
               <Text style={styles.confirmDesc}>您确定要将金库中的一件闲置现货，以 <Text style={{fontWeight:'900', color:'#FF3B30'}}>¥{matchModal?.bid?.price}</Text> 卖给该买家吗？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setMatchModal(null)}><Text style={styles.cancelBtnText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeMatchBid} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认卖出</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 📜 相关公告弹窗 */}
      <Modal visible={showAnnounceModal} transparent animationType="slide">
         <View style={styles.modalOverlayFull}>
            <View style={styles.modalContentFull}>
               <View style={styles.pickerHeader}>
                  <Text style={styles.announceModalTitle}>📜 相关王国旨意</Text>
                  <TouchableOpacity onPress={() => setShowAnnounceModal(false)}><Text style={{color:'#999', fontSize: 16}}>关闭</Text></TouchableOpacity>
               </View>
               {loadingAnnounce ? <ActivityIndicator color="#0066FF" style={{marginTop: 50}}/> : (
                  <FlatList 
                      data={relatedAnnouncements}
                      keyExtractor={item => item.id}
                      contentContainerStyle={{paddingBottom: 50}}
                      ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 40}}>暂无与该系列相关的旨意</Text>}
                      renderItem={({item}) => (
                         <View style={styles.announceCard}>
                            <Text style={styles.announceCardTitle}>{item.title}</Text>
                            <Text style={styles.announceCardTime}>{new Date(item.created_at).toLocaleString()}</Text>
                            <Text style={styles.announceCardContent}>{item.content}</Text>
                         </View>
                      )}
                  />
               )}
            </View>
         </View>
      </Modal>

      {/* 🎉 极客【成功反馈】模态框 */}
      <Modal visible={!!successMsg} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {borderColor: '#4CD964', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#4CD964', fontSize: 22}]}>{successMsg?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#111', fontWeight: '800', lineHeight: 22}]}>{successMsg?.desc}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#4CD964'}]} onPress={() => setSuccessMsg(null)}>
                  <Text style={[styles.confirmBtnText, {color: '#FFF'}]}>朕知道了</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  headerBg: { width: '100%', minHeight: 340 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  heroContent: { alignItems: 'center', paddingVertical: 10 },
  heroImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#FFF', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  
  announceBadge: { backgroundColor: 'rgba(255,215,0,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)', marginBottom: 20 },
  announceBadgeText: { color: '#FFD700', fontSize: 12, fontWeight: '800' },

  statsMatrix: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, width: '90%', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#FFD700', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#CCC' },
  statDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },

  listSection: { flex: 1, backgroundColor: '#F5F6F8', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, overflow: 'hidden' },
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 20, paddingBottom: 10, backgroundColor: '#FFF', justifyContent: 'space-between' },
  tabBtn: { paddingBottom: 8, borderBottomWidth: 2, borderColor: 'transparent', flex: 1, alignItems: 'center' },
  tabBtnActive: { borderColor: '#111' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#111', fontWeight: '900' },
  
  fomoBanner: { backgroundColor: '#FFF5E6', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#FFE4B5' },
  fomoText: { color: '#D49A36', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  sweepToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sweepToggleBtn: { backgroundColor: '#F0F6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  sweepToggleText: { color: '#0066FF', fontSize: 12, fontWeight: '800' },

  nftCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  imgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  nftImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  checkboxContainer: { position: 'absolute', top: 6, right: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  myOwnOverlay: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, alignItems: 'center' },
  nftInfo: { flex: 1 },
  serial: { fontSize: 14, fontWeight: '900', color: '#111', fontFamily: 'monospace', marginBottom: 2 },
  owner: { fontSize: 10, color: '#888', marginBottom: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 6 },
  priceLabel: { fontSize: 10, color: '#999' },
  priceValue: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },

  sweepBottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: {width:0, height:-5}, elevation: 20 },
  selectAllBtn: { backgroundColor: '#F5F5F5', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginRight: 10 },
  selectAllBtnText: { color: '#111', fontSize: 14, fontWeight: '800' },
  checkoutBtn: { flex: 1, backgroundColor: '#0066FF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  checkoutBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

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
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentFull: { backgroundColor: '#F9F9F9', height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  announceModalTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  
  announceCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  announceCardTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  announceCardTime: { fontSize: 11, color: '#999', marginBottom: 8 },
  announceCardContent: { fontSize: 13, color: '#666', lineHeight: 20 },

  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});