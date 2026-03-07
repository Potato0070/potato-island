import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function CommunityScreen() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_featured', { ascending: false }) // 🔥 加精的永远在最上面
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAnnouncements(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  // 🚀 核心逻辑：点赞即燃烧大盘门票！
  const handleLike = async (item: any) => {
    setLikingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Alert.alert('提示', '请先登录！');

      const { error } = await supabase.rpc('like_announcement_and_burn', {
        p_user_id: user.id,
        p_announcement_id: item.id
      });

      if (error) {
         if (error.message.includes('不可重复燃烧')) {
            Alert.alert('提示', '您已经为该公告贡献过燃料啦！');
         } else {
            throw error;
         }
      } else {
         // 乐观更新 UI，无需重新拉取网络
         setAnnouncements(prev => prev.map(ann => 
            ann.id === item.id ? { ...ann, likes_count: (ann.likes_count || 0) + 1 } : ann
         ));
         Alert.alert('🔥 贡献成功', '您的一次点赞，已成功从大盘销毁了 1 张 Potato 卡！通缩因你而加速！');
      }
    } catch (e: any) {
      Alert.alert('点赞失败', e.message);
    } finally {
      setLikingId(null);
    }
  };

  // 格式化时间显示
  const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 60) return `${diffMins || 1} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays < 7) return `${diffDays} 天前`;
      return date.toLocaleDateString();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.is_featured && styles.featuredCard]}>
      {/* 头部信息 */}
      <View style={styles.headerRow}>
        <View style={styles.authorBox}>
           {/* 🔥 智能识别身份头像与红名 */}
           <Image 
              source={{uri: item.author_name === '土豆清道夫' 
                 ? 'https://via.placeholder.com/40/FF3B30/FFF?text=🧹' 
                 : 'https://via.placeholder.com/40/D49A36/FFF?text=KING'}} 
              style={styles.avatar} 
           />
           <View>
              <Text style={[styles.authorName, item.author_name === '土豆清道夫' && {color: '#FF3B30'}]}>
                 {item.author_name || '土豆国王'}
              </Text>
              <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
           </View>
        </View>
        {item.is_featured && (
            <View style={styles.featuredBadge}>
                <Text style={styles.featuredText}>🔥 官方精华</Text>
            </View>
        )}
      </View>

      {/* 文本内容 */}
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content}>{item.content}</Text>

      {/* 纯正 IP 配图 */}
      {item.image_url && (
         <Image source={{ uri: item.image_url }} style={styles.announceImage} />
      )}

      {/* 底部点赞操作区 */}
      <View style={styles.footerRow}>
         <TouchableOpacity 
            style={styles.likeBtn} 
            activeOpacity={0.7} 
            onPress={() => handleLike(item)}
            disabled={likingId === item.id}
         >
            {likingId === item.id ? (
               <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
               <>
                  <Text style={styles.likeIcon}>🤍</Text>
                  <Text style={styles.likeCount}>点赞燃烧 ({item.likes_count || 0})</Text>
               </>
            )}
         </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>王国社区</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#D49A36" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />}
          ListEmptyComponent={<Text style={styles.emptyText}>土豆宇宙暂无新的旨意下发。</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  featuredCard: { borderWidth: 2, borderColor: '#D49A36', backgroundColor: '#FFFCF8' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  authorBox: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  authorName: { fontSize: 15, fontWeight: '800', color: '#4A2E1B' },
  timeText: { fontSize: 12, color: '#999', marginTop: 2 },
  
  featuredBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  featuredText: { color: '#FF3B30', fontSize: 12, fontWeight: '900' },

  title: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 8 },
  content: { fontSize: 15, color: '#555', lineHeight: 24, marginBottom: 16 },
  
  announceImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16, backgroundColor: '#F0F0F0', resizeMode: 'cover' },

  footerRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#F5F5F5', paddingTop: 16 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF9F1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  likeIcon: { fontSize: 16, marginRight: 6 },
  likeCount: { fontSize: 14, fontWeight: '700', color: '#D49A36' },

  emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontSize: 15 }
});