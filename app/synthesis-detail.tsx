import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function SynthesisDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [eventData, setEventData] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [canSynthesize, setCanSynthesize] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // 1. 拉取合成活动主信息
      const { data: evData, error: evErr } = await supabase
        .from('synthesis_events')
        .select('*, target_collection:target_collection_id(name, image_url, description)')
        .eq('id', id)
        .single();
      if (evErr) throw evErr;

      // 🔥 防弹修复 1：目标产物类型安全化
      if (evData && evData.target_collection) {
          const tc: any = evData.target_collection;
          evData.target_collection = Array.isArray(tc) ? tc[0] : tc;
      }
      setEventData(evData);

      // 2. 拉取所需的献祭材料清单
      const { data: reqData, error: reqErr } = await supabase
        .from('synthesis_requirements')
        .select('req_count, collection:req_collection_id(id, name, image_url)')
        .eq('event_id', id);
      if (reqErr) throw reqErr;

      // 3. 盘点玩家金库里的闲置材料
      let userInventory: Record<string, number> = {};
      if (user) {
          const { data: nfts } = await supabase
              .from('nfts')
              .select('collection_id')
              .eq('owner_id', user.id)
              .eq('status', 'idle');
          
          if (nfts) {
              nfts.forEach(nft => {
                  userInventory[nft.collection_id] = (userInventory[nft.collection_id] || 0) + 1;
              });
          }
      }

      // 4. 🔥 防弹修复 2：材料类型安全化，并合并数据
      let allMet = true;
      const enrichedReqs = (reqData || []).map(req => {
          // 剥除可能的数组外壳，安全提取 ID
          const c: any = req.collection;
          const colObj = Array.isArray(c) ? (c[0] || {}) : (c || {});
          const colId = colObj.id;
          
          const owned = colId ? (userInventory[colId] || 0) : 0;
          const isMet = owned >= req.req_count;
          if (!isMet) allMet = false;
          
          return {
              ...req,
              collection: colObj, // 把剥好皮的安全对象覆盖回去
              owned_count: owned,
              is_met: isMet
          };
      });

      setRequirements(enrichedReqs);
      
      // 判断熔断和时间
      const isMelted = evData.max_count > 0 && evData.current_count >= evData.max_count;
      const isExpired = new Date(evData.end_time).getTime() < new Date().getTime();
      
      setCanSynthesize(allMet && !isMelted && !isExpired && !!user);

    } catch (err: any) {
      Alert.alert('获取失败', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDetail(); }, [id]));

  // 🚀 触发原子级变异合约
  const handleSynthesize = async () => {
      if (!canSynthesize) return;
      
      Alert.alert(
          '⚠️ 危险警告', 
          '献祭一旦开始不可逆！所有作为材料的藏品将被永久销毁！是否确认开启变异？',
          [
              { text: '取消', style: 'cancel' },
              { text: '确认献祭', style: 'destructive', onPress: executeContract }
          ]
      );
  };

  const executeContract = async () => {
      setSynthesizing(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('请先登录');

          const { error } = await supabase.rpc('execute_nft_synthesis', {
              p_user_id: user.id,
              p_event_id: id
          });

          if (error) throw error;

          Alert.alert('🧬 变异成功！', `神圣的火焰吞噬了材料！恭喜你获得了全新的【${eventData.target_collection?.name || '神级资产'}】！`, [
              { text: '查看金库', onPress: () => router.push('/(tabs)/profile') },
              { text: '继续合成', onPress: () => fetchDetail() }
          ]);

      } catch (err: any) {
          Alert.alert('变异失败', err.message);
      } finally {
          setSynthesizing(false);
      }
  };

  if (loading || !eventData) return <View style={styles.center}><ActivityIndicator color="#00E5FF" /></View>;

  const isMelted = eventData.max_count > 0 && eventData.current_count >= eventData.max_count;
  const isExpired = new Date(eventData.end_time).getTime() < new Date().getTime();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>配方实验室</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* 顶部目标神级产物展示 */}
        <ImageBackground source={{ uri: eventData.target_collection?.image_url }} style={styles.topStage} blurRadius={30}>
            <View style={styles.stageOverlay}>
                <Image source={{ uri: eventData.target_collection?.image_url }} style={styles.targetImage} />
                <View style={styles.targetBadge}><Text style={styles.targetBadgeText}>终极变异产物</Text></View>
                <Text style={styles.targetName}>{eventData.target_collection?.name}</Text>
                
                <View style={styles.statusBox}>
                    <Text style={styles.statusText}>
                        全岛限量: <Text style={{color: '#00E5FF'}}>{eventData.max_count === 0 ? '无限' : eventData.max_count}</Text>
                    </Text>
                    <Text style={styles.statusText}>
                        已被合成: <Text style={{color: '#FFD700'}}>{eventData.current_count}</Text>
                    </Text>
                </View>
            </View>
        </ImageBackground>

        {/* 中间材料盘点区 */}
        <View style={styles.reqContainer}>
            <View style={styles.reqHeader}>
                <Text style={styles.reqTitle}>🧬 必须献祭的材料</Text>
                <Text style={styles.reqSubtitle}>系统已自动盘点您的金库</Text>
            </View>

            {requirements.map((req, index) => (
                <View key={index} style={styles.reqCard}>
                    <Image source={{ uri: req.collection?.image_url }} style={styles.reqImg} />
                    <View style={styles.reqInfo}>
                        <Text style={styles.reqName} numberOfLines={1}>{req.collection?.name}</Text>
                        <View style={styles.progressRow}>
                            <Text style={styles.progressLabel}>需要数量: {req.req_count}</Text>
                            <Text style={[styles.progressValue, req.is_met ? {color: '#00E5FF'} : {color: '#FF3B30'}]}>
                                拥有: {req.owned_count}
                            </Text>
                        </View>
                        {/* 进度条可视化 */}
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { 
                                width: `${Math.min((req.owned_count / req.req_count) * 100, 100)}%`,
                                backgroundColor: req.is_met ? '#00E5FF' : '#FF3B30'
                            }]} />
                        </View>
                    </View>
                </View>
            ))}
        </View>

      </ScrollView>

      {/* 底部操作台 */}
      <View style={styles.bottomBar}>
         {isMelted ? (
             <View style={[styles.actionBtn, {backgroundColor: '#333'}]}>
                 <Text style={{color: '#888', fontWeight: '800'}}>通道已熔断</Text>
             </View>
         ) : isExpired ? (
             <View style={[styles.actionBtn, {backgroundColor: '#333'}]}>
                 <Text style={{color: '#888', fontWeight: '800'}}>配方已失效</Text>
             </View>
         ) : (
             <TouchableOpacity 
                 style={[styles.actionBtn, !canSynthesize && {backgroundColor: '#333', borderColor: '#555'}]} 
                 activeOpacity={0.8}
                 disabled={!canSynthesize || synthesizing}
                 onPress={handleSynthesize}
             >
                 {synthesizing ? <ActivityIndicator color="#000" /> : (
                     <Text style={[styles.actionBtnText, !canSynthesize && {color: '#888'}]}>
                         {canSynthesize ? '⚡ 启动变异炉' : '材料不足，前往集市扫货'}
                     </Text>
                 )}
             </TouchableOpacity>
         )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0B0C' },
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#0B0B0C' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#00E5FF', fontWeight: 'bold' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 2 },

  topStage: { width: width, height: 320, backgroundColor: '#111' },
  stageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 30 },
  targetImage: { width: 140, height: 140, borderRadius: 16, borderWidth: 2, borderColor: '#00E5FF', marginBottom: -15, zIndex: 2 },
  targetBadge: { backgroundColor: '#00E5FF', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20, zIndex: 3, shadowColor: '#00E5FF', shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  targetBadgeText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  targetName: { fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 16, letterSpacing: 2, textShadowColor: '#00E5FF', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 10 },
  
  statusBox: { flexDirection: 'row', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  statusText: { color: '#CCC', fontSize: 12, fontWeight: '700', marginHorizontal: 10 },

  reqContainer: { padding: 20, marginTop: -20, backgroundColor: '#0B0B0C', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  reqHeader: { marginBottom: 20 },
  reqTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  reqSubtitle: { fontSize: 12, color: '#666' },

  reqCard: { flexDirection: 'row', backgroundColor: '#161618', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A2D' },
  reqImg: { width: 60, height: 60, borderRadius: 8, marginRight: 16 },
  reqInfo: { flex: 1, justifyContent: 'center' },
  reqName: { fontSize: 15, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  progressValue: { fontSize: 14, fontWeight: '900' },
  
  progressBarBg: { height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(11, 11, 12, 0.95)', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderTopWidth: 1, borderColor: '#222' },
  actionBtn: { height: 55, backgroundColor: '#00E5FF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  actionBtnText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
});