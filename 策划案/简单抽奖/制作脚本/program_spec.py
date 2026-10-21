"""The program-facing rules and UI contract for the existing lottery design."""
import html

E = lambda s: html.escape(str(s))


def table(headers, rows):
    return '<div class="table-wrap"><table><thead><tr>' + ''.join('<th>'+E(x)+'</th>' for x in headers) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+E(x).replace('\n','<br>')+'</td>' for x in row)+'</tr>' for row in rows) + '</tbody></table></div>'


def code(s):
    return '<pre class="spec-code">'+E(s)+'</pre>'


FIELD_MEANINGS = {
    'LotteryPool': ['奖池唯一标识','是否允许新抽取','最低角色等级','单次付费抽取消耗的资源','固定消耗数量','每个刷新周期的免费次数上限','每天刷新所在小时','刷新时区'],
    'LotteryReward': ['条目唯一标识','所属奖池','发放的可叠加资源','此条目的固定发放数量','此条目的抽取权重','是否使用稀有结果表现'],
    'Resource': ['可叠加资源唯一标识','名称多语言键','图标资源键','数量显示单位'],
    'UiText': ['文案唯一键','中文模板','占位符定义列表'],
}

SHAPES = [
    ['pool','LotteryPool','单对象，恰好1个','本期一个常驻池；不按奖励数量复制奖池。'],
    ['entries','List<LotteryReward>','可变长；N≥1；无业务固定上限','按 poolId 关联，id 按字符码点升序；id不可重复，可重复引用相同 resourceId，按不同条目分别展示/抽取。N=0时禁止抽取。'],
    ['entries[i].resourceId','ResourceId = string','单值，恰好1个','仅支持可叠加资源；本版不支持独立装备实例、直接属性加成、技能授予或多项礼包。'],
    ['entries[i].count','int','单值，固定数量；≥1','每次命中此条目都发放 count；不是 list，不是随机 min/max，不接受小数。'],
    ['drawCount','int 常量','固定为1','每次操作只抽取1个条目；无十连和多选。'],
    ['result','DrawSuccess | null','可空单对象；成功时恰好1个','未成功或尚未确认时为 null；成功对象不是 List<Reward>。'],
    ['balances','Map<ResourceId, int>','玩家信息，0..N个键','非负整数余额；不存在的合法资源键按0读取；不是静态策划配置。'],
    ['UiText.params','List<string>','可变长；0..N','每项格式 name:type，type∈{string,int}；name唯一；[]表示无参数；不依赖数组顺序。'],
]

RESULT_TYPE = '''DrawSuccess {                // 成功结果的逻辑形状，不是接口协议
  entryId: string;            // 选中的唯一条目
  resourceId: string;         // 恰好一种可叠加资源
  count: int;                 // 固定正整数，不是列表或范围
  rare: bool;                 // 决定表现，不改变计算
  recovered: bool;            // 恢复展示时不重播动效
}
result: DrawSuccess | null;    // 一次成功 = 一个对象
phase: IDLE | SUBMITTING | PENDING | ANIMATING | RESULT;
usedCycleKey: int | null;      // 玩家上次使用免费次数的周期
freeUsed: int;                 // 该周期已用次数，0或1'''


def logic_html(flow):
    out = '<p>本期：单池、单抽、可叠加资源奖励。正文定义类型、数量、计算与UI行为；具体资源和数量是附件中的示例配置。</p>' + flow
    rules = [
        ['r-01','开放与刷新','新抽取要求配置有效、pool.enabled=true、角色等级≥unlockLevel。每日免费上限 dailyFree 为0或1，周期按 <a href="#f-01">周期与免费次数公式</a> 判断。读取页面、点击抽奖和跨周期时刷新；依据游戏统一时间。'],
        ['r-02','选择消耗方式','已接受的抽奖优先确认和展示，不能再发起一笔。新操作按配置有效→开放→等级→空闲→刷新免费→选择消耗校验。freeRemaining>0 优先免费，否则检查抽奖前余额 B[costResourceId]≥costCount。资源不足不消耗。'],
        ['r-03','抽取、发放、表现','按 <a href="#f-03">概率与抽取公式</a> 从 N 个条目中选且只选1个；按 <a href="#f-02">消耗公式</a> 扣除资源，按 <a href="#f-04">数量与余额公式</a> 发放该条目的固定count。成功结果确定并入账后才播放0.8秒过程表现。跳过只结束表现，不改变结果；结果为单对象，不设置领取步骤。'],
        ['r-04','重复操作与恢复','SUBMITTING、PENDING、ANIMATING、RESULT时禁止新抽。明确失败不扣免费次数和资源；不明状态显示PENDING，确认原结果，不当失败重抽。离开不撤销已接受的抽取；返回补展示未看过的成功结果，恢复时不重播动效、不重复发放。'],
        ['r-05','时间与配置边界','使用接受时的配置和刷新周期；接受后关闭奖池或修改权重不改变原结果。旧周期最后一秒接受、新周期展示，消耗旧周期免费，新周期资格保留。N=0、非正整数权重/数量、重复条目ID或引用缺失使整池不可用，禁止悄悄删除坏行后重新归一化。'],
    ]
    for anchor,title,body in rules:
        out += f'<h3 id="{anchor}">{title}</h3><p>{body}</p>'
    out += '<h3 id="formulas">计算公式、变量与边界</h3>'
    out += table(['变量','类型 / 单位','含义'],[
        ['t / h','int / UTC秒、小时','t为接受抽奖的时间；h=resetHour∈[0,23]；固定UTC+8时区。'],
        ['d / u / D','int|null / int / int','d=usedCycleKey，u=freeUsed∈{0,1}，D为当前周期键。'],
        ['F / C / B[x]','int / 次、资源单位','F为可用免费次数，C=costCount≥1，B[x]为抽取前资源余额。'],
        ['N / w_i / W','int / 条、无量纲','N为条目数；w_i>0；W为总权重，必须>0。'],
        ['p_i / r / S_i','比例 / int / int','p_i范围(0,1]；r是均匀随机整数；S_i为累计权重。'],
    ])
    formulas = [
        ('f-01','周期与免费次数', 'D(t) = floor((t + 8×3600 - h×3600) / 86400)\nusedToday = (d == D(t)) ? u : 0\nF = max(0, dailyFree - usedToday)', '时间达到刷新整点即进入新周期，等号归新周期；不累计未用次数。免费成功后 d=D(t)、u=usedToday+1；失败保持原值。'),
        ('f-02','消耗', 'costType = (F > 0) ? free : resource\npaidCost = (costType == free) ? 0 : C\n新抽取可支付 = (F > 0) OR (B[costResourceId] >= C)', 'costCount是单个固定整数。余额等于C允许抽取；不使用尚未获得的奖励垫付本次消耗。'),
        ('f-03','概率与抽取', 'W = Σ(w_i), i = 1..N\np_i = w_i / W\nS_0 = 0; S_i = Σ(w_j), j = 1..i\nr ∈ {0, 1, …, W-1}，每个整数等可能\n选择唯一满足 S_(i-1) <= r < S_i 的条目 i', '按id字符码点升序确定区间；采用左闭右开。r=0命中第一条，r=W-1命中最后一条。各次独立使用全池，同一条目可再次命中；无保底。'),
        ('f-04','数量与余额', 'rewardCount = entries[i].count\nB_after[x] = B_before[x]\n             - (x == costResourceId ? paidCost : 0)\n             + (x == result.resourceId ? rewardCount : 0)', '发放数量直接取正整数，不二次随机、不乘权重。消耗与奖励引用同一资源时合并计算净变化。一次成功只结算一次。本版假设可叠加资源无业务容量上限；项目若有上限，接入前补齐溢出规则，不默认截断或重抽。'),
        ('f-05','概率与数量的显示', '若 0 < 100×p_i < 0.01：显示 <0.01%\n否则 pct_i = floor(10000×w_i/W + 0.5) / 100\n按两位小数显示 pct_i + %\n数量：显示完整整数 + Resource.unit，不使用K/M缩写', '仅显示时四舍五入；实际抽取使用原始整数权重。四舍五入后合计可能不等于100.00%，不人为修改最后一项。名称和图标通过引用读取，不能按特定资源ID写表现分支。'),
    ]
    for anchor,title,formula,note in formulas:
        out += f'<h4 id="{anchor}">{title}</h4>'+code(formula)+'<p>'+E(note)+'</p>'
    out += '<details class="sample-config"><summary>展开一个纯权重边界算例</summary><p>权重[1,2,1]的区间是[0,1)、[1,3)、[3,4)，r=0/1/2/3分别命中第1/2/2/3条。把条目内容换成任意受支持资源，算法不变。算例不限制条目数。</p></details>'
    return out


def config_html(fields, diagram):
    out = '<h3 id="data-shapes">单值、列表与数量约束</h3>'+table(['数据','类型','形状 / 数量','边界与语义'],SHAPES)+code(RESULT_TYPE)+diagram
    out += '<p>本案共4张静态表。所有字段均必填且不可null；默认值用于新建配置，不把缺失字段默认为0。唯一ID字段不可空，按字符串保存。示例值不构成ID枚举或数量上限。</p>'
    for name,fs in fields.items():
        rows=[]
        for index,f in enumerate(fs):
            shape = 'list；0..N；[]合法；元素非空' if f[0]=='params' and name=='UiText' else '单值；恰好1；不可null'
            rows.append([f[0],FIELD_MEANINGS[name][index],f[1],shape,f[2]])
        out+=f'<h3 id="cfg-{name}">{name}</h3>'+table(['字段','含义','类型','数量 / 空值','约束 / 默认 / 引用'],rows)
    out+='<details class="sample-config"><summary>示例配置文件（用于验证规则，可替换内容）</summary><p>具体资源名、数量和权重只出现在这组样例及演示里；程序按上述结构和公式读取。</p>'
    out+='<p>'+' · '.join(f'<a href="配置表/{name}.csv">{name}.csv</a>' for name in fields)+'</p><p><a href="配置表/示例配置.json">样例 JSON</a> · <a href="配置表/字段字典.json">字段字典</a> · <a href="配置表/逻辑结构.json">逻辑结构与数量约束</a></p></details>'
    return out


UI_STATES = [
    ['已有原抽奖：PENDING','“结果确认中”；禁用抽取；无开奖动效','允许离开；返回继续确认；成功进入ANIMATING或恢复RESULT，明确失败才回IDLE。'],
    ['已有原抽奖：SUBMITTING','“处理中…”＋等待标记；禁用抽取','不显示已到账；无跳过按钮；重复点击无效果。'],
    ['已有原抽奖：ANIMATING','结果已成功，0.8秒过程动效；抽取禁用','显示“跳过表现”；跳过/时间结束进入RESULT；离开后保留成功结果。'],
    ['已有原抽奖：RESULT','UI-03居中显示；主页面抽取禁用','仅关闭返回IDLE；没有领取或再次随机。'],
    ['无原抽奖：数据未就绪','加载占位，数量显示“—”，主按钮禁用','不能把尚未加载的列表判为N=0或余额不足。'],
    ['配置无效 / N=0','列表显示“奖池暂不可用”；抽取/概率入口禁用','保留返回按钮；不呈现空白可点击槽位。'],
    ['enabled=false','“当前奖池暂未开放”；抽取禁用','返回可用；原抽奖仍按前四项完成。'],
    ['等级不足','“达到{unlockLevel}级开放”；抽取禁用','显示解锁条件，不显示免费红点。'],
    ['IDLE且F>0','“免费抽一次”；免费次数F/dailyFree；按钮可用','成功后刷新免费和余额；打开页面不清除红点。'],
    ['IDLE、F=0、B≥C','“抽一次（{C}{unit}{name}）”；按钮可用','点击后立即进入SUBMITTING；概率与免费相同。'],
    ['IDLE、F=0、B<C','消耗数量标红；按钮保留可点','点击显示UI-04资源不足；不扣除、不跳转充值。'],
]


def ui_detail(uid):
    if uid=='UI-01':
        return '<h4 id="ui-01-layout">控件布局与列表</h4>'+table(['控件','数据 / 数量','确定表现'],[
            ['01-A 奖池列表','entries：List，N≥1','960×560示意画布中，常规3列×2行可视；N>6时仅列表区纵向滚动。N=1或2从左起排，不补空槽。窄布局按项目适配减少列数，顺序不变。'],
            ['条目卡片','每条1个图标＋1个名称＋1个数量','按id升序；相同resourceId不合并；名称最多2行，超出省略，点击名称复用UI-04信息弹窗显示全文（仅关闭，无消耗）。数量完整整数；缺图用统一占位图，不能剔除此条目改变概率。'],
            ['01-B 抽一次','固定1个按钮','免费/消耗文案由F与C决定；主按钮固定在列表下方，不随列表滚动。状态规则见下表。'],
            ['免费次数与资源余额','各为整数单值','数据未就绪显示—；正常按当前玩家状态显示；成功结算及跨周期刷新。'],
        ])+'<h4 id="ui-01-states">状态优先级（从上到下匹配）</h4>'+table(['条件 / 状态','显示及按钮','操作 / 变化'],UI_STATES)
    if uid=='UI-02':
        return table(['区域','数量与布局','行为'],[
            ['概率行','List<ProbabilityRow>，与entries一一对应','每行图标、名称、固定数量、按“概率与数量的显示”公式计算的百分比；不按数量或概率重新排序。'],
            ['滚动区','固定6行可视，N>6纵向滚动','底部规则说明和关闭按钮不滚动；N<6不补空白行。'],
            ['状态','正常 / 配置失效','数据有效时显示；若配置关闭或失效，清除旧概率并显示暂不可用；关闭/返回回UI-01。'],
        ])
    if uid=='UI-03':
        return table(['状态','显示 / 动效','操作'],[
            ['普通成功：rare=false','恰好1个结果卡；图标、名称、count、已到账；亮边0.35秒','关闭按钮始终可用；关闭清理动效并刷新主页面。'],
            ['稀有成功：rare=true','同一个结果卡；背景光芒0.6秒，替代普通亮边','不叠加普通特效；不改变概率、数量和到账时点。'],
            ['恢复展示：recovered=true','只显示静态结果，不重播过程/结果动效或音效','重复打开不重复发奖；无领取按钮。'],
        ])
    return table(['原因 / 状态','确切反馈','操作与资源'],[
        ['名称全文','显示所点条目的完整资源名称','关闭返回来源页，无资源变化。'],
        ['余额不足','{name}不足，需要{count}{unit}','确认关闭；资源与免费不变。'],
        ['等级不足 / 关闭 / 配置无效','显示对应原因，不能统一提示网络错误','确认回主页面，主按钮按UI-01重新判断。'],
        ['明确失败','本次未完成抽奖，未消耗资源','确认后IDLE；可再次按正常规则发起新抽取。'],
        ['结果不明','结果确认中，请稍后查看','不显示失败、未扣费或再抽；允许离开；原结果确定后更新。'],
    ])


def enrich_ui(ui):
    main,prob,result,error=ui
    main.update(purpose='按可变长entries列表展示奖池；按玩家状态显示消耗，发起单次抽取。',states='加载、配置无效/空列表、关闭、锁定、免费可用、资源可支付、不足、SUBMITTING、PENDING、ANIMATING、RESULT。',lines=['奖池列表：entries[0..N-1]，N≥1','每项：icon / name / count（整数）','3列×2行可视；多于6项纵向滚动','底栏：freeRemaining / dailyFree；余额B'],buttons=['免费 / 消耗 C','返回'])
    main['controls'][0][1]='按entries动态创建N张卡片，id升序；不是固定3格；概率入口打开UI-02。'
    main['controls'][1][1]='F>0显示免费，否则显示C、单位和资源名；按状态表决定可用；余额不足点击打开UI-04。'
    main['controls'][2][1]='SUBMITTING/PENDING禁用且不能跳过；仅ANIMATING可跳过已确定结果的表现。'
    main['red']='配置有效且开放、等级满足、F>0且phase=IDLE时，主入口和主按钮亮红点。打开页面不消除；成功用掉免费、资格失效或进入处理中时重新判断。'
    prob['controls'][0][1]='遍历与主页面相同的N个条目，逐行显示引用名称、固定count和按“概率与数量的显示”公式计算的百分比；无固定奖励种类。'
    prob['lines']=['概率行：entries[0..N-1]','名称_i × count_i                 display(p_i)','p_i = weight_i / Σweight','固定6行可视；超出滚动','一次只返回一条结果；各次独立']
    result['controls'][0][1]='绑定单个DrawSuccess；rare控制普通/稀有表现，recovered控制是否重播；不得按具体resourceId分支。'
    result['lines']=['单结果区：DrawSuccess（不是List）','{name} × {count}  · {icon}','奖励已到账','rare：普通/稀有；恢复只展示静态结果']
    error['states'] += '、名称全文（复用信息提示）。'
    error['lines']=['原因提示','{name}不足，需要{count}{unit}','明确失败：未消耗资源','结果不明：确认中，不声明未扣费']
    return ui


def enrich_graphs(graphs):
    changes={'access2':'开放阈值 / 周期与免费次数\n免费数量：0或1\nUI-01状态优先级','pay2':'entries：List，N≥1\n单抽1条 / count固定整数\n消耗 / 概率与抽取','reward2':'DrawSuccess：单对象\n数量与余额 / 概率显示\nUI-03普通/稀有/恢复','produce2':'UI列表 / 单结果 / 状态变体\n3份独立制作需求Excel\n具体资源只作样例'}
    for n in graphs['M01']['nodes']:
        if n['id'] in changes:n['text']=changes[n['id']]
    for n in graphs['F01']['nodes']:
        if n['id']=='commit':n['text']='消耗0或C个资源单位\n按权重从N条中选1条\n发放该条固定count'
    for n in graphs['C01']['nodes']:
        if n['id']=='LotteryReward':n['text']=n['text'].replace('· 奖励','· 条目 [1..N]')
    graphs['C01']['edges'][0]['label']='N:1 · poolId → id'
    for gid in graphs:
        for n in graphs[gid]['nodes']:
            n['h']=max(n['h'],len(n['text'].split('\n'))*25+42)
    return graphs


def ui_svg(uid, fallback):
    if uid!='UI-01':return fallback
    cards=''
    for i in range(6):
        x=40+(i%3)*285;y=115+(i//3)*125
        cards+=f'<g><rect x="{x}" y="{y}" width="265" height="110" rx="8" fill="white" stroke="#b5cbbd"/><rect x="{x+14}" y="{y+17}" width="50" height="50" rx="5" fill="#e4eee5"/><text x="{x+22}" y="{y+48}" font-size="13">icon</text><text x="{x+77}" y="{y+40}" font-size="20">entries[{i}]</text><text x="{x+77}" y="{y+69}" font-size="17">name × count</text><text x="{x+14}" y="{y+94}" font-size="13" fill="#6a7f70">仅展示实际存在的条目</text></g>'
    return '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560"><rect width="960" height="560" fill="#f3f6f0"/><rect width="960" height="70" fill="#234a3b"/><text x="35" y="46" font-size="26" fill="white">UI-01 · 可变长列表与固定操作区</text><text x="40" y="97" font-size="16">entries：N≥1 · 3列×2行可视 · N&gt;6仅列表区滚动</text>'+cards+'<rect x="906" y="115" width="8" height="235" rx="4" fill="#dce4db"/><text x="40" y="407" font-size="22">免费次数 F / dailyFree     消耗资源余额 B</text><rect x="40" y="435" width="510" height="65" rx="9" fill="#27614f"/><text x="65" y="475" font-size="23" fill="white">免费抽一次 / 抽一次（C · unit · name）</text><text x="610" y="474" font-size="21">概率说明　　返回</text><text x="40" y="537" font-size="15" fill="#6a7f70">状态决定文案、可用性与动效；详见本页状态表。占位内容不限制具体奖励。</text></svg>'
