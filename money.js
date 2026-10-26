/* Money Book engine (Money Trace › Money Book and APDCL Expenditure), shared by those pages and Portfolio.
   Records live in the Invest store under "cash" (encrypted sync slot "#inv-cash"), never in this repo:
     tx    — approved entries {date, time, kind: out|in|move, acct: bank|wallet, to (move only), amt, cat, note, src: hand|yono, ref, raw}
     pend  — rows read from a YONO statement, waiting for Pranju's approval (same shape + draft remark)
     bal   — balance checks {acct, amt, date, time}: the real figure on a date; only newer entries move it
     learn — what he approved last time for a payee, so the next draft for that payee is already right
   WhatsApp drafts (src "wa"): money notes from his self-chat, read by the nightly review into TickTick MONEY REVIEW,
   arrive in pend with waId and book (personal | apdcl).
   Every entry is Personal or APDCL (book). APDCL entries are imprest money: they move the wallet or bank like any other
   (so Money now includes what APDCL gives and what's spent for APDCL) and also make up the APDCL ledger, whose
   balance (received − spent) is the APDCL part of Money now; the rest is personal. FINANCE sheet history sits on
   accounts of its own (old, imprest, imprest-bil) and never moves the wallet or bank.
   Spending = "out" entries. Wallet↔bank moves (ATM, cash deposit) are not spending, and nor are the
   categories in NOT_SPEND (money put into investments or sent to his own accounts). */
(function(){
"use strict";
const I=window.Invest,{ok}=I,KEY="cash";
const ACCTS=[["wallet","Wallet"],["bank","Bank"]];
/* history accounts from the FINANCE sheet: imprest (Samaguri imprest up to Oct 2026), imprest-bil (Bilasipara, closed),
   old (personal ledger 2021–22) */
const OWN=new Set(["wallet","bank"]),IMP=new Set(["imprest","imprest-bil"]);
const IMP_CATS=["Fuel","Labour","Vehicle hire","Drives & DC","Food & tea","Office","Materials","Events","Other"];
const IMP_IN_CATS=["Imprest received","Other"];
const OUT_CATS=["Food","Groceries","Fuel","Vehicle","Mobile","Bills","Medical","Household","Clothing","Travel","Family","Social","Subscriptions","Loan / EMI","Investment","Self transfer","Other"];
const IN_CATS=["Salary","Refund","Interest","Gift","Self transfer","Other"];
const NOT_SPEND=new Set(["Investment","Self transfer"]);
const pad=n=>String(n).padStart(2,"0");
/* now in IST: date and HH:MM */
function now(){const t=I.ist();return {date:t.iso,time:pad(Math.floor(t.mins/60))+":"+pad(t.mins%60)};}
/* order of an entry or a balance check within the records */
const ord=x=>(x.date||"")+" "+(x.time||"00:00")+" "+String(x.seq||0).padStart(5,"0")+" "+String(x.t||0).padStart(14,"0");
/* APDCL money: marked APDCL, or imprest history */
const isApdcl=x=>x.book==="apdcl"||IMP.has(x.acct);
/* personal spending (APDCL spending is counted on its own) */
const isSpend=x=>x.kind==="out"&&!NOT_SPEND.has(x.cat)&&!isApdcl(x);
function list(coll){const s=I.load(KEY);return Object.entries(s[coll]).filter(([,x])=>x).map(([id,x])=>({id,...x}));}
function entries(){return list("tx").filter(x=>ok(x.amt)).sort((a,b)=>ord(a)<ord(b)?-1:ord(a)>ord(b)?1:0);}
/* what an entry does to one account */
function effect(x,acct){if(x.kind==="move")return x.acct===acct?-x.amt:x.to===acct?x.amt:0;
  if(x.acct!==acct)return 0;return x.kind==="in"?x.amt:-x.amt;}
/* does an entry move the balance after this check, or is it already inside the checked figure?
   - a hand entry counts if it was logged after the check was entered (whatever date or time it carries):
     spend first and then count the cash, and the count already has it; count first and then log, and it's taken off
   - a statement row counts only if it is dated after the check's day, since the bank balance (typed in, or the
     statement's closing balance) already includes that day's rows; a row given a time later than a check typed in
     the same day also counts */
function counts(x,cp){
  if(x.src==="sheet")return x.date>cp.date;
  if(x.src==="yono")return x.date>cp.date||(x.date===cp.date&&cp.src!=="yono"&&!!x.time&&x.time>(cp.time||""));
  return (x.at||x.t||0)>(cp.t||0);}
/* balance of one account: its latest check, then every entry that came after it */
function balance(acct,T){T=T||entries();
  const cps=list("bal").filter(b=>b.acct===acct&&ok(b.amt)).sort((a,b)=>ord(a)<ord(b)?-1:1),cp=cps[cps.length-1]||null;
  const after=T.filter(x=>!cp||counts(x,cp));
  return {acct,cp,val:(cp?cp.amt:0)+after.reduce((a,x)=>a+effect(x,acct),0),set:!!cp||T.some(x=>effect(x,acct))};}
/* the APDCL ledger at Samaguri (Bilasipara's closed imprest stays out): received − spent */
function apdcl(T){T=(T||entries()).filter(x=>isApdcl(x)&&x.acct!=="imprest-bil"&&x.kind!=="move");
  const inn=T.filter(x=>x.kind==="in").reduce((a,x)=>a+x.amt,0),out=T.filter(x=>x.kind==="out").reduce((a,x)=>a+x.amt,0);
  return {T,received:inn,spent:out,val:inn-out,set:T.length>0};}
/* Money now = wallet + bank; of which APDCL = the APDCL ledger's balance (negative: spent from your own money, due from APDCL) */
function summary(){const T=entries(),b=balance("bank",T),w=balance("wallet",T),ap=apdcl(T),total=b.val+w.val;
  return {T,bank:b,wallet:w,apdcl:ap,total,personal:total-ap.val,any:b.set||w.set};}
function names(){const s=(I.load(KEY).settings)||{};return {bank:s.bankName||"Bank",wallet:s.walletName||"Wallet",imprest:"Imprest (sheet)","imprest-bil":"Bilasipara imprest",old:"FINANCE sheet"};}
function archive(){return list("arch").filter(a=>a.rows).sort((a,b)=>(a.n||0)-(b.n||0));}

/* ---------- YONO statement ---------- */
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function parseDate(v){
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+"-"+pad(v.getMonth()+1)+"-"+pad(v.getDate());
  if(typeof v==="number"&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*864e5));return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate());}
  const s=String(v||"").trim();let m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return m[1]+"-"+pad(m[2])+"-"+pad(m[3]);
  if((m=s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/))){const y=m[3].length===2?"20"+m[3]:m[3];return y+"-"+pad(m[2])+"-"+pad(m[1]);}
  if((m=s.match(/^(\d{1,2})[\s\-\/]*([A-Za-z]{3})[a-z]*[\s\-\/,]*(\d{2,4})/))&&MON[m[2].toLowerCase()]){const y=m[3].length===2?"20"+m[3]:m[3];return y+"-"+pad(MON[m[2].toLowerCase()])+"-"+pad(m[1]);}
  return "";}
function parseAmt(v){if(typeof v==="number")return v;const s=String(v||"").replace(/[,₹\s]|INR|Rs\.?/gi,"").replace(/(CR|DR)$/i,"");if(!s||s==="-")return NaN;const n=parseFloat(s);return isFinite(n)?n:NaN;}
/* find the header row and the columns, whatever the export's wording */
function columns(rows){
  for(let r=0;r<Math.min(rows.length,60);r++){const h=rows[r].map(c=>String(c||"").trim().toLowerCase());
    const find=(re,not)=>h.findIndex(c=>re.test(c)&&!(not&&not.test(c)));
    const dNoValue=find(/date/,/value/),date=dNoValue>=0?dNoValue:find(/date/);
    const desc=find(/desc|narration|details|particular|remark/),ref=find(/ref|cheque|chq/),bal=find(/balance/);
    const dr=find(/debit|withdraw|^dr\b|paid out/),cr=find(/credit|deposit|^cr\b|paid in/),amt=find(/^amount|amount\s*\(/),typ=find(/^(dr\s*\/\s*cr|cr\s*\/\s*dr|type)$/);
    if(date>=0&&desc>=0&&((dr>=0&&cr>=0)||(amt>=0&&typ>=0)))return {row:r,date,desc,ref,bal,dr,cr,amt,typ};}
  return null;}
function readStatement(rows){
  const c=columns(rows);if(!c)throw new Error("This doesn't look like a bank statement: no Date / Description / Debit / Credit columns found.");
  const out=[];let seq=0;
  for(let r=c.row+1;r<rows.length;r++){const R=rows[r],date=parseDate(R[c.date]);if(!date)continue;
    let dr=c.dr>=0?parseAmt(R[c.dr]):NaN,cr=c.cr>=0?parseAmt(R[c.cr]):NaN;
    if(c.amt>=0&&!ok(dr)&&!ok(cr)){const a=parseAmt(R[c.amt]),t=String(R[c.typ]||"").toLowerCase();if(ok(a)){if(/d/.test(t))dr=a;else cr=a;}}
    const amt=ok(dr)&&dr>0?dr:ok(cr)&&cr>0?cr:NaN;if(!ok(amt))continue;
    const raw=String(R[c.desc]||"").replace(/\s+/g," ").trim(),ref=c.ref>=0?String(R[c.ref]||"").trim():"";
    out.push({date,raw,ref,amt:I.r2(amt),dir:ok(dr)&&dr>0?"dr":"cr",bal:c.bal>=0?parseAmt(R[c.bal]):NaN,seq:++seq});}
  if(!out.length)throw new Error("No transactions found in this statement.");
  /* statements may run newest-first: keep the file order within a day, oldest day first */
  if(out.length>1&&out[0].date>out[out.length-1].date){out.reverse();out.forEach((x,i)=>x.seq=i+1);}
  return out;}
const title=s=>String(s||"").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()).trim();
/* who the money went to or came from, from SBI's description */
function payee(raw){const s=String(raw||"").toUpperCase();let m;
  if((m=s.match(/UPI\/(?:DR|CR)\/\d+\/([^\/]+)/)))return m[1].trim();
  if((m=s.match(/UPI[\/\-](?:P2[AM][\/\-])?\d{6,}[\/\-]([^\/]+)/)))return m[1].trim();
  if((m=s.match(/(?:NEFT|IMPS|RTGS)[*\/\-][^*\/]*[*\/\-][^*\/]*[*\/\-]([A-Z][A-Z .]{2,})/)))return m[1].trim();
  if((m=s.match(/POS\s*\d*\s*([A-Z][A-Z .&]{2,})/)))return m[1].trim();
  return s.replace(/^(TO|BY)\s+TRANSFER[- ]*/,"").replace(/[\/*\-]\s*$/,"").split(/[\/*]/).filter(p=>p&&!/^\d+$/.test(p.trim())&&!/^(DR|CR|UPI|NEFT|IMPS|INB|SBIN)$/.test(p.trim()))[0]||s.slice(0,30);}
const learnKey=raw=>payee(raw).replace(/[^A-Z0-9]/g,"").slice(0,24);
/* a draft for one statement row: learned answer first, then SBI's usual wording */
function draft(x){const s=x.raw.toUpperCase(),L=I.load(KEY).learn[learnKey(x.raw)],p=title(payee(x.raw));
  const d={date:x.date,time:"",acct:"bank",amt:x.amt,raw:x.raw,ref:x.ref,dir:x.dir,seq:x.seq,src:"yono",bal:x.bal};
  if(x.dir==="dr"&&/ATM|ATW|CASH\s*W|CSH\s*W|CASH WDL|NFS\/|WDL\s*TFR/.test(s))return {...d,kind:"move",to:"wallet",cat:"",note:"ATM withdrawal"};
  if(x.dir==="cr"&&/CASH\s*DEP|CSH\s*DEP|BY CASH|CDM/.test(s))return {...d,kind:"move",acct:"wallet",to:"bank",cat:"",note:"Cash deposit"};
  if(L&&L.kind===(x.dir==="dr"?"out":"in"))return {...d,kind:L.kind,cat:L.cat||"",note:L.note||p,book:L.book||"personal",learned:true};
  if(x.dir==="cr"){if(/SAL|SALARY|APDCL|ASSAM POWER/.test(s))return {...d,kind:"in",cat:"Salary",note:"Salary"};
    if(/INT\.?\s*PD|INTEREST|CREDIT INT/.test(s))return {...d,kind:"in",cat:"Interest",note:"Bank interest"};
    if(/REFUND|REVERSAL|REV\b|CASHBACK/.test(s))return {...d,kind:"in",cat:"Refund",note:"Refund · "+p};
    return {...d,kind:"in",cat:"",note:p};}
  if(/ZERODHA|KITE|GROWW|MUTUAL|MF\b|NACH.*(SIP|AMC)|BSE STAR|CAMS|KFIN/.test(s))return {...d,kind:"out",cat:"Investment",note:p};
  if(/EMI|LOAN|NACH/.test(s))return {...d,kind:"out",cat:"Loan / EMI",note:p};
  if(/JIO|AIRTEL|RECHARGE|VODAFONE|\bVI\b/.test(s))return {...d,kind:"out",cat:"Mobile",note:p};
  if(/PETROL|FUEL|HPCL|BPCL|IOCL|INDIAN OIL|FILLING/.test(s))return {...d,kind:"out",cat:"Fuel",note:p};
  if(/SWIGGY|ZOMATO|KFC|DOMINO|RESTAURANT|HOTEL|DHABA|CAFE/.test(s))return {...d,kind:"out",cat:"Food",note:p};
  if(/AMAZON|FLIPKART|MYNTRA|MEESHO/.test(s))return {...d,kind:"out",cat:"",note:p};
  if(/PHARM|MEDIC|HOSPITAL|CLINIC|APOLLO|DIAGNOS/.test(s))return {...d,kind:"out",cat:"Medical",note:p};
  if(/CHARGE|FEE|SMS ALERT|GST/.test(s))return {...d,kind:"out",cat:"Bills",note:"Bank charges"};
  return {...d,kind:"out",cat:"",note:p};}
/* add a statement's rows to the review list, skipping rows already logged or waiting; returns counts */
/* a statement row's identity: day, amount, direction, SBI's description and reference (the description carries the UPI number) */
const dirOf=x=>x.dir||(x.kind==="in"||(x.kind==="move"&&x.to==="bank")?"cr":"dr");
const rowKey=x=>[x.date,x.amt,dirOf(x),String(x.raw||"").replace(/\s+/g," ").trim().toUpperCase(),String(x.ref||"").trim().toUpperCase()].join("|");
/* add a statement's rows to the review list. Statements may overlap (yesterday + today uploaded again at night): a row is new
   only if the file has more copies of it than are already logged, waiting or discarded, so overlapping ranges add nothing
   twice while two genuinely identical payments on one day both come in. Returns counts. */
function importRows(rows){const s=I.load(KEY),have={};
  [...Object.values(s.tx),...Object.values(s.pend),...Object.values(s.skip)].forEach(x=>{if(x&&(x.src==="yono"||x.skipKey)){const k=x.skipKey||rowKey(x);have[k]=(have[k]||0)+1;}});
  const fileN={},fresh=rows.filter(x=>{const k=rowKey(x);fileN[k]=(fileN[k]||0)+1;return fileN[k]>(have[k]||0);});
  const base=Date.now();fresh.forEach((x,i)=>{s.pend[I.uid()+i]={...draft(x),t:base+i};});
  /* the statement's last balance is the bank's real balance on that day */
  const last=rows[rows.length-1];let cp=null;
  if(last&&ok(last.bal)){const old=Object.values(s.bal).filter(b=>b&&b.acct==="bank").sort((a,b)=>ord(a)<ord(b)?-1:1).pop();
    if(!old||(last.date>=old.date&&!(old.date===last.date&&old.amt===last.bal&&old.src==="yono"))){cp={acct:"bank",amt:last.bal,date:last.date,time:"23:59",src:"yono",t:base};s.bal[I.uid()]=cp;}}
  I.save(KEY,s);return {added:fresh.length,dup:rows.length-fresh.length,cp,from:rows[0].date,to:last.date};}
/* a hand entry from the bank that the statement also has: same day, same amount, same direction */
function handTwin(p){const same=x=>x.kind==="move"?p.kind==="move"&&x.to===p.to:x.kind===p.kind&&x.acct==="bank";
  return list("tx").find(x=>x.src==="hand"&&!x.ref&&x.date===p.date&&x.amt===p.amt&&same(x));}
function approve(id,edit){const s=I.load(KEY),p=s.pend[id];if(!p)return;const r={...p,...edit};delete r.learned;delete r.bal;delete r.t;
  const twin=handTwin(r);
  if(twin){const {id:tid,...tw}=twin;delete tw.t;I.upsert(KEY,"tx",tid,{...tw,ref:r.ref,raw:r.raw,dir:r.dir,src:"yono",book:r.book||tw.book||"personal"});}
  else I.upsert(KEY,"tx",null,r);
  if(r.kind!=="move"&&r.src!=="wa")I.upsert(KEY,"learn",learnKey(r.raw),{kind:r.kind,cat:r.cat,note:r.note,book:r.book||"personal"});
  I.remove(KEY,"pend",id);return twin?"linked":"added";}
/* a discarded statement row is remembered, so uploading an overlapping statement doesn't bring it back */
function discard(id){const p=I.load(KEY).pend[id];if(p&&p.src==="yono")I.upsert(KEY,"skip",null,{skipKey:rowKey(p),date:p.date});I.remove(KEY,"pend",id);}
/* WhatsApp money drafts from the bridge -> review list (skips ones already waiting or already approved).
   APDCL ones are imprest money: they are drafted on the Imprest account. */
function addWa(items){const s=I.load(KEY),seen=new Set();[...Object.values(s.tx),...Object.values(s.pend)].forEach(x=>{if(x&&x.waId)seen.add(x.waId);});
  const base=Date.now();let n=0;(items||[]).forEach((x,i)=>{if(!x||!x.id||seen.has(x.id)||!ok(x.amt))return;const ap=x.book==="apdcl";
    s.pend[I.uid()+i]={src:"wa",waId:x.id,kind:x.kind==="in"?"in":"out",acct:x.acct==="bank"?"bank":"wallet",amt:x.amt,date:x.date||now().date,time:x.time||"",cat:ap?(x.kind==="in"?"Imprest received":impCat(x.cat,x.note)):x.cat||"",note:x.note||"",raw:x.raw||x.note||"",book:ap?"apdcl":"personal",t:base+i};n++;});
  if(n)I.save(KEY,s);return n;}
/* an APDCL category from a draft's category or remark */
function impCat(cat,note){if(IMP_CATS.includes(cat))return cat;const s=(String(cat||"")+" "+String(note||"")).toUpperCase();
  if(/HIRING|HIRED|CRANE/.test(s))return "Vehicle hire";if(/FUEL|PETROL|DIESEL|BOLERO|ALTO|WAGON/.test(s))return "Fuel";if(/LABOUR|WAGES/.test(s))return "Labour";
  if(/DRIVE|POLICE|THEFT|VIGILANCE|\bDC\b/.test(s))return "Drives & DC";if(/FOOD|TEA|HOTEL|LUNCH/.test(s))return "Food & tea";
  if(/OFFICE|PAPER|STATION|REGISTER|RECHARGE/.test(s))return "Office";return "Other";}
/* entries put on the short-lived "imprest" account by the app (not sheet history) go back to wallet/bank, marked APDCL,
   keeping when they were logged so balance checks treat them as before */
function migrateApdcl(){const s=I.load(KEY);let n=0;
  Object.entries(s.tx).forEach(([id,x])=>{if(x&&x.acct==="imprest"&&x.src!=="sheet"){s.tx[id]={...x,acct:x.src==="yono"?"bank":"wallet",book:"apdcl",at:x.at||x.t,t:Date.now()};n++;}});
  Object.entries(s.pend).forEach(([id,x])=>{if(x&&x.acct==="imprest"){s.pend[id]={...x,acct:"wallet",book:"apdcl",t:Date.now()};n++;}});
  if(n)I.save(KEY,s);return n;}
/* ---------- Zerodha top-ups feed the Kite fund ----------
   An Invest entry whose remark mentions Zerodha or Kite is money sent to the Kite account: it is mirrored as Kite fund
   "money in" (ETF Shop's cap records), so ETF Shop and Portfolio show it. If ETF Shop already has a money-in of the same
   amount on the same day, that record is used instead of adding another. Zerodha takes no cash, so such an entry
   logged on the wallet is moved to the bank. The mirror follows edits and deletions of the entry. */
const isKite=x=>x&&x.kind==="out"&&x.cat==="Investment"&&!isApdcl(x)&&/zerodha|kite/i.test((x.note||"")+" "+(x.raw||""));
function linkKite(){const s=I.load(KEY),e=I.load("etf");let n=0;
  const used=new Set(Object.values(s.tx).map(x=>x&&x.kiteId).filter(Boolean));
  Object.entries(s.tx).forEach(([id,x])=>{if(!x)return;
    if(isKite(x)){let r=x,ch=false;
      if(r.acct==="wallet"&&r.src!=="sheet"){r={...r,acct:"bank",at:r.at||r.t};ch=true;}
      let cid=r.kiteId;
      if(!cid){cid=Object.entries(e.cap).find(([cid2,c])=>c&&!used.has(cid2)&&c.date===r.date&&Math.abs((c.amount||0)-r.amt)<0.5)?.[0]||"mb-"+id;used.add(cid);r={...r,kiteId:cid,at:r.at||r.t};ch=true;}
      const c=e.cap[cid];if(!c||c.date!==r.date||Math.abs((c.amount||0)-r.amt)>=0.5)I.upsert("etf","cap",cid,{...(c||{}),date:r.date,amount:r.amt,note:(c&&c.note)||"From Money Book: "+(r.note||"Zerodha")});
      if(ch){delete r.t;I.upsert(KEY,"tx",id,r);n++;}}
    else if(x.kiteId){I.remove("etf","cap",x.kiteId);const r={...x,at:x.at||x.t};delete r.kiteId;delete r.t;I.upsert(KEY,"tx",id,r);n++;}});
  return n;}
window.Money={isKite,linkKite,isApdcl,apdcl,OWN,IMP,IMP_CATS,IMP_IN_CATS,archive,impCat,migrateApdcl,counts,KEY,ACCTS,OUT_CATS,IN_CATS,NOT_SPEND,now,ord,isSpend,list,entries,effect,balance,summary,names,readStatement,payee,draft,importRows,approve,discard,handTwin,addWa};
})();
