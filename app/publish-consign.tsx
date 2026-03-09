import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function PublishConsignScreen() {
  const router = useRouter();
  // 接收从 my-nft-detail 传过来的藏品专属 ID (不是系列ID)
  const { id } = useLocalSearchParams(); 
  const [nft, setNft] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const PLATFORM_FEE_RATE = 0.05; // 模拟 5% 的平台创作者版税

  useEffect(() => {
    supabase.from('nfts').select('*, collections(*)').eq('id', id).single().then(({data}) => {
      setNft(data);
      setLoading(false);
    });
  }, [id]);

  const handlePublish = async () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return Alert.alert('错误', '请输入有效价格');
    
    const maxPrice = nft?.collections?.max_consign_price;
    if (maxPrice && p > maxPrice) return Alert.alert('越界警告', `为防止恶意炒作，全岛最高限价为 ¥${maxPrice}`);

    setPublishing(true);
    try {
      const { error } = await supabase.from('nfts').update({ status: 'listed', consign_price: p }).eq('id', id);
      if (error) throw error;
      Alert.alert('✅ 上架成功', '您的藏品已挂入现货大盘！', [{ text: '好的', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('失败', err.message); } finally { setPublishing(false); }
  };

  if (loading || !nft) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  const parsedPrice = parseFloat(price) || 0;
  const fee = parsedPrice * PLATFORM_FEE_RATE;
  const income = parsedPrice - fee;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布寄售</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
        {/* 顶部藏品卡片 */}
        <View style={styles.targetHeader}>
           <Image source={{ uri: nft.collections?.image_url }} style={styles.targetImg} />
           <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{nft.collections?.name}</Text>
              <Text style={styles.targetSub}>唯一编号: #{String(nft.serial_number).padStart(6, '0')}</Text>
              <Text style={styles.targetSubHighlight}>大盘最高限价: ¥{nft.collections?.max_consign_price || '无限制'}</Text>
           </View>
        </View>

        {/* 标价输入框 */}
        <View style={styles.inputBox}>
           <Text style={styles.inputLabel}>出售价格 (¥)</Text>
           <TextInput 
              style={styles.inputField} 
              placeholder="请输入您的挂单价" 
              keyboardType="decimal-pad" 
              value={price} 
              onChangeText={setPrice} 
              autoFocus
           />
        </View>

        {/* 平台版税清算台 */}
        <View style={styles.feeBox}>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>挂单金额</Text>
              <Text style={styles.feeValue}>¥ {parsedPrice.toFixed(2)}</Text>
           </View>
           <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>创作者版税 (5%)</Text>
              <Text style={[styles.feeValue, {color: '#FF3B30'}]}>- ¥ {fee.toFixed(2)}</Text>
           </View>
           <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeLabelTotal}>预计到手收益</Text>
              <Text style={styles.feeValueTotal}>¥ {income.toFixed(2)}</Text>
           </View>
        </View>

        <Text style={styles.hintText}>* 上架后资产将被冻结，直至取消挂单或被买家买走。成交后收益将自动打入您的土豆币金库。</Text>

        <TouchableOpacity style={[styles.submitBtn, parsedPrice <= 0 && {backgroundColor: '#CCC'}]} onPress={handlePublish} disabled={publishing || parsedPrice <= 0}>
           {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>确认上架大盘</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F0F0F0' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  targetHeader: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
  targetImg: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#EEE', marginRight: 16 },
  targetInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 16, fontWeight: '900', color: '#111', marginBottom: 6 },
  targetSub: { fontSize: 12, color: '#666', fontFamily: 'monospace', marginBottom: 6 },
  targetSubHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '800' },

  inputBox: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 12 },
  inputField: { fontSize: 32, fontWeight: '900', color: '#0066FF', borderBottomWidth: 1, borderColor: '#F0F0F0', paddingBottom: 10 },

  feeBox: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  feeLabel: { fontSize: 13, color: '#666' },
  feeValue: { fontSize: 13, fontWeight: '700', color: '#111' },
  feeTotalRow: { borderTopWidth: 1, borderColor: '#E6E6E6', paddingTop: 12, marginBottom: 0, alignItems: 'center' },
  feeLabelTotal: { fontSize: 14, fontWeight: '900', color: '#111' },
  feeValueTotal: { fontSize: 20, fontWeight: '900', color: '#4CD964' },

  hintText: { fontSize: 12, color: '#999', lineHeight: 18, marginBottom: 30 },

  submitBtn: { backgroundColor: '#0066FF', paddingVertical: 16, borderRadius: 25, alignItems: 'center', shadowColor: '#0066FF', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});