import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function GenesisExchangeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  const [realPotatoCount, setRealPotatoCount] = useState(0);
  const [realUniversalCount, setRealUniversalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{visible: boolean, type: 'universal' | 'elder', costStr: string} | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => { fetchProfileAndInventory(); }, []);

  const fetchProfileAndInventory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profData } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
        setProfile(profData);

        const { data: myNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user.id).eq('status', 'idle');
        
        let pCount = 0;
        let uCount = 0;
        
        if (myNfts) {
           myNfts.forEach((nft: any) => {
              const colName = Array.isArray(nft.collections) ? nft.collections[0]?.name : nft.collections?.name;
              if (colName === 'Potato卡') pCount++;
              if (colName === '万能土豆卡') uCount++;
           });
        }
        
        setRealPotatoCount(pCount);
        setRealUniversalCount(uCount);
      }
    } catch(err) { console.error(err); } finally { setLoading(false); }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleExchangeClick = (type: 'universal' | 'elder') => {
    if (loading) return showToast('数据加载中，请稍后');

    if (type === 'universal') {
       if (realPotatoCount < 200) return showToast(`金库现货不足！需要 200 张真实的 Potato卡 (当前 ${realPotatoCount} 张)`);
       setConfirmModal({ visible: true, type, costStr: '200 张 Potato卡' });
    } else {
       if (realUniversalCount < 10) return showToast(`金库现货不足！需要 10 张真实的 万能土豆卡 (当前 ${realUniversalCount} 张)`);
       setConfirmModal({ visible: true, type, costStr: '10 张 万能土豆卡' });
    }
  };

  const executeExchange = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: myIdleNfts } = await supabase.from('nfts').select('id, collections(name)').eq('owner_id', user?.id).eq('status', 'idle');
      
      if (confirmModal.type === 'universal') {
         const potatoesToBurn = myIdleNfts?.filter((n: any) => (Array.isArray(n.collections) ? n.collections[0]?.name : n.collections?.name) === 'Potato卡').slice(0, 200).map(n => n.id) || [];
         
         if (potatoesToBurn.length < 200) throw new Error('金库库存异常，未能成功抓取 200 张卡片');

         await supabase.from('nfts').update({ status: 'burned' }).in('id', potatoesToBurn);

         const { data: uniColData } = await supabase.from('collections').select('id, total_minted').eq('name', '万能土豆卡').single();
         if (uniColData) {
            const newSerial = (uniColData.total_minted || 0) + 1;
            await supabase.from('nfts').insert([{ collection_id: uniColData.id, owner_id: user?.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', uniColData.id);
         }
         
         showToast('✅ 创世神迹！成功兑换 1 张真实的【万能土豆卡】！');
      } 
      else if (confirmModal.type === 'elder') {
         const universalsToBurn = myIdleNfts?.filter((n: any) => (Array.isArray(n.collections) ? n.collections[0]?.name : n.collections?.name) === '万能土豆卡').slice(0, 10).map(n => n.id) || [];
         
         if (universalsToBurn.length < 10) throw new Error('金库万能卡库存异常！');

         await supabase.from('nfts').update({ status: 'burned' }).in('id', universalsToBurn);

         const { data: colData } = await supabase.from('collections').select('id, total_minted').eq('name', '褐皮土豆长老').single();
         if (!colData) throw new Error('系统尚未配置【褐皮土豆长老】系列资产！');

         const newSerial = (colData.total_minted || 0) + 1;
         await supabase.from('nfts').insert([{ collection_id: colData.id, owner_id: user?.id, serial_number: newSerial.toString(), status: 'idle' }]);
         await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', colData.id);

         await supabase.from('announcements').insert([{ 
            title: '👑 创世殿堂降临神迹！', 
            content: `恭喜岛民【${profile?.nickname || '神秘玩家'}】在创世发新殿堂，永久燃烧了 10 张万能卡，成功召唤出神级资产【褐皮土豆长老】！全岛震动！`, 
            author_name: '创世中枢', 
            is_featured: true 
         }]);

         showToast('👑 伟大的岛主！神级资产【褐皮土豆长老】已打入您的金库！');
      }

      setConfirmModal(null);
      fetchProfileAndInventory();
    } catch (err: any) { 
      showToast(`兑换失败: ${err.message}`); 
      setConfirmModal(null);
    } finally { 
      setProcessing(false); 
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  // 🌟 核心防误触逻辑：计算是否买得起
  const canBuyUniversal = realPotatoCount >= 200;
  const canBuyElder = realUniversalCount >= 10;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 🌟 极简护眼导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>创世发新</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>超级单品兑换殿堂</Text>
            <Text style={styles.headerSub}>收集基础材料，向上合成，获取全岛最顶级的权力资产。</Text>
            <View style={styles.balanceRow}>
               <Text style={styles.balanceText}>Potato卡: <Text style={{color:'#FF3B30'}}>{realPotatoCount}</Text></Text>
               <Text style={styles.balanceText}>万能卡: <Text style={{color:'#D49A36'}}>{realUniversalCount}</Text></Text>
            </View>
         </View>

         {/* 兑换卡片 1：万能土豆卡 */}
         <View style={styles.exchangeCard}>
            <View style={styles.cardInfo}>
               <View style={styles.imgPlaceholder}><Text style={{fontSize: 40}}>🌟</Text></View>
               <View style={{flex: 1, marginLeft: 16}}>
                  <Text style={styles.itemName}>万能土豆卡</Text>
                  <Text style={styles.itemDesc}>极其稀有的高级合成材料与权力凭证。</Text>
               </View>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>兑换所需</Text>
               <Text style={styles.costValue}>200 张 Potato卡</Text>
            </View>
            
            {/* 🌟 防误触按钮：材料不够直接灰显 */}
            <TouchableOpacity 
               style={[styles.actionBtn, !canBuyUniversal && styles.actionBtnDisabled]} 
               onPress={() => handleExchangeClick('universal')}
               disabled={!canBuyUniversal || processing}
            >
               <Text style={[styles.actionBtnText, !canBuyUniversal && styles.actionBtnTextDisabled]}>
                  {canBuyUniversal ? '立即兑换' : '材料不足 (需 200 张)'}
               </Text>
            </TouchableOpacity>
         </View>

         {/* 兑换卡片 2：褐皮土豆长老 */}
         <View style={[styles.exchangeCard, {borderColor: '#D49A36', borderWidth: 2}]}>
            <View style={styles.cardInfo}>
               <View style={[styles.imgPlaceholder, {backgroundColor: '#FDF8F0', borderColor: '#D49A36', borderWidth: 1}]}><Text style={{fontSize: 40}}>👑</Text></View>
               <View style={{flex: 1, marginLeft: 16}}>
                  <Text style={styles.itemName}>褐皮土豆长老</Text>
                  <Text style={styles.itemDesc}>土豆王国的神级原住民，全网唯一数字资产凭证，拥有无上权力。</Text>
               </View>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>兑换所需</Text>
               <Text style={[styles.costValue, {color: '#D49A36'}]}>10 张 万能土豆卡</Text>
            </View>
            
            {/* 🌟 防误触按钮：材料不够直接灰显 */}
            <TouchableOpacity 
               style={[styles.actionBtn, !canBuyElder && styles.actionBtnDisabled]} 
               onPress={() => handleExchangeClick('elder')}
               disabled={!canBuyElder || processing}
            >
               <Text style={[styles.actionBtnText, !canBuyElder && styles.actionBtnTextDisabled]}>
                  {canBuyElder ? '登顶王座 (兑换)' : '材料不足 (需 10 张)'}
               </Text>
            </TouchableOpacity>
         </View>
      </ScrollView>

      {/* 🌟 优雅复古风弹窗 */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>💎 创世确认</Text>
               <Text style={styles.confirmDesc}>您即将永久燃烧 <Text style={{fontWeight:'900', color:'#FF3B30'}}>{confirmModal?.costStr}</Text>，兑换【{confirmModal?.type === 'universal' ? '万能土豆卡' : '褐皮土豆长老'}】。操作不可逆转，是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(null)}><Text style={styles.cancelBtnText}>暂不兑换</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executeExchange} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认燃烧</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🌟 全局复古米白背景
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' },
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(78, 52, 46, 0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  headerBox: { marginBottom: 30, marginTop: 10 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#4E342E', marginBottom: 10 },
  headerSub: { fontSize: 13, color: '#8D6E63', lineHeight: 20, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', backgroundColor: '#F5EFE6', padding: 12, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#EAE0D5' },
  balanceText: { color: '#4E342E', fontSize: 13, fontWeight: '800', marginRight: 16 },

  // 🌟 卡片改版为干净纯白
  exchangeCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#4E342E', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F0E6D2' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  imgPlaceholder: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#FDF8F0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  itemName: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 6 },
  itemDesc: { fontSize: 12, color: '#8D6E63', lineHeight: 18 },
  
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F5EFE6', marginBottom: 20 },
  costLabel: { fontSize: 14, color: '#8D6E63' },
  costValue: { fontSize: 16, fontWeight: '900', color: '#FF3B30' },
  
  // 🌟 正常态按钮：琥珀金
  actionBtn: { backgroundColor: '#D49A36', paddingVertical: 16, borderRadius: 25, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  // 🌟 禁用态按钮：高级灰显
  actionBtnDisabled: { backgroundColor: '#EAE0D5' },
  actionBtnTextDisabled: { color: '#A1887F' },

  // 🌟 弹窗改造：深棕色遮罩 + 纯白框
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#8D6E63', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  cancelBtnText: { color: '#8D6E63', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#D49A36', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});