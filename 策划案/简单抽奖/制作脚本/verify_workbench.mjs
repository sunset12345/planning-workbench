import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
const documentPath=path.join(root,'简单抽奖策划案.html');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'lottery-v07-'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sha=data=>createHash('sha256').update(data).digest('hex');
const get=()=>page.evaluate(async()=>{const r=await window.planningExport.snapshot();return {...r,files:r.files.map(f=>({path:f.path,data:Array.from(f.data)}))};});
function validate(result){
 assert.equal(result.planning.source.htmlSha256,sha(result.html));
 const p=result.planning, sections=p.document.sections,blocks=sections.flatMap(s=>s.blocks);
 assert.equal(sections.length,10);assert.equal(p.diagrams.length,7);
 assert.equal(p.project,null);assert.equal(p.features[0].systemId,null);
 const ids=[p.document.id,...p.features.map(x=>x.id),...sections.map(x=>x.id),...blocks.map(x=>x.id),...p.diagrams.map(x=>x.id),...p.attachments.map(x=>x.id),...p.relations.map(x=>x.id)];
 assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
 const blockIds=new Set(blocks.map(b=>b.id)),allIds=new Set(ids);
 for(const b of blocks) for(const r of b.references) assert(allIds.has(r.targetId),'Dangling reference');
 for(const d of p.diagrams) assert(blockIds.has(d.blockId));
 for(const r of p.relations) assert(blockIds.has(r.fromId)&&blockIds.has(r.toId));
 for(const a of p.attachments) assert.equal(a.sha256,sha(Uint8Array.from(result.files.find(f=>f.path===a.path).data)));
 assert(!JSON.stringify(p).match(/workflowStatus|fillStatus|制作状态|计划交付日期/));
 return blocks;
}
try {
 await page.goto(pathToFileURL(documentPath).href);
 const original=await get();const blocks=validate(original);
 // All ten chapters are completely represented, not just their summaries.
 assert(await page.evaluate(()=>[...document.querySelectorAll('.chapter')].every(s=>[...s.children].every(c=>c.tagName==='H2'||c.hasAttribute('data-block-id')))));
 // Baseline formulas and gameplay rules must retain their text.
 const baseline=await browser.newPage();await baseline.goto(pathToFileURL('/tmp/lottery-v06-mindmap-before/简单抽奖策划案.html').href);
 const before=await baseline.locator('#section-3').innerText();
 assert.equal(await page.locator('#section-3').innerText(),before);
 await baseline.close();
 await fs.writeFile(documentPath,original.html);
 await fs.writeFile(path.join(root,'planning.json'),JSON.stringify(original.planning,null,2)+'\n');
 for(const f of original.files)await fs.writeFile(path.join(root,f.path),Uint8Array.from(f.data));
 await page.goto(pathToFileURL(documentPath).href);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save-package').click()]);
 await download.saveAs(path.join(root,'简单抽奖策划案_完整资料包.zip'));
 await page.screenshot({path:path.join(import.meta.dirname,'首页预览.png')});
 // Renaming and reordering existing content must preserve identity.
 await page.evaluate(()=>{const b=document.querySelector('[data-anchor="r-01"]');b.querySelector('h3').textContent='更名检查';b.parentElement.append(b);});
 const changed=await get();validate(changed);
 assert.equal(changed.planning.document.sections[2].blocks.find(b=>b.anchor==='r-01').id,blocks.find(b=>b.anchor==='r-01').id);
 await page.goto(pathToFileURL(documentPath).href);
 const card=page.locator('[data-graph="M01"]');
 await card.locator('[data-action="edit"]').click();
 await page.locator('#node-text').fill('导入数据同步验证');await page.locator('#set-node').click();await page.locator('#apply-edit').click();
 await page.locator('[data-ui="UI-01"] [data-action="svg"]').click();
 const svg=await page.locator('#source-text').inputValue();
 await page.locator('#source-text').fill(svg.replace('可变长列表与固定操作区','SVG 同步验证'));
 await page.locator('#apply-edit').click();
 const edited=await get();validate(edited);
 assert.equal(edited.planning.diagrams.find(d=>d.kind==='mindmap').sourceData.nodes[0].text,'导入数据同步验证');
 const ui=edited.planning.diagrams.find(d=>d.kind==='ui'&&d.sourceData.includes('SVG 同步验证'));
 assert(ui);assert.equal(new TextDecoder().decode(Uint8Array.from(edited.files.find(f=>f.path==='图示/UI-01.svg').data)),ui.sourceData);
 const [editedDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#save-package').click()]);
 await editedDownload.saveAs(path.join(temp,'edited.zip'));
 await fs.writeFile(path.join(temp,'edited.html'),edited.html);
 await page.goto(pathToFileURL(path.join(temp,'edited.html')).href);
 assert((await card.innerText()).includes('导入数据同步验证'));
 assert.equal((await get()).planning.document.id,original.planning.document.id);
 await page.goto(pathToFileURL(documentPath).href);
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile overflow');
 await page.screenshot({path:path.join(import.meta.dirname,'窄屏预览.png')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({sections:10,blocks:blocks.length,diagrams:7,attachments:original.files.length,relations:original.planning.relations.length,editedPackage:path.join(temp,'edited.zip'),checks:'IDs, references, hashes, full text, unchanged gameplay, graph/SVG save-reopen and mobile layout passed'}));
} finally { await browser.close(); }
