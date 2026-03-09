import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const [showPicker, setShowPicker] = useState(false);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]);
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

  const openMaterialPicker = async (reqIndex: number) => {
    setActiveReqIndex(reqIndex);
    setShowPicker(true);
    setMyIdleNfts([]);
    
    const req = requirements[reqIndex];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('nfts')
        .select('id, serial_number')
        .eq('collection_id', req.req_collection_id)
        .eq('owner_id', user.id)
        .eq('status', 'idle');
        
      if (data) setMyIdleNfts(data);
    } catch (e) { console.error(e); }
  };

  const toggleNftSelection = (nftId: string) => {
    if (activeReqIndex === null) return;
    const req = requirements[activeReqIndex];
    const currentSelected = selectedNfts[activeReqIndex] || [];
    
    if (currentSelected.includes(nftId)) {
      setSelectedNfts({ ...selectedNfts, [activeReqIndex]: currentSelected.filter(id => id !== nftId) });
    } else {
      if (currentSelected.length >= req.req_count) {
         Alert.alert('提示', '该材料槽已满');
         return;
      }
      setSelectedNfts({ ...selectedNfts, [activeReqIndex]: [...currentSelected, nftId] });
    }
  };

  const handleExecute = async () => {
    let allNftsToBurn: string[] = [];
    for (let i = 0; i < requirements.length; i++) {
      const selected = selectedNfts[i] || [];
      if (selected.length < requirements[i].req_count) {
        return Alert.alert('能量不足', '请填满所有基因材料槽！');
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
      
      Alert.alert('🧬 进化成功', `材料已成功燃烧！恭喜获得全新的【${eventData.target_collection.name}】！`, [
        { text: '查看金库', onPress: () => router.push('/(tabs)/profile') }
      ]);
    } catch (err: any) {
      Alert.alert('💥 进化失败', err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading || !eventData) return <View style={styles.center}><ActivityIndicator color="#00E5FF" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>进化舱中心</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 16, alignItems: 'center'}}>
        <View style={styles.mechaScreen}>
           <Text style={styles.mechaScreenTitle}> {eventData.name} </Text>
           <Image source={{ uri: eventData.target_collection?.image_url || 'https://via.placeholder.com/300' }} style={styles.mainImage} />
           <View style={styles.mechaInfoBox}>
             <Text style={styles.mechaText}>剩余额度: {eventData.max_count > 0 ? eventData.max_count - eventData.current_count : '能量无限'}</Text>
             <Text style={styles.mechaText}>关闭时间: {new Date(eventData.end_time).toLocaleString()}</Text>
           </View>
        </View>

        <Text style={styles.sectionHeader}>◆ 注入进化基因 ◆</Text>

        <View style={styles.materialsGrid}>
          {requirements.map((req, index) => {
            const selectedCount = (selectedNfts[index] || []).length;
            const isFull = selectedCount === req.req_count;
            return (
              <TouchableOpacity 
                key={req.id} 
                style={[styles.materialSlot, isFull && styles.materialSlotFull]}
                onPress={() => openMaterialPicker(index)}
              >
                <Image source={{ uri: req.collection.image_url }} style={[styles.slotImage, { opacity: isFull ? 1 : 0.3 }]} />
                {!isFull && <Text style={styles.slotEmptyText}>点击注入</Text>}
                <View style={[styles.reqBadge, isFull && {backgroundColor: '#00E5FF'}]}>
                  <Text style={[styles.reqBadgeText, isFull && {color: '#000'}]}>{selectedCount}/{req.req_count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
         <TouchableOpacity style={styles.cyberBtn} activeOpacity={0.8} onPress={handleExecute} disabled={synthesizing}>
            {synthesizing ? <ActivityIndicator color="#000" /> : <Text style={styles.cyberBtnText}>⚡ 启动进化舱 ⚡</Text>}
         </TouchableOpacity>
      </View>

      <Modal visible={showPicker} animationType="slide">
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerNav}>
             <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{fontSize: 16, color: '#999'}}>取消</Text></TouchableOpacity>
             <Text style={{fontSize: 18, color: '#FFF', fontWeight: '800'}}>选择基因序列</Text>
             <Text style={{width: 32}}></Text>
          </View>

          {activeReqIndex !== null && (
            <Text style={{color: '#00E5FF', textAlign: 'center', marginBottom: 20}}>
              请选择 {requirements[activeReqIndex].req_count} 个【{requirements[activeReqIndex].collection.name}】
            </Text>
          )}

          <ScrollView style={{flex: 1, paddingHorizontal: 16}}>
             {myIdleNfts.length === 0 ? (
               <View style={{alignItems: 'center', marginTop: 100}}>
                  <Text style={{color: '#666', marginBottom: 20}}>该基因序列材料不足，请前往大盘扫货</Text>
                  <TouchableOpacity style={styles.buyBtn} onPress={() => { setShowPicker(false); router.push('/(tabs)/market'); }}>
                    <Text style={{color: '#000', fontWeight: '800'}}>去扫货</Text>
                  </TouchableOpacity>
               </View>
             ) : (
               myIdleNfts.map((nft) => {
                 const isSelected = (selectedNfts[activeReqIndex as number] || []).includes(nft.id);
                 return (
                   <TouchableOpacity 
                     key={nft.id} 
                     style={[styles.nftPickerRow, isSelected && {borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.1)'}]}
                     onPress={() => toggleNftSelection(nft.id)}
                   >
                     <Text style={{color: '#FFF', fontSize: 16}}>编号: #{nft.serial_number}</Text>
                     <View style={[styles.checkbox, isSelected && {backgroundColor: '#00E5FF'}]} />
                   </TouchableOpacity>
                 )
               })
             )}
          </ScrollView>

          <View style={{padding: 20}}>
            <TouchableOpacity style={styles.confirmPickBtn} onPress={() => setShowPicker(false)}>
              <Text style={{color: '#000', fontSize: 16, fontWeight: '800'}}>确认注入</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090E17' },
  container: { flex: 1, backgroundColor: '#090E17' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#00E5FF', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  mechaScreen: { width: width - 32, backgroundColor: '#0D1623', borderWidth: 2, borderColor: '#1F3C5A', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: {width: 0, height: 0} },
  mechaScreenTitle: { color: '#00E5FF', fontSize: 18, fontWeight: '900', marginBottom: 16, letterSpacing: 1 },
  mainImage: { width: width * 0.6, height: width * 0.6, resizeMode: 'cover', borderRadius: 8, borderWidth: 1, borderColor: '#00E5FF' },
  mechaInfoBox: { width: '100%', backgroundColor: '#060A10', padding: 12, borderRadius: 8, marginTop: 16, borderWidth: 1, borderColor: '#1A2E44' },
  mechaText: { color: '#8AB4F8', fontSize: 12, marginBottom: 4, fontFamily: 'monospace' },
  sectionHeader: { color: '#00E5FF', fontSize: 16, fontWeight: '900', marginVertical: 24, letterSpacing: 2 },
  materialsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  materialSlot: { width: 100, height: 100, backgroundColor: '#0D1623', borderWidth: 1, borderColor: '#1F3C5A', borderRadius: 12, margin: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  materialSlotFull: { borderColor: '#00E5FF', shadowColor: '#00E5FF', shadowOpacity: 0.5, shadowRadius: 10 },
  slotImage: { position: 'absolute', width: '100%', height: '100%', resizeMode: 'cover' },
  slotEmptyText: { color: '#4A6D8C', fontSize: 12, fontWeight: '800', zIndex: 2 },
  reqBadge: { position: 'absolute', top: -1, right: -1, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderBottomLeftRadius: 8 },
  reqBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  bottomBar: { padding: 20, borderTopWidth: 1, borderColor: '#1F3C5A', backgroundColor: '#060A10' },
  cyberBtn: { height: 50, backgroundColor: '#00E5FF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#00E5FF', shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: {width: 0, height: 0} },
  cyberBtnText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  pickerContainer: { flex: 1, backgroundColor: '#090E17' },
  pickerNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderColor: '#1F3C5A', marginBottom: 16 },
  buyBtn: { backgroundColor: '#00E5FF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 24 },
  nftPickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0D1623', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#1F3C5A' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#00E5FF' },
  confirmPickBtn: { height: 50, backgroundColor: '#00E5FF', borderRadius: 25, justifyContent: 'center', alignItems: 'center' }
});