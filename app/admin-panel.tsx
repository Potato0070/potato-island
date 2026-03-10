import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

type AdminTab = '数据罗盘' | '资产调控' | '新增系列' | '快照空投' | '全局参数' | '藏品发新' | '进化配置' | '岛民制裁' | '王国公告' | '神之手';
interface CategoryItem { id: number; name: string; sort_order: number; }

export default function AdminPanelScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('数据罗盘');
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  
  const [collections, setCollections] = useState<any[]>([]);
  const [adminCategories, setAdminCategories] = useState<CategoryItem[]>([]);
  const [launchList, setLaunchList] = useState<any[]>([]);
  const [synthesisList, setSynthesisList] = useState<any[]>([]);
  const [announceList, setAnnounceList] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, transfers: 0, nfts: 0 });

  // 🌟 统一个性化反馈矩阵 (Toast + 二次确认 + 成功反馈)
  const [toastMsg, setToastMsg] = useState('');
  const [successModal, setSuccessModal] = useState<{title: string, msg: string} | null>(null);
  const [confirmAction, setConfirmAction] = useState<{title: string, desc: string, confirmText: string, isDanger: boolean, action: () => Promise<void>} | null>(null);

  // 💎 资产调控专属模态框
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [selectedCol, setSelectedCol] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [burnAmount, setBurnAmount] = useState('');

  // 🌟 分区多选状态数组
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);

  // 🔍 资产调控：搜索与筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');

  // 🌟 全局可视化选择器
  const [showColPicker, setShowColPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'announce' | 'launch' | 'synTarget' | 'synReq' | 'mint' | 'airdropReq' | 'airdropTarget' | 'configSign' | 'configBlackhole' | null>(null);
  const [activeReqIndex, setActiveReqIndex] = useState<number | null>(null);

  // ⏱️ 时间选择器
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateOffset, setSelectedDateOffset] = useState(0); 
  const [selectedHour, setSelectedHour] = useState('20');
  const [selectedMinute, setSelectedMinute] = useState('00');

  // 📜 表单状态们
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceContent, setAnnounceContent] = useState('');
  const [announceImage, setAnnounceImage] = useState('');
  const [announceFeatured, setAnnounceFeatured] = useState(false);

  const [launchColId, setLaunchColId] = useState('');
  const [launchColName, setLaunchColName] = useState('');
  const [launchPrice, setLaunchPrice] = useState('');
  const [launchSupply, setLaunchSupply] = useState('');
  const [launchStartTime, setLaunchStartTime] = useState('');

  const [synName, setSynName] = useState('');
  const [targetColId, setTargetColId] = useState('');
  const [targetColName, setTargetColName] = useState('');
  const [synMaxCount, setSynMaxCount] = useState('100');
  const [requirements, setRequirements] = useState<{id: string, name: string, count: string}[]>([{ id: '', name: '', count: '1' }]);

  const [newBalance, setNewBalance] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [mintColId, setMintColId] = useState('');
  const [mintColName, setMintColName] = useState('');
  const [mintAmount, setMintAmount] = useState('1');

  const [airdropReqs, setAirdropReqs] = useState<{id: string, name: string}[]>([]);
  const [airdropTargetId, setAirdropTargetId] = useState('');
  const [airdropTargetName, setAirdropTargetName] = useState('');

  const [targetUserId, setTargetUserId] = useState('');
  const [targetUserCoin, setTargetUserCoin] = useState('');
  const [targetMailTitle, setTargetMailTitle] = useState('');
  const [targetMailContent, setTargetMailContent] = useState('');

  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [newColName, setNewColName] = useState('');
  const [newColImage, setNewColImage] = useState('');
  const [newColMaxPrice, setNewColMaxPrice] = useState('');
  // 🌟 母版多选分区状态
  const [newColCategoryIds, setNewColCategoryIds] = useState<number[]>([]);

  useFocusEffect(useCallback(() => { initAdmin(); }, []));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const initAdmin = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace('/');
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) { showToast('越权拦截，无权访问！'); return router.back(); }
      setAdminId(user.id);
      await fetchData();
    } catch (err: any) { showToast(`初始化失败: ${err.message}`); } finally { setLoading(false); }
  };

  const fetchData = async () => {
      try {
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

          const { data: cfgData } = await supabase.from('system_config').select('*');
          if (cfgData) {
             const cMap: Record<string, string> = {};
             cfgData.forEach(c => cMap[c.key] = c.value);
             setConfigs(cMap);
          }

          const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          const { count: tCount } = await supabase.from('transfer_logs').select('*', { count: 'exact', head: true });
          const { count: nCount } = await supabase.from('nfts').select('*', { count: 'exact', head: true });
          setStats({ users: uCount || 0, transfers: tCount || 0, nfts: nCount || 0 });
      } catch (e) { console.error("Fetch Data Error: ", e); }
  };

  // 🔍 计算搜索与筛选后的藏品列表
  const filteredCollections = collections.filter(c => {
      const matchName = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      let matchCategory = true;
      if (filterCategory !== 'all') {
          if (c.category_ids && Array.isArray(c.category_ids)) {
              matchCategory = c.category_ids.includes(filterCategory);
          } else {
              matchCategory = c.category_id === filterCategory;
          }
      }
      return matchName && matchCategory;
  });

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
    if (pickerTarget === 'airdropTarget') { setAirdropTargetId(col.id); setAirdropTargetName(col.name); }
    if (pickerTarget === 'configSign') { handleSaveConfig('sign_reward_col_id', col.id); } 
    if (pickerTarget === 'configBlackhole') { handleSaveConfig('blackhole_jackpot_col_id', col.id); } 
    if (pickerTarget === 'airdropReq') { 
        if(!airdropReqs.find(r => r.id === col.id)) setAirdropReqs([...airdropReqs, {id: col.id, name: col.name}]); 
    }
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

  // ================= 🎯 岛民制裁 =================
  const handleGrantUserCoins = () => {
      if (!targetUserId || !targetUserCoin) return showToast('请输入完整信息');
      setConfirmAction({
          title: '💰 资金注入确认',
          desc: `确定要向 UID为\n【${targetUserId}】\n的岛民强行注入 ¥${targetUserCoin} 吗？`,
          confirmText: '确认打款',
          isDanger: false,
          action: async () => {
              const { data: prof, error: fetchErr } = await supabase.from('profiles').select('potato_coin_balance').eq('id', targetUserId).single();
              if (fetchErr) throw new Error('找不到该用户ID');
              const newBal = (prof?.potato_coin_balance || 0) + parseFloat(targetUserCoin);
              await supabase.from('profiles').update({ potato_coin_balance: newBal }).eq('id', targetUserId);
              setTargetUserCoin('');
              setSuccessModal({title: '✅ 下发成功', msg: `已向该用户注入 ¥${targetUserCoin} 土豆币！`});
          }
      });
  };

  const handleSendDirectMail = () => {
      if (!targetUserId || !targetMailTitle || !targetMailContent) return showToast('请输入完整信息');
      setConfirmAction({
          title: '📩 发送专属信件',
          desc: `确定要将信件【${targetMailTitle}】发送给指定用户吗？`,
          confirmText: '投递',
          isDanger: false,
          action: async () => {
              await supabase.from('messages').insert([{ user_id: targetUserId, title: targetMailTitle, content: targetMailContent }]);
              setTargetMailTitle(''); setTargetMailContent('');
              setSuccessModal({title: '📩 投递成功', msg: '定向王国信件已送达对方信箱！'});
          }
      });
  };

  // 🌟 多选交互事件
  const toggleNewColCat = (id: number) => {
     setNewColCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleEditCat = (id: number) => {
     setEditCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  // ================= 🖼️ 创建全新藏品母版 =================
  const handleCreateCollection = () => {
      if (!newColName || !newColImage || newColCategoryIds.length === 0) { return showToast('请填写名称、图片并选择至少一个分区'); }
      setConfirmAction({
          title: '✨ 铸造母版确认',
          desc: `即将把【${newColName}】永久刻入全岛图鉴，不可轻易撤销。`,
          confirmText: '确认铸造',
          isDanger: false,
          action: async () => {
              const { error } = await supabase.from('collections').insert([{ name: newColName, image_url: newColImage, category_ids: newColCategoryIds, max_consign_price: parseFloat(newColMaxPrice) || null, total_minted: 0, circulating_supply: 0, is_tradeable: false }]);
              if (error) throw error;
              setNewColName(''); setNewColImage(''); setNewColMaxPrice(''); setNewColCategoryIds([]); fetchData();
              setSuccessModal({title: '✅ 缔造成功', msg: `全新藏品母版已铸造！请前往发新或印钞。`});
          }
      });
  };

  // ================= ⚙️ 动态全局参数保存 =================
  const handleSaveConfig = async (key: string, val: string) => {
      if(!val) return;
      try {
         const { data: exist } = await supabase.from('system_config').select('id').eq('key', key).single();
         if (exist) { await supabase.from('system_config').update({ value: val }).eq('key', key); } 
         else { await supabase.from('system_config').insert([{ key, value: val }]); }
         showToast('✅ 配置更新成功'); fetchData();
      } catch (e: any) { showToast(`保存失败: ${e.message}`); } 
  };

  // ================= 🎁 全网快照空投 =================
  const executeAirdrop = () => {
      if (airdropReqs.length === 0 || !airdropTargetId) return showToast('请选择快照要求和空投目标');
      setConfirmAction({
          title: '🚨 终极快照空投指令',
          desc: `即将扫描全岛持有者，向下取整并强行空投【${airdropTargetName}】！此动作涉及大规模资产变动，不可逆！`,
          confirmText: '⚡ 确认执行',
          isDanger: true,
          action: async () => {
              const reqIds = airdropReqs.map(r => r.id);
              const { data: userNfts } = await supabase.from('nfts').select('owner_id, collection_id').in('collection_id', reqIds).eq('status', 'idle');
              if (!userNfts || userNfts.length === 0) throw new Error('全网无人持有该组合');

              const userColCounts: Record<string, Record<string, number>> = {};
              userNfts.forEach(nft => {
                 if (!userColCounts[nft.owner_id]) userColCounts[nft.owner_id] = {};
                 userColCounts[nft.owner_id][nft.collection_id] = (userColCounts[nft.owner_id][nft.collection_id] || 0) + 1;
              });

              const { data: rewardCol } = await supabase.from('collections').select('total_minted').eq('id', airdropTargetId).single();
              let currentMinted = rewardCol?.total_minted || 0;
              
              const newNfts: any[] = [];
              const messageInserts: any[] = [];

              Object.keys(userColCounts).forEach(userId => {
                  const counts = userColCounts[userId];
                  let combos = Infinity;
                  for (const reqId of reqIds) {
                      if (!counts[reqId]) { combos = 0; break; }
                      combos = Math.min(combos, counts[reqId]);
                  }
                  if (combos > 0) {
                      for(let i=0; i<combos; i++) {
                          currentMinted++;
                          newNfts.push({ collection_id: airdropTargetId, owner_id: userId, serial_number: currentMinted.toString(), status: 'idle' });
                      }
                      messageInserts.push({ user_id: userId, title: '🎁 史诗级快照空投', content: `基于资产快照，已向您空投了 ${combos} 份【${airdropTargetName}】！` });
                  }
              });

              if (newNfts.length === 0) throw new Error('没有用户满足完整组合');

              await supabase.from('nfts').insert(newNfts);
              await supabase.from('collections').update({ total_minted: currentMinted, circulating_supply: currentMinted }).eq('id', airdropTargetId);
              await supabase.from('messages').insert(messageInserts);

              setAirdropReqs([]); setAirdropTargetId(''); setAirdropTargetName('');
              setSuccessModal({title: '✅ 空投大获成功', msg: `共计向全网投递了 ${newNfts.length} 份藏品及信件！`});
          }
      });
  };

  // ================= 💎 核心资产调控功能 =================
  const toggleTradeable = (item: any) => {
      setConfirmAction({
          title: '⚖️ 流通状态调控',
          desc: `确定要将【${item.name}】的状态修改为 ${item.is_tradeable ? '已冻结(禁止买卖)' : '允许流通'} 吗？`,
          confirmText: '确认更改',
          isDanger: item.is_tradeable, 
          action: async () => {
              const newVal = !item.is_tradeable;
              const { error } = await supabase.from('collections').update({ is_tradeable: newVal }).eq('id', item.id);
              if (error) throw error;
              fetchData();
              showToast('状态已更新');
          }
      });
  };

  const executeUpdatePrice = async () => {
    const price = parseFloat(editValue);
    if (isNaN(price) || price < 0) return showToast('无效价格');
    setPublishing(true);
    try {
        const { error } = await supabase.rpc('update_max_price_and_clean', { p_collection_id: selectedCol.id, p_new_max_price: price });
        if (error) throw error;
        setShowPriceModal(false); fetchData(); showToast('限价及违规盘清理完毕');
    } catch(e:any){ showToast(`操作失败: ${e.message}`); } finally { setPublishing(false); }
  };

  const executeChangeCategory = async () => {
      if (editCategoryIds.length === 0) return showToast('至少保留一个分区！');
      setPublishing(true);
      try{
         const { error } = await supabase.from('collections').update({ category_ids: editCategoryIds }).eq('id', selectedCol.id);
         if (error) throw error;
         setShowCategoryModal(false); fetchData(); showToast('多分区分配成功');
      }catch(e:any){showToast(e.message);}finally{setPublishing(false);}
  };

  const executeBurnToRuins = async () => {
      const amount = parseInt(burnAmount);
      if (isNaN(amount) || amount <= 0) return showToast('请输入有效整数');
      if (amount > selectedCol.circulating_supply) return showToast('销毁数量不能超过大盘流通存量');

      setPublishing(true);
      try {
          const { error: updateErr } = await supabase.from('collections').update({ circulating_supply: selectedCol.circulating_supply - amount }).eq('id', selectedCol.id);
          if (updateErr) throw updateErr;
          await supabase.from('announcements').insert([{ title: '🚨 宏观销毁播报', content: `刚刚清道夫将 ${amount} 份【${selectedCol.name}】打入废墟！`, image_url: selectedCol.image_url, is_featured: false, author_name: '土豆清道夫' }]);
          
          setShowBurnModal(false); setBurnAmount(''); fetchData();
          setSuccessModal({title: '🔥 销毁成功', msg: '物资已打入废墟，全岛播报已发出。'});
      } catch (err: any) { showToast(`失败: ${err.message}`); } finally { setPublishing(false); }
  };

  const handlePublishAnnouncement = () => {
    if (!announceTitle || !announceContent || !announceImage) return showToast('请填写完整');
    setConfirmAction({
        title: '📣 颁布旨意',
        desc: '即将向全岛发送此公告，是否确认？',
        confirmText: '立刻发布',
        isDanger: false,
        action: async () => {
            const { error } = await supabase.from('announcements').insert([{ title: announceTitle, content: announceContent, image_url: announceImage, is_featured: announceFeatured, author_name: '土豆国王' }]);
            if (error) throw error;
            setAnnounceTitle(''); setAnnounceContent(''); setAnnounceImage(''); fetchData(); 
            showToast('✅ 旨意已下达');
        }
    });
  };

  const handleDeleteAnnouncement = (id: string) => {
      setConfirmAction({
          title: '🚨 删除公告',
          desc: '确定要全网删除这条公告/播报吗？操作无法恢复。',
          confirmText: '强制删除',
          isDanger: true,
          action: async () => {
              await supabase.from('announcements').delete().eq('id', id); fetchData(); showToast('删除成功');
          }
      });
  };

  const handleCreateLaunch = () => { 
      if (!launchColId || !launchPrice || !launchSupply || !launchStartTime) return showToast('请填写完整参数');
      setConfirmAction({
          title: '🚀 发售排期',
          desc: `确定要在 ${new Date(launchStartTime).toLocaleString()} 开启【${launchColName}】的首发抢购吗？`,
          confirmText: '锁定排期',
          isDanger: false,
          action: async () => {
              await supabase.from('launch_events').insert([{ collection_id: launchColId, price: parseFloat(launchPrice), total_supply: parseInt(launchSupply), remaining_supply: parseInt(launchSupply), start_time: launchStartTime }]);
              setLaunchColId(''); setLaunchColName(''); fetchData(); 
              setSuccessModal({title: '✅ 部署成功', msg: '首发大厅排期已锁定，静候疯抢！'});
          }
      });
  };

  const handleDeleteLaunch = (id: string) => { 
      setConfirmAction({ title: '🚨 撤销发售', desc: '强行终止发售事件？', confirmText: '终止', isDanger: true, action: async () => { await supabase.from('launch_events').delete().eq('id', id); fetchData(); }});
  };
  
  const handleCreateSynthesis = () => { 
      if (!synName || !targetColId) return showToast('请填写完整配方');
      setConfirmAction({
          title: '🧬 变异指令',
          desc: '确定下发此变异合成配方吗？',
          confirmText: '下发',
          isDanger: false,
          action: async () => {
              const { data: evData } = await supabase.from('synthesis_events').insert([{ name: synName, target_collection_id: targetColId, end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), max_count: parseInt(synMaxCount) || 0 }]).select('id').single();
              const reqInserts = requirements.map(r => ({ event_id: evData!.id, req_collection_id: r.id, req_count: parseInt(r.count) }));
              await supabase.from('synthesis_requirements').insert(reqInserts);
              fetchData(); setSynName(''); setRequirements([{ id: '', name: '', count: '1' }]);
              setSuccessModal({title: '✅ 配方已生效', msg: '变异合成通道已开启。'});
          }
      });
  };

  const handleDeleteSynthesis = (id: string) => { 
      setConfirmAction({ title: '🚨 关闭合成通道', desc: '强行关闭该配方？', confirmText: '关闭', isDanger: true, action: async () => { await supabase.from('synthesis_events').delete().eq('id', id); fetchData(); }});
  };
  
  const addRequirement = () => setRequirements([...requirements, { id: '', name: '', count: '1' }]);
  const removeRequirement = (index: number) => setRequirements(requirements.filter((_, i) => i !== index));
  const updateReqCount = (index: number, val: string) => { const newReqs = [...requirements]; newReqs[index].count = val; setRequirements(newReqs); };

  const handleTamperBalance = () => {
      if(!newBalance) return showToast('请输入余额');
      setConfirmAction({ title: '💰 资金篡改', desc: '即将强行覆写您的个人土豆币余额，是否继续？', confirmText: '注入', isDanger: true, action: async () => {
          await supabase.from('profiles').update({ potato_coin_balance: parseFloat(newBalance) }).eq('id', adminId);
          setNewBalance(''); setSuccessModal({title:'成功', msg:'您的私人小金库已塞满！'});
      }});
  };

  const handleCreateCategory = () => {
      if(!newCategoryName) return showToast('请输入分类名');
      setConfirmAction({ title: '🗂️ 新增分区', desc: `新增【${newCategoryName}】？`, confirmText: '创建', isDanger: false, action: async () => {
          await supabase.from('categories').insert([{ name: newCategoryName, sort_order: 99 }]);
          setNewCategoryName(''); fetchData(); showToast('新分类已创建');
      }});
  };

  const handleMintCustom = () => {
      if(!mintColId || !mintAmount) return showToast('请选择藏品并输入数量');
      setConfirmAction({ title: '🖨️ 虚空印钞', desc: `将向您的私人金库印发 ${mintAmount} 张【${mintColName}】，并增加全岛流通存量，是否执行？`, confirmText: '开机印钞', isDanger: false, action: async () => {
          const { data: col } = await supabase.from('collections').select('total_minted').eq('id', mintColId).single();
          const startNum = (col?.total_minted || 0) + 1;
          const inserts = Array.from({length: parseInt(mintAmount)}).map((_, i) => ({ collection_id: mintColId, owner_id: adminId, serial_number: (startNum + i).toString(), status: 'idle' }));
          await supabase.from('nfts').insert(inserts);
          await supabase.from('collections').update({ total_minted: startNum + parseInt(mintAmount) - 1, circulating_supply: startNum + parseInt(mintAmount) - 1 }).eq('id', mintColId);
          setMintColId(''); setMintColName(''); setMintAmount('1'); fetchData();
          setSuccessModal({title: '🖨️ 印钞完成', msg: '印钞机冷却完毕，资产已进私人金库。'});
      }});
  };

  const executeUnifiedAction = async () => {
      if (!confirmAction) return;
      setPublishing(true);
      try {
          await confirmAction.action();
      } catch (e:any) {
          showToast(`操作异常: ${e.message}`);
      } finally {
          setPublishing(false);
          setConfirmAction(null);
      }
  };

  const renderAssetCard = ({ item }: { item: any }) => {
    const catNames = adminCategories
      .filter(c => item.category_ids?.includes(c.id) || item.category_id === c.id)
      .map(c => c.name)
      .join(', ') || '未分类';

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.image_url || `https://via.placeholder.com/150` }} style={styles.cardImg} />
        <View style={styles.cardInfo}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
             <Text style={styles.cardName}>{item.name}</Text>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={{color: '#888', fontSize: 10, marginRight: 4}}>{item.is_tradeable ? '流通中' : '已冻结'}</Text>
                <Switch value={!!item.is_tradeable} onValueChange={() => toggleTradeable(item)} trackColor={{ false: '#333', true: '#FFD700' }} thumbColor="#FFF" style={{transform: [{scale: 0.8}]}} />
             </View>
          </View>
          <Text style={{color: '#888', fontSize: 11, marginTop: 4}}>大盘存量: {item.circulating_supply} | 标签: {catNames}</Text>
          <View style={{flexDirection: 'row', marginTop: 12, justifyContent: 'space-between'}}>
             <TouchableOpacity style={[styles.miniBtn, {backgroundColor: '#2C2C2E', borderColor: '#555'}]} onPress={() => { 
                 setSelectedCol(item); 
                 setEditCategoryIds(item.category_ids || (item.category_id ? [item.category_id] : []));
                 setShowCategoryModal(true); 
             }}>
                <Text style={{color: '#CCC', fontSize: 11, fontWeight: '700'}}>🗂️ 标签</Text>
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

      {toastMsg ? <View style={styles.toastBox}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRowOuter} contentContainerStyle={styles.tabRow}>
        {(['数据罗盘', '资产调控', '岛民制裁', '快照空投', '全局参数', '新增系列', '藏品发新', '进化配置', '王国公告', '神之手'] as AdminTab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 50}} /> : (
        <View style={{flex: 1}}>
          
          {activeTab === '数据罗盘' && (
             <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16}}>
                <Text style={styles.sectionTitle}>🌐 全岛宏观数据</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10}}>
                   <View style={styles.statCard}><Text style={styles.statLabel}>总注册岛民</Text><Text style={styles.statNumber}>{stats.users}</Text></View>
                   <View style={styles.statCard}><Text style={styles.statLabel}>总交易/流转笔数</Text><Text style={styles.statNumber}>{stats.transfers}</Text></View>
                   <View style={[styles.statCard, {width: '100%', marginTop: 16, backgroundColor: '#FFD700'}]}><Text style={[styles.statLabel, {color: '#111'}]}>全岛已铸造藏品总数</Text><Text style={[styles.statNumber, {color: '#111', fontSize: 32}]}>{stats.nfts}</Text></View>
                </View>
             </ScrollView>
          )}

          {activeTab === '资产调控' && (
            <View style={{flex: 1}}>
               {/* 🔍 搜索与筛选工具栏 */}
               <View style={styles.filterToolbar}>
                  <TextInput
                     style={styles.searchInput}
                     placeholder="🔍 搜索藏品名称..."
                     placeholderTextColor="#666"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterCatScroll}>
                     <TouchableOpacity 
                        style={[styles.filterCatChip, filterCategory === 'all' && styles.filterCatChipActive]}
                        onPress={() => setFilterCategory('all')}
                     >
                        <Text style={[styles.filterCatChipText, filterCategory === 'all' && styles.filterCatChipTextActive]}>全部</Text>
                     </TouchableOpacity>
                     {adminCategories.map(cat => (
                        <TouchableOpacity 
                           key={cat.id}
                           style={[styles.filterCatChip, filterCategory === cat.id && styles.filterCatChipActive]}
                           onPress={() => setFilterCategory(cat.id)}
                        >
                           <Text style={[styles.filterCatChipText, filterCategory === cat.id && styles.filterCatChipTextActive]}>{cat.name}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
               </View>

               <FlatList 
                  data={filteredCollections} 
                  renderItem={renderAssetCard} 
                  keyExtractor={item => item.id} 
                  contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
                  style={{flex: 1}} 
                  ListEmptyComponent={<Text style={{color: '#888', textAlign: 'center', marginTop: 50}}>没有找到符合条件的藏品</Text>} 
               />
            </View>
          )}

          {activeTab !== '资产调控' && activeTab !== '数据罗盘' && (
            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 100}}>
              
              {activeTab === '岛民制裁' && (
                 <View>
                    <View style={styles.cheatBox}>
                       <Text style={styles.sectionTitle}>💰 定向空投土豆币 (补偿/发薪)</Text>
                       <TextInput style={styles.inputDark} placeholder="目标用户的 UID" placeholderTextColor="#666" value={targetUserId} onChangeText={setTargetUserId} />
                       <View style={{flexDirection: 'row'}}>
                          <TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="下发金额 ¥" placeholderTextColor="#666" keyboardType="decimal-pad" value={targetUserCoin} onChangeText={setTargetUserCoin} />
                          <TouchableOpacity style={[styles.goldBtnSmall, {marginLeft: 10}]} onPress={handleGrantUserCoins} disabled={publishing}><Text style={{fontWeight:'900'}}>打款</Text></TouchableOpacity>
                       </View>
                    </View>

                    <View style={styles.cheatBox}>
                       <Text style={styles.sectionTitle}>📩 发送专属王国信件</Text>
                       <TextInput style={styles.inputDark} placeholder="目标用户的 UID" placeholderTextColor="#666" value={targetUserId} onChangeText={setTargetUserId} />
                       <TextInput style={styles.inputDark} placeholder="信件标题 (如: 违规警告 / 补偿通知)" placeholderTextColor="#666" value={targetMailTitle} onChangeText={setTargetMailTitle} />
                       <TextInput style={[styles.inputDark, {height: 100, textAlignVertical: 'top'}]} placeholder="信件正文内容..." placeholderTextColor="#666" multiline value={targetMailContent} onChangeText={setTargetMailContent} />
                       <TouchableOpacity style={styles.goldBtn} onPress={handleSendDirectMail} disabled={publishing}><Text style={styles.goldBtnText}>强行塞入信箱</Text></TouchableOpacity>
                    </View>
                 </View>
              )}

              {activeTab === '全局参数' && (
                <View>
                   <View style={styles.cheatBox}>
                      <Text style={styles.sectionTitle}>🕳️ 黑洞坍缩概率与奖池</Text>
                      <Text style={{color:'#888', fontSize: 12, marginBottom:10}}>配置玩家向黑洞献祭时，触发奇迹的概率与大奖藏品。</Text>
                      <View style={styles.reqRow}>
                         <Text style={{color:'#FFF', flex:1}}>奇迹触发概率 (0~1)</Text>
                         <TextInput style={[styles.reqCountInput, {width: 80}]} placeholder="0.01" placeholderTextColor="#666" value={configs['blackhole_success_rate']||''} onChangeText={(v)=>setConfigs({...configs, blackhole_success_rate: v})} />
                         <TouchableOpacity style={styles.goldBtnSmall} onPress={()=>handleSaveConfig('blackhole_success_rate', configs['blackhole_success_rate'])}><Text style={{fontWeight:'900'}}>保存</Text></TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[styles.pickerBtn, {marginTop: 10, borderColor: '#9932CC'}]} onPress={() => openPicker('configBlackhole')}>
                         <Text style={[styles.pickerBtnText, {color: configs['blackhole_jackpot_col_id'] ? '#9932CC' : '#666'}]}>{configs['blackhole_jackpot_col_id'] ? `🌌 黑洞大奖已绑: ${configs['blackhole_jackpot_col_id'].substring(0,8)}...` : '+ 绑定黑洞大奖藏品'}</Text>
                      </TouchableOpacity>
                   </View>

                   <View style={styles.cheatBox}>
                      <Text style={styles.sectionTitle}>📅 签到奖励配置</Text>
                      <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('configSign')}>
                         <Text style={styles.pickerBtnText}>{configs['sign_reward_col_id'] ? `✅ 已配置藏品ID: ${configs['sign_reward_col_id'].substring(0,8)}...` : '+ 选择签到奖励藏品'}</Text>
                      </TouchableOpacity>
                   </View>

                   <View style={styles.cheatBox}>
                      <Text style={styles.sectionTitle}>🔄 特权兑换消耗</Text>
                      <View style={styles.reqRow}><Text style={{color:'#FFF', flex:1}}>转赠卡需要 Potato</Text><TextInput style={styles.reqCountInput} value={configs['exchange_transfer_cost']||''} onChangeText={(v)=>setConfigs({...configs, exchange_transfer_cost: v})} /><TouchableOpacity style={styles.goldBtnSmall} onPress={()=>handleSaveConfig('exchange_transfer_cost', configs['exchange_transfer_cost'])}><Text style={{fontWeight:'900'}}>存</Text></TouchableOpacity></View>
                      <View style={styles.reqRow}><Text style={{color:'#FFF', flex:1}}>万能卡需要 Potato</Text><TextInput style={styles.reqCountInput} value={configs['exchange_universal_cost']||''} onChangeText={(v)=>setConfigs({...configs, exchange_universal_cost: v})} /><TouchableOpacity style={styles.goldBtnSmall} onPress={()=>handleSaveConfig('exchange_universal_cost', configs['exchange_universal_cost'])}><Text style={{fontWeight:'900'}}>存</Text></TouchableOpacity></View>
                   </View>

                   <View style={styles.cheatBox}>
                      <Text style={styles.sectionTitle}>👑 VIP 升级消耗 (万能卡)</Text>
                      {[2,3,4,5].map(level => (
                          <View key={level} style={styles.reqRow}><Text style={{color:'#FFF', flex:1}}>升至 VIP {level}</Text><TextInput style={styles.reqCountInput} value={configs[`vip${level}_cost`]||''} onChangeText={(v)=>setConfigs({...configs, [`vip${level}_cost`]: v})} /><TouchableOpacity style={styles.goldBtnSmall} onPress={()=>handleSaveConfig(`vip${level}_cost`, configs[`vip${level}_cost`])}><Text style={{fontWeight:'900'}}>存</Text></TouchableOpacity></View>
                      ))}
                   </View>
                </View>
              )}

              {/* 🌟 新增系列 (带多选标签功能) */}
              {activeTab === '新增系列' && (
                 <View>
                    <View style={styles.cheatBox}>
                       <Text style={styles.sectionTitle}>🖼️ 铸造全新藏品母版</Text>
                       <TextInput style={styles.inputDark} placeholder="藏品名称 (例: 皇家土豆骑士)" placeholderTextColor="#666" value={newColName} onChangeText={setNewColName} />
                       <Text style={{color:'#FFF', fontWeight:'800', marginBottom:8}}>图片链接 (网络URL)</Text>
                       <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
                          {newColImage ? (<Image source={{uri: newColImage}} style={{width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#333'}} />) : (<View style={{width: 50, height: 50, borderRadius: 8, backgroundColor: '#333', marginRight: 12, justifyContent: 'center', alignItems: 'center'}}><Text style={{color: '#666'}}>图</Text></View>)}
                          <TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="https://..." placeholderTextColor="#666" value={newColImage} onChangeText={setNewColImage} />
                       </View>

                       <Text style={{color:'#FFF', fontWeight:'800', marginBottom:8}}>为藏品打上多个分区标签</Text>
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                          {adminCategories.map(cat => {
                             const isActive = newColCategoryIds.includes(cat.id);
                             return (
                                <TouchableOpacity key={cat.id} style={[styles.catChip, isActive && styles.catChipActive]} onPress={() => toggleNewColCat(cat.id)}>
                                   <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>{cat.name}</Text>
                                </TouchableOpacity>
                             )
                          })}
                       </ScrollView>

                       <TextInput style={styles.inputDark} placeholder="设置最高限价 (可空)" placeholderTextColor="#666" keyboardType="decimal-pad" value={newColMaxPrice} onChangeText={setNewColMaxPrice} />
                       <TouchableOpacity style={[styles.goldBtn, {marginTop: 10}]} onPress={handleCreateCollection} disabled={publishing}><Text style={styles.goldBtnText}>✨ 确认铸造图鉴</Text></TouchableOpacity>
                    </View>
                 </View>
              )}

              {activeTab === '快照空投' && (
                <View>
                   <View style={styles.cheatBox}>
                      <Text style={styles.sectionTitle}>🎁 全服快照与精准空投</Text>
                      <Text style={{color:'#FFF', fontWeight:'800', marginBottom:10}}>1. 设定快照条件组合</Text>
                      {airdropReqs.map((req, i) => (<View key={i} style={[styles.reqRow, {backgroundColor:'#222', padding:10, borderRadius:8}]}><Text style={{color:'#00E5FF', flex:1, fontWeight:'800'}}>👉 {req.name}</Text><TouchableOpacity onPress={() => setAirdropReqs(airdropReqs.filter((_, idx)=>idx!==i))}><Text style={{color:'#FF3B30'}}>移除</Text></TouchableOpacity></View>))}
                      <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('airdropReq')}><Text style={styles.pickerBtnText}>+ 添加要求持有的藏品</Text></TouchableOpacity>
                      <Text style={{color:'#FFF', fontWeight:'800', marginBottom:10, marginTop:10}}>2. 设定空投奖励目标</Text>
                      <TouchableOpacity style={[styles.pickerBtn, {borderColor:'#FFD700'}]} onPress={() => openPicker('airdropTarget')}><Text style={[styles.pickerBtnText, {color: airdropTargetName ? '#FFD700' : '#888'}]}>{airdropTargetName ? `🎁 空投物: ${airdropTargetName}` : '+ 选择要派发的空投藏品'}</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.goldBtn, {marginTop: 20}]} onPress={executeAirdrop} disabled={publishing}><Text style={styles.goldBtnText}>⚡ 立即执行全岛空投</Text></TouchableOpacity>
                   </View>
                </View>
              )}

              {activeTab === '藏品发新' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>🚀 部署创世发新</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('launch')}><Text style={styles.pickerBtnText}>{launchColName ? `📍 已选发售物: ${launchColName}` : '+ 从图库选择发售藏品'}</Text></TouchableOpacity>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><TextInput style={[styles.inputDark, {flex: 0.48}]} placeholder="首发价 ¥" placeholderTextColor="#666" keyboardType="decimal-pad" value={launchPrice} onChangeText={setLaunchPrice} /><TextInput style={[styles.inputDark, {flex: 0.48}]} placeholder="释放数量" placeholderTextColor="#666" keyboardType="number-pad" value={launchSupply} onChangeText={setLaunchSupply} /></View>
                    <TouchableOpacity style={[styles.pickerBtn, {borderColor: '#00E5FF', minHeight: 50}]} onPress={() => setShowTimePicker(true)}><Text style={[styles.pickerBtnText, {color: launchStartTime ? '#00E5FF' : '#666'}]}>{launchStartTime ? `⏰ 开售: ${new Date(launchStartTime).toLocaleString()}` : '⏱️ 点击设定开售时间'}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.goldBtn} onPress={handleCreateLaunch} disabled={publishing}><Text style={styles.goldBtnText}>⚡ 锁定发售排期</Text></TouchableOpacity>
                  </View>
                  {launchList.map(item => (<View key={item.id} style={styles.manageCard}><View style={{flex: 1}}><Text style={{color: '#FFF', fontWeight: '800'}}>{item.collection?.name}</Text><Text style={{color: '#888', fontSize: 12}}>剩余: {item.remaining_supply}/{item.total_supply}</Text></View><TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteLaunch(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity></View>))}
                </View>
              )}

              {activeTab === '进化配置' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>🧬 部署变异配方</Text>
                    <TextInput style={styles.inputDark} placeholder="活动名称" placeholderTextColor="#666" value={synName} onChangeText={setSynName} />
                    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><TouchableOpacity style={[styles.pickerBtn, {flex: 0.7, borderColor: '#00E5FF'}]} onPress={() => openPicker('synTarget')}><Text style={[styles.pickerBtnText, {color: targetColName ? '#00E5FF' : '#666'}]}>{targetColName ? `🏆 ${targetColName}` : '+ 选目标产物'}</Text></TouchableOpacity><TextInput style={[styles.inputDark, {flex: 0.25}]} placeholder="限量" placeholderTextColor="#666" keyboardType="number-pad" value={synMaxCount} onChangeText={setSynMaxCount} /></View>
                    {requirements.map((req, index) => (<View key={index} style={styles.reqRow}><TouchableOpacity style={[styles.pickerBtn, {flex: 1, borderColor: '#FF3B30', marginBottom: 0}]} onPress={() => openPicker('synReq', index)}><Text style={[styles.pickerBtnText, {color: req.name ? '#FF3B30' : '#666', fontSize: 12}]} numberOfLines={1}>{req.name ? `🔥 材料 ${index+1}: ${req.name}` : '+ 选材料'}</Text></TouchableOpacity><TextInput style={styles.reqCountInput} placeholder="数量" keyboardType="number-pad" value={req.count} onChangeText={(val) => updateReqCount(index, val)} />{requirements.length > 1 && (<TouchableOpacity style={styles.removeBtn} onPress={() => removeRequirement(index)}><Text style={{color: '#FFF'}}>🗑️</Text></TouchableOpacity>)}</View>))}
                    <TouchableOpacity style={styles.addReqBtn} onPress={addRequirement}><Text style={{color: '#FFD700', fontWeight: '800'}}>+ 增加材料维度</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.goldBtn, {marginTop: 20}]} onPress={handleCreateSynthesis}><Text style={styles.goldBtnText}>下发配方</Text></TouchableOpacity>
                  </View>
                  {synthesisList.map(item => (<View key={item.id} style={styles.manageCard}><View style={{flex: 1}}><Text style={{color: '#FFF', fontWeight: '800'}}>{item.name}</Text><Text style={{color: '#888', fontSize: 12}}>目标: {item.collection?.name}</Text></View><TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteSynthesis(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity></View>))}
                </View>
              )}

              {activeTab === '王国公告' && (
                <View>
                  <View style={styles.cheatBox}>
                    <Text style={styles.sectionTitle}>📣 颁布王国旨意</Text>
                    <View style={styles.switchRow}><Text style={{color: '#FFF', fontSize: 16, fontWeight: '700'}}>🔥 设为精华置顶</Text><Switch value={announceFeatured} onValueChange={setAnnounceFeatured} trackColor={{ false: '#333', true: '#FF3B30' }} /></View>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('announce')}>{announceImage ? (<Image source={{uri: announceImage}} style={{width: '100%', height: 100, borderRadius: 8, resizeMode: 'cover'}} />) : (<Text style={styles.pickerBtnText}>🖼️ 从资产库选择配图</Text>)}</TouchableOpacity>
                    <TextInput style={styles.inputDark} placeholder="震撼人心的标题" placeholderTextColor="#666" value={announceTitle} onChangeText={setAnnounceTitle} />
                    <TextInput style={[styles.inputDark, {height: 150, textAlignVertical: 'top'}]} placeholder="输入旨意正文..." placeholderTextColor="#666" multiline value={announceContent} onChangeText={setAnnounceContent} />
                    <TouchableOpacity style={styles.goldBtn} onPress={handlePublishAnnouncement} disabled={publishing}><Text style={styles.goldBtnText}>传达至全岛</Text></TouchableOpacity>
                  </View>
                  {announceList.map(item => (<View key={item.id} style={styles.manageCard}><View style={{flex: 1}}><Text style={{color: item.author_name === '土豆清道夫' ? '#FF3B30' : '#FFF', fontWeight: '800'}}>{item.title}</Text></View><TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteAnnouncement(item.id)}><Text style={{color:'#FFF'}}>🗑️</Text></TouchableOpacity></View>))}
                </View>
              )}

              {activeTab === '神之手' && (
                <View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>🖨️ 虚空印钞 (派发给自己)</Text><TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('mint')}><Text style={styles.pickerBtnText}>{mintColName ? `📍 选定: ${mintColName}` : '+ 选择要印制的藏品'}</Text></TouchableOpacity><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="数量" placeholderTextColor="#666" keyboardType="number-pad" value={mintAmount} onChangeText={setMintAmount} /><TouchableOpacity style={[styles.goldBtn, {width: 100, marginLeft: 10, marginTop: 0}]} onPress={handleMintCustom}><Text style={styles.goldBtnText}>印发</Text></TouchableOpacity></View></View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>💰 篡改个人资金</Text><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="覆盖当前余额" placeholderTextColor="#666" keyboardType="decimal-pad" value={newBalance} onChangeText={setNewBalance} /><TouchableOpacity style={[styles.goldBtn, {width: 80, marginLeft: 10, marginTop: 0}]} onPress={handleTamperBalance}><Text style={styles.goldBtnText}>注入</Text></TouchableOpacity></View></View>
                  <View style={styles.cheatBox}><Text style={styles.sectionTitle}>🗂️ 增加大盘分区分类</Text><View style={{flexDirection: 'row', marginTop: 10}}><TextInput style={[styles.inputDark, {flex: 1, marginBottom: 0}]} placeholder="新分类名称" placeholderTextColor="#666" value={newCategoryName} onChangeText={setNewCategoryName} /><TouchableOpacity style={[styles.goldBtn, {width: 80, marginLeft: 10, marginTop: 0}]} onPress={handleCreateCategory}><Text style={styles.goldBtnText}>创建</Text></TouchableOpacity></View></View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ================= 💎 专属业务模态框 ================= */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
          <View style={[styles.timePickerBox, {marginBottom: 100}]}><Text style={styles.modalTitle}>修改最高限价</Text><TextInput style={[styles.inputDark, {fontSize: 24, textAlign: 'center', color: '#00E5FF', fontWeight: '900', borderColor: '#00E5FF'}]} keyboardType="decimal-pad" value={editValue} onChangeText={setEditValue} autoFocus /><View style={{flexDirection: 'row', marginTop: 20}}><TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowPriceModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0}]} onPress={executeUpdatePrice} disabled={publishing}><Text style={styles.goldBtnText}>确认修改</Text></TouchableOpacity></View></View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🌟 改造后的多选标签模态框 */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.modalOverlayFull}>
          <View style={styles.timePickerBox}>
             <Text style={styles.modalTitle}>修改大盘分区 (可多选)</Text>
             <ScrollView style={{maxHeight: 300, marginBottom: 10}}>
                {adminCategories.map(cat => {
                    const isActive = editCategoryIds.includes(cat.id);
                    return (
                        <TouchableOpacity key={cat.id} style={[styles.inputDark, {padding: 12, alignItems: 'center', marginBottom: 8, borderColor: isActive ? '#00E5FF' : '#333', borderWidth: isActive ? 2 : 1}]} onPress={() => toggleEditCat(cat.id)} disabled={publishing}>
                            <Text style={{color: isActive ? '#00E5FF' : '#FFF', fontWeight: '800'}}>{cat.name}</Text>
                        </TouchableOpacity>
                    )
                })}
             </ScrollView>
             <View style={{flexDirection: 'row'}}>
                <TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowCategoryModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0, backgroundColor: '#00E5FF'}]} onPress={executeChangeCategory} disabled={publishing}><Text style={{color: '#111', fontWeight: '900'}}>确认打标</Text></TouchableOpacity>
             </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBurnModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayFull}>
          <View style={[styles.timePickerBox, {marginBottom: 100, borderColor: '#FF3B30', borderWidth: 2}]}>
            <Text style={[styles.modalTitle, {color: '#FF3B30'}]}>🚨 宏观销毁：打入废墟</Text>
            <TextInput style={[styles.inputDark, {fontSize: 20, textAlign: 'center', color: '#FF3B30', fontWeight: '900', borderColor: '#FF3B30'}]} placeholder="输入销毁数量" placeholderTextColor="#666" keyboardType="number-pad" value={burnAmount} onChangeText={setBurnAmount} autoFocus />
            <View style={{flexDirection: 'row', marginTop: 10}}>
              <TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowBurnModal(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0, backgroundColor: '#FF3B30'}]} onPress={executeBurnToRuins} disabled={publishing}><Text style={{color: '#FFF', fontWeight: '900'}}>🔥 确认销毁</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade"><View style={styles.modalOverlayFull}><View style={styles.timePickerBox}><Text style={styles.modalTitle}>设定时间</Text><Text style={styles.timeSectionLabel}>日期</Text><View style={styles.timeBtnRow}>{['今天', '明天', '后天'].map((label, i) => (<TouchableOpacity key={label} style={[styles.timeBtn, selectedDateOffset === i && styles.timeBtnActive]} onPress={() => setSelectedDateOffset(i)}><Text style={[styles.timeBtnText, selectedDateOffset === i && styles.timeBtnTextActive]}>{label}</Text></TouchableOpacity>))}</View><Text style={styles.timeSectionLabel}>小时</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{maxHeight: 50}}>{['00','08','10','12','14','18','20','21','22'].map(h => (<TouchableOpacity key={h} style={[styles.timeBtn, selectedHour === h && styles.timeBtnActive]} onPress={() => setSelectedHour(h)}><Text style={[styles.timeBtnText, selectedHour === h && styles.timeBtnTextActive]}>{h}:00</Text></TouchableOpacity>))}</ScrollView><Text style={styles.timeSectionLabel}>分钟</Text><View style={styles.timeBtnRow}>{['00','15','30','45'].map(m => (<TouchableOpacity key={m} style={[styles.timeBtn, selectedMinute === m && styles.timeBtnActive]} onPress={() => setSelectedMinute(m)}><Text style={[styles.timeBtnText, selectedMinute === m && styles.timeBtnTextActive]}>{m}分</Text></TouchableOpacity>))}</View><View style={{flexDirection: 'row', marginTop: 30}}><TouchableOpacity style={[styles.mCancelBtn, {flex: 1, marginRight: 10}]} onPress={() => setShowTimePicker(false)}><Text style={{color: '#CCC'}}>取消</Text></TouchableOpacity><TouchableOpacity style={[styles.goldBtn, {flex: 1, marginTop: 0}]} onPress={confirmTimeSelection}><Text style={styles.goldBtnText}>确认</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showColPicker} transparent animationType="slide"><View style={styles.modalOverlayFull}><View style={styles.modalContentFull}><View style={styles.pickerHeader}><Text style={styles.modalTitle}>选择藏品</Text><TouchableOpacity onPress={() => setShowColPicker(false)}><Text style={{color:'#999', fontSize: 16}}>关闭</Text></TouchableOpacity></View><FlatList data={collections} keyExtractor={item => item.id} numColumns={3} renderItem={({item}) => (<TouchableOpacity style={styles.miniCard} onPress={() => handleSelectFromPicker(item)}><Image source={{uri: item.image_url}} style={styles.miniImg} /><Text style={styles.miniName} numberOfLines={1}>{item.name}</Text></TouchableOpacity>)}/></View></View></Modal>

      {/* ================= 🛡️ 终极防误触【二次确认】模态框 ================= */}
      <Modal visible={!!confirmAction} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={styles.confirmBox}>
               <Text style={[styles.confirmTitle, confirmAction?.isDanger && {color: '#FF3B30'}]}>{confirmAction?.title}</Text>
               <Text style={styles.confirmDesc}>{confirmAction?.desc}</Text>
               <View style={styles.confirmBtnRow}>
                  <TouchableOpacity style={styles.cancelBtnOutline} onPress={() => setConfirmAction(null)}><Text style={styles.cancelBtnOutlineText}>取消</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, confirmAction?.isDanger ? {backgroundColor: '#FF3B30'} : {backgroundColor: '#0066FF'}]} onPress={executeUnifiedAction} disabled={publishing}>
                     {publishing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>{confirmAction?.confirmText}</Text>}
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* ================= 🎉 极客【成功反馈】模态框 ================= */}
      <Modal visible={!!successModal} transparent animationType="fade">
         <View style={styles.modalOverlayCenter}>
            <View style={[styles.confirmBox, {borderColor: '#FFD700', borderWidth: 2}]}>
               <Text style={[styles.confirmTitle, {color: '#FFD700', fontSize: 22}]}>{successModal?.title}</Text>
               <Text style={[styles.confirmDesc, {fontSize: 15, color: '#CCC', fontWeight: '800', lineHeight: 22}]}>{successModal?.msg}</Text>
               <TouchableOpacity style={[styles.confirmBtn, {width: '100%', backgroundColor: '#FFD700'}]} onPress={() => setSuccessModal(null)}>
                  <Text style={[styles.confirmBtnText, {color: '#111'}]}>朕知道了</Text>
               </TouchableOpacity>
            </View>
         </View>
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
  
  // 🔍 新增：过滤与搜索工具栏样式
  filterToolbar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#111' },
  searchInput: { backgroundColor: '#1C1C1E', color: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#333', marginBottom: 12 },
  filterCatScroll: { maxHeight: 40 },
  filterCatChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#222', marginRight: 10, borderWidth: 1, borderColor: '#333', justifyContent: 'center' },
  filterCatChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterCatChipText: { color: '#888', fontSize: 12, fontWeight: '800' },
  filterCatChipTextActive: { color: '#111', fontWeight: '900' },

  toastBox: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(255,215,0,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, zIndex: 100, shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 10 },
  toastText: { color: '#111', fontSize: 14, fontWeight: '900' },

  statCard: { width: '48%', backgroundColor: '#1C1C1E', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  statLabel: { color: '#888', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  statNumber: { color: '#FFF', fontSize: 24, fontWeight: '900', fontFamily: 'monospace' },

  card: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#333', flexDirection: 'row' },
  cardImg: { width: 70, height: 70, borderRadius: 8, marginRight: 12 },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  cardName: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, flex: 1, alignItems: 'center', marginHorizontal: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#FFD700', marginBottom: 10 },
  inputDark: { backgroundColor: '#111', color: '#FFF', padding: 16, borderRadius: 12, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  goldBtn: { backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  goldBtnSmall: { backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, justifyContent:'center', marginLeft:10 },
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

  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#333', marginRight: 10, marginBottom: 10 },
  catChipActive: { backgroundColor: '#00E5FF' },
  catChipText: { color: '#888', fontWeight: '800' },
  catChipTextActive: { color: '#111', fontWeight: '900' },

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
  mCancelBtn: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  confirmBox: { width: '85%', backgroundColor: '#1C1C1E', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 16 },
  confirmDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtnOutline: { flex: 0.48, paddingVertical: 14, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  cancelBtnOutlineText: { color: '#888', fontSize: 15, fontWeight: '800' },
  confirmBtn: { flex: 0.48, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' }
});