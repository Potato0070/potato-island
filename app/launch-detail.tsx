import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function LaunchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isStarted, setIsStarted] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('launch_events')
        .select(`*, collection:collection_id(name, image_url, description)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setEventData(data);
    } catch (err: any) {
      Alert.alert('获取失败', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // 高频倒计时引擎
  useEffect(() => {
    if (!eventData) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(eventData.start_time).getTime();
      const diff = start - now;

      if (diff <= 0) {
        setIsStarted(true);
        setIsUrgent(false);
        if (eventData.remaining_supply <= 0) {
            setTimeLeftStr('已售罄');
        } else {
            setTimeLeftStr('抢购进行中');
        }
      } else {
        setIsStarted(false);
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);

        if (d === 0 && h === 0 && m < 10) {
            setIsUrgent(true);
            setTimeLeftStr(`🚨 距离开抢 00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
            setIsUrgent(false);
            setTimeLeftStr(`预热中: ${d}天 ${h}时 ${m}分`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [eventData]);

  // 触发抢购合约
  const handleBuy = async (buyCount: number = 1) => {
    if (!isStarted) return Alert.alert('提示', '发售尚未开始！');
    if (eventData.remaining_supply < buyCount) return Alert.alert('提示', '手慢了，库存不足！');
    
    setBuying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录');

      const { error } = await supabase.rpc('execute_launch_buy', {
        p_user_id: user.id,
        p_launch_id: id,
        p_buy_count: buyCount
      });

      if (error) throw error;
      
      Alert.alert('🎉 抢购成功', `恭喜！已将 ${buyCount} 份【${eventData.collection.name}】收入囊中！`, [
        { text: '查看金库', onPress: () => router.push('/(tabs)/profile') },
        { text: '继续抢', onPress: () => fetchDetail() } // 刷新库存
      ]);
    } catch (err: any) {
      Alert.alert('抢购失败', err.message);
    } finally {
      setBuying(false);
    }
  };

  if (loading || !eventData) return <View style={styles.center}><ActivityIndicator color="#D49A36" /></View>;

  const progressPercent = ((eventData.total_supply - eventData.remaining_supply) / eventData.total_supply) * 100;
  const isSoldOut = eventData.remaining_supply <= 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 沉浸式导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 返回</Text></TouchableOpacity>
        <Text style={styles.navTitle}>创世首发</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* 顶部超清大图展台 */}
        <View style={styles.imageStage}>
          <Image source={{ uri: eventData.collection.image_url }} style={styles.mainImage} />
          {isSoldOut && (
            <View style={styles.soldOutStamp}>
               <Text style={styles.soldOutText}>已售罄</Text>
            </View>
          )}
        </View>

        {/* 核心信息面板 */}
        <View style={styles.infoBox}>
          <Text style={styles.title}>{eventData.collection.name}</Text>
          <Text style={styles.desc}>{eventData.collection.description || '来自土豆宇宙的全新基因序列。'}</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>首发价格</Text>
            <Text style={styles.price}>¥ {eventData.price.toFixed(2)}</Text>
          </View>

          {/* 库存进度条 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>发行总量: {eventData.total_supply}</Text>
              <Text style={styles.progressTextHighlight}>剩余: {eventData.remaining_supply}</Text>
            </View>
            <View style={styles.progressBarBg}>
               <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部抢购操作台 */}
      <View style={styles.bottomBar}>
        {/* 倒计时提示 */}
        <View style={styles.timerRow}>
           <Text style={[styles.timerText, isUrgent && {color: '#FF3B30'}]}>{timeLeftStr}</Text>
        </View>

        <View style={styles.btnGroup}>
           {/* 批量优先购 (预留给白名单大户) */}
           <TouchableOpacity 
              style={[styles.batchBtn, (!isStarted || isSoldOut) && {opacity: 0.5}]} 
              activeOpacity={0.8}
              disabled={!isStarted || isSoldOut || buying}
              onPress={() => Alert.alert('特权验证', '检测到您尚未激活【优先购白名单】，无法进行批量包场抢购！')}
           >
              <Text style={styles.batchBtnText}>📦 特权批量购</Text>
           </TouchableOpacity>

           {/* 普通单次抢购 */}
           <TouchableOpacity 
              style={[styles.buyBtn, (!isStarted || isSoldOut) && {backgroundColor: '#CCC'}]} 
              activeOpacity={0.8}
              disabled={!isStarted || isSoldOut || buying}
              onPress={() => handleBuy(1)}
           >
              {buying ? <ActivityIndicator color="#FFF" /> : (
                 <Text style={styles.buyBtnText}>{isSoldOut ? '已被抢空' : (isStarted ? '⚡ 立即抢购' : '等待发售')}</Text>
              )}
           </TouchableOpacity>
        </View>
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
  
  imageStage: { width: width, height: width, backgroundColor: '#FDF9F1', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  mainImage: { width: '85%', height: '85%', borderRadius: 16, resizeMode: 'cover', borderWidth: 4, borderColor: '#FFF' },
  soldOutStamp: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.7)', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', transform: [{rotate: '-15deg'}] },
  soldOutText: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 2 },

  infoBox: { padding: 20, backgroundColor: '#FFF', marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2E1B', marginBottom: 8 },
  desc: { fontSize: 14, color: '#888', lineHeight: 22, marginBottom: 20 },
  
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  priceLabel: { fontSize: 14, color: '#999', marginRight: 10, fontWeight: '600' },
  price: { fontSize: 32, fontWeight: '900', color: '#D49A36' },

  progressContainer: { backgroundColor: '#FDF9F1', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F5E8D4' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 12, color: '#666', fontWeight: '600' },
  progressTextHighlight: { fontSize: 12, color: '#D49A36', fontWeight: '800' },
  progressBarBg: { height: 8, backgroundColor: '#EFEFEF', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#D49A36', borderRadius: 4 },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, shadowColor: '#000', shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  timerRow: { alignItems: 'center', marginBottom: 12 },
  timerText: { fontSize: 14, fontWeight: '800', color: '#4A2E1B', fontFamily: 'monospace' },
  
  btnGroup: { flexDirection: 'row', justifyContent: 'space-between' },
  batchBtn: { flex: 0.35, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#4A2E1B', borderRadius: 12, justifyContent: 'center', alignItems: 'center', height: 50, marginRight: 10 },
  batchBtnText: { color: '#4A2E1B', fontSize: 14, fontWeight: '800' },
  buyBtn: { flex: 0.65, backgroundColor: '#D49A36', borderRadius: 12, justifyContent: 'center', alignItems: 'center', height: 50, shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width:0, height:4} },
  buyBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
});