import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

// 💰 千分位金额格式化
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

// ⏱️ 坚如磐石的日期格式化 (终结 Invalid Date)
const formatDate = (dateString: string) => {
  if (!dateString) return '未知时间';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString.split('T')[0] + ' ' + dateString.split('T')[1].substring(0,8);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateString;
  }
};

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
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchWalletData();
  }, []));

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 获取最新余额
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
      if (profile) setBalance(profile.potato_coin_balance || 0);

      // 2. 查全岛藏品名字典
      const { data: cols } = await supabase.from('collections').select('id, name');
      const colMap: any = {};
      if (cols) cols.forEach(c => colMap[c.id] = c.name);

      let allLogs: any[] = [];

      // 3. 拉取所有交易流水 (包括买、卖、收空投、转赠)
      const { data: transferData } = await supabase.from('transfer_logs')
        .select('*')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`);

      if (transferData) {
        transferData.forEach(log => {
           const isIncome = log.seller_id === user.id;
           const targetName = colMap[log.collection_id] || '神秘藏品';
           const typeStr = TYPE_MAP[log.transfer_type] || '资金流转';

           let titleStr = '';
           let amountStr = '';
           let amountColor = '#4E342E';
           let isTransferCard = false;

           if (log.transfer_type === '好友转赠') {
               isTransferCard = true;
               titleStr = isIncome ? `赠出藏品 (${targetName})` : `收到赠礼 (${targetName})`;
               amountStr = isIncome ? '- 1 张介质' : '+ 1 件藏品';
               amountColor = isIncome ? '#A1887F' : '#D49A36';
           } else {
               titleStr = isIncome ? `出售收益 (${targetName})` : `购买支出 (${targetName})`;
               amountStr = isIncome ? `+ ¥${formatMoney(log.price)}` : `- ¥${formatMoney(log.price)}`;
               amountColor = isIncome ? '#D49A36' : '#4E342E'; // 金色代表收入，深咖色代表支出
           }

           allLogs.push({
              id: 't_' + log.id,
              title: titleStr,
              amount: amountStr,
              amountColor: amountColor,
              isTransferCard: isTransferCard,
              time: new Date(log.transfer_time).getTime(),
              timeStr: formatDate(log.transfer_time),
              type: typeStr
           });
        });
      }

      // 4. 拉取所有求购/竞拍产生的资金冻结与解冻记录
      const { data: orderData } = await supabase.from('buy_orders')
        .select('*')
        .eq('buyer_id', user.id);

      if (orderData) {
         orderData.forEach(order => {
            const targetName = colMap[order.collection_id] || '神秘藏品';
            const totalCost = formatMoney(order.price * order.quantity);
            const isBid = order.order_type === 'bid';
            
            // 只要发起过订单，必定有一笔最初的【资金冻结】记录
            allLogs.push({
                id: 'o_c_' + order.id,
                title: `发布${isBid ? '竞拍单' : '求购单'} (${targetName})`,
                amount: `- ¥${totalCost}`,
                amountColor: '#4E342E',
                isTransferCard: false,
                time: new Date(order.created_at).getTime(),
                timeStr: formatDate(order.created_at),
                type: '资金冻结'
            });

            // 🌟 核心补全：如果你撤单了，或者竞价被别人超了退钱了，记录一笔【资金退回】
            if (order.status === 'cancelled') {
                allLogs.push({
                    id: 'o_r_' + order.id,
                    title: `撤销${isBid ? '竞拍单' : '求购单'} (${targetName})`,
                    amount: `+ ¥${totalCost}`,
                    amountColor: '#D49A36', // 收入/退款用金色
                    isTransferCard: false,
                    // 模拟一个退款时间（为了排序在冻结之后）
                    time: new Date(order.created_at).getTime() + 1000, 
                    timeStr: formatDate(order.created_at), // 实际应用中最好有个 updated_at 字段
                    type: '解冻退回'
                });
            }
         });
      }

      // 5. 按时间流绝对顺序排序（时间戳从大到小）
      allLogs.sort((a, b) => b.time - a.time);
      setLogs(allLogs);

    } catch (err: any) { 
      Alert.alert("加载失败", err.message);
    } finally { 
      setLoading(false); 
      setRefreshing(false);
    }
  };

  const renderLogItem = ({ item }: { item: any }) => (
    <View style={styles.logRow}>
       <View style={styles.logLeft}>
          <Text style={styles.logTitle}>{item.title}</Text>
          <View style={styles.tagRow}>
             <View style={[styles.typeTag, item.type.includes('退回') && {backgroundColor: '#FDF8F0', borderColor: '#D49A36'}, item.type.includes('冻结') && {backgroundColor: '#F5EFE6', borderColor: '#A1887F'}]}>
                <Text style={[styles.typeTagText, item.type.includes('退回') && {color: '#D49A36'}, item.type.includes('冻结') && {color: '#8D6E63'}]}>{item.type}</Text>
             </View>
             <Text style={styles.logTime}>{item.timeStr}</Text>
          </View>
       </View>
       <Text style={[styles.logAmount, {color: item.amountColor}, item.isTransferCard && {fontSize: 14, fontFamily: 'System'}]}>
           {item.amount}
       </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>我的金库账本</Text>
        <View style={styles.navBtn} />
      </View>

      {/* 🌟 顶级财富面板：复古琥珀金 */}
      <View style={styles.walletCard}>
         <View style={styles.cardHeader}>
             <Text style={styles.cardLabel}>土豆币可用余额 (¥)</Text>
             <TouchableOpacity style={styles.historyBtn} onPress={() => alert('暂未开放历史全账单')}>
                <Text style={styles.historyBtnText}>总账单 〉</Text>
             </TouchableOpacity>
         </View>
         <Text style={styles.cardBalance} numberOfLines={1}>{formatMoney(balance)}</Text>
         
         <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); alert('官方充值通道即将开放'); }}>
               <Text style={styles.actionBtnText}>🪙 去充值</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); alert('您还未绑定提现账户'); }}>
               <Text style={styles.actionBtnOutlineText}>🏦 提现</Text>
            </TouchableOpacity>
         </View>
      </View>

      <View style={styles.logSection}>
         <Text style={styles.sectionTitle}>近期流水明细</Text>
         
         {loading ? (
            <ActivityIndicator color="#D49A36" style={{marginTop: 50}} />
         ) : (
            <FlatList
              data={logs}
              renderItem={renderLogItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{paddingBottom: 100}}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />}
              ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 80}}><Text style={{fontSize: 60, marginBottom: 10}}>📜</Text><Text style={{color: '#8D6E63', fontWeight: '800'}}>您的金库尚未发生任何流转记录</Text></View>}
            />
         )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' }, 
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  // 🌟 财富面板重构
  walletCard: { backgroundColor: '#2C1E16', marginHorizontal: 16, marginTop: 10, marginBottom: 24, borderRadius: 20, padding: 24, shadowColor: '#4E342E', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: {width: 0, height: 8}, elevation: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { color: '#EAE0D5', fontSize: 13, fontWeight: '600' },
  historyBtn: { backgroundColor: 'rgba(212,154,54,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,154,54,0.3)' },
  historyBtnText: { color: '#D49A36', fontSize: 10, fontWeight: '800' },
  cardBalance: { color: '#D49A36', fontSize: 44, fontWeight: '900', marginBottom: 24, fontFamily: 'monospace' },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 0.48, backgroundColor: '#D49A36', paddingVertical: 14, borderRadius: 14, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, elevation: 2 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  actionBtnOutline: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#A1887F', shadowOpacity: 0 },
  actionBtnOutlineText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  logSection: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#EAE0D5' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 8 },
  
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  logLeft: { flex: 1, marginRight: 16 },
  logTitle: { fontSize: 15, fontWeight: '900', color: '#4E342E', marginBottom: 8 },
  
  tagRow: { flexDirection: 'row', alignItems: 'center' },
  typeTag: { backgroundColor: '#FDF8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8, borderWidth: 1, borderColor: '#EAE0D5' },
  typeTagText: { color: '#8D6E63', fontSize: 10, fontWeight: '800' },
  logTime: { fontSize: 11, color: '#A1887F', fontWeight: '600' },
  
  logAmount: { fontSize: 18, fontWeight: '900', fontFamily: 'monospace' }
});