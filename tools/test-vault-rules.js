/* Checks vault-rules.js against made-up documents in the formats APDCL paperwork uses.
   Run:  node tools/test-vault-rules.js      (prints "ok" lines; exits 1 if a rule broke)
   When a new kind of document needs a rule, add a sample here first, then change vault-rules.js until it passes.
   All names and numbers below are invented. */
const R=require('../vault-rules.js');let bad=0;
const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)bad++};
const bill=`Consumer Name: RAMEN TESTBORA Consumer Number: 129000012345 Bill Amount: 2500.0 Address: NAMGAON Old Consumer Number: SMGDL0001K Due Date: 24-Apr-2023
DTR Number: 042 Bill Number:900000001
Bill Period: 02-Jan-2023 To 01-Apr-2023
Connected Load in KW: 1.0 Bill Date : 07-Apr-2023
Units Consumed 12 Net Bill Amount Rs. 1478.60 Rs. 1021.40 Rs. 0.00 Rs. 2500.0
NAME OF ELECTRICAL SUB-DIVISION / IRCA : SAMAGURI ELECTRICITY BILL`;
let f=R.read({name:'900000001.pdf'},bill);
ok(f.doc_type==='invoice'&&f.confidence==='high','bill is an invoice');ok(f.consumer_nos.join()==='129000012345','consumer number');
ok(f.date==='07-04-2023','bill date, not the due date');ok(f.amounts.join('|')==='Rs 1,478.60|Rs 1,021.40|Rs 2,500.0','amounts as written, zero left out');
ok(f.names[0]==='Ramen Testbora'&&f.places.includes('DTR 042'),'name and DTR');
const letter=`ASSAM POWER DISTRIBUTION COMPANY LIMITED
OFFICE OF THE SUB-DIVISIONAL ENGINEER SAMAGURI ELECTRICAL SUB-DIVISION SAMAGURI, NAGAON
No:- SDE/SESD/APDCL/T-9/1234
To,
Dtd: 10/04/23
The Officer In Charge
Testpur Police Station
Sub: FIR regarding theft of conductor at vill- Namgaon, P.O Testpur.
Sir,
With reference to AGM/NED-II/APDCL/CAR/T-26/2023/2550 Dtd 01/04/2023, one person named Hari Example, S/o Late Example was seen.
Memo No. SDE/SESD/APDCL/CAR/E-7/2026 4120
Copy to: The Assistant General Manager, Nagaon Electrical Division-II`;
f=R.read({name:'scan 12.pdf'},letter);
ok(f.doc_type==='letter','letter');ok(f.memo_nos[0]==='SDE/SESD/APDCL/T-9/1234','own memo number first');
ok(f.memo_nos.includes('AGM/NED-II/APDCL/CAR/T-26/2023/2550'),'referred memo number stops before "Dtd"');
ok(f.memo_nos.includes('SDE/SESD/APDCL/CAR/E-7/2026/4120'),'number that lost its slash in scanning');
ok(f.date==='10-04-2023'&&/^FIR regarding theft/.test(f.subject),'date and subject');
ok(f.names.includes('The Officer In Charge, Testpur Police Station')&&f.names.includes('Hari Example'),'addressee and named person');
ok(f.names.includes('Nagaon Electrical Division-II')&&f.places.includes('Namgaon'),'office and village');
const rc=`FINAL ASSESSMENT BILL PAYMENT RECEIPT Duplicate
Receipt No : 800000001 D/T : 07/11/2026, 8:17:26 PM Invoice No : 3000001 Sub Division : Testpur Consumer No : 032010100001 Name : ABUL EXAMPLE S/O LT SOMEONE Bill Amount : Rs. 67435 Due Amount : Rs. 0 Payment Mode : cash Amount Received : Rs. 67435 Payment Date : 07/11/2026
Receipt No : 800000002 D/T : 07/11/2026, 8:16:39 PM Invoice No : 3000002 Sub Division : Testpur Consumer No : 032010100002 Name : MINA EXAMPLE Bill Amount : Rs. 100 Amount Received : Rs. 100 Payment Date : 07/11/2026`;
f=R.read({name:'Duplicate Receipt Print.pdf'},rc);
ok(f.doc_type==='receipt'&&/^2 payment receipts \(800000001, 800000002\)/.test(f.summary),'two receipts in one file');
ok(f.names.join('|')==='Abul Example|Mina Example'&&f.consumer_nos.length===2,'names stop before S/O; both consumers');
f=R.read({name:'x.pdf'},'');ok(f.needs&&/No readable text/.test(f.reason),'blank scan goes to review');
f=R.read({name:'x.pdf'},'l1 |||| ~~ xx7 q9z ;;; 0O0 lI1 ,,,, zxq wqp ttt rrr 99x x9x ||| ~~~ qqq zzz xxx jjj kkk vvv bbb nnn mmm ppp ddd fff ggg hhh');
ok(f.needs&&/garbled/.test(f.reason),'scanner noise goes to review');
f=R.read({name:'x.pdf'},'Minutes of the weekly gathering held at the hall where members talked about the picnic and who would bring which food items for everybody attending.');
ok(f.needs&&/not recognised/.test(f.reason),'unknown type goes to review');
f=R.read({name:'k.pdf'},'To,\nThe Manager\nSub: KYC update, Aadhaar 1234 5678 9012, PAN ABCDE1234F, A/c No: 30123456789\nSir, kindly update. Yours faithfully');
ok(!/1234 5678 9012|ABCDE1234F|30123456789/.test(JSON.stringify(f)),'Aadhaar, PAN and account numbers never reach the index');
f=R.readSheet({name:'Daily Non Com Report.xlsx'},[{title:'MAIN',rows:137,cols:15,sample:[['Non communicating smart meters'],['Sl','Consumer No','Meter No','Feeder'],[1,'130000018948','X1','11 kV Testpur Feeder']]},{title:'21.09.2026',rows:7,cols:15,sample:[]}]);
ok(f.doc_type==='report'&&/2 tabs: "MAIN" \(137 rows in grid\)/.test(f.summary)&&f.consumer_nos[0]==='130000018948','spreadsheet');
ok(R.toRow({id:'A',name:'a.pdf',type:'pdf'},f).length===26,'26 columns');
process.exit(bad?1:0);
