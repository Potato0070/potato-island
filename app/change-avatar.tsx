import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function ChangeAvatarScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uniqueNfts, setUniqueNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useFocusEffect(useCallback(() => { fetchMyData(); }, []));

  const fetchMyData = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single();
      if (profile) {
        setNickname(profile.nickname || '');
        setAvatarUrl(profile.avatar_url || 'https://via.placeholder.com/100');
      }

      // 🌟 核心优化：拉取藏品并在前端按照 collection_id 进行去重
      const { data: nfts } = await supabase.from('nfts').select('collection_id, collections(name, image_url)').eq('owner_id', user.id).neq('status', 'burned');
      
      if (nfts) {
         const uniqueMap = new Map();
         nfts.forEach(nft => {
            if (!uniqueMap.has(nft.collection_id)) {
               uniqueMap.set(nft.collection_id, { id: nft.collection_id, image_url: nft.collections?.image_url, name: nft.collections?.name });
            }
         });
         setUniqueNfts(Array.from(uniqueMap.values()));
      }
    } catch (err) { console.error(err); } finally { setFetching(false); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('profiles').update({ nickname, avatar_url: avatarUrl }).eq('id', user?.id);
      Alert.alert('✅ 保存成功', '档案已更新！', [{ text: '确认', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('保存失败', err.message); } finally { setLoading(false); }
  };

  // 🌟 核心优化：退出登录
  const handleLogout = async () => {
     Alert.alert('退出登录', '确定要退出土豆岛吗？', [
        { text: '取消', style: 'cancel' },
        { text: '残忍退出', style: 'destructive', onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login' as any);
        }}
     ]);
  };

  const renderNftItem = ({ item }: { item: any }) => {
    const isSelected = avatarUrl === item.image_url;
    return (
      <TouchableOpacity style={[styles.nftCard, isSelected && styles.nftCardSelected]} onPress={() => setAvatarUrl(item.image_url)} activeOpacity={0.8}>
        <Image source={{ uri: item.image_url }} style={styles.nftImg} />
        {isSelected && <View style={styles.selectedBadge}><Text style={{color: '#FFF', fontSize: 10, fontWeight: '900'}}>佩戴中</Text></View>}
      </TouchableOpacity>
    );
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator color="#111" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>系统设置</Text>
        <View style={styles.navBtn} />
      </View>

      <FlatList 
        data={uniqueNfts}
        keyExtractor={item => item.id}
        numColumns={4}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <>
            <View style={{alignItems: 'center', marginBottom: 30}}>
               <Image source={{ uri: avatarUrl }} style={styles.previewAvatar} />
            </View>
            <Text style={styles.label}>岛民尊号</Text>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />
            <Text style={styles.label}>选择身份标识 (已去重)</Text>
          </>
        }
        renderItem={renderNftItem}
        ListFooterComponent={
          <View style={{marginTop: 40}}>
            <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>保存修改</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>退出登录</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// 样式同上省略，保持代码整洁
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  previewAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFEFEF', borderWidth: 4, borderColor: '#111' },
  label: { width: '100%', fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 12 },
  input: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 30, borderWidth: 1, borderColor: '#E0E0E0' },
  nftCard: { width: (width - 40) / 4 - 8, aspectRatio: 1, marginRight: 10, marginBottom: 10, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  nftCardSelected: { borderColor: '#111' },
  nftImg: { width: '100%', height: '100%', backgroundColor: '#EEE' },
  selectedBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#111', alignItems: 'center', paddingVertical: 2 },
  btn: { width: '100%', backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  logoutBtn: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '900' }
});