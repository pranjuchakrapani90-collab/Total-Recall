// Cloudflare Worker bridge for Total Recall.
// Secrets: TICKTICK_ACCESS_TOKEN for TickTick and OPENAI_API_KEY for Memory Lane AI.
// Never put either token in index.html or this repository.

const ALLOWED_ORIGIN = 'https://pranjuchakrapani90-collab.github.io';
const RESPONSIBILITIES = ['SDE-TECH','SDE-REV','SDE-ESTT','HOME-MANAGER','BROTHER','SON'];
const API = 'https://api.ticktick.com/open/v1';
const OPENAI_API = 'https://api.openai.com/v1/responses';

/* ---------- Security lock (26 Oct 2026) ----------
   Every route except GPSLogger's live-log needs header X-Pranju-Key = the owner's Pranju OS sync code
   (pos-guard.js adds it on every page). Before this, anyone who found this Worker's URL (it is in the
   public repo) could read and change TickTick, read/approve money drafts, spend the OpenAI key and flood KV.
   Owner: Worker secret OWNER_CODE (if set), else KV "auth:owner", enrolled automatically the first time a
   code arrives whose sync vault already existed (only the real owner holds that code). */
const hex=buf=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
const sha=async t=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)));
const OWNER_SLOTS=['','#melodies','#path','#fingerstyle','#solos','#estimates','#sldsurvey','#health','#inv-cash','#inv-etf','#inv-pkp','#inv-pf'];
/* KV name for a sync vault. It used to be SHA-256(code), the very bytes the pages use as the AES key, so anyone
   who could list KV could decrypt everything. Now it is a separate, labelled hash; old names are moved on first use. */
const kvName=async c=>'vault2:'+await sha('kv-name-v2|'+c);
let ownerCache=null;
async function ownerHash(env){
  if(env.OWNER_CODE)return sha('owner|'+String(env.OWNER_CODE).trim());
  if(ownerCache)return ownerCache;
  if(!env.SYNC_KV)return null;
  const h=await env.SYNC_KV.get('auth:owner');if(h)ownerCache=h;return h;}
async function vaultExists(env,code){
  for(const slot of OWNER_SLOTS){const c=code+slot;
    if(await env.SYNC_KV.get('vault:'+await sha(c))!==null)return true;
    if(await env.SYNC_KV.get(await kvName(c))!==null)return true;}
  return false;}
/* null when allowed, else the error Response */
async function requireOwner(request,env,origin){
  const deny=async(msg,st)=>{await new Promise(r=>setTimeout(r,400));return new Response(JSON.stringify({error:msg,auth:false}),{status:st||401,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});};
  const key=String(request.headers.get('X-Pranju-Key')||'').trim();
  if(key.length<8)return deny('Locked: turn on ☁ Sync on this device with your Pranju OS sync code.');
  const mine=await sha('owner|'+key);
  let owner=await ownerHash(env);
  if(!owner){ // first use after the lock: enrol only a code that already owns a sync vault
    if(!env.SYNC_KV||!(await vaultExists(env,key)))return deny('Locked: this sync code is not the owner code.',403);
    await env.SYNC_KV.put('auth:owner',mine);ownerCache=owner=mine;}
  if(mine!==owner)return deny('Locked: this sync code is not the owner code.',403);
  const sc=request.headers.get('X-Total-Recall-Sync');
  if(sc!==null){const c=String(sc).trim();if(c!==key&&c.indexOf(key+'#')!==0)return deny('That sync slot does not belong to this code.',403);}
  return null;}

function corsHeaders(origin) {
  const allowed=origin===ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed?origin:ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Total-Recall-Sync, X-Live-Token, X-Pranju-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  };
}
function normTag(t) { return String(t || '').trim().replace(/^#/,'').toUpperCase().replace(/\s+/g,'-'); }
function taskTags(task) { const raw=task&&task.tags; if(Array.isArray(raw))return raw.map(normTag); if(raw&&typeof raw==='object')return Object.keys(raw).map(normTag); if(typeof raw==='string')return raw.split(',').map(normTag); return []; }
function todayInZone(timeZone){const now=new Date();const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;}
function addDays(isoDate,days){const d=new Date(isoDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function localIsoStart(date){return date+'T00:00:00.000+0530';}
function localIsoEnd(date){return date+'T23:59:59.999+0530';}
function dateInZone(value,timeZone){if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value).slice(0,10);const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;}
function uniqueKey(task,tags){const title=String(task.title||'(Untitled TickTick task)').trim().toLowerCase().replace(/\s+/g,' ');const project=String(task.projectId||'');const resp=tags.filter(t=>RESPONSIBILITIES.indexOf(t)>=0).sort().join('|');return title+'|'+project+'|'+resp;}
function scheduleTitle(task){return String(task&&task.title||'').trim().toLowerCase().replace(/\s+/g,' ');}
function sameScheduledTask(a,b){const at=scheduleTitle(a),bt=scheduleTitle(b);if(!at||!bt||at!==bt)return false;const ap=String(a&&a.projectId||''),bp=String(b&&b.projectId||'');return !ap||!bp||ap===bp;}
async function tick(path,token,options={}){const r=await fetch(API+path,{method:options.method||'GET',headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});if(!r.ok){const text=await r.text();throw new Error('TickTick API HTTP '+r.status+' for '+path+': '+text.slice(0,300));}return r.json();}
async function fetchCompletedTasksForRange(start,end,token){
  try{return{source:'search',result:await tick('/task/search',token,{method:'POST',body:{dueFrom:localIsoStart(start),dueTo:localIsoEnd(end),status:[2]}})}}
  catch(_){return{source:'filter',result:await tick('/task/filter',token,{method:'POST',body:{startDate:localIsoStart(start),endDate:localIsoEnd(end),status:[2]}})}}
}
async function fetchOpenTasksForRange(start,end,token){
  try{return{source:'filter',result:await tick('/task/filter',token,{method:'POST',body:{startDate:localIsoStart(start),endDate:localIsoEnd(end),status:[0]}})}}
  catch(_){return{source:'search',result:await tick('/task/search',token,{method:'POST',body:{dueFrom:localIsoStart(start),dueTo:localIsoEnd(end),status:[0]}})}}
}
async function fetchCompletedTasksForDay(day,token){try{return{source:'search',result:await tick('/task/search',token,{method:'POST',body:{dueFrom:localIsoStart(day),dueTo:localIsoEnd(day),status:[2]}})}}catch(_){return{source:'filter',result:await tick('/task/filter',token,{method:'POST',body:{startDate:localIsoStart(day),endDate:localIsoEnd(day),status:[2]}})}}}
async function fetchOpenTasksForDay(day,token){try{return{source:'filter',result:await tick('/task/filter',token,{method:'POST',body:{startDate:localIsoStart(day),endDate:localIsoEnd(day),status:[0]}})}}catch(_){return{source:'search',result:await tick('/task/search',token,{method:'POST',body:{dueFrom:localIsoStart(day),dueTo:localIsoEnd(day),status:[0]}})}}}
function unwrapTasks(result){return Array.isArray(result)?result:((result&&result.tasks)||[]);}

const EPISODE_SCHEMA={type:'object',additionalProperties:false,properties:{id:{type:'string'},type:{type:'string'},title:{type:'string'},startDate:{type:'string'},endDate:{type:'string'},summary:{type:'string'},people:{type:'array',items:{type:'string'}},topics:{type:'array',items:{type:'string'}},events:{type:'array',items:{type:'string'}},recallCue:{type:'string'},evidence:{type:'array',items:{type:'object',additionalProperties:false,properties:{messageId:{type:'string'},reason:{type:'string'}},required:['messageId','reason']}}},required:['id','type','title','startDate','endDate','summary','people','topics','events','recallCue','evidence']};
const PERSON_SCHEMA={type:'object',additionalProperties:false,properties:{name:{type:'string'},aliases:{type:'array',items:{type:'string'}},role:{type:'string'},context:{type:'string'},confidence:{type:'string'}},required:['name','aliases','role','context','confidence']};
const MEMORY_SCHEMA={type:'object',additionalProperties:false,properties:{episodes:{type:'array',items:EPISODE_SCHEMA},people:{type:'array',items:PERSON_SCHEMA}},required:['episodes','people']};

async function memoryExtract(request,env){
  if(!env.OPENAI_API_KEY)return new Response(JSON.stringify({error:'OPENAI_API_KEY secret is not configured on the Worker. Add it in Cloudflare Worker Secrets before running AI extraction.'}),{status:500,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const body=await request.json();
  if(!body||!Array.isArray(body.messages)||!body.messages.length)return new Response(JSON.stringify({error:'messages array is required'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  if(body.messages.length>120)return new Response(JSON.stringify({error:'Maximum 120 messages per extraction batch'}),{status:413,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const source=body.source||{};
  const transcript=body.messages.map(m=>`[${m.id}] ${m.date} | ${m.sender}: ${m.body}`).join('\n');
  const instructions=`You are the Memory Lane extraction engine for a private personal archive. Turn a chronological slice of WhatsApp messages into durable memory episodes and people context. Source truth is sacred: never invent a person, event, date, relationship, feeling, or fact that is not supported by the supplied messages. Prefer uncertainty over guessing. Do not treat automated notices, encryption notices, delivery receipts, or order-system boilerplate as meaningful interpersonal memories unless they are clearly useful context. An episode is a coherent memorable unit: a conversation beginning, decision, plan, visit, argument, celebration, work incident, relationship development, family moment, recurring theme, or other meaningful arc. Episodes may overlap slightly. Keep titles human and specific. Summary should read like a compact memory prompt, not a generic transcript summary. recallCue should ask the user to retrieve the memory before revealing it. Evidence must point only to supplied message IDs and briefly explain why each message matters. People are named participants or people clearly discussed in the slice; aliases should capture alternate spellings or names only when evidenced. The self-chat source is personal journal/context, not another person. This is source ${source.name||'unknown'}, batch ${Number(body.batchIndex||0)+1} of ${body.totalBatches||1}.`;
  const payload={model:env.MEMORY_MODEL||'gpt-5.6-luna',store:false,instructions,input:`SOURCE METADATA: ${JSON.stringify({id:source.id,name:source.name,kind:source.kind})}\n\nMESSAGES:\n${transcript}`,text:{format:{type:'json_schema',name:'memory_lane_extraction',strict:true,schema:MEMORY_SCHEMA}}};
  const r=await fetch(OPENAI_API,{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const raw=await r.text();if(!r.ok)return new Response(JSON.stringify({error:'OpenAI API HTTP '+r.status+': '+raw.slice(0,500)}),{status:502,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const data=JSON.parse(raw);let text=data.output_text||'';if(!text&&Array.isArray(data.output)){for(const item of data.output){for(const c of (item.content||[])){if(c.type==='output_text')text+=c.text||'';}}}let parsed;try{parsed=JSON.parse(text)}catch(e){return new Response(JSON.stringify({error:'AI returned non-JSON output',raw:text.slice(0,2000)}),{status:502,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}})}
  return new Response(JSON.stringify({...parsed,meta:{model:data.model||payload.model,responseId:data.id||'',batchIndex:body.batchIndex||0}}),{status:200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
}


async function handleTravelFile(request,env){
  if(!env.SYNC_KV)return new Response(JSON.stringify({error:'Cloud sync is not configured: SYNC_KV binding is missing on the Worker.'}),{status:503,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const code=String(request.headers.get('X-Total-Recall-Sync')||'').trim();
  if(code.length<8)return new Response(JSON.stringify({error:'A sync code of at least 8 characters is required.'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const fileId=String(new URL(request.url).searchParams.get('fileId')||'').trim();
  if(!/^gpx-[a-f0-9]{64}$/.test(fileId))return new Response(JSON.stringify({error:'Invalid travel file id.'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const key='travel-file2:'+await sha('kv-name-v2|'+code)+':'+fileId,oldKey='travel-file:'+await sha(code)+':'+fileId;
  if(request.method==='GET'){
    let blob=await env.SYNC_KV.get(key);
    if(blob===null){blob=await env.SYNC_KV.get(oldKey);if(blob!==null){await env.SYNC_KV.put(key,blob);await env.SYNC_KV.delete(oldKey);}}
    if(blob===null)return new Response(JSON.stringify({error:'Travel file not found.'}),{status:404,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
    return new Response(blob,{status:200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  if(request.method==='PUT'){
    const blob=await request.text();
    if(!blob)return new Response(JSON.stringify({error:'Encrypted travel file is empty.'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
    if(new TextEncoder().encode(blob).byteLength>25*1024*1024)return new Response(JSON.stringify({error:'Travel file exceeds the 25 MiB Workers KV value limit after encryption.'}),{status:413,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
    await env.SYNC_KV.put(key,blob);await env.SYNC_KV.delete(oldKey);
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  }
  return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
}

/* Travel Trace live tracking.
   GPSLogger (mendhak) on the phone calls, for every recorded point:
     GET or POST ?mode=live-log&k=<live token>&lat=%LAT&lon=%LON&ts=%TIMESTAMP&time=%TIME&acc=%ACC&spd=%SPD&alt=%ALT
   (query values win; a form or JSON body fills anything missing). Pranju OS reads with header X-Live-Token:
     GET ?mode=live                      -> {days:[{day,n,last}]}
     GET ?mode=live&day=YYYY-MM-DD&since=<ms> -> {points:[[ms,lat,lon,acc,spd,alt],...]}
     DELETE ?mode=live&day=YYYY-MM-DD&upto=<ms> (after the day is saved as GPX in the encrypted archive)
   Days are India (IST) calendar days. Points sit here, unencrypted, only until a finished day is archived. */
const LIVE_IST_MS=19800000;
const liveDay=ms=>new Date(ms+LIVE_IST_MS).toISOString().slice(0,10);
export class LiveTrack{
  constructor(state){
    this.sql=state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS pts(ms INTEGER PRIMARY KEY, day TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, acc REAL, spd REAL, alt REAL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS pts_day ON pts(day, ms)');
  }
  async fetch(request){
    const u=new URL(request.url),op=u.searchParams.get('op'),day=u.searchParams.get('day')||'';
    if(op==='add'){const p=await request.json();
      this.sql.exec('INSERT OR REPLACE INTO pts(ms,day,lat,lon,acc,spd,alt) VALUES(?,?,?,?,?,?,?)',p.ms,p.day,p.lat,p.lon,p.acc,p.spd,p.alt);
      return Response.json({ok:true});}
    if(op==='days')return Response.json({days:this.sql.exec('SELECT day, COUNT(*) AS n, MAX(ms) AS last FROM pts GROUP BY day ORDER BY day').toArray()});
    if(op==='get'){const since=Number(u.searchParams.get('since'))||0;
      return Response.json({points:[...this.sql.exec('SELECT ms,lat,lon,acc,spd,alt FROM pts WHERE day=? AND ms>? ORDER BY ms',day,since).raw()]});}
    if(op==='del'){const upto=Number(u.searchParams.get('upto'))||0;
      this.sql.exec('DELETE FROM pts WHERE day=? AND ms<=?',day,upto);
      return Response.json({ok:true});}
    return Response.json({error:'Unknown operation'},{status:400});
  }
}
async function handleLive(request,env,origin){
  const url=new URL(request.url),q=url.searchParams,mode=q.get('mode');
  const json=(o,s)=>new Response(JSON.stringify(o),{status:s||200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
  if(!env.LIVE_TRACK)return json({error:'Live tracking is not set up on the Worker yet (LIVE_TRACK binding is missing).'},503);
  const token=String((mode==='live-log'?q.get('k'):request.headers.get('X-Live-Token'))||'').trim();
  if(!/^[A-Za-z0-9_-]{20,80}$/.test(token))return json({error:'Missing or invalid live token.'},400);
  const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('live:'+token));
  const stub=env.LIVE_TRACK.get(env.LIVE_TRACK.idFromName(Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')));
  const call=(op,params,body)=>stub.fetch('https://live/?op='+op+(params||''),body?{method:'POST',body:JSON.stringify(body)}:{}).then(r=>r.json());
  if(mode==='live-log'){
    const v={};
    if(request.method==='POST'){
      const ct=request.headers.get('Content-Type')||'',raw=await request.text();
      try{if(ct.includes('json')||raw.trim().startsWith('{'))Object.assign(v,JSON.parse(raw));else new URLSearchParams(raw).forEach((val,k)=>{v[k]=val;});}catch(e){}
    }
    q.forEach((val,k)=>{v[k]=val;});
    const num=x=>{const n=Number(x);return x===undefined||x===null||String(x).trim()===''||!isFinite(n)?null:n;};
    const lat=num(v.lat??v.latitude),lon=num(v.lon??v.lng??v.longitude);
    if(lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return json({error:'lat and lon are required.'},400);
    let ms=num(v.ts??v.timestamp);if(ms!==null&&ms<1e12)ms*=1000;
    if(ms===null&&v.time){const d=Date.parse(v.time);if(isFinite(d))ms=d;}
    const now=Date.now();if(ms===null||ms>now+600000||ms<now-60*86400000)ms=now;
    ms=Math.round(ms);
    await call('add','',{ms,day:liveDay(ms),lat,lon,acc:num(v.acc??v.accuracy),spd:num(v.spd??v.speed),alt:num(v.alt??v.altitude)});
    return new Response('OK',{status:200,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
  }
  const day=q.get('day')||'';
  if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({error:'Invalid day.'},400);
  if(request.method==='GET')return json(day?await call('get','&day='+day+'&since='+(Number(q.get('since'))||0)):{...await call('days'),today:liveDay(Date.now())});
  if(request.method==='DELETE'&&day)return json(await call('del','&day='+day+'&upto='+(Number(q.get('upto'))||0)));
  return json({error:'Method not allowed'},405);
}

/* Live NSE prices for the Investments pages (ETF Shop, JuniorBees PKP).
   GET ?mode=quotes&s=ITBEES,GOLDBEES  (up to 40 symbols, NSE codes without "NSE:")
   Returns per symbol: live price, previous session close, day change %, and daily closes for ~2 years
   (the page works out the 52-week-high close and the highest close since each buy from them).
   Source: Yahoo Finance's public chart data for NSE (.NS); no keys or secrets involved. */
async function yahooChart(sym){
  const hosts=['https://query1.finance.yahoo.com','https://query2.finance.yahoo.com'];let last='';
  for(const h of hosts){try{
    const r=await fetch(h+'/v8/finance/chart/'+encodeURIComponent(sym+'.NS')+'?range=2y&interval=1d&includePrePost=false',
      {headers:{'User-Agent':'Mozilla/5.0 (compatible; TotalRecall/1.0)','Accept':'application/json'},cf:{cacheTtl:45,cacheEverything:true}});
    if(!r.ok){last='HTTP '+r.status;continue;}
    const j=await r.json(),res=j&&j.chart&&j.chart.result&&j.chart.result[0];
    if(!res){last=(j&&j.chart&&j.chart.error&&j.chart.error.description)||'no data';continue;}
    return res;}catch(e){last=String(e&&e.message||e);}}
  throw new Error(last||'no data');
}
const istDate=sec=>new Date((sec+19800)*1000).toISOString().slice(0,10);
/* Mutual fund NAVs for the Portfolio page: GET ?mode=nav&p=/mf/<code>/latest or /mf/search?q=<text> (passes through to mfapi.in) */
async function handleNav(request){const p=String(new URL(request.url).searchParams.get('p')||'');
  if(!/^\/mf\/(\d{3,8}\/latest|search\?q=[^&]{1,80})$/.test(p))return new Response(JSON.stringify({error:'bad path'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const r=await fetch('https://api.mfapi.in'+p,{cf:{cacheTtl:600,cacheEverything:true}});
  return new Response(await r.text(),{status:r.status,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});}
async function handleQuotes(request){
  const url=new URL(request.url),list=String(url.searchParams.get('s')||'').split(',').map(x=>x.trim().toUpperCase().replace(/^NSE:/,'')).filter(x=>/^[A-Z0-9&\-]{1,20}$/.test(x));
  const syms=[...new Set(list)].slice(0,40),out={};
  await Promise.all(syms.map(async sym=>{try{
    const res=await yahooChart(sym),m=res.meta||{},ts=res.timestamp||[],qq=((res.indicators||{}).quote||[{}])[0],cl=qq.close||[],lo=qq.low||[],hi=qq.high||[];
    const R=v=>v==null?null:Math.round(v*100)/100;
    /* each day: [date, close, low, high] (low/high let the PKP page tell whether a GTT trigger was touched intraday) */
    const days=[];for(let i=0;i<ts.length;i++){if(cl[i]!=null)days.push([istDate(ts[i]),R(cl[i]),R(lo[i]),R(hi[i])]);}
    const price=m.regularMarketPrice!=null?m.regularMarketPrice:(days.length?days[days.length-1][1]:null);
    const mt=m.regularMarketTime?istDate(m.regularMarketTime):(days.length?days[days.length-1][0]:'');
    const dLo=R(m.regularMarketDayLow),dHi=R(m.regularMarketDayHigh);
    if(days.length&&days[days.length-1][0]===mt){const d=days[days.length-1];d[1]=R(price);if(dLo!=null)d[2]=dLo;if(dHi!=null)d[3]=dHi;}
    else if(price!=null&&mt)days.push([mt,R(price),dLo,dHi]);
    const prev=days.length>1?days[days.length-2][1]:null;
    out[sym]={price,prev,chg:prev?(price/prev-1)*100:null,time:m.regularMarketTime||null,day:mt,dayLow:dLo,dayHigh:dHi,closes:days};
  }catch(e){out[sym]={error:String(e&&e.message||e)};}}));
  return new Response(JSON.stringify({at:Date.now(),quotes:out}),{headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
}
async function handleSync(request,env){
  if(!env.SYNC_KV)return new Response(JSON.stringify({error:'Cloud sync is not configured: SYNC_KV binding is missing on the Worker.'}),{status:503,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const code=String(request.headers.get('X-Total-Recall-Sync')||'').trim();
  if(code.length<8)return new Response(JSON.stringify({error:'A sync code of at least 8 characters is required.'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  const key=await kvName(code),oldKey='vault:'+await sha(code);
  if(request.method==='POST'){
    const body=await request.json();
    if(!body||!body.state)return new Response(JSON.stringify({error:'state is required'}),{status:400,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
    let blob=await env.SYNC_KV.get(key);
    if(blob===null){blob=await env.SYNC_KV.get(oldKey);if(blob!==null){await env.SYNC_KV.put(key,blob);await env.SYNC_KV.delete(oldKey);}}
    return new Response(JSON.stringify({blob:blob||null}),{status:200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  }
  if(request.method==='PUT'){
    const blob=await request.text();
    if(!blob)throw new Error('Encrypted sync payload is empty');
    if(blob.length>20*1024*1024)throw new Error('Sync payload too large');
    await env.SYNC_KV.put(key,blob);
    if(await env.SYNC_KV.get(oldKey)!==null)await env.SYNC_KV.delete(oldKey);
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  }
  return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
}
/* WhatsApp Review: Claude drafts items from the WhatsApp self-chat into a TickTick project named "WA REVIEW".
   Pranju OS lists them (GET ?mode=wa-review) and, per item, approves it into its destination project with the
   edited title/tags/date/notes (POST action=approve) or discards it (POST action=discard).
   Writes only ever touch tasks that are inside the WA REVIEW project. */
const WA_PROJECT='wa review';
const WA_TARGETS=['inbox','reference','schedule','projects','checklists'];
function waMeta(content){const s=String(content||'');const line=(s.match(/\[wa\][^\n]*$/i)||[''])[0];const g=k=>{const m=line.match(new RegExp('(?:^|\\s)'+k+'=([^\\s]+)','i'));if(!m)return '';try{return decodeURIComponent(m[1])}catch(_){return m[1]}};const t=g('target'),r=g('repeat');
  return {target:t?t.toLowerCase():'inbox',repeat:r?r.toLowerCase():'none',update:g('update'),uproject:g('uproject'),utitle:g('utitle'),queued:g('approved')==='update',line,notes:s.replace(/\n?\[wa\][^\n]*$/i,'').trim()};}
/* 'update' drafts: news on a task he already has. Approving adds a dated comment to that task instead of creating a new one. */
function waDateLabel(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(new Date());return p;}
async function addComment(token,projectId,taskId,text){
  for(const path of ['/comment','/comments']){try{const r=await fetch(API+'/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId)+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({title:text})});if(r.ok)return true;}catch(_){}}
  return false;}
async function waProjects(token){const projects=await tick('/project',token);const list=Array.isArray(projects)?projects:((projects&&projects.projects)||[]);return list;}
async function handleWaReview(request,env,origin){
  const json=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
  const token=env.TICKTICK_ACCESS_TOKEN;if(!token)return json({error:'TICKTICK_ACCESS_TOKEN secret is not configured'},500);
  const list=await waProjects(token);const review=list.find(p=>String(p.name||'').trim().toLowerCase()===WA_PROJECT);
  if(!review)return json({items:[],note:'No TickTick project named WA REVIEW yet.'});
  const data=await tick('/project/'+encodeURIComponent(review.id)+'/data',token);
  const tasks=unwrapTasks(data&&data.tasks?data.tasks:data).filter(t=>!t.status);
  if(request.method==='GET'&&new URL(request.url).searchParams.get('list')==='tasks'){
    /* open tasks he can attach an update to: Inbox and his main lists; daily-repeat copies collapse to the newest */
    const want=['schedule','projects','reference','checklists'],out=[],seen=new Map();
    const srcs=[{id:'inbox',name:'Inbox'}].concat(list.filter(p=>want.indexOf(String(p.name||'').trim().toLowerCase())>=0));
    for(const p of srcs){let d;try{d=await tick('/project/'+encodeURIComponent(p.id)+'/data',token)}catch(_){continue}
      for(const t of unwrapTasks(d&&d.tasks?d.tasks:d)){if(t.status||!t.title)continue;const key=p.id+'|'+String(t.title).trim().toLowerCase();const o={id:t.id,projectId:t.projectId||p.id,project:p.name,title:t.title,tags:Array.isArray(t.tags)?t.tags:[],m:t.modifiedTime||t.createdTime||''};
        const prev=seen.get(key);if(!prev||String(o.m)>String(prev.m))seen.set(key,o);}}
    for(const o of seen.values())out.push(o);out.sort((a,b)=>String(b.m).localeCompare(String(a.m)));
    return json({tasks:out.slice(0,1500)});}
  if(request.method==='GET'){
    const items=tasks.map(t=>({t,m:waMeta(t.content||t.desc)})).filter(x=>!x.m.queued).map(({t,m})=>({id:t.id,title:t.title||'',notes:m.notes,target:m.target,repeat:m.repeat,update:m.update?{id:m.update,project:m.uproject,title:m.utitle}:null,tags:Array.isArray(t.tags)?t.tags:[],due:String(t.dueDate||'').slice(0,10),priority:t.priority||0,created:t.createdTime||''}));
    items.sort((a,b)=>String(a.created).localeCompare(String(b.created)));
    return json({projectId:review.id,items});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch(_){return json({error:'Invalid JSON'},400)}
  const task=tasks.find(t=>t.id===body.id);if(!task)return json({error:'That item is no longer in WA REVIEW.'},404);
  if(body.action==='discard'){await fetch(API+'/project/'+encodeURIComponent(review.id)+'/task/'+encodeURIComponent(task.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});return json({ok:true,discarded:task.id});}
  if(body.action!=='approve')return json({error:'Unknown action'},400);
  const wm=waMeta(task.content||task.desc);
  if(body.mode==='update'&&body.update&&body.uproject){if(!(body.uproject==='inbox'||/^inbox/.test(body.uproject)||list.some(p=>p.id===body.uproject)))return json({error:'Unknown project for that task'},400);wm.update=String(body.update);wm.uproject=String(body.uproject);wm.line=wm.line.replace(/\s*(update|uproject|utitle)=\S+/g,'')+' update='+encodeURIComponent(wm.update)+' uproject='+encodeURIComponent(wm.uproject)+' utitle='+encodeURIComponent(String(body.utitle||''));}
  if(body.mode==='update'&&wm.update&&wm.uproject){
    const text=(waDateLabel()+': '+String(body.notes||wm.notes||'')).slice(0,1020);
    const dropDraft=()=>fetch(API+'/project/'+encodeURIComponent(review.id)+'/task/'+encodeURIComponent(task.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
    if(await addComment(token,wm.uproject,wm.update,text)){await dropDraft();return json({ok:true,commented:wm.update});}
    /* comment API refused: keep the draft, marked approved; the nightly review adds the comment */
    await tick('/task/'+encodeURIComponent(task.id),token,{method:'POST',body:{id:task.id,projectId:review.id,title:task.title,content:String(body.notes||wm.notes||'')+'\n'+wm.line.replace(/\s*approved=\S+/,'')+' approved=update'}});
    return json({ok:true,queued:true});}
  const target=String(body.target||'inbox').toLowerCase();if(WA_TARGETS.indexOf(target)<0)return json({error:'Unknown destination'},400);
  let projectId='inbox';if(target!=='inbox'){const p=list.find(x=>String(x.name||'').trim().toLowerCase()===target);if(!p)return json({error:'TickTick project '+target.toUpperCase()+' not found'},404);projectId=p.id;}
  const tags=(Array.isArray(body.tags)?body.tags:[]).map(t=>String(t).trim().toLowerCase().replace(/^#/,'').replace(/\s+/g,'-')).filter(Boolean).slice(0,10);
  const out={title:String(body.title||task.title||'').slice(0,300),content:String(body.notes||'').slice(0,5000),tags,priority:[0,1,3,5].indexOf(+body.priority)>=0?+body.priority:(task.priority||0),timeZone:env.TIME_ZONE||'Asia/Kolkata'};
  if(projectId!=='inbox')out.projectId=projectId;
  let due=/^\d{4}-\d{2}-\d{2}$/.test(String(body.due||''))?body.due:'';
  if(body.repeat==='daily'){if(!due)due=todayInZone(env.TIME_ZONE||'Asia/Kolkata');out.repeatFlag='RRULE:FREQ=DAILY;INTERVAL=1';}
  if(due){out.dueDate=due+'T00:00:00.000+0530';out.startDate=out.dueDate;out.isAllDay=true;}
  const created=await tick('/task',token,{method:'POST',body:out});
  await fetch(API+'/project/'+encodeURIComponent(review.id)+'/task/'+encodeURIComponent(task.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  return json({ok:true,created:{id:created.id,projectId:created.projectId}});
}

/* Money from WhatsApp: Claude drafts money notes from the self-chat into the TickTick project "MONEY REVIEW",
   one task per amount, last line '[money] status=draft kind=in|out amt=.. acct=wallet|bank date=YYYY-MM-DD time=HH:MM cat=.. book=personal|apdcl'.
   Money Book (Pranju OS) lists drafts (GET ?mode=money-review) and, on approval, POSTs action=approve with the final values:
   approve (Personal or APDCL) or discard -> the task is deleted: the Money Book holds the entry (APDCL ones on its Imprest
   account; the FINANCE sheet is no longer written, 26 Oct 2026). Only tasks inside MONEY REVIEW are ever touched. */
const MONEY_PROJECT='money review';
function moneyMeta(content){const s=String(content||'');const line=(s.match(/\[money\][^\n]*$/i)||[''])[0];const o={};line.replace(/([a-z]+)=([^\s]*)/gi,(m,k,v)=>{try{o[k.toLowerCase()]=decodeURIComponent(v)}catch(_){o[k.toLowerCase()]=v}return m});o.notes=s.replace(/\n?\[money\][^\n]*$/i,'').trim();return o;}
function moneyLine(o){const enc=v=>encodeURIComponent(String(v==null?'':v));return '[money] status='+enc(o.status)+' kind='+enc(o.kind)+' amt='+enc(o.amt)+' acct='+enc(o.acct)+' date='+enc(o.date)+' time='+enc(o.time)+' cat='+enc(o.cat)+' book='+enc(o.book);}
async function handleMoneyReview(request,env,origin){
  const json=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
  const token=env.TICKTICK_ACCESS_TOKEN;if(!token)return json({error:'TICKTICK_ACCESS_TOKEN secret is not configured'},500);
  const projects=await tick('/project',token);const list=Array.isArray(projects)?projects:((projects&&projects.projects)||[]);
  const proj=list.find(p=>String(p.name||'').trim().toLowerCase()===MONEY_PROJECT);
  if(!proj)return json({items:[]});
  const data=await tick('/project/'+encodeURIComponent(proj.id)+'/data',token);
  const tasks=unwrapTasks(data&&data.tasks?data.tasks:data).filter(t=>!t.status);
  if(request.method==='GET'){
    const items=tasks.map(t=>({t,m:moneyMeta(t.content||t.desc)})).filter(x=>(x.m.status||'draft')==='draft'&&+x.m.amt>0).map(({t,m})=>({id:t.id,note:t.title||'',raw:m.notes,kind:m.kind==='in'?'in':'out',amt:+m.amt,acct:m.acct==='bank'?'bank':'wallet',date:/^\d{4}-\d{2}-\d{2}$/.test(m.date||'')?m.date:'',time:/^\d{2}:\d{2}$/.test(m.time||'')?m.time:'',cat:m.cat||'',book:m.book==='apdcl'?'apdcl':'personal'}));
    return json({items});}
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch(_){return json({error:'Invalid JSON'},400)}
  const task=tasks.find(t=>t.id===body.id);if(!task)return json({ok:true,gone:true});
  const del=()=>fetch(API+'/project/'+encodeURIComponent(proj.id)+'/task/'+encodeURIComponent(task.id),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  if(body.action==='discard'||body.action==='approve'){await del();return json({ok:true});}
  if(body.action!=='approve')return json({error:'Unknown action'},400);
  const m=moneyMeta(task.content||task.desc);
  const o={status:'approved',kind:body.kind==='in'?'in':'out',amt:+body.amt>0?+body.amt:+m.amt,acct:body.acct==='bank'?'bank':'wallet',date:/^\d{4}-\d{2}-\d{2}$/.test(body.date||'')?body.date:(m.date||''),time:/^\d{2}:\d{2}$/.test(body.time||'')?body.time:(m.time||''),cat:String(body.cat||m.cat||'').slice(0,40),book:'apdcl'};
  const title=String(body.note||task.title||'').slice(0,200);
  await tick('/task/'+encodeURIComponent(task.id),token,{method:'POST',body:{id:task.id,projectId:proj.id,title,content:(m.notes?m.notes+'\n':'')+moneyLine(o)}});
  return json({ok:true,kept:'apdcl'});
}

export default {async fetch(request,env){const origin=request.headers.get('Origin')||'';if(request.method==='OPTIONS'){const h=corsHeaders(origin);const requested=request.headers.get('Access-Control-Request-Headers');if(requested)h['Access-Control-Allow-Headers']=requested;return new Response(null,{status:204,headers:h});}const url=new URL(request.url);
 if(url.searchParams.get('mode')!=='live-log'){try{const denied=await requireOwner(request,env,origin);if(denied)return denied;}catch(e){return new Response(JSON.stringify({error:'Auth check failed'}),{status:503,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.pathname==='/memory-extract'){if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:corsHeaders(origin)});try{return await memoryExtract(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.pathname==='/sync'||url.searchParams.get('mode')==='sync'){try{return await handleSync(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='nav'){try{return await handleNav(request)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='quotes'||url.pathname==='/quotes'){try{return await handleQuotes(request)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='money-review'||url.pathname==='/money-review'){try{return await handleMoneyReview(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='wa-review'||url.pathname==='/wa-review'){try{return await handleWaReview(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='live'||url.searchParams.get('mode')==='live-log'){try{return await handleLive(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='travel-file'){try{return await handleTravelFile(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:corsHeaders(origin)});
 if(url.pathname!=='/'&&url.pathname!=='/responsibility-tasks'&&url.pathname!=='/completed-tasks'&&url.pathname!=='/task-detail')return new Response('Not found',{status:404,headers:corsHeaders(origin)});
 if(!env.TICKTICK_ACCESS_TOKEN)return new Response(JSON.stringify({error:'TICKTICK_ACCESS_TOKEN secret is not configured'}),{status:500,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
 try{const tz=env.TIME_ZONE||'Asia/Kolkata';
  if(url.pathname==='/task-detail'||url.searchParams.get('mode')==='task-detail'){const projectId=url.searchParams.get('projectId'),taskId=url.searchParams.get('taskId');if(!projectId||!taskId)throw new Error('projectId and taskId are required');const task=await tick('/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId),env.TICKTICK_ACCESS_TOKEN);let comments=[];try{const cr=await tick('/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId)+'/comments',env.TICKTICK_ACCESS_TOKEN);comments=Array.isArray(cr)?cr:((cr&&cr.comments)||[])}catch(_){comments=[]}return new Response(JSON.stringify({task,comments}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}

  if(url.pathname==='/reference-tasks'||url.searchParams.get('mode')==='reference'){const projects=await tick('/project',env.TICKTICK_ACCESS_TOKEN);const list=Array.isArray(projects)?projects:((projects&&projects.projects)||[]);const project=list.find(p=>String(p.name||'').trim().toLowerCase()==='reference');if(!project)throw new Error('TickTick project/section named Reference was not found.');const data=await tick('/project/'+encodeURIComponent(project.id)+'/data',env.TICKTICK_ACCESS_TOKEN);let tasks=unwrapTasks(data&&data.tasks?data.tasks:data);const start=url.searchParams.get('start')||'';const end=url.searchParams.get('end')||'';if(start||end){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('start and end must be YYYY-MM-DD');tasks=tasks.filter(task=>{const referenceDate=task.createdTime||task.createdDate||task.dateAdded||task.modifiedTime||task.modifiedDate||task.dueDate||task.due||'';const d=dateInZone(referenceDate,tz);return d&&d>=start&&d<=end})}const tags={};for(const task of tasks){const ts=taskTags(task);for(const tag of ts){if(!tags[tag])tags[tag]=[];tags[tag].push({id:task.id||'',title:task.title||'(Untitled reference item)',due:String(task.dueDate||task.due||'').slice(0,16),projectId:task.projectId||project.id,tags:ts})}}for(const k of Object.keys(tags)){const seen=new Set();tags[k]=tags[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}return new Response(JSON.stringify({section:'Reference',projectId:project.id,projectName:project.name,start:start||null,end:end||null,taskCount:tasks.length,tags}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}
if(url.pathname==='/completed-tasks'||url.searchParams.get('mode')==='completed'){const today=todayInZone(tz);const start=url.searchParams.get('start')||addDays(today,-6);const end=url.searchParams.get('end')||today;if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('start and end must be YYYY-MM-DD');const raw=[],seenRaw=new Set();let completedFetch;try{completedFetch=await fetchCompletedTasksForRange(start,addDays(end,1),env.TICKTICK_ACCESS_TOKEN)}catch(_){completedFetch=null}if(completedFetch){for(const task of unwrapTasks(completedFetch.result)){const id=String(task.id||'')+'|'+String(task.completedTime||task.completedDate||task.completeTime||'')+'|'+String(task.dueDate||task.due||'');if(!seenRaw.has(id)){seenRaw.add(id);raw.push(task)}}}else{for(let day=start;day<=addDays(end,1);day=addDays(day,1)){const fetched=await fetchCompletedTasksForDay(day,env.TICKTICK_ACCESS_TOKEN);for(const task of unwrapTasks(fetched.result)){const id=String(task.id||'')+'|'+String(task.completedTime||task.completedDate||task.completeTime||'')+'|'+String(task.dueDate||task.due||'');if(!seenRaw.has(id)){seenRaw.add(id);raw.push(task)}}}}const scheduledByDay=new Map();for(let day=start;day<=addDays(end,1);day=addDays(day,1))scheduledByDay.set(day,[]);for(const task of raw){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);const completedDate=dateInZone(task&&(task.completedTime||task.completedDate||task.completeTime||''),tz);if(dueDate&&scheduledByDay.has(dueDate))scheduledByDay.get(dueDate).push(task);if(completedDate&&scheduledByDay.has(completedDate)&&completedDate!==dueDate)scheduledByDay.get(completedDate).push(task)}let openFetched;try{openFetched=await fetchOpenTasksForRange(addDays(start,1),addDays(end,1),env.TICKTICK_ACCESS_TOKEN)}catch(_){openFetched=null}if(openFetched){for(const task of unwrapTasks(openFetched.result)){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);if(scheduledByDay.has(dueDate))scheduledByDay.get(dueDate).push(task)}}else{for(let day=addDays(start,1);day<=addDays(end,1);day=addDays(day,1)){const nextFetched=await fetchOpenTasksForDay(day,env.TICKTICK_ACCESS_TOKEN);for(const task of unwrapTasks(nextFetched.result)){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);if(dueDate===day)scheduledByDay.get(day).push(task)}}}const byKey=new Map();let matched=0,excludedContinuing=0;const diagnostics=[];for(const task of raw){const tags=taskTags(task);const completedValue=task.completedTime||task.completedDate||task.completeTime||'';const completedDate=dateInZone(completedValue,tz);const dueDate=dateInZone(task.dueDate||task.due||'',tz);const effectiveDate=completedDate||dueDate;if(!effectiveDate||effectiveDate<start||effectiveDate>end)continue;const nextDate=addDays(effectiveDate,1);const nextTasks=scheduledByDay.get(nextDate)||[];const continuation=nextTasks.find(nextTask=>nextTask.id!==task.id&&sameScheduledTask(task,nextTask));if(continuation){excludedContinuing++;diagnostics.push({title:task.title||'',completedDate:effectiveDate,nextDate,result:'EXCLUDED_CONTINUING',completedId:task.id||'',nextId:continuation.id||'',completedProjectId:task.projectId||'',nextProjectId:continuation.projectId||''});continue}matched++;const key=uniqueKey(task,tags);let item=byKey.get(key);if(!item){item={id:task.id||'',title:task.title||'(Untitled TickTick task)',projectId:task.projectId||'',tags,completionDates:[],completionCount:0};byKey.set(key,item)}if(item.completionDates.indexOf(effectiveDate)<0){item.completionDates.push(effectiveDate);item.completionCount++}diagnostics.push({title:task.title||'',completedDate:effectiveDate,nextDate,result:'INCLUDED_NO_NEXT_DAY_MATCH'})}const tasks=Array.from(byKey.values()).sort((a,b)=>a.title.localeCompare(b.title));tasks.forEach(t=>t.completionDates.sort());return new Response(JSON.stringify({start,end,timeZone:tz,uniqueCount:tasks.length,rawCount:raw.length,matchedCount:matched,excludedContinuing,tasks,diagnostics}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}
  const target=todayInZone(tz),groups=Object.fromEntries(RESPONSIBILITIES.map(k=>[k,[]])),allTags={};let result,source='search';try{result=await tick('/task/search',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{dueFrom:localIsoStart(target),dueTo:localIsoEnd(target),status:[0]}})}catch(_){source='filter';result=await tick('/task/filter',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{startDate:localIsoStart(addDays(target,-1)),endDate:localIsoEnd(addDays(target,1)),status:[0]}})}const tasks=unwrapTasks(result);let dueMatches=0,taggedMatches=0;for(const task of tasks){const due=task&&(task.dueDate||task.due||'');if(!due||dateInZone(due,tz)!==target)continue;dueMatches++;const tags=taskTags(task);const item={id:task.id||'',title:task.title||'(Untitled TickTick task)',due:String(due).slice(0,16),projectId:task.projectId||'',tags};for(const tag of tags){if(!allTags[tag])allTags[tag]=[];allTags[tag].push(item)}const matches=RESPONSIBILITIES.filter(r=>tags.indexOf(r)>=0);if(matches.length)taggedMatches++;for(const responsibility of matches)groups[responsibility].push(item)}for(const k of RESPONSIBILITIES){const seen=new Set();groups[k]=groups[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}for(const k of Object.keys(allTags)){const seen=new Set();allTags[k]=allTags[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}return new Response(JSON.stringify({date:target,timeZone:tz,responsibilities:groups,tags:allTags,debug:{source,taskCount:tasks.length,dueMatches,taggedMatches}}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})
 }catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}};
