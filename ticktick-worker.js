// Cloudflare Worker bridge for Total Recall.
// Secrets: TICKTICK_ACCESS_TOKEN for TickTick, OPENAI_API_KEY for Memory Lane AI,
// GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET for Travel Trace's Google Drive storage.
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
  if(request.method==='DELETE'){ // the day now lives in Google Drive (or was purged): free the KV space
    await env.SYNC_KV.delete(key);await env.SYNC_KV.delete(oldKey);
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
/* Storage is batched to stay inside Cloudflare's free Durable Objects quota (100,000 rows written a day):
   GPSLogger may send a point every 2 seconds (43,200 a day). Points wait in memory and are written as one row
   per ~20 seconds ("chunks"), so a full day is ~4,500 rows, plus ~4,500 to clear it after archiving.
   A 10-second alarm writes out whatever is waiting when the phone goes quiet. Reads include the waiting points.
   The first version stored one row per point (+ an index row) in table pts; it is still read until archived. */
const LIVE_FLUSH_MS=20000;
const liveDayStart=d=>Date.parse(d+'T00:00:00+05:30');
export class LiveTrack{
  constructor(state){
    this.state=state;this.sql=state.storage.sql;this.buf=[];this.bufAt=0;
    this.sql.exec('CREATE TABLE IF NOT EXISTS chunks(ms INTEGER PRIMARY KEY, last INTEGER NOT NULL, n INTEGER NOT NULL, pts TEXT NOT NULL)');
    this.oldTable=this.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='pts'").toArray().length>0;
    if(this.oldTable)this.sql.exec('CREATE TABLE IF NOT EXISTS old_done(day TEXT PRIMARY KEY)');
  }
  flush(){
    if(!this.buf.length)return;
    const b=this.buf;this.buf=[];this.bufAt=0;
    // one row per chunk; a chunk never spans two IST days
    let i=0;while(i<b.length){const d=liveDay(b[i][0]);let j=i;while(j<b.length&&liveDay(b[j][0])===d)j++;
      const part=b.slice(i,j);
      this.sql.exec('INSERT OR REPLACE INTO chunks(ms,last,n,pts) VALUES(?,?,?,?)',part[0][0],part[part.length-1][0],part.length,JSON.stringify(part));i=j;}
  }
  async alarm(){this.flush();}
  pointsOf(day,since){
    const a=liveDayStart(day),z=a+86400000,lo=Math.max(a,since+1),out=new Map();
    if(this.oldTable&&!this.sql.exec('SELECT 1 FROM old_done WHERE day=?',day).toArray().length)for(const r of this.sql.exec('SELECT ms,lat,lon,acc,spd,alt FROM pts WHERE day=? AND ms>? ORDER BY ms',day,since).raw())out.set(r[0],r);
    // a chunk starting up to a minute before "since" can still hold newer points
    for(const r of this.sql.exec('SELECT pts FROM chunks WHERE ms>=? AND ms<? ORDER BY ms',Math.max(a,lo-60000),z).raw())
      for(const p of JSON.parse(r[0]))if(p[0]>=lo)out.set(p[0],p);
    for(const p of this.buf)if(p[0]>=lo&&p[0]<z)out.set(p[0],p);
    return [...out.values()].sort((x,y)=>x[0]-y[0]);
  }
  async fetch(request){
    const u=new URL(request.url),op=u.searchParams.get('op'),day=u.searchParams.get('day')||'';
    if(op==='add'){const p=await request.json();
      if(!this.buf.length){this.bufAt=Date.now();await this.state.storage.setAlarm(Date.now()+10000);}
      this.buf.push([p.ms,p.lat,p.lon,p.acc,p.spd,p.alt]);
      if(Date.now()-this.bufAt>=LIVE_FLUSH_MS||this.buf.length>=200)this.flush();
      return Response.json({ok:true});}
    if(op==='days'){
      const m=new Map(),addTo=(d,n,last)=>{const x=m.get(d)||{day:d,n:0,last:0};x.n+=n;x.last=Math.max(x.last,last);m.set(d,x);};
      if(this.oldTable)for(const r of this.sql.exec('SELECT day, COUNT(*) AS n, MAX(ms) AS last FROM pts WHERE day NOT IN (SELECT day FROM old_done) GROUP BY day').toArray())addTo(r.day,r.n,r.last);
      for(const r of this.sql.exec('SELECT ms,last,n FROM chunks').toArray())addTo(liveDay(r.ms),r.n,r.last);
      for(const p of this.buf)addTo(liveDay(p[0]),1,p[0]);
      return Response.json({days:[...m.values()].sort((a,b)=>a.day<b.day?-1:1)});}
    if(op==='get')return Response.json({points:this.pointsOf(day,Number(u.searchParams.get('since'))||0)});
    if(op==='del'){const upto=Number(u.searchParams.get('upto'))||0,a=liveDayStart(day);
      this.flush();
      this.sql.exec('DELETE FROM chunks WHERE ms>=? AND ms<? AND last<=?',a,a+86400000,upto);
      if(this.oldTable){ // old one-row-per-point table: mark the day done (deleting row by row would use the quota),
        this.sql.exec('INSERT OR IGNORE INTO old_done(day) VALUES(?)',day); // and drop the whole table once every day in it is done
        if(!this.sql.exec('SELECT 1 FROM pts WHERE day NOT IN (SELECT day FROM old_done) LIMIT 1').toArray().length){
          this.sql.exec('DROP TABLE pts');this.sql.exec('DROP TABLE old_done');this.oldTable=false;}}
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

/* ---------- Google Drive storage (27 Oct 2026) ----------
   Travel Trace keeps finished GPS days and memory photos in the owner's own Google Drive, in
   "Pranju OS / Travel Trace / GPS archive" and ".../Memory photos". The Worker holds the Google connection
   (a refresh token in KV) so no phone ever sees a sign-in popup; pages ask it for a short-lived access token and
   then talk to Google Drive directly. Scope is drive.file: the app sees only the files it created itself.
   Worker secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (OAuth client of type "Web application" whose
   redirect URI is <this Worker's URL>/drive-callback).
     GET ?mode=drive&op=status             -> {configured, connected, email}
     GET ?mode=drive&op=start&back=<url>   -> {url}  Google consent page; it returns to /drive-callback
     GET /drive-callback                   (Google redirects here; no owner header, checked by a one-time state)
     GET ?mode=drive&op=token[&fresh=1]    -> {token, expiresIn, folders:{root,travel,gps,photos}}
     POST ?mode=drive&op=disconnect        -> revokes the connection (files stay in Drive) */
const GD_SCOPE='https://www.googleapis.com/auth/drive.file';
const GD_API='https://www.googleapis.com/drive/v3';
const GD_FOLDERS=[['root','Pranju OS',null],['travel','Travel Trace','root'],['gps','GPS archive','travel'],['photos','Memory photos','travel'],['vault','Sync vault (locked)','root']];
let gdAccess=null;
const gdRedirect=request=>new URL(request.url).origin+'/drive-callback';
async function gdRefresh(env){const raw=await env.SYNC_KV.get('drive:refresh');return raw?JSON.parse(raw):null;}
async function gdAccessToken(env){
  if(gdAccess&&gdAccess.exp>Date.now()+120000)return gdAccess;
  const kv=await env.SYNC_KV.get('drive:access');if(kv){const a=JSON.parse(kv);if(a.exp>Date.now()+120000)return gdAccess=a;}
  const rt=await gdRefresh(env);if(!rt)throw Object.assign(new Error('Google Drive is not connected.'),{code:'not_connected'});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:rt.rt,grant_type:'refresh_token'})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.access_token){
    if(d.error==='invalid_grant'){await env.SYNC_KV.delete('drive:refresh');await env.SYNC_KV.delete('drive:access');gdAccess=null;
      throw Object.assign(new Error('Google Drive access was withdrawn or expired. Connect it again in Travel Trace.'),{code:'not_connected'});}
    throw new Error('Google token refresh failed: '+(d.error_description||d.error||'HTTP '+r.status));}
  gdAccess={token:d.access_token,exp:Date.now()+(d.expires_in||3600)*1000};
  await env.SYNC_KV.put('drive:access',JSON.stringify(gdAccess),{expirationTtl:Math.max(120,(d.expires_in||3600)-60)});
  return gdAccess;}
async function gdCall(token,path,init){const r=await fetch(GD_API+path,{...(init||{}),headers:{Authorization:'Bearer '+token,...((init&&init.body)?{'Content-Type':'application/json'}:{})}});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error('Google Drive HTTP '+r.status+': '+((d.error&&d.error.message)||''));return d;}
/* the app's folders, created once and remembered; fresh=1 re-checks they still exist (e.g. after being deleted in Drive) */
async function gdFolders(env,token,fresh){
  let f={};try{f=JSON.parse(await env.SYNC_KV.get('drive:folders')||'{}')}catch(_){}
  let changed=false;
  for(const [key,name,parent] of GD_FOLDERS){
    if(f[key]&&fresh){try{const m=await gdCall(token,'/files/'+f[key]+'?fields=id,trashed');if(m.trashed)f[key]=null;}catch(_){f[key]=null;}}
    if(f[key])continue;
    const q="mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='pos' and value='"+key+"' }";
    const found=await gdCall(token,'/files?spaces=drive&fields=files(id)&q='+encodeURIComponent(q));
    if(found.files&&found.files.length)f[key]=found.files[0].id;
    else f[key]=(await gdCall(token,'/files?fields=id',{method:'POST',body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',appProperties:{pos:key},...(parent?{parents:[f[parent]]}:{})})})).id;
    changed=true;}
  if(changed)await env.SYNC_KV.put('drive:folders',JSON.stringify(f));
  return f;}
async function handleDrive(request,env,origin){
  const json=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
  if(!env.SYNC_KV)return json({error:'SYNC_KV binding is missing on the Worker.'},503);
  const q=new URL(request.url).searchParams,op=q.get('op')||'status',configured=!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
  if(op==='status'){const rt=await gdRefresh(env);return json({configured,connected:configured&&!!rt,email:rt&&rt.email||''});}
  if(!configured)return json({error:'Google Drive is not set up on the Worker yet (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets).',code:'not_configured'},503);
  if(op==='start'){
    const back=String(q.get('back')||'');if(back.indexOf(ALLOWED_ORIGIN+'/')!==0)return json({error:'Invalid return address.'},400);
    const b=new Uint8Array(18);crypto.getRandomValues(b);const state=hex(b);
    await env.SYNC_KV.put('drive:state:'+state,back,{expirationTtl:900});
    const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:gdRedirect(request),response_type:'code',scope:GD_SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state}).toString();
    return json({url:u.toString()});}
  if(op==='token'){
    try{const a=await gdAccessToken(env);const folders=await gdFolders(env,a.token,q.get('fresh')==='1');
      return json({token:a.token,expiresIn:Math.floor((a.exp-Date.now())/1000),folders});}
    catch(e){return json({error:String(e&&e.message||e),code:e&&e.code||''},e&&e.code==='not_connected'?409:502);}}
  if(op==='disconnect'&&request.method==='POST'){
    const rt=await gdRefresh(env);
    if(rt){try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:rt.rt})})}catch(_){}}
    await env.SYNC_KV.delete('drive:refresh');await env.SYNC_KV.delete('drive:access');gdAccess=null;
    return json({ok:true});}
  return json({error:'Unknown Drive operation'},400);}
async function handleDriveCallback(request,env){
  const q=new URL(request.url).searchParams,state=String(q.get('state')||'');
  const page=(msg)=>new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p style="font:16px system-ui;padding:24px">'+msg+'</p>',{status:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(!/^[a-f0-9]{36}$/.test(state)||!env.SYNC_KV)return page('This sign-in link is not valid. Go back to Pranju OS and tap Connect again.');
  const back=await env.SYNC_KV.get('drive:state:'+state);
  if(!back)return page('This sign-in link has expired. Go back to Pranju OS and tap Connect again.');
  await env.SYNC_KV.delete('drive:state:'+state);
  const go=res=>{const u=new URL(back);u.searchParams.set('drive',res);return Response.redirect(u.toString(),302);};
  if(q.get('error')||!q.get('code'))return go(q.get('error')==='access_denied'?'denied':'error');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({code:q.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:gdRedirect(request),grant_type:'authorization_code'})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.refresh_token)return go('error');
  let email='';try{email=(await gdCall(d.access_token,'/about?fields=user(emailAddress)')).user.emailAddress||''}catch(_){}
  await env.SYNC_KV.put('drive:refresh',JSON.stringify({rt:d.refresh_token,email,at:new Date().toISOString()}));
  gdAccess={token:d.access_token,exp:Date.now()+(d.expires_in||3600)*1000};
  await env.SYNC_KV.put('drive:access',JSON.stringify(gdAccess),{expirationTtl:Math.max(120,(d.expires_in||3600)-60)});
  return go('ok');}

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
/* ---------- Sync vaults in Google Drive (28 Oct 2026) ----------
   Every page's encrypted sync bundle (one per slot: People/Tasks, #melodies, #health, #inv-cash, ...) is kept as a
   file in the owner's Drive, "Pranju OS / Sync vault (locked)". The Worker only ever sees AES-encrypted text.
   - first read of a slot with Drive connected: its KV copy is copied into Drive (KV left untouched as a backup)
   - after that, reads and writes go to Drive only. KV is never used as a silent fallback for a slot already in
     Drive, because it would hand back old data; if Drive can't be reached the page is told so and keeps its own copy.
   - KV marker "drive:vm:<vault>" = {id, at} remembers the Drive file for each slot. */
const GD_UP='https://www.googleapis.com/upload/drive/v3';
const vmCache=new Map();
async function vaultMark(env,key){if(vmCache.has(key))return vmCache.get(key);const raw=await env.SYNC_KV.get('drive:vm:'+key);const m=raw?JSON.parse(raw):null;if(m)vmCache.set(key,m);return m;}
async function vaultSetMark(env,key,id){const m={id,at:new Date().toISOString()};vmCache.set(key,m);await env.SYNC_KV.put('drive:vm:'+key,JSON.stringify(m));return m;}
const vaultFileName=key=>key.replace(/^vault2:/,'').slice(0,16)+'.vault';
async function vaultDriveRead(token,id){
  const r=await fetch(GD_API+'/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
  if(r.status===404)return {missing:true};
  if(!r.ok)throw new Error('Google Drive read failed (HTTP '+r.status+')');
  return {blob:await r.text()};}
async function vaultDriveCreate(env,token,key,blob){
  const f=await gdFolders(env,token,false),b='posvault'+Date.now();
  const meta={name:vaultFileName(key),parents:[f.vault],mimeType:'application/json',appProperties:{posVault:key.slice(-40)}};
  const body='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+blob+'\r\n--'+b+'--';
  const r=await fetch(GD_UP+'/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+b},body});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.id)throw new Error('Google Drive save failed (HTTP '+r.status+')');
  return (await vaultSetMark(env,key,d.id)).id;}
async function vaultDriveWrite(token,id,blob){
  const r=await fetch(GD_UP+'/files/'+encodeURIComponent(id)+'?uploadType=media&fields=id',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:blob});
  if(r.status===404)return false;
  if(!r.ok)throw new Error('Google Drive save failed (HTTP '+r.status+')');
  return true;}
async function kvVaultRead(env,key,oldKey){
  let blob=await env.SYNC_KV.get(key);
  if(blob===null){blob=await env.SYNC_KV.get(oldKey);if(blob!==null){await env.SYNC_KV.put(key,blob);await env.SYNC_KV.delete(oldKey);}}
  return blob;}
async function driveToken(env){if(!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET))return null;try{return (await gdAccessToken(env)).token}catch(e){if(e&&e.code==='not_connected')return null;throw e;}}
async function handleSync(request,env){
  const json=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...corsHeaders(request.headers.get('Origin')||''),'Content-Type':'application/json'}});
  if(!env.SYNC_KV)return json({error:'Cloud sync is not configured: SYNC_KV binding is missing on the Worker.'},503);
  const code=String(request.headers.get('X-Total-Recall-Sync')||'').trim();
  if(code.length<8)return json({error:'A sync code of at least 8 characters is required.'},400);
  const key=await kvName(code),oldKey='vault:'+await sha(code);
  const mark=await vaultMark(env,key);
  let token;
  try{token=await driveToken(env);}
  catch(e){if(mark)return json({error:'Google Drive could not be reached just now; your data on this device is safe, try again shortly. ('+(e&&e.message||e)+')'},503);token=null;}
  if(mark&&!token)return json({error:'Your sync data now lives in Google Drive, which is disconnected. Open Travel Trace → Google Drive → Connect.',code:'drive_needed'},409);
  if(request.method==='POST'){
    const body=await request.json();
    if(!body||!body.state)return json({error:'state is required'},400);
    if(!token)return json({blob:await kvVaultRead(env,key,oldKey)||null,store:'cloudflare'});
    try{
      if(mark){const got=await vaultDriveRead(token,mark.id);
        if(!got.missing)return json({blob:got.blob||null,store:'drive'});}
      /* first time (or the Drive file was deleted): bring the Cloudflare copy over, leaving it in place as a backup */
      const blob=await kvVaultRead(env,key,oldKey);
      if(blob!==null)await vaultDriveCreate(env,token,key,blob);
      return json({blob:blob||null,store:'drive'});
    }catch(e){
      if(mark)return json({error:'Google Drive could not be reached just now; your data on this device is safe, try again shortly. ('+(e&&e.message||e)+')'},503);
      return json({blob:await kvVaultRead(env,key,oldKey)||null,store:'cloudflare'});}
  }
  if(request.method==='PUT'){
    const blob=await request.text();
    if(!blob)return json({error:'Encrypted sync payload is empty'},400);
    if(blob.length>20*1024*1024)return json({error:'Sync payload too large'},413);
    if(!token){
      await env.SYNC_KV.put(key,blob);
      if(await env.SYNC_KV.get(oldKey)!==null)await env.SYNC_KV.delete(oldKey);
      return json({ok:true,store:'cloudflare'});}
    try{
      if(!(mark&&await vaultDriveWrite(token,mark.id,blob)))await vaultDriveCreate(env,token,key,blob);
      return json({ok:true,store:'drive'});
    }catch(e){return json({error:'Google Drive could not be reached just now; your data on this device is safe and will sync next time. ('+(e&&e.message||e)+')'},503);}
  }
  return json({error:'Method not allowed'},405);
}
/* WhatsApp Review: Claude drafts items from the WhatsApp self-chat into a TickTick project named "WA REVIEW".
   Pranju OS lists them (GET ?mode=wa-review) and, per item, approves it into its destination project with the
   edited title/tags/date/notes (POST action=approve) or discards it (POST action=discard).
   Writes only ever touch tasks that are inside the WA REVIEW project. */
/* Delegation (Pranju OS, 29 Oct 2026): a delegated task marked done in the app is done FOR THE DAY in TickTick.
   POST ?mode=deleg-done {projectId, taskId}
   - repeating task due today or earlier -> TickTick's complete, which moves it to its next date (that day it shows as usual)
   - repeating task already moved past today -> nothing (already done today)
   - task without a repeat -> nothing: closing a task for good stays his own step inside TickTick */
async function handleDelegDone(request,env,origin){
  const json=(o,st)=>new Response(JSON.stringify(o),{status:st||200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
  const token=env.TICKTICK_ACCESS_TOKEN;if(!token)return json({error:'TICKTICK_ACCESS_TOKEN secret is not configured'},500);
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  let body={};try{body=await request.json()}catch(_){return json({error:'Invalid JSON'},400)}
  const pid=String(body.projectId||''),tid=String(body.taskId||'');if(!pid||!tid)return json({error:'projectId and taskId are required'},400);
  const tz=env.TIME_ZONE||'Asia/Kolkata',today=todayInZone(tz);
  const t=await tick('/project/'+encodeURIComponent(pid)+'/task/'+encodeURIComponent(tid),token);
  if(!t||!t.id)return json({error:'Task not found in TickTick'},404);
  if(t.status)return json({ok:true,completed:false,reason:'closed'});
  if(!t.repeatFlag)return json({ok:true,completed:false,reason:'not-repeating'});
  const due=dateInZone(t.dueDate||t.startDate||'',tz);
  if(due&&due>today)return json({ok:true,completed:false,reason:'already-done-today',next:due});
  /* an overdue repeating task (missed days) is completed until its next date is after today */
  let next='';for(let n=0;n<15;n++){
    const r=await fetch(API+'/project/'+encodeURIComponent(pid)+'/task/'+encodeURIComponent(tid)+'/complete',{method:'POST',headers:{Authorization:'Bearer '+token}});
    if(!r.ok){if(n)break;return json({error:'TickTick refused to complete it (HTTP '+r.status+')'},502);}
    try{const t2=await tick('/project/'+encodeURIComponent(pid)+'/task/'+encodeURIComponent(tid),token);next=dateInZone(t2&&(t2.dueDate||t2.startDate)||'',tz)}catch(_){next='';}
    if(!next||next>today)break;}
  return json({ok:true,completed:true,next});
}
const WA_PROJECT='wa review';
const WA_TARGETS=['inbox','reference','schedule','projects','checklists'];
function waMeta(content){const s=String(content||'');const line=(s.match(/\[wa\][^\n]*$/i)||[''])[0];const g=k=>{const m=line.match(new RegExp('(?:^|\\s)'+k+'=([^\\s]+)','i'));if(!m)return '';try{return decodeURIComponent(m[1])}catch(_){return m[1]}};const t=g('target'),r=g('repeat');
  return {target:t?t.toLowerCase():'inbox',repeat:r?r.toLowerCase():'none',update:g('update'),uproject:g('uproject'),utitle:g('utitle'),queued:g('approved')==='update',line,notes:s.replace(/\n?\[wa\][^\n]*$/i,'').trim()};}
/* 'update' drafts: news on a task he already has. Approving adds a dated note to that task's description instead of creating a new one. */
function waDateLabel(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(new Date());return p;}
async function addComment(token,projectId,taskId,text){
  for(const path of ['/comment','/comments']){try{const r=await fetch(API+'/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId)+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({title:text})});if(r.ok)return true;}catch(_){}}
  return false;}
/* append a dated note to an existing task's own description (TEXT tasks keep it in content, CHECKLIST tasks in desc) */
function taskNoteField(t){return t&&String(t.kind||'').toUpperCase()==='CHECKLIST'?'desc':'content';}
async function appendToTask(token,projectId,taskId,text){
  const t=await tick('/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId),token);
  if(!t||!t.id)throw new Error('That task is no longer in TickTick');const f=taskNoteField(t),old=String(t[f]||'').trim();
  await tick('/task/'+encodeURIComponent(t.id),token,{method:'POST',body:{...t,[f]:(old?old+'\n\n---\n':'')+text}});return true;}
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
    /* the update goes into that task's own description, dated, so it stays one task */
    try{await appendToTask(token,wm.uproject,wm.update,text);await dropDraft();return json({ok:true,updated:wm.update});}catch(_){}
    if(await addComment(token,wm.uproject,wm.update,text)){await dropDraft();return json({ok:true,commented:wm.update});}
    /* TickTick refused both: keep the draft, marked approved; the nightly review adds it */
    await tick('/task/'+encodeURIComponent(task.id),token,{method:'POST',body:{id:task.id,projectId:review.id,title:task.title,content:String(body.notes||wm.notes||'')+'\n'+wm.line.replace(/\s*approved=\S+/,'')+' approved=update'}});
    return json({ok:true,queued:true});}
  const target=String(body.target||'inbox').toLowerCase();if(WA_TARGETS.indexOf(target)<0)return json({error:'Unknown destination'},400);
  let projectId='inbox';if(target!=='inbox'){const p=list.find(x=>String(x.name||'').trim().toLowerCase()===target);if(!p)return json({error:'TickTick project '+target.toUpperCase()+' not found'},404);projectId=p.id;}
  const tags=(Array.isArray(body.tags)?body.tags:[]).map(t=>String(t).trim().toLowerCase().replace(/^#/,'').replace(/\s+/g,'-')).filter(Boolean).slice(0,10);
  const out={title:String(body.title||task.title||'').slice(0,300),content:String(body.notes||'').slice(0,5000),tags,priority:[0,1,3,5].indexOf(+body.priority)>=0?+body.priority:(task.priority||0),timeZone:env.TIME_ZONE||'Asia/Kolkata'};
  if(projectId!=='inbox')out.projectId=projectId;
  let due=/^\d{4}-\d{2}-\d{2}$/.test(String(body.due||''))?body.due:'';
  if(body.repeat==='daily'){const td=todayInZone(env.TIME_ZONE||'Asia/Kolkata');if(!due||due<td)due=td;out.repeatFlag='RRULE:FREQ=DAILY;INTERVAL=1';}
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
 if(url.pathname==='/drive-callback'){try{return await handleDriveCallback(request,env)}catch(e){return new Response('Google Drive sign-in failed: '+String(e&&e.message||e),{status:502,headers:{'Content-Type':'text/plain'}})}}
 if(url.searchParams.get('mode')!=='live-log'){try{const denied=await requireOwner(request,env,origin);if(denied)return denied;}catch(e){return new Response(JSON.stringify({error:'Auth check failed'}),{status:503,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.pathname==='/memory-extract'){if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:corsHeaders(origin)});try{return await memoryExtract(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.pathname==='/sync'||url.searchParams.get('mode')==='sync'){try{return await handleSync(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='nav'){try{return await handleNav(request)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='quotes'||url.pathname==='/quotes'){try{return await handleQuotes(request)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='deleg-done'){try{return await handleDelegDone(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='money-review'||url.pathname==='/money-review'){try{return await handleMoneyReview(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='wa-review'||url.pathname==='/wa-review'){try{return await handleWaReview(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='live'||url.searchParams.get('mode')==='live-log'){try{return await handleLive(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='drive'){try{return await handleDrive(request,env,origin)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(url.searchParams.get('mode')==='travel-file'){try{return await handleTravelFile(request,env)}catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:corsHeaders(origin)});
 if(url.pathname!=='/'&&url.pathname!=='/responsibility-tasks'&&url.pathname!=='/completed-tasks'&&url.pathname!=='/task-detail')return new Response('Not found',{status:404,headers:corsHeaders(origin)});
 if(!env.TICKTICK_ACCESS_TOKEN)return new Response(JSON.stringify({error:'TICKTICK_ACCESS_TOKEN secret is not configured'}),{status:500,headers:{...corsHeaders(origin),'Content-Type':'application/json'}});
 try{const tz=env.TIME_ZONE||'Asia/Kolkata';
  if(url.pathname==='/task-detail'||url.searchParams.get('mode')==='task-detail'){const projectId=url.searchParams.get('projectId'),taskId=url.searchParams.get('taskId');if(!projectId||!taskId)throw new Error('projectId and taskId are required');const task=await tick('/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId),env.TICKTICK_ACCESS_TOKEN);let comments=[];try{const cr=await tick('/project/'+encodeURIComponent(projectId)+'/task/'+encodeURIComponent(taskId)+'/comments',env.TICKTICK_ACCESS_TOKEN);comments=Array.isArray(cr)?cr:((cr&&cr.comments)||[])}catch(_){comments=[]}return new Response(JSON.stringify({task,comments}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}

  if(url.pathname==='/reference-tasks'||url.searchParams.get('mode')==='reference'){const projects=await tick('/project',env.TICKTICK_ACCESS_TOKEN);const list=Array.isArray(projects)?projects:((projects&&projects.projects)||[]);const project=list.find(p=>String(p.name||'').trim().toLowerCase()==='reference');if(!project)throw new Error('TickTick project/section named Reference was not found.');const data=await tick('/project/'+encodeURIComponent(project.id)+'/data',env.TICKTICK_ACCESS_TOKEN);let tasks=unwrapTasks(data&&data.tasks?data.tasks:data);const start=url.searchParams.get('start')||'';const end=url.searchParams.get('end')||'';if(start||end){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('start and end must be YYYY-MM-DD');tasks=tasks.filter(task=>{const referenceDate=task.createdTime||task.createdDate||task.dateAdded||task.modifiedTime||task.modifiedDate||task.dueDate||task.due||'';const d=dateInZone(referenceDate,tz);return d&&d>=start&&d<=end})}const tags={};for(const task of tasks){const ts=taskTags(task);for(const tag of ts){if(!tags[tag])tags[tag]=[];tags[tag].push({id:task.id||'',title:task.title||'(Untitled reference item)',due:String(task.dueDate||task.due||'').slice(0,16),projectId:task.projectId||project.id,tags:ts})}}for(const k of Object.keys(tags)){const seen=new Set();tags[k]=tags[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}return new Response(JSON.stringify({section:'Reference',projectId:project.id,projectName:project.name,start:start||null,end:end||null,taskCount:tasks.length,tags}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}
if(url.pathname==='/completed-tasks'||url.searchParams.get('mode')==='completed'){const today=todayInZone(tz);const start=url.searchParams.get('start')||addDays(today,-6);const end=url.searchParams.get('end')||today;if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('start and end must be YYYY-MM-DD');const raw=[],seenRaw=new Set();let completedFetch;try{completedFetch=await fetchCompletedTasksForRange(start,addDays(end,1),env.TICKTICK_ACCESS_TOKEN)}catch(_){completedFetch=null}if(completedFetch){for(const task of unwrapTasks(completedFetch.result)){const id=String(task.id||'')+'|'+String(task.completedTime||task.completedDate||task.completeTime||'')+'|'+String(task.dueDate||task.due||'');if(!seenRaw.has(id)){seenRaw.add(id);raw.push(task)}}}else{for(let day=start;day<=addDays(end,1);day=addDays(day,1)){const fetched=await fetchCompletedTasksForDay(day,env.TICKTICK_ACCESS_TOKEN);for(const task of unwrapTasks(fetched.result)){const id=String(task.id||'')+'|'+String(task.completedTime||task.completedDate||task.completeTime||'')+'|'+String(task.dueDate||task.due||'');if(!seenRaw.has(id)){seenRaw.add(id);raw.push(task)}}}}const scheduledByDay=new Map();for(let day=start;day<=addDays(end,1);day=addDays(day,1))scheduledByDay.set(day,[]);for(const task of raw){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);const completedDate=dateInZone(task&&(task.completedTime||task.completedDate||task.completeTime||''),tz);if(dueDate&&scheduledByDay.has(dueDate))scheduledByDay.get(dueDate).push(task);if(completedDate&&scheduledByDay.has(completedDate)&&completedDate!==dueDate)scheduledByDay.get(completedDate).push(task)}let openFetched;try{openFetched=await fetchOpenTasksForRange(addDays(start,1),addDays(end,1),env.TICKTICK_ACCESS_TOKEN)}catch(_){openFetched=null}if(openFetched){for(const task of unwrapTasks(openFetched.result)){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);if(scheduledByDay.has(dueDate))scheduledByDay.get(dueDate).push(task)}}else{for(let day=addDays(start,1);day<=addDays(end,1);day=addDays(day,1)){const nextFetched=await fetchOpenTasksForDay(day,env.TICKTICK_ACCESS_TOKEN);for(const task of unwrapTasks(nextFetched.result)){const dueDate=dateInZone(task&&(task.dueDate||task.due||''),tz);if(dueDate===day)scheduledByDay.get(day).push(task)}}}const byKey=new Map();let matched=0,excludedContinuing=0;const diagnostics=[];for(const task of raw){const tags=taskTags(task);const completedValue=task.completedTime||task.completedDate||task.completeTime||'';const completedDate=dateInZone(completedValue,tz);const dueDate=dateInZone(task.dueDate||task.due||'',tz);const effectiveDate=completedDate||dueDate;if(!effectiveDate||effectiveDate<start||effectiveDate>end)continue;const nextDate=addDays(effectiveDate,1);const nextTasks=scheduledByDay.get(nextDate)||[];const continuation=nextTasks.find(nextTask=>nextTask.id!==task.id&&sameScheduledTask(task,nextTask));if(continuation){excludedContinuing++;diagnostics.push({title:task.title||'',completedDate:effectiveDate,nextDate,result:'EXCLUDED_CONTINUING',completedId:task.id||'',nextId:continuation.id||'',completedProjectId:task.projectId||'',nextProjectId:continuation.projectId||''});continue}matched++;const key=uniqueKey(task,tags);let item=byKey.get(key);if(!item){item={id:task.id||'',title:task.title||'(Untitled TickTick task)',projectId:task.projectId||'',tags,completionDates:[],completionCount:0};byKey.set(key,item)}if(item.completionDates.indexOf(effectiveDate)<0){item.completionDates.push(effectiveDate);item.completionCount++}diagnostics.push({title:task.title||'',completedDate:effectiveDate,nextDate,result:'INCLUDED_NO_NEXT_DAY_MATCH'})}const tasks=Array.from(byKey.values()).sort((a,b)=>a.title.localeCompare(b.title));tasks.forEach(t=>t.completionDates.sort());return new Response(JSON.stringify({start,end,timeZone:tz,uniqueCount:tasks.length,rawCount:raw.length,matchedCount:matched,excludedContinuing,tasks,diagnostics}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}
  const target=todayInZone(tz),groups=Object.fromEntries(RESPONSIBILITIES.map(k=>[k,[]])),allTags={};let result,source='search',overdueFetched=0;try{result=await tick('/task/search',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{dueFrom:localIsoStart(target),dueTo:localIsoEnd(target),status:[0]}});
  /* search came back empty: ask TickTick's filter for today as well */
  if(!unwrapTasks(result).length){try{const f=unwrapTasks(await tick('/task/filter',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{startDate:localIsoStart(target),endDate:localIsoEnd(target),status:[0]}}));if(f.length){result=f;source='search empty, filter';}}catch(_){}}
  /* overdue open tasks (last 14 days) come from a separate filter call; if it fails, today's list is untouched */
  {const byId=new Map();for(const t of unwrapTasks(result))if(t&&t.id)byId.set(t.id,t);
   try{const od=unwrapTasks(await tick('/task/filter',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{startDate:localIsoStart(addDays(target,-14)),endDate:localIsoEnd(addDays(target,-1)),status:[0]}}));overdueFetched=od.length;for(const t of od)if(t&&t.id&&!byId.has(t.id)&&!t.status)byId.set(t.id,t);}catch(e){overdueFetched='failed'}
   result=[...byId.values()];}}catch(_){source='filter';result=await tick('/task/filter',env.TICKTICK_ACCESS_TOKEN,{method:'POST',body:{startDate:localIsoStart(addDays(target,-14)),endDate:localIsoEnd(addDays(target,1)),status:[0]}})}const tasks=unwrapTasks(result);let dueMatches=0,taggedMatches=0;for(const task of tasks){const due=task&&(task.dueDate||task.due||'');const dd=due?dateInZone(due,tz):'';if(!dd||dd>target)continue;dueMatches++;const tags=taskTags(task);const item={id:task.id||'',title:task.title||'(Untitled TickTick task)',due:String(due).slice(0,16),projectId:task.projectId||'',tags,overdue:dd<target};for(const tag of tags){if(!allTags[tag])allTags[tag]=[];allTags[tag].push(item)}const matches=RESPONSIBILITIES.filter(r=>tags.indexOf(r)>=0);if(matches.length)taggedMatches++;for(const responsibility of matches)groups[responsibility].push(item)}for(const k of RESPONSIBILITIES){const seen=new Set();groups[k]=groups[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}for(const k of Object.keys(allTags)){const seen=new Set();allTags[k]=allTags[k].filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true})}return new Response(JSON.stringify({date:target,timeZone:tz,responsibilities:groups,tags:allTags,debug:{source,taskCount:tasks.length,dueMatches,taggedMatches,overdueFetched}}),{status:200,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})
 }catch(e){return new Response(JSON.stringify({error:String(e&&e.message||e)}),{status:502,headers:{...corsHeaders(origin),'Content-Type':'application/json'}})}}};
