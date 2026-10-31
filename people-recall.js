/* People Recall v2 — one-tap daily practice with honest grading.
   - Today's plan: names due again first, then new names, up to a daily goal.
   - Three answers after "Show": Forgot (back tomorrow, asked again at the end of this session),
     Hazy (same gap again), Knew it (gap grows 1·3·7·14·30·60·120·180 days).
   - The schedule is worked out from each person's history, so the two phones agree after sync.
     Old "Recalled" entries count as "Knew it".
   - Office roster CSVs (Name, Designation, Duty, Phone, Hook …) attach details to names you already
     have and add the rest. Details live only in your synced data, never in this public code.
   Uses window.PeopleBridge (index.html) and window.PeopleHooks (people-hooks.js). */
(function(){
'use strict';
var PR=window.PeopleBridge,PH=window.PeopleHooks||{};
function $(id){return document.getElementById(id)}
function esc(s){return PR.esc(s==null?'':s)}
var GROUPS=window.PEOPLE_GROUPS||[];
var IV=[1,3,7,14,30,60,120,180];
var K_GOAL='prGoal_v1',K_FOCUS='prFocus_v1',K_DIR='prDir_v1';
function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function keyOf(n){return String(n||'').trim().replace(/\s+/g,' ').toLowerCase()}
function groupsOf(p){return p&&Array.isArray(p.groups)?p.groups:[]}
function hist(p){return p&&Array.isArray(p.history)?p.history:[]}
function nowIso(){return new Date().toISOString()}
function dayOf(d){var x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2)}
function today(){return dayOf(Date.now())}
function addDays(day,n){var p=day.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]+n);return dayOf(d)}
function daysBetween(a,b){var pa=a.split('-'),pb=b.split('-');return Math.round((new Date(+pb[0],+pb[1]-1,+pb[2])-new Date(+pa[0],+pa[1]-1,+pa[2]))/864e5)}
function goal(){var g=parseInt(lsGet(K_GOAL,'20'),10);return g>0&&g<500?g:20}
function gap(n){return n>=30?Math.round(n/30)+' mo':n+' d'}

/* ---------- schedule, worked out from history ---------- */
function sched(p){
  var h=hist(p).filter(function(e){return e&&e.date&&!e.rl}).slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  var lvl=-1,iv=0,lapses=0,lastG=0,last='';
  h.forEach(function(e){var g=e.g||3;if(g===1){lvl=0;iv=1;lapses++}else if(g===2){lvl=Math.max(lvl,0);iv=IV[lvl]}else{lvl=Math.min(lvl+1,7);iv=IV[lvl]}lastG=g;last=e.date});
  if(!h.length)return {isNew:true,lvl:-1,reviews:0,lapses:0};
  var dueDay=addDays(dayOf(last),iv);
  return {isNew:false,lvl:lvl,iv:iv,reviews:h.length,lapses:lapses,lastG:lastG,last:last,dueDay:dueDay,due:dueDay<=today()};
}
function nextGaps(p){var s=sched(p),l=s.lvl;return {1:1,2:IV[Math.max(l,0)],3:IV[Math.min(l+1,7)]}}
function hasInfo(p){var i=p&&p.info;return !!(i&&(i.desig||i.duty||i.phone||i.emp))}
function hasClue(p){return hasInfo(p)||groupsOf(p).length||!!(p&&p.note)}

/* ---------- focus (which names) ---------- */
function focusList(){
  var f=lsGet(K_FOCUS,''),a=Object.values(PR.db.people);
  if(!f)return a;
  if(f==='__staff')return a.filter(hasInfo);
  if(f==='__weak')return a.filter(function(p){var s=sched(p);return !s.isNew&&(s.lapses>0||s.lastG<3)});
  if(f==='__none')return a.filter(function(p){return !groupsOf(p).length});
  if(f==='__new')return a.filter(function(p){return p.addedAt&&(Date.now()-new Date(p.addedAt).getTime())<30*864e5});
  return a.filter(function(p){return groupsOf(p).indexOf(f)>=0});
}
function reviewedToday(){var t=today(),n=0;Object.values(PR.db.people).forEach(function(p){hist(p).forEach(function(e){if(e&&e.date&&!e.rl&&dayOf(e.date)===t)n++})});return n}
function streak(){
  var days={};Object.values(PR.db.people).forEach(function(p){hist(p).forEach(function(e){if(e&&e.date)days[dayOf(e.date)]=1})});
  var d=today(),n=0;if(!days[d])d=addDays(d,-1);while(days[d]){n++;d=addDays(d,-1)}return n;
}
function plan(){
  var a=focusList(),due=[],fresh=[];
  a.forEach(function(p){var s=sched(p);if(s.isNew)fresh.push(p);else if(s.due)due.push({p:p,d:s.dueDay})});
  due.sort(function(x,y){return x.d.localeCompare(y.d)});
  return {due:due.map(function(x){return x.p}),fresh:fresh};
}
window.PeopleToday=function(){
  try{var pl=plan(),done=reviewedToday(),left=Math.max(0,goal()-done);left=Math.min(left,pl.due.length+pl.fresh.length);return {left:left,done:done,due:pl.due.length,fresh:pl.fresh.length}}catch(e){return {left:0}}
};

/* ---------- home panel ---------- */
var FOCUS_OPTS=function(){return [['','All'],['__staff','Office staff'],['__weak','Weak ones'],['__new','Added lately'],['__none','No hook yet']].concat(GROUPS.map(function(g){return [g,g]}))};
function buildPanel(){
  var card=$('cardPeople');if(!card||$('prHome'))return;
  var keep=document.createElement('div');keep.className='prLegacy';keep.hidden=true;
  Array.prototype.slice.call(card.children).forEach(function(ch){if(ch.id!=='tools'&&ch.tagName!=='H3')keep.appendChild(ch)});
  var tools=$('tools');
  var home=document.createElement('div');home.id='prHome';
  home.innerHTML=
    '<div class="prSearch"><input id="prQ" type="search" placeholder="Who is…?  name, place, duty, note" autocomplete="off"><div id="prQOut"></div></div>'+
    '<div class="prToday"><div class="prRing" id="prRing"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="bg"/><circle cx="22" cy="22" r="19" class="fg" id="prRingFg"/></svg><b id="prLeft">0</b><small id="prLeftLbl">left today</small></div>'+
    '<div class="prTodayTxt"><div id="prLine1" class="prL1"></div><div id="prLine2" class="prL2"></div></div></div>'+
    '<button id="prStart" class="prBig">Start ▸</button>'+
    '<div class="prLbl">Practise</div><div class="prChips" id="prFocus"></div>'+
    '<div class="prDir" id="prDir"><button data-dir="name">Name → who</button><button data-dir="clue">Clue → name</button></div>'+
    '<div class="prBar"><i id="prBarFill"></i></div><div class="prL2" id="prProg"></div>'+
    '<details class="prMore"><summary>Manage names · daily goal</summary><label class="prGoal">Names per day <input id="prGoalIn" type="number" min="5" max="200" step="5"></label><div id="prToolsSlot"></div></details>';
  card.appendChild(home);card.appendChild(keep);
  if(tools){tools.classList.remove('hidden');$('prToolsSlot').appendChild(tools)}
  $('prGoalIn').value=goal();
  $('prGoalIn').addEventListener('change',function(){var v=parseInt(this.value,10);if(v>0){lsSet(K_GOAL,String(v));renderPanel()}});
  $('prStart').addEventListener('click',function(){startSession(false)});
  $('prFocus').addEventListener('click',function(e){var b=e.target.closest('[data-f]');if(!b)return;lsSet(K_FOCUS,decodeURIComponent(b.dataset.f));renderPanel()});
  $('prDir').addEventListener('click',function(e){var b=e.target.closest('[data-dir]');if(!b)return;lsSet(K_DIR,b.dataset.dir);renderPanel()});
  $('prQ').addEventListener('input',quickSearch);
  $('prQOut').addEventListener('click',onQuickClick);
}
function renderPanel(){
  if(!$('prHome'))return;
  var all=Object.values(PR.db.people),t=window.PeopleToday(),g=goal(),st=streak(),f=lsGet(K_FOCUS,''),dir=lsGet(K_DIR,'name');
  var learned=0,strong=0;all.forEach(function(p){var s=sched(p);if(!s.isNew){learned++;if(s.lvl>=4)strong++}});
  $('prLeft').textContent=t.left;$('prLeftLbl').textContent=t.left?'left today':(t.done?'goal done':'all clear');
  var frac=Math.min(1,t.done/g),C=2*Math.PI*19;$('prRingFg').setAttribute('stroke-dasharray',(C*frac).toFixed(1)+' '+C.toFixed(1));
  $('prLine1').textContent=(st?'🔥 '+st+'-day streak':'Start a streak today')+' · '+t.done+' of '+g+' done';
  $('prLine2').textContent=t.due+' due again · '+t.fresh.toLocaleString('en-IN')+' not met yet'+(f?' (in this focus)':'');
  var b=$('prStart');
  if(t.left){b.textContent=t.done?'Continue ▸ '+t.left+' more':'Start today’s '+t.left+' ▸';b.dataset.extra=''}
  else if(t.due+t.fresh){b.textContent='Goal done ✓ — another '+Math.min(g,t.due+t.fresh)+' ▸'}
  else b.textContent=all.length?'All caught up ✓ — practise anyway ▸':'Import names first';
  $('prFocus').innerHTML=FOCUS_OPTS().map(function(o){var n=o[0]===f;return '<button class="prChip'+(n?' on':'')+'" data-f="'+encodeURIComponent(o[0])+'">'+esc(o[1])+'</button>'}).join('');
  Array.prototype.forEach.call($('prDir').children,function(x){x.classList.toggle('on',x.dataset.dir===dir)});
  $('prBarFill').style.width=(all.length?learned/all.length*100:0).toFixed(1)+'%';
  $('prProg').textContent=learned.toLocaleString('en-IN')+' of '+all.length.toLocaleString('en-IN')+' names met · '+strong.toLocaleString('en-IN')+' strong (a month or more)';
  if($('prQ').value)quickSearch();
}
window.peopleRenderPanel=renderPanel;

/* ---------- "Who is…?" quick search ---------- */
function infoLine(p){var i=p.info||{};return [i.desig,i.duty].filter(Boolean).join(' · ')}
function matchText(p){var i=p.info||{};return (p.name+' '+(p.note||'')+' '+groupsOf(p).join(' ')+' '+[i.desig,i.duty,i.emp,i.phone].join(' ')).toLowerCase()}
function quickSearch(){
  var q=$('prQ').value.trim().toLowerCase(),out=$('prQOut');if(!q){out.innerHTML='';return}
  var words=q.split(/\s+/),hits=Object.values(PR.db.people).filter(function(p){var t=matchText(p);return words.every(function(w){return t.indexOf(w)>=0})});
  hits.sort(function(a,b){var an=a.name.toLowerCase().indexOf(q)===0?0:1,bn=b.name.toLowerCase().indexOf(q)===0?0:1;return an-bn||a.name.localeCompare(b.name)});
  out.innerHTML='<div class="prQn">'+hits.length+' found'+(hits.length>30?' · showing 30':'')+'</div>'+hits.slice(0,30).map(function(p){var k=encodeURIComponent(keyOf(p.name)),gs=groupsOf(p),il=infoLine(p);return '<div class="prHit" data-k="'+k+'"><div class="prHitTop"><b>'+esc(p.name)+'</b>'+(gs.length?'<span>'+esc(gs.join(' · '))+'</span>':'')+'</div>'+(il?'<div class="prHitInfo">'+esc(il)+'</div>':'')+(p.note?'<div class="prHitInfo">'+esc(p.note)+'</div>':'')+'<div class="prHitEd"></div></div>'}).join('');
}
function onQuickClick(e){
  if(e.target.closest('.prEd'))return;
  var hit=e.target.closest('.prHit');if(!hit)return;var slot=hit.querySelector('.prHitEd');
  if(slot.innerHTML){slot.innerHTML='';return}
  var p=PR.db.people[decodeURIComponent(hit.dataset.k)];if(p)slot.innerHTML=editorHtml(p,true);
}

/* ---------- editor: hooks (tap = saved), note, office details ---------- */
function editorHtml(p,full){
  var gs=groupsOf(p),i=p.info||{},k=esc(keyOf(p.name));
  var h='<div class="prEd" data-k="'+k+'">';
  if(hasInfo(p))h+='<div class="prInfo">'+(i.desig?'<div><b>'+esc(i.desig)+'</b>'+(i.emp?' <span>· '+esc(i.emp)+'</span>':'')+'</div>':'')+(i.duty?'<div>'+esc(i.duty)+'</div>':'')+(i.phone?'<div class="prCall"><a href="tel:'+esc(i.phone.replace(/\s/g,''))+'">📞 '+esc(i.phone)+'</a><a href="https://wa.me/91'+esc(i.phone.replace(/\D/g,'').slice(-10))+'" target="_blank" rel="noopener">WhatsApp</a></div>':'')+'</div>';
  h+='<div class="prChips prHooks">'+GROUPS.map(function(g){return '<button type="button" class="prChip'+(gs.indexOf(g)>=0?' on':'')+'" data-g="'+esc(g)+'">'+esc(g)+'</button>'}).join('')+'</div>';
  h+='<textarea class="prNote" rows="2" placeholder="How you know them — place, relation, last met…">'+esc(p.note||'')+'</textarea>';
  if(full)h+='<details class="prInfoEd"><summary>Office details</summary><input data-i="desig" placeholder="Designation" value="'+esc(i.desig||'')+'"><input data-i="duty" placeholder="Duty / place" value="'+esc(i.duty||'')+'"><input data-i="phone" placeholder="Phone" inputmode="tel" value="'+esc(i.phone||'')+'"></details>';
  h+='<div class="prSaved"></div></div>';return h;
}
function flash(ed,msg){var s=ed.querySelector('.prSaved');if(s){s.textContent=msg;clearTimeout(s._t);s._t=setTimeout(function(){s.textContent=''},1400)}}
document.addEventListener('click',function(e){
  var c=e.target.closest('.prEd .prHooks .prChip');if(!c)return;
  var ed=c.closest('.prEd'),p=PR.db.people[ed.dataset.k];if(!p)return;
  c.classList.toggle('on');p.groups=Array.prototype.map.call(ed.querySelectorAll('.prHooks .prChip.on'),function(x){return x.dataset.g});p.groupsAt=nowIso();
  PR.save();flash(ed,'Saved ✓');var hn=ed.parentNode&&ed.parentNode.querySelector('.prHint');if(hn)hn.remove();
});
document.addEventListener('change',function(e){
  var ed=e.target.closest&&e.target.closest('.prEd');if(!ed)return;var p=PR.db.people[ed.dataset.k];if(!p)return;
  if(e.target.classList.contains('prNote')){var v=e.target.value.trim();if(v!==(p.note||'')){p.note=v;p.noteAt=nowIso();PR.save();flash(ed,'Note saved ✓')}}
  else if(e.target.dataset.i){p.info=Object.assign({},p.info||{});p.info[e.target.dataset.i]=e.target.value.trim();p.infoAt=nowIso();PR.save();flash(ed,'Saved ✓')}
});

/* ---------- session ---------- */
var S=null;
function buildSession(){
  if($('prSession'))return;
  var sec=document.createElement('section');sec.id='prSession';sec.className='hidden';
  sec.innerHTML='<div class="prS"><div class="prTop"><button id="prQuit" class="prGhost">✕</button><div class="prPBar"><i id="prPFill"></i></div><span id="prPTxt"></span></div>'+
    '<div class="prCard" id="prCard"><div class="prTag" id="prTag"></div><div class="prFront" id="prFront"></div><div class="prAsk" id="prAsk"></div><div class="prBack hidden" id="prBack"></div></div>'+
    '<div class="prActs"><button id="prShow" class="prBig">Show</button><div id="prGrades" class="prGrades hidden"><button data-g="1" class="g1">Forgot<small></small></button><button data-g="2" class="g2">Hazy<small></small></button><button data-g="3" class="g3">Knew it<small></small></button></div></div>'+
    '<div class="prFoot"><button id="prUndo" class="prGhost">↶ Undo</button><button id="prDel" class="prGhost prDanger">Delete name</button></div></div>'+
    '<div class="prS hidden" id="prEnd"><div class="prEndBig" id="prEndBig"></div><div class="prEndTxt" id="prEndTxt"></div><button id="prAgain" class="prBig">Another round ▸</button><button id="prEndHome" class="prGhost prWide">Back to People</button></div>';
  var ref=$('session');ref.parentNode.insertBefore(sec,ref.nextSibling);
  $('prQuit').addEventListener('click',endSession);
  $('prShow').addEventListener('click',reveal);
  $('prCard').addEventListener('click',function(e){if(S&&!S.shown&&!e.target.closest('.prEd'))reveal()});
  $('prGrades').addEventListener('click',function(e){var b=e.target.closest('[data-g]');if(b)grade(+b.dataset.g)});
  $('prUndo').addEventListener('click',undo);
  $('prDel').addEventListener('click',delCurrent);
  $('prAgain').addEventListener('click',function(){startSession(true)});
  $('prEndHome').addEventListener('click',goHome);
  document.addEventListener('keydown',function(e){if(!S||$('prSession').classList.contains('hidden')||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(!S.shown&&(e.key===' '||e.key==='Enter')){e.preventDefault();reveal()}else if(S.shown&&/^[123]$/.test(e.key))grade(+e.key)});
}
function startSession(){
  var all=Object.values(PR.db.people);if(!all.length){alert('Import some names first (Manage names).');return}
  var pl=plan(),done=reviewedToday(),n=Math.max(goal()-done,0)||goal(),q=pl.due.concat(shuffle(pl.fresh)).slice(0,n);
  if(!q.length){q=shuffle(focusList().slice()).slice(0,goal());if(!q.length){alert('No names in this focus yet.');return}}
  S={q:q.map(function(p){return {k:keyOf(p.name),rl:false}}),i:0,shown:false,dir:lsGet(K_DIR,'name'),tally:{1:0,2:0,3:0},undo:[],relearn:{}};
  ['home','session','done'].forEach(function(id){if($(id))$(id).classList.add('hidden')});
  $('prEnd').classList.add('hidden');$('prSession').querySelector('.prS').classList.remove('hidden');$('prSession').classList.remove('hidden');
  window.scrollTo(0,0);draw();
}
function shuffle(a){for(var j=a.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1)),t=a[j];a[j]=a[k];a[k]=t}return a}
function cur(){return S&&S.q[S.i]?PR.db.people[S.q[S.i].k]:null}
function draw(){
  while(S.i<S.q.length&&!PR.db.people[S.q[S.i].k])S.q.splice(S.i,1);
  if(S.i>=S.q.length){finish();return}
  var it=S.q[S.i],p=cur(),s=sched(p),clue=S.dir==='clue'&&hasClue(p);
  S.shown=false;S.clue=clue;
  $('prPFill').style.width=(S.i/S.q.length*100)+'%';$('prPTxt').textContent=(S.i+1)+' / '+S.q.length;
  $('prTag').textContent=it.rl?'Once more — you forgot this one':s.isNew?'New':s.lapses?'Tricky · seen '+s.reviews+'×':'Seen '+s.reviews+'× · every '+gap(s.iv);
  $('prTag').className='prTag'+(it.rl||s.lapses?' warn':s.isNew?' new':'');
  if(clue){var i=p.info||{},bits=[];if(i.desig)bits.push(i.desig);if(i.duty)bits.push(i.duty);if(groupsOf(p).length)bits.push(groupsOf(p).join(' · '));if(p.note)bits.push(p.note);
    $('prFront').className='prFront clue';$('prFront').innerHTML=bits.map(function(b){return '<div>'+esc(b)+'</div>'}).join('');$('prAsk').textContent='Who is this? Say the name, then tap Show';}
  else{$('prFront').className='prFront';$('prFront').textContent=p.name;$('prAsk').textContent='Who is this? How do you know them? Think, then tap Show';}
  $('prFront').classList.remove('hidden');$('prBack').classList.add('hidden');$('prBack').innerHTML='';$('prAsk').classList.remove('hidden');
  $('prShow').classList.remove('hidden');$('prGrades').classList.add('hidden');
  $('prUndo').disabled=!S.undo.length;
}
function reveal(){
  if(!S||S.shown)return;var p=cur();if(!p)return;S.shown=true;
  var head=S.clue?'<div class="prName">'+esc(p.name)+'</div>':'';
  var empty=!hasClue(p)?'<div class="prHint">No hook yet — tap the groups below that fit, or add a note. It saves as you tap.</div>':'';
  if(S.clue)$('prFront').classList.add('hidden');$('prBack').innerHTML=head+empty+editorHtml(p,false);$('prBack').classList.remove('hidden');$('prAsk').classList.add('hidden');
  var g=nextGaps(p),bs=$('prGrades').querySelectorAll('small'),it=S.q[S.i];
  bs[0].textContent=it.rl?'again now':'tomorrow + now';bs[1].textContent=it.rl?'—':gap(g[2]);bs[2].textContent=it.rl?'—':gap(g[3]);
  if(it.rl){bs[0].textContent='again';bs[1].textContent='ok';bs[2].textContent='got it'}
  $('prShow').classList.add('hidden');$('prGrades').classList.remove('hidden');
}
function grade(g){
  if(!S||!S.shown)return;var it=S.q[S.i],p=cur();if(!p)return;
  var e={date:nowIso(),note:g===1?'Forgot':g===2?'Hazy':'Knew it',g:g};if(it.rl)e.rl=1;
  p.history=p.history||[];p.history.push(e);
  var added=false;
  if(g===1&&(!S.relearn[it.k]||S.relearn[it.k]<2)){S.relearn[it.k]=(S.relearn[it.k]||0)+1;S.q.push({k:it.k,rl:true});added=true}
  if(!it.rl)S.tally[g]++;
  S.undo.push({i:S.i,k:it.k,date:e.date,g:g,rl:it.rl,added:added});
  PR.save();S.i++;draw();
}
function undo(){
  if(!S||!S.undo.length)return;var u=S.undo.pop(),p=PR.db.people[u.k];
  if(p)p.history=hist(p).filter(function(e){return e.date!==u.date});
  if(u.added){S.q.pop();S.relearn[u.k]--}
  if(!u.rl)S.tally[u.g]--;
  S.i=u.i;PR.save();$('prEnd').classList.add('hidden');$('prSession').querySelector('.prS').classList.remove('hidden');draw();
}
function delCurrent(){
  var p=cur();if(!p||!confirm('Delete '+p.name+' and their recall history on both phones?'))return;
  var k=keyOf(p.name);PR.db.deletedPeople=PR.db.deletedPeople||{};PR.db.deletedPeople[k]=nowIso();delete PR.db.people[k];
  S.q=S.q.filter(function(x,j){return j<S.i||x.k!==k});PR.save();draw();
}
function finish(){
  $('prSession').querySelector('.prS').classList.add('hidden');$('prEnd').classList.remove('hidden');
  var t=S.tally,n=t[1]+t[2]+t[3],T=window.PeopleToday();
  $('prEndBig').textContent=n?(t[3]===n?'Perfect round 🎯':'Round done ✓'):'Done';
  $('prEndTxt').innerHTML='<div class="prTally"><span class="g3">'+t[3]+' knew</span><span class="g2">'+t[2]+' hazy</span><span class="g1">'+t[1]+' forgot</span></div>'+
    (t[1]?'<p>The ones you forgot come back tomorrow.</p>':'')+'<p>'+(T.left?T.left+' left for today’s goal.':'Today’s goal of '+goal()+' is done. 🔥 '+streak()+'-day streak.')+'</p>';
  $('prAgain').textContent=T.left?'Next '+T.left+' ▸':'Another round anyway ▸';
}
function endSession(){if(S&&S.i>0&&S.i<S.q.length&&!confirm('Stop here? Answers so far are saved.'))return;goHome()}
function goHome(){S=null;$('prSession').classList.add('hidden');if($('home'))$('home').classList.remove('hidden');PR.render();renderPanel()}

/* ---------- office roster import (CSV with Name + Designation / Duty / Phone / Hook …) ---------- */
var R=null;
function col(heads,re){for(var i=0;i<heads.length;i++)if(re.test(heads[i]))return i;return -1}
function bestMatch(name){
  var people=PR.db.people,k=keyOf(name);if(people[k])return {k:k,exact:true};
  var tk=PH.tokens?PH.tokens(name):k.split(' '),best=null,bestExtra=99;if(tk.length<2)return null;
  Object.keys(people).forEach(function(pk){var et=PH.tokens?PH.tokens(people[pk].name):pk.split(' ');if(et.length<2)return;
    var ok=(PH.subset&&PH.subset(tk,et))||(PH.subset&&PH.subset(et,tk));
    if(!ok&&PH.lev){var a=tk.join(''),b=et.join('');ok=a.length>=7&&a[0]===b[0]&&PH.lev(a,b)<=1}
    if(ok){var extra=Math.abs(et.length-tk.length);if(extra<bestExtra){best=pk;bestExtra=extra}}});
  return best?{k:best,exact:false}:null;
}
window.peopleRosterImport=function(rows,src){
  var heads=(rows[0]||[]).map(function(h){return String(h||'').trim().toLowerCase()});
  var ni=col(heads,/^(full )?name/),di=col(heads,/designation|post|role/),ui=col(heads,/duty|work|remark|place|office/),phi=col(heads,/phone|mobile|contact no/),hi=col(heads,/hook|group/),noi=col(heads,/^note/),ei=col(heads,/employment|regular|type/);
  if(ni<0||(di<0&&ui<0&&phi<0&&hi<0))return false;
  var dead=PR.db.deletedPeople||{},items=[],seen={};
  rows.slice(1).forEach(function(r){var name=String(r[ni]||'').replace(/^(sri|smti|shri|md\.?)\s+/i,'').replace(/\(os\)/i,'').trim().replace(/\s+/g,' ');if(!name||seen[name.toLowerCase()])return;seen[name.toLowerCase()]=1;
    if(name===name.toUpperCase())name=name.toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase()});
    var info={desig:di>=0?r[di]||'':'',duty:ui>=0?r[ui]||'':'',phone:phi>=0?r[phi]||'':'',emp:ei>=0?r[ei]||'':''};
    var hook=hi>=0&&GROUPS.indexOf(r[hi])>=0?r[hi]:'',m=bestMatch(name);
    items.push({name:name,info:info,hook:hook,note:noi>=0?r[noi]||'':'',m:m,dead:!m&&!!dead[keyOf(name)]})});
  R={src:src,items:items};
  var ex=items.filter(function(x){return x.m&&x.m.exact}).length,near=items.filter(function(x){return x.m&&!x.m.exact}).length,fresh=items.length-ex-near;
  var h='<div class="imp"><b>Office roster · '+esc(src)+'</b><p class="impSum"><span>'+ex+' already in your list</span><span>'+near+' look like a name you have</span><span>'+fresh+' new</span></p><p class="muted">Details (designation, duty, phone) go onto the matching name. Check the "looks like" rows.</p><div class="impList">'+
    items.map(function(x,i){var lab=x.m?(x.m.exact?'Add details':'Add to “'+esc(PR.db.people[x.m.k].name)+'”'):'Add as new';
      return '<div class="impRow'+(x.m&&!x.m.exact?' dup':'')+'"><span><b>'+esc(x.name)+'</b> <small>'+esc([x.info.desig,x.info.duty].filter(Boolean).join(' · '))+'</small></span><select data-ri="'+i+'"><option value="link"'+(x.m?' selected':'')+(x.m?'':' disabled')+'>'+(x.m?lab:'—')+'</option><option value="new"'+(!x.m&&!x.dead?' selected':'')+'>Add as new name</option><option value="skip"'+(x.dead?' selected':'')+'>Skip</option></select></div>'}).join('')+
    '</div><div class="row"><button id="rosterAdd">Apply</button><button class="secondary" id="rosterCancel">Cancel</button></div></div>';
  var box=$('importPreview');box.innerHTML=h;box.scrollIntoView({behavior:'smooth',block:'start'});
  return true;
};
document.addEventListener('click',function(e){
  if(e.target.id==='rosterCancel'){R=null;$('importPreview').innerHTML='';return}
  if(e.target.id!=='rosterAdd'||!R)return;
  var ts=nowIso(),linked=0,added=0;
  Array.prototype.forEach.call(document.querySelectorAll('#importPreview [data-ri]'),function(sel){var x=R.items[+sel.dataset.ri],v=sel.value,p;if(!x||v==='skip')return;
    if(v==='link'&&x.m){p=PR.db.people[x.m.k];linked++}else{var k=keyOf(x.name);p=PR.db.people[k];if(!p){p=PR.db.people[k]={name:x.name,history:[],sources:[],addedAt:ts};added++}if(PR.db.deletedPeople)delete PR.db.deletedPeople[k]}
    if(!p)return;p.info=Object.assign({},p.info||{},Object.keys(x.info).reduce(function(o,f){if(x.info[f])o[f]=x.info[f];return o},{}));p.infoAt=ts;
    p.sources=p.sources||[];if(p.sources.indexOf(R.src)<0)p.sources.push(R.src);
    if(x.hook&&groupsOf(p).indexOf(x.hook)<0){p.groups=groupsOf(p).concat([x.hook]);p.groupsAt=ts}
    if(x.note&&!p.note){p.note=x.note;p.noteAt=ts}});
  R=null;PR.save();PR.render();$('importPreview').innerHTML='<div class="imp"><b>Done.</b> Details added to '+linked+' names, '+added+' new names added. Pick “Office staff” under Practise to start on them.</div>';
});

/* ---------- styles ---------- */
var css=document.createElement('style');css.textContent=
'#cardPeople{flex-direction:column}#prHome{display:flex;flex-direction:column;gap:12px;width:100%}'+
'#prHome button,#prSession button{min-width:0;font:inherit;cursor:pointer;white-space:normal}'+
'.prSearch input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--tr-line,#e6e3db);border-radius:12px;font-size:16px;background:#fff}'+
'.prQn{font-size:12px;color:var(--tr-muted,#6b6a64);margin:8px 2px}.prHit{border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:10px 12px;margin-bottom:6px;background:#fff;cursor:pointer}'+
'.prHitTop{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.prHitTop span{font-size:12px;color:var(--tr-acc-ink,#3730a3)}.prHitInfo{font-size:13px;color:var(--tr-muted,#6b6a64);margin-top:2px}'+
'.prToday{display:flex;gap:14px;align-items:center;background:var(--tr-soft,#f0eee8);border-radius:14px;padding:12px 14px}'+
'.prRing{position:relative;width:78px;height:78px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center}.prRing svg{position:absolute;inset:0;transform:rotate(-90deg)}'+
'.prRing circle{fill:none;stroke-width:4}.prRing .bg{stroke:#e2dfd6}.prRing .fg{stroke:var(--tr-acc,#4f46e5);stroke-linecap:round;transition:stroke-dasharray .4s}.prRing b{font-size:24px;line-height:1;position:relative}.prRing small{font-size:10px;color:var(--tr-muted,#6b6a64);position:relative}'+
'.prL1{font-weight:650;font-size:14px}.prL2{font-size:12.5px;color:var(--tr-muted,#6b6a64);margin-top:3px}'+
'.prBig{display:block;width:100%;padding:15px!important;border-radius:14px!important;border:0!important;background:var(--tr-acc,#4f46e5)!important;color:#fff!important;font-size:16px!important;font-weight:700!important}'+
'.prLbl{font-size:12px;font-weight:650;color:var(--tr-muted,#6b6a64);margin-bottom:-6px}'+
'.prChips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.prChips::-webkit-scrollbar{display:none}.prHooks{flex-wrap:wrap;overflow:visible}'+
'.prChip{flex:none;border:1px solid var(--tr-line,#e6e3db)!important;background:#fff!important;color:var(--tr-ink,#1c1b19)!important;border-radius:999px!important;padding:7px 12px!important;font-size:13px!important;font-weight:550!important}'+
'.prChip.on{background:var(--tr-acc,#4f46e5)!important;border-color:var(--tr-acc,#4f46e5)!important;color:#fff!important}'+
'.prDir{display:grid;grid-template-columns:1fr 1fr;background:var(--tr-soft,#f0eee8);border-radius:12px;padding:3px}.prDir button{border:0!important;background:transparent!important;color:var(--tr-muted,#6b6a64)!important;padding:9px!important;border-radius:10px!important;font-size:13px!important;font-weight:650!important}.prDir button.on{background:#fff!important;color:var(--tr-ink,#1c1b19)!important;box-shadow:0 1px 3px #0001}'+
'.prBar{height:6px;background:#e2dfd6;border-radius:9px;overflow:hidden}.prBar i{display:block;height:100%;background:#16a34a;border-radius:9px}'+
'.prMore{border-top:1px solid var(--tr-line,#e6e3db);padding-top:10px}.prMore summary{font-size:13px;font-weight:650;color:var(--tr-muted,#6b6a64);cursor:pointer}.prGoal{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:14px}.prGoal input{width:80px;padding:8px;border:1px solid var(--tr-line,#e6e3db);border-radius:8px}'+
'#prSession{max-width:620px;margin:0 auto;padding:12px 14px calc(18px + env(safe-area-inset-bottom,0px))}.prS{display:flex;flex-direction:column;gap:12px;min-height:calc(100vh - 140px)}'+
'.prTop{display:flex;align-items:center;gap:10px}.prPBar{flex:1;height:8px;background:#e2dfd6;border-radius:9px;overflow:hidden}.prPBar i{display:block;height:100%;background:var(--tr-acc,#4f46e5);transition:width .3s}#prPTxt{font-size:13px;color:var(--tr-muted,#6b6a64);font-variant-numeric:tabular-nums}'+
'.prGhost{border:0!important;background:transparent!important;color:var(--tr-muted,#6b6a64)!important;padding:8px 10px!important;font-size:14px!important;font-weight:600!important}.prGhost:disabled{opacity:.35}.prDanger{color:#b91c1c!important}.prWide{width:100%}'+
'.prCard{flex:1;background:#fff;border:1px solid var(--tr-line,#e6e3db);border-radius:20px;box-shadow:0 4px 18px #1c1b190d;padding:20px 18px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;min-height:300px;cursor:pointer}'+
'.prTag{font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--tr-muted,#6b6a64);background:var(--tr-soft,#f0eee8);padding:4px 10px;border-radius:999px}.prTag.new{background:#eef0ff;color:#3730a3}.prTag.warn{background:#fdf0e6;color:#9a3412}'+
'.prFront{font-size:clamp(26px,8vw,38px);font-weight:750;letter-spacing:-.02em;line-height:1.15;margin-top:auto;word-break:break-word}.prFront.clue{font-size:18px;font-weight:600;line-height:1.4;display:flex;flex-direction:column;gap:6px}'+
'.prAsk{font-size:13.5px;color:var(--tr-muted,#6b6a64);margin-bottom:auto}.prBack{width:100%;text-align:left;cursor:default}.prName{font-size:26px;font-weight:750;text-align:center;margin-bottom:8px}.prHint{font-size:13px;color:#9a3412;background:#fdf0e6;border-radius:10px;padding:8px 10px;margin-bottom:8px}'+
'.prEd{display:flex;flex-direction:column;gap:8px;margin-top:8px;cursor:default}.prInfo{background:var(--tr-soft,#f0eee8);border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.45}.prInfo span{color:var(--tr-muted,#6b6a64)}'+
'.prCall{display:flex;gap:14px;margin-top:4px}.prCall a{color:var(--tr-acc-ink,#3730a3);font-weight:650;text-decoration:none}'+
'.prNote{width:100%;box-sizing:border-box;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;padding:9px 10px;font:inherit;font-size:15px;resize:vertical}'+
'.prInfoEd summary{font-size:13px;color:var(--tr-muted,#6b6a64);cursor:pointer}.prInfoEd input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px 10px;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;font-size:15px}.prSaved{font-size:12px;color:#15803d;min-height:15px}'+
'.prGrades{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.prGrades button{border:0!important;border-radius:14px!important;padding:13px 6px!important;font-size:15px!important;font-weight:700!important;display:flex;flex-direction:column;align-items:center;gap:2px}.prGrades small{font-size:11px;font-weight:550;opacity:.8}'+
'.g1{background:#fee2e2!important;color:#991b1b!important}.g2{background:#fef3c7!important;color:#92400e!important}.g3{background:#dcfce7!important;color:#166534!important}'+
'.prActs{position:sticky;bottom:0;padding:8px 0 calc(4px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,var(--tr-bg,#f6f5f1) 22%)}.prFront.hidden{display:none}.prFoot{display:flex;justify-content:space-between}'+
'#prEnd{align-items:stretch;justify-content:center;text-align:center}.prEndBig{font-size:30px;font-weight:750}.prEndTxt{color:var(--tr-muted,#6b6a64);font-size:15px}.prTally{display:flex;gap:8px;justify-content:center;margin:12px 0}.prTally span{padding:8px 12px;border-radius:12px;font-weight:700}'+
'#importPreview select{font-size:13px;padding:6px;border-radius:8px;border:1px solid var(--tr-line,#e6e3db);max-width:52%}#importPreview .impRow{display:flex;justify-content:space-between;gap:8px;align-items:center}';
document.head.appendChild(css);

window.addEventListener('hashchange',function(){if(S&&location.hash!=='#people'){S=null;$('prSession').classList.add('hidden');if($('home'))$('home').classList.remove('hidden')}});
function init(){buildPanel();buildSession();renderPanel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
