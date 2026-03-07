import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function SynthesisListScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // 获取所有未过期且未熔断的变异活动，并带上目标藏品的图
      const { data, error } = await supabase
        .from('synthesis_events')
        .select(`
          *,
          target_collection:target_collection_id(name, image_url)
        `)
        .gte('end_time', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 过滤掉已经达到熔断上限的配方
      const activeEvents = (data || []).filter(e => e.max_count === 0 || e.current_count < e.max_count);
      setEvents(activeEvents);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchEvents(); }, []));

  const renderItem = ({ item }: { item: any }) => {
    const isLimited = item.max_count > 0;
    const remain = isLimited ? item.max_count - item.current_count : '无限';
    
    return (
      <TouchableOpacity 
         style={styles.card} 
         activeOpacity={0.8}
         onPress={() => router.push({ pathname: '/synthesis-detail', params: { id: item.id } })}
      >
        <ImageBackground source={{ uri: item.target_collection?.image_url }} style={styles.cardBg} blurRadius={20}>
           <View style={styles.overlay}>
              
              {/* 左侧目标产物图 */}
              <View style={styles.targetImgBox}>
                 <Image source={{ uri: item.target_collection?.image_url }} style={styles.targetImg} />
                 <View style={styles.tagBox}>
                    <Text style={styles.tagText}>目标产物</Text>
                 </View>
              </View>

              {/* 右侧配方信息 */}
              <View style={styles.infoBox}>
                 <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                 <Text style={styles.targetName}>产出: {item.target_collection?.name}</Text>
                 
                 <View style={styles.statusRow}>
                    <Text style={styles.statusText}>
                       全岛剩余名额: <Text style={{color: '#00E5FF', fontWeight: '900'}}>{remain}</Text>
                    </Text>
                 </View>

                 <View style={styles.btnRow}>
                    <TouchableOpacity 
                       style={styles.actionBtn}
                       onPress={() => router.push({ pathname: '/synthesis-detail', params: { id: item.id } })}
                    >
                       <Text style={styles.actionBtnText}>查看配方与材料 〉</Text>
                    </TouchableOpacity>
                 </View>
              </View>

           </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
           <Text style={styles.iconText}>〈</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>基因进化大厅</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Text style={{fontSize: 40, marginBottom: 10}}>🧬</Text>
               <Text style={styles.emptyText}>当前暂无开放的变异配方</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0C' }, // 朋克暗黑风背景
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#0B0B0C' },
  navBtn: { width: 40, height: 40, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#00E5FF', fontWeight: 'bold' },
  navTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 2 },

  card: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#1F1F22' },
  cardBg: { width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', flexDirection: 'row', padding: 16 },
  
  targetImgBox: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#00E5FF', position: 'relative', marginTop: 10 },
  targetImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  tagBox: { position: 'absolute', top: 0, left: 0, backgroundColor: '#00E5FF', paddingHorizontal: 6, paddingVertical: 2, borderBottomRightRadius: 8 },
  tagText: { color: '#000', fontSize: 10, fontWeight: '900' },

  infoBox: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 6 },
  targetName: { fontSize: 13, color: '#CCC', marginBottom: 12 },
  statusRow: { marginBottom: 16 },
  statusText: { fontSize: 12, color: '#888', fontWeight: '600' },
  
  btnRow: { alignItems: 'flex-end' },
  actionBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#00E5FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  actionBtnText: { color: '#00E5FF', fontSize: 12, fontWeight: '800' },

  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 14, fontWeight: '600' }
});