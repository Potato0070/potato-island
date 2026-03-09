import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function GenesisExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // 高级定制确认弹窗
  const [confirmModal, setConfirmModal] = useState<{visible: boolean, type: 'universal' | 'elder', costStr: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, universal_cards').eq('id', user.id).single();
      setProfile(data);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleExchangeClick = (type: 'universal' | 'elder') => {
    if (!profile) return showToast('数据加载中，请稍后');
    
    const potatoCards = Number(profile.potato_cards) || 0;
    const universalCards = Number(profile.universal_cards) || 0;

    if (type === 'universal') {
       if (potatoCards < 200) return showToast(`余额不足！需要 200 张 Potato卡 (当前 ${potatoCards} 张)`);
       setConfirmModal({ visible: true, type, costStr: '200 张 Potato卡' });
    } else {
       if (universalCards < 10) return showToast(`余额不足！需要 10 张 万能土豆卡 (当前 ${universalCards} 张)`);
       setConfirmModal({ visible: true, type, costStr: '10 张 万能土豆卡' });
    }
  };

  const executeExchange = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (confirmModal.type === 'universal') {
         // 扣 200 Potato，加 1 万能卡
         const { error } = await supabase.from('profiles').update({
            potato_cards: profile.potato_cards - 200,
            universal_cards: (profile.universal_cards || 0) + 1
         }).eq('id', user?.id);
         if (error) throw error;
         showToast('✅ 创世神迹！成功兑换 1 张【万能土豆卡】！');
      } 
      else if (confirmModal.type === 'elder') {
         // 扣 10 万能卡，铸造 1 个长老 NFT
         const { data: colData } = await supabase.from('collections').select('id, total_minted, name').eq('name', '褐皮土豆长老').single();
         if (!colData) throw new Error('系统尚未配置【褐皮土豆长老】系列资产！');

         // 扣卡
         await supabase.from('profiles').update({ universal_cards: profile.universal_cards - 10 }).eq('id', user?.id);

         // 印发长老并上链
         const newSerial = colData.total_minted + 1;
         await supabase.from('nfts').insert([{ collection_id: colData.id, owner_id: user?.id, serial_number: newSerial.toString(), status: 'idle' }]);
         await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', colData.id);

         // 全服播报
         await supabase.from('announcements').insert([{ 
            title: '👑 创世殿堂降临神迹！', 
            content: `恭喜岛民在创世发新殿堂，成功兑换出神级资产【褐皮土豆长老】！全岛震动！`, 
            author_name: '创世中枢', 
            is_featured: true 
         }]);

         showToast('👑 伟大的岛主！神级资产【褐皮土豆长老】已打入您的金库！');
      }

      setConfirmModal(null);
      fetchProfile();
    } catch (err: any) { 
      showToast(`兑换失败: ${err.message}`); 
      setConfirmModal(null);
    } finally { 
      setProcessing(false); 
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>创世发新</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>超级单品兑换殿堂</Text>
            <Text style={styles.headerSub}>收集基础材料，向上合成，获取全岛最顶级的权力资产。</Text>
            <View style={styles.balanceRow}>
               <Text style={styles.balanceText}>Potato卡: <Text style={{color:'#FF3B30'}}>{profile?.potato_cards || 0}</Text></Text>
               <Text style={styles.balanceText}>万能卡: <Text style={{color:'#D49A36'}}>{profile?.universal_cards || 0}</Text></Text>
            </View>
         </View>

         {/* 万能卡兑换模块 */}
         <View style={styles.exchangeCard}>
            <View style={styles.cardInfo}>
               <View style={styles.imgPlaceholder}><Text style={{fontSize: 40}}>🌟</Text></View>
               <View style={{flex: 1, marginLeft: 16}}>
                  <Text style={styles.itemName}>万能土豆卡</Text>
                  <Text style={styles.itemDesc}>极其稀有的高级合成材料与权力凭证。</Text>
               </View>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>兑换所需</Text>
               <Text style={styles.costValue}>200 张 Potato卡</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleExchangeClick('universal')}>
               <Text style={styles.actionBtnText}>立即兑换</Text>
            </TouchableOpacity>
         </View>

         {/* 长老兑换模块 */}
         <View style={[styles.exchangeCard, {borderColor: '#FFD700', borderWidth: 1}]}>
            <View style={styles.cardInfo}>
               <View style={[styles.imgPlaceholder, {backgroundColor: '#FFF5E6'}]}><Text style={{fontSize: 40}}>👑</Text></View>
               <View style={{flex: 1, marginLeft: 16}}>
                  <Text style={styles.itemName}>褐皮土豆长老</Text>
                  <Text style={styles.itemDesc}>土豆王国的神级原住民，全网唯一数字资产凭证，拥有无上权力。</Text>
               </View>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>兑换所需</Text>
               <Text style={[styles.costValue, {color: '#FFD700'}]}>10 张 万能土豆卡</Text>
            </View>
            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FFD700'}]} onPress={() => handleExchangeClick('elder')}>
               <Text style={[styles.actionBtnText, {color: '#111'}]}>登顶王座 (兑换)</Text>
            </TouchableOpacity>
         </View>
      </ScrollView>

      {/* 🌟 严苛二次确认弹窗 */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>💎 创世确认</Text>
               <Text style={styles.confirmDesc}>您即将永久燃烧 <Text style={{fontWeight:'900', color:'#FF3B30'}}>{confirmModal?.costStr}</Text>，兑换【{confirmModal?.type === 'universal' ? '万能土豆卡' : '褐皮土豆长老'}】。操作不可逆转，是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(null)}><Text style={styles.cancelBtnText}>暂不兑换</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeExchange} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认燃烧与兑换</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  container: { flex: 1, backgroundColor: '#111' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, borderBottomWidth: 1, borderColor: '#333' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#FFF' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#111', fontSize: 14, fontWeight: '900' },
  
  headerBox: { marginBottom: 30, marginTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#FFD700', marginBottom: 10 },
  headerSub: { fontSize: 13, color: '#CCC', lineHeight: 20, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, alignSelf: 'flex-start' },
  balanceText: { color: '#FFF', fontSize: 13, fontWeight: '800', marginRight: 16 },

  exchangeCard: { backgroundColor: '#222', borderRadius: 20, padding: 20, marginBottom: 20 },
  cardInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  imgPlaceholder: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 6 },
  itemDesc: { fontSize: 12, color: '#999', lineHeight: 18 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#333', marginBottom: 20 },
  costLabel: { fontSize: 14, color: '#999' },
  costValue: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  actionBtn: { backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  actionBtnText: { color: '#111', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#222', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#CCC', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#444', alignItems: 'center' },
  cancelBtnText: { color: '#CCC', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FFD700', alignItems: 'center' },
  confirmBtnText: { color: '#111', fontSize: 15, fontWeight: '900' }
});