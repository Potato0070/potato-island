import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function MyNftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchMyNft();
  }, [id]);

  const fetchMyNft = async () => {
    try {
      const { data, error } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).single();
      if (error) throw error;
      setNft(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // 🛡️ 核心：撤销挂单的二次确认逻辑
  const handleCancelList = () => {
    Alert.alert(
      '🚨 撤单确认',
      `您确定要将【${nft?.collections?.name}】从大盘撤下吗？\n撤下后，该藏品将回到您的金库变为闲置状态。`,
      [
        { text: '再想想', style: 'cancel' },
        { 
          text: '确认撤回', 
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              // 更新状态为 idle，清空挂单价。底层触发器会自动同步大盘在售数量！
              const { error } = await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', id);
              if (error) throw error;
              
              Alert.alert('✅ 撤回成功', '藏品已安全退回金库！');
              fetchMyNft(); // 刷新页面状态
            } catch (err: any) { Alert.alert('失败', err.message); } finally { setProcessing(false); }
          }
        }
      ]
    );
  };

  // 🛡️ 转移操作的二次拦截 (如果后续加上这功能的话，先预留)
  const handleGoTransfer = () => {
    Alert.alert('流转提示', '前往转赠页面将消耗 1 张转赠卡，是否继续？', [
      { text: '取消', style: 'cancel' },
      { text: '前往', onPress: () => router.push('/transfer') }
    ]);
  };

  if (loading || !nft) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  const hashString = nft.id.replace(/-/g, '').toUpperCase();
  const isListed = nft.status === 'listed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>资产管理</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* 顶部展台 */}
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}>
              <Image source={{ uri: nft.collections?.image_url }} style={styles.mainImg} />
           </View>
           <View style={styles.shadowOval} />
           
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#4CD964'}]}>
               <Text style={styles.statusBadgeText}>{isListed ? `寄售中 (¥${nft.consign_price})` : '金库闲置'}</Text>
           </View>
        </View>

        {/* 资产信息 */}
        <View style={styles.infoSection}>
           <Text style={styles.sectionTitle}>资产档案</Text>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>系列名称</Text>
              <Text style={styles.infoValue}>{nft.collections?.name}</Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>唯一编号</Text>
              <Text style={styles.infoValueHigh}>#{String(nft.serial_number).padStart(6, '0')}</Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>获得时间</Text>
              <Text style={styles.infoValue}>{new Date(nft.created_at).toLocaleDateString()}</Text>
           </View>
           <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>底层哈希</Text>
              <Text style={styles.infoHash} numberOfLines={1}>{hashString}</Text>
           </View>
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
         {isListed ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelList} disabled={processing}>
               {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.cancelBtnText}>撤销寄售</Text>}
            </TouchableOpacity>
         ) : (
            <>
              <TouchableOpacity style={styles.subActionBtn} onPress={handleGoTransfer}>
                 <Text style={styles.subActionText}>转赠</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mainActionBtn} onPress={() => router.push({pathname: '/publish-consign', params: {id: nft.id}})}>
                 <Text style={styles.mainActionText}>前往寄售大盘</Text>
              </TouchableOpacity>
            </>
         )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 16, fontWeight: '800', color: '#111' },

  stageContainer: { alignItems: 'center', backgroundColor: '#F0F0F5', paddingVertical: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20 },
  floatBox: { padding: 10, backgroundColor: '#FFF', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: {width: 0, height: 10}, elevation: 10, zIndex: 2 },
  mainImg: { width: width * 0.45, height: width * 0.45, borderRadius: 8, resizeMode: 'cover' },
  shadowOval: { width: width * 0.35, height: 15, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '50%', marginTop: 20, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  infoSection: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#111', fontWeight: '800' },
  infoValueHigh: { fontSize: 16, color: '#D49A36', fontWeight: '900', fontFamily: 'monospace' },
  infoHash: { fontSize: 10, color: '#999', fontFamily: 'monospace', width: 180, textAlign: 'right' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05, elevation: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FF3B30', paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  cancelBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '900' },
  
  subActionBtn: { flex: 0.3, backgroundColor: '#F0F6FF', paddingVertical: 14, borderRadius: 25, alignItems: 'center', marginRight: 12 },
  subActionText: { color: '#0066FF', fontSize: 15, fontWeight: '800' },
  mainActionBtn: { flex: 0.7, backgroundColor: '#0066FF', paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  mainActionText: { color: '#FFF', fontSize: 16, fontWeight: '900' }
});