import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

// 🌟 设定超级管理员的 ID，用于扣除他的卡！(请确保你的管理员账号里有大量Potato卡，否则烧不动)
// 在你 Supabase 的 auth.users 表里复制你的 UUID 填到这里
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
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setAnnouncements(data || []);
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

      // 1. 找一张超级管理员的 Potato 卡
      const { data: adminNfts } = await supabase.from('nfts')
         .select('id, collections!inner(name)')
         .eq('owner_id', SUPER_ADMIN_ID) // ⚠️ 如果测试时管理员没卡，可以暂时注释这行，烧点赞者自己的卡
         .eq('status', 'idle')
         .eq('collections.name', 'Potato卡')
         .limit(1);

      if (!adminNfts || adminNfts.length === 0) {
         // 管理员没卡了，只能加点赞数，不烧卡
         await supabase.from('announcements').update({ likes_count: (post.likes_count || 0) + 1 }).eq('id', post.id);
         Alert.alert('点赞成功', '由于神谕金库库存不足，本次未触发通缩神迹。');
      } else {
         const cardToBurn = adminNfts[0];

         // 2. 物理销毁这张卡
         await supabase.from('nfts').update({ status: 'burned' }).eq('id', cardToBurn.id);

         // 3. 点赞数 + 1
         await supabase.from('announcements').update({ likes_count: (post.likes_count || 0) + 1 }).eq('id', post.id);

         // 4. 🌟 适配表结构：既然没有 messages 表，直接作为“全网广播”插入到公告表！
         const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
         await supabase.from('announcements').insert([{
            title: '🔥 全网通缩神迹降临！',
            content: `岛民【${profile?.nickname || '神秘信徒'}】刚刚赞颂了王国旨意，触发了神迹！官方金库已当场焚毁 1 张 Potato卡！大盘通缩加剧！`,
            author_name: '土豆清道夫', // 专属特殊作者名
            is_featured: false // 不置顶，让它作为最新动态自然流动
         }]);

         // 5. 弹窗震撼提示
         setBurnModal({ visible: true, msg: `您赞颂了王国旨意，触发了神迹！\n官方金库已当场焚毁 1 张 Potato卡！\n全岛通缩加剧！` });
      }

      // 记录本地已点赞
      const newLiked = { ...likedPosts, [post.id]: true };
      setLikedPosts(newLiked);
      AsyncStorage.setItem('liked_announcements', JSON.stringify(newLiked));
      
      // 刷新列表
      fetchAnnouncements();

    } catch (e: any) {
      Alert.alert('点赞失败', e.message);
    }
  };

  const renderPost = ({ item }: { item: any }) => {
    const isCleaner = item.author_name === '土豆清道夫'; 
    const hasLiked = likedPosts[item.id];

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

        {/* 土豆清道夫的系统播报不需要点赞和评论按钮 */}
        {!isCleaner && (
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