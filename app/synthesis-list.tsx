import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function SynthesisListScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchEvents();
  }, []));

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('synthesis_events')
        .select('*, target_collection:target_collection_id(name, image_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const renderEvent = ({ item }: { item: any }) => {
    const isUnlimited = item.max_count === 0;
    const remaining = isUnlimited ? '无限' : item.max_count - item.current_count;
    const progress = isUnlimited ? 0 : (item.current_count / item.max_count) * 100;
    
    const now = new Date().getTime();
    const endTime = new Date(item.end_time).getTime();
    const isEnded = now > endTime || (!isUnlimited && (item.max_count - item.current_count) <= 0);

    return (
      <TouchableOpacity 
        style={[styles.card, isEnded && styles.cardEnded]} 
        activeOpacity={0.9} 
        onPress={() => router.push({ pathname: '/synthesis-detail', params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
           <Text style={styles.cardTitle}>{item.name}</Text>
           <View style={[styles.statusTag, isEnded ? {backgroundColor: '#CCC'} : {backgroundColor: '#FF3B30'}]}>
              <Text style={styles.statusText}>{isEnded ? '已结束' : '进行中'}</Text>
           </View>
        </View>

        <View style={styles.cardBody}>
           <Image source={{ uri: item.target_collection?.image_url }} style={styles.targetImg} />
           <View style={styles.cardInfo}>
              <Text style={styles.targetName}>目标产物：{item.target_collection?.name}</Text>
              <Text style={styles.timeText}>截止时间：{new Date(item.end_time).toLocaleString()}</Text>
              
              <View style={styles.progressBox}>
                 <View style={styles.progressLabels}>
                    <Text style={styles.progressLabelText}>已合成: {item.current_count}</Text>
                    <Text style={styles.progressLabelTextHighlight}>剩余: {remaining}</Text>
                 </View>
                 {!isUnlimited && (
                   <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, {width: `${progress}%`}, isEnded && {backgroundColor: '#999'}]} />
                   </View>
                 )}
              </View>
           </View>
        </View>

        {isEnded && <View style={styles.endedOverlay}><Text style={styles.endedOverlayText}>COMPLETED</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>基因合成大厅</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0066FF" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{textAlign: 'center', color: '#999', marginTop: 50}}>暂无合成变异活动</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, overflow: 'hidden' },
  cardEnded: { opacity: 0.8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderColor: '#F0F0F0', paddingBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#111' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  cardBody: { flexDirection: 'row' },
  targetImg: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F5F5F5', marginRight: 16, borderWidth: 1, borderColor: '#EEE' },
  cardInfo: { flex: 1, justifyContent: 'center' },
  targetName: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 6 },
  timeText: { fontSize: 11, color: '#888', marginBottom: 12 },
  
  progressBox: { width: '100%' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabelText: { fontSize: 11, color: '#666' },
  progressLabelTextHighlight: { fontSize: 11, color: '#FF3B30', fontWeight: '800' },
  progressBarBg: { width: '100%', height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FF3B30', borderRadius: 3 },

  endedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  endedOverlayText: { transform: [{rotate: '-15deg'}], fontSize: 30, fontWeight: '900', color: '#CCC', letterSpacing: 4, opacity: 0.7, borderWidth: 4, borderColor: '#CCC', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }
});