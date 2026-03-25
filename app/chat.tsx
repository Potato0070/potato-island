import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

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

  useEffect(() => {
    initChat();
    // 🌟 核心：监听 Supabase WebSocket 实时消息管道
    const channel = supabase
      .channel(`chat_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` },
        async (payload) => {
          // 当收到新消息广播时，如果是别人发的，我们需要拉取他的昵称
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

      // 拉取历史消息（倒序，最新的在前面）
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
    setInputText(''); // 🌟 秒清空输入框，提供极速手感
    setSending(true);

    try {
      // 1. 乐观更新（假装已经发送成功，让 UI 瞬间出现消息）
      const optimisticMsg = {
         id: Math.random().toString(),
         user_id: myUserId,
         content: textToSend,
         created_at: new Date().toISOString(),
         profiles: { nickname: '我' }
      };
      setMessages(prev => [optimisticMsg, ...prev]);

      // 2. 真实入库
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
    const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={{fontSize: 16}}>👤</Text>
          </View>
        )}
        <View style={[styles.msgContent, isMe ? styles.msgContentMe : styles.msgContentOther]}>
          {!isMe && <Text style={styles.nickname}>{item.profiles?.nickname || '神秘岛民'}</Text>}
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
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{name || '群聊'}</Text>
        <View style={styles.navBtn} />
      </View>

      <KeyboardAvoidingView 
         style={{ flex: 1 }} 
         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
           <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>
        ) : (
           <FlatList
             ref={flatListRef}
             data={messages}
             inverted // 🌟 核心：倒置列表，让消息像微信一样从底部往上顶！
             renderItem={renderMessage}
             keyExtractor={item => item.id}
             contentContainerStyle={{ padding: 16 }}
             showsVerticalScrollIndicator={false}
           />
        )}

        {/* 聊天输入框 */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
           <TextInput
              style={styles.textInput}
              placeholder="聊点什么..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={200}
           />
           <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && {backgroundColor: '#E0E0E0'}]} 
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
           >
              <Text style={[styles.sendBtnText, !inputText.trim() && {color: '#999'}]}>发送</Text>
           </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111', maxWidth: '70%' },

  msgWrapper: { flexDirection: 'row', marginBottom: 16, width: '100%' },
  msgWrapperMe: { justifyContent: 'flex-end' },
  msgWrapperOther: { justifyContent: 'flex-start' },
  
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  
  msgContent: { maxWidth: '75%' },
  msgContentMe: { alignItems: 'flex-end' },
  msgContentOther: { alignItems: 'flex-start' },
  
  nickname: { fontSize: 11, color: '#888', marginBottom: 4, marginLeft: 4 },
  
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: '#0066FF', borderTopRightRadius: 4 }, // 科技蓝气泡
  bubbleOther: { backgroundColor: '#FFF', borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#EAEAEA' }, // 白色气泡
  
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: '#FFF' },
  msgTextOther: { color: '#111' },
  
  timeText: { fontSize: 10, color: '#CCC', marginTop: 4, paddingHorizontal: 4 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F0F0F0' },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F5F6F8', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: '#111', marginRight: 12 },
  sendBtn: { height: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' }
});