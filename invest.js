/* Investments (ETF Shop, JuniorBees PKP): shared helpers.
   The pages read Pranju's own Google Sheets live. Nothing about the sheets is stored in this public repo:
   the sheet link is pasted once on the phone, kept in this device's storage and copied to the other phones
   through the app's encrypted sync (slot "#invest"). The last data read is cached on the device so the page
   opens instantly and still shows something offline.
   Two link kinds work:
   - "Publish to web" link (…/spreadsheets/d/e/2PACX…/pubhtml): most reliable, exact cell values.
   - normal sheet link (…/spreadsheets/d/<id>/edit) shared as "Anyone with the link · Viewer". */
(function(){
"use strict";
const LK="invest-links-v1",CK="invest-cache-v1";
const get=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const links=()=>get(LK)||{};
const hasSync=()=>!!(window.GSync&&GSync.code&&GSync.code());

async function saveLink(key,val){
  const L=links();L[key]=String(val||"").trim();L.t=Date.now();put(LK,L);
  if(hasSync()){try{await GSync.putSlot(GSync.code(),"#invest",L);}catch(e){}}
}
/* another phone may have saved the links already */
async function pullLinks(){
  if(!hasSync())return false;
  try{const r=await GSync.fetchSlot(GSync.code(),"#invest"),L=links();
    if(r&&(r.t||0)>(L.t||0)){put(LK,r);return true;}
    if(L.t&&(!r||(L.t>(r.t||0))))await GSync.putSlot(GSync.code(),"#invest",L);
  }catch(e){}
  return false;
}

/* CSV → rows (quoted fields may hold commas and line breaks) */
function parseCSV(s){
  const rows=[];let row=[],f="",q=false;
  for(let i=0;i<s.length;i++){const c=s[i];
    if(q){if(c==='"'){if(s[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;
    else if(c===","){row.push(f);f="";}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&s[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f="";}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  return rows;
}
function tabUrl(link,gid){
  const pub=link.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
  if(pub)return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?gid=${gid}&single=true&output=csv&_=${Date.now()}`;
  const id=link.match(/\/spreadsheets\/d\/([\w-]{20,})/);
  if(id)return `https://docs.google.com/spreadsheets/d/${id[1]}/gviz/tq?tqx=out:csv&headers=0&gid=${gid}&_=${Date.now()}`;
  return null;
}
async function fetchTab(link,gid){
  const u=tabUrl(link,gid);if(!u)throw new Error("That doesn't look like a Google Sheets link.");
  let r;try{r=await fetch(u,{cache:"no-store"});}catch(e){throw new Error("Couldn't reach Google Sheets. Check the internet, or that the sheet is published / shared by link.");}
  if(!r.ok)throw new Error("Google Sheets answered HTTP "+r.status+". Is the sheet published to the web (or shared as 'Anyone with the link')?");
  const t=await r.text();
  if(/^\s*<(!doctype|html)/i.test(t))throw new Error("Google asked for a sign-in, so the sheet isn't public yet. Publish it to the web, or share it as 'Anyone with the link · Viewer'.");
  return parseCSV(t);
}
/* read every tab; keep the raw rows in the cache */
async function load(key,tabs){
  const link=links()[key];if(!link){const e=new Error("Add the sheet link below to load it.");e.nolink=true;throw e;}
  const raw={};
  await Promise.all(Object.entries(tabs).map(async([n,g])=>{raw[n]=await fetchTab(link,g);}));
  const c=get(CK)||{};c[key]={t:Date.now(),raw};put(CK,c);
  return wrap(raw);
}
function cached(key){const c=(get(CK)||{})[key];return c?{t:c.t,tabs:wrap(c.raw)}:null;}
function wrap(raw){const o={};Object.entries(raw||{}).forEach(([n,rows])=>{o[n]=new Grid(rows);});return o;}

/* a sheet tab: look things up by their labels, so moved columns don't break the page */
function Grid(rows){this.rows=rows||[];}
Grid.prototype.c=function(r,c){const x=(this.rows[r]||[])[c];return x==null?"":String(x).trim();};
Grid.prototype.n=function(r,c){return num(this.c(r,c));};
Grid.prototype.find=function(txt,o){o=o||{};const from=o.from||0,pre=!!o.prefix,col=o.col;
  for(let r=from;r<this.rows.length;r++){const row=this.rows[r]||[];
    for(let c=(col==null?0:col);c<(col==null?row.length:col+1);c++){const v=String(row[c]==null?"":row[c]).trim();
      if(pre?v.toLowerCase().startsWith(txt.toLowerCase()):v===txt)return [r,c];}}
  return null;};
Grid.prototype.below=function(txt,o){const p=this.find(txt,o);return p?this.c(p[0]+1,p[1]):"";};
Grid.prototype.right=function(txt,o){const p=this.find(txt,o);return p?this.c(p[0],p[1]+1):"";};

function num(s){if(s==null)return NaN;s=String(s).replace(/[₹,\s]/g,"");if(s===""||s==="-")return NaN;
  const neg=/^\(.*\)$/.test(s);s=s.replace(/[()%]/g,"");const v=parseFloat(s);return isNaN(v)?NaN:(neg?-v:v);}
const ok=v=>typeof v==="number"&&isFinite(v);
function inr(v,d){if(!ok(v))return "—";return (v<0?"−":"")+"₹"+Math.abs(v).toLocaleString("en-IN",{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function price(v){return ok(v)?v.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";}
function pct(v,sign){if(!ok(v))return "—";return (v>0&&sign?"+":v<0?"−":"")+Math.abs(v).toFixed(2)+"%";}
function signInr(v){return ok(v)?(v>0?"+":"")+inr(v):"—";}
const tone=v=>!ok(v)||Math.abs(v)<1e-9?"":(v>0?"up":"dn");
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sym=s=>String(s||"").replace(/^NSE:/,"");
const MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function date(s){const m=String(s||"").match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[-\/ ](\d{2,4})$/);
  if(m){const y=+m[3]<100?2000+ +m[3]:+m[3];return new Date(y,MON[m[2].toLowerCase()],+m[1]);}
  const d=String(s||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(d)return new Date(+d[3],+d[2]-1,+d[1]);return null;}
const short=d=>d?d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:d.getFullYear()!==new Date().getFullYear()?"2-digit":undefined}):"";
function ago(t){const m=Math.round((Date.now()-t)/6e4);if(m<1)return "just now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+" h ago";
  return new Date(t).toLocaleDateString("en-IN",{day:"numeric",month:"short"});}
/* market clock in IST: is today a weekday, and is it past the 4 PM check time? */
function ist(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false,day:"2-digit",month:"short",year:"numeric"}).formatToParts(new Date()),g=t=>(p.find(x=>x.type===t)||{}).value;
  const wd=g("weekday"),h=+g("hour"),day=new Date(+g("year"),MON[String(g("month")).slice(0,3).toLowerCase()],+g("day"));
  return {weekend:wd==="Sat"||wd==="Sun",after4:h>=16,wd,day};}

/* the "Sheet link" box both pages show */
function setupHtml(key,sheetName,tabNames){const L=links()[key]||"";
  return `<div class="setup">
    <p class="small">Reads <b>${esc(sheetName)}</b> straight from your Google Drive. The link stays on your phones (synced, encrypted) and is never in the app's code.</p>
    <ol class="small steps">
      <li>Open the sheet → <b>File → Share → Publish to web</b>.</li>
      <li>Pick <b>Entire document</b> (or just the tabs: ${esc(tabNames.join(", "))}) and <b>Publish</b>.</li>
      <li>Copy the link it shows and paste it here.</li>
    </ol>
    <p class="small muted">A normal sheet link also works if the sheet is shared as "Anyone with the link · Viewer", but published links read numbers more reliably.</p>
    <div class="linkrow"><input id="lnk" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(L)}"><button id="lnkSave" type="button">Save</button></div>
    <p class="small muted" id="lnkMsg">${hasSync()?"Saved links reach your other phones through Sync.":"Turn on Sync on the home screen to share the link with your other phones."}</p>
  </div>`;}
function bindSetup(root,key,onSaved){const b=root.querySelector("#lnkSave");if(!b)return;
  b.onclick=async()=>{const v=root.querySelector("#lnk").value.trim();
    if(v&&!tabUrl(v,0)){root.querySelector("#lnkMsg").textContent="That isn't a Google Sheets link.";return;}
    b.disabled=true;await saveLink(key,v);b.disabled=false;root.querySelector("#lnkMsg").textContent="Saved.";onSaved&&onSaved();};}

window.Invest={links,saveLink,pullLinks,load,cached,parseCSV,Grid,num,ok,inr,price,pct,signInr,tone,esc,sym,date,short,ago,ist,setupHtml,bindSetup};
})();
