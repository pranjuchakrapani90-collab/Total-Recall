/* Pranju OS · one search box on Home (1 Nov 2026).
   Searches, all at once and on the phone: Tasks (open, closed, any list), People Recall (name, hooks, note, office
   details), Money Book entries, Travel Trace memories, and the Gemini document vault (vault.js). Every word typed
   must match. Results are grouped by section; tapping one opens it. Loaded by index.html after tasks-local.js,
   drive.js and vault.js. */
(function(){
"use strict";
var box,input,out,launch,timer,PER=6;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function J(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function low(s){return String(s==null?"":s).toLowerCase()}
function strs(o,skip){var a=[];if(!o||typeof o!=="object")return "";Object.keys(o).forEach(function(k){if(skip&&skip[k])return;var v=o[k];
  if(typeof v==="string"||typeof v==="number")a.push(v);else if(Array.isArray(v))v.forEach(function(x){if(typeof x==="string")a.push(x)})});return a.join(" ")}
function hit(words,title,rest){var t=low(title),all=t+" "+low(rest),sc=0;for(var i=0;i<words.length;i++){if(all.indexOf(words[i])<0)return 0;sc+=t.indexOf(words[i])>=0?3:1}return sc}
function mark(s,words){s=esc(s);words.forEach(function(w){if(w.length<2)return;var re=new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig");s=s.replace(re,"<mark>$1</mark>")});return s}
function around(text,words,n){text=String(text||"");var t=low(text),i=-1;for(var k=0;k<words.length&&i<0;k++)i=t.indexOf(words[k]);
  n=n||140;if(i<0||text.length<=n)return text.slice(0,n)+(text.length>n?"…":"");var s=Math.max(0,i-40);return (s?"…":"")+text.slice(s,s+n)+(s+n<text.length?"…":"")}
function rupee(n){n=Number(n)||0;return "₹"+n.toLocaleString("en-IN",{maximumFractionDigits:2})}
var LIST={inbox:"Inbox",schedule:"SCHEDULE",projects:"PROJECTS",checklists:"CHECKLISTS",reference:"REFERENCE",archive:"ARCHIVE"};

function sTasks(w){var res=[];if(!window.PosTasks)return res;var all={};try{all=PosTasks.all()}catch(e){}
  Object.keys(all).forEach(function(id){var t=all[id],items=(t.it||[]).map(function(x){return x.ti}).join(" "),cm=(t.cm||[]).map(function(x){return x.x}).join(" ");
    var sc=hit(w,t.ti,(t.c||"")+" "+items+" "+cm+" "+(t.tg||[]).join(" "));if(!sc)return;
    var open=!t.st;res.push({sc:sc+(open?2:0),h:"tasks.html#t="+encodeURIComponent(id),t:t.ti,
      m:[LIST[t.pj]||t.pj,open?(t.du?"due "+t.du:"no date"):"closed"+(t.cd?" "+String(t.cd).slice(0,10):"")].concat((t.tg||[]).map(function(g){return "#"+g})).join(" · "),
      x:around((t.c||"")+" "+items,w)})});return res}
function sPeople(w){var db=J("totalRecallPWA_v2")||{},ppl=db.people||{},res=[];
  Object.keys(ppl).forEach(function(k){var p=ppl[k];if(!p||p.deleted)return;var g=Array.isArray(p.groups)?p.groups:[];
    var rest=g.join(" ")+" "+strs(p,{name:1,history:1,sources:1,addedAt:1,groupsAt:1});var sc=hit(w,p.name||k,rest);if(!sc)return;
    res.push({sc:sc,h:"#people",t:p.name||k,m:g.join(" · ")||"no hook yet",x:around(strs(p,{name:1,history:1,sources:1,addedAt:1,groupsAt:1,groups:1}),w)})});return res}
function sMoney(w){var c=J("inv-cash-v1")||{},tx=c.tx||{},res=[];
  Object.keys(tx).forEach(function(id){var e=tx[id];if(!e||(c.del&&c.del[id]))return;
    var sc=hit(w,e.note||e.cat||"",[e.cat,e.raw,e.ref,e.acct,e.book,e.date,e.amt].join(" "));if(!sc)return;
    res.push({sc:sc,d:e.date||"",h:"money.html",t:(e.kind==="in"?"+ ":e.kind==="out"?"− ":"⇄ ")+rupee(e.amt)+"  "+(e.note||e.cat||""),
      m:[e.date,e.time,e.acct,e.cat,e.book==="apdcl"?"APDCL":""].filter(Boolean).join(" · "),x:""})});
  res.sort(function(a,b){return b.sc-a.sc||(a.d<b.d?1:-1)});return res}
function sTravel(w){var db=J("totalRecallPWA_v2")||{},n=db.travelNotes||{},res=[];
  Object.keys(n).forEach(function(id){var e=n[id];if(!e)return;var sc=hit(w,e.text||"",e.date||"");if(!sc)return;
    res.push({sc:sc,d:e.date||"",h:"#travel",date:e.date,t:around(e.text||"(photo memory)",w,90),m:e.date||"",x:""})});
  res.sort(function(a,b){return b.sc-a.sc||(a.d<b.d?1:-1)});return res}
function sVault(w){if(!window.PosVault)return [];return PosVault.search(w.join(" "),60).map(function(e){
  return {sc:e.score,h:e.u,ext:1,t:e.t,m:PosVault.domainLabel(e.d)+" · AI summary — check the source",x:around(e.x,w,170)}})}

var GROUPS=[["Tasks",sTasks],["People",sPeople],["Money Book",sMoney],["Travel memories",sTravel],["Document vault",sVault]];
var shown={};
function run(){var q=input.value.trim(),w=low(q).split(/\s+/).filter(Boolean);
  if(!q){out.hidden=true;out.innerHTML="";if(launch)launch.style.display="";return}
  if(launch)launch.style.display="none";out.hidden=false;
  var html="",total=0;
  GROUPS.forEach(function(g){var r=[];try{r=g[1](w)}catch(e){console.warn("search",g[0],e)}
    if(g[1]!==sMoney&&g[1]!==sTravel)r.sort(function(a,b){return b.sc-a.sc});
    if(!r.length)return;total+=r.length;var lim=shown[g[0]]?r.length:PER;
    html+='<section class="srG"><h4>'+esc(g[0])+' <b>'+r.length+'</b></h4>'+r.slice(0,lim).map(function(x,i){
      return '<a class="srI" href="'+esc(x.h)+'"'+(x.ext?' target="_blank" rel="noopener"':'')+(x.date?' data-date="'+esc(x.date)+'"':'')+'><span class="srT">'+mark(x.t,w)+'</span>'+
        (x.m?'<span class="srM">'+esc(x.m)+'</span>':'')+(x.x?'<span class="srX">'+mark(x.x,w)+'</span>':'')+'</a>'}).join("")+
      (r.length>lim?'<button type="button" class="srMore" data-g="'+esc(g[0])+'">Show all '+r.length+'</button>':'')+'</section>'});
  var vm=window.PosVault&&window.__posVaultMeta;
  if(!total)html='<p class="srNone">Nothing matches “'+esc(q)+'”.</p>';
  if(window.PosVault&&!vm)html+='<p class="srNote">Document vault not loaded yet — open Vault once (needs Google Drive connected).</p>';
  out.innerHTML=html}
function init(){
  var home=$("home");launch=$("launch");if(!home||!launch||$("posSearch"))return;
  box=document.createElement("div");box.className="srBox";box.id="posSearch";
  box.innerHTML='<input id="posSearchIn" type="search" placeholder="Search tasks, people, money, memories, documents" autocomplete="off" enterkeyhint="search"><div id="posSearchOut" class="srOut" hidden></div>';
  home.insertBefore(box,launch);input=$("posSearchIn");out=$("posSearchOut");
  input.addEventListener("input",function(){shown={};clearTimeout(timer);timer=setTimeout(run,140)});
  input.addEventListener("keydown",function(e){if(e.key==="Escape"){input.value="";run()}});
  out.addEventListener("click",function(e){var b=e.target.closest(".srMore");if(b){shown[b.getAttribute("data-g")]=1;run();return}
    var a=e.target.closest("a.srI");if(a&&a.getAttribute("href").charAt(0)==="#"){var d=a.getAttribute("data-date");
      if(d)try{sessionStorage.setItem("pos-search-travel-date",d)}catch(_){}
      input.value="";run()}});
  var css=document.createElement("style");css.textContent=
    ".srBox{margin:14px 0 4px}.srBox input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--tr-line,#ddd);border-radius:12px;font:15px system-ui,sans-serif;background:var(--tr-paper,#fff);color:var(--tr-ink,#222)}"+
    ".srOut{margin-top:12px}.srG{margin:0 0 16px}.srG h4{margin:0 0 6px;font:700 12px system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--tr-muted,#777)}.srG h4 b{font-weight:600;opacity:.7}"+
    ".srI{display:block;padding:10px 12px;margin:0 0 6px;border:1px solid var(--tr-line,#e5e5e5);border-radius:12px;background:var(--tr-paper,#fff);color:var(--tr-ink,#222);text-decoration:none}"+
    ".srT{display:block;font-weight:650;line-height:1.35}.srM{display:block;font-size:12px;color:var(--tr-muted,#777);margin-top:2px}.srX{display:block;font-size:13px;color:var(--tr-ink,#333);opacity:.85;margin-top:4px;line-height:1.4}"+
    ".srI mark{background:var(--tr-acc-soft,#fde68a);color:inherit;border-radius:3px;padding:0 1px}.srMore{border:0;background:none;color:var(--tr-acc,#4f46e5);font:600 13px system-ui,sans-serif;padding:4px 2px;cursor:pointer}"+
    ".srNone,.srNote{color:var(--tr-muted,#777);font-size:13px;margin:6px 2px}";
  document.head.appendChild(css);
  if(window.PosVault)PosVault.load().then(function(d){window.__posVaultMeta=d&&d.meta||null;
    /* refresh the vault quietly in the background (at most every 10 minutes) */
    if(window.PosDrive&&PosDrive.connected())PosVault.ensure(false).then(function(d2){window.__posVaultMeta=d2&&d2.meta||null}).catch(function(){})});
}
/* a Travel memory result opens Travel Trace on that memory's day */
window.addEventListener("hashchange",function(){if(location.hash!=="#travel")return;var d=null;try{d=sessionStorage.getItem("pos-search-travel-date");sessionStorage.removeItem("pos-search-travel-date")}catch(e){}
  if(!d)return;setTimeout(function(){var el=$("travelDate");if(el&&el.value!==d){el.value=d;el.dispatchEvent(new Event("change",{bubbles:true}));el.dispatchEvent(new Event("input",{bubbles:true}))}},400)});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
