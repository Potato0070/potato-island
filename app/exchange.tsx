import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function ExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // 底部选择器状态
  const [showPicker, setShowPicker] = useState(false);
  const [targetCardType, setTargetCardType] = useState<'transfer' | 'batch' | null>(null);
  const [myIdleNfts, setMyIdleNfts] = useState<any[]>([]);
  const [selectedNftIds, setSelectedNftIds] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('transfer_cards, batch_cards').eq('id', user.id).single();
      setProfile(data);
    }
  };

  const openPicker = async (type: 'transfer' | 'batch') => {
    setTargetCardType(type);
    setSelectedNftIds([]);
    setShowPicker(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user?.id).eq('status', 'idle');
    setMyIdleNfts(data || []);
  };

  const toggleSelect = (id: string) => {
    if (selectedNftIds.includes(id)) {
      setSelectedNftIds(selectedNftIds.filter(item => item !== id));
    } else {
      if (selectedNftIds.length >= 3) return Alert.alert('提示', '只需献祭 3 张资产即可！');
      setSelectedNftIds([...selectedNftIds, id]);
    }
  };

  const executeExchange = async () => {
    if (selectedNftIds.length !== 3) return Alert.alert('提示', '必须选满 3 张资产！');
    
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('exchange_privilege_card', {
        p_user_id: user?.id,
        p_nft_ids: selectedNftIds,
        p_card_type: targetCardType
      });

      if (error) throw error;

      Alert.alert('🔥 献祭成功', `3 张资产已化为灰烬，您获得了 1 张【${targetCardType === 'transfer' ? '转赠卡' : '批量寄售卡'}】！`);
      setShowPicker(false);
      fetchProfile(); // 刷新余额
    } catch (err: any) { Alert.alert('兑换失败', err.message); } finally { setProcessing(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>特权兑换</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>资产熔炉与特权兑换</Text>
            <Text style={styles.headerSub}>在此献祭您冗余的数字资产，换取高阶金融操作特权。</Text>
         </View>

         {/* 转赠卡兑换 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>🎁</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>资产转赠卡</Text>
                  <Text style={styles.cardDesc}>用于给其他岛民转赠藏品，单次消耗1张。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>当前持有: <Text style={{color:'#111', fontWeight:'900'}}>{profile?.transfer_cards || 0}</Text> 张</Text>
               <TouchableOpacity style={styles.exchangeBtn} onPress={() => openPicker('transfer')}>
                  <Text style={styles.exchangeBtnText}>献祭 3 张资产兑换</Text>
               </TouchableOpacity>
            </View>
         </View>

         {/* 批量寄售卡兑换 */}
         <View style={styles.cardBox}>
            <View style={styles.cardHeader}>
               <View style={styles.cardIcon}><Text style={{fontSize: 24}}>📦</Text></View>
               <View style={{flex: 1}}>
                  <Text style={styles.cardName}>批量寄售权益卡</Text>
                  <Text style={styles.cardDesc}>解锁大户特权，支持一键上架多达20件藏品。</Text>
               </View>
            </View>
            <View style={styles.cardFooter}>
               <Text style={styles.holdText}>当前持有: <Text style={{color:'#111', fontWeight:'900'}}>{profile?.batch_cards || 0}</Text> 张</Text>
               <TouchableOpacity style={[styles.exchangeBtn, {backgroundColor: '#111'}]} onPress={() => openPicker('batch')}>
                  <Text style={[styles.exchangeBtnText, {color: '#FFD700'}]}>献祭 3 张资产兑换</Text>
               </TouchableOpacity>
            </View>
         </View>
      </ScrollView>

      {/* 底部材料选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择祭品 ({selectedNftIds.length}/3)</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#999', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>
             
             <ScrollView style={{padding: 16}}>
                {myIdleNfts.length === 0 ? (
                  <Text style={{textAlign:'center', color:'#999', marginTop: 40}}>您的金库暂无可献祭的闲置资产</Text>
                ) : (
                  myIdleNfts.map(nft => {
                    const isSelected = selectedNftIds.includes(nft.id);
                    return (
                       <TouchableOpacity key={nft.id} style={[styles.nftPickRow, isSelected && styles.nftPickRowActive]} onPress={() => toggleSelect(nft.id)}>
                          <Image source={{uri: nft.collections?.image_url}} style={styles.pickImg} />
                          <View style={{flex: 1}}>
                             <Text style={{fontSize: 14, fontWeight: '800', color: '#111'}}>{nft.collections?.name}</Text>
                             <Text style={{fontSize: 11, color: '#888'}}>编号: #{nft.serial_number}</Text>
                          </View>
                          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                             {isSelected && <Text style={{color:'#FFF', fontSize: 12}}>✓</Text>}
                          </View>
                       </TouchableOpacity>
                    )
                  })
                )}
             </ScrollView>

             <View style={styles.sheetFooter}>
                <TouchableOpacity 
                  style={[styles.confirmBtn, selectedNftIds.length < 3 && {backgroundColor: '#CCC'}]} 
                  onPress={executeExchange} 
                  disabled={selectedNftIds.length < 3 || processing}
                >
                   {processing ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>确认献祭并兑换</Text>}
                </TouchableOpacity>
             </View>
          </RNSafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  headerBox: { marginBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 8 },
  headerSub: { fontSize: 13, color: '#666', lineHeight: 20 },

  cardBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F9F9F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#888', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 16 },
  holdText: { fontSize: 12, color: '#666' },
  exchangeBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  exchangeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', height: height * 0.7, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#FF3B30' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  nftPickRowActive: { borderColor: '#FF3B30', backgroundColor: '#FFF5F5' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0' },
  confirmBtn: { backgroundColor: '#FF3B30', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }
});