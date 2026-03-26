import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');

const QUICK_ACTIONS = [
  { id: 'likes', title: '赞颂与神迹', icon: '👍', bgColor: '#FFE6E6', iconColor: '#FF3B30' },
  { id: 'follows', title: '新增关注', icon: '👤', bgColor: '#E6F0FF', iconColor: '#0066FF' },
  { id: 'comments', title: '评论与留言', icon: '💬', bgColor: '#E6FFE6', iconColor: '#34C759' },
];

export default function MessagesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemMsg, setSystemMsg] = useState<any>(null);
  const [unreadSysCount, setUnreadSysCount] = useState(0);

  // 🌟 核心：引入顶部分类 Tab
  const [activeTab, setActiveTab] = useState<'system' | 'trade' | 'community'>('system');

  const [chatList, setChatList] = useState<any[]>([
    {
      id: 'global_group',
      type: 'group',
      name: '🥔 土豆王国全球总群',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop',
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

  const fetchSystemMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: msgs } = await supabase.from('messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (msgs && msgs.length > 0) {
         setSystemMsg(msgs[0]); 
         setUnreadSysCount(msgs.length); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchSystemMessages();
  }, []));

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchSystemMessages();
  }, []);

  const renderChatItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity style={styles.chatRow} activeOpacity={0.7} onPress={() => {
          Haptics.selectionAsync();
          router.push({ pathname: '/chat', params: { id: item.id, name: item.name } } as any)
      }}>
         <View style={styles.avatarContainer}>
            <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
            {item.unread > 0 && (
               <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
               </View>
            )}
         </View>

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

  // 🌟 空状态组件
  const renderEmptyState = (text: string) => (
      <View style={{alignItems: 'center', marginTop: 80}}>
          <Text style={{fontSize: 60, marginBottom: 16}}>📭</Text>
          <Text style={{color: '#8D6E63', fontWeight: '800', fontSize: 16}}>{text}</Text>
      </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
         <View style={{width: 60}} /> 
         <Text style={styles.navTitle}>信箱</Text>
         <TouchableOpacity style={{width: 60, alignItems: 'flex-end'}} onPress={() => Haptics.selectionAsync()}>
            <Text style={styles.navRightText}>写信</Text>
         </TouchableOpacity>
      </View>

      {/* 🌟 顶部分类 Tab */}
      <View style={styles.tabsContainer}>
          <View style={styles.tabsRow}>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'system' && styles.tabBtnActive]} onPress={() => { Haptics.selectionAsync(); setActiveTab('system'); }}>
                <Text style={[styles.tabText, activeTab === 'system' && styles.tabTextActive]}>系统通知</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'trade' && styles.tabBtnActive]} onPress={() => { Haptics.selectionAsync(); setActiveTab('trade'); }}>
                <Text style={[styles.tabText, activeTab === 'trade' && styles.tabTextActive]}>交易动态</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, activeTab === 'community' && styles.tabBtnActive]} onPress={() => { Haptics.selectionAsync(); setActiveTab('community'); }}>
                <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>社区频道</Text>
            </TouchableOpacity>
          </View>
      </View>

      <ScrollView 
         showsVerticalScrollIndicator={false} 
         contentContainerStyle={{paddingBottom: 100, minHeight: '100%'}}
         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />}
      >
         
         {activeTab === 'system' && (
             <>
                 <View style={styles.quickActionRow}>
                    {QUICK_ACTIONS.map(action => (
                       <TouchableOpacity key={action.id} style={styles.quickActionItem} activeOpacity={0.7} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                          <View style={[styles.quickActionIconBox, { backgroundColor: action.bgColor }]}>
                             <Text style={{fontSize: 28}}>{action.icon}</Text>
                          </View>
                          <Text style={styles.quickActionText}>{action.title}</Text>
                       </TouchableOpacity>
                    ))}
                 </View>

                 <View style={styles.divider} />

                 <TouchableOpacity style={styles.systemRow} activeOpacity={0.7} onPress={() => Haptics.selectionAsync()}>
                    <View style={styles.avatarContainer}>
                       <View style={styles.systemIconBox}>
                          <Text style={{fontSize: 24}}>🔔</Text>
                       </View>
                       {unreadSysCount > 0 && <View style={styles.unreadDot} />}
                    </View>
                    
                    <View style={styles.chatContent}>
                       <View style={styles.chatHeader}>
                          <Text style={styles.systemName}>系统公告与空投</Text>
                          <Text style={styles.chatTime}>
                             {systemMsg ? new Date(systemMsg.created_at).toLocaleDateString() : '刚刚'}
                          </Text>
                       </View>
                       <View style={styles.chatFooter}>
                          {loading ? (
                             <Text style={styles.chatLastMsg}>正在接收中枢旨意...</Text>
                          ) : (
                             <Text style={[styles.chatLastMsg, {color: '#4E342E', fontWeight: '800'}]} numberOfLines={1}>
                                {systemMsg ? `【${systemMsg.title}】${systemMsg.content}` : '暂无最新空投或系统旨意'}
                             </Text>
                          )}
                          <Text style={styles.mutedIcon}>〉</Text>
                       </View>
                    </View>
                 </TouchableOpacity>
                 <View style={styles.thickDivider} />
                 
                 {/* 假设系统消息没有其他列表了 */}
                 {renderEmptyState('没有更多系统通知啦')}
             </>
         )}

         {activeTab === 'community' && (
             <FlatList
                data={chatList}
                renderItem={renderChatItem}
                keyExtractor={item => item.id}
                scrollEnabled={false} 
                ListEmptyComponent={renderEmptyState('你还没有加入任何社区群聊')}
             />
         )}

         {activeTab === 'trade' && (
             // 预留的空状态
             renderEmptyState('暂无与您相关的交易动态')
         )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  navRightText: { fontSize: 15, fontWeight: '800', color: '#D49A36' },

  // 🌟 Tab 样式
  tabsContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#EAE0D5', borderRadius: 20, padding: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16 },
  tabBtnActive: { backgroundColor: '#FFF', shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  tabTextActive: { color: '#D49A36', fontWeight: '900' },

  quickActionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, paddingHorizontal: 10, backgroundColor: '#FDF8F0' },
  quickActionItem: { alignItems: 'center', flex: 1 },
  quickActionIconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 5 },
  quickActionText: { fontSize: 12, color: '#4E342E', fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#EAE0D5', marginHorizontal: 20 },
  thickDivider: { height: 8, backgroundColor: '#F5EFE6' },

  systemRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FDF8F0', alignItems: 'center' },
  systemIconBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#D49A36', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  systemName: { fontSize: 16, fontWeight: '900', color: '#4E342E' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#FDF8F0' },

  chatRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  avatarContainer: { marginRight: 16, position: 'relative' },
  avatarImg: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F5EFE6', borderWidth: 1, borderColor: '#EAE0D5' },
  unreadBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#FF3B30', paddingHorizontal: 5, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF', minWidth: 18 },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  chatContent: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chatName: { fontSize: 15, fontWeight: '900', color: '#4E342E', maxWidth: '70%' },
  chatTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  chatTagText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  chatTime: { fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMsg: { fontSize: 13, color: '#8D6E63', flex: 1, marginRight: 10, fontWeight: '600' },
  mutedIcon: { fontSize: 14, color: '#A1887F' },
});