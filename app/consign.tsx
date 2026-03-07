import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

interface InventoryNFT {
  id: string;
  serial_number: string;
  collection_id: string;
  collections: {
    name: string;
    max_consign_price: number;
  };
}

export default function ConsignScreen() {
  const router = useRouter();
  
  const [myNFTs, setMyNFTs] = useState<InventoryNFT[]>([]);
  const [selectedNft, setSelectedNft] = useState<InventoryNFT | null>(null);
  const [price, setPrice] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMyInventory = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let ownerId = user?.id;
      
      if (!ownerId) {
        const { data: fallback } = await supabase.from('profiles').select('id').limit(1).single();
        ownerId = fallback?.id;
      }
      
      if (!ownerId) throw new Error('未找到钱包账户');

      const { data, error } = await supabase
        .from('nfts')
        .select(`
          id, serial_number, collection_id,
          collections ( name, max_consign_price )
        `)
        .eq('owner_id', ownerId)
        .eq('status', 'idle'); 

      if (error) throw error;
      
      // ⚠️ 修复 1：用 as any 强行绕过 TS 连表推断
      setMyNFTs((data as any) || []);
      if (data && data.length > 0) {
        setSelectedNft(data[0] as any); 
      }
    } catch (err: any) {
      console.error('获取库存失败:', err);
      Alert.alert('获取库存失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyInventory();
  }, []);

  const handleConsign = async () => {
    setErrorMsg('');
    if (!selectedNft) return setErrorMsg('请先选择要寄售的藏品');
    
    const numPrice = parseFloat(price);
    if (!numPrice || numPrice <= 0) return setErrorMsg('请输入有效的寄售价格');

    // 提取可能的数组或对象中的属性，防止运行时错误
    const maxPrice = Array.isArray(selectedNft.collections) ? selectedNft.collections[0]?.max_consign_price : selectedNft.collections?.max_consign_price;
    const colName = Array.isArray(selectedNft.collections) ? selectedNft.collections[0]?.name : selectedNft.collections?.name;

    if (numPrice > maxPrice) {
      return setErrorMsg(`超出限价！大盘规定【${colName}】的最高寄售价不得超过 ¥${maxPrice.toFixed(2)}`);
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let sellerId = user?.id;
      if (!sellerId) {
        const { data: fallback } = await supabase.from('profiles').select('id').limit(1).single();
        sellerId = fallback?.id;
      }

      const { error: insertError } = await supabase.from('listings').insert({
        nft_id: selectedNft.id,
        collection_id: selectedNft.collection_id,
        seller_id: sellerId,
        price: numPrice,
        status: 'active'
      });
      if (insertError) throw insertError;

      const { error: updateNftError } = await supabase
        .from('nfts')
        .update({ status: 'listed' })
        .eq('id', selectedNft.id);
      if (updateNftError) throw updateNftError;

      const { data: colData } = await supabase.from('collections').select('active_listings_count').eq('id', selectedNft.collection_id).single();
      if (colData) {
         await supabase.from('collections').update({ active_listings_count: colData.active_listings_count + 1 }).eq('id', selectedNft.collection_id);
      }

      Alert.alert('✅ 上架成功', `您的藏品已成功挂载到市场大厅！\n标价：¥${numPrice.toFixed(2)}`, [
        { text: '去市场看看', onPress: () => router.push('/market') }
      ]);

    } catch (err: any) {
      console.error('上架失败:', err);
      Alert.alert('❌ 上架失败', err.message || '可能该藏品已被锁定');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={{ marginTop: 12 }}>正在清点您的数字金库...</Text>
      </SafeAreaView>
    );
  }

  // 安全渲染提取
  const displayColName = selectedNft ? (Array.isArray(selectedNft.collections) ? selectedNft.collections[0]?.name : selectedNft.collections?.name) : '藏品';
  const displayMaxPrice = selectedNft ? (Array.isArray(selectedNft.collections) ? selectedNft.collections[0]?.max_consign_price : selectedNft.collections?.max_consign_price) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.backArrow}>〈</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>发布寄售</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {myNFTs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>包裹空空如也</Text>
              <Text style={styles.emptySub}>您当前没有可寄售的空闲藏品</Text>
              <TouchableOpacity style={styles.goMarketBtn} onPress={() => router.push('/market')}>
                <Text style={styles.goMarketBtnText}>去市场扫货</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.assetCard}>
                <Image 
                  source={{ uri: `https://via.placeholder.com/150/1A1A1A/FFD700?text=${encodeURIComponent(displayColName.substring(0,4))}` }} 
                  style={styles.assetImage} 
                />
                <View style={styles.assetInfo}>
                  <Text style={styles.assetName}>{displayColName}</Text>
                  <Text style={styles.assetSerial}>{selectedNft?.serial_number}</Text>
                  <View style={styles.limitBadge}>
                    <Text style={styles.limitText}>最高限价: ¥{displayMaxPrice.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>一口价 (¥)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="请输入您的售价"
                  value={price}
                  onChangeText={setPrice}
                  maxLength={10}
                />
                <Text style={styles.feeTip}>平台将收取 6% 作为交易手续费</Text>
              </View>

              {errorMsg !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {myNFTs.length > 0 && (
          <View style={styles.footer}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>预计到手 (扣除6%手续费)</Text>
              <Text style={styles.summaryTotal}>
                ¥ {price && !isNaN(parseFloat(price)) ? (parseFloat(price) * 0.94).toFixed(2) : '0.00'}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
              activeOpacity={0.8} 
              onPress={handleConsign}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>确认上架</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', height: 50, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#EEE' },
  navBtn: { padding: 4, minWidth: 50 },
  backArrow: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 16, fontWeight: '700', color: '#111', flex: 1, textAlign: 'center' },
  scrollContent: { padding: 20 },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#888', marginBottom: 24 },
  goMarketBtn: { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goMarketBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  assetCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  assetImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F0F0F0' },
  assetInfo: { marginLeft: 16, flex: 1, justifyContent: 'center' },
  assetName: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 4 },
  assetSerial: { fontSize: 13, color: '#666', marginBottom: 12 },
  limitBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF4E5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FFE0B2' },
  limitText: { color: '#E65100', fontSize: 11, fontWeight: '700' },
  formGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD', borderRadius: 12, paddingHorizontal: 16, height: 54, fontSize: 18, fontWeight: '700', color: '#111' },
  feeTip: { fontSize: 12, color: '#999', marginTop: 8 },
  errorBox: { backgroundColor: '#F8D7DA', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#F5C6CB' },
  errorText: { color: '#721C24', fontSize: 13, fontWeight: '600' },
  footer: { backgroundColor: '#FFF', padding: 20, paddingBottom: 34, borderTopWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryBox: { flex: 1 },
  summaryLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  summaryTotal: { fontSize: 22, fontWeight: '900', color: '#28A745' },
  submitBtn: { backgroundColor: '#111', paddingHorizontal: 30, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});