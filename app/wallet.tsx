import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 🌟 交易类型人性化中文映射字典
const TYPE_MAP: Record<string, string> = {
  'direct_buy': '大盘现货',
  'bid_match': '委托撮合',
  'launch_mint': '首发盲盒',
  'system_airdrop': '系统空投',
  'genesis_exchange': '创世兑换',
  '好友转赠': '好友转赠'
};

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState('0.00');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchWalletData();
  }, []));

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 获取最新余额
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
      if (profile) setBalance((profile.potato_coin_balance || 0).toFixed(2));

      // 2. 智能聚合所有资金与资产流转水
      const { data: transferData } = await supabase.from('transfer_logs')
        .select('*, collections(name)')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order('transfer_time', { ascending: false });

      if (transferData) {
        const formattedLogs = transferData.map(log => {
           const isIncome = log.seller_id === user.id;
           const colName = Array.isArray(log.collections) ? log.collections[0]?.name : log.collections?.name;
           const targetName = colName || '神秘藏品';
           const typeStr = TYPE_MAP[log.transfer_type] || '资金流转';

           // 🌟 核心：针对不同类型的交易，组合出极具可读性的文案
           let titleStr = '';
           let amountStr = '';
           let amountColor = '#111';

           if (log.transfer_type === '好友转赠') {
               titleStr = isIncome ? `赠出藏品 (${targetName})` : `收到赠礼 (${targetName})`;
               amountStr = isIncome ? '- 1 张转赠卡' : '+ 1 件藏品';
               amountColor = isIncome ? '#888' : '#4CD964';
           } else {
               titleStr = isIncome ? `出售收益 (${targetName})` : `购买支出 (${targetName})`;
               amountStr = isIncome ? `+ ¥${log.price}` : `- ¥${log.price}`;
               amountColor = isIncome ? '#4CD964' : '#111';
           }

           return {
              id: log.id,
              title: titleStr,
              amount: amountStr,
              amountColor: amountColor,
              time: new Date(log.transfer_time).toLocaleString(),
              type: typeStr
           };
        });
        setLogs(formattedLogs);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderLogItem = ({ item }: { item: any }) => (
    <View style={styles.logRow}>
       <View style={styles.logLeft}>
          <Text style={styles.logTitle}>{item.title}</Text>
          <View style={styles.tagRow}>
             <View style={styles.typeTag}><Text style={styles.typeTagText}>{item.type}</Text></View>
             <Text style={styles.logTime}>{item.time}</Text>
          </View>
       </View>
       <Text style={[styles.logAmount, {color: item.amountColor}]}>
          {item.amount}
       </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>我的钱包</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.walletCard}>
         <Text style={styles.cardLabel}>土豆币可用余额 (¥)</Text>
         <Text style={styles.cardBalance}>{balance}</Text>
         <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => alert('充值通道暂未开放')}>
               <Text style={styles.actionBtnText}>充值</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => alert('提现通道暂未开放')}>
               <Text style={styles.actionBtnOutlineText}>提现</Text>
            </TouchableOpacity>
         </View>
      </View>

      <View style={styles.logSection}>
         <Text style={styles.sectionTitle}>近期账单明细</Text>
         {loading ? (
            <ActivityIndicator color="#FFD700" style={{marginTop: 50}} />
         ) : (
            <FlatList
              data={logs}
              renderItem={renderLogItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{paddingBottom: 50}}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 30}}>暂无资金流水记录</Text>}
            />
         )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  walletCard: { backgroundColor: '#111', margin: 16, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: {width: 0, height: 5}, elevation: 5 },
  cardLabel: { color: '#CCC', fontSize: 13, marginBottom: 8 },
  cardBalance: { color: '#FFD700', fontSize: 40, fontWeight: '900', marginBottom: 24, fontFamily: 'monospace' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 0.48, backgroundColor: '#FFD700', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: '#111', fontSize: 16, fontWeight: '900' },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  actionBtnOutlineText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  logSection: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 16 },
  
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  logLeft: { flex: 1, marginRight: 16 },
  logTitle: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 8 },
  tagRow: { flexDirection: 'row', alignItems: 'center' },
  typeTag: { backgroundColor: '#F0F6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  typeTagText: { color: '#0066FF', fontSize: 10, fontWeight: '800' },
  logTime: { fontSize: 11, color: '#999' },
  logAmount: { fontSize: 18, fontWeight: '900', fontFamily: 'monospace' }
});