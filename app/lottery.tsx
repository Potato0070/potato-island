import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LotteryScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🌟 高级弹窗状态
  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, universal_cards, nickname').eq('id', user.id).single();
      setProfile(data);
    }
    setLoading(false);
  };

  const handleDrawClick = () => {
    if (!profile) return showToast('数据加载中...');
    if ((profile.potato_cards || 0) < 5) return showToast('余额不足！需要消耗 5 张 Potato卡');
    setConfirmModal(true);
  };

  const executeDraw = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let currentPotato = profile.potato_cards - 5;
      let currentUniversal = profile.universal_cards || 0;
      
      // 🌟 核心：100份真实概率引擎
      const roll = Math.floor(Math.random() * 100); 
      let prizeMsg = '';
      let isElder = false;
      let mintNftName = ''; 

      if (roll < 40) { // 40份
         currentPotato += 1;
         prizeMsg = 'Potato卡 * 1';
      } else if (roll < 70) { // 30份
         currentPotato += 2;
         prizeMsg = 'Potato卡 * 2';
      } else if (roll < 80) { // 10份
         currentPotato += 3;
         prizeMsg = 'Potato卡 * 3';
      } else if (roll < 90) { // 10份
         mintNftName = '原生土豆种子';
         prizeMsg = '原生土豆种子 * 1';
      } else if (roll < 94) { // 4份
         mintNftName = '白皮土豆劳动者';
         prizeMsg = '白皮土豆劳动者 * 1';
      } else if (roll < 98) { // 4份
         mintNftName = '红皮土豆艺术家';
         prizeMsg = '红皮土豆艺术家 * 1';
      } else if (roll < 99) { // 1份
         currentUniversal += 1;
         prizeMsg = '🌟 万能土豆卡 * 1';
      } else { // 1份
         mintNftName = '褐皮土豆长老';
         prizeMsg = '👑 史诗级：褐皮土豆长老 * 1';
         isElder = true;
      }

      await supabase.from('profiles').update({ potato_cards: currentPotato, universal_cards: currentUniversal }).eq('id', user?.id);

      if (mintNftName) {
         const { data: colData } = await supabase.from('collections').select('id, total_minted').eq('name', mintNftName).single();
         if (colData) {
            const newSerial = colData.total_minted + 1;
            await supabase.from('nfts').insert([{ collection_id: colData.id, owner_id: user?.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', colData.id);
            
            if (isElder) {
               await supabase.from('announcements').insert([{ 
                  title: '👑 命运的抉择！史诗降临！', 
                  content: `恭喜岛民【${profile.nickname || '神秘玩家'}】在命运抽签中获得了极其稀有的【褐皮土豆长老】！王国已为其空投 10 份原生土豆种子作为嘉奖！`, 
                  author_name: '王国大喇叭', 
                  is_featured: true 
               }]);
               const { data: seedCol } = await supabase.from('collections').select('id, total_minted').eq('name', '原生土豆种子').single();
               if (seedCol) {
                  let seedSerial = seedCol.total_minted;
                  const seedInserts = Array.from({length: 10}).map(() => {
                     seedSerial += 1;
                     return { collection_id: seedCol.id, owner_id: user?.id, serial_number: seedSerial.toString(), status: 'idle' };
                  });
                  await supabase.from('nfts').insert(seedInserts);
                  await supabase.from('collections').update({ total_minted: seedSerial, circulating_supply: seedSerial }).eq('id', seedCol.id);
                  prizeMsg += '\n\n🎁 触发神迹：已额外空投 [原生土豆种子 * 10]！';
               }
            }
         }
      }

      setConfirmModal(false);
      setResultModal({ title: '🎉 盲盒开启成功', msg: `恭喜您获得了：\n\n${prizeMsg}` });
      fetchProfile();
    } catch (err: any) { 
       setConfirmModal(false);
       showToast(`抽签失败: ${err.message}`); 
    } finally { setProcessing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>命运抽签</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.banner}>
            <Text style={styles.bannerTitle}>命运盲盒</Text>
            <Text style={styles.bannerSub}>每次开启消耗 5 张 Potato卡，极小概率获得史诗级藏品与万能卡。</Text>
            <View style={styles.balanceBox}>
               <Text style={{color: '#FFF', fontSize: 12}}>当前拥有: Potato卡 x{profile?.potato_cards || 0}</Text>
            </View>
         </View>

         <View style={styles.card}>
            <View style={styles.cardStatus}><Text style={styles.cardStatusText}>常驻奖池</Text></View>
            <View style={styles.imgPlaceholder}><Text style={{fontSize: 60}}>🔮</Text></View>
            <Text style={styles.eventName}>土豆王国创世盲盒</Text>
            
            <View style={styles.infoRow}><Text style={styles.infoLabel}>开启消耗</Text><Text style={styles.infoValueCost}>5 张 Potato卡 / 次</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>神级大奖</Text><Text style={styles.infoValueHot}>褐皮土豆长老 (1%)</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>稀有奖励</Text><Text style={styles.infoValue}>万能土豆卡 (1%)</Text></View>
            <View style={[styles.infoRow, {borderBottomWidth: 0, paddingBottom: 0}]}><Text style={styles.infoLabel}>基础奖励</Text><Text style={styles.infoValue}>随机数量Potato卡/劳动者等</Text></View>

            <TouchableOpacity style={[styles.joinBtn, (profile?.potato_cards || 0) < 5 && {backgroundColor: '#CCC'}]} onPress={handleDrawClick} disabled={processing || (profile?.potato_cards || 0) < 5}>
               <Text style={styles.joinBtnText}>{(profile?.potato_cards || 0) < 5 ? 'Potato卡不足' : '立即投入并开启'}</Text>
            </TouchableOpacity>
         </View>
      </ScrollView>

      {/* 🌟 抽签确认弹窗 */}
      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🎰 开启命运盲盒</Text>
               <Text style={styles.confirmDesc}>将立即扣除 <Text style={{color:'#FF3B30', fontWeight:'900'}}>5 张</Text> Potato卡，盲盒开启后结果不可逆。是否确认投入？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeDraw} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认抽签</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 🌟 中奖结果展示弹窗 */}
      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {borderColor: '#FFD700', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#FF3B30', fontSize: 20}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 16, color: '#111', fontWeight: '800'}]}>{resultModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%'}]} onPress={() => setResultModal(null)}>
                  <Text style={styles.confirmBtnText}>开心收下</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  banner: { backgroundColor: '#111', padding: 24, borderRadius: 16, marginBottom: 20 },
  bannerTitle: { fontSize: 24, fontWeight: '900', color: '#FFD700', marginBottom: 8 },
  bannerSub: { fontSize: 13, color: '#CCC', lineHeight: 20, marginBottom: 16 },
  balanceBox: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardStatus: { position: 'absolute', top: 20, right: 20, backgroundColor: '#0066FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10 },
  cardStatusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  imgPlaceholder: { width: '100%', height: 180, backgroundColor: '#F0F0F0', borderRadius: 12, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  eventName: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  infoValueCost: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },
  infoValueHot: { fontSize: 14, fontWeight: '900', color: '#D49A36' },
  joinBtn: { backgroundColor: '#0066FF', paddingVertical: 16, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#0066FF', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});