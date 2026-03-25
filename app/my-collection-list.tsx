import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const FallbackImage = ({ uri, style }: { uri: string, style: any }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF8F0' }]}>
      {!hasError ? (
        <Image source={{ uri: uri || 'invalid_url' }} style={[style, { position: 'absolute', width: '100%', height: '100%' }]} onError={() => setHasError(true)} />
      ) : (
        <Text style={{ fontSize: 24 }}>🥔</Text>
      )}
    </View>
  );
};

export default function MyCollectionListScreen() {
  const router = useRouter();
  const { collectionId, collectionName } = useLocalSearchParams();
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [batchPrice, setBatchPrice] = useState('');
  const [processing, setProcessing] = useState(false);

  useFocusEffect(
    useCallback(() => { if (collectionId) fetchNfts(); }, [collectionId])
  );

  const fetchNfts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('nfts')
        .select(`id, serial_number, status, collections(name, image_url, max_consign_price)`)
        .eq('owner_id', user.id)
        .eq('collection_id', collectionId)
        .neq('status', 'burned') 
        .order('serial_number', { ascending: true });

      if (error) throw error;
      setNfts(data || []);
    } catch (err) { console.error('获取藏品失败', err); } finally { setLoading(false); }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      if (selectedIds.length >= 20) return Alert.alert('上限提示', '单次批量操作最多支持 20 件藏品！');
      setSelectedIds([...selectedIds, id]);
    }
  };

  const executeBatchConsign = async () => {
    const price = parseFloat(batchPrice);
    if (isNaN(price) || price <= 0) return Alert.alert('错误', '请输入有效价格');
    
    const maxPrice = nfts[0]?.collections?.max_consign_price;
    if (maxPrice && price > maxPrice) return Alert.alert('越界警告', `全岛最高限价为 ¥${maxPrice}`);

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('batch_consign_nfts', {
        p_user_id: user?.id,
        p_nft_ids: selectedIds,
        p_price: price
      });

      if (error) {
         if (error.message.includes('特权不足')) {
            Alert.alert('缺少特权', '您需要拥有【批量寄售权益卡】才能使用此功能，请前往特权中心兑换！');
         } else {
            throw error;
         }
      } else {
         Alert.alert('✅ 批量上架成功', `成功将 ${selectedIds.length} 件藏品以 ¥${price} 上架！`);
         setShowPriceModal(false);
         setIsBatchMode(false);
         setSelectedIds([]);
         fetchNfts();
      }
    } catch (err: any) { Alert.alert('操作失败', err.message); } finally { setProcessing(false); }
  };

  const renderItem = ({ item }: { item: any }) => {
    const coverImg = item.collections?.image_url || 'https://via.placeholder.com/150';
    const isSelected = selectedIds.includes(item.id);
    const isListed = item.status === 'listed';

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected, isListed && {opacity: 0.6}]}
        activeOpacity={isBatchMode ? 0.9 : 0.8}
        disabled={isBatchMode && isListed} 
        onPress={() => {
           if (isBatchMode) toggleSelect(item.id);
           else router.push({ pathname: '/my-nft-detail', params: { id: item.id } });
        }}
      >
        <View style={[styles.badge, isListed ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#D49A36'}]}>
           <Text style={styles.badgeText}>{isListed ? '寄售中' : '金库中'}</Text>
        </View>

        {isBatchMode && !isListed && (
           <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
              {isSelected && <Text style={{color:'#FFF', fontSize: 12, fontWeight:'900'}}>✓</Text>}
           </View>
        )}

        <View style={styles.imgContainer}>
           <FallbackImage uri={coverImg} style={styles.img} />
        </View>
        
        <View style={styles.info}>
           <Text style={styles.title} numberOfLines={1}>{item.collections?.name}</Text>
           <Text style={styles.serial} numberOfLines={1}>#{String(item.serial_number).padStart(6, '0')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => isBatchMode ? setIsBatchMode(false) : router.back()} style={styles.navBtn}>
          <Text style={styles.iconText}>{isBatchMode ? '取消' : '〈'}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isBatchMode ? `已选 ${selectedIds.length}/20` : (collectionName || '藏品列表')}</Text>
        
        {!isBatchMode ? (
          <TouchableOpacity style={styles.navBtnRight} onPress={() => {setIsBatchMode(true); setSelectedIds([]);}}>
            <Text style={styles.batchText}>批量寄售</Text>
          </TouchableOpacity>
        ) : <View style={styles.navBtnRight} />}
      </View>

      {loading ? (
         <ActivityIndicator size="large" color="#D49A36" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={nfts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.rowWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#8D6E63' }}>该系列暂无可用藏品</Text>}
        />
      )}

      {isBatchMode && (
         <View style={styles.batchBottomBar}>
            <Text style={styles.batchTip}>将消耗 1 张批量寄售卡</Text>
            <TouchableOpacity 
               style={[styles.batchSubmitBtn, selectedIds.length === 0 && {backgroundColor: '#EAE0D5'}]}
               disabled={selectedIds.length === 0}
               onPress={() => setShowPriceModal(true)}
            >
               <Text style={[styles.batchSubmitText, selectedIds.length === 0 && {color: '#A1887F'}]}>统一标价上架</Text>
            </TouchableOpacity>
         </View>
      )}

      <Modal visible={showPriceModal} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.priceModalBox}>
               <Text style={styles.modalTitle}>批量设置价格</Text>
               <Text style={styles.modalSub}>正在为 {selectedIds.length} 件藏品设置上架价格</Text>
               <TextInput style={styles.modalInput} placeholder="输入单件寄售价格 (¥)" placeholderTextColor="#A1887F" keyboardType="decimal-pad" value={batchPrice} onChangeText={setBatchPrice} autoFocus />
               
               <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPriceModal(false)}><Text style={{color: '#8D6E63', fontWeight: '900'}}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={executeBatchConsign} disabled={processing}>
                     {processing ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: '900'}}>确认上架</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F0' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44, backgroundColor: '#FDF8F0', borderBottomWidth: 1, borderColor: '#EAE0D5' },
  navBtn: { width: 60, justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#4E342E', fontWeight: '900' },
  navTitle: { fontSize: 17, fontWeight: '900', color: '#4E342E' },
  navBtnRight: { width: 60, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  batchText: { fontSize: 14, color: '#D49A36', fontWeight: '900' },
  
  listContainer: { padding: 16, paddingBottom: 120 },
  rowWrapper: { justifyContent: 'space-between', marginBottom: 16 },
  
  card: { width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', shadowColor: '#4E342E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, padding: 8, borderWidth: 2, borderColor: '#EAE0D5' },
  cardSelected: { borderColor: '#D49A36', backgroundColor: '#FFFDF5' },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  checkbox: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#EAE0D5', backgroundColor: '#FDF8F0', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#D49A36', borderColor: '#D49A36' },
  
  imgContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FDF8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: '#EAE0D5' },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  info: { alignItems: 'center', paddingBottom: 4 },
  title: { fontSize: 14, fontWeight: '900', color: '#4E342E', marginBottom: 4 },
  serial: { fontSize: 12, color: '#8D6E63', fontWeight: '700', fontFamily: 'monospace' },

  batchBottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#4E342E', shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.05, elevation: 10, borderTopWidth: 1, borderColor: '#EAE0D5' },
  batchTip: { fontSize: 12, color: '#FF3B30', fontWeight: '900' },
  batchSubmitBtn: { backgroundColor: '#D49A36', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  batchSubmitText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,30,22,0.7)', justifyContent: 'center', alignItems: 'center' },
  priceModalBox: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#4E342E', marginBottom: 8 },
  modalSub: { fontSize: 13, color: '#8D6E63', marginBottom: 20, fontWeight: '700' },
  modalInput: { width: '100%', backgroundColor: '#FDF8F0', padding: 16, borderRadius: 12, fontSize: 20, fontWeight: '900', color: '#FF3B30', textAlign: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#EAE0D5' },
  modalBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalCancel: { flex: 0.48, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FDF8F0', alignItems: 'center', borderWidth: 1, borderColor: '#EAE0D5' },
  modalConfirm: { flex: 0.48, paddingVertical: 14, borderRadius: 12, backgroundColor: '#D49A36', alignItems: 'center' }
});