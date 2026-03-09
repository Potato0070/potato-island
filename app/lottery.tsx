import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');

export default function LotteryScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('potato_cards, universal_cards, nickname').eq('id', user.id).single();
      setProfile(data);
    }
    setLoading(false);
  };

  // 🛡️ 强制二次弹窗确认
  const handleDraw = () => {
    if (!profile) return Alert.alert('提示', '数据加载中...');
    if ((profile.potato_cards || 0) < 5) return Alert.alert('余额不足', '命运抽签需要消耗 5 张 Potato卡！');

    Alert.alert(
      '🎰 开启命运盲盒',
      '将立即扣除 5 张 Potato卡，盲盒开启后结果不可逆。是否确认投入？',
      [
        { text: '再想想', style: 'cancel' },
        { text: '确认抽签', style: 'destructive', onPress: executeDraw }
      ]
    );
  };

  const executeDraw = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. 扣除门票
      let currentPotato = profile.potato_cards - 5;
      let currentUniversal = profile.universal_cards || 0;
      
      // 2. 🌟 核心：100份真实概率引擎
      const roll = Math.floor(Math.random() * 100); // 0-99
      let prizeMsg = '';
      let isElder = false;
      let mintNftName = ''; // 如果抽中数字藏品，记录名字用于印钞

      if (roll < 40) { // 40%
         currentPotato += 1;
         prizeMsg = 'Potato卡 * 1';
      } else if (roll < 70) { // 30%
         currentPotato += 2;
         prizeMsg = 'Potato卡 * 2';
      } else if (roll < 80) { // 10%
         currentPotato += 3;
         prizeMsg = 'Potato卡 * 3';
      } else if (roll < 90) { // 10%
         mintNftName = '原生土豆种子';
         prizeMsg = '原生土豆种子 * 1';
      } else if (roll < 94) { // 4%
         mintNftName = '白皮土豆劳动者';
         prizeMsg = '白皮土豆劳动者 * 1';
      } else if (roll < 98) { // 4%
         mintNftName = '红皮土豆艺术家';
         prizeMsg = '红皮土豆艺术家 * 1';
      } else if (roll < 99) { // 1%
         currentUniversal += 1;
         prizeMsg = '🌟 万能土豆卡 * 1';
      } else { // 1% (99)
         mintNftName = '褐皮土豆长老';
         prizeMsg = '👑 史诗级：褐皮土豆长老 * 1';
         isElder = true;
      }

      // 3. 更新基础资产
      await supabase.from('profiles').update({ 
         potato_cards: currentPotato,
         universal_cards: currentUniversal
      }).eq('id', user?.id);

      // 4. 如果抽中藏品，执行铸造 (前提是数据库里要有这些名字的 collection)
      if (mintNftName) {
         // 查找对应系列的 ID
         const { data: colData } = await supabase.from('collections').select('id, total_minted').eq('name', mintNftName).single();
         if (colData) {
            const newSerial = colData.total_minted + 1;
            await supabase.from('nfts').insert([{ collection_id: colData.id, owner_id: user?.id, serial_number: newSerial.toString(), status: 'idle' }]);
            await supabase.from('collections').update({ total_minted: newSerial, circulating_supply: newSerial }).eq('id', colData.id);
            
            // 🌟 史诗级狂欢：抽中长老，全服播报并空投 10 个种子
            if (isElder) {
               // 全服公告
               await supabase.from('announcements').insert([{ 
                  title: '👑 命运的抉择！史诗降临！', 
                  content: `恭喜岛民【${profile.nickname || '神秘玩家'}】在命运抽签中获得了极其稀有的【褐皮土豆长老】！\n王国已为其空投 10 份原生土豆种子作为嘉奖！`, 
                  author_name: '王国大喇叭', 
                  is_featured: true 
               }]);
               
               // 找到种子系列并连发 10 张
               const { data: seedCol } = await supabase.from('collections').select('id, total_minted').eq('name', '原生土豆种子').single();
               if (seedCol) {
                  let seedSerial = seedCol.total_minted;
                  const seedInserts = Array.from({length: 10}).map(() => {
                     seedSerial += 1;
                     return { collection_id: seedCol.id, owner_id: user?.id, serial_number: seedSerial.toString(), status: 'idle' };
                  });
                  await supabase.from('nfts').insert(seedInserts);
                  await supabase.from('collections').update({ total_minted: seedSerial, circulating_supply: seedSerial }).eq('id', seedCol.id);
                  prizeMsg += '\n\n🎁 触发神迹：已额外空投 [原生土豆种子 * 10]！';
               }
            }
         }
      }

      // 5. 成功弹窗
      Alert.alert('🎉 盲盒开启成功', `恭喜您获得了：\n\n${prizeMsg}`, [{ text: '收下奖励', onPress: fetchProfile }]);
    } catch (err: any) { Alert.alert('抽签失败', err.message); } finally { setProcessing(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#0066FF" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈 </Text></TouchableOpacity>
        <Text style={styles.navTitle}>命运抽签</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
         <View style={styles.banner}>
            <Text style={styles.bannerTitle}>命运盲盒</Text>
            <Text style={styles.bannerSub}>每次开启消耗 5 张 Potato卡，极小概率获得史诗级藏品与万能卡。</Text>
            <View style={styles.balanceBox}>
               <Text style={{color: '#FFF', fontSize: 12}}>当前拥有: Potato卡 x{profile?.potato_cards || 0}</Text>
            </View>
         </View>

         <View style={styles.card}>
            <View style={styles.cardStatus}><Text style={styles.cardStatusText}>常驻奖池</Text></View>
            <View style={styles.imgPlaceholder}><Text style={{fontSize: 60}}>🔮</Text></View>
            <Text style={styles.eventName}>土豆王国创世盲盒</Text>
            
            <View style={styles.infoRow}><Text style={styles.infoLabel}>开启消耗</Text><Text style={styles.infoValueCost}>5 张 Potato卡 / 次</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>神级大奖</Text><Text style={styles.infoValueHot}>褐皮土豆长老 (1%)</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>稀有奖励</Text><Text style={styles.infoValue}>万能土豆卡 (1%)</Text></View>
            <View style={[styles.infoRow, {borderBottomWidth: 0, paddingBottom: 0}]}><Text style={styles.infoLabel}>基础奖励</Text><Text style={styles.infoValue}>随机数量Potato卡/劳动者等</Text></View>

            <TouchableOpacity 
               style={[styles.joinBtn, (profile?.potato_cards || 0) < 5 && {backgroundColor: '#CCC'}]} 
               onPress={handleDraw} disabled={processing || (profile?.potato_cards || 0) < 5}
            >
               {processing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.joinBtnText}>{(profile?.potato_cards || 0) < 5 ? 'Potato卡不足' : '立即投入并开启'}</Text>}
            </TouchableOpacity>
         </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FFF' },
  navBtn: { width: 40, justifyContent: 'center' },
  iconText: { fontSize: 20, color: '#111' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  banner: { backgroundColor: '#111', padding: 24, borderRadius: 16, marginBottom: 20 },
  bannerTitle: { fontSize: 24, fontWeight: '900', color: '#FFD700', marginBottom: 8 },
  bannerSub: { fontSize: 13, color: '#CCC', lineHeight: 20, marginBottom: 16 },
  balanceBox: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardStatus: { position: 'absolute', top: 20, right: 20, backgroundColor: '#0066FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, zIndex: 10 },
  cardStatusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  imgPlaceholder: { width: '100%', height: 180, backgroundColor: '#F0F0F0', borderRadius: 12, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  eventName: { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F5' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  infoValueCost: { fontSize: 14, fontWeight: '900', color: '#FF3B30' },
  infoValueHot: { fontSize: 14, fontWeight: '900', color: '#D49A36' },
  joinBtn: { backgroundColor: '#0066FF', paddingVertical: 16, borderRadius: 25, alignItems: 'center', marginTop: 30 },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 }
});