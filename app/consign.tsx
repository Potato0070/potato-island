import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import FolioButton from '../components/FolioButton';
import TradeConfirmDialog from '../components/TradeConfirmDialog';

export default function ConsignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [listedNfts, setListedNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [buying, setBuying] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const readVersion = useRef(0);

  const fetchListed = useCallback(async () => {
    const version = ++readVersion.current;
    setLoading(true);
    setReadError('');
    try {
      if (!id) throw new Error('缺少藏品信息，请返回集市重新选择。');
      const { data, error } = await supabase.from('nfts').select('*, collections(name, image_url)')
      .eq('collection_id', id).eq('status', 'listed').order('consign_price', { ascending: true });
      if (error) throw error;
      if (version === readVersion.current) setListedNfts(data || []);
    } catch {
      if (version === readVersion.current) setReadError(id ? '现货暂时加载失败，请重试。' : '缺少藏品信息，请返回集市重新选择。');
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchListed();
    return () => { readVersion.current += 1; };
  }, [fetchListed]);

  const executeBuy = async () => {
    if (lock.current || !selected) return;
    lock.current = true;
    setBuying(true);
    setTradeError('');
    const listing = selected;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('请先登录，再购买藏品。');
      if (listing.owner_id === user.id) throw new Error('不能购买自己寄售的藏品。');
      const { error } = await supabase.rpc('execute_trade', { p_nft_id: listing.id, p_buyer_id: user.id });
      if (error) throw error;
      setSelected(null);
      setListedNfts(current => current.filter(item => item.id !== listing.id));
      setNotice('购买成功，藏品已收入金库。');
      void fetchListed();
    } catch (error: unknown) {
      setTradeError(error instanceof Error ? error.message : '交易未能完成，请前往订单核对结果后再试。');
    } finally {
      lock.current = false;
      setBuying(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View>
         <Text style={styles.serial}>#{String(item.serial_number).padStart(6, '0')}</Text>
         <Text style={styles.seller}>卖家: 土豆岛藏友</Text>
      </View>
      <View style={{alignItems: 'flex-end'}}>
         <Text style={styles.price}>{item.consign_price} 土豆币</Text>
         <FolioButton label="购买" disabled={buying} onPress={() => { setTradeError(''); setNotice(''); setSelected(item); }} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回集市" onPress={() => router.canGoBack() ? router.back() : router.replace('/market')} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>现货大盘</Text>
        <View style={styles.navBtn} />
      </View>
      {!!notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
      {loading ? <ActivityIndicator style={{marginTop: 50}} color="#D49A36" /> : readError ? (
        <View style={styles.state}><Text style={styles.notice}>{readError}</Text>{!!id && <FolioButton label="重新加载" onPress={fetchListed} />}</View>
      ) : (
        <FlatList data={listedNfts} renderItem={renderItem} keyExtractor={item => item.id} contentContainerStyle={{padding: 16}}
          ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>盘口已被扫空，暂无现货</Text>}
        />
      )}
      <TradeConfirmDialog visible={!!selected} title="确认购买" description={selected ? `${selected.collections?.name || '藏品'} #${String(selected.serial_number).padStart(6, '0')}\n支付 ${selected.consign_price} 土豆币，购买后收入金库。` : ''}
        error={tradeError} busy={buying} onCancel={() => { if (!lock.current) setSelected(null); }} onConfirm={executeBuy} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, minHeight: 44, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  serial: { fontSize: 16, fontWeight: '900', color: '#333', fontFamily: 'monospace' },
  seller: { fontSize: 12, color: '#999', marginTop: 4 },
  price: { fontSize: 18, fontWeight: '900', color: '#FF3B30', marginBottom: 8 },
  notice: { textAlign: 'center', padding: 20, fontSize: 15, lineHeight: 24, color: '#706255' },
  state: { padding: 24, alignItems: 'center', gap: 16 },
});
