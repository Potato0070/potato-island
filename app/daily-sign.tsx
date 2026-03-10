import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

// 🌟 核心引擎：强制获取东八区（北京时间）的 YYYY-MM-DD
const getBeijingDateStr = () => {
  // 当前的 UTC 毫秒数 + 8小时的毫秒数
  const bjTime = new Date(Date.now() + 8 * 3600 * 1000);
  return bjTime.toISOString().split('T')[0]; 
};

export default function DailySignScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  // 🌟 高级定制弹窗
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('last_checkin_date, checkin_streak, universal_cards').eq('id', user.id).single();
      
      // 🌟 查出真实大盘里的 Potato卡 数量，避免显示虚假数据
      const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
      let realPotatoCount = 0;
      if (myNfts) {
         realPotatoCount = myNfts.filter((nft: any) => {
            const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
            return colName === 'Potato卡';
         }).length;
      }
      setProfile({ ...data, potato_cards: realPotatoCount });
    }
    setLoading(false);
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      const today = getBeijingDateStr(); // 🌟 使用北京时间校验
      
      let newStreak = 1;
      
      // 计算连续签到 (严格基于北京时间的日期差)
      if (profile.last_checkin_date) {
         const lastDate = new Date(profile.last_checkin_date).getTime();
         const currentDate = new Date(today).getTime();
         // 算出相差的天数
         const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
         
         if (diffDays === 1) newStreak = (profile.checkin_streak || 0) + 1;
         else if (diffDays === 0) return showToast('今日已朝圣，请明日北京时间 0 点后再来！');
         else newStreak = 1; // 断签重置
      }

      // 计算今日发放的 Potato 卡数量 (最高7张)
      const rewardCards = newStreak <= 7 ? newStreak : 1; 
      if (newStreak > 7) newStreak = 1; // 7天一周期轮回

      // 🌟 第7天神秘空投逻辑
      let airdropMsg = '';
      let addUniversal = 0;
      let extraPotato = 0;
      let mintNftName = ''; // 用来铸造隐藏材料

      if (newStreak === 7) {
         const rand = Math.random() * 100;
         if (rand <= 5) {
            addUniversal = 1;
            airdropMsg = '\n\n🎉 【神之眷顾】爆出隐藏款：万能土豆卡 *1！';
         } else if (rand <= 20) {
            extraPotato = 10;
            airdropMsg = '\n\n🎁 【周期大奖】额外空投：Potato卡 *10！';
         } else {
            const mats = ['天然矿盐', '地下泉水', '天然土', '天然油'];
            mintNftName = mats[Math.floor(Math.random() * mats.length)];
            airdropMsg = `\n\n🎁 【周期大奖】额外空投：${mintNftName} *1`;
         }
      }

      // 🌟 核心：物理印发真实的 NFT 藏品到大盘！
      const { data: cols } = await supabase.from('collections').select('id, name, total_minted').in('name', ['Potato卡', '万能土豆卡', mintNftName]);
      const potatoCol = cols?.find(c => c.name === 'Potato卡');
      const uniCol = cols?.find(c => c.name === '万能土豆卡');
      const matCol = cols?.find(c => c.name === mintNftName);

      let inserts = [];

      // 1. 印发 Potato卡
      if (potatoCol && (rewardCards + extraPotato) > 0) {
         let currentPotatoSerial = potatoCol.total_minted;
         const amount = rewardCards + extraPotato;
         for(let i = 0; i < amount; i++) {
            currentPotatoSerial++;
            inserts.push({ collection_id: potatoCol.id, owner_id: user.id, serial_number: currentPotatoSerial.toString(), status: 'idle' });
         }
         await supabase.from('collections').update({ total_minted: currentPotatoSerial, circulating_supply: currentPotatoSerial }).eq('id', potatoCol.id);
      }

      // 2. 印发 万能土豆卡
      if (uniCol && addUniversal > 0) {
         const newUniSerial = uniCol.total_minted + 1;
         inserts.push({ collection_id: uniCol.id, owner_id: user.id, serial_number: newUniSerial.toString(), status: 'idle' });
         await supabase.from('collections').update({ total_minted: newUniSerial, circulating_supply: newUniSerial }).eq('id', uniCol.id);
      }

      // 3. 印发 周期神秘材料
      if (matCol && mintNftName) {
         const newMatSerial = matCol.total_minted + 1;
         inserts.push({ collection_id: matCol.id, owner_id: user.id, serial_number: newMatSerial.toString(), status: 'idle' });
         await supabase.from('collections').update({ total_minted: newMatSerial, circulating_supply: newMatSerial }).eq('id', matCol.id);
      }

      // 执行所有 NFT 发放
      if (inserts.length > 0) {
         await supabase.from('nfts').insert(inserts);
      }

      // 🌟 更新签到状态和旧版万能卡冗余字段
      await supabase.from('profiles').update({ 
         last_checkin_date: today,
         checkin_streak: newStreak,
         universal_cards: (profile.universal_cards || 0) + addUniversal
      }).eq('id', user.id);

      setResultModal({ title: '🙏 朝圣成功', msg: `您已连续朝圣 ${newStreak} 天！\n\n获得：Potato卡 *${rewardCards}${airdropMsg}` });
      fetchStatus();
    } catch (e: any) { showToast(`失败: ${e.message}`); } finally { setSigning(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const todayStr = getBeijingDateStr();
  const hasSigned = profile?.last_checkin_date === todayStr;
  const displayStreak = hasSigned ? profile.checkin_streak : (profile?.checkin_streak || 0) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <View style={styles.content}>
         <Text style={styles.emoji}>📅</Text>
         <Text style={styles.title}>每日朝圣</Text>
         <Text style={styles.subtitle}>每日签到领取硬通货【Potato卡】。连续7天更可触发神秘材料或万能卡空投！</Text>

         <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>{hasSigned ? '当前连续朝圣' : '今日签到可得'}</Text>
            <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 10}}>
               <Text style={styles.rewardValue}>{hasSigned ? profile.checkin_streak : displayStreak}</Text>
               <Text style={{fontSize: 16, color: '#D49A36', fontWeight: '900', marginLeft: 6}}>{hasSigned ? '天' : '张 Potato卡'}</Text>
            </View>
            {!hasSigned && displayStreak === 7 && <Text style={styles.airdropHint}>🎁 今日签到将触发第7日神秘空投</Text>}
         </View>

         <View style={{flexDirection: 'row', marginBottom: 40}}>
            <Text style={{color: '#666'}}>金库真实库存: </Text>
            <Text style={{color: '#111', fontWeight: '900'}}>Potato卡 x{profile?.potato_cards || 0} | 万能卡 x{profile?.universal_cards || 0}</Text>
         </View>

         <TouchableOpacity style={[styles.signBtn, hasSigned && {backgroundColor: '#CCC'}]} onPress={handleSign} disabled={hasSigned || signing}>
            {signing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.signBtnText}>{hasSigned ? '今日已朝圣' : '虔诚领取'}</Text>}
         </TouchableOpacity>
      </View>

      {/* 🌟 朝圣成功高级弹窗 */}
      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 20}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 16, color: '#111', fontWeight: '800'}]}>{resultModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => setResultModal(null)}>
                  <Text style={styles.confirmBtnText}>感恩岛主</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  container: { flex: 1, backgroundColor: '#FFF' },
  navBar: { paddingHorizontal: 16, height: 44, justifyContent: 'center' },
  navBtn: { width: 80 },
  iconText: { fontSize: 16, color: '#111', fontWeight: '800' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  content: { flex: 1, alignItems: 'center', padding: 30, paddingTop: 40 },
  emoji: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#4A2E1B', marginBottom: 12 },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  rewardBox: { width: '100%', backgroundColor: '#FDF9F1', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#F5E8D4', borderStyle: 'dashed', marginBottom: 20 },
  rewardLabel: { fontSize: 14, color: '#D49A36', fontWeight: '800' },
  rewardValue: { fontSize: 48, fontWeight: '900', color: '#FF3B30' },
  airdropHint: { color: '#FF3B30', fontSize: 12, fontWeight: '800', marginTop: 12 },
  signBtn: { width: '100%', backgroundColor: '#D49A36', paddingVertical: 18, borderRadius: 30, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  signBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});