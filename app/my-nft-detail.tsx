import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function MyNftDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [nft, setNft] = useState<any>(null);

  useEffect(() => {
    supabase.from('nfts').select('*, collections(name, image_url)').eq('id', id).single().then(({data}) => setNft(data));
  }, [id]);

  const handleBurn = () => {
    Alert.alert('🔥 终极熔炉', '献祭此藏品将永久销毁它，并获得大盘硬通货【Potato卡】。是否继续？', [
      { text: '取消', style: 'cancel' },
      { text: '确认献祭', style: 'destructive', onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.rpc('burn_in_furnace', { p_nft_id: id, p_user_id: user?.id });
          if (error) Alert.alert('熔炼失败', error.message);
          else { Alert.alert('献祭成功', '藏品已化为灰烬，您获得了全新的 Potato 卡！'); router.back(); }
      }}
    ]);
  };

  if (!nft) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>基因详情</Text>
        <View style={styles.navBtn} />
      </View>
      <View style={{padding: 20, alignItems: 'center'}}>
        <Image source={{uri: nft.collections?.image_url}} style={styles.img} />
        <Text style={styles.name}>{nft.collections?.name}</Text>
        <Text style={styles.serial}>唯一序列号: #{String(nft.serial_number).padStart(6, '0')}</Text>
        <View style={styles.btnRow}>
           <TouchableOpacity style={styles.burnBtn} onPress={handleBurn}><Text style={styles.burnText}>🔥 投入熔炉</Text></TouchableOpacity>
           <TouchableOpacity style={styles.sellBtn} onPress={() => router.push({pathname: '/consign', params: {id: nft.id}})}><Text style={styles.sellText}>立即寄售</Text></TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#111' },
  img: { width: 300, height: 300, borderRadius: 16, marginTop: 20, borderWidth: 4, borderColor: '#FFF' },
  name: { fontSize: 24, fontWeight: '900', marginTop: 20, color: '#4A2E1B' },
  serial: { fontSize: 16, color: '#888', marginTop: 8, fontFamily: 'monospace' },
  btnRow: { flexDirection: 'row', marginTop: 40, width: '100%', justifyContent: 'space-between' },
  burnBtn: { flex: 0.45, backgroundColor: '#FFEBEB', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30' },
  burnText: { color: '#FF3B30', fontSize: 16, fontWeight: '800' },
  sellBtn: { flex: 0.5, backgroundColor: '#D49A36', padding: 15, borderRadius: 12, alignItems: 'center' },
  sellText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});