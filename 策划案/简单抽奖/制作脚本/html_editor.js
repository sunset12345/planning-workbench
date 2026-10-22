(()=>{'use strict';
const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg';
let graphs=JSON.parse($('#graph-data').textContent),edit=null,dirty=false;
let inlineEdit=null,viewerCamera=null;
const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
const clone=x=>JSON.parse(JSON.stringify(x));
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3500);}
function el(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function draw(g,container,selected='',editing=false){
 const compact=g.presentation==='compact-tree';
 const svg=compact?PlanningMindmap.svg(g,{interactive:false}):el('svg',{viewBox:`0 0 ${Math.max(...g.nodes.map(n=>n.x+n.w))+40} ${Math.max(...g.nodes.map(n=>n.y+n.h))+40}`,role:'img','aria-label':g.title});
 if(!compact){
 const defs=el('defs'),mark=el('marker',{id:'arrow-'+container.id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'});mark.append(el('path',{d:'M0,0 L10,5 L0,10Z',fill:'#568b72'}));defs.append(mark);svg.append(defs);
 const ns=Object.fromEntries(g.nodes.map(n=>[n.id,n]));
 for(const e of g.edges){const a=ns[e.fromId],b=ns[e.toId];if(!a||!b)continue;const down=b.y>=a.y+a.h,up=a.y>=b.y+b.h,left=b.x+b.w<=a.x,vertical=down||up;
 const x1=vertical?a.x+a.w/2:(left?a.x:a.x+a.w),y1=down?a.y+a.h:up?a.y:a.y+a.h/2,x2=vertical?b.x+b.w/2:(left?b.x+b.w:b.x),y2=down?b.y:up?b.y+b.h:b.y+b.h/2;const active=!selected||selected===e.id||selected===a.id||selected===b.id;const group=el('g',{class:'edge'+(active?' active':'')});const path=el('path',{d:vertical?`M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`:`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`,fill:'none',stroke:'#568b72','stroke-width':2,'marker-end':`url(#arrow-${container.id})`});path.append(el('title',{},e.label||`${a.text.split('\n')[0]} → ${b.text.split('\n')[0]}`));group.append(path);if(e.label&&(!selected||selected===e.id)&&g.edges.length<9)group.append(el('text',{x:(x1+x2)/2,y:(y1+y2)/2-8,fill:'#976a2c','font-size':14,'text-anchor':'middle',stroke:'#ffffff','stroke-width':4,'paint-order':'stroke'},e.label));svg.append(group);}
 }
 for(const n of g.nodes){const gr=compact?[...svg.querySelectorAll('.node')].find(e=>e.dataset.node===n.id):el('g',{class:'node','data-node':n.id,transform:`translate(${n.x},${n.y})`,tabindex:0});gr.classList.toggle('selected',selected===n.id);
 if(!compact){gr.append(el('rect',{width:n.w,height:n.h,rx:8,fill:n.id==='root'?'#285c47':'#fff',stroke:'#adc5b6'}));n.text.split('\n').forEach((t,i)=>gr.append(el('text',{x:15,y:28+i*25,'font-size':i===0?19:16,fill:n.id==='root'?'white':'#27483b'},t)));if(n.href){
 const link=el('a',{href:n.href,class:'node-jump','aria-label':'跳转：'+n.text.split('\n')[0]});
 if(!n.href.startsWith('#')){link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');}
 link.append(el('rect',{x:n.w-82,y:n.h-29,width:72,height:22,rx:5,fill:n.id==='root'?'#dbeee1':'#edf4ef',stroke:'none'}));
 link.append(el('text',{x:n.w-72,y:n.h-13,'font-size':12,fill:'#27614f'},'↗ 跳转'));
 link.append(el('title',{},n.href));
 gr.append(link);
 }}
 gr.querySelector('.node-jump')?.addEventListener('click',e=>{e.stopPropagation();if(editing){e.preventDefault();toast('先应用修改，再从文档中的跳转按钮打开链接。');}else if(n.href.startsWith('#')){e.preventDefault();jumpTo(n.href);}});
 gr.addEventListener('click',ev=>{if(ev.target.closest('.node-jump'))return;if(editing){selectNode(n.id);$('#edit-canvas').focus({preventScroll:true});}else{container.querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.node===n.id));}});
 gr.addEventListener('dblclick',ev=>{if(ev.target.closest('.node-jump'))return;ev.preventDefault();if(editing){selectNode(n.id);startInline(n.id);}else{openEditor(container.closest('[data-graph]').dataset.graph,'graph',n.id);startInline(n.id);}});
 gr.addEventListener('keydown',ev=>{if(!editing&&ev.key==='Enter'){ev.preventDefault();openEditor(container.closest('[data-graph]').dataset.graph,'graph',n.id);}});
 if(editing)gr.addEventListener('pointerdown',ev=>{
  if(ev.button!==0||ev.target.closest('.node-jump'))return;
  finishInline();ev.preventDefault();selectNode(n.id);
  const matrix=svg.getScreenCTM(),scale=1/matrix.a,startX=ev.clientX,startY=ev.clientY,ox=n.x,oy=n.y;let moved=false;
  const before=snapshot();
  const move=v=>{
   if(!moved&&Math.hypot(v.clientX-startX,v.clientY-startY)<4)return;
   moved=true;n.x=Math.max(0,Math.round(ox+(v.clientX-startX)*scale));n.y=Math.max(0,Math.round(oy+(v.clientY-startY)*scale));
   gr.setAttribute('transform',`translate(${n.x},${n.y})`);redrawEdges(g,svg,container.id);
  };
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);if(moved){pushHistory(before);paintEditor();}else fillControls();$('#edit-canvas').focus({preventScroll:true});};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 });svg.append(gr);}
 container.replaceChildren(svg);return svg;
}
function jumpTo(href){
 const target=document.getElementById(decodeURIComponent(href.slice(1)));if(!target)return toast('未找到对应章节');
 $('#clear-search').click();document.querySelectorAll('.chapter,.table-wrap').forEach(x=>x.hidden=false);
 if($('#viewer').open)$('#viewer').close();location.hash=href;target.scrollIntoView({behavior:'smooth',block:'start'});
 target.classList.remove('jump-target');void target.offsetWidth;target.classList.add('jump-target');
}
function cleanLink(value){
 if(typeof value!=='string')throw Error('链接需要是文本');const href=value.trim();if(!href)return '';
 if(/[\x00-\x20\\]/.test(href)||href.startsWith('//'))throw Error('链接中不能有空格、反斜杠或控制字符');
 if(href.startsWith('#')){let id;try{id=decodeURIComponent(href.slice(1));}catch{throw Error('章节链接格式无效');}if(!document.getElementById(id))throw Error('找不到此正文锚点，可从“选择正文或附件”中选择');return href;}
 if(/^https?:\/\//i.test(href)){try{new URL(href);}catch{throw Error('网页链接格式无效');}return href;}
 if(/^[^/?#]*:/.test(href)||href.startsWith('/'))throw Error('请填写 https:// 网页、#正文锚点或包内相对文件路径');
 return href;
}
function redrawEdges(g,svg,id){
 const temp=document.createElement('div');temp.id=id;draw(g,temp,'',false);
 const old=[...svg.querySelectorAll(':scope > .edge')],fresh=[...temp.querySelectorAll('.edge')];old.forEach((x,i)=>x.replaceWith(fresh[i]));
}
function renderAll(){
 document.querySelectorAll('[data-graph]').forEach(card=>{const stage=card.querySelector('.graph-stage'),id=card.dataset.graph,g=graphs[id];stage.id='stage-'+id;
  if(g.presentation==='compact-tree')PlanningMindmap.mount(g,stage,{onJump:jumpTo,onEdit:nodeId=>{openEditor(id,'graph',nodeId);startInline(nodeId);}});
  else draw(g,stage);
 });$('#graph-data').textContent=JSON.stringify(graphs,null,2).replace(/</g,'\\u003c');
}
function validate(g){if(!g||!Array.isArray(g.nodes)||!g.nodes.length||!Array.isArray(g.edges))throw Error('需要非空 nodes 和 edges 数组');const ids=new Set();for(const n of g.nodes){if(typeof n.id!=='string'||!n.id||ids.has(n.id))throw Error('节点ID不能为空或重复');ids.add(n.id);if(n.href!==undefined)cleanLink(n.href);if(typeof n.text!=='string')throw Error('节点文字必须为文本');for(const k of['x','y','w','h'])if(!Number.isFinite(n[k])||n[k]<0)throw Error('节点位置/大小必须为非负数字');if(n.w<60||n.h<35)throw Error('节点宽度至少60，高度至少35');}const ei=new Set();for(const e of g.edges){if(!e.id||ei.has(e.id))throw Error('连线ID不能为空或重复');ei.add(e.id);if(!ids.has(e.fromId)||!ids.has(e.toId))throw Error('连线端点不存在：'+e.id);if(typeof e.label!=='string')throw Error('连线标签必须为文本');}}
function options(sel,items,current){sel.replaceChildren(...items.map(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o;}));sel.value=current;}
function snapshot(){return {draft:clone(edit.draft),node:edit.node,edge:edit.edge};}
function pushHistory(before){edit.undo.push(before);if(edit.undo.length>60)edit.undo.shift();edit.redo=[];updateHistoryButtons();}
function updateHistoryButtons(){if($('#undo-edit')){$('#undo-edit').disabled=!edit.undo.length;$('#redo-edit').disabled=!edit.redo.length;}}
function mutate(action){const before=snapshot();try{action();validate(edit.draft);if(JSON.stringify(before.draft)!==JSON.stringify(edit.draft))pushHistory(before);$('#editor-error').textContent='';paintEditor();}catch(e){edit.draft=before.draft;$('#editor-error').textContent=e.message;}}
function historyStep(redo=false){finishInline();const source=redo?edit.redo:edit.undo,target=redo?edit.undo:edit.redo;if(!source.length)return;target.push(snapshot());Object.assign(edit,source.pop());paintEditor();}
function nodeHeight(n){
 if(edit?.draft.presentation==='compact-tree'){const level=PlanningMindmap.levels(edit.draft).get(n.id),size=level===1?17:level<=3?14:13;n.h=Math.max(n.h,PlanningMindmap.lines(n.text,n.w-(level<=2?36:24),size).length*18+(level<=2?16:8));}
 else n.h=Math.max(n.h,n.text.split('\n').length*25+(n.href?42:20));
}
function fillControls(){
 if(edit?.mode!=='graph')return;
 const g=edit.draft,n=g.nodes.find(x=>x.id===edit.node)||g.nodes[0],edge=g.edges.find(x=>x.id===edit.edge)||g.edges[0];edit.node=n.id;edit.edge=edge?.id;
 options($('#node-select'),g.nodes.map(n=>[n.id,n.text.split('\n')[0]]),n.id);$('#node-text').value=n.text;$('#node-link').value=n.href||'';
 for(const k of['x','y','w','h'])$('#node-'+k).value=n[k];
 options($('#edge-select'),g.edges.map(e=>[e.id,e.label||e.id]),edge?.id);
 for(const k of['fromId','toId'])options($('#edge-'+k),g.nodes.map(n=>[n.id,n.text.split('\n')[0]]),edge?.[k]);$('#edge-label').value=edge?.label||'';
 const targets=[['','选择正文或附件…'],...[...document.querySelectorAll('main h2[id],main h3[id],main section[id]')].map(e=>['#'+e.id,e.matches('section')?e.querySelector('h2').textContent:e.textContent]),...[...document.querySelectorAll('main a[href]')].filter(a=>!a.getAttribute('href').startsWith('#')&&!a.closest('[data-graph]')).map(a=>[a.getAttribute('href'),a.textContent.trim()])];
 options($('#link-target'),[...new Map(targets.map(x=>[x[0],x])).values()],n.href||'');
 $('#node-link-label').textContent=n.href?'已关联：'+n.href:'未设置链接';
 $('#edit-canvas').querySelectorAll('.node').forEach(x=>x.classList.toggle('selected',x.dataset.node===n.id));updateHistoryButtons();
}
function paintEditor(){$('#edit-canvas').classList.toggle('compact-mindmap-editor',edit.draft.presentation==='compact-tree');draw(edit.draft,$('#edit-canvas'),edit.node,true);$('#edit-canvas svg').style.width=(edit.zoom||100)+'%';$('#zoom-label').textContent=(edit.zoom||100)+'%';fillControls();}
function selectNode(id){finishInline();edit.node=id;fillControls();}
function finishInline(cancel=false){
 if(!inlineEdit)return;const current=inlineEdit;inlineEdit=null;const value=current.input.value;current.input.remove();
 if(!cancel){mutate(()=>{const n=edit.draft.nodes.find(x=>x.id===current.id);n.text=value;nodeHeight(n);});}
}
function startInline(id){
 finishInline();const node=edit.draft.nodes.find(n=>n.id===id),canvas=$('#edit-canvas'),group=[...canvas.querySelectorAll('.node')].find(n=>n.dataset.node===id);
 group.scrollIntoView({block:'nearest',inline:'nearest'});
 const rect=group.getBoundingClientRect(),base=canvas.getBoundingClientRect(),input=document.createElement('textarea');input.id='inline-node-text';input.className='inline-node-text';input.value=node.text;input.setAttribute('aria-label','直接编辑节点文字');
 Object.assign(input.style,{left:(rect.left-base.left+canvas.scrollLeft)+'px',top:(rect.top-base.top+canvas.scrollTop)+'px',width:Math.max(180,rect.width)+'px',height:Math.max(70,rect.height)+'px'});
 canvas.append(input);inlineEdit={id,input};let composing=false;
 input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
 input.onkeydown=e=>{e.stopPropagation();if(e.isComposing||composing||e.keyCode===229)return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishInline();canvas.focus({preventScroll:true});}if(e.key==='Escape'){e.preventDefault();finishInline(true);canvas.focus({preventScroll:true});}};
 input.onblur=()=>finishInline();input.focus({preventScroll:true});input.select();
}
function addNode(sibling=false){
 finishInline();let newId;
 mutate(()=>{const g=edit.draft,current=g.nodes.find(n=>n.id===edit.node),parent=sibling?g.nodes.find(n=>n.id===g.edges.find(e=>e.toId===current.id)?.fromId):current;
  if(sibling&&!parent)throw Error('根节点没有同级；可按 Tab 添加子节点');
  const peers=g.edges.filter(e=>e.fromId===parent.id).map(e=>g.nodes.find(n=>n.id===e.toId));
  const x=peers.length?peers[0].x:parent.x+parent.w+90;let y=peers.length?Math.max(...peers.map(n=>n.y+n.h))+35:parent.y;
  while(g.nodes.some(n=>x<n.x+n.w+15&&x+260>n.x-15&&y<n.y+n.h+15&&y+85>n.y-15))y+=110;
  newId=uid('node');g.nodes.push({id:newId,text:sibling?'同级节点':'子节点',x,y,w:260,h:85,href:''});g.edges.push({id:uid('edge'),fromId:parent.id,toId:newId,label:''});edit.node=newId;if(g.presentation==='compact-tree')PlanningMindmap.layout(g);
 });if(newId)startInline(newId);
}
function deleteNode(){finishInline();mutate(()=>{if(edit.draft.nodes.length===1)throw Error('至少保留一个节点');const old=edit.node,parent=edit.draft.edges.find(e=>e.toId===old)?.fromId;edit.draft.nodes=edit.draft.nodes.filter(n=>n.id!==old);edit.draft.edges=edit.draft.edges.filter(e=>e.fromId!==old&&e.toId!==old);edit.node=parent||edit.draft.nodes[0].id;});}
function saveNode(){mutate(()=>{const n=edit.draft.nodes.find(n=>n.id===edit.node);n.text=$('#node-text').value;n.href=cleanLink($('#node-link').value);for(const k of['x','y','w','h'])n[k]=Number($('#node-'+k).value);nodeHeight(n);});}
function setLink(value){mutate(()=>{const n=edit.draft.nodes.find(n=>n.id===edit.node);n.href=cleanLink(value);nodeHeight(n);});}
function openEditor(id,mode,nodeId){
 edit={id,mode,draft:clone(graphs[id]),node:nodeId||graphs[id]?.nodes[0].id,edge:graphs[id]?.edges[0]?.id,undo:[],redo:[],zoom:window.innerWidth<=900?280:100};$('#editor-error').textContent='';$('#editor-title').textContent=mode==='source'?'编辑 JSON 源码':'编辑导图';$('#editor').classList.toggle('visual-editor',mode==='graph');
 if(mode==='source'){const t=document.createElement('textarea');t.id='source-text';t.className='source-area';t.value=JSON.stringify(edit.draft,null,2);$('#editor-body').replaceChildren(t);}
 else{
 $('#editor-body').innerHTML=`<div class="mind-toolbar"><button id="add-child">＋ 子节点 <kbd>Tab</kbd></button><button id="add-sibling">＋ 同级 <kbd>Enter</kbd></button><button id="del-node">删除节点</button><button id="undo-edit">撤销</button><button id="redo-edit">重做</button>${edit.draft.presentation==='compact-tree'?'<button id="layout-edit">自动排布</button>':''}<span class="toolbar-space"></span><button id="zoom-out" aria-label="缩小画布">−</button><output id="zoom-label">100%</output><button id="zoom-in" aria-label="放大画布">＋</button><button id="fit-edit">适应画布</button></div>
 <p class="mind-help">双击改字 · 拖动位置 · Tab 子节点 · Enter 同级 · ⌘/Ctrl Z 撤销 · 编辑文字时 Shift+Enter 换行</p>
 <div class="editor-grid"><div id="edit-canvas" class="editor-canvas" tabindex="0" aria-label="导图编辑画布"></div><aside class="editor-form">
 <label>当前节点<select id="node-select"></select></label><label>文字<textarea id="node-text"></textarea></label>
 <label>选择正文或附件<select id="link-target"></select></label><label>或粘贴链接<input id="node-link" placeholder="#ui-01 / 需求表/xxx.xlsx / https://…"></label><div class="buttons"><button id="set-link">设置链接</button><button id="clear-link">移除链接</button></div><p id="node-link-label" class="caption"></p>
 <details><summary>节点位置与大小</summary><div class="buttons">${['x','y','w','h'].map(k=>`<label>${k}<input id="node-${k}" type="number" min="0"></label>`).join('')}</div></details><button id="set-node">更新节点</button>
 <details class="edge-settings"><summary>编辑连线</summary><label>连线<select id="edge-select"></select></label><label>起点<select id="edge-fromId"></select></label><label>终点<select id="edge-toId"></select></label><label>连线文字<input id="edge-label"></label><div class="buttons"><button id="set-edge">更新连线</button><button id="add-edge">新增连线</button><button id="del-edge">删除连线</button></div></details>
 <p class="caption">删除仅移除此节点及相连连线。取消会丢弃本次编辑；应用后请下载 HTML 保存。</p></aside></div>`;
 $('#node-select').onchange=e=>{edit.node=e.target.value;paintEditor();[...$('#edit-canvas').querySelectorAll('.node')].find(n=>n.dataset.node===edit.node)?.scrollIntoView({block:'nearest',inline:'nearest'});};$('#edge-select').onchange=e=>{edit.edge=e.target.value;fillControls();};
 $('#set-node').onclick=saveNode;$('#node-text').onchange=saveNode;
 $('#set-link').onclick=()=>setLink($('#node-link').value);$('#clear-link').onclick=()=>setLink('');$('#link-target').onchange=e=>{if(e.target.value)setLink(e.target.value);};
 $('#add-child').onclick=()=>addNode();$('#add-sibling').onclick=()=>addNode(true);$('#del-node').onclick=deleteNode;$('#undo-edit').onclick=()=>historyStep();$('#redo-edit').onclick=()=>historyStep(true);
 if($('#layout-edit'))$('#layout-edit').onclick=()=>{finishInline();mutate(()=>PlanningMindmap.layout(edit.draft));};
 for(const [name,delta]of[['zoom-out',-20],['zoom-in',20],['fit-edit',0]])$('#'+name).onclick=()=>{finishInline();edit.zoom=delta?Math.min(400,Math.max(40,edit.zoom+delta)):100;$('#zoom-label').textContent=edit.zoom+'%';paintEditor();};
 $('#set-edge').onclick=()=>mutate(()=>{const edge=edit.draft.edges.find(e=>e.id===edit.edge);if(!edge)return;for(const k of['fromId','toId'])edge[k]=$('#edge-'+k).value;edge.label=$('#edge-label').value;});
 $('#add-edge').onclick=()=>mutate(()=>{if(edit.draft.nodes.length<2)throw Error('请先新增节点');const id=uid('edge');edit.draft.edges.push({id,fromId:edit.draft.nodes[0].id,toId:edit.draft.nodes[1].id,label:'关联'});edit.edge=id;});
 $('#del-edge').onclick=()=>mutate(()=>{edit.draft.edges=edit.draft.edges.filter(e=>e.id!==edit.edge);});
 $('#edit-canvas').onkeydown=e=>{if(e.target.matches('input,textarea,select')||e.isComposing)return;const cmd=e.metaKey||e.ctrlKey;
  if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();historyStep(e.shiftKey);}
  else if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();historyStep(true);}
  else if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();addNode();}
  else if(e.key==='Enter'){e.preventDefault();addNode(true);}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteNode();}
  else if(e.key==='F2'){e.preventDefault();startInline(edit.node);}
 };paintEditor();
 }
 $('#editor').showModal();if(mode==='graph'){$('#edit-canvas').focus({preventScroll:true});paintEditor();[...$('#edit-canvas').querySelectorAll('.node')].find(n=>n.dataset.node===edit.node)?.scrollIntoView({block:'nearest',inline:'nearest'});}
}
function clearViewer(){viewerCamera?.destroy();viewerCamera=null;$('#viewer').querySelector('.mindmap-dialog-tools')?.remove();$('#viewer-body').classList.remove('mindmap-viewport','is-panning');$('#viewer-body').removeAttribute('tabindex');for(const key of['scale','panX','panY'])delete $('#viewer-body').dataset[key];}
$('#viewer').addEventListener('close',clearViewer);
document.addEventListener('click',e=>{const jump=e.target.closest('#viewer .node-jump');if(jump?.getAttribute('href')?.startsWith('#')){e.preventDefault();jumpTo(jump.getAttribute('href'));return;}const b=e.target.closest('[data-action]');if(!b)return;const card=b.closest('[data-graph]'),fig=b.closest('[data-ui]');if(b.dataset.action==='edit'||b.dataset.action==='source')openEditor(card.dataset.graph,b.dataset.action==='edit'?'graph':'source');
 else if(b.dataset.action==='zoom'||b.dataset.action==='zoom-ui'){
  clearViewer();const svg=(card?.querySelector('svg')||fig.querySelector('svg')).cloneNode(true);svg.removeAttribute('style');$('#viewer-body').replaceChildren(svg);$('#viewer').showModal();
  if(card&&graphs[card.dataset.graph].presentation==='compact-tree'){
   const bar=document.createElement('div');bar.className='mindmap-dialog-tools';bar.innerHTML='<button data-zoom="out">−</button><output>100%</output><button data-zoom="in">＋</button><button data-zoom="fit">适应窗口</button><button data-zoom="width">适应宽度</button><button data-zoom="actual">100%</button>';
   $('#viewer-body').before(bar);viewerCamera=PlanningMindmap.viewport($('#viewer-body'),svg,s=>bar.querySelector('output').textContent=Math.round(s*100)+'%');
   bar.onclick=e=>{const action=e.target.dataset.zoom;if(action==='in')viewerCamera.zoomIn();if(action==='out')viewerCamera.zoomOut();if(action==='fit')viewerCamera.fit();if(action==='width')viewerCamera.fit('width');if(action==='actual')viewerCamera.actual();};
  }
 }
 else if(b.dataset.action==='svg'){edit={mode:'svg',fig};$('#editor-title').textContent='编辑 SVG 源码';const t=document.createElement('textarea');t.id='source-text';t.className='source-area';t.value=fig.querySelector('.ui-art').innerHTML;$('#editor-body').replaceChildren(t);$('#editor-error').textContent='';$('#editor').showModal();}});
$('#apply-edit').onclick=()=>{try{finishInline();if(edit.mode==='svg'){const raw=$('#source-text').value,doc=new DOMParser().parseFromString(raw,'image/svg+xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('SVG格式错误');if(doc.querySelector('script,foreignObject,iframe')||[...doc.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)||(/href$/i.test(a.name)&&!a.value.startsWith('#')))))throw Error('只支持无脚本、无外部引用的SVG');edit.fig.querySelector('.ui-art').replaceChildren(document.importNode(doc.documentElement,true));}else{const next=edit.mode==='source'?JSON.parse($('#source-text').value):edit.draft;validate(next);graphs[edit.id]=next;renderAll();}dirty=true;$('#editor').close();toast('已应用到页面；请下载当前 HTML 保存。');}catch(e){$('#editor-error').textContent=e.message;}};
$('#cancel-edit').onclick=()=>{finishInline(true);$('#editor').close();};
$('#editor').addEventListener('close',()=>{finishInline(true);$('#editor').classList.remove('visual-editor');});
$('#editor').addEventListener('cancel',e=>{if(inlineEdit){e.preventDefault();finishInline(true);}});
$('#search').oninput=e=>{const q=e.target.value.trim().toLowerCase();let count=0;document.querySelectorAll('.search-unit').forEach(s=>{const ok=!q||s.textContent.toLowerCase().includes(q);s.hidden=!ok;if(ok){count++;s.querySelectorAll('.table-wrap').forEach(t=>t.hidden=false);if(q)s.querySelectorAll('details').forEach(d=>{if(d.textContent.toLowerCase().includes(q))d.open=true;});}});$('#search-status').textContent=q?`找到 ${count} 个章节`:'';};$('#clear-search').onclick=()=>{$('#search').value='';$('#search').dispatchEvent(new Event('input'));};
let fold=false;$('#toggle-tables').onclick=()=>{fold=!fold;document.querySelectorAll('.table-wrap').forEach(x=>x.hidden=fold);$('#toggle-tables').textContent=fold?'展开全部表格':'折叠全部表格';};
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.chapter').forEach(x=>x.hidden=false);}));
renderAll();
$('#save-html').onclick=()=>{const root=document.documentElement.cloneNode(true);root.querySelector('#graph-data').textContent=JSON.stringify(graphs,null,2).replace(/<\//g,'<\\/');root.querySelectorAll('dialog').forEach(d=>d.removeAttribute('open'));root.querySelector('#editor-body').replaceChildren();root.querySelector('#viewer-body').replaceChildren();root.querySelector('#search').setAttribute('value','');root.querySelector('#search-status').textContent='';root.querySelector('#toggle-tables').textContent='折叠全部表格';root.querySelector('#editor').classList.remove('visual-editor');root.querySelectorAll('.chapter,.table-wrap').forEach(x=>x.removeAttribute('hidden'));root.querySelector('#toast').style.display='none';const blob=new Blob(['<!doctype html>\n'+root.outerHTML],{type:'text/html;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='简单抽奖策划案.html';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);dirty=false;toast('已下载新 HTML；请放回附件包目录并替换原文件。');};
window.lotteryEditor={markSaved(){dirty=false;},getGraphs(){return clone(graphs);}};
$('#print').onclick=()=>{document.querySelectorAll('.chapter,.table-wrap').forEach(x=>x.hidden=false);window.print();};
window.addEventListener('beforeunload',e=>{if(dirty||($('#editor').open&&edit?.mode==='graph'&&(inlineEdit||JSON.stringify(edit.draft)!==JSON.stringify(graphs[edit.id])))){e.preventDefault();e.returnValue='';}});
})();
