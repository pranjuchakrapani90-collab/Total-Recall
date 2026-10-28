/* Line Survey → estimate in the SDE's own format (29 Oct 2026).
   Follows "BAGHBHARALI_LT_ESTIMATE.xlsx" cell for cell (A–I, rows A–P, VLOOKUP on the hidden "SOR-21-22 (2)" sheet)
   and "Baghbarali_LT_FORW" for the forwarding letter.
   - p.est   : the editable estimate (rows by SoR number, quantity, stock flag, remarks; % and fees)
   - p.fw    : the forwarding letter text
   - p.app   : the application the estimate is based on (details + files; files live in IndexedDB and, when
               Google Drive is connected, in Drive too)
   Loaded after the main Line Survey script; it uses that script's globals (P, compute, boq, touch, renderAll …). */
(function(){
"use strict";
const SOR=window.SOR2122||{},SECS=window.SOR_SECS||[];
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const r2=v=>Math.round((v+Number.EPSILON)*100)/100;
const rup=v=>"₹ "+(+v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});      // Excel "₹ "#,##0.00
const rin=v=>"₹ "+(+v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});      // letter: Indian grouping
const ROM=["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"];
const isKm=u=>/^k\.?m\.?$/i.test(String(u||"").trim());
const fmtQ=(q,u)=>{q=+q||0;if(isKm(u))return q.toFixed(3);return Number.isInteger(q)?String(q):String(Math.round(q*1000)/1000)};
const CIVIL=SECS.findIndex(s=>/CIVIL/i.test(s));
// kinds of material that are not bought new: shown in column H and deducted at M
const SK={rdss:{n:"RDSS dismantled",rem:"RDSS DISMANTLED"},om:{n:"O&M stock",rem:"O&M SUPPLY"},reuse:{n:"Reusable",rem:"REUSABLE"}};
const skOf=r=>r.st&&!r.job?(SK[r.sk]?r.sk:(/RDSS/i.test(r.rem||"")?"rdss":/REUS/i.test(r.rem||"")?"reuse":"om")):"";
const hasCol=e=>e.stockCol!==false;
function usedSk(e){const u=new Set();e.rows.forEach(r=>{const s=skOf(r);if(s)u.add(s)});return["rdss","om","reuse"].filter(x=>u.has(x))}
const hHeadOf=e=>e.hHead||((u=>u.length?u.map(x=>SK[x].n).join(" / ")+" materials":"RDSS dismantled / O&M stock materials")(usedSk(e)));
const mLabOf=e=>e.mLab||((u=>"Less: "+(u.length?u.map(x=>x==="reuse"?"reusable":SK[x].n).join(", ").replace(/, ([^,]*)$/," & $1"):"RDSS dismantled & O&M stock")+" materials (incl. GST)")(usedSk(e)));
const isJobSor=k=>{const s=SOR[k];return !!s&&(s[7]===CIVIL||/^(Job|Rm|Sqm|Cum)\.?$/i.test(s[3]))};
const isCond=k=>/^(44[5-9]|45\d|46[0-3]|1[0-9]|2[0-9])$/.test(String(k));

/* ---------- words, Indian system, the way the template writes them ---------- */
function words(n){n=Math.round(n);if(!n)return"Zero";
 const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],t=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
 const two=x=>x<20?a[x]:t[Math.floor(x/10)]+(x%10?"-"+a[x%10]:"");
 const cr=Math.floor(n/1e7),lk=Math.floor(n/1e5)%100,th=Math.floor(n/1e3)%100,hu=Math.floor(n/100)%10,rest=n%100,parts=[];
 if(cr)parts.push((cr>=100?words(cr):two(cr))+" Crore");if(lk)parts.push(two(lk)+" Lakh");if(th)parts.push(two(th)+" Thousand");if(hu)parts.push(a[hu]+" Hundred");
 let s=parts.join(" ");if(rest)s+=(s?" and ":"")+two(rest);return s}

/* ---------- the estimate model ---------- */
function itemOf(r){const s=r.sor&&SOR[r.sor];if(s&&!r.cust)return{desc:s[2],unit:s[3],rate:+s[4],ok:true};return{desc:r.d||"",unit:r.u||"",rate:+r.r||0,ok:!r.sor||!!r.cust}}
function sigOf(c){const b=boq(c);return JSON.stringify([b.mat.map(r=>[r.sor,r.q,r.eq]),b.job.map(r=>[r.sor,r.q])])}
function genRows(c){const b=boq(c),rows=[],U=()=>uid();
 const push=(r,q,st,job)=>{if(!(q>0))return;const k=/^\d+$/.test(r.sor)&&SOR[r.sor]?r.sor:"";
  rows.push({id:U(),sor:k,q:Math.round(q*1000)/1000,st:!!st,sk:st?(isCond(r.sor)?"rdss":"om"):"",job:!!job,rem:st?(isCond(r.sor)?"RDSS DISMANTLED":"O&M SUPPLY"):"",
   ...(k?{}:{cust:true,sor0:r.sor,d:r.desc,u:r.unit,r:r.rate})})};
 b.mat.forEach(r=>{const eq=Math.min(r.eq||0,r.q);if(eq>=r.q)push(r,r.q,true);else{push(r,r.q-eq,false);push(r,eq,true)}});
 b.job.forEach(r=>push(r,r.q,false,true));return rows}
function defaults(p){const m=p.meta,dep=m.pay==="dep";return{kc:dep?0.03:0,ks:dep?0.15:0}}
function ensure(p,c){if(!p.est){p.est={v:1,rows:genRows(c),sig:sigOf(c),edited:false,...defaults(p),meter:0,sarma:true};return p.est}
 const e=p.est;if(!e.edited){const sg=sigOf(c);if(sg!==e.sig){e.rows=genRows(c);e.sig=sg}}return e}
function calc(p,e){const mat=[],job=[];e.rows.forEach(r=>{const it=itemOf(r),G=it.rate*(+r.q||0);(r.job?job:mat).push({r,it,G,H:hasCol(e)&&skOf(r)?G:0})});
 const A=mat.reduce((s,x)=>s+x.G,0),HA=mat.reduce((s,x)=>s+x.H,0),B=A*0.05,C=A+B,D=C*0.15,E=job.reduce((s,x)=>s+x.G,0),DE=D+E,F=C*(+e.kc||0),G=DE*(+e.ks||0),
  Hh=C+DE+F+G,I=+(p.meta.fee||0),J=Hh*0.09,K=Hh*0.09,L=Hh+I+J+K,H28=HA,H30=H28*0.09,H32=H28+H30*2,M=H32,N=+(e.meter||0),O=L-M-N,Pp=Math.ceil(O-1e-9);
 return{mat,job,A,HA,B,C,D,E,DE,F,G,Hh,I,J,K,L,H30,H32,M,N,O,P:Pp}}
const titleOf=(p,c)=>p.meta.estTitle||("Provisional Estimate for "+workOf(c).replace(/^Construction/,"construction")+" at "+locOf()+(p.meta.fdr?" under "+p.meta.fdr:"")+".");
const docOf=p=>p.meta.doc||"SESD/"+new Date().getFullYear()+"/";
const dtOf=p=>{const d=p.meta.date;if(!d)return"";const[y,m,dd]=d.split("-");return dd+"."+m+"."+y};

/* ---------- the sheet, drawn like the workbook ---------- */
const W=[6.11,7,61.11,4.89,8.66,12.66,15.89,12,16.55],TW=W.reduce((a,b)=>a+b,0);
function sheetHTML(p,c,ed){const e=ensure(p,c),k=calc(p,e),HC=hasCol(e),N9=HC?9:8,N3=HC?3:2,WW=HC?W:W.filter((w,i)=>i!==7),TT=WW.reduce((a,b)=>a+b,0);let sl=0;
 const inp=(cls,val,attrs="")=>ed?`<input class="ci ${cls}" value="${esc(val)}" ${attrs}>`:esc(val);
 const ctl=h=>ed?`<td class="ctl">${h||""}</td>`:"";
 const itemRow=(x,i,isJob)=>{const r=x.r,it=x.it,bad=r.sor&&!SOR[r.sor]&&!r.cust;
  const B=ed?`<input class="ci sor${bad?" bad":""}" data-f="sor" data-id="${r.id}" value="${esc(r.cust&&!r.sor?"":r.sor)}" inputmode="numeric" title="SoR Sl. No. — type a number, or tap 🔍 to search">`:esc(r.sor);
  const vt=ed&&!r.cust&&SOR[r.sor]&&SOR[r.sor][9]?`<span class="vt noprint">${kvTag(SOR[r.sor][9])}</span>`:"";
  const Cc=r.cust&&ed?`<textarea class="ci" data-f="d" data-id="${r.id}" rows="1">${esc(it.desc)}</textarea>`:esc(bad?"(not in SoR 2021-22)":it.desc)+vt;
  const Dd=r.cust&&ed?`<input class="ci" data-f="u" data-id="${r.id}" value="${esc(it.unit)}">`:esc(it.unit);
  const Ff=r.cust&&ed?`<input class="ci n" data-f="r" data-id="${r.id}" value="${it.rate}" inputmode="decimal">`:rup(it.rate);
  const Ee=ed?`<input class="ci n" data-f="q" data-id="${r.id}" value="${fmtQ(r.q,it.unit)}" inputmode="decimal">`:fmtQ(r.q,it.unit);
  const sk=skOf(r),Hh=isJob?rup(0):ed?`<span class="skv${sk?" on "+sk:""}">${rup(x.H)}</span><select class="skov" data-f="sk" data-id="${r.id}" title="Not bought new? Choose RDSS dismantled, O&amp;M stock or reusable"><option value="">New material (₹ 0.00 here)</option>${Object.entries(SK).map(([k2,v])=>`<option value="${k2}" ${sk===k2?"selected":""}>${v.n}</option>`).join("")}</select>`:rup(x.H);
  const Ii=ed?`<input class="ci" data-f="rem" data-id="${r.id}" value="${esc(r.rem||"")}" list="remList">`:esc(r.rem||"");
  return`<tr class="${isJob?"jb":"it"}"><td class="c">${isJob?ROM[i]||i+1:++sl}</td><td class="c">${B}</td><td class="l${isJob?" t":""}">${Cc}${ed?` <button type="button" class="pk" data-act="pick" data-id="${r.id}" title="Pick from SoR">🔍</button>`:""}</td><td class="c">${Dd}</td><td class="c">${Ee}</td><td class="${isJob?"c":"l"}">${Ff}</td><td class="c">${rup(x.G)}</td>${HC?`<td class="c h${ed&&!isJob?" skc":""}">${Hh}</td>`:""}<td class="i">${Ii}</td>${ctl(`<button type="button" data-act="up" data-id="${r.id}" title="Move up">↑</button><button type="button" data-act="dn" data-id="${r.id}" title="Move down">↓</button><button type="button" data-act="del" data-id="${r.id}" title="Delete row">✕</button><button type="button" data-act="mv" data-id="${r.id}" title="${isJob?"Move to materials":"Move to E (labour included)"}">${isJob?"⇡M":"⇣E"}</button>`)}</tr>`};
 const ab=(L,t,v,h,o={})=>`<tr class="ab${o.nb?" nb":""}"><td class="c">${L}</td><td class="l" colspan="5">${t}</td><td class="c">${o.gh!=null?o.gh:rup(v)}</td>${HC?`<td class="c h">${h==null?"":rup(h)}</td>`:""}<td></td>${ctl(o.ctl)}</tr>`;
 const pct=(f,v,lab)=>ed?`<label class="pc">${lab} <input class="ci n" data-g="${f}" value="${Math.round((+v||0)*10000)/100}" inputmode="decimal">%</label>`:"";
 const addRow=job=>ed?`<tr class="add"><td colspan="${N9}"><button type="button" data-act="add" data-job="${job?1:0}">＋ Add ${job?"item with labour included (E)":"material item"}</button><button type="button" data-act="addpick" data-job="${job?1:0}">🔍 Add from SoR</button>${job?"":`<button type="button" data-act="addcust" data-job="0">＋ Item without SoR No.</button>`}</td>${ctl()}</tr>`:"";
 return`<div class="xe${ed?" ed":""}"><table class="xs"><colgroup>${WW.map(w=>`<col style="width:${(w/TT*100).toFixed(3)}%">`).join("")}${ed?'<col class="ctlc">':""}</colgroup><tbody>
 <tr style="height:29px"><td colspan="${N9}" class="h1 c">ASSAM POWER DISTRIBUTION COMPANY LTD.</td>${ctl()}</tr>
 <tr style="height:25px"><td colspan="${N9}" class="h1 c">Samaguri Electrical Sub-Division, Nagaon ED-II, CAR</td>${ctl()}</tr>
 <tr style="height:14px"><td colspan="6" rowspan="2" class="h2 c">PROVISIONAL ESTIMATE</td><td colspan="${N3}" class="ar b c">GSTIN :18AABCL1354J1ZJ</td>${ctl()}</tr>
 <tr style="height:16px"><td colspan="${N3}" class="ar b c">PROFORMA INVOICE</td>${ctl()}</tr>
 <tr style="height:14px"><td colspan="4" class="cal">Document No : ${ed?`<input class="ci" data-m="doc" value="${esc(docOf(p))}" style="width:70%">`:esc(docOf(p))}</td><td colspan="2" class="cal">Dt: ${ed?`<input class="ci" data-m="date" type="date" value="${esc(p.meta.date||"")}" style="width:72%">`:esc(dtOf(p))}</td><td colspan="${N3}" class="ar c">(not valid for Input Tax credit)</td>${ctl()}</tr>
 <tr style="height:46px"><td colspan="6" class="ti">${ed?`<textarea class="ci" data-m="estTitle" rows="3" placeholder="${esc(titleOf({meta:{...p.meta,estTitle:""}},c))}">${esc(p.meta.estTitle||titleOf(p,c))}</textarea>`:esc(titleOf(p,c))}</td><td colspan="${N3}" class="sr c">Rates as per SoR 2021-22</td>${ctl()}</tr>
 ${e.sarma!==false?`<tr style="height:14px"><td colspan="${N9}" class="sa c">"This estimate has been prepared incorporating the recommendations of Hon'ble Justice H.N. Sarma Commission."</td>${ctl(ed?'<label class="pc"><input type="checkbox" data-g="sarma" checked> Sarma line</label>':"")}</tr>`:ed?`<tr class="add"><td colspan="${N9}"><label class="pc"><input type="checkbox" data-g="sarma"> Show the H.N. Sarma Commission line</label></td>${ctl()}</tr>`:""}
 <tr class="hd" style="height:72px"><td class="c nb">Sl. No.</td><td class="c">SOR Sl. No.</td><td class="c">Item Description</td><td class="c">Unit</td><td class="c">Quantity</td><td class="c">Ex. Work Price in Rs.</td><td class="c">Amount<br>in Rs.</td>${HC?`<td class="c">${ed?`<textarea class="ci c" data-g="hHead" rows="3">${esc(hHeadOf(e))}</textarea>`:esc(hHeadOf(e))}</td>`:""}<td class="c">Remarks</td>${ctl(ed?`<label class="pc"><input type="checkbox" data-g="stockCol" ${HC?"checked":""}> RDSS / O&amp;M / reusable column</label>`:"")}</tr>
 ${k.mat.map((x,i)=>itemRow(x,i,false)).join("")}${addRow(false)}
 ${ab("A","Cost of Material excl GST",k.A,k.HA)}
 ${ab("B","Add: Transportation &amp; Storage (5% of A )",k.B,0)}
 ${ab("C","Total Cost of materials",k.C,k.HA)}
 ${ab("D","Add: Labour Charge (15% of C )",k.D,0)}
 ${ab("E","Add: Other expenses where labour charge is included ("+(k.job.length?k.job.map((x,i)=>ROM[i]).join("+"):"i+ii+iii")+")",k.E,0)}
 ${k.job.map((x,i)=>itemRow(x,i,true)).join("")}${addRow(true)}
 ${ab("","Total: D + E",k.DE,0)}
 ${ab("F","Add: Contingency charge (% in K of C )",k.F,0,{ctl:pct("kc",e.kc,"K =")})}
 ${ab("G","Add: Supervision charge (% in K of (D+E))",k.G,0,{ctl:pct("ks",e.ks,"K =")})}
 ${ab("H","Gross Estimate Cost ( C+D+E+F+G )",k.Hh,k.HA)}
 ${ab("I","Add: Processing  Fees: (As Applicable) ",k.I,0,{gh:ed?`<input class="ci n c" data-m="fee" value="${+(p.meta.fee||0)}" inputmode="decimal">`:null})}
 ${ab("J","CGST @ (9% on H)",k.J,k.H30)}
 ${ab("K","SGST @ (9% on H)",k.K,k.H30)}
 ${ab("L","Total Amount (H+I+J+K)",k.L,k.H32)}
 ${ab("M",ed&&HC?`<input class="ci" data-g="mLab" value="${esc(mLabOf(e))}">`:esc(mLabOf(e)),k.M,null)}
 ${ab("N","Less: Cost of metering equipments to be paid separately",k.N,null,{gh:ed?`<input class="ci n c" data-g="meter" value="${+(e.meter||0)}" inputmode="decimal">`:null})}
 ${ab("O","Total: L-M-N ( Total Estimate Amount )",k.O,null)}
 ${ab("P","Total Estimated Amount ( ROUNDED OFF )",k.P,null,{nb:1})}
 <tr class="wd"><td colspan="${N9-1}">Rupees (${words(k.P)}) only.</td><td class="nob"></td>${ctl()}</tr>
 </tbody></table>${ed?`<datalist id="remList"><option value="RDSS DISMANTLED"><option value="O&amp;M SUPPLY"><option value="PARTY SUPPLY"><option value="EXISTING"></datalist>`:""}</div>`}

/* ---------- Estimate tab ---------- */
const CSS=`
.xe{background:#fff;padding:14px 10px;overflow:auto}
.xe table.xs{border-collapse:collapse;table-layout:fixed;width:100%;min-width:760px;max-width:980px;margin:0 auto;font:11px/1.25 Cambria,Caladea,"Times New Roman",serif;color:#000}
.xe.ed table.xs{max-width:1080px}
.xe .xs td{border:1px solid #000;padding:1px 3px;vertical-align:middle;overflow:hidden;word-wrap:break-word}
.xe .xs td.c{text-align:center}.xe .xs td.l{text-align:left}.xe .xs td.t{vertical-align:top}.xe .xs td.i{text-align:left;font-family:Calibri,Carlito,Arial,sans-serif}
.xe .xs td.h{font-family:Calibri,Carlito,Arial,sans-serif}
.xe .xs .h1{font:700 20px/1.2 Calibri,Carlito,Arial,sans-serif}.xe .xs .h2{font:700 16px Calibri,Carlito,Arial,sans-serif}
.xe .xs .ar{font:10px Arial,Helvetica,sans-serif}.xe .xs .b{font-weight:700}
.xe .xs .cal{font:10px Calibri,Carlito,Arial,sans-serif;text-align:left}
.xe .xs .ti{font:italic 12px/1.3 Calibri,Carlito,Arial,sans-serif;text-align:left;white-space:pre-wrap}
.xe .xs .sr{font:italic 700 10px Calibri,Carlito,Arial,sans-serif}
.xe .xs .sa{font:italic 10px Calibri,Carlito,Arial,sans-serif}
.xe .xs tr.hd td{font:700 11px Calibri,Carlito,Arial,sans-serif;white-space:normal}.xe .xs tr.hd td.nb{font-weight:400}
.xe .xs tr.ab td{font-weight:700}.xe .xs tr.ab td.h{font-weight:400}.xe .xs tr.ab.nb td{font-weight:400}
.xe .xs tr.wd td{border:0;font-weight:700;padding-top:3px}.xe .xs td.nob{border:0}
.xe .xs td.ctl,.xe .xs tr.add td{border:0;background:transparent}
.xe .xs col.ctlc{width:132px}
.xe .ci{border:0;background:transparent;font:inherit;color:inherit;width:100%;padding:0;margin:0;text-align:inherit;resize:vertical}
.xe.ed .ci{background:#eef6ff;border-radius:2px}.xe.ed .ci:focus{outline:2px solid #2563eb;background:#fff}
.xe .ci.bad{background:#fee2e2;color:#991b1b}
.xe .ci.n{text-align:center}.xe textarea.ci{display:block;min-height:1.3em;font:inherit}
.xe .ti textarea.ci{min-height:42px}
.xe .pk{border:0;background:none;cursor:pointer;padding:0 2px;font-size:11px}
.xe td.skc{position:relative;cursor:pointer}.xe td.skc .skv{display:block;border:1px dashed #94a3b8;border-radius:4px}.xe .skv.on{background:#fef3c7;border:1px solid #d97706}.xe .skv.reuse{background:#dcfce7;border-color:#16a34a}.xe .skv.om{background:#e0f2fe;border-color:#0284c7}
.xe select.skov{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:14px}
.xe .hd textarea.ci{font:inherit;text-align:center;resize:none;height:66px;overflow:hidden}
.xe td.ctl{white-space:nowrap;padding-left:6px!important;text-align:left}
.xe td.ctl button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font:12px system-ui;padding:1px 5px;margin-right:2px}
.xe td.ctl .pc,.xe tr.add .pc{font:12px system-ui;color:#334155}.xe td.ctl .pc input.ci{width:46px;display:inline-block;background:#eef6ff}
.xe tr.add td{padding:4px 0 6px!important}.xe tr.add button{border:1px dashed #0f766e;background:#f0fdfa;color:#0f766e;border-radius:8px;font:600 12px system-ui;padding:4px 10px;cursor:pointer;margin-right:6px}
.disbar{margin:12px 0 4px;padding:8px 12px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px}
.estbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}
.estnote{font-size:13px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:8px 12px;margin:0 0 10px}
#sorDlg .dlg{max-width:760px}#sorList{max-height:56vh;overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:8px}
#sorList .sr{display:grid;grid-template-columns:52px 1fr 52px 96px;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);cursor:pointer;font-size:13px}
#sorList .sr:hover{background:#f0fdfa}#sorList .sg{background:#f1f5f9;font:700 12px system-ui;padding:6px 10px;color:#334155;position:sticky;top:0}
#sorList .sr b{font-family:var(--mono)}#sorList .sr .rt{text-align:right;font-family:var(--mono)}
#sorList .sr{grid-template-columns:52px 1fr 64px 52px 96px}#sorList .sr.off{opacity:.45}
.vk{display:inline-block;font:700 10.5px system-ui;padding:1px 6px;border-radius:999px;background:#e2e8f0;color:#334155;white-space:nowrap;text-align:center}.vk.v33{background:#ede9fe;color:#5b21b6}.vk.v11{background:#dcfce7;color:#166534}.vk.vLT{background:#ffedd5;color:#9a3412}.vk.vHT{background:#e0f2fe;color:#075985}
.ctxrow{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:2px 0 8px;font-size:13px}.ctxrow .lb{font-weight:650;color:#475569}.ctxrow select{padding:5px 8px;border-radius:8px;border:1px solid var(--line)}
.seg{display:inline-flex;border:1px solid #0f766e;border-radius:10px;overflow:hidden}.seg button{border:0;background:#fff;padding:5px 11px;font:600 13px system-ui;cursor:pointer;color:#0f766e}.seg button.on{background:#0f766e;color:#fff}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.chips button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:999px;padding:4px 10px;font:600 12.5px system-ui;cursor:pointer}.chips button.on{background:#0f766e;color:#fff;border-color:#0f766e}
.xe .vt{font:700 9px system-ui;margin-left:4px;vertical-align:1px}
/* application */
.appfiles{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.appfile{width:150px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;font-size:12px}
.appfile .th{height:180px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}.appfile .th img,.appfile .th canvas{max-width:100%;max-height:100%}
.appfile .nm{padding:5px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.appfile .ac{display:flex;gap:4px;padding:0 6px 6px}.appfile .ac button{flex:1;border:1px solid var(--line);background:#fff;border-radius:6px;font-size:12px;cursor:pointer;padding:3px}
.drop{border:2px dashed #94a3b8;border-radius:12px;padding:14px;text-align:center;color:#475569;font-size:14px;cursor:pointer;background:#f8fafc}.drop.ov{background:#ecfeff;border-color:#0f766e}
/* forwarding letter */
.fwwrap{background:#e5e7eb;padding:14px 8px;border-radius:12px;overflow:auto}
.fwp{background:#fff;width:210mm;min-height:297mm;margin:0 auto;padding:11mm 22mm 14mm 30mm;box-sizing:border-box;font:12.6pt/1.18 "Times New Roman",Tinos,"Liberation Serif",Times,serif;color:#000;box-shadow:0 2px 10px #0002}
.fwp .lh{position:relative;text-align:center;font-size:9.6pt;line-height:1.17;padding:0 0 6px;border-bottom:1.6px solid #000;margin:0 -8mm 0 -14mm}
.fwp .lh img{position:absolute;left:4mm;top:-2mm;width:24mm;height:24mm}
.fwp .rw{display:flex;justify-content:space-between;font-weight:700;margin:16px 0 26px}
.fwp .to{margin:0 0 14px}.fwp .to .ad{padding-left:13mm;font-weight:700}
.fwp .sbj{display:flex;gap:0;margin:0 0 14px;text-align:justify}.fwp .sbj .k{width:13mm;flex:none}.fwp .rw span{white-space:pre}
.fwp p{margin:0 0 13px;text-align:justify}.fwp p.ind{text-indent:13mm}
.fwp ol{margin:0 0 13px;padding-left:20mm}.fwp ol li{padding-left:3mm;text-align:justify}
.fwp table.sm{border-collapse:collapse;width:100%;margin:0 0 14px;font-size:12.6pt}.fwp table.sm td{border:1px solid #000;padding:2px 5px;vertical-align:top}
.fwp table.sm td.a{width:30%;font-weight:700}.fwp table.sm tr.h td{font-weight:400}.fwp table.sm td.s{width:10%}
.fwp .sg{margin-top:4px;display:flex;justify-content:space-between}.fwp .sg .r{text-align:center;font-weight:700;margin-right:-6mm}
.fwp [contenteditable]{outline:none;border-radius:2px}.fwwrap.ed .fwp [contenteditable]{background:#eef6ff}.fwwrap.ed .fwp [contenteditable]:focus{background:#fff;box-shadow:0 0 0 2px #2563eb}
.fwp .fx{font:12px system-ui;display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}.fwp .fx button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;padding:0 5px}
@media print{.xe{padding:0}.xe table.xs{min-width:0;max-width:none;width:100%}.fwwrap{background:#fff;padding:0}.fwp{box-shadow:none;width:auto;min-height:0;padding:0 8mm 0 14mm}
 #printFw{page:fw}#printApp img{display:block;max-width:100%;max-height:270mm;margin:0 auto;page-break-after:always}#printApp{page:port}
 body.p-sld #printFw,body.p-est #printFw,body.p-sld #printApp,body.p-est #printApp,body.p-fw #printSld,body.p-fw #printEst,body.p-fw #printApp{display:none!important}}
@page fw{size:A4 portrait;margin:12mm 16mm 12mm 16mm}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${CSS}</style>`);

/* markup: application card + estimate toolbar in the Estimate tab, the Forwarding tab, print areas, SoR dialog */
const vEst=$("#v-est"),box=$("#estBox");
box.insertAdjacentHTML("beforebegin",`<div class="card noprint" id="appCard"><h2>Application (basis of this estimate)</h2>
 <div class="f"><label>Applicant / office<input id="apName" placeholder="e.g. Sri Rajen Bora, Baghbarali"></label><label>Application date<input id="apDate" type="date"></label>
 <label>Ref. / Memo No.<input id="apRef" placeholder="if any"></label><label>What was applied for<input id="apFor" placeholder="e.g. new LT connection / shifting of pole"></label></div>
 <label class="drop" id="apDrop"><input type="file" id="apFile" accept="application/pdf,image/*" multiple hidden>📎 Upload the application — scanned PDF or photo (tap, or drop files here)</label>
 <div class="appfiles" id="apFiles"></div><p class="hint" id="apHint"></p></div>
 <div class="estbar noprint" id="estBar"><button class="btn alt" id="xls2Btn" type="button" hidden>⬇ Excel</button><button class="btn alt" id="estRegen" type="button">↻ Rebuild from SLD</button><button class="btn alt" id="toFw" type="button">✉ Make forwarding letter →</button></div>
 <div id="estNote"></div>`);
document.querySelector("nav.tabs").insertAdjacentHTML("beforeend",'<button data-v="fw" aria-selected="false">✉ Forwarding</button>');
document.querySelector("#v-proj").insertAdjacentHTML("beforebegin",`<section id="v-fw" hidden>
 <div class="card noprint"><h2>Forwarding letter</h2><div class="drow" style="justify-content:flex-start">
  <button class="btn" id="fwPrint" type="button">🖨 Print / save PDF</button><button class="btn alt" id="fwDocx" type="button">⬇ Word (.docx)</button>
  <button class="btn alt" id="fwSet" type="button">🖨 Full set: letter + estimate + SLD + application</button><button class="btn alt" id="fwRedraft" type="button">↻ Redraft from estimate</button></div>
  <p class="hint">Tap any blue text on the letter to change it. The summary table follows the estimate. ＋ and ✕ add or remove paragraphs and points.</p></div>
 <div class="fwwrap ed" id="fwBox"></div></section>`);
{const se=$("#printSld"),pe=$("#printEst");se.insertAdjacentHTML("afterend",'<div class="printarea" id="printApp"></div>');se.parentNode.insertBefore(pe,se);pe.insertAdjacentHTML("beforebegin",'<div class="printarea" id="printFw"></div>')}
document.body.insertAdjacentHTML("beforeend",`
<dialog id="sorDlg"><div class="dlg"><h3 id="sorT">Pick from SoR 2021-22</h3>
<div class="ctxrow"><span class="lb">Working on</span><span class="seg" id="sorKv">${[["","Any"],["33","33 kV"],["11","11 kV"],["LT","LT"]].map(([v,t])=>`<button type="button" data-kv="${v}">${t}</button>`).join("")}</span>
 <span class="lb">Conductor</span><select id="sorCond"><option value="">Any</option>${["Wolf","Panther","Raccoon","Dog","Rabbit","Weasel","Squirrel"].map(c=>`<option>${c}</option>`).join("")}</select></div>
<div class="chips" id="sorChips">${[["Disc","disc"],["Disc hardware","h/w fitting"],["Pin insulator","pin insulator"],["Tension clamp","tension clamp"],["Suspension clamp","suspension clamp"],["PG clamp","pg clamp"],["Jointing sleeve","sleeve"],["Cross arm","cross arm"],["Channel","channel"],["Top cleat","top cleat"],["Stay set","stay set"],["Stay wire","stay wire"],["Guy insulator","guy insulator"],["Pole","pole"],["Grouting","grouting"],["Earthing","earth"],["LA","arrestor"],["AB switch / isolator","isolator|tpgo|ab switch|goab|air break"],["DO fuse","do fuse"],["Conductor","conductor"],["DTR","dtr"],["Danger plate","danger"],["Barbed wire","barbed"],["Nuts & bolts","nuts"]].map(([t,q])=>`<button type="button" data-q="${esc(q)}">${t}</button>`).join("")}</div>
<div class="f" style="grid-template-columns:1fr 200px"><label>Search number or words<input id="sorQ" placeholder="e.g. 607, disc, stay set, grouting"></label><label>Section<select id="sorSec"><option value="">All sections</option>${SECS.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join("")}</select></label></div>
<label class="ck" style="font-size:13px"><input type="checkbox" id="sorAll"> Also show items for other voltages and conductors</label>
<div id="sorList"></div><div class="drow"><span style="flex:1"></span><button class="btn alt" id="sorClose" type="button">Close</button></div></div></dialog>`);
document.querySelectorAll("nav.tabs button[data-v=fw]").forEach(b=>b.onclick=()=>{show("fw");renderAll()});

/* Estimate tab render */
window.renderEst=function(c){const p=P(),m=p.meta;$("#mWork").value=m.work;$("#mWork").placeholder=autoWork(c);$("#mLoc").value=m.loc;$("#mPay").value=m.pay;$("#mDoc").value=m.doc;$("#mDate").value=m.date;$("#mSS").value=m.ss;$("#mFdr").value=m.fdr;$("#mFee").value=m.fee||0;
 const fl=c.flags.length?`<div class="warns flags"><b>Rates to check</b><ul>${c.flags.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:"";
 $("#estWarn").innerHTML=warnBox(c)+fl;renderApp(p);
 if(!c.pts.length&&!(p.est&&p.est.rows.length)){box.innerHTML='<p class="muted" style="padding:16px">Mark points on the Survey tab or draw the SLD first — or add items straight into the estimate with ＋ below.</p>'+sheetHTML(p,c,true);return}
 const e=ensure(p,c);$("#estNote").innerHTML=e.edited&&e.sig!==sigOf(c)?`<div class="estnote">The SLD has changed since this estimate was made. Your edits are kept. Tap <b>↻ Rebuild from SLD</b> to start the estimate again from the current SLD (your edits will be lost).</div>`:"";
 const keep=document.activeElement&&document.activeElement.dataset?{f:document.activeElement.dataset.f||document.activeElement.dataset.m||document.activeElement.dataset.g,id:document.activeElement.dataset.id}:null;
 box.innerHTML=sheetHTML(p,c,true)+disHTML(p,c,true);
 if(keep&&keep.f){const el=box.querySelector(`[data-${keep.id?"f":(document.activeElement&&document.activeElement.dataset.m?"m":"g")}="${keep.f}"]${keep.id?`[data-id="${keep.id}"]`:""}`);if(el)try{el.focus()}catch(_){}}};
window.estHTML=function(c){return sheetHTML(P(),c,false)+disHTML(P(),c,false)};
const rowById=(e,id)=>e.rows.find(r=>r.id===id);
function edit(fn){const p=P(),c=compute(p),e=ensure(p,c);fn(p,e,c);e.edited=true;touch(p);renderAll()}
box.addEventListener("change",ev=>{const t=ev.target,p=P();
 if(t.dataset.m){const k=t.dataset.m;let v=t.value;if(k==="fee")v=+v||0;if(k==="estTitle"){const c=compute(p);v=v.trim();if(v===titleOf({meta:{...p.meta,estTitle:""}},c))v=""}p.meta[k]=v;touch(p);renderAll();return}
 if(t.dataset.g){const k=t.dataset.g;edit((p,e)=>{if(k==="sarma")e.sarma=t.checked;else if(k==="stockCol"){e.stockCol=t.checked;if(!t.checked&&usedSk(e).length&&!confirm("Hide the RDSS / O&M / reusable column? Nothing will be deducted at M; your markings are kept and come back if you show the column again.")){e.stockCol=true}}
  else if(k==="hHead"||k==="mLab"){const v=t.value.trim(),def=k==="hHead"?hHeadOf({...e,hHead:""}):mLabOf({...e,mLab:""});e[k]=v&&v!==def?v:""}else if(k==="meter")e.meter=+t.value||0;else e[k]=(+t.value||0)/100});return}
 const id=t.dataset.id,f=t.dataset.f;if(!id||!f)return;
 edit((p,e)=>{const r=rowById(e,id);if(!r)return;
  if(f==="sor"){const v=t.value.trim();if(!v){r.sor="";if(!r.cust){r.cust=true;r.d=r.d||"";r.u=r.u||"";r.r=r.r||0}return}r.sor=v;if(SOR[v]){delete r.cust;if(isJobSor(v)!==!!r.job&&confirm(isJobSor(v)?"SoR "+v+" is a labour-included job item. Move it to E (other expenses where labour charge is included)?":"SoR "+v+" is a material item. Move it up to the materials?"))r.job=isJobSor(v)}}
  else if(f==="sk"){const v=t.value,old=skOf(r);r.st=!!v;r.sk=v;if(v&&(!r.rem||(old&&r.rem===SK[old].rem)))r.rem=SK[v].rem;if(!v&&/^(RDSS DISMANTLED|O&M SUPPLY|REUSABLE)$/.test(r.rem||""))r.rem=""}
  else if(f==="q")r.q=+t.value||0;else if(f==="rem")r.rem=t.value.trim();else if(f==="d")r.d=t.value;else if(f==="u")r.u=t.value.trim();else if(f==="r")r.r=+t.value||0})});
box.addEventListener("click",ev=>{const b=ev.target.closest("button[data-act]");if(!b)return;const a=b.dataset.act,id=b.dataset.id;
 if(a==="pick"){openSor(k=>edit((p,e)=>{const r=rowById(e,id);if(r){r.sor=k;delete r.cust;if(isJobSor(k)!==!!r.job&&confirm(isJobSor(k)?"This is a labour-included job item. Move it to E?":"This is a material item. Move it to the materials?"))r.job=isJobSor(k)}}),"Change item");return}
 if(a==="addpick"){openSor(k=>edit((p,e)=>{e.rows.push({id:uid(),sor:k,q:1,st:false,job:isJobSor(k),rem:""})}),"Add item");return}
 edit((p,e)=>{const i=e.rows.findIndex(r=>r.id===id),r=e.rows[i];
  if(a==="add")e.rows.push({id:uid(),sor:"",q:1,st:false,job:b.dataset.job==="1",rem:""});
  else if(a==="addcust")e.rows.push({id:uid(),sor:"",cust:true,d:"",u:"No.",r:0,q:1,st:false,job:false,rem:""});
  else if(!r)return;
  else if(a==="del"){if(confirm("Delete this row?"))e.rows.splice(i,1)}
  else if(a==="st"){r.st=!r.st;if(r.st&&!r.rem)r.rem=isCond(r.sor)?"RDSS DISMANTLED":"O&M SUPPLY";if(!r.st&&/^(RDSS DISMANTLED|O&M SUPPLY)$/.test(r.rem))r.rem=""}
  else if(a==="mv"){r.job=!r.job;if(r.job){r.st=false;r.sk=""}}
  else if(a==="up"||a==="dn"){const same=e.rows.map((x,j)=>[x,j]).filter(([x])=>!!x.job===!!r.job),k=same.findIndex(([x])=>x===r),o=same[a==="up"?k-1:k+1];if(o){e.rows[i]=o[0];e.rows[o[1]]=r}}})});
$("#estRegen").onclick=()=>{const p=P();if(p.est&&p.est.edited&&!confirm("Start the estimate again from the current SLD? All your changes to items, quantities and remarks will be lost."))return;const c=compute(p);const keep=p.est?{kc:p.est.kc,ks:p.est.ks,meter:p.est.meter,sarma:p.est.sarma}:{};delete p.est;ensure(p,c);Object.assign(p.est,keep);touch(p);renderAll()};
$("#mPay").addEventListener("change",()=>{const p=P();if(p.est){Object.assign(p.est,defaults(p));touch(p);renderAll()}});
$("#toFw").onclick=()=>{show("fw");renderAll()};
$("#xls2Btn").onclick=()=>{try{const p=P();dl(buildEstXlsx(p,compute(p)),"Estimate_"+fileBase()+".xlsx")}catch(e){alert("Couldn't build the Excel file: "+e.message)}};
const oldX=$("#xlsBtn");if(oldX){oldX.textContent="⬇ Excel (.xlsx) in your format";oldX.onclick=()=>$("#xls2Btn").click()}

/* SoR picker */
let sorCb=null;
// what the SDE is working on: voltage and conductor, guessed from the SLD, remembered per survey
function ctxOf(p,c){const e=p.est||{};if(e.ctx)return e.ctx;const seg=(c.segs||[]).filter(s=>!s.L.ex&&!s.L.dis),hv=seg.filter(s=>s.cls==="HV");
 const kv=hv.some(s=>s.kv===33)?"33":hv.length?"11":seg.length?"LT":"",cn=(()=>{const L=(hv[0]||seg[0]||{}).L||{},m=String(L.t||"").match(/Wolf|Panther|Raccoon|Dog|Rabbit|Weasel|Squirrel/);return m?m[0]:""})();return{kv,cond:cn}}
const kvTag=v=>v?`<span class="vk v${v}">${v==="LT"?"LT":v==="HT"?"HT (11/33)":v+" kV"}</span>`:"";
const kvFits=(t,kv)=>!kv||!t||t===kv||(t==="HT"&&(kv==="33"||kv==="11"));
const condFits=(t,cn)=>!cn||!t||t===cn;
let SC={kv:"",cond:""};
function openSor(cb,title){const p=P();sorCb=cb;SC={...ctxOf(p,compute(p))};$("#sorT").textContent=(title||"Pick")+" — SoR 2021-22";$("#sorQ").value="";$("#sorSec").value="";$("#sorAll").checked=false;$("#sorCond").value=SC.cond;listSor();$("#sorDlg").showModal();setTimeout(()=>$("#sorQ").focus(),50)}
function saveCtx(){const p=P();if(p.est){p.est.ctx={...SC};touch(p)}}
function listSor(){document.querySelectorAll("#sorKv button").forEach(b=>b.classList.toggle("on",b.dataset.kv===SC.kv));
 const q=$("#sorQ").value.trim().toLowerCase(),sec=$("#sorSec").value,all=$("#sorAll").checked,alts=q.split("|").map(a=>a.split(/\s+/).filter(Boolean)).filter(a=>a.length);
 document.querySelectorAll("#sorChips button").forEach(b=>b.classList.toggle("on",b.dataset.q===q));
 const norm=s=>s.toLowerCase().replace(/rac+o+n/g,"raccoon");let out=[],n=0,last="",hidden=0;
 Object.keys(SOR).sort((a,b)=>+a-+b).forEach(k=>{const s=SOR[k];if(sec!==""&&s[7]!==+sec)return;
  const hay=norm(k+" "+s[2]+" "+s[3]+" "+(s[8]||"")+" "+(SECS[s[7]]||""));
  if(alts.length&&!(k===q||alts.some(ws=>ws.every(w=>{w=norm(w);return w.length<=3?new RegExp("(^|[^a-z0-9])"+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)").test(hay):hay.includes(w)}))))return;
  const fit=kvFits(s[9],SC.kv)&&condFits(s[10],SC.cond);if(!fit&&!all){hidden++;return}if(n>=200)return;n++;
  const g=(SECS[s[7]]||"")+(s[8]?" — "+s[8]:"");if(g!==last){last=g;out.push(`<div class="sg">${esc(g)}</div>`)}
  out.push(`<div class="sr${fit?"":" off"}" data-k="${k}"><b>${k}</b><span>${esc(s[2])}</span><span>${kvTag(s[9])}</span><span>${esc(s[3])}</span><span class="rt">${rup(s[4])}</span></div>`)});
 $("#sorList").innerHTML=(out.join("")||'<p class="muted" style="padding:12px">Nothing matches.</p>')+(hidden&&!all?`<p class="muted" style="padding:8px 12px;font-size:12.5px">${hidden} item${hidden>1?"s":""} for other voltages or conductors hidden — tick “Also show” to see them.</p>`:"")}
$("#sorQ").addEventListener("input",listSor);$("#sorSec").addEventListener("change",listSor);$("#sorAll").addEventListener("change",listSor);
$("#sorKv").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;SC.kv=b.dataset.kv;saveCtx();listSor()});
$("#sorCond").addEventListener("change",e=>{SC.cond=e.target.value;saveCtx();listSor()});
$("#sorChips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$("#sorQ").value=$("#sorQ").value===b.dataset.q?"":b.dataset.q;listSor()});$("#sorClose").onclick=()=>$("#sorDlg").close();
$("#sorList").addEventListener("click",e=>{const r=e.target.closest(".sr");if(!r)return;$("#sorDlg").close();if(sorCb)sorCb(r.dataset.k)});

/* ---------- Excel, built on the workbook's own styles ---------- */
const xe=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const colL=n=>String.fromCharCode(64+n);
function buildEstXlsx(p,c){const e=ensure(p,c),k=calc(p,e),rows=[],merges=[];let R=0;
 const row=(h,cells,custom=true)=>{R++;rows.push(`<row r="${R}"${h?` ht="${h}"${custom?' customHeight="1"':""}`:""}>${cells.map(x=>x).join("")}</row>`);return R};
 const S=(col,st,v)=>`<c r="${col}${R+1}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
 const N=(col,st,v)=>`<c r="${col}${R+1}" s="${st}"><v>${v}</v></c>`;
 const F=(col,st,f,v,str)=>`<c r="${col}${R+1}" s="${st}"${str?' t="str"':""}><f>${xe(f)}</f><v>${str?xe(v):v}</v></c>`;
 const E=(col,st)=>`<c r="${col}${R+1}" s="${st}"/>`;
 const blank=(from,to,st)=>{let o="";for(let i=from;i<=to;i++)o+=E(colL(i),st);return o};
 row(29.25,[S("A",131,"ASSAM POWER DISTRIBUTION COMPANY LTD."),blank(2,9,132)]);merges.push("A1:I1");
 row(24.75,[S("A",131,"Samaguri Electrical Sub-Division, Nagaon ED-II, CAR"),blank(2,9,132)]);merges.push("A2:I2");
 row(13.5,[S("A",145,"PROVISIONAL ESTIMATE"),blank(2,6,145),S("G",133,"GSTIN :18AABCL1354J1ZJ"),blank(8,9,133)]);
 row(15.75,[blank(1,6,145),S("G",133,"PROFORMA INVOICE"),blank(8,9,133)]);merges.push("A3:F4","G3:I3","G4:I4");
 row(14.25,[S("A",143,"Document No : "+docOf(p)),blank(2,4,143),S("E",143,"Dt: "+dtOf(p)),E("F",143),S("G",134,"(not valid for Input Tax credit)"),blank(8,9,134)]);merges.push("A5:D5","E5:F5","G5:I5");
 row(45.75,[S("A",144,titleOf(p,c)),blank(2,6,144),S("G",135,"Rates as per SoR 2021-22"),blank(8,9,135)]);merges.push("A6:F6","G6:I6");
 if(e.sarma!==false){row(14.25,[S("A",136,"\"This estimate has been prepared incorporating the recommendations of Hon'ble Justice H.N. Sarma Commission.\""),blank(2,9,137)]);merges.push(`A${R}:I${R}`)}
 row(72,[S("A",104,"Sl. No."),S("B",105,"SOR Sl. No."),S("C",105,"Item Description"),S("D",105,"Unit"),S("E",106,"Quantity"),S("F",107,"Ex. Work Price in Rs."),S("G",108,"Amount\nin Rs."),S("H",109,hHeadOf(e)),S("I",130,"Remarks")]);
 const VL=(r,col)=>`VLOOKUP(B${r},'SOR-21-22 (2)'!$A$2:$${colL(col)}$931,${col},0)`;
 const htOf=d=>{const L=Math.max(1,Math.ceil(String(d).length/72));return L>1?+(L*14.4+1).toFixed(1):15};
 const item=(x,sl,job)=>{const r=x.r,it=x.it,rr=R+1,lk=!!(r.sor&&SOR[r.sor]&&!r.cust),eSt=job?160:isKm(it.unit)||!Number.isInteger(+r.q)?158:157;
  const cells=[job?S("A",118,sl):N("A",110,sl),lk?N("B",job?119:111,+r.sor):(r.sor?S("B",job?119:111,r.sor):E("B",job?119:111)),
   lk?F("C",job?120:112,VL(rr,4),it.desc,true):S("C",job?120:112,it.desc),lk?F("D",job?121:110,VL(rr,5),it.unit,true):S("D",job?121:110,it.unit),
   N("E",eSt,+r.q||0),lk?F("F",job?122:113,VL(rr,6),it.rate):N("F",job?122:113,it.rate),F("G",job?122:114,`F${rr}*E${rr}`,x.G),
   job?N("H",115,0):(x.H?F("H",115,`G${rr}`,x.G):N("H",115,0)),r.rem?S("I",htOf(it.desc)>15?159:129,r.rem):E("I",129)];
  row(htOf(it.desc),cells,htOf(it.desc)===15);return rr};
 const first=R+1;k.mat.forEach((x,i)=>item(x,i+1,false));const last=Math.max(R,first);
 const ab=(L,lab,gf,gv,hf,hv,o={})=>{const rr=R+1,st=o.st||[116,138,117];row(o.h||15,[L!==""?S("A",st[0],L):E("A",st[0]),S("B",st[1],lab),blank(3,6,st[1]),gf!=null?F("G",st[2],gf,gv):N("G",st[2],gv),hf===null?E("H",115):hf!=null?F("H",115,hf,hv):N("H",115,hv||0),E("I",129),...(o.jk||[])]);merges.push(`B${rr}:F${rr}`);return rr};
 const rA=ab("A","Cost of Material excl GST",`SUM(G${first}:G${last})`,k.A,`SUM(H${first}:H${last})`,k.HA);
 const rB=ab("B","Add: Transportation & Storage (5% of A )",`G${rA}*5%`,k.B,undefined,0);
 const rC=ab("C","Total Cost of materials",`G${rA}+G${rB}`,k.C,`H${rA}`,k.HA);
 const rD=ab("D","Add: Labour Charge (15% of C )",`G${rC}*15%`,k.D,undefined,0);
 const jl=k.job.length?k.job.map((x,i)=>ROM[i]).join("+"):"i+ii+iii",rE=R+1;
 ab("E","Add: Other expenses where labour charge is included ("+jl+")",k.job.length?`SUM(G${rE+1}:G${rE+k.job.length})`:null,k.E,undefined,0);
 k.job.forEach((x,i)=>item(x,ROM[i]||String(i+1),true));
 const rDE=ab("","Total: D + E",`G${rD}+G${rE}`,k.DE,undefined,0,{st:[116,142,117]});
 const rF=ab("F","Add: Contingency charge (% in K of C )",`G${rC}*K${R+1}`,k.F,undefined,0,{jk:[`<c r="J${R+1}" t="inlineStr"><is><t>Contingency % (0 = departmental; 3% for deposit work)</t></is></c>`,N("K",123,+e.kc||0)]});
 const rG=ab("G","Add: Supervision charge (% in K of (D+E))",`G${rDE}*K${R+1}`,k.G,undefined,0,{jk:[`<c r="J${R+1}" t="inlineStr"><is><t>Supervision % (0 = departmental; 15% for deposit work)</t></is></c>`,N("K",123,+e.ks||0)]});
 const rH=ab("H","Gross Estimate Cost ( C+D+E+F+G )",`G${rC}+G${rDE}+G${rF}+G${rG}`,k.Hh,`H${rC}`,k.HA);
 const rI=ab("I","Add: Processing  Fees: (As Applicable) ",null,k.I,undefined,0);
 const rJ=ab("J","CGST @ (9% on H)",`G${rH}*9%`,k.J,`H${rH}*9%`,k.H30);
 const rK=ab("K","SGST @ (9% on H)",`G${rH}*9%`,k.K,`H${rH}*9%`,k.H30);
 const rL=ab("L","Total Amount (H+I+J+K)",`G${rH}+G${rI}+G${rJ}+G${rK}`,k.L,`H${rH}+H${rJ}+H${rK}`,k.H32);
 const rM=hasCol(e)?ab("M",mLabOf(e),`H${rL}`,k.M,null):ab("M",mLabOf(e),null,0,null);
 const rN=ab("N","Less: Cost of metering equipments to be paid separately",null,k.N,null);
 const rO=ab("O","Total: L-M-N ( Total Estimate Amount )",`G${rL}-G${rM}-G${rN}`,k.O,null,null,{st:[124,139,125],h:14.25});
 ab("P","Total Estimated Amount ( ROUNDED OFF )",`ROUNDUP(G${rO},0)`,k.P,null,null,{st:[126,140,127],h:14.25});
 row(15,[S("A",161,"Rupees ("+words(k.P)+") only."),blank(2,8,141)]);merges.push(`A${R}:H${R}`);
 const sname=(p.name||"Estimate").replace(/[\\\/\?\*\[\]:']/g," ").replace(/\s+/g," ").trim().slice(0,31)||"Estimate";
 const fit=R>45?' fitToHeight="0"':"";
 const sh1=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:K${R}"/><sheetViews><sheetView tabSelected="1" zoomScaleNormal="100" workbookViewId="0"/></sheetViews><sheetFormatPr defaultColWidth="8.6640625" defaultRowHeight="14.4"/><cols><col min="1" max="1" width="6.109375" customWidth="1"/><col min="2" max="2" width="7" customWidth="1"/><col min="3" max="3" width="61.109375" customWidth="1"/><col min="4" max="4" width="4.88671875" customWidth="1"/><col min="6" max="6" width="12.6640625" customWidth="1"/><col min="7" max="7" width="15.88671875" customWidth="1"/><col min="8" max="8" width="12" customWidth="1"${hasCol(e)?"":' hidden="1"'}/><col min="9" max="9" width="16.5546875" customWidth="1"/><col min="10" max="10" width="52" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells><pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.511811023622047" footer="0.511811023622047"/><pageSetup paperSize="9" orientation="portrait"${fit} horizontalDpi="300" verticalDpi="300"/></worksheet>`;
 // hidden SoR sheet that the VLOOKUPs read — every SoR 2021-22 item, same layout as the workbook
 const sx=[`<row r="1" ht="110.25" customHeight="1">${(window.SOR_HDR||[]).map((h,i)=>`<c r="${colL(i+1)}1" s="${[51,52,51,51,51,53,54,54][i]}" t="inlineStr"><is><t>${xe(h)}</t></is></c>`).join("")}</row>`];let rn=1;
 Object.keys(SOR).sort((a,b)=>+a-+b).forEach(k2=>{const s=SOR[k2];rn++;const v=(col,st,x)=>x===""||x==null?`<c r="${col}${rn}" s="${st}"/>`:typeof x==="number"?`<c r="${col}${rn}" s="${st}"><v>${x}</v></c>`:`<c r="${col}${rn}" s="${st}" t="inlineStr"><is><t>${xe(x)}</t></is></c>`;
  sx.push(`<row r="${rn}">${v("A",57,+k2)}${v("B",57,s[0])}${v("C",57,s[1])}${v("D",58,s[2])}${v("E",57,s[3])}${v("F",59,s[4])}${v("G",60,s[5])}${v("H",60,s[6])}</row>`)});
 const sh2=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:H${rn}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultColWidth="9.109375" defaultRowHeight="14.4"/><cols><col min="1" max="1" width="9.88671875" style="45" customWidth="1"/><col min="2" max="2" width="8.88671875" style="46" customWidth="1"/><col min="3" max="3" width="7.44140625" style="46" customWidth="1"/><col min="4" max="4" width="39.88671875" style="47" customWidth="1"/><col min="5" max="5" width="9" style="46" customWidth="1"/><col min="6" max="6" width="15.44140625" style="48" customWidth="1"/><col min="7" max="7" width="14.88671875" style="48" customWidth="1"/><col min="8" max="8" width="14.33203125" style="49" customWidth="1"/></cols><sheetData>${sx.join("")}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.5" footer="0.5"/></worksheet>`;
 const DS=disOf(p,c).on?disSheet(p,c):null,WS=n=>`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
 const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${WS(1)}${WS(2)}${DS?WS(3):""}<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
 const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
 const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${xe(sname)}" sheetId="1" r:id="rId1"/>${DS?`<sheet name="Dismantling" sheetId="3" r:id="rId5"/>`:""}<sheet name="SOR-21-22 (2)" sheetId="2" state="hidden" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${xe(sname)}'!$A$1:$I$${R}</definedName>${DS?`<definedName name="_xlnm.Print_Area" localSheetId="1">Dismantling!$A$1:$I$${DS.R}</definedName>`:""}<definedName name="_xlnm.Print_Titles" localSheetId="${DS?2:1}">'SOR-21-22 (2)'!$1:$1</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
 const wrel=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>${DS?'<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>':""}</Relationships>`;
 return zip([["[Content_Types].xml",ct],["_rels/.rels",rels],["xl/workbook.xml",wb],["xl/_rels/workbook.xml.rels",wrel],["xl/styles.xml",window.EST_STY],["xl/theme/theme1.xml",window.EST_THEME],["xl/worksheets/sheet1.xml",sh1],["xl/worksheets/sheet2.xml",sh2],...(DS?[["xl/worksheets/sheet3.xml",DS.xml]]:[])])}
window.buildEstXlsx=buildEstXlsx;

/* ---------- Application (basis of the estimate) ---------- */
const DBN="sldsurvey-files";let idb=null;
function db(){return idb||(idb=new Promise((ok,no)=>{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>r.result.createObjectStore("files");r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}))}
async function fput(id,blob){const d=await db();return new Promise((ok,no)=>{const t=d.transaction("files","readwrite");t.objectStore("files").put(blob,id);t.oncomplete=ok;t.onerror=()=>no(t.error)})}
async function fget(id){const d=await db();return new Promise((ok,no)=>{const t=d.transaction("files").objectStore("files").get(id);t.onsuccess=()=>ok(t.result||null);t.onerror=()=>no(t.error)})}
async function fdel(id){const d=await db();return new Promise(ok=>{const t=d.transaction("files","readwrite");t.objectStore("files").delete(id);t.oncomplete=ok;t.onerror=ok})}
const app=p=>p.app=p.app||{name:"",date:"",ref:"",for:"",files:[]};
async function blobOf(f){let b=null;try{b=await fget(f.id)}catch(_){}if(!b&&f.drive&&window.PosDrive){try{b=await PosDrive.download(f.drive);if(b)await fput(f.id,b)}catch(_){}}return b}
let PDFJS=null;
function pdfjs(){return PDFJS||(PDFJS=new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";ok(window.pdfjsLib)};s.onerror=()=>{PDFJS=null;no(new Error("couldn't load the PDF reader"))};document.head.appendChild(s)}))}
async function pdfPages(blob,scale,max){const L=await pdfjs(),doc=await L.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise,out=[];
 for(let i=1;i<=Math.min(doc.numPages,max||99);i++){const pg=await doc.getPage(i),vp=pg.getViewport({scale}),cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;out.push(cv)}return{pages:out,n:doc.numPages}}
let appFor=null;
function renderApp(p){const a=app(p);if(appFor!==p.id||document.activeElement==null||!$("#appCard").contains(document.activeElement)){$("#apName").value=a.name||"";$("#apDate").value=a.date||"";$("#apRef").value=a.ref||"";$("#apFor").value=a.for||""}
 if(appFor===p.id&&$("#apFiles").dataset.sig===JSON.stringify(a.files))return;appFor=p.id;$("#apFiles").dataset.sig=JSON.stringify(a.files);
 $("#apFiles").innerHTML=a.files.map(f=>`<div class="appfile" data-id="${f.id}"><div class="th" data-open="${f.id}">${/pdf/.test(f.type)?"📄 PDF":"🖼"}</div><div class="nm" title="${esc(f.name)}">${esc(f.name)}</div><div class="ac"><button type="button" data-open="${f.id}">Open</button><button type="button" data-rm="${f.id}">Remove</button></div></div>`).join("");
 $("#apHint").textContent=a.files.length?(a.files.some(f=>f.drive)?"Kept on this device and in your Google Drive.":(window.PosDrive&&PosDrive.connected()?"Kept on this device; copying to Google Drive…":"Kept on this device. Connect Google Drive on the Pranju OS home page to have it on your other devices too.")):"";
 a.files.forEach(async f=>{const el=$("#apFiles").querySelector(`.appfile[data-id="${f.id}"] .th`);const b=await blobOf(f);if(!el)return;if(!b){el.textContent="Not on this device";return}
  if(/^image\//.test(f.type)){const u=URL.createObjectURL(b);el.innerHTML=`<img src="${u}" alt="">`}else if(/pdf/.test(f.type)){try{const r=await pdfPages(b,0.4,1);el.innerHTML="";el.appendChild(r.pages[0])}catch(_){}}})}
["apName","apDate","apRef","apFor"].forEach(id=>$("#"+id).addEventListener("change",e=>{const p=P(),a=app(p);a[{apName:"name",apDate:"date",apRef:"ref",apFor:"for"}[id]]=e.target.value.trim();touch(p)}));
async function addFiles(list){const p=P(),a=app(p);for(const f of list){if(!/^image\/|pdf$/.test(f.type)&&!/\.pdf$/i.test(f.name)){alert(f.name+" is not a PDF or an image.");continue}
  const id="ap_"+p.id+"_"+uid(),rec={id,name:f.name,type:f.type||(/\.pdf$/i.test(f.name)?"application/pdf":"image/jpeg"),size:f.size,at:Date.now()};
  try{await fput(id,f)}catch(e){alert("Couldn't keep "+f.name+" on this device: "+e.message);continue}a.files.push(rec);
  if(window.PosDrive&&PosDrive.connected())PosDrive.upload("photos","Application_"+fileBase()+"_"+f.name,f,{sldApp:p.id,fid:id}).then(r=>{rec.drive=r.id;touch(p);if(VIEW==="est")renderAll()}).catch(()=>{})}
 touch(p);renderAll()}
$("#apFile").addEventListener("change",e=>{addFiles([...e.target.files]);e.target.value=""});
const dz=$("#apDrop");["dragenter","dragover"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add("ov")}));["dragleave","drop"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove("ov")}));
dz.addEventListener("drop",e=>{if(e.dataTransfer&&e.dataTransfer.files)addFiles([...e.dataTransfer.files])});
$("#apFiles").addEventListener("click",async e=>{const o=e.target.closest("[data-open]"),rm=e.target.closest("[data-rm]"),p=P(),a=app(p);
 if(o){const f=a.files.find(x=>x.id===o.dataset.open),b=f&&await blobOf(f);if(b)window.open(URL.createObjectURL(b),"_blank");return}
 if(rm&&confirm("Remove this file from the survey?")){const f=a.files.find(x=>x.id===rm.dataset.rm);a.files=a.files.filter(x=>x!==f);await fdel(f.id);if(f.drive&&window.PosDrive)PosDrive.trash(f.drive).catch(()=>{});touch(p);renderAll()}});

/* ---------- Forwarding letter ---------- */
const fy=d=>{const t=d?new Date(d):new Date(),y=t.getFullYear(),m=t.getMonth()+1,s=m>=4?y:y-1;return s+"-"+String((s+1)%100).padStart(2,"0")};
const lc=s=>s?s[0].toLowerCase()+s.slice(1):s;
function draft(p,c){const e=ensure(p,c),k=calc(p,e),a=app(p),tt=(p.meta.estTitle||"").replace(/^\s*provisional estimate for\s*/i,"").replace(/\.\s*$/,""),work=tt||lc(workOf(c)).replace(/^construction of /,"")+" at "+locOf().replace(/^_+$/,"________"),loc=locOf().replace(/^_+$/,"________"),dt=d=>{if(!d)return"";const[y,m,dd]=d.split("-");return dd+"."+m+"."+y};
 const st=k.mat.filter(x=>x.H>0),rd=st.filter(x=>skOf(x.r)==="rdss"),om=st.filter(x=>skOf(x.r)==="om"),ru=st.filter(x=>skOf(x.r)==="reuse");
 const nm=x=>{const d=x.it.desc.replace(/\s+/g," ").trim(),kv=d.match(/(\d+)\s*KVA/i);if(kv&&/DTR|transformer/i.test(d))return kv[1]+" KVA DTR";if(/earth pipe/i.test(d))return(/^CI/i.test(d)?"CI ":"GI ")+"earth pipes";
  const a=d.match(/^ACSR\s*"?\s*(\w+)\s*"?\s*Conductor/i);if(a)return"ACSR "+a[1][0].toUpperCase()+a[1].slice(1).toLowerCase()+" conductor";if(/^\d+C\s*x/i.test(d))return"LT AB cable "+d.split(" (")[0];
  const T=[[/disc insulator/i,"disc insulators"],[/h\/?w fitting/i,"disc hardware fittings"],[/tension clamp/i,"tension clamps"],[/suspension clamp/i,"suspension clamps"],[/pg clamp/i,"PG clamps"],[/pin insulator/i,"pin insulators"],[/shackle insulator/i,"shackle insulators"],[/guy insulator/i,"guy insulators"],[/stay set/i,"stay sets"],[/stay wire/i,"stay wire"],[/channel cross arm/i,"channel cross arms"],[/cross arm/i,"cross arms"],[/tubular pole|SP-?\d+/i,"steel tubular poles"],[/PSC pole/i,"PSC poles"],[/rail pole/i,"rail poles"],[/lightning arrestor|lighting arrestor/i,"lightning arresters"],[/GOAB|AB switch/i,"AB switch"],[/DO fuse/i,"DO fuse sets"],[/MCCB/i,"MCCB"],[/distribution box/i,"distribution boxes"],[/jointing sleeve|sleeve/i,"jointing sleeves"],[/conductor/i,"conductor"]];
  for(const[rx,t]of T)if(rx.test(d))return t;
  const w=d.split(/\s*[(,]/)[0];if(w.length<=48)return w;return w.slice(0,48).replace(/\s+\S*$/,"")};
 const qn=x=>isKm(x.it.unit)?" ("+fmtQ(x.r.q,x.it.unit)+" KM)":"";
 let sorP="The estimate has been prepared as per SoR 2021-22.";
 if(st.length){const and=l=>l.reduce((o,x,i)=>o+(i===0?"":i===l.length-1?" and ":", ")+x,""),parts=[];
  if(rd.length)parts.push("the "+and(rd.map(x=>nm(x)+qn(x)))+" used in the works "+(rd.length>1?"are":"is")+" RDSS dismantled material");
  if(om.length)parts.push("the "+and(om.map(x=>nm(x)))+" "+(om.length>1?"were":"was")+" drawn from O&M stock");
  if(ru.length)parts.push("the "+and(ru.map(x=>nm(x)+qn(x)))+" "+(ru.length>1?"are":"is")+" reusable material from the existing installation");
  sorP+=" "+parts.reduce((o,x,i,l)=>o+(i===0?"":i===l.length-1?", and ":", ")+x,"").replace(/^the/,"The")+". The cost of the same has been deducted from the estimate as summarised below:"}
 else sorP+=" The estimate is summarised below:";
 const paras=[{t:"With regards to the subject cited above, I have the honour to submit herewith the provisional estimate for "+work+".",ind:1}];
 if(a.name||a.files.length)paras.push({t:"It may please be noted that "+(a.name?"an application"+(a.date?" dated "+dt(a.date):"")+(a.ref?" vide "+a.ref:"")+" has been received from "+a.name:"an application has been received")+(a.for?" for "+a.for:"")+". Accordingly, the site was surveyed and the provisional estimate has been prepared for the following works:",ind:1});
 else paras.push({t:"It may please be noted that the site was surveyed and the provisional estimate has been prepared for the following works:",ind:1});
 const works=autoWork(c).replace(/^Construction of /,"").split(/, | & /).map(s=>s.trim()).filter(Boolean).map(s=>s[0].toUpperCase()+s.slice(1)+".");
 return{no:"No. SDE/SESD/        /"+fy(p.meta.date)+"/",dated:"Dated:",to:"The Asst. General Manager\nNagaon Electrical Division- II\nNagaon, APDCL:: CAR",
  sub:"Submission of provisional estimate for "+work,paras,works,after:[],sorP:{t:sorP,ind:1},
  l2:[rd.length?"RDSS dismantled conductor":"",om.length?"O&M stock materials ("+om.map(x=>nm(x).replace(/^\d+ KVA /,"")).join(", ")+")":"",ru.length?"reusable materials ("+ru.map(x=>nm(x).replace(/^\d+ KVA /,"")).join(", ")+")":""].filter(Boolean).reduce((o,x,i,l)=>o+(i===0?"":i===l.length-1?" and ":", ")+x,""),
  close:"In this regard , you are requested to kindly accord approval of the aforementioned estimate. This is for favour of your kind information and necessary action.",
  ...(()=>{const d=disOf(p,c);if(!d.on)return{};const dk=disCalc(p,d);return{after:["A separate provisional estimate for dismantling of the existing materials, amounting to "+rin(dk.P)+" (Rupees "+words(dk.P)+" only), is also enclosed. The dismantled materials will be returned to the APDCL store."]}})(),
  encl:"Enclosed: Provisional estimate"+(disOf(p,c).on?", dismantling estimate":"")+(a.files.length?", application"+(a.name?" of "+a.name:""):"")+" and SLD as stated."}}
function fwOf(p,c){if(!p.fw)p.fw=draft(p,c);return p.fw}
function fwHTML(p,c,ed){const f=fwOf(p,c),k=calc(p,ensure(p,c)),CE=(key,tag="span",cls="")=>`<${tag} class="${cls}" ${ed?`contenteditable="true" data-k="${key}"`:""}>${esc(getK(f,key)).replace(/\n/g,"<br>")}</${tag}>`;
 const fx=(h)=>ed?`<span class="fx noprint">${h}</span>`:"";
 const rowsT=[["1.","Total amount of estimate",k.L]];if(k.M>0)rowsT.push([rowsT.length+1+".","Less: "+(f.l2||"RDSS dismantled conductor and O&M stock materials"),k.M,"l2"]);if(k.N>0)rowsT.push([rowsT.length+1+".","Less: Cost of metering equipments to be paid separately",k.N]);rowsT.push([rowsT.length+1+".","Net estimated amount (rounded off)",k.P]);
 return`<div class="fwp"><div class="lh"><img src="${window.APDCL_LOGO}" alt="">ASSAM POWER DISTRIBUTION COMPANY LIMITED<br>REGD OFFICE: BIJULEE BHABAN, PALTANBAZAR, GUWAHATI-781001, ASSAM<br>CIN: U40109AS20035GC007242<br>GISTN: 18AABCL154J1ZJ<br>OFFICE OF THE SUB-DIVISIONAL ENGINEER<br>SAMAGURI ELECTRICAL SUB-DIVISION<br>SAMAGURI, NAGAON, ASSAM-782140</div>
 <div class="rw">${CE("no")}${CE("dated")}</div>
 <div class="to">To,<div class="ad">${CE("to","div")}</div></div>
 <div class="sbj"><span class="k">Sub:</span>${CE("sub","div")}</div>
 <div style="margin:0 0 3px">Sir,</div>
 ${f.paras.map((x,i)=>`<p class="${x.ind?"ind":""}">${CE("paras."+i+".t","span")}${fx(`<button type="button" data-fw="padd" data-i="${i}" title="Add a paragraph after this">＋¶</button><button type="button" data-fw="pdel" data-i="${i}" title="Remove this paragraph">✕</button>`)}</p>`).join("")}
 ${f.works.length?`<ol>${f.works.map((w,i)=>`<li>${CE("works."+i,"span")}${fx(`<button type="button" data-fw="wadd" data-i="${i}" title="Add a point after this">＋</button><button type="button" data-fw="wdel" data-i="${i}" title="Remove this point">✕</button>`)}</li>`).join("")}</ol>`:ed?`<p class="noprint">${fx('<button type="button" data-fw="wadd" data-i="-1">＋ Add numbered points</button>')}</p>`:""}
 ${(f.after||[]).map((x,i)=>`<p class="ind">${CE("after."+i,"span")}${fx(`<button type="button" data-fw="adel" data-i="${i}">✕</button>`)}</p>`).join("")}${ed?`<p class="noprint" style="margin:-6px 0 8px">${fx('<button type="button" data-fw="aadd">＋ Paragraph after the points</button>')}</p>`:""}
 <p class="ind">${CE("sorP.t")}</p>
 <table class="sm"><tr class="h"><td class="s">SL NO.</td><td>PARTICULARS</td><td class="a" style="font-weight:400">AMOUNT (Rs.)</td></tr>${rowsT.map(r=>`<tr><td class="s">${r[0]}</td><td>${r[3]?"Less: "+CE(r[3]):esc(r[1])}</td><td class="a">${rin(r[2])}</td></tr>`).join("")}</table>
 <div style="text-align:justify">${CE("close","span")}</div><div style="margin:0 0 14px">${CE("encl","span")}</div>
 <div class="sg"><div>Thanking you,</div><div></div></div><div style="text-align:right;margin:4px 14mm 0 0">Yours faithfully</div>
 <div style="height:52px"></div><div style="display:flex;justify-content:flex-end"><div class="r" style="text-align:center;font-weight:700;font-size:13.4pt;line-height:1.1">Sub Divisional Engineer<br>Samaguri Electrical Sub Division<br>APDCL::CAR</div></div></div>`}
function getK(o,path){return path.split(".").reduce((x,k)=>x==null?x:x[k],o)}
function setK(o,path,v){const ks=path.split("."),last=ks.pop(),t=ks.reduce((x,k)=>x[k],o);t[last]=v}
window.renderFw=function(c){const p=P();$("#fwBox").innerHTML=fwHTML(p,c,true)};
$("#fwBox").addEventListener("input",e=>{const el=e.target.closest("[data-k]");if(!el)return;const p=P();setK(fwOf(p,compute(p)),el.dataset.k,el.innerText.replace(/ /g," ").replace(/\n$/,""));p.upd=Date.now();save()});
$("#fwBox").addEventListener("focusout",e=>{if(e.target.closest("[data-k]"))touch(P())});
$("#fwBox").addEventListener("click",e=>{const b=e.target.closest("button[data-fw]");if(!b)return;const p=P(),f=fwOf(p,compute(p)),i=+b.dataset.i,a=b.dataset.fw;
 if(a==="padd")f.paras.splice(i+1,0,{t:"",ind:1});if(a==="pdel"&&confirm("Remove this paragraph?"))f.paras.splice(i,1);
 if(a==="wadd")f.works.splice(i+1,0,"");if(a==="wdel")f.works.splice(i,1);if(a==="aadd")(f.after=f.after||[]).push("");if(a==="adel")f.after.splice(i,1);
 touch(p);renderAll()});
$("#fwRedraft").onclick=()=>{const p=P();if(p.fw&&!confirm("Write the letter again from the estimate and application? Your changes to the letter will be lost."))return;delete p.fw;touch(p);renderAll()};

/* printing: letter / full set */
async function appImages(p){const a=app(p),out=[];for(const f of a.files){const b=await blobOf(f);if(!b)continue;
  if(/^image\//.test(f.type))out.push(`<img src="${URL.createObjectURL(b)}" alt="">`);else if(/pdf/.test(f.type)){try{const r=await pdfPages(b,2,40);r.pages.forEach(cv=>out.push(`<img src="${cv.toDataURL("image/jpeg",0.9)}" alt="">`))}catch(_){out.push(`<p style="font:14px serif;padding:20mm">Application (${esc(f.name)}) is a PDF and could not be added to this print here — please print it separately.</p>`)}}}return out.join("")}
const _doPrint=window.doPrint;window.fitEstHook=()=>fitEst();
// each estimate (main and dismantling) on its own page, shrunk to fit like the workbook's fit-to-page
function fitEst(){const pe=$("#printEst"),lim=277*96/25.4;pe.querySelectorAll(".xe").forEach(x=>{const m=document.createElement("div");m.style.cssText="position:absolute;left:-9999px;top:0;width:190mm;visibility:hidden";m.innerHTML=x.outerHTML;document.body.appendChild(m);
 const h=m.scrollHeight;m.remove();const z=h>lim?Math.max(0.55,lim/h-0.01):1;x.style.zoom=z===1?"":z})}
window.doPrint=async function(which){const p=P(),c=compute(p);$("#printFw").innerHTML="";$("#printApp").innerHTML="";$("#printEst").innerHTML='<div class="est">'+estHTML(c)+"</div>";fitEst();
 if(which==="fw"||which==="set"){$("#printFw").innerHTML=`<div class="fwwrap">${fwHTML(p,c,false)}</div>`}
 if(which==="set"){$("#printApp").innerHTML=await appImages(p)}
 if(which==="fw"){document.body.classList.remove("p-sld","p-est");document.body.classList.add("p-fw");setTimeout(()=>window.print(),120);return}
 if(which==="set")which="";
 _doPrint(which)};
window.addEventListener("afterprint",()=>document.body.classList.remove("p-fw"));
$("#fwPrint").onclick=()=>doPrint("fw");$("#fwSet").onclick=()=>doPrint("set");
$("#fwDocx").onclick=()=>{try{const p=P();dlBin(buildDocx(p,compute(p)),"Forwarding_"+fileBase()+".docx")}catch(e){alert("Couldn't build the Word file: "+e.message)}};

/* ---------- Word (.docx) ---------- */
function dlBin(u8,name){const b=new Blob([u8],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function b64u8(d){const s=atob(d.split(",")[1]),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function buildDocx(p,c){const f=fwOf(p,c),k=calc(p,ensure(p,c)),X=s=>xe(s);
 const run=(t,o={})=>`<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${o.b?"<w:b/>":""}<w:sz w:val="${o.sz||24}"/></w:rPr>${String(t).split("\n").map((l,i)=>(i?"<w:br/>":"")+`<w:t xml:space="preserve">${X(l)}</w:t>`).join("")}</w:r>`;
 const para=(runs,o={})=>`<w:p><w:pPr><w:spacing w:after="${o.after==null?200:o.after}" w:line="240" w:lineRule="auto"/>${o.jc?`<w:jc w:val="${o.jc}"/>`:""}${o.ind?`<w:ind ${o.ind}/>`:""}${o.tabs?`<w:tabs>${o.tabs}</w:tabs>`:""}</w:pPr>${runs}</w:p>`;
 const tab='<w:r><w:tab/></w:r>';
 const lh=["ASSAM POWER DISTRIBUTION COMPANY LIMITED","REGD OFFICE: BIJULEE BHABAN, PALTANBAZAR, GUWAHATI-781001, ASSAM","CIN: U40109AS20035GC007242","GISTN: 18AABCL154J1ZJ","OFFICE OF THE SUB-DIVISIONAL ENGINEER","SAMAGURI ELECTRICAL SUB-DIVISION","SAMAGURI, NAGAON, ASSAM-782140"];
 const img=`<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="2" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>-640080</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="822960" cy="822960"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Logo"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="822960" cy="822960"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
 const body=[];
 lh.forEach((l,i)=>body.push(para((i===0?img:"")+run(l,{sz:20}),{jc:"center",after:0})));
 body.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:after="240"/></w:pPr></w:p>`);
 body.push(para(run(f.no,{b:1})+tab+run(f.dated,{b:1}),{tabs:'<w:tab w:val="right" w:pos="9026"/>',after:360}));
 body.push(para(run("To,"),{after:0}));f.to.split("\n").forEach((l,i,a)=>body.push(para(run(l,{b:1}),{ind:'w:left="720"',after:i===a.length-1?240:0})));
 body.push(para(run("Sub:")+tab+run(f.sub),{ind:'w:left="0"',tabs:'<w:tab w:val="left" w:pos="720"/>',jc:"both"}));
 body.push(para(run("Sir,"),{after:40}));
 f.paras.forEach(x=>body.push(para(run(x.t),{jc:"both",ind:x.ind?'w:firstLine="720"':""})));
 f.works.forEach((w,i)=>body.push(para(run((i+1)+".")+tab+run(w),{jc:"both",ind:'w:left="1080" w:hanging="360"',after:i===f.works.length-1?200:0,tabs:'<w:tab w:val="left" w:pos="1080"/>'})));
 (f.after||[]).forEach(x=>body.push(para(run(x),{jc:"both",ind:'w:firstLine="720"'})));
 body.push(para(run(f.sorP.t),{jc:"both",ind:'w:firstLine="720"'}));
 const rowsT=[["SL NO.","PARTICULARS","AMOUNT (Rs.)",0],["1.","Total amount of estimate",rin(k.L),1]];if(k.M>0)rowsT.push([rowsT.length+".","Less: "+(f.l2||"RDSS dismantled conductor and O&M stock materials"),rin(k.M),1]);if(k.N>0)rowsT.push([rowsT.length+".","Less: Cost of metering equipments to be paid separately",rin(k.N),1]);rowsT.push([rowsT.length+".","Net estimated amount (rounded off)",rin(k.P),1]);
 const tc=(t,w,b)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${para(run(t,{b}),{after:0})}</w:tc>`;
 body.push(`<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/><w:tblBorders>${["top","left","bottom","right","insideH","insideV"].map(s=>`<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="900"/><w:gridCol w:w="5426"/><w:gridCol w:w="2700"/></w:tblGrid>${rowsT.map(r=>`<w:tr>${tc(r[0],900)}${tc(r[1],5426)}${tc(r[2],2700,r[3])}</w:tr>`).join("")}</w:tbl>`);
 body.push(para("",{after:120}));body.push(para(run(f.close),{jc:"both",after:0}));body.push(para(run(f.encl),{after:240}));
 body.push(para(run("Thanking you,",{sz:26}),{after:0}));body.push(para(run("Yours faithfully",{sz:26}),{jc:"right",ind:'w:right="900"',after:900}));
 ["Sub Divisional Engineer","Samaguri Electrical Sub Division","APDCL::CAR"].forEach(l=>body.push(para(run(l,{b:1,sz:26}),{jc:"center",ind:'w:left="5040"',after:0})));
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="1080" w:bottom="720" w:left="1440" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
 const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
 const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
 const drel=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`;
 return zipBin([["[Content_Types].xml",ct],["_rels/.rels",rels],["word/document.xml",doc],["word/_rels/document.xml.rels",drel],["word/media/logo.png",b64u8(window.APDCL_LOGO)]])}
// a zip writer that also takes binary parts (the shared one only takes text)
function zipBin(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;
 files.forEach(([name,data])=>{const nb=enc.encode(name),d=typeof data==="string"?enc.encode(data):data,crc=crc32(d),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nb.length,true);
  parts.push(new Uint8Array(h.buffer),nb,d);const cd=new DataView(new ArrayBuffer(46));cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);cd.setUint16(8,0x0800,true);cd.setUint32(16,crc,true);cd.setUint32(20,d.length,true);cd.setUint32(24,d.length,true);cd.setUint16(28,nb.length,true);cd.setUint32(42,off,true);
  cen.push(new Uint8Array(cd.buffer),nb);off+=30+nb.length+d.length});
 const cl=cen.reduce((s,x)=>s+x.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cl,true);end.setUint32(16,off,true);
 const all=[...parts,...cen,new Uint8Array(end.buffer)],out=new Uint8Array(all.reduce((s,x)=>s+x.length,0));let o=0;all.forEach(x=>{out.set(x,o);o+=x.length});return out}
window.buildDocx=buildDocx;

/* ---------- Dismantling estimate (editable, same look; 85% of SoR for dismantled material) ---------- */
function disSig(c){const d=dism(c);return JSON.stringify(d?d.rows.map(r=>[r.sor,r.q]):[])}
function disGen(c){const d=dism(c);return d?d.rows.map(r=>{const k=/^\d+$/.test(r.sor)&&SOR[r.sor]?r.sor:"";return{id:uid(),sor:k,q:r.q,rem:"",...(k?{}:{cust:true,d:r.desc,u:r.unit,r:r.rate})}}):[]}
function disOf(p,c){if(!p.dis){const rows=disGen(c);p.dis={on:rows.length>0,rows,sig:disSig(c),edited:false,ks:p.meta.pay==="dep"?0.15:0,kc:0}}
 const d=p.dis;if(!d.edited){const sg=disSig(c);if(sg!==d.sig){d.rows=disGen(c);d.sig=sg;if(d.rows.length&&d.auto!==false)d.on=true}}return d}
function disCalc(p,d){const rows=d.rows.map(r=>{const it=itemOf(r),r85=it.rate*0.85,amt=r85*(+r.q||0);return{r,it,r85,amt}});
 const A=rows.reduce((s,x)=>s+x.amt,0),B=A*0.05,C=A+B,D=C*0.15,E=C*(+d.kc||0),F=D*(+d.ks||0),G=C+D+E+F,H=G-A,I=H*0.09,J=H*0.09,K=H+I+J,Pp=Math.ceil(K-1e-9),SG=F*1.18;
 return{rows,A,B,C,D,E,F,G,H,I,J,K,P:Pp,SG,SGP:Math.ceil(SG-1e-9),dep:(+d.ks||0)>0}}
const disTitleOf=(p,c)=>p.meta.disTitle||("Provisional Estimate for dismantling of existing materials in connection with "+(p.meta.estTitle?p.meta.estTitle.replace(/^\s*provisional estimate for\s*/i,"").replace(/\.\s*$/,""):lc(workOf(c))+" at "+locOf())+".");
function disHTML(p,c,ed){const d=disOf(p,c);
 if(!d.on)return ed?`<div class="disbar noprint"><label class="ck"><input type="checkbox" data-dg="on"> Include a dismantling estimate${d.rows.length?` (${d.rows.length} item${d.rows.length>1?"s":""} from the SLD)`:""}</label></div>`:"";
 const k=disCalc(p,d),ctl=h=>ed?`<td class="ctl">${h||""}</td>`:"";let sl=0;
 const row=x=>{const r=x.r,it=x.it,bad=r.sor&&!SOR[r.sor]&&!r.cust,vt=ed&&!r.cust&&SOR[r.sor]&&SOR[r.sor][9]?`<span class="vt noprint">${kvTag(SOR[r.sor][9])}</span>`:"";
  return`<tr class="it"><td class="c">${++sl}</td><td class="c">${ed?`<input class="ci sor${bad?" bad":""}" data-df="sor" data-id="${r.id}" value="${esc(r.cust&&!r.sor?"":r.sor)}" inputmode="numeric">`:esc(r.sor)}</td>
  <td class="l">${r.cust&&ed?`<textarea class="ci" data-df="d" data-id="${r.id}" rows="1">${esc(it.desc)}</textarea>`:esc(bad?"(not in SoR 2021-22)":it.desc)+vt}${ed?` <button type="button" class="pk" data-da="pick" data-id="${r.id}" title="Pick from SoR">🔍</button>`:""}</td>
  <td class="c">${r.cust&&ed?`<input class="ci" data-df="u" data-id="${r.id}" value="${esc(it.unit)}">`:esc(it.unit)}</td><td class="c">${ed?`<input class="ci n" data-df="q" data-id="${r.id}" value="${fmtQ(r.q,it.unit)}" inputmode="decimal">`:fmtQ(r.q,it.unit)}</td>
  <td class="l">${r.cust&&ed?`<input class="ci n" data-df="r" data-id="${r.id}" value="${it.rate}" inputmode="decimal">`:rup(it.rate)}</td><td class="c">${rup(x.r85)}</td><td class="c">${rup(x.amt)}</td><td class="i">${ed?`<input class="ci" data-df="rem" data-id="${r.id}" value="${esc(r.rem||"")}">`:esc(r.rem||"")}</td>
  ${ctl(`<button type="button" data-da="up" data-id="${r.id}">↑</button><button type="button" data-da="dn" data-id="${r.id}">↓</button><button type="button" data-da="del" data-id="${r.id}">✕</button>`)}</tr>`};
 const ab=(L,t,v,o={})=>`<tr class="ab${o.nb?" nb":""}"><td class="c">${L}</td><td class="l" colspan="6">${t}</td><td class="c">${rup(v)}</td><td></td>${ctl(o.ctl)}</tr>`;
 const pct=(f,v)=>ed?`<label class="pc">@ <input class="ci n" data-dg="${f}" value="${Math.round((+v||0)*10000)/100}" inputmode="decimal">%</label>`:"";
 const W2=[6.11,7,56,4.89,8.66,12.66,13.5,15.89,12],T2=W2.reduce((a,b)=>a+b,0);
 return`${ed?`<div class="disbar noprint"><label class="ck"><input type="checkbox" data-dg="on" checked> Include the dismantling estimate</label>${d.edited?` <button type="button" class="btn alt sm" data-da="regen">↻ Rebuild from SLD</button>`:""}</div>`:""}
 <div style="break-before:page;page-break-before:always;height:1px"></div>
 <div class="xe${ed?" ed":""}"><table class="xs"><colgroup>${W2.map(w=>`<col style="width:${(w/T2*100).toFixed(3)}%">`).join("")}${ed?'<col class="ctlc">':""}</colgroup><tbody>
 <tr style="height:29px"><td colspan="9" class="h1 c">ASSAM POWER DISTRIBUTION COMPANY LTD.</td>${ctl()}</tr>
 <tr style="height:25px"><td colspan="9" class="h1 c">Samaguri Electrical Sub-Division, Nagaon ED-II, CAR</td>${ctl()}</tr>
 <tr style="height:14px"><td colspan="6" rowspan="2" class="h2 c">PROVISIONAL ESTIMATE (DISMANTLING)</td><td colspan="3" class="ar b c">GSTIN :18AABCL1354J1ZJ</td>${ctl()}</tr>
 <tr style="height:16px"><td colspan="3" class="ar b c">PROFORMA INVOICE</td>${ctl()}</tr>
 <tr style="height:14px"><td colspan="4" class="cal">Document No : ${esc(docOf(p))}</td><td colspan="2" class="cal">Dt: ${esc(dtOf(p))}</td><td colspan="3" class="ar c">(not valid for Input Tax credit)</td>${ctl()}</tr>
 <tr style="height:46px"><td colspan="6" class="ti">${ed?`<textarea class="ci" data-dm="disTitle" rows="3">${esc(disTitleOf(p,c))}</textarea>`:esc(disTitleOf(p,c))}</td><td colspan="3" class="sr c">Rates as per SoR 2021-22</td>${ctl()}</tr>
 <tr class="hd" style="height:60px"><td class="c nb">Sl. No.</td><td class="c">SOR Sl. No.</td><td class="c">Item Description</td><td class="c">Unit</td><td class="c">Quantity</td><td class="c">Ex. Work Price in Rs.</td><td class="c">Dismantled material rate (85% of SoR)</td><td class="c">Amount<br>in Rs.</td><td class="c">Remarks</td>${ctl()}</tr>
 ${k.rows.map(row).join("")}
 ${ed?`<tr class="add"><td colspan="9"><button type="button" data-da="add">＋ Add item</button><button type="button" data-da="addpick">🔍 Add from SoR</button><button type="button" data-da="addcust">＋ Item without SoR No.</button></td>${ctl()}</tr>`:""}
 ${ab("A","Value of dismantled materials (85% of SoR)",k.A)}${ab("B","Add: Transportation &amp; Storage (5% of A )",k.B)}${ab("C","Total ( A+B )",k.C)}${ab("D","Add: Labour Charge (15% of C )",k.D)}
 ${ab("E","Add: Contingency charge (% of C )",k.E,{ctl:pct("kc",d.kc)})}${ab("F","Add: Supervision charge (% of D )",k.F,{ctl:pct("ks",d.ks)})}
 ${ab("G","Gross total ( C+D+E+F )",k.G)}${ab("H","Dismantling charges ( G − A )",k.H)}${ab("I","CGST @ (9% on H)",k.I)}${ab("J","SGST @ (9% on H)",k.J)}${ab("K","Total Amount ( H+I+J )",k.K)}
 ${ab("P","Total Estimated Amount ( ROUNDED OFF )",k.P,{nb:1})}
 <tr class="wd"><td colspan="8">Rupees (${words(k.P)}) only.</td><td class="nob"></td>${ctl()}</tr>
 <tr class="wd"><td colspan="9" style="font-weight:400;font-style:italic">${k.dep?`Amount to be deposited (supervision charge with GST): ${rup(k.F)} + GST 18% ${rup(k.SG-k.F)} = ${rup(k.SG)}, say ${rup(k.SGP)}. `:""}Dismantled materials to be returned to APDCL store.</td>${ctl()}</tr>
 </tbody></table></div>`}
function disEdit(fn){const p=P(),c=compute(p),d=disOf(p,c);fn(p,d,c);d.edited=true;touch(p);renderAll()}
box.addEventListener("change",ev=>{const t=ev.target,p=P();
 if(t.dataset.dm){const v=t.value.trim();p.meta.disTitle=v===disTitleOf({meta:{...p.meta,disTitle:""}},compute(p))?"":v;touch(p);renderAll();return}
 if(t.dataset.dg){const k=t.dataset.dg,c=compute(p),d=disOf(p,c);if(k==="on"){d.on=t.checked;d.auto=false;touch(p);renderAll()}else disEdit((p,d)=>{d[k]=(+t.value||0)/100});return}
 const id=t.dataset.id,f=t.dataset.df;if(!id||!f)return;
 disEdit((p,d)=>{const r=d.rows.find(x=>x.id===id);if(!r)return;
  if(f==="sor"){const v=t.value.trim();if(!v){r.sor="";if(!r.cust){r.cust=true;r.d=r.d||"";r.u=r.u||"";r.r=r.r||0}return}r.sor=v;if(SOR[v])delete r.cust}
  else if(f==="q")r.q=+t.value||0;else if(f==="rem")r.rem=t.value.trim();else if(f==="d")r.d=t.value;else if(f==="u")r.u=t.value.trim();else if(f==="r")r.r=+t.value||0})});
box.addEventListener("click",ev=>{const b=ev.target.closest("button[data-da]");if(!b)return;const a=b.dataset.da,id=b.dataset.id;
 if(a==="regen"){if(!confirm("Start the dismantling estimate again from the SLD? Your changes to it will be lost."))return;const p=P(),c=compute(p),on=p.dis&&p.dis.on;delete p.dis;disOf(p,c).on=!!on||p.dis.on;touch(p);renderAll();return}
 if(a==="pick"){openSor(k=>disEdit((p,d)=>{const r=d.rows.find(x=>x.id===id);if(r){r.sor=k;delete r.cust}}),"Change item");return}
 if(a==="addpick"){openSor(k=>disEdit((p,d)=>{d.rows.push({id:uid(),sor:k,q:1,rem:""})}),"Add dismantled item");return}
 disEdit((p,d)=>{const i=d.rows.findIndex(r=>r.id===id),r=d.rows[i];
  if(a==="add")d.rows.push({id:uid(),sor:"",q:1,rem:""});else if(a==="addcust")d.rows.push({id:uid(),sor:"",cust:true,d:"",u:"No.",r:0,q:1,rem:""});
  else if(!r)return;else if(a==="del"){if(confirm("Delete this row?"))d.rows.splice(i,1)}
  else if(a==="up"&&i>0){d.rows[i]=d.rows[i-1];d.rows[i-1]=r}else if(a==="dn"&&i<d.rows.length-1){d.rows[i]=d.rows[i+1];d.rows[i+1]=r}})});
function disSheet(p,c){const d=disOf(p,c),k=disCalc(p,d),rows=[],merges=[];let R=0;
 const row=(h,cells,custom=true)=>{R++;rows.push(`<row r="${R}"${h?` ht="${h}"${custom?' customHeight="1"':""}`:""}>${cells.join("")}</row>`)};
 const S=(col,st,v)=>`<c r="${col}${R+1}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`,N=(col,st,v)=>`<c r="${col}${R+1}" s="${st}"><v>${v}</v></c>`,
  F=(col,st,f,v,str)=>`<c r="${col}${R+1}" s="${st}"${str?' t="str"':""}><f>${xe(f)}</f><v>${str?xe(v):v}</v></c>`,E=(col,st)=>`<c r="${col}${R+1}" s="${st}"/>`,blank=(a,b,st)=>{let o="";for(let i=a;i<=b;i++)o+=E(colL(i),st);return o};
 row(29.25,[S("A",131,"ASSAM POWER DISTRIBUTION COMPANY LTD."),blank(2,9,132)]);merges.push("A1:I1");
 row(24.75,[S("A",131,"Samaguri Electrical Sub-Division, Nagaon ED-II, CAR"),blank(2,9,132)]);merges.push("A2:I2");
 row(13.5,[S("A",145,"PROVISIONAL ESTIMATE (DISMANTLING)"),blank(2,6,145),S("G",133,"GSTIN :18AABCL1354J1ZJ"),blank(8,9,133)]);
 row(15.75,[blank(1,6,145),S("G",133,"PROFORMA INVOICE"),blank(8,9,133)]);merges.push("A3:F4","G3:I3","G4:I4");
 row(14.25,[S("A",143,"Document No : "+docOf(p)),blank(2,4,143),S("E",143,"Dt: "+dtOf(p)),E("F",143),S("G",134,"(not valid for Input Tax credit)"),blank(8,9,134)]);merges.push("A5:D5","E5:F5","G5:I5");
 row(45.75,[S("A",144,disTitleOf(p,c)),blank(2,6,144),S("G",135,"Rates as per SoR 2021-22"),blank(8,9,135)]);merges.push("A6:F6","G6:I6");
 row(60,[S("A",104,"Sl. No."),S("B",105,"SOR Sl. No."),S("C",105,"Item Description"),S("D",105,"Unit"),S("E",106,"Quantity"),S("F",107,"Ex. Work Price in Rs."),S("G",108,"Dismantled material rate (85% of SoR)"),S("H",108,"Amount\nin Rs."),S("I",130,"Remarks")]);
 const VL=(r,col)=>`VLOOKUP(B${r},'SOR-21-22 (2)'!$A$2:$${colL(col)}$931,${col},0)`,htOf=t=>{const L=Math.max(1,Math.ceil(String(t).length/68));return L>1?+(L*14.4+1).toFixed(1):15};
 const first=R+1;k.rows.forEach((x,i)=>{const r=x.r,it=x.it,rr=R+1,lk=!!(r.sor&&SOR[r.sor]&&!r.cust),h=htOf(it.desc);
  row(h,[N("A",110,i+1),lk?N("B",111,+r.sor):(r.sor?S("B",111,r.sor):E("B",111)),lk?F("C",112,VL(rr,4),it.desc,true):S("C",112,it.desc),lk?F("D",110,VL(rr,5),it.unit,true):S("D",110,it.unit),
   N("E",isKm(it.unit)||!Number.isInteger(+r.q)?158:157,+r.q||0),lk?F("F",113,VL(rr,6),it.rate):N("F",113,it.rate),F("G",114,`F${rr}*85%`,x.r85),F("H",114,`G${rr}*E${rr}`,x.amt),r.rem?S("I",129,r.rem):E("I",129)],h===15)});
 const last=Math.max(R,first);
 const ab=(L,lab,f,v,o={})=>{const rr=R+1,st=o.st||[116,138,117];row(o.h||15,[S("A",st[0],L),S("B",st[1],lab),blank(3,7,st[1]),f!=null?F("H",st[2],f,v):N("H",st[2],v),E("I",129),...(o.jk||[])]);merges.push(`B${rr}:G${rr}`);return rr};
 const a=ab("A","Value of dismantled materials (85% of SoR)",`SUM(H${first}:H${last})`,k.A),b=ab("B","Add: Transportation & Storage (5% of A )",`H${a}*5%`,k.B),cc=ab("C","Total ( A+B )",`H${a}+H${b}`,k.C),dd=ab("D","Add: Labour Charge (15% of C )",`H${cc}*15%`,k.D);
 const ee=ab("E","Add: Contingency charge (% in K of C )",`H${cc}*K${R+1}`,k.E,{jk:[`<c r="J${R+1}" t="inlineStr"><is><t>Contingency %</t></is></c>`,N("K",123,+d.kc||0)]});
 const ff=ab("F","Add: Supervision charge (% in K of D )",`H${dd}*K${R+1}`,k.F,{jk:[`<c r="J${R+1}" t="inlineStr"><is><t>Supervision % (0 = departmental; 15% for deposit work)</t></is></c>`,N("K",123,+d.ks||0)]});
 const gg=ab("G","Gross total ( C+D+E+F )",`H${cc}+H${dd}+H${ee}+H${ff}`,k.G),hh=ab("H","Dismantling charges ( G − A )",`H${gg}-H${a}`,k.H),ii=ab("I","CGST @ (9% on H)",`H${hh}*9%`,k.I),jj=ab("J","SGST @ (9% on H)",`H${hh}*9%`,k.J);
 const kk=ab("K","Total Amount ( H+I+J )",`H${hh}+H${ii}+H${jj}`,k.K,{st:[124,139,125],h:14.25});ab("P","Total Estimated Amount ( ROUNDED OFF )",`ROUNDUP(H${kk},0)`,k.P,{st:[126,140,127],h:14.25});
 row(15,[S("A",161,"Rupees ("+words(k.P)+") only."),blank(2,8,141)]);merges.push(`A${R}:H${R}`);
 row(15,[S("A",136,(k.dep?"Amount to be deposited (supervision charge with GST): "+rup(k.SG)+", say "+rup(k.SGP)+". ":"")+"Dismantled materials to be returned to APDCL store."),blank(2,9,137)]);merges.push(`A${R}:I${R}`);
 return{xml:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:K${R}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultColWidth="8.6640625" defaultRowHeight="14.4"/><cols><col min="1" max="1" width="6.109375" customWidth="1"/><col min="2" max="2" width="7" customWidth="1"/><col min="3" max="3" width="56" customWidth="1"/><col min="4" max="4" width="4.88671875" customWidth="1"/><col min="6" max="6" width="12.6640625" customWidth="1"/><col min="7" max="7" width="13.5" customWidth="1"/><col min="8" max="8" width="15.88671875" customWidth="1"/><col min="9" max="9" width="12" customWidth="1"/><col min="10" max="10" width="40" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells><pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/><pageSetup paperSize="9" orientation="portrait" horizontalDpi="300" verticalDpi="300"/></worksheet>`,R}}

window.EstDoc={calc,ensure,sheetHTML,words,genRows,draft,fwOf,disOf,disCalc};
})();
