import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function ExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, transfer_cards, batch_cards').eq('id', user.id).single();
      setProfile(data);
    }
  };

  // 🌟 核心修复：绝对安全的余额校验与二次确认拦截
  const handleExchange = (type: 'transfer' | 'batch', cost: number) => {
    // 1. 防御性拦截：确保数据加载完成
    if (!profile) {
       Alert.alert('提示', '数据加载中，请稍后再试');
       return; 
    }
    
    // 2. 强转为数字，如果没有数据则默认为 0，彻底封死 undefined 漏洞
    const currentCards = Number(profile.potato_cards) || 0;
    
    // 3. 拦截余额不足，并在执行后立刻 return 阻断后续代码
    if (currentCards < cost) {
       Alert.alert('余额不足', `您需要 ${cost} 张 Potato卡 才能兑换该特权！(当前仅持有 ${currentCards} 张)`);
       return;
    }
    
    // 4. 严苛的二次确认弹窗
    Alert.alert(
       '🔥 确认献祭', 
       `将永久燃烧 ${cost} 张 Potato卡 兑换此特权，是否继续？`,
       [
          { text: '取消', style: 'cancel' },
          { text: '确认燃烧', style: 'destructive', onPress: () => executeExchange(type, cost) }
       ]
    );
  };

  const executeExchange = async (type: 'transfer' | 'batch', cost: number) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 组装要更新的数据字典
      const updates: any = { potato_cards: profile.potato_cards - cost };
      if (type === 'transfer') updates.transfer_cards = profile.transfer_cards + 1;
      if (type === 'batch') updates.batch_cards = profile.batch_cards + 1;

      // 执行数据库更新
      const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
      if (error) throw error;

      // 🌟 成功后弹窗提示
      Alert.alert('✅ 兑换成功', '特权卡已发放至您的账户！');
      
      // 刷新本地余额数据，UI会自动更新
      fetchProfile();
    } catch (err: any) { 
      Alert.alert('失败', err.message); 
    } finally { 
      setProcessing(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>特权兑换</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>基础材料熔炉</Text>
            <Text style={styles.headerSub}>当前持有 Potato卡: <Text style={{color:'#FF3B30', fontWeight:'900', fontSize: 16}}>{profile?.potato_cards || 0}</Text> 张</Text>
         </View>

         {/* 🎁 资产转赠卡兑换模块 */}
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
               <TouchableOpacity style={styles.exchangeBtn} onPress={() => handleExchange('transfer', 3)} disabled={processing}>
                  <Text style={styles.exchangeBtnText}>燃烧 3 张 Potato卡</Text>
               </TouchableOpacity>
            </View>
         </View>

         {/* 📦 批量寄售权益卡兑换模块 */}
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
               <TouchableOpacity style={[styles.exchangeBtn, {backgroundColor: '#111'}]} onPress={() => handleExchange('batch', 10)} disabled={processing}>
                  <Text style={[styles.exchangeBtnText, {color: '#FFD700'}]}>燃烧 10 张 Potato卡</Text>
               </TouchableOpacity>
            </View>
         </View>
      </ScrollView>
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
});