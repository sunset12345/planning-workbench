const config = JSON.parse(document.querySelector('#demo-data').textContent);
const pool = config.LotteryPool[0];
const resourceMap = Object.fromEntries(config.Resource.map(r => [r.id, r]));
const labels = Object.fromEntries(config.UiText.map(t => [t.key, t.zhCN]));
function compareIds(a,b){const x=Array.from(a,c=>c.codePointAt(0)),y=Array.from(b,c=>c.codePointAt(0));for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;}
const baseEntries = config.LotteryReward.filter(r => r.poolId === pool.id).sort((a,b) => compareIds(a.id,b.id));
const slides = [...document.querySelectorAll('.slide')];
let ix=0, free=pool.dailyFree, busy=false, awaitingClose=false, entries=baseEntries, displayState='ready';
let balances = Object.fromEntries(config.Resource.map(r => [r.id, r.id === pool.costResourceId ? 3*pool.costCount : 0]));
const nameOf = id => labels[resourceMap[id].nameKey];
function probabilityLabel(weight,total) {
  const p=weight/total;
  return p*100 < 0.01 ? '<0.01%' : (Math.floor(10000*weight/total+0.5)/100).toFixed(2)+'%';
}
function chooseEntry(rows,r) {
  const total=rows.reduce((sum,row)=>sum+row.weight,0);
  if(!rows.length||!Number.isInteger(r)||r<0||r>=total)throw Error('无效抽取区间');
  let cumulative=0;
  for(const row of rows){cumulative+=row.weight;if(r<cumulative)return row;}
  throw Error('权重配置无效');
}
function show(n) {
  ix=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,i)=>s.hidden=i!==ix);
  document.querySelector('#counter').textContent=(ix+1)+' / '+slides.length;
  document.querySelector('#choose').value=ix;
}
document.querySelector('#prev').onclick=()=>show(ix-1);
document.querySelector('#next').onclick=()=>show(ix+1);
document.querySelector('#choose').onchange=e=>show(Number(e.target.value));
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')show(ix+1);if(e.key==='ArrowLeft')show(ix-1);});
function renderEntries() {
  const list=document.querySelector('#demo-entries');list.replaceChildren();
  if(!entries.length){list.textContent='奖池暂不可用（N=0）';return;}
  const total=entries.reduce((s,r)=>s+r.weight,0);
  for(const entry of entries){
    const card=document.createElement('article');card.className='demo-entry';
    const title=document.createElement('strong');title.textContent=nameOf(entry.resourceId);title.title=title.textContent;
    const count=document.createElement('div');count.textContent='× '+entry.count+' '+resourceMap[entry.resourceId].unit;
    const probability=document.createElement('small');probability.textContent=probabilityLabel(entry.weight,total)+' · '+entry.id;
    card.append(title,count,probability);list.append(card);
  }
}
function refresh() {
  const loading=displayState==='loading';
  document.querySelector('#balances').textContent=loading?'免费 — / — · 资源余额 —':`免费 ${free}/${pool.dailyFree} · `+config.Resource.map(r=>nameOf(r.id)+' '+balances[r.id]).join(' · ');
  const draw=document.querySelector('#draw');
  const reasons={loading:'加载中…',closed:'当前奖池暂未开放',locked:`达到${pool.unlockLevel}级开放`,pending:'结果确认中，请稍后查看'};
  draw.textContent=busy?'抽取中…':awaitingClose?'请关闭本次结果':reasons[displayState]||(!entries.length?'奖池暂不可用':free>0?'免费抽一次':`抽一次（${pool.costCount}${resourceMap[pool.costResourceId].unit}${nameOf(pool.costResourceId)}）`);
  draw.disabled=busy||awaitingClose||displayState!=='ready'||!entries.length;
  document.querySelector('#entry-count').disabled=busy||awaitingClose;document.querySelector('#demo-state').disabled=busy||awaitingClose;document.querySelector('#result-close').hidden=!awaitingClose;
  document.querySelector('#demo-entries').hidden=displayState==='loading';
  document.querySelector('#demo-status').textContent=busy?'ANIMATING：奖励已确定；结束后展示唯一结果':awaitingClose?'RESULT：固定一个结果卡；关闭后才可继续抽取':reasons[displayState]||`IDLE：N=${entries.length}；单次返回1个对象；每条count为固定整数。`;
  if(!busy&&displayState==='ready'&&!entries.length)document.querySelector('#demo-status').textContent='配置无效：没有可抽条目；不显示可点击空槽。';
}
document.querySelector('#entry-count').onchange=e=>{
  const n=Number(e.target.value);
  entries=Array.from({length:n},(_,i)=>({...baseEntries[i%baseEntries.length],id:'sample_'+String(i+1).padStart(2,'0')}));
  renderEntries();refresh();document.querySelector('#result').textContent='示例列表已切换；已用免费和余额不重置。';
};
document.querySelector('#demo-state').onchange=e=>{displayState=e.target.value;refresh();document.querySelector('#result').textContent=displayState==='pending'?'这里只预览确认中状态，未实际发起抽奖。':'状态预览，不改变资源。';};
document.querySelector('#draw').onclick=()=>{
  if(busy||awaitingClose||displayState!=='ready'||!entries.length)return;
  if(free===0&&balances[pool.costResourceId]<pool.costCount){document.querySelector('#result').textContent=`${nameOf(pool.costResourceId)}不足，需要${pool.costCount}${resourceMap[pool.costResourceId].unit}。本次未消耗资源。`;return;}
  const total=entries.reduce((sum,row)=>sum+row.weight,0),r=Math.floor(Math.random()*total),result=chooseEntry(entries,r);
  const paidCost=free>0?0:pool.costCount;
  if(free>0)free--;else balances[pool.costResourceId]-=paidCost;
  balances[result.resourceId]+=result.count;
  busy=true;refresh();document.querySelector('#result').classList.remove('rare');
  document.querySelector('#result').textContent='结果已确定，播放0.8秒演示表现…';
  document.querySelector('#formula-trace').textContent=`上次抽取：N=${entries.length}，W=${total}，r=${r}；命中 ${result.id}；消耗=${paidCost}，固定发放count=${result.count}。`;
  setTimeout(()=>{
    document.querySelector('#result').textContent=`获得 ${nameOf(result.resourceId)} × ${result.count}，奖励已到账。`;
    document.querySelector('#result').classList.toggle('rare',result.rare);busy=false;awaitingClose=true;refresh();
  },800);
};
document.querySelector('#result-close').onclick=()=>{awaitingClose=false;document.querySelector('#result').textContent='结果已关闭；余额保持不变。';document.querySelector('#result').classList.remove('rare');refresh();};
document.querySelector('#reset').onclick=()=>{
  if(busy)return;awaitingClose=false;free=pool.dailyFree;balances=Object.fromEntries(config.Resource.map(r=>[r.id,r.id===pool.costResourceId?3*pool.costCount:0]));
  displayState='ready';document.querySelector('#demo-state').value='ready';
  document.querySelector('#formula-trace').textContent='';document.querySelector('#result').textContent='演示数据已重置。';document.querySelector('#result').classList.remove('rare');refresh();
};
renderEntries();refresh();show(0);
