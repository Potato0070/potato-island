import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function TransferScreen() {
  const router = useRouter();
  const [receiverId, setReceiverId] = useState('');
  const [transferCards, setTransferCards] = useState(0);
  const [publishing, setPublishing] = useState(false);
  
  // 底部选择器状态
  const [showPicker, setShowPicker] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  useEffect(() => {
    // 拉取玩家持有的转赠卡数量
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('transfer_cards').eq('id', user.id).single()
          .then(({ data }) => setTransferCards(data?.transfer_cards || 0));
      }
    });
  }, []);

  const openNftPicker = async () => {
    setShowPicker(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user.id).eq('status', 'idle');
    setMyNfts(data || []);
  };

  const executeTransfer = async () => {
    if (!receiverId || receiverId.length < 5) return Alert.alert('错误', '请输入正确的接收人一岛号');
    if (!selectedNft) return Alert.alert('错误', '请选择要转赠的藏品');
    if (transferCards < 1) return Alert.alert('转赠卡不足', '您需要拥有至少1张转赠卡才能进行转移操作！');

    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 1. 扣除转赠卡
      await supabase.from('profiles').update({ transfer_cards: transferCards - 1 }).eq('id', user?.id);
      
      // 2. 转移藏品所有权
      // 真实业务中需要根据一岛号(截取的id)找到真实的 user id，这里假设输入的就是真实ID或者做简单匹配
      const { error } = await supabase.from('nfts').update({ owner_id: receiverId }).eq('id', selectedNft.id);
      if (error) throw error;

      // 3. 写入流水
      await supabase.from('transfer_logs').insert([{
        nft_id: selectedNft.id, collection_id: selectedNft.collection_id, seller_id: user?.id, buyer_id: receiverId, price: 0, transfer_type: '好友转赠'
      }]);

      Alert.alert('🎁 转赠成功', '藏品已发送至对方金库！', [{ text: '返回', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('转赠失败', err.message); } finally { setPublishing(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>资产转赠</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
               <Text style={styles.inputLabel}>受赠人</Text>
               <TextInput style={styles.inputField} placeholder="请输入接收人ID" value={receiverId} onChangeText={setReceiverId} textAlign="right" />
            </View>
         </View>

         {/* 选择藏品的大按钮 */}
         <TouchableOpacity style={styles.selectNftBox} onPress={openNftPicker} activeOpacity={0.8}>
            {selectedNft ? (
              <View style={{alignItems: 'center'}}>
                 <Image source={{uri: selectedNft.collections?.image_url}} style={styles.selectedImg} />
                 <Text style={styles.selectedName}>{selectedNft.collections?.name}</Text>
                 <Text style={styles.selectedSerial}>#{String(selectedNft.serial_number).padStart(6, '0')}</Text>
              </View>
            ) : (
              <View style={{alignItems: 'center'}}>
                 <View style={styles.emptyNftIcon}><Text style={{fontSize: 30}}>+</Text></View>
                 <Text style={styles.emptyNftText}>点击选择要转赠的藏品</Text>
              </View>
            )}
         </TouchableOpacity>

         {/* 消耗卡片展示 */}
         <View style={styles.costBox}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
               <Text style={styles.costLabel}>消耗转赠卡</Text>
               <Text style={styles.costValue}>- 1</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
               <Text style={styles.ownedText}>持有转赠卡: {transferCards}</Text>
               <TouchableOpacity style={styles.exchangeBtn} onPress={() => Alert.alert('兑换中心', '功能建设中：稍后可使用Potato卡按1:1兑换转赠卡！')}>
                  <Text style={styles.exchangeText}>去兑换 〉</Text>
               </TouchableOpacity>
            </View>
         </View>

         <View style={styles.ruleBox}>
            <Text style={styles.ruleTitle}>转赠说明</Text>
            <Text style={styles.ruleText}>1. 转赠需消耗转赠卡，每转赠1个藏品需消耗1张。</Text>
            <Text style={styles.ruleText}>2. 若填写错接收人ID导致资产丢失，平台概不负责，请谨慎核对。</Text>
            <Text style={styles.ruleText}>3. 平台严厉打击场外交易与炒作，转赠功能仅限赠与，不构成任何指导意见。</Text>
         </View>

         <TouchableOpacity style={[styles.submitBtn, transferCards < 1 && {backgroundColor: '#CCC'}]} onPress={executeTransfer} disabled={publishing || transferCards < 1}>
            <Text style={styles.submitBtnText}>{transferCards < 1 ? '转赠卡不足' : '确认转赠'}</Text>
         </TouchableOpacity>
      </ScrollView>

      {/* 底部选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择藏品</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#999', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myNfts.map(nft => (
                   <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedNft?.id === nft.id && styles.nftPickRowActive]} onPress={() => { setSelectedNft(nft); setShowPicker(false); }}>
                      <Image source={{uri: nft.collections?.image_url}} style={styles.pickImg} />
                      <View style={{flex: 1}}>
                         <Text style={{fontSize: 14, fontWeight: '800', color: '#111'}}>{nft.collections?.name}</Text>
                         <Text style={{fontSize: 11, color: '#888'}}>编号: #{nft.serial_number}</Text>
                      </View>
                   </TouchableOpacity>
                ))}
             </ScrollView>
          </RNSafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  inputGroup: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  inputLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  inputField: { flex: 1, fontSize: 16, color: '#111', fontWeight: '900' },

  selectNftBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyNftIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyNftText: { color: '#666', fontSize: 14, fontWeight: '600' },
  selectedImg: { width: 120, height: 120, borderRadius: 12, marginBottom: 12 },
  selectedName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 4 },
  selectedSerial: { fontSize: 13, color: '#888', fontFamily: 'monospace' },

  costBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20 },
  costLabel: { fontSize: 14, color: '#666' },
  costValue: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  ownedText: { fontSize: 12, color: '#111', fontWeight: '800' },
  exchangeBtn: { backgroundColor: '#F0F6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  exchangeText: { color: '#0066FF', fontSize: 12, fontWeight: '800' },

  ruleBox: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, marginBottom: 30 },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#888', marginBottom: 10 },
  ruleText: { fontSize: 12, color: '#999', lineHeight: 20, marginBottom: 6 },

  submitBtn: { backgroundColor: '#0066FF', paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  nftPickRowActive: { borderColor: '#0066FF', backgroundColor: '#F0F6FF' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
});