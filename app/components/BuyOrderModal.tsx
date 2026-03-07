import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabase';

export default function BuyOrderModal({ currentUser, collectionData, onClose, onRefresh }: any) {
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [myPotatoCards, setMyPotatoCards] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // 计算价格下限
  const minLimit = collectionData?.floor_price 
    ? collectionData.floor_price * 0.7 
    : (collectionData?.max_price || 0) * 0.7;

  // 获取金库里的 Potato 卡
  const fetchMyCards = async () => {
    setIsSelecting(true);
    setLoadingCards(true);
    try {
      const { data } = await supabase
        .from('nfts')
        .select('id, serial_number, collections(name, image_url)')
        .eq('owner_id', currentUser.id)
        .eq('status', 'idle')
        .ilike('collections.name', '%Potato%'); // 模糊匹配 Potato 卡
      setMyPotatoCards(data || []);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedCards.includes(id)) {
      setSelectedCards(selectedCards.filter(i => i !== id));
    } else {
      if (selectedCards.length >= quantity) {
        Alert.alert('数量超限', `当前求购数量为 ${quantity}，仅需质押 ${quantity} 张卡`);
        return;
      }
      setSelectedCards([...selectedCards, id]);
    }
  };

  const handleSubmit = async () => {
    const numPrice = parseFloat(price);
    if (!numPrice || numPrice < minLimit) return Alert.alert('提示', `出价不能低于 ¥${minLimit.toFixed(2)}`);
    if (selectedCards.length !== quantity) return Alert.alert('提示', `请先添加 ${quantity} 张材料卡`);

    try {
      const { error } = await supabase.rpc('create_batch_buy_order_v3', {
        p_user_id: currentUser.id,
        p_collection_id: collectionData.id,
        p_price: numPrice,
        p_nft_ids: selectedCards
      });
      if (error) throw error;
      Alert.alert('🎉 发布成功', '求购单已挂出，成交即销毁质押卡');
      onRefresh();
      onClose();
    } catch (e: any) {
      Alert.alert('发布失败', e.message);
    }
  };

  if (isSelecting) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsSelecting(false)}><Text style={styles.cancelLink}>取消</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>选择质押材料 ({selectedCards.length}/{quantity})</Text>
          <TouchableOpacity onPress={() => setIsSelecting(false)}><Text style={styles.confirmLink}>确定</Text></TouchableOpacity>
        </View>
        {loadingCards ? <ActivityIndicator style={{marginTop: 50}} /> : (
          <FlatList
            data={myPotatoCards}
            numColumns={3}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.cardItem} onPress={() => handleToggleSelect(item.id)}>
                <Image source={{ uri: item.collections?.image_url }} style={[styles.cardImg, selectedCards.includes(item.id) && styles.cardImgActive]} />
                {selectedCards.includes(item.id) && <View style={styles.checkIcon}><Ionicons name="checkmark-circle" size={20} color="#3B82F6" /></View>}
                <Text style={styles.cardSn}>#{item.serial_number}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>金库里没有可用的 Potato 卡</Text>}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>发起求购</Text>
      
      <View style={styles.inputCard}>
        <View style={styles.row}>
          <Text style={styles.label}>求购出价</Text>
          <TextInput style={styles.input} keyboardType="numeric" placeholder={`最低 ¥${minLimit.toFixed(2)}`} value={price} onChangeText={setPrice} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>求购数量</Text>
          <View style={styles.stepper}>
            <TouchableOpacity onPress={() => quantity > 1 && setQuantity(quantity - 1)} style={styles.stepBtn}><Text>-</Text></TouchableOpacity>
            <Text style={styles.stepVal}>{quantity}</Text>
            <TouchableOpacity onPress={() => setQuantity(quantity + 1)} style={styles.stepBtn}><Text>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.subLabel}>消耗材料</Text>
      <TouchableOpacity style={styles.slot} onPress={fetchMyCards}>
        {selectedCards.length > 0 ? (
          <Image source={{ uri: myPotatoCards.find(c => c.id === selectedCards[0])?.collections?.image_url }} style={styles.slotImg} />
        ) : (
          <Ionicons name="add" size={30} color="#CCC" />
        )}
        <View style={[styles.badge, selectedCards.length === quantity && {backgroundColor: '#FF3B30'}]}>
          <Text style={styles.badgeText}>{selectedCards.length}/{quantity}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.tipsBox}>
        <Text style={styles.tipTitle}>交易规则</Text>
        <Text style={styles.tipText}>· 求购成功后，质押材料将【物理销毁】实现通缩</Text>
        <Text style={styles.tipText}>· 系统预扣 ¥{(parseFloat(price || '0') * quantity * 1.01).toFixed(2)} (含1%服务费)</Text>
      </View>

      <TouchableOpacity style={[styles.submitBtn, (selectedCards.length === quantity && price) && styles.submitBtnActive]} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>确认发布</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  cancelLink: { color: '#999' },
  confirmLink: { color: '#3B82F6', fontWeight: '800' },
  mainTitle: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 20 },
  inputCard: { backgroundColor: '#F7F7F7', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 60 },
  divider: { height: 1, backgroundColor: '#EEE' },
  label: { fontSize: 15, fontWeight: '700', color: '#444' },
  input: { flex: 1, textAlign: 'right', fontSize: 16, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 30, height: 30, backgroundColor: '#FFF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD' },
  stepVal: { marginHorizontal: 15, fontSize: 16, fontWeight: '900' },
  subLabel: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  slot: { width: 80, height: 80, backgroundColor: '#F7F7F7', borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center' },
  slotImg: { width: '100%', height: '100%', borderRadius: 10 },
  badge: { position: 'absolute', top: -10, right: -10, backgroundColor: '#999', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  tipsBox: { marginTop: 20, marginBottom: 30 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#666', marginBottom: 5 },
  tipText: { fontSize: 12, color: '#999', lineHeight: 18 },
  submitBtn: { backgroundColor: '#EEE', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnActive: { backgroundColor: '#111' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cardItem: { flex: 1/3, padding: 8, alignItems: 'center' },
  cardImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F5F5F5' },
  cardImgActive: { borderWidth: 3, borderColor: '#3B82F6' },
  checkIcon: { position: 'absolute', top: 12, right: 12 },
  cardSn: { fontSize: 11, color: '#999', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});