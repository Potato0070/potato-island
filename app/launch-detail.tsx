import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function LaunchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [launch, setLaunch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  
  // 倒计时状态
  const [timeLeftStr, setTimeLeftStr] = useState('计算中...');
  const [isStarted, setIsStarted] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);

  useEffect(() => {
    fetchLaunchData();
  }, [id]);

  const fetchLaunchData = async () => {
    try {
      const { data, error } = await supabase.from('launch_events')
        .select('*, collection:collection_id(*)').eq('id', id).single();
      if (error) throw error;
      setLaunch(data);
      if (data.remaining_supply <= 0) setIsSoldOut(true);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!launch) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(launch.start_time).getTime();
      const diff = start - now;

      if (launch.remaining_supply <= 0) {
         setTimeLeftStr('已全部售罄');
         setIsStarted(true);
         setIsSoldOut(true);
      } else if (diff <= 0) {
         setTimeLeftStr('抢购进行中！');
         setIsStarted(true);
      } else {
         setIsStarted(false);
         const d = Math.floor(diff / (1000 * 60 * 60 * 24));
         const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
         const m = Math.floor((diff / 1000 / 60) % 60);
         const s = Math.floor((diff / 1000) % 60);
         setTimeLeftStr(`距离开售还剩: ${d}天 ${h}时 ${m}分 ${s}秒`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [launch]);

  const handleMint = async () => {
    Alert.alert(
      '🚀 确认抢购',
      `将扣除 ¥${launch.price} 土豆币购买【${launch.collection?.name}】首发盲盒，是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确认支付', 
          style: 'destructive',
          onPress: async () => {
            setBuying(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('未登录');

              // 1. 查余额
              const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
              if (!profile || profile.potato_coin_balance < launch.price) throw new Error('土豆币余额不足！');

              // 2. 查库存并扣减 (这里用前端模拟事务，真实高并发需转写 RPC)
              const { data: currentLaunch } = await supabase.from('launch_events').select('remaining_supply').eq('id', id).single();
              if (!currentLaunch || currentLaunch.remaining_supply <= 0) throw new Error('手慢了，已被抢空！');

              // 3. 扣钱
              await supabase.from('profiles').update({ potato_coin_balance: profile.potato_coin_balance - launch.price }).eq('id', user.id);
              
              // 4. 减库存
              await supabase.from('launch_events').update({ remaining_supply: currentLaunch.remaining_supply - 1 }).eq('id', id);

              // 5. 印钞发货 (状态 idle)
              const newSerial = launch.total_supply - currentLaunch.remaining_supply + 1;
              const { error: mintErr } = await supabase.from('nfts').insert([{
                 collection_id: launch.collection_id,
                 owner_id: user.id,
                 serial_number: newSerial.toString(),
                 status: 'idle'
              }]);
              if (mintErr) throw mintErr;

              // 6. 更新大盘数据
              await supabase.from('collections').update({
                 total_minted: newSerial,
                 circulating_supply: newSerial
              }).eq('id', launch.collection_id);

              Alert.alert('🎉 抢购成功', '首发藏品已打入您的金库！', [{text: '去查看', onPress: () => router.push('/(tabs)/profile')}]);
              fetchLaunchData();
            } catch (err: any) { Alert.alert('抢购失败', err.message); } finally { setBuying(false); }
          }
        }
      ]
    );
  };

  if (loading || !launch) return <View style={styles.center}><ActivityIndicator color="#FFD700" /></View>;

  const progress = ((launch.total_supply - launch.remaining_supply) / launch.total_supply) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ImageBackground source={{ uri: launch.collection?.image_url }} style={styles.headerBg} blurRadius={20}>
         <View style={styles.headerOverlay}>
            <View style={styles.navBar}>
               <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={[styles.iconText, {color: '#FFF'}]}>〈</Text></TouchableOpacity>
               <Text style={styles.navTitle}>发售详情</Text>
               <View style={styles.navBtn} />
            </View>
            <View style={styles.heroBox}>
               <Image source={{ uri: launch.collection?.image_url }} style={styles.heroImg} />
               <View style={styles.timerBadge}>
                  <Text style={styles.timerText}>{timeLeftStr}</Text>
               </View>
            </View>
         </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.scrollContent}>
         <View style={styles.infoCard}>
            <Text style={styles.title}>{launch.collection?.name}</Text>
            <View style={styles.priceRow}>
               <Text style={styles.priceLabel}>首发价</Text>
               <Text style={styles.priceValue}>¥ {launch.price.toFixed(2)}</Text>
            </View>
            
            {/* 进度条 */}
            <View style={styles.progressSection}>
               <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>已抢 {launch.total_supply - launch.remaining_supply} 份</Text>
                  <Text style={styles.progressText}>限量 {launch.total_supply} 份</Text>
               </View>
               <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, {width: `${progress}%`}]} />
               </View>
            </View>
         </View>

         <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>发售规则</Text>
            <Text style={styles.ruleText}>1. 藏品采用先到先得模式，抢完即止。</Text>
            <Text style={styles.ruleText}>2. 抢购成功后资产将自动发放至您的金库。</Text>
            <Text style={styles.ruleText}>3. 为防止黄牛刷单，同一账户可能面临限购策略。</Text>
            <Text style={styles.ruleText}>4. 抢购行为不可逆，请确保您的土豆币余额充足。</Text>
         </View>
      </ScrollView>

      {/* 底部抢购栏 */}
      <View style={styles.bottomBar}>
         <TouchableOpacity 
            style={[styles.buyBtn, (!isStarted || isSoldOut) && {backgroundColor: '#555'}]} 
            onPress={handleMint}
            disabled={!isStarted || isSoldOut || buying}
         >
            {buying ? <ActivityIndicator color="#111" /> : (
               <Text style={[styles.buyBtnText, (!isStarted || isSoldOut) && {color: '#999'}]}>
                  {isSoldOut ? '已被抢空' : (isStarted ? '立即抢购' : '等待开售')}
               </Text>
            )}
         </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  
  headerBg: { width: '100%', height: 350 },
  headerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, marginTop: 10 },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20 },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },

  heroBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroImg: { width: 180, height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#FFD700', marginBottom: 20 },
  timerBadge: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  timerText: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },

  scrollContent: { padding: 16, paddingBottom: 100, marginTop: -20 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  title: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20, borderBottomWidth: 1, borderColor: '#F0F0F0', paddingBottom: 16 },
  priceLabel: { fontSize: 13, color: '#666', marginRight: 8 },
  priceValue: { fontSize: 28, fontWeight: '900', color: '#FF3B30' },

  progressSection: { width: '100%' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 12, color: '#888', fontWeight: '600' },
  progressBarBg: { height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 4 },

  ruleCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  ruleTitle: { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 12 },
  ruleText: { fontSize: 13, color: '#666', lineHeight: 22, marginBottom: 6 },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderTopWidth: 1, borderColor: '#F0F0F0' },
  buyBtn: { backgroundColor: '#FFD700', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  buyBtnText: { color: '#111', fontSize: 18, fontWeight: '900', letterSpacing: 2 }
});