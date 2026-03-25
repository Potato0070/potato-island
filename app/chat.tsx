import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, ImageBackground, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

// 🌟 这里我为你预设了一个尊贵的黑金大理石纹理背景，直接作为网络图片引用
const CHAT_BACKGROUND_URL = 'https://images.unsplash.com/photo-1557187666-4fd70cf76254?q=80&w=600&auto=format&fit=crop&blur=10';

export default function ChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [myUserId, setMyUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false); // 🌟 控制右上角更多菜单

  useEffect(() => {
    initChat();
    const channel = supabase
      .channel(`chat_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` },
        async (payload) => {
          if (payload.new.user_id !== myUserId) {
             const { data } = await supabase.from('group_messages').select('*, profiles(nickname)').eq('id', payload.new.id).single();
             if (data) {
                setMessages(prev => [data, ...prev]);
             }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, myUserId]);

  const initChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);

      const { data, error } = await supabase
        .from('group_messages')
        .select('*, profiles(nickname)')
        .eq('group_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !myUserId) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const optimisticMsg = {
         id: Math.random().toString(),
         user_id: myUserId,
         content: textToSend,
         created_at: new Date().toISOString(),
         profiles: { nickname: '我' }
      };
      setMessages(prev => [optimisticMsg, ...prev]);

      await supabase.from('group_messages').insert({
         group_id: id,
         user_id: myUserId,
         content: textToSend
      });
    } catch (e: any) {
      console.error('发送失败:', e.message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.user_id === myUserId;
    // 🌟 参考参考图，对方消息带头像，我方不带
    const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={{fontSize: 16, color: '#111'}}>🥔</Text>
          </View>
        )}
        <View style={[styles.msgContent, isMe ? styles.msgContentMe : styles.msgContentOther]}>
          {!isMe && <Text style={styles.nickname}>{item.profiles?.nickname || '岛民'}</Text>}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>{item.content}</Text>
          </View>
          <Text style={[styles.timeText, isMe ? {textAlign: 'right'} : {textAlign: 'left'}]}>{timeStr}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 🌟 质感导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{name || '土豆全球群'}</Text>
        {/* 🌟 右上角三大点 (设置入口) */}
        <TouchableOpacity style={styles.navBtn} onPress={() => setShowMoreModal(true)}>
          <Text style={styles.moreIcon}>⋮⋮</Text> 
        </TouchableOpacity>
      </View>

      {/* 🌟 这里是核心：带有质感纹理的背景图覆盖整个 FlatList */}
      <ImageBackground source={{ uri: CHAT_BACKGROUND_URL }} style={{ flex: 1 }} resizeMode="cover">
        {loading ? (
           <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>
        ) : (
           <FlatList
             ref={flatListRef}
             data={messages}
             inverted 
             renderItem={renderMessage}
             keyExtractor={item => item.id}
             contentContainerStyle={{ padding: 20 }}
             showsVerticalScrollIndicator={false}
           />
        )}
      </ImageBackground>

      {/* 🌟 重新雕琢的输入框 (参考第二张图) */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
         <TouchableOpacity style={styles.addBtn}><Text style={{fontSize: 24, color: '#999'}}>+</Text></TouchableOpacity>
         <TextInput
            style={styles.textInput}
            placeholder="在尊贵的土豆岛聊点什么..."
            placeholderTextColor="#BBB"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
         />
         <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && {backgroundColor: '#2C2C2E'}]} // 没字时深灰
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
         >
            {sending ? <ActivityIndicator color="#111" /> : <Text style={[styles.sendBtnIcon, !inputText.trim() && {color: '#888'}]}>➤</Text>}
         </TouchableOpacity>
      </View>

      {/* 🌟 右上角【更多】选项模态框 */}
      <Modal visible={showMoreModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoreModal(false)}>
              <View style={[styles.moreMenuBox, { top: insets.top + 50 }]}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => setShowMoreModal(false)}>
                      <Text style={{fontSize: 16, marginRight: 10}}>🔍</Text><Text style={styles.menuItemText}>搜索聊天记录</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => setShowMoreModal(false)}>
                      <Text style={{fontSize: 16, marginRight: 10}}>🔔</Text><Text style={styles.menuItemText}>群消息免打扰</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => {
                       setShowMoreModal(false);
                       router.push('/admin-panel'); // 🌟 这里我为你预设跳转到后台管理(如果是管理员)
                  }}>
                      <Text style={{fontSize: 16, marginRight: 10}}>👑</Text><Text style={styles.menuItemText}>管理群组成员</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => setShowMoreModal(false)}>
                      <Text style={{fontSize: 16, marginRight: 10}}>🚨</Text><Text style={[styles.menuItemText, {color: '#FF3B30'}]}>举报该群聊</Text>
                  </TouchableOpacity>
              </View>
          </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#111' }, // 🌟 整体背景设为黑色，显得稳重
  
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0', zIndex: 10 },
  navBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20, color: '#111', fontWeight: '800' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111', maxWidth: '65%' },
  moreIcon: { fontSize: 20, color: '#111', fontWeight: '900', letterSpacing: -1 }, // 三个点

  msgWrapper: { flexDirection: 'row', marginBottom: 20, width: '100%' },
  msgWrapperMe: { justifyContent: 'flex-end' },
  msgWrapperOther: { justifyContent: 'flex-start' },
  
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#DDD', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  msgContent: { maxWidth: '78%' },
  msgContentMe: { alignItems: 'flex-end' },
  msgContentOther: { alignItems: 'flex-start' },
  
  nickname: { fontSize: 12, color: '#999', marginBottom: 6, marginLeft: 4, fontWeight: '700' },
  
  bubble: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  // 🌟 我的消息：土豆金褐色背景
  bubbleMe: { backgroundColor: '#D49A36', borderBottomRightRadius: 4 }, 
  // 🌟 对方消息：高级磨砂白气泡
  bubbleOther: { backgroundColor: '#FFF', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#EAEAEA' }, 
  
  msgText: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  msgTextMe: { color: '#FFF' },
  msgTextOther: { color: '#111' },
  
  timeText: { fontSize: 11, color: '#BBB', marginTop: 6, paddingHorizontal: 4, fontWeight: '700' },

  // 重新雕琢的输入框
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F0F0F0' },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F5F6F8', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: '#111', marginHorizontal: 8, borderWidth: 1, borderColor: '#EAEAEA' },
  sendBtn: { height: 40, width: 40, borderRadius: 20, backgroundColor: '#D49A36', justifyContent: 'center', alignItems: 'center', marginLeft: 4 }, // 金黄色发送按钮
  sendBtnIcon: { color: '#FFF', fontSize: 18, fontWeight: '900' }, // 小飞机图标 ➤

  // 右上角【更多】选项样式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }, // 半透明遮罩
  moreMenuBox: { position: 'absolute', right: 16, backgroundColor: '#FFF', borderRadius: 16, padding: 8, width: 170, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 14, color: '#111', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
});