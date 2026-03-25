import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 30 }}>🥔</Text>
      )}
    </View>
  );
};

export default function MyNftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [cancelListModal, setCancelListModal] = useState(false);
  const [transferTipModal, setTransferTipModal] = useState(false);
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchMyNft();
  }, [id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const fetchMyNft = async () => {
    try {
      const { data, error } = await supabase.from('nfts').select('*, collections(*)').eq('id', id).single();
      if (error) throw error;
      setNft(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const executeCancelList = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.from('nfts').update({ status: 'idle', consign_price: null }).eq('id', id);
      if (error) throw error;
      
      setCancelListModal(false);
      setTimeout(() => {
         setSuccessModal({ title: '✅ 撤回成功', msg: '您的藏品已安全退回金库，恢复闲置状态！' });
         fetchMyNft(); 
      }, 400);
    } catch (err: any) { 
      setCancelListModal(false);
      showToast(`撤回失败: ${err.message}`); 
    } finally { 
      setProcessing(false); 
    }
  };

  if (loading || !nft) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const hashString = nft.id.replace(/-/g, '').toUpperCase();
  const isListed = nft.status === 'listed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>资产管理</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.stageContainer}>
           <View style={styles.floatBox}>
              <FallbackImage uri={nft.collections?.image_url} style={styles.mainImg} />
           </View>
           <View style={styles.shadowOval} />
           
           <View style={[styles.statusBadge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#D49A36'}]}>
               <Text style={styles.statusBadgeText}>{isListed ? `大盘寄售中 (¥${nft.consign_price})` : '金库闲置中'}</Text>
           </View>
        </View>

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

      <View style={styles.bottomBar}>
         {isListed ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelListModal(true)} disabled={processing}>
               <Text style={styles.cancelBtnText}>撤销寄售</Text>
            </TouchableOpacity>
         ) : (
            <>
              {/* 🌟 换掉了蓝色的转赠按钮 */}
              <TouchableOpacity style={styles.subActionBtn} onPress={() => setTransferTipModal(true)}>
                 <Text style={styles.subActionText}>转赠</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mainActionBtn} onPress={() => router.push({pathname: '/publish-consign', params: {id: nft.id}})}>
                 <Text style={styles.mainActionText}>前往寄售大盘</Text>
              </TouchableOpacity>
            </>
         )}
      </View>

      <Modal visible={cancelListModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🚨 撤单确认</Text>
               <Text style={styles.confirmDesc}>您确定要将【<Text style={{fontWeight:'900', color:'#4E342E'}}>{nft?.collections?.name}</Text>】从大盘撤下吗？撤下后，该藏品将回到您的金库变为闲置状态。</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtnOutline} onPress={() => setCancelListModal(false)}><Text style={styles.cancelBtnOutlineText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#FF3B30'}]} onPress={executeCancelList} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认撤回</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      <Modal visible={transferTipModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🎁 流转提示</Text>
               <Text style={styles.confirmDesc}>前往转赠页面进行交易，将消耗 <Text style={{fontWeight:'900', color:'#FF3B30'}}>1 张转赠卡</Text>，是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtnOutline} onPress={() => setTransferTipModal(false)}><Text style={styles.cancelBtnOutlineText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={() => { setTransferTipModal(false); router.push('/transfer'); }}>
                     <Text style={styles.confirmBtnText}>前往转赠</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      <Modal visible={!!successModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 22}]}>{successModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#4E342E', fontWeight: '900', lineHeight: 22}]}>{successModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => setSuccessModal(null)}>
                  <Text style={styles.confirmBtnText}>知道了</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78,52,46,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  stageContainer: { alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: '#EAE0D5', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  floatBox: { padding: 10, backgroundColor: '#FDF8F0', borderRadius: 16, shadowColor: '#4E342E', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: {width: 0, height: 10}, elevation: 10, zIndex: 2, borderWidth: 1, borderColor: '#D49A36' },
  mainImg: { width: width * 0.45, height: width * 0.45, borderRadius: 8, resizeMode: 'cover' },
  shadowOval: { width: width * 0.35, height: 15, backgroundColor: 'rgba(78,52,46,0.1)', borderRadius: '50%', marginTop: 20, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  infoSection: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5EFE6' },
  infoLabel: { fontSize: 14, color: '#8D6E63', fontWeight: '700' },
  infoValue: { fontSize: 14, color: '#4E342E', fontWeight: '900' },
  infoValueHigh: { fontSize: 16, color: '#D49A36', fontWeight: '900', fontFamily: 'monospace' },
  infoHash: { fontSize: 10, color: '#A1887F', fontFamily: 'monospace', width: 180, textAlign: 'right' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#4E342E', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05, elevation: 10, borderTopWidth: 1, borderColor: '#EAE0D5' },
  cancelBtn: { flex: 1, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#FF3B30', paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  cancelBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '900' },
  
  // 🌟 洗掉转赠的淡蓝色
  subActionBtn: { flex: 0.3, backgroundColor: '#FDF8F0', paddingVertical: 14, borderRadius: 25, alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#D49A36' },
  subActionText: { color: '#D49A36', fontSize: 15, fontWeight: '900' },
  mainActionBtn: { flex: 0.7, backgroundColor: '#D49A36', paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  mainActionText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtnOutline: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnOutlineText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});