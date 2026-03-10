import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const MENU_GRID = [
  { name: '订单', icon: '📝', route: '/my-orders' },
  { name: '邀请', icon: '🤝', route: '' },
  { name: '求购', icon: '🛒', route: '/create-buy-order' }, 
  { name: '钱包', icon: '👛', route: '/wallet' },
  { name: '合成', icon: '🧬', route: '/synthesis-list' },
  { name: '权益', icon: '💎', route: '/vip-privilege' },
  { name: '转赠', icon: '🎁', route: '/transfer' },
  { name: '设置', icon: '⚙️', route: '/change-avatar' },
];

// 🌟 等级映射字典
const VIP_TIER_NAMES: Record<number, string> = {
  1: '大众会员',
  2: '黄金会员',
  3: '铂金会员',
  4: '钻石会员',
  5: '黑钻会员'
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [totalNfts, setTotalNfts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfileData = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      // 1. 获取用户信息
      const { data: profData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profData);

      // 2. 获取个人藏品并按系列聚合
      const { data: nfts } = await supabase.from('nfts').select('id, collection_id, status, collections(id, name, image_url)')
        .eq('owner_id', user.id).neq('status', 'burned');
      
      if (nfts) {
        setTotalNfts(nfts.length);
        const counts: Record<string, any> = {};
        nfts.forEach(nft => {
          const col = Array.isArray(nft.collections) ? nft.collections[0] : nft.collections;
          if (!col) return;
          if (!counts[col.id]) counts[col.id] = { id: col.id, name: col.name, image_url: col.image_url, count: 0, idleCount: 0 };
          counts[col.id].count += 1;
          if (nft.status === 'idle') counts[col.id].idleCount += 1;
        });
        setCollections(Object.values(counts));
      }
    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchProfileData(); }, []));

  const copyToClipboard = async () => {
    if (profile?.id) {
       await Clipboard.setStringAsync(profile.id);
       alert('✅ 土豆岛号已复制到剪贴板！');
    }
  };

  // 🌟 核心：计算真实需要显示的等级，如果为管理员则直接满级
  const displayLevel = profile?.is_admin ? 5 : (profile?.vip_level || 1);
  const displayName = profile?.is_admin ? '创世神' : VIP_TIER_NAMES[displayLevel];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfileData} tintColor="#D49A36" />}>
        
        {/* --- 1. 顶部身份档案区 --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/change-avatar')}>
             <Image source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/100' }} style={styles.avatar} />
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={styles.nickname}>{profile?.nickname || '土豆岛民'}</Text>
               {/* 🌟 动态同步的顶部等级 Tag */}
               <View style={styles.vipTag}><Text style={styles.vipText}>V{displayLevel}</Text></View>
               {profile?.is_admin && <View style={[styles.vipTag, {backgroundColor: '#FF3B30', marginLeft: 4}]}><Text style={styles.vipText}>Admin</Text></View>}
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 6}}>
               <Text style={styles.uid}>土豆岛号: td_{profile?.id?.substring(0,8).toUpperCase() || '00000000'}</Text>
               <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                  <Text style={styles.copyBtnText}>复制</Text>
               </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.qrCodeBtn}><Text style={{fontSize: 24}}>🪪</Text></TouchableOpacity>
        </View>

        {/* --- 专属上帝通道：创世中枢 --- */}
        {profile?.is_admin && (
           <TouchableOpacity style={styles.adminBanner} onPress={() => router.push('/admin-panel')} activeOpacity={0.8}>
              <View style={styles.adminIconBox}><Text style={{fontSize: 20}}>👑</Text></View>
              <View style={{flex: 1}}>
                 <Text style={styles.adminTitle}>创世中枢控制台</Text>
                 <Text style={styles.adminSub}>上帝视角 · 调控全岛资产与经济</Text>
              </View>
              <Text style={{color: '#FFD700', fontSize: 16, fontWeight: '900'}}>进入 〉</Text>
           </TouchableOpacity>
        )}

        {/* --- 2. 财富与收益看板 --- */}
        <View style={styles.wealthCard}>
           <View style={styles.wealthTop}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 {/* 🌟 动态同步的会员名称 */}
                 <Text style={styles.wealthVipTitle}>👑 {displayName}</Text>
                 <Text style={styles.wealthVipSub}> | 升级享受更多权益，去查看 〉</Text>
              </View>
              <Text style={styles.wealthVipLogo}>VIP</Text>
           </View>
           
           <View style={styles.wealthDataRow}>
              <View style={styles.wealthDataItem}>
                 <Text style={styles.wealthDataValue}>0.00</Text>
                 <Text style={styles.wealthDataLabel}>今日收益</Text>
              </View>
              <View style={styles.wealthDataItem}>
                 <Text style={styles.wealthDataValue}>0.00</Text>
                 <Text style={styles.wealthDataLabel}>本月收益</Text>
              </View>
              <View style={styles.wealthDataItem}>
                 <Text style={styles.wealthDataValue}>{profile?.potato_coin_balance?.toFixed(2) || '0.00'}</Text>
                 <Text style={styles.wealthDataLabel}>土豆币余额</Text>
              </View>
           </View>
        </View>

        {/* --- 3. 8宫格操作区 --- */}
        <View style={styles.gridContainer}>
          {MENU_GRID.map((item, index) => (
            <TouchableOpacity key={index} style={styles.gridItem} activeOpacity={0.7} onPress={() => item.route ? router.push(item.route as any) : null}>
              <View style={styles.gridIconWrapper}><Text style={styles.gridIconEmoji}>{item.icon}</Text></View>
              <Text style={styles.gridText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- 4. 抽签日历横幅 --- */}
        <TouchableOpacity style={styles.bannerAd} activeOpacity={0.9} onPress={() => router.push('/lottery')}>
           <View style={{flex: 1}}>
              <Text style={styles.bannerTitle}>命运抽签</Text>
              <Text style={styles.bannerSub}>DRAW LOTS CALENDAR</Text>
           </View>
           <Text style={{fontSize: 40}}>📅</Text>
        </TouchableOpacity>

        {/* --- 5. 藏品归纳区 --- */}
        <View style={styles.collectionSection}>
          <View style={styles.colHeader}>
             <Text style={styles.sectionTitle}>我的藏品 <Text style={{fontSize: 14, fontWeight: 'normal', color: '#666'}}>{totalNfts}</Text></Text>
             <Text style={{color: '#0066FF', fontSize: 13, fontWeight: '600'}}>全部藏品 〉</Text>
          </View>

          <View style={styles.grid}>
            {collections.map(col => (
              <TouchableOpacity 
                key={col.id} 
                style={styles.colCard} 
                activeOpacity={0.9}
                onPress={() => router.push({pathname: '/my-collection-list', params: {collectionId: col.id, collectionName: col.name}})}
              >
                <View style={styles.colImgBox}>
                   <Image source={{ uri: col.image_url }} style={styles.colImg} />
                </View>
                <View style={styles.colInfo}>
                  <Text style={styles.colName} numberOfLines={1}>{col.name}</Text>
                  <Text style={styles.colCount}>持有量: {col.count}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {collections.length === 0 && (
               <View style={styles.emptyBox}>
                  <Text style={{fontSize: 40, marginBottom: 10}}>📦</Text>
                  <Text style={{color: '#999', fontWeight: '600'}}>金库空空如也，去集市扫货吧！</Text>
               </View>
            )}
          </View>
        </View>
        <View style={{height: 100}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#F9F9F9' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEE', borderWidth: 2, borderColor: '#FFF' },
  userInfo: { flex: 1, marginLeft: 16 },
  nickname: { fontSize: 20, fontWeight: '900', color: '#111' },
  vipTag: { backgroundColor: '#0066FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  vipText: { color: '#FFF', fontSize: 10, fontWeight: '900', fontStyle: 'italic' },
  uid: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  qrCodeBtn: { padding: 10 },

  copyBtn: { marginLeft: 8, backgroundColor: '#FFF5E6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#D49A36' },
  copyBtnText: { color: '#D49A36', fontSize: 10, fontWeight: '800' },

  adminBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, shadowColor: '#FFD700', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: {width: 0, height: 4}, elevation: 5 },
  adminIconBox: { width: 40, height: 40, backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  adminTitle: { color: '#FFD700', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  adminSub: { color: '#CCC', fontSize: 11 },

  wealthCard: { backgroundColor: '#FFF5E6', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFE4B5' },
  wealthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  wealthVipTitle: { fontSize: 15, fontWeight: '900', color: '#8B5A2B' },
  wealthVipSub: { fontSize: 12, color: '#B8860B' },
  wealthVipLogo: { fontSize: 24, fontWeight: '900', color: '#EEDC82', fontStyle: 'italic' },
  wealthDataRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wealthDataItem: { alignItems: 'center', flex: 1 },
  wealthDataValue: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 4 },
  wealthDataLabel: { fontSize: 11, color: '#8B5A2B' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, paddingVertical: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 16 },
  gridIconWrapper: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#F5F6F8', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridIconEmoji: { fontSize: 22 },
  gridText: { fontSize: 12, color: '#333', fontWeight: '600' },

  bannerAd: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F0FF', marginHorizontal: 16, borderRadius: 16, padding: 20, marginBottom: 24 },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#0047AB', marginBottom: 4 },
  bannerSub: { fontSize: 10, color: '#4169E1', letterSpacing: 1 },

  collectionSection: { paddingHorizontal: 16 },
  colHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  colCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  colImgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5' },
  colImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  colInfo: { padding: 12 },
  colName: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 4 },
  colCount: { fontSize: 11, color: '#666' },
  emptyBox: { width: '100%', alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFF', borderRadius: 16 },
});