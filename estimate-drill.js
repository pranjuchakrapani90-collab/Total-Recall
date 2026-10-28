/* Pole-to-BoQ Trainer · Estimate drill (28 Oct 2026)
   A blank estimate sheet laid out like the office Excel: tap the SoR cell to pull the item in (as VLOOKUP does),
   type the quantity and the amount works itself out, then fill the A–P abstract percentages yourself.
   It is the last step of every lesson (one structure) and of every level (a mix of that level's structures).
   Mounted by the trainer: Drill.mount(el,{key,pool,mix,pass,onPass}). Rates are always APDCL SoR 2021-22.
   Uses the trainer's globals: C, K, kitRows, tolOf, fmt, fq, esc, lsGet, lsSet. */
(function(){
"use strict";
const D=document,q$=s=>D.querySelector(s);let root=null,OPT=null;
const DRAFT="p2b-drill-cur",HIST="p2b-drill";
const TYPES={
 dept:{t:"Departmental (capital / O&M)",f:0,gd:0,ge:0,note:"Departmental work: no contingency and no supervision charge."},
 dep:{t:"Deposit work (party pays)",f:3,gd:15,ge:2.25,note:"Deposit work: contingency 3% of C, supervision 15% of D plus 2.25% of E."},
 veh:{t:"Vehicular damage, recovered from the party",f:3,gd:15,ge:2.25,note:"Recovery estimate for vehicular damage: same loadings as deposit work, contingency 3% of C, supervision 15% of D plus 2.25% of E."}
};
const ABK=[["b","bb"],["d","db"],["f","fb"],["g1"],["g2"],["j"],["k"]];
const r2=n=>Math.round(n*100)/100;
let S=null;
function drafts(){try{const d=JSON.parse(lsGet(DRAFT,"{}"));return d&&!d.sc&&typeof d==="object"?d:{}}catch(e){return {}}}
function load(){const d=drafts();S=d[OPT.key]||null;if(S&&(!S.sc||!Array.isArray(S.rows)))S=null;if(S)S.sc.kits=S.sc.kits.filter(([k])=>K[k]&&OPT.pool.includes(k));if(S&&!S.sc.kits.length)S=null}
function save(){const d=drafts();d[OPT.key]=S;lsSet(DRAFT,JSON.stringify(d))}

/* ---------- the work to estimate ---------- */
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function maxCount(k){const lv=K[k].lv;return lv==="blk"?4:lv==="lt"||lv==="hv"?3:/per route-km/.test(K[k].t)?2:1}
function newScenario(){
 const pool=OPT.pool;if(!pool.length)return null;
 const pick=[...pool].sort(()=>Math.random()-.5),n=OPT.mix?Math.min(pool.length,rnd(2,3)):1;
 const kits=pick.slice(0,n).map(k=>[k,OPT.mix?rnd(1,Math.min(2,maxCount(k))):rnd(1,maxCount(k))]);
 const ty=Object.keys(TYPES)[rnd(0,2)];
 return {kits,type:ty,std:"apdcl",ts:Date.now()};
}
function keyRows(sc){
 const old=STD;STD="apdcl";const by={},out=[];
 try{sc.kits.forEach(([k,n])=>kitRows(k).forEach(r=>{if(!(r.q>0))return;const ex=by[r.id];
  if(ex){ex.q=+(ex.q+r.q*n).toFixed(3);ex.opt=ex.opt&&r.opt;if(r.why&&!ex.why)ex.why=r.why}
  else{by[r.id]={id:r.id,q:+(r.q*n).toFixed(3),opt:r.opt,why:r.why||""};out.push(by[r.id])}}))}finally{STD=old}
 return out;
}
function workName(sc){
 const parts=sc.kits.map(([k,n])=>`${n} ${/per route-km/.test(K[k].t)?"route-km of":n>1?"nos. of":"no. of"} ${K[k].t.replace(/, per route-km.*$/,"").replace(/^One /,"")}`);
 return "Providing and erecting "+parts.join("; ")+" under Samaguri ESD";
}

/* ---------- arithmetic ---------- */
const isJob=id=>C[id]&&C[id][4]==="job";
const rate=id=>C[id]&&C[id][3]!=null?C[id][3]:0;
function baseVal(code,v){return v[code]||0}
function abstract(rows,ab){
 const v={};v.A=0;v.E=0;rows.forEach(r=>{if(!r.id)return;const a=r2(rate(r.id)*(+r.q||0));if(isJob(r.id))v.E+=a;else v.A+=a});
 v.A=r2(v.A);v.E=r2(v.E);
 v.B=r2(baseVal(ab.bb,v)*(+ab.b||0)/100);v.C=r2(v.A+v.B);
 v.D=r2(baseVal(ab.db,v)*(+ab.d||0)/100);
 v.F=r2(baseVal(ab.fb,v)*(+ab.f||0)/100);
 v.G=r2(v.D*(+ab.g1||0)/100+v.E*(+ab.g2||0)/100);
 v.H=r2(v.C+v.D+v.E+v.F+v.G);v.J=r2(v.H*(+ab.j||0)/100);v.K=r2(v.H*(+ab.k||0)/100);
 v.L=r2(v.H+v.J+v.K);v.M=0;v.O=r2(v.L-v.M);v.P=Math.round(v.O);return v;
}
function answerAb(sc){const t=TYPES[sc.type];return {b:5,bb:"A",d:15,db:"C",f:t.f,fb:"C",g1:t.gd,g2:t.ge,j:9,k:9}}
function words(n){
 n=Math.round(n);if(n===0)return"Zero";
 const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],
 t=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
 const two=x=>x<20?a[x]:t[Math.floor(x/10)]+(x%10?" "+a[x%10]:""),three=x=>(x>=100?a[Math.floor(x/100)]+" Hundred"+(x%100?" ":""):"")+(x%100?two(x%100):"");
 const parts=[];const cr=Math.floor(n/1e7);n%=1e7;const lk=Math.floor(n/1e5);n%=1e5;const th=Math.floor(n/1e3);n%=1e3;
 if(cr)parts.push(words(cr)+" Crore");if(lk)parts.push(two(lk)+" Lakh");if(th)parts.push(two(th)+" Thousand");if(n)parts.push(three(n));return parts.join(" ");
}

/* ---------- SoR picker (stands in for typing the SoR no. and VLOOKUP) ---------- */
const LIST=Object.keys(C).filter(id=>C[id][1]).sort((x,y)=>{const a=parseFloat(C[x][0]),b=parseFloat(C[y][0]);
 if(isNaN(a)&&isNaN(b))return C[x][1].localeCompare(C[y][1]);if(isNaN(a))return 1;if(isNaN(b))return -1;return a-b});
let pickRow=-1;
function openPicker(i){pickRow=i;const m=q$("#xpick");m.hidden=false;const inp=q$("#xpq");inp.value="";renderPick("");setTimeout(()=>inp.focus(),50)}
function closePicker(){q$("#xpick").hidden=true;pickRow=-1}
function matches(s){s=s.trim().toLowerCase();if(!s)return LIST;
 if(/^\d+$/.test(s))return LIST.filter(id=>C[id][0].startsWith(s));
 const w=s.split(/\s+/);return LIST.filter(id=>{const h=(C[id][0]+" "+C[id][1]).toLowerCase();return w.every(x=>h.includes(x))})}
function renderPick(s){const m=matches(s),list=m.slice(0,80);
 q$("#xpl").innerHTML=list.length?list.map(id=>`<button type="button" data-id="${id}"><b>${esc(C[id][0])}</b><span>${esc(C[id][1])}</span><small>${esc(C[id][2])} · ${C[id][3]==null?"no rate":"₹"+fmt(C[id][3])}</small></button>`).join("")+(m.length>80?`<p class="hint">${m.length-80} more; keep typing to narrow.</p>`:"")
  :`<p class="hint">No SoR item matches “${esc(s)}”.</p>`;
}
function setItem(i,id){if(!S||i<0)return;S.rows[i].id=id;if(i===S.rows.length-1)S.rows.push({id:"",q:""});S.checked=null;save();closePicker();render();
 const el=root.querySelector(`input[data-q="${i}"]`);if(el)el.focus()}

/* ---------- render ---------- */
function start(){const sc=newScenario();if(!sc){root.innerHTML="";return}
 S={sc,rows:[{id:"",q:""}],ab:{b:"",bb:"",d:"",db:"",f:"",fb:"",g1:"",g2:"",j:"",k:""},checked:null};save();render()}
function baseSel(key){const v=S.ab[key]||"";return `<select class="xbase" data-ab="${key}" aria-label="base">`+["","A","C","D","E","H"].map(o=>`<option value="${o}" ${o===v?"selected":""}>${o?"of "+o:"of …"}</option>`).join("")+`</select>`}
function pct(key){return `<input class="xpct" data-ab="${key}" inputmode="decimal" value="${esc(S.ab[key])}" aria-label="percent">%`}
function render(){
 if(!S){start();return}
 const sc=S.sc,ty=TYPES[sc.type],chk=S.checked;
 let h=`<div class="xtask"><div><div class="eyebrow">Prepare the estimate</div><h2>${esc(workName(sc))}</h2>
  <p class="xmeta"><span>${esc(ty.t)}</span><span>APDCL SoR 2021-22 rates</span><span>Pass mark ${Math.round(OPT.pass*100)}%</span></p>
  <details class="xsc"><summary>What the work covers</summary><ul>${sc.kits.map(([k,n])=>`<li><b>${n} ×</b> ${esc(K[k].t)}<div class="why">${esc(K[k].scen||"")}</div></li>`).join("")}</ul></details></div>
  <div class="actions" style="margin-top:0"><button class="btn ghost" id="xnew2">Another work</button></div></div>`;
 /* the sheet */
 h+=`<div class="xl"><div class="xlscroll"><table class="sheet"><thead><tr class="cols"><th></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th><th>G</th><th></th></tr>
 <tr class="hdr"><th>1</th><th>Sl.</th><th>SoR Sl. No.</th><th>Item Description</th><th>Unit</th><th>Qty</th><th>Ex-work price ₹</th><th>Amount ₹</th><th></th></tr></thead><tbody>`;
 let sl=0;S.rows.forEach((r,i)=>{const c=r.id?C[r.id]:null;if(c)sl++;const m=chk&&chk.rows[i];
  const amt=c?r2(rate(r.id)*(+r.q||0)):null;
  h+=`<tr class="${m?"m-"+m.s:""}"><th>${i+2}</th><td class="c">${c?sl:""}</td>
  <td class="sorc"><button type="button" data-pick="${i}" class="${c?"":"empty"}">${c?esc(c[0]):"tap"}</button></td>
  <td class="desc">${c?esc(c[1])+(isJob(r.id)?' <span class="opt">E · civil</span>':""):""}${m&&m.msg?`<div class="xmsg">${esc(m.msg)}</div>`:""}</td>
  <td class="c">${c?esc(c[2]):""}</td>
  <td class="qcell">${c?`<input data-q="${i}" inputmode="decimal" value="${esc(r.q)}" aria-label="quantity">`:""}</td>
  <td class="n">${c?(c[3]==null?"—":fmt(c[3])):""}</td><td class="n" id="xa${i}">${c&&r.q!==""?fmt(amt):""}</td>
  <td>${c?`<button type="button" class="xdel" data-del="${i}" aria-label="Delete row">×</button>`:""}</td></tr>`});
 h+=`</tbody></table></div></div><p class="hint" style="margin-top:6px">Tap an SoR cell to bring the item in; a new row opens below each time. Rate and amount fill themselves, as VLOOKUP does in the office sheet.</p>`;
 /* the abstract */
 h+=`<div class="xl xab"><table class="sheet abs"><thead><tr class="hdr"><th></th><th>Abstract of cost</th><th>Amount ₹</th></tr></thead><tbody id="xabb"></tbody></table></div>
 <div class="actions"><button class="btn" id="xcheck">Check my estimate</button><button class="btn ghost" id="xreset">Clear sheet</button><span id="xsc" class="score"></span></div><div id="xres"></div>`;
 root.innerHTML=h;renderAb();if(chk)renderResult();
 q$("#xnew2").onclick=()=>{if(!S.checked&&S.rows.some(r=>r.id)&&!confirm("Start a new estimate? This sheet will be cleared."))return;start()};
 root.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>openPicker(+b.dataset.pick));
 root.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{S.rows.splice(+b.dataset.del,1);if(!S.rows.length||S.rows[S.rows.length-1].id)S.rows.push({id:"",q:""});S.checked=null;save();render()});
 root.querySelectorAll("[data-q]").forEach(inp=>inp.oninput=()=>{const i=+inp.dataset.q,r=S.rows[i];r.q=inp.value.replace(/[^\d.]/g,"");
  const a=q$("#xa"+i);if(a)a.textContent=r.q===""?"":fmt(r2(rate(r.id)*(+r.q||0)));save();updAb()});
 q$("#xcheck").onclick=check;
 q$("#xreset").onclick=()=>{if(!confirm("Clear every row and the abstract?"))return;S.rows=[{id:"",q:""}];Object.keys(S.ab).forEach(k=>S.ab[k]="");S.checked=null;save();render()};
}
function renderAb(){
 const mk=k=>{const c=S.checked&&S.checked.ab[k];return c==null?"":c?" ok":" bad"};
 const row=(l,lab,cls="")=>`<tr class="${cls}"><th>${l}</th><td>${lab}</td><td class="n" id="xv${l}"></td></tr>`;
 const bx=k=>`<span class="xin${mk(k)}">${pct(k)}</span>`,bs=k=>`<span class="xin${mk(k)}">${baseSel(k)}</span>`;
 let h=row("A","Cost of materials (excl. GST)<small>sum of the material rows</small>");
 h+=row("B",`Transportation &amp; storage @ ${bx("b")} ${bs("bb")}`);
 h+=row("C","Total (A + B)","sub");
 h+=row("D",`Erection / labour @ ${bx("d")} ${bs("db")}`);
 h+=row("E","Civil works (grouting, labour-included jobs)<small>sum of the E rows</small>");
 h+=row("F",`Contingency @ ${bx("f")} ${bs("fb")}`);
 h+=row("G",`Supervision @ ${bx("g1")} of D + ${bx("g2")} of E`);
 h+=row("H","Gross total (C + D + E + F + G)","sub");
 h+=row("J",`CGST @ ${bx("j")} of H`);h+=row("K",`SGST @ ${bx("k")} of H`);
 h+=row("L","Total (H + J + K)","sub");h+=row("M","Less party supply / O&amp;M stock");
 h+=row("O","Net amount (L − M)","sub");
 h+=`<tr class="sub fin"><th>P</th><td>Say, rounded<small id="xwords"></small></td><td class="n" id="xvP"></td></tr>`;
 const tb=q$("#xabb");if(!tb)return;tb.innerHTML=h;
 tb.querySelectorAll("input[data-ab]").forEach(inp=>inp.oninput=()=>{S.ab[inp.dataset.ab]=inp.value.replace(/[^\d.]/g,"");save();updAb()});
 tb.querySelectorAll("select[data-ab]").forEach(s=>s.onchange=()=>{S.ab[s.dataset.ab]=s.value;save();updAb()});
 updAb();
}
function updAb(){const v=abstract(S.rows,S.ab);"ABCDEFGHJKLMO".split("").forEach(l=>{const e=q$("#xv"+l);if(e)e.textContent=fmt(v[l])});
 const p=q$("#xvP");if(p)p.textContent=fmt(v.P);const w=q$("#xwords");if(w)w.textContent="Rupees "+words(v.P)+" only"}

/* ---------- checking ---------- */
function check(){
 const key=keyRows(S.sc),kb={};key.forEach(r=>kb[r.id]=r);
 const mine={};S.rows.forEach(r=>{if(r.id)mine[r.id]=(mine[r.id]||0)+(+r.q||0)});
 const rows=S.rows.map(r=>{if(!r.id)return null;const k=kb[r.id],have=mine[r.id];
  if(!k)return {s:"extra",msg:"Not part of this work."};
  const tol=tolOf(C[r.id][2]),ok=k.opt?true:Math.abs(have-k.q)<=Math.max(tol*k.q,1e-6);
  return ok?{s:"ok",msg:k.opt?"Optional here; fine either way.":""}:{s:"qty",msg:`Quantity should be ${fq(k.q)} ${C[r.id][2]}${tol?` (±${Math.round(tol*100)}% allowed)`:""}.`}});
 const need=key.filter(r=>!r.opt),missing=need.filter(r=>!(r.id in mine));
 const okItems=need.filter(r=>r.id in mine&&rows.some((x,i)=>x&&S.rows[i].id===r.id&&x.s==="ok")).length;
 const extra=Object.keys(mine).filter(id=>!kb[id]).length;
 const ans=answerAb(S.sc),ab={};
 [["b","bb"],["d","db"],["f","fb"]].forEach(([p,b])=>{ab[p]=Math.abs((+S.ab[p]||0)-ans[p])<1e-6&&(S.ab[p]!==""||ans[p]===0);ab[b]=ans[p]===0?true:S.ab[b]===ans[b]});
 ["g1","g2","j","k"].forEach(p=>ab[p]=(S.ab[p]!==""||ans[p]===0)&&Math.abs((+S.ab[p]||0)-ans[p])<1e-6);
 const abN=Object.keys(ab).length,abOk=Object.values(ab).filter(Boolean).length;
 const raw=(okItems+abOk-extra*0.5)/(need.length+abN),score=Math.max(0,Math.min(1,raw));
 S.checked={rows,ab,missing:missing.map(r=>r.id),okItems,need:need.length,extra,abOk,abN,score};save();
 const hst=hist();hst[String(Date.now())]={t:workName(S.sc),ty:S.sc.type,s:Math.round(score*100),k:OPT.key};
 if(score>=OPT.pass&&OPT.onPass)OPT.onPass(score);
 const ks=Object.keys(hst).sort();while(ks.length>30)delete hst[ks.shift()];lsSet(HIST,JSON.stringify(hst));
 render();const r=q$("#xres");if(r)r.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderResult(){
 const c=S.checked,key=keyRows(S.sc),kb={};key.forEach(r=>kb[r.id]=r);
 const sc=q$("#xsc");sc.textContent=`${Math.round(c.score*100)}%`;sc.className="score "+(c.score>=.9?"good":c.score>=.6?"mid":"bad");
 const ans=answerAb(S.sc),model=abstract(key.map(r=>({id:r.id,q:r.opt?0:r.q})),ans);
 let h=`<div class="kit xresult"><div class="xstats"><div><b>${c.okItems}/${c.need}</b><span>items right</span></div><div><b>${c.missing.length}</b><span>missing</span></div><div><b>${c.extra}</b><span>not needed</span></div><div><b>${c.abOk}/${c.abN}</b><span>abstract cells</span></div></div>`;
 if(c.missing.length)h+=`<h3>Missing from your sheet</h3><div class="tbl-wrap"><table><thead><tr><th>SoR</th><th>Item</th><th class="num">Qty</th></tr></thead><tbody>`+
  c.missing.map(id=>`<tr><td class="sor">${esc(C[id][0])}</td><td>${esc(C[id][1])}${kb[id].why?`<div class="why">${esc(kb[id].why)}</div>`:""}</td><td class="num">${fq(kb[id].q)} ${esc(C[id][2])}</td></tr>`).join("")+`</tbody></table></div>`;
 const wrongAb=Object.entries(c.ab).filter(([,v])=>!v).map(([k])=>k);
 if(wrongAb.length){const lab={b:"B transport %",bb:"B base",d:"D labour %",db:"D base",f:"F contingency %",fb:"F base",g1:"G supervision on D",g2:"G supervision on E",j:"CGST",k:"SGST"};
  h+=`<h3>Abstract corrections</h3><ul class="xfix">`+wrongAb.map(k=>`<li><b>${lab[k]}</b>: ${/b$/.test(k)&&k.length===2?"of "+ans[k]:ans[k]+"%"}</li>`).join("")+`</ul>`}
 h+=`<div class="note"><b>Rule</b>${esc(TYPES[S.sc.type].note)} Transport 5% of A, labour 15% of C, CGST and SGST 9% each on H.</div>`;
 h+=`<p class="hint">Model answer: A ₹${fmt(model.A)}${model.E?`, E ₹${fmt(model.E)}`:""}, net payable ₹${fmt(model.P)}. Optional items are left out of the model.</p>`;
 const pass=c.score>=OPT.pass;
 h+=pass?`<div class="note xpass"><b>Passed</b>${esc(OPT.passMsg||"Step complete.")}</div>`:`<div class="note trap"><b>Not yet</b>You need ${Math.round(OPT.pass*100)}% to complete this step. Fix the sheet and check again, or try another work.</div>`;
 h+=`<div class="actions">${pass&&OPT.next?`<button class="btn" id="xnext">${esc(OPT.next.label)}</button>`:""}<button class="btn ${pass&&OPT.next?"ghost":""}" id="xredo">Fix and check again</button><button class="btn ghost" id="xagain">Another work</button></div></div>`;
 q$("#xres").innerHTML=h;
 const nx=q$("#xnext");if(nx)nx.onclick=OPT.next.go;
 q$("#xagain").onclick=()=>start();
 q$("#xredo").onclick=()=>{S.checked=null;save();render()};
}
function hist(){try{return JSON.parse(lsGet(HIST,"{}"))||{}}catch(e){return {}}}
function histHtml(){const h=hist(),ks=Object.keys(h).sort().reverse().slice(0,5);if(!ks.length)return"";
 return `<div class="xhist"><h3>Recent estimates</h3><ul>`+ks.map(k=>{const x=h[k],d=new Date(+k);
  return `<li><span class="score ${x.s>=90?"good":x.s>=60?"mid":"bad"}">${x.s}%</span><span>${esc(x.t)}</span><small>${d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small></li>`}).join("")+`</ul></div>`}

/* picker wiring */
q$("#xpq").oninput=e=>renderPick(e.target.value);
q$("#xpq").onkeydown=e=>{if(e.key==="Enter"){const m=matches(e.target.value);if(m.length)setItem(pickRow,m[0])}else if(e.key==="Escape")closePicker()};
q$("#xpl").onclick=e=>{const b=e.target.closest("button[data-id]");if(b)setItem(pickRow,b.dataset.id)};
q$("#xpclose").onclick=closePicker;q$("#xpick").addEventListener("click",e=>{if(e.target.id==="xpick")closePicker()});

window.Drill={mount(el,opt){root=el;OPT=Object.assign({pass:.8},opt);load();render()},history:hist};
})();
