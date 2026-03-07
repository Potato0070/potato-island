import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 模拟在这个系列下，玩家们寄售的具体编号数据
const MOCK_LISTINGS = [
  { id: '1', serial: '#298363', price: 1.00 },
  { id: '2', serial: '#298354', price: 1.00 },
  { id: '3', serial: '#298353', price: 1.00 },
  { id: '4', serial: '#298339', price: 2.50 },
  { id: '5', serial: '#298338', price: 3.00 },
];

export default function CollectionPage() {
  const router = useRouter();
  const params = useLocalSearchParams(); // 接收从市场传来的系列大类数据

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.listItem}
      activeOpacity={0.8}
      // 核心：点击具体的编号，带着所有信息跳入“大图详情页”
      onPress={() => router.push({
        pathname: '/detail',
        params: { ...params, serial: item.serial, price: item.price } 
      })}
    >
      <Image source={{ uri: params.image as string }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{params.title}</Text>
        <Text style={styles.itemSerial}>{item.serial}/900000</Text>
      </View>
      <Text style={styles.itemPrice}>🥔 {item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{params.title}</Text>
        <TouchableOpacity>
          <Text style={styles.headerRight}>去寄售</Text>
        </TouchableOpacity>
      </View>

      {/* 藏品总览 */}
      <View style={styles.summaryCard}>
        <Image source={{ uri: params.image as string }} style={styles.summaryImage} />
        <View style={styles.summaryInfo}>
          <Text style={styles.summaryTitle}>{params.title}</Text>
          <Text style={styles.summaryText}>发行量：900000</Text>
          <Text style={styles.summaryText}>流通量：{params.circulation}</Text>
        </View>
      </View>

      {/* 筛选栏 */}
      <View style={styles.filterBar}>
        <Text style={styles.filterLeft}>寄售藏品 10922</Text>
        <View style={styles.filterRight}>
          <Text style={styles.filterText}>最新</Text>
          <Text style={[styles.filterText, styles.filterActive]}>价格</Text>
        </View>
      </View>
      
      {/* 提示条 */}
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>寄售价不够合适？点此去发布求购单，抢先拿下心仪藏品 {'>'}</Text>
      </View>

      {/* 寄售列表 */}
      <FlatList
        data={MOCK_LISTINGS}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* 底部按钮组 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.btn, styles.btnBlue]}><Text style={styles.btnText}>相关公告</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnYellow]}><Text style={styles.btnText}>批量购买</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnRed]}><Text style={styles.btnText}>快捷购买</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerRight: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  summaryCard: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', marginVertical: 8 },
  summaryImage: { width: 80, height: 80, borderRadius: 8, marginRight: 16 },
  summaryInfo: { justifyContent: 'center' },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  summaryText: { fontSize: 12, color: '#999', marginBottom: 4 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterLeft: { fontSize: 14, color: '#999' },
  filterRight: { flexDirection: 'row' },
  filterText: { fontSize: 14, marginLeft: 16, color: '#999' },
  filterActive: { color: '#007AFF', fontWeight: 'bold' },
  warningBanner: { backgroundColor: '#FFF4E5', padding: 10 },
  warningText: { color: '#FF8C00', fontSize: 12, textAlign: 'center' },
  listContainer: { padding: 16, paddingBottom: 100 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  itemImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 6, color: '#333' },
  itemSerial: { fontSize: 12, color: '#999' },
  itemPrice: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  bottomBar: { flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', padding: 12, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#EEE' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 24, marginHorizontal: 4, alignItems: 'center' },
  btnBlue: { backgroundColor: '#007AFF' },
  btnYellow: { backgroundColor: '#FFA500' },
  btnRed: { backgroundColor: '#FF4D4F' },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});