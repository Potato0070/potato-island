import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

// 🌟 顶部三大快捷入口数据
const QUICK_ACTIONS = [
  { id: 'likes', title: '赞颂与神迹', icon: '👍', bgColor: '#FFE6E6', iconColor: '#FF3B30' },
  { id: 'follows', title: '新增关注', icon: '👤', bgColor: '#E6F0FF', iconColor: '#0066FF' },
  { id: 'comments', title: '评论与留言', icon: '💬', bgColor: '#E6FFE6', iconColor: '#34C759' },
];

export default function MessagesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [systemMsg, setSystemMsg] = useState<any>(null);
  const [unreadSysCount, setUnreadSysCount] = useState(0);

  // 🌟 模拟的群聊和私聊列表（后续可接数据库）
  const [chatList, setChatList] = useState<any[]>([
    {
      id: 'global_group',
      type: 'group',
      name: '🥔 土豆王国全球总群',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop', // 换成酷炫的宇宙图
      lastMsg: '[全岛广播] 欢迎来到土豆宇宙，一起努力吧！',
      time: '刚刚',
      unread: 12,
      tag: '官方社区',
      tagColor: '#0066FF',
      isMuted: false
    },
    {
      id: 'trade_group',
      type: 'group',
      name: '🛒 现货与场外交易群',
      avatar: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=200&auto=format&fit=crop',
      lastMsg: '[3条] 刚刚有人扫货了，快去看大盘！',
      time: '下午 1:22',
      unread: 0,
      tag: '交易',
      tagColor: '#34C759',
      isMuted: true
    }
  ]);

  useFocusEffect(useCallback(() => {
    fetchSystemMessages();
  }, []));

  const fetchSystemMessages = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 抓取该用户的系统信件（空投、补偿、警告等）
      const { data: msgs } = await supabase.from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (msgs && msgs.length > 0) {
         setSystemMsg(msgs[0]); // 取最新一条作为预览
         // 假设如果没有已读字段，我们临时算作全未读，或者固定显示红点
         setUnreadSysCount(msgs.length); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderChatItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity style={styles.chatRow} activeOpacity={0.7} onPress={() => {
          // 跳转到具体聊天页面，预留参数
          // router.push({ pathname: '/chat', params: { id: item.id, name: item.name } })
      }}>
         {/* 头像区 */}
         <View style={styles.avatarContainer}>
            <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
            {item.unread > 0 && (
               <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
               </View>
            )}
         </View>

         {/* 消息内容区 */}
         <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
               <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                  <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
                  {item.tag && (
                     <View style={[styles.chatTag, {backgroundColor: item.tagColor}]}>
                        <Text style={styles.chatTagText}>{item.tag}</Text>
                     </View>
                  )}
               </View>
               <Text style={styles.chatTime}>{item.time}</Text>
            </View>
            <View style={styles.chatFooter}>
               <Text style={styles.chatLastMsg} numberOfLines={1}>{item.lastMsg}</Text>
               {item.isMuted && <Text style={styles.mutedIcon}>🔕</Text>}
            </View>
         </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 🌟 顶部导航栏 */}
      <View style={styles.navBar}>
         <View style={{width: 60}} /> 
         <Text style={styles.navTitle}>消息</Text>
         <TouchableOpacity style={{width: 60, alignItems: 'flex-end'}}>
            <Text style={styles.navRightText}>去聊天</Text>
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
         
         {/* 🌟 三大快捷金刚区 */}
         <View style={styles.quickActionRow}>
            {QUICK_ACTIONS.map(action => (
               <TouchableOpacity key={action.id} style={styles.quickActionItem} activeOpacity={0.7}>
                  <View style={[styles.quickActionIconBox, { backgroundColor: action.bgColor }]}>
                     <Text style={{fontSize: 28}}>{action.icon}</Text>
                  </View>
                  <Text style={styles.quickActionText}>{action.title}</Text>
               </TouchableOpacity>
            ))}
         </View>

         <View style={styles.divider} />

         {/* 🌟 系统通知专属行 (最高优) */}
         <TouchableOpacity style={styles.systemRow} activeOpacity={0.7} onPress={() => {
             // 预留跳转到系统消息列表页
             // router.push('/system-messages');
         }}>
            <View style={styles.avatarContainer}>
               <View style={styles.systemIconBox}>
                  <Text style={{fontSize: 24}}>🔔</Text>
               </View>
               {unreadSysCount > 0 && <View style={styles.unreadDot} />}
            </View>
            
            <View style={styles.chatContent}>
               <View style={styles.chatHeader}>
                  <Text style={styles.systemName}>系统通知</Text>
                  <Text style={styles.chatTime}>
                     {systemMsg ? new Date(systemMsg.created_at).toLocaleDateString() : '刚刚'}
                  </Text>
               </View>
               <View style={styles.chatFooter}>
                  {loading ? (
                     <Text style={styles.chatLastMsg}>正在同步大盘数据...</Text>
                  ) : (
                     <Text style={[styles.chatLastMsg, {color: '#111', fontWeight: '600'}]} numberOfLines={1}>
                        {systemMsg ? `【${systemMsg.title}】${systemMsg.content}` : '暂无最新空投或系统旨意'}
                     </Text>
                  )}
                  <Text style={styles.mutedIcon}>〉</Text>
               </View>
            </View>
         </TouchableOpacity>

         <View style={styles.thickDivider} />

         {/* 🌟 实时聊天列表区 */}
         <FlatList
            data={chatList}
            renderItem={renderChatItem}
            keyExtractor={item => item.id}
            scrollEnabled={false} // 因为在 ScrollView 里面，关闭自己的滚动
         />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FFF' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  navRightText: { fontSize: 15, fontWeight: '700', color: '#0066FF' },

  quickActionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, paddingHorizontal: 10, backgroundColor: '#FFF' },
  quickActionItem: { alignItems: 'center', flex: 1 },
  quickActionIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionText: { fontSize: 13, color: '#333', fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 20 },
  thickDivider: { height: 8, backgroundColor: '#F5F6F8' },

  // 系统通知样式
  systemRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFF', alignItems: 'center' },
  systemIconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
  systemName: { fontSize: 17, fontWeight: '900', color: '#111' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#FFF' },

  // 聊天列表样式
  chatRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F5F6F8' },
  avatarContainer: { marginRight: 16, position: 'relative' },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F0F0F0' },
  unreadBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#FF3B30', paddingHorizontal: 5, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF', minWidth: 18 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  chatContent: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chatName: { fontSize: 16, fontWeight: '800', color: '#111', maxWidth: '75%' },
  chatTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  chatTagText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  chatTime: { fontSize: 12, color: '#999' },
  
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMsg: { fontSize: 14, color: '#888', flex: 1, marginRight: 10 },
  mutedIcon: { fontSize: 14, color: '#CCC' },
});