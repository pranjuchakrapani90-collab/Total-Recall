/* Build a structure step by step (5 Nov 2026).
   The SDE stands at one point and builds it in his head the way it happens on site: what is already standing,
   erect the new pole, dig and grout, cross arm, pins, channels, tension, jumpers, switchgear, DTR, stays, earthing, safety.
   At every step HE picks the items (SoR short-list for that step, or any SoR item); nothing is pre-filled.
   Each item goes into the estimate with the step as its reason. When he finishes, the app compares his build with
   the items it would have added itself (c.AUTO / c.AWHY from compute) and he adds or skips each difference.
   A built point's items replace the app's automatic kit for that point; spans (conductor, intermediate poles) stay automatic.
   Data lives on the point: x.build = {on, done, cur, have:[…], items:[{id,sor,q,step}], skip:[sor…]}.
   Loaded after the main Line Survey script and est-doc.js; uses P, compute, touch, renderAll, RATES, sorRate, KINDS, LINES, openSor. */
(function(){
"use strict";
const q$=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const rup=v=>"₹ "+(+v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const DTRK=new Set(["dtr","htc","dtrShift","dtrAug","dtrTemp"]);
const NOBUILD=new Set(["cont","mark","lm","rmPole"]);
const canBuild=x=>!!x&&!NOBUILD.has(x.kind)&&!(KINDS[x.kind]&&KINDS[x.kind].standalone);
const rate=k=>RATES[k]||sorRate(k);
const fq=(q,u)=>{q=+q||0;return /^km/i.test(u||"")?q.toFixed(3):String(Math.round(q*1000)/1000)};
const stepQ=u=>/^km/i.test(u||"")?0.01:/^(kg|mtr)/i.test(u||"")?1:1;

/* ---------- what is at this point (voltage, line types around it) ---------- */
function ctxOf(x,c){const e=(c.adj[x.id]||[]).map(a=>a.sg),work=e.filter(sg=>!sg.L.ex&&!sg.L.dis),hv=e.filter(sg=>sg.cls==="HV");
 const kv=hv.some(sg=>sg.kv===33)||x.kind==="src33"||x.kind==="iso33"?33:hv.length||DTRK.has(x.kind)?11:0.4;
 return{kv,dtr:DTRK.has(x.kind),mv:e.some(sg=>sg.L.mv),bare:e.some(sg=>sg.L.bare&&sg.cls==="HV"),abc:e.some(sg=>sg.L.abc),lt:e.some(sg=>sg.cls==="LT"),
  newLines:work.map(sg=>sg.L.t),allLines:e.map(sg=>sg.L.t+(sg.L.ex?" (existing)":""))}}

/* ---------- the site sequence ---------- */
const HAVE_HV=["Nothing — new spot","Single pole","Double pole (DP)","3-pole structure","T cross arm","V cross arm","Channel cross arms","Pin insulators","Disc insulators","Bare conductor","MVCC","GOAB","DO fuse set","LA","DTR","Stay","Earthing","Danger plate"];
const HAVE_LT=["Nothing — new spot","Single pole","LT double pole","LT cross arm","LT pin insulators","Shackles","Bare LT conductor","LT ABC","Distribution box","Stay","Earthing","Danger plate"];
function steps(ctx){const hv=ctx.kv>=11,k33=ctx.kv===33,S=[];
 S.push({id:"have",t:"What is already standing here?",ask:"Look at the spot first. Tick everything that is already there — nothing here is costed, it is just what you are building on.",have:true});
 if(hv){
  S.push({id:"pole",t:"Erect new pole(s)",ask:"Do you need a new pole here? Which one, and how many?",it:k33?["754","753","752","751","748"]:["748","747","746","751","752","753","754"]});
  S.push({id:"grout",t:"Dig and grout",ask:"The new pole has to stand: digging, grouting / muffling.",it:["427","426","425","422","423"]});
  S.push({id:"top",t:"Top of the pole: cross arm / channels",ask:"What goes on top — a T cross arm for the straight run, channels to tie a DP, a top cleat?",it:k33?["635","647","640","641","639","638","642","637","636"]:["634","647","638","639","640","641","642","637","636"]});
  S.push({id:"fix",t:"Fix it: clamps, nuts & bolts",ask:"Every cross arm and channel is held by pole clamps and bolts.",it:["830","646"]});
  S.push({id:"pin",t:"Pin insulators",ask:"Pins on the cross arm — for the straight run or to support the jumpers.",it:k33?["613","840"]:["626","841"]});
  S.push({id:"tens",t:"Tension: disc insulators & hardware",ask:"Does the line end, turn or get cut here? Then it is held in tension — disc insulators, hardware, tension clamps"+(ctx.mv?" (MVCC: tension insulator + tension hardware)":"")+".",
   it:(ctx.mv?(k33?["922","910"]:["926","914","928","916","925","913"]):[]).concat(k33?["607","844","611","836"]:["622","850","612","852","834","835","836"])});
  S.push({id:"jump",t:"Conductor work here: jumpers, terminations",ask:"Jumpers across the cut, PG clamps, MVCC termination kits and ties, connectors from bare to covered.",
   it:(ctx.mv?(k33?["869","898"]:["873","875","872","902","904","878","879"]):[]).concat(k33?["828","449"]:["826","827","828","446","447","448"])});
  S.push({id:"sw",t:"Switchgear",ask:"Any GOAB, DO fuse set or LA on this structure?",it:k33?["660","674"]:["518","519","513","514","676"]});
  if(ctx.dtr){
   S.push({id:"dtr",t:"Mount the transformer",ask:"Which DTR goes on the DP?",it:["770","771","772","774","778","780","782"]});
   S.push({id:"ltside",t:"LT side of the DTR",ask:"MCCB, LT cable from the DTR to the MCCB / DB, lugs.",it:["354","355","356","357","358","124","71","683","686","811","813"]})}
  if(ctx.lt)S.push({id:"ltw",t:"LT line on this pole",ask:"Is the LT line also carried here? Cross arm, pins, shackles, ABC clamps, boxes.",it:["645","630","842","632","853","800","806","810","807","802","811","813","805","809","808"]});
  S.push({id:"stay",t:"Stays",ask:"Where does the pull come from? Put a stay against each unbalanced pull.",it:k33?["653","616","651","428"]:["653","629","651","428"]});
  S.push({id:"earth",t:"Earthing",ask:"Earth pits and leads — pole, LA, DTR body and neutral.",it:["474","473","481","649","650","476"]});
  S.push({id:"safe",t:"Safety",ask:"Danger plate, anti-climbing barbed wire, guarding.",it:[k33?"720":"721","633","637","650","654"]});
  if(ctx.dtr)S.push({id:"civil",t:"Fencing / plinth",ask:"Fencing round the DTR, plinth if it sits on the ground.",it:["420","440"]});
 }else{
  S.push({id:"pole",t:"Erect new pole(s)",ask:"Do you need a new pole here? Which one, and how many?",it:["747","746","748"]});
  S.push({id:"grout",t:"Dig and grout",ask:"Digging and grouting of the new pole.",it:["426","425","427"]});
  S.push({id:"top",t:"Top of the pole",ask:"LT cross arm, MS channel for an LT DP, clamps.",it:["645","644","637"]});
  S.push({id:"fix",t:"Fix it: clamps, nuts & bolts",ask:"Pole clamps and bolts for what you put on top.",it:["830","646"]});
  if(ctx.abc)S.push({id:"abc",t:"ABC fittings",ask:"Suspension or anchor clamp, eye hook, end caps, IPC to join the existing line, cable ties.",it:["800","806","810","807","802","819","801"]});
  else S.push({id:"ins",t:"Insulators",ask:"Pins for the straight run, shackles where the line ends or turns.",it:["630","842","632","853","718"]});
  S.push({id:"db",t:"Distribution box & services",ask:"Boxes on this pole and what goes with them.",it:["811","813","805","809","808","802"]});
  S.push({id:"stay",t:"Stays",ask:"Stay against each unbalanced pull.",it:["657","631","652","428"]});
  S.push({id:"earth",t:"Earthing",ask:"Earth pit and leads.",it:["474","649","650"]});
  S.push({id:"safe",t:"Safety",ask:"Danger plate, anti-climbing.",it:["722","633"]});
 }
 S.push({id:"check",t:"Check with the app",ask:"",check:true});
 return S}

/* ---------- state ---------- */
let XID=null;
const ptOf=()=>XID&&P().pts.find(q=>q.id===XID);
function bOf(x){if(!x.build)x.build={on:true,done:false,cur:0,have:[],items:[],skip:[]};const b=x.build;b.items=b.items||[];b.have=b.have||[];b.skip=b.skip||[];return b}
function save(){const p=P();touch(p);renderAll()}
function totOf(b){return b.items.reduce((s,it)=>{const r=rate(it.sor);return s+(r?r[2]*(+it.q||0):0)},0)}

/* ---------- dialog ---------- */
function ensureDlg(){if(q$("#bldDlg"))return;
 const st=document.createElement("style");st.textContent=`
#bldDlg{width:min(720px,100vw);max-width:100vw;max-height:100dvh;padding:0;border:0;border-radius:16px}
#bldDlg::backdrop{background:#0006}
.bd{display:flex;flex-direction:column;max-height:94dvh}
.bd .bh{padding:12px 16px 8px;border-bottom:1px solid var(--line)}
.bd .bh h3{margin:0;font-size:17px}.bd .bh .sub{font-size:12.5px;color:var(--muted);margin-top:2px}
.bd .prog{display:flex;gap:4px;overflow-x:auto;padding:8px 0 2px;scrollbar-width:none}
.bd .prog button{flex:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 9px;font:600 12px system-ui;color:var(--muted);cursor:pointer;white-space:nowrap}
.bd .prog button.done{background:var(--steel-soft);color:#115e59;border-color:#99d5cc}.bd .prog button.cur{background:var(--steel);color:#fff;border-color:var(--steel)}
.bd .bb{padding:12px 16px;overflow:auto;flex:1}
.bd .ask{font-size:15px;margin:0 0 10px;line-height:1.4}
.bd .lbl{font:700 12px system-ui;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:12px 0 6px}
.bd .chips{display:flex;flex-wrap:wrap;gap:6px}
.bd .chips button{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:7px 12px;font:600 13.5px system-ui;cursor:pointer}
.bd .chips button[aria-pressed=true]{background:var(--steel-soft);border-color:var(--steel);color:#115e59}
.bd .opt{display:grid;grid-template-columns:42px 1fr auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:6px;background:#fff;cursor:pointer;text-align:left;width:100%;font:inherit}
.bd .opt b{font:700 12.5px var(--mono);color:#115e59}.bd .opt span{font-size:13.5px}.bd .opt i{font-style:normal;font-size:12px;color:var(--muted);white-space:nowrap}
.bd .opt:hover{border-color:var(--steel)}
.bd .row{display:grid;grid-template-columns:42px 1fr auto auto;gap:8px;align-items:center;background:var(--steel-soft);border-radius:10px;padding:8px 10px;margin-bottom:6px}
.bd .row b{font:700 12.5px var(--mono);color:#115e59}.bd .row .d{font-size:13.5px}.bd .row .d small{display:block;color:var(--muted);font-size:12px}
.bd .qty{display:flex;align-items:center;gap:4px}.bd .qty button{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:#fff;font:700 16px system-ui;cursor:pointer}
.bd .qty input{width:62px;padding:5px;border:1px solid #d1d5db;border-radius:8px;text-align:center;font:600 14px system-ui}
.bd .x{border:0;background:none;color:var(--bad);font-size:18px;cursor:pointer;padding:4px}
.bd .know{background:var(--brass-soft);color:#7c2d12;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:10px}
.bd .bf{display:flex;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid var(--line);flex-wrap:wrap}
.bd .bf .tot{flex:1;font-size:13px;color:var(--muted)}.bd .bf .tot b{color:var(--ink);font-size:15px}
.bd .ck{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:6px;display:grid;grid-template-columns:42px 1fr auto;gap:8px;align-items:center}
.bd .ck b{font:700 12.5px var(--mono)}.bd .ck .d{font-size:13.5px}.bd .ck .d small{display:block;color:var(--muted);font-size:12px}
.bd .ck .acts{display:flex;gap:6px}.bd .ck .acts button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:600 12.5px system-ui;cursor:pointer}
.bd .ck .acts button.y{background:var(--steel);color:#fff;border-color:var(--steel)}
.bd .ok{background:var(--steel-soft);color:#115e59;border-radius:10px;padding:10px;font-size:14px}
.bstrip{background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin:0 0 10px;font-size:13px}
.bstrip b{font-size:13.5px}.bstrip .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.bstrip button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 10px;font:600 12.5px system-ui;cursor:pointer}
.bstrip button.on{background:var(--steel-soft);border-color:var(--steel);color:#115e59}.bstrip button.half{background:var(--brass-soft);border-color:#f2c48a;color:var(--brass)}
`;document.head.appendChild(st);
 const d=document.createElement("dialog");d.id="bldDlg";d.innerHTML=`<div class="bd"><div class="bh"><h3 id="bT"></h3><div class="sub" id="bSub"></div><div class="prog" id="bProg"></div></div><div class="bb" id="bBody"></div>
 <div class="bf"><span class="tot" id="bTot"></span><button class="btn alt" id="bBack" type="button">‹ Back</button><button class="btn" id="bNext" type="button">Next ›</button></div></div>`;
 document.body.appendChild(d);
 d.addEventListener("click",onClick);d.addEventListener("change",onChange);
 d.addEventListener("cancel",e=>{e.preventDefault();d.close()});
 q$("#bBack").onclick=()=>{const x=ptOf();if(!x)return;const b=bOf(x);if(b.cur>0){b.cur--;save();draw()}else d.close()};
 q$("#bNext").onclick=()=>{const x=ptOf();if(!x)return;const b=bOf(x),S=steps(ctxOf(x,compute(P())));
  if(b.cur>=S.length-1){b.done=true;b.on=true;save();d.close();return}b.cur++;save();draw()}}

window.openBuild=function(id){const x=P().pts.find(q=>q.id===id);if(!canBuild(x))return;ensureDlg();XID=id;
 if(!x.build)bOf(x),save();else{x.build.on=true;save()}draw();q$("#bldDlg").showModal()};

function draw(){const x=ptOf();if(!x)return;const c=compute(P()),ctx=ctxOf(x,c),S=steps(ctx),b=bOf(x);if(b.cur>=S.length)b.cur=S.length-1;const st=S[b.cur],K=KINDS[x.kind]||{};
 const lab=c.lab&&c.lab[x.id]?c.lab[x.id]+" · ":"";
 q$("#bT").textContent="Build "+lab+"P"+x.no+" — "+(K.t||x.kind);
 q$("#bSub").textContent=(ctx.kv===0.4?"LT":ctx.kv+" kV")+(ctx.allLines.length?" · lines here: "+[...new Set(ctx.allLines)].join(", "):"")+(x.note?" · "+x.note:"");
 q$("#bProg").innerHTML=S.map((s,i)=>{const n=b.items.filter(it=>it.step===s.id).length;return`<button type="button" data-go="${i}" class="${i===b.cur?"cur":i<b.cur||n?"done":""}">${i+1}. ${esc(s.t.split(":")[0])}${n?" ("+n+")":""}</button>`}).join("");
 setTimeout(()=>{const cb=q$("#bProg .cur");if(cb)cb.scrollIntoView({inline:"center",block:"nearest"})},0);
 q$("#bBody").innerHTML=st.check?checkHTML(x,c,b):st.have?haveHTML(st,b,ctx):stepHTML(st,b);
 q$("#bTot").innerHTML="This structure so far: <b>"+rup(totOf(b))+"</b> · "+b.items.length+" item"+(b.items.length===1?"":"s");
 q$("#bBack").textContent=b.cur?"‹ Back":"Close";
 q$("#bNext").textContent=st.check?"✓ Finish":b.items.some(it=>it.step===st.id)||st.have?"Next ›":"Nothing here, next ›"}

function haveHTML(st,b,ctx){const L=ctx.kv>=11?HAVE_HV:HAVE_LT;
 return`<p class="ask">${esc(st.ask)}</p><div class="chips">${L.map(h=>`<button type="button" data-have="${esc(h)}" aria-pressed="${b.have.includes(h)}">${esc(h)}</button>`).join("")}</div>
 <p class="hint" style="margin-top:12px">Later steps show what you ticked here, so you can decide what is still needed (another T cross arm? more pins?).</p>`}

function rowHTML(it){const r=rate(it.sor)||["(no rate)","",0];return`<div class="row"><b>${esc(it.sor)}</b><span class="d">${esc(r[0])}<small>${esc(r[1])} × ${rup(r[2])} = ${rup(r[2]*(+it.q||0))}</small></span>
 <span class="qty"><button type="button" data-dq="-1" data-id="${it.id}">−</button><input data-q="${it.id}" value="${fq(it.q,r[1])}" inputmode="decimal"><button type="button" data-dq="1" data-id="${it.id}">+</button></span><button type="button" class="x" data-del="${it.id}" title="Remove">✕</button></div>`}

function stepHTML(st,b){const mine=b.items.filter(it=>it.step===st.id),used=new Set(mine.map(it=>it.sor));
 const know=b.have.length&&!b.have.includes("Nothing — new spot")?`<div class="know"><b>Already standing:</b> ${b.have.map(esc).join(", ")}</div>`:"";
 const opts=st.it.filter(k=>!used.has(k)&&rate(k)).map(k=>{const r=rate(k);return`<button type="button" class="opt" data-add="${k}"><b>${k}</b><span>${esc(r[0])}</span><i>${esc(r[1])} · ${rup(r[2])}</i></button>`}).join("");
 return`${know}<p class="ask">${esc(st.ask)}</p>${mine.length?`<div class="lbl">You are putting here</div>${mine.map(rowHTML).join("")}`:""}
 <div class="lbl">${mine.length?"Anything else?":"Pick what goes in"}</div>${opts}
 <button type="button" class="opt" data-other="1" style="border-style:dashed"><b>＋</b><span>Other SoR item…</span><i>search SoR 2021-22</i></button>`}

/* ---------- end-of-build check against the app's own kit ---------- */
function diffOf(x,c,b){const A=(c.AUTO||{})[x.id]||{},W=(c.AWHY||{})[x.id]||{},mine={};b.items.forEach(it=>mine[it.sor]=(mine[it.sor]||0)+(+it.q||0));
 const miss=[],less=[],extra=[];
 Object.keys(A).forEach(k=>{const r=rate(k);if(!r)return;const u=r[1],aq=/^km/i.test(u)?Math.round(A[k]*1000)/1000:Math.ceil(A[k]-1e-9),mq=mine[k]||0,why=(W[k]||[]).join("; ");
  if(!mq){if(!b.skip.includes(k))miss.push({k,aq,why})}else if(Math.abs(mq-aq)>1e-6&&!b.skip.includes("q"+k))less.push({k,aq,mq,why})});
 Object.keys(mine).forEach(k=>{if(!(k in A))extra.push({k,mq:mine[k]})});return{miss,less,extra}}
function checkHTML(x,c,b){const{miss,less,extra}=diffOf(x,c,b);
 const ck=(o,acts,sub)=>{const r=rate(o.k);return`<div class="ck"><b>${o.k}</b><span class="d">${esc(r[0])}<small>${sub}</small></span><span class="acts">${acts}</span></div>`};
 let h=`<p class="ask">Your build is in the estimate. Here is where it differs from what the app would have put at this point — you decide each one.</p>`;
 if(!miss.length&&!less.length)h+=`<div class="ok">✓ Nothing missing. Your build has everything the app would have added${extra.length?", plus your own items below":""}.</div>`;
 if(miss.length)h+=`<div class="lbl">The app would also add</div>`+miss.map(o=>ck(o,`<button type="button" class="y" data-take="${o.k}" data-n="${o.aq}">＋ Add ${fq(o.aq,rate(o.k)[1])}</button><button type="button" data-skip="${o.k}">Not needed</button>`,esc(o.why||"")+" · app: "+fq(o.aq,rate(o.k)[1])+" "+esc(rate(o.k)[1]))).join("");
 if(less.length)h+=`<div class="lbl">Different quantity</div>`+less.map(o=>ck(o,`<button type="button" data-setq="${o.k}" data-n="${o.aq}">Use app's ${fq(o.aq,rate(o.k)[1])}</button><button type="button" data-skip="q${o.k}">Keep mine</button>`,"yours "+fq(o.mq,rate(o.k)[1])+" · app "+fq(o.aq,rate(o.k)[1])+(o.why?" — "+esc(o.why):""))).join("");
 if(extra.length)h+=`<div class="lbl">Only in your build</div>`+extra.map(o=>ck(o,"",fq(o.mq,rate(o.k)[1])+" "+esc(rate(o.k)[1])+" — your decision; the app doesn't add this here")).join("");
 h+=`<p class="hint" style="margin-top:14px">The span's conductor and its intermediate poles stay with the line, not this point.</p>
 <button type="button" class="btn alt" data-drop="1" style="margin-top:8px">Throw away my build — use the app's items for P${x.no}</button>`;
 return h}

/* ---------- events ---------- */
function stepOfSor(S,k){const s=S.find(s=>s.it&&s.it.includes(k));return s?s.id:"check"}
function onClick(e){const t=e.target.closest("button");if(!t)return;const x=ptOf();if(!x)return;const b=bOf(x),c=compute(P()),S=steps(ctxOf(x,c)),st=S[b.cur];
 if(t.dataset.go!=null){b.cur=+t.dataset.go;save();draw();return}
 if(t.dataset.have){const h=t.dataset.have,i=b.have.indexOf(h);if(i>=0)b.have.splice(i,1);else{if(h==="Nothing — new spot")b.have=[];else b.have=b.have.filter(v=>v!=="Nothing — new spot");b.have.push(h)}save();draw();return}
 if(t.dataset.add){const k=t.dataset.add;b.items.push({id:nid(),sor:k,q:/^km/i.test(rate(k)[1])?0.01:1,step:st.id});save();draw();return}
 if(t.dataset.other){window.openSor(k=>{if(!rate(k)){alert("SoR "+k+" has no rate.");return}b.items.push({id:nid(),sor:k,q:/^km/i.test(rate(k)[1])?0.01:1,step:st.check?stepOfSor(S,k):st.id});save();draw()},"Add to "+st.t);const al=q$("#sorAll");if(al){al.checked=true;al.dispatchEvent(new Event("change"))}return}
 if(t.dataset.dq){const it=b.items.find(i=>i.id===t.dataset.id);if(!it)return;const u=rate(it.sor)[1],dq=stepQ(u)*+t.dataset.dq;it.q=Math.max(0,Math.round(((+it.q||0)+dq)*1000)/1000);if(!it.q)b.items=b.items.filter(i=>i!==it);save();draw();return}
 if(t.dataset.del){b.items=b.items.filter(i=>i.id!==t.dataset.del);save();draw();return}
 if(t.dataset.take){const k=t.dataset.take;b.items.push({id:nid(),sor:k,q:+t.dataset.n,step:stepOfSor(S,k)});save();draw();return}
 if(t.dataset.setq){const k=t.dataset.setq,its=b.items.filter(i=>i.sor===k);its.forEach((it,i)=>it.q=i?0:+t.dataset.n);b.items=b.items.filter(i=>i.sor!==k||+i.q>0);save();draw();return}
 if(t.dataset.skip){if(!b.skip.includes(t.dataset.skip))b.skip.push(t.dataset.skip);save();draw();return}
 if(t.dataset.drop){if(!confirm("Throw away everything you built for P"+x.no+"? The app's own items for this point come back into the estimate."))return;delete x.build;save();q$("#bldDlg").close();return}}
function onChange(e){const t=e.target;if(!t.dataset.q)return;const x=ptOf();if(!x)return;const b=bOf(x),it=b.items.find(i=>i.id===t.dataset.q);if(!it)return;
 const v=parseFloat(t.value);it.q=v>0?v:0;if(!it.q)b.items=b.items.filter(i=>i!==it);save();draw()}

/* ---------- ways in: point dialog button, and a strip on the Estimate tab ---------- */
function ptBtn(){const dr=q$("#ptDlg .drow");if(!dr||q$("#dBuild"))return;const bt=document.createElement("button");bt.type="button";bt.className="btn alt";bt.id="dBuild";
 dr.insertBefore(bt,dr.children[1]);bt.onclick=()=>{const id=window.__bldId;if(!id)return;q$("#dSave").click();setTimeout(()=>window.openBuild(id),30)}}
const _op=window.openPoint;
if(typeof _op==="function"){window.openPoint=function(x,pos,restored){_op(x,pos,restored);ptBtn();const bt=q$("#dBuild");window.__bldId=x&&x.id;
 if(!bt)return;bt.hidden=!x||!canBuild(x);if(x&&x.build){const n=(x.build.items||[]).length;bt.textContent=x.build.done?"🔨 Built ("+n+") — open":"🔨 Continue building ("+n+")"}else bt.textContent="🔨 Build step by step"};
 try{openPoint=window.openPoint}catch(_){}}
function strip(c){const box=q$("#estWarn");if(!box)return;const p=P(),pts=p.pts.filter(canBuild);if(!pts.length)return;
 const half=pts.filter(x=>x.build&&x.build.on&&!x.build.done);
 const d=document.createElement("div");d.className="bstrip";d.innerHTML=`<b>🔨 Build a structure step by step</b> <span class="hint">— tap a point, build it the way it happens on site; your items replace the app's for that point.</span>
 <div class="chips">${pts.map(x=>`<button type="button" data-b="${x.id}" class="${x.build&&x.build.on?(x.build.done?"on":"half"):""}">${esc((c.lab&&c.lab[x.id])||"P"+x.no)} · P${x.no}${x.build&&x.build.on?(x.build.done?" ✓":" …"):""}</button>`).join("")}</div>`;
 d.addEventListener("click",e=>{const b=e.target.closest("button[data-b]");if(b)window.openBuild(b.dataset.b)});
 box.prepend(d);
 if(half.length){const w=document.createElement("div");w.className="warns";w.innerHTML=`<b>Not finished</b><ul><li>${half.map(x=>"P"+x.no).join(", ")}: building started but not finished — only what you have built so far is in the estimate. Open it and go to the last step.</li></ul>`;box.prepend(w)}}
const _re=window.renderEst;
if(typeof _re==="function"){window.renderEst=function(c){_re(c);try{strip(c)}catch(e){console.error(e)}};try{renderEst=window.renderEst}catch(_){}}
})();
