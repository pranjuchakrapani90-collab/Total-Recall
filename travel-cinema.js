/* Pranju OS — Travel Trace "Week in Motion"
   A full-screen film of one week (Monday–Sunday) of GPS days:
   week title → for each day with a trace: title card, then a marker that runs the route from the first point
   to the last at a steady pace (by distance, not clock time, so time spent in one place is never replayed).
   The camera stays at "road level" and glides after the marker; the route is simplified first so GPS wobble,
   zig-zags and micro-curves disappear while real bends stay. The marker stops only at pinned memories
   (note + photos), then carries on. Ends with every day's route together and the week's numbers.
   Uses window.TravelBridge from index.html (dates, day, notes, photo, maps, esc).
*/
(function(){'use strict';
var DAYCOL=['#f59e0b','#38bdf8','#a78bfa','#34d399','#f472b6','#facc15','#fb7185'];
var SPEEDS=[0.75,1,1.5,2];
var MAPSTYLE=[
 {elementType:'geometry',stylers:[{color:'#1b1f2a'}]},
 {elementType:'labels.text.fill',stylers:[{color:'#8a93a6'}]},
 {elementType:'labels.text.stroke',stylers:[{color:'#11141b'}]},
 {featureType:'administrative',elementType:'geometry',stylers:[{color:'#2c3242'}]},
 {featureType:'poi',stylers:[{visibility:'off'}]},
 {featureType:'transit',stylers:[{visibility:'off'}]},
 {featureType:'road',elementType:'geometry',stylers:[{color:'#2a3040'}]},
 {featureType:'road',elementType:'labels.icon',stylers:[{visibility:'off'}]},
 {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#3a4155'}]},
 {featureType:'water',elementType:'geometry',stylers:[{color:'#0e1626'}]},
 {featureType:'landscape.natural',elementType:'geometry',stylers:[{color:'#1d2430'}]}
];
var S=null;

function $(id){return document.getElementById(id)}
function TB(){return window.TravelBridge}
function h(s){var e=TB()&&TB().esc;return e?e(s==null?'':s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pref(k,d){try{var v=localStorage.getItem('tcine_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function setPref(k,v){try{localStorage.setItem('tcine_'+k,JSON.stringify(v))}catch(e){}}

/* ---------- dates & weeks (Monday to Sunday) ---------- */
function dUTC(s){return new Date(s+'T00:00:00Z')}
function iso(d){return d.toISOString().slice(0,10)}
function addDays(s,n){var d=dUTC(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)}
function monday(s){var d=dUTC(s),w=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-w);return iso(d)}
function fmt(s,o){return dUTC(s).toLocaleDateString(undefined,Object.assign({timeZone:'UTC'},o))}
function weekLabel(m){return fmt(m,{day:'numeric',month:'short'})+' – '+fmt(addDays(m,6),{day:'numeric',month:'short',year:'numeric'})}
function weeksWithData(){
  var by={};(TB().dates()||[]).forEach(function(d){var m=monday(d);(by[m]||(by[m]=[])).push(d)});
  return Object.keys(by).sort().reverse().map(function(m){return {start:m,dates:by[m].sort()}})
}

/* ---------- geometry ---------- */
function hav(a,b){var R=6371000,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lng-a.lng)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function proj(lat0,lng0){var kx=Math.cos(lat0*Math.PI/180)*111320,ky=110540;return{
  xy:function(p){return{x:(p.lng-lng0)*kx,y:(p.lat-lat0)*ky,ms:p.ms||0}},
  ll:function(q){return{lat:lat0+q.y/ky,lng:lng0+q.x/kx}}}}
function segDist(p,a,b){var dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy,t=L?((p.x-a.x)*dx+(p.y-a.y)*dy)/L:0;t=Math.max(0,Math.min(1,t));var x=a.x+t*dx-p.x,y=a.y+t*dy-p.y;return{d:Math.sqrt(x*x+y*y),t:t}}
/* Douglas–Peucker: keep only the points that matter at this zoom */
function simplify(pts,tol){
  var n=pts.length;if(n<3)return pts.slice();
  var keep=new Uint8Array(n),st=[[0,n-1]];keep[0]=keep[n-1]=1;
  while(st.length){var r=st.pop(),a=r[0],b=r[1],md=0,mi=-1;
    for(var i=a+1;i<b;i++){var d=segDist(pts[i],pts[a],pts[b]).d;if(d>md){md=d;mi=i}}
    if(md>tol&&mi>0){keep[mi]=1;st.push([a,mi],[mi,b])}}
  return pts.filter(function(_,i){return keep[i]})
}
/* round each corner a little so the marker turns instead of snapping */
function roundCorners(pts,R){
  if(pts.length<3)return pts.slice();
  var out=[pts[0]];
  function lerp(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,ms:a.ms+(b.ms-a.ms)*t}}
  function len(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
  for(var i=1;i<pts.length-1;i++){
    var A=pts[i-1],P=pts[i],B=pts[i+1],la=len(A,P),lb=len(P,B);
    if(la<1||lb<1){out.push(P);continue}
    var p1=lerp(P,A,Math.min(R,la*.45)/la),p2=lerp(P,B,Math.min(R,lb*.45)/lb);
    for(var k=0;k<=5;k++){var t=k/5,u=1-t;out.push({x:u*u*p1.x+2*u*t*P.x+t*t*p2.x,y:u*u*p1.y+2*u*t*P.y+t*t*p2.y,ms:u*u*p1.ms+2*u*t*P.ms+t*t*p2.ms})}
  }
  out.push(pts[pts.length-1]);return out
}
function mpp(z,lat){return 156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z)}

/* one day: cleaned GPS segments → a smooth path measured by distance, plus where each memory sits on it */
function buildDay(date,segs,notes,ci){
  var raw=[];segs.slice().sort(function(a,b){return (a[0].ms||0)-(b[0].ms||0)}).forEach(function(s){s.forEach(function(p){raw.push(p)})});
  var km=0;segs.forEach(function(s){for(var i=1;i<s.length;i++)km+=hav(s[i-1],s[i])});km/=1000;
  var pts=[];raw.forEach(function(p){var l=pts[pts.length-1];if(!l||hav(l,p)>=3)pts.push(p)});
  if(!pts.length)return null;
  var lat0=0,lng0=0;pts.forEach(function(p){lat0+=p.lat;lng0+=p.lng});lat0/=pts.length;lng0/=pts.length;
  var P=proj(lat0,lng0),xy=pts.map(P.xy),rawLen=0;for(var i=1;i<xy.length;i++)rawLen+=Math.hypot(xy[i].x-xy[i-1].x,xy[i].y-xy[i-1].y);
  /* pick a zoom where the day plays in 12–45 s at ~110 screen px a second, never closer than street-block level */
  var T=Math.max(12,Math.min(45,12+0.4*rawLen/1000)),need=rawLen/(110*T),z=15;
  while(z>10&&mpp(z,lat0)<need)z--;
  var tol=Math.max(10,2.5*mpp(z,lat0)),path=roundCorners(simplify(xy,tol),tol*2.5),cum=[0];
  for(i=1;i<path.length;i++)cum.push(cum[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
  var total=cum[cum.length-1];
  var stops=notes.map(function(n){
    var q=P.xy(n),best={d:Infinity,at:0};
    for(var i=1;i<path.length;i++){var r=segDist(q,path[i-1],path[i]);if(r.d<best.d)best={d:r.d,at:cum[i-1]+r.t*(cum[i]-cum[i-1])}}
    if(path.length===1)best={d:Math.hypot(q.x-path[0].x,q.y-path[0].y),at:0};
    return {note:n,at:best.at,off:best.d}
  }).sort(function(a,b){return a.at-b.at});
  return {date:date,P:P,path:path,ll:path.map(P.ll),cum:cum,total:total,km:km,zoom:z,T:T,stops:stops,color:DAYCOL[ci%DAYCOL.length],
    start:pts[0].ms,end:pts[pts.length-1].ms,lat0:lat0,first:pts[0]}
}
function posAt(day,d){
  var c=day.cum,lo=0,hi=c.length-1;if(hi<1)return{i:0,ll:day.ll[0],ms:day.path[0].ms,dir:0};
  d=Math.max(0,Math.min(day.total,d));
  while(hi-lo>1){var m=(lo+hi)>>1;if(c[m]<=d)lo=m;else hi=m}
  var a=day.path[lo],b=day.path[hi],t=c[hi]>c[lo]?(d-c[lo])/(c[hi]-c[lo]):0;
  return{i:lo,ll:day.P.ll({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),ms:a.ms+(b.ms-a.ms)*t}
}

/* ---------- styles + stage ---------- */
function injectStyles(){if($('tcineStyles'))return;var css=
'#tcine{position:fixed;inset:0;z-index:9999;background:#07070c;color:#f5f3ee;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none}'+
'#tcine .map{position:absolute;inset:0}#tcine [hidden]{display:none!important}'+
'#tcine .vig{position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at center,transparent 55%,#0009 100%)}'+
'#tcine .bar{position:absolute;left:0;right:0;height:56px;background:linear-gradient(#000e,#0000);z-index:3;pointer-events:none}#tcine .bar.bot{bottom:0;background:linear-gradient(#0000,#000e);height:84px}#tcine .bar.top{top:0}'+
'#tcine .card{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:6vh 7vw;background:#07070cf2;transition:opacity .9s ease;opacity:1}#tcine .card.hide{opacity:0;pointer-events:none}'+
'#tcine .card .in{max-width:900px;width:100%;animation:tcIn 1s cubic-bezier(.2,.7,.2,1) both}'+
'@keyframes tcIn{from{opacity:0;transform:translateY(16px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}'+
'#tcine .kicker{font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#cbb994;font-weight:700}'+
'#tcine .title{font-family:Georgia,"Times New Roman",serif;font-weight:400;line-height:1.08;margin:14px 0 0;font-size:clamp(32px,7vw,76px)}'+
'#tcine .sub{margin-top:14px;color:#cfcbd8;font-size:clamp(14px,1.8vw,18px);line-height:1.5}'+
'#tcine .nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:26px}#tcine .num{padding:14px;border-radius:14px;background:#ffffff0d;border:1px solid #ffffff1c}#tcine .num b{display:block;font-family:Georgia,serif;font-size:32px;font-weight:400}#tcine .num span{font-size:12px;color:#cfcbd8;letter-spacing:.06em}'+
'#tcine .swatch{display:inline-block;width:26px;height:4px;border-radius:3px;vertical-align:middle;margin-right:10px}'+
'#tcine .pick{display:flex;flex-direction:column;gap:12px;margin-top:24px;max-width:420px}#tcine select{font:600 16px system-ui,sans-serif;padding:12px;border-radius:12px;background:#ffffff14;color:#fff;border:1px solid #ffffff30}#tcine select option{color:#111}'+
'#tcine .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}#tcine .btns button{border:1px solid #ffffff30;background:#ffffff14;color:#fff;padding:12px 18px;border-radius:12px;font:inherit;font-weight:650;cursor:pointer}#tcine .btns .primary{background:#f5f3ee;color:#111;border-color:#f5f3ee}'+
'#tcine .chip{position:absolute;top:12px;left:12px;z-index:4;padding:7px 12px;border-radius:999px;background:#000b;border:1px solid #ffffff26;font:600 13px system-ui,sans-serif;font-variant-numeric:tabular-nums;display:flex;gap:10px;align-items:center;max-width:calc(100% - 80px)}#tcine .chip i{width:9px;height:9px;border-radius:50%;flex:none}'+
'#tcine .close{position:absolute;top:8px;right:8px;z-index:7;width:42px;height:42px;border-radius:50%;border:0;background:#000a;color:#fff;font-size:20px;cursor:pointer}'+
'#tcine .mem{position:absolute;left:50%;bottom:92px;transform:translate(-50%,20px);z-index:4;width:min(560px,calc(100% - 24px));max-height:58vh;overflow:hidden;padding:16px 18px;border-radius:18px;background:#0d0d14e8;border:1px solid #ffffff22;box-shadow:0 20px 50px #000a;opacity:0;transition:opacity .6s,transform .6s;pointer-events:none}#tcine .mem.on{opacity:1;transform:translate(-50%,0)}'+
'#tcine .mem .k{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#d8b4fe;font-weight:700}#tcine .mem .t{font-family:Georgia,serif;font-size:clamp(17px,2.4vw,22px);line-height:1.4;margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:22vh;overflow:hidden}'+
'#tcine .mem .ph{margin-top:12px;height:min(32vh,260px);position:relative;border-radius:12px;overflow:hidden;background:#ffffff0a}#tcine .mem .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s,transform 6s linear;transform:scale(1.06)}#tcine .mem .ph img.on{opacity:1;transform:scale(1)}#tcine .mem .ph:empty{display:none}'+
'#tcine .hud{position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;flex-direction:column;gap:6px;padding:8px 12px calc(10px + env(safe-area-inset-bottom));transition:opacity .5s}#tcine.idle .hud,#tcine.idle .close{opacity:0}'+
'#tcine .prog{display:flex;gap:3px;height:4px}#tcine .prog span{flex:1;background:#ffffff26;border-radius:3px;overflow:hidden;position:relative}#tcine .prog span b{position:absolute;inset:0 auto 0 0;width:0;background:var(--c,#fff)}'+
'#tcine .ctl{display:flex;align-items:center;gap:4px}#tcine .ctl button{background:transparent;border:0;color:#f5f3ee;font:inherit;font-size:18px;padding:8px 9px;cursor:pointer;border-radius:8px;min-width:38px}#tcine .ctl button:hover{background:#ffffff1a}#tcine .ctl .sp{font-size:13px;font-weight:700}#tcine .ctl .z{font-size:13px;font-weight:700}#tcine .ctl .lbl{flex:1;font-size:12px;color:#cfcbd8;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.04em}'+
'#tcine .paused{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none;opacity:0;transition:opacity .3s}#tcine.isPaused .paused{opacity:1}#tcine .paused span{font-size:13px;letter-spacing:.3em;text-transform:uppercase;padding:10px 18px;border-radius:999px;background:#000a;border:1px solid #ffffff30}'+
'#tcine .reel{display:flex;gap:8px;overflow-x:auto;margin-top:18px;padding-bottom:4px}#tcine .reel img{height:84px;width:84px;object-fit:cover;border-radius:10px;flex:none;background:#ffffff10}'+
'#tcine .days{margin-top:18px;display:flex;flex-direction:column;gap:6px;font-size:14px;color:#e7e4ee}'+
'#tcine .outro{position:absolute;left:0;right:0;bottom:0;z-index:5;padding:22px 20px calc(96px + env(safe-area-inset-bottom));background:linear-gradient(#07070c00,#07070cee 22%);max-height:70vh;overflow:auto;transition:opacity .9s}#tcine .outro.hide{opacity:0;pointer-events:none}'+
'#tcine .outro .title{font-size:clamp(26px,5vw,48px)}'+
'#tcine .loading{display:flex;gap:6px;align-items:center;color:#a9a3b8;font-size:13px;margin-top:18px}#tcine .loading i{width:6px;height:6px;border-radius:50%;background:#a9a3b8;animation:tcPulse 1s infinite}#tcine .loading i:nth-child(2){animation-delay:.15s}#tcine .loading i:nth-child(3){animation-delay:.3s}@keyframes tcPulse{50%{opacity:.2}}'+
'@media(max-width:600px){#tcine .ctl button{padding:8px 6px;min-width:32px;font-size:16px}#tcine .ctl .lbl{display:none}#tcine .mem{bottom:86px}}';
var st=document.createElement('style');st.id='tcineStyles';st.textContent=css;document.head.appendChild(st)}

function stage(){
  var el=document.createElement('div');el.id='tcine';el.setAttribute('role','dialog');el.setAttribute('aria-label','Week in Motion');
  el.innerHTML='<div class="map" id="tcMap"></div><div class="vig"></div><div class="bar top"></div><div class="bar bot"></div>'+
   '<div class="chip" id="tcChip" hidden><i></i><span></span></div>'+
   '<div class="mem" id="tcMem"><div class="k"></div><div class="t"></div><div class="ph"></div></div>'+
   '<div class="outro hide" id="tcOutro"></div>'+
   '<div class="paused"><span>Paused</span></div>'+
   '<div class="card" id="tcCard"><div class="in"></div></div>'+
   '<button class="close" id="tcClose" aria-label="Close">✕</button>'+
   '<div class="hud" id="tcHud" hidden><div class="prog" id="tcProg"></div><div class="ctl">'+
    '<button id="tcPrev" title="Previous day">⏮</button><button id="tcPlay" title="Play / pause">❚❚</button><button id="tcNext" title="Skip ahead">⏭</button>'+
    '<button id="tcSpeed" class="sp" title="Speed">1×</button><button id="tcZo" class="z" title="Zoom out">−</button><button id="tcZi" class="z" title="Zoom in">＋</button>'+
    '<span class="lbl" id="tcLbl"></span></div></div>';
  document.body.appendChild(el);return el
}
function card(html){var c=$('tcCard');c.classList.remove('hide');c.querySelector('.in').outerHTML='<div class="in">'+html+'</div>'}
function hideCard(){$('tcCard').classList.add('hide')}

/* ---------- open: pick a week ---------- */
async function open(date){
  if(!TB()){alert('Travel Trace is not ready yet.');return}
  close();injectStyles();stage();
  S={weeks:weeksWithData(),days:[],di:0,speed:pref('speed',1),zoomAdj:pref('zoom',0),playing:false,phase:'pick',hold:0,then:null,raf:0,last:0,map:null,ov:[],wake:null,idleT:0};
  $('tcClose').onclick=close;
  document.addEventListener('keydown',onKey);
  if(!S.weeks.length){card('<div class="kicker">Week in Motion</div><div class="title">No traces yet</div><div class="sub">Once GPSLogger has recorded a few days, they play here as a film.</div>');return}
  var cur=date?monday(date):S.weeks[0].start,has=S.weeks.some(function(w){return w.start===cur});if(!has)cur=S.weeks[0].start;
  card('<div class="kicker">Travel Trace</div><div class="title">Week in Motion</div><div class="sub">Every day of the week, from the first point to the last. The marker moves at a steady pace, skips the time you stayed put, and stops only at your memories.</div>'+
   '<div class="pick"><select id="tcWeek">'+S.weeks.map(function(w){return '<option value="'+w.start+'"'+(w.start===cur?' selected':'')+'>'+h(weekLabel(w.start))+' · '+w.dates.length+' day'+(w.dates.length===1?'':'s')+'</option>'}).join('')+'</select></div>'+
   '<div class="btns"><button class="primary" id="tcGo">▶ Play the week</button></div><div id="tcMsg"></div>');
  $('tcGo').onclick=function(){start($('tcWeek').value)}
}

async function start(weekStart){
  var w=S.weeks.filter(function(x){return x.start===weekStart})[0];if(!w)return;
  S.week=w;
  $('tcMsg').innerHTML='<div class="loading"><i></i><i></i><i></i><span id="tcLoadTxt">Loading the map…</span></div>';
  $('tcGo').disabled=true;
  try{await TB().maps()}catch(e){$('tcMsg').innerHTML='<div class="sub">'+h(e.message)+' Open Travel Trace → Map key to add it.</div>';$('tcGo').disabled=false;return}
  var days=[],fails=[];
  for(var i=0;i<w.dates.length;i++){
    var d=w.dates[i];if($('tcLoadTxt'))$('tcLoadTxt').textContent='Loading '+fmt(d,{weekday:'long'})+'…';
    try{var segs=await TB().day(d),day=segs.length?buildDay(d,segs,TB().notes(d),days.length):null;if(day&&day.total>30)days.push(day)}
    catch(e){fails.push(fmt(d,{weekday:'short'})+': '+e.message)}
  }
  if(!S)return;
  if(!days.length){$('tcMsg').innerHTML='<div class="sub">No route could be loaded for this week.'+(fails.length?'<br>'+h(fails.join(' · ')):'')+'</div>';$('tcGo').disabled=false;return}
  days.forEach(function(d,i){d.color=DAYCOL[i%DAYCOL.length]});
  S.days=days;S.fails=fails;
  try{if(navigator.wakeLock)S.wake=await navigator.wakeLock.request('screen')}catch(_){}
  try{var el=$('tcine');if(el.requestFullscreen&&window.matchMedia('(max-width:900px)').matches)el.requestFullscreen().catch(function(){})}catch(_){}
  buildMap();buildHud();intro()
}

/* ---------- map ---------- */
function buildMap(){
  var g=google.maps,d0=S.days[0];
  S.map=new g.Map($('tcMap'),{center:d0.ll[0],zoom:d0.zoom,styles:MAPSTYLE,disableDefaultUI:true,gestureHandling:'none',keyboardShortcuts:false,clickableIcons:false,backgroundColor:'#1b1f2a'});
  S.ghost=[];S.days.forEach(function(d){S.ghost.push(new g.Polyline({map:S.map,path:d.ll,strokeColor:'#ffffff',strokeOpacity:.14,strokeWeight:3,clickable:false,zIndex:1}))});
  S.glow=new g.Polyline({map:S.map,path:[],strokeColor:'#fff',strokeOpacity:.22,strokeWeight:11,clickable:false,zIndex:2});
  S.line=new g.Polyline({map:S.map,path:[],strokeColor:'#fff',strokeOpacity:1,strokeWeight:3.5,clickable:false,zIndex:3});
  S.done=[];
  S.dot=new g.Marker({map:null,clickable:false,zIndex:10,icon:{path:g.SymbolPath.CIRCLE,scale:8,fillColor:'#fff',fillOpacity:1,strokeColor:'#000',strokeOpacity:.35,strokeWeight:6}});
  S.pins=[];
  $('tcMap').addEventListener('click',togglePlay)
}
function clearPins(){S.pins.forEach(function(m){m.setMap(null)});S.pins=[]}
function cam(ll,zoom){if(!S.map)return;var o={center:ll};if(zoom!=null)o.zoom=zoom;if(S.map.moveCamera)S.map.moveCamera(o);else{S.map.setCenter(ll);if(zoom!=null)S.map.setZoom(zoom)}}
function dayZoom(d){return Math.max(9,Math.min(17,d.zoom+S.zoomAdj))}

/* ---------- HUD ---------- */
function buildHud(){
  $('tcHud').hidden=false;
  $('tcProg').innerHTML=S.days.map(function(d){return '<span style="--c:'+d.color+'"><b></b></span>'}).join('');
  $('tcPlay').onclick=togglePlay;$('tcNext').onclick=skip;$('tcPrev').onclick=prev;
  $('tcSpeed').textContent=S.speed+'×';$('tcSpeed').onclick=function(){var i=SPEEDS.indexOf(S.speed);S.speed=SPEEDS[(i+1)%SPEEDS.length];setPref('speed',S.speed);$('tcSpeed').textContent=S.speed+'×'};
  $('tcZo').onclick=function(){zoomBy(-1)};$('tcZi').onclick=function(){zoomBy(1)};
  ['pointermove','pointerdown','touchstart'].forEach(function(ev){$('tcine').addEventListener(ev,wake,{passive:true})});
  wake()
}
function zoomBy(n){S.zoomAdj=Math.max(-4,Math.min(3,S.zoomAdj+n));setPref('zoom',S.zoomAdj);var d=S.days[S.di];if(d&&(S.phase==='move'))S.map.setZoom(dayZoom(d))}
function wake(){var el=$('tcine');if(!el)return;el.classList.remove('idle');clearTimeout(S.idleT);S.idleT=setTimeout(function(){if(S&&S.playing&&$('tcine'))$('tcine').classList.add('idle')},2800)}
function progress(){
  var bars=$('tcProg')?$('tcProg').querySelectorAll('b'):[];
  for(var i=0;i<bars.length;i++){var f=i<S.di?1:i>S.di?0:(S.phase==='title'?0:Math.min(1,(S.d||0)/(S.days[i].total||1)));if(S.phase==='outro')f=1;bars[i].style.width=(f*100)+'%'}
}
function chip(){
  var d=S.days[S.di],c=$('tcChip');if(!d||S.phase==='outro'||S.phase==='intro'){c.hidden=true;return}
  c.hidden=false;c.querySelector('i').style.background=d.color;
  var p=posAt(d,S.d||0),t=p.ms?new Date(p.ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';
  var kmNow=d.km*((S.d||0)/(d.total||1));
  c.querySelector('span').textContent=fmt(d.date,{weekday:'short'})+(t?' · '+t:'')+' · '+kmNow.toFixed(kmNow<10?1:0)+' km'
}
function togglePlay(){if(!S||S.phase==='pick')return;if(S.phase==='outro'&&!S.playing)return;S.playing=!S.playing;$('tcine').classList.toggle('isPaused',!S.playing);$('tcPlay').textContent=S.playing?'❚❚':'▶';if(S.playing){S.last=0;loop()}wake()}
function onKey(e){if(!S)return;if(e.key==='Escape')close();else if(e.key===' '){e.preventDefault();togglePlay()}else if(e.key==='ArrowRight')skip();else if(e.key==='ArrowLeft')prev()}

/* ---------- the timeline ---------- */
function after(ms,fn){S.hold=ms;S.then=fn}
function loop(){
  cancelAnimationFrame(S.raf);
  S.raf=requestAnimationFrame(function tick(now){
    if(!S||!S.playing)return;
    var dt=S.last?Math.min(100,now-S.last):16;S.last=now;
    var k=dt*S.speed;
    if(S.hold>0){S.hold-=k;if(S.hold<=0&&S.then){var f=S.then;S.then=null;f()}}
    else if(S.phase==='move')step(k);
    if(S.phase==='move'||S.phase==='memory')follow(dt);
    S.raf=requestAnimationFrame(tick)
  })
}
function intro(){
  S.phase='intro';var km=0,mem=0,ph=0;S.days.forEach(function(d){km+=d.km;mem+=d.stops.length;d.stops.forEach(function(s){ph+=(s.note.photos||[]).length})});
  S.totals={km:km,mem:mem,ph:ph};
  card('<div class="kicker">Week in Motion</div><div class="title">'+h(weekLabel(S.week.start))+'</div>'+
   '<div class="nums"><div class="num"><b data-n="'+km.toFixed(1)+'">0</b><span>KM TRAVELLED</span></div><div class="num"><b data-n="'+S.days.length+'">0</b><span>DAYS ON THE MAP</span></div><div class="num"><b data-n="'+mem+'">0</b><span>MEMORIES</span></div>'+(ph?'<div class="num"><b data-n="'+ph+'">0</b><span>PHOTOS</span></div>':'')+'</div>'+
   (S.fails.length?'<div class="sub" style="font-size:12px">Could not load: '+h(S.fails.join(' · '))+'</div>':''));
  countUp();
  S.playing=true;$('tcine').classList.remove('isPaused');$('tcPlay').textContent='❚❚';S.last=0;
  after(4200,function(){dayTitle(0)});loop()
}
function countUp(){var els=$('tcCard').querySelectorAll('[data-n]'),t0=performance.now();(function f(now){var p=Math.min(1,(now-t0)/1800),e=1-Math.pow(1-p,3);els.forEach(function(el){var n=Number(el.dataset.n),dec=String(el.dataset.n).indexOf('.')>=0;el.textContent=dec?(n*e).toFixed(1):Math.round(n*e)});if(p<1&&$('tcCard'))requestAnimationFrame(f)})(t0)}

function dayTitle(i){
  S.di=i;S.phase='title';S.d=0;S.nextStop=0;var d=S.days[i];
  memHide();clearPins();
  /* routes already played stay on the map in their day colour */
  S.line.setPath([]);S.glow.setPath([]);
  S.line.setOptions({strokeColor:d.color});S.glow.setOptions({strokeColor:d.color});
  S.dot.setMap(null);
  var t1=new Date(d.start),t2=new Date(d.end),tf={hour:'numeric',minute:'2-digit'};
  card('<div class="kicker"><span class="swatch" style="background:'+d.color+'"></span>Day '+(i+1)+' of '+S.days.length+'</div><div class="title">'+h(fmt(d.date,{weekday:'long'}))+'</div>'+
   '<div class="sub">'+h(fmt(d.date,{day:'numeric',month:'long'}))+' · '+d.km.toFixed(d.km<10?1:0)+' km'+(d.start&&d.end?' · '+h(t1.toLocaleTimeString([],tf))+' – '+h(t2.toLocaleTimeString([],tf)):'')+(d.stops.length?' · '+d.stops.length+' memor'+(d.stops.length===1?'y':'ies'):'')+'</div>');
  cam(d.ll[0],dayZoom(d));S.camPos={lat:d.ll[0].lat,lng:d.ll[0].lng};
  progress();chip();
  after(2600,function(){
    hideCard();
    var g=google.maps;
    d.stops.forEach(function(s){S.pins.push(new g.Marker({map:S.map,position:{lat:s.note.lat,lng:s.note.lng},clickable:false,zIndex:5,icon:{path:g.SymbolPath.CIRCLE,scale:7,fillColor:'#c084fc',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}}))});
    S.dot.setIcon(Object.assign({},S.dot.getIcon(),{fillColor:'#fff'}));S.dot.setPosition(d.ll[0]);S.dot.setMap(S.map);
    S.pathIdx=0;S.line.setPath([d.ll[0]]);S.glow.setPath([d.ll[0]]);
    S.dayT=0;
    after(900,function(){S.phase='move'})
  })
}
/* move along by distance: steady speed, eased at the start, the end and into each memory */
function step(k){
  var d=S.days[S.di],v=d.total/(d.T*1000);
  S.dayT+=k;
  var stop=d.stops[S.nextStop],toStop=stop?stop.at-S.d:Infinity,toEnd=d.total-S.d,ease=Math.min(1,0.15+S.dayT/1400);
  var f=Math.max(0.18,Math.min(1,ease,toStop/(v*1500),toEnd/(v*1100)+0.1));
  var nd=S.d+v*k*f;
  if(stop&&nd>=stop.at){nd=stop.at;setPos(nd);memory(stop);return}
  if(nd>=d.total){setPos(d.total);endDay();return}
  setPos(nd)
}
function setPos(nd){
  var d=S.days[S.di],p=posAt(d,nd);S.d=nd;
  var path=S.line.getPath(),gp=S.glow.getPath();
  while(S.pathIdx<p.i){S.pathIdx++;path.setAt(path.getLength()-1,d.ll[S.pathIdx]);path.push(d.ll[S.pathIdx]);gp.setAt(gp.getLength()-1,d.ll[S.pathIdx]);gp.push(d.ll[S.pathIdx])}
  path.setAt(path.getLength()-1,p.ll);gp.setAt(gp.getLength()-1,p.ll);
  S.dot.setPosition(p.ll);S.markerPos=p.ll;
  if(!S._c||performance.now()-S._c>250){S._c=performance.now();progress();chip()}
}
/* camera glides after the marker (no shake on every small turn) */
function follow(dt){
  var tgt=S.focus||S.markerPos;if(!tgt||!S.camPos)return;
  var a=1-Math.exp(-dt/(S.focus?650:420));
  S.camPos={lat:S.camPos.lat+(tgt.lat-S.camPos.lat)*a,lng:S.camPos.lng+(tgt.lng-S.camPos.lng)*a};
  cam(S.camPos)
}
function memory(stop){
  var d=S.days[S.di],n=stop.note,photos=(n.photos||[]).slice(0,6);
  S.phase='memory';S.nextStop++;
  S.focus={lat:n.lat,lng:n.lng};
  S.map.setZoom(Math.min(18,dayZoom(d)+2));
  var m=$('tcMem');
  m.querySelector('.k').textContent='📍 Memory · '+fmt(d.date,{weekday:'long'});
  m.querySelector('.t').textContent=n.text||'';m.querySelector('.t').style.display=n.text?'':'none';
  var box=m.querySelector('.ph');box.innerHTML='';
  var imgs=photos.map(function(ph){var im=document.createElement('img');im.alt='Memory photo';box.appendChild(im);TB().photo(ph).then(function(u){if(u)im.src=u}).catch(function(){});return im});
  var per=2600,hold=1400+(n.text?Math.min(4000,1800+n.text.length*25):0)+Math.max(1,imgs.length)*per*(imgs.length?1:0);
  if(!imgs.length)hold=Math.max(hold,3800);
  setTimeout(function(){if(S&&S.phase==='memory')m.classList.add('on')},500);
  var shown=-1;
  function next(){if(!S||S.phase!=='memory')return;if(shown>=0&&imgs[shown])imgs[shown].classList.remove('on');shown++;if(imgs[shown]){imgs[shown].classList.add('on');S.phTimer=setTimeout(function(){waitPlay(next)},per/S.speed)}}
  if(imgs.length)setTimeout(next,700);
  after(hold+700,function(){memHide();S.focus=null;S.map.setZoom(dayZoom(d));after(900,function(){S.phase='move'})})
}
function waitPlay(fn){if(!S)return;if(S.playing)fn();else S.phTimer=setTimeout(function(){waitPlay(fn)},300)}
function memHide(){var m=$('tcMem');if(m)m.classList.remove('on');if(S)clearTimeout(S.phTimer)}
function endDay(){
  var d=S.days[S.di];S.phase='dayend';
  S.done.push(new google.maps.Polyline({map:S.map,path:d.ll,strokeColor:d.color,strokeOpacity:.85,strokeWeight:3,clickable:false,zIndex:2}));
  progress();
  after(1500,function(){if(S.di+1<S.days.length)dayTitle(S.di+1);else outro()})
}
function outro(){
  S.phase='outro';memHide();clearPins();S.dot.setMap(null);S.line.setPath([]);S.glow.setPath([]);$('tcChip').hidden=true;progress();
  S.done.forEach(function(p){p.setMap(null)});S.done=[];
  var g=google.maps,b=new g.LatLngBounds();
  S.days.forEach(function(d){S.done.push(new g.Polyline({map:S.map,path:d.ll,strokeColor:d.color,strokeOpacity:.95,strokeWeight:3.5,clickable:false,zIndex:2}));d.ll.forEach(function(p){b.extend(p)})});
  S.map.fitBounds(b,{top:60,left:30,right:30,bottom:Math.round(window.innerHeight*.45)});
  var longest=S.days.slice().sort(function(a,b){return b.km-a.km})[0],allPh=[];
  S.days.forEach(function(d){d.stops.forEach(function(s){(s.note.photos||[]).forEach(function(p){allPh.push(p)})})});
  var o=$('tcOutro');o.classList.remove('hide');
  o.innerHTML='<div class="kicker">That was the week</div><div class="title">'+S.totals.km.toFixed(1)+' km · '+S.days.length+' day'+(S.days.length===1?'':'s')+'</div>'+
   '<div class="sub">Longest: '+h(fmt(longest.date,{weekday:'long'}))+', '+longest.km.toFixed(1)+' km'+(S.totals.mem?' · '+S.totals.mem+' memor'+(S.totals.mem===1?'y':'ies'):'')+'</div>'+
   '<div class="days">'+S.days.map(function(d){return '<div><span class="swatch" style="background:'+d.color+'"></span>'+h(fmt(d.date,{weekday:'short',day:'numeric',month:'short'}))+' — '+d.km.toFixed(1)+' km'+(d.stops.length?' · '+d.stops.length+' 📍':'')+'</div>'}).join('')+'</div>'+
   (allPh.length?'<div class="reel" id="tcReel"></div>':'')+
   '<div class="btns"><button class="primary" id="tcAgain">↺ Play again</button><button id="tcOther">Another week</button><button id="tcDone">Close</button></div>';
  if(allPh.length){var r=$('tcReel');allPh.slice(0,30).forEach(function(ph){var im=document.createElement('img');im.alt='Memory photo';r.appendChild(im);TB().photo(ph).then(function(u){if(u)im.src=u}).catch(function(){})})}
  $('tcAgain').onclick=function(){o.classList.add('hide');S.done.forEach(function(p){p.setMap(null)});S.done=[];intro()};
  $('tcOther').onclick=function(){var w=S.week.start;open(w)};
  $('tcDone').onclick=close;
  S.playing=false;$('tcPlay').textContent='▶';$('tcine').classList.remove('idle')
}
function skip(){
  if(!S)return;wake();
  if(S.phase==='intro'||S.phase==='title'){if(S.then){S.hold=0.01}return}
  if(S.phase==='memory'){memHide();S.focus=null;S.map.setZoom(dayZoom(S.days[S.di]));after(0,function(){});S.phase='move';return}
  if(S.phase==='move'){var d=S.days[S.di],st=d.stops[S.nextStop];setPos(st?Math.max(S.d,st.at-1):d.total);if(!st)endDay();return}
  if(S.phase==='dayend'&&S.then)S.hold=0.01
}
function prev(){
  if(!S||!S.days.length)return;wake();
  var i=S.phase==='outro'?S.days.length-1:S.di;
  if((S.phase==='move'||S.phase==='memory')&&S.d>S.days[i].total*0.1){}else i=Math.max(0,i-1);
  /* rebuild the coloured routes of the days before this one */
  S.done.forEach(function(p){p.setMap(null)});S.done=[];
  for(var j=0;j<i;j++)S.done.push(new google.maps.Polyline({map:S.map,path:S.days[j].ll,strokeColor:S.days[j].color,strokeOpacity:.85,strokeWeight:3,clickable:false,zIndex:2}));
  $('tcOutro').classList.add('hide');S.focus=null;memHide();
  if(!S.playing){S.playing=true;$('tcine').classList.remove('isPaused');$('tcPlay').textContent='❚❚';S.last=0;loop()}
  dayTitle(i)
}
function close(){
  if(S){S.playing=false;cancelAnimationFrame(S.raf);clearTimeout(S.idleT);clearTimeout(S.phTimer);try{if(S.wake)S.wake.release()}catch(_){}}
  S=null;document.removeEventListener('keydown',onKey);
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(_){}
  var el=$('tcine');if(el)el.remove()
}
window.TravelCinema={open:open,close:close,_buildDay:buildDay,_simplify:simplify};
})();
