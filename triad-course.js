/* Soloing Course · triad library (helpers + triad lessons used by soloing-course.js)
   A learning-by-doing course: soloing with triads, from what a triad is to full 16-bar solo studies.
   Every exercise is generated, so "New example" gives the same idea in another key / position.
   Uses Solo Builder's globals: OPEN, MAJ, KEYS, PROGS, CAGED, QUAL, ROM, nn, keyName, chordName, shapeNotes,
   start, stop, play, lead, audio, ctx, ui, st, save, view, render, toast, esc, BAR. */
"use strict";
(function(){
const W=48,H=24,DQ=18,Q=12,E=6,T3=4,S16=3;
const K=v=>KEYS[((v%KEYS.length)+KEYS.length)%KEYS.length].pc;
const pcsOf=(key,c)=>[0,2,4].map(k=>(key+MAJ[(c+k)%7])%12);
const roleOf=(pc,key,c)=>["R","3","5"][pcsOf(key,c).indexOf(pc)];
const inScale=(pc,key)=>MAJ.includes(((pc-key)%12+12)%12);
const SETS={1:"strings 1-2-3 (e B G)",2:"strings 2-3-4 (B G D)",3:"strings 3-4-5 (G D A)",4:"strings 4-5-6 (D A E)"};
const INV=["root position","1st inversion","2nd inversion"];

/* every voicing of chord c (scale degree) on three neighbouring strings t, t+1, t+2; notes low → high */
function voicings(key,c,t){const want=pcsOf(key,c),out=[];
  const opt=[t,t+1,t+2].map(s=>{const a=[];for(let f=1;f<=17;f++){const pc=(OPEN[s]+f)%12;if(want.includes(pc))a.push({s,f,pc});}return a;});
  opt[0].forEach(a=>opt[1].forEach(b=>opt[2].forEach(d=>{if(new Set([a.pc,b.pc,d.pc]).size<3)return;const fs=[a.f,b.f,d.f];if(Math.max(...fs)-Math.min(...fs)>4)return;
    const notes=[d,b,a].map(n=>({s:n.s,f:n.f,role:roleOf(n.pc,key,c)}));out.push({notes,lo:Math.min(...fs),hi:Math.max(...fs),inv:["R","3","5"].indexOf(notes[0].role)});})));
  return out.sort((x,y)=>x.lo-y.lo);}
const avgF=v=>v.notes.reduce((a,n)=>a+n.f,0)/3;
function near(key,c,t,fret,inv){let L=voicings(key,c,t);if(inv!=null){const f=L.filter(v=>v.inv===inv);if(f.length)L=f;}
  return L.reduce((b,v)=>Math.abs(avgF(v)-fret)<Math.abs(avgF(b)-fret)?v:b,L[0]);}
/* smallest move from one chord to the next (voice leading) */
function chain(key,chs,t,fret){const out=[];let prev=null;chs.forEach(c=>{const L=voicings(key,c,t).filter(v=>v.lo<=14);
  const v=prev?L.reduce((b,x)=>{const d=x.notes.reduce((a,n,i)=>a+Math.abs(n.f-prev.notes[i].f),0),db=b.notes.reduce((a,n,i)=>a+Math.abs(n.f-prev.notes[i].f),0);return d<db?x:b;},L[0]):near(key,c,t,fret);
  out.push(v);prev=v;});return out;}
/* the three inversions of one chord walking up the neck */
function invUp(key,c,t,fret){const L=voicings(key,c,t).filter(v=>v.lo>=Math.max(1,fret-3));const out=[];let last=-1;
  for(const v of L){if(v.lo>last&&out.length<3&&!out.some(o=>o.inv===v.inv)){out.push(v);last=v.lo;}}return out;}

/* note helpers (durations in 48ths of a bar) */
const nt=(n,d,x)=>Object.assign({s:n.s,f:n.f,d},x||{});
const R=d=>({r:1,d});
const blk=(v,d,x)=>Object.assign({s:v.notes[2].s,f:v.notes[2].f,d,tr:[{s:v.notes[1].s,f:v.notes[1].f},{s:v.notes[0].s,f:v.notes[0].f}]},x||{});
const dbl=(v,d,x)=>Object.assign({s:v.notes[2].s,f:v.notes[2].f,d,tr:[{s:v.notes[1].s,f:v.notes[1].f}]},x||{});
const arp=(v,idx,d,x)=>idx.map(i=>nt(v.notes[i],d,x));
/* scale neighbour on the same string: dir +1 above, -1 below; chromatic = half step */
function nb(n,key,dir,chrom){if(chrom)return {s:n.s,f:n.f+dir};for(const df of [1,2]){const f=n.f+dir*df;if(f>=1&&inScale((OPEN[n.s]+f)%12,key))return {s:n.s,f};}return {s:n.s,f:n.f+dir};}
/* the scale step above that is 1 or 2 semitones below a target on the same string, for bends into it */
function bendFrom(n,key){for(const df of [2,1]){const f=n.f-df;if(f>=1&&inScale((OPEN[n.s]+f)%12,key))return {s:n.s,f,b:df};}return null;}
const prog=v=>Object.keys(PROGS)[((v%5)+5)%5];
const P4=(v)=>PROGS[prog(v)].d;

/* ===================== The course ===================== */
const C=[
{n:1,t:"Triad foundations",goal:"Know what a triad is and find every one in a key on the top strings.",lessons:[
 {id:"1.1",t:"A triad is three notes",
  what:"A triad is the root, 3rd and 5th of a chord played together or one after another. Here you take one triad shape on the top three strings and play it as a chord, then as single notes.",
  why:"Every chord in the songs you play is built from a triad. Its three notes are the safest, strongest notes to land on in a solo. Learn to see them and you always have somewhere good to go.",
  ex:[
   {t:"Strike the triad",how:"Play the three notes together on beats 1 and 3. Let them ring. Listen to the chord they make.",gen:v=>{const k=K(v),a=near(k,0,1,7);return {key:k,ch:[0,0],bars:[[blk(a,H),blk(a,H)],[blk(a,H),blk(a,H,{v:1})]],info:SETS[1]};}},
   {t:"Break it up: R 3 5 3",how:"Same shape, one note at a time in quarter notes: low, middle, high, middle. Keep your fingers in the shape.",gen:v=>{const k=K(v),a=near(k,0,1,7);return {key:k,ch:[0,0],bars:[arp(a,[0,1,2,1],Q),arp(a,[0,1,2,1],Q)],info:SETS[1]};}},
   {t:"Up and down in eighths",how:"Low to high, then back down, two notes per beat. Even and relaxed; alternate picking.",gen:v=>{const k=K(v),a=near(k,0,1,7);return {key:k,ch:[0,0],bars:[arp(a,[0,1,2,1,0,1,2,1],E),arp(a,[2,1,0,1,2,1,0,1],E)],info:SETS[1]};}},
   {t:"Name each note",how:"Each note held for two beats with vibrato. As it rings, say its name: root, third, fifth. Hear how each one feels over the chord.",gen:v=>{const k=K(v),a=near(k,0,1,7);return {key:k,ch:[0,0,0],bars:[[nt(a.notes[0],H,{v:1}),R(H)],[nt(a.notes[1],H,{v:1}),R(H)],[nt(a.notes[2],H,{v:1}),R(H)]],info:SETS[1]};}}]},
 {id:"1.2",t:"Three inversions on the top strings",
  what:"The same three notes can be stacked three ways: root at the bottom (root position), 3rd at the bottom (1st inversion) or 5th at the bottom (2nd inversion). On the top three strings they sit one above the other up the neck.",
  why:"Three shapes of one chord means you can play over that chord anywhere on the neck. Each shape has a different top note, so each gives you a different melody note for the same chord.",
  ex:[
   {t:"Climb the three shapes",how:"Strike each inversion for a bar, moving up the neck, then come back down. Notice which note is on top each time.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[[blk(L[0],W)],[blk(L[1],W)],[blk(L[2],W)],[blk(L[1],W)]],info:SETS[1]+" · "+L.map(x=>INV[x.inv]).join(" → ")};}},
   {t:"Arpeggiate each shape upward",how:"Each shape low → middle → high → middle in quarters, one bar per shape.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[arp(L[0],[0,1,2,1],Q),arp(L[1],[0,1,2,1],Q),arp(L[2],[0,1,2,1],Q),arp(L[1],[2,1,0,1],Q)],info:SETS[1]};}},
   {t:"Top notes only",how:"Play only the top note of each shape, held, with vibrato. That's three melody notes for one chord.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[[nt(L[0].notes[2],DQ+E,{v:1}),R(H)],[nt(L[1].notes[2],DQ+E,{v:1}),R(H)],[nt(L[2].notes[2],DQ+E,{v:1}),R(H)],[nt(L[1].notes[2],W,{v:3})]],info:SETS[1]};}},
   {t:"Shape jumps in eighths",how:"Down each shape in eighths, then jump to the next shape up. Aim for no gap at the jump.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[arp(L[0],[2,1,0,1,2,1,0,1],E),arp(L[1],[2,1,0,1,2,1,0,1],E),arp(L[2],[2,1,0,1,2,1,0,1],E),[nt(L[2].notes[2],W,{v:1})]],info:SETS[1]};}}]},
 {id:"1.3",t:"The seven triads of a key",
  what:"Build a triad on every note of the major scale and you get the key's seven chords: I, ii, iii, IV, V, vi and vii°. Three are major, three minor, one diminished.",
  why:"These are the chords songs in this key use, so these are the shapes you'll solo over. Walking through them also shows the major scale hiding inside triad shapes.",
  ex:[
   {t:"Walk up the key (block)",how:"One triad per bar from I up to the next I. Listen to major, minor, minor, major, major, minor, diminished.",gen:v=>{const k=K(v),ch=[0,1,2,3,4,5,6,0];let f=2;const vs=ch.map((c,i)=>{const x=near(k,c,1,f,0);f=x.lo+(i===6?3:2);return x;});return {key:k,ch,bars:vs.map(x=>[blk(x,H),blk(x,H)]),info:SETS[1]+" · root position"};}},
   {t:"Walk up the key (arpeggio)",how:"Same walk, each triad played low → middle → high → middle.",gen:v=>{const k=K(v),ch=[0,1,2,3,4,5,6,0];let f=2;const vs=ch.map((c,i)=>{const x=near(k,c,1,f,0);f=x.lo+2;return x;});return {key:k,ch,bars:vs.map(x=>arp(x,[0,1,2,1],Q)),info:SETS[1]};}},
   {t:"Up one, down the next",how:"Arpeggiate up on one chord and down on the next. It flows like a melody.",gen:v=>{const k=K(v),ch=[0,1,2,3,4,5,6,0];let f=2;const vs=ch.map(c=>{const x=near(k,c,1,f,0);f=x.lo+2;return x;});return {key:k,ch,bars:vs.map((x,i)=>arp(x,i%2?[2,1,0,1,2,1,0,1]:[0,1,2,1,0,1,2,1],E)),info:SETS[1]};}}]},
 {id:"1.4",t:"Triads on strings 2-3-4",
  what:"Move the same ideas down one string set: B, G and D strings. The shapes change because of the G–B tuning, but the notes are the same.",
  why:"A second set doubles the places you can find each chord and gives a warmer, lower register for the start of a solo.",
  ex:[
   {t:"Three inversions, strings 2-3-4",how:"Strike each inversion of the I chord for a bar, moving up the neck.",gen:v=>{const k=K(v),L=invUp(k,0,2,3);return {key:k,ch:[0,0,0,0],bars:[[blk(L[0],W)],[blk(L[1],W)],[blk(L[2],W)],[blk(L[1],W)]],info:SETS[2]};}},
   {t:"Key walk, strings 2-3-4",how:"I to I through all seven triads, arpeggiated.",gen:v=>{const k=K(v),ch=[0,1,2,3,4,5,6,0];let f=2;const vs=ch.map(c=>{const x=near(k,c,2,f,0);f=x.lo+2;return x;});return {key:k,ch,bars:vs.map(x=>arp(x,[0,1,2,1],Q)),info:SETS[2]};}},
   {t:"Swap sets on one chord",how:"Same chord on strings 1-2-3, then 2-3-4 in the same area. Find the shared notes.",gen:v=>{const k=K(v),a=near(k,0,1,7),b=near(k,0,2,7);return {key:k,ch:[0,0,0,0],bars:[arp(a,[0,1,2,1],Q),arp(b,[0,1,2,1],Q),arp(a,[2,1,0,1],Q),arp(b,[2,1,0,1],Q)],info:"strings 1-2-3 and 2-3-4"};}}]},
 {id:"1.5",t:"Triads on the lower strings",
  what:"Strings 3-4-5 and 4-5-6 hold the same triads an octave lower.",
  why:"Lower triads are useful for opening a solo quietly and for climbing all the way up to the top strings for a big ending.",
  ex:[
   {t:"Strings 3-4-5",how:"Three inversions of the I chord, arpeggiated.",gen:v=>{const k=K(v),L=invUp(k,0,3,3);return {key:k,ch:[0,0,0],bars:L.map(x=>arp(x,[0,1,2,1],Q)),info:SETS[3]};}},
   {t:"Strings 4-5-6",how:"Same on the lowest set. Keep it clean: mute the strings you're not playing.",gen:v=>{const k=K(v),L=invUp(k,0,4,3);return {key:k,ch:[0,0,0],bars:L.map(x=>arp(x,[0,1,2,1],Q)),info:SETS[4]};}},
   {t:"Low to high",how:"One chord climbing through all four string sets in the same area of the neck.",gen:v=>{const k=K(v);const L=[4,3,2,1].map(t=>near(k,0,t,6));return {key:k,ch:[0,0,0,0],bars:L.map(x=>arp(x,[0,1,2,1],Q)),info:"strings 4-5-6 up to 1-2-3"};}}]},
 {id:"1.6",t:"Triads inside your CAGED shape",
  what:"Your CAGED scale shapes from Melodic Lead already contain the I, IV and V triads. Here you find them inside one shape.",
  why:"It joins the two ways of seeing the neck: you can play scale lines and, without moving, drop onto the chord's triad.",
  ex:[
   {t:"I, IV, V inside the shape",how:"Each triad here is fretted entirely inside today's CAGED shape. Strike each for a bar.",gen:v=>{const k=K(v),sh=((v%5)+5)%5,S=shapeNotes(k,sh),inS=x=>x.notes.every(n=>S.some(p=>p.s===n.s&&p.f===n.f));
     const pickIn=c=>{for(const t of [1,2,3]){const L=voicings(k,c,t).filter(inS);if(L.length)return L[0];}return near(k,c,1,S[0].f+2);};const a=pickIn(0),b=pickIn(3),d=pickIn(4);
     return {key:k,ch:[0,3,4,0],bars:[[blk(a,W)],[blk(b,W)],[blk(d,W)],[blk(a,W)]],info:`${CAGED[sh].n} shape (Melodic Lead)`};}},
   {t:"Scale run, then the triad",how:"Four scale notes up the shape, then land on the chord's triad. Scale and triad are one picture.",gen:v=>{const k=K(v),sh=((v%5)+5)%5,S=shapeNotes(k,sh),i0=Math.max(0,Math.floor(S.length/2)-3);
     const run=S.slice(i0,i0+4).map(p=>nt(p,E)),inS=x=>x.notes.every(n=>S.some(p=>p.s===n.s&&p.f===n.f));let tri=null;for(const t of [1,2,3]){const L=voicings(k,0,t).filter(inS);if(L.length){tri=L[0];break;}}tri=tri||near(k,0,1,S[0].f+2);
     return {key:k,ch:[0,0],bars:[[...run,blk(tri,H)],[...S.slice(i0,i0+4).reverse().map(p=>nt(p,E)),blk(tri,H,{v:1})]],info:`${CAGED[sh].n} shape`};}}]}]},

{n:2,t:"Following the chords",goal:"Change triads with the chords smoothly and make the changes heard.",lessons:[
 {id:"2.1",t:"The smallest move",
  what:"When the chord changes, go to the shape of the new chord that is nearest to where your hand already is. Usually one or two notes move a fret or two.",
  why:"Your hand stays in one area, the lines move smoothly, and the chord change sounds clear in your solo. This is called voice leading.",
  ex:[
   {t:"Block triads through a progression",how:"One nearest triad per chord, struck on beats 1 and 3. Watch how little your fingers move.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[blk(x,H),blk(x,H)]),info:SETS[1]+` · ${PROGS[prog(v)].n} progression`};}},
   {t:"Same, strings 2-3-4",how:"The progression with nearest triads on the next set down.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,2,6);return {key:k,ch,bars:vs.map(x=>[blk(x,H),blk(x,H)]),info:SETS[2]+` · ${PROGS[prog(v+1)].n}`};}},
   {t:"Higher up the neck",how:"Same idea starting around the 10th fret. Find the progression a second time.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,11);return {key:k,ch,bars:vs.map(x=>[blk(x,H),blk(x,H)]),info:SETS[1]+" · high position"};}}]},
 {id:"2.2",t:"One arpeggio per bar",
  what:"Instead of strumming, break each chord's nearest triad into single notes, one chord per bar.",
  why:"This is the simplest real triad solo: every note fits its chord, so it already sounds melodic. Patterns give it a shape.",
  ex:[
   {t:"Up, in quarters",how:"Low, middle, high, middle on each chord.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>arp(x,[0,1,2,1],Q)),info:SETS[1]};}},
   {t:"Down, in quarters",how:"High, middle, low, middle on each chord.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>arp(x,[2,1,0,1],Q)),info:SETS[1]};}},
   {t:"Pattern 1-3-5-3 in eighths",how:"Two notes a beat, up and down the shape, without stopping at the change.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>arp(x,[0,1,2,1,0,1,2,1],E)),info:SETS[1]};}},
   {t:"Pattern 3-5-1-5",how:"Start from the middle note. A different order makes a different melody from the same notes.",gen:v=>{const k=K(v),ch=P4(v+3),vs=chain(k,ch,2,7);return {key:k,ch,bars:vs.map(x=>arp(x,[1,2,0,2,1,2,0,2],E)),info:SETS[2]};}},
   {t:"Triplet arpeggios",how:"Three notes per beat, low-middle-high, rolling. Count trip-o-let.",gen:v=>{const k=K(v),ch=P4(v+4),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>arp(x,[0,1,2,1,0,1,2,1,0,1,2,1],T3)),info:SETS[1]+" · triplets"};}}]},
 {id:"2.3",t:"The top-note melody",
  what:"Take only the top note of each nearest triad. Strung together, those notes make a melody that follows the chords.",
  why:"This is the skeleton many great solos hide inside. Once you can hear it, you can decorate it in a hundred ways and still sound connected to the song.",
  ex:[
   {t:"Long top notes",how:"Each chord's top note held a whole bar with vibrato. Sing along.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[2],W,{v:1})]),info:SETS[1]};}},
   {t:"Give it a rhythm",how:"Top note on beat 1, held, then a short repeat before the change.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[2],DQ+E+Q,{v:1}),R(E),nt(x.notes[2],E)]),info:SETS[1]};}},
   {t:"Middle note leads to the top",how:"A quick middle note, then the top note. Two-note phrases that sing.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[1],E),nt(x.notes[2],DQ+Q,{v:1}),R(Q)]),info:SETS[1]};}}]},
 {id:"2.4",t:"Rhythm with triads",
  what:"Rests, short notes, pushes and triplets turn the same triad notes into grooves.",
  why:"Rhythm makes or breaks a solo. A strong rhythm with three notes beats a weak rhythm with thirty.",
  ex:[
   {t:"On and off",how:"Eighth notes with rests between pairs. Leave the gaps empty.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[0],E),nt(x.notes[1],E),R(Q),nt(x.notes[2],E),nt(x.notes[1],E),R(Q)]),info:SETS[1]};}},
   {t:"Push the change",how:"Play the next chord's triad on the 'and' of beat 4, half a beat early. That push is called an anticipation.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map((x,i)=>{const nx=vs[(i+1)%vs.length];return [nt(x.notes[2],Q),nt(x.notes[1],E),nt(x.notes[0],E),R(H-E),blk(nx,E,{ac:1})];}),info:SETS[1]+" · anticipation"};}},
   {t:"Short stabs off the beat",how:"Short, accented triads on the 'and' of each beat, funk-style. Mute in between.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[R(E),blk(x,E,{st:1}),R(E),blk(x,E,{st:1,ac:1}),R(E),blk(x,E,{st:1}),R(E),blk(x,E,{st:1,ac:1})]),info:SETS[1]};}},
   {t:"Triplet push",how:"A triplet up the shape into a long top note.",gen:v=>{const k=K(v),ch=P4(v+3),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[...arp(x,[0,1,2],T3),nt(x.notes[2],H,{v:1}),R(Q)]),info:SETS[1]};}}]}]},

{n:3,t:"Melody around the triad",goal:"Surround triad notes with scale and chromatic notes so lines flow instead of jumping.",lessons:[
 {id:"3.1",t:"Upper neighbour",
  what:"Play a triad note, step up to the scale note above, and come back. The triad note is home; the neighbour is a short trip away.",
  why:"It's the simplest way to turn a chord tone into a melody. The neighbour adds movement while the chord tone keeps it anchored.",
  ex:[
   {t:"Top note and its neighbour",how:"Top note, scale note above, top note again (eighth, eighth, quarter), twice per chord.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2],u=nb(t,k,1);return [nt(t,E),nt(u,E),nt(t,Q),nt(t,E),nt(u,E),nt(t,Q,{v:1})];}),info:SETS[1]};}},
   {t:"On the middle note",how:"Same move on the middle string. Slightly darker colour.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[1],u=nb(t,k,1);return [nt(t,E),nt(u,E),nt(t,Q),nt(x.notes[2],H,{v:1})];}),info:SETS[1]};}},
   {t:"Neighbour, then arpeggio",how:"Upper neighbour on the top note, then run down the triad.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2],u=nb(t,k,1);return [nt(t,E),nt(u,E),nt(t,E),nt(x.notes[1],E),nt(x.notes[0],Q),R(Q)];}),info:SETS[1]};}}]},
 {id:"3.2",t:"Lower neighbour",
  what:"Approach a triad note from below: the scale note under it, or the note one fret below (a half step).",
  why:"Lower neighbours pull upward into the target. The half-step version is the bluesy, jazzy sound you hear everywhere.",
  ex:[
   {t:"Scale step below",how:"Scale note below, then the triad note, on each chord's 3rd or top note.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2],l=nb(t,k,-1);return [nt(l,E),nt(t,DQ,{v:1}),nt(l,E),nt(t,DQ)];}),info:SETS[1]};}},
   {t:"Half step below",how:"One fret below, sliding up into the triad note. Smooth and quick.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[1],l=nb(t,k,-1,true);return [nt(l,E),nt(t,E,{h:1}),nt(x.notes[2],Q),nt(l,E),nt(t,E,{h:1}),R(Q)];}),info:SETS[1]};}},
   {t:"Both neighbours",how:"Above, below, then the target: the melody circles in on the note.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2];return [nt(nb(t,k,1),E),nt(nb(t,k,-1),E),nt(t,DQ+E,{v:1}),R(H-E-E)].filter(n=>n.d>0);}),info:SETS[1]};}}]},
 {id:"3.3",t:"Enclosures",
  what:"Surround the target from both sides just before it: scale note above, half step below, then the target lands on beat 1 of the new chord.",
  why:"Enclosures make chord changes sound intentional. The ear hears tension around the target and relief when it lands.",
  ex:[
   {t:"Enclose each new chord's top note",how:"The last two eighths of each bar enclose the next chord's top note, which lands on beat 1.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map((x,i)=>{const nx=vs[(i+1)%vs.length].notes[2];return [nt(x.notes[2],Q+E,{v:1}),nt(x.notes[1],E),nt(x.notes[0],Q),nt(nb(nx,k,1),E),{s:nx.s,f:nx.f-1,d:E}];}),info:SETS[1]};}},
   {t:"Enclose the 3rd",how:"Same, aimed at each chord's 3rd: the note that says major or minor.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);const third=x=>x.notes.find(n=>n.role==="3");return {key:k,ch,bars:vs.map((x,i)=>{const t3=third(x),nx=third(vs[(i+1)%vs.length]);return [nt(t3,DQ,{v:1}),nt(x.notes[2],E),nt(x.notes[1],Q),nt(nb(nx,k,1),E),{s:nx.s,f:nx.f-1,d:E}];}),info:SETS[1]};}}]},
 {id:"3.4",t:"Passing notes",
  what:"Fill the gaps between triad notes with the scale notes in between, so a jump becomes a run.",
  why:"Passing notes connect your chord tones into flowing lines. They are why scale runs can sound melodic: they're travelling between targets.",
  ex:[
   {t:"Fill R to 5",how:"Root, scale note, 3rd, scale note, 5th, then back down the same way.",gen:v=>{const k=K(v),x=near(k,0,1,7);const [a,b,c]=x.notes;const run=[a,nb(a,k,1),b,nb(b,k,1),c].map(n=>nt(n,E));return {key:k,ch:[0,0],bars:[[...run,nt(c,Q,{v:1}),R(E)],[...run.slice().reverse().map(n=>({...n})),nt(a,Q+E,{v:1})]],info:SETS[1]};}},
   {t:"Through the progression",how:"Each bar: arpeggio up with a passing note, ending on the top note.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const [a,b,c]=x.notes;return [nt(a,E),nt(nb(a,k,1),E),nt(b,E),nt(nb(b,k,1),E),nt(c,H,{v:1})];}),info:SETS[1]};}},
   {t:"Descending runs",how:"Top note down through the passing notes to the root of each chord.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const [a,b,c]=x.notes;return [nt(c,E),nt(nb(c,k,-1),E),nt(b,E),nt(nb(b,k,-1),E),nt(a,H,{v:1})];}),info:SETS[1]};}}]},
 {id:"3.5",t:"Chord tones on the beat",
  what:"A simple rule that makes long lines sound right: triad notes on the beats, other scale notes on the 'ands' in between.",
  why:"The beats are where the ear checks the harmony. Put chord tones there and you can use any scale note between them.",
  ex:[
   {t:"Over one chord",how:"Eighth notes: triad note, scale note, triad note, scale note… Check that every beat lands on R, 3 or 5.",gen:v=>{const k=K(v),x=near(k,0,1,7);const [a,b,c]=x.notes;return {key:k,ch:[0,0],bars:[[nt(a,E),nt(nb(a,k,1),E),nt(b,E),nt(nb(b,k,1),E),nt(c,E),nt(nb(c,k,1),E),nt(c,Q)],[nt(c,E),nt(nb(c,k,-1),E),nt(b,E),nt(nb(b,k,-1),E),nt(a,H,{v:1})]],info:SETS[1]};}},
   {t:"Over the changes",how:"Same rule while the chords move.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map((x,i)=>{const [a,b,c]=x.notes,up=i%2===0;return up?[nt(a,E),nt(nb(a,k,1),E),nt(b,E),nt(nb(b,k,1),E),nt(c,Q,{v:1}),R(Q)]:[nt(c,E),nt(nb(c,k,-1),E),nt(b,E),nt(nb(b,k,-1),E),nt(a,Q,{v:1}),R(Q)];}),info:SETS[1]};}}]}]},

{n:4,t:"Expression on triads",goal:"Make triad lines sing with hammer-ons, slides, bends, double stops and vibrato.",lessons:[
 {id:"4.1",t:"Sus moves: 2 to 3, 4 to 3",
  what:"Hammer from the 2nd up to the 3rd, or pull off from the 4th down to the 3rd, inside a triad shape.",
  why:"This tiny move is the sound of soul and R&B guitar (and players like John Mayer). It makes a plain triad sound like a vocal line.",
  ex:[
   {t:"Hammer 2 → 3",how:"Pick the scale note below the chord's 3rd, hammer on to the 3rd, let it ring.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes.find(n=>n.role==="3"),l=nb(t,k,-1);return [nt(l,E),nt(t,DQ,{h:1,v:1}),nt(x.notes[2],Q),nt(x.notes[1],Q)];}),info:SETS[1]};}},
   {t:"Pull 4 → 3",how:"Pick the note above the 3rd, pull off down to the 3rd.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes.find(n=>n.role==="3"),u=nb(t,k,1);return [nt(u,E),nt(t,DQ,{h:1,v:1}),blk(x,Q,{st:1}),R(Q)];}),info:SETS[1]};}},
   {t:"Both, with a triad stab",how:"Triad stab, then hammer and pull around the 3rd. A complete little R&B phrase.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes.find(n=>n.role==="3");return [blk(x,Q,{ac:1}),nt(nb(t,k,-1),E),nt(t,E,{h:1}),nt(nb(t,k,1),E),nt(t,E,{h:1}),nt(x.notes[0],Q,{v:1})];}),info:SETS[1]};}}]},
 {id:"4.2",t:"Slides into the shape",
  what:"Slide into a triad note from two frets below instead of picking it cleanly.",
  why:"Slides smooth out the start of a phrase and move you between shapes up and down the neck without a gap.",
  ex:[
   {t:"Slide into each top note",how:"Slide into the top note of each chord's triad, hold it.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[2],H,{sl:1,v:1}),nt(x.notes[1],Q),nt(x.notes[0],Q)]),info:SETS[1]};}},
   {t:"Slide between inversions",how:"Climb the three inversions of one chord, sliding the top note up to the next shape.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[[...arp(L[0],[0,1,2],Q),R(Q)],[nt(L[1].notes[2],Q,{sl:1}),...arp(L[1],[1,0],Q),R(Q)],[nt(L[2].notes[2],Q,{sl:1}),...arp(L[2],[1,0],Q),R(Q)],[nt(L[2].notes[2],W,{v:2})]],info:SETS[1]};}}]},
 {id:"4.3",t:"Bend into chord tones",
  what:"Instead of fretting a triad note, bend up to it from the scale note below: 2 up to 3, 4 up to 5, 7 up to the root.",
  why:"A bend arriving on a chord tone is the most vocal sound the guitar makes. The bend is tension, the arrival is release.",
  ex:[
   {t:"Bend 2 → 3 over the I chord",how:"Bend a whole step until the note matches the 3rd. Check against the triad note first.",gen:v=>{const k=K(v),x=near(k,0,1,8),t=x.notes.find(n=>n.role==="3"),bf=bendFrom(t,k);return {key:k,ch:[0,0],bars:[[nt(t,Q),R(Q),{s:bf.s,f:bf.f,d:H,b:bf.b,v:1}],[{s:bf.s,f:bf.f,d:H,b:bf.b,bt:"r"},nt(x.notes[0],H,{v:1})]],info:SETS[1]};}},
   {t:"Bend into each top note",how:"Over each chord, bend up into its top note and hold with vibrato.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,8);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2],bf=bendFrom(t,k);return bf?[{s:bf.s,f:bf.f,d:H+Q,b:bf.b,v:1},nt(x.notes[1],Q)]:[nt(t,H+Q,{v:1}),nt(x.notes[1],Q)];}),info:SETS[1]};}},
   {t:"Pre-bend and release",how:"Bend silently first, pick, then release down. A falling, crying sound.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,8);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2],bf=bendFrom(t,k);return bf?[{s:bf.s,f:bf.f,d:H,b:bf.b,bt:"p"},nt(x.notes[1],Q),nt(x.notes[0],Q)]:[nt(t,H),nt(x.notes[1],Q),nt(x.notes[0],Q)];}),info:SETS[1]};}}]},
 {id:"4.4",t:"Double stops from triads",
  what:"Play two notes of a triad together, usually the top two.",
  why:"Double stops sound fuller than single notes but lighter than chords: the classic sound of rock, country and soul leads.",
  ex:[
   {t:"Top two notes through the progression",how:"Strike the top pair of each nearest triad, let it ring.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[dbl(x,Q+E),dbl(x,E),dbl(x,H,{v:1})]),info:SETS[1]};}},
   {t:"Slide the pair",how:"Slide each double stop in from below.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[dbl(x,H,{sl:1}),nt(x.notes[0],Q),R(Q)]),info:SETS[1]};}},
   {t:"Pairs and single notes",how:"Double stop on the beat, single note answer.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[dbl(x,Q,{ac:1}),nt(x.notes[0],E),nt(nb(x.notes[0],k,1),E),dbl(x,H,{v:1})]),info:SETS[1]};}}]},
 {id:"4.5",t:"Vibrato and space",
  what:"Hold target notes long with different vibratos and leave silence after them.",
  why:"Space lets the listener hear what you just said. Vibrato is your voice: wide for intensity, delayed for tenderness.",
  ex:[
   {t:"Normal, wide, delayed",how:"The same top note three ways, with a rest after each.",gen:v=>{const k=K(v),x=near(k,0,1,8),t=x.notes[2];return {key:k,ch:[0,0,0],bars:[[nt(t,H,{v:1}),R(H)],[nt(t,H,{v:2}),R(H)],[nt(t,W,{v:3})]],info:SETS[1]};}},
   {t:"One note per chord, lots of space",how:"A single long note per chord with a breath after it. Make each note count.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,8);return {key:k,ch,bars:vs.map((x,i)=>[nt(x.notes[i%2?1:2],H+Q,{v:i%3+1}),R(Q)]),info:SETS[1]};}}]}]},

{n:5,t:"Phrases with triads",goal:"Turn triad material into phrases: questions and answers, motifs and climbs.",lessons:[
 {id:"5.1",t:"Call and response",
  what:"Two bars ask a question (end on the 5th or the 3rd, up high), two bars answer it (end low, on the root).",
  why:"A conversation is the easiest structure to hear. It gives your solo shape even if every note is simple.",
  ex:[
   {t:"Up asks, down answers",how:"Bars 1-2 climb and end on a top note; bars 3-4 come down and end on a root.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:[[...arp(vs[0],[0,1,2],E),nt(vs[0].notes[2],DQ,{v:1}),R(Q)],[...arp(vs[1],[1,2],Q),nt(vs[1].notes[2],H,{v:1})],[...arp(vs[2],[2,1,0],E),nt(vs[2].notes[0],DQ),R(Q)],[...arp(vs[3],[2,1],Q),nt(vs[3].notes[0],H,{v:1})]].map(b=>b.filter(n=>n.d>0)),info:SETS[1]};}},
   {t:"Answer with neighbours",how:"The response circles its last note with neighbours before landing.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);const r0=vs[3].notes[0];return {key:k,ch,bars:[[...arp(vs[0],[0,1,2,1],Q)],[nt(vs[1].notes[2],W-Q,{v:1}),R(Q)],[...arp(vs[2],[2,1],Q),nt(nb(r0,k,1),E),{s:r0.s,f:r0.f-1,d:E},R(Q)],[nt(r0,W,{v:3})]],info:SETS[1]};}}]},
 {id:"5.2",t:"Move one idea through the chords",
  what:"Keep the same pattern of shape notes and rhythm, and apply it to each chord's triad in turn.",
  why:"Repetition with changing harmony is one of the most satisfying sounds in music: the idea stays, the chords colour it differently.",
  ex:[
   {t:"Idea A: low-high-middle",how:"One small pattern, repeated on every chord's nearest triad.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[nt(x.notes[0],E),nt(x.notes[2],E),nt(x.notes[1],Q,{v:1}),R(Q),nt(x.notes[2],Q)]),info:SETS[1]};}},
   {t:"Idea B: with a neighbour",how:"Top note, its upper neighbour, back, then the middle note. Same on each chord.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>{const t=x.notes[2];return [nt(t,E),nt(nb(t,k,1),E),nt(t,E),nt(x.notes[1],E),nt(x.notes[1],H,{v:1})];}),info:SETS[1]};}},
   {t:"Idea C: syncopated",how:"The same three notes starting off the beat.",gen:v=>{const k=K(v),ch=P4(v+2),vs=chain(k,ch,2,7);return {key:k,ch,bars:vs.map(x=>[R(E),nt(x.notes[1],E),nt(x.notes[2],Q,{ac:1}),nt(x.notes[0],E),nt(x.notes[1],DQ,{v:1})]),info:SETS[2]};}}]},
 {id:"5.3",t:"Same idea, new string set",
  what:"Play a short triad phrase on strings 2-3-4, then the same phrase on 1-2-3.",
  why:"Moving an idea to a higher set raises the energy without inventing new material. It's how solos build.",
  ex:[
   {t:"Lower set, then higher",how:"Bars 1-2 on strings 2-3-4, bars 3-4 the same idea on 1-2-3.",gen:v=>{const k=K(v),ch=P4(v),lo=chain(k,ch,2,6),hi=chain(k,ch,1,8);const idea=x=>[nt(x.notes[0],E),nt(x.notes[1],E),nt(x.notes[2],Q,{v:1}),R(Q),nt(x.notes[1],Q)];return {key:k,ch,bars:[idea(lo[0]),idea(lo[1]),idea(hi[2]),idea(hi[3])],info:"strings 2-3-4, then 1-2-3"};}}]},
 {id:"5.4",t:"Single notes and triad stabs",
  what:"Alternate a single-note line with short triad stabs at the chord changes.",
  why:"Mixing melody and harmony makes one guitar sound like two. Stabs mark the changes; the line carries the tune.",
  ex:[
   {t:"Stab, then a line",how:"Triad stab on beat 1, then a short line from the same shape.",gen:v=>{const k=K(v),ch=P4(v),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map(x=>[blk(x,E,{ac:1}),R(E),nt(x.notes[2],E),nt(nb(x.notes[2],k,1),E),nt(x.notes[2],E),nt(x.notes[1],E),nt(x.notes[0],Q)]),info:SETS[1]};}},
   {t:"Line, then a stab on the push",how:"A line through the bar, and the next chord stabbed half a beat early.",gen:v=>{const k=K(v),ch=P4(v+1),vs=chain(k,ch,1,7);return {key:k,ch,bars:vs.map((x,i)=>[...arp(x,[0,1,2,1,0,1],E),R(E),blk(vs[(i+1)%4],E,{ac:1,st:1})]),info:SETS[1]};}}]},
 {id:"5.5",t:"Climb through the inversions",
  what:"Over one or two chords, climb from the low inversion to the high one, getting busier as you go.",
  why:"Rising pitch plus more notes is the sound of building tension: the middle of a solo heading for its peak.",
  ex:[
   {t:"Build over the I chord",how:"Quarter notes on the first shape, eighths on the second, triplets on the third, then hold the top.",gen:v=>{const k=K(v),L=invUp(k,0,1,3);return {key:k,ch:[0,0,0,0],bars:[arp(L[0],[0,1,2,1],Q),arp(L[1],[0,1,2,1,0,1,2,1],E),arp(L[2],[0,1,2,1,0,1,2,1,0,1,2,1],T3),[nt(L[2].notes[2],W,{v:2,ac:1})]],info:SETS[1]};}}]}]},

{n:6,t:"Full solo studies",goal:"Put it all together in complete solos, then write your own.",lessons:[
 {id:"6.1",t:"8-bar study: simple",
  what:"An 8-bar solo using only triad notes, top-note melody and neighbours.",
  why:"It shows how far simple tools go. Learn it, then change one thing per bar to make it yours.",
  ex:[{t:"Study 1",how:"Learn bars 1-4, then 5-8, then the whole thing with the band.",gen:v=>{const k=K(v),ch=[...P4(v),...P4(v)],vs=chain(k,ch,1,7);const b=vs.map((x,i)=>{const t=x.notes[2];switch(i%4){case 0:return [nt(t,H+Q,{v:1}),R(Q)];case 1:return [nt(t,E),nt(nb(t,k,1),E),nt(t,Q),nt(x.notes[1],H,{v:1})];case 2:return arp(x,[2,1,0,1],Q);default:return [nt(x.notes[1],E),nt(t,DQ+Q,{v:1}),R(Q)];}});b[7]=[nt(vs[7].notes.find(n=>n.role==="R")||vs[7].notes[0],W,{v:3})];return {key:k,ch,bars:b,info:SETS[1]};}}]},
 {id:"6.2",t:"8-bar study: expressive",
  what:"The same idea with hammer-ons, slides, bends, double stops and an enclosure.",
  why:"Expression turns correct notes into music. Compare it with Study 1: same skeleton, different voice.",
  ex:[{t:"Study 2",how:"Slow it down until every bend is in tune, then bring the tempo up.",gen:v=>{const k=K(v),ch=[...P4(v),...P4(v)],vs=chain(k,ch,1,8);const b=vs.map((x,i)=>{const t=x.notes[2],t3=x.notes.find(n=>n.role==="3");switch(i){
   case 0:return [nt(t,H,{sl:1,v:1}),nt(x.notes[1],Q),R(Q)];
   case 1:return [nt(nb(t3,k,-1),E),nt(t3,DQ,{h:1}),dbl(x,H,{v:1})];
   case 2:{const bf=bendFrom(t,k);return bf?[{s:bf.s,f:bf.f,d:H+Q,b:bf.b,v:1},R(Q)]:[nt(t,H+Q,{v:1}),R(Q)];}
   case 3:{const nx=vs[4].notes[2];return [...arp(x,[2,1,0],E),R(E+Q),nt(nb(nx,k,1),E),{s:nx.s,f:nx.f-1,d:E}];}
   case 4:return [nt(t,Q,{ac:1}),nt(nb(t,k,1),E),nt(t,E),dbl(x,H,{v:2})];
   case 5:return [blk(x,E,{ac:1,st:1}),R(E),...arp(x,[0,1,2,1],E),nt(t,Q)];
   case 6:{const bf=bendFrom(t,k);return bf?[{s:bf.s,f:bf.f,d:H,b:bf.b,bt:"r"},nt(x.notes[1],Q),nt(x.notes[0],Q)]:[nt(t,H),nt(x.notes[1],Q),nt(x.notes[0],Q)];}
   default:return [nt(x.notes.find(n=>n.role==="R")||x.notes[0],W,{v:3})];}});return {key:k,ch,bars:b,info:SETS[1]};}}]},
 {id:"6.3",t:"16-bar solo study",
  what:"A full solo in four phrases: a quiet statement, an answer, a climb through inversions, and a resolution to the root.",
  why:"It's the same story arc Solo Builder uses, played entirely with triad tools, so you can hear the whole method working.",
  ex:[{t:"Study 3",how:"Learn one phrase (4 bars) at a time. Then play it all with the band at a slow tempo.",gen:v=>{const k=K(v),p=P4(v),ch=[...p,...p,p[0],p[1],p[2],4,p[0],p[1],4,0];const lo=chain(k,ch,2,6),hi=chain(k,ch,1,9);
   const b=ch.map((c,i)=>{const L=i<8?lo:hi,x=L[i],t=x.notes[2];
     if(i<4)return i%2===0?[nt(x.notes[1],E),nt(t,DQ+Q,{v:1}),R(Q)]:[R(H),nt(x.notes[0],Q),nt(x.notes[1],Q)];
     if(i<8)return [nt(t,E),nt(nb(t,k,1),E),nt(t,Q),nt(x.notes[1],Q),nt(x.notes[0],Q,{v:1})];
     if(i===8)return arp(x,[0,1,2,1,0,1,2,1],E);
     if(i===9)return arp(x,[0,1,2,1,0,1,2,1,0,1,2,1],T3);
     if(i===10){const bf=bendFrom(t,k);return bf?[{s:bf.s,f:bf.f,d:W,b:bf.b,v:2,ac:1}]:[nt(t,W,{v:2,ac:1})];}
     if(i===11){const t3=x.notes.find(n=>n.role==="3");return [...arp(x,[2,1,0,1],E),nt(t3,H,{v:1})];}
     if(i===12)return [dbl(x,Q,{ac:1}),nt(x.notes[0],E),nt(nb(x.notes[0],k,1),E),dbl(x,H,{v:1})];
     if(i===13)return arp(x,[2,1,0,1,2,1,0,1],E);
     if(i===14)return [nt(t,Q),nt(x.notes[1],Q),nt(x.notes[0],H,{v:1})];
     return [nt(x.notes.find(n=>n.role==="R")||x.notes[0],W,{v:3})];});return {key:k,ch,bars:b,info:"strings 2-3-4, then 1-2-3"};}}]},
 {id:"6.4",t:"Your turn",
  what:"Open Solo Builder with today's key and shape and write your own solo using triads: the skeleton, triad stabs, neighbours, enclosures and bends.",
  why:"Learning sticks when you make something with it. Your solo is saved and checked like any other.",
  ex:[],turn:true}]}];

/* this file is now a library: the Soloing Course (soloing-course.js) uses its helpers and triad lessons */
window.TRIAD_COURSE={C,voicings,chain,invUp,near,nt,R,blk,dbl,arp,nb,bendFrom,K,P4,prog,pcsOf,inScale,SETS,INV,W,H,DQ,Q,E,T3,S16};
})();
