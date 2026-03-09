import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MessagesScreen() {
  // 模拟一些系统通知，后续可以接通 Supabase 的 notifications 表
  const [messages, setMessages] = useState([
    { id: '1', title: '🎉 交易成功', content: '您挂单的【变异土豆】已被神秘藏友买走，土豆币已入账！', time: '10分钟前', isRead: false },
    { id: '2', title: '🚨 发新提醒', content: '【至尊黑松露土豆泥】即将在今晚20:00准时发售，请准备好资金！', time: '2小时前', isRead: true },
    { id: '3', title: '🎁 签到奖励', content: '您今日的朝圣奖励【纯净水滴】已空投至金库，请前往解冻。', time: '昨天', isRead: true },
  ]);

  const markAsRead = (id: string) => {
    setMessages(messages.map(m => m.id === id ? { ...m, isRead: true } : m));
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={[styles.card, !item.isRead && styles.unreadCard]} onPress={() => markAsRead(item.id)} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>王国信箱</Text>
      </View>
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
      />
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