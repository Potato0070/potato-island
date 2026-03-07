import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

type AdminTab = '资产调控' | '王国公告' | '藏品发新' | '进化配置' | '神之手';
interface CategoryItem { id: number; name: string; sort_order: number; }

export default function AdminPanelScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('资产调控');
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  
  // 核心数据源
  const [collections, setCollections] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<CategoryItem[]>([]);
  
  // 看板数据
  const [launchList, setLaunchList] = useState<any[]>([]);
  const [synthesisList, setSynthesisList] = useState<any[]>([]);
  const [announceList, setAnnounceList] = useState<any[]>([]);

  // 💎 资产调控专属模态框
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [selectedCol, setSelectedCol] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [burnAmount, setBurnAmount] = useState('');

  // 🌟 全局可视化选择器
  const [showColPicker, setShowColPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'announce' | 'launch' | 'synTarget' | 'synReq' | 'mint' | null>(null);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);

  // ⏱️ 北京时间快捷选择器
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateOffset, setSelectedDateOffset] = useState(0); 
  const [selectedHour, setSelectedHour] = useState('20');
  const [selectedMinute, setSelectedMinute] = useState('00');

  // 📜 社区 2.0
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceContent, setAnnounceContent] = useState('');
  const [announceImage, setAnnounceImage] = useState('');
  const [announceFeatured, setAnnounceFeatured] = useState(false);

  // 🚀 发新大厅 6.0
  const [launchColId, setLaunchColId] = useState('');
  const [launchColName, setLaunchColName] = useState('');
  const [launchPrice, setLaunchPrice] = useState('');
  const [launchSupply, setLaunchSupply] = useState('');
  const [launchStartTime, setLaunchStartTime] = useState('');

  // 🧬 进化配方
  const [synName, setSynName] = useState('');
  const [targetColId, setTargetColId] = useState('');
  const [targetColName, setTargetColName] = useState('');
  const [synMaxCount, setSynMaxCount] = useState('100');
  const [requirements, setRequirements] = useState<{id: string, name: string, count: string}[]>([{ id: '', name: '', count: '1' }]);

  // 👑 神之手
  const [newBalance, setNewBalance] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [furnaceRewardStr, setFurnaceRewardStr] = useState('');
  const [currentFurnaceReward, setCurrentFurnaceReward] = useState('0');
  const [mintColId, setMintColId] = useState('');
  const [mintColName, setMintColName] = useState('');
  const [mintAmount, setMintAmount] = useState('1');

  useFocusEffect(useCallback(() => { initAdmin(); }, []));

  const initAdmin = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace('/');
      
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) { Alert.alert('越权拦截', '无权访问！'); return router.back(); }
      setAdminId(user.id);
      
      await fetchData();
    } catch (err: any) { Alert.alert('初始化失败', err.message); } finally { setLoading(false); }
  };

  const fetchData = async () => {
      try {
          // 防弹级获取策略：拆分查询，避免关联查错导致整个页面黑屏
          const { data: catData } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
          if (catData) setAdminCategories(catData as CategoryItem[]);

          const { data: cData } = await supabase.from('collections').select('*').order('created_at', { ascending: true });
          if (cData) setCollections(cData);
          
          const { data: lData } = await supabase.from('launch_events').select('*, collection:collection_id(name)').order('created_at', { ascending: false });
          if (lData) setLaunchList(lData);

          const { data: sData } = await supabase.from('synthesis_events').select('*, collection:target_collection_id(name)').order('created_at', { ascending: false });
          if (sData) setSynthesisList(sData);

          const { data: aData } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
          if (aData) setAnnounceList(aData);

          const { data: cfg } = await supabase.from('system_config').select('value').eq('key', 'furnace_potato_reward').single();
          if (cfg) setCurrentFurnaceReward(cfg.value.toString());
      } catch (e) {
          console.error("Fetch Data Error: ", e);
      }
  };

  const openPicker = (target: typeof pickerTarget, index?: number) => {
    setPickerTarget(target);
    if (index !== undefined) setActiveReqIndex(index);
    setShowColPicker(true);
  };

  const handleSelectFromPicker = (col: any) => {
    if (pickerTarget === 'announce') setAnnounceImage(col.image_url);
    if (pickerTarget === 'launch') { setLaunchColId(col.id); setLaunchColName(col.name); }
    if (pickerTarget === 'synTarget') { setTargetColId(col.id); setTargetColName(col.name); }
    if (pickerTarget === 'mint') { setMintColId(col.id); setMintColName(col.name); }
    if (pickerTarget === 'synReq' && activeReqIndex !== null) { 
        const newReqs = [...requirements];
        newReqs[activeReqIndex].id = col.id;
        newReqs[activeReqIndex].name = col.name;
        setRequirements(newReqs);
    }
    setShowColPicker(false);
  };

  const confirmTimeSelection = () => {
    const now = new Date();
    const targetDate = new Date(now.getTime() + selectedDateOffset * 24 * 60 * 60 * 1000);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const timeString = `${year}-${month}-${day}T${selectedHour}:${selectedMinute}:00+08:00`;
    setLaunchStartTime(timeString);
    setShowTimePicker(false);
  };

  // ================= 💎 核心资产调控功能 =================

  // 1. 开关市场流通
  const toggleTradeable = async (item: any) => {
      const newVal = !item.is_tradeable;
      const { error } = await supabase.from('collections').update({ is_tradeable: newVal }).eq('id', item.id);
      if (error) Alert.alert('错误', error.message); else fetchData();
  };

  // 2. 修改最高限价
  const executeUpdatePrice = async () => {
    const price = parseFloat(editValue);
    if (isNaN(price) || price < 0) return Alert.alert('错误', '无效价格');
    const { error } = await supabase.rpc('update_max_price_and_clean', { p_collection_id: selectedCol.id, p_new_max_price: price });
    if (error) Alert.alert('操作失败', error.message); else { setShowPriceModal(false); fetchData(); }
  };

  // 3. 修改分区分类
  const executeChangeCategory = async (catId: number) => {
      const { error } = await supabase.from('collections').update({ category_id: catId }).eq('id', selectedCol.id);
      if (error) Alert.alert('转移失败', error.message); else { setShowCategoryModal(false); fetchData(); }
  };

  // 4. 🔥 打入废墟 & 清道夫播报
  const executeBurnToRuins = async () => {
      const amount = parseInt(burnAmount);
      if (isNaN(amount) || amount <= 0) return Alert.alert('错误', '请输入有效整数');
      if (amount > selectedCol.circulating_supply) return Alert.alert('错误', '销毁数量不能超过大盘现有流通存量！');

      setPublishing(true);
      try {
          // A. 扣减大盘数据
          const { error: updateErr } = await supabase.from('collections')
              .update({ circulating_supply: selectedCol.circulating_supply - amount })
              .eq('id', selectedCol.id);
          if (updateErr) throw updateErr;

          // B. 触发清道夫自动广播
          const burnContent = `刚刚土豆清道夫将 ${amount} 份【${selectedCol.name}】进行回收打入废墟，助力土豆岛起飞！`;
          const { error: annErr } = await supabase.from('announcements').insert([{
              title: '🚨 宏观销毁播报',
              content: burnContent,
              image_url: selectedCol.image_url,
              is_featured: false,
              author_name: '土豆清道夫'
          }]);
          if (annErr) throw annErr;

          Alert.alert('🔥 销毁成功', `已成功打入废墟！\n全岛播报已发出。`);
          setShowBurnModal(false); setBurnAmount(''); fetchData();
      } catch (err: any) {
          Alert.alert('销毁失败', err.message);
      } finally {
          setPublishing(false);
      }
  };

  // ================= 其他模块操作 =================

  const handlePublishAnnouncement = async () => {
    if (!announceTitle || !announceContent || !announceImage) return Alert.alert('提示', '请填写完整');
    setPublishing(true);
    const { error } = await supabase.from('announcements').insert([{ 
      title: announceTitle, content: announceContent, image_url: announceImage, is_featured: announceFeatured, author_name: '土豆国王'
    }]);
    setPublishing(false);
    if (error) Alert.alert('发布失败', error.message);
    else { Alert.alert('成功', '公告已发布！'); setAnnounceTitle(''); setAnnounceContent(''); setAnnounceImage(''); fetchData(); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
      Alert.alert('撤回', '确定要全网删除这条公告/播报吗？', [
          {text: '取消', style: 'cancel'},
          {text: '强制删除', style: 'destructive', onPress: async () => { await supabase.from('announcements').delete().eq('id', id); fetchData(); }}
      ]);
  };

  const handleCreateLaunch = async () => { 
      if (!launchColId || !launchPrice || !launchSupply || !launchStartTime) return Alert.alert('提示', '请填写完整参数');
      setPublishing(true);
      const { error } = await supabase.from('launch_events').insert([{ collection_id: launchColId, price: parseFloat(launchPrice), total_supply: parseInt(launchSupply), remaining_supply: parseInt(launchSupply), start_time: launchStartTime }]);
      setPublishing(false);
      if (error) Alert.alert('失败', error.message); else { Alert.alert('✅ 部署成功'); setLaunchColId(''); setLaunchColName(''); fetchData(); }
  };
  const handleDeleteLaunch = async (id: string) => { await supabase.from('launch_events').delete().eq('id', id); fetchData(); };
  
  const handleCreateSynthesis = async () => { 
      if (!synName || !targetColId) return Alert.alert('错误', '请填写完整配方');
      setPublishing(true);
      const { data: evData } = await supabase.from('synthesis_events').insert([{ name: synName, target_collection_id: targetColId, end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), max_count: parseInt(synMaxCount) || 0 }]).select('id').single();
      const reqInserts = requirements.map(r => ({ event_id: evData!.id, req_collection_id: r.id, req_count: parseInt(r.count) }));
      await supabase.from('synthesis_requirements').insert(reqInserts);
      setPublishing(false); Alert.alert('成功'); fetchData(); setSynName(''); setRequirements([{ id: '', name: '', count: '1' }]);
  };
  const handleDeleteSynthesis = async (id: string) => { await supabase.from('synthesis_events').delete().eq('id', id); fetchData(); };
  
  const addRequirement = () => setRequirements([...requirements, { id: '', name: '', count: '1' }]);
  const removeRequirement = (index: number) => setRequirements(requirements.filter((_, i) => i !== index));
  const updateReqCount = (index: number, val: string) => { const newReqs = [...requirements]; newReqs[index].count = val; setRequirements(newReqs); };

  const handleTamperBalance = async () => {
      if(!newBalance) return;
      await supabase.from('profiles').update({ potato_coin_balance: parseFloat(newBalance) }).eq('id', adminId);
      Alert.alert('成功', '资金已强行覆写！'); setNewBalance('');
  };
  const handleUpdateFurnace = async () => {
      if(!furnaceRewardStr) return;
      await supabase.from('system_config').update({ value: parseFloat(furnaceRewardStr) }).eq('key', 'furnace_potato_reward');
      Alert.alert('成功', '熔炉奖励已更新！'); fetchData();
  };
  const handleCreateCategory = async () => {
      if(!newCategoryName) return;
      await supabase.from('categories').insert([{ name: newCategoryName, sort_order: 99 }]);
      Alert.alert('成功', '新分类已创建！'); setNewCategoryName(''); fetchData();
  };
  const handleMintCustom = async () => {
      if(!mintColId || !mintAmount) return Alert.alert('提示', '请选择藏品并输入数量');
      const { data: col } = await supabase.from('collections').select('total_minted').eq('id', mintColId).single();
      const startNum = (col?.total_minted || 0) + 1;
      const inserts = Array.from({length: parseInt(mintAmount)}).map((_, i) => ({ collection_id: mintColId, owner_id: adminId, serial_number: (startNum + i).toString(), status: 'idle' }));
      await supabase.from('nfts').insert(inserts);
      await supabase.from('collections').update({ total_minted: startNum + parseInt(mintAmount) - 1, circulating_supply: startNum + parseInt(mintAmount) - 1 }).eq('id', mintColId);
      Alert.alert('🖨️ 印钞成功'); setMintColId(''); setMintColName(''); setMintAmount('1'); fetchData();
  };

  // ================= UI 渲染 =================

  const renderAssetCard = ({ item }: { item: any }) => {
    // 纯前端匹配分类名称，安全无痛
    const catName = adminCategories.find(c => c.id === item.category_id)?.name || '未分类';

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.image_url || `https://via.placeholder.com/150` }} style={styles.cardImg} />
        
        <View style={styles.cardInfo}>
          {/* 第一行：名字 + 开关 */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
             <Text style={styles.cardName}>{item.name}</Text>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={{color: '#888', fontSize: 10, marginRight: 4}}>{item.is_tradeable ? '流通中' : '已冻结'}</Text>
                <Switch 
                   value={!!item.is_tradeable} 
                   onValueChange={() => toggleTradeable(item)} 
                   trackColor={{ false: '#333', true: '#FFD700' }} 
                   thumbColor="#FFF" 
                   style={{transform: [{scale: 0.8}]}} 
                />
             </View>
          </View>

          {/* 第二行：存量 + 类别 */}
          <Text style={{color: '#888', fontSize: 11, marginTop: 4}}>大盘存量: {item.circulating_supply} | 类别: {catName}</Text>
          
          {/* 第三行：三大核心操作按钮 */}
          <View style={{flexDirection: 'row', marginTop: 12, justifyContent: 'space-between'}}>
             <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#2C2C2E', borderColor: '#555'}]} onPress={() => { setSelectedCol(item); setShowCategoryModal(true); }}>
                <Text style={{color: '#CCC', fontSize: 11, fontWeight: '700'}}>🗂️ 分区</Text>
             </TouchableOpacity>
             
             <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#2C2C2E', borderColor: '#00E5FF'}]} onPress={() => { setSelectedCol(item); setEditValue(item.max_consign_price?.toString()); setShowPriceModal(true); }}>
                <Text style={{color: '#00E5FF', fontSize: 11, fontWeight: '700'}}>¥{item.max_consign_price?.toFixed(0)} 限价</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#2C2C2E', borderColor: '#FF3B30'}]} onPress={() => { setSelectedCol(item); setBurnAmount(''); setShowBurnModal(true); }}>
                <Text style={{color: '#FF3B30', fontSize: 11, fontWeight: '900'}}>🔥 废墟</Text>
             </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}><Text style={styles.iconText}>〈</Text></TouchableOpacity>
        <Text style={styles.navTitle}>👑 创世中枢</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRowOuter} contentContainerStyle={styles.tabRow}>
        {(['资产调控', '藏品发新', '进化配置', '王国公告', '神之手'] as AdminTab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 50}} /> : (
        <View style={{flex: 1}}>
          
          {/* 💎 资产调控 Tab */}
          {activeTab === '资产调控' && (
            <FlatList 
               data={collections} 
               renderItem={renderAssetCard} 
               keyExtractor={item => item.id} 
               contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
               style={{flex: 1}}
               ListEmptyComponent={<Text style={{color: '#888', textAlign: 'center', marginTop: 50}}>暂无藏品数据</Text>}
            />
          )}

          {/* 其他 Tabs */}
          {activeTab !== '资产调控' && (
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 100}}>
              
              {activeTab === '藏品发新' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>🚀 部署创世发新</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('launch')}><Text style={styles.pickerBtnText}>{launchColName ? `📍 已选发售物: ${launchColName}` : '+ 从图库选择发售藏品'}</Text></TouchableOpacity>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><TextInput style={[styles.inputDark, {flex: 0.48}]} placeholder="首发价 ¥" placeholderTextColor="#666" keyboardType="decimal-pad" value={launchPrice} onChangeText={setLaunchPrice} /><TextInput style={[styles.inputDark, {flex: 0.48}]} placeholder="释放数量" placeholderTextColor="#666" keyboardType="number-pad" value={launchSupply} onChangeText={setLaunchSupply} /></View>
                    <TouchableOpacity style={[styles.pickerBtn, {borderColor: '#00E5FF', minHeight: 50}]} onPress={() => setShowTimePicker(true)}><Text style={[styles.pickerBtnText, {color: launchStartTime ? '#00E5FF' : '#666'}]}>{launchStartTime ? `⏰ 开售: ${new Date(launchStartTime).toLocaleString()}` : '⏱️ 点击设定开售时间 (北京时间)'}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.goldBtn} onPress={handleCreateLaunch} disabled={publishing}><Text style={styles.goldBtnText}>{publishing ? '部署中...' : '⚡ 锁定发售排期'}</Text></TouchableOpacity>
                  </View>
                  <Text style={[styles.sectionTitle, {marginTop: 10}]}>📋 发新排期看板</Text>
                  {launchList.map(item => (
                      <View key={item.id} style={styles.manageCard}>
                          <View style={{flex: 1}}><Text style={{color: '#FFF', fontWeight: '800'}}>{item.collection?.name}</Text><Text style={{color: '#888', fontSize: 12, marginTop: 4}}>首发: ¥{item.price} | 剩余: {item.remaining_supply}/{item.total_supply}</Text><Text style={{color: '#00E5FF', fontSize: 12, marginTop: 4}}>开售: {new Date(item.start_time).toLocaleString()}</Text></View>
                          <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteLaunch(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity>
                      </View>
                  ))}
                </View>
              )}

              {activeTab === '进化配置' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>🧬 部署变异配方</Text>
                    <TextInput style={styles.inputDark} placeholder="活动名称 (如: 神圣土豆变异)" placeholderTextColor="#666" value={synName} onChangeText={setSynName} />
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><TouchableOpacity style={[styles.pickerBtn, {flex: 0.7, borderColor: '#00E5FF'}]} onPress={() => openPicker('synTarget')}><Text style={[styles.pickerBtnText, {color: targetColName ? '#00E5FF' : '#666'}]}>{targetColName ? `🏆 ${targetColName}` : '+ 选目标产物'}</Text></TouchableOpacity><TextInput style={[styles.inputDark, {flex: 0.25}]} placeholder="限量" placeholderTextColor="#666" keyboardType="number-pad" value={synMaxCount} onChangeText={setSynMaxCount} /></View>
                    <View style={styles.divider} />
                    {requirements.map((req, index) => (
                      <View key={index} style={styles.reqRow}><TouchableOpacity style={[styles.pickerBtn, {flex: 1, borderColor: '#FF3B30', marginBottom: 0}]} onPress={() => openPicker('synReq', index)}><Text style={[styles.pickerBtnText, {color: req.name ? '#FF3B30' : '#666', fontSize: 12}]} numberOfLines={1}>{req.name ? `🔥 材料 ${index+1}: ${req.name}` : '+ 选献祭材料'}</Text></TouchableOpacity><TextInput style={styles.reqCountInput} placeholder="数量" placeholderTextColor="#666" keyboardType="number-pad" value={req.count} onChangeText={(val) => updateReqCount(index, val)} />{requirements.length > 1 && (<TouchableOpacity style={styles.removeBtn} onPress={() => removeRequirement(index)}><Text style={{color: '#FFF'}}>🗑️</Text></TouchableOpacity>)}</View>
                    ))}
                    <TouchableOpacity style={styles.addReqBtn} onPress={addRequirement}><Text style={{color: '#FFD700', fontWeight: '800'}}>+ 增加材料维度</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.goldBtn, {marginTop: 20}]} onPress={handleCreateSynthesis}><Text style={styles.goldBtnText}>下发变异指令</Text></TouchableOpacity>
                  </View>
                  <Text style={[styles.sectionTitle, {marginTop: 10}]}>📋 合成通道看板</Text>
                  {synthesisList.map(item => (
                      <View key={item.id} style={styles.manageCard}>
                          <View style={{flex: 1}}><Text style={{color: '#FFF', fontWeight: '800'}}>{item.name}</Text><Text style={{color: '#888', fontSize: 12, marginTop: 4}}>目标: {item.collection?.name}</Text><Text style={{color: '#FFD700', fontSize: 12, marginTop: 4}}>限量: {item.max_count === 0 ? '不限' : `${item.current_count}/${item.max_count}`}</Text></View>
                          <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteSynthesis(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity>
                      </View>
                  ))}
                </View>
              )}

              {activeTab === '王国公告' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>📣 颁布王国旨意</Text>
                    <View style={styles.switchRow}><Text style={{color: '#FFF', fontSize: 16, fontWeight: '700'}}>🔥 设为超级精华 (置顶红名)</Text><Switch value={announceFeatured} onValueChange={setAnnounceFeatured} trackColor={{ false: '#333', true: '#FF3B30' }} /></View>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('announce')}>{announceImage ? (<Image source={{uri: announceImage}} style={{width: '100%', height: 100, borderRadius: 8, resizeMode: 'cover'}} />) : (<Text style={styles.pickerBtnText}>🖼️ 从资产库选择配图</Text>)}</TouchableOpacity>
                    <TextInput style={styles.inputDark} placeholder="震撼人心的标题" placeholderTextColor="#666" value={announceTitle} onChangeText={setAnnounceTitle} />
                    <TextInput style={[styles.inputDark, {height: 150, textAlignVertical: 'top'}]} placeholder="输入旨意正文..." placeholderTextColor="#666" multiline value={announceContent} onChangeText={setAnnounceContent} />
                    <TouchableOpacity style={styles.goldBtn} onPress={handlePublishAnnouncement} disabled={publishing}><Text style={styles.goldBtnText}>{publishing ? '传达中...' : '传达至全岛'}</Text></TouchableOpacity>
                  </View>
                  <Text style={[styles.sectionTitle, {marginTop: 10}]}>📋 历史旨意 (含清道夫播报)</Text>
                  {announceList.map(item => (
                      <View key={item.id} style={styles.manageCard}>
                          <View style={{flex: 1}}>
                              <Text style={{color: item.author_name === '土豆清道夫' ? '#FF3B30' : '#FFF', fontWeight: '800'}}>
                                  {item.is_featured ? '🔥 ' : ''}{item.author_name === '土豆清道夫' ? '🚨 清道夫: ' : ''}{item.title}
                              </Text>
                              <Text style={{color: '#888', fontSize: 12, marginTop: 4}} numberOfLines={1}>{item.content}</Text>
                              <Text style={{color: '#FFD700', fontSize: 12, marginTop: 4}}>点赞: {item.likes_count || 0} | {new Date(item.created_at).toLocaleDateString()}</Text>
                          </View>
                          <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteAnnouncement(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity>
                      </View>
                  ))}
                </View>
              )}

              {activeTab === '神之手' && (
                <View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>🖨️ 虚空印钞 (派发给自己)</Text><TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('mint')}><Text style={styles.pickerBtnText}>{mintColName ? `📍 选定: ${mintColName}` : '+ 选择要印制的藏品'}</Text></TouchableOpacity><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="印制数量" placeholderTextColor="#666" keyboardType="number-pad" value={mintAmount} onChangeText={setMintAmount} /><TouchableOpacity style={[styles.goldBtn, {width: 100, marginLeft: 10, marginTop: 0}]} onPress={handleMintCustom}><Text style={styles.goldBtnText}>直接印发</Text></TouchableOpacity></View></View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>💰 篡改个人资金</Text><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="覆盖当前余额" placeholderTextColor="#666" keyboardType="decimal-pad" value={newBalance} onChangeText={setNewBalance} /><TouchableOpacity style={[styles.goldBtn, {width: 80, marginLeft: 10, marginTop: 0}]} onPress={handleTamperBalance}><Text style={styles.goldBtnText}>注入</Text></TouchableOpacity></View></View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>🔥 熔炼奖励配置</Text><Text style={{color: '#888', fontSize: 12, marginBottom: 10}}>当前销毁垃圾图奖励: {currentFurnaceReward} Potato卡</Text><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="修改单张奖励数量" placeholderTextColor="#666" keyboardType="decimal-pad" value={furnaceRewardStr} onChangeText={setFurnaceRewardStr} /><TouchableOpacity style={[styles.goldBtn, {width: 80, marginLeft: 10, marginTop: 0}]} onPress={handleUpdateFurnace}><Text style={styles.goldBtnText}>更新</Text></TouchableOpacity></View></View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>🗂️ 增加藏品系列分类</Text><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="新分类名称" placeholderTextColor="#666" value={newCategoryName} onChangeText={setNewCategoryName} /><TouchableOpacity style={[styles.goldBtn, {width: 80, marginLeft: 10, marginTop: 0}]} onPress={handleCreateCategory}><Text style={styles.goldBtnText}>创建</Text></TouchableOpacity></View></View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ================= 💎 模态框集合 ================= */}

      {/* 修改价格弹窗 */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
          <View style={[styles.timePickerBox, {marginBottom: 100}]}><Text style={styles.modalTitle}>修改最高限价</Text><TextInput style={[styles.inputDark, {fontSize: 24, textAlign: 'center', color: '#00E5FF', fontWeight: '900', borderColor: '#00E5FF'}]} keyboardType="decimal-pad" value={editValue} onChangeText={setEditValue} autoFocus /><View style={{flexDirection: 'row', marginTop: 20}}><TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowPriceModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0}]} onPress={executeUpdatePrice}><Text style={styles.goldBtnText}>确认修改</Text></TouchableOpacity></View></View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 修改分类弹窗 */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.timePickerBox}>
             <Text style={styles.modalTitle}>转移至新分区</Text>
             {adminCategories.map(cat => (
                 <TouchableOpacity key={cat.id} style={[styles.inputDark, {padding: 12, alignItems: 'center'}]} onPress={() => executeChangeCategory(cat.id)}>
                     <Text style={{color: '#FFF', fontWeight: '800'}}>{cat.name}</Text>
                 </TouchableOpacity>
             ))}
             <TouchableOpacity style={[styles.mCancelBtn, {marginTop: 10}]} onPress={() => setShowCategoryModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔥 宏观销毁弹窗 */}
      <Modal visible={showBurnModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
          <View style={[styles.timePickerBox, {marginBottom: 100, borderColor: '#FF3B30', borderWidth: 2}]}>
            <Text style={[styles.modalTitle, {color: '#FF3B30'}]}>🚨 宏观销毁：打入废墟</Text>
            <Text style={{color: '#888', fontSize: 12, marginBottom: 16, lineHeight: 18}}>
               目标：<Text style={{color: '#FFF'}}>{selectedCol?.name}</Text>{'\n'}
               大盘剩余流通：<Text style={{color: '#FFD700'}}>{selectedCol?.circulating_supply}</Text>{'\n'}
               ⚠️ 销毁后，“土豆清道夫”将自动发布全岛公告进行播报！
            </Text>
            <TextInput style={[styles.inputDark, {fontSize: 20, textAlign: 'center', color: '#FF3B30', fontWeight: '900', borderColor: '#FF3B30'}]} placeholder="输入销毁数量" placeholderTextColor="#666" keyboardType="number-pad" value={burnAmount} onChangeText={setBurnAmount} autoFocus />
            <View style={{flexDirection: 'row', marginTop: 10}}>
              <TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowBurnModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0, backgroundColor: '#FF3B30'}]} onPress={executeBurnToRuins} disabled={publishing}><Text style={{color: '#FFF', fontWeight: '900'}}>🔥 确认销毁</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 时间选择器弹窗 */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlayFull}><View style={styles.timePickerBox}><Text style={styles.modalTitle}>设定开售时间</Text><Text style={styles.timeSectionLabel}>日期</Text><View style={styles.timeBtnRow}>{['今天', '明天', '后天'].map((label, i) => (<TouchableOpacity key={label} style={[styles.timeBtn, selectedDateOffset === i && styles.timeBtnActive]} onPress={() => setSelectedDateOffset(i)}><Text style={[styles.timeBtnText, selectedDateOffset === i && styles.timeBtnTextActive]}>{label}</Text></TouchableOpacity>))}</View><Text style={styles.timeSectionLabel}>小时 (24H)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 50}}>{['00','08','10','12','14','18','20','21','22'].map(h => (<TouchableOpacity key={h} style={[styles.timeBtn, selectedHour === h && styles.timeBtnActive]} onPress={() => setSelectedHour(h)}><Text style={[styles.timeBtnText, selectedHour === h && styles.timeBtnTextActive]}>{h}:00</Text></TouchableOpacity>))}</ScrollView><Text style={styles.timeSectionLabel}>分钟</Text><View style={styles.timeBtnRow}>{['00','15','30','45'].map(m => (<TouchableOpacity key={m} style={[styles.timeBtn, selectedMinute === m && styles.timeBtnActive]} onPress={() => setSelectedMinute(m)}><Text style={[styles.timeBtnText, selectedMinute === m && styles.timeBtnTextActive]}>{m}分</Text></TouchableOpacity>))}</View><View style={{flexDirection: 'row', marginTop: 30}}><TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowTimePicker(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0}]} onPress={confirmTimeSelection}><Text style={styles.goldBtnText}>确认时间</Text></TouchableOpacity></View></View></View>
      </Modal>

      {/* 藏品图库选择弹窗 */}
      <Modal visible={showColPicker} transparent animationType="slide">
        <View style={styles.modalOverlayFull}><View style={styles.modalContentFull}><View style={styles.pickerHeader}><Text style={styles.modalTitle}>请选择藏品</Text><TouchableOpacity onPress={() => setShowColPicker(false)}><Text style={{color:'#999', fontSize: 16}}>关闭</Text></TouchableOpacity></View><FlatList data={collections} keyExtractor={item => item.id} numColumns={3} renderItem={({item}) => (<TouchableOpacity style={styles.miniCard} onPress={() => handleSelectFromPicker(item)}><Image source={{uri: item.image_url}} style={styles.miniImg} /><Text style={styles.miniName} numberOfLines={1}>{item.name}</Text></TouchableOpacity>)}/></View></View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' }, 
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50, backgroundColor: '#111' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 20, color: '#FFD700' }, 
  navTitle: { fontSize: 18, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  tabRowOuter: { maxHeight: 50, backgroundColor: '#1C1C1E' },
  tabRow: { flexDirection: 'row', padding: 10, minWidth: '100%', justifyContent: 'flex-start' },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginRight: 8 },
  tabBtnActive: { backgroundColor: '#FFD700' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#111', fontWeight: '900' },
  
  card: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#333', flexDirection: 'row' },
  cardImg: { width: 70, height: 70, borderRadius: 8, marginRight: 12 },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  cardName: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, flex: 1, alignItems: 'center', marginHorizontal: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFD700', marginBottom: 10 },
  inputDark: { backgroundColor: '#111', color: '#FFF', padding: 16, borderRadius: 12, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  goldBtn: { backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  goldBtnText: { color: '#111', fontSize: 16, fontWeight: '900' },
  cheatBox: { backgroundColor: '#1C1C1E', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  pickerBtn: { width: '100%', minHeight: 50, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 16, padding: 8 },
  pickerBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#111', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 10 },
  reqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reqCountInput: { width: 60, backgroundColor: '#111', color: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', textAlign: 'center', marginLeft: 10 },
  removeBtn: { width: 40, height: 40, backgroundColor: '#FF3B30', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  addReqBtn: { width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginTop: 10 },

  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentFull: { backgroundColor: '#1C1C1E', height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#333' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  miniCard: { width: '30%', margin: '1.5%', alignItems: 'center', marginBottom: 16 },
  miniImg: { width: 80, height: 80, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  miniName: { color: '#CCC', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  manageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  delBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginLeft: 10 },

  timePickerBox: { backgroundColor: '#1C1C1E', margin: 20, marginBottom: 40, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  timeSectionLabel: { color: '#888', fontSize: 12, marginTop: 16, marginBottom: 8 },
  timeBtnRow: { flexDirection: 'row', flexWrap: 'wrap' },
  timeBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#111', borderRadius: 8, borderWidth: 1, borderColor: '#333', marginRight: 10, marginBottom: 10 },
  timeBtnActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  timeBtnText: { color: '#FFF', fontSize: 14 },
  timeBtnTextActive: { color: '#000', fontWeight: '800' },
  mCancelBtn: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#555', justifyContent: 'center', alignItems: 'center' }
});