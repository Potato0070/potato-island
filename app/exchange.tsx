import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function ExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [potatoIds, setPotatoIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{visible: boolean, type: 'transfer'|'batch', cost: number} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchMyData(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchMyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profData } = await supabase.from('profiles').select('transfer_cards, batch_cards').eq('id', user.id).single();
    setProfile(profData);

    const { data: myNfts } = await supabase.from('nfts')
      .select('id, collections(name)')
      .eq('owner_id', user.id)
      .eq('status', 'idle');
    
    const realPotatoCards = myNfts?.filter((nft: any) => {
       const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
       return colName === 'Potato卡';
    }) || [];
    setPotatoIds(realPotatoCards.map((nft: any) => nft.id));
  };

  const handleExchangeClick = (type: 'transfer' | 'batch', cost: number) => {
    if (potatoIds.length < cost) {
       return showToast(`仓库现货不足！需要 ${cost} 张 Potato卡 (当前仅闲置 ${potatoIds.length} 张)`);
    }
    setConfirmModal({ visible: true, type, cost });
  };

  const executeExchange = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const idsToBurn = potatoIds.slice(0, confirmModal.cost);
      await supabase.from('nfts').update({ status: 'burned' }).in('id', idsToBurn);

      const updates: any = {};
      if (confirmModal.type === 'transfer') updates.transfer_cards = (profile?.transfer_cards || 0) + 1;
      if (confirmModal.type === 'batch') updates.batch_cards = (profile?.batch_cards || 0) + 1;
      await supabase.from('profiles').update(updates).eq('id', user?.id);

      setConfirmModal(null);
      showToast('✅ 献祭成功！真实资产已销毁，特权卡入库！');
      fetchMyData(); 
    } catch (err: any) { 
      showToast(`失败: ${err.message}`); 
    } finally { setProcessing(false); }
  };

  // 🌟 核心防误触：计算材料是否足够
  const canAffordTransfer = potatoIds.length >= 3;
  const canAffordBatch = potatoIds.length >= 10;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>特权兑换</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>基础材料熔炉</Text>
            <Text style={styles.headerSub}>金库现存 Potato卡: <Text style={{color:'#FF3B30', fontWeight:'900', fontSize: 16}}>{potatoIds.length}</Text> 张</Text>
         </View>

         {/* 兑换卡 1：资产转赠卡 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>🎁</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>资产转赠卡</Text>
                  <Text style={styles.cardDesc}>用于给其他岛民转赠藏品，单次消耗1张。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>持有: <Text style={{color:'#4E342E', fontWeight:'900'}}>{profile?.transfer_cards || 0}</Text> 张</Text>
               
               {/* 🌟 颜色大一统 + 防坑置灰 */}
               <TouchableOpacity 
                  style={[styles.exchangeBtn, !canAffordTransfer && styles.disabledBtn]} 
                  onPress={() => handleExchangeClick('transfer', 3)} 
                  disabled={processing || !canAffordTransfer}
               >
                  <Text style={[styles.exchangeBtnText, !canAffordTransfer && styles.disabledBtnText]}>
                     {canAffordTransfer ? '兑换 (耗 3 张卡)' : '材料不足 (需 3 张)'}
                  </Text>
               </TouchableOpacity>
            </View>
         </View>

         {/* 兑换卡 2：批量寄售卡 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>📦</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>批量寄售权益卡</Text>
                  <Text style={styles.cardDesc}>解锁大户特权，支持一键上架多达20件藏品。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>持有: <Text style={{color:'#4E342E', fontWeight:'900'}}>{profile?.batch_cards || 0}</Text> 张</Text>
               
               {/* 🌟 颜色大一统 + 防坑置灰 */}
               <TouchableOpacity 
                  style={[styles.exchangeBtn, !canAffordBatch && styles.disabledBtn]} 
                  onPress={() => handleExchangeClick('batch', 10)} 
                  disabled={processing || !canAffordBatch}
               >
                  <Text style={[styles.exchangeBtnText, !canAffordBatch && styles.disabledBtnText]}>
                     {canAffordBatch ? '兑换 (耗 10 张卡)' : '材料不足 (需 10 张)'}
                  </Text>
               </TouchableOpacity>
            </View>
         </View>
      </ScrollView>

      <Modal visible={!!confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🔥 确认献祭</Text>
               <Text style={styles.confirmDesc}>将从您的金库中永久物理销毁 <Text style={{fontWeight:'900', color:'#FF3B30'}}>{confirmModal?.cost}</Text> 张 Potato卡 兑换此特权。是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtnOutline} onPress={() => setConfirmModal(null)}><Text style={styles.cancelBtnOutlineText}>我再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeExchange} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认销毁</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 彻底抛弃冷色调，拥抱尊贵米白
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  headerBox: { marginBottom: 24, paddingHorizontal: 4 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#4E342E', marginBottom: 8 },
  headerSub: { fontSize: 13, color: '#8D6E63', fontWeight: '600' },
  
  cardBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FDF8F0', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  cardName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#8D6E63', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F5EFE6', paddingTop: 16 },
  holdText: { fontSize: 12, color: '#8D6E63', fontWeight: '600' },
  
  // 🌟 正常状态按钮：琥珀金
  exchangeBtn: { backgroundColor: '#D49A36', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  exchangeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  // 🌟 禁用状态按钮：高级灰 (防误触核心)
  disabledBtn: { backgroundColor: '#EAE0D5' },
  disabledBtnText: { color: '#A1887F' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtnOutline: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#EAE0D5', alignItems: 'center' },
  cancelBtnOutlineText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});