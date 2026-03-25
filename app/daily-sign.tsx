import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 🌟 核心引擎：强制获取东八区（北京时间）的 YYYY-MM-DD
const getBeijingDateStr = () => {
  const bjTime = new Date(Date.now() + 8 * 3600 * 1000);
  return bjTime.toISOString().split('T')[0]; 
};

// 🌟 获取北京时间的 Date 对象，用于日历渲染
const getBeijingDateObj = () => {
  return new Date(Date.now() + 8 * 3600 * 1000);
};

export default function DailySignScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('last_checkin_date, checkin_streak, universal_cards').eq('id', user.id).single();
        
        const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
        let realPotatoCount = 0;
        if (myNfts) {
           realPotatoCount = myNfts.filter((nft: any) => {
              const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
              return colName === 'Potato卡';
           }).length;
        }
        setProfile({ ...data, checkin_streak: data?.checkin_streak || 0, potato_cards: realPotatoCount });
      }
    } catch (e) { console.error(e) } finally { setLoading(false); }
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      const today = getBeijingDateStr(); 
      
      let newStreak = 1;
      
      if (profile?.last_checkin_date) {
         const lastDate = new Date(profile.last_checkin_date).getTime();
         const currentDate = new Date(today).getTime();
         const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
         
         if (diffDays === 1) newStreak = (profile.checkin_streak || 0) + 1;
         else if (diffDays === 0) return showToast('今日已朝圣，请明日北京时间 0 点后再来！');
         else newStreak = 1; 
      }

      const rewardCards = newStreak <= 7 ? newStreak : 1; 
      if (newStreak > 7) newStreak = 1; 

      let airdropMsg = '';
      let addUniversal = 0;
      let extraPotato = 0;
      let mintNftName = ''; 

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

      const { data: cols } = await supabase.from('collections').select('id, name, total_minted').in('name', ['Potato卡', '万能土豆卡', mintNftName]);
      const potatoCol = cols?.find(c => c.name === 'Potato卡');
      const uniCol = cols?.find(c => c.name === '万能土豆卡');
      const matCol = cols?.find(c => c.name === mintNftName);

      let inserts = [];

      if (potatoCol && (rewardCards + extraPotato) > 0) {
         let currentPotatoSerial = potatoCol.total_minted || 0;
         const amount = rewardCards + extraPotato;
         for(let i = 0; i < amount; i++) {
            currentPotatoSerial++;
            inserts.push({ collection_id: potatoCol.id, owner_id: user.id, serial_number: currentPotatoSerial.toString(), status: 'idle' });
         }
         await supabase.from('collections').update({ total_minted: currentPotatoSerial, circulating_supply: currentPotatoSerial }).eq('id', potatoCol.id);
      }

      if (uniCol && addUniversal > 0) {
         const newUniSerial = (uniCol.total_minted || 0) + 1;
         inserts.push({ collection_id: uniCol.id, owner_id: user.id, serial_number: newUniSerial.toString(), status: 'idle' });
         await supabase.from('collections').update({ total_minted: newUniSerial, circulating_supply: newUniSerial }).eq('id', uniCol.id);
      }

      if (matCol && mintNftName) {
         const newMatSerial = (matCol.total_minted || 0) + 1;
         inserts.push({ collection_id: matCol.id, owner_id: user.id, serial_number: newMatSerial.toString(), status: 'idle' });
         await supabase.from('collections').update({ total_minted: newMatSerial, circulating_supply: newMatSerial }).eq('id', matCol.id);
      }

      if (inserts.length > 0) {
         const { error: insertErr } = await supabase.from('nfts').insert(inserts);
         if (insertErr) console.log('发放并发冲突，已静默拦截'); 
      }

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
  const displayStreak = hasSigned ? (profile?.checkin_streak || 0) : (profile?.checkin_streak || 0) + 1;

  // 🌟 动态日历引擎：根据当前年月和最后签到日，逆推当月签到记录
  const bjDate = getBeijingDateObj();
  const currentYear = bjDate.getUTCFullYear();
  const currentMonth = bjDate.getUTCMonth() + 1; // 1-12
  const currentDay = bjDate.getUTCDate();
  
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  // 算出本月第一天是星期几 (0=周日, 1=周一...)
  const firstDayOfWeek = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();

  // 🌟 逆向推导已签到的日期集合
  const checkedDates = new Set<string>();
  if (profile?.last_checkin_date && profile?.checkin_streak > 0) {
     const lastDateObj = new Date(profile.last_checkin_date);
     for (let i = 0; i < profile.checkin_streak; i++) {
         const d = new Date(lastDateObj.getTime() - i * 24 * 3600 * 1000);
         // 只记录本月的签到
         if (d.getUTCFullYear() === currentYear && (d.getUTCMonth() + 1) === currentMonth) {
             checkedDates.add(d.getUTCDate().toString());
         }
     }
  }

  // 构造日历网格数据
  const calendarGrid = [];
  // 填充月初空白
  for (let i = 0; i < firstDayOfWeek; i++) {
     calendarGrid.push({ day: '', isChecked: false, isToday: false });
  }
  // 填充真实天数
  for (let i = 1; i <= daysInMonth; i++) {
     calendarGrid.push({
         day: i.toString(),
         isChecked: checkedDates.has(i.toString()),
         isToday: i === currentDay
     });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 🌟 规范化顶部导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>每日朝圣</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
         
         <View style={styles.headerArea}>
            <Text style={styles.title}>朝圣神殿</Text>
            <Text style={styles.subtitle}>每日朝圣领取硬通货【Potato卡】。连续7天可触发神秘空投！</Text>
         </View>

         <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>{hasSigned ? '当前连续朝圣' : '今日签到可得'}</Text>
            <View style={{flexDirection: 'row', alignItems: 'baseline', marginTop: 10}}>
               <Text style={styles.rewardValue}>{hasSigned ? (profile?.checkin_streak || 0) : displayStreak}</Text>
               <Text style={{fontSize: 16, color: '#D49A36', fontWeight: '900', marginLeft: 6}}>{hasSigned ? '天' : '张 Potato卡'}</Text>
            </View>
            {!hasSigned && displayStreak === 7 && <Text style={styles.airdropHint}>🎁 今日签到将触发第7日神秘空投</Text>}
         </View>

         {/* 🌟 核心：月度签到日历网格 */}
         <View style={styles.calendarBox}>
             <View style={styles.calHeaderRow}>
                 <Text style={styles.calMonthText}>{currentYear}年 {currentMonth}月</Text>
                 <Text style={styles.calStreakText}>本月已朝圣: <Text style={{color: '#D49A36', fontSize: 16}}>{checkedDates.size}</Text> 天</Text>
             </View>
             
             {/* 星期表头 */}
             <View style={styles.weekRow}>
                 {['日','一','二','三','四','五','六'].map(w => (
                     <Text key={w} style={styles.weekText}>{w}</Text>
                 ))}
             </View>

             {/* 日期网格 */}
             <View style={styles.daysGrid}>
                 {calendarGrid.map((item, idx) => (
                     <View key={idx} style={styles.dayCell}>
                         {item.day !== '' && (
                             <View style={[styles.dayCircle, item.isToday && !item.isChecked && styles.dayCircleToday]}>
                                 {item.isChecked ? (
                                     <View style={styles.stampBox}><Text style={{fontSize: 14}}>🥔</Text></View>
                                 ) : (
                                     <Text style={[styles.dayText, item.isToday && {color: '#D49A36', fontWeight: '900'}]}>{item.day}</Text>
                                 )}
                             </View>
                         )}
                     </View>
                 ))}
             </View>
         </View>

         <View style={styles.inventoryRow}>
            <Text style={{color: '#8D6E63'}}>金库真实库存: </Text>
            <Text style={{color: '#4E342E', fontWeight: '900'}}>Potato卡 x{profile?.potato_cards || 0} | 万能卡 x{profile?.universal_cards || 0}</Text>
         </View>

         <TouchableOpacity 
            style={[styles.signBtn, hasSigned && {backgroundColor: '#EAE0D5'}]} 
            onPress={handleSign} 
            disabled={hasSigned || signing}
         >
            {signing ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.signBtnText, hasSigned && {color: '#A1887F'}]}>{hasSigned ? '今日已朝圣' : '虔诚领取'}</Text>}
         </TouchableOpacity>
      </ScrollView>

      {/* 🌟 朝圣成功高级弹窗 */}
      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>{resultModal?.title}</Text>
               <Text style={styles.confirmDesc}>{resultModal?.msg}</Text>
               <TouchableOpacity style={styles.confirmBtn} onPress={() => setResultModal(null)}>
                  <Text style={styles.confirmBtnText}>感恩岛主</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 统一复古米白
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  content: { alignItems: 'center', padding: 20, paddingBottom: 50 },
  
  headerArea: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#4E342E', marginBottom: 12 },
  subtitle: { fontSize: 13, color: '#8D6E63', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  
  rewardBox: { width: '100%', backgroundColor: '#FFF', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 20 },
  rewardLabel: { fontSize: 14, color: '#D49A36', fontWeight: '800' },
  rewardValue: { fontSize: 48, fontWeight: '900', color: '#FF3B30', fontFamily: 'monospace' },
  airdropHint: { color: '#FF3B30', fontSize: 12, fontWeight: '900', marginTop: 12, backgroundColor: '#FFF0F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  
  // 🌟 惊艳的日历网格样式
  calendarBox: { width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 20 },
  calHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calMonthText: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  calStreakText: { fontSize: 12, color: '#8D6E63', fontWeight: '700' },
  
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, color: '#A1887F', fontWeight: '800' },
  
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 2 },
  dayCircle: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#FDF8F0' },
  dayCircleToday: { borderWidth: 2, borderColor: '#D49A36', backgroundColor: '#FFF' },
  dayText: { fontSize: 14, color: '#4E342E', fontWeight: '600' },
  stampBox: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5EFE6', borderRadius: 12, borderWidth: 1, borderColor: '#D49A36' }, // 🌟 签到后的金色印章效果

  inventoryRow: { flexDirection: 'row', marginBottom: 30, backgroundColor: '#F5EFE6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },

  signBtn: { width: '100%', backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 30, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  signBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#D49A36' },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: '#D49A36', marginBottom: 16 },
  confirmDesc: { fontSize: 15, color: '#4E342E', textAlign: 'center', lineHeight: 24, marginBottom: 24, fontWeight: '700' },
  confirmBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' }
});