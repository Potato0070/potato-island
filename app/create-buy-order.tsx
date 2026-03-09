import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const { colId } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [minPriceLimit, setMinPriceLimit] = useState(0);

  // 定制化高级弹窗状态
  const [confirmModal, setConfirmModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    supabase.from('collections').select('*').eq('id', colId).single().then(({data}) => {
      setCollection(data);
      const isOnSale = data?.on_sale_count > 0;
      const basePrice = isOnSale ? (data?.floor_price_cache || 0) : (data?.max_consign_price || 0);
      setMinPriceLimit(basePrice * 0.7);
      setLoading(false);
    });
  }, [colId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handlePublishClick = () => {
    const p = parseFloat(price);
    const q = parseInt(quantity);
    if (isNaN(p) || p <= 0) return showToast('请输入有效求购价格');
    if (isNaN(q) || q <= 0) return showToast('求购数量不能少于1');
    if (p < minPriceLimit) return showToast(`出价过低！不可低于底线：¥${minPriceLimit.toFixed(2)}`);

    setConfirmModal(true);
  };

  const executePublish = async () => {
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance, potato_cards').eq('id', user?.id).single();
      const totalCost = parseFloat(price) * parseInt(quantity);
      
      if (!profile || profile.potato_coin_balance < totalCost) throw new Error('土豆币余额不足！');
      if (profile.potato_cards < 1) throw new Error('缺少发布凭证：需持有至少 1 张 Potato卡！');
      
      await supabase.from('profiles').update({ 
         potato_coin_balance: profile.potato_coin_balance - totalCost,
         potato_cards: profile.potato_cards - 1 
      }).eq('id', user?.id);

      const { error } = await supabase.from('buy_orders').insert([{ collection_id: colId, buyer_id: user?.id, price: parseFloat(price), quantity: parseInt(quantity) }]);
      if (error) throw error;
      
      setConfirmModal(false);
      showToast('✅ 发布成功！资金已冻结');
      setTimeout(() => router.back(), 1500);
    } catch (err: any) { 
       setConfirmModal(false);
       showToast(`失败: ${err.message}`); 
    } finally { 
       setPublishing(false); 
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布求购单</Text>
        <View style={styles.navBtn} />
      </View>

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView contentContainerStyle={{padding: 20}}>
        <View style={styles.targetHeader}>
           <Image source={{ uri: collection?.image_url }} style={styles.targetImg} />
           <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{collection?.name}</Text>
              <Text style={styles.targetSubHighlight}>最低出价保护线: ¥{minPriceLimit.toFixed(2)}</Text>
           </View>
        </View>

        <View style={styles.inputGroup}>
           <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>求购价格 (¥)</Text>
              <TextInput style={styles.inputField} placeholder={`最低 ¥${minPriceLimit.toFixed(2)}`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} textAlign="right" />
           </View>
           <View style={[styles.inputRow, {borderBottomWidth: 0}]}>
              <Text style={styles.inputLabel}>求购数量</Text>
              <View style={styles.stepper}>
                 <TouchableOpacity onPress={() => setQuantity(Math.max(1, parseInt(quantity)-1).toString())}><Text style={styles.stepperBtn}>-</Text></TouchableOpacity>
                 <TextInput style={styles.stepperInput} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" textAlign="center" />
                 <TouchableOpacity onPress={() => setQuantity((parseInt(quantity)+1).toString())}><Text style={styles.stepperBtn}>+</Text></TouchableOpacity>
              </View>
           </View>
        </View>

        <View style={styles.ruleBox}>
           <Text style={styles.ruleTitle}>求购说明</Text>
           <Text style={styles.ruleText}>1. 发起求购需消耗 1 张 Potato卡，不予退回。</Text>
           <Text style={styles.ruleText}>2. 【未退市】最低价为地板价的70%；【已退市】最低价为最高限价的70%。</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
         <View style={styles.payInfo}>
            <Text style={{fontSize: 12, color: '#666'}}>需冻结资金</Text>
            <Text style={{fontSize: 24, fontWeight: '900', color: '#FF3B30'}}>¥ {((parseFloat(price)||0) * (parseInt(quantity)||1)).toFixed(2)}</Text>
         </View>
         <TouchableOpacity style={styles.payBtn} onPress={handlePublishClick}>
            <Text style={styles.payBtnText}>确认支付</Text>
         </TouchableOpacity>
      </View>

      {/* 🌟 高级定制确认弹窗 */}
      <Modal visible={confirmModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
               <Text style={styles.confirmTitle}>📝 订单确认</Text>
               <Text style={styles.confirmDesc}>发布求购将冻结 <Text style={{color:'#FF3B30', fontWeight:'900'}}>¥{((parseFloat(price)||0) * (parseInt(quantity)||1)).toFixed(2)}</Text> 资金，并强制销毁 <Text style={{fontWeight:'900'}}>1 张 Potato卡</Text>。若撤单，材料卡不退回。是否继续？</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(false)}><Text style={styles.cancelBtnText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={executePublish} disabled={publishing}>
                     {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认并发布</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

// 样式（同 exchange 的高阶样式，完美适配）
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  targetHeader: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20 },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#EEE', marginRight: 12 },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 6 },
  targetSubHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '700' },
  inputGroup: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  inputLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  inputField: { flex: 1, fontSize: 16, color: '#FF3B30', fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 18, color: '#333' },
  stepperInput: { width: 40, fontSize: 15, fontWeight: '900', color: '#111' },
  ruleBox: { backgroundColor: '#F0F6FF', padding: 16, borderRadius: 12 },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#0047AB', marginBottom: 10 },
  ruleText: { fontSize: 12, color: '#4169E1', lineHeight: 20, marginBottom: 6 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderTopWidth: 1, borderColor: '#F0F0F0' },
  payInfo: { flex: 1 },
  payBtn: { backgroundColor: '#FF5722', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 24 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 16, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});