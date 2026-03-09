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
  const [myPotatoCards, setMyPotatoCards] = useState<any[]>([]); 
  
  const [priceStr, setPriceStr] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (collectionId) fetchData();
  }, [collectionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 获取目标藏品信息
      const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).single();
      if (colData) setTargetCollection(colData);

      // 2. 获取玩家金库中闲置的实体 Potato 门票卡
      const { data: matData } = await supabase
        .from('nfts')
        .select('id, serial_number, collections(name, image_url)')
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .ilike('collections.name', '%Potato%'); 
        
      if (matData) {
        setMyPotatoCards(matData);
      }
    } catch (err: any) {
      Alert.alert('初始化失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 核心：变态风控逻辑，有货托底70%，没货（已退市）直接按最高限价起拍！
  const minLimit = targetCollection?.floor_price 
    ? targetCollection.floor_price * 0.7 
    : (targetCollection?.max_price || 9999); 

  const parsedQty = parseInt(quantityStr) || 1;
  const parsedPrice = parseFloat(priceStr) || 0;
  const totalPrice = parsedPrice * parsedQty * 1.01; // 含 1% 手续费

  // ⚡️ 一键自动装填实体门票
  const handleAutoSelect = () => {
    if (myPotatoCards.length < parsedQty) {
      return Alert.alert('库存不足', `本次狙击需燃烧 ${parsedQty} 张门票，您当前仅有 ${myPotatoCards.length} 张`);
    }
    const autoIds = myPotatoCards.slice(0, parsedQty).map(c => c.id);
    setSelectedCards(autoIds);
  };

  const toggleSelect = (id: string) => {
    if (selectedCards.includes(id)) {
      setSelectedCards(selectedCards.filter(i => i !== id));
    } else {
      if (selectedCards.length >= parsedQty) {
        return Alert.alert('数量已满', `当前狙击数量为 ${parsedQty}，无需装填更多`);
      }
      setSelectedCards([...selectedCards, id]);
    }
  };

  const handlePreSubmit = () => {
    if (parsedPrice < minLimit) return Alert.alert('提示', `当前起拍价不可低于 ¥${minLimit.toFixed(2)}`);
    if (selectedCards.length !== parsedQty) return Alert.alert('提示', `请先装填 ${parsedQty} 张实体门票卡！`);
    
    setShowConfirmModal(true);
  };

  const executeBuyOrder = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      // 🚀 核心修复：调用我们写好的 v3 原子级销毁/冻结发单合约
      const { error } = await supabase.rpc('create_batch_buy_order_v3', {
        p_user_id: user.id,
        p_collection_id: targetCollection.id,
        p_price: parsedPrice,
        p_nft_ids: selectedCards
      });

      if (error) throw error;

      Alert.alert('🎉 狙击发布成功', `资金与实体门票已冻结入暗池。\n随时可在订单台撤销，一旦被接单，门票将永久销毁！`, [
        { text: '返回大盘', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('❌ 狙击失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !targetCollection) {
    return <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#FF3B30" /></SafeAreaView>;
  }

  const targetImage = targetCollection.image_url || `https://via.placeholder.com/300/1A1A1A/FFD700?text=NFT`;
  const matImage = myPotatoCards[0]?.collections?.image_url || `https://via.placeholder.com/150/F0E68C/000000?text=Ticket`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        
        {/* 顶部导航 */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
          <Text style={styles.navTitle}>暗池狙击</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          
          {/* 藏品信息卡片 */}
          <View style={styles.heroCard}>
            <Image source={{ uri: targetImage }} style={styles.heroImage} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{targetCollection.name}</Text>
              <Text style={styles.heroSub}>流通量 {targetCollection.circulating_supply || 0}</Text>
              {/* 红色高亮起拍提示 */}
              <View style={styles.limitBox}>
                 <Text style={styles.heroFloor}>当前起拍底线: ¥{minLimit.toFixed(2)}</Text>
                 {!targetCollection.floor_price && <Text style={{fontSize: 10, color: '#FFF', fontWeight: 'bold'}}>已退市机制触发</Text>}
              </View>
            </View>
          </View>

          {/* 表单输入区 */}
          <View style={styles.inputSection}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>狙击出价</Text>
              <TextInput 
                style={[styles.inputField, {color: '#FF3B30', fontWeight: '900'}]} 
                placeholder={`起拍 ¥${minLimit.toFixed(2)}`} 
                placeholderTextColor="#FFAAA5" 
                keyboardType="decimal-pad"
                value={priceStr}
                onChangeText={setPriceStr}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>扫货数量</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantityStr(String(Math.max(1, parsedQty-1)))}><Text style={styles.qtyBtnText}>－</Text></TouchableOpacity>
                <TextInput 
                  style={styles.qtyInput} 
                  keyboardType="number-pad"
                  value={quantityStr}
                  onChangeText={setQuantityStr}
                />
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantityStr(String(parsedQty+1))}><Text style={styles.qtyBtnText}>＋</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 实体门票装填区 */}
          <View style={styles.materialSection}>
            <View>
              <Text style={styles.materialLabel}>装填实体门票 ({selectedCards.length}/{parsedQty})</Text>
              <Text style={{fontSize: 12, color: '#999', marginTop: 4}}>每买1份需燃烧1张门票</Text>
            </View>
            <TouchableOpacity style={styles.matBox} onPress={() => setShowMaterialModal(true)}>
              {selectedCards.length > 0 ? (
                <Image source={{ uri: matImage }} style={styles.matImage} />
              ) : (
                <View style={[styles.matImage, {justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed'}]}>
                   <Text style={{fontSize: 24, color: '#CCC'}}>+</Text>
                </View>
              )}
              <View style={[styles.matBadge, selectedCards.length === parsedQty && {backgroundColor: '#111', borderColor: '#111'}]}>
                <Text style={styles.matBadgeText}>{selectedCards.length}/{parsedQty}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 规则说明 */}
          <View style={styles.rulesSection}>
            <Text style={styles.rulesTitle}>⚠️ 黑暗森林法则</Text>
            <Text style={styles.rulesText}>
              1. 无地板价的藏品，狙击出价直接按官方退市价起拍。{'\n\n'}
              2. 预扣款含 1% 服务费。进入暗池后，资金与装填的实体门票将被冻结。{'\n\n'}
              <Text style={{color: '#FF3B30', fontWeight: '900'}}>3. ⚡️死亡宣告：一旦被卖方接单，您装填的实体门票将被丢入黑洞，遭受永久性的物理销毁！</Text>
            </Text>
          </View>

        </ScrollView>

        {/* 底部操作栏 */}
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
             <Text style={styles.currencySymbol}>预扣 ¥</Text>
             <Text style={styles.priceBig}>{totalPrice > 0 ? totalPrice.toFixed(2) : '0.00'}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.payBtn, (selectedCards.length !== parsedQty || parsedPrice < minLimit) && {backgroundColor: '#CCC'}]} 
            activeOpacity={0.8}
            onPress={handlePreSubmit}
            disabled={submitting || selectedCards.length !== parsedQty || parsedPrice < minLimit}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.payBtnText}>冻结并发布</Text>}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* 选择实体门票弹窗 */}
      <Modal visible={showMaterialModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalFull}>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => setShowMaterialModal(false)} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
            <Text style={styles.navTitle}>装填弹药</Text>
            <TouchableOpacity style={styles.autoBtn} onPress={handleAutoSelect}>
              <Text style={styles.autoBtnText}>⚡一键装填</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={myPotatoCards}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 20 }}
            columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 20 }}
            renderItem={({item}) => {
              const isSel = selectedCards.includes(item.id);
              return (
                <TouchableOpacity style={[styles.matSelectCard, isSel && styles.matSelectCardActive]} onPress={() => toggleSelect(item.id)}>
                  <Image source={{ uri: item.collections?.image_url || `https://via.placeholder.com/300` }} style={styles.matSelectImg} />
                  {isSel && <View style={styles.checkBadge}><Text style={styles.checkIcon}>✓</Text></View>}
                  <Text style={[styles.matSelectSerial, isSel && {color: '#FF3B30', fontWeight: '900'}]}>#{item.serial_number}</Text>
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 100, color: '#999', fontWeight: '800'}}>金库里没有闲置的实体门票了</Text>}
          />
          <View style={{ padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#EEE', backgroundColor: '#FFF' }}>
            <TouchableOpacity style={[styles.confirmMatBtn, selectedCards.length === parsedQty && {backgroundColor: '#111'}]} onPress={() => setShowMaterialModal(false)}>
              <Text style={styles.confirmMatText}>{selectedCards.length === parsedQty ? '确认装填' : `还缺 ${parsedQty - selectedCards.length} 张`}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 二次确认预支付的弹窗 */}
      <Modal visible={showConfirmModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>暗池协议确认</Text>
            <Text style={styles.modalMessage}>即将冻结 ¥{totalPrice.toFixed(2)} 与 {parsedQty} 张实体门票。随时可全额撤单，撮合成功后门票即刻销毁。</Text>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9' },
  container: { flex: 1, backgroundColor: '#F9F9F9' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF', zIndex: 10 },
  navBtn: { height: 40, justifyContent: 'center', minWidth: 40 },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111', fontStyle: 'italic' },
  autoBtn: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  autoBtnText: { color: '#FF3B30', fontSize: 12, fontWeight: '900' },

  heroCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  heroImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#EEE', marginRight: 16, borderWidth: 1, borderColor: '#EEE' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 6 },
  heroSub: { fontSize: 13, color: '#888', marginBottom: 8 },
  limitBox: { backgroundColor: '#FF3B30', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  heroFloor: { fontSize: 12, color: '#FFF', fontWeight: '900' }, 

  inputSection: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  inputLabel: { fontSize: 16, fontWeight: '900', color: '#111', width: 80 },
  inputField: { flex: 1, fontSize: 18, color: '#111', textAlign: 'right' },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 32, height: 32, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  qtyBtnText: { fontSize: 18, color: '#111', fontWeight: '900' },
  qtyInput: { width: 60, textAlign: 'center', fontSize: 18, fontWeight: '900' },

  materialSection: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  materialLabel: { fontSize: 16, fontWeight: '900', color: '#111' },
  matBox: { position: 'relative' },
  matImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#EEE' },
  matBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  matBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  rulesSection: { backgroundColor: '#FFF3F3', borderRadius: 16, padding: 16, marginBottom: 40 },
  rulesTitle: { fontSize: 15, fontWeight: '900', color: '#FF3B30', marginBottom: 12 },
  rulesText: { fontSize: 13, color: '#D32F2F', lineHeight: 22, fontWeight: '700' },

  bottomBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, borderColor: '#EEE', alignItems: 'center', justifyContent: 'space-between' },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySymbol: { fontSize: 14, fontWeight: '800', color: '#666', marginBottom: 6, marginRight: 4 },
  priceBig: { fontSize: 28, fontWeight: '900', color: '#111' },
  payBtn: { backgroundColor: '#FF3B30', width: 150, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalFull: { flex: 1, backgroundColor: '#F9F9F9' },
  matSelectCard: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', paddingBottom: 12, borderWidth: 3, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  matSelectCardActive: { borderColor: '#FF3B30' },
  matSelectImg: { width: '100%', height: CARD_WIDTH, resizeMode: 'cover', borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  matSelectSerial: { textAlign: 'center', marginTop: 12, fontSize: 14, color: '#999', fontWeight: '800' },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  checkIcon: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  confirmMatBtn: { backgroundColor: '#CCC', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  confirmMatText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 16 },
  modalMessage: { fontSize: 15, color: '#666', marginBottom: 30, textAlign: 'center', lineHeight: 24, fontWeight: '600' },
  modalBtnGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modalCancelText: { fontSize: 16, fontWeight: '800', color: '#666' },
  modalConfirmBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
});