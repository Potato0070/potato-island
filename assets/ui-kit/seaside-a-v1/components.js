(function () {
  'use strict';
  const assets = window.SeasideAAssets;
  const base = new URL('.', document.currentScript.src);
  const ns = 'http://www.w3.org/2000/svg';
  const mountedFrames = new WeakMap();
  const activeFrames = new Set();
  const $ = id => document.getElementById(id);

  // Viewports expose the measured part of the original bitmap. No CSS-drawn
  // replacement borders, transformed source files, or regenerated artwork.
  function frame(host, id) {
    const old = mountedFrames.get(host);
    if (old) { old.observer.disconnect(); old.element.remove(); activeFrames.delete(old); }
    const a = assets[id];
    if (!a) throw new Error('Missing UI asset: '+id);
    const layer = document.createElement('span');
    layer.className = 'a-frame';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.asset = id;
    const c = a.crop, s = a.slice;
    const xs = [c.x, c.x+s.left, c.right-s.right, c.right];
    const ys = [c.y, c.y+s.top, c.bottom-s.bottom, c.bottom];
    for (let row=0;row<3;row++) for (let col=0;col<3;col++) {
      const svg = document.createElementNS(ns,'svg');
      svg.setAttribute('viewBox',`${xs[col]} ${ys[row]} ${xs[col+1]-xs[col]} ${ys[row+1]-ys[row]}`);
      svg.setAttribute('preserveAspectRatio','none');
      svg.setAttribute('focusable','false');
      const image = document.createElementNS(ns,'image');
      image.setAttribute('href',new URL(a.src,base).href);
      image.setAttribute('width',a.width);image.setAttribute('height',a.height);
      svg.append(image);layer.append(svg);
    }
    host.prepend(layer);
    const update = () => {
      const w=host.clientWidth,h=host.clientHeight;
      if (!w||!h) return;
      const scale=Math.min(1,w/c.width,h/c.height);
      const left=s.left*scale,right=s.right*scale,top=s.top*scale,bottom=s.bottom*scale;
      layer.style.gridTemplateColumns=`${left}px minmax(0,1fr) ${right}px`;
      layer.style.gridTemplateRows=`${top}px minmax(0,1fr) ${bottom}px`;
    };
    const observer=new ResizeObserver(update);observer.observe(host);update();
    const entry={element:layer,observer};
    mountedFrames.set(host,entry);activeFrames.add(entry);
    host.dataset.skin=id;
  }
  document.querySelectorAll('[data-skin]').forEach(el=>frame(el,el.dataset.skin));
  function clearChildren(host){
    host.querySelectorAll('[data-skin]').forEach(el=>{const entry=mountedFrames.get(el);if(entry){entry.observer.disconnect();activeFrames.delete(entry);mountedFrames.delete(el);}});
    host.replaceChildren();
  }
  function busy(button,active,label) {
    button.disabled=active;button.setAttribute('aria-busy',String(active));
    button.querySelector('.spinner')?.remove();
    if(active){const spinner=document.createElement('span');spinner.className='spinner';spinner.setAttribute('aria-hidden','true');button.append(spinner);}
    button.querySelector('.button-label').textContent=label;
  }
  function checkArt(input) {
    const img=input.nextElementSibling;
    img.src=new URL('runtime/checkbox-'+(input.checked?'checked':'unchecked')+'.webp',base).href;
    input.parentElement.querySelector('.mixed-mark')?.remove();
    if(input.indeterminate){const mark=document.createElement('span');mark.className='mixed-mark';mark.textContent='−';mark.setAttribute('aria-hidden','true');input.parentElement.append(mark);}
  }
  document.querySelectorAll('.a-check input').forEach(input=>input.addEventListener('change',()=>checkArt(input)));
  let actionBusy=false, confirmMode='buy', actionTimer;
  const actionLabels={buy:'确认购买',list:'确认上架',withdraw:'确认撤回'};
  function closeDialog(dialog){if(dialog.id==='confirm-dialog'&&actionBusy)return;dialog.close();}
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog($(button.dataset.close))));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('cancel',event=>{if(dialog.id==='confirm-dialog'&&actionBusy)event.preventDefault();}));
  function showConfirmation(mode) {
    if(actionBusy)return;
    confirmMode=mode;
    $('confirm-error').hidden=true;
    $('confirm-title').textContent={buy:'确认购买',list:'确认寄售',withdraw:'撤回寄售'}[mode];
    $('confirm-copy').textContent={buy:'请核对藏品编号与金额。确认后将使用土豆币购买这件藏品。',list:'请核对寄售价格。上架后暂不能转赠，撤回寄售后恢复。',withdraw:'撤回后，该藏品保留在您的金库，当前寄售价格将取消。'}[mode];
    $('confirm-item').textContent='Potato卡';
    $('confirm-amount-label').textContent=mode==='list'?'寄售价格':mode==='withdraw'?'当前寄售价':'支付金额';
    $('confirm-amount').textContent=(mode==='list'?Number($('price').value).toFixed(2):'6.00')+' 土豆币';
    $('cancel-label').textContent=mode==='list'?'修改价格':mode==='withdraw'?'保留寄售':'取消';
    frame($('confirm-action'),mode==='withdraw'?'button-danger-clay':'button-transaction-gold');
    busy($('confirm-action'),false,actionLabels[mode]);
    $('confirm-dialog').showModal();
  }
  $('open-buy').addEventListener('click',()=>showConfirmation('buy'));
  $('open-confirm-demo').addEventListener('click',()=>showConfirmation('buy'));
  $('open-withdraw').addEventListener('click',()=>showConfirmation('withdraw'));
  $('confirm-action').addEventListener('click',()=>{
    if(actionBusy)return;
    actionBusy=true;$('confirm-error').hidden=true;
    $('confirm-dialog').querySelectorAll('[data-close]').forEach(b=>b.disabled=true);
    busy($('confirm-action'),true,'提交中');
    actionTimer=setTimeout(()=>{
      actionBusy=false;$('confirm-dialog').querySelectorAll('[data-close]').forEach(b=>b.disabled=false);
      busy($('confirm-action'),false,actionLabels[confirmMode]);
      if($('response-mode').value==='error'){
        $('confirm-error').textContent='模拟失败：操作未完成，原内容已保留。请核对后重试。';$('confirm-error').hidden=false;return;
      }
      $('confirm-dialog').close();
      $('result-title').textContent={buy:'购买完成',list:'上架成功',withdraw:'寄售已撤回'}[confirmMode];
      $('result-copy').textContent='这是演示结果，未提交真实交易或改变任何资产。';
      $('result-dialog').showModal();
    },900);
  });
  window.addEventListener('pagehide',()=>clearTimeout(actionTimer));
  function validatePrice(){
    const v=$('price').value.trim();let error='';
    if(!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)<=0||!Number.isFinite(Number(v)))error='请输入大于 0 的金额，最多保留两位小数。';
    else if(Number(v)>300)error='示例最高寄售价为 300 土豆币。';
    $('price-error').textContent=error;$('price-error').hidden=!error;
    $('price-shell').dataset.invalid=String(!!error);$('price').setAttribute('aria-invalid',String(!!error));
    return !error;
  }
  $('check-price').addEventListener('click',()=>{if(validatePrice())showConfirmation('list');else $('price').focus();});
  $('price').addEventListener('input',()=>{if($('price').getAttribute('aria-invalid')==='true')validatePrice();});
  let saveBusy=false;
  function simulateButton(button,label,feedback){
    if(button.disabled)return;
    busy(button,true,'处理中');feedback.textContent='正在演示加载状态…';
    setTimeout(()=>{busy(button,false,label);feedback.textContent='演示完成；没有保存或提交真实数据。';saveBusy=false;},900);
  }
  $('demo-save').addEventListener('click',()=>{if(saveBusy)return;saveBusy=true;simulateButton($('demo-save'),'保存修改',$('button-feedback'));});
  $('demo-loading').addEventListener('click',()=>simulateButton($('demo-loading'),'体验加载',$('button-feedback')));
  $('demo-back').addEventListener('click',()=>{$('button-feedback').textContent='返回按钮已响应；当前仍在组件预览页。';});
  $('demo-pressed').addEventListener('click',()=>{$('button-feedback').textContent='按下态：轻微缩放，保留原尺寸与文字位置。';});
  $('icon-back').addEventListener('click',()=>{$('control-feedback').textContent='返回示例已响应。';});
  $('icon-close').addEventListener('click',()=>{$('control-feedback').textContent='关闭示例已响应。';});
  $('icon-search').addEventListener('click',()=>{$('search').focus();});
  const records=[
    {name:'Potato卡',serial:128,status:'idle',time:3},
    {name:'天然土',serial:50005,status:'idle',time:1},
    {name:'红皮土豆艺术家',serial:406,status:'listed',time:4},
    {name:'Potato卡',serial:432,status:'listed',time:2},
  ];
  let tab='all',sort='serial-asc',pendingSort=sort;
  const sortLabels={'serial-asc':'编号从小到大','serial-desc':'编号从大到小','time-desc':'最新获得','time-asc':'最早获得'};
  function renderCollections(){
    const query=$('search').value.trim().toLowerCase().replace(/^#/,'');
    const list=records.filter(r=>(tab==='all'||r.status===tab)&&(!query||r.name.toLowerCase().includes(query)||String(r.serial).padStart(6,'0').includes(query)));
    list.sort((a,b)=>sort==='serial-asc'?a.serial-b.serial:sort==='serial-desc'?b.serial-a.serial:sort==='time-desc'?b.time-a.time:a.time-b.time);
    clearChildren($('collection-list'));
    for(const record of list){
      const row=document.createElement('div');row.className='result-line';
      const info=document.createElement('div');const name=document.createElement('strong');name.textContent=record.name;
      const serial=document.createElement('small');serial.className='serial';serial.textContent='#'+String(record.serial).padStart(6,'0');
      info.append(name,serial);const badge=document.createElement('span');badge.className='a-badge';const label=document.createElement('span');label.textContent=record.status==='idle'?'在库':'寄售中';badge.append(label);row.append(info,badge);$('collection-list').append(row);frame(badge,record.status==='idle'?'status-in-vault':'status-listed');
    }
    if(!list.length){const p=document.createElement('p');p.className='caption';p.textContent='没有找到匹配藏品，可修改名称、编号或分类。';$('collection-list').append(p);}
    $('result-count').textContent='共 '+list.length+' 件藏品';$('sort-label').textContent=sortLabels[sort];
  }
  $('search').addEventListener('input',renderCollections);
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
    tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b===button;b.setAttribute('aria-pressed',String(active));frame(b,active?'tab-selected':'tab-default');});renderCollections();
  }));
  function markSort(){document.querySelectorAll('[data-sort]').forEach(b=>{const selected=b.dataset.sort===pendingSort;b.setAttribute('aria-pressed',String(selected));frame(b,selected?'status-in-vault':'badge-neutral');});}
  function openSort(){pendingSort=sort;markSort();$('filter-drawer').showModal();}
  $('open-filter').addEventListener('click',openSort);$('icon-filter').addEventListener('click',openSort);
  document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{pendingSort=b.dataset.sort;markSort();}));
  $('reset-sort').addEventListener('click',()=>{pendingSort='serial-asc';markSort();});
  $('apply-sort').addEventListener('click',()=>{sort=pendingSort;renderCollections();$('filter-drawer').close();});
  renderCollections();
  let selectedMaterials=new Set();
  const materialIds=[128,129,130];
  function updateMaterialCount(){
    const available=$('inventory-mode').value==='short'?2:3;
    $('material-count').textContent='已选 '+selectedMaterials.size+' / 3';
    $('apply-materials').disabled=selectedMaterials.size!==3;
    $('apply-materials').querySelector('.button-label').textContent=selectedMaterials.size===3?'确认选择':'请先选齐材料';
    $('select-all').checked=selectedMaterials.size===available;
    $('select-all').indeterminate=selectedMaterials.size>0&&selectedMaterials.size<available;checkArt($('select-all'));
  }
  function renderMaterials(){
    const available=$('inventory-mode').value==='short'?2:3;
    $('material-list').replaceChildren();
    materialIds.forEach((id,index)=>{
      const row=document.createElement('div');row.className='material-row';
      const label=document.createElement('label');label.className='a-check';
      const input=document.createElement('input');input.type='checkbox';input.disabled=index>=available;input.checked=selectedMaterials.has(id);
      input.setAttribute('aria-label','选择材料 #'+String(id).padStart(6,'0'));
      const art=document.createElement('img');art.alt='';label.append(input,art);checkArt(input);
      const text=document.createElement('span');const title=document.createElement('strong');title.textContent='Potato卡';const serial=document.createElement('small');serial.textContent='#'+String(id).padStart(6,'0');text.append(title,serial);label.append(text);
      const state=document.createElement('small');state.textContent=index<available?'可用':'暂未持有';row.append(label,state);$('material-list').append(row);
      input.addEventListener('change',()=>{if(input.checked)selectedMaterials.add(id);else selectedMaterials.delete(id);checkArt(input);updateMaterialCount();});
    });
    $('material-shortage').hidden=available===3;$('go-market').hidden=available===3;updateMaterialCount();
  }
  $('open-materials').addEventListener('click',()=>{renderMaterials();$('market-feedback').textContent='';$('material-drawer').showModal();});
  $('inventory-mode').addEventListener('change',()=>{selectedMaterials=new Set();$('material-feedback').textContent='尚未选择材料';});
  $('select-all').addEventListener('change',()=>{const available=$('inventory-mode').value==='short'?2:3;selectedMaterials=$('select-all').checked?new Set(materialIds.slice(0,available)):new Set();renderMaterials();});
  $('apply-materials').addEventListener('click',()=>{if(selectedMaterials.size!==3)return;$('material-feedback').textContent='已选择 3 件材料（演示），未消耗藏品。';$('material-drawer').close();});
  $('go-market').addEventListener('click',()=>{$('market-feedback').textContent='演示入口：正式接入时跳转到 Potato卡 的集市，并保留当前合成活动与选择。';});
  window.SeasideA={frame};
})();
