/* Pranju OS · document vault (1 Nov 2026; rebuilt 12 Nov 2026 around the "Gemini Vault Index" Google Sheet).
   Since 8 Nov Gemini no longer writes master_document_vault.json; it keeps one row per Drive file in the sheet
   "Gemini Vault Index" (tab "Index", columns A–Z). From 12 Nov Pranju OS reads Drive files itself with fixed rules,
   no AI (vault-rules.js + vault-scan.js), and writes its rows to a second tab, "Auto index", with the same columns.
   Files the rules cannot read or classify are listed in a third tab, "Needs review", which is the only work left for
   Gemini (or for you, by hand).
   This file reads both tabs straight from Google with the Worker's short-lived token (?mode=drive&op=token), merges
   them and keeps the result on the phone (IndexedDB "pos-vault").
   Which row wins for a file: Gemini's row in "Index" > a later row in "Auto index" > an earlier one. "Auto index" is
   only ever added to, never edited, so the phone fetches just the rows it has not seen yet.
   Needs pos-guard.js loaded first.
   window.PosVault:
     load()            -> {meta, entries, queue, log} from the phone (no network); null before the first download
     ensure(force)     -> checks the sheet for changes, reads what is new, returns the same. force "full" re-reads all
     search(q, max)    -> [{t,id,u,d,x,src,score}] best first (every word must match)
     manual(id,type,note) -> you reviewed a queued file yourself: adds a row saying so and takes it off the queue
     coverage(progress)-> how much of Drive has a record
     domainLabel(d)    -> "Office order"
     g                 -> the Google helpers vault-scan.js shares (token, fetch with retry, sheet reading)
   entry: t file name · id Drive file id · u view url · d document type · x the other columns as one text line ·
          src "ai" (Gemini) | "rules" (Pranju OS) | "manual" (you) · c confidence · m modified · p folder */
(function(){
"use strict";
var DB="pos-vault",ST="kv",KEY="data4",CK="pos-vault-checked",DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev";
var API="https://www.googleapis.com/drive/v3",SH="https://sheets.googleapis.com/v4/spreadsheets/";
var SHEET_NAME="Gemini Vault Index",T_AI="Index",T_AUTO="Auto index",T_QUEUE="Needs review";
var mem=null,tok=null;
function idb(){return new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
async function get(k){var d=await idb();return new Promise(function(ok,no){var r=d.transaction(ST).objectStore(ST).get(k);r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}})}
async function set(k,v){var d=await idb();return new Promise(function(ok,no){var t=d.transaction(ST,"readwrite");t.objectStore(ST).put(v,k);t.oncomplete=function(){ok()};t.onerror=function(){no(t.error)}})}
function base(){var u=null;try{u=localStorage.getItem("totalRecallTickTickUrl")}catch(e){}return u||window.TOTAL_RECALL_TICKTICK_URL||DEF}
function sleep(ms){return new Promise(function(ok){setTimeout(ok,ms)})}

/* ---------- Google access ---------- */
async function token(fresh){
  if(!fresh&&tok&&tok.exp>Date.now()+90000)return tok;
  var u=base(),r=await fetch(u+(u.indexOf("?")>=0?"&":"?")+"mode=drive&op=token",{cache:"no-store"}),d={};
  try{d=await r.json()}catch(e){}
  if(!r.ok||d.error){var e=new Error(d.error||"Could not get Google Drive access (HTTP "+r.status+")");e.code=d.code||"";throw e}
  tok={token:d.token,exp:Date.now()+(d.expiresIn||1800)*1000,folders:d.folders||{}};return tok}
/* Sheets allows about 60 reads a minute for one person: calls to it are spaced a second apart */
var gate=Promise.resolve();
function sheetTurn(){var p=gate.then(function(){return sleep(1050)});gate=p.catch(function(){});return p}
/* fetch with the token; retries when Google says "slow down", on server errors and on a dropped connection */
async function gfetch(url,init){
  var sheets=url.indexOf("sheets.googleapis.com")>=0,fresh=false,r=null;
  for(var i=0;i<6;i++){
    var t=await token(fresh);fresh=false;var o=Object.assign({},init||{}),h=new Headers(o.headers||{});h.set("Authorization","Bearer "+t.token);o.headers=h;
    if(sheets)await sheetTurn();
    try{r=await fetch(url,o)}catch(e){if(i<4){await sleep(900*Math.pow(2,i));continue}throw new Error("No connection to Google ("+(e&&e.message||e)+")")}
    if(r.status===401&&i<2){tok=null;fresh=true;continue}
    var slow=r.status===429||r.status>=500;
    if(r.status===403){var b="";try{b=await r.clone().text()}catch(e){}slow=/rateLimitExceeded|userRateLimitExceeded|RATE_LIMIT|Quota exceeded/i.test(b)}
    if(slow&&i<5){await sleep(1500*Math.pow(2,i)+Math.random()*700);continue}
    return r}
  return r}
async function fail(r,what){var m="";try{var d=await r.clone().json();m=d.error&&d.error.message||""}catch(e){}
  var e=new Error(what+" failed (Google HTTP "+r.status+(m?": "+m:"")+")");e.status=r.status;return e}
async function gjson(url,init,what){var r=await gfetch(url,init);if(!r.ok)throw await fail(r,what||"Google request");return r.json()}
async function findSheet(){
  var q="name='"+SHEET_NAME+"' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners";
  var d=await gjson(API+"/files?spaces=drive&pageSize=1&orderBy="+encodeURIComponent("modifiedTime desc")+"&fields=files(id,name,modifiedTime)&q="+encodeURIComponent(q),null,"Looking for the index sheet");
  var f=(d.files||[])[0];if(!f)throw new Error('No Google Sheet named "'+SHEET_NAME+'" was found in your Drive.');return f}
function a1(tab,range){return "'"+String(tab).replace(/'/g,"''")+"'!"+range}
async function values(id,range){var d=await gjson(SH+id+"/values/"+encodeURIComponent(range)+"?majorDimension=ROWS",null,"Reading the index sheet");return d.values||[]}
async function tabs(id){var d=await gjson(SH+id+"?fields="+encodeURIComponent("sheets.properties(title,sheetId,gridProperties(rowCount))"),null,"Reading the index sheet");
  return (d.sheets||[]).map(function(s){return s.properties})}

/* ---------- topics: every record goes under ONE topic, picked by which topic's words it mentions most ---------- */
var TOPICS=[
 ["Theft & enforcement",/theft|hooking|pilfer|unauthori[sz]ed|section\s*1(?:26|35)|compound|assessment bill|raid|enforcement|tamper/gi],
 ["Accidents & safety",/accident|electrocut|fatal|\bptw\b|permit to work|shut ?down|safety|earthing/gi],
 ["Smart meters",/smart ?meter|non.?comm?\b|non.?communicat|prepaid|postpaid|\bmdm\b|meter replacement|defective meter|not working meter/gi],
 ["Billing & revenue",/electricity bill|\bbill\b|receipt|arrear|revenue|collection|payment|outstanding|\bdues\b|disconnect|\btdc\b|defaulter|tariff/gi],
 ["Estimates & works",/estimate|\bboq\b|cost abstract|\bsor\b|deposit work|\brdss\b|sanction|scheme|tender|work order|ab cable|utility shifting|crossing/gi],
 ["Network & DTR",/\bdtr\b|transformer|feeder|\b(?:11|33) ?kv\b|sub-?station|\bptr\b|\bsld\b|single line|indexing|\bpole\b|conductor|line checking|line status|inspection|interruption|storm|energy audit|\bjmr\b|injection/gi],
 ["Consumers & connections",/new (?:service )?connection|\bnsc\b|load (?:extension|sanction|enhancement)|application|petition|complain|grievance|consumer list|rooftop|solar/gi],
 ["Staff & office",/office order|transfer|posting|superannuation|retire|\bleave\b|salary|imprest|establishment|attendance|deployment|election|meeting|circular|notification|vacanc/gi]];
function topicOf(text){var best="Other",top=0;text=String(text||"");
  TOPICS.forEach(function(t){var m=text.match(t[1]),n=m?m.length:0;if(n>top){top=n;best=t[0]}});return best}
/* words that mean nearly the same thing in APDCL paperwork: a search for one also offers the others as "related" */
var ALIKE=[["dtr","transformer"],["ptr","power transformer"],["theft","hooking","pilferage","unauthorised","section 135","section 126"],["accident","electrocution","electrocuted","fatal"],
 ["fir","police"],["bill","invoice","billing"],["receipt","payment"],["estimate","boq","cost abstract"],["non-comm","non comm","non com","non communicating","not working meter"],
 ["feeder","line"],["substation","sub-station","33/11"],["pole","psc"],["shutdown","ptw","permit to work","outage","interruption"],["complaint","grievance","petition"],
 ["connection","nsc","load extension"],["solar","rooftop"],["arrear","outstanding","dues","defaulter"],["disconnection","tdc","disconnected"],["railway","rail crossing","track crossing"],
 ["tree","jungle"],["storm","damage","restoration"],["transfer","posting","office order"],["retirement","superannuation"],["sld","single line diagram"],["ab cable","abc","rdss"],
 ["indexing","gis"],["energy audit","jmr","at&c"],["smart meter","prepaid","postpaid"],["letter","memo"]];
function alike(w){var out=[];ALIKE.forEach(function(g){if(g.indexOf(w)>=0)g.forEach(function(x){if(x!==w&&out.indexOf(x)<0)out.push(x)})});
  if(w.length>3&&/s$/.test(w))out.push(w.slice(0,-1));return out}

/* ---------- rows -> entries ---------- */
var LBL=[[9,"consumer nos"],[10,"memo nos"],[11,"receipt / bill nos"],[12,"names"],[13,"places"],[14,"amounts"],[19,"unclear"],[20,"discrepancies"],[21,"note"]];
function entry(r,src){
  var id=String(r[0]||"").trim();if(!id||id==="file_id")return null;
  var st=String(r[23]||"").trim().toLowerCase(),x=[];if(r[15])x.push(String(r[15]));
  LBL.forEach(function(l){if(l[0]===19&&st==="needs_review")return;if(r[l[0]])x.push(l[1]+": "+r[l[0]])});
  var s=x.join(" · ");if(s.length>2600)s=s.slice(0,2600)+"…";
  return {id:id,s:String(r[15]||"").slice(0,700),k:topicOf(String(r[1]||"")+" "+String(r[1]||"")+" "+s+" "+String(r[8]||"")),t:String(r[1]||id),u:String(r[2]||"https://drive.google.com/file/d/"+encodeURIComponent(id)+"/view"),p:String(r[3]||""),ft:String(r[4]||""),m:String(r[5]||""),
    d:String(r[8]||"other").trim().toLowerCase()||"other",x:s,c:String(r[17]||""),st:st,dup:String(r[24]||""),why:String(r[19]||""),src:src==="ai"?"ai":(st==="manual"?"manual":"rules")}}
function merge(ai,auto){
  var by={},order=[];
  auto.forEach(function(e){if(!by[e.id])order.push(e.id);by[e.id]=e});
  ai.forEach(function(e){if(e.st==="skipped"&&by[e.id])return;if(!by[e.id])order.push(e.id);by[e.id]=e});
  var entries=[],queue=[],dups=[],doms={},tops={},n={ai:0,rules:0,manual:0};
  order.forEach(function(id){var e=by[id];
    if(e.st==="duplicate"){dups.push(id);return}
    if(e.st==="needs_review"){queue.push(e);return}
    entries.push(e);doms[e.d]=(doms[e.d]||0)+1;tops[e.k]=(tops[e.k]||0)+1;n[e.src]=(n[e.src]||0)+1});
  queue.sort(function(a,b){return a.m<b.m?1:-1});
  return {entries:entries,queue:queue,log:{ids:dups},counts:n,domains:doms,topics:tops}}
function build(st){var m=merge(st.ai,st.auto);
  m.meta={v:3,sheetId:st.sheetId,modified:st.modified,fetched:st.fetched,count:m.entries.length,domains:m.domains,topics:m.topics,ai:m.counts.ai,rules:m.counts.rules,manual:m.counts.manual,
    queue:m.queue.length,dups:m.log.ids.length,autoRows:st.autoRows,hasAuto:st.hasAuto};
  m.raw=st;return m}

function checkedAt(){var n=0;try{n=Number(localStorage.getItem(CK)||0)}catch(e){}return n||0}
async function load(){if(mem)return mem;var st=null;try{st=await get(KEY)}catch(e){}mem=st?build(st):null;return mem}
async function save(){if(mem&&mem.raw)await set(KEY,mem.raw)}
var busy=null;
function ensure(force){if(busy)return busy;busy=ensure1(force).finally(function(){busy=null});return busy}
async function ensure1(force){
  var cur=await load();
  if(!force&&cur&&Date.now()-checkedAt()<10*60000)return cur;
  var f=await findSheet();
  try{localStorage.setItem(CK,String(Date.now()))}catch(e){}
  var old=cur&&cur.raw,same=old&&old.sheetId===f.id;
  if(same&&old.modified===f.modifiedTime&&force!=="full")return cur;
  var tb=await tabs(f.id),has=function(n){return tb.some(function(t){return t.title===n})};
  if(!has(T_AI))throw new Error('The sheet "'+SHEET_NAME+'" has no "'+T_AI+'" tab.');
  var st={sheetId:f.id,modified:f.modifiedTime,fetched:new Date().toISOString(),ai:[],auto:[],autoRows:0,hasAuto:has(T_AUTO),hasQueue:has(T_QUEUE)};
  (await values(f.id,a1(T_AI,"A2:Z"))).forEach(function(r){var e=entry(r,"ai");if(e)st.ai.push(e)});
  if(st.hasAuto){
    var keep=same&&force!=="full"&&old.autoRows>0?old.autoRows:0;
    if(keep){ /* the last row already on the phone must still be where it was; if not, read the whole tab again */
      var chk=await values(f.id,a1(T_AUTO,"A"+(keep+1)+":A"+(keep+1))),lastId=old.auto.length?old.auto[old.auto.length-1].id:"";
      if(!chk.length||String(chk[0][0]||"")!==String(old.autoLast||lastId))keep=0}
    st.auto=keep?old.auto.slice():[];st.autoRows=keep;st.autoLast=keep?old.autoLast:"";
    var rows=await values(f.id,a1(T_AUTO,"A"+(keep+2)+":Z"));
    rows.forEach(function(r){st.autoRows++;st.autoLast=String(r[0]||"");var e=entry(r,"rules");if(e)st.auto.push(e)})}
  await set(KEY,st);mem=build(st);
  try{window.dispatchEvent(new CustomEvent("posvault",{detail:mem.meta}))}catch(e){}
  return mem}
/* vault-scan.js has just added these rows to the "Auto index" tab: take them into the phone's copy without re-reading */
function absorb(rows){if(!mem||!mem.raw)return;var st=mem.raw;st.hasAuto=true;
  rows.forEach(function(r){st.autoRows++;st.autoLast=String(r[0]||"");var e=entry(r,"rules");if(e)st.auto.push(e)});
  mem=build(st)}
/* you looked at a queued file yourself */
async function manual(id,type,note){
  var cur=await load();if(!cur)throw new Error("Open the vault first.");
  var q=cur.queue.filter(function(e){return e.id===id})[0];if(!q)throw new Error("That file is not waiting for review any more.");
  var now=new Date(Date.now()+19800000).toISOString().slice(0,16)+"+05:30";
  var row=[q.id,q.t,q.u,q.p,q.ft,q.m,"","drive",type||"other","","","","","","",String(note||"").slice(0,1500),"","","yes","","","Reviewed by hand in Pranju OS","","manual","",now];
  var r=await gfetch(SH+cur.raw.sheetId+"/values/"+encodeURIComponent(a1(T_AUTO,"A1"))+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:[row]})});
  if(!r.ok)throw await fail(r,"Saving your review");
  absorb([row]);await save();return mem}

/* ---------- coverage: every file you own in Drive against the index ---------- */
/* working sheets of Pranju OS and of the AI reviews themselves: not documents to review */
var OWN=/^(WA Review learning log|Pranju OS Drafts)$/i;
function junkName(n){return /\.(tmp|thumb|nomedia)$/i.test(n)||/\.thumb\.tmp$/i.test(n)}
/* rows: [id, name, mimeType, modifiedTime, createdTime, size, md5, parent] */
async function listDrive(progress,opt){
  opt=opt||{};var rows=[],page="",junk=0,q="trashed=false and mimeType!='application/vnd.google-apps.folder' and 'me' in owners"+(opt.q?" and ("+opt.q+")":"");
  var skipId=mem&&mem.raw?mem.raw.sheetId:"";
  for(var i=0;i<20000;i++){   /* ends when Drive has no more pages; pages can be much smaller than 1000 */
    var d=await gjson(API+"/files?spaces=drive&pageSize=1000&fields="+encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,md5Checksum,parents,appProperties)")+"&q="+encodeURIComponent(q)+(page?"&pageToken="+encodeURIComponent(page):""),null,"Drive listing");
    (d.files||[]).forEach(function(f){
      if(f.appProperties||f.id===skipId||/\.(vault|gpx)$/i.test(f.name)||f.name==="master_document_vault.json"||f.name==="reviewed_files_log.json"||f.name===SHEET_NAME||OWN.test(f.name))return;
      if(junkName(f.name)){junk++;return}
      rows.push([f.id,f.name,f.mimeType,f.modifiedTime,f.createdTime||"",Number(f.size||0),f.md5Checksum||"",(f.parents||[])[0]||""])});
    if(progress)progress(rows.length+junk);
    if(!d.nextPageToken)break;page=d.nextPageToken}
  return {files:rows,junk:junk,at:new Date().toISOString()}}
function kind(m,n){m=String(m||"");n=String(n||"").toLowerCase();
  if(m.indexOf("image/")===0)return "Images";if(m.indexOf("video/")===0)return "Videos";if(m.indexOf("audio/")===0)return "Audio";
  if(m==="application/pdf")return "PDFs";if(/spreadsheet|excel|csv/.test(m)||/\.(xlsx?|csv|ods)$/.test(n))return "Sheets";
  if(/document|word|text\/plain|rtf|presentation|powerpoint/.test(m)||/\.(docx?|txt|rtf|odt|pptx?)$/.test(n))return "Docs";return "Other"}
async function coverage(progress){var cur=await load();if(!cur)throw new Error("Open the vault first.");
  var d=await listDrive(progress),files=d.files||[],rec={},dup={},que={};
  cur.entries.forEach(function(e){rec[e.id]=1});cur.log.ids.forEach(function(i){dup[i]=1});cur.queue.forEach(function(e){que[e.id]=1});
  var res={junk:d.junk,total:files.length,records:0,logged:0,waiting:0,none:0,byType:{},missing:[]};
  files.forEach(function(f){var ty=kind(f[2],f[1]),b=res.byType[ty]=res.byType[ty]||{total:0,records:0,logged:0,waiting:0,none:0};b.total++;
    if(rec[f[0]]){res.records++;b.records++}else if(dup[f[0]]){res.logged++;b.logged++}else if(que[f[0]]){res.waiting++;b.waiting++}else{res.none++;b.none++;res.missing.push(f)}});
  res.missing.sort(function(a,b){return a[3]<b[3]?1:-1});res.at=d.at;return res}

function label(k){k=String(k||"").replace(/[_-]+/g," ").trim();return k?k.charAt(0).toUpperCase()+k.slice(1):"Other"}
function norm(s){return String(s||"").toLowerCase()}
function search(q,max){
  var words=norm(q).split(/\s+/).filter(Boolean);if(!words.length||!mem)return [];
  var res=[];
  mem.entries.forEach(function(e){
    var t=norm(e.t),all=t+" "+norm(e.x)+" "+e.d;
    for(var i=0,score=0;i<words.length;i++){var w=words[i];if(all.indexOf(w)<0)return;score+=t.indexOf(w)>=0?5:1}
    res.push(Object.assign({score:score},e))});
  res.sort(function(a,b){return b.score-a.score||(a.m<b.m?1:-1)});
  return res.slice(0,max||50)}
/* search-first lookup. Returns {exact, related}: "exact" has every word you typed; "related" has, for at least one
   word, only a word that means the same (DTR for transformer). opt.topic keeps to one topic. No words + a topic =
   that topic's newest records. */
function find(q,opt){opt=opt||{};var out={exact:[],related:[],words:[]};if(!mem)return out;
  var words=norm(q).split(/\s+/).filter(Boolean),alt=words.map(alike),max=opt.max||40;out.words=words;
  if(!words.length){if(!opt.topic)return out;
    out.exact=mem.entries.filter(function(e){return e.k===opt.topic}).sort(function(a,b){return a.m<b.m?1:-1}).slice(0,max);return out}
  mem.entries.forEach(function(e){if(opt.topic&&e.k!==opt.topic)return;
    var t=norm(e.t),sm=norm(e.s),all=t+" "+norm(e.x)+" "+e.d+" "+norm(e.p),score=0,loose=false;
    for(var i=0;i<words.length;i++){var w=words[i];
      if(all.indexOf(w)>=0){score+=t.indexOf(w)>=0?6:sm.indexOf(w)>=0?3:1;continue}
      var hit=false;for(var j=0;j<alt[i].length;j++)if(all.indexOf(alt[i][j])>=0){hit=true;break}
      if(!hit)return;loose=true;score+=1}
    (loose?out.related:out.exact).push({e:e,score:score})});
  var srt=function(a,b){return b.score-a.score||(a.e.m<b.e.m?1:-1)},pick=function(a){return a.sort(srt).slice(0,max).map(function(x){return x.e})};
  out.nExact=out.exact.length;out.nRelated=out.related.length;out.exact=pick(out.exact);out.related=pick(out.related);return out}
/* every file in Drive, reviewed or not, photos included: Google's own index of names and of the text inside files */
async function driveSearch(q,skip){var words=String(q||"").split(/\s+/).filter(function(w){return w.length>=2}).slice(0,6);if(!words.length)return [];
  var qs="trashed=false and 'me' in owners and mimeType!='application/vnd.google-apps.folder' and "+words.map(function(w){return "fullText contains '"+w.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+"'"}).join(" and ");
  var d=await gjson(API+"/files?spaces=drive&pageSize=40&fields="+encodeURIComponent("files(id,name,mimeType,modifiedTime,appProperties)")+"&q="+encodeURIComponent(qs),null,"Drive search");
  skip=skip||{};return (d.files||[]).filter(function(f){return !skip[f.id]&&!f.appProperties&&!junkName(f.name)&&f.name!==SHEET_NAME&&!OWN.test(f.name)}).slice(0,20)
    .map(function(f){return {id:f.id,t:f.name,u:"https://drive.google.com/file/d/"+encodeURIComponent(f.id)+"/view",m:f.modifiedTime||"",kind:kind(f.mimeType,f.name)}})}
window.PosVault={find:find,driveSearch:driveSearch,topicOf:topicOf,coverage:coverage,checkedAt:checkedAt,load:load,ensure:ensure,search:search,domainLabel:label,manual:manual,absorb:absorb,save:save,listDrive:listDrive,kind:kind,
  names:{sheet:SHEET_NAME,ai:T_AI,auto:T_AUTO,queue:T_QUEUE},
  g:{token:token,gfetch:gfetch,gjson:gjson,fail:fail,findSheet:findSheet,values:values,tabs:tabs,a1:a1,sleep:sleep,API:API,SH:SH},
  _:{entry:entry,merge:merge}};
})();
