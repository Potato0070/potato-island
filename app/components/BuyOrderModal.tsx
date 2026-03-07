import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// 修复点 1：往上退两级找到 supabase
import { supabase } from '../../supabase';

export default function BuyOrderModal({ currentUser, collectionData, onClose, onRefresh }: any) {
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedCards, setSelectedCards] = useState<string[]>([]); // 存放选中的 Potato卡 UUID
  const [minPrice, setMinPrice] = useState(0);

  // 1. 初始化计算最低价
  useEffect(() => {
    if (collectionData) {
      const floor = collectionData.floor_price;
      const max = collectionData.max_price;
      const minLimit = floor ? floor * 0.7 : max * 0.7;
      setMinPrice(minLimit);
    }
  }, [collectionData]);

  // 2. 数量加减
  const handleQuantityChange = (delta: number) => {
    const newQ = quantity + delta;
    if (newQ >= 1 && newQ <= 1000) setQuantity(newQ);
  };

  // 3. 打开卡片选择器
  const openCardSelector = () => {
    Alert.alert('提示', `这里即将接入：从金库里勾选 ${quantity} 张闲置的 Potato卡`);
    // 临时测试用：假装选中了对应数量的卡
    // setSelectedCards(Array(quantity).fill('test-uuid')); 
  };

  // 4. 提交订单
  const handleSubmit = async () => {
    const numPrice = parseFloat(price);
    
    // 纯前端拦截
    if (!numPrice || numPrice <= 0) return Alert.alert('提示', '请输入有效的求购价');
    if (numPrice < minPrice) return Alert.alert('提示', `求购价不能低于 ¥${minPrice.toFixed(2)}`);
    if (numPrice > collectionData.max_price) return Alert.alert('提示', `求购价不能高于 ¥${collectionData.max_price}`);
    if (selectedCards.length !== quantity) return Alert.alert('提示', `请先放入 ${quantity} 张 Potato卡作为消耗材料`);

    try {
      const { error } = await supabase.rpc('create_batch_buy_order_with_freeze', {
        p_user_id: currentUser.id,
        p_collection_id: collectionData.id,
        p_price: numPrice,
        p_quantity: quantity,
        p_selected_nft_ids: selectedCards
      });

      if (error) throw error;

      Alert.alert('🎉 发布成功', `成功发起 ${quantity} 笔求购，已冻结对应 Potato卡！`);
      onRefresh();
      onClose();
    } catch (e: any) {
      Alert.alert('发布失败', e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* 价格输入区 */}
      <View style={styles.section}>
        <Text style={styles.label}>求购价格</Text>
        <TextInput
          style={styles.input}
          placeholder={`最低输入 ¥${minPrice.toFixed(2)}`}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          placeholderTextColor="#999"
        />
      </View>

      {/* 数量选择区 */}
      <View style={styles.sectionRow}>
        <Text style={styles.label}>求购数量</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => handleQuantityChange(-1)} style={styles.stepBtn}>
            <Text style={styles.stepText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{quantity}</Text>
          <TouchableOpacity onPress={() => handleQuantityChange(1)} style={styles.stepBtn}>
            <Text style={styles.stepText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 材料消耗槽 (一岛精髓) */}
      <View style={styles.materialSection}>
        <Text style={styles.label}>消耗材料</Text>
        <TouchableOpacity style={styles.materialSlot} onPress={openCardSelector}>
          {/* 这里可以放一个默认的材料底图 */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <Text style={{color: '#999', fontSize: 24}}>+</Text>
          </View>
          {/* 悬浮的数量指示器 */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{selectedCards.length}/{quantity}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 底部按钮 */}
      <TouchableOpacity 
         style={[styles.submitBtn, selectedCards.length === quantity ? styles.submitBtnActive : {}]} 
         onPress={handleSubmit}
      >
        <Text style={styles.submitBtnText}>预支付 ¥ {price ? (parseFloat(price) * quantity * 1.01).toFixed(2) : '--'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#FFF', borderRadius: 16 },
  section: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 12, padding: 16, marginBottom: 12 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333', width: 80 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, padding: 4 },
  stepBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 6 },
  stepText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  stepValue: { width: 40, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#333' },
  materialSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 12, padding: 16, marginBottom: 24 },
  materialSlot: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#EEE', position: 'relative', borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed' },
  badge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#CCC', padding: 16, borderRadius: 30, alignItems: 'center' },
  submitBtnActive: { backgroundColor: '#1A1A1A' }, // 激活时变黑/你的主题色
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});