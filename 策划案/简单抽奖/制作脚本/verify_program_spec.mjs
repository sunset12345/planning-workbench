import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const dir=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(b,m)=>{if(!b)throw Error(m)};
try{
 await page.goto(pathToFileURL(path.join(dir,'简单抽奖策划案.html')).href);
 await page.locator('#data-shapes').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(import.meta.dirname,'类型结构预览.png')});
 await page.locator('#f-03').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(import.meta.dirname,'公式预览.png')});
 await page.locator('#ui-01').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(import.meta.dirname,'列表UI预览.png')});
 check(await page.locator('.sample-config:not([open])').count()===2,'Samples should start folded');
 const definitions=JSON.parse(await fs.readFile(path.join(dir,'配置表/字段字典.json'),'utf8'));
 check(definitions.LotteryReward.find(x=>x.field==='count').shape==='scalar','Quantity type');
 check(definitions.UiText.find(x=>x.field==='params').shape==='list','Params list type');
 await page.goto(pathToFileURL(path.join(dir,'抽奖演示稿.html')).href);await page.locator('#choose').selectOption('5');
 const boundary=await page.evaluate(()=>{const rows=[{id:'a',weight:1},{id:'b',weight:2},{id:'c',weight:1}];return [0,1,2,3].map(r=>chooseEntry(rows,r).id)});
 check(JSON.stringify(boundary)==='["a","b","b","c"]','Weighted interval boundaries');
 const pct=await page.evaluate(()=>[probabilityLabel(1,3),probabilityLabel(1,10001),probabilityLabel(1,10000),probabilityLabel(1,1)]);
 check(JSON.stringify(pct)==='["33.33%","<0.01%","0.01%","100.00%"]','Probability rounding');
 await page.locator('#entry-count').selectOption('1');check(await page.locator('.demo-entry').count()===1,'One item layout '+JSON.stringify(errors));
 await page.locator('#draw').click();await page.waitForTimeout(850);check((await page.locator('#result').textContent()).includes('已到账'),'Single item draw');
 check(await page.locator('#draw').isDisabled(),'Result state must block next draw');await page.locator('#result-close').click();
 const stable=await page.locator('#balances').textContent();
 for(const state of ['loading','closed','locked','pending']){await page.locator('#demo-state').selectOption(state);check(await page.locator('#draw').isDisabled(),'State must disable draw: '+state);}
 await page.locator('#demo-state').selectOption('ready');check((await page.locator('#balances').textContent())===stable,'State preview changed balance');
 await page.locator('#entry-count').selectOption('0');check(await page.locator('#draw').isDisabled(),'Empty pool');
 await page.locator('#entry-count').selectOption('8');check(await page.locator('.demo-entry').count()===8,'List was hardcoded');
 check(await page.locator('#demo-entries').evaluate(el=>el.scrollHeight>el.clientHeight),'Long list not scrolling');
 await page.screenshot({path:path.join(import.meta.dirname,'结构演示预览.png')});
 check(!errors.length,errors.join('\n'));console.log('PASS: type shapes, folded examples, weighted interval endpoints, percentage rounding, N=0/1/8, state priorities, scroll, no page errors.');
}finally{await browser.close();}
