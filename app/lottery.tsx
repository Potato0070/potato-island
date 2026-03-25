import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LotteryScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [potatoIds, setPotatoIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // 🌟 动态获取真实日期，打破 7月17日 的时间循环！
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDate = today.getDate();

  useEffect(() => { fetchProfile(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('universal_cards, nickname').eq('id', user.id).single();
      setProfile(data);

      const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
      const pCards = myNfts?.filter((nft: any) => {
         const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
         return colName === 'Potato卡';
      }) || [];
      setPotatoIds(pCards.map((nft: any) => nft.id));
    }
    setLoading(false);
  };

  const handleDrawClick = () => {
    if (potatoIds.length < 5) return showToast(`金库现货不足！需要 5 张真实的 Potato卡 (当前仅闲置 ${potatoIds.length} 张)`);
    setConfirmModal(true);
  };

  const executeDraw = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const idsToBurn = potatoIds.slice(0, 5);
      await supabase.from('nfts').update({ status: 'burned' }).in('id', idsToBurn);
      
      let currentUniversal = profile?.universal_cards || 0;
      
      const roll = Math.floor(Math.random() * 100); 
      let prizeMsg = '';
      let isElder = false;
      let mintNftName = ''; 
      let potatoRewardCount = 0;

      if (roll < 40) { 
         potatoRewardCount = 1; prizeMsg = 'Potato卡 * 1';
      } else if (roll < 70) { 
         potatoRewardCount = 2; prizeMsg = 'Potato卡 * 2';
      } else if (roll < 80) { 
         potatoRewardCount = 3; prizeMsg = 'Potato卡 * 3';
      } else if (roll < 90) { 
         mintNftName = '原生土豆种子'; prizeMsg = '原生土豆种子 * 1';
      } else if (roll < 94) { 
         mintNftName = '白皮土豆劳动者'; prizeMsg = '白皮土豆劳动者 * 1';
      } else if (roll < 98) { 
         mintNftName = '红皮土豆艺术家'; prizeMsg = '红皮土豆艺术家 * 1';
      } else if (roll < 99) { 
         currentUniversal += 1; prizeMsg = '🌟 万能土豆卡 * 1';
      } else { 
         mintNftName = '褐皮土豆长老'; prizeMsg = '👑 史诗级：褐皮土豆长老 * 1';
         isElder = true;
      }

      await supabase.from('profiles').update({ universal_cards: currentUniversal }).eq('id', user?.id);

      if (potatoRewardCount > 0) mintNftName = 'Potato卡';

      if (mintNftName) {
         const { data: colData } = await supabase.from('collections').select('id, total_minted').eq('name', mintNftName).single();
         if (colData) {
            let currentMinted = colData.total_minted;
            const loopCount = potatoRewardCount > 0 ? potatoRewardCount : 1;
            const inserts = Array.from({length: loopCount}).map(() => {
               currentMinted += 1;
               return { collection_id: colData.id, owner_id: user?.id, serial_number: currentMinted.toString(), status: 'idle' };
            });
            await supabase.from('nfts').insert(inserts);
            await supabase.from('collections').update({ total_minted: currentMinted, circulating_supply: currentMinted }).eq('id', colData.id);
            
            if (isElder) {
               await supabase.from('announcements').insert([{ 
                  title: '👑 命运的抉择！史诗降临！', 
                  content: `恭喜岛民【${profile?.nickname || '神秘玩家'}】在命运抽签中获得了极其稀有的【褐皮土豆长老】！王国已为其空投 10 份原生土豆种子作为嘉奖！`, 
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const isMaterialEnough = potatoIds.length >= 5;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 🌟 极简护眼导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>命运抽签</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         {/* 🌟 改造突兀的黑色背景栏，植入动态日历 */}
         <View style={styles.banner}>
            <View style={{flex: 1}}>
               <Text style={styles.bannerTitle}>命运盲盒</Text>
               <Text style={styles.bannerSub}>每次开启消耗 5 张 Potato卡，极小概率获得史诗级藏品与万能卡。</Text>
               <View style={styles.balanceBox}>
                  <Text style={styles.balanceText}>金库闲置: Potato卡 x{potatoIds.length}</Text>
               </View>
            </View>
            
            <View style={styles.dynamicCalendar}>
               <View style={styles.calHeader}><Text style={styles.calMonth}>{currentMonth}月</Text></View>
               <View style={styles.calBody}><Text style={styles.calDay}>{currentDate}</Text></View>
            </View>
         </View>

         {/* 🌟 卡片区域：统一复古UI */}
         <View style={styles.card}>
            {/* 🌟 拔掉蓝色的“常驻奖池”，换上琥珀金 */}
            <View style={styles.cardStatus}><Text style={styles.cardStatusText}>常驻奖池</Text></View>
            <View style={styles.imgPlaceholder}><Text style={{fontSize: 60}}>🔮</Text></View>
            <Text style={styles.eventName}>土豆王国创世盲盒</Text>
            
            <View style={styles.infoRow}><Text style={styles.infoLabel}>开启消耗</Text><Text style={styles.infoValueCost}>5 张 Potato卡 / 次</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>神级大奖</Text><Text style={styles.infoValueHot}>褐皮土豆长老 (1%)</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>稀有奖励</Text><Text style={styles.infoValue}>万能土豆卡 (1%)</Text></View>
            <View style={[styles.infoRow, {borderBottomWidth: 0, paddingBottom: 0}]}><Text style={styles.infoLabel}>基础奖励</Text><Text style={styles.infoValue}>随机数量卡片/劳动者等</Text></View>

            {/* 🌟 优化禁用按钮的状态：材料不足时呈现高级的失效灰 */}
            <TouchableOpacity 
               style={[styles.joinBtn, !isMaterialEnough && styles.joinBtnDisabled]} 
               onPress={handleDrawClick} 
               disabled={processing || !isMaterialEnough}
            >
               <Text style={[styles.joinBtnText, !isMaterialEnough && styles.joinBtnTextDisabled]}>
                  {!isMaterialEnough ? '材料不足 (需 5 张)' : '立即投入并开启'}
               </Text>
            </TouchableOpacity>
         </View>
      </ScrollView>

      {/* 🌟 抽签确认弹窗 (去蓝化) */}
      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🎰 开启命运盲盒</Text>
               <Text style={styles.confirmDesc}>将立即物理销毁金库里的 <Text style={{color:'#FF3B30', fontWeight:'900'}}>5 张</Text> 真实 Potato卡。结果不可逆。是否确认？</Text>
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
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 20}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 16, color: '#4E342E', fontWeight: '800'}]}>{resultModal?.msg}</Text>
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
  // 🌟 全局大背景：换成了护眼的复古米白
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  // 🌟 重新设计的 Banner，告别突兀的纯黑
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5EFE6', padding: 24, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EAE0D5' },
  bannerTitle: { fontSize: 24, fontWeight: '900', color: '#4E342E', marginBottom: 8 },
  bannerSub: { fontSize: 13, color: '#8D6E63', lineHeight: 20, marginBottom: 16 },
  balanceBox: { backgroundColor: 'rgba(212, 154, 54, 0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  balanceText: { color: '#D49A36', fontSize: 12, fontWeight: '800' },

  // 🔥 动态日历
  dynamicCalendar: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden', shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: '#EAE0D5', marginLeft: 16 },
  calHeader: { backgroundColor: '#D49A36', height: 18, justifyContent: 'center', alignItems: 'center' },
  calMonth: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  calBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  calDay: { color: '#4E342E', fontSize: 20, fontWeight: '900' },

  // 卡片主体
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  cardStatus: { position: 'absolute', top: 20, right: 20, backgroundColor: '#D49A36', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10 }, // 🌟 换成琥珀金
  cardStatusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  imgPlaceholder: { width: '100%', height: 180, backgroundColor: '#FDF8F0', borderRadius: 12, marginBottom: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  eventName: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 20 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  infoLabel: { fontSize: 14, color: '#8D6E63' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#4E342E' },
  infoValueCost: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },
  infoValueHot: { fontSize: 14, fontWeight: '900', color: '#D49A36' },
  
  // 🌟 开启盲盒按钮
  joinBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  joinBtnDisabled: { backgroundColor: '#EAE0D5' }, // 高级禁用灰
  joinBtnTextDisabled: { color: '#A1887F' },

  // 弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' }, // 棕色遮罩
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' }, // 🌟 换成琥珀金
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});