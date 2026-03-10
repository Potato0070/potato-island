import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function BlackholeScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  
  // 选卡逻辑状态
  const [showPicker, setShowPicker] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  // 🌟 高级弹窗状态
  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState<{title: string, msg: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // 🌟 核心防白屏：极限容错的数据解析函数
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
       // 去真实仓库里翻出所有闲置的数字藏品
       const { data } = await supabase.from('nfts')
         .select('*, collections(name, image_url)')
         .eq('owner_id', user?.id)
         .eq('status', 'idle');
       
       // 🌟 核心拦截：不允许投入 Potato卡！
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
      
      // 1. 物理燃烧掉你丢进来的垃圾卡
      await supabase.from('nfts').update({ status: 'burned' }).eq('id', selectedNft.id);

      // 2. 获取大盘里的 Potato卡 和 万能土豆卡 的系列 ID，用来给你印真实的新钞票！
      const { data: cols } = await supabase.from('collections').select('id, name, total_minted').in('name', ['Potato卡', '万能土豆卡']);
      const potatoCol = cols?.find(c => c.name === 'Potato卡');
      const universalCol = cols?.find(c => c.name === '万能土豆卡');

      // 3. 99% 与 1% 真实判定
      const roll = Math.floor(Math.random() * 100); 
      let resTitle = '';
      let resMsg = '';
      
      if (roll === 99) { 
         // 🌟 1% 极品：铸造 1 张真实的【万能土豆卡】NFT 给玩家
         if (universalCol) {
            const newSerial = (universalCol.total_minted || 0) + 1;
            await supabase.from('nfts').insert([{ collection_id: universalCol.id, owner_id: user.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', universalCol.id);
         }
         resTitle = '🌟 神迹显现！';
         resMsg = '废墟中凝结出了一张【万能土豆卡】，已打入您的金库！';
      } else { 
         // 🌟 99% 保底：铸造 1 张真实的【Potato卡】NFT 给玩家
         if (potatoCol) {
            const newSerial = (potatoCol.total_minted || 0) + 1;
            await supabase.from('nfts').insert([{ collection_id: potatoCol.id, owner_id: user.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', potatoCol.id);
         }
         resTitle = '💥 献祭失败！';
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
                 <View style={styles.emptyNftIcon}><Text style={{fontSize: 30, color: '#888'}}>+</Text></View>
                 <Text style={styles.emptyNftText}>点击选择要销毁的祭品</Text>
              </View>
            )}
         </TouchableOpacity>

         <TouchableOpacity style={[styles.throwBtn, !selectedNft && {backgroundColor: '#555'}]} onPress={handleThrowClick} disabled={processing || !selectedNft}>
            <Text style={styles.throwBtnText}>一键投入黑洞</Text>
         </TouchableOpacity>
      </ScrollView>

      {/* 底部抽屉选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择祭品 (已过滤 Potato卡)</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#999', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myNfts.length === 0 ? (
                   <Text style={{color: '#888', textAlign: 'center', marginTop: 40}}>金库中暂无可以献祭的藏品</Text>
                ) : (
                   myNfts.map(nft => (
                      <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedNft?.id === nft.id && styles.nftPickRowActive]} onPress={() => { setSelectedNft(nft); setShowPicker(false); }}>
                         <Image source={{uri: getColImage(nft)}} style={styles.pickImg} />
                         <View style={{flex: 1}}>
                            <Text style={{fontSize: 14, fontWeight: '800', color: '#FFF'}}>{getColName(nft)}</Text>
                            <Text style={{fontSize: 11, color: '#888'}}>编号: #{String(nft.serial_number || 0).padStart(6, '0')}</Text>
                         </View>
                      </TouchableOpacity>
                   ))
                )}
             </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🌟 黑洞确认悬浮窗 */}
      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {backgroundColor: '#222', borderColor: '#444', borderWidth: 1}]}>
               <Text style={[styles.confirmTitle, {color: '#FFF'}]}>🕳️ 确认投入黑洞</Text>
               <Text style={styles.confirmDesc}>您确定要将【<Text style={{color:'#FFF', fontWeight:'900'}}>{getColName(selectedNft)}</Text>】投入黑洞吗？警告：藏品将被永久销毁！</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={[styles.cancelBtn, {backgroundColor: '#444'}]} onPress={() => setConfirmModal(false)}><Text style={[styles.cancelBtnText, {color: '#CCC'}]}>我害怕了</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeThrow} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>搏一搏！</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* 🌟 销毁结果悬浮窗 */}
      <Modal visible={!!resultModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, {backgroundColor: '#222', borderColor: '#FF3B30', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#FF3B30', fontSize: 20}]}>{resultModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 16, color: '#FFF', fontWeight: '800'}]}>{resultModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%'}]} onPress={() => { setResultModal(null); setSelectedNft(null); router.replace('/(tabs)/profile'); }}>
                  <Text style={styles.confirmBtnText}>回金库验货</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#1A1A1A' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#FFF' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#111', fontSize: 14, fontWeight: '900' },
  
  header: { alignItems: 'center', paddingVertical: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  ruleBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#FFF', marginBottom: 12 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  ruleDot: { color: '#888', marginRight: 8, fontSize: 16 },
  ruleText: { fontSize: 13, color: '#CCC', flex: 1, lineHeight: 20 },
  
  selectNftBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  emptyNftIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyNftText: { color: '#888', fontSize: 14, fontWeight: '600' },
  selectedImg: { width: 120, height: 120, borderRadius: 12, marginBottom: 12 },
  selectedName: { fontSize: 16, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  selectedSerial: { fontSize: 13, color: '#888', fontFamily: 'monospace' },
  
  throwBtn: { backgroundColor: '#FF3B30', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#FF3B30', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
  throwBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#222', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#333' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#333', borderRadius: 12, marginBottom: 12 },
  nftPickRowActive: { borderColor: '#FF3B30', borderWidth: 1, backgroundColor: '#442222' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});