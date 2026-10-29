/* Pranju OS → Google Drive (27 Oct 2026).
   The Worker holds the Google connection and hands out short-lived access tokens (?mode=drive&op=token);
   this file talks to Google Drive directly with them, so big files never pass through the Worker.
   window.PosDrive:
     status()                          -> {configured, connected, email}   (also cached in localStorage "posDriveState")
     connected()                       -> true when the last status said connected (no network)
     connect()                         -> goes to Google's consent page; comes back to Travel Trace with ?drive=ok
     disconnect()
     find({key:value})                 -> [{id,name,size}] files this app made with those appProperties
     upload(folder, name, blob, props) -> {id,name,size}   folder: "gps" | "photos" (resumable, any size)
     download(id)                      -> Blob
     trash(id)                         -> moves to Drive's bin (recoverable for 30 days)
     viewUrl(id)                       -> link that opens the file in Drive
     result                            -> "ok" | "denied" | "error" | "" : how the last Connect ended (read once) */
(function(){
"use strict";
var DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev",API="https://www.googleapis.com/drive/v3",UP="https://www.googleapis.com/upload/drive/v3";
var tok=null,result="";
try{var sp=new URLSearchParams(location.search),r=sp.get("drive");
  if(r){result=r;sp.delete("drive");var qs=sp.toString();history.replaceState(null,"",location.pathname+(qs?"?"+qs:"")+location.hash);}}catch(e){}
function base(){var u=null;try{u=localStorage.getItem("totalRecallTickTickUrl")}catch(e){}return u||window.TOTAL_RECALL_TICKTICK_URL||DEF}
function wurl(q){var u=base();return u+(u.indexOf("?")>=0?"&":"?")+"mode=drive&"+q}
function remember(s){try{localStorage.setItem("posDriveState",JSON.stringify({configured:!!s.configured,connected:!!s.connected,email:s.email||"",at:Date.now()}))}catch(e){}}
async function worker(q,method){
  var r=await fetch(wurl(q),{method:method||"GET",cache:"no-store"}),d={};
  try{d=await r.json()}catch(e){}
  if(!r.ok||d.error){var e=new Error(d.error||("the Worker answered HTTP "+r.status));e.code=d.code||"";if(e.code==="not_connected")remember({configured:true,connected:false});throw e}
  return d}
async function status(){var s=await worker("op=status");remember(s);return s}
function connected(){try{var s=JSON.parse(localStorage.getItem("posDriveState")||"null");return !!(s&&s.connected)}catch(e){return false}}
async function connect(){var back=location.origin+location.pathname+"#travel",d=await worker("op=start&back="+encodeURIComponent(back));location.href=d.url}
async function disconnect(){await worker("op=disconnect","POST");tok=null;remember({configured:true,connected:false})}
async function token(fresh){
  if(!fresh&&tok&&tok.exp>Date.now()+90000)return tok;
  var d=await worker("op=token"+(fresh?"&fresh=1":""));
  tok={token:d.token,exp:Date.now()+(d.expiresIn||1800)*1000,folders:d.folders||{}};return tok}
async function gfetch(url,init,again){
  var t=await token();init=Object.assign({},init||{});
  var h=new Headers(init.headers||{});h.set("Authorization","Bearer "+t.token);init.headers=h;
  var r=await fetch(url,init);
  if(r.status===401&&!again){tok=null;return gfetch(url,init,true)}
  return r}
async function fail(r,what){var m="";try{var d=await r.json();m=d.error&&d.error.message||""}catch(e){}return new Error(what+" failed (Google Drive HTTP "+r.status+(m?": "+m:"")+")")}
function propsQuery(props){return Object.keys(props).map(function(k){return "appProperties has { key='"+k+"' and value='"+String(props[k]).replace(/'/g,"\\'")+"' }"}).join(" and ")}
async function find(props){
  var r=await gfetch(API+"/files?spaces=drive&fields=files(id,name,size)&q="+encodeURIComponent(propsQuery(props)+" and trashed=false"));
  if(!r.ok)throw await fail(r,"Drive search");return (await r.json()).files||[]}
async function upload(folder,name,blob,props,again){
  var t=await token(again),parent=t.folders[folder];
  if(!parent)throw new Error("the Drive folder for "+folder+" is missing");
  var type=blob.type||"application/octet-stream";
  var start=await gfetch(UP+"/files?uploadType=resumable&fields=id,name,size",{method:"POST",
    headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":type,"X-Upload-Content-Length":String(blob.size)},
    body:JSON.stringify({name:name,parents:[parent],appProperties:props||{}})});
  if(start.status===404&&!again)return upload(folder,name,blob,props,true); // folder deleted in Drive: recreate and retry
  if(!start.ok)throw await fail(start,"Drive upload");
  var loc=start.headers.get("Location");if(!loc)throw new Error("Google Drive did not return an upload address");
  var put=await fetch(loc,{method:"PUT",headers:{"Content-Type":type},body:blob});
  if(!put.ok)throw await fail(put,"Drive upload");
  return put.json()}
/* Estimate Lessons (29 Oct 2026): make an empty Google file (e.g. a Sheet) in a Pranju OS folder, replace a file's
   content, and read a Google file as text (a Sheet exports its first tab as CSV). */
async function create(folder,name,mime,props,again){
  var t=await token(again),parent=t.folders[folder];
  if(!parent)throw new Error("the Drive folder for "+folder+" is missing");
  var r=await gfetch(API+"/files?fields=id,name",{method:"POST",headers:{"Content-Type":"application/json; charset=UTF-8"},
    body:JSON.stringify({name:name,mimeType:mime,parents:[parent],appProperties:props||{}})});
  if(r.status===404&&!again)return create(folder,name,mime,props,true);
  if(!r.ok)throw await fail(r,"Drive create");return r.json()}
async function put(id,blob){
  var r=await gfetch(UP+"/files/"+encodeURIComponent(id)+"?uploadType=media&fields=id,name,size",{method:"PATCH",headers:{"Content-Type":blob.type||"application/octet-stream"},body:blob});
  if(!r.ok)throw await fail(r,"Drive save");return r.json()}
async function exportText(id,mime){
  var r=await gfetch(API+"/files/"+encodeURIComponent(id)+"/export?mimeType="+encodeURIComponent(mime||"text/csv"));
  if(!r.ok)throw await fail(r,"Drive read");return r.text()}
async function download(id){var r=await gfetch(API+"/files/"+encodeURIComponent(id)+"?alt=media");if(!r.ok)throw await fail(r,"Drive download");return r.blob()}
async function trash(id){var r=await gfetch(API+"/files/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:true})});if(!r.ok&&r.status!==404)throw await fail(r,"Drive delete")}
window.PosDrive={status:status,connected:connected,connect:connect,disconnect:disconnect,find:find,upload:upload,download:download,trash:trash,create:create,put:put,exportText:exportText,
  viewUrl:function(id){return "https://drive.google.com/file/d/"+encodeURIComponent(id)+"/view"},
  get result(){var r=result;result="";return r}};
})();
