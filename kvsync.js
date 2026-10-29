/* Pranju OS · sync for the small stores that had none (28 Oct 2026).
   Most sections sync their own data. These did not, so they lived on one phone only:
     BoM Kits ("bomkits"), T&C Handbook ("tc-prog"), BoQ Trainer position and settings ("p2b-cur", "p2b-qck", "p2b-std"),
     Estimate Practice progress ("est-practice"), hidden Completed tasks, Travel Trace's map key, Guitar plan skips and popups, metronome, Weight range, and small preferences.
   How: each value is split into its leaves (nested object fields); every leaf carries the time it last changed on a device.
   Merging keeps, leaf by leaf, the newer change, deletions included, so two phones never overwrite each other's edits.
   Encrypted with the sync code, in the "#kv" slot, the same way every other section is. Load this on every page.
   A page lists the keys it shows on screen in data-reload; if the other phone changed one, the page refreshes
   (or offers to, once you have started using it). */
(function(){
"use strict";
var KEYS=["bomkits","tc-prog","p2b-cur","p2b-qck","p2b-std","p2b-drill","p2b-steps","p2b-legacy","totalRecallCompletedSuppressions_v1","totalRecallGoogleMapsKey_v1",
  "gsp-skip","gs-metro-v1","health-range","dr-fb-snd","totalRecallCineSpeed","money-acct","est-practice"];
var PREFIXES=["gsp-nudged-","gsp-celebrated-"];
var SLOT="#kv",META="kvsync-meta-v1",SYNC_KEY="totalRecallSyncCode_v1",DEF="https://total-recall-ticktick.pranjuchakrapani90.workers.dev",SEP="\u0001";
var ls;try{ls=window.localStorage;}catch(e){return;}
var S=Storage.prototype,origSet=S.setItem,origRemove=S.removeItem;
function watched(k){return KEYS.indexOf(k)>=0||PREFIXES.some(function(p){return String(k).indexOf(p)===0;});}
function allKeys(){var out=KEYS.slice();for(var i=0;i<ls.length;i++){var k=ls.key(i);if(k&&out.indexOf(k)<0&&watched(k))out.push(k);}return out;}
function code(){try{return (ls.getItem(SYNC_KEY)||"").trim();}catch(e){return "";}}
function url(){var u=null;try{u=ls.getItem("totalRecallTickTickUrl");}catch(e){}u=u||window.TOTAL_RECALL_TICKTICK_URL||DEF;return u+(u.indexOf("?")>=0?"&":"?")+"mode=sync";}

/* ---- leaves: {"a\u0001b": JSON text} ; a non-JSON string is stored as one leaf "" ---- */
function flat(raw){var out={};if(raw===null||raw===undefined)return out;var v;
  try{v=JSON.parse(raw);}catch(e){out[""]=JSON.stringify({s:raw});return out;}
  /* an empty object adds no leaf: "nothing set here yet" must never outvote the other phone's entries */
  (function walk(x,p){if(x&&typeof x==="object"&&!Array.isArray(x)){Object.keys(x).forEach(function(k){walk(x[k],p===null?k:p+SEP+k);});if(p===null&&!Object.keys(x).length)out[""]=JSON.stringify({j:{}});}
    else out[p===null?"":p]=JSON.stringify({j:x});})(v,null);
  return out;}
function unflat(f){var ks=Object.keys(f);if(!ks.length)return null;
  if(ks.length===1&&ks[0]===""){var o=JSON.parse(f[""]);return "s" in o?o.s:JSON.stringify(o.j);}
  var root={};ks=ks.filter(function(p){return p!=="";}).sort(function(a,b){return a.split(SEP).length-b.split(SEP).length;});
  ks.forEach(function(p){var parts=p.split(SEP),cur=root;for(var i=0;i<parts.length-1;i++){if(!cur[parts[i]]||typeof cur[parts[i]]!=="object")cur[parts[i]]={};cur=cur[parts[i]];}
    cur[parts[parts.length-1]]=JSON.parse(f[p]).j;});
  return JSON.stringify(root);}
function meta(){try{var m=JSON.parse(ls.getItem(META)||"null");if(m&&m.snap&&m.t)return m;}catch(e){}return {snap:{},t:{}};}
function saveMeta(m){try{origSet.call(ls,META,JSON.stringify(m));}catch(e){}}
/* note what changed on this device since last time */
function stamp(m){var now=Date.now();allKeys().forEach(function(k){var cur=flat(ls.getItem(k)),prev=m.snap[k]||{},t=m.t[k]=m.t[k]||{};
  Object.keys(cur).forEach(function(p){if(prev[p]!==cur[p])t[p]=now;});
  Object.keys(prev).forEach(function(p){if(!(p in cur))t[p]=now;});
  m.snap[k]=cur;});
  Object.keys(m.snap).forEach(function(k){if(allKeys().indexOf(k)<0){var t=m.t[k]=m.t[k]||{};Object.keys(m.snap[k]).forEach(function(p){t[p]=now;});m.snap[k]={};}});}
function payload(m){var o={};Object.keys(m.t).forEach(function(k){o[k]={v:m.snap[k]||{},t:m.t[k]};});return {v:1,keys:o};}
/* take the newer change leaf by leaf; returns the keys this device changed */
function merge(m,R){var changed=[];Object.keys((R&&R.keys)||{}).forEach(function(k){if(!watched(k))return;
  var r=R.keys[k],rv=r.v||{},rt=r.t||{},lv=m.snap[k]||{},lt=m.t[k]||{},nv={},nt={},paths={};
  [lv,lt,rv,rt].forEach(function(x){Object.keys(x).forEach(function(p){paths[p]=1;});});
  Object.keys(paths).forEach(function(p){var useR=(rt[p]||0)>(lt[p]||0),src=useR?rv:lv;nt[p]=Math.max(rt[p]||0,lt[p]||0);if(p in src)nv[p]=src[p];});
  var before=JSON.stringify(lv),after=JSON.stringify(nv);m.t[k]=nt;m.snap[k]=nv;
  if(before!==after||JSON.stringify(flat(ls.getItem(k)))!==after){var val=unflat(nv);
    try{if(val===null)origRemove.call(ls,k);else origSet.call(ls,k,val);}catch(e){}changed.push(k);}});
  return changed;}

/* ---- the same encryption every section uses: AES-GCM with SHA-256(code + slot) ---- */
var b64=function(a){var s="";new Uint8Array(a).forEach(function(x){s+=String.fromCharCode(x);});return btoa(s);};
var unb64=function(s){var r=atob(s),u=new Uint8Array(r.length);for(var i=0;i<r.length;i++)u[i]=r.charCodeAt(i);return u;};
function key(c){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(c+SLOT)).then(function(h){return crypto.subtle.importKey("raw",h,{name:"AES-GCM"},false,["encrypt","decrypt"]);});}
async function enc(o,c){var iv=crypto.getRandomValues(new Uint8Array(12)),k=await key(c),ct=await crypto.subtle.encrypt({name:"AES-GCM",iv:iv},k,new TextEncoder().encode(JSON.stringify(o)));return JSON.stringify({v:1,iv:b64(iv),data:b64(ct)});}
async function dec(blob,c){var x=JSON.parse(blob),k=await key(c),p=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(x.iv)},k,unb64(x.data));return JSON.parse(new TextDecoder().decode(p));}

var busy=false,again=false,timer=0,lastPull=0,touched=false,loadedAt=Date.now();
async function sync(){var c=code();if(!c)return [];
  if(busy){again=true;return [];}busy=true;var changed=[];
  try{var m=meta();stamp(m);
    var h={"Content-Type":"application/json","X-Total-Recall-Sync":c+SLOT};
    var r=await fetch(url(),{method:"POST",headers:h,body:JSON.stringify({state:{app:"kv"}}),cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);var d=await r.json();if(d.error)throw new Error(d.error);
    var R=d.blob?await dec(d.blob,c):null;
    if(R)changed=merge(m,R);
    saveMeta(m);lastPull=Date.now();
    var mine=payload(m);
    if(!R||JSON.stringify(canon(mine))!==JSON.stringify(canon(R))){
      var w=await fetch(url(),{method:"PUT",headers:h,body:await enc(mine,c),cache:"no-store"});if(!w.ok)throw new Error("upload HTTP "+w.status);}
  }catch(e){console.warn("Pranju OS sync (#kv):",e&&e.message||e);}
  finally{busy=false;if(again){again=false;schedule();}}
  if(changed.length)applied(changed);
  return changed;}
function canon(x){if(Array.isArray(x))return x.map(canon);if(x&&typeof x==="object"){var o={};Object.keys(x).sort().forEach(function(k){o[k]=canon(x[k]);});return o;}return x;}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,1500);}

/* a page's on-screen keys changed from the other phone: refresh it */
var reloadKeys=(function(){var s=document.currentScript;return s&&s.dataset&&s.dataset.reload?s.dataset.reload.split(/[\s,]+/).filter(Boolean):[];})();
function applied(keys){try{window.dispatchEvent(new CustomEvent("kvsync",{detail:keys}));}catch(e){}
  if(!keys.some(function(k){return reloadKeys.indexOf(k)>=0;}))return;
  if(!touched&&Date.now()-loadedAt<15000){location.reload();return;}
  if(document.getElementById("kvsync-note"))return;
  var b=document.createElement("button");b.id="kvsync-note";b.type="button";b.textContent="Updated on your other device · tap to refresh";
  b.style.cssText="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;border:0;border-radius:999px;padding:11px 18px;background:#1c1b19;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px #0004";
  b.onclick=function(){location.reload();};document.body.appendChild(b);}

/* local changes: watched keys upload a moment after they are saved */
S.setItem=function(k,v){origSet.call(this,k,v);if(this===ls&&watched(k))schedule();};
S.removeItem=function(k){origRemove.call(this,k);if(this===ls&&watched(k))schedule();};
["pointerdown","keydown"].forEach(function(ev){window.addEventListener(ev,function(){touched=true;},{capture:true,passive:true});});
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&Date.now()-lastPull>30000)sync();});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){sync();});else sync();
window.PosKV={sync:sync,keys:allKeys};
})();
