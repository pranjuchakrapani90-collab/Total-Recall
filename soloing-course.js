/* Soloing Course: Guitar Studio section 3.
   A learning-by-doing course in soloing, from first notes in a CAGED shape to complete 16-bar solos.
   Every lesson says what you're learning and why; every exercise is generated tab you play with the band,
   and "New example" gives the same exercise in another key, shape or progression.
   Uses Solo Builder's globals (OPEN, MAJ, KEYS, PROGS, CAGED, shapeNotes, ctSet, tensionSet, chordName, keyName, nn,
   start, stop, play, ui, st, save, view, render, newSolo, brief, esc, tabsHTML) and the triad library (triad-course.js). */
"use strict";
(function(){
const T=window.TRIAD_COURSE,{W,H,DQ,Q,E,T3,S16,nt,R,K,P4,prog,nb,bendFrom,chain,near,invUp,blk,dbl,arp}=T;

/* ---------- scale-shape helpers: a context is one key + one CAGED shape ---------- */
function cx(v){if(window.__TRACE)window.__TRACE.cx=1;const k=K(v),sh=window.__CSH!=null?window.__CSH:(((v*3+Math.floor(v/8))%5)+5)%5,P=shapeNotes(k,sh);return {k,sh,P,N:P.length,info:`${CAGED[sh].n} shape`};}
const cl=(c,i)=>Math.max(0,Math.min(c.N-1,Math.round(i)));
const at=(c,i)=>c.P[cl(c,i)];
const N_=(c,i,d,x)=>nt(at(c,i),d,x);
function dI(c,deg,nr){nr=nr==null?c.N/2:nr;let b=-1,bd=1e9;c.P.forEach((p,i)=>{if(p.deg===deg&&Math.abs(i-nr)<bd){bd=Math.abs(i-nr);b=i;}});return b<0?cl(c,nr):b;}
function ctI(c,ch,nr,dir){const cs=ctSet(ch);nr=cl(c,nr);for(let d=0;d<c.N;d++){const a=dir<0?[nr-d,nr+d]:[nr+d,nr-d];for(const j of a)if(j>=0&&j<c.N&&cs.has(c.P[j].deg))return j;}return nr;}
function tnI(c,ch,nr){const ts=tensionSet(ch);let b=cl(c,nr),bd=1e9;c.P.forEach((p,i)=>{if(ts.has(p.deg)&&Math.abs(i-nr)<bd){bd=Math.abs(i-nr);b=i;}});return b;}
/* pad a bar with a rest to exactly 4 beats (48 steps), or trim it */
function bar(items){const out=[];let t=0;for(const x of items){if(!x||x.d<=0)continue;if(t+x.d>48){const d=48-t;if(d>0)out.push({...x,d});t=48;break;}out.push(x);t+=x.d;}if(t<48)out.push(R(48-t));return out;}
/* split a long note list into bars */
function bars(list){const out=[];let cur=[],t=0;list.forEach(x=>{let d=x.d;while(d>0){const room=48-t,take=Math.min(room,d);cur.push({...x,d:take});t+=take;d-=take;if(t===48){out.push(cur);cur=[];t=0;}}});if(cur.length)out.push(cur);return out;}
/* a line: start index, then steps through the shape */
function line(c,i0,steps,durs,x){let i=i0;return steps.map((s,j)=>{i=cl(c,i+s);return N_(c,i,durs[j%durs.length],x&&x[j]);});}
const ex=(c,ch,bs,more)=>({key:c.k,ch:ch.slice(0,bs.length).concat(Array(Math.max(0,bs.length-ch.length)).fill(ch[ch.length-1])),bars:bs.map(bar),info:c.info+(more?" · "+more:"")});
const I=n=>Array(n).fill(0);
const lo=c=>Math.round(c.N*.25),mid=c=>Math.round(c.N*.5),hi=c=>Math.round(c.N*.8);
/* motif recipes (steps + rhythm) for the motif lessons */
const MOTS=[{s:[0,1,1],d:[Q,Q,H]},{s:[0,1,-2,1],d:[E,E,Q,H]},{s:[0,2,-1,-1],d:[Q,E,E,H]},{s:[0,-1,-1,2],d:[DQ,E,Q,Q]},{s:[0,1,1,1,-2],d:[E,E,E,E,H]},{s:[0,2,1,-1],d:[Q,Q,E,DQ]}];
const mot=v=>MOTS[((v%MOTS.length)+MOTS.length)%MOTS.length];
const motNotes=(c,i0,m,x)=>{const ns=line(c,i0,m.s,m.d);const l=ns[ns.length-1];if(l.d>=Q)l.v=1;if(x)Object.assign(ns[0],x);return ns;};
const posOf=m=>{let p=0;return m.s.map(s=>p+=s);};
const fromPos=(ps,d)=>({s:ps.map((p,i)=>i?p-ps[i-1]:p),d});

/* ===================== the syllabus ===================== */
const tri=(mi,li,id,t)=>Object.assign({},T.C[mi].lessons[li],{id,t:t||T.C[mi].lessons[li].t});
const C=[
{n:1,t:"First notes",goal:"Know your CAGED shape, play it in time, and make your first tiny melodies.",lessons:[
 {id:"1.1",t:"The shape and its roots",what:"A CAGED shape is the major scale under one hand position. The dark dots are the roots, the 'home' note of the key.",
  why:"Every solo in this course lives inside a shape. Knowing where the roots are means you always know where home is.",
  ex:[{t:"Up the shape",how:"Every note of the shape from lowest to highest, one per beat. Say 'root' each time you hit a dark dot.",gen:v=>{const c=cx(v);return ex(c,I(8),bars(c.P.map(p=>nt(p,Q))));}},
      {t:"Down the shape",how:"Highest to lowest. Keep the beat steady.",gen:v=>{const c=cx(v);return ex(c,I(8),bars([...c.P].reverse().map(p=>nt(p,Q))));}},
      {t:"Root to root",how:"From one root up to the next root and back, in eighth notes.",gen:v=>{const c=cx(v),r=c.P.findIndex(p=>p.deg===0),up=c.P.slice(r,r+8);return ex(c,I(2),bars([...up,...up.slice(0,7).reverse()].map(p=>nt(p,E)).concat([nt(up[0],E)])));}},
      {t:"Only the roots",how:"Find every root in the shape and play just those, two beats each.",gen:v=>{const c=cx(v),rs=c.P.filter(p=>p.deg===0);return ex(c,I(2),bars([...rs,...rs.slice().reverse()].map(p=>nt(p,H,{v:1}))));}},
      {t:"Thirds up and down",how:"Skip one note each time: 1-3, 2-4, 3-5… up the shape, then back down the same way, in eighth notes.",gen:v=>{const c=cx(v),u=[];for(let i=0;i+2<c.N;i++)u.push(c.P[i],c.P[i+2]);const d=[];for(let i=c.N-1;i-2>=0;i--)d.push(c.P[i],c.P[i-2]);return ex(c,I(8),bars([...u,...d].map(p=>nt(p,E))));}},
      {t:"Chord tones only",how:"Only the 1, 3 and 5 of the key (the notes of the I chord) up and down the shape. These are the safest landing notes in any solo.",gen:v=>{const c=cx(v),t=c.P.filter(p=>[0,2,4].includes(p.deg));return ex(c,I(4),bars([...t,...t.slice(0,-1).reverse()].map((p,i)=>nt(p,Q,p.deg===0?{ac:1}:null))));}}]},
 {id:"1.2",t:"Play in time",what:"Playing exactly with the band: starting together, staying together, stopping together.",
  why:"Time is the first thing a listener hears. Simple notes in perfect time sound better than fancy notes out of time.",
  ex:[{t:"One note, four beats",how:"The root on every beat for two bars, then rest two bars. Start exactly with the band after the count-in.",gen:v=>{const c=cx(v),r=dI(c,0,lo(c));return ex(c,I(4),[Array(4).fill(0).map(()=>N_(c,r,Q)),Array(4).fill(0).map(()=>N_(c,r,Q,{v:1})),[],[]]);}},
      {t:"Eighths up and down",how:"Four notes up and four down in eighth notes, every bar the same.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),Array(4).fill(0).map(()=>line(c,i,[0,1,1,1,-1,-1,-1,0],[E])));}},
      {t:"Stop together",how:"One bar of notes, one bar of silence. The silence has to be exact too.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1,-2],[Q]),[],line(c,i,[0,-1,-1,2],[Q]),[]]);}}]},
 {id:"1.3",t:"Three-note melodies",what:"Melodies made from only three neighbouring notes of the shape.",
  why:"Limits free you up. With three notes you can only make music with rhythm and order, and that's exactly what you need to learn first.",
  ex:[{t:"Up and hold",how:"Three notes up: quarter, quarter, then a long note. Repeat with small changes.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),[line(c,i,[0,1,1],[Q,Q,H]),line(c,i,[2,-1,-1],[Q,Q,H]),line(c,i,[0,1,1],[Q,Q,H]),line(c,i,[1,1,-2],[Q,Q,H])]);}},
      {t:"Quick-quick-slow",how:"Two eighths and a long note.",gen:v=>{const c=cx(v),i=lo(c)+1;return ex(c,I(4),[line(c,i,[0,1,1],[E,E,DQ+Q]),line(c,i,[0,1,1],[E,E,DQ+Q]),line(c,i,[2,-1,-1],[E,E,DQ+Q]),line(c,i,[1,-1,0],[Q,Q,H],[0,0,{v:1}])]);}},
      {t:"Dotted rhythm",how:"Long-short pairs (dotted quarter + eighth). It gives a lilt.",gen:v=>{const c=cx(v),i=mid(c)-1;return ex(c,I(4),[line(c,i,[0,1,1,-1],[DQ,E,DQ,E]),line(c,i,[0,2,-1],[DQ,E,H]),line(c,i,[2,-1,-1,1],[DQ,E,DQ,E]),line(c,i,[1,-1],[DQ,E+H],[0,{v:1}])]);}},
      {t:"Your three, your rhythm",how:"Play the example, then mute 🎸 and make up your own rhythms with the same three notes.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,-1,1,1],[E,E,Q,E,E+Q]),line(c,i,[2,-2],[H,H]),line(c,i,[0,0,1,1],[E,E,Q,H]),line(c,i,[2,-1,-1],[Q,E,E+H],[0,0,{v:1}])]);}}]},
 {id:"1.4",t:"Ending on the root",what:"Short phrases that come to rest on the root.",
  why:"The root sounds like home. Ending a phrase there tells the listener 'that sentence is finished'.",
  ex:[{t:"Step down to the root",how:"Four notes stepping down, landing long on the root.",gen:v=>{const c=cx(v),r=dI(c,0,mid(c));return ex(c,I(4),[line(c,r+3,[0,-1,-1,-1],[Q,Q,Q,Q]),line(c,r,[0],[W],[{v:1}]),line(c,r+3,[0,-1,-1,-1],[E,E,Q,H],[0,0,0,{v:1}]),[]]);}},
      {t:"Step up to the root",how:"From below up into the root.",gen:v=>{const c=cx(v),r=dI(c,0,mid(c));return ex(c,I(4),[line(c,r-3,[0,1,1,1],[Q,Q,Q,Q]),line(c,r,[0],[W],[{v:1}]),line(c,r-2,[0,1,1],[E,E,DQ+Q],[0,0,{v:1}]),[]]);}},
      {t:"Around and home",how:"Wander a little, then come home to the root at the end of each two bars.",gen:v=>{const c=cx(v),r=dI(c,0,mid(c));return ex(c,I(4),[line(c,r,[0,2,1,-1],[Q,Q,E,DQ]),line(c,r+1,[0,1,-2,-1],[Q,Q,Q,Q]),line(c,r,[-1,-1,2,1,1],[E,E,Q,Q,Q]),line(c,r+1,[0,-1],[Q,DQ+Q+E],[0,{v:1}])]);}}]}]},

{n:2,t:"Rhythm and space",goal:"Make simple notes interesting with rests, note lengths, off-beats and triplets.",lessons:[
 {id:"2.1",t:"Rests are music",what:"Silence between phrases, on purpose.",
  why:"Space lets the listener hear what you played and makes the next phrase stronger. Beginners fill every beat; good players breathe like singers.",
  ex:[{t:"Play a bar, rest a bar",how:"Short phrase, then a full bar of silence.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1,-1],[Q,Q,E,DQ]),[],line(c,i,[1,1,-1,-1],[Q,Q,E,DQ],[0,0,0,{v:1}]),[]]);}},
      {t:"Two beats on, two off",how:"Every phrase is two beats long, followed by two beats of rest.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[[...line(c,i,[0,1,1],[E,E,Q]),R(H)],[...line(c,i+2,[0,-1,-1],[E,E,Q]),R(H)],[...line(c,i,[0,2,-1],[E,E,Q]),R(H)],[...line(c,i+1,[0,-1],[Q,Q],[0,{v:1}]),R(H)]]);}},
      {t:"Breathe before the change",how:"Each phrase ends on beat 3 and the last beat is silent, like taking a breath.",gen:v=>{const c=cx(v),ch=P4(v);return ex(c,ch,ch.map((h,b)=>{const t=ctI(c,h,mid(c)+(b%2));return [...line(c,t-2,[0,1],[Q,Q]),N_(c,t,Q,{v:1}),R(Q)];}),PROGS[prog(v)].n);}}]},
 {id:"2.2",t:"Long and short notes",what:"Mixing note lengths: long held notes, short quick ones.",
  why:"Contrast keeps a melody alive. All short notes sound nervous; all long notes sound sleepy. Mixing them sounds like speech.",
  ex:[{t:"Long, short, short",how:"A half note, then two quarters, over and over.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,-1,-1],[H,Q,Q]),line(c,i,[1,-1,-1],[H,Q,Q]),line(c,i,[2,-1,-1],[H,Q,Q]),line(c,i,[0],[W],[{v:1}])]);}},
      {t:"Short, short, long",how:"Two eighths into a long note, with vibrato.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),Array(4).fill(0).map((_,b)=>line(c,i+(b%2?1:-1),[0,1,1],[E,E,DQ+Q+E+E],[0,0,{v:1}])));}},
      {t:"Mixed lengths",how:"Every bar uses three different note lengths.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1,-2],[Q,E,E,H]),line(c,i,[0,-1,1,2],[E,E,Q,H]),line(c,i+2,[0,-1,-1],[DQ,E,H]),line(c,i,[0,-1],[E,DQ+H],[0,{v:1}])]);}}]},
 {id:"2.3",t:"Off-beat starts",what:"Starting phrases on the 'and' between beats instead of on the beat (syncopation).",
  why:"Off-beat starts make a solo groove and sound less predictable. Most memorable riffs and melodies use them.",
  ex:[{t:"Start on the 'and' of 1",how:"Rest half a beat, then play. Count '1-and' and come in on 'and'.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),Array(4).fill(0).map((_,b)=>[R(E),...line(c,i+(b%3),[0,1,-1],[E,Q,H-E+Q],[0,0,{v:1}])]));}},
      {t:"Push across the beat",how:"Eighth, quarter, eighth: the quarter note lands between beats.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),Array(4).fill(0).map((_,b)=>line(c,i+(b%2),[0,1,1,-1,-1],[E,Q,E,Q,Q])));}},
      {t:"Anticipate the bar",how:"Each phrase starts on the last 'and' of the bar before: a pickup.",gen:v=>{const c=cx(v),ch=P4(v);return ex(c,ch,ch.map((h,b)=>{const t=ctI(c,ch[(b+1)%4],mid(c));return [...line(c,ctI(c,h,mid(c)),[0,-1],[DQ,E+Q]),R(Q+E),N_(c,t-1,E)];}));}}]},
 {id:"2.4",t:"Triplets and dotted rhythms",what:"Three notes in the space of one beat (triplets), and long-short dotted pairs.",
  why:"They change the feel instantly: triplets roll, dotted rhythms swing. Bluesy and soulful solos use both constantly.",
  ex:[{t:"Triplet steps",how:"Three notes per beat, stepping up then down. Say 'trip-o-let'.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),[line(c,i,[0,1,1,1,1,1,-1,-1,-1,-1,-1,-1],[T3]),line(c,i,[0,1,1,-1,1,1],[T3,T3,T3,T3,T3,T3+Q+Q]),line(c,i+2,[0,-1,-1,1,-1,-1],[T3]),line(c,i,[0],[W],[{v:1}])]);}},
      {t:"Dotted pairs",how:"Long-short, long-short. Keep the short note crisp.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1,1],[DQ,E,DQ,E]),line(c,i+3,[0,-1,-1,-1],[DQ,E,DQ,E]),line(c,i,[0,2,-1,1],[DQ,E,DQ,E]),line(c,i+2,[0],[W],[{v:1}])]);}},
      {t:"Mix the feels",how:"A triplet bar, a straight bar, a dotted bar, a long note.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1,1,-1,-1],[T3,T3,T3,T3,T3,T3+Q+Q]),line(c,i,[0,1,-1,-1],[E,E,Q,H]),line(c,i,[0,1,1,-1],[DQ,E,DQ,E]),line(c,i,[0],[W],[{v:3}])]);}}]},
 {id:"2.5",t:"Same rhythm, new notes",what:"Keep one rhythm and change the notes each bar, following the chords.",
  why:"A repeated rhythm is a hook. The ear follows it easily, so you can travel through the chords and still sound connected.",
  ex:[{t:"One rhythm through the chords",how:"The same rhythm in every bar, ending each bar on a note of that bar's chord.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v);return ex(c,ch,ch.map(h=>{const t=ctI(c,h,mid(c));const ps=posOf(m),last=ps[ps.length-1];return line(c,t-last,m.s,m.d,m.s.map((_,j)=>j===m.s.length-1?{v:1}:0));}),PROGS[prog(v)].n);}},
      {t:"Another rhythm",how:"A different rhythm, same idea.",gen:v=>{const c=cx(v),ch=P4(v+1),m=mot(v+2);return ex(c,ch,ch.map(h=>{const t=ctI(c,h,mid(c)+1),ps=posOf(m);return line(c,t-ps[ps.length-1],m.s,m.d);}),PROGS[prog(v+1)].n);}}]}]},

{n:3,t:"Motifs",goal:"Build a solo from one small idea by repeating and changing it.",lessons:[
 {id:"3.1",t:"What a motif is",what:"A motif is a short musical idea, 3 to 5 notes with a clear rhythm, that you can repeat and recognise.",
  why:"Listeners remember ideas, not scales. A solo built from one motif feels like it's saying something.",
  ex:[{t:"One motif, four times",how:"Play the motif in every bar exactly the same. Learn it by heart.",gen:v=>{const c=cx(v),m=mot(v),i=lo(c)+1;return ex(c,I(4),Array(4).fill(0).map(()=>motNotes(c,i,m)));}},
      {t:"A different motif",how:"Same exercise with another idea. Which one do you like better, and why?",gen:v=>{const c=cx(v),m=mot(v+3),i=mid(c);return ex(c,I(4),Array(4).fill(0).map(()=>motNotes(c,i,m)));}},
      {t:"Motif and space",how:"Motif, then a bar of rest, twice. Let it sink in.",gen:v=>{const c=cx(v),m=mot(v+1),i=mid(c);return ex(c,I(4),[motNotes(c,i,m),[],motNotes(c,i,m),[]]);}}]},
 {id:"3.2",t:"Repeat, repeat, turn (AAAB)",what:"Play the motif three times, then something different in the fourth bar that turns it around.",
  why:"Three repeats build expectation; the change satisfies it. It's one of the oldest and strongest melody forms.",
  ex:[{t:"AAAB",how:"Three motifs, then a turn that steps down to the root.",gen:v=>{const c=cx(v),m=mot(v),i=mid(c),r=dI(c,0,lo(c));return ex(c,I(4),[motNotes(c,i,m),motNotes(c,i,m),motNotes(c,i,m),line(c,r+3,[0,-1,-1,-1],[E,E,Q,H],[0,0,0,{v:1}])]);}},
      {t:"AAAB over chords",how:"The motif moves to fit each chord, then the turn.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v+1),ps=posOf(m);return ex(c,ch,ch.map((h,b)=>b<3?motNotes(c,ctI(c,h,mid(c))-ps[ps.length-1],m):line(c,ctI(c,h,mid(c)+2),[0,-1,-1,-1],[E,E,Q,H])),PROGS[prog(v)].n);}},
      {t:"AABA",how:"Motif, motif, contrast, motif.",gen:v=>{const c=cx(v),m=mot(v+2),i=mid(c);return ex(c,I(4),[motNotes(c,i,m),motNotes(c,i,m),line(c,i+3,[0,-1,1,-2],[Q,Q,Q,Q]),motNotes(c,i,m)]);}}]},
 {id:"3.3",t:"Sequences",what:"Repeat the motif starting one scale step higher (or lower) each time.",
  why:"A sequence moves the music forward while keeping the idea. It's the same thinking as the sequences in your Melodic Lead book.",
  ex:[{t:"Up by step",how:"The motif four times, each one step higher.",gen:v=>{const c=cx(v),m=mot(v),i=lo(c);return ex(c,I(4),[0,1,2,3].map(s=>motNotes(c,i+s,m)));}},
      {t:"Down by step",how:"Starting high, each repeat one step lower, ending near the root.",gen:v=>{const c=cx(v),m=mot(v+1),i=hi(c)-1;return ex(c,I(4),[0,1,2,3].map(s=>motNotes(c,i-s,m)));}},
      {t:"Up by a third",how:"Jump two steps each time. Bigger moves, more energy.",gen:v=>{const c=cx(v),m=mot(v+2),i=lo(c)-1;return ex(c,I(4),[0,2,4,6].map(s=>motNotes(c,i+s,m)));}}]},
 {id:"3.4",t:"Developing a motif",what:"Classic composer's changes: flip it upside down, play it backwards, stretch it, squeeze it, or use just a fragment.",
  why:"These tools let one idea fill a whole solo without getting boring. The listener hears both the familiar and the new.",
  ex:[{t:"Invert",how:"Bar 1 the motif, bar 2 upside down (ups become downs). Twice.",gen:v=>{const c=cx(v),m=mot(v),inv={s:m.s.map(x=>-x),d:m.d},i=mid(c);return ex(c,I(4),[motNotes(c,i,m),motNotes(c,i,inv),motNotes(c,i,m),motNotes(c,i,inv)]);}},
      {t:"Reverse",how:"Bar 2 plays the motif's notes backwards with the same rhythm.",gen:v=>{const c=cx(v),m=mot(v+1),ps=posOf(m).reverse(),rv=fromPos(ps,m.d),i=mid(c);return ex(c,I(4),[motNotes(c,i,m),motNotes(c,i,rv),motNotes(c,i,m),motNotes(c,i,rv)]);}},
      {t:"Stretch (augment)",how:"The motif, then the same notes twice as long across two bars.",gen:v=>{const c=cx(v),m=mot(v+2),i=mid(c),aug={s:m.s,d:m.d.map(x=>x*2)};return ex(c,I(4),[motNotes(c,i,m),[],...bars(motNotes(c,i,aug))].slice(0,4).concat([]));}},
      {t:"Squeeze (diminish)",how:"Twice as fast, played twice in one bar.",gen:v=>{const c=cx(v),m=mot(v+3),i=mid(c),dm={s:m.s,d:m.d.map(x=>x/2)};return ex(c,I(4),[motNotes(c,i,m),[...motNotes(c,i,dm),...motNotes(c,i,dm)],motNotes(c,i,m),[...motNotes(c,i,dm),...motNotes(c,i,dm)]]);}},
      {t:"Fragment",how:"Just the first two notes, repeated, then the full motif.",gen:v=>{const c=cx(v),m=mot(v+4),i=mid(c),fr={s:m.s.slice(0,2),d:m.d.slice(0,2)};return ex(c,I(4),[motNotes(c,i,m),[...line(c,i,fr.s,fr.d),...line(c,i,fr.s,fr.d),...line(c,i,fr.s,fr.d)],[...line(c,i+1,fr.s,fr.d),...line(c,i+1,fr.s,fr.d)],motNotes(c,i,m)]);}}]}]},

{n:4,t:"Chord tones",goal:"Hear and target the notes of each chord so your lines fit the song.",lessons:[
 {id:"4.1",t:"Chord tones over one chord",what:"The root, 3rd and 5th of the chord (the green notes in the workshop) inside your shape.",
  why:"Chord tones are where phrases sound settled. Other scale notes are for travelling; chord tones are for arriving.",
  ex:[{t:"Only R, 3 and 5",how:"Every chord tone in the shape, low to high and back.",gen:v=>{const c=cx(v),cs=ctSet(0),L=c.P.filter(p=>cs.has(p.deg));return ex(c,I(4),bars([...L,...L.slice(0,-1).reverse()].map(p=>nt(p,Q))));}},
      {t:"End on the 3rd or 5th",how:"Short scale phrases that land on a chord tone, held.",gen:v=>{const c=cx(v),t3=dI(c,2,mid(c)),t5=dI(c,4,mid(c));return ex(c,I(4),[line(c,t3-2,[0,1,1],[Q,Q,H],[0,0,{v:1}]),[],line(c,t5+2,[0,-1,-1],[Q,Q,H],[0,0,{v:1}]),[]]);}},
      {t:"Run into a chord tone",how:"An eighth-note run whose last note lands on beat 1 of the next bar on a chord tone.",gen:v=>{const c=cx(v),t=dI(c,2,mid(c));return ex(c,I(4),[[R(Q),...line(c,t-6,[0,1,1,1,1,1],[E])],[N_(c,t,W,{v:1})],[R(Q),...line(c,t+6,[0,-1,-1,-1,-1,-1],[E])],[N_(c,t,W,{v:3})]]);}}]},
 {id:"4.2",t:"Following the changes",what:"When the chord changes, aim for a note of the new chord, often its 3rd.",
  why:"This is what makes a solo sound like it belongs to the song rather than floating over it. The 3rd tells the ear major or minor.",
  ex:[{t:"One chord tone per bar",how:"A whole note on the nearest chord tone of each chord.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i,W,{v:1})];}),PROGS[prog(v)].n);}},
      {t:"3rds on beat 1",how:"The 3rd of each chord on beat 1, then a short answer.",gen:v=>{const c=cx(v),ch=P4(v+1);let i=mid(c);return ex(c,ch,ch.map(h=>{i=dI(c,(h+2)%7,i);return [N_(c,i,H,{v:1}),...line(c,i,[1,-1],[Q,Q])];}),PROGS[prog(v+1)].n);}},
      {t:"Lines that land",how:"Eighth notes through the bar, landing on the next chord's tone on beat 1.",gen:v=>{const c=cx(v),ch=P4(v+2);let i=mid(c);return ex(c,ch,ch.map((h,b)=>{const nxt=ctI(c,ch[(b+1)%4],i),start=ctI(c,h,i);i=nxt;const dir=nxt>=start?1:-1;return [N_(c,start,Q),...line(c,start,[dir,dir,dir,-dir,dir,dir],[E])];}),PROGS[prog(v+2)].n);}}]},
 {id:"4.3",t:"The skeleton",what:"Choose one target note per bar first (a chord tone, moving by small steps), then decorate the space before each target.",
  why:"It's how many pros plan a solo: a strong, simple melody underneath and the flash on top. You can't get lost.",
  ex:[{t:"Skeleton only",how:"Half notes on beat 1: one target per chord.",gen:v=>{const c=cx(v),ch=[...P4(v),...P4(v)];let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i,H,{v:1})];}),"skeleton");}},
      {t:"Lead into each target",how:"Same targets, with two notes leading into each one.",gen:v=>{const c=cx(v),ch=[...P4(v),...P4(v)];let i=mid(c);const t=ch.map(h=>i=ctI(c,h,i));return ex(c,ch,ch.map((h,b)=>{const nx=t[(b+1)%t.length],d=nx>=t[b]?1:-1;return [N_(c,t[b],H,{v:1}),R(Q),N_(c,nx-2*d,E),N_(c,nx-d,E)];}),"decorated");}},
      {t:"Neighbours around the targets",how:"Circle each target with the scale notes above and below.",gen:v=>{const c=cx(v),ch=P4(v+1);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i+1,E),N_(c,i-1,E),N_(c,i,DQ+E,{v:1}),R(Q)];}));}}]},
 {id:"4.4",t:"Tension and release",what:"Some scale notes clash a little with the chord (the dashed amber notes): over a major chord, its 4th and 7th. Play one, then step to a chord tone.",
  why:"Tension followed by release is what makes music feel like it's going somewhere. Without tension, nothing resolves.",
  ex:[{t:"4 resolves to 3",how:"Hold the 4th over the I chord, feel the pull, then step down to the 3rd.",gen:v=>{const c=cx(v),f=dI(c,3,mid(c)),t=dI(c,2,f);return ex(c,I(4),[[N_(c,f,H,{ac:1}),N_(c,t,H,{v:1})],[],[N_(c,f,Q),N_(c,f,Q),N_(c,t,H,{v:1})],[]]);}},
      {t:"7 resolves to the root",how:"The 7th wants to rise to the root.",gen:v=>{const c=cx(v),s7=dI(c,6,mid(c)),r=dI(c,0,s7+1);return ex(c,I(4),[[N_(c,s7,H),N_(c,r,H,{v:1})],[],[N_(c,s7-1,Q),N_(c,s7,Q),N_(c,r,H,{v:1})],[]]);}},
      {t:"Tension on every chord",how:"On each chord, start on its tension note and step to a chord tone.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map(h=>{const tn=tnI(c,h,i),res=ctI(c,h,tn);i=res;return [N_(c,tn,Q+E,{ac:1}),N_(c,res,E+H,{v:1})];}),PROGS[prog(v)].n);}}]},
 {id:"4.5",t:"Approach notes and enclosures",what:"Lead into a target from a step below, a half step below, or from both sides (enclosure).",
  why:"Approaches make arrivals sound deliberate, and chromatic approaches add a bluesy or jazzy colour without sounding wrong.",
  ex:[{t:"Scale step below",how:"Into each chord tone from the scale note below it.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i-1,E),N_(c,i,DQ+Q,{v:1}),R(Q)];}));}},
      {t:"Half step below",how:"One fret below the target, then the target.",gen:v=>{const c=cx(v),ch=P4(v+1);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);const t=at(c,i);return [{s:t.s,f:Math.max(1,t.f-1),d:E},N_(c,i,DQ+Q,{v:1}),R(Q)];}));}},
      {t:"Enclose the target",how:"Scale note above, half step below, then the target on the beat.",gen:v=>{const c=cx(v),ch=P4(v+2);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);const t=at(c,i);return [R(Q),N_(c,i+1,E),{s:t.s,f:Math.max(1,t.f-1),d:E},N_(c,i,H,{v:1})];}));}}]}]},

{n:5,t:"Triads",goal:"Use the chord's own shapes anywhere on the neck: inversions, voice leading, triad melodies.",lessons:[
 tri(0,0,"5.1"),tri(0,1,"5.2"),tri(0,2,"5.3"),tri(1,0,"5.4"),tri(1,1,"5.5"),tri(1,2,"5.6"),tri(2,0,"5.7"),tri(2,2,"5.8"),tri(3,0,"5.9"),tri(3,3,"5.10")]},

{n:6,t:"Expression",goal:"Make notes sing: slides, legato, bends, vibrato, accents and short notes.",lessons:[
 {id:"6.1",t:"Slides",what:"Sliding into a note from two frets below, or along a string from one note to the next.",
  why:"Slides join notes like a singer's voice moving between pitches, and let you change position without a gap.",
  ex:[{t:"Slide into chord tones",how:"Each held note slides in from below.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i,H,{sl:1,v:1}),...line(c,i,[-1,-1],[Q,Q])];}));}},
      {t:"Slide-in motif",how:"A motif whose first note slides in, repeated.",gen:v=>{const c=cx(v),m=mot(v),i=mid(c);return ex(c,I(4),Array(4).fill(0).map(()=>motNotes(c,i,m,{sl:1})));}}]},
 {id:"6.2",t:"Legato: hammer-ons and pull-offs",what:"Sounding the next note with the fretting hand only: hammer on going up, pull off going down.",
  why:"Legato makes lines smooth and fluid and lets you play faster with less picking.",
  ex:[{t:"Hammer up in pairs",how:"Pick one note, hammer the next. Pairs of eighths.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),[0,1,2,3].map(b=>line(c,i+b,[0,1,0,1,0,1],[E,E,E,E,E,E+Q],[0,{h:1},0,{h:1},0,{h:1}])));}},
      {t:"Pull down in pairs",how:"Pick the higher note, pull off to the lower.",gen:v=>{const c=cx(v),i=hi(c);return ex(c,I(4),[0,1,2,3].map(b=>line(c,i-b,[0,-1,0,-1,0,-1],[E,E,E,E,E,E+Q],[0,{h:1},0,{h:1},0,{h:1}])));}},
      {t:"Legato phrase",how:"One pick, three notes: pick, hammer, pull.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map(h=>{i=ctI(c,h,i);return [N_(c,i,E),N_(c,i+1,E,{h:1}),N_(c,i,E,{h:1}),N_(c,i-1,E),N_(c,i,H,{v:1})];}));}}]},
 {id:"6.3",t:"Bends",what:"Pushing the string to raise the pitch to the next scale note: a whole step (2 frets) or half step (1 fret).",
  why:"Bends are the guitar's most vocal sound. A bend that arrives on a chord tone is tension and release in one gesture.",
  ex:[{t:"Bend 2 up to 3",how:"First play the target note fretted, then bend the note two frets below up to match it.",gen:v=>{const c=cx(v),t=dI(c,2,hi(c)),tp=at(c,t),bf=bendFrom(tp,c.k);return ex(c,I(4),[[N_(c,t,H),R(H)],[bf?{s:bf.s,f:bf.f,d:W,b:bf.b,v:1}:N_(c,t,W)],[N_(c,t,H),R(H)],[bf?{s:bf.s,f:bf.f,d:W,b:bf.b,bt:"r"}:N_(c,t,W)]]);}},
      {t:"Bend 4 up to 5",how:"Same idea, bending up to the 5th.",gen:v=>{const c=cx(v),t=dI(c,4,hi(c)),tp=at(c,t),bf=bendFrom(tp,c.k);return ex(c,I(4),[[N_(c,t,H),R(H)],[bf?{s:bf.s,f:bf.f,d:H+Q,b:bf.b,v:1}:N_(c,t,H+Q),R(Q)],[N_(c,t-1,Q),N_(c,t,Q),R(H)],[bf?{s:bf.s,f:bf.f,d:W,b:bf.b,v:2}:N_(c,t,W)]]);}},
      {t:"Bend and release, pre-bend",how:"Bend up and come back down; then bend silently, pick, and release.",gen:v=>{const c=cx(v),ch=P4(v);let i=hi(c);return ex(c,ch,ch.map((h,b)=>{i=ctI(c,h,i);const bf=bendFrom(at(c,i),c.k);if(!bf)return [N_(c,i,W,{v:1})];return b%2?[{s:bf.s,f:bf.f,d:H,b:bf.b,bt:"p"},N_(c,i-1,Q),N_(c,i-2,Q)]:[{s:bf.s,f:bf.f,d:H,b:bf.b,bt:"r"},N_(c,i-1,Q),N_(c,i-2,Q)];}));}}]},
 {id:"6.4",t:"Vibrato",what:"A regular wobble in pitch on a held note: normal, wide, or delayed (starting partway through the note).",
  why:"Vibrato is your voice. It makes long notes feel alive and tells the listener a phrase has ended.",
  ex:[{t:"Three vibratos",how:"The same note with normal, wide and delayed vibrato, a rest after each.",gen:v=>{const c=cx(v),t=dI(c,2,hi(c));return ex(c,I(4),[[N_(c,t,H,{v:1}),R(H)],[N_(c,t,H,{v:2}),R(H)],[N_(c,t,W,{v:3})],[]]);}},
      {t:"Vibrato at phrase ends",how:"Only the last note of each phrase gets vibrato.",gen:v=>{const c=cx(v),ch=P4(v);let i=mid(c);return ex(c,ch,ch.map((h,b)=>{const t=ctI(c,h,i);i=t;return [...line(c,t+2,[0,-1],[E,E]),N_(c,t,DQ+E+Q,{v:b%3+1})];}));}}]},
 {id:"6.5",t:"Accents and short notes",what:"Playing some notes harder (accents) and cutting some short (staccato).",
  why:"Dynamics and articulation are how a melody speaks. The same notes with different accents become different phrases.",
  ex:[{t:"Accent the off-beats",how:"Eighth notes with the 'and' notes played harder.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[0,1,2,3].map(b=>line(c,i-1+b%2,[0,1,0,1,0,1,0,-1],[E],[0,{ac:1},0,{ac:1},0,{ac:1},0,{ac:1}])));}},
      {t:"Short and long",how:"Short (staccato) notes contrasted with a long held note.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[0,1,2,3].map(b=>line(c,i+b%2,[0,1,1,-1],[Q,Q,Q,Q],[{st:1},{st:1},{st:1},b%2?{v:1}:0])));}}]}]},

{n:7,t:"Phrasing",goal:"Shape phrases like sentences: questions and answers, lengths, leaps and peaks.",lessons:[
 {id:"7.1",t:"Call and response",what:"A phrase that asks (ends on a note that sounds unfinished) and one that answers (ends on a chord tone, often the root).",
  why:"Conversation is the easiest structure for a listener to follow. It gives meaning even to simple notes.",
  ex:[{t:"Question and answer",how:"Bars 1-2 end up high on a non-chord note; bars 3-4 answer and end on the root.",gen:v=>{const c=cx(v),m=mot(v),i=mid(c),q=tnI(c,0,hi(c)),r=dI(c,0,mid(c));const ps=posOf(m),last=ps[ps.length-1];return ex(c,I(4),[motNotes(c,q-last,m),[],line(c,r+2,[0,-1,-1],[Q,Q,H],[0,0,{v:1}]),[]]);}},
      {t:"Over the chords",how:"Call over the first two chords, response over the last two.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v+1),ps=posOf(m),last=ps[ps.length-1];const call=tnI(c,ch[1],hi(c)),resp=dI(c,0,mid(c));return ex(c,ch,[motNotes(c,mid(c),m),[...line(c,call-1,[0,1],[Q,H+Q],[0,{v:2}])],motNotes(c,resp+2-last,m),[N_(c,resp,W,{v:1})]]);}}]},
 {id:"7.2",t:"Phrase lengths",what:"Phrases can be one bar, two bars, or start mid-bar and cross the bar line.",
  why:"Always playing 4-beat phrases that start on beat 1 sounds square. Varying length and start point sounds natural and alive.",
  ex:[{t:"One-bar phrases",how:"Short statements, each one bar, with breathing room.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),[line(c,i,[0,1,1],[Q,Q,Q]),line(c,i+2,[0,-1,-1],[Q,Q,Q]),line(c,i,[0,2,-1],[Q,Q,Q]),line(c,i+1,[0,-1],[Q,H],[0,{v:1}])]);}},
      {t:"Start on beat 3",how:"Phrases begin halfway through the bar and finish in the next.",gen:v=>{const c=cx(v),i=mid(c);return ex(c,I(4),bars([R(H),...line(c,i,[0,1,1,1,-1,-1],[E,E,Q,Q,Q,H],[0,0,0,0,0,{v:1}]),R(H),...line(c,i+2,[0,-1,1,-2],[E,E,Q,W],[0,0,0,{v:1}])]));}},
      {t:"A long phrase",how:"One phrase that runs over two and a half bars, then rest.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),bars([...line(c,i,[0,1,1,1,1,-1,1,1,1,-1,-1,-1,1,1],[E,E,E,E,Q,E,E,Q,E,E,E,E,Q,H+Q],[0,0,0,0,0,0,0,0,0,0,0,0,0,{v:1}])]));}}]},
 {id:"7.3",t:"Leaps and steps",what:"Most melody moves by step; a leap (a jump of a 4th or more) adds surprise. After a leap, step back the other way.",
  why:"Steps keep a melody singable; leaps keep it interesting. Balancing them is a basic rule of good melody.",
  ex:[{t:"Leap up, step down",how:"Jump up a few notes, then walk back down.",gen:v=>{const c=cx(v),i=lo(c);return ex(c,I(4),[0,1,0,1].map(b=>line(c,i+b,[0,4,-1,-1],[Q,Q,Q,Q],[0,{ac:1},0,b?{v:1}:0])));}},
      {t:"Leap down, step up",how:"The mirror image.",gen:v=>{const c=cx(v),i=hi(c);return ex(c,I(4),[0,1,0,1].map(b=>line(c,i-b,[0,-4,1,1],[Q,Q,Q,Q])));}},
      {t:"Arpeggio leaps",how:"Leaps between chord tones sound complete without stepping back.",gen:v=>{const c=cx(v),cs=ctSet(0),L=c.P.map((p,i)=>i).filter(i=>cs.has(c.P[i].deg));const a=L.slice(1,5);return ex(c,I(4),[a.map(i=>N_(c,i,Q)),[N_(c,a[3],W,{v:1})],a.slice().reverse().map(i=>N_(c,i,Q)),[N_(c,a[0],W,{v:1})]]);}}]},
 {id:"7.4",t:"One peak",what:"The highest note of a phrase or solo, played once, on a strong beat.",
  why:"A single, well-placed peak is the moment people remember. Hitting the top note over and over wastes it.",
  ex:[{t:"Climb to one peak",how:"Climb for three bars, hit the top note once on beat 1, then come down.",gen:v=>{const c=cx(v),i=lo(c),top=c.N-1;return ex(c,I(4),[line(c,i,[0,1,1,1],[Q]),line(c,i+3,[0,1,-1,1,1],[Q,E,E,Q,Q]),[N_(c,top,H,{v:2,ac:1}),...line(c,top,[-1,-1],[Q,Q])],line(c,top-3,[0,-1,-1],[Q,Q,H],[0,0,{v:1}])]);}},
      {t:"Peak early, walk down",how:"A short climb that peaks in bar 2, then a long, slow walk down. The peak happens once.",gen:v=>{const c=cx(v),top=c.N-1,i=top-4;return ex(c,I(4),[line(c,i,[0,1,1,1],[E,E,Q,H]),[N_(c,top,H,{ac:1,v:2}),...line(c,top,[-1,-1],[Q,Q])],line(c,top-3,[0,-1,-1,-1],[Q]),line(c,top-7,[0,-1],[H,H],[0,{v:1}])]);}},
      {t:"Two phrases, one peak",how:"The first phrase stops just short of the top. The second goes one note higher: that's the peak.",gen:v=>{const c=cx(v),top=c.N-1;return ex(c,I(4),[line(c,top-5,[0,1,1,1],[Q]),[N_(c,top-2,H,{v:1}),R(H)],line(c,top-3,[0,1,1,1],[E,E,Q,H],[0,0,0,{ac:1,v:2}]),line(c,top-2,[0,-1,-1],[Q,Q,H],[0,0,{v:1}])]);}}]}]},

{n:8,t:"Shaping a whole solo",goal:"Plan a solo as a story: statement, answer, build, climax, resolution.",lessons:[
 {id:"8.1",t:"The statement",what:"The first phrase: simple, low-to-middle in the shape, with space.",
  why:"A calm start gives you somewhere to go. If you start at full power, you can't build.",
  ex:[{t:"A quiet first phrase",how:"Motif, rest, motif again, hold. Bars 1-4 of a solo.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v),i=lo(c)+1;return ex(c,ch,[motNotes(c,i,m),[R(H),N_(c,i-1,Q),N_(c,i,Q)],motNotes(c,i,m),[N_(c,ctI(c,ch[3],i),H+Q,{v:1})]],"phrase 1");}},
      {t:"Start on a long note",how:"Open with a held chord tone, add two small notes, and leave the band room.",gen:v=>{const c=cx(v),ch=P4(v),i=lo(c)+1;return ex(c,ch,[[N_(c,ctI(c,ch[0],i),H),N_(c,i+1,Q),N_(c,i,Q)],[N_(c,ctI(c,ch[1],i),W,{v:1})],[R(H),...line(c,i,[0,1],[Q,Q])],[N_(c,ctI(c,ch[3],i+1),H+Q,{v:1})]],"phrase 1");}},
      {t:"Say it, then turn it over",how:"The motif, a bar of space, then the motif upside down, ending on a long note.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v+1),i=lo(c)+2;return ex(c,ch,[motNotes(c,i,m),[],motNotes(c,i+1,{s:m.s.map(x=>-x),d:m.d}),[N_(c,ctI(c,ch[3],i),W,{v:1})]],"phrase 1");}}]},
 {id:"8.2",t:"Building",what:"Raising energy: higher in the shape, more notes, shorter rests.",
  why:"Tension builds when pitch and activity rise together. It makes the listener lean in.",
  ex:[{t:"Climb and fill",how:"Each bar higher and busier than the last.",gen:v=>{const c=cx(v),ch=P4(v),i=mid(c)-2;return ex(c,ch,[line(c,i,[0,1,1],[Q,Q,H]),line(c,i+1,[0,1,1,-1,1],[E,E,Q,Q,Q]),line(c,i+2,[0,1,1,1,-1,1,1,1],[E]),line(c,i+5,[0,1,-1,1,1,-1,1,1,-1,1,1,1],[T3])],"phrase 3");}},
      {t:"Same motif, climbing",how:"One motif played three times, each a little higher, then a run of eighths.",gen:v=>{const c=cx(v),ch=P4(v),m=mot(v),i=lo(c);return ex(c,ch,[motNotes(c,i,m),motNotes(c,i+2,m),motNotes(c,i+4,m),line(c,i+6,[0,1,1,1,1,1,1,1],[E])],"phrase 3");}},
      {t:"Shrinking rests",how:"Each bar the silence gets shorter and the notes get busier, until there's no space left.",gen:v=>{const c=cx(v),ch=P4(v+1),i=lo(c);return ex(c,ch,[[...line(c,i,[0,1],[Q,Q]),R(H)],[...line(c,i+1,[0,1,1],[E,E,Q]),R(Q),N_(c,i+3,Q)],[...line(c,i+2,[0,1,1,1,1],[E,E,E,E,Q]),R(E),N_(c,i+5,E)],line(c,i+4,[0,1,1,1,1,1,1,1],[E])],"phrase 3");}}]},
 {id:"8.3",t:"The climax",what:"The peak moment: the highest note, often bent and held with wide vibrato.",
  why:"Every story needs a high point. Make it one clear moment.",
  ex:[{t:"Bend to the top",how:"A run up into the highest chord tone, bent and held.",gen:v=>{const c=cx(v),top=ctI(c,0,c.N-1,-1),bf=bendFrom(at(c,top),c.k);return ex(c,I(2),[line(c,top-6,[0,1,1,1,1,1],[E,E,E,E,E,E+Q]).concat([]),[bf?{s:bf.s,f:bf.f,d:W,b:bf.b,v:2,ac:1}:N_(c,top,W,{v:2,ac:1})]],"climax");}},
      {t:"Climax by repetition",how:"Circle the top three notes faster and faster, then hold the top one.",gen:v=>{const c=cx(v),top=ctI(c,0,c.N-1,-1);return ex(c,I(3),[line(c,top-2,[0,1,1,-1,1,1,-1,1],[E]),line(c,top-1,[0,1,-1,1,-1,1],[E,E,E,E,Q,Q]),[N_(c,top,W,{v:2,ac:1})]],"climax");}},
      {t:"Climax and fall",how:"Hit the peak first, then fall all the way down the shape to the root.",gen:v=>{const c=cx(v),top=ctI(c,0,c.N-1,-1),r=dI(c,0,lo(c));return ex(c,I(4),[[N_(c,top,H,{v:2,ac:1}),...line(c,top,[-1,-1],[Q,Q])],line(c,top-3,[0,-1,-1,-1,-1,-1,-1,-1],[E]),line(c,Math.max(r+3,top-11),[0,-1,-1,-1],[Q]),[N_(c,r,W,{v:1})]],"climax");}}]},
 {id:"8.4",t:"The ending",what:"Coming home: down the shape, slowing down, landing on the root with vibrato.",
  why:"A clear ending makes the whole solo feel finished and deliberate.",
  ex:[{t:"Come home",how:"Descend in eighths, then quarters, then the root, held.",gen:v=>{const c=cx(v),ch=[0,P4(v)[1],4,0],r=dI(c,0,lo(c));return ex(c,ch,[line(c,r+8,[0,-1,-1,-1,-1,-1,-1,-1],[E]),line(c,r+1,[0,1,-1,-1],[Q]),line(c,r+2,[0,-1],[H,H]),[N_(c,r,W,{v:3})]],"phrase 4");}},
      {t:"Question, then answer",how:"First phrase stops on the 5th over the V chord (a question). The second lands on the root over I (the answer).",gen:v=>{const c=cx(v),r=dI(c,0,lo(c));return ex(c,[0,4,4,0],[line(c,r+2,[0,1,1,-1],[Q]),[N_(c,dI(c,4,r+4),W,{v:1})],line(c,r+3,[0,-1,-1,-1],[Q]),[N_(c,r,W,{v:3})]],"phrase 4");}},
      {t:"Home from below, home from above",how:"Land on the root from underneath, then from above, then hold it.",gen:v=>{const c=cx(v),r=dI(c,0,mid(c));return ex(c,[0,4,4,0],[[...line(c,r-2,[0,1],[Q,Q]),N_(c,r,H,{v:1})],[],[...line(c,r+2,[0,-1],[Q,Q]),N_(c,r,H,{v:1})],[N_(c,r,W,{v:3})]],"phrase 4");}}]},
 {id:"8.5",t:"The whole arc",what:"All four phrases in 16 bars: statement, answer, build and climax, resolution.",
  why:"Hearing the whole shape at once makes it easy to copy the plan in your own solos.",
  ex:[{t:"16-bar arc",how:"Learn it phrase by phrase, then play it all. Notice where it's quiet and where it peaks.",gen:v=>{const c=cx(v),p=P4(v),ch=[...p,...p,p[0],p[1],p[2],4,p[0],p[1],4,0],m=mot(v),i=lo(c)+1,r=dI(c,0,lo(c)),top=c.N-1,bf=bendFrom(at(c,ctI(c,4,top,-1)),c.k);
   const b=[motNotes(c,i,m),[R(H),N_(c,i-1,Q),N_(c,i,Q)],motNotes(c,i,m),[N_(c,ctI(c,ch[3],i),H+Q,{v:1})],
     motNotes(c,i+2,m),motNotes(c,i+2,{s:m.s.map(x=>-x),d:m.d}),motNotes(c,i+4,m),[N_(c,ctI(c,ch[7],i+4),H,{v:1}),...line(c,i+5,[0,1],[Q,Q])],
     line(c,i+5,[0,1,1,-1,1,1,1,-1],[E]),line(c,i+7,[0,1,1,-1,1,1,1,-1,1,1,1,-1],[T3]),[bf?{s:bf.s,f:bf.f,d:W,b:bf.b,v:2,ac:1}:N_(c,top,W,{v:2})],line(c,top-1,[0,-1,1,-2],[E,E,Q,H],[0,0,0,{v:1}]),
     motNotes(c,hi(c)-2,m),line(c,r+8,[0,-1,-1,-1,-1,-1,-1,-1],[E]),line(c,r+2,[0,-1,1,-1],[Q]),[N_(c,r,W,{v:3})]];return ex(c,ch,b,"story arc");}}]}]},

{n:9,t:"Solo studies",goal:"Complete solos that combine everything, to learn and then change.",lessons:[
 tri(5,0,"9.1","8-bar triad study: simple"),tri(5,1,"9.2","8-bar triad study: expressive"),tri(5,2,"9.3","16-bar triad solo"),
 {id:"9.4",t:"16-bar scale and triad solo",what:"A 16-bar solo mixing scale motifs (modules 1-3), chord-tone targets (4), triad stabs (5) and expression (6).",
  why:"Real solos mix approaches. This study shows how they fit together in one piece.",
  ex:[{t:"Mixed study",how:"Learn four bars at a time, slowly.",gen:v=>{const c=cx(v),p=P4(v),ch=[...p,...p,p[0],p[1],p[2],4,p[0],p[1],4,0],m=mot(v+1),vs=chain(c.k,ch,1,8);let i=mid(c);
   const b=ch.map((h,k)=>{const x=vs[k],t=ctI(c,h,i);i=t;switch(k%4){case 0:return k>=12?[blk(x,E,{ac:1}),R(E),...line(c,t,[0,-1,-1],[Q,Q,Q])]:motNotes(c,t-posOf(m).slice(-1)[0],m);case 1:return [N_(c,t+1,E),N_(c,t-1,E),N_(c,t,DQ+E,{v:1}),R(Q)];case 2:return k===10?[dbl(x,H,{sl:1}),...arp(x,[1,0],Q)]:[blk(x,Q,{st:1}),R(Q),N_(c,t,H,{v:1})];default:return k===15?[N_(c,dI(c,0,t),W,{v:3})]:line(c,t+2,[0,-1,-1,1],[E,E,Q,H],[0,0,0,{v:1}]);}});
   return ex(c,ch,b,"scale + triads");}}]}]},

{n:10,t:"Workshop: your own solos",goal:"Write, improvise and save your own solos with everything you've learned.",lessons:[
 {id:"10.1",t:"Warm up by improvising",what:"Two-minute warm-ups over the band with a limit: two notes only, chord notes only, off-beats only and more.",
  why:"Limits remove the fear of choosing. Improvising a little each day is how ideas start to come by themselves.",ex:[],turn:"jam"},
 {id:"10.2",t:"Write a 16-bar solo",what:"Today's key, shape and progression. Write bar by bar with the guide, the skeleton, suggestions built from your bar 1, and the checks.",
  why:"Writing slowly is improvising in slow motion. Every solo you finish adds phrases you'll later play without thinking.",ex:[],turn:"new"},
 {id:"10.3",t:"Write in a form: call and response",what:"A solo whose first 8 bars are calls and responses.",
  why:"Choosing a form before you start makes the blank page much easier.",ex:[],turn:"form:call"},
 {id:"10.4",t:"Write in a form: AAAB",what:"A solo whose first 8 bars repeat one idea three times and then turn.",
  why:"Repetition is the strongest glue in melody. This form makes you use it.",ex:[],turn:"form:aaab"},
 {id:"10.5",t:"Your solos",what:"Everything you've written, saved and synced. Open one to play it with the band, change it, or improvise over it with your part muted.",
  why:"Going back to old solos shows your progress, and playing them is great practice.",ex:[],turn:"lib"}]}];

/* ===================== exhaustive expansion, key by key =====================
   Every lesson is laid out in full and worked key by key: pick a key (C first, then C♯/D♭, D … B), play every
   exercise of the lesson in that key in all five CAGED shapes (triad work: all four string sets), then the next
   key opens by itself. When all 12 keys are done the lesson is complete and the next lesson opens. */
const KORD=[0,1,2,3,4,5,6,7,8,9,10,11];
const SHORD=[0,1,2,3,4];
const KLAB=k=>({1:"C♯/D♭",6:"F♯/G♭"})[k]||keyName(k);
function trace(g){window.__TRACE={sets:new Set(),cx:0};try{g(0);}catch(e){}const t=window.__TRACE;window.__TRACE=null;return t;}
function inst(base,o){return Object.assign({},base,o,{gen:v=>{window.__CK=o.key;window.__CSH=o.sh!=null?o.sh:null;window.__TMAP=o.set?{[o.S]:o.set}:null;
  try{const r=base.gen(v);if(o.set&&r.info)r.info=r.info.split(T.SETS[o.S]).join(T.SETS[o.set]);return r;}finally{window.__CK=window.__CSH=window.__TMAP=null;}}});}
C.forEach(m=>m.lessons.forEach(l=>{if(l.turn||!l.ex.length)return;const raw=l.ex,out=[];
  const tr=raw.map(e=>trace(e.gen)),cxs=tr.some(t=>t.cx),S1=raw.map((e,d)=>!tr[d].cx&&tr[d].sets.size===1?[...tr[d].sets][0]:0);
  l.per=cxs?"shape":S1.some(x=>x)?"set":"";l.drills=raw.length;
  KORD.forEach(k=>{const P=`${l.id}.k${k}`;
    if(cxs){SHORD.forEach(sh=>raw.forEach((e,d)=>{if(tr[d].cx)out.push(inst(e,{id:`${P}.${d+1}.${CAGED[sh].n}`,kg:k,g:CAGED[sh].n+" shape",key:k,sh}));}));
      raw.forEach((e,d)=>{if(!tr[d].cx)out.push(inst(e,{id:`${P}.${d+1}`,kg:k,g:"More",key:k}));});}
    else if(S1.some(x=>x)){[1,2,3,4].forEach(set=>raw.forEach((e,d)=>{if(S1[d])out.push(inst(e,{id:`${P}.${d+1}.s${set}`,kg:k,g:T.SETS[set],key:k,set,S:S1[d]}));}));
      raw.forEach((e,d)=>{if(!S1[d])out.push(inst(e,{id:`${P}.${d+1}`,kg:k,g:"Across string sets",key:k}));});}
    else raw.forEach((e,d)=>out.push(inst(e,{id:`${P}.${d+1}`,kg:k,g:"Exercises",key:k})));});
  l.ex=out;}));
/* earlier progress keeps its place:
   · ticks from the very first version (lesson.n, played in C, C shape) → key C;
   · ticks from 20 Oct (lesson.n.shape, each lesson in its own home key; module 1 numbered 1.1, 1.2 all-keys, 1.3–1.5) → that key. */
function migrate(D){const v=st.course.mig||0;if(v>=3)return;const NL=C.flatMap(m=>m.lessons).filter(l=>!l.turn&&l.ex.length).map(l=>l.id);
  const toOld={"1.2":"1.3","1.3":"1.4","1.4":"1.5"},toNew={"1.3":"1.2","1.4":"1.3","1.5":"1.4"},CIRC=[0,7,2,9,4,11,6,1,8,3,10,5];
  const oldOrder=[NL[0],"1.2*",...NL.slice(1).map(x=>toOld[x]||x)],home=o=>CIRC[oldOrder.indexOf(o)%12];
  const has=id=>allEx().some(x=>x.id===id),put=(id,t)=>{if(id&&has(id)&&!D[id])D[id]=t;};
  Object.keys(D).forEach(id=>{const t=D[id];let m;
    if(v<2&&(m=id.match(/^(\d+\.\d+)\.(\d+)$/))){delete D[id];const L=m[1];[`${L}.k0.${m[2]}.C`,`${L}.k0.${m[2]}.s1`,`${L}.k0.${m[2]}`].some(x=>{if(has(x)){put(x,t);return true;}return false;});return;}
    if(v===2){delete D[id];if(/^1\.2\.k\d+\./.test(id))return; // the old all-keys lesson is folded into every lesson
      m=id.match(/^(\d+\.\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?$/);if(!m)return;const L=toNew[m[1]]||m[1],k=home(m[1]);if(k==null||isNaN(k))return;
      put(`${L}.k${k}.${m[2]}${m[3]?"."+m[3]:""}`,t);}});
  st.course.mig=3;}

/* ===================== state, rendering, actions ===================== */
const allEx=()=>C.flatMap(m=>m.lessons.flatMap(l=>l.ex.map(e=>({id:e.id,e,l,m}))));
const done=()=>{st.course=st.course||{done:{}};st.course.done=st.course.done||{};migrate(st.course.done);return st.course.done;};
let cur={lesson:null},vari={},cache={};
function exData(id,e){const v=vari[id]||0,k=id+"#"+v;if(!cache[k]){try{cache[k]=e.gen(v);}catch(err){cache[k]={key:0,ch:[0],bars:[[{r:1,d:48}]],info:"this example didn't work in this key: tap New example"};}}return cache[k];}
const lessonDone=l=>l.ex.length&&l.ex.every(e=>done()[e.id]);
function nextLesson(){for(const m of C)for(const l of m.lessons)if(!l.turn&&!lessonDone(l))return l;return C[9].lessons[1];}
const findL=id=>{for(const m of C)for(const l of m.lessons)if(l.id===id)return {l,m};return null;};
const pcsOf=T.pcsOf;

function miniFret(ex){const ns=[];ex.bars.forEach(b=>b.forEach(n=>{if(!n.r){ns.push({s:n.s,f:n.f});(n.tr||[]).forEach(t=>ns.push(t));}}));if(!ns.length)return "";
  const fs=ns.map(n=>n.f),lo0=Math.max(0,Math.min(...fs)-1),hi0=Math.max(...fs)+1,cols=hi0-lo0,W0=340,L=22,Tp=10,G=18,cw=(W0-L-8)/cols,Hh=Tp+G*5+22,uniq={};
  ns.forEach(n=>{uniq[n.s+"/"+n.f]=n;});const role=n=>pcsOf(ex.key,ex.ch[0]).indexOf((OPEN[n.s]+n.f)%12);
  let g=`<svg viewBox="0 0 ${W0} ${Hh}" style="width:100%;height:auto;display:block">`;
  for(let k=0;k<=cols;k++){const x=L+k*cw;g+=`<line x1="${x}" x2="${x}" y1="${Tp}" y2="${Tp+5*G}" stroke="#cbd5e1"/>`;}
  for(let s=1;s<=6;s++)g+=`<line x1="${L}" x2="${W0-8}" y1="${Tp+(s-1)*G}" y2="${Tp+(s-1)*G}" stroke="#94a3b8" stroke-width="${.7+s*.2}"/><text x="6" y="${Tp+(s-1)*G+4}" font-size="9" fill="#94a3b8">${"eBGDAE"[s-1]}</text>`;
  for(let f=lo0+1;f<=hi0;f++)g+=`<text x="${L+(f-lo0-.5)*cw}" y="${Tp+5*G+15}" font-size="9" text-anchor="middle" fill="#64748b">${f}</text>`;
  Object.values(uniq).forEach(n=>{const r=role(n),col=r===0?"#172033":r===1?"#059669":r===2?"#2563eb":"#fff",tc=r>=0?"#fff":"#334155";
    g+=`<circle cx="${L+(n.f-lo0-.5)*cw}" cy="${Tp+(n.s-1)*G}" r="8" fill="${col}" stroke="${r>=0?col:"#94a3b8"}"/><text x="${L+(n.f-lo0-.5)*cw}" y="${Tp+(n.s-1)*G+3}" font-size="8" font-weight="700" text-anchor="middle" fill="${tc}">${nn(OPEN[n.s]+n.f,ex.key)}</text>`;});
  return g+`</svg><p class="small muted" style="margin:0">Notes in this example. Over the first chord: <b style="color:#172033">root</b> · <b style="color:#059669">3rd</b> · <b style="color:#2563eb">5th</b> · white = other notes.</p>`;}
function exTab(ex,id){const lab=n=>(n.ac?">":"")+(n.sl?"/":"")+(n.h?"h":"")+n.f+(n.b?(n.bt==="r"?"br":n.bt==="p"?"pb":"b"):"")+(n.v?["","~","≈","-~"][n.v]:"")+(n.st?".":"");
  return `<div class="bars">${ex.bars.map((br,b)=>{const Wd=160,Tp=8,G=9,x=p=>6+p/48*(Wd-12),bl=beatLayer(br,Wd,Tp,G,x),Hh=bl.H;let pos=0,g=bl.bg;
    for(let s=1;s<=6;s++)g+=`<line x1="2" x2="${Wd-2}" y1="${Tp+(s-1)*G}" y2="${Tp+(s-1)*G}" stroke="#e2e8f0"/>`;
    br.forEach(n=>{if(!n.r){const y=Tp+(n.s-1)*G,l=lab(n);(n.tr||[]).forEach(q=>{const yy=Tp+(q.s-1)*G;g+=`<rect x="${x(pos)-1}" y="${yy-5.5}" width="${String(q.f).length*5.6+2}" height="10" fill="#fff"/><text x="${x(pos)}" y="${yy+3}" font-size="9.5" font-weight="700" font-family="ui-monospace,Menlo,monospace" fill="#7c3aed">${q.f}</text>`;});
      g+=`<rect x="${x(pos)}" y="${y+3}" width="${Math.max(2,x(pos+n.d)-x(pos)-2)}" height="2" rx="1" fill="#fdba74"/><rect x="${x(pos)-1}" y="${y-5.5}" width="${l.length*5.6+2}" height="10" fill="#fff"/><text class="nt" data-a="${pos}" data-z="${pos+n.d}" x="${x(pos)}" y="${y+3}" font-size="9.5" font-weight="700" font-family="ui-monospace,Menlo,monospace" fill="#172033">${l}</text>`;}pos+=n.d;});g+=bl.cn;
    return `<div class="bar" data-cb="${b}" data-cex="${id}"><div class="bh">${chordName(ex.ch[b],ex.key)}<span>${b+1}</span></div><svg viewBox="0 0 ${Wd} ${Hh}" data-sub="${bl.sub}">${g}</svg></div>`;}).join("")}</div>`;}
const ctempo=()=>{st.course=st.course||{done:{}};return st.course.tempo||66;};

function renderSyllabus(){const D=done(),A=allEx(),tot=A.length,n=A.filter(x=>D[x.id]).length,nx=nextLesson(),nL=C.reduce((a,m)=>a+m.lessons.length,0);
  return `${tabsHTML()}<section class="card"><div class="row between"><h2>Soloing Course</h2><span class="muted small">${n} of ${tot} exercises</span></div>
    <p class="small">Learn to solo by doing it, from your first notes in a CAGED shape to complete 16-bar solos of your own. ${C.length} modules, ${nL} lessons, ${tot} exercises.</p>
    <p class="small muted">Each lesson tells you what you're learning and why it helps, then lays out every exercise in full, key by key: in C first, every exercise in all five CAGED shapes (triad work on all four string sets); then C♯/D♭, D and so on through all 12 keys. The next key and the next lesson open by themselves. Each exercise starts slower and climbs to your goal tempo.</p>
    <span class="fill"><s style="width:${tot?n/tot*100:0}%"></s></span>
    <div class="row"><button class="pri" data-clesson="${nx.id}">${n?"Continue":"Start"}: ${nx.id} ${esc(nx.t)} ▸</button></div></section>
  <section class="card"><h2>Syllabus</h2>
    ${C.map(m=>{const ex=m.lessons.flatMap(l=>l.ex.map(e=>e.id)),k=ex.filter(id=>D[id]).length;
      return `<details${m.lessons.some(l=>l.id===nx.id)?" open":""} style="border-top:1px solid var(--line);padding-top:8px"><summary style="cursor:pointer"><b>Module ${m.n} · ${esc(m.t)}</b> <span class="muted small">${ex.length?`${k}/${ex.length}`:"workshop"}</span><br><span class="small muted">${esc(m.goal)}</span></summary>
      <div class="lib" style="margin-top:8px">${m.lessons.map(l=>{const kk=l.ex.filter(e=>D[e.id]).length;
        return `<div class="solo"><div style="min-width:0"><b>${l.id} ${esc(l.t)}</b><span>${l.turn?"hands-on":`${l.ex.length} exercise${l.ex.length>1?"s":""}`}</span></div><div class="row" style="flex:none">${l.turn?"":`<span class="badge${kk===l.ex.length?" fin":""}">${kk}/${l.ex.length}</span>`}<button data-clesson="${l.id}">Open</button></div></div>`;}).join("")}</div></details>`;}).join("")}
  </section>`;}
const keyDone=(l,k)=>{const D=done();return l.ex.every(e=>e.kg!==k||D[e.id]);};
function curKey(l){if(cur.keyL===l.id&&cur.key!=null)return cur.key;cur.keyL=l.id;cur.key=KORD.find(k=>!keyDone(l,k));if(cur.key==null)cur.key=KORD[0];cur.grp=null;return cur.key;}
const groups=(l,k)=>[...new Set(l.ex.filter(e=>e.kg===k).map(e=>e.g))];
function curGrp(l,k){const gs=groups(l,k);if(cur.grp&&cur.grpL===l.id+"@"+k&&gs.includes(cur.grp))return cur.grp;const D=done();cur.grpL=l.id+"@"+k;cur.grp=gs.find(g=>l.ex.some(e=>e.kg===k&&e.g===g&&!D[e.id]))||gs[0];return cur.grp;}
function keyBar(l,K,D){if(!l.ex.length)return "";
  return `<section class="card"><div class="row between"><b>Key</b><span class="small muted">${KORD.filter(k=>keyDone(l,k)).length} of 12 keys done</span></div>
    <p class="small muted" style="margin:4px 0 6px">Play everything in one key, ${l.per==="shape"?"through all five shapes":l.per==="set"?"on all four string sets":"start to finish"}. The next key opens when this one is done.</p>
    <div class="row" style="flex-wrap:wrap;gap:6px">${KORD.map(k=>{const xs=l.ex.filter(e=>e.kg===k),n=xs.filter(e=>D[e.id]).length;
      return `<button data-ckey="${k}" class="${k===K?"pri":n===xs.length?"good":""}">${n===xs.length?"✓ ":""}${KLAB(k)}${n&&n<xs.length?` <span class="small">${n}/${xs.length}</span>`:""}</button>`;}).join("")}</div></section>`;}
function grpBar(l,K,G,D){const gs=groups(l,K);if(gs.length<2)return "";
  return `<section class="card"><p class="small muted" style="margin:0 0 6px">${KLAB(K)} major: work through the ${l.per==="set"?"string sets":"shapes"} in order.</p><div class="row" style="flex-wrap:wrap;gap:6px">${gs.map(g=>{const xs=l.ex.filter(e=>e.kg===K&&e.g===g),k=xs.filter(e=>D[e.id]).length;
    return `<button data-cgrp="${esc(g)}" class="${g===G?"pri":k===xs.length?"good":""}">${esc(g.replace(/^strings /,""))} <span class="small">${k}/${xs.length}</span></button>`;}).join("")}</div></section>`;}
function renderLesson(id){const f=findL(id);if(!f)return renderSyllabus();const {l,m}=f,D=done(),all=C.flatMap(x=>x.lessons),i=all.indexOf(l),prev=all[i-1],next=all[i+1],K=l.ex.length?curKey(l):0,G=l.ex.length?curGrp(l,K):null;
  const turnBtn={jam:"Start a warm-up ▸",new:"Write today's solo ▸","form:call":"Write a call & response solo ▸","form:aaab":"Write an AAAB solo ▸",lib:"Open your solos ▸"}[l.turn];
  return `${tabsHTML()}<section class="card"><div class="row between"><button class="linkb" data-csyl="1">← Syllabus</button><span class="muted small">Module ${m.n} · ${esc(m.t)}</span></div>
    <h2>${l.id} ${esc(l.t)}</h2>
    <div class="tip"><b>What you're learning:</b> ${esc(l.what)}</div>
    <div class="tip" style="background:var(--good-soft)"><b>Why it's useful:</b> ${esc(l.why)}</div>
    ${l.turn?`<div class="row"><button class="pri" data-cturn="${l.turn}">${turnBtn}</button></div>`:""}
  </section>
  ${keyBar(l,K,D)}${grpBar(l,K,G,D)}
  ${l.ex.filter(e=>e.kg===K).map((e,j)=>({e,j})).filter(x=>x.e.g===G).map(({e,j})=>{const xid=e.id,ex=exData(xid,e),on=play&&play.cex===xid;
    return `<section class="card" data-excard="${xid}"><div class="row between exhd"><h3>${j+1}. ${esc(e.t)}${e.sub?` · ${esc(e.sub)}`:` · ${esc(e.g)}`}</h3><button data-cdone="${xid}" class="${D[xid]?"good":""}">${D[xid]?"✓ Done":"Mark done"}</button></div>
      <p>${esc(e.how)}</p><p class="small muted">${keyName(ex.key)} major · ${esc(ex.info||"")} · ${ex.bars.length} bars</p>
      ${exTab(ex,xid)}${miniFret(ex)}
      <div class="row exrow">${on?`<button class="pri" data-cstop="1">■ Stop</button>`:`<button class="pri" data-cplay="${xid}">▶ Play with band</button>`}${tchip(on)}
        <button data-cdone="${xid}" class="${D[xid]?"good":""}">${D[xid]?"✓ Done":"Mark done"}</button></div></section>`;}).join("")}
  ${!l.ex.length?"":(()=>{const gs=groups(l,K),gi=gs.indexOf(G),ng=gs[gi+1],gd=l.ex.filter(e=>e.kg===K&&e.g===G).every(e=>D[e.id]),nk=KORD.find(k=>k>K&&!keyDone(l,k));
    return `<section class="card"><div class="row between">${ng?`<button class="${gd?"pri":""}" data-cgrp="${esc(ng)}">${esc(ng)} ▸</button>`:nk!=null?`<button class="${keyDone(l,K)?"pri":""}" data-ckey="${nk}">Next key: ${KLAB(nk)} ▸</button>`:"<span></span>"}
      ${lessonDone(l)?`<span class="badge fin">lesson complete</span>`:`<button data-cldone="${l.id}">✓ Mark lesson complete</button>`}</div>
      <p class="small muted" style="margin:0">${l.ex.filter(e=>e.kg===K&&D[e.id]).length} of ${l.ex.filter(e=>e.kg===K).length} done in ${KLAB(K)} · ${l.ex.filter(e=>D[e.id]).length} of ${l.ex.length} in the whole lesson (12 keys).</p></section>`;})()}
  <section class="card"><div class="row between">${prev?`<button data-clesson="${prev.id}">◂ ${prev.id}</button>`:"<span></span>"}
    <span class="row" style="gap:4px"><span class="small muted">goal tempo</span><button data-ctempo="-4">−</button><b>${ctempo()}</b><button data-ctempo="4">+</button></span>
    ${next?`<button class="pri" data-clesson="${next.id}">${next.id} ▸</button>`:""}</div>
    <div class="row small"><button data-cclimb="1" class="${st.course&&st.course.climb===false?"":"on"}">📈 climb ${st.course&&st.course.climb===false?"off":"on"}</button><span class="muted">${st.course&&st.course.climb===false?"Plays at the goal tempo straight away.":`Starts at ${Math.max(40,ctempo()-20)} bpm and rises 4 bpm every time round until it reaches ${ctempo()}.`} <b id="ctNow"></b></span></div>
    <div class="row small"><button data-clead="1" class="${ui.lead===false?"":"on"}">🎸 example notes ${ui.lead===false?"off":"on"}</button><span class="muted">Turn the example off to play the part yourself over the band.</span></div>
    <p class="small muted" style="margin:0">Tab legend: b bend · br bend & release · pb pre-bend · /7 slide in · h7 legato · ~ vibrato (≈ wide, -~ delayed) · >7 accent · 7. short · purple = triad notes.</p></section>`;}
/* tempo chip beside Play with band: the climb (start → goal) before playing, the live tempo while playing; tap to switch the climb on or off */
function tchip(on){const g=ctempo(),cl=!(st.course&&st.course.climb===false),lo=Math.max(40,g-20);
  return `<button class="tchip${cl?" on":""}" data-cclimb="1" title="${cl?`Climb on: starts at ${lo} bpm, +4 bpm each time round, up to ${g}. Tap to play at ${g} straight away.`:`Climb off: plays at ${g} bpm. Tap to climb from ${lo}.`}">${on?`♩<b class="ctnow">${cl?lo:g}</b>${cl?`<small>→${g}</small>`:""}`:cl?`↗${lo}<small>→${g}</small>`:`♩${g}`}</button>`;}
window.renderCourse=function(){document.getElementById("app").innerHTML=cur.lesson?renderLesson(cur.lesson):renderSyllabus();};
/* the exercises on screen right now (this lesson, key and shape/string set) */
function onScreen(){const f=cur.lesson&&findL(cur.lesson);if(!f||!f.l.ex.length)return null;const l=f.l,K=curKey(l),G=curGrp(l,K);
  return {l,K,G,xs:l.ex.filter(e=>e.kg===K&&e.g===G)};}
/* bottom bar on a lesson page: Play/Stop, live tempo, Done for the exercise playing, position in the set */
function bottomBar(){const o=onScreen();if(!o)return "";const D=done(),xs=o.xs;
  if(play&&play.cex){const i=xs.findIndex(e=>e.id===play.cex),id=play.cex;
    return `<button class="pri" data-cstop="1">■ Stop</button>${tchip(true)}<button data-cbdone="${id}" class="${D[id]?"good":""}">${D[id]?"✓ Done":"✓ Mark done"}</button>${i>=0?`<span class="exn">${i+1}/${xs.length}</span>`:""}`;}
  const nx=xs.find(e=>!D[e.id])||xs[0],i=xs.indexOf(nx);
  return `<button class="pri" data-cbplay="${nx.id}">▶ Play ${i+1}</button>${tchip(false)}<span class="exn">${xs.filter(e=>D[e.id]).length}/${xs.length} done</span>`;}
function playEx(id){const b=document.querySelector(`[data-cplay="${id}"]`);if(b){b.click();const c=document.querySelector(`[data-excard="${id}"]`);if(c)window.scrollTo({top:Math.max(0,window.scrollY+c.getBoundingClientRect().top-12),behavior:"smooth"});}}
window.SOLO_COURSE={C,allEx,exData,bar:bottomBar,progress:()=>{const D=done(),A=allEx();return {n:A.filter(x=>D[x.id]).length,tot:A.length};}};

document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(view!=="course")return;
  if(d.csyl){stop();cur.lesson=null;render();window.scrollTo(0,0);return;}
  if(d.clesson){stop();cur.lesson=d.clesson;cur.grp=null;cur.key=null;cur.keyL=null;render();window.scrollTo(0,0);return;}
  if(d.cturn){stop();const k=d.cturn;if(k==="jam"){view="jam";render();window.scrollTo(0,0);return;}
    if(k==="lib"){view="home";render();window.scrollTo(0,0);return;}
    const br=Object.assign({},brief());if(k.startsWith("form:"))br.form=k.slice(5);newSolo(br);return;}
  if(d.cplay){const x=allEx().find(y=>y.id===d.cplay);if(!x)return;const ex=exData(x.id,x.e);start(0,ex.bars.length-1,{key:ex.key,tempo:ctempo(),ch:ex.ch,bars:ex.bars,climb:!(st.course&&st.course.climb===false)});play.cex=x.id;render();return;}
  if(d.cstop){stop();render();return;}
  if(d.cnew){const was=play&&play.cex===d.cnew;stop();vari[d.cnew]=(vari[d.cnew]||0)+1;render();if(was){const b=document.querySelector(`[data-cplay="${d.cnew}"]`);if(b)b.click();}return;}
  if(d.ckey!=null&&d.ckey!==""){stop();cur.key=+d.ckey;cur.keyL=cur.lesson;cur.grp=null;render();window.scrollTo(0,0);return;}
  if(d.cclimb){st.course=st.course||{done:{}};st.course.climb=st.course.climb===false;save();const was=play&&play.cex;stop();render();if(was){const b=document.querySelector(`[data-cplay="${was}"]`);if(b)b.click();}return;}
  if(d.cgrp){stop();cur.grp=d.cgrp;render();window.scrollTo(0,0);return;}
  if(d.cldone){const f=findL(d.cldone);if(!f)return;stop();const D=done(),now=Date.now();f.l.ex.forEach(e=>{if(!D[e.id])D[e.id]=now;});st.course.t=now;save();
    const all=C.flatMap(x=>x.lessons),nx=all[all.indexOf(f.l)+1];if(nx){cur.lesson=nx.id;cur.grp=null;cur.key=null;cur.keyL=null;}render();window.scrollTo(0,0);return;}
  if(d.cbplay){playEx(d.cbplay);return;}
  if(d.cbdone){const D=done(),L0=cur.lesson;if(D[d.cbdone])return; // from the bottom bar while playing: mark it done and go straight on to the next one
    D[d.cbdone]=Date.now();st.course.t=Date.now();save();stop();
    const f=findL(L0),l=f&&f.l;if(!l){render();return;}
    let K=curKey(l),G=curGrp(l,K);const gs=groups(l,K);
    if(l.ex.filter(e=>e.kg===K&&e.g===G).every(e=>D[e.id])){
      const ng=gs.slice(gs.indexOf(G)+1).concat(gs.slice(0,gs.indexOf(G))).find(g=>l.ex.some(e=>e.kg===K&&e.g===g&&!D[e.id]));
      if(ng){cur.grp=ng;toast(`${G} done ✓ Now ${ng}`);}
      else{const nk=KORD.slice(KORD.indexOf(K)+1).concat(KORD.slice(0,KORD.indexOf(K))).find(k=>!keyDone(l,k));
        if(nk!=null){cur.key=nk;cur.keyL=l.id;cur.grp=null;toast(`${KLAB(K)} done ✓ Now ${KLAB(nk)} major`);}
        else{const all=C.flatMap(x=>x.lessons),nx=all[all.indexOf(l)+1];if(nx){cur.lesson=nx.id;cur.grp=null;cur.key=null;cur.keyL=null;toast(`${l.id} complete in all 12 keys ✓`);}render();window.scrollTo(0,0);return;}}}
    render();const o2=onScreen();const nx=o2&&o2.xs.find(e=>!D[e.id]);if(nx)setTimeout(()=>playEx(nx.id),60);return;}
  if(d.cdone){const D=done(),was=D[d.cdone];if(was)delete D[d.cdone];else D[d.cdone]=Date.now();st.course.t=Date.now();save();
    const f=cur.lesson&&findL(cur.lesson);
    if(!was&&f){const l=f.l,K=curKey(l),G=curGrp(l,K),gs=groups(l,K);
      if(l.ex.filter(e=>e.kg===K&&e.g===G).every(e=>D[e.id])){stop();
        const ng=gs.slice(gs.indexOf(G)+1).concat(gs.slice(0,gs.indexOf(G))).find(g=>l.ex.some(e=>e.kg===K&&e.g===g&&!D[e.id]));
        if(ng){cur.grp=ng;render();window.scrollTo(0,0);return;}
        const nk=KORD.slice(KORD.indexOf(K)+1).concat(KORD.slice(0,KORD.indexOf(K))).find(k=>!keyDone(l,k)); // this key is finished: open the next one
        if(nk!=null){cur.key=nk;cur.keyL=l.id;cur.grp=null;toast(`${KLAB(K)} done ✓ Now ${KLAB(nk)} major`);render();window.scrollTo(0,0);return;}
        const all=C.flatMap(x=>x.lessons),nx=all[all.indexOf(l)+1]; // all 12 keys done: the next lesson
        if(nx){cur.lesson=nx.id;cur.grp=null;cur.key=null;cur.keyL=null;toast(`${l.id} complete in all 12 keys ✓`);render();window.scrollTo(0,0);return;}}}
    render();return;}
  if(d.ctempo){st.course=st.course||{done:{}};st.course.tempo=Math.max(40,Math.min(160,ctempo()+ +d.ctempo));save();const was=play&&play.cex;stop();render();if(was){const b=document.querySelector(`[data-cplay="${was}"]`);if(b)b.click();}return;}
  if(d.clead){ui.lead=ui.lead===false;render();return;}
});
})();
