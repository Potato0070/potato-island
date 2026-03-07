import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function DetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [actualCirculation, setActualCirculation] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // 求购模态框状态
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetailData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUser(session?.user || null);

      // 1. 获取藏品基础资料
      const { data: colData, error: colErr } = await supabase.from('collections').select('*').eq('id', id).single();
      if (colErr) throw colErr;
      setCollection(colData);

      // 2. 实时计算流通量 (非锁定状态的所有卡)
      const { count } = await supabase
        .from('nfts')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', id)
        .neq('status', 'locked');
      setActualCirculation(count || 0);

      // 3. 抓取寄售盘口 (支持 listed 和 consigning)
      const { data: nftsData } = await supabase
        .from('nfts')
        .select('*')
        .eq('collection_id', id)
        .in('status', ['listed', 'consigning'])
        .order('price', { ascending: true });
      setListings(nftsData || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDetailData(); }, [id]));

  // 🛒 原子化购买逻辑
  const handleBuy = async (nft: any) => {
    if (!currentUser) return Alert.alert('提示', '请先登录土豆宇宙');
    
    Alert.alert('确认购买', `是否花费 ¥${nft.price} 购买 #${nft.serial_number}？`, [
        { text: '取消', style: 'cancel' },
        { text: '立即支付', onPress: async () => {
            setSubmitting(true);
            try {
                const { error } = await supabase.rpc('purchase_nft_atomic', {
                    p_nft_id: nft.id,
                    p_buyer_id: currentUser.id
                });
                if (error) throw error;
                Alert.alert('🎉 购买成功', '藏品已移交至您的金库！', [
                    { text: '去金库', onPress: () => router.push('/(tabs)/profile') },
                    { text: '留在集市', onPress: () => fetchDetailData() }
                ]);
            } catch (e: any) { Alert.alert('交易失败', e.message); } finally { setSubmitting(false); }
        }}
    ]);
  };

  // 🧬 发布求购 (含 Potato卡 冻结逻辑)
  const handleConfirmOffer = async () => {
    const price = parseFloat(offerPrice);
    if (!price || price <= 0) return Alert.alert('提示', '请输入有效的求购出价');
    
    setSubmitting(true);
    try {
      // 调用我们在 SQL 里写好的冻结函数
      const { error } = await supabase.rpc('create_buy_order_with_freeze', {
        p_user_id: currentUser.id,
        p_collection_id: id,
        p_price: price
      });

      if (error) throw error;

      Alert.alert('✅ 求购发布成功', '已为您冻结 1 张【Potato卡】作为入场券。若求购成功，该卡将被销毁；若撤销求购，该卡将返还。');
      setBuyModalVisible(false);
      setOfferPrice('');
      fetchDetailData();
    } catch (e: any) {
      // 这里会自动拦截并提示：例如“金库里没有Potato卡”
      Alert.alert('发布失败', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !collection) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#D49A36" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部导航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.backIcon}>〈</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{collection.name}</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.navBtn}><Text style={styles.navLink}>去金库</Text></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 1. 藏品大图卡片 (参考截图二) */}
        <View style={styles.infoCard}>
          <Image source={{ uri: collection.image_url }} style={styles.heroImg} />
          <View style={styles.heroRight}>
            <Text style={styles.heroName}>{collection.name}</Text>
            <View style={styles.statsRow}>
               <Text style={styles.statsLabel}>全网流通：</Text>
               <Text style={styles.statsValue}>{actualCirculation}</Text>
            </View>
            <View style={styles.statsRow}>
               <Text style={styles.statsLabel}>最高限价：</Text>
               <Text style={[styles.statsValue, {color: '#8B5A2B'}]}>¥{collection.max_consign_price?.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 2. 居中的发布求购大按钮 (参考截图二) */}
        <View style={styles.actionArea}>
          <TouchableOpacity style={styles.bigOfferBtn} activeOpacity={0.8} onPress={() => setBuyModalVisible(true)}>
             <Text style={styles.bigOfferBtnText}>发布求购单</Text>
          </TouchableOpacity>
        </View>

        {/* 3. 寄售盘口列表 */}
        <View style={styles.listHeader}>
           <Text style={styles.listTitle}>寄售盘口 ({listings.length})</Text>
        </View>

        {listings.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{flex: 1}}>
                <Text style={styles.itemSerial}>编号 #{item.serial_number}</Text>
                <Text style={styles.itemStatus}>状态: {item.status === 'consigning' ? '寄售中' : '已挂单'}</Text>
            </View>
            <Text style={styles.itemPrice}>¥{Number(item.price).toFixed(2)}</Text>
            <TouchableOpacity 
               style={[styles.smallBuyBtn, submitting && {opacity: 0.5}]} 
               onPress={() => handleBuy(item)}
               disabled={submitting}
            >
               <Text style={styles.smallBuyBtnText}>{submitting ? '...' : '购买'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {listings.length === 0 && (
            <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>当前盘口无人在售，发布求购单试试吧</Text>
            </View>
        )}
      </ScrollView>

      {/* 4. 求购发布弹窗 (参考截图三 & 十六) */}
      <Modal visible={buyModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>发起全网求购</Text>
              <TouchableOpacity onPress={() => setBuyModalVisible(false)} style={styles.closeBtn}><Text style={{fontSize: 24, color: '#999'}}>×</Text></TouchableOpacity>
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.label}>您愿意支付的价格 (元)</Text>
              <TextInput 
                style={styles.priceInput} 
                placeholder="0.00" 
                placeholderTextColor="#CCC"
                keyboardType="numeric"
                value={offerPrice}
                onChangeText={setOfferPrice}
                autoFocus
              />
            </View>

            {/* 规则说明区 (参考截图十六) */}
            <View style={styles.termsBox}>
                <Text style={styles.termTitle}>⚖️ 求购契约说明</Text>
                <Text style={styles.termText}>• 发布求购将从金库冻结 1 张【Potato卡】。</Text>
                <Text style={styles.termText}>• 系统将预扣 [出价 + 1%手续费] 的 Potato 币。</Text>
                <Text style={styles.termText}>• 求购成功：保证金卡片将被销毁，资产存入金库。</Text>
                <Text style={styles.termText}>• 撤销求购：保证金卡片与 Potato 币将全额退回。</Text>
            </View>

            <TouchableOpacity 
              style={[styles.confirmBtn, submitting && {backgroundColor: '#AAA'}]} 
              onPress={handleConfirmOffer}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>确认质押并发布</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0EBE1' },
  navBtn: { minWidth: 50, justifyContent: 'center' },
  backIcon: { fontSize: 24, fontWeight: 'bold', color: '#4A2E1B' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  navLink: { color: '#D49A36', fontWeight: '800', fontSize: 14 },

  // 资料卡
  infoCard: { flexDirection: 'row', backgroundColor: '#FFF', margin: 16, padding: 20, borderRadius: 24, shadowColor: '#4A2E1B', shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  heroImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 1, borderColor: '#EEDCBE' },
  heroRight: { flex: 1, marginLeft: 20, justifyContent: 'center' },
  heroName: { fontSize: 22, fontWeight: '900', color: '#4A2E1B', marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statsLabel: { fontSize: 13, color: '#999', fontWeight: '600' },
  statsValue: { fontSize: 14, fontWeight: '900', color: '#4A2E1B' },

  // 动作区
  actionArea: { paddingHorizontal: 16, marginBottom: 20 },
  bigOfferBtn: { backgroundColor: '#D49A36', height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  bigOfferBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  // 列表
  listHeader: { paddingHorizontal: 20, marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: '900', color: '#4A2E1B' },
  itemRow: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 10, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F0EBE1' },
  itemSerial: { fontSize: 15, fontWeight: '800', color: '#4A2E1B' },
  itemStatus: { fontSize: 11, color: '#BBB', marginTop: 2 },
  itemPrice: { fontSize: 20, fontWeight: '900', color: '#FF3B30', marginRight: 15 },
  smallBuyBtn: { backgroundColor: '#4A2E1B', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  smallBuyBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },

  emptyBox: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#CCC', fontWeight: '700' },

  // 弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(74, 46, 27, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#4A2E1B' },
  closeBtn: { padding: 5 },
  inputBox: { marginBottom: 25 },
  label: { fontSize: 14, color: '#999', fontWeight: '700', marginBottom: 12 },
  priceInput: { backgroundColor: '#F9F6F0', height: 60, borderRadius: 16, paddingHorizontal: 20, fontSize: 28, fontWeight: '900', color: '#D49A36', textAlign: 'center' },
  termsBox: { backgroundColor: '#FDFCF8', padding: 16, borderRadius: 16, marginBottom: 30, borderLeftWidth: 4, borderColor: '#D49A36' },
  termTitle: { fontSize: 15, fontWeight: '900', color: '#8B5A2B', marginBottom: 8 },
  termText: { fontSize: 12, color: '#AAA', lineHeight: 20, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#D49A36', height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});