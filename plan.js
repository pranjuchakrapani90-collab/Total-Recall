/* Guitar Studio · the 45-minute cycle: 15 min Melodic Lead → 15 min Fingerstyle Solo → 15 min Soloing Course.
   (The Soloing Course joined on 20 Oct 2026; days before that count Melodic Lead and Fingerstyle only.)
   (Lead Course is on hold since 18 Oct 2026: to bring it back, uncomment its line in PLAN and set its minutes.)
   A cycle is not a day: it stays open across days until every section has had its minutes,
   so a day with only one section done picks up with the next section tomorrow.
   The cycle is worked out by replaying each section's own minute counters day by day (each section already
   merges minutes synced from your other devices into those counters), so every device agrees on it.
   Time beyond a section's minutes carries into the next cycle, up to one block per section. */
(function(){
"use strict";
const PLAN=[
  {k:"ml",n:"Melodic Lead",ico:"🎸",href:"guitar.html",min:15,col:"#4f46e5"},
  // {k:"lc",n:"Lead Course",ico:"⚡",href:"lead.html",min:10,col:"#0f766e"}, // on hold
  {k:"fs",n:"Fingerstyle Solo",ico:"🎶",href:"fingerstyle.html",min:15,col:"#7c3aed"},
  {k:"sc",n:"Soloing Course",ico:"✍️",href:"solo.html",min:15,col:"#c2410c",from:"2026-10-20"}];
const act=k=>PLAN.filter(p=>!p.from||k>=p.from); // the sections in the plan on day k
const START="2026-10-18"; // cycles count from the day the 15 + 15 plan started
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const pad=n=>String(n).padStart(2,"0"),dkey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const counter=o=>k=>o?((o.days&&o.days[k])||0)+Object.values(o.odays||{}).reduce((a,d)=>a+((d&&d[k])||0),0):0;
function secs(sec,k){
  if(sec==="ml"){const m=get("mss-sessions")||{};return Object.values(m.ds||{}).reduce((a,x)=>a+((x&&x.days&&x.days[k])||0),0);}
  if(sec==="fs")return counter(get("fs-v1"))(k);
  if(sec==="sc")return counter(get("solo-v1"))(k);
  const lp=get("leadpath-v1");if(lp)return counter(lp)(k);
  return counter(get("caged-v1"))(k)+counter(get("lead-v1"))(k);}
/* today's minutes per section (for the daily 30-minute goal) */
function today(extra){const k=dkey(new Date());return PLAN.map(p=>({...p,sec:secs(p.k,k)+((extra&&extra[p.k])||0)}));}
/* the open cycle: replay every day since START; a cycle closes once each section has 10 minutes in it */
function cycle(extra){
  const tk=dkey(new Date()),bank={};PLAN.forEach(p=>{bank[p.k]=0;});let n=0,closed=null;
  const [y,m,d]=START.split("-").map(Number),day=new Date(y,m-1,d);
  for(let guard=0;guard<4000;guard++){const k=dkey(day);
    const A=act(k);A.forEach(p=>{bank[p.k]+=secs(p.k,k)+((k===tk&&extra&&extra[p.k])||0);});
    while(A.every(p=>bank[p.k]>=p.min*60)){n++;closed=k;A.forEach(p=>{bank[p.k]=Math.min(p.min*60,bank[p.k]-p.min*60);});}
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
const CSS=`.gsp-bar{display:grid;grid-template-columns:repeat(${PLAN.length},minmax(0,1fr));gap:6px}
a.gsp-seg,.gsp-nudge a.gsp-seg{position:relative;overflow:hidden;display:flex!important;flex-direction:column;gap:2px;padding:8px 10px!important;border-radius:10px;background:#f1f5f9!important;color:#172033!important;text-decoration:none;font:600 12px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif!important;border:2px solid transparent;box-shadow:none!important;min-width:0}
.gsp-seg i{position:absolute;left:0;top:0;bottom:0;background:var(--c);opacity:.16}
.gsp-seg.done i{opacity:.24}a.gsp-seg.here{border-color:var(--c)}
.gsp-seg span,.gsp-seg b{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gsp-seg b{font:700 15px ui-monospace,Menlo,Consolas,monospace!important;color:var(--c)!important}
.gsp-nudge{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));z-index:60;width:min(560px,calc(100% - 24px));background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 10px 30px #0f172a33;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033}
.gsp-nudge .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.gsp-nudge a,.gsp-nudge button{font:650 14px system-ui,sans-serif;border:0;border-radius:10px;padding:9px 14px;cursor:pointer;text-decoration:none}
.gsp-nudge .row a{background:var(--c);color:#fff}.gsp-nudge button{background:#f1f5f9;color:#475569}
.gsp-here{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;border-radius:12px;background:#ffffff26;color:inherit;font:13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif}
.gsp-here span{white-space:nowrap}.gsp-here i{flex:1;height:8px;border-radius:5px;background:#ffffff40;overflow:hidden;min-width:40px}
.gsp-here s{display:block;height:100%;background:#fff;text-decoration:none}.gsp-here b.t{font:700 14px ui-monospace,Menlo,Consolas,monospace;white-space:nowrap}`;
let styled=false;function style(){if(styled)return;styled=true;const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);}

/* inside a section: a live "this section in this cycle" timer under the page's stats, and when the section's
   10 minutes are in, the player stops and a card offers to keep going here or move to the next section (once per cycle).
   o = {live: unsaved seconds being played right now, playing: is the player running, stop: stop the player} */
function watch(here,o){style();o=o||{};const live=()=>{try{return Math.max(0,Math.min(90,o.live?o.live():0));}catch(e){return 0;}};
  const P=PLAN.find(p=>p.k===here);if(!P)return; // a section on hold has no cycle timer
  function chip(c){let el=document.getElementById("gspHere");
    if(!el){const a=document.getElementById("hTodayS"),host=a&&a.parentElement;if(!host)return;
      el=document.createElement("div");el.id="gspHere";el.className="gsp-here";host.insertAdjacentElement("afterend",el);}
    const me=c.rows.find(r=>r.k===here),f=Math.min(1,me.sec/(me.min*60));
    el.style.setProperty("--c",P.col);
    el.innerHTML=`<span>${P.ico} <b>${P.n}</b> this cycle</span><i><s style="width:${f*100}%"></s></i><b class="t">${mm(Math.min(me.sec,me.min*60))} / ${me.min}:00</b>`;}
  function tick(){const c=cycle({[here]:live()});chip(c);
    const key="gsp-nudged-"+here+"-c"+c.n;let shown;try{shown=localStorage.getItem(key);}catch(e){shown="1";}
    /* the cycle closed while playing here: celebrate once, the new cycle is already open */
    const prevKey="gsp-celebrated-c"+c.done;let cel=null;try{cel=localStorage.getItem(prevKey);}catch(e){cel="1";}
    if(c.done&&c.closedOn===dkey(new Date())&&!cel){try{localStorage.setItem(prevKey,"1");}catch(e){}
      const was=o.playing&&o.playing();if(was&&o.stop)o.stop();
      show(`<div><b>🎉 Cycle ${c.done} complete.</b> Every section has had its minutes${was?", so the player has stopped":""}. Cycle ${c.n} starts now.</div>${barHTML(c.rows,here)}<div class="row"><button type="button">Keep going here</button></div>`,"#059669");return;}
    if(shown)return;
    const me=c.rows.find(r=>r.k===here);if(me.sec<me.min*60)return;
    try{localStorage.setItem(key,"1");}catch(e){}
    const nx=next(c.rows);if(!nx)return;
    const was=o.playing&&o.playing();if(was&&o.stop)o.stop();
    show(`<div><b>✓ ${me.min} minutes of ${me.n} done${was?". The player has stopped":""}.</b> Next in cycle ${c.n}: ${nx.ico} <b>${nx.n}</b>.</div>${barHTML(c.rows,here)}<div class="row"><button type="button">Keep going here</button><a href="${nx.href}">Go to ${nx.n} ▸</a></div>`,nx.col);}
  tick();setInterval(tick,1000);}
function show(html,col){const el=document.createElement("div");el.className="gsp-nudge";el.setAttribute("role","status");el.style.setProperty("--c",col);el.innerHTML=html;
  el.querySelector("button").onclick=()=>el.remove();document.body.appendChild(el);}
window.GSPlan={LABEL:PLAN.map(p=>p.min).join(" + "),PLAN,today,cycle,next,skip,barHTML,watch,style,mm};
})();
