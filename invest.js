/* Investments (ETF Shop, JuniorBees PKP): shared engine for the standalone pages.
   - Data lives on the phone (localStorage) and is shared between phones through the app's encrypted sync
     (slots "#inv-etf" and "#inv-pkp"). Nothing personal is in this public repo; existing records come in once
     through "Import" (a JSON file made from the old Google Sheets).
   - Every record has an id and an edit time "t"; phones merge record by record, newest edit wins, deletions win
     over older edits.
   - Live NSE prices come from the Pranju OS worker (?mode=quotes), which reads Yahoo Finance's NSE feed. */
(function(){
"use strict";
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
const SK={etf:"inv-etf-v1",pkp:"inv-pkp-v1"},COLL={etf:["lots","cap"],pkp:["tx"]},QK="inv-quotes-v1";
const workerBase=()=>{let u=null;try{u=localStorage.getItem("totalRecallTickTickUrl");}catch(e){}return (u||"https://total-recall-ticktick.pranjuchakrapani90.workers.dev").replace(/[?#].*$/,"").replace(/\/$/,"");};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------- store ---------- */
function blank(key){const o={v:1,del:{},settings:null};COLL[key].forEach(c=>o[c]={});return o;}
function load(key){const s=get(SK[key])||blank(key);COLL[key].forEach(c=>s[c]=s[c]||{});s.del=s.del||{};return s;}
let pushTimer={};
function save(key,s){put(SK[key],s);clearTimeout(pushTimer[key]);pushTimer[key]=setTimeout(()=>push(key).catch(()=>{}),1500);}
function merge(key,a,b){
  const o=blank(key);o.del={...(a.del||{})};Object.entries(b.del||{}).forEach(([id,t])=>{if(!(o.del[id]>=t))o.del[id]=t;});
  COLL[key].forEach(c=>{[a[c]||{},b[c]||{}].forEach(src=>Object.entries(src).forEach(([id,r])=>{
    if(!r||(o.del[id]||0)>=(r.t||0))return;if(!o[c][id]||(r.t||0)>(o[c][id].t||0))o[c][id]=r;}));});
  const sa=a.settings,sb=b.settings;o.settings=!sa?sb||null:!sb?sa:((sb.t||0)>(sa.t||0)?sb:sa);
  return o;}
function upsert(key,coll,id,rec){const s=load(key);id=id||uid();s[coll][id]={...rec,t:Date.now()};save(key,s);return id;}
function remove(key,coll,id){const s=load(key);delete s[coll][id];s.del[id]=Date.now();save(key,s);}
function setSettings(key,patch){const s=load(key);s.settings={...(s.settings||{}),...patch,t:Date.now()};save(key,s);}

/* ---------- sync (encrypted, reuses the app's sync code) ---------- */
const hasSync=()=>!!(window.GSync&&GSync.code&&GSync.code());
const canon=x=>window.GSync&&GSync.canon?GSync.canon(x):JSON.stringify(x);
async function push(key){if(!hasSync())return;await GSync.putSlot(GSync.code(),"#inv-"+key,load(key));}
/* pull the other phones' copy, merge, upload if this phone had something the cloud lacked; true if this phone changed */
async function sync(key){
  if(!hasSync())return {ok:false,msg:"Sync is off on this phone. Turn it on from the home screen to share records between phones."};
  const local=load(key);let remote=null;
  remote=await GSync.fetchSlot(GSync.code(),"#inv-"+key);
  const m=remote?merge(key,local,remote):local,changed=canon(m)!==canon(local);
  if(changed)put(SK[key],m);
  if(!remote||canon(m)!==canon(remote))await GSync.putSlot(GSync.code(),"#inv-"+key,m);
  return {ok:true,changed};}

/* ---------- import / export ---------- */
function importData(obj){
  if(!obj||obj.kind!=="total-recall-investments")throw new Error("This isn't a Pranju OS investments file.");
  const done=[];["etf","pkp"].forEach(k=>{if(obj[k]){const m=merge(k,load(k),obj[k]);put(SK[k],m);push(k).catch(()=>{});done.push(k);}});
  return done;}
function exportData(){const o={kind:"total-recall-investments",exported:new Date().toISOString().slice(0,10),etf:load("etf"),pkp:load("pkp")};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:"application/json"}));
  a.download="investments-backup-"+o.exported+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function pickImport(onDone){const i=document.createElement("input");i.type="file";i.accept="application/json,.json";
  i.onchange=async()=>{const f=i.files&&i.files[0];if(!f)return;try{const done=importData(JSON.parse(await f.text()));onDone(null,done);}catch(e){onDone(e);}};i.click();}

/* ---------- live prices ---------- */
function quotesCache(){return get(QK)||{};}
async function quotes(symbols){
  const want=[...new Set(symbols.map(s=>String(s).toUpperCase()))],out=quotesCache(),errs=[];
  for(let i=0;i<want.length;i+=25){const part=want.slice(i,i+25);
    const r=await fetch(workerBase()+"/?mode=quotes&s="+encodeURIComponent(part.join(",")),{cache:"no-store"});
    if(!r.ok)throw new Error(r.status===404||r.status===405||r.status===500?"The price service isn't set up on the worker yet (redeploy ticktick-worker.js).":"Price service answered HTTP "+r.status);
    const j=await r.json();if(j.error)throw new Error(j.error);
    Object.entries(j.quotes||{}).forEach(([s,q])=>{if(q&&!q.error&&q.price!=null){q.at=j.at;q.closes=(q.closes||[]).slice(-420);out[s]=q;}else errs.push(s);});}
  if(!put(QK,out)){const slim={};Object.entries(out).forEach(([s,q])=>slim[s]={...q,closes:(q.closes||[]).slice(-260)});put(QK,slim);}
  return {quotes:out,missing:errs};}
function highSince(q,fromIso){let h=-Infinity;(q&&q.closes||[]).forEach(([d,c])=>{if(d>=fromIso&&c>h)h=c;});return h;}
function high52(q){const d=new Date(Date.now()-365*864e5).toISOString().slice(0,10);return highSince(q,d);}

/* ---------- market clock (IST) ---------- */
function ist(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false,day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(new Date()),g=t=>(p.find(x=>x.type===t)||{}).value;
  const wd=g("weekday"),mins=(+g("hour"))*60+(+g("minute")),weekend=wd==="Sat"||wd==="Sun";
  return {wd,weekend,mins,open:!weekend&&mins>=555&&mins<930,afterClose:!weekend&&mins>=930,iso:`${g("year")}-${g("month")}-${g("day")}`};}

/* ---------- formatting ---------- */
const ok=v=>typeof v==="number"&&isFinite(v);
const r2=v=>Math.round(v*100)/100;
function inr(v,d){if(!ok(v))return "—";return (v<0?"−":"")+"₹"+Math.abs(v).toLocaleString("en-IN",{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function price(v){return ok(v)?v.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";}
function pct(v,sign){if(!ok(v))return "—";return (v>0&&sign?"+":v<0?"−":"")+Math.abs(v).toFixed(2)+"%";}
function signInr(v){return ok(v)?(v>0?"+":"")+inr(v):"—";}
const tone=v=>!ok(v)||Math.abs(v)<1e-9?"":(v>0?"up":"dn");
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dshort=iso=>{if(!iso)return "";const d=new Date(iso+"T00:00:00");return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:d.getFullYear()!==new Date().getFullYear()?"2-digit":undefined});};
const days=(a,b)=>Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/864e5);
function ago(t){if(!t)return "";const m=Math.round((Date.now()-t)/6e4);if(m<1)return "just now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+" h ago";return new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short"});}
/* XIRR on dated cash flows [[iso, amount]] (negative = money in) */
function xirr(flows){if(flows.length<2)return NaN;const t0=new Date(flows[0][0]+"T00:00:00");
  const f=r=>flows.reduce((a,[d,v])=>a+v/Math.pow(1+r,(new Date(d+"T00:00:00")-t0)/31536e6),0);
  let lo=-0.99,hi=10;if(f(lo)*f(hi)>0)return NaN;for(let i=0;i<200;i++){const m=(lo+hi)/2;if(f(lo)*f(m)<=0)hi=m;else lo=m;}return (lo+hi)/2*100;}

/* ---------- entry form (one sheet for every add / edit) ---------- */
function form(o){
  let d=document.getElementById("invForm");if(d)d.remove();
  d=document.createElement("dialog");d.id="invForm";d.className="sheet";
  d.innerHTML=`<form method="dialog"><h3>${esc(o.title)}</h3>${o.note?`<p class="small muted">${esc(o.note)}</p>`:""}
    ${o.fields.map(f=>`<label class="fld"><span>${esc(f.label)}</span>${f.type==="select"
      ?`<select name="${f.k}">${f.options.map(x=>`<option value="${esc(x[0])}"${String(x[0])===String(f.value)?" selected":""}>${esc(x[1])}</option>`).join("")}</select>`
      :`<input name="${f.k}" type="${f.type||"text"}"${f.type==="number"?` inputmode="decimal" step="${f.step||"any"}"`:""}${f.list?` list="${f.k}L"`:""} value="${esc(f.value==null?"":f.value)}"${f.req===false?"":" required"}>${f.list?`<datalist id="${f.k}L">${f.list.map(x=>`<option value="${esc(x)}">`).join("")}</datalist>`:""}`}
      ${f.hint?`<small class="muted">${esc(f.hint)}</small>`:""}</label>`).join("")}
    <p class="ferr" hidden></p>
    <div class="fbtns">${o.onDelete?`<button type="button" class="danger" data-a="del">${esc(o.delLabel||"Delete")}</button>`:""}${(o.extra||[]).map((x,i)=>`<button type="button" class="ghost" data-x="${i}">${esc(x.label)}</button>`).join("")}<span></span><button type="button" class="ghost" data-a="cancel">Cancel</button><button type="submit">${esc(o.ok||"Save")}</button></div></form>`;
  document.body.appendChild(d);
  const fm=d.querySelector("form"),err=d.querySelector(".ferr"),close=()=>{d.close();d.remove();};
  const vals=()=>{const v={};o.fields.forEach(f=>{const x=fm.elements[f.k].value.trim();v[f.k]=f.type==="number"?(x===""?NaN:parseFloat(x)):x;});return v;};
  fm.onsubmit=e=>{e.preventDefault();try{const m=o.onSubmit(vals());if(m){err.hidden=false;err.textContent=m;return;}close();}catch(ex){err.hidden=false;err.textContent=ex.message;}};
  d.querySelector('[data-a="cancel"]').onclick=close;
  const del=d.querySelector('[data-a="del"]');if(del)del.onclick=()=>{if(confirm(o.delConfirm||"Delete this record?")){o.onDelete();close();}};
  d.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{const x=o.extra[+b.dataset.x];if(x.run(vals())!==false)close();});
  d.addEventListener("cancel",()=>d.remove());
  d.showModal();}

/* ---------- minimal building blocks shared by both pages ---------- */
/* one action row: kind colours the label; btn is [text, attrs] or null */
function todo(kind,label,what,q,sub,amt,btn){return `<div class="todo ${kind}"><span class="tl"><em>${label}</em> <b>${what}</b></span><span class="tq">${q||""}</span>${btn?`<button type="button" class="tick" ${btn[1]}>${btn[0]}</button>`:`<span class="tick none"></span>`}<span class="ts">${sub||""}</span><span class="ta">${amt||""}</span></div>`;}
function tabs(list,cur){return `<nav class="tabs" role="tablist">${list.map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" class="${k===cur?"on":""}" aria-selected="${k===cur}">${l}</button>`).join("")}</nav>`;}
function sum(items){return `<section class="sum">${items.map(([l,v,cls,sub])=>`<div><span>${l}</span><b class="${cls||""}">${v}</b>${sub?`<small>${sub}</small>`:""}</div>`).join("")}</section>`;}
function rememberTab(key,def){let t=def;try{t=sessionStorage.getItem("inv-tab-"+key)||def;}catch(e){}return t;}
function saveTab(key,t){try{sessionStorage.setItem("inv-tab-"+key,t);}catch(e){}}
window.Invest={todo,tabs,sum,rememberTab,saveTab,load,save,merge,upsert,remove,setSettings,uid,sync,push,hasSync,importData,exportData,pickImport,quotes,quotesCache,highSince,high52,ist,ok,r2,inr,price,pct,signInr,tone,esc,dshort,days,ago,xirr,form};
})();
