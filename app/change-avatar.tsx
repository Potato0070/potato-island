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
  const [myNfts, setMyNfts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchMyData();
  }, []));

  const fetchMyData = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 获取当前个人资料
      const { data: profile } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single();
      if (profile) {
        setNickname(profile.nickname || '');
        setAvatarUrl(profile.avatar_url || 'https://via.placeholder.com/100');
      }

      // 2. 🌟 Web3 核心逻辑：拉取自己金库里拥有的藏品 (剔除已烧毁的废料)
      const { data: nfts } = await supabase
        .from('nfts')
        .select('id, serial_number, collections(name, image_url)')
        .eq('owner_id', user.id)
        .neq('status', 'burned')
        .order('created_at', { ascending: false });
      
      setMyNfts(nfts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      
      const { error } = await supabase.from('profiles').update({ 
        nickname: nickname, 
        avatar_url: avatarUrl 
      }).eq('id', user.id);
      
      if (error) throw error;
      Alert.alert('✅ 档案更新成功', '您已佩戴专属数字资产作为身份标识！', [{ text: '确认', onPress: () => router.back() }]);
    } catch (err: any) { 
      Alert.alert('保存失败', err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const renderNftItem = ({ item }: { item: any }) => {
    const isSelected = avatarUrl === item.collections?.image_url;
    
    return (
      <TouchableOpacity 
        style={[styles.nftCard, isSelected && styles.nftCardSelected]} 
        onPress={() => setAvatarUrl(item.collections?.image_url)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.collections?.image_url }} style={styles.nftImg} />
        {isSelected && (
           <View style={styles.selectedBadge}>
              <Text style={{color: '#FFF', fontSize: 10, fontWeight: '900'}}>佩戴中</Text>
           </View>
        )}
      </TouchableOpacity>
    );
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>岛民档案</Text>
        <View style={styles.navBtn} />
      </View>

      <FlatList 
        data={myNfts}
        keyExtractor={item => item.id}
        numColumns={4}
        contentContainerStyle={{ padding: 20 }}
        columnWrapperStyle={{ justifyContent: 'flex-start' }}
        ListHeaderComponent={
          <>
            <View style={{alignItems: 'center', marginBottom: 30}}>
               <Image source={{ uri: avatarUrl }} style={styles.previewAvatar} />
               <Text style={{color: '#666', fontSize: 12, marginTop: 10}}>当前数字身份</Text>
            </View>

            <Text style={styles.label}>岛民尊号</Text>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="请输入您的尊姓大名" placeholderTextColor="#999" />

            <Text style={styles.label}>专属数字资产头像</Text>
            <Text style={styles.subLabel}>* 仅可使用您金库中持有的藏品作为身份标识</Text>
          </>
        }
        renderItem={renderNftItem}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
             <Text style={{fontSize: 40, marginBottom: 10}}>🥔</Text>
             <Text style={{color: '#888'}}>金库空空如也，请先前往大盘获取藏品！</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>保存档案</Text>}
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  
  previewAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EFEFEF', borderWidth: 4, borderColor: '#D49A36', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  label: { width: '100%', fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 8 },
  subLabel: { width: '100%', fontSize: 12, color: '#FF3B30', marginBottom: 16 },
  
  input: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 30, borderWidth: 1, borderColor: '#E0E0E0' },
  
  nftCard: { width: (width - 40) / 4 - 8, aspectRatio: 1, marginRight: 10, marginBottom: 10, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  nftCardSelected: { borderColor: '#D49A36' },
  nftImg: { width: '100%', height: '100%', backgroundColor: '#EEE' },
  selectedBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#D49A36', alignItems: 'center', paddingVertical: 2 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 20 },

  btn: { width: '100%', backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 40, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  btnText: { color: '#FFD700', fontSize: 18, fontWeight: '900', letterSpacing: 2 }
});