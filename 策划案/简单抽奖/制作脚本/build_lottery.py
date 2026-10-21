from pathlib import Path
import json,html,csv,re
import program_spec as spec
R=Path(__file__).resolve().parents[1];S=R/'制作脚本';E=lambda x:html.escape(str(x),quote=True)
def table(head,rows):return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+E(x)+'</th>' for x in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+str(x).replace('\n','<br>')+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def para(t):return '<p>'+t+'</p>'
def graph(k,title):return f'<div class="graph-card" data-graph="{k}"><div class="graph-tools"><strong>{title}</strong><button data-action="zoom">放大</button><button data-action="edit">编辑导图</button><button data-action="source">编辑 JSON 源码</button></div><div class="graph-stage"></div><p class="caption">双击节点直接改字；点击节点右下角“↗ 跳转”查看关联内容。编辑后应用修改，并下载当前 HTML 保存。</p></div>'
fields={
 'LotteryPool':[['id','string','必填；唯一；无默认','pool_daily'],['enabled','bool','必填；true开放、false关闭；默认false','true'],['unlockLevel','int','必填；角色等级≥1；无默认','5'],['costResourceId','string','必填；引用Resource.id；无默认','ticket'],['costCount','int','必填；固定消耗正整数≥1；单位随costResourceId；无默认','1'],['dailyFree','int','必填；本版0或1；每日免费次数；默认1','1'],['resetHour','int','必填；整点0—23；默认0','0'],['timezone','string','必填；本版固定Asia/Shanghai；UTC+8','Asia/Shanghai']],
 'LotteryReward':[['id','string','必填；唯一；无默认','reward_gold'],['poolId','string','必填；引用LotteryPool.id','pool_daily'],['resourceId','string','必填；引用Resource.id','gold'],['count','int','必填；单次获得量≥1；单位随Resource','100'],['weight','int','必填；正整数；概率=本行权重/同池总权重','60'],['rare','bool','必填；默认false；仅控制表现，不影响权重','false']],
 'Resource':[['id','string','必填；唯一非空字符串；任意合法的可叠加资源ID；非固定枚举','gold'],['nameKey','string','必填；引用UiText.key','res.gold'],['iconKey','string','必填；引用美术需求资源键；按美术需求提供对应资源','icon_gold'],['unit','string','必填；展示计量单位；无默认','枚']],
 'UiText':[['key','string','必填；唯一；无默认','lottery.free'],['zhCN','string','必填；中文原文；不可空','免费抽一次'],['params','string[]','默认[]；元素为name:type，type为string/int；name唯一；无参数为[]','[]']]
}
texts=[('res.gold','金币',[]),('res.stone','强化石',[]),('res.gem','晶石',[]),('res.ticket','抽奖券',[]),('lottery.title','每日补给',[]),('lottery.free','免费抽一次',[]),('lottery.cost','抽一次（{count}{unit}{name}）',['count:int','unit:string','name:string']),('lottery.rate','奖池概率',[]),('lottery.refresh','免费次数每日{hour}:00刷新（UTC+8）',['hour:string']),('lottery.draw','抽取中…',[]),('lottery.result','获得 {name} × {count}',['name:string','count:int']),('lottery.done','奖励已到账',[]),('lottery.close','关闭',[]),('lottery.skip','跳过表现',[]),('lottery.insufficient','{name}不足，需要{count}{unit}',['name:string','count:int','unit:string']),('lottery.closed','当前奖池暂未开放',[]),('lottery.locked','角色达到{level}级后开放',['level:int']),('lottery.pending','结果确认中，请稍后查看',['']),('lottery.failed','本次未完成抽奖，未消耗资源',[]),('lottery.confirm','确认',[])]
texts[17]=('lottery.pending','结果确认中，请稍后查看',[])
texts += [('lottery.unavailable','奖池暂不可用',[]),('lottery.loading','加载中…',[]),('lottery.processing','处理中…',[])]
data={'LotteryPool':[dict(zip([x[0]for x in fields['LotteryPool']],['pool_daily',True,5,'ticket',1,1,0,'Asia/Shanghai']))],
'LotteryReward':[{'id':'reward_'+k,'poolId':'pool_daily','resourceId':k,'count':n,'weight':w,'rare':r}for k,n,w,r in [('gold',100,60,False),('stone',5,30,False),('gem',1,10,True)]],
'Resource':[dict(id=k,nameKey='res.'+k,iconKey='icon_'+k,unit=u)for k,u in [('gold','枚'),('stone','个'),('gem','颗'),('ticket','张')]],
'UiText':[dict(key=k,zhCN=v,params=a)for k,v,a in texts]}
for name,rows in data.items():
 with (R/'配置表'/f'{name}.csv').open('w',newline='',encoding='utf-8-sig')as f:
  w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows({k:json.dumps(v,ensure_ascii=False)if isinstance(v,(list,bool))else v for k,v in row.items()}for row in rows)
(R/'配置表/示例配置.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
dictionary={name:[dict(field=f[0],meaning=spec.FIELD_MEANINGS[name][i],type=f[1],shape='list' if f[0]=='params' else 'scalar',cardinality='0..N' if f[0]=='params' else '1',nullable=False,constraints=f[2]) for i,f in enumerate(fs)]for name,fs in fields.items()}
(R/'配置表/字段字典.json').write_text(json.dumps(dictionary,ensure_ascii=False,indent=2))
(R/'配置表/逻辑结构.json').write_text(json.dumps([dict(zip(['data','type','cardinality','rules'],row))for row in spec.SHAPES],ensure_ascii=False,indent=2))
def node(i,t,x,y,w=260,h=75):return dict(id=i,text=t,x=x,y=y,w=w,h=h)
def edge(i,a,b,l=''):return dict(id=i,fromId=a,toId=b,label=l)
graphs={
'M01':dict(title='抽奖功能导图',nodes=[node('root','简单抽奖',20,270,180),node('access','进入与每日免费',280,20),node('pay','消耗与抽取',280,210),node('reward','结果与恢复',280,400),node('produce','制作需求',280,590),node('access2','Lv5开放 / 每日1次\n00:00 UTC+8刷新\nUI-01 主页面',640,20,360,110),node('pay2','免费优先 / 单抽1张券\n60%金币 / 30%强化石 / 10%晶石\nUI-02 概率说明',640,210,470,110),node('reward2','成功后奖励直接入账\n不明状态先确认，不重新抽\nUI-03结果 / UI-04提示',640,400,410,110),node('produce2','4图标 / 4页面＋3组件\n3个特效 / 3份独立Excel\nHTML可操作演示',640,590,410,110)],edges=[edge('e'+str(i),'root',a)for i,a in enumerate(['access','pay','reward','produce'])]+[edge('l'+str(i),a,a+'2')for i,a in enumerate(['access','pay','reward','produce'])]),
'F01':dict(title='单次抽奖流程',nodes=[node('click','点击抽一次',20,35),node('check','检查开放、等级\n刷新免费资格 / 检查券数量',350,35,330,100),node('commit','确认免费或券抽\n消耗一次资格/1张券\n按权重选定并发放1项奖励',780,35,350,130),node('result','结果已确定\n播放表现 / UI-03展示',780,270,350,100),node('fail','条件不满足 / 明确失败\nUI-04提示；不消耗',350,270,330,100),node('pending','结果不明\n确认原结果，禁止重新抽取',350,490,330,100)],edges=[edge('f1','click','check'),edge('f2','check','commit','满足条件'),edge('f3','check','fail','未满足'),edge('f4','commit','result','已成功'),edge('f5','commit','pending','暂未获知结果'),edge('f6','pending','result','原结果成功'),edge('f7','pending','fail','原结果失败')]),
'C01':dict(title='配置表结构与引用',nodes=[node('LotteryPool','LotteryPool · 奖池\n'+'\n'.join(x[0]+': '+x[1]for x in fields['LotteryPool']),30,30,370,290),node('LotteryReward','LotteryReward · 奖励\n'+'\n'.join(x[0]+': '+x[1]for x in fields['LotteryReward']),500,30,400,240),node('Resource','Resource · 资源\n'+'\n'.join(x[0]+': '+x[1]for x in fields['Resource']),30,490,370,180),node('UiText','UiText · 文案\n'+'\n'.join(x[0]+': '+x[1]for x in fields['UiText']),500,490,400,160)],edges=[edge('c1','LotteryReward','LotteryPool','poolId → id'),edge('c2','LotteryPool','Resource','costResourceId → id'),edge('c3','LotteryReward','Resource','resourceId → id'),edge('c4','Resource','UiText','nameKey → key')])}
node_links={
'M01':{'root':'#section-3','access':'#r-01','pay':'#r-02','reward':'#r-04','produce':'#section-10','access2':'#ui-01','pay2':'#ui-02','reward2':'#ui-03','produce2':'需求表/简单抽奖_UI需求.xlsx'},
'F01':{'click':'#ui-01','check':'#r-02','commit':'#r-03','result':'#ui-03','fail':'#ui-04','pending':'#r-04'},
'C01':{name:'#cfg-'+name for name in fields}}
for gid,links in node_links.items():
 for n in graphs[gid]['nodes']:
  n['href']=links.get(n['id'],'')
  n['h']=max(n['h'],len(n['text'].split('\n'))*25+42)

ui=[
dict(id='UI-01',name='抽奖主页面',entry='主界面“每日补给”入口',purpose='查看本期奖励、免费资格与券数量，发起一次抽奖。',states='免费可用、免费已用且券足、券不足、抽取中、结果确认中、未解锁、奖池关闭。',controls=[['01-A 奖池展示','显示金币100、强化石5、晶石1；点击“概率”打开UI-02'],['01-B 抽一次','免费可用显示“免费抽一次”；否则显示“抽一次（1张券）”；点击按“选择消耗方式”规则校验；券不足打开UI-04'],['01-C 状态反馈','抽取中与结果确认中禁用重复点击；前者可跳过表现；结果不明不能跳过确认'],['01-D 返回','空闲直接返回；已发起时离开不取消已确认的奖励，恢复后按“重复操作与恢复”规则展示']],red='免费资格可用时，入口及主按钮显示一个红点；打开页面不清除；成功消耗免费资格后清除；付费券充足不亮红点。',lines=['每日补给   奖池概率 >','金币 ×100        强化石 ×5        晶石 ×1','免费次数 1/1                    抽奖券 3','免费次数每日00:00刷新（UTC+8）'],buttons=['免费抽一次','返回']),
dict(id='UI-02',name='奖池概率弹窗',entry='UI-01 点击“奖池概率”',purpose='完整说明当前奖池奖励与真实概率，不消耗任何资源。',states='正常、奖池关闭或配置无效。',controls=[['02-A 奖励列表','显示金币100：60%、强化石5：30%、晶石1：10%；数值随同池有效配置权重计算'],['02-B 说明','每次独立抽取，仅发1项，无保底；概率不是累计承诺'],['02-C 关闭','关闭或返回键回UI-01；不改变免费次数和券数量']],red='本页不新增红点；打开/关闭不消除主页面免费提示。',lines=['奖池概率','金币 ×100                  60%','强化石 ×5                  30%','晶石 ×1                    10%','每次独立抽取，无保底；仅获得其中1项。'],buttons=['关闭']),
dict(id='UI-03',name='抽奖结果弹窗',entry='本次奖励成功确定并结束或跳过表现后',purpose='展示本次唯一奖励、数量及已到账状态。',states='普通奖励、稀有奖励、恢复展示。',controls=[['03-A 奖励内容','展示已确定的奖励；晶石为稀有表现；不在动画结束时二次随机'],['03-B 已到账','结果弹出前发放已完成，不设置领取按钮'],['03-C 关闭','关闭返回UI-01并刷新资源/免费状态；重复查看不重复发奖']],red='本页无红点；结果不产生可领奖红点。',lines=['获得奖励','晶石 ×1','奖励已到账','关闭不会丢失奖励'],buttons=['关闭']),
dict(id='UI-04',name='通用提示与确认状态',entry='UI-01 操作未满足条件或结果暂不明确',purpose='明确告知是否扣费，以及玩家接下来可以做什么。',states='券不足、等级不足、奖池关闭、明确失败、结果确认中。',controls=[['04-A 条件提示','券不足/等级不足/关闭时显示具体原因；确定关闭；不跳转未定义的充值商店'],['04-B 明确失败','显示“本次未完成抽奖，未消耗资源”；确定后返回空闲'],['04-C 结果确认中','显示“结果确认中，请稍后查看”；不显示失败或再抽按钮；允许离开，返回继续确认原结果']],red='本页无独立红点；失败不消耗免费资格，主入口红点按“开放与刷新”规则重新判断。',lines=['提示','抽奖券不足，需要1张','本次未消耗资源','另一状态：结果确认中，请稍后查看'],buttons=['确认'])]
ui=spec.enrich_ui(ui)
graphs=spec.enrich_graphs(graphs)
art=[]
for i,(key,name,brief)in enumerate([('gold','金币','金色币堆剪影，数量不烘焙进图'),('stone','强化石','蓝灰色锻造石；与晶石轮廓区分'),('gem','晶石','紫色晶簇；稀有性也用名称与标记表达'),('ticket','抽奖券','带抽奖符号的券面，避免与奖励图标混淆')]):art.append([f'ART-{i+1:03}',f'icon_{key}',name+'图标','资源图标',f'Resource.{key}',1,'张',brief,'建议源稿512×512，导出256×256透明PNG','分层PSD或可编辑SVG＋透明PNG','优先复用同类资源，无匹配资源时新增','../简单抽奖策划案.html#section-5'])
uir=[]
for i,u in enumerate(ui):uir.append([f'UIR-{i+1:03}',u['id'],u['name'],u['entry'],u['states'],'；'.join(c[1]for c in u['controls']),'按V0.6线框与状态表制作；列表按N生成，主页面3列×2行可视，超出滚动；结果固定1卡；长文与数量分层','ART-001—004；VFX-001—003','可编辑页面源稿、状态页、独立切图','../简单抽奖策划案.html#'+u['id'].lower()])
for i,(key,name,desc)in enumerate([('CMP-BUTTON','抽奖按钮状态','免费/资源支付/不足/加载/锁定/处理中/确认中/动画/结果等状态；按UI-01优先级；动态文案不烘焙'),('CMP-DOT','免费资格红点','入口与按钮共用；静态提示，成功用掉免费后消除'),('CMP-MODAL','弹窗框架','概率/结果/错误复用外框，内容独立；正常/按下/禁用按钮')],5):uir.append([f'UIR-{i:03}',key,name,'UI-01—04','按关联页面状态',desc,'可伸缩背景；图标和文字分层；至少覆盖最长中文文案','UI-01—04','可编辑组件源稿、切图','../简单抽奖策划案.html#section-5'])
vfx=[]
for i,a in enumerate([
 ['抽奖过程','抽奖主页面 / 抽取、发放、表现','本次结果已确认成功','中央奖池区域轻量光环','建议0.8秒','单次；跳过时立即结束','离开界面停止；结果不明时不播开奖','同一抽奖最多一个过程表现','不制造假概率轮盘；不遮挡结果确认状态','SFX-01','VFX工程源文件＋预览视频'],
 ['普通奖励结果','抽奖结果弹窗 / 抽取、发放、表现','rare=false且已发放，首次展示结果','奖励图标短亮边','建议0.35秒','单次；显示静态结果后结束','关闭弹窗清理；恢复结果不重播','不与稀有表现同时播放','数量和已到账文案优先可读','ART-001/002；SFX-02','VFX工程源文件＋预览视频'],
 ['稀有奖励结果','抽奖结果弹窗 / 抽取、发放、表现','rare=true且已发放，首次展示结果','结果图标背后紫金短光芒','建议0.6秒','单次；结束后保持图标','关闭弹窗清理；恢复结果不重播','替代普通表现；不改变概率和发放','无整屏白闪；不遮挡关闭按钮','ART-003；SFX-03','VFX工程源文件＋预览视频']
]):vfx.append([f'VFX-{i+1:03}',*a,'../简单抽奖策划案.html#section-5'])
requirements={'美术需求':art,'UI需求':uir,'特效需求':vfx};(S/'requirements.json').write_text(json.dumps(requirements,ensure_ascii=False,indent=2))
def svg(u):
 lines=''.join(f'<text x="65" y="{140+i*52}" font-size="24" fill="#234339">{E(x)}</text>'for i,x in enumerate(u['lines']))
 buttons=''.join(f'<g><rect x="{65+i*280}" y="450" width="240" height="56" rx="9" fill="#27614f"/><text x="{90+i*280}" y="486" font-size="23" fill="white">{E(x)}</text></g>'for i,x in enumerate(u['buttons']))
 base=f'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560"><rect width="960" height="560" fill="#f3f6f0"/><rect width="960" height="70" fill="#234a3b"/><text x="35" y="46" font-size="26" fill="white">{u["id"]} {u["name"]} · 线框示意</text><rect x="35" y="95" width="890" height="320" rx="12" fill="white" stroke="#dce4db"/>{lines}{buttons}<text x="35" y="540" font-size="15" fill="#718476">静态信息与状态示意；不代表最终视觉规范。</text></svg>'
 return spec.ui_svg(u['id'],base)
(R/'图示').mkdir(exist_ok=True)
for u in ui:(R/'图示'/f'{u["id"]}.svg').write_text(svg(u))
content=[]
def section(n,title,text):content.append(f'<section class="chapter search-unit" id="section-{n}"><h2>{n}. {title}</h2>{text}</section>')
section(1,'修订记录',table(['版本 / 日期','来源与修改'],[['V0.1 / 2026-10-22','用户要求简单抽奖案；自主设计玩法、HTML图示编辑、4页UI及3份制作需求Excel；规格和数值为建议初值。'],['V0.2 / 2026-10-22','根据用户反馈，增加双击编辑、快捷新增、拖动、撤销与节点超链接。'],['V0.3 / 2026-10-22','补齐类型/列表基数、参数化公式、状态和UI布局；折叠样例配置。'],['V0.4 / 2026-10-22','规则与公式标题改用自然名称，保留跳转。'],['V0.5 / 2026-10-22','移除首页数据类型摘要卡片，详细类型与数量约束集中在配置章节。'],['V0.6 / 2026-10-22','按用户要求移除文档与制作进度字段；补齐稳定标识、工作台导入数据和成套导出；同步三份制作需求表。玩法、公式、配置数值沿用V0.5。']]))
section(2,'可编辑思维导图',para('双击节点即可进入画布直接改字。选中节点后 Tab 新增子节点，Enter 新增同级，拖动调整位置；支持撤销/重做。右侧可选择正文、UI、附件或粘贴网页超链接。点击节点“↗ 跳转”直接查看关联内容。应用修改后，下载当前 HTML 保存；本地文件不提供多人实时协作。')+graph('M01','功能导图'))
section(3,'功能逻辑与计算公式',spec.logic_html(graph('F01','抽奖主流程')))
section(4,'配置类型与数量结构',spec.config_html(fields,graph('C01','配置结构与引用基数')))
uicont=table(['页面','入口','说明'],[[u['id']+' '+u['name'],u['entry'],f'<a href="#{u["id"].lower()}">打开本页</a>']for u in ui])
for u in ui:uicont+=f'<h3 id="{u["id"].lower()}">{u["id"]} {u["name"]}</h3><figure class="ui-figure" data-ui="{u["id"]}"><div class="graph-tools"><strong>UI 示意图</strong><button data-action="zoom-ui">放大</button><button data-action="svg">编辑 SVG 源码</button></div><div class="ui-art">{svg(u)}</div></figure>'+para('入口：'+u['entry']+'。'+u['purpose'])+para('状态：'+u['states'])+table(['控件','显示 / 操作 / 反馈'],u['controls'])+para('配置与状态：LotteryPool开放/免费/券消耗；LotteryReward奖励与概率；Resource/UiText图文；玩家等级、免费日期、券数量与当前抽奖结果。公共规则见 <a href="#section-3">功能逻辑与计算公式</a>。')+para('<b>本页红点：</b>'+u['red'])+spec.ui_detail(u['id'])
section(5,'UI 示意图与逐页逻辑',uicont)
section(6,'多语言',para(f'新增{len(texts)}个Key，中文已拟定，目标语言范围尚未提供。含参数的文本使用命名占位符；按钮允许伸缩，错误提示换行，避免拼接句子。')+table(['Key','中文原文','参数'],[[k,E(v),', '.join(a)or'无']for k,v,a in texts]))
section(7,'音效需求',para('以下仅是制作需求，未提供声音素材。若项目已有匹配的通用音效，优先复用。')+table(['ID','触发与内容','停止与复用要求'],[['SFX-01','成功确定结果后播放短抽奖过程声','跳过/离开立即停；需提供对应音效'],['SFX-02','rare=false结果首次展示时播放获得声','单次，不循环；优先复用匹配音效'],['SFX-03','rare=true结果首次展示时播放稀有获得声','替代普通获得声；关闭即停；需提供对应音效']]))
section(8,'红点逻辑索引',para('具体逻辑已经写在各 UI 页。入口与主按钮只提示可用免费资格；券足不提示，结果无可领奖红点。每日刷新、等级变化、奖池开放状态变化或抽奖成功后重新判断。')+table(['位置','规则入口'],[['主入口/主按钮','<a href="#ui-01">UI-01 免费红点</a>'],['其他页面','<a href="#ui-02">UI-02</a> / <a href="#ui-03">UI-03</a> / <a href="#ui-04">UI-04</a>：无独立红点']]))
section(9,'业务打点（建议）',table(['事件','何时记录','业务字段'],[['lottery_open','页面实际打开','poolId:string、入口:string、freeAvailable:bool'],['lottery_click','点击抽一次','poolId:string、预期消耗方式:free/ticket；只计意图'],['lottery_result','一次抽奖原结果最终确定后','poolId:string、result:success/fail、costType:free/ticket/none、rewardId:string?、rewardCount:int、reason:string?；成功时记录实际消耗'],['lottery_result_view','结果首次展示','poolId:string、rewardId:string、recovered:bool；只统计展示']])+para('结果不明不记失败；关闭已完成结果不改为取消；同一抽奖恢复查看不新增成功次数。概率弹窗和失败提示关闭只计查看行为，不算抽奖成功。'))
section(10,'制作需求与演示附件','<div class="attachments">'+''.join(f'<a class="attachment" href="需求表/简单抽奖_{k}.xlsx"><b>{k}.xlsx</b><span>{len(v)}条独立需求</span></a>'for k,v in requirements.items())+'<a class="attachment" href="抽奖演示稿.html"><b>HTML 演示稿</b><span>翻页说明＋可操作单抽</span></a></div>'+para('三份需求表统一为V0.6；用ART/UIR/VFX编号关联。表格说明制作规格、触发条件和交付物要求。演示稿使用本地样例数据，不连接真实账户，刷新即重置。'))
css=(S/'html_style.css').read_text(); js=(S/'html_editor.js').read_text()+'\n'+(S/'workbench_export.js').read_text()
titles=['修订记录','可编辑思维导图','逻辑与公式','配置类型与数量','UI示意图','多语言','音效需求','红点逻辑','业务打点','制作附件']
nav=''.join(f'<a href="#section-{i+1}">{i+1}. {t}</a>'for i,t in enumerate(titles))
out=f'''<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>简单抽奖｜功能策划案</title><style>{css}</style></head><body><aside class="sidebar"><a class="brand" href="#top"><small>功能策划 / V0.6</small><strong>简单抽奖</strong><span>每日免费 · 券抽 · 固定奖池</span></a><nav>{nav}</nav><p>HTML 正式维护入口<br>离线可读 / 图示可编辑</p></aside><main><header class="hero" id="top"><div class="eyebrow">GAME FEATURE DESIGN</div><h1>每日补给，单次抽奖</h1><p class="lead">单池、单抽；奖池为可变长列表，单次结果为一个对象。</p><p>V0.6 · 2026-10-22</p><p>程序阅读入口：类型与数量结构、计算公式、UI状态和表现。具体奖励仅作样例；玩法规则与制作规格见对应章节。</p><div class="toolbar"><a class="button" href="#section-2">查看导图</a><a class="button secondary" href="抽奖演示稿.html">打开演示</a><a class="button secondary" href="#section-10">制作需求 Excel</a><button id="save-package">下载完整资料包</button><button id="save-html">下载当前 HTML</button><button id="print">打印</button></div><div class="stats"><div><b>4</b>UI 页面</div><div><b>1</b>单次结果对象</div></div></header><div class="search-bar"><label for="search">搜索全文</label><input id="search" placeholder="输入规则、UI、字段或奖励"><button id="clear-search">清除</button><button id="toggle-tables">折叠全部表格</button><span id="search-status" aria-live="polite"></span></div>{''.join(content)}<footer>本案由用户授权自主设计。图示源码、UI SVG、正文和需求附件可独立维护；改图后需同步核对相关规则。</footer></main><dialog id="editor"><form method="dialog"><header><h2 id="editor-title">编辑图示</h2><button value="cancel">关闭</button></header></form><div id="editor-body"></div><p id="editor-error" role="alert"></p><div class="toolbar"><button id="apply-edit">应用修改</button><button id="cancel-edit">取消</button></div></dialog><dialog id="viewer"><form method="dialog"><button>关闭大图</button></form><div id="viewer-body"></div></dialog><div id="toast" role="status"></div><!-- 编辑以下 graph-data 可维护节点和独立连线；也可用页内编辑器。 --><script type="application/json" id="graph-data">{json.dumps(graphs,ensure_ascii=False,indent=2).replace('</','<\\/')}</script><script>{js}</script></body></html>'''
from workbench_metadata import prepare_html
(R/'简单抽奖策划案.html').write_text(prepare_html(out, R))
demo_script=(S/'program_demo.js').read_text()
demo_slides=[('<div class="eyebrow">功能演示 / V0.6</div><h1>简单抽奖</h1><p class="lead">可变长奖池列表；固定单结果和数量；按公式判定与展示。</p><p>本演示包含4页UI讲解和可操作的样例单抽。使用演示数据，刷新重置，不连接真实账户；不演示跨日、断线和正式特效。</p><a class="button" href="简单抽奖策划案.html">返回完整策划案</a>','方案概览')]
for u in ui:demo_slides.append((f'<h1>{u["id"]} {u["name"]}</h1><div class="ui-art">{svg(u)}</div>'+para(u['purpose'])+para(u['states']),u['name']))
demo_slides.append(('<h1>结构与状态演示</h1><p>配置内容仅作样例；遍历N条、按权重计算、固定返回1条结果。</p><div class="demo-controls"><label>条目数量 <select id="entry-count"><option value="0">0：空配置</option><option value="1">1条</option><option value="3" selected>3条</option><option value="8">8条：滚动</option></select></label><label>状态预览 <select id="demo-state"><option value="ready">正常</option><option value="loading">加载</option><option value="closed">关闭</option><option value="locked">锁定</option><option value="pending">结果确认中</option></select></label></div><p id="demo-status"></p><div id="demo-entries" class="demo-entries"></div><div id="balances"></div><div class="toolbar"><button id="draw">免费抽一次</button><button id="reset">重置演示数据</button></div><p id="result" class="demo-result" role="status">点击按钮开始。</p><button id="result-close" hidden>关闭结果</button><p id="formula-trace" class="caption"></p><p class="caption">这里只演示列表、状态、计算和单抽；状态预览不发起真实请求。实际跨日、断线恢复和正式特效由正文定义。</p>','可操作结构演示'))
demo=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>简单抽奖演示稿</title><style>{css}</style></head><body class="deck"><main>'+''.join(f'<section class="slide">{x}</section>'for x,t in demo_slides)+'</main><div class="deck-nav"><button id="prev">上一页</button><select id="choose">'+''.join(f'<option value="{i}">{i+1}. {E(t)}</option>'for i,(x,t)in enumerate(demo_slides))+'</select><span id="counter" class="slide-counter"></span><button id="next">下一页</button></div><script>'+demo_script+'</script></body></html>'
demo=demo.replace('<script>', '<script type="application/json" id="demo-data">'+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+'</script><script>', 1)
(R/'抽奖演示稿.html').write_text(demo)
(R/'简单抽奖策划案.html').write_text(prepare_html(out, R))
print('HTML created; fields',sum(map(len,fields.values())),'UI',len(ui),'art/ui/vfx',*[len(x)for x in requirements.values()])
