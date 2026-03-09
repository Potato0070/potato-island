import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 匹配一岛的 VIP 阶级配置
const VIP_TIERS = [
  { level: 1, name: '大众会员', threshold: 0, nextThreshold: 1000, bg: ['#F5F5F5', '#E0E0E0'], color: '#666', icon: '👤' },
  { level: 2, name: '黄金会员', threshold: 1000, nextThreshold: 5000, bg: ['#FFF5E6', '#FFD700'], color: '#B8860B', icon: '🏅' },
  { level: 3, name: '铂金会员', threshold: 5000, nextThreshold: 20000, bg: ['#F0F8FF', '#B0C4DE'], color: '#4682B4', icon: '💍' },
  { level: 4, name: '钻石会员', threshold: 20000, nextThreshold: 100000, bg: ['#F5EEF8', '#DDA0DD'], color: '#8A2BE2', icon: '💎' },
  { level: 5, name: '黑钻会员', threshold: 100000, nextThreshold: 9999999, bg: ['#2C3E50', '#000000'], color: '#FFD700', icon: '👑' },
];

export default function VipPrivilegeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // 直接从数据库拿底层算好的硬核数据
        supabase.from('profiles').select('vip_level, total_consumed').eq('id', user.id).single()
          .then(({ data }) => { setProfile(data); setLoading(false); });
      }
    });
  }, []));

  if (loading || !profile) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  // 动态计算进度
  const currentTier = VIP_TIERS.find(t => t.level === profile.vip_level) || VIP_TIERS[0];
  const nextTier = VIP_TIERS.find(t => t.level === profile.vip_level + 1);
  
  const consumed = parseFloat(profile.total_consumed) || 0;
  const max = currentTier.nextThreshold;
  const progressPercent = nextTier ? Math.min((consumed / max) * 100, 100) : 100;

  // 模拟一岛的特权矩阵
  const privileges = [
    { title: '优先购', sub: `${currentTier.level * 2}次/月`, icon: '⚡' },
    { title: '首发奖励', sub: `好友买入${currentTier.level * 5}%`, icon: '🎁' },
    { title: '寄售奖励', sub: `最高${currentTier.level * 8}%`, icon: '💰' },
    { title: '减手续费', sub: `寄售${100 - (currentTier.level * 5)}折`, icon: '📉' },
    { title: '免提现费', sub: `每月${currentTier.level}次`, icon: '🏧' },
    { title: '挂靠收益', sub: currentTier.level > 2 ? '开启' : '未解锁', icon: '📈' },
    { title: '平台分红', sub: currentTier.level === 5 ? '上不封顶' : '未解锁', icon: '📊' },
    { title: '求购权益', sub: `${currentTier.level * 500}个`, icon: '🛒' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>领主权益中心</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* 🌟 核心：阶级卡片 */}
        <View style={[styles.vipCard, { backgroundColor: currentTier.bg[0], borderColor: currentTier.bg[1] }]}>
           <View style={styles.cardHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={{fontSize: 24, marginRight: 8}}>{currentTier.icon}</Text>
                 <Text style={[styles.cardTitle, {color: currentTier.color}]}>{currentTier.name}</Text>
              </View>
              <Text style={[styles.cardLevel, {color: currentTier.color}]}>V{currentTier.level}</Text>
           </View>

           <Text style={[styles.upgradeTip, {color: currentTier.color}]}>
              {nextTier ? `完成指定任务可升级为 ${nextTier.name}` : '您已达到土豆岛权利的巅峰'}
           </Text>

           {/* 动态进度条 */}
           <View style={styles.progressContainer}>
              <View style={styles.progressTextRow}>
                 <Text style={[styles.progressVal, {color: currentTier.color}]}>{consumed.toFixed(0)} <Text style={{fontSize: 12}}>/ {nextTier ? max : 'MAX'}</Text></Text>
                 <Text style={[styles.progressLabel, {color: currentTier.color}]}>累计消费(元)</Text>
              </View>
              <View style={[styles.progressBarBg, {backgroundColor: 'rgba(0,0,0,0.1)'}]}>
                 <View style={[styles.progressBarFill, {width: `${progressPercent}%`, backgroundColor: currentTier.color}]} />
              </View>
           </View>
        </View>

        {/* 🌟 核心：特权矩阵 */}
        <View style={styles.section}>
           <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>✨ VIP 特权</Text>
              <Text style={styles.sectionSubTitle}>{currentTier.name}可享受下列会员权益</Text>
           </View>
           
           <View style={styles.grid}>
              {privileges.map((item, index) => (
                 <View key={index} style={styles.gridItem}>
                    <View style={styles.gridIcon}><Text style={{fontSize: 24}}>{item.icon}</Text></View>
                    <Text style={styles.gridTitle}>{item.title}</Text>
                    <Text style={styles.gridSub} numberOfLines={1}>{item.sub}</Text>
                 </View>
              ))}
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },

  // VIP 卡片
  vipCard: { margin: 20, borderRadius: 20, padding: 24, borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: {width: 0, height: 5}, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: '900' },
  cardLevel: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', opacity: 0.5 },
  upgradeTip: { fontSize: 13, marginBottom: 24, fontWeight: '600', opacity: 0.8 },
  
  progressContainer: { marginTop: 10 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  progressVal: { fontSize: 24, fontWeight: '900' },
  progressLabel: { fontSize: 12, opacity: 0.8, marginBottom: 4 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  // 特权矩阵
  section: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginRight: 10 },
  sectionSubTitle: { fontSize: 12, color: '#888' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: (width - 60) / 4, alignItems: 'center', marginBottom: 24 },
  gridIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  gridTitle: { fontSize: 13, fontWeight: '800', color: '#333', marginBottom: 4 },
  gridSub: { fontSize: 10, color: '#888' },
});