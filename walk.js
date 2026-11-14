/* Pranju OS · walking from GPS (14 Nov 2026)
   Works out how far you WALKED in a day from the points GPSLogger sends to Travel Studio. Riding in a vehicle does
   not count, and neither does the GPS wandering about while the phone lies on a table.
   How a day's points are read:
     1. poor fixes are dropped (accuracy worse than 30 m, impossible jumps);
     2. for every point, the "net speed" around it is measured: straight-line distance covered over about a minute
        and a half, divided by that time. Wandering GPS covers a long zig-zag path but almost no straight-line
        distance, so it comes out as standing still;
     3. each moment is labelled still (under 1.6 km/h), walking (1.6 to 8 km/h) or vehicle (over 9 km/h, or the
        phone's own speed reading over 12 km/h);
     4. walking moments next to each other form a walk. A walk counts only if it lasts 90 seconds and covers 80 m,
        and is not a slow crawl in traffic (vehicle speed shortly before AND shortly after, and under 5 minutes);
     5. its distance is measured along the path, counting a step only when you have moved 10 m from the last counted
        spot, which keeps GPS jitter from adding distance.
   What it cannot see: steps indoors (no GPS fix), and walks with the phone left behind.
   Steps are an estimate: distance divided by step length (0.414 x height).
   Pure functions; works in the page (window.PosWalk) and in Node (module.exports) so tools/test-walk.js can test it.
     day(points, opt) -> {km, min, steps, bouts:[{from,to,m,min}], n, vehicleKm}
        points: [{ms, lat, lng, acc, spd}] (spd in m/s, optional)     opt: {height: cm}
     parseGpx(text) -> points          fromLive(rows) -> points   (rows: [[ms,lat,lon,acc,spd,alt],…])
     VERSION -> raise when the method changes, so saved days are worked out again */
(function(root){
"use strict";
var VERSION=1,R=6371000,RAD=Math.PI/180;
var STILL=0.45,WALK_MAX=2.25,VEH=2.5,VEH_SPD=3.4,HALF=45000,ANCHOR=10,MIN_S=90,MIN_M=80,GAP=180000;
function dist(a,b){var dLat=(b.lat-a.lat)*RAD,dLng=(b.lng-a.lng)*RAD,la=a.lat*RAD,lb=b.lat*RAD,h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(la)*Math.cos(lb)*Math.sin(dLng/2)*Math.sin(dLng/2);return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
function clean(points){
  var pts=(points||[]).filter(function(p){return p&&isFinite(p.ms)&&isFinite(p.lat)&&isFinite(p.lng)&&!(p.acc!=null&&p.acc>30)}).sort(function(a,b){return a.ms-b.ms}),out=[];
  pts.forEach(function(p){var q=out[out.length-1];if(q&&p.ms===q.ms)return;
    /* a jump no vehicle on these roads makes (over 200 km/h) is a bad fix */
    if(q){var dt=(p.ms-q.ms)/1000;if(dt>0&&dist(q,p)/dt>55)return}
    out.push(p)});
  return out}
/* path length that ignores jitter: a move counts once you are 10 m (or the fix's own accuracy) from the last counted spot */
function pathLen(pts,i0,i1){var sm=[],lo=i0,hi=i0,gp=[];
  for(var g=i0+1;g<=i1;g++)gp.push(pts[g].ms-pts[g-1].ms);
  /* each point is first averaged with its neighbours (within 12 s, or one point either side when points are sparse),
     which takes most of the jitter out of the line */
  var win=Math.max(12000,1.2*median(gp));
  for(var i=i0;i<=i1;i++){while(pts[i].ms-pts[lo].ms>win)lo++;while(hi<i1&&pts[hi+1].ms-pts[i].ms<=win)hi++;
    var la=0,ln=0,c=0;for(var k=lo;k<=hi;k++){la+=pts[k].lat;ln+=pts[k].lng;c++}sm.push({lat:la/c,lng:ln/c})}
  var a=sm[0],m=0;for(i=1;i<sm.length;i++){var d=dist(a,sm[i]);if(d>=ANCHOR){m+=d;a=sm[i]}}
  return m+dist(a,sm[sm.length-1])}
/* how far the stretch reaches from where it began: jitter stays in a small patch, a walk goes somewhere */
function reach(pts,i0,i1){var r=0;for(var i=i0+1;i<=i1;i++)r=Math.max(r,dist(pts[i0],pts[i]));return r}
function median(a){a=a.slice().sort(function(x,y){return x-y});return a.length?a[a.length>>1]:0}
function segment(pts){var segs=[],cur=[];pts.forEach(function(p){if(cur.length&&p.ms-cur[cur.length-1].ms>GAP){segs.push(cur);cur=[]}cur.push(p)});if(cur.length)segs.push(cur);return segs}
/* label every point of one unbroken stretch: 0 still, 1 walking, 2 vehicle */
function label(seg){
  var n=seg.length,lab=new Array(n),lo=0,hi=0,gaps=[];
  for(var g=1;g<n;g++)gaps.push(seg[g].ms-seg[g-1].ms);
  /* points far apart in time need a wider window, or two noisy fixes alone decide the speed */
  var half=Math.max(HALF,2.5*median(gaps));
  for(var i=0;i<n;i++){
    while(seg[i].ms-seg[lo].ms>half)lo++;
    while(hi<n-1&&seg[hi+1].ms-seg[i].ms<=half)hi++;
    var a=lo,b=hi;if(b-a<2){a=Math.max(0,i-1);b=Math.min(n-1,i+1)}
    var dt=(seg[b].ms-seg[a].ms)/1000,net=dt>0?dist(seg[a],seg[b])/dt:0;
    /* the phone's own speed reading, when it sent one: middle value of the window */
    var sp=[];for(var k=a;k<=b;k++)if(seg[k].spd!=null&&isFinite(seg[k].spd))sp.push(seg[k].spd);sp.sort(function(x,y){return x-y});
    var med=sp.length>=3?sp[sp.length>>1]:null;
    lab[i]=net>VEH||(med!==null&&med>VEH_SPD)?2:net<STILL?0:net<=WALK_MAX?1:2}
  /* smooth one-off flips */
  var out=lab.slice();
  for(i=1;i<n-1;i++)if(lab[i-1]===lab[i+1]&&lab[i]!==lab[i-1])out[i]=lab[i-1];
  return out}
function walks(seg){
  var lab=label(seg),n=seg.length,res=[],veh=0,i=0;
  for(var k=1;k<n;k++)if(lab[k]===2&&lab[k-1]===2)veh+=dist(seg[k-1],seg[k]);
  while(i<n){
    if(lab[i]!==1){i++;continue}
    var s=i,e=i,j=i+1;
    /* a walk carries on through short halts (a crossing, a gate): up to 90 s of standing still */
    while(j<n){if(lab[j]===1){e=j;j++}else if(lab[j]===0&&seg[j].ms-seg[e].ms<=90000)j++;else break}
    i=e+1;
    var secs=(seg[e].ms-seg[s].ms)/1000,m=pathLen(seg,s,e);
    if(secs<MIN_S||m<MIN_M)continue;
    /* stayed within a small patch: GPS wander, not a walk */
    var accs=[];for(k=s;k<=e;k++)if(seg[k].acc!=null)accs.push(seg[k].acc);
    if(reach(seg,s,e)<Math.max(60,3*median(accs)))continue;
    /* too fast overall to be on foot */
    if(m/secs>WALK_MAX)continue;
    /* crawling in traffic: vehicle speed within two minutes before and after, and the "walk" is short */
    var before=false,after=false;
    for(k=s-1;k>=0&&seg[s].ms-seg[k].ms<=120000;k--)if(lab[k]===2){before=true;break}
    for(k=e+1;k<n&&seg[k].ms-seg[e].ms<=120000;k++)if(lab[k]===2){after=true;break}
    if(before&&after&&secs<300)continue;
    res.push({from:seg[s].ms,to:seg[e].ms,m:Math.round(m),min:Math.round(secs/6)/10})}
  return {bouts:res,veh:veh}}
function day(points,opt){
  var pts=clean(points),bouts=[],veh=0;
  segment(pts).forEach(function(seg){if(seg.length<4)return;var w=walks(seg);bouts=bouts.concat(w.bouts);veh+=w.veh});
  var m=bouts.reduce(function(a,b){return a+b.m},0),min=bouts.reduce(function(a,b){return a+b.min},0);
  var h=opt&&opt.height>100&&opt.height<230?opt.height:170,step=0.414*h/100;
  return {km:Math.round(m/10)/100,min:Math.round(min),steps:Math.round(m/step/10)*10,bouts:bouts,n:pts.length,vehicleKm:Math.round(veh/100)/10,v:VERSION}}
function parseGpx(text){var out=[],re=/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g,m;
  while((m=re.exec(String(text||"")))){var la=m[1].match(/lat="([^"]+)"/),lo=m[1].match(/lon="([^"]+)"/),t=m[2].match(/<time>([^<]+)<\/time>/);if(!la||!lo||!t)continue;
    var ms=Date.parse(t[1]);if(!isFinite(ms))continue;var ac=m[2].match(/<(?:acc|accuracy|hdop)>([^<]+)</),sp=m[2].match(/<(?:spd|speed)>([^<]+)</);
    out.push({ms:ms,lat:+la[1],lng:+lo[1],acc:ac&&isFinite(+ac[1])&&/acc/.test(ac[0])?+ac[1]:null,spd:sp&&isFinite(+sp[1])?+sp[1]:null})}
  return out}
function fromLive(rows){return (rows||[]).map(function(p){return {ms:p[0],lat:p[1],lng:p[2],acc:p[3]==null?null:p[3],spd:p[4]==null?null:p[4]}})}
var api={VERSION:VERSION,day:day,parseGpx:parseGpx,fromLive:fromLive,dist:dist};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PosWalk=api;
})(typeof window!=="undefined"?window:this);
