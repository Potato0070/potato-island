import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// 导入你根目录配置好的 supabase 实例
import { supabase } from '../supabase';

// 定义用户资产数据的 TypeScript 接口
interface UserProfile {
  id: string;
  username: string;
  potato_coin_balance: number; // 法币/土豆币余额
  potato_card_balance: number; // 基础燃料卡
  wildcard_balance: number;    // 万能土豆卡
  pity_fragments: number;      // 垫刀残片保底
}

export default function WalletScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🚀 核心：从 Supabase 拉取真实钱包余额 (防弹安全版)
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // 获取当前用户的登录态
      const { data: { user } } = await supabase.auth.getUser();
      
      let profileData = null;
      let fetchError = null;

      if (user) {
        // 如果有登录状态，抓当前用户
        const res = await supabase.from('profiles').select('*').eq('id', user.id).single();
        profileData = res.data;
        fetchError = res.error;
      } else {
        // ⚠️ 本地测试兜底：没登录的话，抓取我们用 SQL 捏出来的【创世神】账号
        // 使用 .limit(1) 防范空表导致的 .single() 报错
        const res = await supabase.from('profiles').select('*').limit(1);
        profileData = res.data && res.data.length > 0 ? res.data[0] : null;
        fetchError = res.error;
      }

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (profileData) {
        setProfile(profileData as UserProfile);
      } else {
        // 如果连兜底账号都没有，给个温柔的提示
        Alert.alert('空空如也', '数据库 profiles 表里还没有任何账号，快去跑一下那段创世印钞 SQL！');
      }
    } catch (err: any) {
      console.error('获取钱包数据失败:', err);
      Alert.alert('网络拦截', err.message || '请检查网络或数据库连接');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  // 模拟充值与提现按钮点击
  const handleAction = (action: string) => {
    Alert.alert(`🏦 ${action}功能`, '系统级法币通道正在对接中...', [{ text: '我知道了' }]);
  };

  // 加载中状态展示
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.loadingText}>正在打开数字金库...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部导航 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>数字金库</Text>
        <Text style={styles.headerSub}>欢迎回来，{profile?.username || '未实名岛民'}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />}
      >
        {/* 1. 核心法币资产卡片 (黑金压迫感) */}
        <View style={styles.mainAssetCard}>
          <Text style={styles.cardLabel}>当前可用土豆币 (¥)</Text>
          <Text style={styles.mainBalance}>
            {profile?.potato_coin_balance ? profile.potato_coin_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.depositBtn} onPress={() => handleAction('充值')} activeOpacity={0.8}>
              <Text style={styles.depositBtnText}>充值</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => handleAction('提现')} activeOpacity={0.8}>
              <Text style={styles.withdrawBtnText}>提现</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. 生态通缩燃料矩阵 (双列布局) */}
        <Text style={styles.sectionTitle}>生态资产与燃料</Text>
        <View style={styles.fuelMatrix}>
          
          {/* 基础燃料：Potato卡 */}
          <View style={[styles.fuelCard, { marginRight: 8 }]}>
            <View style={styles.fuelHeader}>
              <Text style={styles.fuelName}>Potato 卡</Text>
              <View style={styles.badgeBase}><Text style={styles.badgeTextBase}>基础</Text></View>
            </View>
            <Text style={styles.fuelAmount}>{profile?.potato_card_balance || 0}</Text>
            <Text style={styles.fuelDesc}>全岛唯一流通燃料</Text>
          </View>

          {/* 顶级资产：万能卡 */}
          <View style={[styles.fuelCard, { marginLeft: 8, borderColor: '#FBC02D', borderWidth: 1 }]}>
            <View style={styles.fuelHeader}>
              <Text style={styles.fuelName}>万能土豆卡</Text>
              <View style={styles.badgeGod}><Text style={styles.badgeTextGod}>极品</Text></View>
            </View>
            <Text style={[styles.fuelAmount, { color: '#F57F17' }]}>{profile?.wildcard_balance || 0}</Text>
            <Text style={styles.fuelDesc}>合成公式的终极润滑剂</Text>
          </View>
        </View>

        {/* 3. 保底机制与数据 */}
        <View style={styles.pityCard}>
          <View>
            <Text style={styles.pityTitle}>合成保底残片</Text>
            <Text style={styles.pityDesc}>满 100 个可兑换 100% 成功合成机会</Text>
          </View>
          <Text style={styles.pityAmount}>{profile?.pity_fragments || 0} <Text style={{ fontSize: 14, color: '#888' }}>/ 100</Text></Text>
        </View>

        {/* 4. 金融流水入口 */}
        <Text style={styles.sectionTitle}>交易管理</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuText}>🧾 资金与燃料流水</Text>
            <Text style={styles.menuArrow}>➔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <Text style={styles.menuText}>📈 我的挂单 (一口价)</Text>
            <Text style={styles.menuArrow}>➔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} activeOpacity={0.7}>
            <Text style={styles.menuText}>🔥 我的求购单 (Gas插队)</Text>
            <Text style={styles.menuArrow}>➔</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { marginTop: 16, color: '#666', fontSize: 14, fontWeight: '600' },
  
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#111' },
  headerSub: { fontSize: 14, color: '#666', marginTop: 4, fontWeight: '600' },
  
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // 核心法币卡片（黑金压迫感）
  mainAssetCard: { backgroundColor: '#111', borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  cardLabel: { color: '#AAA', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  mainBalance: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: 1, marginBottom: 24 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  depositBtn: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginRight: 8 },
  depositBtnText: { color: '#111', fontSize: 16, fontWeight: '800' },
  withdrawBtn: { flex: 1, backgroundColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginLeft: 8 },
  withdrawBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 12, marginLeft: 4 },
  
  // 燃料矩阵
  fuelMatrix: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  fuelCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  fuelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  fuelName: { fontSize: 15, fontWeight: '800', color: '#111' },
  badgeBase: { backgroundColor: '#E9ECEF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTextBase: { fontSize: 10, color: '#495057', fontWeight: '800' },
  badgeGod: { backgroundColor: '#FFF9C4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTextGod: { fontSize: 10, color: '#F57F17', fontWeight: '800' },
  fuelAmount: { fontSize: 28, fontWeight: '900', color: '#111', marginBottom: 4 },
  fuelDesc: { fontSize: 11, color: '#999', fontWeight: '500' },

  // 残片保底
  pityCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  pityTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 4 },
  pityDesc: { fontSize: 12, color: '#888' },
  pityAmount: { fontSize: 24, fontWeight: '900', color: '#111' },

  // 菜单列表
  menuGroup: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  menuText: { fontSize: 15, fontWeight: '700', color: '#333' },
  menuArrow: { fontSize: 16, color: '#CCC', fontWeight: '800' },
});