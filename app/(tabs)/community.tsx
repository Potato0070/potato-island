import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

// 🌟 设定超级管理员的 ID，用于扣除他的卡！
const SUPER_ADMIN_ID = '你的超级管理员UUID_在这里替换'; 

export default function CommunityScreen() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  
  // 高级弹窗
  const [burnModal, setBurnModal] = useState<{visible: boolean, msg: string} | null>(null);

  useFocusEffect(useCallback(() => {
    fetchAnnouncements();
    loadLikedData();
  }, []));

  const loadLikedData = async () => {
    try {
      const savedLikes = await AsyncStorage.getItem('liked_announcements');
      if (savedLikes) setLikedPosts(JSON.parse(savedLikes));
    } catch (e) { console.error(e); }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*'); 
        
      if (error) throw error;

      // 🌟 核心：前端数据清洗器！重塑身份、头像、置顶规则与绝对优先级权重
      let formattedData = (data || []).map(item => {
         let displayAuthor = item.author_name || '王国大喇叭';
         let icon = '👑';
         let bgColor = '#111';
         let isFeatured = item.is_featured;
         let priorityWeight = 3; // 默认最低优先级：普通国王公告

         if (item.author_name === '创世中枢' || item.author_name === '超级中枢') {
             displayAuthor = '超级播报'; 
             icon = '📢'; 
             bgColor = '#0066FF'; 
             isFeatured = false; // 强行扒掉数据库可能误标的置顶
             priorityWeight = 2; // 第二优先级：系统播报
         } else if (item.author_name === '土豆清道夫') {
             icon = '🚨';
             bgColor = '#FF3B30';
             isFeatured = false; // 强行扒掉置顶
             priorityWeight = 2; // 第二优先级：清道夫播报
         } else if (item.author_name === '土豆国王') {
             icon = '🥔';
             bgColor = '#D49A36';
             // 只有国王可以被置顶，一旦置顶，权重最高
             if (item.is_featured) {
                 priorityWeight = 1; // 绝对霸主优先级！
             }
         }

         return { 
             ...item, 
             display_author: displayAuthor, 
             avatar_icon: icon, 
             avatar_bg: bgColor, 
             is_featured: isFeatured,
             priority_weight: priorityWeight // 注入计算好的权重
         };
      });

      // 🌟 史诗级三段式排序算法
      formattedData.sort((a, b) => {
         // 1. 优先比拼权重（数字越小越靠前：1 > 2 > 3）
         if (a.priority_weight !== b.priority_weight) {
             return a.priority_weight - b.priority_weight;
         }
         // 2. 如果权重相同（比如同为清道夫和超级播报，或同为普通国王），则按时间倒序（最新的在上面）
         return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setAnnouncements(formattedData);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // 🌟 核心：点赞触发全网烧卡神迹
  const handleLike = async (post: any) => {
    if (likedPosts[post.id]) {
       return Alert.alert('提示', '您已经为该旨意贡献过信仰了，不可重复点赞！');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminNfts } = await supabase.from('nfts')
         .select('id, collections!inner(name)')
         .eq('owner_id', SUPER_ADMIN_ID) 
         .eq('status', 'idle')
         .eq('collections.name', 'Potato卡')
         .limit(1);

      if (!adminNfts || adminNfts.length === 0) {
         await supabase.from('announcements').update({ likes_count: (post.likes_count || 0) + 1 }).eq('id', post.id);
         Alert.alert('点赞成功', '由于神谕金库库存不足，本次未触发通缩神迹。');
      } else {
         const cardToBurn = adminNfts[0];
         await supabase.from('nfts').update({ status: 'burned' }).eq('id', cardToBurn.id);
         await supabase.from('announcements').update({ likes_count: (post.likes_count || 0) + 1 }).eq('id', post.id);

         const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
         await supabase.from('announcements').insert([{
            title: '🔥 全网通缩神迹降临！',
            content: `岛民【${profile?.nickname || '神秘信徒'}】刚刚赞颂了王国旨意，触发了神迹！官方金库已当场焚毁 1 张 Potato卡！大盘通缩加剧！`,
            author_name: '土豆清道夫',
            is_featured: false
         }]);

         setBurnModal({ visible: true, msg: `您赞颂了王国旨意，触发了神迹！\n官方金库已当场焚毁 1 张 Potato卡！\n全岛通缩加剧！` });
      }

      const newLiked = { ...likedPosts, [post.id]: true };
      setLikedPosts(newLiked);
      AsyncStorage.setItem('liked_announcements', JSON.stringify(newLiked));
      fetchAnnouncements();
    } catch (e: any) {
      Alert.alert('点赞失败', e.message);
    }
  };

  const renderPost = ({ item }: { item: any }) => {
    const isSystemBroadcast = item.display_author === '超级播报' || item.display_author === '土豆清道夫'; 
    const hasLiked = likedPosts[item.id];

    return (
      <View style={[styles.card, item.display_author === '土豆清道夫' && styles.cardCleaner, item.display_author === '超级播报' && styles.cardBroadcast]}>
        <View style={styles.cardHeader}>
           <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.avatarBox, {backgroundColor: item.avatar_bg}]}>
                 <Text style={{fontSize: 16}}>{item.avatar_icon}</Text>
              </View>
              <View>
                 <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={[styles.authorName, item.display_author === '土豆清道夫' && {color: '#FF3B30'}, item.display_author === '超级播报' && {color: '#0066FF'}]}>
                       {item.display_author}
                    </Text>
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

        {/* 🌟 只有正常帖子才显示点赞和评论，系统播报直接隐藏 */}
        {!isSystemBroadcast && (
          <View style={styles.cardFooter}>
             <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
                <Text style={styles.actionIcon}>{hasLiked ? '🔥' : '👍'}</Text>
                <Text style={[styles.actionText, hasLiked && {color: '#FF3B30', fontWeight: '900'}]}>{item.likes_count || 0}</Text>
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
        )}
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

      {/* 🌟 全网烧卡神迹震动弹窗 */}
      <Modal visible={!!burnModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={{fontSize: 60, marginBottom: 10}}>🔥</Text>
               <Text style={styles.confirmTitle}>神迹降临</Text>
               <Text style={styles.confirmDesc}>{burnModal?.msg}</Text>
               <TouchableOpacity style={styles.confirmBtn} onPress={() => setBurnModal(null)}>
                  <Text style={styles.confirmBtnText}>见证通缩</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111' },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardCleaner: { borderWidth: 1, borderColor: '#FFB3B0', backgroundColor: '#FFF5F5' },
  cardBroadcast: { borderWidth: 1, borderColor: '#CCE0FF', backgroundColor: '#F0F6FF' }, // 🌟 超级播报专属蓝色皮肤
  
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
  actionText: { fontSize: 13, color: '#666', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#FF3B30' },
  confirmTitle: { fontSize: 22, fontWeight: '900', color: '#FF3B30', marginBottom: 16 },
  confirmDesc: { fontSize: 15, color: '#111', textAlign: 'center', lineHeight: 24, marginBottom: 24, fontWeight: '800' },
  confirmBtn: { width: '100%', paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 }
});