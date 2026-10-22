/* Compact tree appearance shared by planning documents. No external dependencies. */
(() => {
  const NS='http://www.w3.org/2000/svg', cameras=new WeakMap(), mounts=new WeakMap();
  const make=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;};
  const childrenOf=g=>{const map=new Map(g.nodes.map(n=>[n.id,[]]));for(const e of g.edges)if(map.has(e.fromId)&&map.has(e.toId)&&!map.get(e.fromId).includes(e.toId))map.get(e.fromId).push(e.toId);return map;};
  function levels(g){
    const children=childrenOf(g),incoming=new Set(g.edges.map(e=>e.toId)),result=new Map(),roots=g.nodes.filter(n=>!incoming.has(n.id));
    const walk=(id,depth)=>{if(result.has(id))return;result.set(id,depth);for(const child of children.get(id)||[])walk(child,depth+1);};
    for(const n of [...roots,...g.nodes])walk(n.id,1);return result;
  }
  function lines(text,width,size){
    const result=[];for(const paragraph of String(text).split('\n')){let line='',used=0;for(const c of paragraph){const w=size*(/[^\x00-\xff]/.test(c)?1:.56);if(used+w>width&&line){result.push(line);line='';used=0;}line+=c;used+=w;}result.push(line);}return result;
  }
  function layout(g){
    const depth=levels(g),children=childrenOf(g),nodes=new Map(g.nodes.map(n=>[n.id,n])),placed=new Set();let cursor=24;
    const maxDepth=Math.max(...depth.values());
    function place(n){
      if(placed.has(n.id))return;placed.add(n.id);const d=depth.get(n.id),size=d===1?17:d<=3?14:13;
      n.x=d===1?24:d===2?230:448+(d-3)*250;n.w=d===1?136:d===2?146:d===maxDepth?544:178;
      const count=lines(n.text,n.w-(d<=2?36:24),size).length;n.h=Math.max(d===1?38:35,count*18+(d<=2?16:8));
      const kids=(children.get(n.id)||[]).filter(id=>depth.get(id)===d+1&&!placed.has(id)).map(id=>nodes.get(id));
      if(kids.length){kids.forEach(place);n.y=(kids[0].y+kids[0].h/2+kids.at(-1).y+kids.at(-1).h/2)/2-n.h/2;if(d===1)n.y=kids[0].y+kids[0].h/2-n.h/2;}
      else{n.y=cursor;cursor+=n.h+8;}
      if(d===2)cursor+=20;
    }
    g.nodes.filter(n=>depth.get(n.id)===1).forEach(place);g.nodes.forEach(place);g.layoutVersion=1;return g;
  }
  function subset(g,focus='all',limit=Infinity){
    const depth=levels(g),children=childrenOf(g),keep=new Set();
    const visit=id=>{if(keep.has(id))return;keep.add(id);for(const c of children.get(id)||[])visit(c);};
    if(focus==='all')g.nodes.forEach(n=>keep.add(n.id));else{visit(focus);g.nodes.filter(n=>depth.get(n.id)===1).forEach(n=>keep.add(n.id));}
    const selected={...g,nodes:g.nodes.filter(n=>keep.has(n.id)&&depth.get(n.id)<=limit).map(n=>({...n})),edges:g.edges.filter(e=>keep.has(e.fromId)&&keep.has(e.toId)&&depth.get(e.fromId)<=limit&&depth.get(e.toId)<=limit)};
    if(focus!=='all'||limit<Math.max(...depth.values()))layout(selected);
    return selected;
  }
  function svg(g,{onEdit,onJump,onFocus,interactive=true}={}){
    const depth=levels(g),nodes=new Map(g.nodes.map(n=>[n.id,n]));
    const width=Math.max(...g.nodes.map(n=>n.x+n.w))+24,height=Math.max(160,...g.nodes.map(n=>n.y+n.h+24));
    const s=make('svg',{viewBox:`0 0 ${width} ${height}`,class:'compact-mindmap-svg',role:'img','aria-label':g.title,'font-family':'Microsoft YaHei,PingFang SC,sans-serif'});
    s.append(make('title',{},g.title),make('rect',{width,height,fill:'#fff'}));
    for(const e of g.edges){const a=nodes.get(e.fromId),b=nodes.get(e.toId);if(!a||!b)continue;
      const x1=a.x+a.w+6,y1=a.y+a.h/2,x2=b.x-12,y2=b.y+b.h/2,lane=(x1+x2)/2,r=Math.min(7,Math.abs(y2-y1)/2),sign=y2>=y1?1:-1;
      const d=r?`M${x1} ${y1} H${lane-r} Q${lane} ${y1} ${lane} ${y1+sign*r} V${y2-sign*r} Q${lane} ${y2} ${lane+r} ${y2} H${x2}`:`M${x1} ${y1} H${x2}`;
      const edge=make('g',{class:'edge active',fill:'none',stroke:'#557aff','stroke-width':1.25,'stroke-linecap':'round','stroke-linejoin':'round'});edge.append(make('path',{d}));s.append(edge);
      if(e.label)edge.append(make('text',{x:lane+5,y:(y1+y2)/2-5,'font-size':11,fill:'#526081',stroke:'none'},e.label));
    }
    for(const n of g.nodes){const level=depth.get(n.id),size=level===1?17:level<=3?14:13,pad=level<=2?12:0;
      const textLines=lines(n.text,n.w-pad-24,size),group=make('g',{class:'node compact-mindmap-node','data-node':n.id,'data-level':level,transform:`translate(${n.x},${n.y})`,tabindex:0});
      group.append(make('rect',{width:n.w,height:n.h,rx:level===1?6:4,fill:level===1?'#4c72ff':level===2?'#f0f1f3':'transparent',stroke:'none'}));
      const label=make('text',{x:pad,y:(n.h-textLines.length*18)/2+14,'font-size':size,fill:level===1?'#fff':'#353940',...(level===1?{'font-weight':600}:{})});
      textLines.forEach((line,i)=>label.append(make('tspan',{x:pad,dy:i?18:0},line)));group.append(label);
      if(n.href){const link=make('a',{href:n.href,class:'node-jump','aria-label':'跳转：'+n.text.split('\n')[0]});if(!n.href.startsWith('#')){link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');}
        link.append(make('rect',{x:n.w-24,y:3,width:24,height:28,fill:'transparent',stroke:'none','pointer-events':'all'}),make('text',{x:n.w-17,y:Math.min(n.h-8,22),'font-size':12,fill:level===1?'#fff':'#557aff'},'↗'),make('title',{},'查看对应说明'));
        if(interactive)link.addEventListener('click',event=>{event.stopPropagation();if(n.href.startsWith('#')&&onJump){event.preventDefault();onJump(n.href);}});group.append(link);
      }
      if(interactive){let focusTimer;
        group.addEventListener('click',event=>{if(event.target.closest('a'))return;s.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',el===group));clearTimeout(focusTimer);if(level===2&&event.detail<2)focusTimer=setTimeout(()=>{if(s.isConnected)onFocus?.(n.id);},300);});
        group.addEventListener('dblclick',event=>{if(event.target.closest('a'))return;clearTimeout(focusTimer);event.preventDefault();onEdit?.(n.id);});
        group.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.target.closest('a')){event.preventDefault();onEdit?.(n.id);}});
      }s.append(group);
    }
    return s;
  }
  function viewport(stage,svg,changed){
    cameras.get(stage)?.destroy();const controller=new AbortController(),layer=document.createElement('div');layer.className='mindmap-pan-layer';
    const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height;svg.style.width=width+'px';svg.style.height=height+'px';layer.append(svg);stage.replaceChildren(layer);stage.classList.add('mindmap-viewport');stage.tabIndex=0;
    let scale=1,x=0,y=0,mode='width',drag=null,dragged=false,pinch=null;const pointers=new Map();
    const clamp=v=>Math.max(.05,Math.min(3,v)),update=()=>{layer.style.transform=`translate(${x}px,${y}px) scale(${scale})`;stage.dataset.scale=scale;stage.dataset.panX=x;stage.dataset.panY=y;changed?.(scale);};
    const point=e=>{const r=stage.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    function fit(next='all'){mode=next;scale=clamp(Math.min(1,(stage.clientWidth-32)/width,...(next==='all'?[(stage.clientHeight-32)/height]:[])));x=(stage.clientWidth-width*scale)/2;y=next==='all'?(stage.clientHeight-height*scale)/2:16;update();}
    function zoom(value,at={x:stage.clientWidth/2,y:stage.clientHeight/2}){const next=clamp(value);x=at.x-(at.x-x)*next/scale;y=at.y-(at.y-y)*next/scale;scale=next;mode='manual';update();}
    const listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:controller.signal});
    listen(stage,'wheel',e=>{e.preventDefault();zoom(scale*Math.exp(-Math.max(-400,Math.min(400,e.deltaY))*.002),point(e));},{passive:false});
    listen(stage,'pointerdown',e=>{if(e.button!==0&&e.pointerType!=='touch')return;const at=point(e);pointers.set(e.pointerId,at);if(pointers.size===1){drag={id:e.pointerId,at,x,y};dragged=false;if(!e.target.closest('.node'))stage.focus({preventScroll:true});}else if(pointers.size===2){const[a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale,world:{x:(mid.x-x)/scale,y:(mid.y-y)/scale}};dragged=true;}});
    listen(window,'pointermove',e=>{if(!pointers.has(e.pointerId))return;const at=point(e);pointers.set(e.pointerId,at);if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};scale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));x=mid.x-pinch.world.x*scale;y=mid.y-pinch.world.y*scale;}else{if(!drag||drag.id!==e.pointerId)return;const dx=at.x-drag.at.x,dy=at.y-drag.at.y;if(!dragged&&Math.hypot(dx,dy)<4)return;dragged=true;x=drag.x+dx;y=drag.y+dy;}mode='manual';stage.classList.add('is-panning');update();});
    for(const type of ['pointerup','pointercancel'])listen(window,type,e=>{pointers.delete(e.pointerId);pinch=null;if(pointers.size===1){const[id,at]=[...pointers.entries()][0];drag={id,at,x,y};}else{drag=null;stage.classList.remove('is-panning');}});
    listen(stage,'click',e=>{if(dragged){e.preventDefault();e.stopImmediatePropagation();dragged=false;}},{capture:true});
    listen(stage,'keydown',e=>{if(e.target!==stage)return;if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.key==='0')fit();else if(e.key==='+'||e.key==='=')zoom(scale*1.25);else if(e.key==='-')zoom(scale/1.25);else if(e.key.startsWith('Arrow')){x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;mode='manual';update();}});
    const observer=new ResizeObserver(()=>{if(mode!=='manual'&&stage.clientWidth)fit(mode);});observer.observe(stage);
    const api={fit,zoomIn:()=>zoom(scale*1.25),zoomOut:()=>zoom(scale/1.25),actual:()=>zoom(1),destroy(){controller.abort();observer.disconnect();cameras.delete(stage);}};cameras.set(stage,api);fit('width');return api;
  }
  function mount(g,stage,callbacks={}){
    mounts.get(stage)?.destroy();if(!g.layoutVersion)layout(g);
    const card=stage.closest('[data-graph]'),existing=card.querySelector('.mindmap-controls');existing?.remove();
    const bar=document.createElement('div');bar.className='graph-tools mindmap-controls';
    bar.innerHTML='<div class="mindmap-selectors"><label>查看分支 <select data-map-focus aria-label="查看导图分支"></select></label><label>显示层级 <select data-map-depth aria-label="导图显示层级"><option value="99">全部层级</option><option value="2">到分支</option><option value="3">到细项</option></select></label><button data-map-download>下载 SVG</button></div><p>滚轮缩放，拖动画布；手机支持双指缩放。点击分支聚焦，↗ 查看说明，双击文字编辑。</p><div class="mindmap-zoom-tools"><button data-map-out>−</button><output>100%</output><button data-map-in>＋</button><button data-map-fit>适应窗口</button><button data-map-width>适应宽度</button><button data-map-actual>100%</button></div>';
    stage.before(bar);stage.classList.add('compact-mindmap-stage');
    const focus=bar.querySelector('[data-map-focus]'),depth=bar.querySelector('[data-map-depth]'),depths=levels(g);
    for(const n of [{id:'all',text:'全部分支'},...g.nodes.filter(n=>depths.get(n.id)===2)]){const option=document.createElement('option');option.value=n.id;option.textContent=n.text.split('\n')[0];focus.append(option);}
    let camera,current;
    const render=()=>{current=svg(subset(g,focus.value,Number(depth.value)),{...callbacks,onFocus:id=>{focus.value=id;render();}});camera=viewport(stage,current,s=>bar.querySelector('output').textContent=Math.round(s*100)+'%');};
    focus.onchange=render;depth.onchange=render;
    for(const [selector,action]of [['out',()=>camera.zoomOut()],['in',()=>camera.zoomIn()],['fit',()=>camera.fit()],['width',()=>camera.fit('width')],['actual',()=>camera.actual()]])bar.querySelector('[data-map-'+selector+']').onclick=action;
    bar.querySelector('[data-map-download]').onclick=()=>{const copy=current.cloneNode(true);copy.removeAttribute('style');const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=g.title+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    render();mounts.set(stage,{destroy(){camera?.destroy();bar.remove();}});
  }
  window.PlanningMindmap={layout,levels,lines,svg,viewport,mount};
})();
