import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 🌟 优化了阶级配色，完美融入复古褐金体系
const VIP_TIERS = [
  { level: 1, name: '大众会员', threshold: 0, nextThreshold: 1000, bg: ['#F5EFE6', '#EAE0D5'], color: '#8D6E63', icon: '👤', cardCost: 2 },
  { level: 2, name: '黄金会员', threshold: 1000, nextThreshold: 5000, bg: ['#FFF5E6', '#FFD700'], color: '#B8860B', icon: '🏅', cardCost: 6 },
  { level: 3, name: '铂金会员', threshold: 5000, nextThreshold: 20000, bg: ['#F0F8FF', '#B0C4DE'], color: '#4682B4', icon: '💍', cardCost: 12 },
  { level: 4, name: '钻石会员', threshold: 20000, nextThreshold: 100000, bg: ['#F5EEF8', '#DDA0DD'], color: '#8A2BE2', icon: '💎', cardCost: 20 },
  { level: 5, name: '黑钻会员', threshold: 100000, nextThreshold: 9999999, bg: ['#2C1E16', '#111111'], color: '#D49A36', icon: '👑', cardCost: 0 }, // 🌟 黑金巅峰
];

export default function VipPrivilegeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  const [realUniversalCount, setRealUniversalCount] = useState(0);
  const [universalNftIds, setUniversalNftIds] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [upgradeModal, setUpgradeModal] = useState<{visible: boolean, cost: number, nextLv: number, nextName: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('id, is_admin, vip_level, total_consumed').eq('id', user.id).single();
      setProfile(data);

      const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
      let uCount = 0;
      let uIds: string[] = [];
      if (myNfts) {
         myNfts.forEach((nft: any) => {
            const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
            if (colName === '万能土豆卡') {
               uCount++;
               uIds.push(nft.id);
            }
         });
      }
      setRealUniversalCount(uCount);
      setUniversalNftIds(uIds);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const handleUpgradeClick = (cost: number, nextLv: number, nextName: string) => {
    if (realUniversalCount < cost) {
       return showToast(`万能土豆卡不足！(需要 ${cost} 张，当前仅 ${realUniversalCount} 张)`);
    }
    setUpgradeModal({ visible: true, cost, nextLv, nextName });
  };

  const executeUpgrade = async () => {
    if (!upgradeModal) return;
    setProcessing(true);
    try {
      if (realUniversalCount < upgradeModal.cost) throw new Error('万能卡不足！被发现试图作弊！');

      const cardsToBurn = universalNftIds.slice(0, upgradeModal.cost);
      await supabase.from('nfts').update({ status: 'burned' }).in('id', cardsToBurn);

      await supabase.from('profiles').update({ vip_level: upgradeModal.nextLv }).eq('id', profile.id);

      setUpgradeModal(null);
      showToast(`⚡ 飞升成功！您已登阶为【${upgradeModal.nextName}】！`);
      fetchProfile(); 
    } catch (err: any) {
      setUpgradeModal(null);
      showToast(`升级失败: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !profile) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const displayLevel = profile.is_admin ? 5 : (profile.vip_level || 1);
  const currentTier = VIP_TIERS.find(t => t.level === displayLevel) || VIP_TIERS[0];
  const nextTier = VIP_TIERS.find(t => t.level === displayLevel + 1);
  
  const consumed = parseFloat(profile.total_consumed) || 0;
  const max = currentTier.nextThreshold;
  const progressPercent = (profile.is_admin || !nextTier) ? 100 : Math.min((consumed / max) * 100, 100);

  // 🌟 核心杀招：给未解锁的权益明确“解锁条件”，不再画空饼！
  const privileges = [
    { title: '优先购', sub: `${currentTier.level * 2}次/月`, icon: '⚡', isLocked: false },
    { title: '首发奖励', sub: `好友买入${currentTier.level * 5}%`, icon: '🎁', isLocked: false },
    { title: '寄售奖励', sub: `最高${currentTier.level * 8}%`, icon: '💰', isLocked: false },
    { title: '减手续费', sub: `寄售${100 - (currentTier.level * 5)}折`, icon: '📉', isLocked: false },
    { title: '免提现费', sub: `每月${currentTier.level}次`, icon: '🏧', isLocked: false },
    { title: '挂靠收益', sub: currentTier.level >= 3 ? '已开启' : '🔒 铂金会员解锁', icon: '📈', isLocked: currentTier.level < 3 },
    { title: '平台分红', sub: currentTier.level === 5 ? '上不封顶' : '🔒 黑钻会员解锁', icon: '📊', isLocked: currentTier.level < 5 },
    { title: '求购权益', sub: `${currentTier.level * 500}个`, icon: '🛒', isLocked: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>领主权益中心</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* 阶级卡片 */}
        <View style={[styles.vipCard, { backgroundColor: currentTier.bg[0], borderColor: currentTier.bg[1] }]}>
           <View style={styles.cardHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={{fontSize: 24, marginRight: 8}}>{currentTier.icon}</Text>
                 <Text style={[styles.cardTitle, {color: currentTier.color}]}>{currentTier.name}</Text>
                 {profile.is_admin && <View style={styles.adminTag}><Text style={styles.adminTagText}>创世神</Text></View>}
              </View>
              <Text style={[styles.cardLevel, {color: currentTier.color}]}>V{currentTier.level}</Text>
           </View>

           <Text style={[styles.upgradeTip, {color: currentTier.color}]}>
              {profile.is_admin ? '创世神威，权利巅峰免检通过' : (nextTier ? `消费达到目标可自动升级为 ${nextTier.name}` : '您已达到土豆岛权利的巅峰')}
           </Text>

           <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                 <Text style={[styles.progressVal, {color: currentTier.color}]}>{profile.is_admin ? '∞' : consumed.toFixed(0)} <Text style={{fontSize: 12}}>/ {profile.is_admin || !nextTier ? 'MAX' : max}</Text></Text>
                 <Text style={[styles.progressLabel, {color: currentTier.color}]}>累计消费(元)</Text>
              </View>
              <View style={[styles.progressBarBg, {backgroundColor: 'rgba(0,0,0,0.1)'}]}>
                 <View style={[styles.progressBarFill, {width: `${progressPercent}%`, backgroundColor: currentTier.color}]} />
              </View>
           </View>

           {(!profile.is_admin && nextTier) && (
              <View style={styles.directUpgradeBox}>
                 <Text style={{color: currentTier.color, fontSize: 12, fontWeight: '700'}}>等不及消费？</Text>
                 <TouchableOpacity 
                    style={[styles.directUpgradeBtn, {backgroundColor: currentTier.color}]}
                    onPress={() => handleUpgradeClick(currentTier.cardCost, nextTier.level, nextTier.name)}
                 >
                    <Text style={[styles.directUpgradeBtnText, currentTier.level === 5 && {color: '#111'}]}>使用 {currentTier.cardCost} 张万能卡直升</Text>
                 </TouchableOpacity>
              </View>
           )}
        </View>

        {/* 特权矩阵 (尊贵复古版) */}
        <View style={styles.section}>
           <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>✨ VIP 特权</Text>
              <Text style={styles.sectionSubTitle}>{currentTier.name}可享受下列会员权益</Text>
           </View>
           
           <View style={styles.grid}>
              {privileges.map((item, index) => (
                 <View key={index} style={[styles.gridItem, item.isLocked && styles.gridItemLocked]}>
                    <View style={styles.gridIcon}><Text style={{fontSize: 24}}>{item.icon}</Text></View>
                    <Text style={styles.gridTitle}>{item.title}</Text>
                    {/* 🌟 核心：如果是锁定的，用尊贵的琥珀金高亮显示解锁条件！ */}
                    <Text style={[styles.gridSub, item.isLocked && styles.gridSubLocked]} numberOfLines={1}>{item.sub}</Text>
                 </View>
              ))}
           </View>
        </View>
      </ScrollView>

      {/* 🌟 弹窗视觉大一统 */}
      <Modal visible={!!upgradeModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>👑 登神确认</Text>
               <Text style={styles.confirmDesc}>将直接燃烧 <Text style={{color:'#FF3B30', fontWeight:'900'}}>{upgradeModal?.cost} 张</Text> 极其稀有的【万能土豆卡】并将其永久物理销毁，借此越过消费门槛，立刻将您的身份强行提升为【{upgradeModal?.nextName}】！是否执行？</Text>
               
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setUpgradeModal(null)}><Text style={styles.cancelBtnText}>太贵了</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={executeUpgrade} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.confirmBtnText, {color: '#FFF'}]}>确认燃烧飞升</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 全面切换到复古米白护眼背景
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  vipCard: { margin: 20, borderRadius: 20, padding: 24, borderWidth: 2, shadowColor: '#4E342E', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: {width: 0, height: 5}, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: '900' },
  cardLevel: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', opacity: 0.5 },
  adminTag: { backgroundColor: '#FF3B30', marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  adminTagText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  upgradeTip: { fontSize: 13, marginBottom: 24, fontWeight: '600', opacity: 0.8 },
  
  progressContainer: { marginTop: 10 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  progressVal: { fontSize: 24, fontWeight: '900', fontFamily: 'monospace' },
  progressLabel: { fontSize: 12, opacity: 0.8, marginBottom: 4 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  directUpgradeBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  directUpgradeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  directUpgradeBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },

  section: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginRight: 10 },
  sectionSubTitle: { fontSize: 12, color: '#8D6E63' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: (width - 60) / 4, alignItems: 'center', marginBottom: 24 },
  // 🌟 特权图标底板调优
  gridIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  gridTitle: { fontSize: 13, fontWeight: '800', color: '#4E342E', marginBottom: 4 },
  gridSub: { fontSize: 10, color: '#8D6E63' },
  
  // 🌟 锁定的特权样式
  gridItemLocked: { opacity: 0.6 },
  gridSubLocked: { color: '#D49A36', fontWeight: '900' },

  // 弹窗样式规范化
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});