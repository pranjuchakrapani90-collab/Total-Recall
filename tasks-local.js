/* Pranju OS · Tasks without TickTick (31 Oct 2026).
   Pranju OS keeps its own tasks. They live in localStorage "pos-tasks" and sync between phones through kvsync.js
   (encrypted, stored in Google Drive like every other section). Each task is stored as ONE JSON string, so the
   two phones merge whole tasks (the newer edit of a task wins) and the sync stays small.

   Every screen that used to ask the Worker for TickTick data (Today's Tasks, Task Recall, Delegation, Completed and
   Reference reviews, task details, WA Review's "add to an existing task") still makes the same request; this file
   answers it here from the local store, in the same shape the Worker used to return. So the screens look the same.
   It only does that once the tasks have been imported (Tasks page → Import from TickTick); before that, requests
   go to TickTick as they always did.

   Task (decoded):
     id, ti title, pj list (inbox|schedule|projects|checklists|reference|archive), tg tags (lower case),
     c notes, it checklist [{ti,d}], du due YYYY-MM-DD ("" = no date), tm time HH:MM, rp repeat ("" or RRULE),
     pr priority 0/1/3/5, st 0 open / 2 closed, cd closed on, cr created ISO, md modified ISO,
     h {YYYY-MM-DD: what happened that day: cont|fin|push|later|done}, cm comments [{x,at}]
   Load after pos-guard.js and kvsync.js, before any page script. */
(function(){
"use strict";
var KEY="pos-tasks",TZ="Asia/Kolkata";
var LISTS=[["inbox","Inbox"],["schedule","SCHEDULE"],["projects","PROJECTS"],["checklists","CHECKLISTS"],["reference","REFERENCE"],["archive","ARCHIVE"],["abandoned","ABANDONED"]];
var LISTNAME={};LISTS.forEach(function(l){LISTNAME[l[0]]=l[1]});
var RESP=["SDE-TECH","SDE-REV","SDE-ESTT","HOME-MANAGER","BROTHER","SON"];
var DAILY="RRULE:FREQ=DAILY;INTERVAL=1";

/* ---------- dates (India time) ---------- */
var FMT=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}),tdC="",tdAt=0;
function today(){var n=Date.now();if(n-tdAt>20000){tdC=FMT.format(new Date(n));tdAt=n}return tdC}
function addDays(iso,n){var d=new Date(iso+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function dow(iso){return new Date(iso+"T12:00:00Z").getUTCDay()}
function daysIn(y,m){return new Date(Date.UTC(y,m+1,0)).getUTCDate()}
function addMonths(iso,n,dom){var y=+iso.slice(0,4),m=+iso.slice(5,7)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;
  var d=Math.min(dom||+iso.slice(8,10),daysIn(y,m));return y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0")}
function nowIso(){return new Date().toISOString()}

/* ---------- repeats: the RRULEs TickTick uses (daily, weekly on days, monthly on a date, yearly) ---------- */
function parseRule(rp){var o={};String(rp||"").replace(/^[A-Z]*RRULE:/i,"").split(";").forEach(function(kv){var p=kv.split("=");if(p[0])o[p[0].toUpperCase()]=p[1]||""});
  o.FREQ=(o.FREQ||"").toUpperCase();o.INTERVAL=Math.max(1,parseInt(o.INTERVAL,10)||1);return o;}
var WD={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};
/* the next occurrence strictly after `from`; anchor = the date the rule counts from */
function nextOcc(rp,from,anchor){var r=parseRule(rp);anchor=anchor||from;
  if(r.FREQ==="WEEKLY"){
    var days=(r.BYDAY||"").split(",").map(function(x){return WD[x.replace(/[^A-Z]/gi,"").toUpperCase()]}).filter(function(x){return x!=null});
    if(!days.length)return addDays(from,7*r.INTERVAL);
    var a0=addDays(anchor,-dow(anchor));
    for(var i=1;i<=7*r.INTERVAL+7;i++){var d=addDays(from,i);var wk=Math.round((Date.parse(addDays(d,-dow(d)))-Date.parse(a0))/6048e5);
      if(days.indexOf(dow(d))>=0&&((wk%r.INTERVAL)+r.INTERVAL)%r.INTERVAL===0)return d;}
    return addDays(from,7);}
  if(r.FREQ==="MONTHLY"){var dom=parseInt(r.BYMONTHDAY,10)||+anchor.slice(8,10);var d2=addMonths(from,0,dom);if(d2<=from)d2=addMonths(from,r.INTERVAL,dom);return d2;}
  if(r.FREQ==="YEARLY"){var d3=String(+from.slice(0,4))+anchor.slice(4);if(d3<=from)d3=String(+from.slice(0,4)+r.INTERVAL)+anchor.slice(4);
    if(d3.slice(5)==="02-29"&&daysIn(+d3.slice(0,4),1)<29)d3=d3.slice(0,5)+"02-28";return d3;}
  return addDays(from,r.INTERVAL);/* DAILY and anything unknown */}
/* move a repeating task's date forward until it is after `day` */
function advance(t,day){var d=t.du||day,anchor=t.du||day,n=0;while(d<=day&&n++<4000)d=nextOcc(t.rp,d,anchor);return d;}
function repeatLabel(rp){if(!rp)return "";var r=parseRule(rp),n=r.INTERVAL;
  if(r.FREQ==="DAILY")return n>1?"Every "+n+" days":"Daily";
  if(r.FREQ==="WEEKLY")return (n>1?"Every "+n+" weeks":"Weekly")+(r.BYDAY?" ("+r.BYDAY.split(",").map(function(x){return x.charAt(0)+x.slice(1).toLowerCase()}).join(", ")+")":"");
  if(r.FREQ==="MONTHLY")return n>1?"Every "+n+" months":"Monthly";
  if(r.FREQ==="YEARLY")return "Yearly";return "Repeats";}

/* ---------- the store ---------- */
var ls;try{ls=window.localStorage}catch(e){ls=null}
function raw(){var d={};try{d=JSON.parse(ls.getItem(KEY)||"{}")||{}}catch(e){}d.t=d.t||{};d.meta=d.meta||{};return d;}
function dec(s){try{var t=typeof s==="string"?JSON.parse(s):s;return t&&t.ti!=null?t:null}catch(e){return null}}
function enc(t){return JSON.stringify(t)}
/* parsed tasks are cached: reading the 1–2 MB store on every call made screens slow (2 Nov 2026). The cache is dropped on
   every write here, when the other phone's changes arrive (kvsync) or another tab writes (storage), and re-checked every 3 s. */
var cache=null,cacheRaw=null,cacheAt=0,cacheMeta={};
function all(){var now=Date.now();if(cache&&now-cacheAt<3000)return cache;var s=ls?ls.getItem(KEY):null;if(cache&&s===cacheRaw){cacheAt=now;return cache}var d=raw(),out={};
  Object.keys(d.t).forEach(function(id){var t=dec(d.t[id]);if(t){t.id=id;out[id]=t}});cache=out;cacheRaw=s;cacheAt=now;cacheMeta=d.meta;return out;}
try{window.addEventListener("kvsync",function(){cache=null});window.addEventListener("storage",function(e){if(!e.key||e.key===KEY)cache=null});}catch(e){}
function on(){all();return !!cacheMeta.on}
function meta(){all();return cacheMeta}
function writeRaw(d){try{ls.setItem(KEY,JSON.stringify(d));cache=null;return true}catch(e){console.warn("Pranju OS tasks: could not save",e);throw new Error("This phone's storage is full — the task was not saved.")}}
function clean(t){var o={ti:String(t.ti||"").trim()||"(Untitled task)",pj:LISTNAME[t.pj]?t.pj:"inbox",tg:(t.tg||[]).map(function(x){return String(x).trim().replace(/^#/,"").toLowerCase().replace(/\s+/g,"-")}).filter(Boolean),
  c:String(t.c||""),it:(t.it||[]).filter(function(x){return x&&String(x.ti||"").trim()}).map(function(x){return {ti:String(x.ti).trim(),d:x.d?1:0}}),
  du:/^\d{4}-\d{2}-\d{2}$/.test(t.du||"")?t.du:"",tm:/^\d{2}:\d{2}$/.test(t.tm||"")?t.tm:"",rp:String(t.rp||""),pr:[0,1,3,5].indexOf(+t.pr)>=0?+t.pr:0,
  st:t.st===2?2:0,cd:t.cd||"",cr:t.cr||nowIso(),md:nowIso(),h:t.h||{},cm:t.cm||[]};
  if(t.src)o.src=t.src;if(t.prev)o.prev=t.prev;if(t.ad)o.ad=t.ad;if(o.tg.length>1)o.tg=o.tg.filter(function(x,i){return o.tg.indexOf(x)===i});return o;}
function put(t){var d=raw(),id=t.id||("l"+Date.now().toString(36)+Math.random().toString(36).slice(2,7));var o=clean(t);d.t[id]=enc(o);writeRaw(d);o.id=id;emit([id]);return o;}
function del(id){var d=raw();if(!d.t[id])return;delete d.t[id];writeRaw(d);emit([id]);}
function get(id){return all()[id]||null}
function emit(ids){try{window.dispatchEvent(new CustomEvent("pos-tasks",{detail:ids}))}catch(e){}}
window.addEventListener("kvsync",function(e){if((e.detail||[]).indexOf(KEY)>=0){cache=null;emit([])}});

/* ---------- what a tap does ----------
   kind: done (plain tick) · cont (work done, continues) · push (not done, to tomorrow) · fin (done and dusted) · later (to `date`) */
function act(id,kind,date){var t=get(id);if(!t)throw new Error("That task is no longer in Pranju OS.");var td=today(),out={ok:true};
  if(t.st===2&&kind!=="reopen")return {ok:true,completed:false,reason:"closed"};
  t.h=Object.assign({},t.h);
  if(kind==="reopen"){t.st=0;t.cd="";put(t);return {ok:true};}
  /* Archive (no longer needed now, may matter some day) / Abandon (no future): off every daily list, kept for review.
     The task's old list, date and repeat are kept in t.prev so "restore" can bring it back (2 Nov 2026). */
  if(kind==="archive"||kind==="abandon"){if(!(t.pj==="archive"||t.pj==="abandoned"))t.prev={pj:t.pj,du:t.du,rp:t.rp};
    t.pj=kind==="archive"?"archive":"abandoned";t.du="";t.rp="";t.ad=td;t.h[td]=kind;put(t);return {ok:true,moved:true,list:t.pj};}
  if(kind==="restore"){var pv=t.prev||{pj:"inbox",du:td,rp:""};t.pj=pv.pj&&pv.pj!=="archive"&&pv.pj!=="abandoned"?pv.pj:"inbox";
    t.rp=pv.rp||"";t.du=!pv.du||pv.du<td?td:pv.du;delete t.prev;delete t.ad;if(t.h[td]==="archive"||t.h[td]==="abandon")delete t.h[td];put(t);return {ok:true,restored:true,list:t.pj,next:t.du};}
  /* left pending yesterday (or earlier), doing it today: the missed day counts as pushed, the task is due today (2 Nov 2026) */
  if(kind==="today"){var y=addDays(td,-1);if(!t.h[y])t.h[y]="push";if(!t.du||t.du!==td)t.du=td;put(t);return {ok:true,moved:true,next:td};}
  /* undo today's choice: forget it and bring the task back to today */
  if(kind==="undo"){var was=t.h[td];delete t.h[td];if(t.st===2&&t.cd===td&&was){t.st=0;t.cd="";}if(t.du&&t.du>td)t.du=td;put(t);return {ok:true,next:td};}
  if(kind==="fin"){t.st=2;t.cd=td;t.rp="";t.h[td]="fin";put(t);return {ok:true,completed:true,closed:true};}
  if(kind==="later"){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||date<=td)throw new Error("Pick a date after today");
    var added=!t.rp;t.du=date;if(!t.rp)t.rp=DAILY;t.h[td]="later";put(t);return {ok:true,moved:true,next:date,repeatAdded:added};}
  if(t.rp){if(t.du&&t.du>td){out.completed=false;out.reason="already-done-today";out.next=t.du;t.h[td]=t.h[td]||kind;put(t);return out;}
    t.du=advance(t,td);t.h[td]=kind;put(t);return {ok:true,completed:true,next:t.du};}
  /* no repeat: a plain tick closes it; "continues" and "push" bring it back tomorrow */
  if(kind==="done"){t.st=2;t.cd=td;t.h[td]="done";put(t);return {ok:true,completed:true,closed:true};}
  t.du=addDays(td,1);t.h[td]=kind;put(t);return {ok:true,moved:true,completed:true,next:t.du};}

/* ---------- import from TickTick (one time; again later only adds what is new) ---------- */
function fromTick(x,listKey){var due="",tm="";
  if(x.dueDate||x.startDate){var v=x.dueDate||x.startDate,dt=new Date(v);if(!isNaN(dt)){due=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(dt);
    if(!x.isAllDay)tm=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(dt);}}
  var notes=String(x.content||"");if(x.desc&&String(x.kind||"").toUpperCase()==="CHECKLIST")notes=String(x.desc)+(notes?"\n"+notes:"");
  return {ti:x.title||"",pj:listKey,tg:Array.isArray(x.tags)?x.tags:[],c:notes,it:(x.items||[]).map(function(i){return {ti:i.title,d:i.status?1:0}}),
    du:due,tm:tm==="00:00"?"":tm,rp:x.repeatFlag||"",pr:x.priority||0,st:0,cr:x.createdTime||nowIso(),src:"tt"};}
function importTick(data){var d=raw(),n=0,skip=0;(data.lists||[]).forEach(function(L){(L.tasks||[]).forEach(function(x){if(!x||!x.id)return;
    if(d.t[x.id]){skip++;return}var o=clean(fromTick(x,L.key));d.t[x.id]=enc(o);n++;});});
  d.meta.on=1;d.meta.imported=d.meta.imported||nowIso();d.meta.lastImport=nowIso();writeRaw(d);emit([]);return {added:n,kept:skip,total:Object.keys(d.t).length,bytes:(ls.getItem(KEY)||"").length};}

/* ---------- TickTick's backup file (Settings → Account → Generate Backup, CSV) ----------
   Brings in what the API can't give: completed tasks and the days each task was ticked. Its taskIds are only row numbers,
   so rows are matched by title (same list first). A completion is "tick" (a daily task pushed on, as the old Completed
   review counted it) when the same title was due again the next day; otherwise "done". Safe to run again: dates merge,
   closed tasks get fixed ids. Long notes of closed tasks are cut to 600 characters (the full file is kept in Drive). */
function istDate(v){if(!v)return "";var d=new Date(v);return isNaN(d)?"":new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function hashStr(x){var h=5381;for(var i=0;i<x.length;i++)h=((h<<5)+h+x.charCodeAt(i))>>>0;return h.toString(36)}
function norm(x){return String(x||"").trim().toLowerCase().replace(/\s+/g," ")}
function checklistOf(c){var parts=String(c||"").split(/(?=[▫▪])/),items=[],rest=[];parts.forEach(function(p){var m=p.match(/^([▫▪])([\s\S]*)$/);
  if(m){var ti=m[2].trim();if(ti)items.push({ti:ti,d:m[1]==="▪"?1:0})}else if(p.trim())rest.push(p.trim())});return {items:items,notes:rest.join("\n")};}
function importBackup(rows){var d=raw(),T=all(),byTitle={};Object.keys(T).forEach(function(id){var t=T[id],k=norm(t.ti);(byTitle[k]=byTitle[k]||[]).push(t)});
  var listKey=function(n){n=norm(n);return LISTNAME[n]?n:(n==="inbox"?"inbox":"inbox")};
  var dueSet={};rows.forEach(function(r){var k=norm(r["Title"]),dd=istDate(r["Due Date"]||r["Start Date"]);if(dd)(dueSet[k]=dueSet[k]||{})[dd]=1});
  var groups={},added=0,closed=0,dates=0,openAdded=0;
  rows.forEach(function(r){var k=norm(r["Title"]);if(!k)return;var lk=listKey(r["List Name"]);
    if(String(r["Status"])==="0"){/* open: only add it if Pranju OS doesn't have it */
      var have=(byTitle[k]||[]).filter(function(t){return t.st!==2});if(have.length)return;
      var id="b"+hashStr(lk+"|"+k+"|open");if(d.t[id])return;var cl=r["Kind"]==="CHECKLIST"?checklistOf(r["Content"]):{items:[],notes:r["Content"]};
      var due=istDate(r["Due Date"]||r["Start Date"]),tm="";if(due&&r["Is All Day"]!=="true"){tm=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r["Due Date"]||r["Start Date"]));if(tm==="00:00")tm="";}
      var o=clean({ti:r["Title"],pj:lk,tg:String(r["Tags"]||"").split(",").map(function(x){return x.trim()}),c:cl.notes,it:cl.items,du:due,tm:tm,rp:r["Repeat"]?"RRULE:"+r["Repeat"]:"",pr:+r["Priority"]||0,cr:r["Created Time"]||nowIso(),src:"ttb"});
      d.t[id]=enc(o);(byTitle[k]=byTitle[k]||[]).push(Object.assign({id:id},o));openAdded++;return;}
    (groups[lk+"|"+k]=groups[lk+"|"+k]||{k:k,lk:lk,rows:[]}).rows.push(r);});
  Object.keys(groups).forEach(function(gk){var g=groups[gk],h={};
    g.rows.forEach(function(r){var cd=istDate(r["Completed Time"]);if(!cd)return;h[cd]=(dueSet[g.k]||{})[addDays(cd,1)]?"tick":"done";});
    if(!Object.keys(h).length)return;
    var open=(byTitle[g.k]||[]).filter(function(t){return t.st!==2}),target=open.filter(function(t){return t.pj===g.lk})[0]||open[0];
    if(target){var t=dec(d.t[target.id])||target;t.h=Object.assign({},h,t.h||{});dates+=Object.keys(h).length;d.t[target.id]=enc(t);return;}
    var last=g.rows.reduce(function(a,b){return String(b["Completed Time"])>String(a["Completed Time"])?b:a}),id="b"+hashStr(gk),cl=last["Kind"]==="CHECKLIST"?checklistOf(last["Content"]):{items:[],notes:last["Content"]};
    var notes=String(cl.notes||"");if(notes.length>600)notes=notes.slice(0,600)+"\n… (shortened; the full text is in the TickTick backup file in Drive)";
    var prev=dec(d.t[id]),hh=Object.assign({},h,prev&&prev.h||{}),days=Object.keys(hh).sort();
    var o=clean({ti:last["Title"],pj:g.lk,tg:String(last["Tags"]||"").split(",").map(function(x){return x.trim()}),c:notes,it:cl.items,du:"",rp:"",pr:+last["Priority"]||0,st:2,cr:last["Created Time"]||nowIso(),h:hh,src:"ttb"});
    o.cd=days[days.length-1];d.t[id]=enc(o);dates+=Object.keys(h).length;if(prev)return;closed++;});
  d.meta.backup=nowIso();writeRaw(d);emit([]);return {openAdded:openAdded,closed:closed,dates:dates,total:Object.keys(d.t).length,bytes:(ls.getItem(KEY)||"").length};}

/* ---------- answers to the Worker's TickTick requests ---------- */
function upTags(t){return (t.tg||[]).map(function(x){return x.toUpperCase()})}
function item(t,td){return {id:t.id,title:t.ti,due:t.du+(t.tm?"T"+t.tm:""),projectId:t.pj,tags:upTags(t),overdue:!!t.du&&t.du<td}}
function todayRes(){var td=today(),groups={},tags={},n=0,due=0,tagged=0;RESP.forEach(function(k){groups[k]=[]});
  var T=all();Object.keys(T).forEach(function(id){var t=T[id];if(t.st===2)return;n++;if(!t.du||t.du>td)return;due++;
    var it=item(t,td),tg=upTags(t);tg.forEach(function(g){(tags[g]=tags[g]||[]).push(it)});var m=RESP.filter(function(r){return tg.indexOf(r)>=0});if(m.length)tagged++;m.forEach(function(r){groups[r].push(it)});});
  Object.keys(tags).forEach(function(k){tags[k].sort(function(a,b){return a.due.localeCompare(b.due)||a.title.localeCompare(b.title)})});
  return {date:td,timeZone:TZ,responsibilities:groups,tags:tags,debug:{source:"Pranju OS",taskCount:n,dueMatches:due,taggedMatches:tagged,overdueFetched:0}};}
function detailRes(id){var t=get(id);if(!t)throw new Error("That task is no longer in Pranju OS.");
  return {task:{id:t.id,projectId:t.pj,title:t.ti,content:t.c,items:t.it.map(function(x){return {title:x.ti,status:x.d?2:0}}),tags:t.tg,dueDate:t.du?(t.du+(t.tm?" "+t.tm:"")):"",repeat:repeatLabel(t.rp),list:LISTNAME[t.pj],local:true},
    comments:(t.cm||[]).map(function(x){return {content:x.x,createdTime:x.at}})};}
function inRange(d,s,e){return d&&(!s||d>=s)&&(!e||d<=e)}
/* Reference / Archive / Abandoned review: list = reference (by date added) | archive | abandoned (by date moved there) */
function referenceRes(s,e,list){list=list==="archive"||list==="abandoned"?list:"reference";var T=all(),tags={},n=0;Object.keys(T).forEach(function(id){var t=T[id];if(t.pj!==list||t.st===2)return;
    var cd=list==="reference"?String(t.cr||"").slice(0,10):(t.ad||String(t.md||t.cr||"").slice(0,10));if((s||e)&&!inRange(cd,s,e))return;n++;var tg=upTags(t);if(!tg.length&&list!=="reference")tg=["UNTAGGED"];
    tg.forEach(function(g){(tags[g]=tags[g]||[]).push({id:t.id,title:t.ti,due:t.du,projectId:list,tags:tg,moved:list==="reference"?"":cd})});});
  return {section:LISTNAME[list],projectId:list,projectName:LISTNAME[list],start:s||null,end:e||null,taskCount:n,tags:tags};}
/* Completed = done and dusted (5 Nov 2026): only tasks that are closed for good, on the day they were closed.
   A "done today, continues", a finished step, or a tick on a repeating task is not completion — that task is still open. */
function completedRes(s,e){var T=all(),out=[];Object.keys(T).forEach(function(id){var t=T[id];if(t.st!==2||!t.cd||!inRange(t.cd,s,e))return;
    out.push({id:t.id,title:t.ti,projectId:t.pj,tags:upTags(t),completionDates:[t.cd],completionCount:1});});
  out.sort(function(a,b){return a.title.localeCompare(b.title)});return {start:s,end:e,timeZone:TZ,uniqueCount:out.length,tasks:out};}
function listRes(){var T=all(),out=[];Object.keys(T).forEach(function(id){var t=T[id];if(t.st===2||t.pj==="archive"||t.pj==="abandoned")return;
    out.push({id:t.id,projectId:t.pj,project:LISTNAME[t.pj],title:t.ti,tags:t.tg,m:t.md||t.cr||""})});
  out.sort(function(a,b){return String(b.m).localeCompare(String(a.m))});return {tasks:out};}
function dateLabel(){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,day:"numeric",month:"short",year:"numeric"}).format(new Date())}
/* WA Review approve: the draft is dropped from the review first (network), then the task is made here */
function approveLocal(b){var td=today();
  if(b.mode==="update"&&b.update){var t=get(b.update);if(!t)throw new Error("That task is no longer in Pranju OS.");
    var text=dateLabel()+": "+String(b.notes||"").trim();t.c=(String(t.c||"").trim()?String(t.c).trim()+"\n\n---\n":"")+text;put(t);return {ok:true,updated:t.id};}
  var due=/^\d{4}-\d{2}-\d{2}$/.test(b.due||"")?b.due:"",rp="";if(b.repeat==="daily"){rp=DAILY;if(!due||due<td)due=td;}
  var tgt=String(b.target||"inbox").toLowerCase();
  var o=put({ti:String(b.title||"").toUpperCase(),pj:LISTNAME[tgt]?tgt:"inbox",tg:b.tags||[],c:b.notes||"",du:due,rp:rp,pr:b.priority||0});
  return {ok:true,created:{id:o.id,projectId:o.pj}};}

/* ---------- the fetch shim ---------- */
var DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev";
function workerOrigin(){var u=null;try{u=ls.getItem("totalRecallTickTickUrl")}catch(e){}try{return new URL(u||window.TOTAL_RECALL_TICKTICK_URL||DEF).origin}catch(e){return new URL(DEF).origin}}
function reply(o,st){return Promise.resolve(new Response(JSON.stringify(o),{status:st||200,headers:{"Content-Type":"application/json"}}))}
var orig=window.fetch;
window.fetch=function(input,init){
  var url=typeof input==="string"?input:(input&&input.url)||String(input),u;
  try{u=new URL(url,location.href)}catch(e){return orig.apply(this,arguments)}
  if(!on()||(u.origin!==workerOrigin()&&u.origin!==new URL(DEF).origin))return orig.apply(this,arguments);
  var q=u.searchParams,mode=q.get("mode")||"",method=String((init&&init.method)||(input&&input.method)||"GET").toUpperCase(),self=this,args=arguments;
  var body=function(){try{return JSON.parse((init&&init.body)||"{}")}catch(e){return {}}};
  try{
    if(!mode&&(q.get("date")==="today"||u.pathname==="/responsibility-tasks"))return reply(todayRes());
    if(mode==="task-detail"||u.pathname==="/task-detail")return reply(detailRes(q.get("taskId")));
    if(mode==="reference"||u.pathname==="/reference-tasks")return reply(referenceRes(q.get("start")||"",q.get("end")||"",q.get("list")||""));
    if(mode==="completed"||u.pathname==="/completed-tasks")return reply(completedRes(q.get("start")||addDays(today(),-6),q.get("end")||today()));
    if(mode==="deleg-done"){var b=body();return reply(act(b.taskId,b.action||"cont",b.date));}
    if(mode==="wa-review"&&method==="GET"&&q.get("list")==="tasks")return reply(listRes());
    if(mode==="wa-review"&&method==="POST"){var w=body();if(w.action!=="approve")return orig.apply(self,args);
      /* drop the draft from the review, then make the task here */
      return orig.call(self,url,Object.assign({},init,{body:JSON.stringify({action:"discard",id:w.id,as:"approved",final:w})})).then(function(r){
        return r.json().catch(function(){return {}}).then(function(d){if(!r.ok||d.error)throw new Error(d.error||("HTTP "+r.status));return new Response(JSON.stringify(approveLocal(w)),{status:200,headers:{"Content-Type":"application/json"}})})});}
  }catch(e){return reply({error:String(e&&e.message||e)},400)}
  return orig.apply(this,arguments);};

/* ---------- a readable copy for Claude, and Claude's change requests ----------
   The store above is encrypted when it syncs, so Claude can't read it. A plain copy of the open tasks (and those closed in the
   last 30 days) goes to the "Tasks" tab of the Pranju OS Drafts sheet in Drive; Claude asks for changes by adding rows to its
   "Requests" tab, which this applies when the app is open (see handleTasksMirror in ticktick-worker.js). */
function wurl(qs){var u=null;try{u=ls.getItem("totalRecallTickTickUrl")}catch(e){}u=u||window.TOTAL_RECALL_TICKTICK_URL||DEF;return u+(u.indexOf("?")>=0?"&":"?")+qs}
function hasCode(){try{return (ls.getItem("totalRecallSyncCode_v1")||"").trim().length>=8}catch(e){return false}}
function lget(k){try{return ls.getItem(k)}catch(e){return null}}function lset(k,v){try{ls.setItem(k,v)}catch(e){}}
var mirrorTimer=0;
function mirrorSoon(ms){if(!on()||!hasCode())return;if(mirrorTimer&&!(ms&&ms<30000))return;clearTimeout(mirrorTimer);mirrorTimer=setTimeout(function(){mirrorTimer=0;mirror()},ms||30000)}
function mirror(){if(!on()||!hasCode())return;var T=all(),old=addDays(today(),-30),rows=[];
  Object.keys(T).forEach(function(id){var t=T[id];if(t.st===2&&!(t.cd>=old))return;
    rows.push([id,t.st===2?"CLOSED "+t.cd:LISTNAME[t.pj],t.ti,(t.tg||[]).join(", "),t.du,t.tm,repeatLabel(t.rp),t.pr||0,
      (t.it||[]).map(function(x){return (x.d?"☑ ":"☐ ")+x.ti}).join("; "),String(t.c||"").slice(0,4000),String(t.cr||"").slice(0,16),String(t.md||"").slice(0,16)])});
  rows.sort(function(a,b){return String(a[1]).localeCompare(String(b[1]))||String(a[2]).localeCompare(String(b[2]))});
  orig(wurl("mode=tasks-mirror"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:rows})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(d){if(r.ok&&!d.error){lset("pos-tasks-mirror-at",String(Date.now()));lset("pos-tasks-mirror-err","")}else lset("pos-tasks-mirror-err",String(d.error||("HTTP "+r.status)).slice(0,300))})})
    .catch(function(e){lset("pos-tasks-mirror-err",String(e&&e.message||e).slice(0,300))});}
function ruleFor(rep,due){rep=String(rep||"").trim();var d=due||today();if(!rep||/^(none|no)$/i.test(rep))return "";if(/RRULE/i.test(rep))return rep.toUpperCase().indexOf("RRULE:")===0?rep:"RRULE:"+rep;
  rep=rep.toLowerCase();if(rep==="daily")return DAILY;if(rep==="weekly")return "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY="+["SU","MO","TU","WE","TH","FR","SA"][dow(d)];
  if(rep==="monthly")return "RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY="+(+d.slice(8,10));if(rep==="yearly")return "RRULE:FREQ=YEARLY;INTERVAL=1";return DAILY;}
function fieldsOnto(t,j){if(j.title!=null)t.ti=String(j.title).toUpperCase();if(j.list!=null){var l=String(j.list).toLowerCase();if(LISTNAME[l])t.pj=l;}
  if(j.tags!=null)t.tg=Array.isArray(j.tags)?j.tags:String(j.tags).split(/[,\s]+/);if(j.notes!=null)t.c=String(j.notes);
  if(j.addNotes)t.c=(String(t.c||"").trim()?String(t.c).trim()+"\n\n---\n":"")+dateLabel()+": "+String(j.addNotes);
  if(j.due!=null)t.du=String(j.due);if(j.time!=null)t.tm=String(j.time);if(j.priority!=null)t.pr=+j.priority||0;
  if(j.repeat!=null)t.rp=ruleFor(j.repeat,t.du);if(t.rp&&!t.du)t.du=today();
  if(Array.isArray(j.checklist))t.it=j.checklist.map(function(x){return typeof x==="string"?{ti:x,d:0}:{ti:x.title||x.ti,d:x.done||x.d?1:0}});
  if(t.pj==="reference"&&j.list!=null&&j.due==null){t.du="";t.rp="";}return t;}
function applyReq(x){var j={};try{j=x.json?JSON.parse(x.json):{}}catch(e){throw new Error("JSON in column F is not valid")}
  var op=x.op;
  if(op==="sld-new")return sldNew(x,j);
  if(op==="add"){var o=put(fieldsOnto({ti:"",pj:"inbox",tg:[],c:"",du:"",rp:""},j));return "added "+o.id;}
  var t=get(x.task);if(!t)throw new Error("no task with id "+x.task);
  if(op==="update"||op==="move"){put(fieldsOnto(t,j));return "updated";}
  if(op==="comment"){t.cm=(t.cm||[]).concat([{x:String(j.text||j.comment||""),at:nowIso()}]);put(t);return "comment added";}
  if(op==="done"){var r=act(t.id,j.kind||"done",j.date);return "done"+(r.next?" · next "+r.next:"")+(r.closed?" · closed":"");}
  if(op==="reopen"){act(t.id,"reopen");return "reopened";}
  if(op==="delete"){del(t.id);return "deleted";}
  throw new Error("unknown op "+op);}
/* op "sld-new" (4 Nov 2026): Claude's WhatsApp review found locations he sent "To claude" for an SLD. A new Line Survey
   (localStorage "sld-survey-v1", synced by sld-survey.html) is created with each location as a "Marked point (details later)".
   JSON: {name, title?, loc?, fdr?, ss?, note?, points:[{lat,lng,label?,time?}]}. Same request id -> same survey (never twice). */
function sldNew(x,j){var pts=(Array.isArray(j.points)?j.points:[]).filter(function(p){return isFinite(+p.lat)&&isFinite(+p.lng)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lng)<=180});
  if(!pts.length)throw new Error("no valid points (lat/lng)");
  var K="sld-survey-v1",db;try{db=JSON.parse(localStorage.getItem(K)||"null")}catch(e){db=null}if(!db||!db.projects)db={projects:{},cur:null};
  var pid="wa"+String(x.id).replace(/[^A-Za-z0-9]/g,"").slice(0,24);if(db.projects[pid]&&!db.projects[pid].del)return "survey already there";
  var d=today(),yr=d.slice(0,4),n=0,mk=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)};
  var p={id:pid,name:String(j.name||("WhatsApp points "+d)).slice(0,120),upd:Date.now(),
    meta:{work:"",loc:String(j.loc||""),pay:"dept",doc:"SESD/"+yr+"/",date:d,ss:String(j.ss||""),fdr:String(j.fdr||""),fee:0,title:String(j.title||"")},
    opt:{north:false,gps:false,span:true,sign:false},set:{sHV:45,sMV:32,sEHV:33,sLT:40,sABC:33,sEarth:5,sStay:0,sSvc:30,sDB:1,sDBph:1},
    pts:pts.map(function(q){n++;return {id:mk(),no:n,kind:"mark",lat:+q.lat,lng:+q.lng,acc:null,src:"whatsapp",par:null,line:"",pole:"",cross:"",note:String(q.label||"").slice(0,80),qk:true,qt:"From WhatsApp"+(q.time?" "+q.time:"")}}),
    from:{wa:String(j.note||"").slice(0,500),req:String(x.id)}};
  db.projects[pid]=p;db.cur=pid;localStorage.setItem(K,JSON.stringify(db));
  return "survey \""+p.name+"\" created with "+n+" point"+(n>1?"s":"")+" (open Line Survey to sync it to your other devices)";}
var reqBusy=false;
function requests(force){if(!on()||!hasCode()||reqBusy)return;var last=+(lget("pos-tasks-req-at")||0);if(!force&&Date.now()-last<5*60e3)return;reqBusy=true;lset("pos-tasks-req-at",String(Date.now()));
  var dev=lget("pos-dev");if(!dev){dev=Math.random().toString(36).slice(2,10);lset("pos-dev",dev)}
  var post=function(b){return orig(wurl("mode=tasks-requests"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()})};
  orig(wurl("mode=tasks-requests"),{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){var L=(d&&d.requests)||[],done=0,chain=Promise.resolve();
    L.forEach(function(x){chain=chain.then(function(){return post({row:x.row,id:x.id,status:"claim",dev:dev}).then(function(c){if(!c||!c.ok)return;
      var res,st="done";try{res=applyReq(x);done++}catch(e){res=String(e&&e.message||e);st="failed"}return post({row:x.row,id:x.id,status:st,result:res});})})});
    return chain.then(function(){if(done){emit([]);try{window.dispatchEvent(new CustomEvent("pos-tasks-requests",{detail:{done:done}}))}catch(e){}}});})
    .catch(function(){}).then(function(){reqBusy=false});}
window.addEventListener("pos-tasks",function(){mirrorSoon(30000)});
setTimeout(function(){requests(false);if(Date.now()-(+(lget("pos-tasks-mirror-at")||0))>6*3600e3)mirrorSoon(4000)},3000);
document.addEventListener("visibilitychange",function(){if(!document.hidden)requests(false)});

/* ---------- editing on the back of a flash card (31 Oct 2026) ----------
   Task Recall and Delegation show this under the task's title when the card is flipped: notes (tap ✎ to edit),
   a one-line "add an update" that adds "dd/mm/yyyy: text" to the notes (his own way of logging progress),
   checklist ticks and new checklist items. Taps inside it never flip the card. */
(function(){var css=document.createElement("style");css.textContent=
".pte{padding:12px 16px 14px;display:flex;flex-direction:column;gap:12px;cursor:auto;text-align:left}"+
".pte .pn{font-size:15px;line-height:1.55;word-break:break-word}.pte .pn p{margin:0 0 7px}.pte .pn ul{margin:0 0 6px;padding-left:20px}.pte .pn hr{border:0;border-top:1px solid var(--tr-line,#e6e3db);margin:10px 0}"+
".pte .pn a{word-break:break-all}.pte .pn a.lk{display:inline-block;word-break:normal;font-size:13px;font-weight:650;text-decoration:none;background:var(--tr-acc-soft,#eef2ff);color:var(--tr-acc-ink,#3730a3);border-radius:999px;padding:1px 10px;margin-left:4px;white-space:nowrap}"+
".pte .pn .nd{display:inline-block;font-size:12px;font-weight:700;background:#f1efe8;color:#57534e;border-radius:6px;padding:0 6px;margin-right:8px}.pte .pn .nu{padding-left:0}"+
".pte .pn .ns{font-size:12.5px;color:var(--tr-muted,#6b6a64)}.pte .pn .nh{font-size:12.5px;font-weight:700;color:var(--tr-muted,#6b6a64);text-transform:none;margin:4px 0 6px}"+
".pte .pn .nb p{margin:0 0 4px}.pte .pn .nb{margin:0 0 8px}"+
".pte .pe{color:var(--tr-muted,#6b6a64);font-size:13.5px}"+
".pte .pr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"+
".pte button{font:600 13px system-ui,sans-serif;border:1px solid var(--tr-line,#e6e3db);background:var(--tr-paper,#fff);color:var(--tr-ink,#1c1b19);border-radius:10px;padding:8px 12px;cursor:pointer}"+
".pte button.pri{background:var(--tr-acc,#4f46e5);border-color:var(--tr-acc,#4f46e5);color:#fff}.pte button.lnk{border:0;background:none;color:var(--tr-acc-ink,#3730a3);padding:4px 0}"+
".pte input[type=text],.pte textarea{font:inherit;font-size:15px;width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;background:#fff;color:var(--tr-ink,#1c1b19)}"+
".pte textarea{min-height:160px;resize:vertical}.pte .pa{display:grid;grid-template-columns:1fr auto auto;gap:8px}"+
".pte .ph{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tr-muted,#6b6a64);margin-bottom:2px}"+
".pte .ck{display:flex;flex-direction:column;gap:2px}.pte .ck label{display:flex;gap:10px;align-items:flex-start;padding:6px 0;font-size:15px;line-height:1.35;cursor:pointer}"+
".pte .ck input[type=checkbox]{width:20px;height:20px;flex:0 0 auto;margin:0;accent-color:#15803d}.pte .ck label.dn span{text-decoration:line-through;color:var(--tr-muted,#6b6a64)}"+
".pte .cm{border:1px solid var(--tr-line,#e6e3db);border-radius:10px;padding:8px 10px;font-size:14px;white-space:pre-wrap;word-break:break-word}.pte .cm small{display:block;color:var(--tr-muted,#6b6a64);font-size:11px}"+
".pte .ok{color:#15803d;font-size:12.5px;font-weight:650;min-height:16px}";
(document.head||document.documentElement).appendChild(css);})();
function escH(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
/* readable notes (2 Nov 2026): TickTick's markdown escapes (\( \_ \=) are dropped; a long link shows as a short
   "Open ↗" button after its label; "dd/mm/yyyy:" update lines get a date tag; "Source:" lines are small and grey;
   "merged …" lines become a small heading; long paragraphs are split at sentence ends so they read in short lines. */
function unesc(s){return String(s).replace(/\\([\\`*_{}\[\]()#+\-.!=|~<>:"'])/g,"$1")}
function linkLabel(u){return /drive\.google\.com|docs\.google\.com/.test(u)?"Open in Drive ↗":/ticktick\.com/.test(u)?"Open in TickTick ↗":"Open link ↗"}
function linkify(h){return h.replace(/(https?:\/\/[^\s<]+)/g,function(u){var raw=u.replace(/&amp;/g,"&");return '<a class="lk" href="'+u+'" target="_blank" rel="noopener noreferrer">'+linkLabel(raw)+'</a>'}).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}
function lineHtml(x){var h=escH(x),m;
  h=h.replace(/\s*[–—-]\s*(?=https?:\/\/)/," ").replace(/:\s*(?=https?:\/\/)/," ");
  if((m=h.match(/^(\d{2}\/\d{2}\/\d{4}):\s*(.*)$/))){
    var mg=m[2].match(/^merged\s+&quot;(.*)&quot;$/);
    if(mg)return '<div class="nh"><span class="nd">'+m[1]+'</span>Merged in: '+linkify(mg[1])+'</div>';
    return '<p class="nu"><span class="nd">'+m[1]+'</span>'+linkify(m[2])+'</p>'}
  if(/^source:/i.test(x))return '<p class="ns">'+linkify(h)+'</p>';
  return '<p>'+linkify(h)+'</p>'}
function split(x){if(x.length<160||/https?:\/\//.test(x))return [x];
  return x.split(/(?<=[a-z0-9)\]][.])\s+(?=[A-Z0-9])/).map(function(s){return s.trim()}).filter(Boolean)}
function notesHtml(c){var out="",list=false;unesc(String(c||"")).replace(/\r/g,"").split("\n").forEach(function(l){var x=l.trim();
    if(/^-\s+/.test(x)){if(!list){out+="<ul>";list=true}out+="<li>"+lineHtml(x.replace(/^-\s+/,"")).replace(/^<p[^>]*>|<\/p>$/g,"")+"</li>";return}
    if(list){out+="</ul>";list=false}if(!x)return;if(/^-{3,}$/.test(x)){out+="<hr>";return}
    if(/^\d{2}\/\d{2}\/\d{4}:/.test(x)||/^source:/i.test(x)){out+=lineHtml(x);return}
    var parts=split(x);out+=parts.length>1?'<div class="nb">'+parts.map(lineHtml).join("")+'</div>':lineHtml(x);});
  if(list)out+="</ul>";return out;}
function dmy(){var p=today().split("-");return p[2]+"/"+p[1]+"/"+p[0]}
function needDrive(){if(window.PosDrive)return Promise.resolve(window.PosDrive);return new Promise(function(res,rej){var s=document.createElement("script");s.src="drive.js?v=20261102t";
  s.onload=function(){window.PosDrive?res(window.PosDrive):rej(new Error("Couldn't load the Drive helper."))};s.onerror=function(){rej(new Error("Couldn't load the Drive helper — are you online?"))};document.head.appendChild(s)})}
function editorHtml(t,editing){var it=t.it||[];
  return '<div class="pte" data-pte="'+escH(t.id)+'">'+
    (editing?'<div><div class="ph">Notes</div><textarea data-pe="txt">'+escH(t.c||"")+'</textarea></div><div class="pr"><button type="button" class="pri" data-pe="save">Save notes</button><button type="button" data-pe="cancel">Cancel</button></div>'
      :'<div><div class="pn">'+(String(t.c||"").trim()?notesHtml(t.c):'<span class="pe">No notes yet.</span>')+'</div><button type="button" class="lnk" data-pe="edit">✎ Edit notes</button></div>')+
    (function(){var upd='<div><div class="ph">Add an update</div><div class="pa"><input type="text" data-pe="upd" placeholder="'+dmy()+': what happened…" autocomplete="off"><button type="button" data-pe="att" title="Attach files — they go to Google Drive and the link goes in the notes">📎</button><button type="button" class="pri" data-pe="add">Add</button></div><input type="file" data-pe="file" multiple hidden></div>',
      ck='<div><div class="ph">Checklist'+(it.length?" · "+it.filter(function(x){return x.d}).length+"/"+it.length:"")+'</div><div class="ck">'+
      it.map(function(x,i){return '<label class="'+(x.d?"dn":"")+'"><input type="checkbox" data-ci="'+i+'"'+(x.d?" checked":"")+'><span>'+escH(x.ti)+'</span></label>'}).join("")+
      '</div><input type="text" data-pe="item" placeholder="+ add a checklist item" autocomplete="off"></div>';
      return it.length?ck+upd:upd+ck;})()+
    ((t.cm||[]).length?'<div><div class="ph">Comments</div>'+t.cm.map(function(x){return '<div class="cm">'+escH(x.x)+'<small>'+escH(String(x.at||"").slice(0,16).replace("T"," "))+'</small></div>'}).join("")+'</div>':"")+
    '<div class="ok" data-pe="ok"></div></div>';}
function mountEditor(root,id,editing){var host=root&&(root.querySelector(".pteMount")||root.querySelector("[data-pte]"));if(!host)return;var t=get(id);if(!t)return;
  var wrap=document.createElement("div");wrap.innerHTML=editorHtml(t,editing);var el=wrap.firstChild;host.replaceWith(el);
  var redraw=function(ed,msg){var p=el.parentNode;if(!p)return;mountEditor(p,id,ed);var o=msg&&p.querySelector('[data-pe="ok"]');if(o)o.textContent=msg};
  el.addEventListener("click",function(e){e.stopPropagation()});
  ["touchstart","touchend"].forEach(function(ev){el.addEventListener(ev,function(e){e.stopPropagation()},{passive:true})});
  var q=function(k){return el.querySelector('[data-pe="'+k+'"]')};
  if(q("edit"))q("edit").onclick=function(){redraw(true)};
  if(q("cancel"))q("cancel").onclick=function(){redraw(false)};
  if(q("save"))q("save").onclick=function(){var x=get(id);x.c=q("txt").value;put(x);redraw(false,"Notes saved ✓")};
  var add=function(){var v=q("upd").value.trim();if(!v)return;var x=get(id);x.c=(String(x.c||"").replace(/\s+$/,"")?String(x.c).replace(/\s+$/,"")+"\n":"")+dmy()+": "+v;put(x);redraw(false,"Update added ✓")};
  q("add").onclick=add;q("upd").onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();add()}};
  /* 📎 files with an update (2 Nov 2026): each file goes straight to Google Drive (Pranju OS / Task files) and its link
     is written into the notes under the day's update line — files live in Drive, the task keeps only links. */
  var fi=q("file"),ok=q("ok"),busy=false;
  q("att").onclick=function(){if(!busy)fi.click()};
  fi.onchange=function(){var files=[].slice.call(fi.files||[]);fi.value="";if(!files.length)return;busy=true;q("att").disabled=true;
    var say=function(m){var o=el.querySelector('[data-pe="ok"]');if(o)o.textContent=m};
    needDrive().then(function(D){if(!D.connected())return D.status().then(function(s){if(!s.connected)throw new Error("Google Drive isn't connected — connect it once from Travel Trace, then attach again.");return D})
        .catch(function(e){throw e&&/connect/.test(e.message)?e:new Error("Google Drive isn't connected — connect it once from Travel Trace, then attach again.")});return D})
     .then(function(D){var x=get(id),stamp=today(),links=[],i=0,
        safe=String(x&&x.ti||"task").replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim().slice(0,50);
      var next=function(){if(i>=files.length)return Promise.resolve();var f=files[i++];say("Uploading "+i+" of "+files.length+" to Drive…");
        return D.uploadSub("tasks","Task files",stamp+" · "+safe+" · "+f.name,f,{posTask:String(id)}).then(function(r){links.push("- "+f.name+": "+D.viewUrl(r.id));return next()})};
      return next().then(function(){return links})})
     .then(function(links){var v=q("upd").value.trim(),x=get(id);if(!x)return;
      var body=String(x.c||"").replace(/\s+$/,"");x.c=(body?body+"\n":"")+dmy()+": "+(v||(links.length>1?links.length+" files attached":"file attached"))+"\n"+links.join("\n");
      put(x);busy=false;redraw(false,links.length+(links.length>1?" files":" file")+" saved to Drive ✓ — link"+(links.length>1?"s":"")+" added to the notes")})
     .catch(function(e){busy=false;var b=q("att");if(b)b.disabled=false;say("⚠ "+(e&&e.message||e))})};
  el.querySelectorAll("[data-ci]").forEach(function(c){c.onchange=function(){var x=get(id),i=+c.dataset.ci;if(!x.it[i])return;x.it[i].d=c.checked?1:0;put(x);redraw(false,c.checked?"Ticked ✓":"Unticked")}});
  var item=q("item");item.onkeydown=function(e){if(e.key==="Enter"&&item.value.trim()){e.preventDefault();var x=get(id);x.it=(x.it||[]).concat([{ti:item.value.trim(),d:0}]);var p=el.parentNode;put(x);redraw(false,"Item added ✓");var ni=p&&p.querySelector('[data-pe="item"]');if(ni)ni.focus()}};
  if(editing){var ta=q("txt");setTimeout(function(){ta.focus()},30)}}

/* ---------- merge: several tasks become ONE (31 Oct 2026; never a main task + sub-tasks) ----------
   The kept task takes the others' notes (each under a dated "merged" line), checklist items, tags, comments and history;
   a date or repeat it lacks is taken from the others. The others are deleted. */
function merge(keepId,ids){var k=get(keepId);if(!k)throw new Error("The task to keep is gone.");var others=ids.filter(function(x){return x!==keepId}).map(get).filter(Boolean);
  if(!others.length)return k;var stamp=dmy();
  others.forEach(function(o){var block=stamp+": merged \""+o.ti+"\""+(String(o.c||"").trim()?"\n"+String(o.c).trim():"");
    k.c=(String(k.c||"").trim()?String(k.c).trim()+"\n\n---\n":"")+block;
    var have={};(k.it||[]).forEach(function(x){have[norm(x.ti)]=1});k.it=(k.it||[]).concat((o.it||[]).filter(function(x){return !have[norm(x.ti)]}));
    k.tg=(k.tg||[]).concat((o.tg||[]).filter(function(g){return (k.tg||[]).indexOf(g)<0}));
    k.cm=(k.cm||[]).concat(o.cm||[]);k.h=Object.assign({},o.h||{},k.h||{});
    if(!k.du&&o.du&&o.st!==2)k.du=o.du;if(!k.rp&&o.rp&&o.st!==2)k.rp=o.rp;if((o.pr||0)>(k.pr||0))k.pr=o.pr;
    if(k.st===2&&o.st!==2){k.st=0;k.cd="";}});
  /* the merged task comes up as soon as the earliest of them would have: an open task due today keeps it on today's cards */
  var dues=[k].concat(others).filter(function(o){return o.st!==2&&o.du}).map(function(o){return o.du}).sort();if(dues.length&&(!k.du||dues[0]<k.du))k.du=dues[0];
  put(k);others.forEach(function(o){del(o.id)});return get(keepId);}

/* ---------- done → next step: a task develops instead of ending (1 Nov 2026) ----------
   Still ONE task. Its title becomes "N+1. NEXT STEP"; the step just finished moves into the notes as a numbered,
   dated line, with the notes written during that step kept under it (like "2. CHARGE … / 1. REPAIR … + its files").
   A divider line "──── step N · now ────" separates the finished steps from the notes of the step in hand. */
var STEPRX=/^──── step (\d+) · now ────$/m;
function stepOf(t){var m=String(t.c||"").match(STEPRX);if(m)return +m[1];var n=String(t.ti||"").match(/^(\d{1,2})\.\s+\S/);return n?+n[1]:1;}
function nextStep(id,title,date){var t=get(id);if(!t)throw new Error("That task is no longer in Pranju OS.");
  title=String(title||"").trim().replace(/^\d{1,2}\.\s+/,"").toUpperCase();if(!title)throw new Error("Write the next step first.");
  var td=today(),dd=today().split("-"),stamp=+dd[2]+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+dd[1]-1],
    c=String(t.c||"").replace(/\s+$/,""),n=stepOf(t),old=String(t.ti||"").replace(/^\d{1,2}\.\s+/,""),head="**"+n+". "+old+"** · done "+stamp;
  if(STEPRX.test(c))c=c.replace(STEPRX,head);/* the step in hand becomes a finished step; its notes stay under it */
  else if(n>1)c=(c?c+"\n\n":"")+head;/* numbered by hand before (earlier steps already in the notes) */
  else c=head+(c?"\n"+c:"");
  c+="\n\n──── step "+(n+1)+" · now ────";
  t.c=c;t.ti=(n+1)+". "+title;t.h=Object.assign({},t.h);t.h[td]="step";
  if(t.st===2){t.st=0;t.cd="";}
  if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>td){t.du=date;if(!t.rp)t.rp=DAILY;}
  else if(!t.du||t.du>td||t.rp)t.du=td;/* comes up today */
  put(t);return get(id);}

window.PosTasks={KEY:KEY,stepOf:stepOf,nextStep:nextStep,LISTS:LISTS,LISTNAME:LISTNAME,DAILY:DAILY,on:on,meta:meta,all:all,get:get,put:put,del:del,act:act,today:today,addDays:addDays,
  nextOcc:nextOcc,advance:advance,repeatLabel:repeatLabel,parseRule:parseRule,importTick:importTick,importBackup:importBackup,mountEditor:mountEditor,merge:merge,todayRes:todayRes,mirror:mirror,requests:requests};
})();
