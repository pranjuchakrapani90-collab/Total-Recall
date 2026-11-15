/* Pranju OS · duplicate copies (15 Nov 2026)
   Drive holds the same WhatsApp documents several times over, from the uploads of 5 Oct, 14–15 Oct and 7–13 Nov.
   This keeps ONE copy of each file and moves the rest to Drive's bin, where Google keeps them for 30 days.

   How a copy is recognised: by Drive's own checksum (md5). Two files with the same checksum are the same bytes,
   nothing alike-but-different. Files with no checksum (Google Docs, Sheets and Slides, which Drive stores its own
   way) are never touched, and neither is a file of zero length.

   Which copy is kept, in this order:
     1. the copy the vault's records point at, so every link in the Vault and in search keeps working;
     2. otherwise the copy with the plain name, not a "(1)" or "-1" copy name;
     3. otherwise the one Drive created first.

   Nothing is deleted. Each file is moved to the bin and marked, in the same request, with appProperties
   posDup=<id of the copy that was kept>. That mark is what "Restore" looks for, so this clean-up can be undone
   whole, without touching anything you put in the bin yourself.

   Drive allows about 1,000 requests every 100 seconds, so moves are paced at about 8 a second. A big clean-up
   takes a while; stopping is safe and the next run carries on.

   Needs vault.js loaded first.
   window.PosDupes:
     plan(progress)   -> {groups, trash:[{id,name,size,keep,kind}], bytes, byKind, kept}   (reads only)
     run({docsOnly,onProgress}) -> {moved, failed, skipped, bytes, errors}
     undo({onProgress})         -> {restored, failed}
     count()          -> how many are in the bin from an earlier clean-up (reads only)
     stop() / running() */
(function(){
"use strict";
var V=window.PosVault,G=V.g,API=G.API;
var PACE=120,WORKERS=2,state={running:false,stop:false},lastPlan=null;
function jpatch(body){return {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}}
/* keep to about 8 requests a second whatever the workers do */
var gate=Promise.resolve();
function turn(){var p=gate.then(function(){return G.sleep(PACE)});gate=p.catch(function(){});return p}
function kindOf(mime,name){return V.kind(mime,name)}
/* 1 for a name Drive or Windows gave a copy, such as "bill (1).pdf" or "bill-1.pdf"; 0 for a plain name.
   Keeping the plain name means the phone's own file still matches something in Drive, so the uploader
   recognises it and does not send it again. */
function copyName(n){return /(?:\(\d+\)|[-_]\d{1,2}|\bcopy\b)\s*(?:\.[A-Za-z0-9]{1,5})?$/i.test(String(n||""))?1:0}
function gb(n){return n>=1073741824?(n/1073741824).toFixed(2)+" GB":n>=1048576?(n/1048576).toFixed(0)+" MB":Math.round(n/1024)+" KB"}

/* ---------- what would be moved ---------- */
async function plan(progress){
  var cur=await V.load();if(!cur)throw new Error("Open the vault once first, so the links that must keep working are known.");
  var keepIds={};cur.entries.forEach(function(e){keepIds[e.id]=1});
  var d=await V.listDrive(function(n){if(progress)progress("Listing your Drive… "+n.toLocaleString("en-IN")+" files")});
  var by={};
  (d.files||[]).forEach(function(f){var md5=f[6],size=Number(f[5]||0);if(!md5||size<=0)return;
    var k=md5+"|"+size;(by[k]=by[k]||[]).push({id:f[0],name:f[1],mime:f[2],created:f[4]||f[3]||"",size:size})});
  var trash=[],groups=0,bytes=0,byKind={},kept=0;
  Object.keys(by).forEach(function(k){var g=by[k];if(g.length<2)return;groups++;kept++;
    var keep=g.filter(function(f){return keepIds[f.id]})[0];
    if(!keep)keep=g.slice().sort(function(a,b){var ca=copyName(a.name),cb=copyName(b.name);
      return ca!==cb?ca-cb:a.created<b.created?-1:a.created>b.created?1:(a.id<b.id?-1:1)})[0];
    g.forEach(function(f){if(f.id===keep.id)return;
      var kind=kindOf(f.mime,f.name);trash.push({id:f.id,name:f.name,size:f.size,keep:keep.id,kind:kind});
      bytes+=f.size;var b=byKind[kind]=byKind[kind]||{n:0,bytes:0};b.n++;b.bytes+=f.size})});
  /* biggest first: the space comes back soonest, and a stop part-way has still done the most good */
  trash.sort(function(a,b){return b.size-a.size});
  lastPlan={trash:trash,groups:groups,bytes:bytes,byKind:byKind,kept:kept,at:Date.now()};
  return lastPlan}
var DOCS={PDFs:1,Sheets:1,Docs:1};

/* ---------- move them to the bin ---------- */
async function run(opt){
  opt=opt||{};if(state.running)throw new Error("A clean-up is already running.");
  state.running=true;state.stop=false;var lock=null;
  var T={moved:0,failed:0,skipped:0,bytes:0,left:0,errors:[]},tell=function(m){if(opt.onProgress)try{opt.onProgress(Object.assign({msg:m||""},T))}catch(e){}};
  try{
    try{if(navigator.wakeLock)lock=await navigator.wakeLock.request("screen")}catch(e){}
    var p=lastPlan&&Date.now()-lastPlan.at<10*60000?lastPlan:await plan(function(s){tell(s)});
    var list=p.trash.filter(function(f){return !opt.docsOnly||DOCS[f.kind]});
    if(opt.limit>0)list=list.slice(0,opt.limit);
    T.left=list.length;tell("Moving copies to the bin…");
    var next=0,fatal=null;
    var worker=async function(){
      while(!state.stop&&!fatal){var i=next++;if(i>=list.length)return;var f=list[i];
        await turn();
        var r;
        try{r=await G.gfetch(API+"/files/"+encodeURIComponent(f.id)+"?fields=id",jpatch({trashed:true,appProperties:{posDup:f.keep}}))}
        catch(e){T.failed++;T.left--;if(T.errors.length<5)T.errors.push(f.name+": "+(e&&e.message||e));continue}
        if(r.ok){T.moved++;T.bytes+=f.size}
        else if(r.status===404){T.skipped++}                       /* already gone */
        else{T.failed++;var e2=await G.fail(r,"Moving to the bin");if(T.errors.length<5)T.errors.push(f.name+": "+e2.message);
          if(r.status===401||r.status===403)fatal=e2}
        T.left--;if(T.moved%25===0||T.left<5)tell(f.name)}};
    var ws=[];for(var w=0;w<Math.min(WORKERS,list.length);w++)ws.push(worker());
    await Promise.all(ws);
    if(fatal)throw fatal;
    lastPlan=null;tell(state.stop?"Stopped":"Finished");return T}
  finally{state.running=false;state.stop=false;try{if(lock)await lock.release()}catch(e){}}}

/* ---------- what is in the bin from this clean-up, and how to put it back ---------- */
var Q="trashed=true and 'me' in owners and appProperties has { key='posDup' and value!='' }";
async function count(){
  var n=0,page="";
  for(var i=0;i<400;i++){
    var d=await G.gjson(API+"/files?spaces=drive&pageSize=1000&fields=nextPageToken,files(id)&q="+encodeURIComponent(Q)+(page?"&pageToken="+encodeURIComponent(page):""),null,"Looking in the bin");
    n+=(d.files||[]).length;if(!d.nextPageToken)break;page=d.nextPageToken}
  return n}
async function undo(opt){
  opt=opt||{};if(state.running)throw new Error("A clean-up is already running.");
  state.running=true;state.stop=false;
  var T={restored:0,failed:0,errors:[]},tell=function(m){if(opt.onProgress)try{opt.onProgress(Object.assign({msg:m||""},T))}catch(e){}};
  try{
    tell("Looking in the bin…");
    for(var round=0;round<400&&!state.stop;round++){
      var d=await G.gjson(API+"/files?spaces=drive&pageSize=200&fields=files(id,name)&q="+encodeURIComponent(Q),null,"Looking in the bin");
      var fs=d.files||[];if(!fs.length)break;
      for(var i=0;i<fs.length&&!state.stop;i++){
        await turn();
        /* the mark is cleared as the file comes back, so it is not restored twice and the vault sees it again */
        var r=await G.gfetch(API+"/files/"+encodeURIComponent(fs[i].id)+"?fields=id",jpatch({trashed:false,appProperties:{posDup:null}}));
        if(r.ok)T.restored++;else{T.failed++;if(T.errors.length<5)T.errors.push(fs[i].name+": HTTP "+r.status)}
        if(T.restored%25===0)tell(fs[i].name)}}
    tell(state.stop?"Stopped":"Finished");return T}
  finally{state.running=false;state.stop=false}}
window.PosDupes={plan:plan,run:run,undo:undo,count:count,gb:gb,stop:function(){state.stop=true},running:function(){return state.running}};
})();
