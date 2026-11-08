/* People Recall v3 — plain revision with clear counts.
   - Home shows: names revised today / streak / last 7 days, how many names have a hook and how many don't,
     how many names were revised how many times (tap a row to revise that group), and names per hook.
   - A round takes the least-revised names first (oldest revision breaks ties), so counts even out.
     Next (or swipe left) counts a revision; Skip leaves no mark; swipe right / Back undoes.
     Tapping a hook on a card saves it and moves on.
   - Recall by hook opens once every name has a hook: pick a hook, see all its names, run a round through them.
   - Office roster CSVs (Name, Designation, Duty, Phone, Hook …) attach details to names you already
     have and add the rest. Details live only in your synced data, never in this public code.
   Uses window.PeopleBridge (index.html) and window.PeopleHooks (people-hooks.js). */
(function(){
'use strict';
var PR=window.PeopleBridge,PH=window.PeopleHooks||{};
function $(id){return document.getElementById(id)}
function esc(s){return PR.esc(s==null?'':s)}
var GROUPS=window.PEOPLE_GROUPS||[];
var K_GOAL='prGoal_v1';
function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function keyOf(n){return String(n||'').trim().replace(/\s+/g,' ').toLowerCase()}
function groupsOf(p){return p&&Array.isArray(p.groups)?p.groups:[]}
function hist(p){return p&&Array.isArray(p.history)?p.history:[]}
function nowIso(){return new Date().toISOString()}
function dayOf(d){var x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2)}
function today(){return dayOf(Date.now())}
function addDays(day,n){var p=day.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]+n);return dayOf(d)}
function goal(){var g=parseInt(lsGet(K_GOAL,'20'),10);return g>0&&g<500?g:20}
function fmt(n){return Number(n||0).toLocaleString('en-IN')}
function pct(a,b){return b?Math.round(a/b*100):0}
function hasInfo(p){var i=p&&p.info;return !!(i&&(i.desig||i.duty||i.phone||i.emp))}
function isNew(p){return p&&p.addedAt&&(Date.now()-new Date(p.addedAt).getTime())<30*864e5}
/* revisions = dated history entries (old "rl" entries were never revisions) */
function revList(p){return hist(p).filter(function(e){return e&&e.date&&!e.rl})}
function revs(p){return revList(p).length}
function lastRev(p){var l='';revList(p).forEach(function(e){if(e.date>l)l=e.date});return l}
var BUCKETS=[[0,0,'Not revised yet'],[1,1,'Once'],[2,2,'2 times'],[3,3,'3 times'],[4,5,'4–5 times'],[6,9,'6–9 times'],[10,1e9,'10 times or more']];
function bucketOf(r){for(var i=0;i<BUCKETS.length;i++)if(r>=BUCKETS[i][0]&&r<=BUCKETS[i][1])return i;return BUCKETS.length-1}

/* ---------- hook list (synced as db.peopleGroups) ---------- */
function cleanHook(x){return String(x||'').trim().replace(/\s+/g,' ').slice(0,40)}
function findHook(n){n=n.toLowerCase();for(var i=0;i<GROUPS.length;i++)if(GROUPS[i].toLowerCase()===n)return GROUPS[i];return ''}
function applyGroups(){var pg=PR.db.peopleGroups;if(pg&&Array.isArray(pg.list)){var used={};Object.values(PR.db.people).forEach(function(p){groupsOf(p).forEach(function(g){used[g]=1})});Object.keys(used).forEach(function(g){if(pg.list.indexOf(g)<0)pg.list.push(g)})}else{var extra=[];Object.values(PR.db.people).forEach(function(p){groupsOf(p).forEach(function(g){if(GROUPS.indexOf(g)<0&&extra.indexOf(g)<0)extra.push(g)})});if(extra.length)GROUPS.push.apply(GROUPS,extra)}if(pg&&Array.isArray(pg.list)&&pg.list.join('|')!==GROUPS.join('|'))GROUPS.splice.apply(GROUPS,[0,GROUPS.length].concat(pg.list));var bg=$('bulkGroup');if(bg&&bg.options.length!==GROUPS.length+1)bg.innerHTML='<option value="">Choose a hook…</option>'+GROUPS.map(function(g){return '<option>'+esc(g)+'</option>'}).join('')}
function setGroups(list){PR.db.peopleGroups={list:list.slice(),at:nowIso()};applyGroups()}
function addHook(name){name=cleanHook(name);if(!name)return '';var have=findHook(name);if(have)return have;setGroups(GROUPS.concat([name]));PR.save();return name}
function renameHook(old,nw){nw=cleanHook(nw);if(!nw||nw===old)return;var into=findHook(nw);if(into&&into!==old&&!confirm('“'+into+'” already exists. Merge “'+old+'” into it?'))return;var target=into&&into!==old?into:nw,ts=nowIso(),n=0;
  Object.values(PR.db.people).forEach(function(p){var gs=groupsOf(p);if(gs.indexOf(old)<0)return;var out=[];gs.forEach(function(g){g=g===old?target:g;if(out.indexOf(g)<0)out.push(g)});p.groups=out;p.groupsAt=ts;n++});
  var list=GROUPS.slice();if(into&&into!==old)list.splice(list.indexOf(old),1);else list[list.indexOf(old)]=target;setGroups(list);
  PR.save();PR.render();return n}
function removeHook(g){var n=Object.values(PR.db.people).filter(function(p){return groupsOf(p).indexOf(g)>=0}).length;if(!confirm('Remove the hook “'+g+'”?'+(n?' It comes off '+n+' name'+(n===1?'':'s')+'; the names stay.':'')))return;var ts=nowIso();
  Object.values(PR.db.people).forEach(function(p){var gs=groupsOf(p);if(gs.indexOf(g)>=0){p.groups=gs.filter(function(x){return x!==g});p.groupsAt=ts}});
  setGroups(GROUPS.filter(function(x){return x!==g}));PR.save();PR.render()}
function hooksAdmin(){var box=$('prHooksAdmin');if(!box)return;var all=Object.values(PR.db.people);
  box.innerHTML='<div class="prLbl">Hooks</div>'+GROUPS.map(function(g){var n=all.filter(function(p){return groupsOf(p).indexOf(g)>=0}).length;return '<div class="prHk"><span>'+esc(g)+' <small>'+n+'</small></span><button class="prGhost" data-ren="'+encodeURIComponent(g)+'">Rename</button><button class="prGhost prDanger" data-rm="'+encodeURIComponent(g)+'">Remove</button></div>'}).join('')+'<button class="prGhost prAddTop" id="prHkAdd">＋ Add a hook</button>'}

/* ---------- which names a round uses ---------- */
function ctxList(c){
  var a=Object.values(PR.db.people);c=c||{k:'all'};
  if(c.k==='none')return a.filter(function(p){return !groupsOf(p).length});
  if(c.k==='staff')return a.filter(hasInfo);
  if(c.k==='new')return a.filter(isNew);
  if(c.k==='rev'){var b=BUCKETS[c.b]||BUCKETS[0];return a.filter(function(p){var r=revs(p);return r>=b[0]&&r<=b[1]})}
  if(c.k==='hook')return a.filter(function(p){return groupsOf(p).indexOf(c.hook)>=0});
  return a;
}
/* least revised first, then the one revised longest ago, random among equals */
function ordered(list){
  return list.map(function(p){return {p:p,r:revs(p),l:lastRev(p),x:Math.random()}})
    .sort(function(a,b){return a.r-b.r||a.l.localeCompare(b.l)||a.x-b.x}).map(function(o){return o.p});
}

/* ---------- counts ---------- */
function stats(){
  var all=Object.values(PR.db.people),t=today(),wk=addDays(t,-6),days={},o={total:all.length,hooked:0,none:0,staff:0,fresh:0,today:0,week:0,sum:0,b:BUCKETS.map(function(){return 0}),hook:{}};
  GROUPS.forEach(function(g){o.hook[g]=0});
  all.forEach(function(p){
    var gs=groupsOf(p);if(gs.length)o.hooked++;else o.none++;
    gs.forEach(function(g){o.hook[g]=(o.hook[g]||0)+1});
    if(hasInfo(p))o.staff++;if(isNew(p))o.fresh++;
    var rl=revList(p);o.sum+=rl.length;o.b[bucketOf(rl.length)]++;
    rl.forEach(function(e){var d=dayOf(e.date);days[d]=1;if(d===t)o.today++;if(d>=wk)o.week++});
  });
  var d=t,n=0;if(!days[d])d=addDays(d,-1);while(days[d]){n++;d=addDays(d,-1)}o.streak=n;
  return o;
}
function reviewedToday(){return stats().today}
window.PeopleToday=function(){try{var s=stats();return {left:s.total?Math.max(0,goal()-s.today):0,done:s.today}}catch(e){return {left:0}}};

/* ---------- home panel ---------- */
function buildPanel(){
  var card=$('cardPeople');if(!card||$('prHome'))return;
  var tools=$('tools');
  var home=document.createElement('div');home.id='prHome';
  home.innerHTML=
   '<div id="prMain">'+
    '<div class="prSearch"><input id="prQ" type="search" placeholder="Who is…?  name, place, duty, note" autocomplete="off"><div id="prQOut"></div></div>'+
    '<div class="prToday"><div><b id="prTd">0</b><small>revised today</small></div><div><b id="prSt">0</b><small>day streak</small></div><div><b id="prWk">0</b><small>last 7 days</small></div></div>'+
    '<button id="prStart" class="prBig">Start ▸</button>'+
    '<section class="prSec"><div class="prSecH"><b id="prHkTitle">Hooks</b><span id="prHkSub"></span></div>'+
      '<div class="prSplitBar"><i id="prHkFill"></i></div><div class="prSplit"><span class="ok" id="prHkYes"></span><span class="no" id="prHkNo"></span></div>'+
      '<button id="prHookRest" class="prSoft"></button>'+
      '<div class="prRows" id="prHookRows"></div><p class="prMuted" id="prHkLock"></p></section>'+
    '<section class="prSec"><div class="prSecH"><b>Revisions</b><span id="prRvSub"></span></div><div class="prRows" id="prRevRows"></div></section>'+
    '<div class="prRows" id="prOther"></div>'+
    '<details class="prMore"><summary>Manage names · hooks · round size</summary><label class="prGoal">Names per round <input id="prGoalIn" type="number" min="5" max="200" step="5"></label><div id="prHooksAdmin"></div><div id="prToolsSlot"></div></details>'+
   '</div>'+
   '<div id="prSheet" hidden><button id="prSheetBack" class="prGhost">← People Recall</button><div class="prSheetT" id="prSheetT"></div><div class="prMuted" id="prSheetSub"></div>'+
    '<div class="prSheetGo"><button id="prSheetRound" class="prBig"></button><button id="prSheetAll" class="prSoft"></button></div>'+
    '<div class="prLbl">Everyone under this hook</div><div id="prSheetList"></div></div>';
  card.appendChild(home);
  if(tools){tools.classList.remove('hidden');$('prToolsSlot').appendChild(tools)}
  $('prGoalIn').value=goal();
  $('prGoalIn').addEventListener('change',function(){var v=parseInt(this.value,10);if(v>0){lsSet(K_GOAL,String(v));renderPanel()}});
  $('prStart').addEventListener('click',function(){startSession({k:'all',label:''})});
  $('prHookRest').addEventListener('click',function(){startSession({k:'none',label:'No hook yet'},true)});
  home.addEventListener('click',function(e){
    var r=e.target.closest('[data-ctx]');if(r){var c=JSON.parse(decodeURIComponent(r.dataset.ctx));if(c.k==='hook'&&c.sheet)openSheet(c.hook);else startSession(c);return}
  });
  $('prSheetBack').addEventListener('click',closeSheet);
  $('prSheetRound').addEventListener('click',function(){startSession({k:'hook',hook:SH,label:SH})});
  $('prSheetAll').addEventListener('click',function(){startSession({k:'hook',hook:SH,label:SH},true)});
  $('prHooksAdmin').addEventListener('click',function(e){var t=e.target;if(t.id==='prHkAdd'){var n=prompt('New hook name (e.g. Family Friends)');if(n&&addHook(n)){PR.render()}return}
    if(t.dataset.ren){var o=decodeURIComponent(t.dataset.ren),nw=prompt('Rename “'+o+'” to:',o);if(nw!=null)renameHook(o,nw);return}
    if(t.dataset.rm)removeHook(decodeURIComponent(t.dataset.rm))});
  $('prQ').addEventListener('input',quickSearch);
  $('prQOut').addEventListener('click',onQuickClick);
  $('prSheetList').addEventListener('click',onQuickClick);
}
function ctxAttr(c){return ' data-ctx="'+encodeURIComponent(JSON.stringify(c))+'"'}
function row(label,n,max,c,cls){
  var w=max?Math.max(n?2:0,n/max*100):0,inner='<span class="l">'+esc(label)+'</span><span class="b"><i style="width:'+w.toFixed(1)+'%"></i></span><span class="n">'+fmt(n)+'</span>';
  return c&&n?'<button type="button" class="prRow'+(cls?' '+cls:'')+'"'+ctxAttr(c)+'>'+inner+'<span class="go">›</span></button>':'<div class="prRow off'+(cls?' '+cls:'')+'">'+inner+'<span class="go"></span></div>';
}
function renderPanel(){
  applyGroups();if(!$('prHome'))return;hooksAdmin();
  var s=stats(),g=goal(),allHooked=s.total>0&&s.none===0;
  $('prTd').textContent=fmt(s.today);$('prSt').textContent=(s.streak?'🔥 ':'')+s.streak;$('prWk').textContent=fmt(s.week);
  $('prStart').textContent=s.total?'Start a round of '+Math.min(g,s.total)+' ▸':'Import names first';
  /* hooks */
  $('prHkTitle').textContent=allHooked?'Recall by hook':'Hooks';
  $('prHkSub').textContent=fmt(s.hooked)+' of '+fmt(s.total)+' hooked · '+pct(s.hooked,s.total)+'%';
  $('prHkFill').style.width=(s.total?s.hooked/s.total*100:0).toFixed(1)+'%';
  $('prHkYes').textContent='✓ '+fmt(s.hooked)+' with a hook';
  $('prHkNo').textContent=s.none?fmt(s.none)+' without':'none without';
  var hr=$('prHookRest');hr.hidden=!s.none;hr.textContent='Hook the remaining '+fmt(s.none)+' ▸';
  var hooks=GROUPS.slice().sort(function(a,b){return (s.hook[b]||0)-(s.hook[a]||0)||a.localeCompare(b)}),hmax=Math.max.apply(null,hooks.map(function(h){return s.hook[h]||0}).concat([1]));
  $('prHookRows').innerHTML=hooks.map(function(h){return row(h,s.hook[h]||0,hmax,allHooked?{k:'hook',hook:h,sheet:1}:null,allHooked?'':'stat')}).join('');
  $('prHkLock').textContent=allHooked?'Tap a hook to see everyone in it and revise them.':(s.total?'🔒 Recall by hook opens once all '+fmt(s.total)+' names have a hook. A name can sit under more than one hook.':'');
  /* revisions */
  var bmax=Math.max.apply(null,s.b.concat([1]));
  $('prRvSub').textContent=s.total?(s.sum/s.total).toFixed(1)+' per name on average · '+fmt(s.sum)+' in all':'';
  $('prRevRows').innerHTML=BUCKETS.map(function(b,i){return row(b[2],s.b[i],bmax,{k:'rev',b:i,label:'Revised '+b[2].toLowerCase()})}).join('');
  /* other rounds, only when they have names */
  var ot='';
  if(s.fresh)ot+=row('Added in the last 30 days',s.fresh,s.fresh,{k:'new',label:'Added lately'},'single');
  if(s.staff)ot+=row('Office staff (roster details)',s.staff,s.staff,{k:'staff',label:'Office staff'},'single');
  $('prOther').innerHTML=ot;$('prOther').hidden=!ot;
  if($('prQ').value&&!$('prQOut').querySelector('.prEd'))quickSearch();
  if(SH&&!$('prSheet').hidden&&!$('prSheetList').querySelector('.prEd'))renderSheet();
}
window.peopleRenderPanel=renderPanel;

/* ---------- recall by hook: one hook's sheet ---------- */
var SH='';
function openSheet(h){SH=h;$('prMain').hidden=true;$('prSheet').hidden=false;renderSheet();window.scrollTo(0,0)}
function closeSheet(){SH='';$('prSheet').hidden=true;$('prMain').hidden=false}
function renderSheet(){
  var list=ctxList({k:'hook',hook:SH}).slice().sort(function(a,b){return a.name.localeCompare(b.name)}),g=goal(),rv=list.reduce(function(n,p){return n+(revs(p)?1:0)},0);
  $('prSheetT').textContent=SH;
  $('prSheetSub').textContent=fmt(list.length)+' name'+(list.length===1?'':'s')+' · '+fmt(rv)+' revised at least once';
  $('prSheetRound').textContent=list.length>g?'Round of '+g+' ▸':'Go through all '+list.length+' ▸';
  $('prSheetAll').hidden=list.length<=g;$('prSheetAll').textContent='All '+fmt(list.length)+' ▸';
  $('prSheetList').innerHTML=list.map(hitHtml).join('')||'<p class="prMuted">No names under this hook.</p>';
}

/* ---------- "Who is…?" quick search ---------- */
function infoLine(p){var i=p.info||{};return [i.desig,i.duty].filter(Boolean).join(' · ')}
function matchText(p){var i=p.info||{};return (p.name+' '+(p.note||'')+' '+groupsOf(p).join(' ')+' '+[i.desig,i.duty,i.emp,i.phone].join(' ')).toLowerCase()}
function hitHtml(p){var k=encodeURIComponent(keyOf(p.name)),gs=groupsOf(p),il=infoLine(p),r=revs(p);return '<div class="prHit" data-k="'+k+'"><div class="prHitTop"><b>'+esc(p.name)+'</b>'+(gs.length?'<span>'+esc(gs.join(' · '))+'</span>':'<span class="prNoHk">no hook</span>')+'<em>'+(r?'revised '+r+'×':'not revised')+'</em></div>'+(il?'<div class="prHitInfo">'+esc(il)+'</div>':'')+(p.note?'<div class="prHitInfo">'+esc(p.note)+'</div>':'')+'<div class="prHitEd"></div></div>'}
function quickSearch(){
  var q=$('prQ').value.trim().toLowerCase(),out=$('prQOut');if(!q){out.innerHTML='';return}
  var words=q.split(/\s+/),hits=Object.values(PR.db.people).filter(function(p){var t=matchText(p);return words.every(function(w){return t.indexOf(w)>=0})});
  hits.sort(function(a,b){var an=a.name.toLowerCase().indexOf(q)===0?0:1,bn=b.name.toLowerCase().indexOf(q)===0?0:1;return an-bn||a.name.localeCompare(b.name)});
  out.innerHTML='<div class="prQn">'+hits.length+' found'+(hits.length>30?' · showing 30':'')+'</div>'+hits.slice(0,30).map(hitHtml).join('');
}
function onQuickClick(e){
  if(e.target.closest('.prEd'))return;
  var hit=e.target.closest('.prHit');if(!hit)return;var slot=hit.querySelector('.prHitEd');
  if(slot.innerHTML){slot.innerHTML='';return}
  var p=PR.db.people[decodeURIComponent(hit.dataset.k)];if(p)slot.innerHTML=editorHtml(p,true);
}

/* ---------- editor: hooks (tap = saved), note, office details ---------- */
function chipsHtml(p){var gs=groupsOf(p);return '<div class="prChips prHooks">'+GROUPS.map(function(g){return '<button type="button" class="prChip'+(gs.indexOf(g)>=0?' on':'')+'" data-g="'+esc(g)+'">'+esc(g)+'</button>'}).join('')+'<button type="button" class="prChip prNew">＋ New hook</button></div>'}
function editorHtml(p,full,noHooks){
  var gs=groupsOf(p),i=p.info||{},k=esc(keyOf(p.name));
  var h='<div class="prEd" data-k="'+k+'">';
  if(hasInfo(p))h+='<div class="prInfo">'+(i.desig?'<div><b>'+esc(i.desig)+'</b>'+(i.emp?' <span>· '+esc(i.emp)+'</span>':'')+'</div>':'')+(i.duty?'<div>'+esc(i.duty)+'</div>':'')+(i.phone?'<div class="prCall"><a href="tel:'+esc(i.phone.replace(/\s/g,''))+'">📞 '+esc(i.phone)+'</a><a href="https://wa.me/91'+esc(i.phone.replace(/\D/g,'').slice(-10))+'" target="_blank" rel="noopener">WhatsApp</a></div>':'')+'</div>';
  if(!noHooks)h+=chipsHtml(p);
  h+='<textarea class="prNote" rows="2" placeholder="How you know them — place, relation, last met…">'+esc(p.note||'')+'</textarea>';
  if(full)h+='<details class="prInfoEd"><summary>Office details</summary><input data-i="desig" placeholder="Designation" value="'+esc(i.desig||'')+'"><input data-i="duty" placeholder="Duty / place" value="'+esc(i.duty||'')+'"><input data-i="phone" placeholder="Phone" inputmode="tel" value="'+esc(i.phone||'')+'"></details>';
  h+='<div class="prSaved"></div></div>';return h;
}
function flash(ed,msg){var s=ed.querySelector('.prSaved');if(s){s.textContent=msg;clearTimeout(s._t);s._t=setTimeout(function(){s.textContent=''},1400)}}
document.addEventListener('click',function(e){
  var c=e.target.closest('.prEd .prHooks .prChip');if(!c)return;
  var ed=c.closest('.prEd'),p=PR.db.people[ed.dataset.k];if(!p)return;
  if(c.classList.contains('prNew')){var n=prompt('New hook name (e.g. Family Friends)');n=n&&addHook(n);if(!n)return;if(groupsOf(p).indexOf(n)<0){p.groups=groupsOf(p).concat([n]);p.groupsAt=nowIso()}PR.save();
    Array.prototype.forEach.call(document.querySelectorAll('.prEd'),function(x){var q=PR.db.people[x.dataset.k],hk=x.querySelector('.prHooks');if(q&&hk)hk.outerHTML=chipsHtml(q)});flash(ed,'Added “'+n+'” ✓');renderPanel();return}
  c.classList.toggle('on');p.groups=Array.prototype.map.call(ed.querySelectorAll('.prHooks .prChip.on'),function(x){return x.dataset.g});p.groupsAt=nowIso();
  PR.save();flash(ed,'Saved ✓');var hn=ed.parentNode&&ed.parentNode.querySelector('.prHint');if(hn)hn.remove();
});
document.addEventListener('change',function(e){
  var ed=e.target.closest&&e.target.closest('.prEd');if(!ed)return;var p=PR.db.people[ed.dataset.k];if(!p)return;
  if(e.target.classList.contains('prNote')){var v=e.target.value.trim();if(v!==(p.note||'')){p.note=v;p.noteAt=nowIso();PR.save();flash(ed,'Note saved ✓')}}
  else if(e.target.dataset.i){p.info=Object.assign({},p.info||{});p.info[e.target.dataset.i]=e.target.value.trim();p.infoAt=nowIso();PR.save();flash(ed,'Saved ✓')}
});

/* ---------- round: read the card, Next (or swipe left), Skip leaves no mark ---------- */
var S=null,autoT=0;
function buildSession(){
  if($('prSession'))return;
  var sec=document.createElement('section');sec.id='prSession';sec.className='hidden';
  sec.innerHTML='<div class="prS"><div class="prTop"><button id="prQuit" class="prGhost">✕</button><div class="prPBar"><i id="prPFill"></i></div><span id="prPTxt"></span></div>'+
    '<div class="prCard" id="prCard"><div class="prCtx" id="prCtx"></div><div class="prTag" id="prTag"></div><div class="prFront" id="prFront"></div><div class="prBack" id="prBack"></div></div>'+
    '<div class="prActs"><div class="prNav"><button id="prSkip" class="prSkipB">Skip<small>comes back later</small></button><button id="prNext" class="prBig">Next →</button></div></div>'+
    '<div class="prFoot"><button id="prPrev" class="prGhost">← Back</button><span class="prSwipe">swipe ← next · → back</span><button id="prDel" class="prGhost prDanger">Delete name</button></div></div>'+
    '<div class="prS hidden" id="prEnd"><div class="prEndBig" id="prEndBig"></div><div class="prEndTxt" id="prEndTxt"></div><button id="prAgain" class="prBig">Another round ▸</button><button id="prEndHome" class="prGhost prWide">Back to People</button></div>';
  var ref=$('session');ref.parentNode.insertBefore(sec,ref.nextSibling);
  $('prQuit').addEventListener('click',goHome);
  $('prNext').addEventListener('click',function(){next(false)});
  $('prSkip').addEventListener('click',function(){next(true)});
  $('prPrev').addEventListener('click',back);
  $('prDel').addEventListener('click',delCurrent);
  $('prAgain').addEventListener('click',function(){startSession(S&&S.ctx,S&&S.whole)});
  $('prEndHome').addEventListener('click',goHome);
  var x0=0,y0=0,ok=false,card=$('prCard');
  card.addEventListener('touchstart',function(e){var t=e.touches[0];ok=!e.target.closest('textarea,input');x0=t.clientX;y0=t.clientY},{passive:true});
  card.addEventListener('touchend',function(e){if(!ok||!S)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;if(dx<0){card.classList.add('swL');next(false)}else{card.classList.add('swR');back()}setTimeout(function(){card.classList.remove('swL','swR')},220)},{passive:true});
  document.addEventListener('keydown',function(e){if(!S||$('prSession').classList.contains('hidden')||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();next(false)}else if(e.key==='ArrowLeft')back();else if(e.key==='s')next(true)});
}
/* whole=true runs through every name in the group instead of one round's worth */
function startSession(ctx,whole){
  ctx=ctx||{k:'all',label:''};
  if(!Object.keys(PR.db.people).length){alert('Import some names first (Manage names).');return}
  var list=ordered(ctxList(ctx));if(!whole)list=list.slice(0,goal());
  if(!list.length){alert('No names here yet.');return}
  S={q:list.map(function(p){return keyOf(p.name)}),i:0,ctx:ctx,whole:!!whole,seen:0,skipped:0,stack:[]};
  ['home','session','done'].forEach(function(id){if($(id))$(id).classList.add('hidden')});
  $('prEnd').classList.add('hidden');$('prSession').querySelector('.prS').classList.remove('hidden');$('prSession').classList.remove('hidden');
  window.scrollTo(0,0);draw();
}
function cur(){return S&&S.q[S.i]?PR.db.people[S.q[S.i]]:null}
function draw(){
  clearTimeout(autoT);
  while(S.i<S.q.length&&!PR.db.people[S.q[S.i]])S.q.splice(S.i,1);
  if(S.i>=S.q.length){finish();return}
  var p=cur(),r=revs(p);
  $('prPFill').style.width=(S.i/S.q.length*100)+'%';$('prPTxt').textContent=(S.i+1)+' / '+S.q.length;
  $('prCtx').textContent=S.ctx.k==='hook'?'🪝 '+S.ctx.hook:(S.ctx.label||'');$('prCtx').hidden=!$('prCtx').textContent;
  $('prTag').textContent=r?'Revised '+r+'×':'First time';$('prTag').className='prTag'+(r?'':' new');
  $('prFront').textContent=p.name;
  var untagged=!groupsOf(p).length;
  $('prBack').innerHTML=(untagged?'<div class="prFtLbl">No hook yet — tap one and it moves to the next name</div>':'')+editorHtml(p,false);
  $('prPrev').disabled=!S.stack.length;
}
function next(skip){
  if(!S)return;var p=cur();if(!p)return;clearTimeout(autoT);
  var date=null;
  if(!skip){date=nowIso();p.history=p.history||[];p.history.push({date:date,note:'Revised',g:3});S.seen++;PR.save()}else S.skipped++;
  S.stack.push({i:S.i,k:S.q[S.i],date:date});S.i++;draw();
}
function back(){
  if(!S||!S.stack.length)return;clearTimeout(autoT);var u=S.stack.pop(),p=PR.db.people[u.k];
  if(u.date){if(p)p.history=hist(p).filter(function(e){return e.date!==u.date});S.seen--;PR.save()}else S.skipped--;
  S.i=u.i;$('prEnd').classList.add('hidden');$('prSession').querySelector('.prS').classList.remove('hidden');draw();
}
/* tapping a hook on the card saves it, then moves on after a moment (another tap in that moment adds it too) */
document.addEventListener('click',function(e){
  if(!S||!e.target.closest('#prCard .prHooks .prChip')||e.target.closest('.prNew'))return;
  clearTimeout(autoT);var k=S.q[S.i];autoT=setTimeout(function(){if(S&&S.q[S.i]===k)next(false)},900);
});
document.addEventListener('focusin',function(e){if(S&&e.target.closest&&e.target.closest('#prCard'))clearTimeout(autoT)});
function delCurrent(){
  var p=cur();if(!p||!confirm('Delete '+p.name+' and their recall history on both phones?'))return;
  var k=keyOf(p.name);PR.db.deletedPeople=PR.db.deletedPeople||{};PR.db.deletedPeople[k]=nowIso();delete PR.db.people[k];
  S.q=S.q.filter(function(x,j){return j<S.i||x!==k});PR.save();draw();
}
function finish(){
  $('prSession').querySelector('.prS').classList.add('hidden');$('prEnd').classList.remove('hidden');
  var st=stats(),left=ordered(ctxList(S.ctx)).length;
  $('prEndBig').textContent='Round done ✓';
  $('prEndTxt').innerHTML='<div class="prTally"><span class="g3">'+S.seen+' revised</span>'+(S.skipped?'<span class="g2">'+S.skipped+' skipped</span>':'')+'</div>'+
    (S.skipped?'<p>Skipped names come back in a later round.</p>':'')+
    '<p>'+fmt(st.today)+' revised today'+(st.streak?' · 🔥 '+st.streak+'-day streak':'')+'</p>'+
    (S.ctx.k==='none'?'<p>'+(st.none?fmt(st.none)+' names still without a hook.':'Every name has a hook now — Recall by hook is open.')+'</p>':'');
  $('prAgain').hidden=!left;
  $('prAgain').textContent='Another round'+(S.ctx.k!=='all'&&S.ctx.label?' · '+S.ctx.label:'')+' ▸';
}
function goHome(){clearTimeout(autoT);S=null;$('prSession').classList.add('hidden');if($('home'))$('home').classList.remove('hidden');PR.render();renderPanel()}

/* ---------- office roster import (CSV with Name + Designation / Duty / Phone / Hook …) ---------- */
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
  R=null;PR.save();PR.render();$('importPreview').innerHTML='<div class="imp"><b>Done.</b> Details added to '+linked+' names, '+added+' new names added. Tap “Office staff” on the People page to revise them.</div>';
});

/* ---------- styles ---------- */
var css=document.createElement('style');css.textContent=
'#cardPeople{flex-direction:column}#prHome,#prMain,#prSheet{display:flex;flex-direction:column;gap:12px;width:100%}#prMain[hidden],#prSheet[hidden],#prOther[hidden],.prCtx[hidden],#prHookRest[hidden],#prSheetAll[hidden],#prAgain[hidden]{display:none!important}'+
'#prHome button,#prSession button{min-width:0;font:inherit;cursor:pointer;white-space:normal}'+
'.prSearch input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--tr-line,#e6e3db);border-radius:12px;font-size:16px;background:#fff}'+
'.prQn{font-size:12px;color:var(--tr-muted,#6b6a64);margin:8px 2px}.prHit{border:1px solid var(--tr-line,#e6e3db);border-radius:12px;padding:10px 12px;margin-bottom:6px;background:#fff;cursor:pointer}'+
'.prHitTop{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.prHitTop span{font-size:12px;color:var(--tr-acc-ink,#3730a3)}.prNoHk{color:#9a3412!important}.prHitTop em{font-style:normal;font-size:11.5px;color:var(--tr-muted,#6b6a64);margin-left:auto}.prHitInfo{font-size:13px;color:var(--tr-muted,#6b6a64);margin-top:2px}'+
'.prToday{display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--tr-soft,#f0eee8);border-radius:14px;padding:12px 6px;text-align:center}.prToday b{display:block;font-size:22px;font-weight:750;line-height:1.1;font-variant-numeric:tabular-nums}.prToday small{font-size:11.5px;color:var(--tr-muted,#6b6a64)}.prToday>div+div{border-left:1px solid #e2dfd6}'+
'.prBig{display:block;width:100%;padding:15px!important;border-radius:14px!important;border:0!important;background:var(--tr-acc,#4f46e5)!important;color:#fff!important;font-size:16px!important;font-weight:700!important}'+
'.prSoft{display:block;width:100%;padding:12px!important;border-radius:12px!important;border:1px solid var(--tr-acc,#4f46e5)!important;background:#eef0ff!important;color:var(--tr-acc-ink,#3730a3)!important;font-size:15px!important;font-weight:700!important}'+
'.prLbl{font-size:12px;font-weight:650;color:var(--tr-muted,#6b6a64);margin-bottom:-4px}.prMuted{font-size:12.5px;color:var(--tr-muted,#6b6a64);margin:0}'+
'.prSec{display:flex;flex-direction:column;gap:8px;border:1px solid var(--tr-line,#e6e3db);border-radius:16px;padding:12px;background:#fff}.prSecH{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.prSecH b{font-size:15px}.prSecH span{font-size:12px;color:var(--tr-muted,#6b6a64)}'+
'.prSplitBar{height:10px;background:#f3d9c4;border-radius:9px;overflow:hidden}.prSplitBar i{display:block;height:100%;background:#16a34a;border-radius:9px 0 0 9px;transition:width .4s}.prSplit{display:flex;justify-content:space-between;font-size:12.5px;font-weight:650}.prSplit .ok{color:#15803d}.prSplit .no{color:#9a3412}'+
'.prRows{display:flex;flex-direction:column;gap:2px}.prRow{display:grid!important;grid-template-columns:minmax(0,9.5em) 1fr 3.4em 1em;align-items:center;gap:8px;width:100%;text-align:left;border:0!important;background:transparent!important;color:var(--tr-ink,#1c1b19)!important;padding:7px 4px!important;border-radius:10px!important;font-size:13.5px!important;font-weight:550!important}'+
'button.prRow:active{background:var(--tr-soft,#f0eee8)!important}.prRow .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prRow .b{height:8px;background:#efede6;border-radius:9px;overflow:hidden}.prRow .b i{display:block;height:100%;background:var(--tr-acc,#4f46e5);border-radius:9px}.prRow .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}.prRow .go{color:var(--tr-muted,#6b6a64);font-size:16px}'+
'.prRow.off{opacity:.55}.prRow.stat{opacity:1}.prRow.stat .b i{background:#a5a1f0}.prRow.single .b{display:none}.prRow.single{grid-template-columns:1fr 3.4em 1em}#prOther{border:1px solid var(--tr-line,#e6e3db);border-radius:16px;padding:6px 8px;background:#fff}'+
'.prSheetT{font-size:24px;font-weight:750;letter-spacing:-.01em}.prSheetGo{display:flex;flex-direction:column;gap:8px}#prSheetBack{align-self:flex-start;padding-left:0!important}'+
'.prChips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.prChips::-webkit-scrollbar{display:none}.prHooks{flex-wrap:wrap;overflow:visible}'+
'.prChip{flex:none;border:1px solid var(--tr-line,#e6e3db)!important;background:#fff!important;color:var(--tr-ink,#1c1b19)!important;border-radius:999px!important;padding:7px 12px!important;font-size:13px!important;font-weight:550!important}'+
'.prChip.on{background:var(--tr-acc,#4f46e5)!important;border-color:var(--tr-acc,#4f46e5)!important;color:#fff!important}'+
'.prMore{border-top:1px solid var(--tr-line,#e6e3db);padding-top:10px}.prMore summary{font-size:13px;font-weight:650;color:var(--tr-muted,#6b6a64);cursor:pointer}.prGoal{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:14px}.prGoal input{width:80px;padding:8px;border:1px solid var(--tr-line,#e6e3db);border-radius:8px}'+
'#prSession{max-width:620px;margin:0 auto;padding:12px 14px calc(18px + env(safe-area-inset-bottom,0px))}.prS{display:flex;flex-direction:column;gap:12px;min-height:calc(100vh - 140px)}'+
'.prTop{display:flex;align-items:center;gap:10px}.prPBar{flex:1;height:8px;background:#e2dfd6;border-radius:9px;overflow:hidden}.prPBar i{display:block;height:100%;background:var(--tr-acc,#4f46e5);transition:width .3s}#prPTxt{font-size:13px;color:var(--tr-muted,#6b6a64);font-variant-numeric:tabular-nums}'+
'.prGhost{border:0!important;background:transparent!important;color:var(--tr-muted,#6b6a64)!important;padding:8px 10px!important;font-size:14px!important;font-weight:600!important}.prGhost:disabled{opacity:.35}.prDanger{color:#b91c1c!important}.prWide{width:100%}'+
'.prCard{flex:1;background:#fff;border:1px solid var(--tr-line,#e6e3db);border-radius:20px;box-shadow:0 4px 18px #1c1b190d;padding:20px 18px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;gap:10px;min-height:300px;transition:transform .2s,opacity .2s}.prCard.swL{transform:translateX(-24px);opacity:.6}.prCard.swR{transform:translateX(24px);opacity:.6}'+
'.prCtx{font-size:13px;font-weight:700;color:var(--tr-acc-ink,#3730a3)}'+
'.prTag{font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--tr-muted,#6b6a64);background:var(--tr-soft,#f0eee8);padding:4px 10px;border-radius:999px}.prTag.new{background:#eef0ff;color:#3730a3}'+
'.prFront{font-size:clamp(26px,8vw,38px);font-weight:750;letter-spacing:-.02em;line-height:1.15;word-break:break-word}'+
'.prBack{width:100%;text-align:left;cursor:default}'+
'.prEd{display:flex;flex-direction:column;gap:8px;margin-top:8px;cursor:default}.prInfo{background:var(--tr-soft,#f0eee8);border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.45}.prInfo span{color:var(--tr-muted,#6b6a64)}'+
'.prCall{display:flex;gap:14px;margin-top:4px}.prCall a{color:var(--tr-acc-ink,#3730a3);font-weight:650;text-decoration:none}'+
'.prNote{width:100%;box-sizing:border-box;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;padding:9px 10px;font:inherit;font-size:15px;resize:vertical}'+
'.prInfoEd summary{font-size:13px;color:var(--tr-muted,#6b6a64);cursor:pointer}.prInfoEd input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px 10px;border:1px solid var(--tr-line,#e6e3db);border-radius:10px;font-size:15px}.prSaved{font-size:12px;color:#15803d;min-height:15px}'+
'.g2{background:#fef3c7!important;color:#92400e!important}.g3{background:#dcfce7!important;color:#166534!important}'+
'.prActs{position:sticky;bottom:0;padding:8px 0 calc(4px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,var(--tr-bg,#f6f5f1) 22%)}.prFoot{display:flex;justify-content:space-between;align-items:center}.prSwipe{font-size:11px;color:var(--tr-muted,#6b6a64)}.prNav{display:grid;grid-template-columns:1fr 2fr;gap:8px}.prSkipB{border:1px solid var(--tr-line,#e6e3db)!important;background:#fff!important;color:var(--tr-ink,#1c1b19)!important;border-radius:14px!important;font-size:15px!important;font-weight:700!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:8px!important}.prSkipB small{font-size:10.5px;font-weight:550;color:var(--tr-muted,#6b6a64)}'+
'.prFtLbl{font-size:12.5px;font-weight:650;color:#9a3412;margin:2px 0 6px;text-align:center}.prNew{border-style:dashed!important;color:var(--tr-acc-ink,#3730a3)!important}.prHk{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--tr-line,#e6e3db);padding:2px 0}.prHk span{flex:1;font-size:14px}.prHk small{color:var(--tr-muted,#6b6a64);margin-left:4px}.prAddTop{margin:4px 0 10px;color:var(--tr-acc-ink,#3730a3)!important}#prHooksAdmin{margin:12px 0}'+
'#prEnd{align-items:stretch;justify-content:center;text-align:center}.prEndBig{font-size:30px;font-weight:750}.prEndTxt{color:var(--tr-muted,#6b6a64);font-size:15px}.prTally{display:flex;gap:8px;justify-content:center;margin:12px 0}.prTally span{padding:8px 12px;border-radius:12px;font-weight:700}'+
'#importPreview select{font-size:13px;padding:6px;border-radius:8px;border:1px solid var(--tr-line,#e6e3db);max-width:52%}#importPreview .impRow{display:flex;justify-content:space-between;gap:8px;align-items:center}';
document.head.appendChild(css);

window.addEventListener('hashchange',function(){if(location.hash!=='#people'){if(SH)closeSheet();if(S){S=null;$('prSession').classList.add('hidden');if($('home'))$('home').classList.remove('hidden')}}});
function init(){buildPanel();buildSession();renderPanel()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
