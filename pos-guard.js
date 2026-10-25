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
})();
