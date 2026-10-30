/* WhatsApp Review (Tasks › WhatsApp Review)
   Claude reads the WhatsApp self-chat and drafts each item into the TickTick project "WA REVIEW".
   Here Pranju edits, renames, retags, dates or discards each draft; Approve sends it to its TickTick
   destination through the worker (?mode=wa-review). When drafts are waiting, a popup opens once per
   app start so they are reviewed one at a time. */
(function(){"use strict";
var $=function(id){return document.getElementById(id)};
var URLB=function(){var u=window.TOTAL_RECALL_TICKTICK_URL;try{u=u||localStorage.getItem("totalRecallTickTickUrl")}catch(e){}u=u||"https://total-recall-ticktick.pranjuchakrapani90.workers.dev";return u+(u.indexOf("?")>=0?"&":"?")+"mode=wa-review"};
var TAGS=["sde-tech","sde-rev","sde-estt","home-manager","brother","son"],MORE=["guitar","read","watch","learn","chess","blog"];
var DEST=[["inbox","Inbox (task)"],["reference","Reference"],["schedule","Schedule"],["projects","Projects"],["checklists","Checklists"]];
var PRI=[[0,"None"],[1,"Low"],[3,"Medium"],[5,"High"]];
var items=[],cur=-1,oneByOne=false,busy=false;
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};

var css=document.createElement("style");css.textContent=
".wal{display:flex;flex-direction:column;gap:8px}"+
".walk{display:flex;flex-wrap:wrap;gap:6px;margin:-2px 0 4px}.walk a{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:6px 10px;border-radius:999px;background:var(--tr-acc-soft,#eef0ff);color:var(--tr-acc-ink,#3730a3);font:600 12.5px system-ui,sans-serif;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"+
".wai{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;background:var(--tr-paper,#fff);color:var(--tr-ink,#1c1b19);border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:11px 12px;font-weight:500}"+
".wai b{display:block;font-weight:650;font-size:14.5px;line-height:1.3}.wai small{color:var(--tr-muted,#6b6a64);font-size:12px}"+
".wad{flex:0 0 auto;font:600 10.5px system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:var(--tr-acc-soft,#eef0ff);color:var(--tr-acc-ink,#3730a3);margin-top:1px}"+
".wad.ref{background:#ecf7ef;color:#14532d}"+
".wam{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;background:#1c1b1966}"+
".wam[hidden]{display:none}"+
".was{background:var(--tr-paper,#fff);width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:11px;box-shadow:0 -6px 30px #0003}"+
"@media(min-width:620px){.wam{align-items:center}.was{border-radius:18px}}"+
".wah{display:flex;justify-content:space-between;align-items:center;gap:8px}.wah h3{margin:0;font:700 17px system-ui,sans-serif}"+
".wah span{color:var(--tr-muted,#6b6a64);font-size:12.5px}"+
".was label{display:flex;flex-direction:column;gap:5px;font:600 12px system-ui,sans-serif;color:var(--tr-muted,#6b6a64);text-transform:uppercase;letter-spacing:.04em}"+
".was input,.was select,.was textarea{font:500 15px system-ui,sans-serif;color:var(--tr-ink,#1c1b19);text-transform:none;letter-spacing:0;padding:10px}.was textarea{min-height:78px}#waTitle{text-transform:uppercase}"+
".wa2{display:grid;grid-template-columns:1fr 1fr;gap:10px}"+
".wat{display:flex;flex-wrap:wrap;gap:6px}.wat button{padding:6px 10px;font-size:12.5px;border-radius:999px;background:var(--tr-soft,#f0eee8);color:var(--tr-ink,#1c1b19);font-weight:600;border:1px solid transparent}"+
".wat button.on{background:var(--tr-acc,#4f46e5);color:#fff}.wat button.mo{font-weight:500}"+
".wab{display:flex;gap:8px;flex-wrap:wrap}.wab button{flex:1 1 auto}.wab .ghost{background:transparent;color:var(--tr-muted,#6b6a64);flex:0 0 auto}"+
".waerr{color:#991b1b;font-size:13px}"+
".waup{display:flex;flex-direction:column;gap:5px;background:#fbf7ec;border:1px solid #f1e3bf;border-radius:12px;padding:10px 12px;font-size:13.5px}.waup[hidden]{display:none}.waup b{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#713f12}.waup span{font-weight:650}.waup small{color:var(--tr-muted,#6b6a64)}"+
".was label.wach{flex-direction:row;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font:500 13.5px system-ui,sans-serif;color:var(--tr-ink,#1c1b19)}.was label.wach input{width:auto;padding:0}"+
".wad.upd{background:#fbf7ec;color:#713f12}"+
".wapick{align-self:flex-start;padding:8px 12px;font-size:13.5px}"+
".wapk{display:flex;flex-direction:column;gap:8px;border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:10px}.wapk[hidden]{display:none}.wapk input{font:500 15px system-ui,sans-serif;padding:10px}"+
".wapkl{max-height:42vh;overflow:auto;display:flex;flex-direction:column;gap:4px}.wapkl button{text-align:left;background:var(--tr-soft,#f0eee8);color:var(--tr-ink,#1c1b19);border-radius:10px;padding:9px 10px;font:600 13.5px/1.3 system-ui,sans-serif}.wapkl small{display:block;font-weight:500;color:var(--tr-muted,#6b6a64);font-size:11.5px}.wapkl p{margin:4px 2px;color:var(--tr-muted,#6b6a64);font-size:13px}";
document.head.appendChild(css);

/* the editor sheet, shared by the startup popup and the list */
var modal=document.createElement("div");modal.className="wam";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-label","WhatsApp Review");
modal.innerHTML='<div class="was"><div class="wah"><h3>WhatsApp Review</h3><span id="waPos"></span></div>'+
'<div class="waup" id="waUp" hidden><b>Update to an existing task</b><span id="waUpT"></span><small>Approve adds the notes below to that task&#39;s description, dated. It stays one task: no new task, no sub-task.</small><label class="wach"><input type="checkbox" id="waNew"> Create a new task instead</label></div>'+
'<button type="button" class="secondary wapick" id="waPick">＋ Add to an existing task…</button>'+
'<div class="wapk" id="waPk" hidden><input id="waPkQ" type="search" placeholder="Search your tasks (place, consumer no., name…)" autocomplete="off"><div class="wapkl" id="waPkL"></div><button type="button" class="secondary" id="waPkX">Cancel</button></div>'+
'<div id="waTaskF"><label>Title<input id="waTitle" autocomplete="off"></label>'+
'<label>Tags<div class="wat" id="waTags"></div></label>'+
'<div class="wa2"><label>Goes to<select id="waDest"></select></label><label>Due<input id="waDue" type="date"></label></div>'+
'<div class="wa2"><label>Priority<select id="waPri"></select></label><label>Repeat<select id="waRep"><option value="daily">Daily</option><option value="none">Does not repeat</option></select></label></div></div>'+
'<label>Notes<textarea id="waNotes"></textarea></label><div class="walk" id="waLinks" hidden></div>'+
'<div class="waerr" id="waErr"></div>'+
'<div class="wab"><button id="waOk">Approve ✓</button><button id="waDel" class="danger">Discard</button></div>'+
'<div class="wab"><button id="waSkip" class="secondary">Skip for now</button><button id="waLater" class="ghost">Close</button></div></div>';
document.body.appendChild(modal);
$("waDest").innerHTML=DEST.map(function(d){return '<option value="'+d[0]+'">'+d[1]+'</option>'}).join("");
$("waPri").innerHTML=PRI.map(function(d){return '<option value="'+d[0]+'">'+d[1]+'</option>'}).join("");
modal.addEventListener("click",function(e){if(e.target===modal)close()});
$("waTags").addEventListener("click",function(e){var b=e.target.closest("button");if(b){e.preventDefault();b.classList.toggle("on")}});

function tagsHtml(sel){var s={};(sel||[]).forEach(function(t){s[String(t).toLowerCase()]=1});
  var extra=(sel||[]).map(function(t){return String(t).toLowerCase()}).filter(function(t){return TAGS.indexOf(t)<0&&MORE.indexOf(t)<0});
  return TAGS.concat(extra).map(function(t){return '<button type="button" data-t="'+esc(t)+'" class="'+(s[t]?"on":"")+'">'+esc(t.toUpperCase())+'</button>'}).join("")+
    MORE.map(function(t){return '<button type="button" data-t="'+t+'" class="mo '+(s[t]?"on":"")+'">'+t+'</button>'}).join("");}
function open(i){if(!items.length){close();return}cur=Math.max(0,Math.min(i,items.length-1));var it=items[cur];
  $("waPos").textContent=(cur+1)+" of "+items.length;$("waTitle").value=it.title;$("waTags").innerHTML=tagsHtml(it.tags);
  $("waDest").value=it.target||"inbox";$("waDue").value=it.due||"";$("waPri").value=String(it.priority||0);$("waRep").value=it.repeat==="daily"?"daily":"none";$("waNotes").value=it.notes||"";driveLinks();$("waErr").textContent="";
  $("waUp").hidden=!it.update;$("waNew").checked=false;$("waTaskF").hidden=!!it.update;if(it.update)$("waUpT").textContent=(it.update.title||"(existing task)")+(it.update.projectName?" · "+it.update.projectName:"");
  $("waPk").hidden=true;$("waPick").hidden=false;$("waPick").textContent=it.update?"Choose a different task…":"＋ Add to an existing task…";
  modal.hidden=false;}
function close(){modal.hidden=true;cur=-1;}
function current(){var it=items[cur];return {id:it.id,title:($("waTitle").value.trim()||it.title).toUpperCase(),tags:[].map.call($("waTags").querySelectorAll("button.on"),function(b){return b.dataset.t}),
  target:$("waDest").value,due:$("waDue").value,priority:+$("waPri").value,repeat:$("waRep").value,notes:$("waNotes").value.trim(),mode:it.update&&!$("waNew").checked?"update":"new",update:it.update?it.update.id:"",uproject:it.update?it.update.project:"",utitle:it.update?it.update.title:""};}
function driveLinks(){var box=$("waLinks");if(!box)return;var t=$("waNotes").value||"",out=[],seen={};t.split(/\n/).forEach(function(line){var re=/https:\/\/(?:drive|docs)\.google\.com\/[^\s)>\]]+/g,m;while((m=re.exec(line))){var u=m[0];if(seen[u])continue;seen[u]=1;var lbl=line.slice(0,m.index).replace(/^[\s\-\u2022\u{1F4CE}]+/u,"").replace(/^drive\s*:\s*/i,"").replace(/(drive|link)?\s*[:\-\u2013]\s*$/i,"").trim()||"Drive file";out.push('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">\u{1F4CE} '+esc(lbl.slice(0,60))+'</a>')}});box.innerHTML=out.join("");box.hidden=!out.length}
async function post(body){var r=await fetch(URLB(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  var d={};try{d=await r.json()}catch(e){}if(!r.ok||d.error)throw new Error(d.error||("HTTP "+r.status));return d;}
async function act(kind){if(busy||cur<0)return;busy=true;$("waErr").textContent="";var b=kind==="approve"?$("waOk"):$("waDel"),t=b.textContent;b.textContent="…";
  try{var body=kind==="approve"?current():{id:items[cur].id};body.action=kind;await post(body);items.splice(cur,1);paint();
    if(items.length)open(Math.min(cur,items.length-1));else close();}
  catch(e){$("waErr").textContent="Could not "+kind+": "+e.message}
  finally{b.textContent=t;busy=false;}}
$("waOk").addEventListener("click",function(){act("approve")});
$("waNew").addEventListener("change",function(){$("waTaskF").hidden=!this.checked;});
$("waNotes").addEventListener("input",driveLinks);
/* pick the task yourself: searchable list of open tasks (Inbox, SCHEDULE, PROJECTS, REFERENCE, CHECKLISTS) */
var allTasks=null;
function pkDraw(){var q=$("waPkQ").value.trim().toLowerCase(),L=$("waPkL");if(!allTasks){L.innerHTML="<p>Loading your tasks…</p>";return}
  var words=q.split(/\s+/).filter(Boolean),hit=allTasks.filter(function(t){var h=(t.title+" "+t.project+" "+(t.tags||[]).join(" ")).toLowerCase();return words.every(function(w){return h.indexOf(w)>=0})}).slice(0,60);
  L.innerHTML=hit.length?hit.map(function(t,i){return '<button type="button" data-k="'+i+'">'+esc(t.title)+'<small>'+esc(t.project)+((t.tags||[]).length?" · "+esc(t.tags.join(", ").toUpperCase()):"")+'</small></button>'}).join(""):"<p>No open task matches.</p>";
  L.querySelectorAll("button").forEach(function(b){b.onclick=function(){var t=hit[+b.dataset.k];items[cur].update={id:t.id,project:t.projectId,title:t.title,projectName:t.project};open(cur);}});}
$("waPick").addEventListener("click",async function(){$("waPk").hidden=false;$("waPick").hidden=true;$("waPkQ").value="";pkDraw();$("waPkQ").focus();
  if(!allTasks){try{var r=await fetch(URLB()+"&list=tasks",{cache:"no-store"});var d=await r.json();if(d.error)throw new Error(d.error);allTasks=d.tasks||[];}catch(e){$("waPkL").innerHTML="<p>Couldn't load tasks: "+esc(e.message)+"</p>";return}pkDraw();}});
$("waPkQ").addEventListener("input",pkDraw);
$("waPkX").addEventListener("click",function(){$("waPk").hidden=true;$("waPick").hidden=false;});
$("waDel").addEventListener("click",function(){act("discard")});
$("waSkip").addEventListener("click",function(){if(cur<items.length-1)open(cur+1);else close()});
$("waLater").addEventListener("click",close);
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!modal.hidden)close()});

/* list on the Tasks › WhatsApp Review page, plus the badge on the Tasks tile */
function paint(){var n=items.length,b=$("bWa");if(b){b.hidden=!n;b.textContent=n>99?"99+":n}
  var l=$("waList");if(!l)return;$("waStatus").textContent=n?n+" item"+(n>1?"s":"")+" waiting. Tap one to edit, retag and approve.":"Nothing waiting. New WhatsApp items appear here after Claude's review.";
  $("waAll").hidden=!n;$("waOne").hidden=!n;
  l.innerHTML=items.map(function(it,i){var dest=(DEST.filter(function(d){return d[0]===it.target})[0]||DEST[0])[1].replace(" (task)","");
    if(it.update)return '<button type="button" class="wai" data-i="'+i+'"><span class="wad upd">Update</span><span><b>'+esc(it.update.title||it.title)+'</b><small>adds a dated note to this task</small></span></button>';
    return '<button type="button" class="wai" data-i="'+i+'"><span class="wad'+(it.target==="reference"?" ref":"")+'">'+esc(dest)+'</span><span><b>'+esc(it.title)+'</b><small>'+
      esc((it.tags||[]).join(" · ").toUpperCase())+(it.repeat==="daily"?" · daily":"")+(it.due?" · from "+esc(it.due):"")+'</small></span></button>'}).join("");}
async function load(){try{var r=await fetch(URLB(),{cache:"no-store"});var d=await r.json();if(d.error)throw new Error(d.error);items=d.items||[];paint();return true}
  catch(e){if($("waStatus"))$("waStatus").textContent="Could not reach the TickTick bridge: "+e.message;return false}}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".wai");if(b)open(+b.dataset.i)});
if($("waRefresh"))$("waRefresh").addEventListener("click",function(){$("waStatus").textContent="Loading…";load()});
if($("waOne"))$("waOne").addEventListener("click",function(){open(0)});
if($("waAll"))$("waAll").addEventListener("click",async function(){if(busy||!items.length)return;if(!confirmAll())return;busy=true;var btn=this,left=[];btn.textContent="Approving…";
  for(var i=0;i<items.length;i++){var it=items[i];try{await post({action:"approve",id:it.id,title:String(it.title).toUpperCase(),tags:it.tags,target:it.target,due:it.due,priority:it.priority,repeat:it.repeat,notes:it.notes,mode:it.update?"update":"new",update:it.update?it.update.id:"",uproject:it.update?it.update.project:"",utitle:it.update?it.update.title:""})}catch(e){left.push(it)}}
  items=left;paint();btn.textContent="Approve all as drafted";busy=false;if(left.length)$("waStatus").textContent=left.length+" could not be approved. Try them one by one.";});
function confirmAll(){return window.confirm("Approve all "+items.length+" items exactly as drafted?")}

/* on app start: if drafts are waiting, open them one by one (once per app start) */
load().then(function(ok){var started=false;try{started=sessionStorage.getItem("waPopupShown")==="1"}catch(e){}
  if(ok&&items.length&&!started&&!location.hash){try{sessionStorage.setItem("waPopupShown","1")}catch(e){}open(0)}});
window.addEventListener("hashchange",function(){if(location.hash==="#wa")load()});
})();
