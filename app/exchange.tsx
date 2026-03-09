import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function ExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // 🌟 核心定制：定制化高级弹窗状态
  const [confirmModal, setConfirmModal] = useState<{visible: boolean, type: 'transfer'|'batch', cost: number} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, transfer_cards, batch_cards').eq('id', user.id).single();
      setProfile(data);
    }
  };

  const handleExchangeClick = (type: 'transfer' | 'batch', cost: number) => {
    if (!profile) return showToast('数据加载中，请稍后');
    const currentCards = Number(profile.potato_cards) || 0;
    
    if (currentCards < cost) {
       return showToast(`余额不足！需要 ${cost} 张 Potato卡 (当前仅 ${currentCards} 张)`);
    }
    
    // 唤起高级定制弹窗
    setConfirmModal({ visible: true, type, cost });
  };

  const executeExchange = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = { potato_cards: profile.potato_cards - confirmModal.cost };
      if (confirmModal.type === 'transfer') updates.transfer_cards = profile.transfer_cards + 1;
      if (confirmModal.type === 'batch') updates.batch_cards = profile.batch_cards + 1;

      const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
      if (error) throw error;

      setConfirmModal(null);
      showToast('✅ 献祭成功！特权卡已入库');
      fetchProfile();
    } catch (err: any) { 
      showToast(`失败: ${err.message}`); 
    } finally { 
      setProcessing(false); 
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>特权兑换</Text>
        <View style={styles.navBtn} />
      </View>

      {/* 轻提示 Toast */}
      {toastMsg ? (
         <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View>
      ) : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>基础材料熔炉</Text>
            <Text style={styles.headerSub}>当前持有 Potato卡: <Text style={{color:'#FF3B30', fontWeight:'900', fontSize: 16}}>{profile?.potato_cards || 0}</Text> 张</Text>
         </View>

         {/* 转赠卡 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>🎁</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>资产转赠卡</Text>
                  <Text style={styles.cardDesc}>用于给其他岛民转赠藏品，单次消耗1张。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>持有: <Text style={{color:'#111', fontWeight:'900'}}>{profile?.transfer_cards || 0}</Text> 张</Text>
               <TouchableOpacity style={styles.exchangeBtn} onPress={() => handleExchangeClick('transfer', 3)} disabled={processing}>
                  <Text style={styles.exchangeBtnText}>燃烧 3 张 Potato卡</Text>
               </TouchableOpacity>
            </View>
         </View>

         {/* 批量卡 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>📦</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>批量寄售权益卡</Text>
                  <Text style={styles.cardDesc}>解锁大户特权，支持一键上架多达20件藏品。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>持有: <Text style={{color:'#111', fontWeight:'900'}}>{profile?.batch_cards || 0}</Text> 张</Text>
               <TouchableOpacity style={[styles.exchangeBtn, {backgroundColor: '#111'}]} onPress={() => handleExchangeClick('batch', 10)} disabled={processing}>
                  <Text style={[styles.exchangeBtnText, {color: '#FFD700'}]}>燃烧 10 张 Potato卡</Text>
               </TouchableOpacity>
            </View>
         </View>
      </ScrollView>

      {/* 🌟 核心修复：独立渲染的确认弹窗 (绝对能点) */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🔥 确认献祭</Text>
               <Text style={styles.confirmDesc}>将永久燃烧 <Text style={{fontWeight:'900', color:'#FF3B30'}}>{confirmModal?.cost}</Text> 张 Potato卡 兑换此特权，操作不可逆。是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(null)}>
                     <Text style={styles.cancelBtnText}>我再想想</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeExchange} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认燃烧</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  headerBox: { marginBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 8 },
  headerSub: { fontSize: 13, color: '#666' },
  cardBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F9F9F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#888', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 16 },
  holdText: { fontSize: 12, color: '#666' },
  exchangeBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  exchangeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});