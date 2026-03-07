import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function MyCollectionListScreen() {
  const router = useRouter();
  const { collectionId, collectionName } = useLocalSearchParams();
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 每次进入该页面时自动刷新数据
  useFocusEffect(
    useCallback(() => {
      if (collectionId) fetchNfts();
    }, [collectionId])
  );

  const fetchNfts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('nfts')
        .select(`id, serial_number, status, collections(name, image_url)`)
        .eq('owner_id', user.id)
        .eq('collection_id', collectionId)
        // 🚀 核心修复：彻底过滤掉化为灰烬（burned）的藏品！
        .neq('status', 'burned') 
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNfts(data || []);
    } catch (err) {
      console.error('获取藏品列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // 处理关联查询返回的数据格式（可能是数组或对象）
    const col = Array.isArray(item.collections) ? item.collections[0] : item.collections;
    const coverImg = col?.image_url || 'https://via.placeholder.com/150';
    
    // 模拟类似 OD013596 的前缀，加上原本的编号（补齐6位）
    const serialStr = `OD013596#${String(item.serial_number).padStart(6, '0')}`;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/my-nft-detail', params: { id: item.id } })}
      >
        {/* 左上角“持有中”黑色半透明标签 */}
        <View style={styles.badge}><Text style={styles.badgeText}>持有中</Text></View>
        
        {/* 藏品图片区域 */}
        <View style={styles.imgContainer}>
           <Image source={{ uri: coverImg }} style={styles.img} />
        </View>
        
        {/* 底部信息区域 */}
        <View style={styles.info}>
           <Text style={styles.title} numberOfLines={1}>{col?.name}</Text>
           <View style={styles.serialRow}>
             <Text style={{ fontSize: 10, marginRight: 4 }}>🧬</Text>
             <Text style={styles.serial} numberOfLines={1}>{serialStr}</Text>
           </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.iconText}>〈</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{collectionName || '藏品列表'}</Text>
        <TouchableOpacity style={styles.navBtnRight}>
          <Text style={styles.batchText}>批量寄售</Text>
        </TouchableOpacity>
      </View>

      {/* 列表渲染区 */}
      {loading ? (
         <ActivityIndicator size="large" color="#0066FF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={nfts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.rowWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>
              该系列暂无可用藏品
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  navBtnRight: { height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  batchText: { fontSize: 14, color: '#0066FF', fontWeight: '600' },
  
  listContainer: { padding: 16, paddingBottom: 100 },
  rowWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  
  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, padding: 8 },
  badge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  imgContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#F5E4C3', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  info: { alignItems: 'center', paddingBottom: 4 },
  title: { fontSize: 14, fontWeight: '800', color: '#6B4226', marginBottom: 4 },
  serialRow: { flexDirection: 'row', alignItems: 'center' },
  serial: { fontSize: 10, color: '#111', fontWeight: '600', fontFamily: 'monospace' },
});