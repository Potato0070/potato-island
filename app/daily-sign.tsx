import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function DailySignScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('last_checkin_date, checkin_streak, potato_cards').eq('id', user.id).single();
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split('T')[0];
      
      let newStreak = 1;
      // 计算连续签到
      if (profile.last_checkin_date) {
         const lastDate = new Date(profile.last_checkin_date);
         const currentDate = new Date(today);
         const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         
         if (diffDays === 1) newStreak = profile.checkin_streak + 1;
         else if (diffDays === 0) return Alert.alert('提示', '今日已朝圣，请明日再来！');
      }

      // 计算今日发放的 Potato 卡数量 (最高7张)
      const rewardCards = newStreak <= 7 ? newStreak : 1; 
      if (newStreak > 7) newStreak = 1; // 7天一周期轮回

      // 🌟 第7天神秘空投逻辑
      let airdropMsg = '';
      let addUniversal = 0;
      let extraPotato = 0;
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
            airdropMsg = `\n\n🎁 【周期大奖】额外空投：${mats[Math.floor(Math.random() * mats.length)]} *1`;
         }
      }

      // 更新数据库
      const { error } = await supabase.from('profiles').update({ 
         last_checkin_date: today,
         checkin_streak: newStreak,
         potato_cards: (profile.potato_cards || 0) + rewardCards + extraPotato,
         universal_cards: (profile.universal_cards || 0) + addUniversal
      }).eq('id', user?.id);

      if (error) throw error;

      Alert.alert('🙏 朝圣成功', `您已连续朝圣 ${newStreak} 天！\n获得：Potato卡 *${rewardCards}${airdropMsg}`, [{text: '感恩岛主', onPress: fetchStatus}]);
    } catch (e: any) { Alert.alert('失败', e.message); } finally { setSigning(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const todayStr = new Date().toISOString().split('T')[0];
  const hasSigned = profile?.last_checkin_date === todayStr;
  const displayStreak = hasSigned ? profile.checkin_streak : (profile?.checkin_streak || 0) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
      </View>

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
            <Text style={{color: '#666'}}>当前持有: </Text>
            <Text style={{color: '#111', fontWeight: '900'}}>Potato卡 x{profile?.potato_cards || 0} | 万能卡 x{profile?.universal_cards || 0}</Text>
         </View>

         <TouchableOpacity style={[styles.signBtn, hasSigned && {backgroundColor: '#CCC'}]} onPress={handleSign} disabled={hasSigned || signing}>
            {signing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.signBtnText}>{hasSigned ? '今日已朝圣' : '虔诚领取'}</Text>}
         </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  container: { flex: 1, backgroundColor: '#FFF' },
  navBar: { paddingHorizontal: 16, height: 44, justifyContent: 'center' },
  navBtn: { width: 80 },
  iconText: { fontSize: 16, color: '#111', fontWeight: '800' },
  content: { flex: 1, alignItems: 'center', padding: 30, paddingTop: 40 },
  emoji: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#4A2E1B', marginBottom: 12 },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  rewardBox: { width: '100%', backgroundColor: '#FDF9F1', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#F5E8D4', borderStyle: 'dashed', marginBottom: 20 },
  rewardLabel: { fontSize: 14, color: '#D49A36', fontWeight: '800' },
  rewardValue: { fontSize: 48, fontWeight: '900', color: '#FF3B30' },
  airdropHint: { color: '#FF3B30', fontSize: 12, fontWeight: '800', marginTop: 12 },
  signBtn: { width: '100%', backgroundColor: '#D49A36', paddingVertical: 18, borderRadius: 30, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  signBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 }
});