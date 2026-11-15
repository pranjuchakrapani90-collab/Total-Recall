/* Checks vault-dupes.js against a stand-in Drive held in memory (invented files).
   Run:  node tools/test-vault-dupes.js     prints "ok" lines; exits 1 if the clean-up rules broke. */
let bad=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)bad++};
const files=[
  /* id, name, mime, modified, created, size, md5, parent */
  ['a1','bill.pdf','application/pdf','2026-10-01','2026-10-01',100,'m1','f1'],
  ['a2','bill.pdf','application/pdf','2026-10-01','2026-09-01',100,'m1','f2'],   /* created first */
  ['a3','bill (1).pdf','application/pdf','2026-10-01','2026-11-01',100,'m1','f3'],
  ['b1','photo.jpg','image/jpeg','2026-10-02','2026-10-02',5000,'m2','f1'],
  ['b2','photo.jpg','image/jpeg','2026-10-02','2026-10-03',5000,'m2','f2'],
  ['c1','report.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','2026-10-03','2026-10-03',200,'m3','f1'],
  ['d1','note','application/vnd.google-apps.document','2026-10-04','2026-10-04',0,'','f1'],
  ['d2','note copy','application/vnd.google-apps.document','2026-10-04','2026-10-04',0,'','f2'],
  ['e1','empty.pdf','application/pdf','2026-10-05','2026-10-05',0,'m4','f1'],
  ['e2','empty2.pdf','application/pdf','2026-10-05','2026-10-05',0,'m4','f2'],
  ['f1x','same-bytes-other-size.pdf','application/pdf','2026-10-06','2026-10-06',10,'m5','f1'],
  ['f2x','same-bytes-other-size.pdf','application/pdf','2026-10-06','2026-10-06',11,'m5','f2']];
const drive={};files.forEach(f=>drive[f[0]]={trashed:false,props:{}});
let calls=0,failOnce=null,authFail=false;
global.window={PosVault:{
  load:async()=>({entries:[{id:'a3'}]}),                       /* the vault links to a3, so a3 must be kept */
  /* Drive never lists what is in the bin */
  listDrive:async p=>{const live=files.filter(f=>!drive[f[0]].trashed);if(p)p(live.length);return {files:live.map(f=>f.slice())}},
  kind:(m,n)=>m.indexOf('image/')===0?'Images':m==='application/pdf'?'PDFs':/spreadsheet/.test(m)?'Sheets':'Docs',
  g:{API:'https://api',sleep:ms=>new Promise(r=>setTimeout(r,0)),
     fail:async(r,w)=>new Error(w+' failed (HTTP '+r.status+')'),
     gjson:async(url)=>{const ids=Object.keys(drive).filter(k=>drive[k].trashed&&drive[k].props.posDup);
       return {files:ids.slice(0,200).map(id=>({id,name:id}))}},
     gfetch:async(url,init)=>{calls++;const id=decodeURIComponent(url.split('/files/')[1].split('?')[0]);const b=JSON.parse(init.body);
       if(authFail)return {ok:false,status:401};
       if(failOnce===id){failOnce=null;return {ok:false,status:500}}
       if(!drive[id])return {ok:false,status:404};
       drive[id].trashed=b.trashed;
       if(b.appProperties)Object.entries(b.appProperties).forEach(([k,v])=>{if(v===null)delete drive[id].props[k];else drive[id].props[k]=v});
       return {ok:true,status:200}}}}};
require('../vault-dupes.js');const D=window.PosDupes;
(async()=>{
  const p=await D.plan();
  const ids=p.trash.map(t=>t.id).sort().join(',');
  ok(ids==='a1,a2,b1'||ids==='a1,a2,b2','only true copies are listed: '+ids);
  ok(!p.trash.some(t=>/^(c1|d1|d2|e1|e2|f1x|f2x)$/.test(t.id)),'single files, Google Docs, empty files and same-md5-different-size are left alone');
  ok(p.trash.filter(t=>/^a/.test(t.id)).every(t=>t.keep==='a3'),'the copy the vault links to is the one kept');
  ok(p.trash.filter(t=>/^b/.test(t.id))[0].keep==='b1','with no vault link, the oldest-created copy is kept');
  ok(p.kept===2&&p.groups===2,'2 groups, one copy of each kept');
  ok(p.bytes===5200,'space to free counted: '+p.bytes);
  ok(p.trash[0].size>=p.trash[1].size,'biggest first');
  const r1=await D.run({docsOnly:true});
  ok(r1.moved===2&&r1.bytes===200,'"only documents" moved the 2 pdf copies, left the photo: '+JSON.stringify(r1));
  ok(drive.a1.trashed&&drive.a2.trashed&&!drive.a3.trashed&&!drive.b1.trashed,'the right files are in the bin');
  ok(drive.a1.props.posDup==='a3','each one is marked with the copy that was kept');
  await D.plan();failOnce='b2';
  const r2=await D.run({});
  ok(r2.failed===1&&r2.moved===0&&r2.errors.length===1,'a one-off server error is reported, not hidden: '+JSON.stringify({moved:r2.moved,failed:r2.failed,errors:r2.errors}));
  const n=await D.count();ok(n===2,'the bin count finds exactly what this moved: '+n);
  const u=await D.undo({});
  ok(u.restored===n&&!drive.a1.trashed&&!drive.a1.props.posDup,'restore puts them back and clears the mark');
  await D.plan();authFail=true;let threw=null;try{await D.run({})}catch(e){threw=e}
  ok(threw&&/401/.test(threw.message),'a lost Google connection stops the run instead of grinding on');
  process.exit(bad?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
