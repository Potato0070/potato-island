import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  const [rawNfts, setRawNfts] = useState<any[]>([]); 
  const [myNfts, setMyNfts] = useState<any[]>([]);   
  const [nftCount, setNftCount] = useState(0);

  const [expandedGroup, setExpandedGroup] = useState<any>(null);
  const [manageNft, setManageNft] = useState<any>(null); 
  const [sellPrice, setSellPrice] = useState('');
  const [manageLoading, setManageLoading] = useState(false);

  // 名字与头像状态
  const [showNameModal, setShowNameModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false); // 🔥 找回：头像选择模态框

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      
      if (sessionErr || !session?.user) {
        setUser(null);
        setLoading(false);
        setRefreshing(false);
        return; 
      }
      
      const currentUser = session.user;
      setUser(currentUser);

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (profileData) setProfile(profileData);

      const { data: nftsData, error: nftsErr } = await supabase
        .from('nfts')
        .select('*, collection:collection_id(*)')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!nftsErr && nftsData) {
          setRawNfts(nftsData); 
          setNftCount(nftsData.length);
          
          const groupedNfts = Object.values(nftsData.reduce((acc: any, nft: any) => {
             const cid = nft.collection_id;
             if (!acc[cid]) acc[cid] = { collection_id: cid, collection: nft.collection, total_owned: 0, listed_count: 0 };
             acc[cid].total_owned += 1;
             if (nft.status === 'listed' || nft.status === 'consigning') acc[cid].listed_count += 1;
             return acc;
          }, {}));
          
          setMyNfts(groupedNfts);
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchUserData(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const handleListNft = async () => {
      const p = parseFloat(sellPrice);
      if (isNaN(p) || p <= 0) return Alert.alert('提示', '请输入正确的寄售金额');
      setManageLoading(true);
      try {
          const { error } = await supabase.from('nfts').update({ status: 'consigning', price: p }).eq('id', manageNft.id);
          if (error) throw error;
          Alert.alert('昭告全岛', '您的资产已成功挂载至集市！');
          setManageNft(null);
          fetchUserData();
      } catch (err: any) {
          Alert.alert('挂售失败', err.message);
      } finally {
          setManageLoading(false);
      }
  };

  const handleDelistNft = async () => {
      setManageLoading(true);
      try {
          const { error } = await supabase.from('nfts').update({ status: 'idle', price: null }).eq('id', manageNft.id);
          if (error) throw error;
          Alert.alert('撤回成功', '该资产已重回您的金库。');
          setManageNft(null);
          fetchUserData();
      } catch (err: any) {
          Alert.alert('撤回失败', err.message);
      } finally {
          setManageLoading(false);
      }
  };

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert('提示', '请输入岛号(邮箱)和密码');
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('欢迎加入', '通行证注册成功！现在可以直接登录。');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        fetchUserData();
      }
    } catch (err: any) { Alert.alert('验证失败', err.message); } finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    Alert.alert('退出土豆宇宙', '确定要离开金库吗？', [
      { text: '留下', style: 'cancel' },
      { text: '退朝', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); setUser(null); }}
    ]);
  };

  const saveNickname = async () => {
      if (!editName.trim()) return Alert.alert('提示', '名号不能为空');
      setSavingName(true);
      try {
          await supabase.from('profiles').update({ nickname: editName.trim() }).eq('id', user.id);
          setProfile({ ...profile, nickname: editName.trim() });
          setShowNameModal(false);
      } catch (err: any) { Alert.alert('修改失败', err.message); } finally { setSavingName(false); }
  };

  // 🔥 找回：设置藏品为头像核心逻辑
  const saveAvatar = async (url: string) => {
      try {
          setSavingName(true);
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
          setProfile({ ...profile, avatar_url: url });
          setShowAvatarModal(false);
          Alert.alert('换装成功', '领主大人的新形象已昭告全岛！');
      } catch (err: any) {
          Alert.alert('更换失败', err.message);
      } finally {
          setSavingName(false);
      }
  };

  if (loading) {
      return (
          <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#D49A36" />
              <Text style={{marginTop: 12, color: '#8B5A2B', fontWeight: '800'}}>正在验证领主印章...</Text>
          </SafeAreaView>
      );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.authBox}>
           <Text style={{fontSize: 60, marginBottom: 20}}>🥔</Text>
           <Text style={styles.authTitle}>土豆宇宙</Text>
           <Text style={styles.authSubtitle}>请输入您的领主印章以开启金库</Text>
           <TextInput style={styles.authInput} placeholder="土豆岛号 (邮箱)" placeholderTextColor="#999" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
           <TextInput style={styles.authInput} placeholder="印章密语 (密码)" placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
           <TouchableOpacity style={styles.authMainBtn} onPress={handleAuth} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authMainBtnText}>{isSignUp ? '缔结契约 (注册)' : '开启金库 (登录)'}</Text>}
           </TouchableOpacity>
           <TouchableOpacity style={{marginTop: 20}} onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.authToggleText}>{isSignUp ? '已有印章？直接开启金库' : '尚未拥有身份？申请土豆岛号'}</Text>
           </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D49A36" />} showsVerticalScrollIndicator={false}>
        
        {/* 身份区 */}
        <View style={styles.identitySection}>
           {/* 🔥 找回：点击头像触发修改面板 */}
           <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
              <Image source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/100/D49A36/FFFFFF?text=LORD' }} style={styles.avatar} />
              <View style={styles.avatarEditBadge}><Text style={{fontSize: 10}}>📷</Text></View>
           </TouchableOpacity>
           
           <View style={styles.nameBox}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={styles.nickname}>{profile?.nickname || '未命名领主'}</Text>
                 <TouchableOpacity style={styles.editBtn} onPress={() => { setEditName(profile?.nickname || ''); setShowNameModal(true); }}>
                    <Text style={{fontSize: 14}}>✏️</Text>
                 </TouchableOpacity>
              </View>
              <Text style={styles.islandId}>土豆岛号: {user?.email}</Text>
           </View>
           
           {/* 超级管理员专属按钮 */}
           {profile?.is_admin && (
               <TouchableOpacity style={styles.topAdminBtn} onPress={() => router.push('/admin-panel')}>
                   <Text style={{fontSize: 20, marginBottom: 2}}>👑</Text>
                   <Text style={styles.topAdminBtnText}>超级中枢</Text>
               </TouchableOpacity>
           )}
        </View>

        <View style={styles.assetCard}>
            <View style={styles.assetItem}>
               <Text style={styles.assetLabel}>金库藏品</Text>
               <Text style={styles.assetValue}>{nftCount}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.assetItem}>
               <Text style={styles.assetLabel}>Potato 币</Text>
               <Text style={[styles.assetValue, {color: '#D49A36'}]}>{Number(profile?.potato_coin_balance || 0).toFixed(2)}</Text>
            </View>
        </View>

        <TouchableOpacity style={styles.vipCard} activeOpacity={0.9}>
            <View style={styles.vipHeader}>
               <Text style={styles.vipTitle}>👑 见习岛民 (V0)</Text>
               <Text style={styles.vipLink}>查看权益 〉</Text>
            </View>
            <Text style={styles.vipDesc}>再消费 ¥99.00 即可晋升 V1 领主，解锁专属特权与更低交易费率。</Text>
            <View style={styles.vipProgressBar}><View style={[styles.vipProgressFill, {width: '10%'}]} /></View>
        </TouchableOpacity>

        {/* 八宫格 */}
        <View style={styles.gridContainer}>
            <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/my-orders')}>
               <Text style={styles.gridIcon}>📜</Text>
               <Text style={styles.gridTitle}>我的挂单</Text>
            </TouchableOpacity>
            {['⚖️历史买卖', '🧬变异记录', '📦非酋盲盒', '🤝邀请收租', '📍地址管理', '🛡️实名认证', '🥔王国使者'].map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.gridItem} onPress={() => Alert.alert('行军中', '该区域建设中...')}>
                   <Text style={styles.gridIcon}>{item.slice(0, 2)}</Text>
                   <Text style={styles.gridTitle}>{item.slice(2)}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <View style={styles.vaultSection}>
           <Text style={styles.vaultTitle}>📦 我的藏品收纳区</Text>
           {myNfts.length === 0 ? (
               <View style={styles.emptyVault}><Text style={styles.emptyVaultText}>金库空空如也，快去集市扫货吧</Text></View>
           ) : (
               <View style={styles.nftGrid}>
                   {myNfts.map((group) => (
                       <TouchableOpacity key={group.collection_id} style={styles.nftCard} activeOpacity={0.8} onPress={() => setExpandedGroup(group)}>
                           <View style={styles.nftImgBox}>
                               <Image source={{uri: group.collection?.image_url}} style={styles.nftImage} />
                               {group.listed_count > 0 && <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{group.listed_count}张寄售中</Text></View>}
                           </View>
                           <View style={styles.nftInfo}>
                               <Text style={styles.nftName} numberOfLines={1}>{group.collection?.name}</Text>
                               <View style={styles.nftCountBox}><Text style={styles.nftCountText}>拥有 x{group.total_owned}</Text></View>
                           </View>
                       </TouchableOpacity>
                   ))}
               </View>
           )}
        </View>

        <View style={styles.footerActions}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}><Text style={styles.logoutText}>退出土豆宇宙</Text></TouchableOpacity>
            <Text style={styles.versionText}>Potato Island v2.0.0</Text>
        </View>
      </ScrollView>

      {/* ✏️ 修改昵称模态框 */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>赐予新名号</Text>
            <TextInput style={styles.modalInputField} placeholder="输入尊号..." placeholderTextColor="#999" value={editName} onChangeText={setEditName} maxLength={12} autoFocus />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.mBtn, styles.mBtnCancel]} onPress={() => setShowNameModal(false)}><Text style={styles.mBtnCancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mBtnConfirm]} onPress={saveNickname} disabled={savingName}><Text style={styles.mBtnConfirmText}>{savingName ? '赐名中...' : '确认昭告'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🔥 找回：选择藏品作为头像模态框 */}
      <Modal visible={showAvatarModal} transparent animationType="slide">
         <View style={styles.sheetOverlay}>
            <View style={styles.sheetContent}>
               <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>选择藏品作为化身</Text>
                  <TouchableOpacity onPress={() => setShowAvatarModal(false)} style={styles.closeBtn}><Text style={styles.closeBtnText}>取消</Text></TouchableOpacity>
               </View>
               {myNfts.length === 0 ? (
                   <Text style={{textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16}}>金库空空，暂无可用化身</Text>
               ) : (
                   <FlatList
                      data={myNfts}
                      keyExtractor={(item) => item.collection_id}
                      numColumns={3}
                      columnWrapperStyle={{ justifyContent: 'flex-start' }}
                      renderItem={({item}) => {
                          const isSelected = profile?.avatar_url === item.collection?.image_url;
                          return (
                              <TouchableOpacity 
                                  style={[styles.avatarOptionCard, isSelected && {borderColor: '#D49A36'}]} 
                                  onPress={() => saveAvatar(item.collection?.image_url)}
                              >
                                  <Image source={{uri: item.collection?.image_url}} style={{width: '100%', height: '100%'}} />
                                  {isSelected && <View style={styles.avatarSelectedBadge}><Text style={{color:'#FFF', fontSize:10}}>✓</Text></View>}
                              </TouchableOpacity>
                          )
                      }}
                   />
               )}
            </View>
         </View>
      </Modal>

      {/* 📂 第一层：藏品明细展开抽屉 */}
      <Modal visible={!!expandedGroup} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContent}>
             <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>已收纳的【{expandedGroup?.collection?.name}】</Text>
                <TouchableOpacity onPress={() => setExpandedGroup(null)} style={styles.closeBtn}><Text style={styles.closeBtnText}>收起</Text></TouchableOpacity>
             </View>
             <FlatList
                data={rawNfts.filter(n => n.collection_id === expandedGroup?.collection_id)}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => (
                    <TouchableOpacity 
                        style={styles.sheetNftCard} activeOpacity={0.8}
                        onPress={() => { setExpandedGroup(null); setManageNft(item); setSellPrice(''); }}
                    >
                        <View style={styles.sheetNftImgBox}>
                            <Image source={{uri: item.collection?.image_url}} style={styles.sheetNftImage} />
                            {(item.status === 'listed' || item.status === 'consigning') && <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>寄售中</Text></View>}
                        </View>
                        <View style={styles.sheetNftInfo}>
                            <Text style={styles.nftName} numberOfLines={1}>{item.collection?.name}</Text>
                            <Text style={styles.sheetNftSerial}>编号: #{item.serial_number}</Text>
                        </View>
                    </TouchableOpacity>
                )}
             />
          </View>
        </View>
      </Modal>

      {/* 🛠️ 第二层神级操作：独立资产控制台中枢 */}
      <Modal visible={!!manageNft} transparent animationType="fade">
         <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.manageBox}>
               <TouchableOpacity style={styles.closeManageBtn} onPress={() => setManageNft(null)}><Text style={{fontSize:22, color:'#999'}}>×</Text></TouchableOpacity>
               <Image source={{uri: manageNft?.collection?.image_url}} style={styles.manageImg} />
               <Text style={styles.manageName}>{manageNft?.collection?.name}</Text>
               <Text style={styles.manageSerial}>编号: #{manageNft?.serial_number}</Text>

               {(manageNft?.status === 'listed' || manageNft?.status === 'consigning') ? (
                   <View style={styles.manageActionArea}>
                       <Text style={styles.manageStatusText}>当前状态: 正在大盘寄售中 (¥{manageNft?.price})</Text>
                       <TouchableOpacity style={styles.delistBtn} onPress={handleDelistNft} disabled={manageLoading}>
                           <Text style={styles.delistBtnText}>{manageLoading ? '处理中...' : '取消寄售 (撤回金库)'}</Text>
                       </TouchableOpacity>
                   </View>
               ) : (
                   <View style={styles.manageActionArea}>
                       <Text style={styles.manageStatusText}>当前状态: 闲置中 (安全在库)</Text>
                       <TextInput style={styles.priceInput} placeholder="输入您的期望售价 (¥)" placeholderTextColor="#AAA" keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
                       <TouchableOpacity style={styles.listBtn} onPress={handleListNft} disabled={manageLoading}>
                           <Text style={styles.listBtnText}>{manageLoading ? '处理中...' : '确认上架寄售'}</Text>
                       </TouchableOpacity>
                   </View>
               )}
            </View>
         </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F6F0' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  identitySection: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 24, position: 'relative' },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#D49A36' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  nameBox: { marginLeft: 16, flex: 1 },
  nickname: { fontSize: 22, fontWeight: '900', color: '#4A2E1B' },
  editBtn: { marginLeft: 8, padding: 4 },
  islandId: { fontSize: 13, color: '#8B5A2B', marginTop: 4, fontWeight: '600' },
  topAdminBtn: { backgroundColor: '#4A2E1B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#D49A36', shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  topAdminBtnText: { color: '#D49A36', fontSize: 10, fontWeight: '900' },
  assetCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 20, shadowColor: '#4A2E1B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  assetItem: { flex: 1, alignItems: 'center' },
  assetLabel: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 8 },
  assetValue: { fontSize: 24, fontWeight: '900', color: '#4A2E1B' },
  divider: { width: 1, backgroundColor: '#F0EBE1', marginVertical: 10 },
  vipCard: { backgroundColor: '#4A2E1B', borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#D49A36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  vipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vipTitle: { fontSize: 16, fontWeight: '900', color: '#D49A36' },
  vipLink: { fontSize: 12, color: '#CCC' },
  vipDesc: { fontSize: 12, color: '#AAA', lineHeight: 18, marginBottom: 12 },
  vipProgressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  vipProgressFill: { height: '100%', backgroundColor: '#D49A36', borderRadius: 3 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF', borderRadius: 16, padding: 12, shadowColor: '#4A2E1B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 24 },
  gridItem: { width: '25%', alignItems: 'center', paddingVertical: 16 },
  gridIcon: { fontSize: 28, marginBottom: 8 },
  gridTitle: { fontSize: 12, color: '#4A2E1B', fontWeight: '700' },
  vaultSection: { marginBottom: 30 },
  vaultTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 16 },
  emptyVault: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0EBE1', borderStyle: 'dashed' },
  emptyVaultText: { color: '#999', fontSize: 14, fontWeight: '600' },
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  nftCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', shadowColor: '#4A2E1B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  nftImgBox: { width: '100%', aspectRatio: 1, position: 'relative', backgroundColor: '#F5F5F5' },
  nftImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  statusBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  nftInfo: { padding: 12, alignItems: 'center' },
  nftName: { fontSize: 14, fontWeight: '800', color: '#4A2E1B', marginBottom: 6 },
  nftCountBox: { backgroundColor: '#F9F6F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  nftCountText: { fontSize: 12, color: '#D49A36', fontWeight: '900' },
  footerActions: { marginTop: 10, paddingBottom: 20 },
  logoutBtn: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EEDCBE' },
  logoutText: { color: '#8B5A2B', fontSize: 16, fontWeight: '800' },
  versionText: { textAlign: 'center', marginTop: 24, fontSize: 12, color: '#CCC', fontWeight: '600' },
  authContainer: { flex: 1, backgroundColor: '#F9F6F0', justifyContent: 'center' },
  authBox: { paddingHorizontal: 30, alignItems: 'center' },
  authTitle: { fontSize: 28, fontWeight: '900', color: '#4A2E1B', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#8B5A2B', marginBottom: 40 },
  authInput: { width: '100%', height: 55, backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#4A2E1B', marginBottom: 16, borderWidth: 1, borderColor: '#EEDCBE' },
  authMainBtn: { width: '100%', height: 55, backgroundColor: '#D49A36', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#D49A36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  authMainBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  authToggleText: { color: '#8B5A2B', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(74, 46, 27, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: width * 0.8, backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 20 },
  modalInputField: { width: '100%', backgroundColor: '#F9F6F0', borderWidth: 1, borderColor: '#EEDCBE', borderRadius: 12, padding: 16, fontSize: 16, color: '#4A2E1B', fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  mBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  mBtnCancel: { backgroundColor: '#F5F5F5', marginRight: 10 },
  mBtnCancelText: { color: '#999', fontSize: 16, fontWeight: '700' },
  mBtnConfirm: { backgroundColor: '#D49A36', marginLeft: 10 },
  mBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  // 抽屉及头像选择库
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(74, 46, 27, 0.6)', justifyContent: 'flex-end' },
  sheetContent: { backgroundColor: '#F9F6F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: height * 0.75, padding: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: '#4A2E1B' },
  closeBtn: { backgroundColor: '#EEDCBE', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  closeBtnText: { color: '#8B5A2B', fontWeight: '800', fontSize: 14 },
  
  avatarOptionCard: { width: '31%', margin: '1%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  avatarSelectedBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#D49A36', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  sheetNftCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EEDCBE', marginBottom: 16 },
  sheetNftImgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5' },
  sheetNftImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  sheetNftInfo: { padding: 12 },
  sheetNftSerial: { fontSize: 12, color: '#D49A36', fontWeight: '900', marginTop: 4 },
  manageBox: { width: width * 0.85, backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#4A2E1B', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  closeManageBtn: { position: 'absolute', top: 12, right: 16, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 15, zIndex: 10 },
  manageImg: { width: 120, height: 120, borderRadius: 16, borderWidth: 2, borderColor: '#D49A36', marginBottom: 16 },
  manageName: { fontSize: 18, fontWeight: '900', color: '#4A2E1B', marginBottom: 4 },
  manageSerial: { fontSize: 14, color: '#D49A36', fontWeight: '800', marginBottom: 20 },
  manageActionArea: { width: '100%', alignItems: 'center', backgroundColor: '#F9F6F0', padding: 16, borderRadius: 16, marginBottom: 16 },
  manageStatusText: { fontSize: 13, color: '#8B5A2B', fontWeight: '700', marginBottom: 12 },
  priceInput: { width: '100%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEDCBE', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'center', marginBottom: 12, color: '#4A2E1B', fontWeight: '900' },
  listBtn: { width: '100%', backgroundColor: '#D49A36', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  listBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  delistBtn: { width: '100%', backgroundColor: '#FF3B30', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  delistBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' }
});