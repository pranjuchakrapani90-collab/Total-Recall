/* Pranju OS · Delegation inside Today's Tasks (29 Oct 2026).
   While he reviews today's TickTick tasks one card at a time, a "Delegate to" row under each task card lets him
   give the task to a member (himself, office staff, family…). Each member then has a flash card on the Delegation
   page (delegation.html) with that member's name in the middle and their tasks around it — member-wise pendency.
   Data: localStorage "deleg" (same store delegation.html uses), synced between phones by kvsync.js.
   Nothing is written to TickTick. Listens for index.html's "tr-draw" event and reads the session through window.TRToday. */
(function(){
"use strict";
var KEY="deleg";
var GROUPS={me:{n:"Me",c:"#4f46e5"},office:{n:"Office",c:"#0f766e"},family:{n:"Family",c:"#b45309"},other:{n:"Other",c:"#64748b"}};
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
function load(){var d={};try{d=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
  d.people=d.people||{};d.assign=d.assign||{};if(!d.people.me)d.people.me={name:"Me",g:"me",u:0};return d;}
function save(D){try{localStorage.setItem(KEY,JSON.stringify(D))}catch(e){}}
function shortKw(title){
  var STOP={};"A AN THE TO OF FOR AND OR IN ON AT BY FROM WITH REG REGARDING ABOUT RE PLEASE PLS KINDLY IS ARE BE INTO THIS THAT".split(" ").forEach(function(w){STOP[w]=1});
  var WORD={};"PAY NEW OLD GET SET PUT BUY FIX RUN CAR BOX DAY ALL ONE TWO OUT OFF END MAP BAG FEE TAX SEE ASK USE ADD CUT TOP LOW HIGH BIG RED DUE NOT YET SEND CALL".split(" ").forEach(function(w){WORD[w]=1});
  var w=String(title||"").replace(/[^\w\s\/&.\-]/g," ").split(/\s+/).filter(Boolean),k=w.filter(function(x){return !STOP[x.toUpperCase()]});if(!k.length)k=w;
  return k.slice(0,3).map(function(x){return /\d/.test(x)||(x.length<=3&&x===x.toUpperCase()&&!WORD[x])?x:x.charAt(0).toUpperCase()+x.slice(1).toLowerCase()}).join(" ");}
function people(D){return Object.keys(D.people).map(function(id){var p=D.people[id];return {id:id,name:p.name,g:p.g,u:p.u||0}})
  .sort(function(a,b){return (b.u-a.u)||a.name.localeCompare(b.name)});}
function pending(D,pid){return Object.keys(D.assign).filter(function(id){var a=D.assign[id];return a.p===pid&&!a.d}).length;}
function current(){try{var S=window.TRToday&&window.TRToday.state();if(!S||S.mode!=="resp"||!S.sub)return null;var arr=S.taskGroups[S.cards[S.idx].key]||[];var t=arr[S.subIdx];return t&&t.id?{task:t,tag:S.cards[S.idx].key}:null}catch(e){return null}}

/* ---------- the row under the task card ---------- */
var css=document.createElement("style");
css.textContent=".dlg{margin-top:14px;padding:12px;border:1px solid var(--tr-line,#e6e3db);border-radius:14px;background:var(--tr-paper,#fff)}"+
".dlg .dh{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px}.dlg .dh b{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--tr-muted,#6b6a64)}"+
".dlg .dh .now{flex:1;font-weight:650;color:#0f766e}.dlg .dh a{font-size:12px;font-weight:700;text-decoration:none;color:var(--tr-acc-ink,#3730a3);white-space:nowrap}"+
".dlg input,.dlg select{font:inherit;padding:8px 10px;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;background:#fff;width:100%;box-sizing:border-box}"+
".dlg .pp{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}"+
".dlg .pc{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--g);background:#fff;color:var(--tr-ink,#1c1b19);border-radius:999px;padding:7px 12px;font:650 13px system-ui,sans-serif;cursor:pointer}"+
".dlg .pc i{width:8px;height:8px;border-radius:50%;background:var(--g)}.dlg .pc small{color:var(--tr-muted,#6b6a64);font-weight:600;font-size:11px}"+
".dlg .pc.on{background:var(--g);color:#fff}.dlg .pc.on i{background:#fff}.dlg .pc.on small{color:#ffffffcc}"+
".dlg .pc.add{border-style:dashed;border-color:#9a978e;color:#6b6a64}"+
".dlg .nw{display:grid;grid-template-columns:1fr 104px auto;gap:7px;margin-top:9px}.dlg .nw button{border:0;border-radius:10px;background:var(--tr-acc,#4f46e5);color:#fff;font:650 13px system-ui,sans-serif;padding:0 14px;cursor:pointer}"+
".recallPane{display:flex;flex-direction:column;gap:12px}.recallPane[hidden]{display:none}.recallHead{display:flex;align-items:center;gap:10px}.recallHead b{flex:1;font-size:16px}"+
".respApps{display:grid;grid-template-columns:repeat(2,84px);gap:6px 22px;justify-content:start;padding:4px 2px}.respApps a.app span{font-size:12.5px}"+
".dlgLink{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:12px 14px;border:1px solid var(--tr-line,#e6e3db);border-radius:12px;background:var(--tr-paper,#fff);text-decoration:none;color:var(--tr-ink,#1c1b19);font-weight:650}"+
"#done .dlgLink{text-align:left;margin:4px 0 14px}"+
".dlgLink small{display:block;font-weight:500;color:var(--tr-muted,#6b6a64);font-size:12px;margin-top:2px}.dlgLink span:last-child{color:var(--tr-acc-ink,#3730a3);font-size:18px}";
document.head.appendChild(css);

var box=document.createElement("div");box.className="dlg hidden";box.id="dlgRow";
var flash=$("flash");if(flash&&flash.parentNode)flash.parentNode.insertBefore(box,flash.nextSibling);
var adding=false,kwFor=null;

function paint(){var c=current();if(!c){box.classList.add("hidden");return}
  box.classList.remove("hidden");var D=load(),t=c.task,a=D.assign[t.id],who=a&&D.people[a.p];
  var kw=a?a.k:(kwFor&&kwFor.id===t.id?kwFor.v:shortKw(t.title));
  box.innerHTML='<div class="dh"><b>Delegate to</b><span class="now">'+(who?"→ "+esc(who.name):"")+'</span><a href="delegation.html">Delegation ▸</a></div>'+
    '<input id="dlgKw" maxlength="40" placeholder="Keyword for the card" value="'+esc(kw)+'" aria-label="Keyword for the card">'+
    '<div class="pp">'+people(D).map(function(p){var g=(GROUPS[p.g]||GROUPS.other).c,n=pending(D,p.id);
      return '<button type="button" class="pc'+(a&&a.p===p.id?" on":"")+'" data-dp="'+esc(p.id)+'" style="--g:'+g+'"><i></i>'+esc(p.name)+(n?"<small>"+n+"</small>":"")+"</button>"}).join("")+
    '<button type="button" class="pc add" data-dadd="1">+ New</button></div>'+
    (adding?'<div class="nw"><input id="dlgName" placeholder="Name" autocomplete="off"><select id="dlgGrp"><option value="office">Office</option><option value="family">Family</option><option value="other">Other</option></select><button type="button" id="dlgGo">Add</button></div>':"");
  var kwEl=$("dlgKw");
  kwEl.oninput=function(){kwFor={id:t.id,v:kwEl.value}};
  kwEl.onchange=function(){var D2=load(),a2=D2.assign[t.id];if(a2){a2.k=kwEl.value.trim()||shortKw(t.title);save(D2)}};
  box.querySelectorAll("[data-dp]").forEach(function(b){b.onclick=function(e){e.stopPropagation();give(t,c.tag,b.dataset.dp)}});
  box.querySelector("[data-dadd]").onclick=function(e){e.stopPropagation();adding=!adding;paint();if(adding){var n=$("dlgName");if(n)n.focus()}};
  var go=$("dlgGo");if(go){var add=function(){var name=$("dlgName").value.trim();if(!name)return;var D3=load(),ex=null;
      Object.keys(D3.people).forEach(function(id){if(D3.people[id].name.toLowerCase()===name.toLowerCase())ex=id});
      var id=ex||("p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6));if(!ex)D3.people[id]={name:name,g:$("dlgGrp").value,u:Date.now()};
      save(D3);adding=false;give(t,c.tag,id,true)};
    go.onclick=add;$("dlgName").onkeydown=function(e){if(e.key==="Enter")add()};}}
/* tap a name: the task goes on that member's card; tap the same name again to take it back */
function give(t,tag,pid,forceOn){var D=load(),a=D.assign[t.id],kwEl=$("dlgKw"),kw=(kwEl&&kwEl.value.trim())||shortKw(t.title);
  if(a&&a.p===pid&&!forceOn){delete D.assign[t.id];toast("Taken back from "+D.people[pid].name)}
  else{D.assign[t.id]={t:t.title,k:kw,p:pid,at:Date.now(),pr:tag||"",pj:t.projectId||""};D.people[pid].u=Date.now();toast("→ "+D.people[pid].name)}
  save(D);paint();summary();}
var tt=0;function toast(m){var el=$("dlgToast");if(!el){el=document.createElement("div");el.id="dlgToast";
    el.style.cssText="position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#1c1b19;color:#fff;border-radius:999px;padding:10px 18px;font:600 14px system-ui,sans-serif;z-index:9999;box-shadow:0 6px 20px #0004;transition:opacity .3s;pointer-events:none";
    document.body.appendChild(el)}el.textContent=m;el.style.opacity=1;clearTimeout(tt);tt=setTimeout(function(){el.style.opacity=0},1500);}

/* ---------- Delegation as a sub-segment of Today's Tasks ---------- */
function linkHtml(){var D=load(),m=0,n=0;Object.keys(D.people).forEach(function(id){var k=pending(D,id);if(k){m++;n+=k}});
  return '<span>Delegation<small>'+(n?n+" pending with "+m+" member"+(m>1?"s":""):"Member-wise pendency")+'</small></span><span>›</span>';}
function summary(){document.querySelectorAll(".dlgLink").forEach(function(a){a.innerHTML=linkHtml()});
  var D=load(),n=0;Object.keys(D.people).forEach(function(id){n+=pending(D,id)});var b=$("bDeleg");if(b){b.hidden=!n;b.textContent=n>99?"99+":n}}
function addLink(parent,before){if(!parent)return;var a=document.createElement("a");a.className="dlgLink";a.href="delegation.html";a.innerHTML=linkHtml();
  if(before)parent.insertBefore(a,before);else parent.appendChild(a);}
/* the two app tiles in Today's Tasks: Responsibility Recall (loads today's undelegated tasks) and Delegation */
/* Task Recall opens its own pane (tag-wise tasks inside it); "← Today's Tasks" goes back to the two icons */
function recallOpen(on){var p=$("recallPane"),apps=document.querySelector(".respApps");if(p)p.hidden=!on;if(apps)apps.style.display=on?"none":"";try{sessionStorage.setItem("trRecallOpen",on?"1":"")}catch(e){}}
var rec=$("appRecall");if(rec)rec.addEventListener("click",function(e){e.preventDefault();recallOpen(true);var s=$("startResp");if(s)s.click()});
var rb=$("recallBack");if(rb)rb.onclick=function(){recallOpen(false)};
var rr=$("recallRefresh");if(rr)rr.onclick=function(){var s=$("startResp");if(s)s.click()};
try{if(sessionStorage.getItem("trRecallOpen")&&location.hash==="#resp"){recallOpen(true);setTimeout(function(){var s=$("startResp");if(s)s.click()},0)}}catch(e){}
window.addEventListener("tr-today",function(e){var b=$("bRecall");if(!b)return;var n=(e.detail&&e.detail.count)||0;b.hidden=!n;b.textContent=n>99?"99+":n});
function sessionOpen(){var s=$("session");return s&&!s.classList.contains("hidden")}
function refilter(){if(!sessionOpen()&&window.TRToday&&window.TRToday.refilter)window.TRToday.refilter()}
var doneHome=$("doneHome");if(doneHome)addLink(doneHome.parentNode,doneHome);

/* redraw the row whenever Today's Tasks moves to another card */
window.addEventListener("tr-draw",function(){adding=false;try{paint()}catch(e){}});
["homeBtn","doneHome"].forEach(function(id){var b=$(id);if(b)b.addEventListener("click",function(){box.classList.add("hidden");summary();setTimeout(refilter,0)})});
window.addEventListener("kvsync",function(e){if((e.detail||[]).indexOf(KEY)>=0){paint();summary();refilter()}});
document.addEventListener("visibilitychange",function(){if(!document.hidden){paint();summary();refilter()}});
summary();
})();
