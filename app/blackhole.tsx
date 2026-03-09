import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function BlackholeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  
  // 选卡逻辑
  const [showPicker, setShowPicker] = useState(false);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, universal_cards').eq('id', user.id).single();
      setProfile(data);
    }
  };

  const openPicker = async () => {
    setShowPicker(true);
    const { data: { user } } = await supabase.auth.getUser();
    // 排除掉不能献祭的东西 (比如 Potato卡如果作为NFT的话，但现在是积分了，这里直接拉取所有的数字藏品)
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user?.id).eq('status', 'idle');
    setMyNfts(data || []);
  };

  // 🛡️ 强制二次弹窗确认
  const handleThrow = () => {
    if (!selectedNft) return Alert.alert('提示', '请先选择要投入黑洞的数字藏品！');

    Alert.alert(
      '🕳️ 确认投入黑洞',
      `您确定要将【${selectedNft.collections?.name}】投入黑洞吗？\n警告：藏品将被永久销毁！99%概率失败转化为1张Potato卡，仅1%概率获得万能卡！`,
      [
        { text: '我害怕了', style: 'cancel' },
        { text: '搏一搏！', style: 'destructive', onPress: executeThrow }
      ]
    );
  };

  const executeThrow = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. 燃烧卡片
      await supabase.from('nfts').update({ status: 'burned' }).eq('id', selectedNft.id);

      // 2. 🌟 核心：99% 与 1% 判定
      const roll = Math.floor(Math.random() * 100); // 0-99
      let resultMsg = '';
      
      if (roll === 99) {
         // 1% 极品成功
         await supabase.from('profiles').update({ universal_cards: (profile.universal_cards || 0) + 1 }).eq('id', user?.id);
         resultMsg = '🌟 神迹显现！\n废墟中凝结出了一张【万能土豆卡】！';
      } else {
         // 99% 失败保底
         await supabase.from('profiles').update({ potato_cards: (profile.potato_cards || 0) + 1 }).eq('id', user?.id);
         resultMsg = '💥 献祭失败！\n藏品已被黑洞粉碎，残渣凝结成了 1 张【Potato卡】。';
      }

      // 3. 成功弹窗
      Alert.alert('结果揭晓', resultMsg, [{ text: '确认', onPress: () => {
         setSelectedNft(null);
         fetchProfile();
      }}]);
    } catch (err: any) { Alert.alert('失败', err.message); } finally { setProcessing(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>黑洞废墟</Text>
        <View style={styles.navBtn} />
      </View>

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
                 <Image source={{uri: selectedNft.collections?.image_url}} style={styles.selectedImg} />
                 <Text style={styles.selectedName}>{selectedNft.collections?.name}</Text>
                 <Text style={styles.selectedSerial}>#{String(selectedNft.serial_number).padStart(6, '0')}</Text>
              </View>
            ) : (
              <View style={{alignItems: 'center'}}>
                 <View style={styles.emptyNftIcon}><Text style={{fontSize: 30}}>+</Text></View>
                 <Text style={styles.emptyNftText}>点击选择要销毁的祭品</Text>
              </View>
            )}
         </TouchableOpacity>

         <TouchableOpacity 
            style={[styles.throwBtn, !selectedNft && {backgroundColor: '#CCC'}]} 
            onPress={handleThrow} 
            disabled={processing || !selectedNft}
         >
            {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.throwBtnText}>一键投入黑洞</Text>}
         </TouchableOpacity>
      </ScrollView>

      {/* 底部选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择祭品</Text>
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
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#1A1A1A' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#FFF' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#222', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#333' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#333', borderRadius: 12, marginBottom: 12 },
  nftPickRowActive: { borderColor: '#FF3B30', borderWidth: 1, backgroundColor: '#442222' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
});