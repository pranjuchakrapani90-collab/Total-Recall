/* Guitar Studio · shared store for the hub's practice notes and the Daily Drills runs.
   Kept in localStorage "studio-v1" and synced (encrypted, like every section) in the "#studio" slot.
   Everything here merges item by item, so two phones never overwrite each other:
   - notes: {id:{id,t,upd,sec,good,fix}} newest edit wins, deletions kept in del:{id:time}
   - runs:  {id:{id,t,day,kind,lv,ok,n,sec,miss:[...]}} drill rounds, only ever added */
(function(){
"use strict";
const KEY="studio-v1",SLOT="#studio";
const pad=n=>String(n).padStart(2,"0");
const dkey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function load(){let s=null;try{s=JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){}
  s=s&&typeof s==="object"?s:{};s.notes=s.notes||{};s.del=s.del||{};s.runs=s.runs||{};return s;}
function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
function notes(s){s=s||load();return Object.values(s.notes).filter(n=>n&&!((s.del[n.id]||0)>=(n.upd||0))).sort((a,b)=>b.t-a.t);}
function addNote(o){const s=load(),t=Date.now(),n={id:uid(),t,upd:t,sec:o.sec||"",good:(o.good||"").trim(),fix:(o.fix||"").trim()};s.notes[n.id]=n;save(s);sync();return n;}
function delNote(id){const s=load();s.del[id]=Date.now();save(s);sync();}
function addRun(r){const s=load(),t=Date.now(),x={id:uid(),t,day:dkey(new Date()),...r};s.runs[x.id]=x;save(s);sync();return x;}
function runs(kind,s){s=s||load();return Object.values(s.runs).filter(r=>r&&(!kind||r.kind===kind)).sort((a,b)=>a.t-b.t);}
function drillSec(day){return runs().filter(r=>r.day===day).reduce((a,r)=>a+(r.sec||0),0);}
function merge(s,R){let ch=false;
  Object.values(R.notes||{}).forEach(n=>{if(!n||!n.id)return;const l=s.notes[n.id];if(!l||(n.upd||0)>(l.upd||0)){s.notes[n.id]=n;ch=true;}});
  Object.entries(R.del||{}).forEach(([k,v])=>{if(!((s.del[k]||0)>=v)){s.del[k]=v;ch=true;}});
  Object.values(R.runs||{}).forEach(r=>{if(r&&r.id&&!s.runs[r.id]){s.runs[r.id]=r;ch=true;}});
  return ch;}
let busy=null,again=false;
/* pull the cloud copy, merge, upload what the cloud lacks; resolves true if this phone changed */
function sync(){if(busy){again=true;return busy;}
  busy=(async()=>{let ch=false;
    try{const G=window.GSync;if(!G||!G.code()||!G.fetchSlot)return false;const c=G.code();
      const R=await G.fetchSlot(c,SLOT),s=load();if(R&&merge(s,R)){save(s);ch=true;}
      const o={v:1,notes:s.notes,del:s.del,runs:s.runs};
      if(!R||G.canon(o)!==G.canon({v:1,notes:R.notes||{},del:R.del||{},runs:R.runs||{}}))await G.putSlot(c,SLOT,o);
    }catch(e){console.warn("studio sync",e);}
    return ch;})();
  return busy.finally(()=>{busy=null;if(again){again=false;sync();}});}
window.GSData={load,save,notes,addNote,delNote,addRun,runs,drillSec,sync,dkey,uid};
})();
