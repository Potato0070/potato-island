import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function PublishConsignScreen() {
  const router = useRouter();
  const { nftId } = useLocalSearchParams();
  
  const [nft, setNft] = useState<any>(null);
  const [priceStr, setPriceStr] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!nftId) return;
    const fetchNft = async () => {
      try {
        const { data, error } = await supabase
          .from('nfts')
          .select('id, serial_number, collections(name, image_url, max_consign_price)')
          .eq('id', nftId)
          .single();
        if (error) throw error;
        setNft({ ...data, collections: Array.isArray(data.collections) ? data.collections[0] : data.collections });
      } catch (err: any) {
        Alert.alert('获取藏品失败', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNft();
  }, [nftId]);

  const handlePublish = async () => {
    const p = parseFloat(priceStr);
    if (isNaN(p) || p <= 0) return Alert.alert('错误', '请输入有效的寄售金额');

    // 🚀 核心新增：寄售前置拦截，保证不能越过岛主设定的最高限价！
    if (nft.collections?.max_consign_price && p > nft.collections.max_consign_price) {
      return Alert.alert('超过限价', `该藏品当前最高指导价为 ¥${nft.collections.max_consign_price.toFixed(2)}，您的寄售价不可越界！`);
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录');

      const { error } = await supabase.rpc('publish_listing_with_match', {
        p_nft_id: nft.id,
        p_seller_id: user.id,
        p_price: p
      });

      if (error) throw error;

      Alert.alert('✅ 操作成功', '如果全网有出价更高的求购单，已为您自动秒速成交！否则已挂牌至大盘。', [
        { text: '返回金库', onPress: () => router.push('/(tabs)/profile') }
      ]);
    } catch (err: any) {
      Alert.alert('❌ 寄售失败', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !nft) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#0066FF" /></SafeAreaView>;
  }

  const coverImg = nft.collections?.image_url || 'https://via.placeholder.com/150';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
          <Text style={styles.navTitle}>发布寄售</Text>
          <View style={styles.navBtn} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View>
            <View style={styles.infoCard}>
              <Image source={{ uri: coverImg }} style={styles.nftImage} />
              <View style={styles.infoRight}>
                <Text style={styles.nftName}>{nft.collections?.name}</Text>
                <Text style={styles.nftSerial}>#{nft.serial_number} / 1000</Text>
              </View>
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>寄售金额</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencySymbol}>¥</Text>
                <TextInput 
                  style={styles.priceInput}
                  keyboardType="decimal-pad"
                  placeholder="请输入金额"
                  placeholderTextColor="#CCC"
                  value={priceStr}
                  onChangeText={setPriceStr}
                  autoFocus
                />
              </View>
            </View>
            
            {/* 提示限价信息 */}
            {nft.collections?.max_consign_price ? (
              <Text style={{ marginTop: 12, color: '#FF3B30', fontSize: 13, textAlign: 'center' }}>
                * 当前藏品官方最高限价：¥{nft.collections.max_consign_price.toFixed(2)}
              </Text>
            ) : null}
            
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={[styles.publishBtn, submitting && {opacity: 0.7}]}
            activeOpacity={0.8}
            onPress={handlePublish}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.publishBtnText}>确认寄售</Text>}
          </TouchableOpacity>
        </View>
        
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },

  scrollContent: { flexGrow: 1, padding: 16 },

  infoCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  nftImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#EEE', marginRight: 16 },
  infoRight: { flex: 1, justifyContent: 'center' },
  nftName: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6 },
  nftSerial: { fontSize: 13, color: '#888' },

  priceCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  priceLabel: { fontSize: 15, fontWeight: '800', color: '#111', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { fontSize: 32, fontWeight: '900', color: '#111', marginRight: 10, marginTop: -4 },
  priceInput: { flex: 1, fontSize: 36, fontWeight: '900', color: '#111', padding: 0 },

  bottomBar: { padding: 20, backgroundColor: '#F5F6F8' },
  publishBtn: { backgroundColor: '#0066FF', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', shadowColor: '#0066FF', shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});