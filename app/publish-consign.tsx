import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

// 💰 千分位金钱格式化
const formatMoney = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n)) return '0.00';
  let parts = n.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 24 }}>🥔</Text>
      )}
    </View>
  );
};

export default function PublishConsignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const [nft, setNft] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);

  const PLATFORM_FEE_RATE = 0.05; 

  useEffect(() => {
    supabase.from('nfts').select('*, collections(*)').eq('id', id).single().then(({data}) => {
      setNft(data);
      setLoading(false);
    });
  }, [id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handlePublishClick = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return showToast('请输入有效价格');
    
    const maxPrice = nft?.collections?.max_consign_price;
    if (maxPrice && p > maxPrice) {
       return showToast(`违规拦截：全岛最高限价为 ¥${formatMoney(maxPrice)}`);
    }
    setConfirmModalVisible(true);
  };

  const executePublish = async () => {
    setPublishing(true);
    try {
      const p = parseFloat(price);
      const { error } = await supabase.from('nfts').update({ status: 'listed', consign_price: p }).eq('id', id);
      if (error) throw error;
      
      setConfirmModalVisible(false);
      setTimeout(() => {
         setSuccessModal({ title: '✅ 上架成功', msg: '您的藏品已挂入现货大盘，耐心等待老板扫货吧！' });
      }, 400);

    } catch (err: any) { 
       setConfirmModalVisible(false);
       showToast(`上架失败: ${err.message}`); 
    } finally { 
       setPublishing(false); 
    }
  };

  if (loading || !nft) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const parsedPrice = parseFloat(price) || 0;
  const fee = parsedPrice * PLATFORM_FEE_RATE;
  const income = parsedPrice - fee;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布寄售</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
        <View style={styles.targetHeader}>
           <FallbackImage uri={nft.collections?.image_url} style={styles.targetImg} />
           <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{nft.collections?.name}</Text>
              <Text style={styles.targetSub}>唯一编号: #{String(nft.serial_number).padStart(6, '0')}</Text>
              <Text style={styles.targetSubHighlight}>大盘最高限价: ¥{nft.collections?.max_consign_price ? formatMoney(nft.collections.max_consign_price) : '无限制'}</Text>
           </View>
        </View>

        <View style={styles.inputBox}>
           <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <Text style={styles.inputLabel}>出售价格 (¥)</Text>
              {/* 🌟 核心：输入价格瞬间，立刻显示到手收益 */}
              {parsedPrice > 0 && (
                  <Text style={{fontSize: 12, color: '#D49A36', fontWeight: '800'}}>
                     实时预计到手: ¥{formatMoney(income)}
                  </Text>
              )}
           </View>
           <TextInput 
              style={styles.inputField} 
              placeholder="请输入您的挂单价" 
              placeholderTextColor="#A1887F"
              keyboardType="decimal-pad" 
              value={price} 
              onChangeText={(val) => setPrice(val.replace(/[^0-9.]/g, ''))} // 🌟 防呆拦截非法输入
              autoFocus
           />
        </View>

        <View style={styles.feeBox}>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>挂单金额</Text>
              <Text style={styles.feeValue}>¥ {formatMoney(parsedPrice)}</Text>
           </View>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>创作者版税 (5%)</Text>
              {/* 🌟 红色预警版税，并加上负号 */}
              <Text style={[styles.feeValue, {color: '#FF3B30'}]}>- ¥ {formatMoney(fee)}</Text>
           </View>
           <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeLabelTotal}>预计到手收益</Text>
              <Text style={styles.feeValueTotal}>¥ {formatMoney(income)}</Text>
           </View>
        </View>

        <Text style={styles.hintText}>* 上架后资产将被冻结，直至取消挂单或被买家买走。成交后收益将自动打入您的土豆币金库。</Text>

        <TouchableOpacity style={[styles.submitBtn, parsedPrice <= 0 && {backgroundColor: '#EAE0D5'}]} onPress={handlePublishClick} disabled={publishing || parsedPrice <= 0}>
           <Text style={[styles.submitBtnText, parsedPrice <= 0 && {color: '#A1887F'}]}>确认上架大盘</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={confirmModalVisible} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📝 寄售二次确认</Text>
               <Text style={styles.confirmDesc}>您即将以 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{formatMoney(parsedPrice)}</Text> 的价格将此藏品挂入大盘。扣除版税后，预计到手 <Text style={{color:'#D49A36', fontWeight:'900'}}>¥{formatMoney(income)}</Text>，是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModalVisible(false)}><Text style={styles.cancelBtnText}>再想想</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#D49A36'}]} onPress={executePublish} disabled={publishing}>
                     {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认无误，上架</Text>}
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
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => { setSuccessModal(null); router.replace('/(tabs)/profile'); }}>
                  <Text style={styles.confirmBtnText}>回金库等待捷报</Text>
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

  targetHeader: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#FDF8F0', marginRight: 16, borderWidth: 1, borderColor: '#EAE0D5' },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  targetSub: { fontSize: 12, color: '#8D6E63', fontFamily: 'monospace', marginBottom: 6, fontWeight: '700' },
  targetSubHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '900' },

  inputBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.02, shadowRadius: 5 },
  inputLabel: { fontSize: 14, fontWeight: '900', color: '#4E342E' },
  inputField: { fontSize: 32, fontWeight: '900', color: '#D49A36', borderBottomWidth: 1, borderColor: '#EAE0D5', paddingBottom: 10 },

  feeBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#EAE0D5' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  feeLabel: { fontSize: 13, color: '#8D6E63', fontWeight: '700' },
  feeValue: { fontSize: 13, fontWeight: '900', color: '#4E342E' },
  feeTotalRow: { borderTopWidth: 1, borderColor: '#F5EFE6', paddingTop: 12, marginBottom: 0, alignItems: 'center' },
  feeLabelTotal: { fontSize: 14, fontWeight: '900', color: '#4E342E' },
  feeValueTotal: { fontSize: 20, fontWeight: '900', color: '#D49A36' },

  hintText: { fontSize: 12, color: '#A1887F', lineHeight: 18, marginBottom: 30, fontWeight: '600' },

  submitBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24, fontWeight: '700' },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});