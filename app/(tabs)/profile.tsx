import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: profData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profData);

      // 按合集统计闲置的藏品数量
      const { data: nfts } = await supabase.from('nfts').select('collection_id, status, collections(id, name, image_url)')
        .eq('owner_id', user.id).neq('status', 'burned');
      
      if (nfts) {
        const counts: Record<string, any> = {};
        nfts.forEach(nft => {
          const col = Array.isArray(nft.collections) ? nft.collections[0] : nft.collections;
          if (!col) return;
          if (!counts[col.id]) counts[col.id] = { id: col.id, name: col.name, image_url: col.image_url, count: 0, idleCount: 0 };
          counts[col.id].count += 1;
          if (nft.status === 'idle') counts[col.id].idleCount += 1;
        });
        setCollections(Object.values(counts));
      }
    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchProfileData(); }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfileData(); }} />}>
        {/* 顶部面板 */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/100' }} style={styles.avatar} />
            <View>
              <Text style={styles.nickname}>{profile?.nickname || '土豆岛民'}</Text>
              <Text style={styles.email}>{profile?.email}</Text>
            </View>
          </View>
          <View style={styles.walletBox}>
            <Text style={styles.walletLabel}>土豆币余额</Text>
            <Text style={styles.walletBalance}>¥ {profile?.potato_coin_balance?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        {/* 管理员专属通道 */}
        {profile?.is_admin && (
           <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin-panel')}>
              <Text style={styles.adminBtnText}>👑 进入创世中枢控制台</Text>
           </TouchableOpacity>
        )}

        {/* 藏品归纳区 */}
        <View style={styles.collectionSection}>
          <Text style={styles.sectionTitle}>我的金库</Text>
          <View style={styles.grid}>
            {collections.map(col => (
              <TouchableOpacity key={col.id} style={styles.colCard} onPress={() => router.push({pathname: '/my-collection-list', params: {collectionId: col.id, collectionName: col.name}})}>
                <Image source={{ uri: col.image_url }} style={styles.colImg} />
                <View style={styles.colInfo}>
                  <Text style={styles.colName} numberOfLines={1}>{col.name}</Text>
                  <Text style={styles.colCount}>持有: {col.count} (可用: {col.idleCount})</Text>
                </View>
              </TouchableOpacity>
            ))}
            {collections.length === 0 && <Text style={{color: '#999', margin: 20}}>金库空空如也，去集市扫货吧！</Text>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 20, backgroundColor: '#FFF', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16, backgroundColor: '#EEE' },
  nickname: { fontSize: 20, fontWeight: '900', color: '#4A2E1B' },
  email: { fontSize: 12, color: '#888', marginTop: 4 },
  walletBox: { backgroundColor: '#FDF9F1', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F5E8D4' },
  walletLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  walletBalance: { fontSize: 28, fontWeight: '900', color: '#D49A36' },
  adminBtn: { margin: 16, backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center' },
  adminBtnText: { color: '#FFD700', fontSize: 14, fontWeight: '800' },
  collectionSection: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  colCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  colImg: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#F5E8D4' },
  colInfo: { marginTop: 8, alignItems: 'center' },
  colName: { fontSize: 14, fontWeight: '800', color: '#4A2E1B' },
  colCount: { fontSize: 11, color: '#888', marginTop: 4 }
});