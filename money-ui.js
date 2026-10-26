/* Money Book and APDCL Expenditure (Money Trace): the page logic, shared by money.html and apdcl.html.
   Every entry is Personal or APDCL (book). Both pages show the same records: the Money Book all of them, with APDCL
   ones marked; APDCL Expenditure only the APDCL ones. */
"use strict";
const I=Invest,M=Money,{esc,inr,ok,r2}=I,KEY=M.KEY,$=id=>document.getElementById(id);
const AP=document.body.dataset.mode==="apdcl";/* true on the APDCL Expenditure page */
/* Invest = money moved into investments (Zerodha, SIPs): it leaves the wallet or bank but isn't spending */
const KINDS=[["out","Spent"],["in","Received"],["inv","Invest"],["atm","ATM ↓"],["dep","Deposit ↑"]];
const BOOKS=[["personal","Personal"],["apdcl","APDCL"]];
let showDays=10,deferredInstall=null,view=AP?"apdcl":"all",query="";
/* which entries a list shows: all, personal, apdcl (Samaguri) or bil (Bilasipara imprest, closed) */
const inView=x=>view==="all"?true:view==="personal"?!M.isApdcl(x):view==="apdcl"?M.isApdcl(x)&&x.acct!=="imprest-bil":x.acct==="imprest-bil";
const matches=x=>{if(!query)return true;const q=query.toLowerCase();return [x.note,x.cat,x.date,String(x.amt),x.raw].some(v=>v&&String(v).toLowerCase().includes(q));};
const kindOf=x=>x.kind==="move"?(x.to==="wallet"?"atm":"dep"):x.kind==="out"&&x.cat==="Investment"?"inv":x.kind;
const fromKind=(k,acct)=>k==="atm"?{kind:"move",acct:"bank",to:"wallet"}:k==="dep"?{kind:"move",acct:"wallet",to:"bank"}:{kind:k==="inv"?"out":k,acct,to:undefined};
const dayName=iso=>{const t=M.now().date,y=new Date(new Date(t+"T00:00:00")-864e5),yi=y.getFullYear()+"-"+String(y.getMonth()+1).padStart(2,"0")+"-"+String(y.getDate()).padStart(2,"0");
  const d=new Date(iso+"T00:00:00"),s=d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});return iso===t?"Today · "+s:iso===yi?"Yesterday · "+s:s;};
function toast(m){const o=document.querySelector(".toast");if(o)o.remove();const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);}
function lastAcct(){try{return localStorage.getItem("money-acct")||"wallet";}catch(e){return "wallet";}}
function setLastAcct(a){try{if(a==="wallet"||a==="bank")localStorage.setItem("money-acct",a);}catch(e){}}
const sumOf=L=>L.reduce((a,x)=>a+x.amt,0);
const isoOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

/* ---------- the numbers ---------- */
function model(){const S=M.summary(),today=M.now().date,mon=today.slice(0,7),N=M.names();
  const spend=S.T.filter(M.isSpend),inc=S.T.filter(x=>x.kind==="in"&&!M.NOT_SPEND.has(x.cat)&&!M.isApdcl(x));
  const tSpent=sumOf(spend.filter(x=>x.date===today)),tIn=sumOf(inc.filter(x=>x.date===today)),mSpent=sumOf(spend.filter(x=>x.date.slice(0,7)===mon)),mIn=sumOf(inc.filter(x=>x.date.slice(0,7)===mon));
  const dom=+today.slice(8,10),cats=L=>{const o={};L.forEach(x=>{const c=x.cat||"Other";o[c]=(o[c]||0)+x.amt;});return Object.entries(o).sort((a,b)=>b[1]-a[1]);};
  const mInv=sumOf(S.T.filter(x=>x.kind==="out"&&x.cat==="Investment"&&x.date.slice(0,7)===mon));
  const A=S.apdcl.T,aMon=A.filter(x=>x.date.slice(0,7)===mon),aOut=sumOf(aMon.filter(x=>x.kind==="out")),aIn=sumOf(aMon.filter(x=>x.kind==="in")),aToday=sumOf(A.filter(x=>x.kind==="out"&&x.date===today));
  return {...S,N,today,mon,tSpent,tIn,mSpent,mIn,mInv,aOut,aIn,aToday,aCat:cats(aMon.filter(x=>x.kind==="out")),avg:mSpent/dom,
    byCat:cats(spend.filter(x=>x.date.slice(0,7)===mon)),pend:M.list("pend").sort((a,b)=>M.ord(a)<M.ord(b)?-1:1)};}

/* ---------- drawing ---------- */
const apTxt=v=>v<0?`${inr(-v)} spent from your own money (due from APDCL)`:v>0?`${inr(v)} of APDCL money in hand`:"nothing pending";
function accTile(b,name){const cp=b.cp;
  if(!b.set)return `<button type="button" class="unset" data-bal="${b.acct}"><span>${esc(name)}</span><b>Set balance</b><small>tap to enter what you have</small></button>`;
  return `<button type="button" data-bal="${b.acct}"><span>${esc(name)}</span><b class="${b.val<0?"dn":""}">${inr(b.val)}</b><small>${cp?"checked "+I.dshort(cp.date):"no balance check yet"}</small></button>`;}
function hero(m){const a=m.apdcl.val;
  return `<section class="card hero"><div class="when">Money now</div><div class="tot">${m.any?inr(m.total):"—"}</div>
  ${m.any&&m.apdcl.set?`<div class="split"><span><i class="pd"></i>Personal <b>${inr(m.personal)}</b></span><a href="apdcl.html"><i class="ad"></i>APDCL <b class="${a<0?"dn":""}">${inr(a)}</b></a></div>`:""}
  <div class="acc2">${accTile(m.wallet,m.N.wallet)}${accTile(m.bank,m.N.bank)}</div>
  ${m.apdcl.set?`<p class="small muted" style="margin-top:8px">APDCL: ${apTxt(a)}. Personal = money now − APDCL.</p>`:""}</section>`;}
function todayCard(m){return `<section class="card"><div class="today">
  <div><span>Spent today</span><b class="${m.tSpent?"dn":""}">${inr(m.tSpent)}</b>${m.tIn?`<small class="up">+${inr(m.tIn)} in</small>`:m.aToday?`<small>+ APDCL ${inr(m.aToday)}</small>`:"<small>personal</small>"}</div>
  <div><span>This month</span><b>${inr(m.mSpent)}</b><small>${inr(m.avg)} a day</small></div>
  <div><span>Received</span><b class="${m.mIn?"up":""}">${inr(m.mIn)}</b><small>${m.mInv?"invested "+inr(m.mInv):"this month"}</small></div></div>
  ${m.aOut||m.aIn?`<a class="aprow" href="apdcl.html"><span><i class="ad"></i>APDCL this month</span><span><b>−${inr(m.aOut)}</b> · <b class="up">+${inr(m.aIn)}</b> ›</span></a>`:""}</section>`;}
/* APDCL Expenditure page: the ledger's balance and this month */
function apHero(m){const a=m.apdcl;
  return `<section class="card hero aph"><div class="when">APDCL balance</div><div class="tot ${a.val<0?"dn":""}">${inr(a.val)}</div>
   <p class="small muted" style="margin:0 0 10px">${apTxt(a.val)}. Received ${inr(a.received)} − spent ${inr(a.spent)} since Jan 2022. It's part of your Money now (${inr(m.total)}).</p>
   <div class="today"><div><span>Spent today</span><b class="${m.aToday?"dn":""}">${inr(m.aToday)}</b></div><div><span>This month</span><b>${inr(m.aOut)}</b></div><div><span>Received</span><b class="${m.aIn?"up":""}">${inr(m.aIn)}</b><small>this month</small></div></div></section>`;}
function monthsCard(m){const A=m.apdcl.T,t=new Date(m.today+"T00:00:00"),rows=[];
  for(let i=0;i<12;i++){const d=new Date(t.getFullYear(),t.getMonth()-i,1),k=isoOf(d).slice(0,7),L=A.filter(x=>x.date.slice(0,7)===k);
    rows.push([d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"}),sumOf(L.filter(x=>x.kind==="in")),sumOf(L.filter(x=>x.kind==="out"))]);}
  if(!rows.some(r=>r[1]||r[2]))return "";
  return `<section class="card"><h2>Month by month <small>last 12</small></h2><table class="mon"><tr><th></th><th>Received</th><th>Spent</th><th>Net</th></tr>
   ${rows.map(([l,i,o])=>`<tr><td>${l}</td><td class="up">${i?inr(i):"–"}</td><td>${o?inr(o):"–"}</td><td class="${i-o<0?"dn":i-o>0?"up":""}">${i||o?inr(i-o):""}</td></tr>`).join("")}</table></section>`;}
function reviewCard(m){if(!m.pend.length)return "";const n=m.pend.length;
  return `<section class="card review"><h2>${n} to approve${(()=>{const w=m.pend.filter(x=>x.src==="wa").length,y=n-w;return w&&y?` <small>${w} from WhatsApp · ${y} from YONO</small>`:w?" from WhatsApp":" from YONO";})()} <small>${I.dshort(m.pend[0].date)}${m.pend[n-1].date!==m.pend[0].date?" – "+I.dshort(m.pend[n-1].date):""}</small></h2>
  <p class="small">Remarks are drafted from the statement, your WhatsApp notes and what you approved before. Mark each Personal or APDCL, or take them as drafted.</p>
  <div class="acts"><button type="button" id="rvOne">Review one by one</button><button type="button" class="ghost" id="rvAll">Approve all ${n}</button></div></section>`;}
function entRow(x,N){const ap=M.isApdcl(x),acc=x.kind==="move"?(x.to==="wallet"?N.bank+" → "+N.wallet:N.wallet+" → "+N.bank):(N[x.acct]||x.acct);
  const iv=x.kind==="out"&&x.cat==="Investment",cls=x.kind==="in"?"in":x.kind==="move"?"mv":iv?"inv":"",sign=x.kind==="in"?"+":x.kind==="move"?"":iv?"→ ":"−";
  const sub=[x.time,x.cat,acc,x.src==="yono"?"YONO":""].filter(Boolean).join(" · ");
  return `<button type="button" class="ent" data-tx="${esc(x.id)}"><span style="min-width:0"><div class="n">${ap&&!AP?`<em class="apt">APDCL</em>`:""}${esc(x.note||x.cat||(x.kind==="move"?"Transfer":"—"))}</div><div class="s">${esc(sub)}</div></span><span class="a ${cls}">${sign}${inr(x.amt,x.amt%1?2:0)}</span></button>`;}
function listCard(m){const any=AP?m.T.some(M.isApdcl):m.T.length;
  if(!any)return `<section class="card empty"><b>No entries yet</b><p class="small muted">${AP?"Log APDCL money with + APDCL, or approve WhatsApp notes as APDCL in the Money Book.":"Set your wallet and bank balances above, then log cash spends with + Log and bring in online ones with a YONO statement file."}</p></section>`;
  const V=AP?[["apdcl","Samaguri"],["bil","Bilasipara (closed)"]]:[["all","All"],["personal","Personal"],["apdcl","APDCL"]];
  return `<section class="card" id="entCard"><h2>Entries <small id="entN"></small></h2>
   <div class="seg" id="sV">${V.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===view?"on":""}">${l}</button>`).join("")}</div>
   <input id="q" class="srch" type="search" placeholder="Search: remark, amount, 2022-05…" value="${esc(query)}" autocomplete="off">
   <div id="entList"></div></section>`;}
function drawList(){const el=$("entList");if(!el)return;const N=M.names(),T=M.entries().filter(x=>inView(x)&&matches(x));
  const dayHead=L=>{const p=sumOf(L.filter(M.isSpend)),a=sumOf(L.filter(x=>M.isApdcl(x)&&x.kind==="out"));
    return view==="apdcl"||view==="bil"?(a?"spent "+inr(a):""):view==="personal"?(p?"spent "+inr(p):""):[p?"spent "+inr(p):"",a?"APDCL "+inr(a):""].filter(Boolean).join(" · ");};
  const byDay={};T.forEach(x=>(byDay[x.date]=byDay[x.date]||[]).push(x));const ds=Object.keys(byDay).sort().reverse(),shown=query?ds.slice(0,Math.max(showDays,60)):ds.slice(0,showDays);
  $("entN").textContent=T.length+(query?" found":"");
  el.innerHTML=!T.length?`<p class="small muted" style="margin:12px 0 4px">Nothing here${query?" for “"+esc(query)+"”":""}.</p>`:shown.map(d=>{const L=byDay[d].slice().reverse();
    return `<div class="day"><span>${esc(dayName(d))}</span><b>${dayHead(L)}</b></div>${L.map(x=>entRow(x,N)).join("")}`;}).join("")+
    (ds.length>shown.length?`<button type="button" class="more" id="more">Show earlier days</button>`:"");
  el.querySelectorAll("[data-tx]").forEach(b=>b.onclick=()=>{const x=I.load(KEY).tx[b.dataset.tx];if(x)entry({id:b.dataset.tx,...x});});
  const mo=$("more");if(mo)mo.onclick=()=>{showDays+=30;drawList();};}
/* the FINANCE sheet's other tabs, kept as they were */
function archCard(){const A=M.archive();if(!A.length)return "";
  return `<section class="card"><h2>Old FINANCE sheet tabs <small>as they were</small></h2><div class="chips">${A.map(a=>`<button type="button" data-arch="${esc(a.id)}">${esc(a.name)}</button>`).join("")}</div></section>`;}
function showArch(id){const a=M.archive().find(x=>x.id===id);if(!a)return;const w=Math.max(...a.rows.map(r=>r.length));
  const d=sheet(`<div style="display:flex;justify-content:space-between;align-items:baseline"><h3>${esc(a.name)}</h3><span class="small muted">${a.rows.length} rows</span></div>
    <div class="tblw"><table class="arch">${a.rows.map((r,i)=>`<tr>${Array.from({length:w},(_,j)=>`<${i===0?"th":"td"}>${esc(r[j]||"")}</${i===0?"th":"td"}>`).join("")}</tr>`).join("")}</table></div>
    <div class="fbtns"><span></span><button type="button" id="eX">Close</button></div>`);
  d.classList.add("wide");$("eX").onclick=()=>{d.close();d.remove();};d.showModal();}
function catsCard(title,L,total,color){if(!L.length)return "";const max=L[0][1];
  return `<section class="card"><h2>${title} <small>${inr(total)}</small></h2><div class="cats">${L.map(([c,v])=>`<div class="cat"><span>${esc(c)}</span><span><i style="width:${Math.max(2,v/max*100).toFixed(1)}%${color?";background:"+color:""}"></i></span><b>${inr(v)}</b></div>`).join("")}</div></section>`;}
function barsCard(m,pick,color){const t=new Date(m.today+"T00:00:00"),L=[];for(let i=29;i>=0;i--){const d=new Date(t-i*864e5),iso=isoOf(d);
    L.push([iso,d.getDate(),sumOf(m.T.filter(x=>x.date===iso&&pick(x)))]);}
  const max=Math.max(...L.map(x=>x[2]));if(!(max>0))return "";
  return `<section class="card"><h2>Last 30 days <small>spent per day</small></h2><div class="bars">${L.map(([iso,d,v])=>`<div title="${iso}: ${inr(v)}"><i style="height:${(v/max*100).toFixed(1)}%${color?";background:"+color:""}"></i><span>${d%5===0||iso===m.today?d:""}</span></div>`).join("")}</div></section>`;}
/* the card goes away on a phone once the Money Log icon has been used there */
const APP_KEY="money-log-icon";if(/[?&]app/.test(location.search))try{localStorage.setItem(APP_KEY,"1");}catch(e){}
window.addEventListener("appinstalled",()=>{try{localStorage.setItem(APP_KEY,"1");}catch(e){}draw();});
function installCard(){let has=false;try{has=!!localStorage.getItem(APP_KEY);}catch(e){}if(has)return "";
  return `<section class="card"><div class="install"><img src="money-192.png" alt=""><p><b>Money Log on your home screen</b><br><span class="muted">One tap opens a new entry. Do this once on each phone.</span></p><button type="button" class="ghost" id="inst">Add</button></div></section>`;}
const APC="#4a6fa5";
function draw(){const m=model();try{localStorage.setItem("money-summary",JSON.stringify({total:m.total,personal:m.personal,apdcl:m.apdcl.val,any:m.any,at:Date.now()}));}catch(e){}
  const sync=I.hasSync()?"Synced between your phones (encrypted).":"Sync is off: entries stay on this phone.";
  $("out").innerHTML=AP
    ?apHero(m)+catsCard("This month by category",m.aCat,m.aOut,APC)+listCard(m)+monthsCard(m)+barsCard(m,x=>M.isApdcl(x)&&x.kind==="out",APC)+
      `<p class="small muted" style="text-align:center;margin:10px 0">${sync} Every entry here is also in the Money Book, marked APDCL, and moves your wallet or bank like any other.</p>`
    :reviewCard(m)+hero(m)+todayCard(m)+listCard(m)+catsCard("This month by category",m.byCat,m.mSpent)+barsCard(m,M.isSpend)+archCard()+installCard()+
      `<p class="small muted" style="text-align:center;margin:10px 0">${sync} Spending figures here are personal; APDCL spending is counted on its own page. ATM withdrawals, deposits, Investment and Self transfer aren't spending.</p>
       <p class="small" style="text-align:center;margin:0 0 16px"><button type="button" class="lnk" id="imp">Import a history file</button></p>`;
  drawList();
  const sv=$("sV");if(sv)sv.querySelectorAll("button").forEach(b=>b.onclick=()=>{view=b.dataset.v;showDays=10;sv.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));drawList();});
  const qi=$("q");if(qi)qi.oninput=()=>{query=qi.value.trim();drawList();};
  document.querySelectorAll("[data-arch]").forEach(b=>b.onclick=()=>showArch(b.dataset.arch));
  document.querySelectorAll("[data-bal]").forEach(b=>b.onclick=()=>balForm(b.dataset.bal));
  const on=(id,f)=>{const e=$(id);if(e)e.onclick=f;};
  on("rvOne",()=>review(0));on("rvAll",approveAll);on("inst",install);on("imp",importHistory);}
function importHistory(){I.pickImport((e,done)=>{if(e){showErr("Import: "+e.message);return;}
  M.migrateApdcl();draw();toast(done&&done.includes("cash")?`History imported · ${M.entries().length} entries`:"Imported");});}

/* ---------- log an entry (the quick sheet) ---------- */
function recentNotes(){const seen=new Set(),out=[];M.entries().reverse().forEach(x=>{const n=(x.note||"").trim();if(n&&!seen.has(n.toLowerCase())&&out.length<60){seen.add(n.toLowerCase());out.push(n);}});return out;}
function chipsHtml(k,cur,book){const ap=book==="apdcl",L=k==="in"?(ap?M.IMP_IN_CATS:M.IN_CATS):k==="out"?(ap?M.IMP_CATS:M.OUT_CATS):[];return L.map(c=>`<button type="button" data-c="${esc(c)}" class="${c===cur?"on":""}">${esc(c)}</button>`).join("");}
function sheet(html){let d=$("mSheet");if(d)d.remove();d=document.createElement("dialog");d.id="mSheet";d.className="sheet";d.innerHTML=`<form method="dialog">${html}</form>`;document.body.appendChild(d);
  d.addEventListener("cancel",()=>d.remove());d.addEventListener("click",e=>{if(e.target===d){d.close();d.remove();}});return d;}
function segWire(d,sel,on){d.querySelectorAll(sel+" button").forEach(b=>b.onclick=e=>{e.preventDefault();d.querySelectorAll(sel+" button").forEach(x=>x.classList.toggle("on",x===b));on(b.dataset.v);});}
function entry(pre,again){pre=pre||{};const N=M.names(),n=M.now(),edit=!!pre.id;
  const fixedAcct=!!pre.acct&&!M.ACCTS.some(([v])=>v===pre.acct);/* FINANCE sheet history keeps its account (and so its book) */
  let k=pre.kind?kindOf(pre):"out",acct=!fixedAcct&&pre.acct&&pre.kind!=="move"?pre.acct:fixedAcct?pre.acct:lastAcct(),cat=pre.cat||"",book=pre.id?(M.isApdcl(pre)?"apdcl":"personal"):(pre.book||(AP?"apdcl":"personal"));
  const d=sheet(`<h3>${edit?"Edit entry":AP?"Log APDCL money":"Log money"}</h3>
    <div class="seg bk" id="sB"${fixedAcct?" hidden":""}>${BOOKS.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===book?"on":""}">${l}</button>`).join("")}</div>
    <div class="seg k" id="sK">${KINDS.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===k?"on":""}">${l}</button>`).join("")}</div>
    <div class="seg" id="sA"${fixedAcct?" hidden":""}>${M.ACCTS.map(([v])=>`<button type="button" data-v="${v}" class="${v===acct?"on":""}">${esc(N[v])}</button>`).join("")}</div>
    ${fixedAcct?`<p class="small muted">${esc(N[pre.acct]||pre.acct)} · history (doesn't move your wallet or bank)</p>`:""}
    <label class="amt"><span>₹</span><input id="eAmt" inputmode="decimal" autocomplete="off" placeholder="0" value="${ok(pre.amt)?pre.amt:""}"></label>
    <div class="chips" id="eCat"></div>
    <label class="fld"><span>Remark</span><input id="eNote" list="eNotes" autocomplete="off" value="${esc(pre.note||"")}"><datalist id="eNotes">${recentNotes().map(x=>`<option value="${esc(x)}">`).join("")}</datalist></label>
    <div class="two"><label class="fld"><span>Date</span><input id="eDate" type="date" value="${pre.date||n.date}"></label><label class="fld"><span>Time</span><input id="eTime" type="time" value="${pre.time!=null&&edit?pre.time:n.time}"></label></div>
    <label class="kchk" id="kWrap" hidden><input type="checkbox" id="eKite" ${pre.kiteId||!edit?"checked":""}> Money added to Zerodha (Kite): also add it to the Kite fund, so ETF Shop and Portfolio show it</label>
    ${pre.raw?`<div class="raw">${esc(pre.raw)}</div>`:""}
    <p class="ferr" hidden></p>
    <div class="fbtns">${edit?`<button type="button" class="danger" id="eDel">Delete</button>`:`<button type="button" class="ghost" id="eNext">Save + next</button>`}<span></span><button type="button" class="ghost" id="eX">Cancel</button><button type="submit">Save</button></div>`);
  const showCats=()=>{const ap=book==="apdcl"||M.isApdcl({acct}),mv=k==="atm"||k==="dep";$("eCat").innerHTML=chipsHtml(k,cat,ap?"apdcl":"personal");$("eCat").hidden=mv||k==="inv";$("sA").hidden=mv||fixedAcct;
    d.querySelectorAll('#sK button[data-v="inv"]').forEach(b=>b.hidden=ap||fixedAcct);
    d.querySelectorAll('#sK button[data-v="atm"],#sK button[data-v="dep"]').forEach(b=>b.hidden=ap||fixedAcct);
    $("kWrap").hidden=!(k==="inv"&&!ap&&!fixedAcct);
    $("eNote").placeholder=ap?"e.g. Wagon R fuel · Nitul, Labour · Bichitra":k==="inv"?"e.g. Zerodha (Kite), Parag Parikh SIP":"e.g. Mess lunch, Sethia Brothers";
    $("eCat").querySelectorAll("button").forEach(b=>b.onclick=e=>{e.preventDefault();cat=cat===b.dataset.c?"":b.dataset.c;showCats();});};
  const setK=v=>{k=v;d.querySelectorAll("#sK button").forEach(x=>x.classList.toggle("on",x.dataset.v===v));};
  segWire(d,"#sK",v=>{if((v==="in")!==(k==="in")||k==="inv"||v==="inv")cat="";k=v;
    if(v==="inv"&&acct==="wallet"&&!edit){acct="bank";d.querySelectorAll("#sA button").forEach(x=>x.classList.toggle("on",x.dataset.v==="bank"));}showCats();});
  segWire(d,"#sB",v=>{if(v!==book)cat="";book=v;if(v==="apdcl"&&(k==="atm"||k==="dep"||k==="inv"))setK("out");showCats();});
  segWire(d,"#sA",v=>{acct=v;});showCats();
  const err=d.querySelector(".ferr"),close=()=>{d.close();d.remove();};
  let walletOk=false;
  const save=()=>{const amt=parseFloat(String($("eAmt").value).replace(/[,₹\s]/g,""));if(!(amt>0)){err.hidden=false;err.textContent="Enter the amount.";return false;}
    /* a spend that would take the wallet below zero was most likely paid from the bank: ask once */
    if(!walletOk&&!fixedAcct&&(k==="out"||k==="inv")&&acct==="wallet"){const w=M.balance("wallet"),was=edit&&pre.acct==="wallet"&&pre.kind==="out"?pre.amt:0,after=w.val+was-amt;
      if(w.set&&after<0){err.hidden=false;err.innerHTML=`Your wallet has ${inr(w.val+was)}, so this would take it to ${inr(after)}. Was it paid from the bank?<span class="fixb"><button type="button" id="fxB">Paid from Bank</button><button type="button" class="ghost" id="fxW">No, from Wallet</button></span>`;
        $("fxB").onclick=()=>{acct="bank";d.querySelectorAll("#sA button").forEach(x=>x.classList.toggle("on",x.dataset.v==="bank"));err.hidden=true;if(save())close();};
        $("fxW").onclick=()=>{walletOk=true;err.hidden=true;if(save())close();};return false;}}
    if(k==="inv")cat="Investment";
    const mv=k==="atm"||k==="dep",note=$("eNote").value.trim();if(!note&&!cat&&!mv){err.hidden=false;err.textContent="Add a remark or pick a category.";return false;}
    const r={...pre,...fromKind(k,acct),amt:r2(amt),cat:mv?"":cat,note:note||(k==="atm"?"ATM withdrawal":k==="dep"?"Cash deposit":""),date:$("eDate").value||n.date,time:$("eTime").value||"",src:pre.src||"hand"};
    if(!fixedAcct)r.book=mv?"personal":book;
    /* when it was logged (balance checks compare against this; editing an entry later doesn't change it) */
    r.at=pre.at||pre.t||Date.now();
    delete r.id;delete r.t;if(r.to===undefined)delete r.to;if(!mv)setLastAcct(acct);
    /* money sent to Zerodha: mirror it as Kite fund "money in" (ETF Shop), linked so edits and deletes follow */
    const toKite=!$("kWrap").hidden&&$("eKite").checked;
    if(toKite)r.kiteId=I.upsert("etf","cap",pre.kiteId||null,{date:r.date,amount:r.amt,note:"From Money Book: "+(r.note||"Investment")});
    else if(pre.kiteId){I.remove("etf","cap",pre.kiteId);delete r.kiteId;}
    I.upsert(KEY,"tx",pre.id,r);draw();
    if(!edit){const m=model();toast(r.book==="apdcl"?`Saved ${inr(r.amt,r.amt%1?2:0)} · APDCL ${inr(m.apdcl.val)}`:`Saved ${inr(r.amt,r.amt%1?2:0)}${toKite?" · added to Kite fund":` · spent today ${inr(m.tSpent)}`}`);}return true;};
  d.querySelector("form").onsubmit=e=>{e.preventDefault();if(save())close();};
  $("eX").onclick=close;
  if($("eNext"))$("eNext").onclick=()=>{if(save()){close();setTimeout(()=>entry({book},true),50);}};
  if($("eDel"))$("eDel").onclick=()=>{if(confirm("Delete this entry?"+(pre.kiteId?" Its Kite fund money-in goes too.":""))){if(pre.kiteId)I.remove("etf","cap",pre.kiteId);I.remove(KEY,"tx",pre.id);close();draw();}};
  d.showModal();setTimeout(()=>{if(!edit)$("eAmt").focus();},60);}

/* ---------- balance check ---------- */
/* the entries that moved an account since its last balance check, newest first */
function movedSince(acct){const b=M.balance(acct);return M.entries().filter(x=>M.effect(x,acct)&&(!b.cp||M.counts(x,b.cp))).reverse();}
function balForm(acct){const N=M.names(),b=M.balance(acct),n=M.now(),L=movedSince(acct);
  const how=b.set?(b.cp?`Checked ${inr(b.cp.amt)} on ${I.dshort(b.cp.date)}`:"Started at ₹0")+(L.length?", then "+L.slice(0,6).map(x=>`${M.effect(x,acct)>0?"+":"−"}${inr(Math.abs(M.effect(x,acct)))} ${x.note||x.cat||""}`).join(", ")+(L.length>6?` and ${L.length-6} more`:""):"")+` = ${inr(b.val,2)}. `:"";
  I.form({title:N[acct]+" balance",note:b.set?`${how}If an entry is on the wrong account, tap “Fix an entry”. Otherwise enter what you actually have (count the cash, or the balance YONO shows); from now on, entries move it.`:`Enter what you have now. From then on, every entry moves it.`,
    extra:L.length?[{label:"Fix an entry",run:()=>{setTimeout(()=>I.form({title:"Which entry?",note:`These moved your ${N[acct].toLowerCase()} since the last check. Pick one to change its account, amount or kind.`,ok:"Open",
      fields:[{k:"id",label:"Entry",type:"select",value:L[0].id,options:L.slice(0,40).map(x=>[x.id,`${I.dshort(x.date)} ${x.time||""} · ${M.effect(x,acct)>0?"+":"−"}${inr(Math.abs(M.effect(x,acct)))} · ${x.note||x.cat||"—"}`])}],
      onSubmit:v=>{const x=I.load(KEY).tx[v.id];if(x)setTimeout(()=>entry({id:v.id,...x}),0);}}),0);}}]:null,
    fields:[{k:"amt",label:acct==="wallet"?"Cash in hand (₹)":"Balance (₹)",type:"number",value:b.set?r2(b.val):""},
      ...(b.set?[{k:"gap",label:"If it differs from the book",type:"select",value:"fix",options:[["fix","Just correct the balance"],["log","Log the difference as unaccounted"]]}]:[]),
      {k:"name",label:"Name shown",value:N[acct],req:false,hint:acct==="bank"?"e.g. SBI":"e.g. Wallet"},
      {k:"date",label:"As on",type:"date",value:n.date}],ok:"Save",
    onSubmit:v=>{if(!ok(v.amt))return "Enter the amount.";const t=v.date===n.date?n.time:"23:59";
      if(b.set&&v.gap==="log"&&Math.abs(v.amt-b.val)>=0.5){const g=r2(b.val-v.amt);I.upsert(KEY,"tx",null,{kind:g>0?"out":"in",acct,amt:Math.abs(g),cat:"Other",note:"Unaccounted",date:v.date,time:t,src:"hand"});}
      I.upsert(KEY,"bal",null,{acct,amt:r2(v.amt),date:v.date,time:t});
      if(v.name&&v.name!==N[acct])I.setSettings(KEY,{[acct+"Name"]:v.name.trim()});draw();}});}

/* ---------- YONO statement ---------- */
function loadXlsx(){return window.XLSX?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=res;s.onerror=()=>rej(new Error("couldn't load the spreadsheet reader (are you online?)"));document.head.appendChild(s);});}
const PW_KEY="money-yono-pw";
const savedPw=()=>{try{return localStorage.getItem(PW_KEY)||"";}catch(e){return "";}};
/* the encrypted file's two inner streams, or null if the file isn't password-protected */
function encStreams(buf){if(!(buf[0]===0xd0&&buf[1]===0xcf&&buf[2]===0x11&&buf[3]===0xe0))return null;
  try{const c=XLSX.CFB.read(buf,{type:"array"}),info=XLSX.CFB.find(c,"EncryptionInfo"),pkg=XLSX.CFB.find(c,"EncryptedPackage");
    return info&&pkg?{info:info.content,pkg:pkg.content}:null;}catch(e){return null;}}
function askPw(name,wrong){return new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;res(v);}};
  I.form({title:"Statement password",note:(wrong?"That password didn't open it. ":"")+name+" is locked with a password (SBI sets this; it's usually given in the SMS or e-mail that came with the statement). It's used only on this phone to open the file.",
    fields:[{k:"pw",label:"Password",type:"password",value:""},{k:"keep",label:"Remember on this phone",type:"select",value:savedPw()?"y":"n",options:[["y","Yes, don't ask again"],["n","No, ask every time"]]}],ok:"Open",
    onSubmit:v=>{if(!v.pw)return "Enter the password.";fin(v);}});
  const d=$("invForm");if(d){d.addEventListener("close",()=>setTimeout(()=>fin(null),0));d.addEventListener("cancel",()=>setTimeout(()=>fin(null),0));}});}
async function openWorkbook(f){const buf=new Uint8Array(await f.arrayBuffer());
  if(buf[0]===0x25&&buf[1]===0x50&&buf[2]===0x44&&buf[3]===0x46)throw new Error("this is a PDF. In YONO, download the statement as Excel instead.");
  const enc=encStreams(buf);
  if(!enc){try{return XLSX.read(buf,{type:"array",cellDates:true});}
    catch(e){if(!/password|encrypt/i.test(e.message))throw e;}}
  /* password-protected: try the remembered password first, then ask */
  let pw=savedPw(),wrong=false;
  for(;;){let keep=null;if(!pw){const a=await askPw(f.name,wrong);if(!a)throw new Error("not opened (no password given).");pw=a.pw;keep=a.keep;}
    $("st").textContent="Unlocking "+f.name+"… (a few seconds)";await new Promise(r=>setTimeout(r,30));
    try{const wb=enc?XLSX.read(await OfficeDecrypt.decrypt(enc.info,enc.pkg,pw),{type:"array",cellDates:true}):XLSX.read(buf,{type:"array",cellDates:true,password:pw});
      try{if(keep==="y")localStorage.setItem(PW_KEY,pw);else if(keep==="n")localStorage.removeItem(PW_KEY);}catch(e){}
      return wb;}
    catch(e){if(!/wrong password|password|encrypt|decrypt|operation/i.test(e.message+" "+e.name))throw e;
      if(pw===savedPw())try{localStorage.removeItem(PW_KEY);}catch(x){}pw="";wrong=true;}}}
function pickYono(){const i=document.createElement("input");i.type="file";i.accept=".xls,.xlsx,.csv,.txt,.htm,.html,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
  i.onchange=async()=>{const f=i.files&&i.files[0];if(!f)return;$("st").textContent="Reading "+f.name+"…";
    try{await loadXlsx();const wb=await openWorkbook(f);$("st").textContent="Reading "+f.name+"…";
      let rows=null,lastErr=null;for(const n of wb.SheetNames){try{rows=M.readStatement(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:""}));break;}catch(e){lastErr=e;}}
      if(!rows)throw lastErr||new Error("No sheet in the file.");
      const r=M.importRows(rows);showErr("");draw();
      $("st").textContent=`${f.name}: ${r.added} new${r.dup?`, ${r.dup} already in`:""}${r.cp?` · bank ${inr(r.cp.amt,2)} on ${I.dshort(r.cp.date)}`:""}`;
      if(r.added)review(0);else toast("Nothing new in this statement.");}
    catch(e){showErr("YONO file: "+e.message);$("st").textContent="";}};
  i.click();}
/* one statement row at a time, like WhatsApp Review: edit the draft, then approve, discard or skip */
function review(at){const P=M.list("pend").sort((a,b)=>M.ord(a)<M.ord(b)?-1:1);if(!P.length){const d=$("mSheet");if(d){d.close();d.remove();}draw();return;}
  const i=Math.max(0,Math.min(at,P.length-1)),p=P[i],N=M.names(),wa=p.src==="wa";let k=kindOf(p),cat=p.cat||"",book=p.book==="apdcl"?"apdcl":"personal",acct=wa?(p.acct==="bank"?"bank":"wallet"):"bank";const twin=wa&&p.acct!=="bank"?null:M.handTwin(p);
  const bnote=v=>v==="apdcl"?"APDCL: counted in your money and on the APDCL Expenditure page.":"Personal.";
  const d=sheet(`<div class="wah" style="display:flex;justify-content:space-between;align-items:baseline"><h3>${wa?"WhatsApp money note":"YONO review"}</h3><span class="small muted">${i+1} of ${P.length}</span></div>
    <div><span class="big ${p.kind==="in"?"in":p.kind==="out"?"out":""}">${p.kind==="in"?"+":p.kind==="out"?"−":""}${inr(p.amt,p.amt%1?2:0)}</span>${p.learned?`<span class="tag">as last time</span>`:""}<div class="small muted">${esc(dayName(p.date))}${p.ref?" · ref "+esc(p.ref):""}</div></div>
    <div class="raw">${esc(p.raw)}</div>
    <div class="seg bk" id="sB">${BOOKS.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===book?"on":""}">${l}</button>`).join("")}</div>
    <p class="small muted" id="bNote" style="margin:-4px 0 0">${bnote(book)}</p>
    ${wa?`<div class="seg" id="sA">${M.ACCTS.map(([v])=>`<button type="button" data-v="${v}" class="${v===acct?"on":""}">${esc(N[v])}</button>`).join("")}</div>
    <div class="two"><label class="fld"><span>Amount ₹</span><input id="eAmt" inputmode="decimal" autocomplete="off" value="${ok(p.amt)?p.amt:""}"></label>
    <label class="fld"><span>Date</span><input id="eDate" type="date" value="${esc(p.date||"")}"></label></div>`:""}
    ${twin?`<p class="twin">You logged this by hand already (“${esc(twin.note||twin.cat)}”). Approving links the two; it won't be counted twice.</p>`:""}
    <div class="seg k" id="sK">${KINDS.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===k?"on":""}">${l}</button>`).join("")}</div>
    <div class="chips" id="eCat"></div>
    <div class="two" style="grid-template-columns:1fr 110px"><label class="fld"><span>Remark</span><input id="eNote" list="eNotes" autocomplete="off" value="${esc(p.note||"")}"><datalist id="eNotes">${recentNotes().map(x=>`<option value="${esc(x)}">`).join("")}</datalist></label>
    <label class="fld"><span>Time (optional)</span><input id="eTime" type="time" value="${esc(p.time||"")}"></label></div>
    <p class="ferr" hidden></p>
    <div class="rbtns"><button type="submit" class="ok">Approve ✓</button><button type="button" class="danger" id="rDel">Discard</button><button type="button" class="ghost" id="rSkip">Skip</button><button type="button" class="ghost" id="eX">Close</button></div>`);
  const showCats=()=>{$("eCat").innerHTML=chipsHtml(k,cat,book);$("eCat").hidden=k==="atm"||k==="dep";
    d.querySelectorAll('#sK button[data-v="atm"],#sK button[data-v="dep"],#sK button[data-v="inv"]').forEach(b=>b.hidden=book==="apdcl");$("eCat").hidden=k==="atm"||k==="dep"||k==="inv";
    $("eCat").querySelectorAll("button").forEach(b=>b.onclick=e=>{e.preventDefault();cat=cat===b.dataset.c?"":b.dataset.c;showCats();});};
  segWire(d,"#sK",v=>{if((v==="in")!==(k==="in"))cat="";k=v;showCats();});
  segWire(d,"#sB",v=>{if(v!==book)cat=v==="apdcl"?M.impCat("",$("eNote").value):"";book=v;$("bNote").textContent=bnote(v);
    if(v==="apdcl"&&(k==="atm"||k==="dep")){k="out";d.querySelectorAll("#sK button").forEach(x=>x.classList.toggle("on",x.dataset.v==="out"));}showCats();});
  if(wa)segWire(d,"#sA",v=>{acct=v;});showCats();
  const close=()=>{d.close();d.remove();draw();};
  d.querySelector("form").onsubmit=e=>{e.preventDefault();const extra={book:k==="atm"||k==="dep"?"personal":book};
    if(wa){const a=parseFloat(String($("eAmt").value).replace(/[,₹\s]/g,""));if(!(a>0)){const fe=d.querySelector(".ferr");fe.hidden=false;fe.textContent="Enter the amount.";return;}extra.amt=a;if($("eDate").value)extra.date=$("eDate").value;}
    const mv=fromKind(k,acct),final={...mv,...extra,cat:k==="atm"||k==="dep"?"":k==="inv"?"Investment":(cat||(book==="apdcl"&&k==="in"?"Imprest received":"Other")),note:$("eNote").value.trim()||p.note,time:$("eTime").value||""},r=M.approve(p.id,final);
    if(wa)waTell({action:"approve",id:p.waId,book:final.book,kind:final.kind,amt:final.amt,acct:final.acct,date:final.date||p.date,time:final.time,cat:final.cat,note:final.note});
    if(r==="linked")toast("Linked to your hand entry");d.remove();review(i);};
  $("rDel").onclick=()=>{if(wa)waTell({action:"discard",id:p.waId});M.discard(p.id);d.remove();review(i);};
  $("rSkip").onclick=()=>{d.remove();if(i+1<P.length)review(i+1);else{draw();toast("Skipped ones stay waiting.");}};
  $("eX").onclick=close;d.showModal();}
function approveAll(){const P=M.list("pend");if(!P.length)return;
  if(!confirm(`Approve all ${P.length} as drafted? Ones without a category go in as Other. You can still edit any entry later.`))return;
  let linked=0;P.sort((a,b)=>M.ord(a)<M.ord(b)?-1:1).forEach(p=>{const ap=p.book==="apdcl"&&p.kind!=="move",c=p.kind==="move"?"":ap?(p.kind==="in"?"Imprest received":M.impCat(p.cat,p.note)):(p.cat||"Other");
    const acct=p.src==="wa"?(p.acct==="bank"?"bank":"wallet"):p.acct;
    if(M.approve(p.id,{cat:c,acct,book:ap?"apdcl":"personal"})==="linked")linked++;
    if(p.src==="wa")waTell({action:"approve",id:p.waId,book:ap?"apdcl":"personal",kind:p.kind,amt:p.amt,acct,date:p.date,time:p.time||"",cat:c,note:p.note});});
  draw();toast(`Approved ${P.length}${linked?` · ${linked} linked to hand entries`:""}`);}

/* ---------- home-screen icon ---------- */
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;});
async function install(){if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice;}catch(e){}deferredInstall=null;return;}
  const url=location.origin+location.pathname,inApp=matchMedia("(display-mode: standalone)").matches;
  I.form({title:"Money Log on the home screen",note:(inApp?"Open this page in the Chrome browser (not inside the Pranju OS app): "+url+" . Then ":"In Chrome, ")+"open the ⋮ menu (top right) and tap “Add to Home screen” → “Install”. The new Money Log icon opens straight into a new entry. Do the same on your other phone.",
    fields:[],ok:"OK",onSubmit:()=>{},extra:navigator.clipboard?[{label:"Copy link",run:()=>{navigator.clipboard.writeText(url).then(()=>toast("Link copied"),()=>{});}}]:null});}

/* ---------- WhatsApp money notes (drafted by the nightly review into TickTick MONEY REVIEW) ---------- */
function waUrl(){let u=null;try{u=localStorage.getItem("totalRecallTickTickUrl");}catch(e){}return (u||"https://total-recall-ticktick.pranjuchakrapani90.workers.dev").replace(/[?#].*$/,"").replace(/\/$/,"")+"/?mode=money-review";}
function waTell(body){fetch(waUrl(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);}).catch(e=>toast("Saved here; couldn't update TickTick ("+e.message+")"));}
async function waFetch(){try{const r=await fetch(waUrl(),{cache:"no-store"});if(!r.ok)return;const d=await r.json();const n=M.addWa(d.items||[]);if(n){draw();toast(n+" money note"+(n>1?"s":"")+" from WhatsApp to approve");}}catch(e){}}

/* ---------- sync ---------- */
function showErr(m){$("err").hidden=!m;$("err").textContent=m||"";}
async function syncNow(loud){try{const r=await I.sync(KEY);if(r.ok&&r.changed)draw();if(loud){$("st").textContent=r.ok?"Synced.":r.msg;}}catch(e){if(loud)showErr("Sync failed: "+e.message);}}
$("qAdd").onclick=()=>entry();if($("qYono"))$("qYono").onclick=pickYono;$("sync").onclick=()=>syncNow(true);
M.migrateApdcl();
draw();
if(/[?&]add/.test(location.search)){entry();history.replaceState(null,"",location.pathname);}
syncNow(false).then(waFetch,waFetch);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow(false);});
