import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// 🌟 为你预留的“复古插画”占位图，等你用 AI 生成好金库插画后，替换这个链接即可！
const VAULT_ILLUSTRATION_URL = 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?q=80&w=800&auto=format&fit=crop&blur=5';

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

const VIP_TIER_NAMES: Record<number, string> = {
  1: '大众会员', 2: '黄金会员', 3: '铂金会员', 4: '钻石会员', 5: '黑钻会员'
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [totalNfts, setTotalNfts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // 🌟 动态获取今天真实的日期，打破 7月17日 诅咒！
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDate = today.getDate();

  const fetchProfileData = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: profData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profData);

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

  const displayLevel = profile?.is_admin ? 5 : (profile?.vip_level || 1);
  const displayName = profile?.is_admin ? '创世神' : VIP_TIER_NAMES[displayLevel];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfileData} tintColor="#D49A36" />}>
        
        {/* --- 1. 顶部身份档案区 (黑金复古风) --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/change-avatar')}>
             <Image source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/100' }} style={styles.avatar} />
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={styles.nickname}>{profile?.nickname || '土豆岛民'}</Text>
               {/* 🌟 拔掉突兀蓝，换上尊贵的琥珀金 VIP 标签 */}
               <View style={styles.vipTag}><Text style={styles.vipText}>V{displayLevel}</Text></View>
               {profile?.is_admin && <View style={[styles.vipTag, {backgroundColor: '#FF3B30', marginLeft: 4}]}><Text style={[styles.vipText, {color: '#FFF'}]}>Admin</Text></View>}
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
              <Text style={{color: '#D49A36', fontSize: 16, fontWeight: '900'}}>进入 〉</Text>
           </TouchableOpacity>
        )}

        {/* --- 2. 财富与收益看板 (🌟 升级为带插画背景的尊贵黑金卡) --- */}
        <TouchableOpacity activeOpacity={0.9} style={styles.wealthCardWrapper}>
           <ImageBackground source={{ uri: VAULT_ILLUSTRATION_URL }} style={styles.wealthCardBg} imageStyle={{ borderRadius: 16 }}>
              <View style={styles.wealthOverlay}>
                 <View style={styles.wealthTop}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <Text style={styles.wealthVipTitle}>👑 {displayName}</Text>
                       <Text style={styles.wealthVipSub}> | 专属金库 〉</Text>
                    </View>
                    <Text style={styles.wealthVipLogo}>ISLAND</Text>
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
           </ImageBackground>
        </TouchableOpacity>

        {/* --- 3. 8宫格操作区 --- */}
        <View style={styles.gridContainer}>
          {MENU_GRID.map((item, index) => (
            <TouchableOpacity key={index} style={styles.gridItem} activeOpacity={0.7} onPress={() => item.route ? router.push(item.route as any) : null}>
              <View style={styles.gridIconWrapper}><Text style={styles.gridIconEmoji}>{item.icon}</Text></View>
              <Text style={styles.gridText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- 4. 抽签日历横幅 (🌟 动态日历取代 7月17日 emoji 诅咒) --- */}
        <TouchableOpacity style={styles.bannerAd} activeOpacity={0.9} onPress={() => router.push('/lottery')}>
           <View style={{flex: 1}}>
              <Text style={styles.bannerTitle}>命运抽签</Text>
              <Text style={styles.bannerSub}>每日虔诚祈祷，获取稀有物资</Text>
           </View>
           
           {/* 🔥 亲手画的动态日历，永远显示今天！ */}
           <View style={styles.dynamicCalendar}>
              <View style={styles.calHeader}><Text style={styles.calMonth}>{currentMonth}月</Text></View>
              <View style={styles.calBody}><Text style={styles.calDay}>{currentDate}</Text></View>
           </View>
        </TouchableOpacity>

        {/* --- 5. 藏品归纳区 --- */}
        <View style={styles.collectionSection}>
          <View style={styles.colHeader}>
             <Text style={styles.sectionTitle}>我的藏品 <Text style={{fontSize: 14, fontWeight: 'normal', color: '#8D6E63'}}>{totalNfts}</Text></Text>
             {/* 🌟 拔掉突兀蓝，换成琥珀金 */}
             <Text style={styles.colHeaderLink}>全部藏品 〉</Text>
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
                  <Text style={{fontSize: 40, marginBottom: 10}}>🪹</Text>
                  <Text style={{color: '#8D6E63', fontWeight: '600'}}>金库空空如也，去集市扫货吧！</Text>
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
  // 🌟 全局大背景：换成了护眼的复古米白
  container: { flex: 1, backgroundColor: '#FDF8F0' }, 
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FDF8F0' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EAE0D5', borderWidth: 2, borderColor: '#D49A36' },
  userInfo: { flex: 1, marginLeft: 16 },
  nickname: { fontSize: 20, fontWeight: '900', color: '#4E342E' }, // 深咖文字
  
  // 🌟 VIP 标签换成了琥珀金背景，深色文字
  vipTag: { backgroundColor: '#D49A36', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  vipText: { color: '#4E342E', fontSize: 10, fontWeight: '900', fontStyle: 'italic' },
  
  uid: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace' },
  qrCodeBtn: { padding: 10 },

  copyBtn: { marginLeft: 8, backgroundColor: '#F5EFE6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#D49A36' },
  copyBtnText: { color: '#D49A36', fontSize: 10, fontWeight: '800' },

  adminBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C1E16', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, shadowColor: '#D49A36', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: {width: 0, height: 4}, elevation: 5 },
  adminIconBox: { width: 40, height: 40, backgroundColor: 'rgba(212,154,54,0.2)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  adminTitle: { color: '#D49A36', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  adminSub: { color: '#A1887F', fontSize: 11 },

  // 🌟 财富看板：升级为带插画背景的尊贵卡片
  wealthCardWrapper: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, shadowColor: '#4E342E', shadowOpacity: 0.15, shadowRadius: 15, elevation: 4 },
  wealthCardBg: { width: '100%', borderRadius: 16 },
  wealthOverlay: { backgroundColor: 'rgba(44, 30, 22, 0.85)', padding: 20, borderRadius: 16 }, // 深色半透明遮罩盖在插画上
  wealthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  wealthVipTitle: { fontSize: 16, fontWeight: '900', color: '#D49A36' },
  wealthVipSub: { fontSize: 12, color: '#A1887F' },
  wealthVipLogo: { fontSize: 24, fontWeight: '900', color: 'rgba(212,154,54,0.3)', fontStyle: 'italic', letterSpacing: 2 },
  wealthDataRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wealthDataItem: { alignItems: 'center', flex: 1 },
  wealthDataValue: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 6, fontFamily: 'monospace' },
  wealthDataLabel: { fontSize: 11, color: '#D49A36', fontWeight: '600' },

  // 🌟 8宫格：融入复古色系
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, paddingVertical: 16, marginBottom: 16, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 16 },
  gridIconWrapper: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FDF8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#F0E6D2' },
  gridIconEmoji: { fontSize: 22 },
  gridText: { fontSize: 12, color: '#4E342E', fontWeight: '700' },

  // 🌟 命运抽签横幅
  bannerAd: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5EFE6', marginHorizontal: 16, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#EAE0D5' },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  bannerSub: { fontSize: 11, color: '#8D6E63', letterSpacing: 1 },
  
  // 🔥 终结 7月17日 Bug，亲手画的动态日历图标
  dynamicCalendar: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden', shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: '#EAE0D5' },
  calHeader: { backgroundColor: '#D49A36', height: 18, justifyContent: 'center', alignItems: 'center' },
  calMonth: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  calBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  calDay: { color: '#4E342E', fontSize: 20, fontWeight: '900' },

  collectionSection: { paddingHorizontal: 16 },
  colHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  colHeaderLink: { color: '#D49A36', fontSize: 13, fontWeight: '900' }, // 拔掉蓝色

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  colCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  colImgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#FDF8F0' },
  colImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  colInfo: { padding: 12 },
  colName: { fontSize: 14, fontWeight: '800', color: '#4E342E', marginBottom: 4 },
  colCount: { fontSize: 11, color: '#8D6E63', fontWeight: '600' },
  emptyBox: { width: '100%', alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#F0E6D2' },
});