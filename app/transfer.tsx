import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

// 🌟 同步植入 FallbackImage 
const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 20 }}>🥔</Text>
      )}
    </View>
  );
};

export default function TransferScreen() {
  const router = useRouter();
  const [receiverId, setReceiverId] = useState('');
  const [transferCards, setTransferCards] = useState(0);
  const [publishing, setPublishing] = useState(false);
  
  const [showPicker, setShowPicker] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('transfer_cards').eq('id', user.id).single()
          .then(({ data }) => setTransferCards(data?.transfer_cards || 0));
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const openNftPicker = async () => {
    setShowPicker(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user.id).eq('status', 'idle');
    setMyNfts(data || []);
  };

  const handleTransferClick = () => {
    if (!receiverId || receiverId.length < 5) return showToast('请输入正确的接收人一岛号');
    if (!selectedNft) return showToast('请选择要转赠的藏品');
    if (transferCards < 1) return showToast('转赠卡不足，无法进行转移！');
    setConfirmModal(true);
  };

  const executeTransfer = async () => {
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('profiles').update({ transfer_cards: transferCards - 1 }).eq('id', user?.id);
      
      const { error } = await supabase.from('nfts').update({ owner_id: receiverId }).eq('id', selectedNft.id);
      if (error) throw error;

      await supabase.from('transfer_logs').insert([{
        nft_id: selectedNft.id, collection_id: selectedNft.collection_id, seller_id: user?.id, buyer_id: receiverId, price: 0, transfer_type: '好友转赠'
      }]);

      setConfirmModal(false);
      setResultModal(true);
    } catch (err: any) { 
      setConfirmModal(false);
      showToast(`转赠失败: ${err.message}`); 
    } finally { 
      setPublishing(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>资产转赠</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
               <Text style={styles.inputLabel}>受赠人</Text>
               <TextInput style={styles.inputField} placeholder="请输入接收人ID" placeholderTextColor="#A1887F" value={receiverId} onChangeText={setReceiverId} textAlign="right" />
            </View>
         </View>

         <TouchableOpacity style={styles.selectNftBox} onPress={openNftPicker} activeOpacity={0.8}>
            {selectedNft ? (
              <View style={{alignItems: 'center'}}>
                 <FallbackImage uri={selectedNft.collections?.image_url} style={styles.selectedImg} />
                 <Text style={styles.selectedName}>{selectedNft.collections?.name}</Text>
                 <Text style={styles.selectedSerial}>#{String(selectedNft.serial_number).padStart(6, '0')}</Text>
              </View>
            ) : (
              <View style={{alignItems: 'center'}}>
                 <View style={styles.emptyNftIcon}><Text style={{fontSize: 30, color: '#D49A36'}}>+</Text></View>
                 <Text style={styles.emptyNftText}>点击选择要转赠的藏品</Text>
              </View>
            )}
         </TouchableOpacity>

         <View style={styles.costBox}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
               <Text style={styles.costLabel}>消耗转赠卡</Text>
               <Text style={styles.costValue}>- 1</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
               <Text style={styles.ownedText}>持有转赠卡: {transferCards}</Text>
               
               {/* 🌟 清洗科技蓝！换成尊贵的琥珀金 */}
               <TouchableOpacity style={styles.exchangeBtn} onPress={() => showToast('功能建设中：稍后可使用Potato卡按1:1兑换转赠卡！')}>
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

         <TouchableOpacity style={[styles.submitBtn, transferCards < 1 && {backgroundColor: '#EAE0D5'}]} onPress={handleTransferClick} disabled={publishing || transferCards < 1}>
            <Text style={[styles.submitBtnText, transferCards < 1 && {color: '#A1887F'}]}>{transferCards < 1 ? '转赠卡不足' : '确认转赠'}</Text>
         </TouchableOpacity>
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择藏品</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#8D6E63', fontSize: 16, fontWeight: '800'}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myNfts.map(nft => (
                   <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedNft?.id === nft.id && styles.nftPickRowActive]} onPress={() => { setSelectedNft(nft); setShowPicker(false); }}>
                      <FallbackImage uri={nft.collections?.image_url} style={styles.pickImg} />
                      <View style={{flex: 1}}>
                         <Text style={[{fontSize: 14, fontWeight: '900', color: '#4E342E'}, selectedNft?.id === nft.id && {color: '#D49A36'}]}>{nft.collections?.name}</Text>
                         <Text style={{fontSize: 11, color: '#8D6E63', fontWeight: '700'}}>编号: #{nft.serial_number}</Text>
                      </View>
                   </TouchableOpacity>
                ))}
             </ScrollView>
          </RNSafeAreaView>
        </View>
      </Modal>

      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>⚠️ 转赠最终确认</Text>
               <Text style={styles.confirmDesc}>即将扣除 <Text style={{fontWeight:'900', color:'#FF3B30'}}>1 张转赠卡</Text>，并将藏品发送给神秘岛号【<Text style={{fontWeight:'900', color: '#4E342E'}}>{receiverId}</Text>】。此操作<Text style={{fontWeight:'900', color:'#FF3B30'}}>不可逆</Text>！填错ID资产将永久遗失！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>我再核对下</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeTransfer} disabled={publishing}>
                     {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认无误发送</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      <Modal visible={resultModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 22}]}>🎁 转赠成功</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#4E342E', fontWeight: '900'}]}>您的心意已通过加密通道传达，藏品已成功发送至对方金库！</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => { setResultModal(false); router.back(); }}>
                  <Text style={styles.confirmBtnText}>返回金库</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  inputGroup: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  inputLabel: { fontSize: 15, fontWeight: '900', color: '#4E342E' },
  inputField: { flex: 1, fontSize: 16, color: '#D49A36', fontWeight: '900' },

  selectNftBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 2, borderColor: '#EAE0D5', borderStyle: 'dashed' },
  emptyNftIcon: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#FDF8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#D49A36' },
  emptyNftText: { color: '#D49A36', fontSize: 14, fontWeight: '800' },
  selectedImg: { width: 120, height: 120, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EAE0D5' },
  selectedName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  selectedSerial: { fontSize: 13, color: '#8D6E63', fontFamily: 'monospace', fontWeight: '800' },

  costBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2' },
  costLabel: { fontSize: 14, color: '#8D6E63', fontWeight: '700' },
  costValue: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  ownedText: { fontSize: 13, color: '#4E342E', fontWeight: '900' },
  // 🌟 洗掉科技蓝！
  exchangeBtn: { backgroundColor: '#FDF8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#D49A36' },
  exchangeText: { color: '#D49A36', fontSize: 12, fontWeight: '900' },

  ruleBox: { backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, marginBottom: 30, borderWidth: 1, borderColor: '#EAE0D5' },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#D49A36', marginBottom: 10 },
  ruleText: { fontSize: 12, color: '#8D6E63', lineHeight: 20, marginBottom: 6, fontWeight: '600' },

  submitBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  bottomSheet: { backgroundColor: '#FDF8F0', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F0E6D2' },
  nftPickRowActive: { borderColor: '#D49A36', backgroundColor: '#FFFDF5', borderWidth: 2 },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#FDF8F0' },

  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#EAE0D5', alignItems: 'center' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});