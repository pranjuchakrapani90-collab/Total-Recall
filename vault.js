/* Pranju OS · Gemini document vault (1 Nov 2026).
   Gemini writes a new master_document_vault.json into Drive on every run. The Worker (?mode=backup&op=vault) says
   which copy is newest; this file downloads it straight from Drive (PosDrive), turns every record that carries a Drive
   file_id into a small searchable entry and keeps them on the phone (IndexedDB "pos-vault"), refreshed when Gemini
   has written a newer copy (2 Nov 2026: the Vault page checks every time it opens; background checks at most every 10 minutes).
   Needs drive.js and pos-guard.js loaded first.
   window.PosVault:
     load()            -> {meta, entries} from the phone (no network); null before the first download
     ensure(force)     -> checks Drive for a newer copy, downloads it if needed, returns {meta, entries}
     search(q, max)    -> [{t,id,u,d,x,score}] best first (every word must match)
     domainLabel(d)    -> "Capital and distribution schemes"
   entry: t title · id Drive file id · u view url · d domain key · x the record's other fields as one text line */
(function(){
"use strict";
var DB="pos-vault",ST="kv",CK="pos-vault-checked",DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev";
var mem=null;
function idb(){return new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
async function get(k){var d=await idb();return new Promise(function(ok,no){var r=d.transaction(ST).objectStore(ST).get(k);r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
async function set(k,v){var d=await idb();return new Promise(function(ok,no){var t=d.transaction(ST,"readwrite");t.objectStore(ST).put(v,k);t.oncomplete=function(){ok()};t.onerror=function(){no(t.error)}})}
function base(){var u=null;try{u=localStorage.getItem("totalRecallTickTickUrl")}catch(e){}return u||window.TOTAL_RECALL_TICKTICK_URL||DEF}
async function worker(op){var u=base();var r=await fetch(u+(u.indexOf("?")>=0?"&":"?")+"mode=backup&op="+op,{cache:"no-store"}),d={};
  try{d=await r.json()}catch(e){}
  if(!r.ok||d.error){var e=new Error(d.error||"the Worker answered HTTP "+r.status);e.code=d.code||"";throw e}return d}

function label(k){k=String(k||"").replace(/[_-]+/g," ").trim();return k?k.charAt(0).toUpperCase()+k.slice(1):"Other"}
function nice(k){return String(k).replace(/[_]+/g," ")}
/* the record's other fields as readable text: "scope: … · gross cost: 29119881.07 · key equipment boq: SP-80 …: 34 nos …" */
function flatText(o,skip){var out=[];
  (function walk(v,k){
    if(v==null||v==="")return;
    if(Array.isArray(v)){v.forEach(function(x){walk(x,k)});return}
    if(typeof v==="object"){Object.keys(v).forEach(function(kk){if(skip&&skip[kk])return;walk(v[kk],kk)});return}
    out.push((k?nice(k)+": ":"")+String(v));
  })(o,"");
  var s=out.join(" · ");return s.length>2400?s.slice(0,2400)+"…":s}
var SKIP={title:1,name:1,file_name:1,file_id:1,fileId:1,drive_id:1,view_url:1,url:1,link:1};
function parse(json){
  var entries=[],seen={},meta={},raw=0;
  var sm=json.system_metadata||{};
  meta.batch=json.batch!=null?json.batch:(sm.batch||"");
  meta.updated=json.last_updated||sm.last_scheduled_study_run||"";
  (function walk(v,path){
    if(!v||typeof v!=="object")return;
    if(Array.isArray(v)){v.forEach(function(x){walk(x,path)});return}
    var fid=v.file_id||v.fileId||v.drive_id||v.drive_file_id||v.source_file_id||"";
    if(!fid){var lk=String(v.view_url||v.url||v.link||v.drive_link||"").match(/\/d\/([A-Za-z0-9_-]{20,})/);if(lk)fid=lk[1]}
    var t=v.title||v.name||v.file_name||v.file||v.document||v.source_file||"";
    if(fid&&typeof fid==="string"){raw++;if(!t)t=fid;
      if(!seen[fid]){seen[fid]=1;
        var d=path[0]==="domains"?(path[1]||""):(path[0]||"");
        entries.push({t:String(t),id:fid,u:v.view_url||v.url||"https://drive.google.com/file/d/"+encodeURIComponent(fid)+"/view",d:d,x:flatText(v,SKIP)})}
      return}
    Object.keys(v).forEach(function(k){if(k==="system_metadata")return;walk(v[k],path.concat([k]))});
  })(json,[]);
  meta.count=entries.length;meta.records=raw;meta.claimed=json.entry_count||sm.total_master_dossiers||"";
  var doms={};entries.forEach(function(e){doms[e.d]=(doms[e.d]||0)+1});meta.domains=doms;
  return {meta:meta,entries:entries}}

function checkedAt(){var n=0;try{n=Number(localStorage.getItem(CK)||0)}catch(e){}return n||0}
async function load(){if(mem)return mem;try{mem=await get("data")||null}catch(e){mem=null}return mem}
async function ensure(force){
  var cur=await load();
  var last=0;try{last=Number(localStorage.getItem(CK)||0)}catch(e){}
  if(!force&&cur&&cur.meta&&cur.meta.v===2&&Date.now()-last<10*60000)return cur;
  var info=await worker("vault");
  try{localStorage.setItem(CK,String(Date.now()))}catch(e){}
  var f=info.vault;if(!f)throw new Error("No master_document_vault.json was found in your Drive.");
  if(cur&&cur.meta&&cur.meta.v===2&&cur.meta.fileId===f.id&&cur.meta.modified===f.modifiedTime)return cur;
  if(!window.PosDrive)throw new Error("drive.js is not loaded");
  var blob=await PosDrive.download(f.id),json=JSON.parse(await blob.text());
  var out=parse(json);json=null;
  /* reviewed_files_log.json: the Drive ids Gemini says it has looked at */
  out.log=null;
  if(info.log)try{var lj=JSON.parse(await (await PosDrive.download(info.log.id)).text());
    var ids={};(function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==="object")Object.keys(v).forEach(function(k){walk(v[k])});else if(typeof v==="string"&&/^[A-Za-z0-9_-]{25,60}$/.test(v))ids[v]=1})(lj.audited_file_ids||lj);
    out.log={ids:Object.keys(ids),lastRun:lj.last_run!=null?lj.last_run:"",dossiers:lj.dossiers_indexed!=null?lj.dossiers_indexed:"",modified:info.log.modifiedTime}}catch(e){out.log=null}
  out.meta.v=2;out.meta.fileId=f.id;out.meta.modified=f.modifiedTime;out.meta.size=Number(f.size||0);out.meta.fetched=new Date().toISOString();
  await set("data",out);mem=out;
  try{window.dispatchEvent(new CustomEvent("posvault",{detail:out.meta}))}catch(e){}
  return out}
/* How much of Drive Gemini has covered: every file in Drive (from the Worker) against the log and the vault records. */
/* lists every file the owner has in Drive, straight from the phone (the Worker's per-request limit stopped at 40,000) */
async function listDrive(progress){var u=base(),tr=await fetch(u+(u.indexOf("?")>=0?"&":"?")+"mode=drive&op=token",{cache:"no-store"}),td=await tr.json();
  if(!tr.ok||td.error)throw new Error(td.error||"Could not get Drive access");
  var tok=td.token,rows=[],page="",junk=0,q="trashed=false and mimeType!='application/vnd.google-apps.folder' and 'me' in owners";
  for(var i=0;i<400;i++){var r=await fetch("https://www.googleapis.com/drive/v3/files?spaces=drive&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,modifiedTime,appProperties)&q="+encodeURIComponent(q)+(page?"&pageToken="+encodeURIComponent(page):""),{headers:{Authorization:"Bearer "+tok}});
    var d=await r.json();if(!r.ok)throw new Error("Drive listing failed: "+((d.error&&d.error.message)||r.status));
    (d.files||[]).forEach(function(f){if(f.appProperties||/\.(vault|gpx)$/i.test(f.name)||f.name==="master_document_vault.json"||f.name==="reviewed_files_log.json")return;
      if(/\.(tmp|thumb|nomedia)$/i.test(f.name)||/\.thumb\.tmp$/i.test(f.name)){junk++;return}
      rows.push([f.id,f.name,f.mimeType,f.modifiedTime])});
    if(progress)progress(rows.length+junk);
    if(!d.nextPageToken)break;page=d.nextPageToken}
  return {files:rows,junk:junk,at:new Date().toISOString()}}
async function coverage(progress){var cur=await load();if(!cur)throw new Error("Open the vault first.");
  var d=await listDrive(progress),files=d.files||[],inVault={},inLog={};
  cur.entries.forEach(function(e){inVault[e.id]=1});((cur.log&&cur.log.ids)||[]).forEach(function(i){inLog[i]=1});
  var res={junk:d.junk,total:files.length,records:0,logged:0,none:0,byType:{},missing:[]};
  files.forEach(function(f){var ty=kind(f[2],f[1]),b=res.byType[ty]=res.byType[ty]||{total:0,records:0,logged:0,none:0};b.total++;
    if(inVault[f[0]]){res.records++;b.records++}else if(inLog[f[0]]){res.logged++;b.logged++}else{res.none++;b.none++;res.missing.push(f)}});
  res.missing.sort(function(a,b){return a[3]<b[3]?1:-1});res.at=d.at;return res}
function kind(m,n){m=String(m||"");n=String(n||"").toLowerCase();
  if(m.indexOf("image/")===0)return "Images";if(m.indexOf("video/")===0)return "Videos";if(m.indexOf("audio/")===0)return "Audio";
  if(m==="application/pdf")return "PDFs";if(/spreadsheet|excel|csv/.test(m)||/\.(xlsx?|csv)$/.test(n))return "Sheets";
  if(/document|word|text\/plain/.test(m)||/\.(docx?|txt)$/.test(n))return "Docs";return "Other"}
function norm(s){return String(s||"").toLowerCase()}
function search(q,max){
  var words=norm(q).split(/\s+/).filter(Boolean);if(!words.length||!mem)return [];
  var res=[];
  mem.entries.forEach(function(e){
    var t=norm(e.t),all=t+" "+norm(e.x)+" "+norm(e.d),score=0;
    for(var i=0;i<words.length;i++){var w=words[i];if(all.indexOf(w)<0)return;score+=t.indexOf(w)>=0?5:1}
    res.push(Object.assign({score:score},e))});
  res.sort(function(a,b){return b.score-a.score||a.t.localeCompare(b.t)});
  return res.slice(0,max||50)}
window.PosVault={coverage:coverage,checkedAt:checkedAt,load:load,ensure:ensure,search:search,domainLabel:label};
})();
