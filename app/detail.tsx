import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function DetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [collection, setCollection] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    supabase.from('collections').select('*').eq('id', id).single().then(({data}) => setCollection(data));
  }, [id]));

  if (!collection) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>藏品大盘</Text>
        <View style={styles.navBtn} />
      </View>
      <ScrollView>
        <Image source={{uri: collection.image_url}} style={styles.mainImg} />
        <View style={styles.infoBox}>
          <Text style={styles.title}>{collection.name}</Text>
          <Text style={styles.statText}>全网发行: {collection.total_minted} | 流通: {collection.circulating_supply}</Text>
          <Text style={styles.statText}>地板价: ¥{collection.floor_price_cache || 0} | 最高限价: ¥{collection.max_consign_price}</Text>
        </View>
        <View style={styles.btnRow}>
           <TouchableOpacity style={styles.btnSell} onPress={() => router.push({pathname: '/publish-consign', params: {colId: collection.id}})}><Text style={styles.btnTextWhite}>发布寄售</Text></TouchableOpacity>
           <TouchableOpacity style={styles.btnBuy} onPress={() => router.push({pathname: '/create-buy-order', params: {colId: collection.id}})}><Text style={styles.btnTextWhite}>发布求购</Text></TouchableOpacity>
        </View>
      </ScrollView>
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
  mainImg: { width: '100%', height: 350, resizeMode: 'cover' },
  infoBox: { padding: 20, backgroundColor: '#FFF' },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginBottom: 10 },
  statText: { fontSize: 14, color: '#666', marginBottom: 6 },
  btnRow: { flexDirection: 'row', padding: 20, justifyContent: 'space-between' },
  btnSell: { flex: 0.48, backgroundColor: '#4A2E1B', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnBuy: { flex: 0.48, backgroundColor: '#D49A36', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnTextWhite: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});