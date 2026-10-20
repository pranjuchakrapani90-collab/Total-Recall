/* Pranju OS — Cinematic Review
   One click plays Completed Task Review or Reference Review as a full-screen,
   auto-advancing film: intro → chapter per tag → each item with its live TickTick
   details (description, checklist, attachments, comments) → closing summary.
   Uses window.TotalRecallBridge exposed by index.html (periodRange, esc,
   tickContentHtml, save, tickUrl, getDb, suppressed).
*/
(function(){'use strict';
var ORDER=['SDE-TECH','SDE-REV','SDE-ESTT','HOME-MANAGER','BROTHER','SON'];
var LABEL={'SDE-TECH':'SDE Technical','SDE-REV':'SDE Revenue','SDE-ESTT':'SDE Establishment','HOME-MANAGER':'Home Manager','BROTHER':'Brother','SON':'Son','UNTAGGED':'Untagged'};
var HUE={'SDE-TECH':200,'SDE-REV':150,'SDE-ESTT':32,'HOME-MANAGER':330,'BROTHER':265,'SON':50,'UNTAGGED':220};
var SPEEDS=[0.75,1,1.5,2];
var S={slides:[],i:0,playing:true,speed:1,timer:null,raf:null,start:0,dur:0,elapsed:0,kind:'',details:{},wake:null};

function $(id){return document.getElementById(id)}
function B(){return window.TotalRecallBridge||{}}
function h(s){return B().esc?B().esc(s==null?'':s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function bridge(){return B().tickUrl?B().tickUrl():'https://total-recall-ticktick.pranjuchakrapani90.workers.dev'}
function q(params){var u=bridge();return u+(u.indexOf('?')>=0?'&':'?')+params}
function tagLabel(t){return LABEL[t]||t}
function hueOf(t){if(HUE[t]!=null)return HUE[t];var x=0;for(var i=0;i<t.length;i++)x=(x*31+t.charCodeAt(i))%360;return x}
function fmtDay(d){var x=new Date(d+'T12:00:00');return isNaN(x)?d:x.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}
function fmtRange(r){return fmtDay(r.start)+' – '+fmtDay(r.end)}
function sortTags(keys){return keys.sort(function(a,b){var ia=ORDER.indexOf(a),ib=ORDER.indexOf(b);if(a==='UNTAGGED')return 1;if(b==='UNTAGGED')return -1;if(ia<0&&ib<0)return a.localeCompare(b);if(ia<0)return 1;if(ib<0)return -1;return ia-ib})}
function primaryTag(tags){tags=(tags||[]).filter(Boolean);for(var i=0;i<ORDER.length;i++)if(tags.indexOf(ORDER[i])>=0)return ORDER[i];return tags[0]||'UNTAGGED'}

/* ---------- styles + stage ---------- */
function injectStyles(){if($('cineStyles'))return;var css=
'#cine{position:fixed;inset:0;z-index:9999;background:#07070c;color:#f5f3ee;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none}'+
'#cine .glow{position:absolute;inset:-20%;background:radial-gradient(ellipse at 30% 35%,hsla(var(--hue),70%,45%,.38),transparent 55%),radial-gradient(ellipse at 75% 70%,hsla(calc(var(--hue) + 40),60%,35%,.30),transparent 55%);transition:background 1.2s ease;animation:cineDrift 24s ease-in-out infinite alternate}'+
'@keyframes cineDrift{from{transform:scale(1) translate(0,0)}to{transform:scale(1.12) translate(-3%,2%)}}'+
'#cine .grain{position:absolute;inset:0;opacity:.07;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.9\' numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}'+
'#cine .bar{position:absolute;left:0;right:0;height:7vh;background:#000;z-index:3}#cine .bar.top{top:0}#cine .bar.bot{bottom:0}'+
'#cine .frame{position:absolute;top:7vh;bottom:7vh;left:0;right:0;display:flex;align-items:center;justify-content:center;padding:3vh 6vw;z-index:2}'+
'#cine .slide{width:100%;max-width:980px;max-height:100%;display:flex;flex-direction:column;animation:cineIn .9s cubic-bezier(.2,.7,.2,1) both}'+
'#cine .slide.out{animation:cineOut .45s ease both}'+
'@keyframes cineIn{from{opacity:0;transform:translateY(18px) scale(.985);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}'+
'@keyframes cineOut{to{opacity:0;transform:translateY(-10px);filter:blur(4px)}}'+
'#cine .kicker{font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:hsla(var(--hue),80%,78%,.95);font-weight:700}'+
'#cine .title{font-family:Georgia,"Times New Roman",serif;font-weight:400;line-height:1.08;margin:14px 0 0;font-size:clamp(28px,5.4vw,58px);letter-spacing:-.01em}'+
'#cine .title.big{font-size:clamp(38px,8vw,92px)}'+
'#cine .sub{margin-top:16px;color:#cfcbd8;font-size:clamp(14px,1.8vw,18px);line-height:1.5}'+
'#cine .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}'+
'#cine .pill{padding:5px 11px;border-radius:999px;border:1px solid #ffffff2e;background:#ffffff10;font-size:12.5px;color:#ece8f4}'+
'#cine .dates{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}#cine .date{font-size:12px;padding:4px 9px;border-radius:6px;background:hsla(var(--hue),60%,50%,.22);color:#fff}'+
'#cine .detail{margin-top:18px;padding-top:14px;overflow:hidden;position:relative;min-height:0;flex:1 1 auto;-webkit-mask-image:linear-gradient(transparent 0,#000 22px);mask-image:linear-gradient(transparent 0,#000 22px)}#cine .detail.over{-webkit-mask-image:linear-gradient(transparent 0,#000 22px,#000 82%,transparent);mask-image:linear-gradient(transparent 0,#000 22px,#000 82%,transparent)}'+
'#cine .detailInner{will-change:transform;font-size:clamp(14px,1.7vw,17px);line-height:1.65;color:#e7e4ee}'+
'#cine .detailInner > *{animation:cineIn .8s ease both}#cine .detailInner > *:nth-child(2){animation-delay:.25s}#cine .detailInner > *:nth-child(3){animation-delay:.5s}#cine .detailInner > *:nth-child(4){animation-delay:.75s}'+
'#cine .detailInner a{color:hsla(var(--hue),85%,78%,1)}#cine .detailInner img{max-width:100%;border-radius:10px}'+
'#cine .detailInner hr{border:0;border-top:1px solid #ffffff1f}'+
'#cine .sec{margin:0 0 16px}#cine .secT{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#a9a3b8;margin-bottom:8px;font-weight:700}'+
'#cine .chk{padding:3px 0}#cine .chk.done{color:#a7f3d0}#cine .att{display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border-radius:10px;background:#ffffff12;border:1px solid #ffffff22;font-size:13px}'+
'#cine .cmt{padding:10px 12px;border-left:3px solid hsla(var(--hue),70%,60%,.8);background:#ffffff0c;border-radius:0 10px 10px 0;margin-bottom:8px}#cine .cmt small{display:block;color:#a9a3b8;margin-top:4px;font-size:11px}'+
'#cine .muted{color:#a9a3b8;font-style:italic}'+
'#cine .detailInner .taskAttachment,#cine .detailInner .contentAttachment{background:#ffffff12!important;border-color:#ffffff22!important;color:#f5f3ee!important}#cine .detailInner .taskAttachmentName{color:#f5f3ee!important}'+
'#cine .loading{display:flex;gap:6px;align-items:center;color:#a9a3b8;font-size:13px}#cine .loading i{width:6px;height:6px;border-radius:50%;background:#a9a3b8;animation:cinePulse 1s infinite}#cine .loading i:nth-child(2){animation-delay:.15s}#cine .loading i:nth-child(3){animation-delay:.3s}'+
'@keyframes cinePulse{50%{opacity:.2}}'+
'#cine .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:24px}#cine .sumCard{padding:16px;border-radius:14px;background:#ffffff0d;border:1px solid #ffffff1c}#cine .sumCard b{display:block;font-family:Georgia,serif;font-size:34px;font-weight:400}#cine .sumCard span{font-size:12px;color:#cfcbd8;letter-spacing:.06em}'+
'#cine .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}#cine .actions button,#cine .actions a{border:1px solid #ffffff30;background:#ffffff14;color:#fff;padding:11px 16px;border-radius:10px;font:inherit;font-weight:650;cursor:pointer;text-decoration:none}#cine .actions .primary{background:#f5f3ee;color:#111;border-color:#f5f3ee}'+
'#cine .hud{position:absolute;left:0;right:0;bottom:0;height:7vh;min-height:52px;z-index:4;display:flex;align-items:center;gap:10px;padding:0 16px;opacity:1;transition:opacity .5s}'+
'#cine.idle .hud,#cine.idle .topHud{opacity:0}'+
'#cine .hud button,#cine .topHud button{background:transparent;border:0;color:#f5f3ee;font:inherit;font-size:18px;padding:8px 10px;cursor:pointer;border-radius:8px}#cine .hud button:hover,#cine .topHud button:hover{background:#ffffff1a}'+
'#cine .hud .speed{font-size:13px;font-weight:700;min-width:46px}'+
'#cine .track{flex:1;height:4px;background:#ffffff26;border-radius:4px;overflow:hidden;position:relative}#cine .fill{position:absolute;inset:0 auto 0 0;background:#ffffff40}#cine .now{position:absolute;top:0;bottom:0;background:hsla(var(--hue),80%,70%,1)}'+
'#cine .count{font-size:12px;color:#cfcbd8;min-width:64px;text-align:right;font-variant-numeric:tabular-nums}'+
'#cine .topHud{position:absolute;top:0;left:0;right:0;height:7vh;min-height:44px;z-index:4;display:flex;align-items:center;justify-content:space-between;padding:0 14px;transition:opacity .5s}'+
'#cine .topHud .lbl{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#cfcbd8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'+
'#cine .paused{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none;opacity:0;transition:opacity .3s}#cine.isPaused .paused{opacity:1}#cine .paused span{font-size:13px;letter-spacing:.3em;text-transform:uppercase;padding:10px 18px;border-radius:999px;background:#000a;border:1px solid #ffffff30}'+
'.cineBtn{background:linear-gradient(135deg,#111827,#4c1d95)!important;color:#fff!important}'+
'@media(max-width:600px){#cine .frame{padding:2vh 20px}#cine .hud{gap:4px;padding:0 6px}#cine .hud button{padding:8px 7px;font-size:16px}}'+
'@media(prefers-reduced-motion:reduce){#cine .glow{animation:none}#cine .slide,#cine .detailInner > *{animation-duration:.01s}}';
var st=document.createElement('style');st.id='cineStyles';st.textContent=css;document.head.appendChild(st)}

function buildStage(){
  var el=document.createElement('div');el.id='cine';el.setAttribute('role','dialog');el.setAttribute('aria-label','Cinematic review');
  el.innerHTML='<div class="glow"></div><div class="grain"></div><div class="bar top"></div><div class="bar bot"></div>'+
  '<div class="topHud"><div class="lbl" id="cineLbl"></div><div><button id="cineChapter" title="Skip to next chapter">⏭ Chapter</button><button id="cineClose" title="Close (Esc)">✕</button></div></div>'+
  '<div class="frame" id="cineFrame"></div><div class="paused"><span>Paused</span></div>'+
  '<div class="hud"><button id="cinePrev" title="Previous (←)">⏮</button><button id="cinePlay" title="Play / pause (Space)">⏸</button><button id="cineNext" title="Next (→)">⏭</button><button class="speed" id="cineSpeed" title="Speed">1×</button><div class="track" id="cineTrack"><div class="fill" id="cineFill"></div><div class="now" id="cineNow"></div></div><div class="count" id="cineCount"></div></div>';
  document.body.appendChild(el);
  $('cineClose').onclick=function(e){e.stopPropagation();close()};
  $('cinePrev').onclick=function(e){e.stopPropagation();go(S.i-1)};
  $('cineNext').onclick=function(e){e.stopPropagation();go(S.i+1)};
  $('cinePlay').onclick=function(e){e.stopPropagation();toggle()};
  $('cineChapter').onclick=function(e){e.stopPropagation();nextChapter()};
  $('cineSpeed').onclick=function(e){e.stopPropagation();var k=(SPEEDS.indexOf(S.speed)+1)%SPEEDS.length;setSpeed(SPEEDS[k])};
  $('cineTrack').onclick=function(e){e.stopPropagation();var r=this.getBoundingClientRect();go(Math.floor((e.clientX-r.left)/r.width*S.slides.length))};
  $('cineFrame').addEventListener('click',function(e){if(e.target.closest('a,button,.detail'))return;var x=e.clientX/window.innerWidth;if(x<.28)go(S.i-1);else if(x>.72)go(S.i+1);else toggle()});
  var sx=null;el.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
  el.addEventListener('touchend',function(e){if(sx==null)return;var dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>60)go(S.i+(dx<0?1:-1))},{passive:true});
  var idleT;function wake(){el.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(function(){if(S.playing)el.classList.add('idle')},2600)}
  el.addEventListener('mousemove',wake);el.addEventListener('touchstart',wake,{passive:true});wake();
  document.addEventListener('keydown',onKey);
  return el;
}
function onKey(e){if(!$('cine'))return;if(e.key==='Escape'){close()}else if(e.key===' '||e.key==='k'){e.preventDefault();toggle()}else if(e.key==='ArrowRight'){go(S.i+1)}else if(e.key==='ArrowLeft'){go(S.i-1)}else if(e.key==='n'){nextChapter()}}

/* ---------- data ---------- */
async function getJson(u){var r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('TickTick bridge returned HTTP '+r.status);var d=await r.json();if(d.error)throw new Error(d.error);return d}

function buildFilm(kind,range,items){
  var groups={};items.forEach(function(t){var g=t._tag;(groups[g]=groups[g]||[]).push(t)});
  var tags=sortTags(Object.keys(groups)),slides=[],total=items.length;
  var isDone=kind==='completed',name=isDone?'Completed Task Review':'Reference Review';
  slides.push({type:'intro',tag:tags[0]||'UNTAGGED',name:name,range:range,total:total,tags:tags,groups:groups});
  var n=0;
  tags.forEach(function(tag){
    slides.push({type:'chapter',tag:tag,count:groups[tag].length,name:name});
    groups[tag].forEach(function(t,j){n++;slides.push({type:'item',tag:tag,task:t,pos:j+1,of:groups[tag].length,n:n,total:total,name:name})});
  });
  slides.push({type:'outro',tag:tags[tags.length-1]||'UNTAGGED',name:name,range:range,total:total,tags:tags,groups:groups});
  return slides;
}

async function loadCompleted(range){
  var d=await getJson(q('mode=completed&start='+encodeURIComponent(range.start)+'&end='+encodeURIComponent(range.end)));
  var sup=(B().suppressed&&B().suppressed())||{};
  return (d.tasks||[]).filter(function(t){return !sup[String(t.title||'').trim().toLowerCase()]}).map(function(t){t._tag=primaryTag(t.tags);return t});
}
async function loadReferenceItems(range){
  var d=await getJson(q('mode=reference&start='+encodeURIComponent(range.start)+'&end='+encodeURIComponent(range.end)));
  var seen={},out=[];
  Object.keys(d.tags||{}).forEach(function(tag){(d.tags[tag]||[]).forEach(function(t){if(!t.id||seen[t.id])return;seen[t.id]=1;t._tag=primaryTag(t.tags&&t.tags.length?t.tags:[tag]);out.push(t)})});
  return out;
}
function fetchDetail(task){
  if(!task||!task.id||!task.projectId)return Promise.resolve(null);
  if(S.details[task.id])return S.details[task.id];
  var p=getJson(q('mode=task-detail&projectId='+encodeURIComponent(task.projectId)+'&taskId='+encodeURIComponent(task.id))).catch(function(e){return {error:e.message}});
  S.details[task.id]=p;return p;
}
function prefetch(from){for(var k=from;k<Math.min(S.slides.length,from+3);k++){var s=S.slides[k];if(s.type==='item')fetchDetail(s.task)}}

/* ---------- rendering ---------- */
function detailHtml(data,task){
  if(!data)return '<div class="muted">Details are not available for this item.</div>';
  if(data.error)return '<div class="muted">Could not load TickTick details: '+h(data.error)+'</div>';
  var t=data.task||task,comments=Array.isArray(data.comments)?data.comments:[],content=t.content||t.desc||'',html='';
  if(content){var body;try{body=B().tickContentHtml?B().tickContentHtml(content,t):h(content).replace(/\n/g,'<br>')}catch(_){body=h(content).replace(/\n/g,'<br>')}html+='<div class="sec">'+body+'</div>'}
  if(Array.isArray(t.items)&&t.items.length)html+='<div class="sec"><div class="secT">Checklist</div>'+t.items.map(function(x){var d=x.status===1||x.status===2;return '<div class="chk'+(d?' done':'')+'">'+(d?'☑':'☐')+' '+h(x.title||'')+'</div>'}).join('')+'</div>';
  var atts=Array.isArray(t.attachments)?t.attachments:(Array.isArray(t.files)?t.files:[]);
  if(atts.length)html+='<div class="sec"><div class="secT">Attachments</div>'+atts.map(function(a){return '<span class="att">📎 '+h(a.name||a.fileName||a.title||'Attachment')+'</span>'}).join('')+'</div>';
  if(comments.length)html+='<div class="sec"><div class="secT">Comments</div>'+comments.map(function(x){var c=x.content||x.text||x.title||'',b;try{b=B().tickContentHtml?B().tickContentHtml(c,t):h(c)}catch(_){b=h(c)}return '<div class="cmt">'+b+(x.createdTime||x.createdAt?'<small>'+h(String(x.createdTime||x.createdAt).slice(0,16).replace('T',' '))+'</small>':'')+'</div>'}).join('')+'</div>';
  if(!html)html='<div class="muted">No description, checklist, attachment or comment on this item.</div>';
  return html;
}
function textLen(html){var d=document.createElement('div');d.innerHTML=html;return (d.textContent||'').trim().split(/\s+/).filter(Boolean).length}
function taskLink(t){return t&&t.projectId&&t.id?'https://ticktick.com/webapp/#p/'+encodeURIComponent(t.projectId)+'/tasks/'+encodeURIComponent(t.id):''}

function render(){
  var s=S.slides[S.i],frame=$('cineFrame'),root=$('cine');if(!s)return;
  root.style.setProperty('--hue',hueOf(s.tag));
  $('cineLbl').textContent=s.name+(s.type==='item'||s.type==='chapter'?' · '+tagLabel(s.tag):'');
  var items=S.slides.filter(function(x){return x.type==='item'}).length,itemNo=s.type==='item'?s.n:null;
  $('cineCount').textContent=itemNo?itemNo+' / '+items:(s.type==='intro'?'Start':s.type==='outro'?'End':'—');
  $('cineFill').style.width=(S.i/(S.slides.length-1||1)*100)+'%';
  var html='';
  if(s.type==='intro'){
    html='<div class="kicker">Pranju OS · '+h(s.name)+'</div><div class="title big">'+(S.kind==='completed'?'What you got done':'What you filed away')+'</div>'+
      '<div class="sub">'+h(fmtRange(s.range))+' · '+s.total+' item'+(s.total===1?'':'s')+' across '+s.tags.length+' area'+(s.tags.length===1?'':'s')+'</div>'+
      '<div class="pills">'+s.tags.map(function(t){return '<span class="pill">'+h(tagLabel(t))+' · '+s.groups[t].length+'</span>'}).join('')+'</div>';
  }else if(s.type==='chapter'){
    html='<div class="kicker">Chapter</div><div class="title big">'+h(tagLabel(s.tag))+'</div><div class="sub">'+s.count+(S.kind==='completed'?' completed task':' reference item')+(s.count===1?'':'s')+'</div>';
  }else if(s.type==='item'){
    var t=s.task,link=taskLink(t),meta='';
    if(S.kind==='completed'){
      meta='<div class="pills"><span class="pill">✓ '+(t.completionCount>1?'Done '+t.completionCount+' times':'Done once')+'</span>'+(t.tags||[]).filter(function(x){return x!==s.tag}).map(function(x){return '<span class="pill">#'+h(x)+'</span>'}).join('')+'</div>'+
        ((t.completionDates||[]).length?'<div class="dates">'+t.completionDates.map(function(d){return '<span class="date">'+h(fmtDay(d))+'</span>'}).join('')+'</div>':'');
    }else{
      meta='<div class="pills">'+(t.tags||[]).map(function(x){return '<span class="pill">#'+h(x)+'</span>'}).join('')+(t.due?'<span class="pill">'+h(String(t.due).slice(0,10))+'</span>':'')+'</div>';
    }
    html='<div class="kicker">'+h(tagLabel(s.tag))+' · '+s.pos+' of '+s.of+'</div><div class="title">'+h(t.title||'Untitled')+'</div>'+meta+
      '<div class="detail" id="cineDetail"><div class="detailInner" id="cineDetailInner"><div class="loading"><i></i><i></i><i></i>&nbsp;Loading from TickTick</div></div></div>'+
      (link?'<div class="actions" style="margin-top:14px"><a href="'+link+'" target="_blank" rel="noopener noreferrer">Open in TickTick ↗</a></div>':'');
  }else{
    html='<div class="kicker">The end · '+h(fmtRange(s.range))+'</div><div class="title big">'+(S.kind==='completed'?s.total+' things done':s.total+' references reviewed')+'</div>'+
      '<div class="summary">'+s.tags.map(function(t){return '<div class="sumCard" style="--hue:'+hueOf(t)+'"><b>'+s.groups[t].length+'</b><span>'+h(tagLabel(t))+'</span></div>'}).join('')+'</div>'+
      '<div class="actions"><button class="primary" id="cineAgain">↺ Watch again</button><button id="cineDone">Close</button></div>';
  }
  var old=frame.firstChild;if(old){old.classList.add('out');setTimeout(function(){if(old.parentNode)old.parentNode.removeChild(old)},420)}
  var node=document.createElement('div');node.className='slide';node.innerHTML=html;S.node=node;
  if(s.type==='outro'){node.querySelector('#cineAgain').onclick=function(e){e.stopPropagation();go(0,true);play(true)};node.querySelector('#cineDone').onclick=function(e){e.stopPropagation();close()}}
  var rt=S.renderToken=(S.renderToken||0)+1;
  setTimeout(function(){if(rt===S.renderToken&&$('cine'))frame.appendChild(node)},old?380:0);
  prefetch(S.i+1);
  schedule(s,node);
}

/* ---------- timing ---------- */
function stopTimers(){clearTimeout(S.timer);cancelAnimationFrame(S.raf);S.timer=null}
function schedule(s,node){
  stopTimers();S.elapsed=0;S.dur=0;setNow(0);
  var token=S.token=(S.token||0)+1;
  if(s.type==='intro'){arm(5500);return}
  if(s.type==='chapter'){arm(3200);return}
  if(s.type==='outro'){S.dur=0;setNow(1);pause(true);$('cine').classList.remove('isPaused');return}
  var waited=Promise.race([fetchDetail(s.task),new Promise(function(r){setTimeout(function(){r('__slow')},6000)})]);
  waited.then(function(data){
    if(token!==S.token)return;
    var show=function(d){var inner=node.querySelector('.detailInner');if(!inner||token!==S.token)return null;var html=detailHtml(d,s.task);inner.innerHTML=html;return html};
    var html;
    if(data==='__slow'){html='';fetchDetail(s.task).then(function(d){if(token===S.token)show(d)});}
    else html=show(data)||'';
    var words=textLen(html)+String(s.task.title||'').split(/\s+/).length;
    var ms=Math.min(32000,Math.max(6500,3500+words*260));
    if(s.task&&S.kind==='reference')logReference(s.task);
    arm(ms,true);
  });
}
function arm(ms,scroll){S.dur=ms;S.elapsed=0;S.scroll=!!scroll;if(S.playing)run()}
function run(){
  stopTimers();if(!S.dur)return;
  var tick=function(now){
    S.elapsed=(now-S.start)*S.speed;
    var p=Math.min(1,S.elapsed/S.dur);setNow(p);
    if(S.scroll)rollCredits(p);
    if(p>=1){go(S.i+1);return}
    S.raf=requestAnimationFrame(tick);
  };
  S.start=performance.now()-S.elapsed/S.speed;S.raf=requestAnimationFrame(tick);
}
function rollCredits(p){var n=S.node,box=n&&n.querySelector('.detail'),inner=n&&n.querySelector('.detailInner');if(!box||!inner)return;var over=inner.scrollHeight-box.clientHeight+24;box.classList.toggle('over',over>0);if(over<=0){inner.style.transform='';return}
  var q2=Math.max(0,Math.min(1,(p-.18)/.72));inner.style.transform='translateY('+(-over*q2)+'px)'}
function setNow(p){var n=S.slides.length-1||1,w=100/n;$('cineNow').style.left=(S.i/n*100)+'%';$('cineNow').style.width=(S.i>=n?0:w*p)+'%'}

function go(i,force){if(i<0)i=0;if(i>=S.slides.length)i=S.slides.length-1;if(i===S.i&&!force)return;S.i=i;render()}
function nextChapter(){for(var k=S.i+1;k<S.slides.length;k++){if(S.slides[k].type==='chapter'||S.slides[k].type==='outro'){go(k);return}}}
function play(silent){S.playing=true;$('cine').classList.remove('isPaused');$('cinePlay').textContent='⏸';if(S.slides[S.i].type==='outro'&&!silent){go(0,true);return}run()}
function pause(auto){S.playing=false;stopTimers();$('cinePlay').textContent='▶';if(!auto)$('cine').classList.add('isPaused');$('cine').classList.remove('idle')}
function toggle(){S.playing?pause():play()}
function setSpeed(v){S.speed=v;$('cineSpeed').textContent=v+'×';try{localStorage.setItem('totalRecallCineSpeed',String(v))}catch(_){}if(S.playing)run()}

function logReference(t){
  try{var db=B().getDb&&B().getDb();if(!t||!t.id||!db)return;S.logged=S.logged||{};if(S.logged[t.id])return;S.logged[t.id]=1;
    db.referenceItems=db.referenceItems||{};db.referenceItems[t.id]=db.referenceItems[t.id]||{name:t.title,history:[]};
    db.referenceItems[t.id].history.push({date:new Date().toISOString(),note:'Reviewed in Cinematic Review.'});
    if(B().save)B().save();
  }catch(_){}
}

/* ---------- open / close ---------- */
async function open(kind,btn){
  var sel=$(kind==='completed'?'completedPeriod':'referencePeriod'),range=B().periodRange?B().periodRange(sel&&sel.value):null;
  if(!range){alert('Please select a review period first.');return}
  var label=btn.textContent;btn.disabled=true;btn.textContent='Loading film…';
  try{
    var items=kind==='completed'?await loadCompleted(range):await loadReferenceItems(range);
    if(!items.length){alert(kind==='completed'?'No completed tasks found for this period.':'No tagged Reference items found for this period.');return}
    injectStyles();S={slides:buildFilm(kind,range,items),i:0,playing:true,speed:Number(localStorage.getItem('totalRecallCineSpeed'))||1,details:{},kind:kind,logged:{}};
    if(SPEEDS.indexOf(S.speed)<0)S.speed=1;
    buildStage();$('cineSpeed').textContent=S.speed+'×';document.documentElement.style.overflow='hidden';
    try{if(navigator.wakeLock)S.wake=await navigator.wakeLock.request('screen')}catch(_){}
    try{var el=$('cine');if(el.requestFullscreen&&window.matchMedia('(max-width:900px)').matches)el.requestFullscreen().catch(function(){})}catch(_){}
    render();
  }catch(e){alert('Could not start Cinematic Review: '+e.message)}
  finally{btn.disabled=false;btn.textContent=label}
}
function close(){
  stopTimers();S.token=(S.token||0)+1;document.removeEventListener('keydown',onKey);
  var el=$('cine');if(el)el.parentNode.removeChild(el);document.documentElement.style.overflow='';
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(_){}
  try{if(S.wake)S.wake.release()}catch(_){}
}

function mount(){
  injectStyles();
  var a=$('reviewCompletedBtn'),b=$('startReference');
  if(a&&!$('cineCompletedBtn')){var x=document.createElement('button');x.id='cineCompletedBtn';x.className='cineBtn';x.textContent='🎬 Cinematic review';x.title='Play every completed task in this period, one after another';x.onclick=function(){open('completed',x)};a.parentNode.insertBefore(x,a.nextSibling)}
  if(b&&!$('cineReferenceBtn')){var y=document.createElement('button');y.id='cineReferenceBtn';y.className='cineBtn';y.textContent='🎬 Cinematic review';y.title='Play every Reference item in this period, one after another';y.onclick=function(){open('reference',y)};b.parentNode.insertBefore(y,b.nextSibling)}
}
window.CinematicReview={open:open,close:close};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
