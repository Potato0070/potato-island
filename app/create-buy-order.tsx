import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64) / 2; 

export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const { collectionId } = useLocalSearchParams();

  const [targetCollection, setTargetCollection] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]); 
  
  const [priceStr, setPriceStr] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!collectionId) return;
    fetchData();
  }, [collectionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 获取目标求购藏品的基本信息和限价
      const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).single();
      if (colData) setTargetCollection(colData);

      // 严格限制：只允许使用“Potato卡”作为门票
      const { data: matData } = await supabase
        .from('nfts')
        .select('id, serial_number, status, collections!inner(id, name, image_url)')
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .eq('collections.name', 'Potato卡'); 
        
      if (matData) {
        const formattedMats = (matData as any[]).map(m => ({ ...m, collections: Array.isArray(m.collections) ? m.collections[0] : m.collections }));
        setMaterials(formattedMats);
        if (formattedMats.length > 0) setSelectedMaterial(formattedMats[0]); 
      }
    } catch (err: any) {
      Alert.alert('初始化失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreSubmit = () => {
    if (materials.length === 0) return Alert.alert('缺少门票', '您当前没有空闲的【Potato卡】，请先前往大盘购买！');
    
    const p = parseFloat(priceStr);
    const q = parseInt(quantityStr, 10);
    if (isNaN(p) || p <= 0) return Alert.alert('提示', '请输入有效的求购单价');
    if (isNaN(q) || q <= 0) return Alert.alert('提示', '请输入求购数量');
    
    // 🚀 核心前置拦截：验证最高限价
    if (targetCollection?.max_consign_price && p > targetCollection.max_consign_price) {
      return Alert.alert('超过限价', `当前藏品的官方最高限价为 ¥${targetCollection.max_consign_price.toFixed(2)}，求购价不可高于此金额。`);
    }
    
    setShowConfirmModal(true);
  };

  const executeBuyOrder = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      const p = parseFloat(priceStr);
      const q = parseInt(quantityStr, 10);

      const { error } = await supabase.rpc('create_buy_order', {
        p_buyer_id: user.id,
        p_collection_id: targetCollection.id,
        p_price: p,
        p_quantity: q,
        p_material_nft_id: selectedMaterial.id
      });

      if (error) throw error;

      Alert.alert('✅ 操作成功', `如果大盘有低于您出价的挂单，系统已自动为您秒杀并退回差价！\n其余需求已挂入大盘求购池等待撮合。`, [
        { text: '返回市场', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('❌ 发起失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !targetCollection) {
    return <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#0066FF" /></SafeAreaView>;
  }

  const targetImage = targetCollection.image_url || `https://via.placeholder.com/300/1A1A1A/FFD700?text=NFT`;
  const matImage = selectedMaterial?.collections?.image_url || `https://via.placeholder.com/150/F0E68C/000000?text=Ticket`;
  const totalPrice = (parseFloat(priceStr) || 0) * (parseInt(quantityStr, 10) || 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
          <Text style={styles.navTitle}>发起求购</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* 藏品信息卡片 */}
          <View style={styles.heroCard}>
            <Image source={{ uri: targetImage }} style={styles.heroImage} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{targetCollection.name}</Text>
              <Text style={styles.heroSub}>流通量 {targetCollection.circulating_supply}</Text>
              <Text style={styles.heroFloor}>当前限价 ¥{targetCollection.max_consign_price?.toFixed(2) || '暂无'}</Text>
            </View>
          </View>

          {/* 表单输入区 */}
          <View style={styles.inputSection}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>求购价格</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="请输入1以上的金额(元)" 
                placeholderTextColor="#CCC" 
                keyboardType="decimal-pad"
                value={priceStr}
                onChangeText={setPriceStr}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>求购数量</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantityStr(String(Math.max(1, parseInt(quantityStr||'1')-1)))}><Text style={styles.qtyBtnText}>－</Text></TouchableOpacity>
                <TextInput 
                  style={styles.qtyInput} 
                  keyboardType="number-pad"
                  value={quantityStr}
                  onChangeText={setQuantityStr}
                />
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantityStr(String(parseInt(quantityStr||'1')+1))}><Text style={styles.qtyBtnText}>＋</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 门票选择区 */}
          <View style={styles.materialSection}>
            <Text style={styles.materialLabel}>消耗材料</Text>
            {materials.length > 0 ? (
              <TouchableOpacity style={styles.matBox} onPress={() => setShowMaterialModal(true)}>
                <Image source={{ uri: matImage }} style={styles.matImage} />
                <View style={styles.matBadge}><Text style={styles.matBadgeText}>1/{materials.length}</Text></View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => Alert.alert('缺少门票', '您当前没有空闲的【Potato卡】，请先前往大盘购买！')}>
                <Text style={styles.noMatText}>缺少门票 (需持有Potato卡)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 规则说明 */}
          <View style={styles.rulesSection}>
            <Text style={styles.rulesTitle}>求购说明</Text>
            <Text style={styles.rulesText}>
              1. 发起求购需消耗材料，求购成功后方销毁对应材料，若取消或系统自动取消求购单，则材料返回。{'\n\n'}
              2. 预付成功后，可在“我的订单”中随时取消求购并获得全额退款。{'\n\n'}
              3. 求购价不可超过该藏品的官方最高限价。{'\n\n'}
              {/* 🚀 新增的高亮撮合说明 */}
              <Text style={{color: '#E68A00', fontWeight: '800'}}>4. ⚡️自动撮合：如果您的求购出价 ≥ 大盘当前的最低挂单价，系统将直接按挂单价为您瞬间买入该藏品，并将多余差价即刻退回您的余额！</Text>
            </Text>
          </View>

        </ScrollView>

        {/* 底部操作栏 */}
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
             <Text style={styles.currencySymbol}>¥</Text>
             <Text style={styles.priceBig}>{totalPrice > 0 ? totalPrice.toFixed(2) : '-'}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.payBtn, submitting && {opacity: 0.5}]} 
            activeOpacity={0.8}
            onPress={handlePreSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.payBtnText}>预支付</Text>}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* 选择门票材料的弹窗 */}
      <Modal visible={showMaterialModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalFull}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => setShowMaterialModal(false)} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
            <Text style={styles.navTitle}>选择材料</Text>
            <View style={styles.navBtn} />
          </View>
          <Text style={styles.modalSubHeader}>请选择【Potato卡】中的任意1个。</Text>
          
          <FlatList
            data={materials}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 20 }}
            columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 20 }}
            renderItem={({item}) => {
              const isSel = selectedMaterial?.id === item.id;
              return (
                <TouchableOpacity style={[styles.matSelectCard, isSel && styles.matSelectCardActive]} onPress={() => setSelectedMaterial(item)}>
                  <Image source={{ uri: item.collections?.image_url || `https://via.placeholder.com/300` }} style={styles.matSelectImg} />
                  {isSel && <View style={styles.checkBadge}><Text style={styles.checkIcon}>✓</Text></View>}
                  <Text style={styles.matSelectSerial}>#{item.serial_number}</Text>
                </TouchableOpacity>
              )
            }}
          />
          <View style={{ padding: 20, paddingBottom: 40 }}>
            <TouchableOpacity style={styles.confirmMatBtn} onPress={() => setShowMaterialModal(false)}>
              <Text style={styles.confirmMatText}>确认填入材料</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 二次确认预支付的弹窗 */}
      <Modal visible={showConfirmModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>预支付确认</Text>
            <Text style={styles.modalMessage}>即将预扣 ¥{totalPrice.toFixed(2)}。若成功触发自动撮合，差价将立即退回；若进入大盘等待池，随时可全额撤单。</Text>
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={styles.modalCancelText}>暂不发布</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={executeBuyOrder}>
                <Text style={styles.modalConfirmText}>确认并冻结</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },

  heroCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  heroImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#EEE', marginRight: 16 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 6 },
  heroSub: { fontSize: 13, color: '#888', marginBottom: 6 },
  heroFloor: { fontSize: 13, color: '#FF3B30', fontWeight: '700' }, // 用红色高亮显示最高限价

  inputSection: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  inputLabel: { fontSize: 15, fontWeight: '800', color: '#111', width: 80 },
  inputField: { flex: 1, fontSize: 15, color: '#111', textAlign: 'right' },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  qtyBtnText: { fontSize: 18, color: '#333', fontWeight: '500' },
  qtyInput: { width: 60, textAlign: 'center', fontSize: 16, fontWeight: '600' },

  materialSection: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' },
  materialLabel: { fontSize: 15, fontWeight: '800', color: '#111' },
  matBox: { position: 'relative' },
  matImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#EEE' },
  matBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#FFF' },
  matBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  noMatText: { color: '#0066FF', fontSize: 13, fontWeight: '600' },

  rulesSection: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 40 },
  rulesTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  rulesText: { fontSize: 13, color: '#666', lineHeight: 22 },

  bottomBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, borderColor: '#EEE', alignItems: 'center', justifyContent: 'space-between' },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySymbol: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4, marginRight: 4 },
  priceBig: { fontSize: 28, fontWeight: '900', color: '#111' },
  payBtn: { backgroundColor: '#0066FF', width: 140, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  modalFull: { flex: 1, backgroundColor: '#F5F6F8' },
  modalSubHeader: { paddingHorizontal: 20, paddingVertical: 10, fontSize: 13, color: '#666' },
  matSelectCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', paddingBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  matSelectCardActive: { borderColor: '#0066FF' },
  matSelectImg: { width: '100%', height: CARD_WIDTH, resizeMode: 'cover' },
  matSelectSerial: { textAlign: 'center', marginTop: 10, fontSize: 13, color: '#666', fontWeight: '500' },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
  checkIcon: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  confirmMatBtn: { backgroundColor: '#0066FF', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  confirmMatText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 16 },
  modalMessage: { fontSize: 15, color: '#333', marginBottom: 30, textAlign: 'center', lineHeight: 22 },
  modalBtnGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#333' },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});