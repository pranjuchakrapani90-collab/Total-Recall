/* Guitar Studio · the 30-minute cycle: 10 min Melodic Lead → 10 min Lead Course → 10 min Fingerstyle Solo.
   A cycle is not a day: it stays open across days until all three sections have had their 10 minutes,
   so a day with only one section done picks up with the next section tomorrow.
   The cycle is worked out by replaying each section's own minute counters day by day (each section already
   merges minutes synced from your other devices into those counters), so every device agrees on it.
   Time beyond a section's 10 minutes carries into the next cycle, up to one block (10 min) per section. */
(function(){
"use strict";
const PLAN=[
  {k:"ml",n:"Melodic Lead",ico:"🎸",href:"guitar.html",min:10,col:"#4f46e5"},
  {k:"lc",n:"Lead Course",ico:"⚡",href:"lead.html",min:10,col:"#0f766e"},
  {k:"fs",n:"Fingerstyle Solo",ico:"🎶",href:"fingerstyle.html",min:10,col:"#7c3aed"}];
const START="2026-10-17"; // cycles count from the day the 10 + 10 + 10 plan started
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const pad=n=>String(n).padStart(2,"0"),dkey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const counter=o=>k=>o?((o.days&&o.days[k])||0)+Object.values(o.odays||{}).reduce((a,d)=>a+((d&&d[k])||0),0):0;
function secs(sec,k){
  if(sec==="ml"){const m=get("mss-sessions")||{};return Object.values(m.ds||{}).reduce((a,x)=>a+((x&&x.days&&x.days[k])||0),0);}
  if(sec==="fs")return counter(get("fs-v1"))(k);
  const lp=get("leadpath-v1");if(lp)return counter(lp)(k);
  return counter(get("caged-v1"))(k)+counter(get("lead-v1"))(k);}
/* today's minutes per section (for the daily 30-minute goal) */
function today(extra){const k=dkey(new Date());return PLAN.map(p=>({...p,sec:secs(p.k,k)+((extra&&extra[p.k])||0)}));}
/* the open cycle: replay every day since START; a cycle closes once each section has 10 minutes in it */
function cycle(extra){
  const tk=dkey(new Date()),bank={ml:0,lc:0,fs:0};let n=0,closed=null;
  const [y,m,d]=START.split("-").map(Number),day=new Date(y,m-1,d);
  for(let guard=0;guard<4000;guard++){const k=dkey(day);
    PLAN.forEach(p=>{bank[p.k]+=secs(p.k,k)+((k===tk&&extra&&extra[p.k])||0);});
    while(PLAN.every(p=>bank[p.k]>=p.min*60)){n++;closed=k;PLAN.forEach(p=>{bank[p.k]=Math.min(p.min*60,bank[p.k]-p.min*60);});}
    if(k>=tk)break;day.setDate(day.getDate()+1);}
  /* sections you skip in this cycle move to the end of its order */
  let skip=[];try{skip=JSON.parse(localStorage.getItem("gsp-skip")||"null")||[];}catch(e){}
  skip=(skip&&skip.cycle===n&&Array.isArray(skip.keys))?skip.keys:[];
  const rows=PLAN.map(p=>({...p,sec:bank[p.k]}));
  rows.sort((a,b)=>(skip.indexOf(a.k)+1||0)-(skip.indexOf(b.k)+1||0)||PLAN.indexOf(PLAN.find(p=>p.k===a.k))-PLAN.indexOf(PLAN.find(p=>p.k===b.k)));
  return {n:n+1,done:n,closedOn:closed,rows};}
/* the section to play next: the first one, in cycle order, that hasn't had its 10 minutes */
function next(rows){return rows.find(r=>r.sec<r.min*60)||null;}
/* push the section to the end of this cycle's order (it still has to be played before the cycle closes) */
function skip(k){const c=cycle();let s=null;try{s=JSON.parse(localStorage.getItem("gsp-skip")||"null");}catch(e){}
  const keys=(s&&s.cycle===c.done&&Array.isArray(s.keys))?s.keys.filter(x=>x!==k):[];keys.push(k);
  try{localStorage.setItem("gsp-skip",JSON.stringify({cycle:c.done,keys}));}catch(e){}}
const mm=s=>{s=Math.floor(s);return Math.floor(s/60)+":"+pad(s%60);};
function barHTML(rows,here){return `<div class="gsp-bar">${rows.map(r=>{const f=Math.min(1,r.sec/(r.min*60));
  return `<a class="gsp-seg${r.k===here?" here":""}${f>=1?" done":""}" href="${r.href}" style="--c:${r.col}" title="${r.n}: ${mm(r.sec)} of ${r.min}:00"><i style="width:${f*100}%"></i><span>${f>=1?"✓ ":""}${r.ico} ${r.n}</span><b>${Math.min(r.min,Math.floor(r.sec/60))}/${r.min}</b></a>`;}).join("")}</div>`;}
const CSS=`.gsp-bar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
a.gsp-seg,.gsp-nudge a.gsp-seg{position:relative;overflow:hidden;display:flex!important;flex-direction:column;gap:2px;padding:8px 10px!important;border-radius:10px;background:#f1f5f9!important;color:#172033!important;text-decoration:none;font:600 12px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif!important;border:2px solid transparent;box-shadow:none!important;min-width:0}
.gsp-seg i{position:absolute;left:0;top:0;bottom:0;background:var(--c);opacity:.16}
.gsp-seg.done i{opacity:.24}a.gsp-seg.here{border-color:var(--c)}
.gsp-seg span,.gsp-seg b{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gsp-seg b{font:700 15px ui-monospace,Menlo,Consolas,monospace!important;color:var(--c)!important}
.gsp-nudge{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));z-index:60;width:min(560px,calc(100% - 24px));background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 10px 30px #0f172a33;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033}
.gsp-nudge .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.gsp-nudge a,.gsp-nudge button{font:650 14px system-ui,sans-serif;border:0;border-radius:10px;padding:9px 14px;cursor:pointer;text-decoration:none}
.gsp-nudge .row a{background:var(--c);color:#fff}.gsp-nudge button{background:#f1f5f9;color:#475569}`;
let styled=false;function style(){if(styled)return;styled=true;const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);}

/* inside a section: once its 10 minutes of the cycle are in, suggest the next section (once per cycle, player keeps running) */
function watch(here,liveExtra){style();
  setInterval(()=>{const c=cycle(liveExtra?{[here]:liveExtra()||0}:null),key="gsp-nudged-"+here+"-c"+c.n;let shown;
    try{shown=localStorage.getItem(key);}catch(e){shown="1";}if(shown)return;
    /* the cycle closed while playing here: celebrate once, the new cycle is already open */
    const prevKey="gsp-celebrated-c"+c.done;let cel=null;try{cel=localStorage.getItem(prevKey);}catch(e){cel="1";}
    const me=c.rows.find(r=>r.k===here);
    if(c.done&&c.closedOn===dkey(new Date())&&!cel){try{localStorage.setItem(prevKey,"1");}catch(e){}
      show(`<div><b>🎉 Cycle ${c.done} complete.</b> All three sections have had their 10 minutes. Cycle ${c.n} starts now.</div>${barHTML(c.rows,here)}<div class="row"><button type="button">Close</button></div>`,"#059669");return;}
    if(me.sec<me.min*60)return;
    try{localStorage.setItem(key,"1");}catch(e){}
    const nx=next(c.rows);if(!nx)return;
    show(`<div><b>✓ ${me.min} minutes of ${me.n} done.</b> Next in cycle ${c.n}: ${nx.ico} <b>${nx.n}</b>.</div>${barHTML(c.rows,here)}<div class="row"><button type="button">Keep going here</button><a href="${nx.href}">Go to ${nx.n} ▸</a></div>`,nx.col);},5000);}
function show(html,col){const el=document.createElement("div");el.className="gsp-nudge";el.setAttribute("role","status");el.style.setProperty("--c",col);el.innerHTML=html;
  el.querySelector("button").onclick=()=>el.remove();document.body.appendChild(el);}
window.GSPlan={PLAN,today,cycle,next,skip,barHTML,watch,style,mm};
})();
