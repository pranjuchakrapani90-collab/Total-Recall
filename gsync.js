/* Guitar Studio sync helpers, shared by the hub (studio.html) and Melodic Lead (guitar.html).
   - canon(): stable JSON for "does the cloud already have everything I have?" checks, so pages only upload when needed
   - melodies merge: sessions and patterns merge item by item instead of newest-wins
   - pullAll(): the hub pulls all three sections from the cloud into this device's storage (read-only, never uploads)
   - fingerprint(): 4 characters derived from the sync code, to check two phones use exactly the same code */
(function(){
"use strict";
const SYNC_KEY="totalRecallSyncCode_v1";
const url=()=>{let u=null;try{u=localStorage.getItem("totalRecallTickTickUrl");}catch(e){}u=u||"https://total-recall-ticktick.pranjuchakrapani90.workers.dev";return u+(u.indexOf("?")>=0?"&":"?")+"mode=sync";};
const code=()=>{try{return localStorage.getItem(SYNC_KEY)||"";}catch(e){return "";}};
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const unb64=s=>{const r=atob(s),u=new Uint8Array(r.length);for(let i=0;i<r.length;i++)u[i]=r.charCodeAt(i);return u;};
async function dec(blob,c,slot){const x=JSON.parse(blob||"{}"),h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(c+slot)),
  k=await crypto.subtle.importKey("raw",h,{name:"AES-GCM"},false,["decrypt"]),p=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(x.iv)},k,unb64(x.data));
  return JSON.parse(new TextDecoder().decode(p));}
async function fetchSlot(c,slot){const r=await fetch(url(),{method:"POST",headers:{"Content-Type":"application/json","X-Total-Recall-Sync":c+slot},body:JSON.stringify({state:{app:slot.slice(1)}}),cache:"no-store"});
  if(!r.ok)throw new Error("the sync bridge answered HTTP "+r.status);const d=await r.json();if(d.error)throw new Error(d.error);return d.blob?dec(d.blob,c,slot):null;}

/* stable JSON: object keys sorted, arrays of plain values sorted */
function canon(x){
  if(Array.isArray(x)){const a=x.map(canon);return "["+(x.every(v=>v===null||typeof v!=="object")?a.sort():a).join(",")+"]";}
  if(x&&typeof x==="object")return "{"+Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+":"+canon(x[k])).join(",")+"}";
  return JSON.stringify(x===undefined?null:x);}

/* ---------- Melodic Lead ---------- */
const maxMap=(a,b)=>{const o={...(a||{})};Object.entries(b||{}).forEach(([k,v])=>{if(typeof v==="number"&&!(o[k]>=v))o[k]=v;else if(!(k in o))o[k]=v;});return o;};
/* Melodic Lead minutes per phone: session.dd = {phone:{day:sec}}, session.days = their sum (what every page reads).
   Minutes recorded before this existed sit in a "legacy" bucket. */
function dev(){let d=null;try{d=localStorage.getItem("gs-dev");}catch(e){}if(!d){d="d"+Math.random().toString(36).slice(2,10);try{localStorage.setItem("gs-dev",d);}catch(e){}}return d;}
const ddOf=x=>x.dd||(x.days&&Object.keys(x.days).length?{legacy:{...x.days}}:{});
function sumDd(dd){const o={};Object.values(dd||{}).forEach(m=>Object.entries(m||{}).forEach(([k,v])=>{o[k]=Math.round(((o[k]||0)+v)*10)/10;}));return o;}
function addMinutes(x,day,sec){const dd=ddOf(x),me=dd[dev()]=dd[dev()]||{};me[day]=Math.round(((me[day]||0)+sec)*10)/10;x.dd=dd;x.days=sumDd(dd);}
function mergeSession(l,r){ // same session on two phones: keep every ticked shape and the larger minute counts
  if(!l)return JSON.parse(JSON.stringify(r));if(!r)return l;
  const nw=(r.upd||0)>(l.upd||0)?r:l,o=JSON.parse(JSON.stringify(nw));
  o.done=[...new Set([...(l.done||[]),...(r.done||[])])];
  const a=ddOf(l),b=ddOf(r),dd={};new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>{dd[k]=maxMap(a[k],b[k]);});
  if(Object.keys(dd).length){o.dd=dd;o.days=sumDd(dd);}else o.days=maxMap(l.days,r.days);
  o.time=maxMap(l.time,r.time);
  if(l.finished||r.finished)o.finished=l.finished||r.finished;
  o.upd=Math.max(l.upd||0,r.upd||0);return o;}
function mergePats(base,other,del){ // base = list from the newer settings; patterns are kept per id, newest edit wins
  const out=[],seen=new Set(),byO=new Map((other||[]).map(p=>[p.id,p]));
  (base||[]).forEach(p=>{const q=byO.get(p.id);out.push(q&&(q.t||0)>(p.t||0)?q:p);seen.add(p.id);});
  (other||[]).forEach((p,i)=>{if(seen.has(p.id))return;out.splice(Math.min(i,out.length),0,p);seen.add(p.id);});
  return out.filter(p=>!(del&&del[p.id]&&del[p.id]>=(p.t||0)));}
/* merge a remote Melodic Lead state into local {sessions,settings}; localOnly = settings that stay per device */
function mergeMelodies(local,remote,localOnly){
  const sessions={...(local.sessions||{})};
  Object.values(remote.sessions||{}).forEach(r=>{if(r&&r.id)sessions[r.id]=mergeSession(sessions[r.id],r);});
  let S={...(local.settings||{})};const R=remote.settings||null;
  if(R){const del=maxMap(S.patDel,R.patDel),newer=(R._upd||0)>(S._upd||0);
    const pats=newer?mergePats(R.myPats,S.myPats,del):mergePats(S.myPats,R.myPats,del);
    if(newer){const keep={};(localOnly||[]).forEach(k=>{if(k in S)keep[k]=S[k];});S={...S,...R,...keep};}
    S.myPats=pats;S.patDel=del;}
  oneTimeFix(sessions);
  return {sessions,settings:S};}
/* one-time correction asked for on 18 Oct 2026: Melodic Lead counts exactly 15 minutes that day
   (minutes were lost to a sync bug). Stored as its own bucket so it syncs once and is never applied twice. */
const FIX={b:"fix-20261018",day:"2026-10-18",sec:900};
function oneTimeFix(sessions){const L=Object.values(sessions||{}).filter(Boolean);if(!L.length)return;
  if(L.some(x=>x.dd&&x.dd[FIX.b]))return;
  const tot=L.reduce((a,x)=>a+((x.days&&x.days[FIX.day])||0),0);
  const host=L.slice().sort((a,b)=>((b.days&&b.days[FIX.day])||0)-((a.days&&a.days[FIX.day])||0)||(b.upd||0)-(a.upd||0))[0];
  const dd=ddOf(host);dd[FIX.b]={[FIX.day]:Math.round((FIX.sec-tot)*10)/10};host.dd=dd;host.days=sumDd(dd);}

/* ---------- Lead Course and Fingerstyle Solo: the same merge their pages use ---------- */
function mergeReps(st,R,withSess){let ch=false;st.doneT=st.doneT||{};st.done=st.done||{};st.offT=st.offT||{};st.days=st.days||{};st.odays=st.odays||{};st.tUpd=st.tUpd||0;
  Object.entries(R.done||{}).forEach(([id,x])=>{if(!st.doneT[id]||x.t>st.doneT[id]){st.doneT[id]=x.t;st.done[id]=x.d;ch=true;}});
  Object.entries(R.off||{}).forEach(([id,t])=>{if(!st.offT[id]||t>st.offT[id]){st.offT[id]=t;ch=true;}});
  Object.keys(st.offT).forEach(id=>{if(st.done[id]&&(st.offT[id]||0)>(st.doneT[id]||0)){delete st.done[id];ch=true;}});
  if((R.tUpd||0)>st.tUpd){st.tempo={...R.tempo};st.tUpd=R.tUpd;ch=true;}
  if(withSess&&(R.sessT||0)>(st.sessT||0)){st.sess=R.sess;st.sessT=R.sessT;ch=true;}
  Object.entries(R.days||{}).forEach(([dev,days])=>{const tgt=dev===st.dev?st.days:(st.odays[dev]=st.odays[dev]||{});
    Object.entries(days||{}).forEach(([k,v])=>{if(v>(tgt[k]||0)){tgt[k]=v;ch=true;}});});
  return ch;}

async function enc(o,c,slot){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(c+slot)),k=await crypto.subtle.importKey("raw",h,{name:"AES-GCM"},false,["encrypt"]),
  iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(JSON.stringify(o)));
  let b="";const t=x=>{let s="";new Uint8Array(x).forEach(v=>s+=String.fromCharCode(v));return btoa(s);};return JSON.stringify({v:1,iv:t(iv),data:t(ct)});}
async function putSlot(c,slot,o){const r=await fetch(url(),{method:"PUT",headers:{"Content-Type":"application/json","X-Total-Recall-Sync":c+slot},body:await enc(o,c,slot),cache:"no-store"});
  if(!r.ok)throw new Error("upload failed with HTTP "+r.status);}
/* the same payloads the section pages upload */
function repsPayload(st,withSess){const done={};Object.keys(st.doneT||{}).forEach(id=>{if(st.done&&st.done[id])done[id]={d:st.done[id],t:st.doneT[id]};});
  const o={v:1,done,off:st.offT||{},tempo:st.tempo||{},tUpd:st.tUpd||0,days:{...(st.odays||{}),[st.dev]:st.days||{}}};if(withSess){o.sess=st.sess||null;o.sessT=st.sessT||0;}return o;}
const LOCAL_ONLY=["micId","latency","audioMode"];
function melPayload(m){const S={...(m.st||{})};LOCAL_ONLY.forEach(k=>delete S[k]);return {v:1,sessions:m.ds||{},settings:S};}
/* hub: merge every section from the cloud into this phone, then upload whatever the cloud is missing; returns true if this phone changed */
async function pullAll(){
  const c=code();if(!c)return false;let ch=false;
  const [mel,path,fs]=await Promise.all([fetchSlot(c,"#melodies"),fetchSlot(c,"#path"),fetchSlot(c,"#fingerstyle")]);
  if(mel){const m=get("mss-sessions")||{ds:{},st:null},before=canon(m);
    const out=mergeMelodies({sessions:m.ds||{},settings:m.st||{}},mel,["micId","latency","audioMode"]);
    const nm={ds:out.sessions,st:Object.keys(out.settings).length?out.settings:(m.st||null)};if(canon(nm)!==before){put("mss-sessions",nm);ch=true;}}
  /* a section never used on this phone has no record yet: start one from the cloud copy (the page fills in its defaults on open) */
  const fresh=()=>({dev:Math.random().toString(36).slice(2,10),done:{},doneT:{},offT:{},tempo:{},tUpd:0,days:{},odays:{}});
  const oldLead=!!(localStorage.getItem("caged-v1")||localStorage.getItem("lead-v1")); // leave the Lead Course's own first-open import alone
  if(path){let st=get("leadpath-v1");if(!st&&!oldLead)st=fresh();if(st){if(!st.dev)st.dev=fresh().dev;if(mergeReps(st,path,true)){put("leadpath-v1",st);ch=true;}}}
  if(fs){let st=get("fs-v1")||fresh();if(!st.dev)st.dev=fresh().dev;if(mergeReps(st,fs,false)){put("fs-v1",st);ch=true;}}
  /* upload what only this phone has (the sections do the same when opened) */
  const m=get("mss-sessions");if(m&&(Object.keys(m.ds||{}).length||m.st)){const o=melPayload(m);if(!mel||canon(o)!==canon({v:1,sessions:mel.sessions||{},settings:mel.settings||{}}))await putSlot(c,"#melodies",o);}
  const lp=get("leadpath-v1");if(lp&&lp.dev){const o=repsPayload(lp,true);if(!path||canon(o)!==canon(path))await putSlot(c,"#path",o);}
  const f=get("fs-v1");if(f&&f.dev){const o=repsPayload(f,false);if(!fs||canon(o)!==canon(fs))await putSlot(c,"#fingerstyle",o);}
  return ch;}
async function fingerprint(){const c=code();if(!c)return "";const h=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(c)));
  return Array.from(h.slice(0,2)).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();}
/* fill any "code check" spot (class gsfp) on the page, now and whenever the page re-renders */
let fpV=null;function fillFp(){document.querySelectorAll(".gsfp").forEach(el=>{if(fpV!==null&&el.textContent!==fpV)el.textContent=fpV||"no code";});}
fingerprint().then(v=>{fpV=v;fillFp();});
document.addEventListener("DOMContentLoaded",()=>{fillFp();try{new MutationObserver(fillFp).observe(document.body,{childList:true,subtree:true});}catch(e){}});
window.GSync={dev,addMinutes,canon,mergeMelodies,mergeSession,mergePats,mergeReps,pullAll,fingerprint,code};
})();
