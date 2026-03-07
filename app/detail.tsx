import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../supabase';

// 修复点 2：在同级 app 目录下找 components 文件夹
import BuyOrderModal from './components/BuyOrderModal';

export default function DetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [isBuyModalVisible, setBuyModalVisible] = useState(false);

  const fetchDetailData = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      const { data: colData, error: colError } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .single();
        
      if (colError) throw colError;

      const { data: floorData } = await supabase
        .from('nfts')
        .select('price')
        .eq('collection_id', id)
        .eq('status', 'listed')
        .order('price', { ascending: true })
        .limit(1);

      const floorPrice = floorData && floorData.length > 0 ? floorData[0].price : null;

      setCollectionData({
        ...colData,
        floor_price: floorPrice,
        max_price: colData.max_price || 9999 // 防止数据库没这字段时报错
      });

    } catch (e) {
      console.error('获取详情失败:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetailData();
  }, [fetchDetailData]);

  if (loading || !collectionData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D49A36" />
        <Text style={{ marginTop: 10, color: '#999' }}>正在连接土豆宇宙节点...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>〈 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>藏品详情</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: collectionData.image_url }} style={styles.mainImage} resizeMode="cover" />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{collectionData.name}</Text>
          <Text style={styles.description}>
            {collectionData.description || '这件神秘的藏品尚未留下太多传说...'}
          </Text>

          <View style={styles.statsBoard}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>当前地板价</Text>
              <Text style={styles.statValue}>
                {collectionData.floor_price ? `¥${collectionData.floor_price}` : '暂无挂售'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>最高限价</Text>
              <Text style={styles.statValue}>¥{collectionData.max_price}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.buyBtn} 
          onPress={() => setBuyModalVisible(true)}
        >
          <Text style={styles.buyBtnText}>发布求购</Text>
        </TouchableOpacity>
      </View>

      {/* 弹窗组件调用 */}
      <Modal
        visible={isBuyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBuyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setBuyModalVisible(false)} />
          
          <View style={styles.modalContent}>
             <View style={styles.modalDragIndicator} />
             <BuyOrderModal 
                currentUser={currentUser}
                collectionData={collectionData}
                onClose={() => setBuyModalVisible(false)}
                onRefresh={fetchDetailData} 
             />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { padding: 8, marginLeft: -8 },
  backText: { fontSize: 16, color: '#4A2E1B', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#4A2E1B' },
  scrollContent: { paddingBottom: 100 }, 
  imageContainer: { padding: 16, alignItems: 'center' },
  mainImage: { width: '100%', aspectRatio: 1, borderRadius: 24, backgroundColor: '#EEE' },
  infoSection: { paddingHorizontal: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginBottom: 8 },
  description: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 24 },
  statsBoard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#4A2E1B' },
  statDivider: { width: 1, backgroundColor: '#EEE', marginHorizontal: 15 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 35, borderTopWidth: 1, borderTopColor: '#EEE', elevation: 10 },
  buyBtn: { backgroundColor: '#1A1A1A', borderRadius: 30, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  buyBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { flex: 1 },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, paddingTop: 10 },
  modalDragIndicator: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 3, alignSelf: 'center', marginBottom: 15 }
});