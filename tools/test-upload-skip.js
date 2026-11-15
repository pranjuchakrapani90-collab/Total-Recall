/* Checks the Drive Sync page's "is this file already in Drive?" test (sync.html, inDrive).
   Run:  node tools/test-upload-skip.js
   The point of these cases: after the Vault clean-up moves duplicate copies to Drive's bin, uploading the same
   phone folder again must NOT bring them back, while a file the owner binned himself must still be uploadable. */
const src=require('fs').readFileSync('__dirname+'/../sync.html'','utf8');
const fn=src.match(/async function inDrive\(f\)\{[\s\S]*?\n    return !x\.trashed[^\n]*\n/)[0];
let drive=[],seenQ='';const API='x';
const g=async u=>{seenQ=decodeURIComponent(u.split('&q=')[1]);return {ok:true,json:async()=>({files:drive})}};
const gerr=async()=>new Error('x');
eval(fn);
(async()=>{let bad=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)bad++};
 drive=[{id:'1',size:'100',trashed:false}];
 ok(await inDrive({name:'bill.pdf',size:100}),'a live file of the same name and size is recognised');
 ok(seenQ.indexOf('trashed=false')<0,'the query no longer hides what is in the bin');
 drive=[{id:'1',size:'100',trashed:true,appProperties:{posDup:'k1'}}];
 ok(await inDrive({name:'bill.pdf',size:100}),'a copy the clean-up binned counts as already in Drive');
 drive=[{id:'1',size:'100',trashed:true}];
 ok(!await inDrive({name:'bill.pdf',size:100}),'a file you binned yourself can still be uploaded again');
 drive=[{id:'1',size:'999',trashed:true,appProperties:{posDup:'k1'}}];
 ok(!await inDrive({name:'bill.pdf',size:100}),'a different size is not a match');
 drive=[];ok(!await inDrive({name:'new.pdf',size:5}),'a genuinely new file is uploaded');
 process.exit(bad?1:0)})();
