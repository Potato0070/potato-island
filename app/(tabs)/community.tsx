import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function CommunityScreen() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchAnnouncements();
  }, []));

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      // 拉取系统公告，按置顶和时间排序
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderPost = ({ item }: { item: any }) => {
    const isCleaner = item.author_name === '土豆清道夫'; // 识别自动销毁播报

    return (
      <View style={[styles.card, isCleaner && styles.cardCleaner]}>
        <View style={styles.cardHeader}>
           <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.avatarBox, isCleaner ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#111'}]}>
                 <Text style={{fontSize: 16}}>{isCleaner ? '🚨' : '👑'}</Text>
              </View>
              <View>
                 <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={[styles.authorName, isCleaner && {color: '#FF3B30'}]}>{item.author_name || '王国大喇叭'}</Text>
                    {item.is_featured && <View style={styles.featuredTag}><Text style={styles.featuredTagText}>置顶</Text></View>}
                 </View>
                 <Text style={styles.timeText}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
           </View>
        </View>

        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent}>{item.content}</Text>
        
        {item.image_url && (
           <Image source={{ uri: item.image_url }} style={styles.postImg} />
        )}

        <View style={styles.cardFooter}>
           <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>👍</Text>
              <Text style={styles.actionText}>{item.likes_count || 0}</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionText}>评论</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>↗️</Text>
              <Text style={styles.actionText}>分享</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>王国旨意</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 40}}>暂无任何王国旨意发布</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111' },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardCleaner: { borderWidth: 1, borderColor: '#FFB3B0', backgroundColor: '#FFF5F5' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatarBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  authorName: { fontSize: 15, fontWeight: '900', color: '#111', marginRight: 8 },
  featuredTag: { backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  featuredTagText: { fontSize: 10, fontWeight: '900', color: '#111' },
  timeText: { fontSize: 11, color: '#999', marginTop: 2 },

  postTitle: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 8 },
  postContent: { fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 12 },
  postImg: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16, backgroundColor: '#F0F0F0' },

  cardFooter: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
  actionIcon: { fontSize: 16, marginRight: 6 },
  actionText: { fontSize: 13, color: '#666', fontWeight: '600' }
});