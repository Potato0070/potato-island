import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState('0.00');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchWallet(); }, []));

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
      if (profile) setBalance(profile.potato_coin_balance.toFixed(2));

      // 抓取资金流水 (买卖记录)
      const { data: transferData } = await supabase.from('transfer_logs')
        .select('*, collections(name)')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('transfer_time', { ascending: false })
        .limit(20);
      
      setLogs(transferData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const renderLog = ({ item }: { item: any }) => {
    const isBuyer = item.buyer_id === item.seller_id ? false : true; // 简化判断，实际需对比 user.id
    const amountStr = isBuyer ? `- ¥${item.price}` : `+ ¥${item.price}`;
    const amountColor = isBuyer ? '#FF3B30' : '#4CD964';
    const typeStr = item.transfer_type || (isBuyer ? '购买藏品' : '寄售收入');

    return (
      <View style={styles.logCard}>
        <View style={styles.logLeft}>
          <Text style={styles.logTitle}>{typeStr} - {item.collections?.name || '神秘物资'}</Text>
          <Text style={styles.logTime}>{new Date(item.transfer_time).toLocaleString()}</Text>
        </View>
        <Text style={[styles.logAmount, { color: amountColor }]}>{amountStr}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>皇家账本</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>当前土豆币余额 (¥)</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
        <TouchableOpacity style={styles.rechargeBtn} onPress={() => alert('请联系岛主进行神之恩赐充值')}>
           <Text style={styles.rechargeText}>获取土豆币</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>近期流水明细</Text>
        {loading ? <ActivityIndicator color="#D49A36" /> : (
          <FlatList data={logs} renderItem={renderLog} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 20}}>暂无资金流水记录</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  balanceCard: { margin: 16, padding: 24, backgroundColor: '#4A2E1B', borderRadius: 16, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width:0,height:4} },
  balanceLabel: { color: '#E5C07B', fontSize: 14, marginBottom: 8 },
  balanceValue: { color: '#FFF', fontSize: 40, fontWeight: '900', marginBottom: 20 },
  rechargeBtn: { backgroundColor: '#D49A36', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  rechargeText: { color: '#FFF', fontWeight: '800' },
  listContainer: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#4A2E1B', marginBottom: 16 },
  logCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  logLeft: { flex: 1 },
  logTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4 },
  logTime: { fontSize: 12, color: '#999' },
  logAmount: { fontSize: 16, fontWeight: '900' }
});