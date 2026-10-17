/* Guitar Studio · today's 30-minute plan: 10 min Melodic Lead → 10 min Lead Course → 10 min Fingerstyle Solo.
   Shared by the hub and the three sections. Reads each section's own minute counters from this device's storage
   (each section already merges minutes synced from your other devices into those counters). */
(function(){
"use strict";
const PLAN=[
  {k:"ml",n:"Melodic Lead",ico:"🎸",href:"guitar.html",min:10,col:"#4f46e5"},
  {k:"lc",n:"Lead Course",ico:"⚡",href:"lead.html",min:10,col:"#0f766e"},
  {k:"fs",n:"Fingerstyle Solo",ico:"🎶",href:"fingerstyle.html",min:10,col:"#7c3aed"}];
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const pad=n=>String(n).padStart(2,"0"),dkey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const counter=o=>k=>o?((o.days&&o.days[k])||0)+Object.values(o.odays||{}).reduce((a,d)=>a+((d&&d[k])||0),0):0;
function secs(sec,k){
  if(sec==="ml"){const m=get("mss-sessions")||{};return Object.values(m.ds||{}).reduce((a,x)=>a+((x&&x.days&&x.days[k])||0),0);}
  if(sec==="fs")return counter(get("fs-v1"))(k);
  const lp=get("leadpath-v1");if(lp)return counter(lp)(k);
  return counter(get("caged-v1"))(k)+counter(get("lead-v1"))(k);}
function today(extra){const k=dkey(new Date());return PLAN.map(p=>({...p,sec:secs(p.k,k)+((extra&&extra[p.k])||0)}));}
/* the section to play next: the first one, in plan order, that hasn't had its 10 minutes */
function next(rows){return rows.find(r=>r.sec<r.min*60)||null;}
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

/* inside a section: once its 10 minutes are in, suggest the next section (once a day, player keeps running) */
function watch(here,liveExtra){style();const k0=()=>"gsp-nudged-"+here+"-"+dkey(new Date());
  setInterval(()=>{let shown;try{shown=localStorage.getItem(k0());}catch(e){shown="1";}if(shown)return;
    const rows=today(liveExtra?{[here]:liveExtra()||0}:null),me=rows.find(r=>r.k===here);if(me.sec<me.min*60)return;
    try{localStorage.setItem(k0(),"1");}catch(e){}
    const nx=next(rows),el=document.createElement("div");el.className="gsp-nudge";el.setAttribute("role","status");el.style.setProperty("--c",nx?nx.col:"#059669");
    el.innerHTML=nx?`<div><b>✓ ${me.min} minutes of ${me.n} done.</b> Next on today's plan: ${nx.ico} <b>${nx.n}</b>.</div>${barHTML(rows,here)}<div class="row"><button type="button">Keep going here</button><a href="${nx.href}">Go to ${nx.n} ▸</a></div>`
      :`<div><b>🎉 Today's 30-minute plan is complete.</b> All three sections done. Keep playing if you like.</div>${barHTML(rows,here)}<div class="row"><button type="button">Close</button></div>`;
    el.querySelector("button").onclick=()=>el.remove();document.body.appendChild(el);},5000);}
window.GSPlan={PLAN,today,next,barHTML,watch,style,mm};
})();
