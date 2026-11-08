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
const SK={etf:"inv-etf-v1",pkp:"inv-pkp-v1",pf:"inv-pf-v1",cash:"inv-cash-v1"},COLL={etf:["lots","cap","amo"],pkp:["tx","liq"],pf:["assets"],cash:["tx","pend","bal","learn","arch","skip"]},QK="inv-quotes-v1";
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
  const done=[];["etf","pkp","pf","cash"].forEach(k=>{if(obj[k]){const m=merge(k,load(k),obj[k]);put(SK[k],m);push(k).catch(()=>{});done.push(k);}});
  return done;}
function exportData(){const o={kind:"total-recall-investments",exported:new Date().toISOString().slice(0,10),etf:load("etf"),pkp:load("pkp"),pf:load("pf"),cash:load("cash")};
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
/* lowest (side "low") or highest (side "high") traded price since a date: intraday low/high when the feed has them,
   else the close; includes the live price. Used to tell whether a GTT trigger was touched. */
function touched(q,fromIso,side){if(!q)return NaN;const lo=side==="low";let v=lo?Infinity:-Infinity;
  const take=x=>{if(ok(x))v=lo?Math.min(v,x):Math.max(v,x);};
  (q.closes||[]).forEach(r=>{if(r[0]>=fromIso)take(ok(lo?r[2]:r[3])?(lo?r[2]:r[3]):r[1]);});
  if(q.day&&q.day>=fromIso)take(lo?q.dayLow:q.dayHigh);take(q.price);return ok(v)?v:NaN;}
function high52(q){const d=new Date(Date.now()-365*864e5).toISOString().slice(0,10);return highSince(q,d);}

/* ---------- mutual fund NAVs (AMFI, through mfapi.in) ----------
   Tries mfapi.in straight from the phone; if that's blocked, goes through the Pranju OS worker (?mode=nav). */
const NK="inv-nav-v1";
function navCache(){return get(NK)||{};}
async function mfJson(path){
  try{const r=await fetch("https://api.mfapi.in"+path,{cache:"no-store"});if(r.ok)return await r.json();}catch(e){}
  const r=await fetch(workerBase()+"/?mode=nav&p="+encodeURIComponent(path),{cache:"no-store"});if(!r.ok)throw new Error("NAV service HTTP "+r.status);return r.json();}
async function navs(codes){const out=navCache();
  await Promise.all([...new Set(codes.map(String))].map(async c=>{try{const j=await mfJson("/mf/"+encodeURIComponent(c)+"/latest");
    const d=j&&j.data&&j.data[0];if(d&&d.nav)out[c]={nav:parseFloat(d.nav),date:d.date,name:j.meta&&j.meta.scheme_name,at:Date.now()};}catch(e){}}));
  put(NK,out);return out;}
async function mfSearch(q){const j=await mfJson("/mf/search?q="+encodeURIComponent(q));return (Array.isArray(j)?j:[]).slice(0,25);}

/* ---------- market clock (IST) ---------- */
function ist(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false,day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(new Date()),g=t=>(p.find(x=>x.type===t)||{}).value;
  const wd=g("weekday"),mins=(+g("hour"))*60+(+g("minute")),iso=`${g("year")}-${g("month")}-${g("day")}`,sp=NSE_SPECIAL[iso]||null;
  /* a special session (Muhurat trading) opens the market on a weekend/holiday for its own short window */
  const weekend=!sp&&(wd==="Sat"||wd==="Sun"),from=sp?sp.from:555,to=sp?sp.to:930;
  return {wd,weekend,mins,special:sp?sp.name:"",from,to,open:!weekend&&mins>=from&&mins<to,afterClose:!weekend&&mins>=to,iso};}

/* ---------- NSE trading days ---------- */
/* NSE equity trading holidays (weekdays). Add each new year's list when NSE publishes it. */
const NSE_HOLIDAYS=new Set(["2026-01-15","2026-01-26","2026-03-03","2026-03-26","2026-03-31","2026-04-03","2026-04-14","2026-05-01","2026-05-28","2026-06-26","2026-09-14","2026-10-02","2026-10-20","2026-11-10","2026-11-24","2026-12-25"]);
/* special live sessions on days NSE is otherwise shut (minutes after midnight IST). Add Muhurat trading
   each year once NSE's circular gives the time. */
const NSE_SPECIAL={"2026-11-08":{name:"Muhurat trading",from:860,to:930}};/* Sun 8 Nov 2026, 2:20–3:30 PM */
const isoOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const nseClosed=iso=>{if(NSE_SPECIAL[iso])return false;const d=new Date(iso+"T00:00:00");return d.getDay()===0||d.getDay()===6||NSE_HOLIDAYS.has(iso);};
function nextTrading(iso){const d=new Date(iso+"T00:00:00");do d.setDate(d.getDate()+1);while(nseClosed(isoOf(d)));return isoOf(d);}
/* the session an order placed now goes into: today if the market is open or not yet open, else the next trading day */
function orderSession(){const t=ist();return !nseClosed(t.iso)&&t.mins<t.to?t.iso:nextTrading(t.iso);}
/* true once that session has opened (9:15 IST) */
function sessionStarted(iso){const t=ist();return t.iso>iso||(t.iso===iso&&t.mins>=t.from);}

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

/* ---------- Kite fund: one pool shared by ETF Shop and PKP ----------
   Cash in Kite + LiquidBees (the reserve sold when cash falls short of a BID or a new ETF buy).
   Cash moves with the records:
     in  — every ETF sale (proceeds after charges; tax isn't taken from Kite), every PKP sale (whole proceeds),
           ETF "money in"
     out — every ETF buy, every PKP buy (SIP and BID alike: the SIP is bought with Kite cash too), ETF "money out"
     Money sent to Zerodha from the Money Book comes in as ETF "money in".
   "Update balance" records the real Kite cash and LiquidBees units on a date; after that only newer records move it.
   Balances are kept in the encrypted PKP record set on the phones, never in this repo. */
const LIQ="LIQUIDBEES";
/* Zerodha delivery charges, so the fund matches Kite to the paisa (zerodha.com/charges, support article on Liquid BeES):
   both sides  NSE transaction 0.00307% + SEBI ₹10/crore, GST 18% on those two; brokerage ₹0
   buy         stamp duty 0.015%
   sell        STT 0.001% on equity ETFs (none on LiquidBees); DP charge once per ETF per day sold:
               ₹15.34 (₹13 + GST) for equity ETFs, ₹11.21 (₹9.50 + GST) for LiquidBees
   The rates sit here in one place: change them if Zerodha changes its charges. */
const CHG={txn:0.0000307,sebi:0.0000001,gst:0.18,stamp:0.00015,stt:0.00001,dp:15.34,dpLiq:11.21};
const r2c=v=>Math.round(v*100)/100;
function charges(side,value,liquid){const txn=r2c(value*CHG.txn),sebi=r2c(value*CHG.sebi),gst=r2c((txn+sebi)*CHG.gst);
  return txn+sebi+gst+(side==="buy"?r2c(value*CHG.stamp):liquid?0:r2c(value*CHG.stt));}
function kiteFund(){
  const e=load("etf"),k=load("pkp"),S=k.settings||{},fl=[],dpDays={};
  const add=(date,t,amt,kind,chg,what)=>{if(date&&ok(amt))fl.push({date,t:t||0,amt:amt-(chg||0),chg:chg||0,kind,what:what||kind});};
  /* a sale: proceeds less charges, plus the DP charge the first time that ETF is sold that day */
  const sell=(date,t,code,value,kind)=>{const liquid=code===LIQ,key=date+"|"+code,dp=dpDays[key]?0:(liquid?CHG.dpLiq:CHG.dp);dpDays[key]=1;
    add(date,t,value,kind,charges("sell",value,liquid)+dp,"sold "+code);};
  Object.values(e.cap).forEach(c=>{if(c)add(c.date,c.t,c.amount,"money",0,c.amount<0?"money out":"money in");});
  Object.values(e.lots).forEach(l=>{if(!l||!ok(l.price)||!ok(l.qty))return;const v=l.price*l.qty;add(l.date,l.t,-v,"etf",charges("buy",v),"bought "+l.code);
    if(ok(l.sellPrice))sell(l.sellDate,l.t,l.code,l.sellPrice*l.qty,"etf");});
  const sym=(S.symbol||"JUNIORBEES").toUpperCase(),T=Object.values(k.tx).filter(Boolean).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.seq||0)-(b.seq||0));let level=0;
  /* when a PKP trade was first recorded (seq), so editing an old SIP later doesn't pull it past the balance date */
  const when=x=>x.seq>1e12?x.seq:(x.t||0);
  T.forEach(x=>{if(x.type==="buy"){const v=x.amount||x.price*x.units,bid=ok(x.bid)&&x.bid>level;
      add(x.date,when(x),-v,bid?"bid":"sip",charges("buy",v),(bid?"BID "+x.bid:"SIP")+" "+sym);if(ok(x.bid))level=x.bid;}
    else{sell(x.date,when(x),sym,x.units*x.price,"sale");level=0;}});
  /* LiquidBees sales are kept as records: units out of LiquidBees, proceeds into cash */
  const sales=Object.entries(k.liq).filter(([,x])=>x&&ok(x.units)&&ok(x.price)).map(([id,x])=>({id,...x})).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.t||0)-(b.t||0));
  sales.forEach(x=>sell(x.date,x.t,LIQ,x.units*x.price,"liq"));
  const A=ok(S.kiteBal)?{bal:S.kiteBal,date:S.kiteOn,t:S.kiteT||0}:null,isAfter=f=>!A||f.date>A.date||(f.date===A.date&&(f.t||0)>A.t);
  const after=fl.filter(isAfter).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.t-b.t),liqAfter=sales.filter(isAfter);
  const moved=after.reduce((a,f)=>a+f.amt,0),chg=after.reduce((a,f)=>a+f.chg,0),cash=(A?A.bal:0)+moved;
  const qc=quotesCache()[LIQ],lp=qc&&ok(qc.price)?qc.price:NaN,lu=Math.max(0,(ok(S.liqUnits)?S.liqUnits:0)-liqAfter.reduce((a,x)=>a+x.units,0)),liq=lu*lp;
  return {cash,moved,chg,A,flows:after,sales,liqUnits:lu,liqPrice:lp,liq,liqOn:S.liqOn,total:cash+(ok(liq)?liq:0)};}
function fundForm(after){const F=kiteFund();
  const lines=F.flows.slice(-8).map(f=>`${dshort(f.date)} ${f.what} ${f.amt>0?"+":"−"}${Math.abs(f.amt).toFixed(2)}${f.chg?` (charges ${f.chg.toFixed(2)})`:""}`);
  form({title:"Kite fund",note:F.A?`Kite cash ${F.A.bal.toFixed(2)} on ${dshort(F.A.date)}, then: ${lines.join(" · ")||"no records"}. Now ${F.cash.toFixed(2)} (charges included: ${F.chg.toFixed(2)}). If Kite still differs, enter its figures below.`
      :"Enter the cash Kite shows now and your LiquidBees units. From then on, sales and money sent to Zerodha add to the cash; ETF buys and every JuniorBees buy (SIP and BID) take from it.",
    fields:[{k:"bal",label:"Cash in Kite (₹)",type:"number",value:F.A?r2(F.cash):""},{k:"liq",label:"LiquidBees units",type:"number",step:"1",value:F.liqUnits||"",hint:"The units grow a little each day from the daily dividend."},
      {k:"date",label:"As on",type:"date",value:ist().iso}],ok:"Save",
    onSubmit:v=>{if(!ok(v.bal))return "Enter the cash balance.";if(!(v.liq>=0))return "Enter the LiquidBees units (0 if none).";
      setSettings("pkp",{kiteBal:v.bal,kiteOn:v.date,kiteT:Date.now(),liqUnits:Math.round(v.liq),liqOn:v.date});if(after)after();},
    extra:F.A?[{label:"Sold LiquidBees",run:()=>{setTimeout(()=>liqForm(after),0);}},...(F.sales.length?[{label:"LiquidBees sales",run:()=>{setTimeout(()=>liqList(after),0);}}]:[])]:null});}
/* the LiquidBees sale records: tap one to correct or delete it */
function liqList(after){const F=kiteFund(),L=F.sales.slice().reverse();
  form({title:"LiquidBees sales",note:"Pick a sale to correct or delete it.",fields:[{k:"id",label:"Sale",type:"select",value:L[0]&&L[0].id,
      options:L.map(x=>[x.id,`${dshort(x.date)} · ${x.units} × ${price(x.price)} = ${inr(x.units*x.price)}`])}],ok:"Open",
    onSubmit:v=>{const x=L.find(y=>y.id===v.id);if(x)setTimeout(()=>liqForm(after,x),0);}});}
/* a LiquidBees sale: units down, cash up by the proceeds; kept as a record (synced) */
function liqForm(after,pre){pre=pre||{};const F=kiteFund(),held=F.liqUnits+(pre.id?pre.units:0);
  form({title:pre.id?"Edit LiquidBees sale":"Sold LiquidBees",note:pre.id?"":`You hold ${F.liqUnits} units. The proceeds are added to your Kite cash.`,
    fields:[{k:"date",label:"Date",type:"date",value:pre.date||ist().iso},{k:"units",label:"Units sold",type:"number",step:"1",value:pre.units||""},
      {k:"price",label:"Price",type:"number",value:pre.price||(ok(F.liqPrice)?r2(F.liqPrice):"")}],
    onSubmit:v=>{const n=Math.round(v.units);if(!(n>0)||!(v.price>0))return "Enter units and price.";if(n>held)return `You hold ${held} units.`;
      upsert("pkp","liq",pre.id,{date:v.date,units:n,price:v.price});if(after)after();},
    onDelete:pre.id?()=>{remove("pkp","liq",pre.id);if(after)after();}:null});}
/* LiquidBees units to sell to raise `gap` rupees of cash. Zerodha makes 100% of a sale from holdings usable the
   same day (since Oct 2024); one rupee per ₹1,000 plus the DP charge covers price moves and charges. */
const LIQ_SAME_DAY=1;
function liqToSell(gap){const F=kiteFund();if(!(gap>0)||!ok(F.liqPrice))return 0;return Math.min(F.liqUnits,Math.ceil((gap*1.001+CHG.dpLiq+1)/(F.liqPrice*LIQ_SAME_DAY)));}
/* need = money the next SIP, BID or ETF buy takes */
function fundBar(need){const F=kiteFund();let note="";
  if(ok(need)&&need>F.cash){const gap=need-F.cash;
    note=ok(F.liqPrice)&&F.liqUnits*F.liqPrice>=gap?`<small class="warn">Cash short ${inr(gap)} for the next buy · sell ${liqToSell(gap)} LiquidBees in market hours</small>`
      :`<small class="dn">Short ${inr(need-F.total)} for the next buy, even with LiquidBees</small>`;}
  if(!F.A)return `<button type="button" class="fund" id="kFund"><span>Kite fund <small>tap to enter your cash and LiquidBees</small></span><b>—</b></button>`;
  return `<button type="button" class="fund${note?" short":""}" id="kFund"><span>Kite fund <small>cash ${inr(F.cash,2)} · LiquidBees ${F.liqUnits}</small></span><b>${inr(F.total)}</b>${note}</button>`;}


/* ---------- Zerodha Kite (read-only, Kite Connect Personal through the worker) ----------
   The worker holds the Kite login (it ends at 6 AM IST daily); phones only get the figures. Nothing is ever
   placed in Kite from here. The last figures are kept on this phone so the card still shows them after the
   day's login has expired. */
const KK="inv-kite-v1";
function kiteCache(){return get(KK)||null;}
async function kiteCall(op,post){
  const back=op==="start"?"&back="+encodeURIComponent(location.href.replace(/([?&])kite=[^&]*&?/,"$1").replace(/[?&]$/,"")):"";
  let r;try{r=await fetch(workerBase()+"/?mode=kite&op="+op+back,{method:post?"POST":"GET",cache:"no-store"});}catch(e){throw new Error("Can't reach the worker: "+e.message);}
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error){const e=new Error(j.error||("Kite HTTP "+r.status));e.code=j.code||(j.error==="Unknown Drive operation"||r.status===404?"old_worker":"");throw e;}
  return j;}
async function kiteLogin(){const j=await kiteCall("start");location.href=j.url;}
async function kiteLogout(){await kiteCall("logout",true);}
/* {d} fresh figures, or {err} (err.code "login" = log in again, "not_configured" = secrets missing) */
async function kiteData(){try{const d=await kiteCall("data");put(KK,d);return {d};}catch(e){return {err:e};}}
const istIso=ms=>new Date(ms+19800000).toISOString().slice(0,10);
/* units the app thinks you hold: open ETF Shop lots + JuniorBees PKP + LiquidBees */
function appUnits(){const u={},add=(c,n)=>{if(n)u[c]=(u[c]||0)+n;};
  Object.values(load("etf").lots).forEach(l=>{if(l&&!ok(l.sellPrice)&&ok(l.qty))add(String(l.code).toUpperCase(),l.qty);});
  const k=load("pkp"),sym=((k.settings||{}).symbol||"JUNIORBEES").toUpperCase();let n=0;
  Object.values(k.tx).filter(Boolean).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.seq||0)-(b.seq||0)).forEach(x=>{if(x.type==="buy")n+=x.units||0;else{n-=x.units||0;if(n<0)n=0;}});
  add(sym,n);add(LIQ,kiteFund().liqUnits);return u;}
/* Kite's answer for a pending AMO/order record {code,kind,qty,session}: only from figures fetched on its session day */
function kiteMatch(a,d){d=d||kiteCache();if(!d||!d.orders||istIso(d.at)!==a.session)return null;
  const side=a.kind==="sell"?"SELL":"BUY",L=d.orders.filter(o=>o.sym===String(a.code).toUpperCase()&&o.side===side);if(!L.length)return null;
  const rank=o=>o.status==="COMPLETE"?0:/OPEN|TRIGGER|AMO|PENDING|VALIDATION|PUT ORDER/.test(o.status)?1:2;
  const o=L.slice().sort((x,y)=>rank(x)-rank(y)||Math.abs(x.qty-a.qty)-Math.abs(y.qty-a.qty))[0];
  return {...o,done:o.status==="COMPLETE"||o.filled>0,dead:rank(o)===2&&!(o.filled>0),open:rank(o)===1};}
/* the Kite card: figures, holdings check, and a one-tap "use Kite's cash" for the Kite fund */
function kiteCard(st){st=st||{};const d=kiteCache(),e=st.err,F=kiteFund();
  if(e&&e.code==="not_configured")return `<section class="card kite"><div class="kh"><b>Kite</b><span class="muted small">not set up yet</span></div><p class="small muted">Add the Kite secrets on the worker (KITE_SETUP.md), then log in here once a day.</p></section>`;
  if(e&&e.code==="old_worker")return `<section class="card kite"><div class="kh"><b>Kite</b><span class="muted small">worker needs the new code</span></div><p class="small muted">Paste the latest ticktick-worker.js into Cloudflare and deploy (KITE_SETUP.md).</p></section>`;
  const today=ist().iso,fresh=d&&istIso(d.at)===today&&!(e&&e.code==="login");
  const head=`<div class="kh"><b>Kite</b><span class="muted small">${d?esc((d.user?d.user+" · ":"")+(fresh?"updated "+ago(d.at):"last seen "+ago(d.at))):"not connected"}</span></div>`;
  const login=!fresh&&(!e||e.code==="login")?`<button type="button" id="kLogin">Log in to Kite for today</button>`:"";
  if(!d)return `<section class="card kite">${head}${e&&e.code!=="login"?`<p class="small dn">${esc(e.message)}</p>`:`<p class="small muted">Read-only: your cash, holdings, today's orders and GTTs. Kite asks you to log in once a day.</p>`}<div class="acts">${login}</div></section>`;
  const f=d.funds||{},kc=f.live,A=appUnits(),K={};if(F.A&&!(LIQ in A))A[LIQ]=0;(d.holdings||[]).forEach(h=>K[h.sym]=h.qty);
  const diff=Object.keys(A).filter(c=>(A[c]||0)!==(K[c]||0)).map(c=>`${esc(c)} app ${A[c]||0} · Kite ${K[c]||0}`);
  const other=Object.keys(K).filter(c=>!(c in A)&&K[c]>0).length,lq=K[LIQ]||0;
  const gt=(d.gtts||[]).filter(g=>g.status==="active").length;
  const cashGap=ok(kc)&&F.A?kc-F.cash:NaN,useBtn=ok(kc)&&fresh&&(!F.A||Math.abs(cashGap)>=1||lq!==F.liqUnits);
  return `<section class="card kite">${head}
    <div class="krow"><span>Cash in Kite</span><b class="mono">${inr(kc,2)}</b></div>
    ${F.A?`<div class="krow sub"><span>App's Kite fund cash</span><span class="mono ${ok(cashGap)&&Math.abs(cashGap)>=1?"warn":""}">${inr(F.cash,2)}${ok(cashGap)&&Math.abs(cashGap)>=1?` · off by ${inr(Math.abs(cashGap),2)}`:""}</span></div>`:""}
    <div class="krow"><span>Holdings</span><span class="${diff.length?"warn":"up"}">${diff.length?diff.length+" differ":"match the app ✓"}</span></div>
    ${diff.length?`<p class="small warn">${diff.join("<br>")}</p>`:""}
    <div class="krow sub"><span>${other?other+" other holding"+(other>1?"s":"")+" in Kite not tracked here":"Nothing else in Kite"}</span><span>${gt} active GTT${gt===1?"":"s"}</span></div>
    ${useBtn?`<p class="small muted">Tap to set the app's Kite fund to Kite's cash and ${lq} LiquidBees. Do it when today's orders have filled.</p>`:""}
    <div class="acts">${useBtn?`<button type="button" id="kUse">Use Kite's figures</button>`:""}${login||`<button type="button" class="ghost" id="kRef">Refresh</button>`}</div>
    ${e&&e.code!=="login"?`<p class="small dn">${esc(e.message)}</p>`:""}</section>`;}
function kiteUse(after){const d=kiteCache();if(!d||!d.funds||!ok(d.funds.live))return;const lq=((d.holdings||[]).find(h=>h.sym===LIQ)||{}).qty||0,on=ist().iso;
  setSettings("pkp",{kiteBal:r2(d.funds.live),kiteOn:on,kiteT:Date.now(),liqUnits:lq,liqOn:on});if(after)after();}
/* wire the card's buttons; on return from Kite's login (?kite=ok) fetch at once */
function kiteWire(redraw){const on=(id,f)=>{const e=document.getElementById(id);if(e)e.onclick=f;};
  on("kLogin",async()=>{try{await kiteLogin();}catch(e){alert(e.message);}});
  on("kRef",()=>kiteRefresh(redraw));on("kUse",()=>kiteUse(()=>redraw()));}
let kiteSt={};
async function kiteRefresh(redraw){const r=await kiteData();kiteSt=r.err?{err:r.err}:{};redraw();return r;}
function kiteState(){return kiteSt;}
function kiteBoot(redraw){const u=new URL(location.href),k=u.searchParams.get("kite");
  if(k){u.searchParams.delete("kite");history.replaceState(null,"",u.toString());if(k!=="ok")setTimeout(()=>alert(k==="denied"?"Kite login was cancelled.":"Kite login failed. Try again."),300);}
  kiteRefresh(redraw);}

/* ---------- minimal building blocks shared by both pages ---------- */
/* one action row: kind colours the label; btn is [text, attrs] or null */
function todo(kind,label,what,q,sub,amt,btn){return `<div class="todo ${kind}"><span class="tl"><em>${label}</em> <b>${what}</b></span><span class="tq">${q||""}</span>${btn?`<button type="button" class="tick" ${btn[1]}>${btn[0]}</button>`:`<span class="tick none"></span>`}<span class="ts">${sub||""}</span><span class="ta">${amt||""}</span></div>`;}
function tabs(list,cur){return `<nav class="tabs" role="tablist">${list.map(([k,l])=>`<button type="button" role="tab" data-tab="${k}" class="${k===cur?"on":""}" aria-selected="${k===cur}">${l}</button>`).join("")}</nav>`;}
function sum(items){return `<section class="sum">${items.map(([l,v,cls,sub])=>`<div><span>${l}</span><b class="${cls||""}">${v}</b>${sub?`<small>${sub}</small>`:""}</div>`).join("")}</section>`;}
function rememberTab(key,def){let t=def;try{t=sessionStorage.getItem("inv-tab-"+key)||def;}catch(e){}return t;}
function saveTab(key,t){try{sessionStorage.setItem("inv-tab-"+key,t);}catch(e){}}
window.Invest={todo,tabs,sum,rememberTab,saveTab,load,save,merge,upsert,remove,setSettings,uid,sync,push,hasSync,importData,exportData,pickImport,quotes,quotesCache,highSince,high52,touched,ist,ok,r2,inr,price,pct,signInr,tone,esc,dshort,days,ago,xirr,form,navs,navCache,mfSearch,NSE_HOLIDAYS,NSE_SPECIAL,nseClosed,nextTrading,orderSession,sessionStarted,LIQ,kiteFund,charges,liqToSell,liqForm,fundForm,fundBar,kiteCache,kiteData,kiteMatch,kiteCard,kiteWire,kiteRefresh,kiteBoot,kiteState,kiteUse,appUnits};
})();
