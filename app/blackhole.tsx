import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function BlackholeScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  
  const [showPicker, setShowPicker] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const getColName = (nft: any) => {
     if (!nft || !nft.collections) return '未知藏品';
     return Array.isArray(nft.collections) ? (nft.collections[0]?.name || '未知') : (nft.collections.name || '未知');
  };
  
  const getColImage = (nft: any) => {
     if (!nft || !nft.collections) return 'https://via.placeholder.com/150';
     return Array.isArray(nft.collections) ? (nft.collections[0]?.image_url || 'https://via.placeholder.com/150') : (nft.collections.image_url || 'https://via.placeholder.com/150');
  };

  const openPicker = async () => {
    setShowPicker(true);
    try {
       const { data: { user } } = await supabase.auth.getUser();
       const { data } = await supabase.from('nfts')
         .select('*, collections(name, image_url)')
         .eq('owner_id', user?.id)
         .eq('status', 'idle');
       
       if (data) {
          const validNfts = data.filter((nft: any) => {
             return getColName(nft) !== 'Potato卡';
          });
          setMyNfts(validNfts);
       }
    } catch (err) {
       console.error(err);
    }
  };

  const handleThrowClick = () => {
    if (!selectedNft) return showToast('请先点击上方选择要投入黑洞的藏品！');
    setConfirmModal(true);
  };

  const executeThrow = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');
      
      await supabase.from('nfts').update({ status: 'burned' }).eq('id', selectedNft.id);

      const { data: cols } = await supabase.from('collections').select('id, name, total_minted').in('name', ['Potato卡', '万能土豆卡']);
      const potatoCol = cols?.find(c => c.name === 'Potato卡');
      const universalCol = cols?.find(c => c.name === '万能土豆卡');

      const roll = Math.floor(Math.random() * 100); 
      let resTitle = '';
      let resMsg = '';
      
      if (roll === 99) { 
         if (universalCol) {
            const newSerial = (universalCol.total_minted || 0) + 1;
            await supabase.from('nfts').insert([{ collection_id: universalCol.id, owner_id: user.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', universalCol.id);
         }
         resTitle = '🌟 神迹显现！';
         resMsg = '废墟中凝结出了一张【万能土豆卡】，已打入您的金库！';
      } else { 
         if (potatoCol) {
            const newSerial = (potatoCol.total_minted || 0) + 1;
            await supabase.from('nfts').insert([{ collection_id: potatoCol.id, owner_id: user.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', potatoCol.id);
         }
         resTitle = '💥 献祭完毕！';
         resMsg = '藏品已被粉碎，残渣凝结成了 1 张【Potato卡】，已放入金库。';
      }

      setConfirmModal(false);
      setResultModal({ title: resTitle, msg: resMsg });
    } catch (err: any) { 
       setConfirmModal(false);
       showToast(`销毁失败: ${err.message}`); 
    } finally { 
       setProcessing(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>黑洞废墟</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.header}>
            <Text style={{fontSize: 60, marginBottom: 10}}>🕳️</Text>
            <Text style={styles.title}>绝对通缩废墟</Text>
            <Text style={styles.subtitle}>将滞销或贬值的数字藏品投入黑洞，清理大盘泡沫，搏取终极万能卡。</Text>
         </View>

         <View style={styles.ruleBox}>
            <Text style={styles.ruleTitle}>黑洞法则</Text>
            <View style={styles.ruleRow}><Text style={styles.ruleDot}>•</Text><Text style={styles.ruleText}>投入任意闲置藏品将被<Text style={{color:'#FF3B30', fontWeight:'800'}}>永久销毁</Text></Text></View>
            <View style={styles.ruleRow}><Text style={styles.ruleDot}>•</Text><Text style={styles.ruleText}>99% 概率失败，保底获得 1 张 Potato卡</Text></View>
            <View style={styles.ruleRow}><Text style={styles.ruleDot}>•</Text><Text style={styles.ruleText}>1% 概率发生奇迹，获得 1 张 万能土豆卡</Text></View>
         </View>

         <TouchableOpacity style={styles.selectNftBox} onPress={openPicker} activeOpacity={0.8}>
            {selectedNft ? (
              <View style={{alignItems: 'center'}}>
                 <Image source={{uri: getColImage(selectedNft)}} style={styles.selectedImg} />
                 <Text style={styles.selectedName}>{getColName(selectedNft)}</Text>
                 <Text style={styles.selectedSerial}>#{String(selectedNft.serial_number || 0).padStart(6, '0')}</Text>
              </View>
            ) : (
              <View style={{alignItems: 'center'}}>
                 <View style={styles.emptyNftIcon}><Text style={{fontSize: 30, color: '#D49A36'}}>+</Text></View>
                 <Text style={styles.emptyNftText}>点击选择要销毁的祭品</Text>
              </View>
            )}
         </TouchableOpacity>

         <TouchableOpacity style={[styles.throwBtn, !selectedNft && {backgroundColor: '#EAE0D5'}]} onPress={handleThrowClick} disabled={processing || !selectedNft}>
            <Text style={[styles.throwBtnText, !selectedNft && {color: '#A1887F'}]}>一键投入黑洞</Text>
         </TouchableOpacity>
      </ScrollView>

      {/* 底部抽屉选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择祭品 (已过滤 Potato卡)</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#8D6E63', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myNfts.length === 0 ? (
                   <Text style={{color: '#8D6E63', textAlign: 'center', marginTop: 40}}>金库中暂无可以献祭的藏品</Text>
                ) : (
                   myNfts.map(nft => (
                      <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedNft?.id === nft.id && styles.nftPickRowActive]} onPress={() => { setSelectedNft(nft); setShowPicker(false); }}>
                         <Image source={{uri: getColImage(nft)}} style={styles.pickImg} />
                         <View style={{flex: 1}}>
                            <Text style={[{fontSize: 14, fontWeight: '900', color: '#4E342E'}, selectedNft?.id === nft.id && {color: '#D49A36'}]}>{getColName(nft)}</Text>
                            <Text style={{fontSize: 11, color: '#8D6E63'}}>编号: #{String(nft.serial_number || 0).padStart(6, '0')}</Text>
                         </View>
                      </TouchableOpacity>
                   ))
                )}
             </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>🕳️ 确认投入黑洞</Text>
               <Text style={styles.confirmDesc}>您确定要将【<Text style={{color:'#D49A36', fontWeight:'900'}}>{getColName(selectedNft)}</Text>】投入黑洞吗？警告：藏品将被永久销毁！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtnOutline} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnOutlineText}>我害怕了</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeThrow} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>搏一搏！</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#D49A36', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#D49A36', fontSize: 20}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 16, color: '#4E342E', fontWeight: '900'}]}>{resultModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#D49A36'}]} onPress={() => { setResultModal(null); setSelectedNft(null); router.replace('/(tabs)/profile'); }}>
                  <Text style={styles.confirmBtnText}>回金库验货</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 彻底干掉黑客帝国风格，换成高贵的复古米白
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  header: { alignItems: 'center', paddingVertical: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#4E342E', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#8D6E63', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  
  ruleBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#F0E6D2', shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#D49A36', marginBottom: 12 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  ruleDot: { color: '#D49A36', marginRight: 8, fontSize: 16 },
  ruleText: { fontSize: 13, color: '#8D6E63', flex: 1, lineHeight: 20 },
  
  selectNftBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 30, borderWidth: 2, borderColor: '#EAE0D5', borderStyle: 'dashed' },
  emptyNftIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FDF8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#D49A36' },
  emptyNftText: { color: '#D49A36', fontSize: 14, fontWeight: '800' },
  selectedImg: { width: 120, height: 120, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EAE0D5' },
  selectedName: { fontSize: 16, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  selectedSerial: { fontSize: 13, color: '#8D6E63', fontFamily: 'monospace', fontWeight: '700' },
  
  // 🌟 红色按钮变成贵气琥珀金
  throwBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
  throwBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FDF8F0', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#EAE0D5', backgroundColor: '#FFF' },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#4E342E' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F0E6D2' },
  nftPickRowActive: { borderColor: '#D49A36', borderWidth: 2, backgroundColor: '#FFFDF5' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#FDF8F0' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtnOutline: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', borderWidth: 1, borderColor: '#EAE0D5', alignItems: 'center' },
  cancelBtnOutlineText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});