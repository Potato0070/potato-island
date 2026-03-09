import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LotteryScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // 模拟一个近期的抽签活动数据
  const lotteryEvent = {
     name: '【黑金机甲土豆】优先购资格',
     image: 'https://api.dicebear.com/7.x/bottts/png?seed=Mecha',
     total_spots: 500,
     cost: 50, // 抽签门票费
     end_time: '今晚 20:00 准时开奖',
     participants: 13942 // 制造 FOMO 的虚假或真实参与人数
  };

  // 🛡️ 核心：参与抽签的二次弹窗拦截
  const handleJoinLottery = () => {
    Alert.alert(
      '🎫 购买抽签凭证',
      `参与本次抽签将扣除 ¥${lotteryEvent.cost} 土豆币门票费。\n若未中签，门票概不退还，直接打入黑洞！是否确认参与？`,
      [
        { text: '我怂了', style: 'cancel' },
        { 
          text: '确认支付', 
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('未登录');

              // 扣钱逻辑
              const { data: profile } = await supabase.from('profiles').select('potato_coin_balance').eq('id', user.id).single();
              if (!profile || profile.potato_coin_balance < lotteryEvent.cost) {
                 throw new Error('土豆币余额不足，请先充值！');
              }

              const { error } = await supabase.from('profiles').update({
                 potato_coin_balance: profile.potato_coin_balance - lotteryEvent.cost
              }).eq('id', user.id);

              if (error) throw error;

              setHasJoined(true);
              Alert.alert('✅ 参与成功', '您已获得抽签资格号码：#89757，请等待开奖！');
            } catch (err: any) {
              Alert.alert('参与失败', err.message);
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>命运抽签</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.banner}>
            <Text style={styles.bannerTitle}>抽签日历</Text>
            <Text style={styles.bannerSub}>以极低成本获取首发顶级数字资产的唯一通道。</Text>
         </View>

         <View style={styles.card}>
            <View style={styles.cardStatus}><Text style={styles.cardStatusText}>进行中</Text></View>
            <Image source={{uri: lotteryEvent.image}} style={styles.cardImg} />
            <Text style={styles.eventName}>{lotteryEvent.name}</Text>
            
            <View style={styles.infoRow}>
               <Text style={styles.infoLabel}>释放名额</Text>
               <Text style={styles.infoValue}>{lotteryEvent.total_spots} 份</Text>
            </View>
            <View style={styles.infoRow}>
               <Text style={styles.infoLabel}>门票费用</Text>
               <Text style={styles.infoValueCost}>¥{lotteryEvent.cost} / 次</Text>
            </View>
            <View style={styles.infoRow}>
               <Text style={styles.infoLabel}>当前参与人数</Text>
               <Text style={styles.infoValueHot}>{lotteryEvent.participants} 人 🔥</Text>
            </View>
            <View style={[styles.infoRow, {borderBottomWidth: 0, paddingBottom: 0}]}>
               <Text style={styles.infoLabel}>开奖时间</Text>
               <Text style={styles.infoValue}>{lotteryEvent.end_time}</Text>
            </View>

            <TouchableOpacity 
               style={[styles.joinBtn, hasJoined && {backgroundColor: '#4CD964'}]} 
               onPress={handleJoinLottery}
               disabled={hasJoined || processing}
            >
               {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.joinBtnText}>{hasJoined ? '已获得抽签码 #89757' : '立即支付并参与'}</Text>}
            </TouchableOpacity>
         </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },

  banner: { backgroundColor: '#111', padding: 24, borderRadius: 16, marginBottom: 20 },
  bannerTitle: { fontSize: 24, fontWeight: '900', color: '#FFD700', marginBottom: 8 },
  bannerSub: { fontSize: 13, color: '#CCC', lineHeight: 20 },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardStatus: { position: 'absolute', top: 20, right: 20, backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10 },
  cardStatusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  cardImg: { width: '100%', height: 200, backgroundColor: '#F0F0F0', borderRadius: 12, marginBottom: 16 },
  eventName: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 20 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  infoValueCost: { fontSize: 14, fontWeight: '900', color: '#D49A36' },
  infoValueHot: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },

  joinBtn: { backgroundColor: '#0066FF', paddingVertical: 16, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});