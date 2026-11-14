/* Checks walk.js against made-up days of GPS points (Samaguri-like coordinates, invented routes).
   Run:  node tools/test-walk.js      prints "ok" lines; exits 1 if the walking method broke.
   Each case builds a track second by second with realistic GPS noise, then asks how far it says you walked. */
const W=require('../walk.js');let bad=0,seed=7;
const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff},gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return (u-3)/0.7071};
const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)bad++};
const M_LAT=1/111320,M_LNG=1/(111320*Math.cos(26.4*Math.PI/180));
/* a builder: position in metres east/north of a start, time in seconds */
function track(every,noise){let x=0,y=0,t=Date.UTC(2026,10,14,1,0,0),left=0,pts=[];
  const put=(spd)=>{pts.push({ms:t,lat:26.4+(y+gauss()*noise)*M_LAT,lng:92.8+(x+gauss()*noise)*M_LNG,acc:Math.max(3,noise*1.5+rnd()*4),spd:spd==null?null:Math.max(0,spd+gauss()*0.2)})};
  const api={still(sec){for(let i=0;i<sec;i++){t+=1000;if(--left<=0){put(0);left=every}}return api},
    move(sec,v,heading,withSpd){const hx=Math.sin(heading*Math.PI/180),hy=Math.cos(heading*Math.PI/180);for(let i=0;i<sec;i++){t+=1000;x+=hx*v;y+=hy*v;if(--left<=0){put(withSpd===false?null:v);left=every}}return api},
    gap(sec){t+=sec*1000;return api},pts:()=>pts};return api}
const km=p=>W.day(p,{height:170}).km;

// 1. phone on the office table for 3 hours, GPS wandering 6 m: nothing walked
let r=W.day(track(10,6).still(3*3600).pts(),{});ok(r.km===0,'3 h at a desk with wandering GPS = '+r.km+' km');
// 2. worse wander (12 m), logged every 30 s
r=W.day(track(30,12).still(4*3600).pts(),{});ok(r.km<=0.05,'4 h indoors, poor GPS = '+r.km+' km');
// 3. a 1.5 km morning walk at 5 km/h with turns
let t=track(10,4).still(600);for(let i=0;i<6;i++)t.move(180,1.39,i*60);t.still(600);
r=W.day(t.pts(),{height:170});ok(Math.abs(r.km-1.5)<0.15,'1.5 km walk measured as '+r.km+' km, '+r.min+' min, '+r.steps+' steps');
ok(r.steps>1800&&r.steps<2400,'about 2,130 steps for 1.5 km at 170 cm: '+r.steps);
// 4. slow stroll 3.2 km/h for 800 m, points every 20 s, no speed readings
r=W.day(track(20,5).still(300).move(900,0.89,40,false).still(300).pts(),{});ok(Math.abs(r.km-0.8)<0.12,'slow 800 m stroll = '+r.km+' km');
// 5. a 12 km drive at 40 km/h with two halts and a crawl through a market: no walking
t=track(10,4).still(300).move(300,11,90).still(40).move(240,11,90).move(150,1.4,90).move(360,11,95).still(60).move(200,11,100).still(600);
r=W.day(t.pts(),{});ok(r.km===0,'drive with halts and a 2.5 min crawl = '+r.km+' km walked (vehicle '+r.vehicleKm+' km)');
// 6. drive, park, walk 600 m to a site, walk back, drive off: only the walking counts
t=track(10,4).move(400,10,0).still(120).move(430,1.4,90).still(900).move(430,1.4,270).still(60).move(400,10,180);
r=W.day(t.pts(),{});ok(Math.abs(r.km-1.2)<0.15,'park, walk 600 m each way = '+r.km+' km');
// 7. motorbike crawling at 7 km/h for 4 minutes between rides is not a walk
t=track(10,4).move(300,9,0).move(240,1.95,0).move(300,9,0);
r=W.day(t.pts(),{});ok(r.km===0,'slow bike in traffic = '+r.km+' km');
// 8. a walk with a 60 s halt at a gate stays one walk
t=track(10,4).still(300).move(300,1.3,10).still(60).move(300,1.3,10).still(300);
r=W.day(t.pts(),{});ok(r.bouts.length===1&&Math.abs(r.km-0.78)<0.1,'walk with a short halt: '+r.bouts.length+' walk, '+r.km+' km');
// 9. two short hops (40 m to the gate and back) are too small to count
t=track(10,5).still(600).move(30,1.3,0).still(600).move(30,1.3,180).still(600);
r=W.day(t.pts(),{});ok(r.km===0,'40 m hops = '+r.km+' km');
// 10. a whole mixed day: desk, walk, drive, site walk, drive, evening walk
t=track(15,6).still(2*3600).move(700,1.35,20).still(3600).move(600,12,90).still(200).move(500,1.3,0).still(1800).move(500,1.3,180).still(100).move(600,12,270).still(3*3600).move(1500,1.5,200).still(3600);
r=W.day(t.pts(),{height:172});const want=(700*1.35+500*1.3*2+1500*1.5)/1000;
ok(Math.abs(r.km-want)/want<0.1,'mixed day: walked '+want.toFixed(2)+' km, measured '+r.km+' km in '+r.bouts.length+' walks');
// 11. GPX round trip keeps time, place and accuracy
const g='<gpx><trk><trkseg><trkpt lat="26.4" lon="92.8"><ele>60</ele><time>2026-11-14T01:00:00.000Z</time><extensions><acc>7.5</acc></extensions></trkpt><trkpt lat="26.4001" lon="92.8001"><time>2026-11-14T01:00:10Z</time></trkpt></trkseg></trk></gpx>';
const gp=W.parseGpx(g);ok(gp.length===2&&gp[0].acc===7.5&&gp[1].acc===null&&gp[1].ms-gp[0].ms===10000,'GPX points read');
ok(W.fromLive([[1,26.4,92.8,5,1.2,60]])[0].spd===1.2,'live points read');
process.exit(bad?1:0);
