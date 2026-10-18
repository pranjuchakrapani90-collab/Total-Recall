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
   Task lessons ("task"): steps to do away from the tab (arranging your own tune, performing). */
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

const LEVELS=[
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
const ALL=LEVELS.flatMap((L,li)=>L.ls.map(x=>({...x,lv:li})));
/* progress from a done map {id:date}. A level opens when the level before it is finished, or when you have
   already ticked a lesson in it (so lessons added to earlier levels later never lock what you reached). */
function progress(done){done=done||{};
  const levelDone=li=>LEVELS[li].ls.every(x=>done[x.id]);
  const unlocked=li=>li===0||levelDone(li-1)||LEVELS[li].ls.some(x=>done[x.id]);
  let level=LEVELS.findIndex((L,li)=>unlocked(li)&&!levelDone(li));if(level<0)level=LEVELS.length-1;
  const next=ALL.find(x=>unlocked(x.lv)&&!done[x.id])||null;
  const n=ALL.filter(x=>done[x.id]).length;
  return {levelDone,unlocked,level,next,n,total:ALL.length};}
window.FSC={TUNINGS,CH,LEVELS,ALL,progress};
})();
