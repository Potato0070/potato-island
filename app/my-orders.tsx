import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const TABS = ['寄售中', '已买入', '已卖出'];

export default function MyOrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [listData, setListData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { 
    fetchDataByTab(activeTab); 
  }, [activeTab]));

  const fetchDataByTab = async (tab: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (tab === '寄售中') {
        // 查我正在卖的现货
        const { data } = await supabase.from('nfts')
          .select('*, collections(name, image_url)')
          .eq('owner_id', user.id)
          .eq('status', 'listed')
          .order('created_at', { ascending: false });
        setListData(data || []);
      } 
      else if (tab === '已买入') {
        // 查我买到的流水
        const { data } = await supabase.from('transfer_logs')
          .select('*, collections(name, image_url), seller:seller_id(nickname)')
          .eq('buyer_id', user.id)
          .order('transfer_time', { ascending: false });
        setListData(data || []);
      } 
      else if (tab === '已卖出') {
        // 查我卖掉的流水
        const { data } = await supabase.from('transfer_logs')
          .select('*, collections(name, image_url), buyer:buyer_id(nickname)')
          .eq('seller_id', user.id)
          .order('transfer_time', { ascending: false });
        setListData(data || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSelling = activeTab === '寄售中';
    const isBought = activeTab === '已买入';
    
    // 提取统一的数据
    const imgUrl = item.collections?.image_url || 'https://via.placeholder.com/150';
    const name = item.collections?.name || '未知藏品';
    const serial = isSelling ? item.serial_number : item.nft_id?.substring(0,6); // 流水表没有直接存编号，可以用ID截取代替演示
    const price = isSelling ? item.consign_price : item.price;
    const timeStr = isSelling ? '上架中...' : new Date(item.transfer_time).toLocaleString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
           <Text style={styles.timeText}>{timeStr}</Text>
           <Text style={[styles.statusText, isSelling ? {color: '#FF3B30'} : {color: '#4CD964'}]}>
              {isSelling ? '寄售中' : '已成交'}
           </Text>
        </View>

        <View style={styles.cardBody}>
           <Image source={{ uri: imgUrl }} style={styles.img} />
           <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
              <Text style={styles.serial}>#{serial}</Text>
              
              {!isSelling && (
                <Text style={styles.subText}>
                   {isBought ? `卖家: ${item.seller?.nickname || '土豆藏友'}` : `买家: ${item.buyer?.nickname || '土豆藏友'}`}
                </Text>
              )}
           </View>
           <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>{isSelling ? '挂单价' : '成交价'}</Text>
              <Text style={styles.price}>¥ {price}</Text>
           </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>订单管理</Text>
        <View style={styles.navBtn} />
      </View>

      {/* 🌟 顶部状态分类 Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map(tab => (
          <TouchableOpacity 
             key={tab} 
             style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
             onPress={() => setActiveTab(tab)}
          >
             <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={listData} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Text style={{fontSize: 40, marginBottom: 10}}>📭</Text>
               <Text style={{color: '#999'}}>暂无{activeTab}数据</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },

  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 10 },
  tabBtnActive: { backgroundColor: '#E6F0FF' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#0066FF', fontWeight: '900' },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F9F9F9' },
  timeText: { fontSize: 12, color: '#999' },
  statusText: { fontSize: 12, fontWeight: '800' },
  
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  img: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F0F0F0', marginRight: 12 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 4 },
  serial: { fontSize: 12, color: '#666', fontFamily: 'monospace', marginBottom: 4 },
  subText: { fontSize: 11, color: '#888' },
  
  priceBox: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, color: '#999', marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '900', color: '#111' },

  emptyBox: { alignItems: 'center', marginTop: 100 }
});