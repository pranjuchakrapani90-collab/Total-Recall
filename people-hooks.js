/* People Recall: smart import (only new names, skip deleted, flag near-duplicates)
   and memory hooks (how you know someone + a short note). Talks to index.html through window.PeopleBridge. */
(function(){
'use strict';
var PR=window.PeopleBridge;function $(id){return document.getElementById(id)}function esc(s){return PR.esc(s)}function save(){PR.save()}function render(){PR.render()}
var GROUPS=['Home','Family','School','College','APDCL Seniors','APDCL Colleagues','APDCL Juniors','APDCL Samaguri','APDCL Bilasipara','Punj Lloyd','Sonitpur Poly'];
window.PEOPLE_GROUPS=GROUPS;
var STOP={kr:1,kumar:1,md:1,mohd:1,mohammad:1,mohammed:1,dr:1,er:1,mr:1,mrs:1,ms:1,sri:1,shri:1,smt:1,miss:1};
function now(){return new Date().toISOString()}
function keyOf(name){return String(name||'').trim().replace(/\s+/g,' ').toLowerCase()}
function cleanName(x){return String(x||'').trim().replace(/\s+/g,' ')}
function groupsOf(p){return p&&Array.isArray(p.groups)?p.groups:[]}
function tokens(s){return String(s||'').toLowerCase().replace(/[^a-z0-9ঀ-৿ ]+/g,' ').split(' ').filter(function(t){return t.length>1&&!STOP[t]})}
function lev(a,b){if(Math.abs(a.length-b.length)>1)return 9;var prev=[],cur,i,j;for(j=0;j<=b.length;j++)prev[j]=j;for(i=1;i<=a.length;i++){cur=[i];for(j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function subset(a,b){return a.every(function(t){return b.indexOf(t)>=0})}

/* ---------- import ---------- */
function parseCSV(text,delim){var rows=[],row=[],f='',q=false;for(var i=0;i<text.length;i++){var c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===delim){row.push(f.trim());f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f.trim());f='';if(row.some(Boolean))rows.push(row);row=[]}else f+=c}row.push(f.trim());if(row.some(Boolean))rows.push(row);return rows}
var parsed=[],heads=[],source='Uploaded file';
function onFile(e){var f=e.target.files[0];if(!f)return;source=f.name;var rd=new FileReader();rd.onload=function(){var text=String(rd.result).replace(/^﻿/,''),first=text.split(/\r?\n/)[0]||'',delim=first.indexOf('\t')>=0?'\t':first.indexOf(';')>=0&&first.indexOf(',')<0?';':',',rows=parseCSV(text,delim);if(!rows.length)return;heads=rows[0];if(heads.length===1&&!/name|person|employee|member|contact/i.test(heads[0])){previewImport(rows.map(function(r){return r[0]}),source);return}parsed=rows.slice(1);var lc=heads.map(function(h){return h.toLowerCase()}),fi=lc.indexOf('first name'),li=lc.indexOf('last name'),opts='';if(fi>=0&&li>=0)opts+='<option value="fml">First + Middle + Last name</option>';opts+=heads.map(function(h,i){return '<option value="'+i+'">'+esc(h||('Column '+(i+1)))+'</option>'}).join('');$('column').innerHTML=opts;var ni=lc.indexOf('name');if(!(fi>=0&&li>=0)&&ni>=0)$('column').value=String(ni);$('columnBox').classList.remove('hidden');$('preview').textContent='First rows: '+columnNames().slice(0,5).join(' • ')};rd.readAsText(f);e.target.value=''}
function columnNames(){var v=$('column').value,lc=heads.map(function(h){return h.toLowerCase()});if(v==='fml'){var fi=lc.indexOf('first name'),mi=lc.indexOf('middle name'),li=lc.indexOf('last name');return parsed.map(function(r){return [r[fi],mi>=0?r[mi]:'',r[li]].filter(Boolean).join(' ')})}var c=Number(v);return parsed.map(function(r){return r[c]})}

var pending=null;
function previewImport(names,src){
  var people=PR.db.people,dead=PR.db.deletedPeople||{},existingCount=0,deletedCount=0,seen={},fresh=[];
  names.forEach(function(x){x=cleanName(x);if(!x||/^[\d\s+()-]+$/.test(x))return;var k=keyOf(x);if(seen[k])return;seen[k]=1;if(people[k]){existingCount++;return}if(dead[k]){deletedCount++;return}fresh.push({name:x,key:k})});
  // near-duplicate check against names already in the list
  var idxSorted={},idxSquash={},all=Object.keys(people).map(function(k){var t=tokens(people[k].name);idxSorted[t.slice().sort().join(' ')]=people[k].name;idxSquash[t.join('')]=people[k].name;return {name:people[k].name,t:t,sq:t.join('')}}),useLev=fresh.length<=400;
  fresh.forEach(function(n){var t=tokens(n.name),sq=t.join(''),srt=t.slice().sort().join(' '),hit=idxSorted[srt]||idxSquash[sq]||'';if(!hit&&t.length){for(var i=0;i<all.length&&!hit;i++){var e=all[i];if(!e.t.length)continue;if(t.length>=2&&e.t.length>=2&&(subset(t,e.t)||subset(e.t,t)))hit=e.name;else if(useLev&&sq.length>=7&&e.sq[0]===sq[0]&&lev(sq,e.sq)<=1)hit=e.name}}n.like=hit});
  pending={src:src,fresh:fresh};
  var box=$('importPreview'),dups=fresh.filter(function(n){return n.like}).length;
  var html='<div class="imp"><b>Import preview</b><p class="impSum"><span>'+fresh.length+' new</span><span>'+existingCount+' already in your list</span><span>'+deletedCount+' you deleted earlier (skipped)</span></p>';
  if(!fresh.length){html+='<p>Nothing new to add.</p><button class="secondary small" id="impCancel">Close</button></div>';box.innerHTML=html;return}
  if(dups)html+='<p class="impWarn">'+dups+' look like names you already have. They are unticked — tick any that are really different people.</p>';
  html+='<label class="inl">Hook for all new names <select id="impGroup"><option value="">— none —</option>'+GROUPS.map(function(g){return '<option>'+esc(g)+'</option>'}).join('')+'</select></label>';
  html+='<div class="impList">'+fresh.map(function(n,i){return '<label class="impRow'+(n.like?' dup':'')+'"><input type="checkbox" data-imp="'+i+'"'+(n.like?'':' checked')+'><span>'+esc(n.name)+(n.like?' <small>looks like: '+esc(n.like)+'</small>':'')+'</span></label>'}).join('')+'</div>';
  html+='<div class="row"><button id="impAdd">Add ticked names</button><button class="secondary" id="impCancel">Cancel</button></div></div>';
  box.innerHTML=html;box.scrollIntoView({behavior:'smooth',block:'start'});
}
function commitImport(){if(!pending)return;var g=$('impGroup')?$('impGroup').value:'',n=0,ts=now();Array.prototype.forEach.call(document.querySelectorAll('#importPreview [data-imp]'),function(cb){if(!cb.checked)return;var it=pending.fresh[Number(cb.dataset.imp)];if(!it||PR.db.people[it.key])return;PR.db.people[it.key]={name:it.name,history:[],sources:[pending.src],addedAt:ts,groups:g?[g]:[],groupsAt:ts};if(PR.db.deletedPeople)delete PR.db.deletedPeople[it.key];n++});pending=null;save();render();$('importPreview').innerHTML='<div class="imp"><b>Added '+n+' new name'+(n===1?'':'s')+'.</b> Pick "New names" under Review to start on them.</div>'}

/* ---------- hooks editor ---------- */
function hookEditor(p){var gs=groupsOf(p);return '<div class="hookEd" data-key="'+esc(keyOf(p.name))+'"><div class="hookName">'+esc(p.name)+'</div><div class="chips">'+GROUPS.map(function(g){return '<button type="button" class="chip'+(gs.indexOf(g)>=0?' on':'')+'" data-g="'+esc(g)+'">'+esc(g)+'</button>'}).join('')+'</div><textarea class="hookNote" placeholder="Note — how you know them, where, who they are related to">'+esc(p.note||'')+'</textarea><div class="row"><button type="button" class="small hookSave">Save hooks</button><span class="muted hookMsg"></span></div></div>'}
function wireEditor(root,after){root.addEventListener('click',function(e){var ed=e.target.closest('.hookEd');if(!ed)return;if(e.target.classList.contains('chip')){e.target.classList.toggle('on');return}if(e.target.classList.contains('hookSave')){var p=PR.db.people[ed.dataset.key];if(!p)return;var ts=now(),gs=Array.prototype.map.call(ed.querySelectorAll('.chip.on'),function(c){return c.dataset.g}),note=ed.querySelector('.hookNote').value.trim();p.groups=gs;p.groupsAt=ts;if(note!==(p.note||'')){p.note=note;p.noteAt=ts}save();render();ed.querySelector('.hookMsg').textContent='Saved ✓';if(after)after(p)}})}
function hooksHtml(p){var gs=groupsOf(p);return '<div class="pReveal"><div class="hookName">'+esc(p.name)+'</div>'+(gs.length?'<div class="chips">'+gs.map(function(g){return '<span class="chip on">'+esc(g)+'</span>'}).join('')+'</div>':'<p class="muted">No hook yet — tap ✎ Hooks below to add how you know them.</p>')+(p.note?'<p class="pNote">'+esc(p.note)+'</p>':'')+'</div>'}

/* ---------- session ---------- */
window.peopleDecorate=function(p){$('hint').textContent='Recall who they are, then tap the card to check';$('hookBtn').classList.remove('hidden');$('hookEdit').classList.add('hidden');$('hookEdit').innerHTML=''};
window.peopleReveal=function(p){var r=$('taskReveal');r.innerHTML=hooksHtml(PR.db.people[keyOf(p.name)]||p);r.classList.remove('hidden')};
function toggleSessionEditor(){var box=$('hookEdit'),p=PR.cards[PR.idx];if(!p)return;if(!box.classList.contains('hidden')){box.classList.add('hidden');return}box.innerHTML=hookEditor(PR.db.people[keyOf(p.name)]||p);box.classList.remove('hidden')}

/* ---------- review filter ---------- */
function isNew(p){return p.addedAt&&(Date.now()-new Date(p.addedAt).getTime())<30*864e5}
window.peopleFiltered=function(){var v=$('peopleFilter')?$('peopleFilter').value:'',a=Object.values(PR.db.people);if(!v)return a;if(v==='__new')return a.filter(isNew);if(v==='__none')return a.filter(function(p){return !groupsOf(p).length});return a.filter(function(p){return groupsOf(p).indexOf(v)>=0})};
window.peopleRenderExtras=function(){var sel=$('peopleFilter');if(!sel)return;var a=Object.values(PR.db.people),cur=sel.value,cnt=function(f){return a.filter(f).length};var o='<option value="">All names ('+a.length+')</option><option value="__new">New names, last 30 days ('+cnt(isNew)+')</option><option value="__none">No hook yet ('+cnt(function(p){return !groupsOf(p).length})+')</option>'+GROUPS.map(function(g){return '<option value="'+esc(g)+'">'+esc(g)+' ('+cnt(function(p){return groupsOf(p).indexOf(g)>=0})+')</option>'}).join('');sel.innerHTML=o;sel.value=cur;if(sel.value!==cur)sel.value='';if($('pSearch')&&$('pSearch').value)searchPeople()};

/* ---------- find & tag in Manage ---------- */
var shown=[];
function searchPeople(){var q=$('pSearch').value.trim().toLowerCase(),out=$('pResults');if(!q){out.innerHTML='';shown=[];$('bulkRow').classList.add('hidden');return}var all=Object.values(PR.db.people).filter(function(p){return p.name.toLowerCase().indexOf(q)>=0||(p.note||'').toLowerCase().indexOf(q)>=0}).sort(function(a,b){return a.name.localeCompare(b.name)});shown=all;out.innerHTML='<p class="muted">'+all.length+' match'+(all.length===1?'':'es')+(all.length>60?' — showing first 60':'')+'</p>'+all.slice(0,60).map(function(p){var gs=groupsOf(p);return '<div class="person"><span>'+esc(p.name)+(gs.length?' <small>'+esc(gs.join(', '))+'</small>':'')+'</span><button class="secondary small" data-hk="'+encodeURIComponent(keyOf(p.name))+'">✎ Hooks</button></div><div class="hkSlot" data-slot="'+encodeURIComponent(keyOf(p.name))+'"></div>'}).join('');$('bulkRow').classList.toggle('hidden',!all.length)}
function bulkAdd(){var g=$('bulkGroup').value;if(!g||!shown.length)return;if(!confirm('Add the hook "'+g+'" to all '+shown.length+' matching names?'))return;var ts=now();shown.forEach(function(p){var gs=groupsOf(p).slice();if(gs.indexOf(g)<0){gs.push(g);p.groups=gs;p.groupsAt=ts}});save();render();searchPeople()}

function init(){
  $('file').addEventListener('change',onFile);
  $('column').addEventListener('change',function(){$('preview').textContent='First rows: '+columnNames().slice(0,5).join(' • ')});
  $('importBtn').addEventListener('click',function(){previewImport(columnNames(),source);$('columnBox').classList.add('hidden')});
  $('pasteBtn').addEventListener('click',function(){var v=$('paste').value.trim();if(v){previewImport(v.split(/\r?\n/),'Pasted names');$('paste').value=''}});
  $('importPreview').addEventListener('click',function(e){if(e.target.id==='impAdd')commitImport();else if(e.target.id==='impCancel'){pending=null;$('importPreview').innerHTML=''}});
  $('hookBtn').addEventListener('click',toggleSessionEditor);
  wireEditor($('hookEdit'),function(p){if($('flash').classList.contains('flipped'))peopleReveal(p)});
  $('pSearch').addEventListener('input',searchPeople);
  $('pResults').addEventListener('click',function(e){var k=e.target.dataset.hk;if(!k)return;var slot=document.querySelector('[data-slot="'+k+'"]');if(slot.innerHTML){slot.innerHTML='';return}var p=PR.db.people[decodeURIComponent(k)];if(p)slot.innerHTML=hookEditor(p)});
  wireEditor($('pResults'));
  $('bulkGroup').innerHTML='<option value="">Choose a hook…</option>'+GROUPS.map(function(g){return '<option>'+esc(g)+'</option>'}).join('');
  $('bulkAdd').addEventListener('click',bulkAdd);
  peopleRenderExtras();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
