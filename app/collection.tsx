import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ImageBackground, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {loading && !hasError && <ActivityIndicator color="#D49A36" style={{ position: 'absolute' }} />}
      {!hasError ? (
        <Image
          source={{ uri: uri || 'invalid_url' }}
          style={[style, { position: 'absolute', width: '100%', height: '100%' }]}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setHasError(true); setLoading(false); }}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
           <Text style={{ fontSize: 32 }}>🥔</Text>
        </View>
      )}
    </View>
  );
};

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

  const [sweepMode, setSweepMode] = useState(false);
  const [selectedNftIds, setSelectedNftIds] = useState<string[]>([]);
  const [sweepConfirmModal, setSweepConfirmModal] = useState(false);

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

  const toggleSweepSelection = (nftId: string) => {
      setSelectedNftIds(prev => {
          if (prev.includes(nftId)) return prev.filter(id => id !== nftId);
          if (prev.length >= 15) { showToast('单次扫货最多 15 张'); return prev; }
          return [...prev, nftId];
      });
  };

  const selectAllCheapest = () => {
      const available = listedNfts.filter(n => n.owner_id !== myUserId); 
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
          fetchData(); 
          setSuccessMsg({title: '🧹 扫货成功', desc: `您已成功将 ${selectedNftIds.length} 件藏品收入金库！`});
      } catch (err: any) {
          setSweepConfirmModal(false);
          showToast(`扫货失败: ${err.message}`);
      } finally {
          setProcessing(false);
      }
  };

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

  const renderNft = ({ item }: { item: any }) => {
    const isListed = item.status === 'listed';
    const isSelected = selectedNftIds.includes(item.id);
    const isMine = item.owner_id === myUserId;

    return (
      <TouchableOpacity 
         style={[styles.nftCard, isSelected && {borderColor: '#D49A36', borderWidth: 2}]} 
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
           <FallbackImage uri={collection?.image_url} style={styles.nftImg} />
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#D49A36'}]}>
              <Text style={styles.statusText}>{isListed ? '寄售中' : '金库锁定'}</Text>
           </View>
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
                <Text style={[styles.priceValue, {color: '#A1887F', fontSize: 12}]}>暂不出售</Text>
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
         <View style={[styles.rankBadge, isTop3 ? {backgroundColor: '#D49A36'} : {backgroundColor: '#FDF8F0'}]}>
            <Text style={[styles.rankText, isTop3 ? {color: '#FFF'} : {color: '#A1887F'}]}>{index + 1}</Text>
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  // 🌟 动态计算 PaddingBottom，防止扫货栏遮挡
  const listPaddingBottom = sweepMode ? 200 : 100;

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: collection?.image_url }} style={styles.headerBg} blurRadius={20}>
         {/* 🌟 加深遮罩，提升文字对比度 */}
         <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']} style={{width: '100%'}}>
               <View style={styles.navBar}>
                 <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
                 <Text style={styles.navTitle}>系列详情</Text>
                 <View style={styles.navBtn} />
               </View>

               <View style={styles.heroContent}>
                  <FallbackImage uri={collection?.image_url} style={styles.heroImg} />
                  <Text style={styles.heroTitle}>{collection?.name}</Text>
                  
                  <TouchableOpacity style={styles.announceBadge} onPress={fetchRelatedAnnouncements}>
                     <Text style={styles.announceBadgeText}>📜 查看该系列相关旨意 〉</Text>
                  </TouchableOpacity>
                  
                  {/* 🌟 优化数据面板，间距拉开，背景加深 */}
                  <View style={styles.statsMatrix}>
                     <View style={styles.statItem}><Text style={styles.statValue}>¥{collection?.floor_price_cache || 0}</Text><Text style={styles.statLabel}>全网地板价</Text></View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}><Text style={styles.statValue}>{collection?.on_sale_count || 0}</Text><Text style={styles.statLabel}>在售现货</Text></View>
                     <View style={styles.statDivider} />
                     <View style={styles.statItem}><Text style={styles.statValue}>{collection?.circulating_supply || 0}</Text><Text style={styles.statLabel}>全网流通量</Text></View>
                  </View>
               </View>
            </SafeAreaView>
         </View>
      </ImageBackground>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.listSection}>
         {/* 🌟 重构：高级胶囊 Tab 栏 */}
         <View style={styles.tabsContainer}>
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
         </View>

         <TouchableOpacity style={styles.fomoBanner} activeOpacity={0.8} onPress={() => router.push({pathname: '/create-buy-order', params: {colId: collection?.id}})}>
            <Text style={styles.fomoText}>点击此处发布求购/竞价单，抢先拿下心仪藏品 〉</Text>
         </TouchableOpacity>

         {activeTab === 'listed' && listedNfts.length > 0 && (
             <View style={styles.sweepToolbar}>
                 <Text style={{fontSize: 12, color: '#8D6E63', fontWeight: '800'}}>在售现货明细</Text>
                 <TouchableOpacity style={[styles.sweepToggleBtn, sweepMode && {backgroundColor: '#4E342E'}]} onPress={() => {setSweepMode(!sweepMode); setSelectedNftIds([]);}}>
                     <Text style={[styles.sweepToggleText, sweepMode && {color: '#D49A36'}]}>{sweepMode ? '取消扫货' : '🧹 批量扫货'}</Text>
                 </TouchableOpacity>
             </View>
         )}

         {activeTab === 'listed' && (
            <FlatList 
               data={listedNfts} 
               renderItem={renderNft} 
               keyExtractor={item => item.id} 
               numColumns={2}
               contentContainerStyle={{ padding: 16, paddingBottom: listPaddingBottom }} 
               columnWrapperStyle={{ justifyContent: 'space-between' }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>🪹</Text><Text style={{color: '#8D6E63'}}>当前系列被大户扫空啦，快去发布求购！</Text></View>}
            />
         )}
         
         {activeTab === 'my_warehouse' && (
            <FlatList 
               data={myWarehouseNfts} 
               renderItem={renderNft} 
               keyExtractor={item => item.id} 
               numColumns={2}
               contentContainerStyle={{ padding: 16, paddingBottom: listPaddingBottom }} 
               columnWrapperStyle={{ justifyContent: 'space-between' }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📦</Text><Text style={{color: '#8D6E63'}}>您尚未拥有该系列的藏品</Text></View>}
            />
         )}

         {activeTab === 'buy_orders' && (
            <FlatList 
               data={buyOrdersList}
               keyExtractor={item => item.id}
               contentContainerStyle={{ padding: 16, paddingBottom: listPaddingBottom }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📉</Text><Text style={{color: '#8D6E63'}}>暂无求购单，点击上方横幅首发求购！</Text></View>}
               renderItem={renderBidItem}
            />
         )}

         {activeTab === 'bids' && (
            <FlatList 
               data={bidOrdersList}
               keyExtractor={item => item.id}
               contentContainerStyle={{ padding: 16, paddingBottom: listPaddingBottom }}
               showsVerticalScrollIndicator={false}
               ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 40}}><Text style={{fontSize: 40, marginBottom: 10}}>📉</Text><Text style={{color: '#8D6E63'}}>暂无竞价单，点击上方发起竞拍！</Text></View>}
               renderItem={renderBidItem}
            />
         )}
      </View>

      {sweepMode && activeTab === 'listed' && (
         <View style={styles.sweepBottomBar}>
             <View style={{flex: 1}}>
                 <Text style={{fontSize: 12, color: '#8D6E63'}}>已选 <Text style={{color: '#D49A36', fontWeight: '900', fontSize: 16}}>{selectedNftIds.length}</Text> 张 (上限15张)</Text>
                 <Text style={{fontSize: 16, fontWeight: '900', color: '#4E342E'}}>总计: <Text style={{color: '#FF3B30'}}>¥{calculateSweepTotal().toFixed(2)}</Text></Text>
             </View>
             <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllCheapest}>
                 <Text style={styles.selectAllBtnText}>一键全选</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.checkoutBtn, selectedNftIds.length === 0 && {backgroundColor: '#EAE0D5'}]} disabled={selectedNftIds.length === 0} onPress={() => setSweepConfirmModal(true)}>
                 <Text style={[styles.checkoutBtnText, selectedNftIds.length === 0 && {color: '#A1887F'}]}>合并买入</Text>
             </TouchableOpacity>
         </View>
      )}

      <Modal visible={sweepConfirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🛒 确认批量扫货</Text>
               <Text style={styles.confirmDesc}>即将一口气买入 <Text style={{fontWeight:'900', color:'#4E342E'}}>{selectedNftIds.length}</Text> 张藏品。总金额 <Text style={{fontWeight:'900', color:'#FF3B30'}}>¥{calculateSweepTotal().toFixed(2)}</Text> 将从您的钱包中扣除。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSweepConfirmModal(false)}><Text style={styles.cancelBtnText}>再看看</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={executeBatchBuy} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>立即付款</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

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

      <Modal visible={showAnnounceModal} transparent animationType="slide">
         <View style={styles.modalOverlayFull}>
            <View style={styles.modalContentFull}>
               <View style={styles.pickerHeader}>
                  <Text style={styles.announceModalTitle}>📜 相关王国旨意</Text>
                  <TouchableOpacity onPress={() => setShowAnnounceModal(false)}><Text style={{color:'#A1887F', fontSize: 16, fontWeight: '800'}}>关闭</Text></TouchableOpacity>
               </View>
               {loadingAnnounce ? <ActivityIndicator color="#D49A36" style={{marginTop: 50}}/> : (
                  <FlatList 
                      data={relatedAnnouncements}
                      keyExtractor={item => item.id}
                      contentContainerStyle={{paddingBottom: 50}}
                      ListEmptyComponent={<Text style={{textAlign: 'center', color: '#8D6E63', marginTop: 40}}>暂无与该系列相关的旨意</Text>}
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

      <Modal visible={!!successMsg} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 22}]}>{successMsg?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#4E342E', fontWeight: '900', lineHeight: 22}]}>{successMsg?.desc}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => setSuccessMsg(null)}>
                  <Text style={[styles.confirmBtnText, {color: '#FFF'}]}>朕知道了</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  headerBg: { width: '100%', minHeight: 340 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)' }, // 🌟 加深遮罩颜色
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  heroContent: { alignItems: 'center', paddingVertical: 10 },
  heroImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: '#D49A36', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  
  announceBadge: { backgroundColor: 'rgba(212,154,54,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,154,54,0.5)', marginBottom: 20 },
  announceBadgeText: { color: '#D49A36', fontSize: 12, fontWeight: '800' },

  // 🌟 优化面板背景和边距
  statsMatrix: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, width: '92%', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#D49A36', marginBottom: 6 }, // 拉开数字和标签间距
  statLabel: { fontSize: 11, color: '#EAE0D5', fontWeight: '700' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)' },

  listSection: { flex: 1, backgroundColor: '#FDF8F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, overflow: 'hidden' },
  
  // 🌟 全新胶囊 Tab 样式
  tabsContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F5EFE6' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#F5EFE6', borderRadius: 20, padding: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16 },
  tabBtnActive: { backgroundColor: '#FFF', shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, color: '#A1887F', fontWeight: '700' },
  tabTextActive: { color: '#D49A36', fontWeight: '900' },
  
  fomoBanner: { backgroundColor: '#FFFDF5', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#F0E6D2' },
  fomoText: { color: '#D49A36', fontSize: 11, fontWeight: '800', textAlign: 'center' },

  sweepToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  sweepToggleBtn: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D49A36' },
  sweepToggleText: { color: '#D49A36', fontSize: 12, fontWeight: '900' },

  nftCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, padding: 8, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1, borderWidth: 1, borderColor: '#F0E6D2' },
  imgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#FDF8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  nftImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  checkboxContainer: { position: 'absolute', top: 6, right: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(78,52,46,0.5)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#D49A36', borderColor: '#D49A36' },
  myOwnOverlay: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(78,52,46,0.8)', paddingVertical: 4, alignItems: 'center' },
  nftInfo: { flex: 1 },
  serial: { fontSize: 14, fontWeight: '900', color: '#4E342E', fontFamily: 'monospace', marginBottom: 2 },
  owner: { fontSize: 10, color: '#8D6E63', marginBottom: 8, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderColor: '#F5EFE6', paddingTop: 6 },
  priceLabel: { fontSize: 10, color: '#A1887F', fontWeight: '700' },
  priceValue: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },

  sweepBottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34, alignItems: 'center', shadowColor: '#4E342E', shadowOpacity: 0.1, shadowOffset: {width:0, height:-5}, elevation: 20, borderTopWidth: 1, borderColor: '#EAE0D5' },
  selectAllBtn: { backgroundColor: '#FDF8F0', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#EAE0D5' },
  selectAllBtnText: { color: '#4E342E', fontSize: 14, fontWeight: '900' },
  checkoutBtn: { flex: 1, backgroundColor: '#D49A36', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  checkoutBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  bidCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1, borderWidth: 1, borderColor: '#F0E6D2' },
  rankBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: '900' },
  bidderName: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  bidInfo: { fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  bidPriceLabel: { fontSize: 10, color: '#A1887F', marginBottom: 2, fontWeight: '700' },
  bidPriceValue: { fontSize: 18, fontWeight: '900', color: '#FF3B30', fontFamily: 'monospace' },
  matchBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  matchBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(44,30,22,0.8)', justifyContent: 'flex-end' },
  modalContentFull: { backgroundColor: '#FDF8F0', height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EAE0D5' },
  announceModalTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  
  announceCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0E6D2' },
  announceCardTitle: { fontSize: 15, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  announceCardTime: { fontSize: 11, color: '#8D6E63', marginBottom: 8, fontWeight: '600' },
  announceCardContent: { fontSize: 13, color: '#8D6E63', lineHeight: 20, fontWeight: '600' },

  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});