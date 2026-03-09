import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function PublishConsignScreen() {
  const router = useRouter();
  const { colId } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: col } = await supabase.from('collections').select('*').eq('id', colId).single();
      setCollection(col);
      const { data: nfts } = await supabase.from('nfts').select('*').eq('collection_id', colId).eq('owner_id', user.id).eq('status', 'idle');
      setMyNfts(nfts || []);
      setLoading(false);
    };
    fetchData();
  }, [colId]);

  const handlePublish = async () => {
    if (myNfts.length === 0) return Alert.alert('提示', '您没有可寄售的该系列藏品！');
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return Alert.alert('错误', '请输入有效价格');
    if (p > collection.max_consign_price) return Alert.alert('越界警告', `王权限制最高不可超过 ¥${collection.max_consign_price}`);

    setPublishing(true);
    const targetNft = myNfts[0];
    try {
      const { error } = await supabase.from('nfts').update({ status: 'listed', consign_price: p }).eq('id', targetNft.id);
      if (error) throw error;
      Alert.alert('✅ 上架成功', '您的藏品已挂入大盘！', [{ text: '好的', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('失败', err.message); } finally { setPublishing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布寄售</Text>
        <View style={styles.navBtn} />
      </View>
      <View style={{padding: 20}}>
        <Text style={styles.title}>发售 {collection?.name}</Text>
        <Text style={styles.subText}>当前可用数量: {myNfts.length}</Text>
        <Text style={styles.subText}>全岛最高限价: ¥{collection?.max_consign_price}</Text>
        <TextInput style={styles.input} placeholder="请输入寄售价格" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <TouchableOpacity style={styles.btn} onPress={handlePublish} disabled={publishing}>
           <Text style={styles.btnText}>{publishing ? '发布中...' : '确认上架'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginBottom: 10 },
  subText: { fontSize: 14, color: '#888', marginBottom: 6 },
  input: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginTop: 20, fontSize: 18, borderWidth: 1, borderColor: '#DDD' },
  btn: { backgroundColor: '#D49A36', padding: 16, borderRadius: 12, marginTop: 20, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});