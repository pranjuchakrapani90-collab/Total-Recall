/* Pranju OS · Vault rules (12 Nov 2026): reads a document's text with fixed rules, no AI.
   Given a Drive file and the text Drive extracted from it, it picks out what follows a fixed format in APDCL
   paperwork (consumer numbers, memo/letter numbers, receipt and bill numbers, dates, rupee amounts, labelled names,
   places, the "Sub:" line), guesses the document type by keyword score, and says how sure it is. Whatever it cannot
   read or classify is flagged for review (by hand, or by Gemini) instead of being guessed.
   It copies values exactly as written in the file; it never rewrites or adds up figures.
   Works in the page (window.PosRules) and in Node (module.exports) so tools/test-vault-rules.js can test it.
     read(file, text)       -> fields     file: {name, type}   type: "pdf" | "doc" | "sheet" | "slides"
     readSheet(file, tabs)  -> fields     tabs: [{title, rows, cols, sample:[[cell,…],…]}]
     toRow(file, fields, o) -> the 26 Index columns (A–Z) as an array of plain text
     TYPES                  -> the document types used
   fields: {doc_type, confidence, needs, reason, consumer_nos[], memo_nos[], receipt_nos[], names[], places[],
            amounts[], date, subject, summary, read} */
(function(root){
"use strict";
var TYPES=["letter","office order","circular","notice","estimate","invoice","receipt","report","register","petition","complaint","form","other"];
var MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function uniq(a,max){var s={},o=[];a.forEach(function(x){x=String(x||"").replace(/\s+/g," ").trim();var k=x.toLowerCase();if(!x||s[k])return;s[k]=1;o.push(x)});return max?o.slice(0,max):o}
function title(s){s=String(s||"").trim();if(s!==s.toUpperCase())return s;return s.toLowerCase().replace(/(^|[\s.\-/(])([a-z])/g,function(m,a,b){return a+b.toUpperCase()})}
/* never carry identity or bank numbers into the index (Aadhaar 4-4-4, PAN, labelled account numbers) */
function scrub(s){return String(s||"").replace(/\b\d{4}[ -]\d{4}[ -]\d{4}\b/g,"[id removed]").replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g,"[id removed]")
  .replace(/((?:A\/?c|Account)\.?\s*(?:No|Number)\.?\s*[:\-]?\s*)\d[\d -]{7,20}\d/gi,"$1[removed]")}

/* ---------- pieces ---------- */
/* APDCL consumer numbers: 12 digits, sub-division code, then 000 or 010 (129000039145, 129010326351) */
function consumers(t){var out=[],re=/(^|[^\d])(\d{3}0[01]0\d{6})(?!\d)/g,m;
  while((m=re.exec(t))){var before=t.slice(Math.max(0,m.index-30),m.index);if(/aadha+r|uid\b|a\/?c\b|account/i.test(before))continue;out.push(m[2])}
  return uniq(out,12)}
/* memo / letter numbers: letters first, three or more parts joined by "/", with a digit somewhere
   (SDE/SESD/APDCL/T-9/3504, AGM/NED-II/APDCL/CAR/T-26/2023/2550, APDCL/CGM(PP&D)/DTR Repairing/2021/246/Pt-I/49) */
function memos(t){var out=[],re=/[A-Z][A-Za-z&().\-]{0,24}(?: ?\/ ?[A-Za-z0-9&().\-]+(?: (?!Dtd?\b|Dated?\b|DT\b)[A-Za-z][A-Za-z&().\-]*){0,2}){2,9}/g,m;
  while((m=re.exec(t))){var parts=m[0].split("/").map(function(p){return p.trim()});
    var last=parts[parts.length-1],after=t.slice(m.index+m[0].length,m.index+m[0].length+10).match(/^ (\d{1,6})(?![\d\/.\-])/);
    if(/^(?:19|20)\d\d$/.test(last)&&after)parts.push(after[1]);   /* "…/E-7/2026 4120": the slash was lost in scanning */
    else if(/\s/.test(last)){var f=last.split(/\s+/)[0];if(/\d/.test(f))parts[parts.length-1]=f;else if(parts.length>3)parts.pop()}
    parts=parts.filter(Boolean);var s=parts.join("/").replace(/[.,;:\-(]+$/,"");
    if(parts.length<3||!/\d/.test(s)||!/[A-Z]{2,}/.test(s)||/^https?$/i.test(parts[0])||/www\.|\.com|\.org|\.in\b/i.test(s))continue;
    if(!parts.some(function(p){return /^[A-Z][A-Za-z&().\-]{1,}$/.test(p)&&/[A-Z]{2,}/.test(p)}))continue;
    out.push(s)}
  return uniq(out,10)}
function pad(n){return (n<10?"0":"")+n}
function mkDate(d,mo,y){d=+d;mo=+mo;y=+y;if(y<100)y+=y<70?2000:1900;if(!(d>=1&&d<=31&&mo>=1&&mo<=12&&y>=1950&&y<=2099))return "";return pad(d)+"-"+pad(mo)+"-"+y}
var D1="(\\d{1,2})\\s?[./-]\\s?(\\d{1,2})\\s?[./-]\\s?(\\d{4}|\\d{2})(?!\\d)",D2="(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\\s,-]+(\\d{4})";
function dateIn(s){var m=s.match(new RegExp(D1));if(m){var a=mkDate(m[1],m[2],m[3]);if(a)return a}
  m=s.match(new RegExp(D2,"i"));if(m)return mkDate(m[1],MON[m[2].toLowerCase()],m[3]);return ""}
/* the document's own date: a labelled one first (Dated / Dt / Bill Date / Payment Date), else the first date in the text */
function docDate(t){var pass=[/(?:Bill Date|Payment Date|Order Date|Receipt Date)\s*[.:\-]*\s*([^\n]{0,24})/gi,/(?:\bDated?|\bDtd?|\bDT|\bD\/T)\s*[.:\-]*\s*([^\n]{0,24})/gi];
  for(var i=0;i<pass.length;i++){var re=pass[i],m;
    while((m=re.exec(t))){if(/(?:due|expiry|birth|joining|upto|valid) *$/i.test(t.slice(Math.max(0,m.index-9),m.index)))continue;var d=dateIn(m[1]);if(d)return d}}
  return dateIn(t.slice(0,6000))}
function money(n){var p=String(n).replace(/,/g,"").split("."),i=p[0].replace(/^0+(?=\d)/,""),l=i.slice(-3),r=i.slice(0,-3);
  if(r)l=r.replace(/\B(?=(\d{2})+(?!\d))/g,",")+","+l;return "Rs "+l+(p[1]?"."+p[1]:"")}
function amounts(t){var out=[],re=/(?:Rs\.?|₹|INR)\s*([\d,]*\d(?:\.\d{1,2})?)/gi,m;
  while((m=re.exec(t))){if(!(parseFloat(m[1].replace(/,/g,""))>0))continue;out.push(money(m[1]))}
  return uniq(out,10)}
function receipts(t,only){var a=[],b=[],re=/\b(Receipt|Bill|Invoice|Challan|Txn|Transaction)\s*(?:No|Number|ID|Id)\b\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{3,23})/gi,m;
  while((m=re.exec(t))){if(!/\d/.test(m[2]))continue;(/^receipt$/i.test(m[1])?a:b).push(m[2].replace(/[\/\-]+$/,""))}
  return only?uniq(a):uniq(a.concat(b),10)}
var STOP="(?=\\s{2,}|\\s+(?:Consumer|Bill|Address|Txn|Collector|Payment|Sub ?Division|Old|Due|S\\/O|D\\/O|W\\/O|C\\/O|Amount|Invoice|Contact|Email|Meter)\\b|[\\n,;]|$)";
function names(t){var out=[],m,re=new RegExp("\\b(?:Consumer\\s+Name|Name)\\s*:\\s*([A-Z][A-Za-z .']{2,50}?)"+STOP,"g");
  while((m=re.exec(t)))out.push(title(m[1]));
  re=/\bnamed\s+([A-Z][A-Za-z .]{2,40}?)\s*[,.(]/g;while((m=re.exec(t)))out.push(title(m[1]));
  re=/\b(?:Sri|Shri|Smt|Md|Mr|Mrs|Ms|Er|Dr)\.? +([A-Z][a-zA-Z]+(?: +[A-Z][a-zA-Z.]+){0,3})/g;while((m=re.exec(t)))out.push(m[1].replace(/\.$/,""));
  /* who a letter is addressed to: the lines after "To," */
  var to=t.match(/(?:^|\n)\s*To,?\s*\n+((?:[^\n]{3,80}\n+){1,3})/);
  if(to){var ls=to[1].split(/\n+/).map(function(x){return x.trim()}).filter(function(x){return x&&!/^(sub|ref|date|dt|dtd|dud|no|memo)\b/i.test(x)&&!dateIn(x)});
    if(ls.length)out.push(title(ls.slice(0,2).join(", ")))}
  re=/\b([A-Z][A-Za-z]+) +Electrical +(Sub[- ]?Division|Division(?:[- ]?[IVX]+\b)?|Circle)/gi;
  while((m=re.exec(t))){if(/^(the|of|under|and|name|engineer|manager|officer|said|this|any|each)$/i.test(m[1])||/engineer$/i.test(m[1]))continue;out.push(title(m[1])+" Electrical "+title(m[2]).replace(/Sub ?Division/i,"Sub-Division"))}
  return uniq(out.map(scrub),12)}
var GAZ=["Samaguri","Rupahi","Rupahihat","Amoni","Barhampur","Puranigudam","Bheloguri","Missa","Laokhowa","Lawkhuwa","Kawaimari","Singimari","Nonoi","Ambagan","Bharaguri","Halowagaon","Amlokhi","Chapanala","Kaliabor","Nagaon","Hojai","Raha","Doboka","Dhing","Kathiatoli","Lanka","Borduwa","Bhoggamukh","Khanatup","Hatipukhuri","Dighali","Garajan","Namkuri","Bilasipara","Gauripur","Dhubri","Kokrajhar","Guwahati"];
function places(t){var out=[],m,re=/\b(?:[Vv]ill(?:age)?|VILL(?:AGE)?|P\.?O|P\.?S|Address|ADDRESS|Mouza)\b\.?\s*[:\-.]?\s*([A-Z][A-Za-z]+(?: (?!P\.?O\b|P\.?S\b|Old\b|Dist\b|Under\b)[A-Z][A-Za-z]+)?)/g;
  while((m=re.exec(t))){if(/^(The|And|Under|Of|Is|No)$/i.test(m[1]))continue;out.push(title(m[1]))}
  re=/\b(\d{2,3}(?:\/\d{1,2})? ?kV) +([A-Z][A-Za-z\-]+(?: [A-Z0-9][A-Za-z0-9\-]*)?) +(Feeder|Line|SS|Sub-?station)\b/gi;
  while((m=re.exec(t)))out.push(m[1].replace(/ ?kv/i," kV")+" "+title(m[2])+" "+title(m[3]));
  re=/\bDTR\s*(?:No|Number|Code)?\.?\s*[:\-]?\s*(\d{2,6})\b/gi;while((m=re.exec(t)))out.push("DTR "+m[1]);
  var low=t.toLowerCase();GAZ.forEach(function(g){if(new RegExp("\\b"+g.toLowerCase()+"\\b").test(low))out.push(g)});
  return uniq(out.map(scrub),12)}
function subject(t){var m=t.match(/(?:^|\n)\s*Sub(?:ject)?\s*[:\-.]+\s*([^\n]+(?:\n(?!\s*\n)(?!\s*(?:Sir|Madam|Ref|Dear|Respected)\b)[^\n]+){0,2})/i);
  if(!m)return "";var s=m[1].replace(/\s+/g," ").trim();return s.length>240?s.slice(0,240)+"…":s}

/* ---------- document type by keyword score ---------- */
var SCORE={
  "receipt":[[/payment receipt|money receipt/i,5],[/receipt\s*no/i,4],[/amount received/i,3],[/payment mode/i,2]],
  "invoice":[[/electricity bill/i,5],[/tax invoice|gst invoice/i,5],[/net bill amount/i,3],[/\bbill (?:number|no)\b/i,2],[/due date/i,2],[/units consumed/i,2],[/assessment bill/i,3]],
  "estimate":[[/cost abstract|abstract of cost/i,4],[/\bestimate\b/i,3],[/\bSoR\b|schedule of rates/i,3],[/\bBoQ\b|bill of quantit/i,3],[/supervision charge/i,2],[/technical sanction|administrative approval/i,2]],
  "office order":[[/office\s+order/i,6],[/\bis hereby\b/i,2],[/\b(?:released|transferred|posted|attached|engaged|relieved)\b/i,2],[/superannuation/i,2]],
  "circular":[[/\bcircular\b/i,6],[/\bnotification\b/i,4]],
  "notice":[[/(?:^|\n)\s*(?:disconnection |final |show cause |legal )?notice\b/i,5],[/section\s*(?:126|135|163|56)\b/i,3],[/show cause/i,3],[/within \d+ (?:days|hours)/i,1]],
  "letter":[[/(?:^|\n)\s*To,?\s*(?:\n|$)/,3],[/(?:^|\n)\s*Sub(?:ject)?\s*[:\-]/i,3],[/\bSir,|\bMadam,|Dear Sir/i,2],[/Memo No|Copy to|Copy for/i,2],[/yours (?:faithfully|sincerely)/i,2],[/for favou?r of/i,1]],
  "petition":[[/\bpetition\b/i,4],[/most respectfully|humbly|beg to (?:state|inform|pray)|prayer/i,3],[/we,? the (?:undersigned|villagers|public)/i,3]],
  "complaint":[[/\bcomplain/i,4],[/\bgrievance/i,3],[/excess bill|wrong bill|bill correction/i,3]],
  "report":[[/\breport\b/i,3],[/joint meter reading|\bJMR\b|energy audit/i,4],[/inspection|interruption|progress|status/i,1],[/daily|weekly|monthly/i,1]],
  "register":[[/\bregister\b|\bledger\b|\binventory\b/i,4],[/\bindexing\b|\bmaster\b|list of/i,2]],
  "form":[[/application form|form no\b/i,4],[/declaration|undertaking|affidavit/i,3]]};
var NAMEHINT=[[/receipt/i,"receipt",3],[/estimate|boq/i,"estimate",4],[/\bbill\b/i,"invoice",2],[/office.?order|\boo\b/i,"office order",4],[/circular/i,"circular",4],[/notice/i,"notice",4],[/report|status|daily/i,"report",3],[/register|master|index|ledger|list/i,"register",3],[/letter|memo/i,"letter",2],[/petition/i,"petition",3],[/complain|grievance/i,"complaint",3],[/form/i,"form",2]];
function classify(name,t){var sc={},head=t.slice(0,8000);
  Object.keys(SCORE).forEach(function(k){var n=0;SCORE[k].forEach(function(r){if(r[0].test(head))n+=r[1]});sc[k]=n});
  NAMEHINT.forEach(function(h){if(h[0].test(name||""))sc[h[1]]=(sc[h[1]]||0)+h[2]});
  var ks=Object.keys(sc).sort(function(a,b){return sc[b]-sc[a]}),best=ks[0],b=sc[best],s=sc[ks[1]]||0;
  /* a letter that carries a stronger specific type (office order, notice, estimate forwarding) keeps the specific type */
  if(b>=5&&b-s>=2)return {type:best,conf:"high",score:b};
  if(b>=3)return {type:best,conf:b-s>=1?"medium":"low",score:b};
  return {type:"other",conf:"low",score:b}}
/* does the text look like real words, or like scanner noise? share of tokens that look like words */
function wordiness(t){var tk=t.slice(0,6000).split(/\s+/).filter(function(x){return x.length>=3});if(tk.length<8)return 0;
  var ok=0;tk.forEach(function(x){if(/^[A-Za-z][A-Za-z'.,:;()\-]*$/.test(x)&&/[aeiouAEIOU]/.test(x)||/^[\d,./:\-]+$/.test(x)||/[\u0980-\u09FF]/.test(x))ok++});return ok/tk.length}
var LHEAD=/ASSAM ?POWER ?DISTRIBUTION|REGD\.? ?OFFICE|\bCIN ?:|GSTIN|GISTN|www\.|OFFICE ?OF ?THE|Customer Care|Scanned with/i,LSKIP=/^(?:No|Memo No|DT|Dtd?|Dated?|Date|To|Ref|Sub)\b[\s.:,\-]/i;
function firstLines(t,n){var ls=t.split(/\n+/).map(function(x){return x.trim()}).filter(function(x){return x.length>=6&&/[A-Za-z\u0980-\u09FF]{3}/.test(x)&&!LHEAD.test(x)&&!LSKIP.test(x)});
  var s=ls.slice(0,3).join(" / ");return s.length>n?s.slice(0,n)+"…":s}
function typeLabel(k){return k.charAt(0).toUpperCase()+k.slice(1)}

/* ---------- a text document (PDF, Doc, slides) ---------- */
function read(file,text){
  var raw=String(text||"").replace(/\r/g,"").replace(/\\([&\-.()#*_])/g,"$1").replace(/[ \t\u00a0]+/g," "),t=raw.length>60000?raw.slice(0,60000):raw;
  var f={doc_type:"other",confidence:"low",needs:false,reason:"",consumer_nos:[],memo_nos:[],receipt_nos:[],names:[],places:[],amounts:[],date:"",subject:"",summary:"",read:raw.length>60000?"first 60,000 characters":"full"};
  var letters=(t.match(/[A-Za-z\u0980-\u09FF]/g)||[]).length;
  if(letters<60){f.needs=true;f.reason="No readable text (photo, handwriting or a blank scan)";f.summary="No text could be read from this file.";f.read="none";return f}
  f.consumer_nos=consumers(t);f.memo_nos=memos(t);f.receipt_nos=receipts(t);f.names=names(t);f.places=places(t);f.amounts=amounts(t);f.date=docDate(t);f.subject=scrub(subject(t));
  var c=classify(file&&file.name,t);f.doc_type=c.type;f.confidence=c.conf;
  var w=wordiness(t);
  if(w<0.45){f.needs=true;f.reason="Text is garbled (poor scan or handwriting)";f.confidence="low"}
  else if(c.type==="other"){f.needs=true;f.reason="Document type not recognised by the rules"}
  var bits=[],own=receipts(t,true),nR=own.length;
  if(f.doc_type==="receipt"){bits.push(nR>1?nR+" payment receipts ("+own.slice(0,4).join(", ")+(nR>4?"…":"")+")":"Payment receipt"+(nR?" "+own[0]:""));
    if(f.date)bits.push("dated "+f.date);if(f.names.length)bits.push(f.names.slice(0,3).join(", "));if(f.consumer_nos.length)bits.push("consumer "+f.consumer_nos.slice(0,3).join(", "));if(f.amounts.length)bits.push(f.amounts[0])}
  else if(f.doc_type==="invoice"){bits.push("Bill"+(f.receipt_nos.length?" "+f.receipt_nos[0]:""));if(f.date)bits.push("dated "+f.date);if(f.names.length)bits.push(f.names[0]);if(f.consumer_nos.length)bits.push("consumer "+f.consumer_nos[0]);if(f.amounts.length)bits.push("amounts "+f.amounts.slice(0,3).join(", "))}
  else{bits.push((f.doc_type==="other"?"Document":typeLabel(f.doc_type))+(f.memo_nos.length?" "+f.memo_nos[0]:""));if(f.date)bits.push("dated "+f.date);
    if(f.subject)bits.push("Sub: "+f.subject);else bits.push("Begins: "+scrub(firstLines(t,200)))}
  f.summary=bits.join(" · ");return f}

/* ---------- a spreadsheet: tab names, sizes and the first rows of each tab ---------- */
function readSheet(file,tabs){
  var f={doc_type:"register",confidence:"medium",needs:false,reason:"",consumer_nos:[],memo_nos:[],receipt_nos:[],names:[],places:[],amounts:[],date:"",subject:"",summary:"",read:"first rows of each tab"};
  tabs=(tabs||[]).filter(function(x){return x});var all=[],desc=[],cells=0;
  tabs.forEach(function(tb){var rows=tb.sample||[];rows.forEach(function(r){(r||[]).forEach(function(c){if(c!==""&&c!=null){cells++;all.push(String(c))}})})});
  if(!cells){f.needs=true;f.reason="Empty sheet, or nothing in its first rows";f.doc_type="other";f.confidence="low";f.summary="No data found in the first rows of this sheet.";return f}
  var text=all.join("\n");
  f.consumer_nos=consumers(text);f.memo_nos=memos(text);f.names=names(text);f.places=places(text);f.date=dateIn((file&&file.name||"")+" "+text.slice(0,3000));
  var head=null,ttl="";
  tabs.forEach(function(tb,i){var rows=tb.sample||[],h=null;
    for(var r=0;r<Math.min(rows.length,12);r++){var row=(rows[r]||[]).map(function(c){return String(c==null?"":c).trim()}),full=row.filter(Boolean);
      var wordy=full.filter(function(c){return /[A-Za-z]/.test(c)&&c.length<=40});
      if(full.length>=3&&wordy.length>=full.length*0.7){h=full;break}
      if(i===0&&!ttl&&full.length&&full.length<=2&&full[0].length>=8)ttl=full[0]}
    if(i===0)head=h;
    desc.push('"'+tb.title+'"'+(tb.rows?" ("+Number(tb.rows).toLocaleString("en-IN")+" rows in grid)":""))});
  var nm=(file&&file.name||"")+" "+ttl,c=classify(file&&file.name,nm+"\n"+(head||[]).join(" "));
  f.doc_type=/report|status|daily|progress|summary|checking|non.?com/i.test(nm)?"report":(c.type==="other"||c.type==="letter"?"register":c.type);
  if(!head){f.confidence="low"}
  var bits=["Workbook with "+tabs.length+" tab"+(tabs.length>1?"s":"")+": "+desc.slice(0,8).join(", ")+(desc.length>8?"…":"")];
  if(ttl)bits.push("Title: "+scrub(ttl.slice(0,160)));
  if(head)bits.push("Columns of first tab: "+scrub(head.slice(0,14).join(", "))+(head.length>14?"…":""));
  f.summary=bits.join(" · ");return f}

/* ---------- the 26 Index columns ---------- */
function ist(d){d=new Date((d?new Date(d).getTime():Date.now())+19800000);return isNaN(d)?"":d.toISOString().slice(0,16)+"+05:30"}
function toRow(file,f,o){o=o||{};var J=function(a){return (a||[]).join(" | ")};
  return [file.id,file.name||"",file.url||"https://drive.google.com/file/d/"+file.id+"/view",file.path||"",file.type||"",ist(file.modified),ist(file.created),"drive",
    f.doc_type||"",J(f.consumer_nos),J(f.memo_nos),J(f.receipt_nos),J(f.names),J(f.places),J(f.amounts),f.summary||"","",f.confidence||"","",
    f.needs?(f.reason||""):"","",o.note||"Read by Pranju OS rules, no AI",f.read||"",o.status||(f.needs?"needs_review":"auto"),o.duplicateOf||"",ist()].map(function(x){return String(x==null?"":x).slice(0,4000)})}
var api={TYPES:TYPES,read:read,readSheet:readSheet,toRow:toRow,ist:ist,scrub:scrub,_:{consumers:consumers,memos:memos,docDate:docDate,amounts:amounts,receipts:receipts,names:names,places:places,subject:subject,classify:classify}};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PosRules=api;
})(typeof window!=="undefined"?window:this);
