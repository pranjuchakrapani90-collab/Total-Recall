/* Guitar Studio · practice metronome (26 Oct 2026).
   For practising what a section taught without its play-through: a plain click in the page's bottom bar,
   and every second it runs counts as practice time for that section (daily goal and the 15 + 15 + 15 cycle),
   exactly like the section's own player.
   One section page uses it with:
     GSMetro.mount({here:"ml", bar:"#nowbar", meter:"4", credit:(sec,final)=>{…add sec to the section's minutes…},
                    stopPage:()=>{…stop the page's player…}});
   The page's own player and the metronome never run together: starting one stops the other.
   Tempo and time signature are remembered per section on this phone (key "gs-metro-v1"). */
(function(){
"use strict";
const KEY="gs-metro-v1";
/* time signatures: b = clicks per bar, acc = how loud each click is (2 = bar start, 1 = group start, 0 = plain) */
const METERS={
  "2":{n:"2/4",b:2,acc:[2,0],d:"March feel"},
  "3":{n:"3/4",b:3,acc:[2,0,0],d:"Waltz feel"},
  "4":{n:"4/4",b:4,acc:[2,0,0,0],d:"Most songs and solos"},
  "6":{n:"6/8",b:6,acc:[2,0,0,1,0,0],d:"6 clicks a bar: one per string when you pluck a chord string by string"},
  "12":{n:"12/8",b:12,acc:[2,0,0,1,0,0,1,0,0,1,0,0],d:"Slow blues and ballads: four groups of three"}};
const ORDER=["4","3","2","6","12"];
let O=null,ctx=null,on=null,wake=null,taps=[];
const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")||{};}catch(e){return {};}};
function cfg(){const a=get()[O.here]||{};return {bpm:Math.max(30,Math.min(240,Number(a.bpm)||(O.bpm||70))),meter:METERS[a.meter]?a.meter:(O.meter||"4"),acc:a.acc!==false};}
function setCfg(p){const a=get();a[O.here]={...cfg(),...p};try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
const mm=s=>{s=Math.floor(s);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};

/* ---------- sound: a short wood-block click, brighter on the first beat of the bar ---------- */
function audio(){if(!ctx){const A=window.AudioContext||window.webkitAudioContext;ctx=new A();}if(ctx.state==="suspended")ctx.resume();return ctx;}
function click(t,lvl){
  const f=lvl===2?2000:lvl===1?1600:1250,v=lvl===2?1:lvl===1?.75:.55;
  [[f,.7],[f*1.5,.22]].forEach(([fr,pk])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=fr;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(pk*v,t+.001);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.08);});}

/* ---------- running ---------- */
function credit(final){if(!on)return;const now=performance.now();let s=(now-on.lf)/1000;on.lf=now;
  s=Math.min(s,90); // a gap while the phone was asleep doesn't count
  if(s>0)try{O.credit(s,!!final);}catch(e){}}
function start(){if(on)return;try{O.stopPage&&O.stopPage();}catch(e){}
  audio();const c=cfg();
  on={next:ctx.currentTime+.1,beat:0,lf:performance.now(),t0:performance.now(),flash:[]};
  on.timer=setInterval(()=>{if(!on)return;const c=cfg(),M=METERS[c.meter],spb=60/c.bpm; // every click is one bpm, in every time signature
    while(on.next<ctx.currentTime+.15){const i=on.beat%M.b;click(on.next,c.acc?M.acc[i]:(i===0?1:0));on.flash.push([on.next,i]);on.next+=spb;on.beat++;}
    if(performance.now()-on.lf>3000)credit(false);},25);
  on.raf=requestAnimationFrame(draw);
  try{if(navigator.wakeLock)navigator.wakeLock.request("screen").then(l=>{if(on)wake=l;else l.release();}).catch(()=>{});}catch(e){}
  paint();}
function stop(){if(!on)return;credit(true);clearInterval(on.timer);cancelAnimationFrame(on.raf);on=null;
  try{if(wake){wake.release().catch(()=>{});wake=null;}}catch(e){}paint();}
document.addEventListener("visibilitychange",()=>{if(on&&document.visibilityState==="visible"&&navigator.wakeLock&&!wake)navigator.wakeLock.request("screen").then(l=>{wake=l;}).catch(()=>{});});
function draw(){if(!on)return;const now=ctx.currentTime;let cur=null;while(on.flash.length&&on.flash[0][0]<=now)cur=on.flash.shift();
  if(cur){document.querySelectorAll(".gsm-dots i").forEach((d,k)=>d.classList.toggle("lit",k===cur[1]));}
  const t=document.getElementById("gsmClock");if(t){const s=(performance.now()-on.t0)/1000,x=mm(s);if(t.textContent!==x)t.textContent=x;}
  on.raf=requestAnimationFrame(draw);}

/* ---------- the button in the bottom bar, the mini bar when the page's bar is hidden, and the panel ---------- */
const CSS=`.gsm-btn{flex:none;font:650 14px system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid #d6d3c8;background:#fff;color:#141413;border-radius:10px;padding:8px 11px;cursor:pointer;white-space:nowrap;line-height:1.2}
.gsm-btn.run{background:#141413;color:#fff;border-color:#141413}
.gsm-mini{position:fixed;left:0;right:0;bottom:0;z-index:19;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:8px 14px calc(8px + env(safe-area-inset-bottom,0px));pointer-events:none}
.gsm-mini>*{pointer-events:auto;box-shadow:0 4px 14px #0002}
.gsm-mini .t{font:700 14px ui-monospace,Menlo,Consolas,monospace;background:#fff;border:1px solid #e5e2d8;border-radius:10px;padding:8px 10px;color:#141413}
.gsm-pan{position:fixed;left:50%;transform:translateX(-50%);z-index:45;width:min(460px,calc(100% - 20px));background:#fff;border:1px solid #e5e2d8;border-radius:16px;box-shadow:0 12px 34px #0f172a33;padding:14px;display:flex;flex-direction:column;gap:12px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#141413}
.gsm-pan h4{margin:0;font:700 15px system-ui,sans-serif;display:flex;justify-content:space-between;align-items:center;gap:8px}
.gsm-pan h4 button{border:0;background:#f1f0eb;border-radius:8px;padding:5px 10px;font:600 13px system-ui,sans-serif;cursor:pointer;color:#555}
.gsm-pan p{margin:0;color:#6b6a63;font-size:13px}
.gsm-tempo{display:flex;align-items:center;justify-content:center;gap:6px}
.gsm-tempo button{border:1px solid #d6d3c8;background:#fff;border-radius:10px;min-width:44px;padding:9px 0;font:700 15px system-ui,sans-serif;cursor:pointer;color:#141413}
.gsm-tempo b{font:800 34px ui-monospace,Menlo,Consolas,monospace;min-width:84px;text-align:center}.gsm-tempo small{display:block;font:600 11px system-ui,sans-serif;color:#6b6a63;text-align:center;margin-top:-4px}
.gsm-pan input[type=range]{width:100%;accent-color:#141413}
.gsm-meters{display:flex;gap:6px;flex-wrap:wrap}
.gsm-meters button{flex:1;min-width:52px;border:1px solid #d6d3c8;background:#fff;border-radius:10px;padding:8px 6px;font:700 14px ui-monospace,Menlo,Consolas,monospace;cursor:pointer;color:#141413}
.gsm-meters button.on{background:#141413;color:#fff;border-color:#141413}
.gsm-dots{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.gsm-dots i{width:16px;height:16px;border-radius:50%;background:#e5e2d8;transition:background .05s}
.gsm-dots i.a2{outline:2px solid #c2410c;outline-offset:1px}.gsm-dots i.a1{outline:2px solid #e5a17e;outline-offset:1px}
.gsm-dots i.lit{background:#c2410c}
.gsm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gsm-row .go{flex:1;border:0;border-radius:12px;padding:12px;font:700 16px system-ui,sans-serif;cursor:pointer;background:#c2410c;color:#fff}
.gsm-row .go.run{background:#141413}
.gsm-row .tap{border:1px solid #d6d3c8;background:#fff;border-radius:12px;padding:12px 14px;font:650 14px system-ui,sans-serif;cursor:pointer;color:#141413}
.gsm-row label{display:flex;gap:6px;align-items:center;font-size:13px;color:#6b6a63}
#gsmClock{font:700 14px ui-monospace,Menlo,Consolas,monospace;color:#141413}`;
let panel=null,mini=null,barEl=null;
function btnHTML(){const c=cfg();return on?`■ ♩${c.bpm}`:"♩ Metronome";}
function ensureBtn(){
  if(!barEl)barEl=document.querySelector(O.bar);
  const host=barEl&&(O.into?barEl.querySelector(O.into)||barEl:barEl);
  if(host&&!host.querySelector("[data-gsm]")){const b=document.createElement("button");b.type="button";b.className="gsm-btn";b.dataset.gsm="1";
    b.title="Metronome · counts as practice time";const ref=host.querySelector(O.after||".play,#nbPlay,.pri");
    if(ref&&ref.parentElement===host)ref.insertAdjacentElement("afterend",b);else host.appendChild(b);paintBtn(b);}
  /* the page's bar is hidden on this view: a small bar of our own, so the metronome is always one tap away */
  const hidden=!barEl||barEl.hidden||getComputedStyle(barEl).display==="none";
  if(hidden&&!mini){mini=document.createElement("div");mini.className="gsm-mini";mini.innerHTML=`<span class="t" data-gsp-timer hidden></span><button type="button" class="gsm-btn" data-gsm="1"></button>`;document.body.appendChild(mini);paintBtn(mini.querySelector("button"));if(window.GSPlanTick)GSPlanTick();}
  if(mini){if(mini.hidden!==!hidden)mini.hidden=!hidden;const t=mini.querySelector(".t");if(t&&t.hidden!==!on)t.hidden=!on;}
  if(panel)place();}
function paintBtn(b){const x=btnHTML();if(b.textContent!==x)b.textContent=x;if(b.classList.contains("run")!==!!on)b.classList.toggle("run",!!on);}
function paint(){document.querySelectorAll("[data-gsm]").forEach(paintBtn);if(mini){const t=mini.querySelector(".t");if(t&&t.hidden!==!on)t.hidden=!on;}if(panel)fill();}
function place(){const b=(barEl&&!barEl.hidden)?barEl:mini;const h=b?b.getBoundingClientRect().height:60;panel.style.bottom=(h+10)+"px";}
function fill(){const c=cfg(),M=METERS[c.meter];
  panel.innerHTML=`<h4><span>♩ Metronome <small style="font-weight:500;color:#6b6a63">· ${O.name||"this section"}</small></span><button type="button" data-gsmx="close">Close</button></h4>
    <div class="gsm-tempo"><button type="button" data-gsmd="-5">−5</button><button type="button" data-gsmd="-1">−1</button><div><b>${c.bpm}</b><small>clicks a minute</small></div><button type="button" data-gsmd="1">+1</button><button type="button" data-gsmd="5">+5</button></div>
    <input type="range" min="30" max="240" step="1" value="${c.bpm}" data-gsmr="1" aria-label="Tempo">
    <div class="gsm-meters">${ORDER.map(k=>`<button type="button" data-gsmm="${k}" class="${k===c.meter?"on":""}">${METERS[k].n}</button>`).join("")}</div>
    <p>${M.n}: ${M.d}.${M.b>=6?" Every click is one string, at the tempo above.":""}</p>
    <div class="gsm-dots">${M.acc.map(a=>`<i class="${c.acc&&a?"a"+a:!c.acc&&a===2?"a2":""}"></i>`).join("")}</div>
    <div class="gsm-row"><button type="button" class="go${on?" run":""}" data-gsmx="go">${on?"■ Stop":"▶ Start"}</button><button type="button" class="tap" data-gsmx="tap">Tap tempo</button></div>
    <div class="gsm-row"><label><input type="checkbox" data-gsma="1" ${c.acc?"checked":""}> Accent the groups</label><span style="margin-left:auto">${on?`Running <span id="gsmClock">0:00</span>`:""}</span></div>
    <p>Every second the metronome runs counts as ${O.name||"this section"} practice, for today's goal and the cycle. Starting the section's own player stops it.</p>`;}
function open(){if(panel){panel.remove();panel=null;return;}panel=document.createElement("div");panel.className="gsm-pan";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Metronome");document.body.appendChild(panel);fill();place();}
function bump(p){setCfg(p);paint();} // a running metronome picks the change up from its next click
document.addEventListener("click",e=>{if(!O)return;const t=e.target;
  if(t.closest("[data-gsm]")){e.preventDefault();e.stopPropagation();open();return;}
  if(!panel||!panel.contains(t))return;const d=t.closest("[data-gsmd]"),m=t.closest("[data-gsmm]"),x=t.closest("[data-gsmx]");
  if(d){bump({bpm:Math.max(30,Math.min(240,cfg().bpm+Number(d.dataset.gsmd)))});}
  else if(m){bump({meter:m.dataset.gsmm});if(on)on.beat=0;}
  else if(x&&x.dataset.gsmx==="close"){panel.remove();panel=null;}
  else if(x&&x.dataset.gsmx==="go"){on?stop():start();}
  else if(x&&x.dataset.gsmx==="tap"){const n=performance.now();taps=taps.filter(v=>n-v<2500);taps.push(n);
    if(taps.length>=2){const g=(taps[taps.length-1]-taps[0])/(taps.length-1);bump({bpm:Math.max(30,Math.min(240,Math.round(60000/g)))});}}},true);
document.addEventListener("input",e=>{if(!O||!panel)return;const t=e.target;
  if(t.dataset.gsmr){setCfg({bpm:Number(t.value)});const b=panel.querySelector(".gsm-tempo b");if(b)b.textContent=t.value;document.querySelectorAll("[data-gsm]").forEach(paintBtn);}
  else if(t.dataset.gsma){bump({acc:t.checked});}});
document.addEventListener("change",e=>{if(panel&&e.target.dataset&&e.target.dataset.gsmr)fill();});

function mount(o){O=o;const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);
  ensureBtn();setInterval(ensureBtn,500);
  /* re-add the button as soon as the page redraws its bar */
  let q=0;try{new MutationObserver(()=>{if(!q)q=requestAnimationFrame(()=>{q=0;ensureBtn();});}).observe(document.body,{childList:true,subtree:true});}catch(e){}}
window.GSMetro={mount,start,stop,isOn:()=>!!on,live:()=>on?Math.min(90,(performance.now()-on.lf)/1000):0};
})();
