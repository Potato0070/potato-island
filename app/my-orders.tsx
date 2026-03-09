import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function MyOrdersScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('transfer_logs')
        .select(`*, collections(name, image_url), buyer:buyer_id(nickname, is_admin)`)
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('transfer_time', { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    // 黑暗森林逻辑：隐去卖方真实身份
    const sellerName = '土豆岛藏友';
    // 判断买方是否为官方黑洞 (超级管理员)
    const isOfficialBlackhole = item.buyer?.is_admin;
    const buyerName = isOfficialBlackhole ? '🕳️ 官方黑洞回收' : (item.buyer?.nickname || '神秘买家');

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.collections?.image_url }} style={styles.img} />
        <View style={styles.info}>
          <Text style={styles.title}>{item.collections?.name}</Text>
          <Text style={styles.price}>成交价: ¥{item.price}</Text>
          <Text style={styles.time}>{new Date(item.transfer_time).toLocaleString()}</Text>
          <View style={styles.routeBox}>
             <Text style={styles.routeText}>由 [{sellerName}]</Text>
             <Text style={styles.routeText}>流转至 <Text style={isOfficialBlackhole ? {color: '#FF3B30', fontWeight: '900'} : {}}>[{buyerName}]</Text></Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>流转记录</Text>
        <View style={styles.navBtn} />
      </View>
      {loading ? <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} /> : (
        <FlatList data={logs} renderItem={renderItem} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16 }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#4A2E1B' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  img: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F5E8D4', marginRight: 12 },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#4A2E1B', marginBottom: 4 },
  price: { fontSize: 14, color: '#D49A36', fontWeight: '800', marginBottom: 4 },
  time: { fontSize: 12, color: '#999', marginBottom: 8 },
  routeBox: { backgroundColor: '#F9F6F0', padding: 8, borderRadius: 6 },
  routeText: { fontSize: 11, color: '#666' }
});