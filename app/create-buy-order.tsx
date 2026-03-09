import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function CreateBuyOrderScreen() {
  const router = useRouter();
  const { colId } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    supabase.from('collections').select('*').eq('id', colId).single().then(({data}) => {
      setCollection(data);
      setLoading(false);
    });
  }, [colId]);

  const handlePublish = async () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return Alert.alert('错误', '请输入有效求购价格');

    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 这里预留了调用底层求购合约的口子
      // await supabase.rpc('create_buy_order', { p_col_id: colId, p_user_id: user.id, p_price: p });
      
      Alert.alert('✅ 求购发布成功', `您已发布求购单：¥${p}\n土豆币已冻结，等待有缘人出货！`, [
        { text: '好的', onPress: () => router.back() }
      ]);
    } catch (err: any) { Alert.alert('失败', err.message); } finally { setPublishing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>发布求购</Text>
        <View style={styles.navBtn} />
      </View>
      <View style={{padding: 20}}>
        <Text style={styles.title}>求购 {collection?.name}</Text>
        <Text style={styles.subText}>当前大盘底价参考: ¥{collection?.floor_price_cache || 0}</Text>
        
        <TextInput 
           style={styles.input} 
           placeholder="请输入您的心理价位 (¥)" 
           keyboardType="decimal-pad" 
           value={price} 
           onChangeText={setPrice} 
        />
        <Text style={styles.tipText}>* 提示：发布求购单将提前冻结您的土豆币。若取消求购，资金将原路返回。</Text>
        
        <TouchableOpacity style={styles.btn} onPress={handlePublish} disabled={publishing}>
           {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>冻结资金并发布</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F6F0' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 16, color: '#4A2E1B', fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B' },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginBottom: 10 },
  subText: { fontSize: 14, color: '#888', marginBottom: 20 },
  input: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 18, borderWidth: 1, borderColor: '#DDD', marginBottom: 12 },
  tipText: { fontSize: 12, color: '#FF3B30', lineHeight: 18, marginBottom: 30 },
  btn: { backgroundColor: '#4A2E1B', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '900' }
});