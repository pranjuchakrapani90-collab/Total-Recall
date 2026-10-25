/* Opens password-protected Excel files (bank statements) in the browser, so the password and the file never leave the phone.
   Implements Office file decryption as documented in Microsoft's MS-OFFCRYPTO:
     - Agile encryption (Excel 2010 and later): SHA-512/SHA-1 key derivation, AES-CBC in 4096-byte segments
     - Standard encryption (Excel 2007): SHA-1 key derivation, AES-ECB
   Input: the two streams of the encrypted file's container, "EncryptionInfo" and "EncryptedPackage".
   Output: the plain .xlsx bytes. WebCrypto's AES-CBC insists on padding, which Office doesn't use, so each
   ciphertext gets one extra block that decrypts to valid padding (see unpadded()). */
(function(){
"use strict";
const S=crypto.subtle,enc=new TextEncoder();
const cat=(...a)=>{const n=a.reduce((x,b)=>x+b.length,0),o=new Uint8Array(n);let p=0;a.forEach(b=>{o.set(b,p);p+=b.length;});return o;};
const le32=n=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;};
const utf16=s=>{const b=new Uint8Array(s.length*2);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);b[2*i]=c&255;b[2*i+1]=c>>8;}return b;};
const b64=s=>Uint8Array.from(atob(s.replace(/\s/g,"")),c=>c.charCodeAt(0));
const HASH={"SHA512":"SHA-512","SHA-512":"SHA-512","SHA384":"SHA-384","SHA256":"SHA-256","SHA-256":"SHA-256","SHA1":"SHA-1","SHA-1":"SHA-1"};
async function H(alg,...parts){return new Uint8Array(await S.digest(alg,cat(...parts)));}
function fit(b,len,fill){if(b.length>=len)return b.slice(0,len);const o=new Uint8Array(len).fill(fill);o.set(b);return o;}
/* AES-CBC decrypt without padding: add one block that decrypts to sixteen 0x10 bytes */
async function unpadded(keyBytes,iv,data){
  const k=await S.importKey("raw",keyBytes,{name:"AES-CBC"},false,["encrypt","decrypt"]);
  const last=data.length>=16?data.slice(data.length-16):iv,pad=new Uint8Array(16).fill(16);
  const extra=new Uint8Array(await S.encrypt({name:"AES-CBC",iv:last},k,pad)).slice(0,16);
  return new Uint8Array(await S.decrypt({name:"AES-CBC",iv},k,cat(data,extra)));}
const BAD="Wrong password for this file.";

/* the password key takes 100,000 rounds of hashing: done here synchronously, since 100,000 awaited WebCrypto calls take many seconds on a phone */
function pre(m,lenBytes,block){const L=m.length,n=Math.ceil((L+1+lenBytes)/block)*block,b=new Uint8Array(n);b.set(m);b[L]=0x80;const dv=new DataView(b.buffer);dv.setUint32(n-4,L*8>>>0);dv.setUint32(n-8,Math.floor(L*8/4294967296));return b;}
function sha1(m){const b=pre(m,8,64),dv=new DataView(b.buffer),w=new Int32Array(80);let h0=0x67452301,h1=0xefcdab89|0,h2=0x98badcfe|0,h3=0x10325476,h4=0xc3d2e1f0|0;
  for(let o=0;o<b.length;o+=64){for(let i=0;i<16;i++)w[i]=dv.getInt32(o+4*i);for(let i=16;i<80;i++){const x=w[i-3]^w[i-8]^w[i-14]^w[i-16];w[i]=x<<1|x>>>31;}
    let a=h0,bb=h1,c=h2,d=h3,e=h4;
    for(let i=0;i<80;i++){const f=i<20?(bb&c|~bb&d)+0x5a827999:i<40?(bb^c^d)+0x6ed9eba1:i<60?(bb&c|bb&d|c&d)-0x70e44324:(bb^c^d)-0x359d3e2a;
      const t=(a<<5|a>>>27)+f+e+w[i]|0;e=d;d=c;c=bb<<30|bb>>>2;bb=a;a=t;}
    h0=h0+a|0;h1=h1+bb|0;h2=h2+c|0;h3=h3+d|0;h4=h4+e|0;}
  const o=new Uint8Array(20),ov=new DataView(o.buffer);[h0,h1,h2,h3,h4].forEach((x,i)=>ov.setInt32(4*i,x));return o;}
const K5=(()=>{const k="428a2f98d728ae22 7137449123ef65cd b5c0fbcfec4d3b2f e9b5dba58189dbbc 3956c25bf348b538 59f111f1b605d019 923f82a4af194f9b ab1c5ed5da6d8118 d807aa98a3030242 12835b0145706fbe 243185be4ee4b28c 550c7dc3d5ffb4e2 72be5d74f27b896f 80deb1fe3b1696b1 9bdc06a725c71235 c19bf174cf692694 e49b69c19ef14ad2 efbe4786384f25e3 0fc19dc68b8cd5b5 240ca1cc77ac9c65 2de92c6f592b0275 4a7484aa6ea6e483 5cb0a9dcbd41fbd4 76f988da831153b5 983e5152ee66dfab a831c66d2db43210 b00327c898fb213f bf597fc7beef0ee4 c6e00bf33da88fc2 d5a79147930aa725 06ca6351e003826f 142929670a0e6e70 27b70a8546d22ffc 2e1b21385c26c926 4d2c6dfc5ac42aed 53380d139d95b3df 650a73548baf63de 766a0abb3c77b2a8 81c2c92e47edaee6 92722c851482353b a2bfe8a14cf10364 a81a664bbc423001 c24b8b70d0f89791 c76c51a30654be30 d192e819d6ef5218 d69906245565a910 f40e35855771202a 106aa07032bbd1b8 19a4c116b8d2d0c8 1e376c085141ab53 2748774cdf8eeb99 34b0bcb5e19b48a8 391c0cb3c5c95a63 4ed8aa4ae3418acb 5b9cca4f7763e373 682e6ff3d6b2b8a3 748f82ee5defb2fc 78a5636f43172f60 84c87814a1f0ab72 8cc702081a6439ec 90befffa23631e28 a4506cebde82bde9 bef9a3f7b2c67915 c67178f2e372532b ca273eceea26619c d186b8c721c0c207 eada7dd6cde0eb1e f57d4f7fee6ed178 06f067aa72176fba 0a637dc5a2c898a6 113f9804bef90dae 1b710b35131c471b 28db77f523047d84 32caab7b40c72493 3c9ebe0a15c9bebc 431d67c49c100d4c 4cc5d4becb3e42b6 597f299cfc657e2a 5fcb6fab3ad6faec 6c44198c4a475817".split(" ");
  const a=new Int32Array(160);k.forEach((x,i)=>{a[2*i]=parseInt(x.slice(0,8),16)|0;a[2*i+1]=parseInt(x.slice(8),16)|0;});return a;})();
function sha512(m){const b=pre(m,16,128),dv=new DataView(b.buffer),W=new Int32Array(160);
  const H=Int32Array.from([0x6a09e667,0xf3bcc908,0xbb67ae85,0x84caa73b,0x3c6ef372,0xfe94f82b,0xa54ff53a,0x5f1d36f1,0x510e527f,0xade682d1,0x9b05688c,0x2b3e6c1f,0x1f83d9ab,0xfb41bd6b,0x5be0cd19,0x137e2179].map(x=>x|0));
  for(let o=0;o<b.length;o+=128){for(let i=0;i<32;i++)W[i]=dv.getInt32(o+4*i);
    for(let i=16;i<80;i++){const xh=W[2*i-30],xl=W[2*i-29],yh=W[2*i-4],yl=W[2*i-3];
      const s0h=(xh>>>1|xl<<31)^(xh>>>8|xl<<24)^(xh>>>7),s0l=(xl>>>1|xh<<31)^(xl>>>8|xh<<24)^(xl>>>7|xh<<25);
      const s1h=(yh>>>19|yl<<13)^(yl>>>29|yh<<3)^(yh>>>6),s1l=(yl>>>19|yh<<13)^(yh>>>29|yl<<3)^(yl>>>6|yh<<26);
      let l=(s0l>>>0)+(s1l>>>0)+(W[2*i-13]>>>0)+(W[2*i-31]>>>0),h=s0h+s1h+W[2*i-14]+W[2*i-32]+Math.floor(l/4294967296);W[2*i]=h|0;W[2*i+1]=l|0;}
    let [ah,al,bh,bl,ch,cl,dh,dl,eh,el,fh,fl,gh,gl,hh,hl]=H;
    for(let i=0;i<80;i++){const S1h=(eh>>>14|el<<18)^(eh>>>18|el<<14)^(el>>>9|eh<<23),S1l=(el>>>14|eh<<18)^(el>>>18|eh<<14)^(eh>>>9|el<<23);
      const chh=eh&fh^~eh&gh,chl=el&fl^~el&gl;
      let l=(hl>>>0)+(S1l>>>0)+(chl>>>0)+(K5[2*i+1]>>>0)+(W[2*i+1]>>>0),t1h=hh+S1h+chh+K5[2*i]+W[2*i]+Math.floor(l/4294967296)|0,t1l=l|0;
      const S0h=(ah>>>28|al<<4)^(al>>>2|ah<<30)^(al>>>7|ah<<25),S0l=(al>>>28|ah<<4)^(ah>>>2|al<<30)^(ah>>>7|al<<25);
      const mjh=ah&bh^ah&ch^bh&ch,mjl=al&bl^al&cl^bl&cl;
      l=(S0l>>>0)+(mjl>>>0);const t2h=S0h+mjh+Math.floor(l/4294967296)|0,t2l=l|0;
      hh=gh;hl=gl;gh=fh;gl=fl;fh=eh;fl=el;l=(dl>>>0)+(t1l>>>0);eh=dh+t1h+Math.floor(l/4294967296)|0;el=l|0;
      dh=ch;dl=cl;ch=bh;cl=bl;bh=ah;bl=al;l=(t1l>>>0)+(t2l>>>0);ah=t1h+t2h+Math.floor(l/4294967296)|0;al=l|0;}
    [ah,al,bh,bl,ch,cl,dh,dl,eh,el,fh,fl,gh,gl,hh,hl].forEach((x,i)=>{if(i%2){const l=(H[i]>>>0)+(x>>>0);H[i-1]=H[i-1]+Math.floor(l/4294967296)|0;H[i]=l|0;}else H[i]=H[i]+x|0;});}
  const o=new Uint8Array(64),ov=new DataView(o.buffer);H.forEach((x,i)=>ov.setInt32(4*i,x));return o;}
const SYNC={"SHA-1":sha1,"SHA-512":sha512};
async function spinHash(alg,salt,password,spin){const f=SYNC[alg];let h=f?f(cat(salt,utf16(password))):await H(alg,salt,utf16(password));
  const buf=new Uint8Array(4+h.length),dv=new DataView(buf.buffer);
  for(let i=0;i<spin;i++){if(f){dv.setUint32(0,i,true);buf.set(h,4);h=f(buf);}else h=await H(alg,le32(i),h);}
  return h;}

/* ---------- agile ---------- */
async function agile(info,pkg,password){
  const xml=new TextDecoder().decode(info.slice(8)),doc=new DOMParser().parseFromString(xml.slice(xml.indexOf("<")),"application/xml");
  const kd=doc.getElementsByTagName("keyData")[0],ek=[...doc.getElementsByTagName("*")].find(e=>e.localName==="encryptedKey"&&e.getAttribute("spinCount"));
  if(!kd||!ek)throw new Error("This file uses a kind of protection the app can't open (no password key).");
  const g=(e,a)=>e.getAttribute(a);
  const pAlg=HASH[g(ek,"hashAlgorithm")],spin=+g(ek,"spinCount"),pSalt=b64(g(ek,"saltValue")),pBits=+g(ek,"keyBits");
  const h=await spinHash(pAlg,pSalt,password,spin);
  const keyFor=async blk=>fit(await H(pAlg,h,new Uint8Array(blk)),pBits/8,0x36);
  const [kVi,kVh,kK]=await Promise.all([keyFor([0xfe,0xa7,0xd2,0x76,0x3b,0x4b,0x9e,0x79]),keyFor([0xd7,0xaa,0x0f,0x6d,0x30,0x61,0x34,0x4e]),keyFor([0x14,0x6e,0x0b,0xe7,0xab,0xac,0xd0,0xd6])]);
  const vIn=await unpadded(kVi,pSalt,b64(g(ek,"encryptedVerifierHashInput"))),vH=await unpadded(kVh,pSalt,b64(g(ek,"encryptedVerifierHashValue")));
  const want=await H(pAlg,vIn.slice(0,pSalt.length));
  if(!want.every((x,i)=>x===vH[i]))throw new Error(BAD);
  const secret=(await unpadded(kK,pSalt,b64(g(ek,"encryptedKeyValue")))).slice(0,+g(kd,"keyBits")/8);
  const dAlg=HASH[g(kd,"hashAlgorithm")],dSalt=b64(g(kd,"saltValue")),bs=+g(kd,"blockSize")||16;
  const size=Number(new DataView(pkg.buffer,pkg.byteOffset,8).getBigUint64(0,true)),body=pkg.slice(8),parts=[];
  for(let off=0,i=0;off<body.length;off+=4096,i++){let seg=body.slice(off,off+4096);if(seg.length%16)seg=seg.slice(0,seg.length-seg.length%16);if(!seg.length)break;
    parts.push(await unpadded(secret,fit(await H(dAlg,dSalt,le32(i)),bs,0x36),seg));}
  return cat(...parts).slice(0,size);}

/* ---------- standard (Excel 2007) ---------- */
async function standard(info,pkg,password){
  const dv=new DataView(info.buffer,info.byteOffset,info.byteLength),hsz=dv.getUint32(8,true),hdr=12;
  const keyBits=dv.getUint32(hdr+16,true)||128,v=hdr+hsz,saltSize=dv.getUint32(v,true);
  const salt=info.slice(v+4,v+4+saltSize),eVer=info.slice(v+4+saltSize,v+20+saltSize),eHash=info.slice(v+24+saltSize,v+56+saltSize);
  const h=await spinHash("SHA-1",salt,password,50000);
  const hf=await H("SHA-1",h,le32(0)),x=b=>{const o=new Uint8Array(64).fill(b);hf.forEach((c,i)=>o[i]^=c);return o;};
  const key=cat(await H("SHA-1",x(0x36)),await H("SHA-1",x(0x5c))).slice(0,keyBits/8);
  /* AES-ECB = AES-CBC on one block at a time with a zero IV */
  const zero=new Uint8Array(16),ecb=async d=>{const o=new Uint8Array(d.length);for(let p=0;p+16<=d.length;p+=16)o.set(await unpadded(key,zero,d.slice(p,p+16)),p);return o;};
  const ver=await ecb(eVer),vh=await ecb(eHash),want=await H("SHA-1",ver);
  if(!want.every((c,i)=>c===vh[i]))throw new Error(BAD);
  const size=Number(new DataView(pkg.buffer,pkg.byteOffset,8).getBigUint64(0,true));
  const body=pkg.slice(8);return (await ecb(body.slice(0,body.length-body.length%16))).slice(0,size);}

async function decrypt(info,pkg,password){
  info=new Uint8Array(info);pkg=new Uint8Array(pkg);
  const major=info[0]|info[1]<<8,minor=info[2]|info[3]<<8;
  if(major===4&&minor===4)return agile(info,pkg,password);
  if((major===3||major===4)&&minor===2)return standard(info,pkg,password);
  throw new Error("This file uses an old kind of protection the app can't open. Open it in Excel and save it without a password.");}
window.OfficeDecrypt={decrypt,sha1,sha512};
})();
