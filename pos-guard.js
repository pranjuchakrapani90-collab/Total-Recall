/* Pranju OS security guard (26 Oct 2026).
   The Worker now refuses every request that doesn't carry the owner's sync code in header X-Pranju-Key.
   This file is loaded first on every page and adds that header to each request sent to the Worker,
   so no other page code has to change. Requests to any other site are left untouched. */
(function(){
"use strict";
var SYNC_KEY="totalRecallSyncCode_v1",DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev";
function workerOrigin(){var u=null;try{u=localStorage.getItem("totalRecallTickTickUrl");}catch(e){}
  try{return new URL(u||window.TOTAL_RECALL_TICKTICK_URL||DEF).origin;}catch(e){return new URL(DEF).origin;}}
function code(){try{return (localStorage.getItem(SYNC_KEY)||"").trim();}catch(e){return "";}}
function isWorker(url){try{var o=new URL(url,location.href).origin;return o===workerOrigin()||o===new URL(DEF).origin;}catch(e){return false;}}
var orig=window.fetch;if(!orig||orig.__posGuard)return;
var guarded=function(input,init){
  var url=typeof input==="string"?input:(input&&input.url)||String(input);
  var c=code();
  if(c&&isWorker(url)){
    init=Object.assign({},init||{});
    var h=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
    h.set("X-Pranju-Key",c);init.headers=h;
    init.referrerPolicy="no-referrer";
  }
  return orig.call(this,input,init);
};
guarded.__posGuard=true;window.fetch=guarded;
/* Restore from backup (1 Nov 2026): after a restore the Worker raises restore:epoch. A phone that hasn't caught up
   clears its own Pranju OS data (keeping the sync code and connection settings) and reloads, so every section pulls
   the restored copy from Drive instead of merging this phone's newer edits back over it. Checked at most every 5 min. */
(function(){
var EK="pos-restore-epoch",CK="pos-restore-checked",KEEP=["totalRecallSyncCode_v1","totalRecallTickTickUrl","totalRecallGoogleMapsKey_v1","posDriveState",EK,CK];
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
if(!(ls("totalRecallSyncCode_v1")||"").trim())return;
if(Date.now()-Number(ls(CK)||0)<300000)return;
setTimeout(function(){
  var u=null;try{u=localStorage.getItem("totalRecallTickTickUrl")}catch(e){}u=u||window.TOTAL_RECALL_TICKTICK_URL||DEF;
  window.fetch(u+(u.indexOf("?")>=0?"&":"?")+"mode=backup&op=epoch",{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d)return;ls(CK,String(Date.now()));
    var mine=Number(ls(EK)||0),srv=Number(d.epoch||0);
    if(!srv||srv<=mine){if(!ls(EK))ls(EK,String(srv));return}
    var drop=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&KEEP.indexOf(k)<0)drop.push(k)}
    drop.forEach(function(k){try{localStorage.removeItem(k)}catch(e){}});
    ls(EK,String(srv));
    alert("Pranju OS was restored to the backup of "+(d.name||"an earlier date")+". This phone will now load the restored data.");
    location.reload();
  }).catch(function(){});
},1500);
})();
})();
