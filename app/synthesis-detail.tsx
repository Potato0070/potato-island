import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

export default function SynthesisDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [eventData, setEventData] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);

  // 底部弹窗材料选择器状态
  const [showPicker, setShowPicker] = useState(false);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]);
  const [tempSelectedNfts, setTempSelectedNfts] = useState<string[]>([]); // 弹窗内临时选择的状态
  
  // 最终确认的材料槽状态
  const [selectedNfts, setSelectedNfts] = useState<Record<number, string[]>>({});

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const { data: ev, error: evErr } = await supabase
        .from('synthesis_events')
        .select(`*, target_collection:target_collection_id(name, image_url)`)
        .eq('id', id)
        .single();
      if (evErr) throw evErr;
      setEventData(ev);

      const { data: reqs, error: reqErr } = await supabase
        .from('synthesis_requirements')
        .select(`*, collection:req_collection_id(name, image_url)`)
        .eq('event_id', id);
      if (reqErr) throw reqErr;
      setRequirements(reqs || []);
    } catch (err: any) {
      Alert.alert('获取配方失败', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // 打开底部选材面板
  const openMaterialPicker = async (reqIndex: number) => {
    setActiveReqIndex(reqIndex);
    setShowPicker(true);
    setMyIdleNfts([]);
    // 将已确认的选择同步到临时状态，方便回显
    setTempSelectedNfts(selectedNfts[reqIndex] || []);
    
    const req = requirements[reqIndex];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('nfts')
        .select('id, serial_number')
        .eq('collection_id', req.req_collection_id)
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .order('serial_number', { ascending: true });
        
      if (data) setMyIdleNfts(data);
    } catch (e) { console.error(e); }
  };

  // 弹窗内的单选/取消逻辑
  const toggleTempSelection = (nftId: string) => {
    if (activeReqIndex === null) return;
    const req = requirements[activeReqIndex];
    
    if (tempSelectedNfts.includes(nftId)) {
      setTempSelectedNfts(tempSelectedNfts.filter(id => id !== nftId));
    } else {
      if (tempSelectedNfts.length >= req.req_count) {
         Alert.alert('提示', `最多只需选择 ${req.req_count} 个`);
         return;
      }
      setTempSelectedNfts([...tempSelectedNfts, nftId]);
    }
  };

  // 确认注入，把临时状态写入主状态
  const confirmSelection = () => {
    if (activeReqIndex === null) return;
    setSelectedNfts({ ...selectedNfts, [activeReqIndex]: tempSelectedNfts });
    setShowPicker(false);
  };

  const handleExecute = async () => {
    let allNftsToBurn: string[] = [];
    for (let i = 0; i < requirements.length; i++) {
      const selected = selectedNfts[i] || [];
      if (selected.length < requirements[i].req_count) {
        return Alert.alert('提示', '请填满所有要求的材料槽！');
      }
      allNftsToBurn = [...allNftsToBurn, ...selected];
    }

    setSynthesizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('execute_synthesis', {
        p_user_id: user?.id,
        p_event_id: id,
        p_material_nft_ids: allNftsToBurn
      });
      if (error) throw error;
      
      Alert.alert('🧬 融合成功', `材料已消耗！恭喜获得【${eventData.target_collection.name}】！`, [
        { text: '查看金库', onPress: () => router.replace('/(tabs)/profile') }
      ]);
    } catch (err: any) {
      Alert.alert('失败', err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading || !eventData) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部导航 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>融合配方</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 16, alignItems: 'center'}}>
        {/* 目标产物展示区 (参考视频顶部大图) */}
        <View style={styles.targetStage}>
           <Image source={{ uri: eventData.target_collection?.image_url || 'https://via.placeholder.com/300' }} style={styles.targetImage} />
           <View style={styles.targetInfo}>
             <Text style={styles.targetName}>[ {eventData.name} ]</Text>
             <Text style={styles.targetSub}>剩余额度: {eventData.max_count > 0 ? eventData.max_count - eventData.current_count : '无限'} 份</Text>
           </View>
        </View>

        <Text style={styles.sectionHeader}>请放入合成材料</Text>

        {/* 动态材料槽列表 */}
        <View style={styles.materialsList}>
          {requirements.map((req, index) => {
            const selectedCount = (selectedNfts[index] || []).length;
            const isFull = selectedCount === req.req_count;
            return (
              <View key={req.id} style={styles.reqRow}>
                 <View style={styles.reqInfo}>
                    <Image source={{ uri: req.collection.image_url }} style={styles.reqThumb} />
                    <View>
                       <Text style={styles.reqName}>{req.collection.name}</Text>
                       <Text style={styles.reqCountText}>需求: {req.req_count} 张</Text>
                    </View>
                 </View>
                 
                 <TouchableOpacity 
                   style={[styles.addBtn, isFull ? styles.addBtnFull : null]}
                   onPress={() => openMaterialPicker(index)}
                 >
                    <Text style={[styles.addBtnText, isFull ? {color: '#FFF'} : null]}>
                      {isFull ? `已放入 (${selectedCount}/${req.req_count})` : `+ 选择材料 (${selectedCount}/${req.req_count})`}
                    </Text>
                 </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 底部确认合成按钮 */}
      <View style={styles.bottomBar}>
         <TouchableOpacity style={styles.cyberBtn} activeOpacity={0.8} onPress={handleExecute} disabled={synthesizing}>
            {synthesizing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.cyberBtnText}>确认融合</Text>}
         </TouchableOpacity>
      </View>

      {/* 🌟 重磅优化：底部滑出式材料选择面板 (Bottom Sheet) */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择材料</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#999', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>

             {activeReqIndex !== null && (
               <Text style={styles.sheetSubTitle}>
                 请选择 {requirements[activeReqIndex].req_count} 个【{requirements[activeReqIndex].collection.name}】
               </Text>
             )}

             <ScrollView style={{flex: 1, paddingHorizontal: 16}}>
                {myIdleNfts.length === 0 ? (
                  <View style={{alignItems: 'center', marginTop: 50}}>
                     <Text style={{color: '#999', marginBottom: 20}}>暂无可用的此藏品</Text>
                     <TouchableOpacity style={styles.goMarketBtn} onPress={() => { setShowPicker(false); router.push('/(tabs)/market'); }}>
                       <Text style={{color: '#0066FF', fontWeight: '800'}}>去交易集市扫货</Text>
                     </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nftGrid}>
                    {myIdleNfts.map((nft) => {
                      const isSelected = tempSelectedNfts.includes(nft.id);
                      const req = requirements[activeReqIndex as number];
                      const thumbUrl = req?.collection?.image_url;

                      return (
                        <TouchableOpacity 
                          key={nft.id} 
                          style={[styles.nftGridItem, isSelected && styles.nftGridItemSelected]}
                          onPress={() => toggleTempSelection(nft.id)}
                          activeOpacity={0.9}
                        >
                          {/* 左上角圆形复选框 */}
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                             {isSelected && <Text style={{color:'#FFF', fontSize: 10, fontWeight:'900'}}>✓</Text>}
                          </View>
                          
                          <Image source={{ uri: thumbUrl }} style={styles.gridImg} />
                          <View style={styles.gridInfo}>
                             <Text style={styles.gridSerial}>#{String(nft.serial_number).padStart(6, '0')}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
             </ScrollView>

             {/* 底部确认栏 */}
             {activeReqIndex !== null && myIdleNfts.length > 0 && (
                <View style={styles.sheetFooter}>
                   <TouchableOpacity 
                     style={[styles.confirmPickBtn, tempSelectedNfts.length < requirements[activeReqIndex].req_count ? {backgroundColor: '#CCC'} : null]} 
                     onPress={confirmSelection}
                     disabled={tempSelectedNfts.length < requirements[activeReqIndex].req_count}
                   >
                     <Text style={styles.confirmPickText}>
                       确认放入 ({tempSelectedNfts.length}/{requirements[activeReqIndex].req_count})
                     </Text>
                   </TouchableOpacity>
                </View>
             )}
          </RNSafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  
  targetStage: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  targetImage: { width: width * 0.5, height: width * 0.5, resizeMode: 'cover', borderRadius: 8, marginBottom: 16 },
  targetInfo: { alignItems: 'center' },
  targetName: { color: '#111', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  targetSub: { color: '#666', fontSize: 12 },
  
  sectionHeader: { width: '100%', fontSize: 14, fontWeight: '800', color: '#333', marginTop: 24, marginBottom: 12, paddingHorizontal: 4 },
  
  materialsList: { width: '100%' },
  reqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
  reqInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  reqThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#EEE', marginRight: 12 },
  reqName: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 4 },
  reqCountText: { fontSize: 11, color: '#888' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#0066FF', backgroundColor: '#F0F6FF' },
  addBtnFull: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  addBtnText: { color: '#0066FF', fontSize: 12, fontWeight: '700' },

  bottomBar: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F0F0F0', shadowColor: '#000', shadowOffset: {width:0, height:-2}, shadowOpacity: 0.05 },
  cyberBtn: { height: 50, backgroundColor: '#0066FF', borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#0066FF', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  cyberBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  // Bottom Sheet 样式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', height: height * 0.7, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  sheetSubTitle: { fontSize: 13, color: '#666', textAlign: 'center', marginVertical: 12 },
  goMarketBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F6FF' },
  
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 },
  nftGridItem: { width: '31%', backgroundColor: '#F9F9F9', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  nftGridItemSelected: { borderColor: '#0066FF', backgroundColor: '#F0F6FF' },
  checkbox: { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#CCC', backgroundColor: '#FFF', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  gridImg: { width: '100%', aspectRatio: 1, borderRadius: 4, marginBottom: 8 },
  gridInfo: { alignItems: 'center' },
  gridSerial: { fontSize: 11, fontWeight: '700', color: '#333', fontFamily: 'monospace' },
  
  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0', backgroundColor: '#FFF' },
  confirmPickBtn: { height: 50, backgroundColor: '#0066FF', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  confirmPickText: { color: '#FFF', fontSize: 16, fontWeight: '900' }
});