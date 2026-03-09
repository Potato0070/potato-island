import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function CommunityScreen() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likingId, setLikingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => { fetchAnnouncements(); }, [])
  );

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_featured', { ascending: false }) // 精华置顶
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleLike = async (id: string) => {
    setLikingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录');
      
      // 🚀 触发原子级点赞燃烧合约
      const { error } = await supabase.rpc('like_announcement_and_burn', { p_user_id: user.id, p_announcement_id: id });
      if (error) {
        if (error.message.includes('已点赞')) Alert.alert('提示', '您已为该旨意贡献过信仰，不可重复点赞！');
        else throw error;
      } else {
        Alert.alert('信仰传达', '点赞成功！全网流通 Potato 卡 -1 🔥');
        fetchAnnouncements(); // 刷新点赞数
      }
    } catch (err: any) { Alert.alert('错误', err.message); } finally { setLikingId(null); }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {item.is_featured && <View style={styles.featuredBadge}><Text style={styles.featuredText}>🔥 超级精华</Text></View>}
      
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      
      {item.image_url && <Image source={{ uri: item.image_url }} style={styles.cardImage} />}
      
      <Text style={styles.content}>{item.content}</Text>
      
      <View style={styles.cardFooter}>
         <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item.id)} disabled={likingId === item.id}>
            {likingId === item.id ? <ActivityIndicator size="small" color="#FF3B30" /> : <Text style={styles.likeIcon}>🤍</Text>}
            <Text style={styles.likeCount}>燃烧点赞 ({item.likes_count || 0})</Text>
         </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.headerTitle}>王国旨意</Text></View>
      {loading ? <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} /> : (
        <FlatList data={announcements} renderItem={renderItem} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  featuredBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12 },
  featuredText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  cardHeader: { marginBottom: 12, marginTop: 8 },
  title: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 6 },
  date: { fontSize: 12, color: '#999' },
  cardImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 16, resizeMode: 'cover' },
  content: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 16 },
  cardFooter: { borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  likeIcon: { fontSize: 16, marginRight: 6 },
  likeCount: { fontSize: 13, color: '#FF3B30', fontWeight: '800' }
});