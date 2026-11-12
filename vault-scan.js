/* Pranju OS · Vault scan (12 Nov 2026): reviews Drive files with code, no AI.
   What Gemini's half-hourly runs did for 15 files at a time, this does in the page for the whole Drive:
     1. lists every PDF, Sheet and Doc you own in Drive and drops the ones that already have a row in the index sheet
        ("Gemini Vault Index": Gemini's "Index" tab or Pranju OS's "Auto index" tab);
     2. exact copies are found by Drive's own checksum (md5) and written as "duplicate" rows without being opened;
     3. every other file is read as text by Google itself: a Google Doc is exported as text; a PDF or Word file is
        copied into a temporary Google Doc (Drive runs its OCR on scans while converting), read, and the copy deleted;
        a spreadsheet gives its tab names, sizes and first rows through the Sheets API;
     4. vault-rules.js turns that text into the index columns;
     5. rows go to the "Auto index" tab; files the rules could not read or classify also go to the "Needs review"
        tab, which is the only list Gemini has to work through from now on.
   Nothing in Drive is changed except the temporary copies, which live in "Pranju OS / Vault scan (temporary)" for a
   few seconds and are deleted for good. Stopping is safe at any time: the next scan carries on where this one ended.
   Needs vault.js and vault-rules.js loaded first.
   window.PosScan:
     plan(progress)        -> {todo, dups, counts}   what a scan would do (reads only)
     run({limit,onProgress}) -> totals              does it; limit = at most this many files to read (for a trial)
     stop()                -> asks a running scan to finish the files in hand and stop
     running()             -> true while a scan runs */
(function(){
"use strict";
var V=window.PosVault,R=window.PosRules,G=V.g,N=V.names,API=G.API,SH=G.SH;
var HEAD=["file_id","file_name","view_url","folder_path","file_type","modified_time","created_time","source","doc_type","consumer_nos","memo_letter_nos","receipt_nos","names","places","amounts","summary","handwritten","confidence","verified","uncertain","discrepancies","analyst_note","read_complete","status","duplicate_of","indexed_at"];
var QHEAD=["file_id","file_name","view_url","file_type","modified_time","why_it_needs_review","what_the_rules_found","added_at"];
var GDOC="application/vnd.google-apps.document",GSHEET="application/vnd.google-apps.spreadsheet",GSLIDES="application/vnd.google-apps.presentation";
var WORKERS=3,MAXPDF=30e6,MAXXLS=20e6;
var state={running:false,stop:false},lastPlan=null;

function ext(n){var m=String(n||"").toLowerCase().match(/\.([a-z0-9]{2,5})$/);return m?m[1]:""}
/* how a file is read: gdoc | gsheet | gslides | pdf | word | excel | slides | csv | txt | "" (not a document) */
function how(mime,name){var e=ext(name);mime=String(mime||"");
  if(mime===GDOC)return "gdoc";if(mime===GSHEET)return "gsheet";if(mime===GSLIDES)return "gslides";
  if(mime==="application/pdf"||e==="pdf")return "pdf";
  if(e==="csv"||mime==="text/csv")return "csv";if(e==="txt"||mime==="text/plain")return "txt";
  if(/wordprocessingml|msword|opendocument\.text|rtf/.test(mime)||/^(docx?|odt|rtf)$/.test(e))return "word";
  if(/spreadsheetml|ms-excel|opendocument\.spreadsheet/.test(mime)||/^(xlsx?|ods)$/.test(e))return "excel";
  if(/presentationml|ms-powerpoint/.test(mime)||/^pptx?$/.test(e))return "slides";
  return ""}
function typeWord(h){return h==="pdf"?"pdf":/sheet|excel|csv/.test(h)?"sheet":/slides/.test(h)?"slides":"doc"}
function jpost(body){return {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}}

/* ---------- the sheet: make sure the two Pranju OS tabs exist ---------- */
async function setup(){
  var f=await G.findSheet(),tb=await G.tabs(f.id),has=function(n){return tb.some(function(t){return t.title===n})},add=[];
  if(!has(N.auto))add.push({addSheet:{properties:{title:N.auto,gridProperties:{rowCount:1000,columnCount:26,frozenRowCount:1}}}});
  if(!has(N.queue))add.push({addSheet:{properties:{title:N.queue,gridProperties:{rowCount:500,columnCount:8,frozenRowCount:1}}}});
  if(add.length){
    await G.gjson(SH+f.id+":batchUpdate",jpost({requests:add}),"Adding the Pranju OS tabs to the index sheet");
    var data=[];if(!has(N.auto))data.push({range:G.a1(N.auto,"A1"),values:[HEAD]});if(!has(N.queue))data.push({range:G.a1(N.queue,"A1"),values:[QHEAD]});
    await G.gjson(SH+f.id+"/values:batchUpdate",jpost({valueInputOption:"RAW",data:data}),"Writing the tab headings")}
  return f.id}
async function append(sheetId,tab,rows){
  if(!rows.length)return;
  var r=await G.gfetch(SH+sheetId+"/values/"+encodeURIComponent(G.a1(tab,"A1"))+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",jpost({values:rows}));
  if(!r.ok)throw await G.fail(r,"Writing to the index sheet")}
/* ids and statuses already in a tab: {id: status} */
async function known(sheetId,tab){var out={},n=0;
  var a=await G.values(sheetId,G.a1(tab,"A2:A")),x=await G.values(sheetId,G.a1(tab,"X2:X"));
  a.forEach(function(r,i){var id=String(r&&r[0]||"").trim();n=i+1;if(id)out[id]=String(x[i]&&x[i][0]||"").trim().toLowerCase()||"?"});
  return {ids:out,rows:a.length}}

/* ---------- folders, for the folder_path column ---------- */
async function folderPaths(){
  var by={},page="";
  for(var i=0;i<60;i++){var d=await G.gjson(API+"/files?spaces=drive&pageSize=1000&fields="+encodeURIComponent("nextPageToken,files(id,name,parents)")+"&q="+encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners")+(page?"&pageToken="+encodeURIComponent(page):""),null,"Folder listing");
    (d.files||[]).forEach(function(f){by[f.id]={n:f.name,p:(f.parents||[])[0]||""}});if(!d.nextPageToken)break;page=d.nextPageToken}
  var memo={};
  return function(id){if(memo[id])return memo[id];var parts=[],cur=id;for(var k=0;k<12&&by[cur];k++){parts.unshift(by[cur].n);cur=by[cur].p}
    return memo[id]=["Drive"].concat(parts).join("/")}}

/* ---------- temporary copies ---------- */
async function tmpFolder(){
  var c="";try{c=localStorage.getItem("posScanTmp")||""}catch(e){}
  if(c){var chk=await G.gfetch(API+"/files/"+encodeURIComponent(c)+"?fields=id,trashed");if(chk.ok){var cj=await chk.json();if(!cj.trashed)return c}}
  var q="mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='pos' and value='scantmpdir' }";
  var d=await G.gjson(API+"/files?spaces=drive&fields=files(id)&q="+encodeURIComponent(q),null,"Drive search"),id=(d.files||[])[0]&&d.files[0].id;
  if(!id){var t=await G.token(),root=t.folders&&t.folders.root;
    var body={name:"Vault scan (temporary)",mimeType:"application/vnd.google-apps.folder",appProperties:{pos:"scantmpdir"}};if(root)body.parents=[root];
    id=(await G.gjson(API+"/files?fields=id",jpost(body),"Making the temporary folder")).id}
  try{localStorage.setItem("posScanTmp",id)}catch(e){}return id}
async function del(id){try{await G.gfetch(API+"/files/"+encodeURIComponent(id),{method:"DELETE"})}catch(e){}}
/* copies left behind by a scan that was cut off (phone locked, tab closed) */
async function sweep(){
  var q="trashed=false and appProperties has { key='pos' and value='scantmp' }",n=0;
  for(var i=0;i<20;i++){var d=await G.gjson(API+"/files?spaces=drive&pageSize=200&fields=files(id)&q="+encodeURIComponent(q),null,"Drive search"),fs=d.files||[];if(!fs.length)break;
    for(var k=0;k<fs.length;k++){await del(fs[k].id);n++}}
  return n}
function hard(e,msg){var x=new Error(msg||e.message);x.hard=true;return x}
/* Google refused this one file for good (too big, cannot be converted)? "Slow down" and "storage full" are not that. */
function refused(r,e){return (r.status===400||r.status===403||r.status===413)&&!/rate limit|quota|storage|too many/i.test(e.message)}
function inner(e){var m=String(e.message).match(/\((Google HTTP [^]*)\)$/);return m?m[1]:e.message}
/* copy the file as a Google Doc / Sheet / Slides (Drive converts it, with OCR for scans), use it, delete it */
async function converted(file,target,dir,use){
  var r=await G.gfetch(API+"/files/"+encodeURIComponent(file.id)+"/copy?fields=id",jpost({name:"~pos-scan "+file.id,mimeType:target,parents:[dir],appProperties:{pos:"scantmp"}}));
  if(!r.ok){var e=await G.fail(r,"Converting to text");
    if(r.status===404)e.gone=true;else if(refused(r,e))e=hard(e,"Drive could not turn this file into text: "+inner(e));
    throw e}
  var id=(await r.json()).id;
  try{return await use(id)}finally{await del(id)}}
async function exportText(id){
  var r=await G.gfetch(API+"/files/"+encodeURIComponent(id)+"/export?mimeType="+encodeURIComponent("text/plain"));
  if(!r.ok){var e=await G.fail(r,"Reading the text");if(r.status===404)e.gone=true;else if(refused(r,e))e=hard(e,"Drive could not hand this file over as text: "+inner(e));throw e}
  return r.text()}
async function head(id,bytes){
  var r=await G.gfetch(API+"/files/"+encodeURIComponent(id)+"?alt=media",{headers:{Range:"bytes=0-"+(bytes-1)}});
  if(!r.ok){var e=await G.fail(r,"Downloading");if(r.status===404)e.gone=true;throw e}return r.text()}
/* a spreadsheet's tabs with sizes and first rows (two Sheets calls) */
async function sheetTabs(id){
  var r=await G.gfetch(SH+id+"?fields="+encodeURIComponent("sheets.properties(title,sheetType,gridProperties(rowCount,columnCount))"));
  if(!r.ok){var e=await G.fail(r,"Reading the spreadsheet");if(r.status===404)e.gone=true;else if(refused(r,e))e=hard(e,"Google Sheets could not open this spreadsheet: "+inner(e));throw e}
  var ps=((await r.json()).sheets||[]).map(function(s){return s.properties}).filter(function(p){return !p.sheetType||p.sheetType==="GRID"}),first=ps.slice(0,6);
  if(!first.length)return [];
  var q=first.map(function(p){return "ranges="+encodeURIComponent(G.a1(p.title,"A1:Z40"))}).join("&");
  var d=await G.gjson(SH+id+"/values:batchGet?majorDimension=ROWS&"+q,null,"Reading the spreadsheet"),vr=d.valueRanges||[];
  return ps.map(function(p,i){var g=p.gridProperties||{};return {title:p.title,rows:g.rowCount||0,cols:g.columnCount||0,sample:i<first.length?(vr[i]&&vr[i].values)||[]:[]}})}
function csvRows(text){return String(text).split(/\r?\n/).slice(0,40).map(function(l){var out=[],cur="",q=false;
  for(var i=0;i<l.length;i++){var ch=l[i];if(ch==='"'){if(q&&l[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===","&&!q){out.push(cur);cur=""}else cur+=ch}
  out.push(cur);return out})}

/* ---------- one file -> its fields ---------- */
async function readFile(file,dir){
  var h=file.how,mb=function(){return (file.size/1e6).toFixed(1)+" MB"};
  if(h==="gdoc")return R.read(file,await exportText(file.id));
  if(h==="gslides")return R.read(file,await exportText(file.id));
  if(h==="gsheet")return R.readSheet(file,await sheetTabs(file.id));
  if(h==="txt")return R.read(file,await head(file.id,200000));
  if(h==="csv")return R.readSheet(file,[{title:file.name,rows:0,cols:0,sample:csvRows(await head(file.id,200000))}]);
  if(h==="pdf"||h==="word"){
    if(file.size>MAXPDF)throw hard(null,"Too large to read automatically ("+mb()+")");
    return converted(file,GDOC,dir,async function(id){return R.read(file,await exportText(id))})}
  if(h==="slides")return converted(file,GSLIDES,dir,async function(id){return R.read(file,await exportText(id))});
  if(h==="excel"){
    if(file.size>MAXXLS)throw hard(null,"Too large to read automatically ("+mb()+")");
    return converted(file,GSHEET,dir,async function(id){return R.readSheet(file,await sheetTabs(id))})}
  throw hard(null,"Not a document type the rules read")}

/* ---------- plan ---------- */
async function plan(progress){
  var say=function(s){if(progress)progress(s)};
  say("Opening the index sheet…");var sheetId=await setup();
  var ai=await known(sheetId,N.ai),auto=await known(sheetId,N.auto),done={};
  Object.keys(auto.ids).forEach(function(k){done[k]=auto.ids[k]});Object.keys(ai.ids).forEach(function(k){if(ai.ids[k]==="skipped"&&done[k])return;done[k]=ai.ids[k]});
  say("Listing your Drive…");
  var list=await V.listDrive(function(n){say("Listing your Drive… "+n.toLocaleString("en-IN")+" files")}),pathOf=await folderPaths(),dir=await tmpFolder();
  var files=[],byMd5={},counts={drive:0,docs:0,indexed:0,waiting:0,PDFs:0,Sheets:0,Docs:0};
  list.files.forEach(function(f){counts.drive++;if(f[7]===dir)return;var h=how(f[2],f[1]);if(!h)return;counts.docs++;
    var o={id:f[0],name:f[1],mime:f[2],modified:f[3],created:f[4],size:f[5],md5:f[6],parent:f[7],how:h,type:typeWord(h)};files.push(o);
    if(o.md5)(byMd5[o.md5]=byMd5[o.md5]||[]).push(o)});
  var isRec=function(id){var s=done[id];return s&&s!=="duplicate"};
  var primary={};
  Object.keys(byMd5).forEach(function(k){var g=byMd5[k];if(g.length<2)return;
    var p=g.filter(function(o){return isRec(o.id)})[0]||g.slice().sort(function(a,b){return (a.created||a.modified)<(b.created||b.modified)?-1:1})[0];primary[k]=p});
  var todo=[],dups=[];
  files.forEach(function(o){
    if(done[o.id]){counts.indexed++;if(done[o.id]==="needs_review")counts.waiting++;return}
    o.path=pathOf(o.parent);
    var p=o.md5&&primary[o.md5];if(p&&p.id!==o.id){dups.push({file:o,of:p});return}
    todo.push(o);counts[o.type==="pdf"?"PDFs":o.type==="sheet"?"Sheets":"Docs"]++});
  todo.sort(function(a,b){return a.modified<b.modified?1:-1});
  /* take files that now have a proper record off the "Needs review" tab */
  var tidied=0;try{tidied=await tidy(sheetId,done)}catch(e){}
  var swept=0;try{swept=await sweep()}catch(e){}
  lastPlan={sheetId:sheetId,dir:dir,todo:todo,dups:dups,counts:counts,autoRows:auto.rows,at:Date.now(),tidied:tidied,swept:swept};
  return lastPlan}
async function tidy(sheetId,done){
  var rows=await G.values(sheetId,G.a1(N.queue,"A2:H"));if(!rows.length)return 0;
  var keep=rows.filter(function(r){var s=done[String(r[0]||"").trim()];return !s||s==="needs_review"});
  if(keep.length===rows.length)return 0;
  await G.gjson(SH+sheetId+"/values/"+encodeURIComponent(G.a1(N.queue,"A2:H"))+":clear",jpost({}),"Tidying the review list");
  if(keep.length)await G.gjson(SH+sheetId+"/values/"+encodeURIComponent(G.a1(N.queue,"A2"))+"?valueInputOption=RAW",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:keep})},"Tidying the review list");
  return rows.length-keep.length}

/* ---------- run ---------- */
async function run(opt){
  opt=opt||{};if(state.running)throw new Error("A scan is already running.");
  state.running=true;state.stop=false;var lock=null;
  var T={read:0,auto:0,review:0,dups:0,failed:0,gone:0,left:0,errors:[]},tell=function(msg){if(opt.onProgress)try{opt.onProgress(Object.assign({msg:msg||""},T))}catch(e){}};
  try{
    try{if(navigator.wakeLock)lock=await navigator.wakeLock.request("screen")}catch(e){}
    var p=lastPlan&&Date.now()-lastPlan.at<5*60000?lastPlan:await plan(function(s){tell(s)});lastPlan=null;
    /* the phone's copy must line up with the sheet before rows are added to both */
    var cur=await V.ensure(true);if(cur&&cur.raw&&cur.raw.autoRows!==p.autoRows)await V.ensure("full");
    var limit=opt.limit>0?opt.limit:Infinity,todo=p.todo.slice(0,limit),dups=opt.limit>0?p.dups.slice(0,opt.limit):p.dups;
    T.left=todo.length+dups.length;
    var buf=[],qbuf=[],writing=Promise.resolve(),sinceSave=0;
    var flush=function(){var rows=buf,q=qbuf;buf=[];qbuf=[];if(!rows.length)return writing;
      writing=writing.then(async function(){await append(p.sheetId,N.auto,rows);V.absorb(rows);if(q.length)await append(p.sheetId,N.queue,q);
        sinceSave+=rows.length;if(sinceSave>=400){sinceSave=0;await V.save()}});return writing};
    /* exact copies first: no reading needed */
    for(var i=0;i<dups.length&&!state.stop;i++){var d=dups[i];
      buf.push(R.toRow({id:d.file.id,name:d.file.name,path:d.file.path,type:d.file.type,modified:d.file.modified,created:d.file.created},
        {doc_type:"",confidence:"high",summary:'Exact copy of "'+d.of.name+'"',read:"checksum only"},{status:"duplicate",duplicateOf:d.of.id,note:"Same checksum as "+d.of.id+" (found by Pranju OS, no AI)"}));
      T.dups++;T.left--;if(buf.length>=200){tell("Writing duplicates…");await flush()}}
    await flush();tell("Reading files…");
    var next=0,fatal=null,streak=0;
    var worker=async function(){
      while(!state.stop&&!fatal){var k=next++;if(k>=todo.length)return;var f=todo[k],fields=null;
        try{fields=await readFile(f,p.dir)}
        catch(e){
          if(e&&e.gone){T.gone++;T.left--;continue}
          if(e&&e.hard)fields={doc_type:"other",confidence:"low",needs:true,reason:e.message,summary:"Not read: "+e.message,read:"none",consumer_nos:[],memo_nos:[],receipt_nos:[],names:[],places:[],amounts:[]};
          else{T.failed++;T.left--;streak++;if(T.errors.length<5)T.errors.push(f.name+": "+(e&&e.message||e));
            if(e&&(e.code==="not_connected"||e.code==="need_full"||e.status===401))fatal=e;
            else if(streak>=10)fatal=new Error("Stopped after 10 files in a row could not be read. Last reason: "+(e&&e.message||e));
            continue}}
        streak=0;
        var row=R.toRow({id:f.id,name:f.name,path:f.path,type:f.type,modified:f.modified,created:f.created},fields);
        buf.push(row);T.read++;T.left--;
        if(fields.needs){T.review++;qbuf.push([f.id,f.name,row[2],f.type,row[5],fields.reason||"",fields.summary||"",R.ist()])}else T.auto++;
        if(buf.length>=25)flush().catch(function(e){fatal=e});
        tell(f.name)}};
    var ws=[];for(var w=0;w<Math.min(WORKERS,todo.length);w++)ws.push(worker());
    await Promise.all(ws);await flush();await writing;await V.save();
    if(fatal)throw fatal;
    tell(state.stop?"Stopped":"Finished");return T
  }finally{state.running=false;state.stop=false;try{if(lock)await lock.release()}catch(e){}}}
window.PosScan={plan:plan,run:run,stop:function(){state.stop=true},running:function(){return state.running},_:{how:how,csvRows:csvRows}};
})();
