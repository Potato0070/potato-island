import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 定义藏品管理数据的 TypeScript 类型
interface AdminCollection {
  id: string;
  name: string;
  is_tradeable: boolean; // 寄售闸门状态
  max_price: number;     // 最高寄售限价
  supply: number;        // 流通量
}

// 模拟从数据库拉取的大盘数据
const MOCK_ADMIN_DATA: AdminCollection[] = [
  { id: '1', name: '马铃薯爵士', is_tradeable: true, max_price: 500.00, supply: 4920 },
  { id: '2', name: '至尊黑松露土豆泥', is_tradeable: false, max_price: 8888.00, supply: 12 }, // ⚠️ 默认锁仓，等待官方开盘
  { id: '3', name: '暗黑原生态土豆', is_tradeable: true, max_price: 300.00, supply: 15000 },
];

export default function AdminDashboardScreen() {
  const [collections, setCollections] = useState<AdminCollection[]>(MOCK_ADMIN_DATA);

  // 上帝指令一：开关寄售闸门
  const handleToggleGate = (id: string, currentStatus: boolean, name: string) => {
    const actionStr = currentStatus ? '关闭寄售' : '开启寄售';
    
    Alert.alert(
      `⚠️ 警告：${actionStr}`,
      `您正在对【${name}】执行宏观调控。\n${currentStatus ? '关闭后，全网将无法买卖此藏品，彻底锁死流动性！' : '开启后，压抑的资金将瞬间涌入二级市场！'}`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确认执行', 
          style: currentStatus ? 'destructive' : 'default',
          onPress: () => {
            setCollections(prev => prev.map(c => 
              c.id === id ? { ...c, is_tradeable: !currentStatus } : c
            ));
            // 此处应调用 Supabase RPC 真正更新 collections 表的 is_tradeable 字段
            Alert.alert('✅ 指令已生效', `【${name}】的流动性闸门已${currentStatus ? '关闭' : '开启'}。`);
          }
        }
      ]
    );
  };

  // 上帝指令二：调整天花板限价
  const handleUpdateCeiling = (id: string, name: string, currentCeiling: number) => {
    Alert.alert(
      '📈 调整最高限价',
      `当前【${name}】的寄售天花板为 ¥${currentCeiling.toFixed(2)}。\n请在后台系统谨慎上调此数值，以释放上涨空间。`,
      [
        { text: '稍后操作', style: 'cancel' },
        { text: '进入高级调价台', onPress: () => console.log('打开调价弹窗或新页面') }
      ]
    );
  };

  // 渲染单个藏品的控制面板
  const renderControlPanel = (item: AdminCollection) => (
    <View key={item.id} style={styles.panelCard}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemData}>全网流通: {item.supply} 份</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.is_tradeable ? '#D4EDDA' : '#F8D7DA' }]}>
          <Text style={[styles.statusText, { color: item.is_tradeable ? '#155724' : '#721C24' }]}>
            {item.is_tradeable ? '流通中' : '已冻结'}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* 核心控制区 */}
      <View style={styles.controlRow}>
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>市场流通闸门</Text>
          <Switch 
            value={item.is_tradeable}
            onValueChange={() => handleToggleGate(item.id, item.is_tradeable, item.name)}
            trackColor={{ false: '#767577', true: '#28A745' }}
            thumbColor={'#FFF'}
          />
        </View>

        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>最高限价天花板</Text>
          <TouchableOpacity 
            style={styles.ceilingBtn}
            onPress={() => handleUpdateCeiling(item.id, item.name, item.max_price)}
          >
            <Text style={styles.ceilingBtnText}>¥ {item.max_price.toFixed(2)} ➔</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 极具压迫感的黑色头部 */}
      <View style={styles.heroHeader}>
        <Text style={styles.heroTitle}>创世神控制台</Text>
        <Text style={styles.heroSub}>全局流动性与价格中枢</Text>
        
        {/* 全岛广播大喇叭 */}
        <TouchableOpacity style={styles.broadcastBtn} activeOpacity={0.8}>
          <Text style={styles.broadcastBtnText}>📢 发布全岛快照/空投公告</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>资产宏观调控</Text>
        {collections.map(renderControlPanel)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  
  heroHeader: { backgroundColor: '#111', padding: 24, paddingBottom: 30, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  heroSub: { color: '#888', fontSize: 13, marginTop: 4, fontWeight: '600' },
  broadcastBtn: { backgroundColor: '#FFD700', marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: '#FFD700', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  broadcastBtnText: { color: '#111', fontSize: 15, fontWeight: '800' },

  scrollContent: { padding: 16, paddingTop: 24, paddingBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 16, marginLeft: 4 },

  panelCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 18, fontWeight: '800', color: '#111' },
  itemData: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },

  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlItem: { flex: 1 },
  controlLabel: { fontSize: 12, color: '#888', marginBottom: 8, fontWeight: '600' },
  
  ceilingBtn: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#DDD', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  ceilingBtnText: { color: '#111', fontWeight: '800', fontSize: 14 },
});