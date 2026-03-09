import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, SafeAreaView as RNSafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { height } = Dimensions.get('window');

export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const { colId } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // 🌟 材料燃烧相关状态
  const [showPicker, setShowPicker] = useState(false);
  const [myMaterials, setMyMaterials] = useState<any[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('collections').select('*').eq('id', colId).single().then(({data}) => {
      setCollection(data);
      setLoading(false);
    });
  }, [colId]);

  // 打开底部材料选择器
  const openMaterialPicker = async () => {
    setShowPicker(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // 假设消耗任意一张闲置卡片作为发单凭证 (可根据后续设定改为指定系列)
    const { data } = await supabase.from('nfts').select('*, collections(name, image_url)').eq('owner_id', user.id).eq('status', 'idle').limit(20);
    setMyMaterials(data || []);
  };

  const handlePublish = async () => {
    const p = parseFloat(price);
    const q = parseInt(quantity);
    
    if (isNaN(p) || p <= 0) return Alert.alert('错误', '请输入有效求购价格');
    if (isNaN(q) || q <= 0) return Alert.alert('错误', '求购数量不能少于1');
    if (!selectedMaterialId) return Alert.alert('缺少凭证', '必须燃烧一张材料卡才能发布求购单！');

    // 核心金融规则：出价不得低于地板价的70%
    const floorPrice = collection?.floor_price_cache || 0;
    if (floorPrice > 0 && p < floorPrice * 0.7) {
        return Alert.alert('出价过低', `您的出价低于市场防砸盘保护线（地板价的70%：¥${(floorPrice * 0.7).toFixed(2)}），请重新输入！`);
    }

    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 1. 验证土豆币余额并扣除 (冻结)
      const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user?.id).single();
      const totalCost = p * q;
      if (!profile || profile.potato_coin_balance < totalCost) throw new Error('您的土豆币余额不足以冻结该订单');
      
      await supabase.from('profiles').update({ potato_coin_balance: profile.potato_coin_balance - totalCost }).eq('id', user?.id);

      // 2. 燃烧材料
      await supabase.from('nfts').update({ status: 'burned' }).eq('id', selectedMaterialId);

      // 3. 写入求购大厅
      const { error } = await supabase.from('buy_orders').insert([{ collection_id: colId, buyer_id: user?.id, price: p, quantity: q }]);
      if (error) throw error;
      
      Alert.alert('✅ 发布成功', `求购单已上链！\n冻结资金: ¥${totalCost.toFixed(2)}\n已将材料打入黑洞！`, [{ text: '返回大盘', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('发布失败', err.message); } finally { setPublishing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布求购单</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
        {/* 顶部藏品信息 */}
        <View style={styles.targetHeader}>
           <Image source={{ uri: collection?.image_url }} style={styles.targetImg} />
           <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{collection?.name}</Text>
              <Text style={styles.targetSub}>发行量: {collection?.total_minted} | 流通量: {collection?.circulating_supply}</Text>
              <Text style={styles.targetSubHighlight}>当前寄售地板价: ¥{collection?.floor_price_cache || 0}</Text>
           </View>
        </View>

        {/* 表单输入区 */}
        <View style={styles.inputGroup}>
           <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>求购价格 (¥)</Text>
              <TextInput style={styles.inputField} placeholder={`最低 ¥${((collection?.floor_price_cache || 0) * 0.7).toFixed(2)}`} keyboardType="decimal-pad" value={price} onChangeText={setPrice} textAlign="right" />
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

        {/* 🌟 消耗材料专区 (复刻一岛交互) */}
        <Text style={styles.sectionTitle}>消耗材料</Text>
        <TouchableOpacity style={styles.materialBox} onPress={openMaterialPicker} activeOpacity={0.8}>
           <View style={styles.materialLeft}>
              <View style={styles.materialThumbSlot}>
                 {selectedMaterialId ? <Text style={{fontSize: 20}}>🔥</Text> : <Text style={{color: '#999'}}>+</Text>}
              </View>
              <Text style={styles.materialHint}>{selectedMaterialId ? '已选定祭品' : '点击选择需燃烧的材料'}</Text>
           </View>
           <Text style={[styles.materialStatus, selectedMaterialId ? {color: '#4CD964'} : {color: '#FF3B30'}]}>
             {selectedMaterialId ? '1/1' : '0/1'}
           </Text>
        </TouchableOpacity>

        {/* 规则说明区 */}
        <View style={styles.ruleBox}>
           <Text style={styles.ruleTitle}>求购说明</Text>
           <Text style={styles.ruleText}>1. 发起求购需消耗1张材料，求购成功或撤单后材料<Text style={{fontWeight:'800', color:'#FF3B30'}}>不予退回</Text>，直接打入黑洞。</Text>
           <Text style={styles.ruleText}>2. 求购价格不得低于当前地板价的 70%，以防恶意砸盘。</Text>
           <Text style={styles.ruleText}>3. 发起求购将全额冻结您的土豆币，若72小时未成交系统自动退款。</Text>
        </View>
      </ScrollView>

      {/* 底部支付浮层 */}
      <View style={styles.bottomBar}>
         <View style={styles.payInfo}>
            <Text style={{fontSize: 12, color: '#666'}}>需冻结资金</Text>
            <Text style={{fontSize: 24, fontWeight: '900', color: '#FF3B30'}}>¥ {((parseFloat(price)||0) * (parseInt(quantity)||1)).toFixed(2)}</Text>
         </View>
         <TouchableOpacity style={styles.payBtn} onPress={handlePublish} disabled={publishing}>
            {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.payBtnText}>确认支付</Text>}
         </TouchableOpacity>
      </View>

      {/* 🌟 底部滑出材料选择器 */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <RNSafeAreaView style={styles.bottomSheet}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>选择祭品</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: '#999', fontSize: 16}}>取消</Text></TouchableOpacity>
             </View>
             <ScrollView style={{padding: 16}}>
                {myMaterials.map(nft => (
                   <TouchableOpacity key={nft.id} style={[styles.nftPickRow, selectedMaterialId === nft.id && styles.nftPickRowActive]} onPress={() => setSelectedMaterialId(nft.id)}>
                      <Image source={{uri: nft.collections?.image_url}} style={styles.pickImg} />
                      <View style={{flex: 1}}>
                         <Text style={{fontSize: 14, fontWeight: '800', color: '#111'}}>{nft.collections?.name}</Text>
                         <Text style={{fontSize: 11, color: '#888'}}>编号: #{nft.serial_number}</Text>
                      </View>
                      <View style={[styles.checkbox, selectedMaterialId === nft.id && styles.checkboxActive]}>
                         {selectedMaterialId === nft.id && <Text style={{color:'#FFF', fontSize: 12}}>✓</Text>}
                      </View>
                   </TouchableOpacity>
                ))}
             </ScrollView>
             <View style={styles.sheetFooter}>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowPicker(false)}><Text style={{color: '#FFF', fontWeight: '900', fontSize: 16}}>确认选中</Text></TouchableOpacity>
             </View>
          </RNSafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 样式部分
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  targetHeader: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20 },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#EEE', marginRight: 12 },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 6 },
  targetSub: { fontSize: 11, color: '#888', marginBottom: 4 },
  targetSubHighlight: { fontSize: 11, color: '#D49A36', fontWeight: '700' },

  inputGroup: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  inputLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  inputField: { flex: 1, fontSize: 16, color: '#FF3B30', fontWeight: '900' },
  
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8 },
  stepperBtn: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 18, color: '#333' },
  stepperInput: { width: 40, fontSize: 15, fontWeight: '900', color: '#111' },

  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 10, marginLeft: 4 },
  materialBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E6E6E6', borderStyle: 'dashed' },
  materialLeft: { flexDirection: 'row', alignItems: 'center' },
  materialThumbSlot: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  materialHint: { fontSize: 14, color: '#666', fontWeight: '600' },
  materialStatus: { fontSize: 14, fontWeight: '900' },

  ruleBox: { backgroundColor: '#F0F6FF', padding: 16, borderRadius: 12 },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#0047AB', marginBottom: 10 },
  ruleText: { fontSize: 12, color: '#4169E1', lineHeight: 20, marginBottom: 6 },

  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderTopWidth: 1, borderColor: '#F0F0F0' },
  payInfo: { flex: 1 },
  payBtn: { backgroundColor: '#FF5722', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 24 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', height: height * 0.6, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  nftPickRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  nftPickRowActive: { borderColor: '#0066FF', backgroundColor: '#F0F6FF' },
  pickImg: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  sheetFooter: { padding: 20, borderTopWidth: 1, borderColor: '#F0F0F0' },
  confirmBtn: { backgroundColor: '#0066FF', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }
});