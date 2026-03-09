import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function SynthesisListScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('synthesis_events')
        .select(`id, name, end_time, current_count, max_count, is_active, target_collection:target_collection_id(name, image_url)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isEnded = new Date(item.end_time) < new Date() || !item.is_active || (item.max_count > 0 && item.current_count >= item.max_count);
    const coverImage = item.target_collection?.image_url || 'https://via.placeholder.com/150';

    return (
      <TouchableOpacity 
        style={[styles.card, isEnded && {opacity: 0.6}]} 
        activeOpacity={0.8}
        onPress={() => !isEnded && router.push({ pathname: '/synthesis-detail', params: { id: item.id } })}
      >
        <Image source={{ uri: coverImage }} style={styles.cardImage} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>剩余名额: {item.max_count > 0 ? item.max_count - item.current_count : '无限'} | {new Date(item.end_time).toLocaleDateString()} 结束</Text>
          <View style={styles.tagRow}>
             <Image source={{uri: 'https://via.placeholder.com/20'}} style={styles.miniAvatar} />
             <Text style={styles.communityText}>土豆岛基因工坊</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, isEnded ? styles.badgeEnded : styles.badgeActive]}>
          <Text style={styles.badgeText}>{isEnded ? '已结束' : '合成中'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>基因合成舱</Text>
        <Text style={{width: 40}}></Text>
      </View>
      
      {loading ? <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} /> : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#333' },
  navTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#EEE', marginRight: 12 },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6 },
  cardSub: { fontSize: 12, color: '#666', marginBottom: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 16, height: 16, borderRadius: 8, marginRight: 6 },
  communityText: { fontSize: 12, color: '#888' },
  statusBadge: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeActive: { backgroundColor: '#0066FF' },
  badgeEnded: { backgroundColor: '#CCC' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' }
});