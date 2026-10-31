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
var LISTS=[["inbox","Inbox"],["schedule","SCHEDULE"],["projects","PROJECTS"],["checklists","CHECKLISTS"],["reference","REFERENCE"],["archive","ARCHIVE"]];
var LISTNAME={};LISTS.forEach(function(l){LISTNAME[l[0]]=l[1]});
var RESP=["SDE-TECH","SDE-REV","SDE-ESTT","HOME-MANAGER","BROTHER","SON"];
var DAILY="RRULE:FREQ=DAILY;INTERVAL=1";

/* ---------- dates (India time) ---------- */
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
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
var cache=null,cacheRaw=null;
function all(){var s=ls?ls.getItem(KEY):null;if(cache&&s===cacheRaw)return cache;var d=raw(),out={};
  Object.keys(d.t).forEach(function(id){var t=dec(d.t[id]);if(t){t.id=id;out[id]=t}});cache=out;cacheRaw=s;return out;}
function on(){return !!raw().meta.on}
function meta(){return raw().meta}
function writeRaw(d){try{ls.setItem(KEY,JSON.stringify(d));cache=null;return true}catch(e){console.warn("Pranju OS tasks: could not save",e);throw new Error("This phone's storage is full — the task was not saved.")}}
function clean(t){var o={ti:String(t.ti||"").trim()||"(Untitled task)",pj:LISTNAME[t.pj]?t.pj:"inbox",tg:(t.tg||[]).map(function(x){return String(x).trim().replace(/^#/,"").toLowerCase().replace(/\s+/g,"-")}).filter(Boolean),
  c:String(t.c||""),it:(t.it||[]).filter(function(x){return x&&String(x.ti||"").trim()}).map(function(x){return {ti:String(x.ti).trim(),d:x.d?1:0}}),
  du:/^\d{4}-\d{2}-\d{2}$/.test(t.du||"")?t.du:"",tm:/^\d{2}:\d{2}$/.test(t.tm||"")?t.tm:"",rp:String(t.rp||""),pr:[0,1,3,5].indexOf(+t.pr)>=0?+t.pr:0,
  st:t.st===2?2:0,cd:t.cd||"",cr:t.cr||nowIso(),md:nowIso(),h:t.h||{},cm:t.cm||[]};
  if(t.src)o.src=t.src;if(o.tg.length>1)o.tg=o.tg.filter(function(x,i){return o.tg.indexOf(x)===i});return o;}
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
function referenceRes(s,e){var T=all(),tags={},n=0;Object.keys(T).forEach(function(id){var t=T[id];if(t.pj!=="reference"||t.st===2)return;
    var cd=String(t.cr||"").slice(0,10);if((s||e)&&!inRange(cd,s,e))return;n++;var tg=upTags(t);
    tg.forEach(function(g){(tags[g]=tags[g]||[]).push({id:t.id,title:t.ti,due:t.du,projectId:"reference",tags:tg})});});
  return {section:"Reference",projectId:"reference",projectName:"REFERENCE",start:s||null,end:e||null,taskCount:n,tags:tags};}
function completedRes(s,e){var T=all(),out=[];Object.keys(T).forEach(function(id){var t=T[id],ds=Object.keys(t.h||{}).filter(function(d){var k=t.h[d];return inRange(d,s,e)&&k!=="push"&&k!=="later"&&k!=="tick"}).sort();
    if(ds.length)out.push({id:t.id,title:t.ti,projectId:t.pj,tags:upTags(t),completionDates:ds,completionCount:ds.length});});
  out.sort(function(a,b){return a.title.localeCompare(b.title)});return {start:s,end:e,timeZone:TZ,uniqueCount:out.length,tasks:out};}
function listRes(){var T=all(),out=[];Object.keys(T).forEach(function(id){var t=T[id];if(t.st===2||t.pj==="archive")return;
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
    if(mode==="reference"||u.pathname==="/reference-tasks")return reply(referenceRes(q.get("start")||"",q.get("end")||""));
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
function mirrorSoon(ms){if(!on()||!hasCode())return;clearTimeout(mirrorTimer);mirrorTimer=setTimeout(mirror,ms||30000)}
function mirror(){if(!on()||!hasCode())return;var T=all(),old=addDays(today(),-30),rows=[];
  Object.keys(T).forEach(function(id){var t=T[id];if(t.st===2&&!(t.cd>=old))return;
    rows.push([id,t.st===2?"CLOSED "+t.cd:LISTNAME[t.pj],t.ti,(t.tg||[]).join(", "),t.du,t.tm,repeatLabel(t.rp),t.pr||0,
      (t.it||[]).map(function(x){return (x.d?"☑ ":"☐ ")+x.ti}).join("; "),String(t.c||"").slice(0,4000),String(t.cr||"").slice(0,16),String(t.md||"").slice(0,16)])});
  rows.sort(function(a,b){return String(a[1]).localeCompare(String(b[1]))||String(a[2]).localeCompare(String(b[2]))});
  orig(wurl("mode=tasks-mirror"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:rows})})
    .then(function(r){if(r.ok)lset("pos-tasks-mirror-at",String(Date.now()))}).catch(function(){});}
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
  if(op==="add"){var o=put(fieldsOnto({ti:"",pj:"inbox",tg:[],c:"",du:"",rp:""},j));return "added "+o.id;}
  var t=get(x.task);if(!t)throw new Error("no task with id "+x.task);
  if(op==="update"||op==="move"){put(fieldsOnto(t,j));return "updated";}
  if(op==="comment"){t.cm=(t.cm||[]).concat([{x:String(j.text||j.comment||""),at:nowIso()}]);put(t);return "comment added";}
  if(op==="done"){var r=act(t.id,j.kind||"done",j.date);return "done"+(r.next?" · next "+r.next:"")+(r.closed?" · closed":"");}
  if(op==="reopen"){act(t.id,"reopen");return "reopened";}
  if(op==="delete"){del(t.id);return "deleted";}
  throw new Error("unknown op "+op);}
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

window.PosTasks={KEY:KEY,LISTS:LISTS,LISTNAME:LISTNAME,DAILY:DAILY,on:on,meta:meta,all:all,get:get,put:put,del:del,act:act,today:today,addDays:addDays,
  nextOcc:nextOcc,advance:advance,repeatLabel:repeatLabel,parseRule:parseRule,importTick:importTick,importBackup:importBackup,todayRes:todayRes,mirror:mirror,requests:requests};
})();
