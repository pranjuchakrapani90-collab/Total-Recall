/* T&C Handbook: labelled test hook-up diagrams (same labelling system as the BoQ Trainer sketches). */
"use strict";
const SW=374,LX=208;let QUIZ=false,SKN=0;
function B(){const o={g:"",co:[]};o.add=s=>{o.g+=s;return o};o.c=(p,t,ty)=>{o.co.push({px:p[0],py:p[1],t,ty:ty==null?p[1]:ty});return o};return o}
function fin(o,H){
 const lh=13,L=o.co.slice().sort((a,b)=>a.ty-b.ty||a.py-b.py);let y=6;
 L.forEach(c=>{c.lines=c.t.split("|");c.h=c.lines.length*lh;c.y=Math.max(c.ty-c.h/2,y);y=c.y+c.h+6});
 let lim=H-4;for(let i=L.length-1;i>=0;i--){const c=L[i];if(c.y+c.h>lim)c.y=lim-c.h;lim=c.y-6}
 let t="";L.forEach(c=>{const my=c.y+c.h/2;
  t+=`<path class="s-ld" d="M${c.px} ${c.py} L${LX-14} ${my} H${LX-4}"/><circle class="s-ldot" cx="${c.px}" cy="${c.py}" r="2.3"/>`;
  c.lines.forEach((ln,j)=>{const b=ln[0]==="*";t+=`<text class="${b?'s-tb':'s-t'}" x="${LX}" y="${c.y+10+j*lh}">${b?ln.slice(1):ln}</text>`})});
 return `<svg viewBox="0 0 ${SW} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Labelled test connection diagram">${o.g}${t}</svg>`}
/* parts */
function inst(o,x,y,w,h,title,terms){let s=`<rect class="s-inst" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><text class="s-in" x="${x+w/2}" y="${y+h-7}" text-anchor="middle">${title}</text>`;const P={};
 terms.forEach((t,i)=>{const tx=x+(i+1)*w/(terms.length+1),ty=y;P[t]=[tx,ty];s+=`<circle class="s-term2" cx="${tx}" cy="${ty}" r="3.4"/><text class="s-in" x="${tx}" y="${ty+15}" text-anchor="middle">${t}</text>`});o.add(s);return P}
function tank(o,x,y,w,h){let s=`<rect class="s-dtr" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;const hv=[],lv=[];
 [0,1,2].forEach(i=>{const bx=x+18+i*24;hv.push([bx,y-26]);s+=`<rect class="s-ins" x="${bx-3.5}" y="${y-24}" width="7" height="24" rx="2"/>`+[6,12,18].map(d=>`<line class="s-web" x1="${bx-6}" y1="${y-d}" x2="${bx+6}" y2="${y-d}"/>`).join("")+`<circle class="s-condpt" cx="${bx}" cy="${y-26}" r="2.4"/><text class="s-in" x="${bx}" y="${y+14}" text-anchor="middle">${"RYB"[i]}</text>`});
 [0,1,2,3].forEach(i=>{const bx=x+w-50+i*13;lv.push([bx,y-13]);s+=`<rect class="s-ins" x="${bx-2.5}" y="${y-12}" width="5" height="12" rx="1.5"/><circle class="s-condpt" cx="${bx}" cy="${y-13}" r="2"/><text class="s-in" x="${bx}" y="${y+14}" text-anchor="middle">${"rybn"[i]}</text>`});
 s+=`<rect class="s-hw" x="${x+w-14}" y="${y+h-14}" width="10" height="7"/>`;o.add(s);return {hv,lv,earth:[x+w-9,y+h-10]}}
function lead(o,d,cls="s-lead"){o.add(`<path class="${cls}" d="${d}"/>`)}
function gndsym(o,x,y){o.add(`<path class="s-earth" d="M${x} ${y} v6 M${x-8} ${y+6} h16 M${x-5} ${y+10} h10 M${x-2} ${y+14} h4"/>`)}
function clip(o,x,y){o.add(`<rect class="s-clip" x="${x-4}" y="${y-4}" width="8" height="8" rx="2"/>`)}
const F={
ir(){const o=B();const t=tank(o,30,70,150,100);
 lead(o,`M${t.hv[0][0]} ${t.hv[0][1]} V30 H${t.hv[2][0]} V${t.hv[2][1]}`,"s-short");lead(o,`M${t.hv[1][0]} 30 V${t.hv[1][1]}`,"s-short");
 lead(o,`M${t.lv[0][0]} ${t.lv[0][1]} V44 H${t.lv[3][0]} V${t.lv[3][1]} M${t.lv[3][0]} 44 H186 V184`,"s-short");
 o.add(`<ellipse class="s-guard" cx="${t.hv[1][0]}" cy="${t.hv[1][1]+16}" rx="7" ry="2.4"/>`);
 const m=inst(o,20,206,120,52,"Megger 5 kV",["L","G","E"]);
 lead(o,`M${m.L[0]} ${m.L[1]} V196 H10 V24 H${t.hv[1][0]} V30`,"s-leadA");
 lead(o,`M${m.G[0]} ${m.G[1]} V190 H22 V86 L${t.hv[1][0]-7} ${t.hv[1][1]+16}`,"s-leadG");
 lead(o,`M${m.E[0]} ${m.E[1]} V188 H${t.earth[0]} V${t.earth[1]}`,"s-leadB");gndsym(o,186,184);
 o.c([t.hv[2][0],30],"*Line (–) to HV R, Y, B|shorted together",22);
 o.c([t.hv[1][0]+7,t.hv[1][1]+16],"Guard ring on a bushing:|surface leakage bypassed",62);
 o.c([186,60],"*LV r, y, b, n shorted|and earthed for HV test",98);
 o.c([t.earth[0],t.earth[1]],"*Earth (+) to the tank");
 o.c([140,232],"*Read at 15 s, 60 s, 10 min|then discharge");
 return fin(o,270)},
ttr(){const o=B();const t=tank(o,30,90,150,100);const m=inst(o,20,226,150,44,"Turns ratio tester",["H1","H2","X1","X2"]);
 lead(o,`M${m.H1[0]} ${m.H1[1]} V212 H8 V40 H${t.hv[0][0]} V${t.hv[0][1]}`,"s-leadA");
 lead(o,`M${m.H2[0]} ${m.H2[1]} V206 H16 V48 H${t.hv[1][0]} V${t.hv[1][1]}`,"s-leadA");
 lead(o,`M${m.X1[0]} ${m.X1[1]} V214 H190 V54 H${t.lv[0][0]} V${t.lv[0][1]}`,"s-leadB");
 lead(o,`M${m.X2[0]} ${m.X2[1]} V208 H196 V62 H${t.lv[3][0]} V${t.lv[3][1]}`,"s-leadB");
 o.c([t.hv[0][0],40],"*H1–H2 on an HV phase pair|(e.g., R–Y)",28);
 o.c([t.lv[0][0],54],"*X1–X2 on the matching LV|winding (e.g., r–n for Dyn11)",76);
 o.c([100,140],"Tap at normal; repeat for|every phase and tap",140);
 o.c([170,248],"*Expect ≈ 44.0 per phase|for 11000/433 V Dyn11");
 return fin(o,280)},
wrm(){const o=B();const t=tank(o,40,110,140,90);const [a,b]=[t.hv[0],t.hv[1]];
 clip(o,a[0],a[1]-14);clip(o,a[0],a[1]-3);clip(o,b[0],b[1]-14);clip(o,b[0],b[1]-3);
 o.add(`<line class="s-short" x1="${a[0]}" y1="${a[1]-14}" x2="${a[0]}" y2="${a[1]}"/><line class="s-short" x1="${b[0]}" y1="${b[1]-14}" x2="${b[0]}" y2="${b[1]}"/>`);
 const m=inst(o,20,230,160,46,"Winding resistance meter",["I+","V+","V–","I–"]);
 lead(o,`M${m["I+"][0]} ${m["I+"][1]} V218 H8 V30 H${a[0]-4} V${a[1]-14}`,"s-leadA");
 lead(o,`M${m["V+"][0]} ${m["V+"][1]} V214 H14 V60 H${a[0]-4} V${a[1]-3}`,"s-leadB");
 lead(o,`M${m["V–"][0]} ${m["V–"][1]} V214 H192 V66 H${b[0]+4} V${b[1]-3}`,"s-leadB");
 lead(o,`M${m["I–"][0]} ${m["I–"][1]} V218 H198 V36 H${b[0]+4} V${b[1]-14}`,"s-leadA");
 o.c([a[0]+4,30],"*Current leads outside|(I+ / I–)",24);
 o.c([b[0]+4,b[1]-3],"*Potential leads inside|(V+ / V–), on the terminal",80);
 o.c([110,150],"Wait for the reading to|settle; note temperature");
 o.c([180,252],"R75 = Rt × 310 ÷ (235 + t)|copper (225 for Al)");
 return fin(o,286)},
mbal(){const o=B();const t=tank(o,30,110,150,90);const L=t.lv;
 o.add(`<circle class="s-src" cx="40" cy="44" r="16"/><path class="s-lead" d="M33 44 q3.5 -7 7 0 q3.5 7 7 0"/><text class="s-in" x="40" y="24" text-anchor="middle">230 V</text>`);
 lead(o,`M56 40 H${L[0][0]} V${L[0][1]}`,"s-leadA");lead(o,`M56 50 H70 V64 H${L[3][0]} V${L[3][1]}`,"s-leadA");
 [[1,"V1",130],[2,"V2",170]].forEach(([i,n,x])=>{o.add(`<circle class="s-vm" cx="${x}" cy="90" r="11"/><text class="s-in" x="${x}" y="94" text-anchor="middle">V</text>`);lead(o,`M${x} 79 V74 H${L[i][0]} V${L[i][1]}`,"s-leadB");lead(o,`M${x} 101 V104 H${L[3][0]+4} V${L[3][1]}`,"s-leadB")});
 o.c([56,40],"*230 V between one LV|phase and neutral",30);
 o.c([130,90],"Voltmeter on 2nd phase–n",92);
 o.c([170,90],"Voltmeter on 3rd phase–n",118);
 o.c([100,180],"*Outer phase fed: most volts|on the middle phase.|Middle fed: shared ~equally");
 return fin(o,220)},
bdv(){const o=B();o.add(`<rect class="s-inst" x="20" y="40" width="170" height="170" rx="6"/><text class="s-in" x="105" y="56" text-anchor="middle">BDV test set</text>`);
 o.add(`<path class="s-cup" d="M60 90 h90 v80 a6 6 0 0 1 -6 6 h-78 a6 6 0 0 1 -6 -6z"/><rect class="s-oil" x="61" y="104" width="88" height="71"/><line class="s-web" x1="60" y1="104" x2="150" y2="104"/>`);
 o.add(`<rect class="s-rod" x="64" y="132" width="30" height="6"/><rect class="s-rod" x="116" y="132" width="30" height="6"/><path class="s-elec" d="M94 128 q8 7 0 14z"/><path class="s-elec" d="M116 128 q-8 7 0 14z"/>`);
 o.add(`<rect class="s-box" x="40" y="186" width="54" height="16" rx="2"/><text class="s-in" x="67" y="198" text-anchor="middle">kV</text>`);
 o.c([105,135],"*Gap 2.5 mm between|mushroom electrodes",112);
 o.c([140,106],"Fill slowly, no bubbles;|rest a few minutes",80);
 o.c([94,194],"*Raise 2 kV/s; 6 breakdowns|stir & rest between, average");
 o.c([62,92],"Clean, dry cell rinsed|with the same oil",44);
 return fin(o,226)},
crm(){const o=B();o.add(`<rect class="s-hw" x="70" y="30" width="60" height="14" rx="2"/><rect class="s-hw" x="70" y="166" width="60" height="14" rx="2"/><rect class="s-vac" x="82" y="58" width="36" height="94" rx="6"/><line class="s-rodp" x1="100" y1="44" x2="100" y2="58"/><line class="s-rodp" x1="100" y1="152" x2="100" y2="166"/><line class="s-web" x1="82" y1="105" x2="118" y2="105"/>`);
 clip(o,76,37);clip(o,124,37);clip(o,76,173);clip(o,124,173);
 const m=inst(o,20,206,160,46,"Micro-ohm meter 100 A",["C+","P+","P–","C–"]);
 lead(o,`M${m["C+"][0]} ${m["C+"][1]} V196 H8 V37 H72`,"s-leadA");lead(o,`M${m["C–"][0]} ${m["C–"][1]} V196 H196 V173 H128`,"s-leadA");
 lead(o,`M${m["P+"][0]} ${m["P+"][1]} V190 H16 V20 H124 V33`,"s-leadB");lead(o,`M${m["P–"][0]} ${m["P–"][1]} V190 H188 V186 H76 V177`,"s-leadB");
 o.c([132,37],"*Breaker CLOSED; one pole|at a time",30);
 o.c([118,90],"Vacuum interrupter",88);
 o.c([128,173],"*Current leads outermost,|potential leads inside",150);
 o.c([180,228],"*Typically tens of µΩ|poles similar (maker value)");
 return fin(o,262)},
timing(){const o=B();[50,100,150].forEach((x,i)=>{o.add(`<rect class="s-vac" x="${x-10}" y="50" width="20" height="50" rx="4"/><text class="s-in" x="${x}" y="44" text-anchor="middle">${"RYB"[i]}</text><circle class="s-condpt" cx="${x}" cy="40" r="0"/>`)});
 o.add(`<rect class="s-box" x="40" y="120" width="120" height="30" rx="3"/><text class="s-in" x="100" y="139" text-anchor="middle">Close / trip coils</text>`);
 const m=inst(o,14,190,180,56,"Breaker timer",["CH1","CH2","CH3","TRIP","CLOSE"]);
 [["CH1",50],["CH2",100],["CH3",150]].forEach(([c,x],i)=>{lead(o,`M${m[c][0]} ${m[c][1]} V${172-i*4} H${x+16} V100 M${x+16} 75 H${x+10}`,"s-leadB");lead(o,`M${x} 100 V108 H${x-14}`,"s-leadB")});
 lead(o,`M${m.TRIP[0]} ${m.TRIP[1]} V160 H120 V150`,"s-leadA");lead(o,`M${m.CLOSE[0]} ${m.CLOSE[1]} V164 H140 V150`,"s-leadA");
 o.c([160,75],"*One channel across each|pole's main contacts",64);
 o.c([140,150],"*Timer drives trip and|close coils",128);
 o.c([194,220],"Discrepancy = slowest pole|minus fastest pole");
 return fin(o,258)},
ctpol(){const o=B();o.add(`<ellipse class="s-ct3" cx="100" cy="110" rx="34" ry="34"/><ellipse class="s-ct4" cx="100" cy="110" rx="18" ry="18"/><line class="s-bus" x1="20" y1="110" x2="180" y2="110"/><text class="s-in" x="26" y="102">P1</text><text class="s-in" x="164" y="102">P2</text>`);
 o.add(`<rect class="s-batt2" x="40" y="30" width="34" height="18" rx="2"/><text class="s-in" x="57" y="43" text-anchor="middle">+ –</text><circle class="s-condpt" cx="96" cy="39" r="2"/><path class="s-lead" d="M96 39 l14 -6"/><circle class="s-condpt" cx="112" cy="39" r="2"/>`);
 lead(o,`M40 39 H24 V110`,"s-leadA");lead(o,`M74 39 H96 M112 39 H176 V110`,"s-leadA");
 o.add(`<text class="s-in" x="86" y="160">S1</text><text class="s-in" x="108" y="160">S2</text><circle class="s-term2" cx="92" cy="146" r="3"/><circle class="s-term2" cx="112" cy="146" r="3"/>`);
 o.add(`<circle class="s-vm" cx="102" cy="206" r="18"/><path class="s-needle" d="M102 214 L112 196"/><text class="s-in" x="102" y="222" text-anchor="middle">+  –</text>`);
 lead(o,`M92 149 V180 H90 V196`,"s-leadB");lead(o,`M112 149 V180 H114 V196`,"s-leadB");
 o.c([57,30],"*Battery 1.5–9 V: + to P1|through a push switch",22);
 o.c([104,36],"Push switch",60);
 o.c([134,110],"CT (primary disconnected)",104);
 o.c([102,188],"*Analog meter: + to S1|kicks forward = correct");
 return fin(o,240)},
knee(){const o=B();o.add(`<circle class="s-src" cx="32" cy="70" r="22"/><text class="s-in" x="32" y="74" text-anchor="middle">Variac</text>`);
 o.add(`<circle class="s-vm" cx="120" cy="110" r="13"/><text class="s-in" x="120" y="114" text-anchor="middle">V</text><circle class="s-vm" cx="90" cy="50" r="13"/><text class="s-in" x="90" y="54" text-anchor="middle">A</text>`);
 o.add(`<rect class="s-box" x="150" y="60" width="40" height="90" rx="6"/><text class="s-in" x="170" y="80" text-anchor="middle">CT</text><text class="s-in" x="170" y="100" text-anchor="middle">S1</text><text class="s-in" x="170" y="140" text-anchor="middle">S2</text>`);
 lead(o,`M54 66 H77 M103 50 H150 V96`,"s-leadA");lead(o,`M54 76 H60 V146 H150`,"s-leadA");lead(o,`M120 97 V72 M120 123 V146`,"s-leadB");
 o.add(`<path class="s-axis" d="M30 260 V170 M30 260 H180"/><path class="s-curve" d="M30 258 Q70 250 90 214 T180 176"/><circle class="s-ldot" cx="104" cy="196" r="3"/><text class="s-in" x="34" y="176">V</text><text class="s-in" x="168" y="272">I</text>`);
 o.c([190,96],"*Apply AC on S1–S2,|primary open",70);
 o.c([90,50],"Ammeter (exciting current)",40);
 o.c([120,123],"Voltmeter across S1–S2",128);
 o.c([104,196],"*Knee: +10% V needs|+50% current");
 o.c([150,184],"Lower slowly to zero|(demagnetise)",236);
 return fin(o,282)},
sec(){const o=B();o.add(`<rect class="s-box" x="20" y="40" width="60" height="80" rx="4"/><text class="s-in" x="50" y="58" text-anchor="middle">CTs</text>`);
 o.add(`<rect class="s-ttb" x="92" y="40" width="32" height="80" rx="3"/><text class="s-in" x="108" y="34" text-anchor="middle">TTB</text>`);
 [60,80,100].forEach(y=>{o.add(`<line class="s-short" x1="80" y1="${y}" x2="96" y2="${y}"/><line class="s-short" x1="96" y1="${y}" x2="96" y2="${y+8}"/><circle class="s-term2" cx="96" cy="${y}" r="2.6"/><circle class="s-open" cx="120" cy="${y}" r="2.6"/>`)});
 o.add(`<line class="s-short" x1="96" y1="68" x2="96" y2="108"/>`);
 o.add(`<rect class="s-inst" x="140" y="40" width="54" height="80" rx="4"/><text class="s-in" x="167" y="58" text-anchor="middle">Relay</text><rect class="s-box" x="150" y="96" width="34" height="14" rx="2"/><text class="s-in" x="167" y="107" text-anchor="middle">trip</text>`);
 [60,80,100].forEach(y=>lead(o,`M120 ${y} H140`,"s-lead"));
 const m=inst(o,20,170,174,52,"Relay test kit",["I1","I2","I3","IN","TIMER"]);
 [["I1",60],["I2",80],["I3",100]].forEach(([k,y],i)=>lead(o,`M${m[k][0]} ${m[k][1]} V${150-i*6} H${128+i*3} V${y} H140`,"s-leadA"));
 lead(o,`M${m.TIMER[0]} ${m.TIMER[1]} V140 H184 V110`,"s-leadB");
 o.c([96,84],"*CT side shorted at the TTB|(links closed to earth)",30);
 o.c([120,100],"Relay side links opened",70);
 o.c([132,150],"*Kit current outputs to|the relay inputs",110);
 o.c([184,128],"*Trip contact stops|the timer",146);
 o.c([194,196],"Check pickup, then times|at 2×, 5×, 10× setting");
 return fin(o,236)},
prim(){const o=B();o.add(`<rect class="s-inst" x="16" y="40" width="70" height="60" rx="4"/><text class="s-in" x="51" y="58" text-anchor="middle">Primary</text><text class="s-in" x="51" y="72" text-anchor="middle">injector</text>`);
 o.add(`<ellipse class="s-ct3" cx="140" cy="70" rx="22" ry="22"/><ellipse class="s-ct4" cx="140" cy="70" rx="11" ry="11"/>`);
 lead(o,`M86 60 H190 M86 84 H106 V118 H190 V60`,"s-heavy");
 o.add(`<rect class="s-inst" x="100" y="160" width="96" height="50" rx="4"/><text class="s-in" x="148" y="180" text-anchor="middle">Relay / meter</text><text class="s-in" x="148" y="196" text-anchor="middle">shows I÷ratio</text>`);
 lead(o,`M134 88 V140 H140 V160 M146 88 V136 H160 V160`,"s-leadB");
 o.c([96,60],"*Heavy leads through the|CT primary only",44);
 o.c([162,70],"CT under test",80);
 o.c([150,140],"*Secondary wiring to the|relay as in service",130);
 o.c([190,185],"Inject 10–20% of rating;|each phase, then residual");
 return fin(o,230)},
earth(){const o=B();o.add(`<line class="s-ground" x1="6" y1="120" x2="200" y2="120"/>`);for(let x=10;x<200;x+=11)o.add(`<line class="s-hatch" x1="${x}" y1="121.5" x2="${x-5}" y2="127"/>`);
 o.add(`<rect class="s-epipe" x="20" y="120" width="8" height="70"/><rect class="s-pit" x="10" y="112" width="28" height="14"/><path class="s-spk" d="M118 110 V142 l3 6 l3 -6 V110"/><path class="s-spk" d="M184 110 V142 l3 6 l3 -6 V110"/>`);
 const m=inst(o,36,62,80,38,"Earth tester",["E","P","C"]);
 lead(o,`M${m.E[0]} ${m.E[1]} V44 H24 V112`,"s-leadA");lead(o,`M${m.P[0]} ${m.P[1]} V50 H121 V110`,"s-leadB");lead(o,`M${m.C[0]} ${m.C[1]} V38 H187 V110`,"s-leadA");
 o.add(`<path class="s-dim" d="M24 210 H187 M24 204 v12 M187 204 v12 M121 200 v14"/><text class="s-in" x="70" y="226">62%</text>`);
 o.c([24,170],"*Pit under test (E):|earth lead disconnected",150);
 o.c([121,134],"*P at 62% of E–C;|also try 52% and 72%",112);
 o.c([187,134],"*C 5–10× electrode length|away (e.g., 25–40 m)",70);
 o.c([110,210],"Readings close at all|three P points = valid",200);
 return fin(o,236)},
batt(){const o=B();for(let i=0;i<6;i++){const x=12+i*30;o.add(`<rect class="s-cell" x="${x}" y="90" width="26" height="60" rx="3"/><rect class="s-oil" x="${x+2}" y="100" width="22" height="48"/><circle class="s-condpt" cx="${x+7}" cy="86" r="2.5"/><circle class="s-condpt" cx="${x+19}" cy="86" r="2.5"/>`);if(i<5)o.add(`<path class="s-lead" d="M${x+19} 86 Q${x+28} 78 ${x+37} 86"/>`)}
 o.add(`<circle class="s-vm" cx="40" cy="44" r="15"/><text class="s-in" x="40" y="48" text-anchor="middle">V</text>`);lead(o,`M32 56 L19 84 M48 56 L31 84`,"s-leadB");
 o.add(`<rect class="s-hyd" x="128" y="24" width="12" height="56" rx="4"/><ellipse class="s-hydb" cx="134" cy="20" rx="10" ry="8"/><line class="s-lead" x1="134" y1="80" x2="134" y2="104"/><rect class="s-float" x="131" y="44" width="6" height="22" rx="2"/>`);
 o.c([40,44],"*Cell voltmeter: each cell|on float",30);
 o.c([140,50],"*Hydrometer: SG of pilot|cells, temperature-corrected",62);
 o.c([102,104],"Level between marks; top|up with distilled water only",110);
 o.c([170,148],"Register: total V, charger A,|cell V, SG, temperature");
 return fin(o,176)},
meter(){const o=B();o.add(`<rect class="s-inst" x="20" y="30" width="80" height="110" rx="6"/><rect class="s-disp" x="32" y="46" width="56" height="20" rx="2"/><text class="s-in" x="60" y="60" text-anchor="middle">kWh</text><circle class="s-led" cx="80" cy="84" r="4"/><text class="s-in" x="60" y="128" text-anchor="middle">Meter</text>`);
 o.add(`<line class="s-bus" x1="40" y1="140" x2="40" y2="190"/><line class="s-bus" x1="80" y1="140" x2="80" y2="190"/><ellipse class="s-clampct" cx="80" cy="170" rx="10" ry="6"/>`);
 o.add(`<rect class="s-scan" x="104" y="76" width="18" height="16" rx="3"/>`);
 o.add(`<rect class="s-inst" x="120" y="150" width="76" height="70" rx="6"/><text class="s-in" x="158" y="168" text-anchor="middle">Reference</text><text class="s-in" x="158" y="182" text-anchor="middle">meter</text><rect class="s-disp" x="132" y="190" width="52" height="18" rx="2"/><text class="s-in" x="158" y="203" text-anchor="middle">err %</text>`);
 lead(o,`M122 84 H150 V150`,"s-leadB");lead(o,`M90 170 H124 V176`,"s-leadA");lead(o,`M40 180 H30 V232 H140 V220 M80 186 H86 V226 H150 V220`,"s-leadV");
 o.c([84,84],"Meter's kWh pulse LED",84);
 o.c([113,76],"*Pulse scanner on the LED;|enter meter constant",40);
 o.c([80,176],"*Clamp CT on the|outgoing phase",130);
 o.c([40,232],"*Voltage leads across|the supply terminals",232);
 o.c([196,200],"Error % = (meter – ref)|÷ ref × 100",184);
 return fin(o,250)}
};
function drawFig(k){try{return F[k]?F[k]():""}catch(e){console.error(e);return ""}}
