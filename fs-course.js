/* Guitar Studio · Fingerstyle Solo course data, shared by fingerstyle.html (the trainer) and studio.html (the hub).
   A standalone solo fingerstyle course: thumb on the bass, fingers on the melody and chord, all from the strings
   (no body percussion). Lesson ids from the first version are kept so progress already ticked carries over.

   Chords: frets from low E to high e (null = not played). r = root bass [string, fret], a = alternate bass, cl = closed shape.
   Names in brackets are shapes for another tuning: (dd) drop D, (dg) DADGAD. The bracket is hidden on screen.

   Pattern lessons ("pat"): "beat:parts" steps, beats counted from 1, parts joined by "+".
     B root bass · A alternate bass · Bm / Am muted (palm on the bass strings) · 1–4 that string of the chord
     W walking bass note into the next chord · 3h hammer-on · 2p pull-off · 3/ slide up · <12>4 natural harmonic
     s@f an exact string and fret (e.g. 5@2), with ! to mark it as melody (e.g. 1@3!)
     "|" between patterns = one pattern per bar, in turn.  pat2 = pattern for every second bar.
   Song lessons ("mel"): "note:beats" per bar ("|" between bars, r = rest); "ch" chords per bar ("," = two in a bar, "-" = none).
     style: mel (melody alone) · one (root once per chord) · bass (root on 1 and 3) · alt (alternating bass every beat) · full (bass + chord fills)
     tr = transpose the melody by semitones.  tune: dd drop D, dg DADGAD.  swing: off-beat eighths played long-short.
   Task lessons ("task"): steps to do away from the tab (arranging your own tune, performing).
   Newer marks in patterns: .p .i .m .a after a part = which finger plucks · ' after a part = short, stopped note ·
     ! after a chord string (e.g. 1!) = that note is the melody voice, louder · s@f~ vibrato · s@f_ let it ring ·
     s@fh / s@fp / s@f/ = reached by hammer-on, pull-off or slide · <ah>s = artificial harmonic on the chord's note.
   vars: a lesson's exercises written out one by one ({tag,vt,prog,pat}) · capos: the same lesson with a capo on each fret.
   how: custom practice steps · sig: time signature label (6/8) · boxes: show chord diagrams. */
(function(){
"use strict";
const X=null;
const TUNINGS={std:{n:"Standard",o:{1:64,2:59,3:55,4:50,5:45,6:40}},dd:{n:"Drop D",o:{1:64,2:59,3:55,4:50,5:45,6:38}},dg:{n:"DADGAD",o:{1:62,2:57,3:55,4:50,5:45,6:38}}};
const CH={
  C:{f:[X,3,2,0,1,0],r:[5,3],a:[4,2]}, G:{f:[3,2,0,0,0,3],r:[6,3],a:[4,0]}, Am:{f:[X,0,2,2,1,0],r:[5,0],a:[4,2]},
  Em:{f:[0,2,2,0,0,0],r:[6,0],a:[4,2]}, D:{f:[X,X,0,2,3,2],r:[4,0],a:[5,0]}, Dm:{f:[X,X,0,2,3,1],r:[4,0],a:[5,0]},
  E:{f:[0,2,2,1,0,0],r:[6,0],a:[4,2]}, A:{f:[X,0,2,2,2,0],r:[5,0],a:[4,2]}, E7:{f:[0,2,0,1,0,0],r:[6,0],a:[4,0]},
  A7:{f:[X,0,2,0,2,0],r:[5,0],a:[4,2]}, D7:{f:[X,X,0,2,1,2],r:[4,0],a:[5,0]}, G7:{f:[3,2,0,0,0,1],r:[6,3],a:[4,0]},
  C7:{f:[X,3,2,3,1,0],r:[5,3],a:[4,2]}, Fmaj7:{f:[X,X,3,2,1,0],r:[4,3],a:[5,0]}, B7:{f:[X,2,1,2,0,2],r:[5,2],a:[4,1]},
  // closed (barre) shapes
  F:{f:[1,3,3,2,1,1],r:[6,1],a:[4,3],cl:1}, "G(3)":{f:[3,5,5,4,3,3],r:[6,3],a:[4,5],cl:1}, "Am(5)":{f:[5,7,7,5,5,5],r:[6,5],a:[4,7],cl:1},
  Bb:{f:[X,1,3,3,3,1],r:[5,1],a:[4,3],cl:1}, "C(3)":{f:[X,3,5,5,5,3],r:[5,3],a:[4,5],cl:1}, "D(5)":{f:[X,5,7,7,7,5],r:[5,5],a:[4,7],cl:1},
  "Dm(5)":{f:[X,5,7,7,6,5],r:[5,5],a:[4,7],cl:1}, Bm:{f:[X,2,4,4,3,2],r:[5,2],a:[4,4],cl:1}, "F#m":{f:[2,4,4,2,2,2],r:[6,2],a:[4,4],cl:1},
  // drop D (low string tuned down to D)
  "D(dd)":{f:[0,0,0,2,3,2],r:[6,0],a:[4,0]}, "G(dd)":{f:[5,X,0,0,0,3],r:[6,5],a:[4,0]}, "A(dd)":{f:[X,0,2,2,2,0],r:[5,0],a:[4,2]},
  // DADGAD
  "D5(dg)":{f:[0,0,0,2,0,0],r:[6,0],a:[4,0]}, "G(dg)":{f:[5,X,0,0,0,0],r:[6,5],a:[4,0]}, "A7sus(dg)":{f:[X,0,2,0,0,0],r:[5,0],a:[4,2]},
};

/* melodies used more than once */
const TWINKLE="A3:1 A3:1 E4:1 E4:1|F#4:1 F#4:1 E4:2|D4:1 D4:1 C#4:1 C#4:1|B3:1 B3:1 A3:2|E4:1 E4:1 D4:1 D4:1|C#4:1 C#4:1 B3:2|E4:1 E4:1 D4:1 D4:1|C#4:1 C#4:1 B3:2|A3:1 A3:1 E4:1 E4:1|F#4:1 F#4:1 E4:2|D4:1 D4:1 C#4:1 C#4:1|B3:1 B3:1 A3:2",
  TWINKLE_CH="A|D,A|D,A|E,A|A,D|A,E|A,D|A,E|A|D,A|D,A|E,A",
  ODE="E4:1 E4:1 F4:1 G4:1|G4:1 F4:1 E4:1 D4:1|C4:1 C4:1 D4:1 E4:1|E4:1.5 D4:.5 D4:2|E4:1 E4:1 F4:1 G4:1|G4:1 F4:1 E4:1 D4:1|C4:1 C4:1 D4:1 E4:1|D4:1.5 C4:.5 C4:2",
  ODE_CH="C|G7|C|C,G7|C|G7|C|G7,C",
  GRACE="r:2 G3:1|C4:2 E4:.5 C4:.5|E4:2 D4:1|C4:2 A3:1|G3:2 G3:1|C4:2 E4:.5 C4:.5|E4:2 D4:1|G4:3|G4:2 E4:1|G4:2 E4:.5 C4:.5|E4:2 D4:1|C4:2 A3:1|G3:2 G3:1|C4:2 E4:.5 C4:.5|E4:2 D4:1|C4:3",
  GRACE_CH="-|C|C7|Fmaj7|C|C|G|G|G7|C|C7|Fmaj7|C|C|G7|C",
  GREEN="r:2 A3:1|C4:2 D4:1|E4:1.5 F4:.5 E4:1|D4:2 B3:1|G3:1.5 A3:.5 B3:1|C4:2 A3:1|A3:1.5 G#3:.5 A3:1|B3:2 G#3:1|E3:2 A3:1|C4:2 D4:1|E4:1.5 F4:.5 E4:1|D4:2 B3:1|G3:1.5 A3:.5 B3:1|C4:1.5 B3:.5 A3:1|G#3:1.5 F#3:.5 G#3:1|A3:3",
  GREEN_CH="-|Am|C|G|Em|Am|E|E|E|Am|C|G|Em|Am|E|Am",
  AULD="r:3 G3:1|C4:1.5 C4:.5 C4:1 E4:1|D4:1.5 C4:.5 D4:1 E4:.5 D4:.5|C4:1.5 C4:.5 E4:1 G4:1|A4:3 A4:1|G4:1.5 E4:.5 E4:1 C4:1|D4:1.5 C4:.5 D4:1 E4:.5 D4:.5|C4:1.5 A3:.5 A3:1 G3:1|C4:4",
  AULD_CH="-|C|G7|C|Fmaj7|C|G7|Fmaj7,G7|C",
  SUSANNA="r:3 C4:.5 D4:.5|E4:1 G4:1 G4:1.5 A4:.5|G4:1 E4:1 C4:1.5 D4:.5|E4:1 E4:1 D4:1 C4:1|D4:3 C4:.5 D4:.5|E4:1 G4:1 G4:1.5 A4:.5|G4:1 E4:1 C4:1.5 D4:.5|E4:1 E4:1 D4:1 D4:1|C4:4|F4:2 F4:2|A4:1 A4:2 A4:1|G4:1 G4:1 E4:1 C4:1|D4:3 C4:.5 D4:.5|E4:1 G4:1 G4:1.5 A4:.5|G4:1 E4:1 C4:1.5 D4:.5|E4:1 E4:1 D4:1 D4:1|C4:4",
  SUSANNA_CH="-|C|C|C|G7|C|C|G7|C|Fmaj7|Fmaj7|C|G7|C|C|G7|C",
  SILENT="G3:1.5 A3:.5 G3:1|E3:3|G3:1.5 A3:.5 G3:1|E3:3|D4:2 D4:1|B3:3|C4:2 C4:1|G3:3|A3:2 A3:1|C4:1.5 B3:.5 A3:1|G3:1.5 A3:.5 G3:1|E3:3|A3:2 A3:1|C4:1.5 B3:.5 A3:1|G3:1.5 A3:.5 G3:1|E3:3|D4:2 D4:1|F4:1.5 D4:.5 B3:1|C4:3|E4:3|C4:1.5 G3:.5 E3:1|G3:1.5 F3:.5 D3:1|C3:3",
  SILENT_CH="C|C|C|C|G7|G7|C|C|Fmaj7|Fmaj7|C|C|Fmaj7|Fmaj7|C|C|G7|G7|C|C|C|G7|C",
  MINUET="D4:1 G3:.5 A3:.5 B3:.5 C4:.5|D4:1 G3:1 G3:1|E4:1 C4:.5 D4:.5 E4:.5 F#4:.5|G4:1 G3:1 G3:1|C4:1 D4:.5 C4:.5 B3:.5 A3:.5|B3:1 C4:.5 B3:.5 A3:.5 G3:.5|F#3:1 G3:.5 A3:.5 B3:.5 G3:.5|A3:3|D4:1 G3:.5 A3:.5 B3:.5 C4:.5|D4:1 G3:1 G3:1|E4:1 C4:.5 D4:.5 E4:.5 F#4:.5|G4:1 G3:1 G3:1|C4:1 D4:.5 C4:.5 B3:.5 A3:.5|B3:1 C4:.5 B3:.5 A3:.5 G3:.5|A3:1 B3:.5 A3:.5 G3:.5 F#3:.5|G3:3",
  MINUET_CH="G|G|C|G|C|G|D|D|G|G|C|G|C|G|D|G";
const T_AR="1:B+1 1.5:3 2:A 2.5:2 3:B+1 3.5:3 4:A 4.5:2"; // Travis with pinches on 1 and 3

/* Level 0 chord changes: every pair of open shapes that live together in a key (each pair once, in the first key
   that uses it), then the everyday progressions that string those changes together. */
const KEYSETS=[["C",["C","G","Am","Fmaj7","Dm","Em","G7"]],["G",["G","C","D","Em","Am","D7","Bm7"]],["D",["D","G","A","Bm7","Em","A7"]],
  ["A",["A","D","E","E7","Bm7"]],["E",["E","A","B7"]],["A minor",["Am","Dm","E","E7","C","G","Fmaj7"]],["E minor",["Em","Am","C","D","G","B7"]]];
const CHG=[],seenPair=new Set();
KEYSETS.forEach(([k,cs],i)=>{const pairs=[];
  for(let a=0;a<cs.length;a++)for(let b=a+1;b<cs.length;b++){const key=[cs[a],cs[b]].sort().join("|");if(seenPair.has(key))continue;seenPair.add(key);pairs.push([cs[a],cs[b]]);}
  if(pairs.length)CHG.push({id:"c"+(i+1),t:`Changes in ${k}`,pairs,scan:1,free:1,meter:4,tempo:[40,40],
    w:`Every change between the open shapes of ${k}${i?" not already covered in an earlier key":""}: ${pairs.length} pairs. Two bars on the first shape, string by string, then two bars on the second, round and round.`,
    tip:i?"Before pressing Play, change between the two shapes ten times in silence: lift, move, land all fingers together. Then let the plucking keep you in time.":"Look for a finger that can stay put or slide: C to Am keeps fingers 1 and 2 where they are. Lift and land the other fingers together, as one movement, while the last note of the old chord still rings."});});
CHG.push(
 {id:"p1",t:"Three-chord songs: I–IV–V",progs:[["C","C|Fmaj7|G7|C"],["G","G|C|D7|G"],["D","D|G|A7|D"],["A","A|D|E7|A"],["E","E|A|B7|E"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"Home, away and back: the three chords behind folk songs, bhajans, Bihu tunes and the blues. One bar on each chord, so the change now comes every bar.",tip:"With one bar per chord you reach only the top strings before changing. Start moving the left hand on beat 4; the old note can ring while you go."},
 {id:"p2",t:"The pop loop: I–V–vi–IV",progs:[["C","C|G|Am|Fmaj7"],["G","G|D|Em|C"],["D","D|A|Bm7|G"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"The four chords under countless modern songs, in every key it fits on open shapes.",tip:"Say the chord names out loud one beat before each change. Knowing what comes next is half the change."},
 {id:"p3",t:"The fifties loop: I–vi–IV–V",progs:[["C","C|Am|Fmaj7|G"],["G","G|Em|C|D"],["D","D|Bm7|G|A"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"The doo-wop and old film-song loop. Same chords as the pop loop in a different order, so the changes feel new.",tip:"In C, Am to Fmaj7 is a small move: the first finger stays on the B string, fret 1."},
 {id:"p4",t:"Minor loops",progs:[["Am","Am|G|Fmaj7|E"],["Am ii–V","Am|Dm|E7|Am"],["Em","Em|C|G|D"],["Em ii–V","Em|Am|B7|Em"],["Dm","Dm|C|A7|Dm"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"The sad, dramatic side: minor keys with the major V chord that pulls back home.",tip:"The falling Am–G–Fmaj7–E loop is one of the most used in all of music. Listen to the bass step down under the shapes."},
 {id:"p5",t:"Jazz turn: ii–V–I with sevenths",progs:[["C","Dm7|G7|Cmaj7|C"],["G","Am7|D7|Gmaj7|G"],["D","Em7|A7|Dmaj7|D"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"Seventh chords chained the way jazz and old ghazal accompaniments use them. The shapes from lessons s3 to s5, now in motion.",tip:"Dm7 to G7 to Cmaj7: notice how few fingers really move. Find the shortest path for each one."},
 {id:"p6",t:"Circle of dominants",progs:[["to G","E7|A7|D7|G"],["to C","A7|D7|G7|C"]],scan:1,free:1,meter:4,tempo:[40,40],
  w:"Each seven-chord pulls into the next, round the circle home: the ragtime and old-song sound the blues lessons use later.",tip:"All seventh shapes, all changing every bar: the hardest drill of Level 0. Take it as slowly as you like."});
/* Warm-up chord chain: every open shape from lessons s1–s5 in one logical order (falling fifths, ii–V–I,
   relative minors, the circle of dominants), each chord held for REP bars of p-i-m-a, then on to the next on its own.
   Part 1 ends on D, which leads back to Em, so the parts join into one unbroken full chain. */
const REP=2,CHAIN=[
  ["Part 1 · open minors and majors",["Em","Am","Dm","G","C","Am","E","A","D"]],
  ["Part 2 · Em to B7, round the sevenths",["Em","B7","E7","A7","D7","G7","C7","Fmaj7"]],
  ["Part 3 · m7 and maj7 colours",["Cmaj7","Am7","Dm7","G7","Gmaj7","Em7","Bm7","E7","Amaj7","Dmaj7","Emaj7"]]];
const WARMUP={id:"wu",t:`Warm-up: the chord chain (each chord ${REP} bars)`,chain:CHAIN,rep:REP,free:1,meter:4,tempo:[60,60],pat:"1:B 2:3 3:2 4:1",
  w:`Every open shape you have learned, in a logical order where each chord leads naturally to the next: Em, Am, Dm, G, C… through B7 and the seventh chords to the m7 and maj7 colours. Each chord is played ${REP} times, one bar each: thumb on the root, then i, m, a up the G, B and high e strings. After the second bar the next chord comes on its own, so the left hand learns to find shapes in time and the right hand keeps going without a break. Use a part as a short warm-up, or the full chain on longer days.`,
  tip:"The on-screen line under the Play button shows the chord you are on, which of its two bars, and the chord coming next. Start moving the left hand while the a finger plays beat 4 of the second bar, and land all fingers together on beat 1."};
/* ===================== Generated exercises for the newer lessons =====================
   Exact notes are written as s@f tokens (string@fret), "!" = melody voice, ".i/.m/.a/.p" = which finger plucks. */
CH.Bm7=CH.Bm7||{f:[X,2,0,2,0,2],r:[5,2],a:[4,0]};
const OPEN={1:64,2:59,3:55,4:50,5:45,6:40},PCN={C:0,"C#":1,Db:1,D:2,Eb:3,E:4,F:5,"F#":6,G:7,Ab:8,A:9,Bb:10,B:11};
const MAJ=[0,2,4,5,7,9,11],NMIN=[0,2,3,5,7,8,10];
const bt=x=>String(+(1+x).toFixed(3)); // beat label from a 0-based offset in the bar
const dashes=n=>Array(n).fill("-").join("|");
const inScale=(m,root,iv)=>iv.includes(((m-root)%12+12)%12);
/* lay a list of steps (each a "+"-joined chord of tokens, or "" for a rest) into bars of `per` steps per bar */
function bars(steps,per,meter){const out=[];for(let i=0;i<steps.length;i+=per){const b=[];
    steps.slice(i,i+per).forEach((x,j)=>{if(x)b.push(bt(j*meter/per)+":"+x);});out.push(b.join(" ")||"1:r");}
  return out;}
/* the scale on the G, B and high e strings, frets 0–5, lowest fret first (open position) */
function topPos(m){let best=null;for(const s of [3,2,1]){const f=m-OPEN[s];if(f>=0&&f<=5&&(!best||f<best.f))best={s,f};}return best;}
function scaleRun(start,root,iv){const up=[];for(let m=start;up.length<8;m++)if(inScale(m,root,iv))up.push(m);return up;}
/* scale over chords (after "Fingerstyle Scales"): each scale note as a pinch with the chord's bass, and with full=1 the
   chord notes that sit BELOW the melody note (rule 1: nothing higher than the melody) */
function overChord(run,c,full){const rs=c.r[0];
  const one=m=>{const p=topPos(m);let t=["B",`${p.s}@${p.f}!`];
    if(full){const fill=[];for(let s=p.s+1;s<rs&&s<=3&&fill.length<2;s++){const f=c.f[6-s];if(f==null)continue;if(OPEN[s]+f<m)fill.push(`${s}@${f}`);}t=t.concat(fill);}
    return t.join("+");};
  const up=run.map(one),down=run.slice().reverse().map(one);return up.concat(down);}
const SVK=[{k:"G",root:7,start:55,top:"G to G",ch:{I:"G",ii:"Am",iii:"Bm7",IV:"C",V:"D",vi:"Em"}},
  {k:"C",root:0,start:55,top:"G to G (the 5th to the 5th)",ch:{I:"C",ii:"Dm",iii:"Em",IV:"Fmaj7",V:"G",vi:"Am"}},
  {k:"D",root:2,start:57,top:"A to A (the 5th to the 5th)",ch:{I:"D",ii:"Em",IV:"G",V:"A",vi:"Bm7"}},
  {k:"A",root:9,start:57,top:"A to A",ch:{I:"A",ii:"Bm7",IV:"D",V:"E"}},
  {k:"E",root:4,start:56,top:"G♯ to G♯ (the 3rd to the 3rd)",ch:{I:"E",IV:"A",V:"B7"}}];
function svVars(deg,full){return SVK.filter(K=>K.ch[deg]).map(K=>{const c=K.ch[deg],run=scaleRun(K.start,K.root,MAJ),st=overChord(run,CH[c],full);
  return {tag:K.k,vt:`${K.k} major · over ${c}`,key:K.k,prog:Array(4).fill(c).join("|"),pat:bars(st,4,4).join("|"),boxes:1};});}
/* the scale harmonised: each melody note over a chord of the key that contains it */
function svHarm(){return SVK.filter(K=>K.ch.IV&&K.ch.V).map(K=>{const run=scaleRun(K.start,K.root,MAJ),seq=run.concat(run.slice().reverse());
  const degOf=m=>MAJ.indexOf(((m-K.root)%12+12)%12),pick=d=>[["I"],["V","ii"],["I","vi"],["IV","ii"],["I","V"],["IV","vi","ii"],["V","iii"]][d].find(x=>K.ch[x]);
  const chs=seq.map(m=>K.ch[pick(degOf(m))]),st=seq.map((m,i)=>overChord([m],CH[chs[i]],1)[0]);
  const prog=[];for(let i=0;i<chs.length;i+=4)prog.push(chs.slice(i,i+4).join(","));
  return {tag:K.k,vt:`${K.k} major`,key:K.k,prog:prog.join("|"),pat:bars(st,4,4).join("|"),boxes:1};});}
/* minor scale over its chords (natural minor) */
const MNK=[{k:"Am",root:9,start:57,ch:{i:"Am",iv:"Dm",v:"Em",VI:"Fmaj7",VII:"G"}},{k:"Em",root:4,start:55,ch:{i:"Em",iv:"Am",VI:"C",VII:"D"}}];
function mnVars(){const out=[];MNK.forEach(K=>{const run=scaleRun(K.start,K.root,NMIN);
  Object.entries(K.ch).forEach(([d,c])=>out.push({tag:`${K.k}-${d}`,vt:`${K.k.replace("m"," minor")} · over ${c}`,key:K.k,prog:Array(4).fill(c).join("|"),pat:bars(overChord(run,CH[c],1),4,4).join("|"),boxes:1}));});return out;}
/* right hand: alternating fingers on the open strings */
function openAlt(a,b){const fx=i=>i%2?b:a,str=s=>Array.from({length:8},(_,i)=>`${s}@0!.${fx(i)}`);
  const cross=[1,1,2,2,3,3,2,2].map((s,i)=>`${s}@0!.${fx(i)}`);return bars([...str(1),...str(2),...str(3),...cross],8,4).join("|");}
/* the G major scale, two octaves in open position, every note plucked by the two fingers in turn */
const G2OCT=[[6,3],[5,0],[5,2],[5,3],[4,0],[4,2],[4,4],[3,0],[3,2],[2,0],[2,1],[2,3],[1,0],[1,2],[1,3]];
function scale2(a,b,per){const seq=G2OCT.concat(G2OCT.slice(0,-1).reverse());return bars(seq.map(([s,f],i)=>`${s}@${f}!.${i%2?b:a}`),per,4);}
/* CAGED major-scale boxes (key of C: C shape frets 0–3, A 2–5, G 4–8, E 7–10, D 9–13), moved to every key */
const CAGED=[["C",0,3],["A",2,3],["G",4,4],["E",7,3],["D",9,4]];
function cagedBox(root,a,w){const pos=[],cnt={},ms=[];
  for(let m=40;m<=88;m++)if(inScale(m,root,MAJ))ms.push(m);
  let s=6;const fr=(m,s)=>m-OPEN[s],inW=(f,lo,hi)=>f>=lo&&f<=hi;
  for(const m of ms){if(s<1)break;const f=fr(m,s);
    if(pos.length===0&&f<a)continue; // below the box on the lowest string
    if(inW(f,a,a+w)&&(cnt[s]||0)<3){pos.push([s,f]);cnt[s]=(cnt[s]||0)+1;continue;}
    if(s>1&&inW(fr(m,s-1),a-1,a+w+1)){s--;pos.push([s,fr(m,s)]);cnt[s]=1;continue;}
    if(inW(f,a,a+w+1)){pos.push([s,f]);cnt[s]=(cnt[s]||0)+1;continue;}
    if(s===1)break;}
  return pos;}
function cagedVars(){const out=[],KS=["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  KS.forEach(K=>{const r=PCN[K];CAGED.forEach(([sh,a0,w])=>{let a=a0+r;if(a>12)a-=12;if(a+w>15)a-=12;if(a<0)a+=12;
    const box=cagedBox(r,a,w),seq=box.concat(box.slice(0,-1).reverse());
    out.push({tag:`${K}.${sh}`,vt:`${K} · ${sh} shape`,key:K,prog:"",pat:bars(seq.map(([s,f],i)=>`${s}@${f}!.${i%2?"m":"i"}`),8,4).join("|")});});});
  out.forEach(v=>{v.prog=dashes(v.pat.split("|").length);});return out;}
/* triads on the G, B and high e strings: the three inversions of each chord, lowest position first */
function triads(q){const iv=q==="m"?[0,3,7]:[0,4,7],KS=["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"],out=[];
  KS.forEach(K=>{const r=PCN[K],want=new Set(iv.map(x=>(r+x)%12)),found={};
    for(let lo=0;lo<=12;lo++)for(let a=lo;a<=lo+3;a++)for(let b=lo;b<=lo+3;b++)for(let c=lo;c<=lo+3;c++){if(Math.min(a,b,c)!==lo)continue;
      const ns=[55+a,59+b,64+c],pcs=ns.map(n=>n%12);if(new Set(pcs).size!==3||!pcs.every(p=>want.has(p)))continue;
      const inv=iv.indexOf(((pcs[0]-r)%12+12)%12);if(!(inv in found))found[inv]=[a,b,c];}
    const vs=Object.values(found).sort((x,y)=>Math.min(...x)-Math.min(...y));
    const bar=([a,b,c])=>`1:3@${a}!.i 1.5:2@${b}!.m 2:1@${c}!.a 2.5:2@${b}!.m 3:3@${a}+2@${b}+1@${c}!`;
    const last=`1:3@${vs[2][0]}+2@${vs[2][1]}+1@${vs[2][2]}! 2:3@${vs[1][0]}+2@${vs[1][1]}+1@${vs[1][2]}! 3:3@${vs[0][0]}+2@${vs[0][1]}+1@${vs[0][2]}!`;
    out.push({tag:K,vt:`${K}${q}`,key:K+q,prog:dashes(4),pat:[...vs.map(bar),last].join("|")});});
  return out;}
/* campanella: each scale step on a different string, so the notes ring into each other like a harp */
const CAMP=[[3,0],[4,7],[2,0],[3,5],[2,3],[1,0],[2,7],[1,3]];
function campVars(){const up=CAMP.map(([s,f])=>`${s}@${f}!_`),dn=CAMP.slice().reverse().map(([s,f])=>`${s}@${f}!_`);
  return [{tag:"q",vt:"Up and down · quarter notes",prog:dashes(4),pat:bars(up.concat(dn),4,4).join("|")},
    {tag:"e",vt:"Up and down · eighth notes",prog:dashes(2),pat:bars(up.concat(dn),8,4).join("|")},
    {tag:"b",vt:"Over a G bass",prog:"G|G|G|G",pat:bars(up.concat(dn).map((x,i)=>i%2?x:"B+"+x),4,4).join("|"),boxes:1}];}
const LEVELS=[
 {n:"Chord shapes, one string at a time",zero:1,d:"Before any picking pattern, get each chord shape into your fingers. Hold the shape and pluck its strings one by one, lowest to highest and back down, so you hear at once if a note is buzzing or dead. Then change between shapes in every key, and run the everyday progressions, all before the thumb-and-fingers work. No goal tempo here: set any speed you like on the slider and change it whenever you want.",ls:[
  {id:"s1",t:"Minor shapes: Em, Am, Dm",shapes:["Em","Am","Dm"],scan:1,free:1,meter:4,tempo:[40,40],w:"Place the shape, then pluck every string it uses, one at a time, from the lowest to the highest and back down. Thumb (p) plays the bass strings, i-m-a the G, B and high e. Every note should ring clearly: no buzz, no dead note.",tip:"A dead note means a finger is leaning on the next string. Arch the fingers, press with the very tips, and sit each tip just behind its fret."},
  {id:"s2",t:"Major shapes: E, A, D, C, G",shapes:["E","A","D","C","G"],scan:1,free:1,meter:4,tempo:[40,40],w:"The five open major shapes, each held for four bars while you pluck its strings one by one, up and back down. Strings marked X on the diagram are not played, and the plucking skips them.",tip:"A: three fingers crowd into fret 2. If the B string buzzes, angle the fingers slightly or try fingers 2-3-4. C and G: reach with the fingertips so the open strings between them ring."},
  {id:"s3",t:"Seventh chords: E7, A7, D7, G7, C7, B7",shapes:["E7","A7","D7","G7","C7","B7"],scan:1,free:1,meter:4,tempo:[40,40],w:"Each 7th chord is a shape you know with one note changed. Pluck string by string and listen for the extra note: it gives the chord its pull towards the next one.",tip:"Compare each with its plain chord first: E to E7 just lifts one finger. B7 is the stretch of the set. Place the second finger (A string, fret 2) first and build the shape around it."},
  {id:"s4",t:"Minor sevenths: Em7, Am7, Dm7, Bm7",shapes:["Em7","Am7","Dm7","Bm7"],scan:1,free:1,meter:4,tempo:[40,40],w:"Soft, open minor-7th sounds used all through the course (Bm7 stands in for the Bm barre in the key of D). Hold, pluck each string, listen.",tip:"Bm7 (x 2 0 2 0 2): finger 1 on the A string fret 2, finger 2 on the G string fret 2, finger 3 on the high e fret 2. The D and B strings ring open between them, so keep the fingers steep. The low E is not played."},
  {id:"s5",t:"Major sevenths: Cmaj7, Fmaj7, Gmaj7, Dmaj7, Amaj7, Emaj7",shapes:["Cmaj7","Fmaj7","Gmaj7","Dmaj7","Amaj7","Emaj7"],scan:1,free:1,meter:4,tempo:[40,40],w:"Dreamy major-7th shapes. Several are a familiar chord with one finger moved or lifted. String by string, up and down.",tip:"Cmaj7 is C with the first finger lifted. Fmaj7 is the easy F with no barre: fingers 3-2-1 on frets 3-2-1 of the D, G and B strings, high e open."},
  WARMUP,
  ...CHG,
 ]},
 {n:"Thumb and fingers",d:"Your thumb (p) owns the bass strings and your fingers own the top three: i on the G string, m on the B, a on the high e. Every later level is built on this division of labour.",ls:[
  {id:"1a",t:"Thumb on the bass",w:"Hold each chord and let your thumb play its root on every beat. The fingers rest lightly on the top three strings.",tip:"Rest your thumb on the next string after each stroke (a rest stroke) so the bass is even and full.",meter:4,prog:"C|Am|Em|G",pat:"1:B 2:B 3:B 4:B",tempo:[50,90]},
  {id:"1b",t:"p, i, m, a one at a time",w:"Thumb plays the root on beat 1, then the fingers pluck one string each on beats 2, 3 and 4: i on G, m on B, a on high e.",tip:"Keep each finger over its own string. Only the tip moves, curling into the palm.",meter:4,prog:"C|Am|Em|G",pat:"1:B 2:3 3:2 4:1",tempo:[50,90]},
  {id:"1c",t:"The pinch",w:"Thumb and ring finger pluck together on beat 1 (a pinch), then i and m answer, then i again.",tip:"Squeeze thumb and a towards each other like picking up a coin; both notes must start at exactly the same moment.",meter:4,prog:"C|G|Am|Em",pat:"1:B+1 2:3 3:2 4:3",tempo:[50,90]},
  {id:"1d",t:"Bass, then the chord together",w:"Thumb on beat 1, then i, m and a pluck the top three strings together on beat 2. Thumb plays the alternate bass on 3, fingers again on 4.",tip:"The three fingers move as one hand: think of closing a gentle fist.",meter:4,prog:"C|Am|D|G",pat:"1:B 2:3+2+1 3:A 4:3+2+1",tempo:[50,90]},
  {id:"1f",t:"Chord changes on the beat",w:"Bass, chord, bass, chord through eight bars of G, C, D and E minor. The right hand never stops while the left hand changes.",tip:"Start moving the left hand on beat 4. The open strings ringing for a moment while you change are fine; a gap in the rhythm is not.",meter:4,prog:"G|C|D|G|Em|C|D|G",pat:"1:B 2:3+2+1 3:A 4:3+2+1",tempo:[50,95]},
  {id:"1g",t:"Waltz time: bass, chord, chord",w:"Three beats to the bar: the thumb on ONE, the three fingers together on two and three. The accompaniment behind every waltz and many old film songs.",tip:"Make beat one a little heavier than two and three: OOM-pah-pah.",meter:3,prog:"C|Am|Dm|G7|C|Am|G7|C",pat:"1:B 2:3+2+1 3:3+2+1",tempo:[60,110]},
  {id:"1e",t:"p-i-m-a in eighth notes",w:"The basic arpeggio: thumb, then i, m, a one after the other in even eighth notes, twice in each bar (the second time from the alternate bass).",tip:"Say it out loud: thumb-i-m-a, thumb-i-m-a. Let every note ring into the next.",meter:4,prog:"C|Am|Em|G",pat:"1:B 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1",tempo:[50,90]},
 ]},
 {n:"Arpeggio patterns",d:"The rolling patterns behind ballads, film songs and classical studies. The left hand holds the chord; the right hand keeps a steady loop.",ls:[
  {id:"2a",t:"Up and back: p-i-m-a-m-i",w:"Six eighth notes to a bar of 3/4: thumb, then up through i-m-a and back down m-i. The classic waltz arpeggio.",tip:"Feel the bar as ONE-two-three with the thumb on ONE.",meter:3,prog:"Am|Dm|E|Am",pat:"1:B 1.5:3 2:2 2.5:1 3:2 3.5:3",tempo:[50,100]},
  {id:"2b",t:"Falling: p-a-m-i",w:"Thumb, then the fingers come down from the high e: a, m, i. Twice a bar.",tip:"Starting with a feels odd at first. Plant a on its string before the thumb plays.",meter:4,prog:"Am|C|G|Em",pat:"1:B 1.5:1 2:2 2.5:3 3:A 3.5:1 4:2 4.5:3",tempo:[50,90]},
  {id:"2c",t:"Rolling: p-i-m-i-a-i-m-i",w:"Eight eighth notes with i returning between every other finger. A smooth, flowing pattern heard under countless songs.",tip:"i works twice as hard here. Keep it relaxed and close to the string.",meter:4,prog:"C|Am|Fmaj7|G",pat:"1:B 1.5:3 2:2 2.5:3 3:1 3.5:3 4:2 4.5:3",tempo:[50,90]},
  {id:"2d",t:"Pinch and roll",w:"The rolling pattern with a pinch (thumb + a) on beats 1 and 3, which puts a little melody on top of the arpeggio.",tip:"Let the pinched top note sing slightly louder than the rest.",meter:4,prog:"C|Am|Fmaj7|G",pat:"1:B+1 1.5:3 2:2 2.5:3 3:A+1 3.5:3 4:2 4.5:3",tempo:[50,90]},
  {id:"2f",t:"Two chords in a bar",w:"p-i-m-a twice a bar, with a new chord on beat 3. The thumb lands on the new root exactly on time.",tip:"Look ahead: by the time the a finger plays on 2-and, the left hand should already be moving.",meter:4,prog:"C,G|Am,Em|Fmaj7,C|Fmaj7,G",pat:"1:B 1.5:3 2:2 2.5:1 3:B 3.5:3 4:2 4.5:1",tempo:[50,90]},
  {id:"2e",t:"Triplet arpeggio",w:"Three notes to every beat: thumb, i, m, then a, m, i, and so on: twelve notes to the bar in a rolling triplet feel.",tip:"Count 1-tri-let 2-tri-let; the thumb lands on 1 and 3.",meter:4,prog:"Em|C|G|D",pat:"1:B 1.333:3 1.667:2 2:1 2.333:2 2.667:3 3:A 3.333:3 3.667:2 4:1 4.333:2 4.667:3",tempo:[40,80]},
  {id:"2g",t:"Sixteenth-note arpeggio",w:"Four notes to every beat: p-i-m-a, m-i-m-a and so on, sixteen notes to a bar. The busy, shimmering accompaniment of modern ballads.",tip:"Count 1-e-&-a. Start very slowly; evenness matters more than speed.",meter:4,prog:"Am|Fmaj7|C|G",pat:"1:B 1.25:3 1.5:2 1.75:1 2:2 2.25:3 2.5:2 2.75:1 3:A 3.25:3 3.5:2 3.75:1 4:2 4.25:3 4.5:2 4.75:1",tempo:[40,75]},
 ]},
 {n:"Travis picking",d:"The thumb alternates between two bass strings like a steady heartbeat while the fingers play off-beats on top. The engine of folk and country fingerstyle.",ls:[
  {id:"3a",t:"Alternating thumb",w:"Thumb only: root on beats 1 and 3, the alternate bass string on 2 and 4. Nothing else.",tip:"This must become automatic. Practise it while talking or looking away.",meter:4,prog:"C|G|Am|Em",pat:"1:B 2:A 3:B 4:A",tempo:[50,100]},
  {id:"3b",t:"Basic Travis pattern",w:"The thumb keeps alternating on every beat; the fingers fill the gaps: a pinch with m on beat 1, then i, m, i, m on the off-beats.",tip:"Never let the fingers drag the thumb. If it wobbles, go back to the thumb alone.",meter:4,prog:"C|G|Am|Em",pat:"1:B+2 1.5:3 2:A 2.5:2 3:B 3.5:3 4:A 4.5:2",tempo:[50,100]},
  {id:"3c",t:"Travis with the high e",w:"The same pattern with the ring finger pinching the high e on beats 1 and 3, which adds a melody voice.",tip:"Listen for three layers: bass, middle and the top note.",meter:4,prog:"C|Am|D|G",pat:T_AR,tempo:[50,100]},
  {id:"3d",t:"Changing chords mid-bar",w:"Two chords in every bar, two beats each, without the thumb losing its place.",tip:"Change the left hand on the off-beat before the new chord, so the thumb lands on the new root on time.",meter:4,prog:"C,G|Am,Em|Fmaj7,C|D7,G",pat:"1:B+2 1.5:3 2:A 2.5:2 3:B+2 3.5:3 4:A 4.5:2",tempo:[50,90]},
  {id:"3f",t:"Travis with bass runs",w:"Travis picking where the thumb walks up to the next chord on beat 4: A–B into C, and A–F♯ into G. Bass runs are what make one guitar sound like a guitar and a bass player.",tip:"The run notes are exact frets, shown on the tab. The fingers keep playing the same off-beats over them.",meter:4,prog:"G|C|D7|G",pat:"1:B+1 1.5:3 2:A 2.5:2 3:B+1 3.5:3 4:5@0 4.5:5@2|"+T_AR+"|1:B+1 1.5:3 2:A 2.5:2 3:B+1 3.5:3 4:5@0 4.5:6@2|"+T_AR,tempo:[50,95]},
  {id:"3g",t:"Travis in 3/4",w:"The alternating thumb in waltz time: root, alternate, root, with finger notes on every 'and'. It feels lopsided at first because the root returns on beat 3.",tip:"Count 1-&-2-&-3-&. The thumb plays each number.",meter:3,prog:"G|C|D7|G",pat:"1:B+1 1.5:3 2:A 2.5:2 3:B 3.5:3",tempo:[50,100]},
  {id:"3e",t:"Syncopated Travis",w:"The finger notes land just before the beat on 2-and and 4-and, giving the bouncing, pushing sound of country picking.",tip:"Keep the thumb rock solid; only the fingers move around it.",meter:4,prog:"G|C|D7|G",pat:"1:B+1 2:A 2.5:2 3:B 3.5:3 4:A 4.5:1",tempo:[50,100]},
 ]},
 {n:"Bass and melody",d:"Two voices at once: a tune on the top strings played by the fingers, and a bass line under it played by the thumb. All tunes here are traditional or classical, free for anyone to play.",ls:[
  {id:"4a",t:"Twinkle Twinkle Little Star",song:1,w:"The tune on the top strings with the thumb playing the chord root on beats 1 and 3 (traditional, 1761).",tip:"Let the bass ring under the melody; fingers and thumb are independent.",meter:4,key:"A",style:"bass",mel:TWINKLE,ch:TWINKLE_CH,tempo:[60,100]},
  {id:"4b",t:"Ode to Joy",song:1,w:"Beethoven's theme (1824) on the B and high e strings, with the root in the bass on beats 1 and 3.",tip:"The melody stays in one place: open e, frets 1 and 3 on the e, frets 1 and 3 on the B.",meter:4,key:"C",style:"bass",mel:ODE,ch:ODE_CH,tempo:[60,110]},
  {id:"4e",t:"Jingle Bells",song:1,w:"The chorus of Jingle Bells (1857) with the root on beats 1 and 3. Lots of repeated notes, so your fingers can concentrate on staying in time with the thumb.",tip:"Alternate i and m on the repeated melody notes instead of using one finger over and over.",meter:4,key:"C",style:"bass",
   mel:"E4:1 E4:1 E4:2|E4:1 E4:1 E4:2|E4:1 G4:1 C4:1.5 D4:.5|E4:4|F4:1 F4:1 F4:1.5 F4:.5|F4:1 E4:1 E4:1 E4:.5 E4:.5|E4:1 D4:1 D4:1 E4:1|D4:2 G4:2|E4:1 E4:1 E4:2|E4:1 E4:1 E4:2|E4:1 G4:1 C4:1.5 D4:.5|E4:4|F4:1 F4:1 F4:1.5 F4:.5|F4:1 E4:1 E4:1 E4:.5 E4:.5|G4:1 G4:1 F4:1 D4:1|C4:4",
   ch:"C|C|C|C|Fmaj7|C|D7|G7|C|C|C|C|Fmaj7|C|G7|C",tempo:[60,110]},
  {id:"4c",t:"Walking bass between chords",w:"Bass and chord on beat 1, the chord on top on 2 and 3, and a walking note on beat 4 that steps into the next chord's root.",tip:"The walking note pulls the ear to the next chord. Play it a little stronger.",meter:4,key:"C",prog:"C|Am|Fmaj7|G|C|Em|Am|G",pat:"1:B+2 2:3+1 3:A 4:W",tempo:[50,90]},
  {id:"4d",t:"Ode to Joy, alternating bass",song:1,w:"The same tune with the thumb alternating on every beat underneath: two independent parts.",tip:"Learn two bars at a time with bar practice; it is the hardest step so far.",meter:4,key:"C",style:"alt",mel:ODE,ch:ODE_CH,tempo:[50,100]},
  {id:"4f",t:"Oh! Susanna, alternating bass",song:1,w:"Stephen Foster's 1848 song over an alternating thumb. The melody has eighth notes against the steady quarter-note bass: the first real test of independence.",tip:"Where a melody note falls between two thumb notes, let the thumb carry on as if the melody were not there.",meter:4,key:"C",style:"alt",mel:SUSANNA,ch:SUSANNA_CH,tempo:[50,100]},
 ]},
 {n:"Full arrangements",d:"Melody, bass and chord together: the complete fingerstyle sound. The thumb plays the bass, the fingers play the tune and fill in chord notes underneath it.",ls:[
  {id:"5a",t:"Twinkle Twinkle, full",song:1,w:"Melody on top, root in the bass, and chord notes filled in on the beats between melody notes.",tip:"The melody must stay the loudest voice. Fill notes are soft.",meter:4,key:"A",style:"full",mel:TWINKLE,ch:TWINKLE_CH,tempo:[50,90]},
  {id:"5b",t:"Amazing Grace",song:1,w:"The hymn tune 'New Britain' (1829) in C, in 3/4: bass on beat 1, chord notes on 2 and 3 under the melody.",tip:"Hold the chord shape and let the melody notes come out of it wherever possible.",meter:3,key:"C",style:"full",mel:GRACE,ch:GRACE_CH,tempo:[50,90]},
  {id:"5d",t:"Silent Night",song:1,w:"Gruber's carol (1818) in C, 3/4. The melody dips down onto the D and A strings at the end, so the thumb plays melody there as well as bass.",tip:"In the last line the tune is in the bass register: let the thumb sing it, and keep the fingers soft above it.",meter:3,key:"C",style:"full",mel:SILENT,ch:SILENT_CH,tempo:[50,90]},
  {id:"5e",t:"Happy Birthday",song:1,w:"The one song everyone will ask you for, now in the public domain. 3/4 in C with the dotted 'hap-py' pick-up.",tip:"The pick-up is long-short (dotted eighth, sixteenth). Count 3-e-&-a and play on 3 and 'a'.",meter:3,key:"C",style:"full",
   mel:"r:2 G3:.75 G3:.25|A3:1 G3:1 C4:1|B3:2 G3:.75 G3:.25|A3:1 G3:1 D4:1|C4:2 G3:.75 G3:.25|G4:1 E4:1 C4:1|B3:1 A3:1 F4:.75 F4:.25|E4:1 C4:1 D4:1|C4:3",
   ch:"-|C|G7|G7|C|C|Fmaj7|C|C",tempo:[50,100]},
  {id:"5c",t:"Greensleeves",song:1,w:"The 16th-century English tune in A minor, 3/4: bass on beat 1, melody on top, chord notes filling the gaps.",tip:"The dotted rhythm (long-short) gives Greensleeves its lilt. Don't straighten it.",meter:3,key:"Am",style:"full",mel:GREEN,ch:GREEN_CH,tempo:[50,90]},
 ]},
 {n:"Arranging workshop",d:"How to turn any tune into a solo piece yourself. One tune, Auld Lang Syne, built up in five layers, then moved to another key, then your own song. Each step is the method you will reuse for every arrangement.",ls:[
  {id:"w1",t:"Step 1: the melody alone",song:1,w:"Auld Lang Syne (traditional) as a bare melody on the top strings. Before anything else, the tune must be secure: you should be able to sing it while playing it.",tip:"Pick a fingering where most notes sit between open and fret 5 on the G, B and e strings. That leaves room for the bass under it.",meter:4,key:"C",style:"mel",mel:AULD,ch:AULD_CH,tempo:[60,110]},
  {id:"w2",t:"Step 2: one bass note per chord",song:1,w:"Add only the chord's root, once, where each chord starts. The tune now has harmony under it, with almost no extra work.",tip:"Choose chords by ear: under each long melody note, try the chords of the key until one sounds at rest.",meter:4,key:"C",style:"one",mel:AULD,ch:AULD_CH,tempo:[60,110]},
  {id:"w3",t:"Step 3: bass on 1 and 3",song:1,w:"The root twice a bar. Now there is a pulse under the tune, and the arrangement keeps moving through long melody notes.",tip:"Where the melody note and the bass would need the same string, the melody wins; the bass rests.",meter:4,key:"C",style:"bass",mel:AULD,ch:AULD_CH,tempo:[60,100]},
  {id:"w4",t:"Step 4: alternating bass",song:1,w:"The thumb alternates on every beat. This is the Travis-style version: a full rhythm section under the melody.",tip:"If a bar falls apart, loop just that bar and play the thumb alone first, then add the melody notes one by one.",meter:4,key:"C",style:"alt",mel:AULD,ch:AULD_CH,tempo:[50,95]},
  {id:"w5",t:"Step 5: fill in the chord",song:1,w:"Bass on the first beat of each chord and chord notes on the other beats wherever the fingers are free. The complete arrangement.",tip:"Fill notes always go below the melody, never above it, or the tune gets lost.",meter:4,key:"C",style:"full",mel:AULD,ch:AULD_CH,tempo:[50,95]},
  {id:"w6",t:"Step 6: the same tune in G",song:1,w:"Auld Lang Syne moved down to G. Changing key changes which notes fall on open strings and where the melody sits, so the same arrangement method gives a different, deeper sound.",tip:"To change key, move every melody note and every chord by the same distance: C to G is down a fourth (five frets).",meter:4,key:"G",style:"full",tr:-5,mel:AULD,ch:"-|G|D7|G|C|G|D7|C,D7|G",tempo:[50,95]},
  {id:"w7",t:"Step 7: arrange a tune you know",task:1,w:"Use the same six steps on a song you love. Old Hindi film songs, Bihu tunes, hymns and folk songs with a clear melody all work well.",tip:"Keep it short to begin with: one verse or one chorus is a complete arrangement.",
   steps:["Pick a tune you can sing all the way through. Hum it and find its last note: that is usually the key's home note.",
     "Choose a guitar-friendly key (C, G, D, A, Am, Em or Dm) where the melody sits on the top three strings between open and fret 5. Move the tune up or down until it fits.",
     "Find the melody by ear on the B and high e strings, one phrase at a time. Write it down as tab in a notebook.",
     "Write a chord above each bar. Under each long or important melody note, use a chord that contains that note.",
     "Build it in layers, exactly as in steps 1 to 5: melody alone, one bass note per chord, bass on 1 and 3, alternating bass, then chord fills.",
     "It is done when you can play it through twice in a row without stopping. Mark this lesson done then."],tempo:[60,60]},
 ]},
 {n:"Up the neck: barre shapes",d:"The same right-hand patterns on closed, movable shapes. The E-shape (root on the low E) and A-shape (root on the A string) barres work in every key.",ls:[
  {id:"6a",t:"E-shape barre arpeggios",w:"p-i-m-a in eighth notes over F, G and A minor, all played as E-shape barre chords.",tip:"Press the barre with the side of the index finger, not the soft middle.",meter:4,prog:"F|G(3)|Am(5)|G(3)",pat:"1:B 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1",tempo:[50,90]},
  {id:"6b",t:"A-shape barre arpeggios",w:"The rolling pattern over B♭, C and D minor as A-shape barres, root on the A string.",tip:"Only the strings you pluck need to ring. Don't squeeze harder than that.",meter:4,prog:"Bb|C(3)|Dm(5)|C(3)",pat:"1:B 1.5:3 2:2 2.5:3 3:1 3.5:3 4:2 4.5:3",tempo:[50,90]},
  {id:"6c",t:"Travis on barre chords",w:"Alternating bass with pinches over F, B♭, C and back, moving between E-shape and A-shape barres.",tip:"Look for the shortest move: F (fret 1) to B♭ (fret 1) is just a shape change.",meter:4,prog:"F|Bb|C(3)|F",pat:T_AR,tempo:[50,90]},
  {id:"6d",t:"Mixing shapes in one key",w:"G, C, D and B minor in the key of G, alternating E-shape and A-shape barres so the hand barely moves.",tip:"Name the root string of each chord before you play it: 6th, 5th, 5th, 5th.",meter:4,prog:"G(3)|C(3)|D(5)|Bm",pat:"1:B+1 1.5:3 2:2 2.5:3 3:A+1 3.5:3 4:2 4.5:3",tempo:[50,90]},
  {id:"6e",t:"The Canon progression",w:"Pachelbel's eight chords (D A Bm F♯m G D G A), two to a bar, mixing open chords with the Bm and F♯m barres. This progression is under hundreds of songs.",tip:"Bm and F♯m share the same fret-2 barre position. Keep the index finger near fret 2 throughout.",meter:4,key:"D",prog:"D,A|Bm,F#m|G,D|G,A",pat:"1:B 1.5:3 2:2 2.5:1 3:B 3.5:3 4:2 4.5:1",tempo:[50,90]},
  {id:"6f",t:"Canon in D: the theme",song:1,w:"Pachelbel's Canon (c. 1700): the famous falling melody over the eight chords, then the second, lower line, with bass and chord fills under both.",tip:"Each melody note lasts a whole chord. Let it ring for its full two beats while the fills move underneath.",meter:4,key:"D",style:"full",
   mel:"F#4:2 E4:2|D4:2 C#4:2|B3:2 A3:2|B3:2 C#4:2|D4:2 C#4:2|B3:2 A3:2|G3:2 F#3:2|G3:2 E3:2|D4:4",ch:"D,A|Bm,F#m|G,D|G,A|D,A|Bm,F#m|G,D|G,A|D",tempo:[50,80]},
 ]},
 {n:"Expression on the strings",d:"Techniques that make fingerstyle sing, all done with the left hand and the strings: hammer-ons, pull-offs, slides, harmonics, a muted thumb, and melodies doubled in thirds and sixths.",ls:[
  {id:"7a",t:"Hammer-ons in the arpeggio",w:"Pluck an open string, then hammer a finger onto the chord fret without plucking again. Two notes for one pluck.",tip:"Hammer close to the fret with the fingertip, fast and firm.",meter:4,prog:"Am|Dm|E|Am",pat:"1:B 1.5:3h 2.5:2 3:A 3.5:3 4:2h 4.5:1",tempo:[50,90]},
  {id:"7b",t:"Pull-offs on the top strings",w:"Pluck a fretted chord note, then pull the finger off sideways so the open string sounds.",tip:"Pull slightly down towards the floor; you are plucking with the left hand.",meter:4,prog:"Am|Dm|C|Am",pat:"1:B 1.5:2p 2.5:1 3:A 3.5:3 4:2p 4.5:3",tempo:[50,90]},
  {id:"7c",t:"Slides into chord notes",w:"Pluck two frets below a chord note and slide up into it, keeping the pressure on. Played on the barre shapes from Level 7, where every chord note has room below it.",tip:"Arrive exactly on the beat; the slide happens just before it.",meter:4,prog:"D(5)|C(3)|G(3)|D(5)",pat:"1:B 1.5:3/ 2.5:2 3:A 3.5:1/ 4.5:2",tempo:[50,90]},
  {id:"7d",t:"Natural harmonic chimes",w:"Touch a string lightly right over the 12th fret (not pressing) and pluck: a bell-like note an octave up. Then the same over frets 7 and 5.",tip:"Lift the touching finger just after plucking to let the chime ring.",meter:4,prog:"-|-|-|-",pat:"1:<12>6 1.5:<12>4 2:<12>3 2.5:<12>2 3:<12>1 4:<12>3+<12>2+<12>1",pat2:"1:<7>6 1.5:<7>4 2:<7>3 2.5:<7>2 3:<5>3+<5>2+<5>1",tempo:[50,90]},
  {id:"7e",t:"Muted thumb under ringing fingers",w:"Rest the side of the picking hand on the bass strings near the bridge so the thumb's notes are short and thumpy, while the fingers' notes ring.",tip:"Only the bass strings are muted. Keep your palm off the top three.",meter:4,prog:"E|A|E|B7",pat:"1:Bm+1 1.5:3 2:Am 2.5:2 3:Bm+1 3.5:3 4:Am 4.5:2",tempo:[60,110]},
  {id:"7f",t:"Melody in sixths",w:"Two melody notes at once, six notes apart, on the G and high e strings with the e finger (a) and i. Sixths are the sweet, two-voice sound of country and folk guitar.",tip:"i and a pluck together like a pinch without the thumb. The thumb keeps its bass on 1 and 3.",meter:4,prog:"C|Fmaj7|G|C",pat:"1:B 2:3@0+1@0! 3:A 4:3@2+1@1!|1:B 2:3@2+1@1! 3:A 4:3@0+1@0!|1:B 2:3@4+1@3! 3:A 4:3@2+1@1!|1:B 2:3@5+1@5! 3:A 4:3@0+1@0!",tempo:[50,90]},
  {id:"7g",t:"Melody in thirds",w:"Scale steps doubled a third apart on the G and B strings (i and m together), climbing over C and falling over A minor.",tip:"Thirds are close together: use two fingers of the left hand side by side and slide the pair along.",meter:4,prog:"C|Am|C|G",pat:"1:B 1.5:3@0+2@0! 2:3@2+2@1! 3:A 3.5:3@4+2@3! 4:3@5+2@5!|1:B 1.5:3@5+2@5! 2:3@4+2@3! 3:A 3.5:3@2+2@1! 4:3@0+2@0!|1:B 1.5:3@0+2@0! 2:3@2+2@1! 3:A 3.5:3@4+2@3! 4:3@5+2@5!|1:B 1.5:3@4+2@3! 2:3@2+2@1! 3:A 3.5:3@0+2@0! 4:3@4+2@3!",tempo:[50,90]},
  {id:"7h",t:"A falling bass line",w:"A minor, G, F and E with the bass stepping down A–G–F–E underneath the arpeggio. A descending bass gives a whole progression its direction.",tip:"For F, fret the low E string at fret 1 with the thumb or first finger and keep the top of the Fmaj7 shape.",meter:4,prog:"Am|G|Fmaj7|E",pat:"1:B+1 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1|1:B+1 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1|1:6@1+1 1.5:3 2:2 2.5:1 3:6@1 3.5:3 4:2 4.5:1|1:B+1 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1",tempo:[50,90]},
 ]},
 {n:"Blues and swing feel",d:"Rhythm that moves: the steady muted thumb of Delta blues, licks on top of it, and the swung, long-short eighth notes of ragtime and jazz, all on the strings.",ls:[
  {id:"b1",t:"Monotonic thumb: 12-bar blues in E",w:"The thumb plays the root on every beat, muted, while the fingers add notes on top. Twelve bars: the blues form under thousands of songs.",tip:"Swing the off-beats: long-short, like a heartbeat. The tab marks swung notes on the 'let' of each beat.",meter:4,swing:1,prog:"E7|A7|E7|E7|A7|A7|E7|E7|B7|A7|E7|B7",pat:"1:Bm+1 2:Bm 2.5:2 3:Bm+1 4:Bm 4.5:3",tempo:[60,110]},
  {id:"b2",t:"Blues licks over a steady thumb",w:"Short melodic phrases from the E minor pentatonic scale on the top strings while the muted thumb never stops. The melody notes are exact frets on the tab.",tip:"Learn each lick alone, then with the thumb. If the thumb hesitates, the lick is too fast.",meter:4,swing:1,prog:"E7|A7|E7|B7",pat:"1:Bm+1@0! 2:Bm 2.5:2@3! 3:Bm+2@0! 4:Bm 4.5:3@2!|1:Bm+1@0! 2:Bm 2.5:2@2! 3:Bm+3@2! 4:Bm 4.5:3@0!|1:Bm+2@3! 1.5:2@0! 2:Bm 3:Bm+3@2! 3.5:3@0! 4:Bm|1:Bm+2@0! 2:Bm 2.5:3@2! 3:Bm+1@2! 4:Bm 4.5:2@0!",tempo:[60,105]},
  {id:"b3",t:"Ragtime circle",w:"C, A7, D7, G7: the ragtime progression, with an alternating thumb, swing, and a syncopated top note just after beat 3.",tip:"The top note on 3-and pushes against the steady thumb. That push is the whole ragtime sound.",meter:4,swing:1,prog:"C|A7|D7|G7",pat:"1:B+1 1.5:3 2:A 2.5:2 3:B 3.5:1 4:A 4.5:2",tempo:[60,110]},
  {id:"b4",t:"Ragtime circle, two chords a bar",w:"The same circle at twice the harmonic speed, with pinches on every chord change and swing on the off-beats.",tip:"Plan the left hand: C to A7 and D7 to G7 are the two moves to drill.",meter:4,swing:1,prog:"C,A7|D7,G7|C,A7|D7,G7",pat:T_AR,tempo:[60,105]},
  {id:"b5",t:"When the Saints Go Marching In",song:1,w:"The New Orleans spiritual (traditional) with the thumb alternating on every beat under the melody.",tip:"Long held notes are the place to enjoy the bass: listen to it walk while the melody rests.",meter:4,key:"C",style:"alt",
   mel:"r:1 C4:1 E4:1 F4:1|G4:4|r:1 C4:1 E4:1 F4:1|G4:4|r:1 C4:1 E4:1 F4:1|G4:2 E4:2|C4:2 E4:2|D4:4|r:1 E4:1 E4:1 D4:1|C4:3 C4:1|E4:2 G4:2|G4:1 F4:3|F4:2 E4:1 F4:1|G4:2 E4:2|C4:2 D4:2|C4:4",
   ch:"C|C|C|C|C|C|C|G7|C|C|C|Fmaj7|C|C|G7|C",tempo:[60,120]},
 ]},
 {n:"Open and altered tunings",d:"Retune the strings and the guitar rings like a harp. Drop D gives a deep low D under everything; DADGAD gives open, droning chords. Retune before each lesson; the tab and sound follow the tuning.",ls:[
  {id:"t1",t:"Drop D: the low drone",w:"Tune the low E string down a whole step to D. Now the open low string is a big D bass under D, G and A chords.",tip:"To tune, play the open 4th string (D) and lower the 6th until it matches an octave below.",meter:4,tune:"dd",key:"D",prog:"D(dd)|G(dd)|D(dd)|A(dd)",pat:T_AR,tempo:[50,100]},
  {id:"t2",t:"Twinkle Twinkle in drop D",song:1,w:"The first tune of the course moved to D, with the low drop-D string and an alternating thumb under it.",tip:"For G in drop D, the bass is at fret 5 of the low string. Keep the melody hand light while the thumb jumps there.",meter:4,tune:"dd",key:"D",style:"alt",tr:5,mel:TWINKLE,ch:"D(dd)|G(dd),D(dd)|G(dd),D(dd)|A(dd),D(dd)|D(dd),G(dd)|D(dd),A(dd)|D(dd),G(dd)|D(dd),A(dd)|D(dd)|G(dd),D(dd)|G(dd),D(dd)|A(dd),D(dd)",tempo:[50,100]},
  {id:"t3",t:"DADGAD: open, ringing chords",w:"Tune to D A D G A D (low to high). The open strings make a ringing chord, and simple shapes give the Celtic, modal sound of this tuning.",tip:"From standard: lower the 6th, 2nd and 1st strings by a whole step each.",meter:4,tune:"dg",key:"D",prog:"D5(dg)|G(dg)|D5(dg)|A7sus(dg)",pat:"1:B 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1",tempo:[50,95]},
  {id:"t4",t:"Amazing Grace in DADGAD",song:1,w:"The hymn moved to D in DADGAD, with open strings ringing under the melody. Compare it with lesson 5b in standard tuning.",tip:"Let notes ring into each other wherever they fall on different strings; that overlap is the DADGAD sound.",meter:3,tune:"dg",key:"D",style:"full",tr:2,mel:GRACE,ch:"-|D5(dg)|D5(dg)|G(dg)|D5(dg)|D5(dg)|A7sus(dg)|A7sus(dg)|A7sus(dg)|D5(dg)|D5(dg)|G(dg)|D5(dg)|D5(dg)|A7sus(dg)|D5(dg)",tempo:[50,90]},
 ]},
 {n:"Mastery: complete solo pieces",d:"Full arrangements at performance tempo, combining everything: independent thumb, melody on top, chord fills, steady time, and finally your own performance.",ls:[
  {id:"8a",t:"Twinkle Twinkle with alternating bass",song:1,w:"The melody over a thumb that alternates on every beat: the Travis engine under a tune.",tip:"If the melody and bass collide, slow down; never let the thumb stop.",meter:4,key:"A",style:"alt",mel:TWINKLE,ch:TWINKLE_CH,tempo:[60,110]},
  {id:"8b",t:"Amazing Grace at tempo",song:1,w:"The full arrangement, now aiming for a flowing performance tempo with the melody singing above the chords.",tip:"Shape the phrases: lean into 'grace', 'sound', 'found' and 'see'.",meter:3,key:"C",style:"full",mel:GRACE,ch:GRACE_CH,tempo:[70,110]},
  {id:"8c",t:"Greensleeves at tempo",song:1,w:"The complete Greensleeves arrangement, aiming for a flowing, singing performance.",tip:"Record yourself and listen: is the melody always on top?",meter:3,key:"Am",style:"full",mel:GREEN,ch:GREEN_CH,tempo:[70,110]},
  {id:"8d",t:"Ode to Joy, full with alternating bass",song:1,w:"Melody, alternating bass and the steady pulse of a complete solo arrangement.",tip:"Play it for someone. Performing is a skill of its own.",meter:4,key:"C",style:"alt",mel:ODE,ch:ODE_CH,tempo:[70,120]},
  {id:"m1",t:"Minuet in G",song:1,w:"The Minuet in G from the Anna Magdalena Notebook (1725): a running eighth-note melody over bass and chord. The most demanding melody line in the course.",tip:"Practise two bars at a time. The left hand has to move with the melody here, so finger it before you speed up.",meter:3,key:"G",style:"full",mel:MINUET,ch:MINUET_CH,tempo:[50,100]},
  {id:"m2",t:"Oh! Susanna, full arrangement",song:1,w:"The Foster song with bass and chord fills at a lively tempo: a complete, sing-along solo piece.",tip:"Keep the eighth-note pick-ups light and quick, and land firmly on beat 1.",meter:4,key:"C",style:"full",mel:SUSANNA,ch:SUSANNA_CH,tempo:[60,115]},
  {id:"m3",t:"Silent Night at tempo",song:1,w:"The carol as a gentle, flowing performance piece, with the low final phrase sung by the thumb.",tip:"Slow and sustained is harder than fast: keep every note ringing for its full length.",meter:3,key:"C",style:"full",mel:SILENT,ch:SILENT_CH,tempo:[60,100]},
  {id:"m4",t:"Your performance piece",task:1,w:"Choose one complete arrangement, from this course or your own from lesson w7, and bring it to performance standard.",tip:"A performance is not perfect; it simply never stops. Practise recovering from mistakes without stopping.",
   steps:["Pick one piece you enjoy that is already close to its goal tempo.",
     "Each day play it through three times without stopping, at about 80% of your best tempo.",
     "Record it on your phone and listen back for three things: is the melody always loudest, is the thumb steady, are there gaps at chord changes?",
     "Fix the weakest bar with bar practice, then play the whole piece again.",
     "Play it for someone, in person or on a call. Mark this lesson done after that first performance."],tempo:[60,60]},
 ]},
];
const RH_LEVEL={n:"Right-hand control",d:"The tone and accuracy skills classical players drill every day: alternating fingers, rest and free strokes, planting, stopping notes, one voice louder than the rest, rolls and tremolo. Short daily drills that make every later pattern cleaner.",ls:[
  {id:"r1",t:"Alternating fingers on the open strings",free:1,meter:4,tempo:[50,50],
   vars:[["i","m"],["m","i"],["m","a"],["i","a"]].map(([a,b])=>({tag:a+b,vt:`${a}-${b}`,prog:dashes(4),pat:openAlt(a,b)})),
   w:"Two fingers take turns on one string, never the same finger twice in a row: two bars on the high e, two on the B, two on the G, then crossing between them. The letter under each note is the finger. First i-m, then m-i, m-a and i-a, so every pair of fingers gets the same control.",
   tip:"Pluck from the big knuckle, not the fingertip joint. The tip follows through towards the palm and comes straight back.",
   how:["<b>Free stroke first:</b> after plucking, the finger moves up into the air, clear of the next string. This is the stroke you use in every arpeggio.",
     "<b>Then rest stroke:</b> pluck through the string and let the finger come to rest on the next lower string. The note is fuller and louder. Use it for melody notes.",
     "Play each exercise once with free strokes, then once with rest strokes. Listen: the rest stroke should sound bigger, not harsher.",
     "Keep the hand still. Only the fingers move; the wrist and forearm stay quiet.",
     "Any steady tempo you like. Mark it done when both kinds of stroke sound even and the fingers never repeat."]},
  {id:"r2",t:"The G major scale, two octaves, alternating",meter:4,tempo:[50,100],
   vars:[["i","m"],["m","a"],["i","a"]].flatMap(([a,b])=>[["quarter notes",4],["eighth notes",8],["triplets",12]].map(([nm,per])=>{const bs=scale2(a,b,per);return {tag:`${a}${b}.${per}`,vt:`${a}-${b} · ${nm}`,prog:dashes(bs.length),pat:bs.join("|")};})),
   w:"From the classical scale practice: the G major scale from the low G (6th string, fret 3) up two octaves to the high G and back, every note plucked by two fingers in turn, never the thumb. Each finger pair is played in three rhythms: quarter notes, eighths and triplets.",
   tip:"At each string crossing, the finger that plays next should already be close to its new string. Small movements make even scales.",
   how:["Play the scale slowly with rest strokes, then repeat it with free strokes.",
     "Watch the string crossings: if two notes in a row are the same finger, you lost the alternation; start again slowly.",
     "Count out loud with the click. Triplets: '1-tri-plet, 2-tri-plet'.",
     "Turn Climb on and let the tempo rise to the goal."]},
  {id:"r3",t:"Planting: place, then play",meter:4,prog:"Am|Dm|E|Am",pat:"1:B 1.5:1 2:2 2.5:3 3:A 3.5:1 4:2 4.5:3",tempo:[50,90],
   w:"Before the thumb plays, the fingers that are about to pluck (a, m and i) touch their strings all at once. Then they pluck one by one. Planting makes every note land on the right string, even at speed, and keeps the hand stable.",
   tip:"You will hear a tiny stop in the strings as the fingers land. That is fine while you learn; later the plant becomes light and silent.",
   how:["On beat 1, as the thumb plays the bass, place a, m and i on the e, B and G strings.",
     "Pluck a, m, i one after another, then plant again before the next thumb note.",
     "Do it at a slow tempo until it is automatic, then let the plant get lighter as the tempo climbs."]},
  {id:"r4",t:"Voicing: one finger louder",free:1,meter:4,tempo:[50,50],
   vars:[[1,"a","high e (a)"],[2,"m","B string (m)"],[3,"i","G string (i)"]].map(([s,f,nm])=>({tag:f,vt:`Loud on the ${nm}`,prog:"C|Am|Fmaj7|G",
     pat:`1:B+${[3,2,1].map(x=>x===s?x+"!":x).join("+")} 2:${[3,2,1].map(x=>x===s?x+"!":x).join("+")} 3:A+${[3,2,1].map(x=>x===s?x+"!":x).join("+")} 4:${[3,2,1].map(x=>x===s?x+"!":x).join("+")}`})),
   w:"The three fingers pluck together, but one of them plays louder than the other two. In a real arrangement the melody is usually on top (a), but it can be in the middle too. This is the single most important skill for making a melody sing over its chord.",
   tip:"Press the loud finger a little deeper into the string before releasing it, and use a rest stroke with that finger only. The others stay light with free strokes.",
   how:["Play slowly. The highlighted (melody-coloured) note in the tab is the loud one.",
     "Record yourself on your phone. Can you clearly hear one note on top of the chord?",
     "Then try the opposite on your own: all three soft, then all three loud. Control is being able to choose."]},
  {id:"r5",t:"Stopped bass: short thumb notes",meter:4,prog:"C|Am|Fmaj7|G",pat:"1:B' 1.5:3 2:2 2.5:1 3:A' 3.5:3 4:2 4.5:1",tempo:[50,90],
   w:"The thumb plays its bass note, then stops it just before the next one, so the bass is short and bouncy while the fingers keep ringing. It makes the bass and the top sound like two different instruments.",
   tip:"Stop the string by letting the thumb come back to touch it lightly, or by easing the fretting finger's pressure. It is not palm muting: the palm stays off the strings.",
   how:["The dot (·) above a bass note means: short, stopped.","First play the bass alone, short and even, then add the fingers.","Compare with lesson 1e, where the bass rings: you should hear the difference clearly."]},
  {id:"r6",t:"Forward roll: p-i-m",meter:4,prog:"G|C|D|G",pat:"1:B 1.5:3 2:2 2.5:A 3:3 3.5:2 4:B 4.5:3",tempo:[50,100],
   w:"A three-note roll (thumb, i, m) running over the four-beat bar, so the accent keeps shifting: 3 + 3 + 2. It gives the rolling, banjo-like sound of folk and bluegrass fingerstyle.",
   tip:"Count the eighth notes: 1-2-3, 1-2-3, 1-2. Accent each '1' slightly and you will hear the roll cross the bar."},
  {id:"r7",t:"Backward roll: m-i-p",meter:4,prog:"G|C|D|G",pat:"1:2 1.5:3 2:B 2.5:2 3:3 3.5:A 4:2 4.5:3",tempo:[50,100],
   w:"The same roll in reverse: m, i, then the thumb. Starting a bar with a finger instead of the thumb trains the fingers to lead.",
   tip:"Keep the thumb's notes on the bass strings even though they no longer fall on the beat."},
  {id:"r8",t:"Tremolo: p-a-m-i",meter:4,prog:"Am|Dm|E|Am",pat:"1:B 1.25:1!.a 1.5:1!.m 1.75:1!.i 2:A 2.25:1!.a 2.5:1!.m 2.75:1!.i 3:B 3.25:1!.a 3.5:1!.m 3.75:1!.i 4:A 4.25:1!.a 4.5:1!.m 4.75:1!.i",tempo:[40,80],
   w:"The classical tremolo: the thumb plays a bass note, then a, m and i pluck the same high string one after another, so the melody note seems to be held in one long, shimmering line.",
   tip:"Evenness is everything: a-m-i must sound like three equal notes. Practise very slowly and listen for gaps.",
   how:["Start at 40 bpm and play only beat 1 (p-a-m-i) over and over.","Then the whole bar. Keep the fingers close to the string; no big movements.","Let Climb raise the tempo only when the three finger notes are perfectly even."]},
 ]};
const SV_LEVEL={n:"Scales over chords",d:"From the 'Fingerstyle Scales' lesson: play the scale of the key on the top strings while the thumb holds the chord's bass, then with the chord notes underneath. Rule 1 of fingerstyle: nothing is played higher than the melody note. Learn this and you can put any melody on top of any chord.",ls:[
  {id:"v1",t:"The scale over the home bass note",free:1,meter:4,tempo:[50,50],vars:svVars("I",0),
   w:"The major scale on the G, B and high e strings, up and back down, with the thumb playing the key's root under every note. Melody and bass at the same time, the very first step of solo fingerstyle.",
   tip:"Thumb and finger pluck together like a pinch. The melody note should be the louder of the two.",
   how:["First play the scale alone, without the bass, until you know where each note is.","Add the bass on every note. Keep the thumb's note steady and the melody singing.","In C, D and E the scale runs from another note of the key to the same note an octave up, so it stays on the top three strings below fret 5."]},
  {id:"v2",t:"The scale over the full home chord",free:1,meter:4,tempo:[50,50],vars:svVars("I",1),
   w:"Now hold the home chord and play the scale on top. Under each melody note you also play the chord notes that sit below it, never the ones above it: nothing higher than the melody note. Your left hand has to keep as much of the chord as it can while a finger reaches for each scale note.",
   tip:"When the melody is on the high e, you hear the full chord under it. When it drops to the G string, only the bass is left: that is rule 1 at work.",
   how:["Look at the chord diagram, then play the first bar slowly. Notice which chord notes disappear as the melody goes down.","If a scale note forces a chord finger off, let it go; the melody always wins.","Keep the melody loud and the chord notes soft, as in lesson r4."]},
  {id:"v3",t:"The scale over the ii chord",free:1,meter:4,tempo:[50,50],vars:svVars("ii",1),
   w:"The same scale, now over the second chord of the key (Am in G, Dm in C, Em in D, Bm7 in A). The notes are the same, but each one feels different against a new chord.",
   tip:"Listen for which scale notes sound at rest over this chord (its own chord notes) and which want to move on."},
  {id:"v4",t:"The scale over the iii chord",free:1,meter:4,tempo:[50,50],vars:svVars("iii",1),
   w:"Over the third chord of the key: Bm7 in G and Em in C. In the keys of D and A this chord needs a barre, so it is left out until Up the neck.",
   tip:"Bm7 stands in for the Bm barre chord here: same sound, open strings, no barre."},
  {id:"v5",t:"The scale over the IV chord",free:1,meter:4,tempo:[50,50],vars:svVars("IV",1),
   w:"Over the fourth chord of the key: C in G, Fmaj7 in C, G in D, D in A, A in E. The IV chord is the most common chord after the home chord.",
   tip:"Over the IV chord the key's 4th note is the chord's own root: it sounds strong and settled."},
  {id:"v6",t:"The scale over the V chord",free:1,meter:4,tempo:[50,50],vars:svVars("V",1),
   w:"Over the fifth chord: D in G, G in C, A in D, E in A, B7 in E. The V chord pulls back home, and so does the melody over it.",
   tip:"Notice the 7th note of the scale (F♯ in G): over the V chord it is a chord note, and it leans strongly up to the home note."},
  {id:"v7",t:"The scale over the vi chord",free:1,meter:4,tempo:[50,50],vars:svVars("vi",1),
   w:"Over the sixth chord, the relative minor: Em in G, Am in C, Bm7 in D. The same notes now sound sad and soft.",
   tip:"This is the sound of the minor key hiding inside the major one. The same scale is the natural minor scale of this chord."},
  {id:"v8",t:"The harmonised scale: a chord for every note",free:1,meter:4,tempo:[50,50],vars:svHarm(),
   w:"The step that turns scales into arrangements: each melody note gets its own chord from the key, one that contains that note (I, IV or V, sometimes ii or vi). The left hand changes chord on every beat while the melody climbs and falls.",
   tip:"This is exactly how you will choose chords when you arrange a tune: under each melody note, a chord of the key that holds it.",
   how:["Learn the chord sequence first, without the melody: bass and fills only.","Then add the melody on top, one bar at a time with bar practice.","Say the chord name as you play it. It trains you to hear which chord fits each note."]},
 ]};
const MU_LEVEL={n:"Musicianship",d:"Everything that turns correct notes into music: minor keys, 6/8 time, turnarounds, intros and endings, shaping a piece with rubato and dynamics, and finding a melody by ear.",ls:[
  {id:"u1",t:"Minor-key arpeggios",meter:4,pat:"1:B+1 1.5:3 2:2 2.5:3 3:A+1 3.5:3 4:2 4.5:3",tempo:[50,90],progs:[["Am","Am|Dm|E7|Am"],["Em","Em|Am|B7|Em"],["Dm","Dm|C|A7|Dm"],["Am · falling","Am|G|Fmaj7|E"]],
   w:"Minor keys with the major (dominant 7th) V chord that pulls home: E7 to Am, B7 to Em, A7 to Dm. Then the falling Am–G–F–E line. This is the sound of most sad songs, ghazals and folk ballads.",
   tip:"Listen for the one changed note: in A minor the E7 has a G♯, not the G of the key. That raised note is what makes it pull back to Am."},
  {id:"u2",t:"Minor scales over their chords",free:1,meter:4,tempo:[50,50],vars:mnVars(),
   w:"The scales-over-chords method from level 'Scales over chords', now in A minor and E minor: the natural minor scale on the top strings over each chord of the key, with only the chord notes below the melody.",
   tip:"A minor uses the same notes as C major, and E minor the same as G major. Only the home note changes, and with it the whole mood."},
  {id:"u3",t:"6/8 time: two big beats",meter:6,sig:"6/8",pat:"1:B 2:3 3:2 4:A 5:2 6:3",tempo:[90,160],progs:[["G","G|Em|C|D"],["Am","Am|Fmaj7|G|E"],["C","C|Am|Fmaj7|G"]],
   w:"Six quick notes to a bar, felt as two big beats: ONE-two-three FOUR-five-six. The lilting sway of lullabies, Irish jigs and many old film songs. The bpm here counts each of the six notes.",
   tip:"The thumb plays on 1 and 4, the two big beats. Tap your foot only on those."},
  {id:"u4",t:"6/8 with a melody on top",meter:6,sig:"6/8",pat:"1:B+1! 2:3 3:2 4:A+2! 5:3 6:2",tempo:[90,160],progs:[["G","G|C|D|G"],["Am","Am|Dm|E7|Am"],["D","D|G|A|D"]],
   w:"The same 6/8 sway with a pinched melody note on each big beat: the top of the chord on 1, the B string on 4. Two melody notes per bar over a rocking arpeggio.",
   tip:"Make the pinched melody notes louder than the arpeggio notes between them (lesson r4)."},
  {id:"u5",t:"Turnarounds: I–vi–ii–V",meter:4,prog:"C|Am|Dm|G7",pat:"1:B+1 1.5:3 2:2 2.5:3 3:A 3.5:3 4:W 4.5:2",tempo:[50,95],
   w:"The four-chord loop that brings a song back to its start: I, vi, ii, V. With a walking bass note on beat 4 stepping into the next chord, it is the glue between verses and the classic way to end a section.",
   tip:"The walking note is the push into the next chord. Play it a touch louder."},
  {id:"u6",t:"Intros and endings",free:1,meter:4,tempo:[50,50],
   vars:[{tag:"chime",vt:"Harmonic chime intro in G",prog:"-|G|Em|G",pat:"1:<12>4+<12>3+<12>2 3:<12>3+<12>2+<12>1|"+T_AR,key:"G"},
     {tag:"walk",vt:"Bass walk-up intro in C",prog:"-|C|Fmaj7|C",pat:"3:6@3 3.5:5@0 4:5@2|1:B+1 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3",key:"C"},
     {tag:"roll",vt:"Ending: slow roll and harmonic tag in C",prog:"Fmaj7|G7|C|C",pat:"1:B 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1|1:B 1.5:3 2:2 2.5:1 3:A 3.5:3 4:2 4.5:1|1:B 1.25:4 1.5:3 1.75:2 2:1|1:<ah>5 1.5:<ah>4 2:<ah>3 2.5:<ah>2 3:<ah>1",key:"C"},
     {tag:"amen",vt:"Ending: the IV–I 'amen' tag in G",prog:"D7|G|C|G",pat:"1:B+1 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3|1:B+1 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3|1:B+1! 2:3 3:2 4:1|1:B+3+2+1!",key:"G"}],
   w:"Four ways to start and finish a piece so it sounds complete: ringing harmonics before the first chord, a bass line walking up into it, a slowed rolled chord with artificial harmonics to close, and the soft IV–I 'amen' ending of hymns.",
   tip:"Endings need time. On the last chord, slow down a little before it and let it ring until it fades."},
  {id:"u7",t:"Rubato and dynamics: shaping a piece",task:1,
   w:"A metronome-perfect performance can still sound flat. Rubato (stretching and catching up time) and dynamics (louder and softer) are what make a slow piece sing. Use one of your finished songs, Amazing Grace or Silent Night are ideal.",
   tip:"Rubato is like breathing: slow at the end of a phrase, move on at the start of the next. Never so much that the pulse is lost.",
   steps:["Pick a slow piece you can already play without stopping (5b Amazing Grace or 5d Silent Night).",
     "Sing the melody and mark where you naturally breathe: those are the phrase ends.",
     "Play it with no metronome. Slow down slightly into each phrase end and hold the last note a little longer.",
     "Choose the high point of the piece (the highest or most important note) and build towards it: soft at the start, louder at the peak, soft again at the end.",
     "Keep the bass and fills soft throughout; only the melody changes its volume.",
     "Record it and listen. Does it sound like someone singing? Mark it done when it does."],tempo:[60,60]},
  {id:"u8",t:"Finding a melody by ear",task:1,
   w:"Before you can arrange a song you need its melody on the fretboard. This is a short, repeatable method using the scales you learned over chords.",
   tip:"Work a phrase at a time. A wrong note is useful: it tells you whether to go up or down.",
   steps:["Choose a short tune you know well, an old Hindi film song, a Bihu tune or a bhajan. Sing it until you can sing it in tune.",
     "Find the last note of the song on the B or G string by singing it and trying notes: that is almost always the home note (key).",
     "Play that key's scale on the top strings (level 'Scales over chords'). The melody will use these notes.",
     "Find the first phrase note by note: sing a note, play the scale note you think it is, compare, adjust up or down.",
     "Write it down as tab in a notebook, phrase by phrase, until you have the whole tune.",
     "Then take it to lesson w7 to arrange it."],tempo:[60,60]},
 ]};
/* lessons added to existing levels */
const UP_ADD=[
  {id:"6g",t:"Major triads on the top three strings",free:1,meter:4,tempo:[50,50],vars:triads(""),
   w:"Every major chord has three small shapes on the G, B and high e strings: one for each note on top. Each bar plays one shape as an arpeggio and then together; the last bar walks back down through all three. All 12 keys.",
   tip:"The top note of each triad is a melody note. Knowing all three lets you put a melody on top of a chord anywhere on the neck."},
  {id:"6h",t:"Minor triads on the top three strings",free:1,meter:4,tempo:[50,50],vars:triads("m"),
   w:"The same three inversions for minor chords, in all 12 keys. Compare each with its major shape: one note moves down a fret.",
   tip:"Find the note that moved: it is the 3rd of the chord, the note that makes major sound happy and minor sad."},
  {id:"6i",t:"Capo: open shapes in any key",meter:4,prog:"G|Em|C|D",pat:T_AR,tempo:[50,95],capos:[2,3,4,5,7],
   w:"Put a capo on and the open shapes you know move up: G-shape chords with a capo on fret 2 sound in A. This is how fingerstyle players fit open-string arrangements to any key or singer.",
   tip:"The tab still reads as if the capo were the nut: fret 0 means the capo fret. Check your tuning after putting the capo on."},
  {id:"6j",t:"Major scales in all five CAGED shapes",meter:4,tempo:[50,100],vars:cagedVars(),
   w:"From the classical scale-practice lesson: the major scale in each of the five CAGED shapes, from the lowest note of the box to the highest and back, plucked i-m all the way. Key by key from C through all 12, shape by shape (C, A, G, E, D).",
   tip:"Use rest strokes for a full sound. Repeat each box with m-a once it is even with i-m.",
   how:["Look at the box first: which fret does it start on, where are the roots?","Play slowly with rest strokes, then free strokes, i-m alternating (the letter under each note).","Then play it again with m-a.","Climb to the goal tempo, then move to the next shape."]},
];
const EXP_ADD=[
  {id:"7i",t:"Vibrato on melody notes",free:1,meter:4,tempo:[50,50],
   vars:[{tag:"C",vt:"in C",key:"C",prog:"C|Am|Fmaj7|G",pat:"1:B+2@1!~ 1.5:3 2:1 2.5:3 3:A 3.5:3 4:1 4.5:3|1:B+2@1!~ 1.5:3 2:1 2.5:3 3:A 3.5:3 4:1 4.5:3|1:B+3@2!~ 1.5:2 2:1 2.5:2 3:A 3.5:2 4:1 4.5:2|1:B+1@3!~ 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3"},
     {tag:"G",vt:"in G",key:"G",prog:"G|Em|C|D",pat:"1:B+1@3!~ 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3|1:B+2@3!~ 1.5:3 2:1 2.5:3 3:A 3.5:3 4:1 4.5:3|1:B+2@1!~ 1.5:3 2:1 2.5:3 3:A 3.5:3 4:1 4.5:3|1:B+1@2!~ 1.5:3 2:2 2.5:3 3:A 3.5:3 4:2 4.5:3"}],
   w:"A long melody note (marked ~) is made to sing by rocking the fretting finger: a small, even wobble in pitch, while the arpeggio carries on below. Vibrato needs a fretted note, so each melody note here is fretted.",
   tip:"Classical vibrato rocks the finger along the string, towards and away from the nut. Start slow and even; speed comes later.",
   how:["Play the melody note with the bass, then start the vibrato a moment after the note begins.","Keep the other chord fingers still while one finger wobbles.","Compare the same bar without vibrato. The note should sound longer and more alive."]},
  {id:"7j",t:"Grace notes: ornaments on the melody",free:1,meter:4,tempo:[50,50],
   vars:[{tag:"C",vt:"in C",key:"C",prog:"C|Fmaj7|G|C",pat:"1:B+2@0! 1.25:2@1!h 2:3 2.5:1 3:A 3.5:3 4:1 4.5:3|1:B+3@0! 1.25:3@2!h 2:2 2.5:1 3:A 3.5:2 4:1 4.5:2|1:B+2@1! 1.25:2@3!/ 2:3 2.5:1 3:A 3.5:3 4:1 4.5:3|1:B+2@3! 1.25:2@1!p 2:3 2.5:1 3:A 3.5:3 4:1 4.5:3"},
     {tag:"G",vt:"in G",key:"G",prog:"G|C|D|G",pat:"1:B+3@2! 1.25:3@4!h 2:2 2.5:1 3:A 3.5:2 4:1 4.5:2|1:B+2@0! 1.25:2@1!h 2:3 2.5:1 3:A 3.5:3 4:1 4.5:3|1:B+1@0! 1.25:1@2!h 2:3 2.5:2 3:A 3.5:3 4:2 4.5:3|1:B+1@2! 1.25:1@3!/ 2:3 2.5:2 3:A 3.5:3 4:2 4.5:3"}],
   w:"A quick note just before a melody note, reached by a hammer-on, a slide or a pull-off: the ornaments that give Indian film songs and folk melodies their curl. The thumb plays on the beat with the grace note; the main note follows a sixteenth later.",
   tip:"Grace notes are quick and light. The main note is the one that counts; don't let the ornament steal its time."},
  {id:"7k",t:"Campanella: a harp-like scale",free:1,meter:4,tempo:[50,50],vars:campVars(),
   w:"The G major scale fingered so that every step is on a different string. Each note keeps ringing under the next, like a harp or bells. Notes are held (they overlap) instead of stopping one another.",
   tip:"Keep every fretting finger down until it has to move; the ringing overlap is the whole effect.",
   how:["Learn the fingering: some notes are high up the neck (fret 7 on the D and B strings) while others are open strings.","Pluck each note and leave it ringing.","Then over a G bass: thumb on every other note."]},
  {id:"7l",t:"Artificial and harp harmonics",meter:4,prog:"C|Am|Fmaj7|G",pat:"1:<ah>4.p 1.5:3.a 2:<ah>3.p 2.5:2.a 3:<ah>2.p 3.5:1.a 4:<ah>3.p 4.5:2.a",tempo:[40,80],
   w:"A harmonic on any fretted note: the index finger (i) touches the string lightly 12 frets above the fretted note while the thumb plucks it. Alternate that chime with an ordinary note plucked by a on a higher string, and you get 'harp harmonics', a cascade of bell tones over the chord.",
   tip:"The tab shows the touch point (fret + 12, marked AH). Point the i finger straight at the fret wire and keep it light; pluck with the thumb behind it.",
   how:["First play only the harmonics (p with i touching) on each chord until they ring clearly.","Then add the a-finger notes between them.","Go slowly: a dead harmonic usually means i is pressing too hard or not exactly over the fret."]},
];
/* the new levels go where they belong in the path; new lessons join the end of their level */
{const at=n=>LEVELS.findIndex(L=>L.n.startsWith(n));
  LEVELS.splice(at("Thumb and fingers")+1,0,RH_LEVEL);LEVELS.splice(at("Bass and melody"),0,SV_LEVEL);LEVELS.splice(at("Mastery"),0,MU_LEVEL);
  LEVELS[at("Up the neck")].ls.push(...UP_ADD);LEVELS[at("Expression")].ls.push(...EXP_ADD);}
const ALL=LEVELS.flatMap((L,li)=>L.ls.map(x=>({...x,lv:li})));

/* ===================== Exhaustive exercises =====================
   Every lesson is broken into exercises you tick one by one; a lesson is finished when all of them are.
   · Pattern lessons: the same right-hand pattern in every open-chord key, C G D A E and Am Em Dm, so the thumb
     meets roots on the 6th, 5th and 4th strings. Where a key has no open shape for a chord, the key's own
     open progression is used instead. Blues lessons stay with their dominant-7 chords (E A D G).
   · Barre lessons (level 7): the pattern moved through all 12 keys on E-shape and A-shape barres.
   · Melody-on-top patterns with fixed frets: moved to every open key their chords and frets allow.
   · Songs: learned in stages (melody alone, bass and chords alone, first half, second half, whole piece),
     then the whole piece in a second key.
   · Tasks and retuned lessons stay as one exercise.
   A tick from before the change counts for the lesson's original version ("home" exercise). */
const NOTE={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
const NM=["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const md=x=>((x%12)+12)%12;
function pc(n){const m=/^([A-G][#b]?)([^(]*)(?:\((.*)\))?$/.exec(n);return m?{r:m[1],q:m[2],tag:m[3]||""}:null;}
/* movable barre shapes: E shape (root on string 6) and A shape (root on string 5) */
const EQ={"":[0,2,2,1,0,0],m:[0,2,2,0,0,0],"7":[0,2,0,1,0,0],m7:[0,2,0,0,0,0],maj7:[0,X,1,1,0,X]},
      AQ={"":[X,0,2,2,2,0],m:[X,0,2,2,1,0],"7":[X,0,2,0,2,0],m7:[X,0,2,0,1,0],maj7:[X,0,2,1,2,0]};
function barre(root,q){if(!(q in EQ))return null;const ef=md(NOTE[root]-4)||12,af=md(NOTE[root]-9)||12;
  const useE=Math.abs(ef-5)<=Math.abs(af-5),f=useE?ef:af,sh=(useE?EQ:AQ)[q],name=`${root}${q}(${f})`;
  if(!CH[name])CH[name]=useE?{f:sh.map(x=>x==null?X:x+f),r:[6,f],a:[4,f+2],cl:1}:{f:sh.map(x=>x==null?X:x+f),r:[5,f],a:[4,f+2],cl:1};
  return name;}
const FALL={m:["m7"],maj7:[""],"7":[],m7:["m"],"":["7"]};
function tChord(n,k,bar){if(n==="-")return "-";const c=pc(n);if(!c||/dd|dg/.test(c.tag))return null;
  const r=NM[md(NOTE[c.r]+k)];
  if(c.tag&&CH[n]&&CH[n].cl){if(!bar)return null;if(k===0)return n;return barre(r,c.q);} // a closed shape stays a barre
  for(const q of [c.q,...(FALL[c.q]||[])]){const nm=r+q;if(CH[nm]&&!CH[nm].cl)return nm;}
  return bar?barre(r,c.q):null;}
function tProg(p,k,bar){const out=p.split("|").map(b=>b.split(",").map(x=>tChord(x.trim(),k,bar)));return out.some(b=>b.includes(null))?null:out.map(b=>b.join(",")).join("|");}
/* each key's own open progression, used where a straight move needs a barre */
const TPL={C:["C","Am","Fmaj7","G"],G:["G","Em","C","D"],D:["D","Bm7","G","A"],A:["A","D","E7","A"],E:["E","A","B7","E"],
  Am:["Am","Fmaj7","C","G"],Em:["Em","C","G","D"],Dm:["Dm","C","A7","Dm"]};
CH.Bm7={f:[X,2,0,2,0,2],r:[5,2],a:[4,0]};CH.Cmaj7={f:[X,3,2,0,0,0],r:[5,3],a:[4,2]};CH.Gmaj7={f:[3,2,0,0,0,2],r:[6,3],a:[4,0]};
CH.Dmaj7={f:[X,X,0,2,2,2],r:[4,0],a:[5,0]};CH.Amaj7={f:[X,0,2,1,2,0],r:[5,0],a:[4,2]};CH.Emaj7={f:[0,2,1,1,0,0],r:[6,0],a:[4,2]};
CH.Am7={f:[X,0,2,0,1,0],r:[5,0],a:[4,2]};CH.Em7={f:[0,2,0,0,0,0],r:[6,0],a:[4,2]};CH.Dm7={f:[X,X,0,2,1,1],r:[4,0],a:[5,0]};
/* left-hand fingers for the open shapes, low E to high e (0 open, null not played) */
const FING={C:[X,3,2,0,1,0],G:[2,1,0,0,0,3],Am:[X,0,2,3,1,0],Em:[0,2,3,0,0,0],D:[X,X,0,1,3,2],Dm:[X,X,0,2,3,1],E:[0,2,3,1,0,0],
  A:[X,0,1,2,3,0],E7:[0,2,0,1,0,0],A7:[X,0,2,0,3,0],D7:[X,X,0,2,1,3],G7:[3,2,0,0,0,1],C7:[X,3,2,4,1,0],Fmaj7:[X,X,3,2,1,0],
  B7:[X,2,1,3,0,4],Bm7:[X,1,0,2,0,3],Cmaj7:[X,3,2,0,0,0],Gmaj7:[3,2,0,0,0,1],Dmaj7:[X,X,0,1,2,3],Amaj7:[X,0,2,1,3,0],
  Emaj7:[0,3,1,2,0,0],Am7:[X,0,2,0,1,0],Em7:[0,2,0,0,0,0],Dm7:[X,X,0,2,1,1]};
function tpl(p,T){let i=0;return p.split("|").map(b=>b.split(",").map(x=>x.trim()==="-"?"-":TPL[T][i++%4]).join(",")).join("|");}
const KM=["C","G","D","A","E"],Km=["Am","Em","Dm"],keyPc=K=>NOTE[K.replace(/m$/,"")],isMin=K=>/m$/.test(K);
function homeKey(p){const c=pc(p.split("|").map(x=>x.split(",")[0].trim()).find(x=>x!=="-")||"C");return NM[NOTE[c.r]]+(/^m(?!aj)/.test(c.q)?"m":"");}
const sl=(str,a,b)=>str.split("|").slice(a,b).join("|");
/* notes of a song melody, for keeping a moved melody within reach */
const midi=t=>{const m=/^([A-G][#b]?)(\d)$/.exec(t);return m?(+m[2]+1)*12+NOTE[m[1]]:null;};
const melRange=mel=>{const ms=mel.split(/[|\s]+/).map(t=>midi(t.split(":")[0])).filter(x=>x!=null);return [Math.min(...ms),Math.max(...ms)];};
const BARRE_LV=LEVELS.findIndex(L=>/^Up the neck/.test(L.n)),BLUES_LV=LEVELS.findIndex(L=>/^Blues/.test(L.n));
function expand(L){const one=[{...L,pid:L.id,home:1}];
  if(L.vars)return L.vars.map((v,i)=>({...L,...v,vars:undefined,id:`${L.id}.${v.tag}`,pid:L.id,home:i?0:1})); // exercises written out in full
  if(L.capos){const hk=homeKey(L.prog);return L.capos.map((c,i)=>({...L,id:`${L.id}.c${c}`,pid:L.id,capo:c,vt:`Capo ${c} · sounds in ${NM[md(keyPc(hk)+c)]} major`,home:i?0:1}));}
  if(L.shapes)return L.shapes.map((c,i)=>{ // whole up-and-down cycles only, so the loop goes back to bar 1 on the lowest string
    const n=CH[c].f.filter(x=>x!=null).length,cyc=2*n-2,M=L.meter||4;let k=1;while((k*cyc)%M||k*cyc<4*M)k++;
    return {...L,id:`${L.id}.${c}`,pid:L.id,vt:c,prog:Array(k*cyc/M).fill(c).join("|"),home:i?0:1};});
  if(L.chain){const run=cs=>cs.map(c=>Array(L.rep).fill(c).join("|")).join("|");
    return [...L.chain.map(([t,cs],i)=>({...L,id:`${L.id}.p${i+1}`,pid:L.id,vt:t,prog:run(cs),seq:cs,home:i?0:1})),
      {...L,id:`${L.id}.all`,pid:L.id,vt:"Full chain · all parts",prog:run(L.chain.flatMap(x=>x[1])),seq:L.chain.flatMap(x=>x[1]),home:0}];}
  if(L.progs)return L.progs.map(([k,pr],i)=>({...L,id:`${L.id}.${k.replace(/[^A-Za-z#]/g,"")}`,pid:L.id,vt:`in ${k}`,prog:pr+"|"+pr,home:i?0:1}));
  if(L.pairs)return L.pairs.map(([a,b],i)=>({...L,id:`${L.id}.${a}-${b}`,pid:L.id,vt:`${a} ↔ ${b}`,prog:`${a}|${a}|${b}|${b}|${a}|${a}|${b}|${b}`,home:i?0:1}));
  if(L.task||L.tune)return one;
  if(L.song){const hk=homeKey(L.ch),n=L.mel.split("|").length,ex=[],add=(tag,vt,o)=>ex.push({...L,...o,id:`${L.id}.${tag}`,pid:L.id,vt});
    if(L.style!=="mel")add("m","Stage 1 · melody alone",{style:"mel"});
    if(!["mel","one"].includes(L.style))add("b","Stage 2 · bass and chords alone",{only:"b"});
    if(n>=8){const h=Math.ceil(n/2);add("h1",`Stage 3 · first half (bars 1–${h})`,{mel:sl(L.mel,0,h),ch:sl(L.ch,0,h)});add("h2",`Stage 4 · second half (bars ${h+1}–${n})`,{mel:sl(L.mel,h),ch:sl(L.ch,h)});}
    add("w","Whole piece",{});ex[ex.length-1].home=1;
    const [lo,hi]=melRange(L.mel),tr=L.tr||0;
    for(const k of [5,7,2,10,3,9]){const ch=tProg(L.ch,k,L.ch.split(/[|,]/).some(n=>CH[n.trim()]&&CH[n.trim()].cl));if(!ch)continue;
      const d=[k,k-12].find(d=>hi+tr+d<=69&&lo+tr+d>=50);if(d==null)continue;
      add("k",`Whole piece in ${NM[md(keyPc(hk)+k)]}${isMin(hk)?" minor":" major"}`,{ch,tr:tr+d,key:NM[md(keyPc(hk)+k)]+(isMin(hk)?"m":"")});break;}
    return ex;}
  if(!L.prog||/^[-|\s]+$/.test(L.prog))return one;
  const hk=homeKey(L.prog),out=[],seen=new Set(),push=(K,prog,o)=>{if(!prog||seen.has(prog))return;seen.add(prog);
    out.push({...L,...o,prog,key:K,id:`${L.id}.${K}`,pid:L.id,vt:`${K.replace(/m$/," minor").replace(/^([A-G][#b]?)$/,"$1 major")}`,home:out.length?0:1});};
  if(/@/.test(L.pat+(L.pat2||""))){ // fixed frets move with the key
    const fr=(L.pat+" "+(L.pat2||"")).match(/\d@(\d+)/g).map(x=>+x.split("@")[1]),f0=Math.min(...fr),f1=Math.max(...fr);
    push(hk,L.prog);
    (isMin(hk)?Km:KM).forEach(K=>{const k=md(keyPc(K)-keyPc(hk));if(!k)return;const d=[k,k-12].find(d=>f0+d>=0&&f1+d<=12);if(d==null)return;
      const prog=tProg(L.prog,k,false);if(!prog)return;const mv=x=>x&&x.replace(/(\d)@(\d+)/g,(_,s,f)=>`${s}@${+f+d}`);
      push(K,prog,{pat:mv(L.pat),pat2:mv(L.pat2)});});
    return out;}
  if(L.lv===BARRE_LV||L.prog.split(/[|,]/).some(n=>CH[n.trim()]&&CH[n.trim()].cl)){for(let i=0;i<12;i++){const k=md(i*7),K=NM[md(keyPc(hk)+k)]+(isMin(hk)?"m":"");push(K,tProg(L.prog,k,true));}return out;}
  const blues=L.lv===BLUES_LV||L.swing;
  push(hk,L.prog);
  [...KM,...Km].forEach(K=>{const k=md(keyPc(K)-keyPc(hk));
    if(isMin(K)===isMin(hk)){const p=tProg(L.prog,k,false);if(p){push(K,p);return;}}
    if(!blues)push(K,tpl(L.prog,K),{alt:1});});
  return out;}
ALL.forEach(L=>{L.ex=expand(L).map(e=>({...e,ex:undefined}));});
const EX=ALL.flatMap(L=>L.ex);
/* progress from a done map {id:date}. A level opens when the level before it is finished, or when you have
   already ticked an exercise in it (so lessons added to earlier levels later never lock what you reached). */
function progress(done){done=done||{};
  const exDone=e=>!!(done[e.id]||(e.home&&done[e.pid]));
  const lessonDone=L=>L.ex.every(exDone);
  const levelDone=li=>ALL.filter(x=>x.lv===li).every(lessonDone);
  const unlocked=li=>li===0||levelDone(li-1)||ALL.some(x=>x.lv===li&&x.ex.some(exDone));
  let level=LEVELS.findIndex((L,li)=>unlocked(li)&&!levelDone(li));if(level<0)level=LEVELS.length-1;
  const next=EX.find(x=>unlocked(x.lv)&&!exDone(x))||null;
  const n=EX.filter(exDone).length;
  return {levelDone,unlocked,lessonDone,exDone,level,next,n,total:EX.length,lessons:ALL.length};}
const lvNo=li=>LEVELS[0].zero?li:li+1;
window.FSC={TUNINGS,CH,FING,LEVELS,ALL,EX,progress,lvNo};
})();
