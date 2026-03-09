import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

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

  useEffect(() => {
    if (collectionId) fetchData();
  }, [collectionId]);

  // 🎯 核心逻辑一：自动装填弹药 (对标一岛秒开体验)
  useEffect(() => {
    const qty = parseInt(quantityStr) || 0;
    if (myPotatoCards.length > 0 && qty > 0) {
      // 自动选取编号靠后的卡作为消耗品
      const autoIds = myPotatoCards.slice(0, Math.min(qty, myPotatoCards.length)).map(c => c.id);
      setSelectedCards(autoIds);
    } else {
      setSelectedCards([]);
    }
  }, [quantityStr, myPotatoCards]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).single();
      if (colData) setTargetCollection(colData);

      // 获取闲置 Potato 门票
      const { data: matData } = await supabase
        .from('nfts')
        .select('id, serial_number, collections(name, image_url)')
        .eq('owner_id', user.id)
        .eq('status', 'idle')
        .ilike('collections.name', '%Potato%'); 
        
      if (matData) setMyPotatoCards(matData);
    } catch (err: any) {
      Alert.alert('初始化失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  const parsedQty = parseInt(quantityStr) || 1;
  const parsedPrice = parseFloat(priceStr) || 0;
  const totalPrice = parsedPrice * parsedQty * 1.01; // 1% 服务费

  // 🎯 核心逻辑二：冰点价动态警告 (黑暗森林规则)
  const floorPrice = targetCollection?.floor_price || 0;
  const isIcePrice = floorPrice > 0 && parsedPrice < floorPrice * 0.7;
  const isDelisted = !targetCollection?.floor_price; // 已退市状态

  const handlePreSubmit = () => {
    if (parsedPrice <= 0) return Alert.alert('提示', '请输入有效的狙击价格');
    if (selectedCards.length < parsedQty) {
        return Alert.alert('弹药匮乏', `本次狙击需燃烧 ${parsedQty} 张门票，你仓库里只有 ${myPotatoCards.length} 张，请先去补充物资。`);
    }
    
    // 二次确认：强化“销毁”概念
    Alert.alert(
        '💀 签署死亡契约',
        `你将冻结 ¥${totalPrice.toFixed(2)} 资金进入暗池。\n\n⚠️ 一旦有卖家点击“砸盘”成交，你装填的 ${parsedQty} 张 Potato 门票将瞬间被物理销毁（不可逆）！`,
        [
            { text: '撤回', style: 'cancel' },
            { text: '确认发布', style: 'destructive', onPress: executeBuyOrder }
        ]
    );
  };

  const executeBuyOrder = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登录');

      // 调用 v3 原子合约：一次性冻结资金+冻结NFT
      const { error } = await supabase.rpc('create_batch_buy_order_v3', {
        p_user_id: user.id,
        p_collection_id: targetCollection.id,
        p_price: parsedPrice,
        p_nft_ids: selectedCards
      });

      if (error) throw error;

      Alert.alert('🎉 狙击令已下达', '订单已进入暗池，等待恐慌抛售者撞单。', [
        { text: '返回', onPress: () => router.back() }
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        
        {/* 顶部导航 */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.backIcon}>〈</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>暗池狙击 (Snipe)</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          
          {/* 1. 狙击目标大图 */}
          <View style={styles.targetSection}>
            <Image source={{ uri: targetCollection.image_url }} style={styles.targetImage} />
            <View style={styles.targetOverlay}>
              <Text style={styles.targetName}>{targetCollection.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.floorLabel}>当前地板</Text>
                <Text style={styles.floorValue}>¥{floorPrice || '---'}</Text>
              </View>
            </View>
          </View>

          {/* 2. 出价区域 - 极简排版 */}
          <View style={styles.inputCard}>
            <View style={styles.inputLine}>
              <Text style={styles.label}>狙击单价</Text>
              <TextInput 
                style={styles.mainInput} 
                placeholder="0.00" 
                placeholderTextColor="#CCC"
                keyboardType="decimal-pad"
                value={priceStr}
                onChangeText={setPriceStr}
              />
              <Text style={styles.unit}>CNY</Text>
            </View>
            
            {/* 动态风险提示 */}
            {isIcePrice && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>⚠️ 冰点价提醒：出价远低于地板，成交概率极低</Text>
              </View>
            )}
            {isDelisted && (
              <View style={styles.delistBanner}>
                <Text style={styles.delistText}>☣️ 已触发退市保护：当前为官方残值定价狙击</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.inputLine}>
              <Text style={styles.label}>扫货数量</Text>
              <View style={styles.qtyBox}>
                <TouchableOpacity onPress={() => setQuantityStr(String(Math.max(1, parsedQty-1)))} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                <TextInput 
                  style={styles.qtyInput} 
                  keyboardType="number-pad"
                  value={quantityStr}
                  onChangeText={setQuantityStr}
                />
                <TouchableOpacity onPress={() => setQuantityStr(String(parsedQty+1))} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 3. 弹药装填可视化 */}
          <View style={styles.ammoSection}>
             <View style={styles.ammoHeader}>
                <Text style={styles.ammoTitle}>弹药库装填 (Potato门票)</Text>
                <Text style={styles.ammoCount}>{selectedCards.length} / {parsedQty}</Text>
             </View>
             
             {/* 自动装填进度条 */}
             <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {width: `${Math.min(100, (selectedCards.length/parsedQty)*100)}%`}]} />
             </View>
             
             <Text style={styles.ammoSub}>
                {selectedCards.length >= parsedQty 
                  ? '✅ 弹药已就绪，随时可以发射' 
                  : `❌ 尚缺 ${parsedQty - selectedCards.length} 张门票，狙击无法锁定`}
             </Text>
          </View>

          {/* 4. 免责条款 (压迫感字体) */}
          <View style={styles.contractSection}>
            <Text style={styles.contractText}>
              ● 本次操作将触发 <Text style={{color: '#000'}}>《土豆岛暗池撮合协议》</Text>{'\n'}
              ● 资金冻结于智能金库，不产生任何利息{'\n'}
              ● 卖方接单瞬间完成“资金-藏品-门票”三方强制互换
            </Text>
          </View>

        </ScrollView>

        {/* 5. 底部动作条 (对标一岛支付条) */}
        <View style={styles.footer}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>预合计(含税)</Text>
            <Text style={styles.totalValue}>¥{totalPrice.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.fireBtn, (selectedCards.length < parsedQty || parsedPrice <= 0) && styles.fireBtnDisabled]}
            onPress={handlePreSubmit}
            disabled={submitting || selectedCards.length < parsedQty || parsedPrice <= 0}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.fireBtnText}>冻结并发布</Text>}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  container: { flex: 1, backgroundColor: '#F2F2F2' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 50, backgroundColor: '#FFF' },
  navBtn: { width: 40 },
  backIcon: { fontSize: 20, fontWeight: '300' },
  navTitle: { fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // 目标展示区
  targetSection: { width: '100%', height: 200, backgroundColor: '#000' },
  targetImage: { width: '100%', height: '100%', opacity: 0.7 },
  targetOverlay: { position: 'absolute', bottom: 20, left: 20 },
  targetName: { color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  floorLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginRight: 8 },
  floorValue: { color: '#FFD700', fontSize: 16, fontWeight: '700' },

  // 输入卡片
  inputCard: { backgroundColor: '#FFF', margin: 16, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  inputLine: { flexDirection: 'row', alignItems: 'center', height: 60 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', width: 80 },
  mainInput: { flex: 1, fontSize: 24, fontWeight: '900', color: '#000', textAlign: 'right', paddingRight: 10 },
  unit: { fontSize: 14, fontWeight: '700', color: '#999' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 5 },
  
  qtyBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '600' },
  qtyInput: { width: 60, textAlign: 'center', fontSize: 20, fontWeight: '800' },

  // 警告样式
  warningBanner: { backgroundColor: '#FFF5F5', padding: 10, borderRadius: 10, marginTop: 10 },
  warningText: { color: '#FF3B30', fontSize: 12, fontWeight: '600' },
  delistBanner: { backgroundColor: '#111', padding: 10, borderRadius: 10, marginTop: 10 },
  delistText: { color: '#FFD700', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // 弹药装填
  ammoSection: { paddingHorizontal: 20, marginBottom: 20 },
  ammoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ammoTitle: { fontSize: 14, fontWeight: '700', color: '#666' },
  ammoCount: { fontSize: 14, fontWeight: '900', color: '#000' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FF3B30' },
  ammoSub: { fontSize: 12, color: '#999', marginTop: 8, fontWeight: '600' },

  contractSection: { padding: 20 },
  contractText: { fontSize: 12, color: '#AAA', lineHeight: 20 },

  // 底部动作条
  footer: { position: 'absolute', bottom: 0, width: '100%', height: 90, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  totalInfo: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#FF3B30' },
  fireBtn: { backgroundColor: '#000', paddingHorizontal: 30, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  fireBtnDisabled: { backgroundColor: '#CCC' },
  fireBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});