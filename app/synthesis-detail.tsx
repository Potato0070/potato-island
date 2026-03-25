import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width, height } = Dimensions.get('window');

export default function SynthesisDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  // 🌟 核心：用于自动滚动的引用
  const scrollViewRef = useRef<ScrollView>(null);
  const [actionAreaY, setActionAreaY] = useState(0);

  const [eventData, setEventData] = useState<any>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]);
  const [tempSelectedNfts, setTempSelectedNfts] = useState<string[]>([]);
  const [selectedNfts, setSelectedNfts] = useState<Record<number, string[]>>({});

  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchDetail(); }, [id]);

  // 🌟 核心动效：当数据加载完且知道操作区位置时，自动丝滑向下滚动！
  useEffect(() => {
    if (!loading && actionAreaY > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: actionAreaY - 20, animated: true });
      }, 400); // 预留 0.4 秒让用户看一眼顶部图，然后自动滑到操作区
    }
  }, [loading, actionAreaY]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

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
      showToast(`获取配方失败: ${err.message}`);
      setTimeout(() => router.back(), 1500);
    } finally { setLoading(false); }
  };

  const openMaterialPicker = async (reqIndex: number) => {
    setActiveReqIndex(reqIndex);
    setShowPicker(true);
    setMyIdleNfts([]);
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

  const toggleTempSelection = (nftId: string) => {
    if (activeReqIndex === null) return;
    const req = requirements[activeReqIndex];
    
    if (tempSelectedNfts.includes(nftId)) {
      setTempSelectedNfts(tempSelectedNfts.filter(id => id !== nftId));
    } else {
      if (tempSelectedNfts.length >= req.req_count) {
         return showToast(`最多只需选择 ${req.req_count} 个`);
      }
      setTempSelectedNfts([...tempSelectedNfts, nftId]);
    }
  };

  const confirmSelection = () => {
    if (activeReqIndex === null) return;
    setSelectedNfts({ ...selectedNfts, [activeReqIndex]: tempSelectedNfts });
    setShowPicker(false);
  };

  const handlePreExecute = () => {
    for (let i = 0; i < requirements.length; i++) {
      const selected = selectedNfts[i] || [];
      if (selected.length < requirements[i].req_count) {
        return showToast('⚠️ 请填满所有要求的材料槽！');
      }
    }
    setConfirmModal(true);
  };

  const executeSynthesis = async () => {
    let allNftsToBurn: string[] = [];
    for (let i = 0; i < requirements.length; i++) {
      allNftsToBurn = [...allNftsToBurn, ...(selectedNfts[i] || [])];
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
      
      setConfirmModal(false);
      setResultModal({
         title: '🧬 炼金成功',
         msg: `您放入的材料已被永远粉碎，残渣凝结成了极其稀有的【${eventData.target_collection.name}】！已打入您的金库。`
      });
    } catch (err: any) {
      setConfirmModal(false);
      showToast(`融合失败: ${err.message}`);
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading || !eventData) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>融合炼金炉</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView ref={scrollViewRef} contentContainerStyle={{padding: 16, alignItems: 'center'}}>
        <View style={styles.targetStage}>
           <Image source={{ uri: eventData.target_collection?.image_url || 'https://via.placeholder.com/300' }} style={styles.targetImage} />
           <View style={styles.targetInfo}>
             <Text style={styles.targetName}>[ {eventData.name} ]</Text>
             <Text style={styles.targetSub}>剩余额度: {eventData.max_count > 0 ? eventData.max_count - eventData.current_count : '无限'} 份</Text>
           </View>
        </View>

        {/* 🌟 记录操作区的 Y 坐标，用于自动滑行定位 */}
        <Text 
           style={styles.sectionHeader}
           onLayout={(e) => setActionAreaY(e.nativeEvent.layout.y)}
        >
           请放入炼金材料
        </Text>

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

      <View style={styles.bottomBar}>
         <TouchableOpacity style={styles.cyberBtn} activeOpacity={0.8} onPress={handlePreExecute} disabled={synthesizing}>
            {synthesizing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.cyberBtnText}>确认炼金融合</Text>}
         </TouchableOpacity>
      </View>

      {/* 底部材料选择面板 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择材料</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#8D6E63', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>

             {activeReqIndex !== null && (
               <Text style={styles.sheetSubTitle}>
                 请选择 {requirements[activeReqIndex].req_count} 个【{requirements[activeReqIndex].collection.name}】
               </Text>
             )}

             <ScrollView style={{flex: 1, paddingHorizontal: 16}}>
                {myIdleNfts.length === 0 ? (
                  <View style={{alignItems: 'center', marginTop: 50}}>
                     <Text style={{color: '#8D6E63', marginBottom: 20}}>金库内暂无此资产</Text>
                     <TouchableOpacity style={styles.goMarketBtn} onPress={() => { setShowPicker(false); router.push('/(tabs)/market'); }}>
                       <Text style={{color: '#D49A36', fontWeight: '800'}}>去交易大盘扫货</Text>
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

             {activeReqIndex !== null && myIdleNfts.length > 0 && (
                <View style={styles.sheetFooter}>
                   <TouchableOpacity 
                     style={[styles.confirmPickBtn, tempSelectedNfts.length < requirements[activeReqIndex].req_count ? {backgroundColor: '#EAE0D5'} : null]} 
                     onPress={confirmSelection}
                     disabled={tempSelectedNfts.length < requirements[activeReqIndex].req_count}
                   >
                     <Text style={[styles.confirmPickText, tempSelectedNfts.length < requirements[activeReqIndex].req_count ? {color: '#A1887F'} : null]}>
                       确认放入 ({tempSelectedNfts.length}/{requirements[activeReqIndex].req_count})
                     </Text>
                   </TouchableOpacity>
                </View>
             )}
          </RNSafeAreaView>
        </View>
      </Modal>

      {/* 🌟 融合前防坑二次确认弹窗 (红金配色，尊贵警告) */}
      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>⚠️ 启动炼金阵</Text>
               <Text style={styles.confirmDesc}>即将启动不可逆的基因融合序列。您刚才放入的所有材料卡将被<Text style={{color:'#FF3B30', fontWeight:'900'}}>永久物理销毁</Text>！是否继续执行？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>我害怕了</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeSynthesis} disabled={synthesizing}>
                     {synthesizing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>立即摧毁并融合</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 🌟 融合成功震撼弹窗 */}
      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 22}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#4E342E', fontWeight: '800'}]}>{resultModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => { setResultModal(null); router.replace('/(tabs)/profile'); }}>
                  <Text style={styles.confirmBtnText}>去金库看新货</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' }, // 🌟 复古米白
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  targetStage: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  targetImage: { width: width * 0.5, height: width * 0.5, resizeMode: 'cover', borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  targetInfo: { alignItems: 'center' },
  targetName: { color: '#4E342E', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  targetSub: { color: '#8D6E63', fontSize: 12 },
  
  sectionHeader: { width: '100%', fontSize: 15, fontWeight: '900', color: '#4E342E', marginTop: 24, marginBottom: 12, paddingHorizontal: 4 },
  
  materialsList: { width: '100%' },
  reqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, shadowColor: '#4E342E', shadowOpacity: 0.03, shadowRadius: 5, borderWidth: 1, borderColor: '#F0E6D2' },
  reqInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  reqThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#FDF8F0', marginRight: 12, borderWidth: 1, borderColor: '#EAE0D5' },
  reqName: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  reqCountText: { fontSize: 11, color: '#8D6E63' },
  
  // 🌟 选材料按钮告别蓝色，拥抱琥珀金
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D49A36', backgroundColor: '#FDF8F0' },
  addBtnFull: { backgroundColor: '#D49A36', borderColor: '#D49A36' },
  addBtnText: { color: '#D49A36', fontSize: 12, fontWeight: '800' },

  bottomBar: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOffset: {width:0, height:-2}, shadowOpacity: 0.05 },
  cyberBtn: { height: 50, backgroundColor: '#D49A36', borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  cyberBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // 🌟 底部抽屉样式重构
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FDF8F0', height: height * 0.7, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  sheetSubTitle: { fontSize: 13, color: '#8D6E63', textAlign: 'center', marginVertical: 12 },
  
  goMarketBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D49A36' },
  
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 },
  nftGridItem: { width: '31%', backgroundColor: '#FFF', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 2, borderColor: 'transparent', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  nftGridItemSelected: { borderColor: '#D49A36', backgroundColor: '#FDF8F0' }, // 🌟 选中框换成金色
  checkbox: { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#CCC', backgroundColor: '#FFF', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#D49A36', borderColor: '#D49A36' },
  gridImg: { width: '100%', aspectRatio: 1, borderRadius: 4, marginBottom: 8, backgroundColor: '#FDF8F0' },
  gridInfo: { alignItems: 'center' },
  gridSerial: { fontSize: 11, fontWeight: '800', color: '#4E342E', fontFamily: 'monospace' },
  
  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  confirmPickBtn: { height: 50, backgroundColor: '#D49A36', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  confirmPickText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  // 弹窗
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});