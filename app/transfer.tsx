import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FolioArtwork } from '../components/FolioArtwork';
import FolioButton from '../components/FolioButton';
import FolioPaperSurface from '../components/FolioPaperSurface';
import { WEB_TEXT_INPUT_RESET } from '../components/webTextInputStyle';
import { OWNED_COLORS } from '../constants/owned-collection';
import { useIslandFonts } from '../hooks/use-island-fonts';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

const EMPTY_TRANSFER_ART = require('../assets/owned-collection/f-card-v1/runtime/empty-transfer-inventory.webp');
const TRANSFER_SUCCESS_ART = require('../assets/owned-collection/f-card-v1/runtime/transfer-success-tudooo-sailboat.webp');

export default function TransferScreen() {
  const router = useRouter();
  const fonts = useIslandFonts();
  const { nftId } = useLocalSearchParams<{ nftId?: string }>();
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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  useEffect(() => {
    if (!nftId) return;
    let active = true;
    const loadSelectedNft = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('nfts')
        .select('*, collections(name, image_url)')
        .eq('id', nftId)
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        showToast('这张藏品暂时不能转赠，请返回金库刷新状态');
        return;
      }
      setSelectedNft(data);
    };
    void loadSelectedNft();
    return () => { active = false; };
  }, [nftId, showToast]);

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
         <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回藏品详情" onPress={() => router.back()} style={styles.navBtn}><Ionicons name="chevron-back" size={24} color={OWNED_COLORS.ink} /></TouchableOpacity>
         <Text style={[styles.navTitle, { fontFamily: fonts.semibold }]}>资产转赠</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
               <Text style={[styles.inputLabel, { fontFamily: fonts.semibold }]}>受赠人</Text>
               <TextInput accessibilityLabel="受赠人一岛号" style={[styles.inputField, { fontFamily: fonts.regular }]} placeholder="请输入接收人ID" placeholderTextColor="#A1887F" value={receiverId} onChangeText={setReceiverId} textAlign="right" />
            </View>
         </View>

         <TouchableOpacity accessibilityRole="button" accessibilityLabel="选择要转赠的藏品" style={styles.selectNftPressable} onPress={openNftPicker} activeOpacity={0.8}>
          <FolioPaperSurface kind="plaque" style={styles.selectNftBox}>
            {selectedNft ? (
              <View style={{alignItems: 'center'}}>
                  <FolioArtwork uri={selectedNft.image_url || selectedNft.collections?.image_url || null} framed={false} style={styles.selectedImg} accessibilityLabel={`${selectedNft.collections?.name || '藏品'}封面`} />
                  <Text style={[styles.selectedName, { fontFamily: fonts.semibold }]}>{selectedNft.collections?.name}</Text>
                  <Text style={styles.selectedSerial}>#{String(selectedNft.serial_number).padStart(6, '0')}</Text>
              </View>
            ) : (
              <View style={{alignItems: 'center'}}>
                  <Image source={require('../assets/owned-collection/f-card-v1/runtime/icon-collection-pencil.webp')} resizeMode="contain" style={styles.emptyNftIcon} accessible={false} />
                  <Text style={[styles.emptyNftText, { fontFamily: fonts.semibold }]}>点击选择要转赠的藏品</Text>
              </View>
            )}
          </FolioPaperSurface>
         </TouchableOpacity>

         <View style={styles.costBox}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
                <Text style={[styles.costLabel, { fontFamily: fonts.semibold }]}>消耗转赠卡</Text>
               <Text style={styles.costValue}>- 1</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text style={[styles.ownedText, { fontFamily: fonts.semibold }]}>持有转赠卡: {transferCards}</Text>
               
               {/* 🌟 清洗科技蓝！换成尊贵的琥珀金 */}
               <FolioButton label="去兑换" tone="gold" icon="swap-horizontal-outline" onPress={() => router.push('/exchange')} style={styles.exchangeBtn} fontFamily={fonts.semibold} />
            </View>
         </View>

         <FolioPaperSurface kind="plaque" style={styles.ruleBox}>
            <Text style={[styles.ruleTitle, { fontFamily: fonts.semibold }]}>转赠说明</Text>
            <Text style={styles.ruleText}>1. 转赠需消耗转赠卡，每转赠1个藏品需消耗1张。</Text>
            <Text style={styles.ruleText}>2. 若填写错接收人ID导致资产丢失，平台概不负责，请谨慎核对。</Text>
            <Text style={styles.ruleText}>3. 平台严厉打击场外交易与炒作，转赠功能仅限赠与，不构成任何指导意见。</Text>
         </FolioPaperSurface>

         <FolioButton label={transferCards < 1 ? '转赠卡不足' : '确认转赠'} tone="blue" pencilIcon="transfer" onPress={handleTransferClick} disabled={publishing || transferCards < 1} loading={publishing} style={styles.submitBtn} fontFamily={fonts.semibold} />
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.pickerSafeArea}>
          <FolioPaperSurface kind="paper" style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { fontFamily: fonts.semibold }]}>选择藏品</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="取消选择" onPress={() => setShowPicker(false)}><Ionicons name="close" size={22} color={OWNED_COLORS.ink} /></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myNfts.length === 0 ? <View style={styles.noNfts}><Image source={EMPTY_TRANSFER_ART} resizeMode="contain" style={styles.noNftsArt} accessible={false} /><Text style={[styles.noNftsText, { fontFamily: fonts.semibold }]}>金库里还没有可转赠的藏品</Text></View> : null}
                {myNfts.map(nft => (
                   <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedNft?.id === nft.id && styles.nftPickRowActive]} onPress={() => { setSelectedNft(nft); setShowPicker(false); }}>
                       <FolioArtwork uri={nft.image_url || nft.collections?.image_url || null} framed={false} style={styles.pickImg} accessibilityLabel={`${nft.collections?.name || '藏品'}封面`} />
                      <View style={{flex: 1}}>
                          <Text style={[styles.pickName, { fontFamily: fonts.semibold }, selectedNft?.id === nft.id && {color: OWNED_COLORS.gold}]}>{nft.collections?.name}</Text>
                          <Text style={styles.pickSerial}>编号: #{nft.serial_number}</Text>
                      </View>
                   </TouchableOpacity>
                ))}
             </ScrollView>
          </FolioPaperSurface>
          </RNSafeAreaView>
        </View>
      </Modal>

      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <FolioPaperSurface kind="confirm" style={styles.confirmBox}>
               <Image source={require('../assets/owned-collection/f-card-v1/runtime/icon-transfer-pencil.webp')} resizeMode="contain" style={styles.modalArtIcon} accessible={false} />
               <Text style={[styles.confirmTitle, { fontFamily: fonts.semibold }]}>转赠最终确认</Text>
               <Text style={styles.confirmDesc}>即将扣除 <Text style={styles.warningText}>1 张转赠卡</Text>，并将藏品发送给一岛号【<Text style={styles.receiverText}>{receiverId}</Text>】。此操作<Text style={styles.warningText}>不可逆</Text>，请再次核对接收人信息。</Text>
               <View style={styles.confirmBtnRow}>
                   <FolioButton label="再核对一下" tone="paper" onPress={() => setConfirmModal(false)} disabled={publishing} style={styles.confirmAction} fontFamily={fonts.semibold} />
                   <FolioButton label="确认发送" tone="gold" pencilIcon="transfer" onPress={executeTransfer} loading={publishing} style={styles.confirmAction} fontFamily={fonts.semibold} />
               </View>
            </FolioPaperSurface>
         </View>
      </Modal>

      <Modal visible={resultModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <FolioPaperSurface kind="result" style={styles.confirmBox}>
               <Image source={TRANSFER_SUCCESS_ART} resizeMode="contain" style={styles.transferSuccessArt} accessibilityLabel="Tudooo乘坐帆船运送礼物" />
               <Text style={[styles.confirmTitle, { fontFamily: fonts.semibold, color: OWNED_COLORS.blue }]}>转赠成功</Text>
               <Text style={styles.confirmDesc}>藏品已送达对方金库。</Text>
               <FolioButton label="返回金库" tone="blue" pencilIcon="collection" onPress={() => { setResultModal(false); router.back(); }} style={styles.resultAction} fontFamily={fonts.semibold} />
            </FolioPaperSurface>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 52, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E8E2D9' },
  navBtn: { width: 40, height: 44, justifyContent: 'center' },
  navTitle: { fontSize: 19, color: OWNED_COLORS.ink },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  inputGroup: { paddingHorizontal: 18, marginBottom: 18, borderRadius: 14, borderWidth: 1, borderColor: '#EAE4DC', backgroundColor: '#FCFAF6' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  inputLabel: { fontSize: 14, color: OWNED_COLORS.ink },
  inputField: { flex: 1, minWidth: 0, fontSize: 16, color: OWNED_COLORS.ink, borderWidth: 0, ...WEB_TEXT_INPUT_RESET, backgroundColor: 'transparent', borderRadius: 0 },

  selectNftPressable: { marginBottom: 18 },
  selectNftBox: { padding: 25, alignItems: 'center', minHeight: 160 },
  emptyNftIcon: { width: 54, height: 54, marginBottom: 10 },
  emptyNftText: { color: OWNED_COLORS.blue, fontSize: 14 },
  selectedImg: { width: 116, marginBottom: 10 },
  selectedName: { fontSize: 16, color: OWNED_COLORS.ink, marginBottom: 3 },
  selectedSerial: { fontSize: 12, color: OWNED_COLORS.muted, fontVariant: ['tabular-nums'] },

  costBox: { padding: 17, marginBottom: 18, borderRadius: 14, borderWidth: 1, borderColor: '#EAE4DC', backgroundColor: '#FCFAF6' },
  costLabel: { fontSize: 14, color: OWNED_COLORS.muted },
  costValue: { fontSize: 16, fontWeight: '700', color: OWNED_COLORS.gold },
  ownedText: { fontSize: 13, color: OWNED_COLORS.ink },
  exchangeBtn: { minHeight: 40, minWidth: 92, paddingHorizontal: 8 },

  ruleBox: { padding: 18, marginBottom: 24 },
  ruleTitle: { fontSize: 14, color: OWNED_COLORS.ink, marginBottom: 9 },
  ruleText: { fontSize: 12, color: OWNED_COLORS.muted, lineHeight: 20, marginBottom: 6 },

  submitBtn: { width: '100%', minHeight: 52 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.28)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.3)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  pickerSafeArea: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { width: '100%', height: height * 0.65, paddingHorizontal: 30, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#EAE0D5' },
  sheetTitle: { fontSize: 18, color: OWNED_COLORS.ink },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 9 },
  nftPickRowActive: { opacity: 0.86 },
  pickImg: { width: 54, marginRight: 12 },
  pickName: { fontSize: 14, color: OWNED_COLORS.ink },
  pickSerial: { fontSize: 11, color: OWNED_COLORS.muted, marginTop: 3 },
  noNfts: { alignItems: 'center', paddingVertical: 26 },
  noNftsArt: { width: 174, height: 116 },
  noNftsText: { color: OWNED_COLORS.ink, fontSize: 13, textAlign: 'center' },

  confirmBox: { width: '100%', maxWidth: 420, paddingHorizontal: 28, paddingVertical: 24, alignItems: 'center' },
  modalArtIcon: { width: 58, height: 58, marginBottom: 9 },
  transferSuccessArt: { width: 188, height: 188, aspectRatio: 1, marginBottom: 2 },
  confirmTitle: { fontSize: 19, color: OWNED_COLORS.ink, marginBottom: 10 },
  confirmDesc: { fontSize: 13, color: OWNED_COLORS.muted, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  warningText: { fontWeight: '700', color: OWNED_COLORS.gold },
  receiverText: { fontWeight: '700', color: OWNED_COLORS.ink },
  confirmBtnRow: { flexDirection: 'row', width: '100%', gap: 9 },
  confirmAction: { flex: 1, minWidth: 0, minHeight: 46 },
  resultAction: { width: '100%', minHeight: 46 },
});
