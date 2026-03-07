import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface AvatarCollection {
  id: string;
  name: string;
  image_url: string;
  isOwned: boolean;
}

export default function ChangeAvatarScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<AvatarCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAvatarData();
  }, []);

  const fetchAvatarData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 获取当前头像
      const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
      if (profile) setCurrentAvatar(profile.avatar_url);

      // 2. 获取大盘所有的合集
      const { data: allCols, error: colError } = await supabase.from('collections').select('id, name, image_url');
      if (colError) throw colError;

      // 3. 获取该玩家当前拥有的所有 NFT 的合集 ID
      const { data: myNfts, error: nftError } = await supabase.from('nfts').select('collection_id').eq('owner_id', user.id);
      if (nftError) throw nftError;

      const ownedIds = new Set(myNfts?.map(n => n.collection_id));

      // 4. 融合数据：标记哪些是拥有的，哪些是未拥有的
      const formattedData = (allCols as any[]).map(c => ({
        ...c,
        isOwned: ownedIds.has(c.id)
      }));

      setCollections(formattedData);
    } catch (err: any) {
      Alert.alert('获取数据失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = async (item: AvatarCollection) => {
    if (!item.isOwned) return; // 没拥有的点不了，只能点去购买
    
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      const { error } = await supabase.from('profiles').update({ avatar_url: item.image_url }).eq('id', user.id);
      if (error) throw error;

      setCurrentAvatar(item.image_url);
      Alert.alert('🎉 更换成功', '您的专属认证头像已更新！', [
        { text: '返回金库', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('更新失败', err.message);
    } finally {
      setUpdating(false);
    }
  };

  const renderItem = ({ item }: { item: AvatarCollection }) => {
    const isSelected = currentAvatar === item.image_url;
    const coverImage = item.image_url || `https://via.placeholder.com/300/1A1A1A/FFD700?text=NFT`;

    return (
      <View style={[styles.card, isSelected && styles.cardSelected]}>
        <Image source={{ uri: coverImage }} style={styles.cardImage} />
        
        {/* 已经拥有且被选中 */}
        {isSelected && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        )}

        {/* ⚠️ 核心：未拥有时的黑膜与“去购买”按钮 */}
        {!item.isOwned && (
          <View style={styles.unownedOverlay}>
            <Text style={styles.unownedText}>暂未拥有此藏品</Text>
            <TouchableOpacity 
              style={styles.buyBtn} 
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
            >
              <Text style={styles.buyBtnText}>去购买</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        </View>

        {/* 拥有的藏品可以点击更换 */}
        {item.isOwned && (
          <TouchableOpacity 
            style={styles.touchArea} 
            onPress={() => handleSelectAvatar(item)} 
            disabled={updating}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.iconText}>〈</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>更换头像</Text>
        <View style={styles.navBtn}><Text style={{fontSize: 12, color: '#666'}}>全部社区 ▾</Text></View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0066FF" /></View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.rowWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF', marginBottom: 10 },
  navBtn: { minWidth: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  
  listContainer: { paddingHorizontal: 16, paddingBottom: 50 },
  rowWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  
  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderColor: '#0066FF' },
  cardImage: { width: '100%', height: CARD_WIDTH, resizeMode: 'cover' },
  
  touchArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  checkIcon: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  unownedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: CARD_WIDTH, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  unownedText: { color: '#FFF', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  buyBtn: { backgroundColor: '#0066FF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  buyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  cardInfo: { padding: 12, alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
});