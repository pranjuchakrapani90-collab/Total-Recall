/* Pranju OS · Transfer: Samaguri ESD → Bilasipara ESD (18 Nov 2026).
   Transfer order 10 Nov 2026; first day at Bilasipara 17 Nov 2026. He asked that everything pertaining to
   Samaguri ESD (tasks and delegations) be archived, while personal / home tasks carry on as before.

   Runs ONCE (flag "xfer" in the pos-tasks meta, which syncs, so the other phone does not run it again), after this
   phone has pulled the latest data. Everything it does is reversible:
     · Tasks: an open task is archived (Archive list, old list/date/repeat kept for Restore, tag "samaguri-esd") when
       it mentions Samaguri / SESD, or carries a work tag (sde-tech, sde-rev, sde-estt) — unless it was created on or
       after 17 Nov 2026, mentions Bilasipara / BESD, or is about him personally as an employee (transfer, LPC,
       handing over charge, TA, salary, leave…), which still matter after the move. Reference items are never touched.
       Personal, home, family and untagged tasks are left exactly as they are.
     · Delegation: assignments of the archived tasks are marked archived on the member cards; office staff left with
       nothing open are retired (hidden from the "Delegate to" row; shown again with "Show done & upcoming").
   A review sheet (Tasks page and home screen) lists what was archived, with Restore per task and Restore all. */
(function(){
"use strict";
var VER="bilasipara-2026-11-17",JOIN="2026-11-17",TAG="samaguri-esd",KEY="pos-tasks",DKEY="deleg";
var WORK=/^(sde|apdcl)/,PERSONAL=/^(home-manager|personal|brother|son|family)$/;
var SAM=/samaguri|\bsesd\b/i,BIL=/bilasipara|\bbesd\b|gauripur|dhubri|kokrajhar/i;
var MINE=/\b(lpc|last pay|hand(ing)?\s*over|charge report|reliev|relieve|joining|join(ed)? at|transfer|t\.?a\.? bill|travell?ing allowance|salary|gpf|nps|leave|increment|pay slip|payslip|service book)\b/i;
var ls;try{ls=window.localStorage}catch(e){return}
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
function rd(k){try{return JSON.parse(ls.getItem(k)||"{}")||{}}catch(e){return {}}}
function wr(k,v){try{ls.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function getMeta(){var d=rd(KEY);return d.meta||{}}
function setMeta(fn){var d=rd(KEY);d.t=d.t||{};d.meta=d.meta||{};fn(d.meta);wr(KEY,d)}
function P(){return window.PosTasks&&PosTasks.on()?PosTasks:null}

/* ---------- which tasks go ---------- */
function verdict(t,keep){
  if(!t||t.st===2)return "";
  if(t.pj==="reference"||t.pj==="archive"||t.pj==="abandoned")return "";
  if(keep[t.id])return "";
  var tags=t.tg||[],text=(t.ti||"")+"\n"+(t.c||"");
  if(tags.indexOf(TAG)>=0)return "";
  var sam=SAM.test(text),work=tags.some(function(g){return WORK.test(g)});
  if(!sam&&!work)return "";                                   /* personal, home, family, untagged: carry on */
  if(!work&&tags.some(function(g){return PERSONAL.test(g)}))return ""; /* a personal task that mentions Samaguri (e.g. shifting house): keep */
  if(BIL.test(text))return "";                                /* already about Bilasipara */
  if(!sam&&String(t.cr||"").slice(0,10)>=JOIN)return "";       /* new work at Bilasipara */
  if(MINE.test(text))return "";                               /* about him as an employee: still matters */
  return sam?"samaguri":"work";}

function run(){var Pt=P();if(!Pt)return null;var M=getMeta();if(M.xfer===VER)return null;
  var keep=M.xferKeep||{},T=Pt.all(),td=Pt.today(),out=[];
  Object.keys(T).forEach(function(id){var t=T[id],why=verdict(t,keep);if(!why)return;
    try{Pt.act(id,"archive");var u=Pt.get(id);if(u){u.tg=(u.tg||[]).concat([TAG]);
      u.cm=(u.cm||[]).concat([{x:"Archived on transfer to Bilasipara ESD ("+td+"). Restore it from Tasks › Archive if it still applies.",at:new Date().toISOString()}]);Pt.put(u);}
      out.push(id);}catch(e){console.warn("transfer: could not archive",id,e)}});
  /* delegation */
  var D=rd(DKEY);D.people=D.people||{};D.assign=D.assign||{};var gone={},nd=0,retired=[];out.forEach(function(id){gone[id]=1});
  var T2=Pt.all();
  Object.keys(D.assign).forEach(function(id){var a=D.assign[id],p=D.people[a.p]||{};if(a.s==="fin"||a.s==="arch"||a.s==="abn")return;
    var t=T2[id],arch=gone[id]||(t&&t.pj==="archive"&&(t.tg||[]).indexOf(TAG)>=0);
    /* an office assignment whose task is no longer in Pranju OS: it was Samaguri office work */
    if(!t&&p.g==="office")arch=true;
    if(!t&&SAM.test(a.t||""))arch=true;
    if(arch){a.xs=a.s||"";a.xon=a.on||"";a.s="arch";a.on=td;a.xf=VER;nd++;}});
  Object.keys(D.people).forEach(function(pid){var p=D.people[pid];if(p.g!=="office"||p.ret)return;
    var open=Object.keys(D.assign).some(function(id){var a=D.assign[id];return a.p===pid&&a.s!=="fin"&&a.s!=="arch"&&a.s!=="abn"});
    if(!open){p.ret=VER;retired.push(pid)}});
  wr(DKEY,D);
  var kept=Object.keys(T2).filter(function(id){var t=T2[id];return t.st!==2&&t.pj!=="archive"&&t.pj!=="abandoned"&&t.pj!=="reference"}).length;
  setMeta(function(m){m.xfer=VER;m.xferAt=new Date().toISOString();m.xferN={tasks:out.length,deleg:nd,staff:retired.length,kept:kept};});
  return {tasks:out.length,deleg:nd,staff:retired.length,kept:kept};}

/* ---------- restore ---------- */
function restore(id){var Pt=P();if(!Pt)return;var t=Pt.get(id);if(!t)return;
  if(t.pj==="archive")Pt.act(id,"restore");var u=Pt.get(id);if(u){u.tg=(u.tg||[]).filter(function(g){return g!==TAG});Pt.put(u)}
  setMeta(function(m){m.xferKeep=m.xferKeep||{};m.xferKeep[id]=1});
  var D=rd(DKEY);D.people=D.people||{};var a=D.assign&&D.assign[id];
  if(a&&a.xf){if(a.xs)a.s=a.xs;else delete a.s;if(a.xon)a.on=a.xon;else delete a.on;delete a.xs;delete a.xon;delete a.xf;
    var p=D.people[a.p];if(p&&p.ret)delete p.ret;wr(DKEY,D);}}
function archivedList(){var Pt=P();if(!Pt)return [];var T=Pt.all();
  return Object.keys(T).map(function(id){return T[id]}).filter(function(t){return t.pj==="archive"&&(t.tg||[]).indexOf(TAG)>=0})
    .sort(function(a,b){return String(a.tg.filter(function(g){return g!==TAG})[0]||"~").localeCompare(String(b.tg.filter(function(g){return g!==TAG})[0]||"~"))||a.ti.localeCompare(b.ti)});}

/* ---------- the note and the review sheet ---------- */
var css=document.createElement("style");
css.textContent=".xf-note{position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9000;max-width:560px;margin:0 auto;background:#1c1b19;color:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 10px 30px #0005;font:14px/1.45 system-ui,sans-serif}"+
".xf-note b{display:block;font-size:15px;margin-bottom:4px}.xf-note .r{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}"+
".xf-note button,.xf-sh button{border:0;border-radius:10px;padding:9px 14px;font:650 13px system-ui,sans-serif;cursor:pointer}"+
".xf-note .p{background:#fff;color:#1c1b19}.xf-note .s{background:#ffffff22;color:#fff}"+
".xf-scr{position:fixed;inset:0;background:#0007;z-index:9001;display:flex;align-items:flex-end;justify-content:center}"+
".xf-sh{background:var(--tr-paper,#fff);color:var(--tr-ink,#1c1b19);width:100%;max-width:640px;max-height:86vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));font:14px/1.45 system-ui,sans-serif}"+
".xf-sh h3{margin:0 0 4px;font-size:18px}.xf-sh p{margin:0 0 12px;color:var(--tr-muted,#6b6a64);font-size:13px}"+
".xf-sh .it{display:flex;gap:10px;align-items:center;border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:10px;margin-bottom:8px}"+
".xf-sh .it div{flex:1;min-width:0}.xf-sh .it b{display:block;font-size:13.5px;word-break:break-word}.xf-sh .it small{color:var(--tr-muted,#6b6a64);font-size:11.5px}"+
".xf-sh .rs{background:#0f766e;color:#fff}.xf-sh .rs[disabled]{background:#cbd5d1}.xf-sh .top{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}"+
".xf-sh .cl{background:var(--tr-line,#e6e3db);color:inherit}.xf-sh .ra{background:#fff;border:1px solid #0f766e!important;color:#0f766e}"+
".xf-sh input{font:inherit;padding:8px 10px;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;flex:1;min-width:140px}";
document.head.appendChild(css);

function note(){var M=getMeta();if(M.xfer!==VER||M.xferSeen||$("xfNote"))return;var n=M.xferN||{};
  var d=document.createElement("div");d.className="xf-note";d.id="xfNote";
  d.innerHTML="<b>Moved to Bilasipara ESD</b>"+(n.tasks||0)+" Samaguri task"+(n.tasks===1?"":"s")+" archived"+(n.deleg?", "+n.deleg+" delegation"+(n.deleg===1?"":"s")+" closed":"")+
    (n.staff?", "+n.staff+" Samaguri staff card"+(n.staff===1?"":"s")+" retired":"")+". Your personal and home tasks carry on as before"+(n.kept!=null?" ("+n.kept+" open tasks)":"")+"."+
    '<div class="r"><button class="p" type="button" id="xfRev">Review &amp; restore</button><button class="s" type="button" id="xfOk">OK</button></div>';
  document.body.appendChild(d);
  $("xfOk").onclick=function(){setMeta(function(m){m.xferSeen=1});d.remove()};
  $("xfRev").onclick=function(){sheet()};}

function sheet(){var L=archivedList(),scr=document.createElement("div");scr.className="xf-scr";
  scr.innerHTML='<div class="xf-sh" role="dialog"><h3>Archived on transfer</h3><p>These were Samaguri ESD tasks. Restore any that still apply at Bilasipara (daily routines, your own matters) — it goes back to its old list, date and repeat, and its delegation card comes back.</p>'+
    '<div class="top"><input id="xfQ" placeholder="Search"><button class="ra" type="button" id="xfAll">Restore all</button><button class="cl" type="button" id="xfCl">Close</button></div><div id="xfL"></div></div>';
  document.body.appendChild(scr);
  function draw(){var q=($("xfQ").value||"").toLowerCase(),h="";
    L.forEach(function(t){if(q&&(t.ti+" "+(t.tg||[]).join(" ")).toLowerCase().indexOf(q)<0)return;var pv=t.prev||{},tags=(t.tg||[]).filter(function(g){return g!==TAG});
      h+='<div class="it"><div><b>'+esc(t.ti)+'</b><small>'+esc((tags.join(", ")||"no tag")+" · was in "+((window.PosTasks&&PosTasks.LISTNAME[pv.pj])||pv.pj||"Inbox")+(pv.rp?" · "+PosTasks.repeatLabel(pv.rp):""))+'</small></div>'+
        '<button class="rs" type="button" data-id="'+esc(t.id)+'">'+(t._r?"Restored":"Restore")+"</button></div>";});
    $("xfL").innerHTML=h||'<p>Nothing archived'+(q?" matches":"")+'.</p>';
    $("xfL").querySelectorAll("[data-id]").forEach(function(b){var t=L.filter(function(x){return x.id===b.dataset.id})[0];if(t&&t._r)b.disabled=true;
      b.onclick=function(){restore(b.dataset.id);if(t)t._r=1;b.disabled=true;b.textContent="Restored"}});}
  draw();$("xfQ").oninput=draw;
  $("xfAll").onclick=function(){var left=L.filter(function(t){return !t._r});if(!left.length)return;
    if(!confirm("Bring back all "+left.length+" archived Samaguri tasks?"))return;left.forEach(function(t){restore(t.id);t._r=1});draw()};
  $("xfCl").onclick=function(){scr.remove();setMeta(function(m){m.xferSeen=1});var n=$("xfNote");if(n)n.remove();if(/tasks\.html|delegation\.html/.test(location.pathname))location.reload()};
  scr.onclick=function(e){if(e.target===scr)$("xfCl").onclick()};}

window.PosTransfer={run:run,sheet:sheet,restore:restore,list:archivedList,VER:VER};

/* after this phone has the other phone's latest tasks */
function start(){var go=function(){try{var r=run();if(r&&/tasks\.html|delegation\.html/.test(location.pathname)){location.reload();return}}catch(e){console.warn("transfer:",e)}note();};
  if(getMeta().xfer===VER){setTimeout(note,600);return}
  var k=window.PosKV&&PosKV.sync;if(!k||!(ls.getItem("totalRecallSyncCode_v1")||"").trim()){setTimeout(go,800);return}
  /* PosKV.sync() returns at once while another sync is running; try until one real round-trip has finished */
  var tries=0;(function attempt(){tries++;var t0=Date.now();Promise.resolve(k()).then(function(){
      if(Date.now()-t0<150&&tries<8){setTimeout(attempt,2500);return}setTimeout(go,300)},function(){setTimeout(go,300)})})();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
