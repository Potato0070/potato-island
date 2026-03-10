import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function MessagesScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 每次切到这个页面都会自动刷新信箱
  useFocusEffect(useCallback(() => {
    fetchMessages();
  }, []));

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 从咱们刚刚建好的 messages 表里抓取属于自己的信件
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      Alert.alert("信箱加载异常", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🌟 点开信件，标记为已读
  const markAsRead = async (id: string, isRead: boolean) => {
    if (isRead) return; // 已经读过的就不浪费性能了

    // 1. 乐观更新 UI：让红点瞬间消失，极其丝滑
    setMessages(messages.map(m => m.id === id ? { ...m, is_read: true } : m));

    try {
      // 2. 后台静默更新数据库
      await supabase.from('messages').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.error('标记已读失败', err);
    }
  };

  // 🌟 极客级时间折叠器：把数据库时间变成 "10分钟前"
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000)); // 差值（秒）
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 172800) return '昨天';
    return date.toLocaleDateString(); // 超过两天的直接显示日期
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, !item.is_read && styles.unreadCard]} 
      onPress={() => markAsRead(item.id, item.is_read)} 
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>王国信箱</Text>
      </View>
      
      {loading ? (
         <ActivityIndicator size="large" color="#D49A36" style={{marginTop: 50}} />
      ) : (
         <FlatList
           data={messages}
           renderItem={renderItem}
           keyExtractor={item => item.id}
           contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
           showsVerticalScrollIndicator={false}
           ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 40}}>信箱空空如也，暂无最新神谕</Text>}
         />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  unreadCard: { backgroundColor: '#FFFDF9', borderColor: '#F5E8D4', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', color: '#4A2E1B' },
  time: { fontSize: 12, color: '#999' },
  content: { fontSize: 14, color: '#666', lineHeight: 20 },
  unreadDot: { position: 'absolute', top: 16, left: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' }
});