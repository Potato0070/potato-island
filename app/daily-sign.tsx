import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function DailySignScreen() {
  const router = useRouter();
  const [hasSigned, setHasSigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    checkSignStatus();
  }, []);

  const checkSignStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('last_checkin_date').eq('id', user.id).single();
      const today = new Date().toISOString().split('T')[0]; // 获取当天的 YYYY-MM-DD
      
      if (data?.last_checkin_date === today) {
        setHasSigned(true);
      }
    }
    setLoading(false);
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split('T')[0];
      
      // 更新签到日期，并奖励 10.00 土豆币
      const { error } = await supabase.rpc('execute_daily_sign', { p_user_id: user?.id, p_today: today });
      
      // 注意：如果不想写 RPC，也可以直接用 update (这里为了演示简单直接 update)
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      await supabase.from('profiles').update({ 
         last_checkin_date: today,
         potato_coin_balance: (profile?.potato_coin_balance || 0) + 10.00 // 每天送10元
      }).eq('id', user?.id);

      setHasSigned(true);
      Alert.alert('🎉 朝圣成功', '伟大的岛主感受到了您的虔诚，已将 ¥10.00 土豆币汇入您的金库！');
    } catch (e: any) {
      Alert.alert('失败', e.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
      </View>

      <View style={styles.content}>
         <Text style={styles.emoji}>🥔</Text>
         <Text style={styles.title}>每日朝圣</Text>
         <Text style={styles.subtitle}>每日向土豆王国宣誓忠诚，即可获得土豆币空投奖励，用于在集市中交易或抵扣手续费。</Text>

         <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>今日可领取</Text>
            <Text style={styles.rewardValue}>¥ 10.00</Text>
         </View>

         <TouchableOpacity 
            style={[styles.signBtn, hasSigned && {backgroundColor: '#CCC', shadowOpacity: 0}]} 
            onPress={handleSign} 
            disabled={hasSigned || signing}
         >
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
  
  content: { flex: 1, alignItems: 'center', padding: 30, paddingTop: 60 },
  emoji: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#4A2E1B', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 40 },

  rewardBox: { width: '100%', backgroundColor: '#FDF9F1', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#F5E8D4', borderStyle: 'dashed', marginBottom: 40 },
  rewardLabel: { fontSize: 14, color: '#D49A36', fontWeight: '800', marginBottom: 10 },
  rewardValue: { fontSize: 40, fontWeight: '900', color: '#FF3B30' },

  signBtn: { width: '100%', backgroundColor: '#D49A36', paddingVertical: 18, borderRadius: 30, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: {width: 0, height: 5} },
  signBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 }
});