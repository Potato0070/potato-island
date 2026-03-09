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
      
      // 🌟 强关联 collections 表拉取名字和图片，彻底解决丢图问题！
      const { data, error } = await supabase.from('transfer_logs')
        .select(`*, collections(name, image_url), buyer:buyer_id(nickname, is_admin)`)
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('transfer_time', { ascending: false });
        
      if (error) throw error;
      setLogs(data || []);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // 黑暗森林逻辑：隐去卖方真实身份
    const sellerName = '土豆岛藏友';
    // 官方黑洞护盘逻辑：如果是超管收货，直接打上红色警示！
    const isOfficialBlackhole = item.buyer?.is_admin;
    const buyerName = isOfficialBlackhole ? '🕳️ 官方黑洞回收' : (item.buyer?.nickname || '神秘买家');

    return (
      <View style={styles.card}>
        {/* 图片从 collections 中安全拉取 */}
        <Image source={{ uri: item.collections?.image_url || 'https://via.placeholder.com/150' }} style={styles.img} />
        
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.collections?.name || '未知基因'}</Text>
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
        <Text style={styles.navTitle}>流转溯源</Text>
        <View style={styles.navBtn} />
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={logs} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={{ padding: 16 }} 
          ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 30}}>暂无任何流转记录</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#4A2E1B' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  img: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F5E8D4', marginRight: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900', color: '#4A2E1B', marginBottom: 4 },
  price: { fontSize: 15, color: '#D49A36', fontWeight: '900', marginBottom: 4 },
  time: { fontSize: 11, color: '#999', marginBottom: 8 },
  
  routeBox: { backgroundColor: '#FDF9F1', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#F5E8D4' },
  routeText: { fontSize: 11, color: '#666', marginBottom: 2 }
});