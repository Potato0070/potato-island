import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 24 }}>🥔</Text>
      )}
    </View>
  );
};

export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const { colId } = useLocalSearchParams();
  
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>((colId as string) || null);
  const [collection, setCollection] = useState<any>(null);
  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [minPriceLimit, setMinPriceLimit] = useState(0);
  const [maxPriceLimit, setMaxPriceLimit] = useState(Infinity);
  const [orderMode, setOrderMode] = useState<'buy' | 'bid'>('buy'); 

  const [potatoIds, setPotatoIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    supabase.from('collections').select('*').eq('is_tradeable', true).then(({data}) => {
       if (data) setAllCollections(data);
    });

    supabase.auth.getUser().then(async ({data: {user}}) => {
       if (user) {
          const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
          if (myNfts) {
             const pCards = myNfts.filter((nft: any) => {
                const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
                return colName === 'Potato卡';
             });
             setPotatoIds(pCards.map(nft => nft.id));
          }
       }
    });
  }, []);

  useEffect(() => {
    if (activeCollectionId) {
      supabase.from('collections').select('*').eq('id', activeCollectionId).single().then(({data}) => {
        setCollection(data);
        const isOnSale = (data?.on_sale_count || 0) > 0;
        if (isOnSale) {
           setOrderMode('buy');
           setMinPriceLimit((data?.floor_price_cache || 0) * 0.7);
           setMaxPriceLimit(data?.max_consign_price || 999999);
        } else {
           setOrderMode('bid');
           setMinPriceLimit(data?.max_consign_price || 0);
           setMaxPriceLimit(Infinity);
        }
        setLoading(false);
      });
    } else {
      setCollection(null);
      setMinPriceLimit(0);
      setMaxPriceLimit(Infinity);
      setLoading(false);
    }
  }, [activeCollectionId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handlePublishClick = () => {
    if (!collection) return showToast('请先选择藏品系列！');
    
    const p = parseFloat(price);
    const q = parseInt(quantity);
    if (isNaN(p) || p <= 0) return showToast('请输入有效价格');
    if (isNaN(q) || q <= 0) return showToast('数量不能少于 1');
    
    if (p < minPriceLimit) return showToast(`出价过低！不可低于：¥${minPriceLimit.toFixed(2)}`);
    if (p > maxPriceLimit) return showToast(`触发熔断！求购上限不得超过：¥${maxPriceLimit.toFixed(2)}`);
    
    if (potatoIds.length < 1) return showToast('金库现货不足！需持有至少 1 张 Potato卡');

    setConfirmModal(true);
  };

  const executePublish = async () => {
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      const totalCost = parseFloat(price) * parseInt(quantity);
      
      if (!profile || profile.potato_coin_balance < totalCost) throw new Error('土豆币钱包余额不足！');
      
      await supabase.from('profiles').update({ potato_coin_balance: profile.potato_coin_balance - totalCost }).eq('id', user?.id);
      await supabase.from('nfts').update({ status: 'burned' }).eq('id', potatoIds[0]);

      const { error } = await supabase.from('buy_orders').insert([{ 
         collection_id: collection.id, 
         buyer_id: user?.id, 
         price: parseFloat(price), 
         quantity: parseInt(quantity),
         order_type: orderMode
      }]);
      if (error) throw error;
      
      setConfirmModal(false);
      showToast('✅ 发布成功！资金已冻结并进入大盘排队');
      setTimeout(() => router.back(), 1500);
    } catch (err: any) { 
       setConfirmModal(false);
       showToast(`发布失败: ${err.message}`); 
    } finally { 
       setPublishing(false); 
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>{orderMode === 'bid' ? '发起竞价' : '发布求购单'}</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
        <TouchableOpacity style={styles.targetHeader} activeOpacity={0.8} onPress={() => setShowPicker(true)}>
           {collection ? (
              <>
                 <FallbackImage uri={collection.image_url} style={styles.targetImg} />
                 <View style={styles.targetInfo}>
                    <Text style={styles.targetName} numberOfLines={1}>{collection.name}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <View style={[styles.modeTag, orderMode === 'bid' ? {backgroundColor: '#FFD700'} : {backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#D49A36'}]}>
                          <Text style={[styles.modeTagText, orderMode === 'bid' ? {color: '#111'} : {color: '#D49A36'}]}>{orderMode === 'bid' ? '竞价模式' : '求购模式'}</Text>
                       </View>
                       <Text style={styles.targetSubHighlight}>下限: ¥{minPriceLimit.toFixed(2)}</Text>
                    </View>
                 </View>
                 <Text style={{color: '#8D6E63', fontSize: 13, fontWeight: '900'}}>更换 〉</Text>
              </>
           ) : (
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                 <View style={[styles.targetImg, {justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#EAE0D5'}]}><Text style={{fontSize: 24, color: '#D49A36'}}>+</Text></View>
                 <View style={styles.targetInfo}>
                    <Text style={[styles.targetName, {color: '#D49A36'}]}>点击选择藏品</Text>
                 </View>
                 <Text style={{color: '#D49A36', fontSize: 13, fontWeight: '900'}}>去选择 〉</Text>
              </View>
           )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
           <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>{orderMode === 'bid' ? '竞拍价 (¥)' : '求购价 (¥)'}</Text>
              <TextInput style={styles.inputField} placeholder={`最低 ¥${minPriceLimit.toFixed(2)}`} placeholderTextColor="#A1887F" keyboardType="decimal-pad" value={price} onChangeText={setPrice} textAlign="right" editable={!!collection} />
           </View>
           <View style={[styles.inputRow, {borderBottomWidth: 0}]}>
              <Text style={styles.inputLabel}>需求数量</Text>
              <View style={styles.stepper}>
                 <TouchableOpacity onPress={() => setQuantity(Math.max(1, parseInt(quantity)-1).toString())} disabled={!collection}><Text style={styles.stepperBtn}>-</Text></TouchableOpacity>
                 <TextInput style={styles.stepperInput} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" textAlign="center" editable={!!collection} />
                 <TouchableOpacity onPress={() => setQuantity((parseInt(quantity)+1).toString())} disabled={!collection}><Text style={styles.stepperBtn}>+</Text></TouchableOpacity>
              </View>
           </View>
        </View>

        <View style={styles.ruleBox}>
           <Text style={styles.ruleTitle}>交易说明</Text>
           <Text style={styles.ruleText}>1. 发起需销毁 1 张 Potato卡。</Text>
           <Text style={styles.ruleText}>2. <Text style={{fontWeight: '900', color: '#4E342E'}}>【求购】</Text>系列未退市时触发。最低价为地板价70%，上限为最高限价。</Text>
           <Text style={styles.ruleText}>3. <Text style={{fontWeight: '900', color: '#4E342E'}}>【竞价】</Text>系列退市后触发。最低价为退市价(最高限价)，上不封顶！</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
         <View style={styles.payInfo}>
            <Text style={{fontSize: 12, color: '#8D6E63', fontWeight: '800'}}>需冻结资金</Text>
            <Text style={{fontSize: 24, fontWeight: '900', color: '#FF3B30'}}>¥ {((parseFloat(price)||0) * (parseInt(quantity)||1)).toFixed(2)}</Text>
         </View>
         <TouchableOpacity style={[styles.payBtn, (!collection || (orderMode === 'buy' && parseFloat(price) > maxPriceLimit)) && {backgroundColor: '#EAE0D5'}]} onPress={handlePublishClick}>
            <Text style={[styles.payBtnText, (!collection || (orderMode === 'buy' && parseFloat(price) > maxPriceLimit)) && {color: '#A1887F'}]}>{orderMode === 'bid' ? '发起竞拍' : '确认支付'}</Text>
         </TouchableOpacity>
      </View>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择目标藏品</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#8D6E63', fontSize: 15, fontWeight: '900'}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {allCollections.map(c => {
                   const isBidMode = (c.on_sale_count || 0) === 0;
                   return (
                     <TouchableOpacity key={c.id} style={styles.colPickRow} onPress={() => { setActiveCollectionId(c.id); setShowPicker(false); }}>
                        <FallbackImage uri={c.image_url} style={styles.pickImg} />
                        <View style={{flex: 1}}>
                           <Text style={styles.pickTitle}>{c.name}</Text>
                           <Text style={styles.pickSub}>在售: <Text style={{color: '#4E342E', fontWeight: '900'}}>{c.on_sale_count || 0}</Text> | {isBidMode ? `退市价: ¥${c.max_consign_price}` : `底价: ¥${c.floor_price_cache || 0}`}</Text>
                        </View>
                        <View style={[styles.miniTag, isBidMode ? {backgroundColor: '#FFD700'} : {backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#D49A36'}]}>
                           <Text style={[styles.miniTagText, isBidMode ? {color: '#111'} : {color: '#D49A36'}]}>{isBidMode ? '竞价' : '求购'}</Text>
                        </View>
                     </TouchableOpacity>
                   )
                })}
             </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📝 订单确认</Text>
               <Text style={styles.confirmDesc}>将冻结 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{((parseFloat(price)||0) * (parseInt(quantity)||1)).toFixed(2)}</Text> 资金，并强制销毁 <Text style={{fontWeight:'900', color: '#4E342E'}}>1 张 Potato卡</Text>。是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executePublish} disabled={publishing}>
                     {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认并发布</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  targetHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#FDF8F0', marginRight: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  targetSubHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '900', marginLeft: 8 },
  modeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modeTagText: { fontSize: 10, fontWeight: '900' },
  
  inputGroup: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  inputLabel: { fontSize: 15, fontWeight: '900', color: '#4E342E' },
  inputField: { flex: 1, fontSize: 16, color: '#D49A36', fontWeight: '900' },
  
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF8F0', borderRadius: 8, borderWidth: 1, borderColor: '#EAE0D5' },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 18, color: '#4E342E', fontWeight: '900' },
  stepperInput: { width: 40, fontSize: 15, fontWeight: '900', color: '#D49A36' },
  
  ruleBox: { backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EAE0D5' },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#D49A36', marginBottom: 10 },
  ruleText: { fontSize: 12, color: '#8D6E63', lineHeight: 20, marginBottom: 6, fontWeight: '700' },
  
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderTopWidth: 1, borderColor: '#EAE0D5', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowOffset: {width: 0, height: -5}, elevation: 10 },
  payInfo: { flex: 1 },
  payBtn: { backgroundColor: '#D49A36', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 24, shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FDF8F0', height: height * 0.65, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  colPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F0E6D2' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  pickTitle: { fontSize: 15, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  pickSub: { fontSize: 12, color: '#8D6E63', fontWeight: '600' },
  miniTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  miniTagText: { fontSize: 10, fontWeight: '900' },
  
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '900' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});