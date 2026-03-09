import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/png?seed=Potato1',
  'https://api.dicebear.com/7.x/bottts/png?seed=Potato2',
  'https://api.dicebear.com/7.x/bottts/png?seed=Potato3',
  'https://api.dicebear.com/7.x/bottts/png?seed=Potato4',
];

export default function ChangeAvatarScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) {
              setNickname(data.nickname || '');
              setAvatarUrl(data.avatar_url || DEFAULT_AVATARS[0]);
            }
            setFetching(false);
          });
      }
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      const { error } = await supabase.from('profiles').update({ nickname, avatar_url: avatarUrl }).eq('id', user.id);
      if (error) throw error;
      Alert.alert('✅ 保存成功', '您的岛民档案已更新！', [{ text: '确认', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('保存失败', err.message); } finally { setLoading(false); }
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>岛民档案</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={{padding: 20, alignItems: 'center'}}>
        <Image source={{ uri: avatarUrl }} style={styles.previewAvatar} />
        
        <Text style={styles.label}>选择头像</Text>
        <View style={styles.avatarGrid}>
          {DEFAULT_AVATARS.map((url, i) => (
            <TouchableOpacity key={i} onPress={() => setAvatarUrl(url)} style={[styles.avatarOption, avatarUrl === url && styles.avatarSelected]}>
              <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>岛民昵称</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="请输入您的尊姓大名" />

        <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>保存档案</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  previewAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF', marginBottom: 30, borderWidth: 4, borderColor: '#D49A36' },
  label: { width: '100%', fontSize: 14, fontWeight: '800', color: '#4A2E1B', marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 30 },
  avatarOption: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EFEFEF', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: '#D49A36' },
  input: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 40, borderWidth: 1, borderColor: '#E0E0E0' },
  btn: { width: '100%', backgroundColor: '#D49A36', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});