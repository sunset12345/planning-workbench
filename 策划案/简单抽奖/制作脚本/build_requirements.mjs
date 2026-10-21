import fs from "node:fs/promises";
import path from "node:path";
import {Workbook,SpreadsheetFile} from "@oai/artifact-tool";
const dir=path.resolve(import.meta.dirname,"..");
const datasets=JSON.parse(await fs.readFile(path.join(import.meta.dirname,"requirements.json"),"utf8"));
const schemas=JSON.parse(await fs.readFile(path.resolve(dir,"../../策划技能/game-feature-planning/assets/制作需求表字段模板.json"),"utf8"));
const out=path.join(dir,"需求表");await fs.mkdir(out,{recursive:true});
const preview=path.join(import.meta.dirname,"需求表预览");await fs.mkdir(preview,{recursive:true});
function col(n){let r='';for(n++;n;n=Math.floor((n-1)/26))r=String.fromCharCode(65+(n-1)%26)+r;return r;}
for(const [kind,rows]of Object.entries(datasets)){
 if(kind==='美术需求')continue;
 const headers=schemas[kind];for(const r of rows)if(r.length!==headers.length)throw Error(`${kind}: ${r.length} != ${headers.length}`);
 const wb=Workbook.create(),sh=wb.worksheets.add(kind),last=col(headers.length-1),end=6+rows.length;
 sh.showGridLines=false;sh.getRange(`A1:${last}${end}`).format.font={name:'Arial',size:11,color:'#243B35'};
 sh.getRange('A2').values=[[`简单抽奖${kind} V0.4`]];sh.getRange('A2').format.font={size:16,bold:true};
 sh.getRange('A3').values=[['建议规格；待评审/制作。负责人待指定，计划日期留空待排期。']];
 sh.getRange('A4').values=[['依据：HTML 正文 V0.4；按类型、列表数量、状态与动效条件制作。需求ID不等同于运行时配置字段。']];
 sh.getRange(`A6:${last}${end}`).values=[headers,...rows];
 sh.tables.add(`A6:${last}${end}`,true,`Req${kind==='美术需求'?'Art':kind==='UI需求'?'UI':'Vfx'}`);
 sh.getRange(`A6:${last}6`).format={fill:'#284D3E',font:{bold:true,color:'#FFFFFF',size:11},rowHeight:32,wrapText:true};
 sh.getRange(`A7:${last}${end}`).format.wrapText=true;sh.getRange(`A7:${last}${end}`).format.verticalAlignment='top';
 const widths=[];for(let i=0;i<headers.length;i++){
  const h=headers[i];const w=/内容|状态$|反馈|要求|表现|交付物|约束|适配|说明|条件|循环|打断|叠加|尺寸/.test(h)&&h!=='制作状态'?280:/ID|资源键|引用|关联|入口/.test(h)?190:/名称/.test(h)?160:105;
  sh.getRange(`${col(i)}6:${col(i)}${end}`).format.columnWidthPx=w;
  widths.push(w);
 }
 for(let r=0;r<rows.length;r++){
  const lines=Math.max(...rows[r].map((v,i)=>String(v||'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil([...line].reduce((n,c)=>n+(c.charCodeAt(0)>255?2:1),0)/((widths[i]-15)/7))),0)));
  sh.getRange(`A${r+7}:${last}${r+7}`).format.rowHeight=Math.max(54,lines*15+14);
  sh.getRange(`A${r+7}:${last}${r+7}`).format.fill=r%2?'#FFFFFF':'#F1F5EF';
 }
 const st=headers.indexOf('制作状态'),pr=headers.indexOf('优先级'),dt=headers.indexOf('计划交付日期');
 sh.getRange(`${col(st)}7:${col(st)}${end}`).dataValidation={rule:{type:'list',values:['待制作','制作中','待评审','需修改','已交付']}};
 sh.getRange(`${col(pr)}7:${col(pr)}${end}`).dataValidation={rule:{type:'list',values:['P0','P1','P2']}};
 sh.getRange(`${col(dt)}7:${col(dt)}${end}`).setNumberFormat('yyyy-mm-dd');
 sh.getRange(`${col(st+1)}7:${col(dt)}${end}`).format.fill='#FFF6DF';
 for(let i=0;i<rows.length;i++){
  const anchor=rows[i].at(-1).split('#')[1];
  sh.getRange(`${last}${i+7}`).values=[[anchor.startsWith('ui-')?'主文档第5章 · '+anchor.toUpperCase():'主文档第'+anchor.split('-')[1]+'章']];
 }
 sh.freezePanes.freezeRows(6);sh.freezePanes.freezeColumns(2);wb.recalculate();
 console.log(kind,rows.length,(await wb.inspect({kind:'match',searchTerm:'#REF!|#VALUE!|#NAME\\?',options:{useRegex:true,maxResults:5}})).ndjson);
 for(const [name,range]of [['left','A1:F10'],['detail',`G6:${last}10`]]){const blob=await wb.render({sheetName:kind,range,scale:1,format:'png'});await fs.writeFile(path.join(preview,`${kind}-${name}.png`),new Uint8Array(await blob.arrayBuffer()));}
 const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(path.join(out,`简单抽奖_${kind}.xlsx`));
}
console.log('Updated UI and VFX workbooks; art sample workbook retained.');
