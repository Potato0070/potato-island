import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function ChangeAvatarScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uniqueNfts, setUniqueNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // 🌟 高级定制弹窗与提示状态
  const [logoutModal, setLogoutModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useFocusEffect(useCallback(() => { fetchMyData(); }, []));

  const showToast = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  const fetchMyData = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single();
      if (profile) {
        setNickname(profile.nickname || '');
        setAvatarUrl(profile.avatar_url || 'https://via.placeholder.com/100');
      }

      // 拉取藏品并在前端按照 collection_id 进行去重
      const { data: nfts } = await supabase.from('nfts').select('collection_id, collections(name, image_url)').eq('owner_id', user.id).neq('status', 'burned');
      
      if (nfts) {
         const uniqueMap = new Map();
         nfts.forEach((nft: any) => {
            const col = Array.isArray(nft.collections) ? nft.collections[0] : nft.collections;
            if (!uniqueMap.has(nft.collection_id) && col) {
               uniqueMap.set(nft.collection_id, { id: nft.collection_id, image_url: col.image_url, name: col.name });
            }
         });
         setUniqueNfts(Array.from(uniqueMap.values()));
      }
    } catch (err) { console.error(err); } finally { setFetching(false); }
  };

  // 🌟 核心修复 1：保存档案改用 Toast 提示，防卡死
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('profiles').update({ nickname, avatar_url: avatarUrl }).eq('id', user?.id);
      showToast('✅ 保存成功！档案已更新');
      // 延迟 1.5 秒后自动返回上一页
      setTimeout(() => router.back(), 1500);
    } catch (err: any) { 
      showToast(`保存失败: ${err.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  // 🌟 核心修复 2：真实可靠的退出登录逻辑
  const executeLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
        await supabase.auth.signOut();
        setLogoutModal(false);
        router.replace('/login' as any);
    } catch (err) {
        console.error(err);
    }
  };

  const renderNftItem = ({ item }: { item: any }) => {
    const isSelected = avatarUrl === item.image_url;
    return (
      <TouchableOpacity 
         style={[styles.nftCard, isSelected && styles.nftCardSelected]} 
         onPress={() => { Haptics.selectionAsync(); setAvatarUrl(item.image_url); }} 
         activeOpacity={0.8}
      >
        <Image source={{ uri: item.image_url }} style={styles.nftImg} />
        {isSelected && <View style={styles.selectedBadge}><Text style={{color: '#FFF', fontSize: 10, fontWeight: '900'}}>佩戴中</Text></View>}
      </TouchableOpacity>
    );
  };

  if (fetching) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>系统设置</Text>
        <View style={styles.navBtn} />
      </View>

      {/* 轻提示 Toast */}
      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <FlatList 
        data={uniqueNfts}
        keyExtractor={item => item.id}
        numColumns={4}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <>
            <View style={{alignItems: 'center', marginBottom: 30}}>
               <Image source={{ uri: avatarUrl }} style={styles.previewAvatar} />
            </View>
            <Text style={styles.label}>岛民尊号</Text>
            <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholderTextColor="#A1887F" />
            <Text style={styles.label}>选择身份标识 (已去重)</Text>
          </>
        }
        renderItem={renderNftItem}
        ListFooterComponent={
          <View style={{marginTop: 40}}>
            <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>保存修改</Text>}
            </TouchableOpacity>
            
            {/* 唤起定制退出弹窗 */}
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLogoutModal(true); }}>
              <Text style={styles.logoutText}>退出登录</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* 🌟 核心定制：绝对能点得动的退出确认弹窗，文案已专业化 */}
      <Modal visible={logoutModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>退出确认</Text>
               <Text style={styles.confirmDesc}>确定要退出登录吗？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogoutModal(false)}>
                     <Text style={styles.cancelBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeLogout}>
                     {/* 🌟 痛点修复：文案改成更专业的“确认退出” */}
                     <Text style={styles.confirmBtnText}>确认退出</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  previewAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F5EFE6', borderWidth: 4, borderColor: '#D49A36' },
  label: { width: '100%', fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 12 },
  input: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 30, borderWidth: 1, borderColor: '#EAE0D5', color: '#4E342E', fontWeight: '700' },
  
  nftCard: { width: (width - 40) / 4 - 8, aspectRatio: 1, marginRight: 10, marginBottom: 10, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', backgroundColor: '#F5EFE6' },
  nftCardSelected: { borderColor: '#D49A36' },
  nftImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectedBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#D49A36', alignItems: 'center', paddingVertical: 2 },
  
  btn: { width: '100%', backgroundColor: '#D49A36', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16, shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  logoutBtn: { width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 12 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '600' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});