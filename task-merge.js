/* Pranju OS · Merge tasks (30 Oct 2026)
   Folds one TickTick task into another so only ONE task is left — no main task / sub-task pair.
   The merged task's title, notes, checklist and tags are added to the kept task's description under a dated
   "MERGED …" line, then the merged task is deleted (TickTick keeps it in Trash). Worker route: ?mode=merge.
   Opened from: the "⇄ Merge" button under a Today's Tasks card, and the "Merge Tasks" tile in the Tasks folder.
   window.TRMerge.open(task?) — task = {id, projectId, title}; without it, he picks both tasks. */
(function(){"use strict";
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var BASE=function(){var u=window.TOTAL_RECALL_TICKTICK_URL;try{u=u||localStorage.getItem("totalRecallTickTickUrl")}catch(e){}return u||"https://total-recall-ticktick.pranjuchakrapani90.workers.dev"};
var url=function(q){var u=BASE();return u+(u.indexOf("?")>=0?"&":"?")+q};
var all=null,st={from:null,into:null,step:"from",busy:false};

var css=document.createElement("style");css.textContent=
".mgm{position:fixed;inset:0;z-index:70;display:flex;align-items:flex-end;justify-content:center;background:#1c1b1966}.mgm[hidden]{display:none}"+
".mgs{background:var(--tr-paper,#fff);width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:11px;box-shadow:0 -6px 30px #0003;color:var(--tr-ink,#1c1b19)}"+
"@media(min-width:620px){.mgm{align-items:center}.mgs{border-radius:18px}}"+
".mgh{display:flex;justify-content:space-between;align-items:center}.mgh h3{margin:0;font:700 17px system-ui,sans-serif}.mgh button{background:transparent;color:var(--tr-muted,#6b6a64);padding:4px 8px;font-size:20px}"+
".mgq{font:600 14px/1.4 system-ui,sans-serif}.mgq small{display:block;font-weight:500;color:var(--tr-muted,#6b6a64);font-size:12.5px;margin-top:2px}"+
".mgs input[type=search]{font:500 15px system-ui,sans-serif;padding:10px}"+
".mgl{max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:4px}.mgl button{text-align:left;background:var(--tr-soft,#f0eee8);color:var(--tr-ink,#1c1b19);border-radius:10px;padding:9px 10px;font:600 13.5px/1.3 system-ui,sans-serif}"+
".mgl small{display:block;font-weight:500;color:var(--tr-muted,#6b6a64);font-size:11.5px}.mgl p{margin:4px 2px;color:var(--tr-muted,#6b6a64);font-size:13px}.mgl .lk{font:700 10.5px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--tr-muted,#6b6a64);margin:6px 2px 0}"+
".mgc{border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:3px}.mgc b{font:700 11px system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase}.mgc span{font-weight:650;font-size:14.5px}"+
".mgc.keep{background:#ecf7ef;border-color:#cfe9d6}.mgc.keep b{color:#14532d}.mgc.gone{background:#fbf7ec;border-color:#f1e3bf}.mgc.gone b{color:#713f12}"+
".mgsw{align-self:center;padding:6px 14px;font-size:13px}"+
".mgp{white-space:pre-wrap;font:500 13px/1.45 system-ui,sans-serif;background:var(--tr-soft,#f0eee8);border-radius:10px;padding:10px;max-height:28vh;overflow:auto}"+
".mgn{font-size:12.5px;color:var(--tr-muted,#6b6a64)}.mge{color:#991b1b;font-size:13px}"+
".mgb{display:flex;gap:8px;flex-wrap:wrap}.mgb button{flex:1 1 auto}"+
".mgrow{margin-top:10px}.mgrow button{width:100%;padding:10px 14px;font-size:14px}";
document.head.appendChild(css);

var modal=document.createElement("div");modal.className="mgm";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-label","Merge tasks");
modal.innerHTML='<div class="mgs"><div class="mgh"><h3>Merge tasks</h3><button type="button" id="mgX" aria-label="Close">×</button></div><div id="mgBody"></div></div>';
document.body.appendChild(modal);
modal.addEventListener("click",function(e){if(e.target===modal)close()});
$("mgX").onclick=close;
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!modal.hidden)close()});

function close(){modal.hidden=true;st.busy=false}
function open(task){st={from:task&&task.id?{id:task.id,projectId:task.projectId,title:task.title,project:task.project||""}:null,into:null,step:task&&task.id?"into":"from",busy:false};
  modal.hidden=false;draw();if(!all)loadAll();}
async function loadAll(){try{var r=await fetch(url("mode=wa-review&list=tasks"),{cache:"no-store"});var d=await r.json();if(d.error)throw new Error(d.error);all=d.tasks||[];}
  catch(e){all=null;var L=$("mgL");if(L)L.innerHTML="<p>Couldn't load your tasks: "+esc(e.message)+"</p>";return}draw();}
var STOP={};"A AN THE TO OF FOR AND OR IN ON AT BY FROM WITH REG RE IS ARE BE THIS THAT".split(" ").forEach(function(w){STOP[w]=1});
function words(t){return String(t||"").toUpperCase().replace(/[^\w\s]/g," ").split(/\s+/).filter(function(w){return w.length>1&&!STOP[w]})}
function likeness(a,b){var A=words(a),B={};words(b).forEach(function(w){B[w]=1});var n=0;A.forEach(function(w){if(B[w])n++});return n}

function draw(){var body=$("mgBody");
  if(st.step==="from"||st.step==="into"){
    var q=st.step==="from"?'<div class="mgq">Which task is only an update?<small>It will be folded into another task and removed.</small></div>'
      :'<div class="mgq">Merge “'+esc(st.from.title)+'” into which task?<small>That task stays. This one is folded into it, so only one task is left.</small></div>';
    body.innerHTML=q+'<input id="mgQ" type="search" placeholder="Search your tasks (place, consumer no., name…)" autocomplete="off"><div class="mgl" id="mgL"></div>'+
      (st.step==="into"&&!st.locked?'<div class="mgb"><button type="button" class="secondary" id="mgBack">← Pick a different task</button></div>':"");
    $("mgQ").oninput=list;list();if(st.step==="into"&&$("mgBack"))$("mgBack").onclick=function(){st.from=null;st.step="from";draw()};
    setTimeout(function(){var i=$("mgQ");if(i&&window.matchMedia("(min-width:620px)").matches)i.focus()},50);return;}
  /* preview */
  body.innerHTML='<div class="mgc keep"><b>Stays</b><span>'+esc(st.into.title)+'</span></div>'+
    '<button type="button" class="secondary mgsw" id="mgSw">⇄ Swap</button>'+
    '<div class="mgc gone"><b>Folded in, then removed</b><span>'+esc(st.from.title)+'</span></div>'+
    '<div class="mgn" id="mgInfo">Checking both tasks in TickTick…</div><div class="mgp" id="mgPv" hidden></div><div class="mge" id="mgE"></div>'+
    '<div class="mgb"><button type="button" id="mgGo" disabled>Merge into one task</button><button type="button" class="secondary" id="mgBk">← Back</button></div>';
  $("mgSw").onclick=function(){var t=st.from;st.from=st.into;st.into=t;draw()};
  $("mgBk").onclick=function(){st.into=null;st.step="into";draw()};
  $("mgGo").onclick=go;preview();}

function list(){var L=$("mgL");if(!L)return;if(!all){L.innerHTML="<p>Loading your tasks…</p>";return}
  var q=$("mgQ").value.trim().toLowerCase(),ws=q.split(/\s+/).filter(Boolean),ex=st.from&&st.from.id;
  var pool=all.filter(function(t){if(t.id===ex)return false;var h=(t.title+" "+t.project+" "+(t.tags||[]).join(" ")).toLowerCase();return ws.every(function(w){return h.indexOf(w)>=0})});
  var top=[];if(!q&&st.step==="into"){top=pool.map(function(t){return {t:t,s:likeness(st.from.title,t.title)}}).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s}).slice(0,6).map(function(x){return x.t});
    var ids={};top.forEach(function(t){ids[t.id]=1});pool=pool.filter(function(t){return !ids[t.id]});}
  var shown=top.concat(pool.slice(0,60)),btn=function(t,i){return '<button type="button" data-k="'+i+'">'+esc(t.title)+'<small>'+esc(t.project)+((t.tags||[]).length?" · "+esc(t.tags.join(", ").toUpperCase()):"")+'</small></button>'};
  var h="";if(top.length)h+='<div class="lk">Looks similar</div>'+top.map(btn).join("")+'<div class="lk">All open tasks</div>';
  h+=pool.slice(0,60).map(function(t,i){return btn(t,i+top.length)}).join("");
  L.innerHTML=shown.length?h:"<p>No open task matches.</p>";
  L.querySelectorAll("button[data-k]").forEach(function(b){b.onclick=function(){var t=shown[+b.dataset.k],o={id:t.id,projectId:t.projectId,title:t.title,project:t.project};
    if(st.step==="from"){st.from=o;st.step="into"}else{st.into=o;st.step="preview"}draw()}});}

async function post(extra){var r=await fetch(url("mode=merge"),{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify(Object.assign({from:{id:st.from.id,projectId:st.from.projectId},into:{id:st.into.id,projectId:st.into.projectId}},extra||{}))});
  var d={};try{d=await r.json()}catch(e){}if(!r.ok||d.error)throw new Error(d.error||("HTTP "+r.status));return d;}
async function preview(){var a=st.from.id,b=st.into.id;
  try{var d=await post({dry:true});if(!st.from||st.from.id!==a||!st.into||st.into.id!==b)return;
    $("mgInfo").textContent="This note is added to the task that stays"+(d.tags&&d.tags.length?" (tags: "+d.tags.join(", ").toUpperCase()+")":"")+":";
    $("mgPv").hidden=false;$("mgPv").textContent=d.block;
    $("mgGo").disabled=false;}
  catch(e){if(st.from&&st.from.id===a){$("mgInfo").textContent="";$("mgE").textContent=e.message;}}}
async function go(){if(st.busy)return;st.busy=true;var b=$("mgGo");b.textContent="Merging…";b.disabled=true;
  try{var d=await post();var from=st.from,into=st.into;
    moveDelegation(from.id,into);
    if(all)all=all.filter(function(t){return t.id!==from.id});
    try{if(window.TRToday&&window.TRToday.drop)window.TRToday.drop(from.id)}catch(e){}
    try{window.dispatchEvent(new CustomEvent("tr-merged",{detail:{from:from,into:into}}))}catch(e){}
    close();toast(d.warning||("Merged: one task left, “"+into.title+"”"));}
  catch(e){$("mgE").textContent="Could not merge: "+e.message;b.textContent="Merge into one task";b.disabled=false;st.busy=false;}}
/* a delegated task that gets merged away: its member keeps the task that stays */
function moveDelegation(fromId,into){try{var D=JSON.parse(localStorage.getItem("deleg")||"{}")||{};if(!D.assign||!D.assign[fromId])return;
  if(!D.assign[into.id]){var a=D.assign[fromId];a.t=into.title;a.pj=into.projectId||a.pj;D.assign[into.id]=a;}
  delete D.assign[fromId];localStorage.setItem("deleg",JSON.stringify(D));}catch(e){}}
var tt=0;function toast(m){var el=$("mgToast");if(!el){el=document.createElement("div");el.id="mgToast";
    el.style.cssText="position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:88vw;background:#1c1b19;color:#fff;border-radius:14px;padding:10px 16px;font:600 14px system-ui,sans-serif;z-index:9999;box-shadow:0 6px 20px #0004;transition:opacity .3s;text-align:center";
    document.body.appendChild(el)}el.textContent=m;el.style.opacity=1;clearTimeout(tt);tt=setTimeout(function(){el.style.opacity=0},2600);}

/* "⇄ Merge" under the Today's Tasks card */
var row=document.createElement("div");row.className="mgrow hidden";row.innerHTML='<button type="button" class="secondary" id="mgCardBtn">⇄ Merge into another task</button>';
var anchor=$("dlgRow")||$("flash");if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(row,anchor.nextSibling);
function cardTask(){try{var S=window.TRToday&&window.TRToday.state();if(!S||S.mode!=="resp"||!S.sub)return null;var t=(S.taskGroups[S.cards[S.idx].key]||[])[S.subIdx];return t&&t.id&&t.projectId?t:null}catch(e){return null}}
function paintRow(){row.classList.toggle("hidden",!cardTask())}
window.addEventListener("tr-draw",paintRow);
["homeBtn","doneHome"].forEach(function(id){var b=$(id);if(b)b.addEventListener("click",function(){row.classList.add("hidden")})});
$("mgCardBtn").onclick=function(e){e.stopPropagation();var t=cardTask();if(t)open({id:t.id,projectId:t.projectId,title:t.title})};
/* "Merge Tasks" tile in the Tasks folder */
var tile=$("appMerge");if(tile)tile.addEventListener("click",function(e){e.preventDefault();open(null)});

window.TRMerge={open:open};
})();
