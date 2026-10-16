/* ================= ART v2: ramps, hand-authored maps, shaded blobs ================= */
const K='#2a1e33', SHADOW='rgba(42,30,51,.26)';
function hexToHsl(hex){const n=parseInt(hex.slice(1),16);let r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}return[h*360,s,l]}
function hslToHex(h,s,l){h=((h%360)+360)%360/360;s=clamp(s,0,1);l=clamp(l,0,1);const f=(n)=>{const k=(n+h*12)%12;const a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return'#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}
// hue-shifted ramp: lights drift toward yellow, shadows toward violet
function rampOf(hex){return[hshift(hex,.12,-8,-.03),hex,hshift(hex,-.13,10,.05),hshift(hex,-.26,18,.08)]}
function mix(a,b,k){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);const ch=(s)=>Math.round(((A>>s)&255)*(1-k)+((B>>s)&255)*k);return'#'+[16,8,0].map(s=>ch(s).toString(16).padStart(2,'0')).join('')}
function hshift(hex,dl,dh=0,ds=0){const[h,s,l]=hexToHsl(hex);return hslToHex(h+dh,s+ds,l+dl)}
const lite=(c,a=.12)=>hshift(c,a,-8,-.03), dark=(c,a=.13)=>hshift(c,-a,10,.05);
function pm(rows,pal){const W=Math.max(...rows.map(r=>r.length)),H=rows.length;const[c,x]=mk(W,H);stamp(x,rows,pal,0,0);return c}
function stamp(x,rows,pal,ox,oy){for(let j=0;j<rows.length;j++){const r=rows[j];for(let i=0;i<r.length;i++){const ch=r[i];if(ch==='.'||ch===' ')continue;const col=pal[ch];if(col){x.fillStyle=col;x.fillRect(ox+i,oy+j,1,1)}}}}
function hash2(x,y,s=0){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296}
function vnoise(x,y,sc,s=0){x/=sc;y/=sc;const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
// shaded cluster blobs (tree canopies, bushes, rocks): ramp = [outline, deep, dark, mid, light, highlight]
function blobs(w,h,cl,ramp,o={}){const[c,x]=mk(w,h);const idx=new Int16Array(w*h).fill(-1),val=new Float32Array(w*h);const L=[-.62,-.78];
  cl.forEach((b,ci)=>{const ry=b.ry||b.r;for(let y=Math.max(0,Math.floor(b.y-ry));y<Math.min(h,Math.ceil(b.y+ry));y++)for(let xx=Math.max(0,Math.floor(b.x-b.r));xx<Math.min(w,Math.ceil(b.x+b.r));xx++){const dx=(xx+.5-b.x)/b.r,dy=(y+.5-b.y)/ry;const d2=dx*dx+dy*dy;if(d2>1)continue;const nz=Math.sqrt(1-d2);let s=dx*L[0]+dy*L[1]+nz*.35-.18;s+=(b.lift||0)-(y/h)*(o.vgrad||.5)+(o.bias||0);s+=(hash2(xx,y,o.seed||1)-.5)*(o.noise??.22);idx[y*w+xx]=ci;val[y*w+xx]=s}});
  const th=o.th||[.5,.18,-.18,-.5];
  for(let i=0;i<w*h;i++){if(idx[i]<0)continue;const s=val[i];const col=s>th[0]?ramp[5]:s>th[1]?ramp[4]:s>th[2]?ramp[3]:s>th[3]?ramp[2]:ramp[1];x.fillStyle=col;x.fillRect(i%w,i/w|0,1,1)}
  // separation: where a front cluster sits over a back one, darken the back pixel just outside the front edge (below/right)
  for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=y*w+xx;if(idx[i]<0)continue;const up=idx[i-w],lf=idx[i-1];if((up>idx[i]&&up>=0)||(lf>idx[i]&&lf>=0)){x.fillStyle=ramp[1];x.fillRect(xx,y,1,1)}}
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=y*w+xx;if(idx[i]<0)continue;const e=(xx===0||idx[i-1]<0)||(xx===w-1||idx[i+1]<0)||(y===0||idx[i-w]<0)||(y===h-1||idx[i+w]<0);if(e){x.fillStyle=ramp[0];x.fillRect(xx,y,1,1)}}
  return c}

/* ---------- palette ---------- */
const PAL={
  grass:['#2f5a3c','#447c49','#5b9a52','#6cad5b','#82c066','#a6d77a'],
  leaf:['#24442f','#2f5b3a','#3f7a45','#579a4f','#79b85a','#a7d872'],
  blossom:['#6b2f4a','#9a4a68','#c56a86','#e597aa','#f6bccb','#fde4ea'],
  autumn:['#5a2e22','#8a4a2a','#b8692f','#dd9440','#f2bc5c','#fbe08a'],
  stone:['#3e3a52','#5c5873','#7c7894','#9d9ab3','#c1bfd2','#e4e2ee'],
  dirt:['#5a3d2c','#7d573d','#a3774f','#c39a6b','#dcbb88','#efd9ad'],
  wood:['#4a2e28','#6b4433','#8f5f43','#b27b52','#d19c68','#ecc48e'],
  water:['#244a72','#2f6596','#3f86bd','#5ea9d8','#8fd0ea','#d6f2f8'],
};

/* ---------- characters (16x24) ---------- */
const SW=16,SH=26,SPAD=2; // 2px headroom for crowns/halos
const SKIN_R=[['#ffeadb','#f9d4b6','#e2ad8c','#c98f72'],['#fadab9','#eebb90','#cf946c','#b17656'],['#eec499','#d6a271','#b47b53','#94603f'],['#d39a70','#b98057','#91603f','#734a30'],['#a9734f','#8e5e3f','#6c452e','#553424'],['#83573b','#684433','#4d3125','#3a241b']];
// heads: rows y1..y12, ears at y7-8 (down/up)
const HEAD_D=['....kkkkkkkk....','..kkSSSSSSSSkk..','.kSssSSSSSSSSSk.','.ksSSSSSSSSSSSk.','.kSSSSSSSSSSSSk.','.kSSSSSSSSSSStk.','ktSSSSSSSSSSSStk','ktSSSSSSSSSSSStk','.kSSSSSSSSSSStk.','..ktSSSSSSSStk..','...kkttttttkk...','.....kkkkkk.....'];
const HEAD_S=['....kkkkkkkk....','..kkSSSSSSSSkk..','.kSssSSSSSSSSSk.','.ksSSSSSSSSSSSk.','.kSSSSSSSSSSSSk.','.kSSSSSSSSSSStk.','.kSSSSSSSSSSStk.','kSSSSSSSSSSSStk.','.kSSSSSSSSSSStk.','..ktSSSSSSSStk..','...kkttttttkk...','.....kkkkkk.....'];
// torso rows y12..y18 (bobs with head), legs rows y19..y23 per frame
const TORSO_D=['...kkCCCCCCkk...','..kdCCCSSCCCck..','.kddkdCCCCCkcck.','.kddkCCCCCCkcck.','.ksSkCCCCCCkStk.','.kkkkcccccckkkk.','....kLLLLLLk....'];
const TORSO_U=['...kkCCCCCCkk...','..kdCCCCCCCCck..','.kddkdCCCCCkcck.','.kddkCCCCCCkcck.','.ksSkCCCCCCkStk.','.kkkkcccccckkkk.','....kLLLLLLk....'];
const LEGS_D=[['....kPPPPppk....','....kPPkkppk....','....kPPkkppk....','....kBbkkBbk....','....kkkkkkkk....'],
              ['....kPPPPppk....','....kPPkkppk....','....kBbkkppk....','....kkkkkBbk....','........kkkk....'],
              ['....kPPPPppk....','....kPPkkppk....','....kPPkkBbk....','....kBbkkkkk....','....kkkk........']];
const TORSO_S=['.....kkCCCk.....','....kCCCCCCk....','....kCCCCCck....','....kCCCCCck....','....kCCCCCck....','....kcccccck....','....kLLLLLLk....'];
const LEGS_S=[['.....kPPPPk.....','.....kPPpk......','.....kPPpk......','....kBBbbk......','....kkkkkk......'],
              ['.....kPPPPk.....','....kPPkkPPk....','...kPPk..kppk...','..kBBbk..kBbk...','..kkkkk...kkk...'],
              ['.....kPPPPk.....','....kppkkPPk....','...kppk..kPPk...','..kBbbk..kBBk...','..kkkkk...kkk...']];
const ARM_S=['kdk','kdk','kdk','ksk','kkk'];
const HAIR={ // [down, up, side, backDown]
 0:[['.....kk.kk......','...kkHkkiHkk....','..kHHHiiiHHHkk..','.kHHiijiHHHHHhk.','.kHiiHHHHHHHHhk.','.kHHHHHHhHHHhhk.','.khHhHHhHHhHhhk.','..kh.h..h..h.hk.','..kh........hk..'],
    ['.....kk.kk......','...kkHkkiHkk....','..kHHHiiiHHHkk..','.kHHiijiiHHHHhk.','.kHiiHHiHHHHHhk.','.kHHHhHHHHhHHhk.','.kHhHHHhHHHHhhk.','kthHHhHHHhHHhhtk','kthhHHhHHhHhhhtk','.khhhhhhhhhhhhk.'],
    ['......kk.kk.....','....kkHkkiHkk...','...kHHHiiiHHHk..','..kHHiijiHHHHhk.','.kHiiHHHHHHHHhk.','.kHHHHHHHHHhHhk.','.khH.hHHHHHhHhk.','.kh...kHHHhHhhk.','......khHHhHhhk.','.......khhhhhhk.','........kkkkk...']],
 1:[['....kkkkkkkk....','..kkHHiiiiHHkk..','.kHHijjiiHHHHhk.','kHHiiHHHHHHHHHhk','kHHHHHHHHHHHHhhk','kHHHHHHHHHHHHhhk','khHhhhhhhhhhhhhk','kHh..........hhk','kHh..........hhk','kHh..........hhk','khhk........khhk','.kk..........kk.'],
    ['....kkkkkkkk....','..kkHHiiiiHHkk..','.kHHijjiiHHHHhk.','kHHiiHHHHHHHHHhk','kHHHHHHHHHHHHhhk','kHHHhHHHHHhHHhhk','kHHHhHHHHHhHHhhk','kHHhHHHHhHHHHhhk','kHHhHHHHhHHHhhhk','khHhHHHhHHHhhhhk','khhhhhhhhhhhhhhk','.kkkkkkkkkkkkkk.'],
    ['.....kkkkkk.....','...kkHiiiHHkk...','..kHijjiHHHHHk..','.kHiiHHHHHHHHhk.','.kHHHHHHHHHHHhhk','.khhhhHHHHHHHhhk','.k....kHHHhHHhhk','......kHHHhHHhhk','......kHHhHHHhhk','......kHhHHHhhhk','......khhhhhhhhk','.......kkkkkkkk.']],
 2:[['...k..kk..k..k..','..kHk.kHkkHkkHk.','.kHiHkHiHHiHHHk.','.kHiiHHiHHHHHhk.','kHHHHHHHHHHHHhhk','khHHhHHHhHHHhhhk','.khHk.hHk.hHkhk.'],
    ['...k..kk..k..k..','..kHk.kHkkHkkHk.','.kHiHkHiHHiHHHk.','.kHiiHHiHHHHHhk.','kHHHHHHHHHHHHhhk','kHHHhHHHHhHHHhhk','kHHhHHHhHHHhHhhk','kthHHhHHHhHHhhtk','kthhHhhHhhHhhhtk','.khhkhhkhhkhhk..'],
    ['....k..kk..k....','...kHk.kHkkHk...','..kHiHkHiHHiHk..','.kHiiHHiHHHHHk..','.kHHHHHHHHHHHhk.','.khhHHHhHHHHhhk.','.k..khHHhHHHhhk.','......kHHhHHhhk.','.......khhkhhk..']],
 3:[['....kkkkkkkk....','..kkHHiiiHHHkk..','.kHHijjiHHHHHhk.','kHHiiHHHkHHHHHhk','kHHHHHHkhHHHHhhk','kHHHHHkh.hHHHhhk','kHHHhkh...hhHhhk','kHHh.........hhk','kHh..........hHk','kHh..........hHk','kHh..........hHk','kHh..........hHk','khh..........hhk'],
    ['....kkkkkkkk....','..kkHHiiiHHHkk..','.kHHijjiHHHHHhk.','kHHiiHHHHHHHHHhk','kHHHHHHHHHHHHhhk','kHHHHHHHHHHHHhhk','kHHHHHhHHHHHHhhk','kHHHHHhHHHHHhhhk','kHHHHhHHHHHHhhhk','kHHHHhHHHHHhhhhk','khHHHhHHHHHhhhhk','khHHHhHHHHhhhhhk','.khHHhHHHHhhhhk.','.khHHHhHHHhhhhk.','.khhHHhHHhhhhhk.','..khhHhHhhhhhk..','...khhhhhhhhk...','....kkkkkkkk....'],
    ['.....kkkkkk.....','...kkHiiiHHkk...','..kHijjiHHHHHk..','.kHiiHHHHHHHHhk.','.kHHHHHHHHHHHhhk','.khhhHHHHHHHHhhk','.k...hkHHHHHHhhk','......kHHHHHhhhk','......kHHHHHhhhk','......kHHHHhhhhk','.......kHHHhhhk.','.......kHHHhhhk.','.......khHHhhhk.','.......khHHhhk..','........khHhhk..','........khhhk...','.........kkk....'],
    ['................','................','................','................','................','kHk..........kHk','kHHk........kHhk','kHHk........kHhk','kHHk........kHhk','kHHk........kHhk','kHHk........kHhk','kHHk........kHhk','.kHHk......kHhk.','.kHHk......kHhk.','.khhk......khhk.','..kk........kk..']],
 4:[['......kkkk......','.....kHijHk.....','...kkkhHHhkkk...','.kkHHHiiiHHHHkk.','.kHHiijiHHHHHhk.','.kHhHHHHHHHHhhk.','.khh........hhk.','..kh........hk..'],
    ['......kkkk......','.....kHijHk.....','...kkkhHHhkkk...','.kkHHHiiiHHHHkk.','.kHHiijiHHHHHhk.','.kHhHHHhHHHhHhk.','.kHHhHHHhHHHhhk.','kthHHhHHHhHHhhtk','kthhHHhHHhHhhhtk','.khhhhhhhhhhhhk.'],
    ['.......kkkk.....','......kHijHk....','....kkkhHHhkk...','..kHHHiiiHHHHk..','.kHHiijiHHHHHhk.','.khH..hHHHHHHhk.','.k....kHHHHHhhk.','......kHHHHhhhk.','.......khhhhhk..']],
 5:[['...kkkkkkkkkk...','..kHiHHiHHiHHk..','.kHiijHiijHiHHk.','kHHiiHhHiiHhHHhk','kHhHHhHHhHHhHhhk','khHhHHhHhHHhHhhk','kHhhh.hh.hh.hhHk','kHh..........hHk','khh..........hhk','.kk..........kk.'],
    ['...kkkkkkkkkk...','..kHiHHiHHiHHk..','.kHiijHiijHiHHk.','kHHiiHhHiiHhHHhk','kHhHHhHHhHHhHhhk','kHhHHhHHhHHhHhhk','kHHiHHhHiHHhHHhk','khHhHHhHhHHhHhhk','kHhHHhHHhHHhHhhk','khhhhhhhhhhhhhhk','.kkkkkkkkkkkkkk.'],
    ['....kkkkkkkkk...','...kHiHHiHHiHk..','..kHiijHiijHHHk.','.kHiiHhHiiHhHHhk','.kHhHHhHHhHHhHhk','.khhH..hHHhHHhhk','.k....khHHhHHhhk','......kHhHHhHhhk','......khHhHHhhhk','.......khhhhhhk.','........kkkkkk..']]
};
const HAIRSTYLE=['Tousled','Bob','Spiky','Long','Top bun','Curly'];
const SHOES=['#3d2c3c','#6b4433','#e9675a','#f4efe4','#3f6fb0','#2f3346'];
function hairRamp(t,y){let b=t.hair;if(b==='prism'){b=['#ff8a7a','#ffcf5a','#86e0c4','#7cb8ff','#c9a2ff'][((y>>1)%5+5)%5]}const r=rampOf(b);return{H:b,h:r[2],i:r[0],j:hshift(b,.26,-14,-.06)}}
function stampHair(x,t,rows,ox,oy){for(let j=0;j<rows.length;j++){const pal=Object.assign({k:K},hairRamp(t,oy+j));stamp(x,[rows[j]],pal,ox,oy+j)}}
function drawRes(c,t,dir,f,ox,oy){
  const sk=SKIN_R[SKINS.indexOf(t.skin)]||SKIN_R[0];const cr=rampOf(t.shirt),pr=rampOf(t.pants);
  const shoe=SHOES[(t.id*7+3)%SHOES.length],shr=rampOf(shoe);
  const pal={k:K,S:sk[1],s:sk[0],t:sk[2],C:t.shirt,d:cr[0],c:cr[2],P:t.pants,p:pr[2],B:shoe,b:shr[0],L:'#4a3330'};
  const side=dir==='left',up=dir==='up';const H=HAIR[t.hs];
  const yb=oy+(f===0?0:1); // body bob on stepping frames
  if(H[3]&&!side&&!up)stampHair(c,t,H[3],ox,yb);
  // legs
  stamp(c,(side?LEGS_S:LEGS_D)[f],pal,ox,oy+19);
  // torso
  const tp=Object.assign({},pal);
  if(t.pat===2){tp.C=t.pants;tp.c=pr[2]}
  if(side){stamp(c,TORSO_S,tp,ox,yb+12)}else stamp(c,up?TORSO_U:TORSO_D,tp,ox,yb+12);
  // outfit details
  const Y=yb;
  if(!side){
    if(t.pat===1){R(c,ox+5,Y+15,6,1,cr[2]);R(c,ox+5,Y+17,6,1,cr[3]);R(c,ox+2,Y+15,2,1,cr[2]);R(c,ox+12,Y+15,2,1,cr[3])}
    if(t.pat===2){// overalls: shirt shoulders/sleeves, bib + straps
      R(c,ox+5,Y+12,6,2,t.shirt);if(!up)P(c,ox+7,Y+13,sk[1]),P(c,ox+8,Y+13,sk[1]);R(c,ox+2,Y+14,2,2,cr[0]);R(c,ox+12,Y+14,2,2,cr[2]);
      P(c,ox+5,Y+13,pr[2]);P(c,ox+10,Y+13,pr[2]);if(!up){R(c,ox+6,Y+14,4,3,pr[0]);P(c,ox+6,Y+14,'#ffd65a');P(c,ox+9,Y+14,'#ffd65a');R(c,ox+7,Y+15,2,1,pr[2])}else{P(c,ox+6,Y+14,pr[2]);P(c,ox+9,Y+14,pr[2]);P(c,ox+7,Y+15,pr[2]);P(c,ox+8,Y+15,pr[2])}}
    if(t.pat===3){// hoodie
      if(!up){R(c,ox+5,Y+12,6,1,cr[2]);P(c,ox+4,Y+13,cr[2]);P(c,ox+11,Y+13,cr[2]);P(c,ox+6,Y+14,'#fbf1dc');P(c,ox+9,Y+14,'#fbf1dc');P(c,ox+6,Y+15,'#fbf1dc');P(c,ox+9,Y+15,'#fbf1dc');R(c,ox+6,Y+16,4,1,cr[2]);P(c,ox+5,Y+16,cr[3]);P(c,ox+10,Y+16,cr[3])}
      else{R(c,ox+4,Y+12,8,3,cr[2]);R(c,ox+5,Y+12,6,2,cr[1]);R(c,ox+5,Y+12,6,1,cr[0])}}
    if(t.pat===0&&!up){P(c,ox+6,Y+13,cr[0]);P(c,ox+9,Y+13,cr[0])}
  }else{
    if(t.pat===1){R(c,ox+5,Y+14,6,1,cr[2]);R(c,ox+5,Y+16,6,1,cr[2])}
    if(t.pat===2){R(c,ox+5,Y+12,6,2,t.shirt);R(c,ox+6,Y+14,3,3,pr[0]);P(c,ox+6,Y+14,'#ffd65a')}
    if(t.pat===3){R(c,ox+8,Y+12,3,3,cr[2]);R(c,ox+9,Y+12,2,2,cr[1])}
  }
  if(side){const ax=f===0?7:f===1?5:9;const ap=Object.assign({},pal,{d:t.pat===2?t.shirt:(f===2?cr[2]:cr[0])});stamp(c,ARM_S,ap,ox+ax-1,Y+13)}
  // head + face
  stamp(c,side?HEAD_S:HEAD_D,pal,ox,Y+1);
  if(!up){
    const W='#ffffff',iris=['#5a3a2a','#3f6fb0','#3f7a45','#7a52a0'][(t.id*3)%4];
    const eye=(x,y,flip)=>{const e=t.eyes;
      if(e===0){R(c,ox+x,Y+y,1,2,K)}
      else if(e===1){R(c,ox+x,Y+y,2,2,K);P(c,ox+x,Y+y,W);P(c,ox+x+1,Y+y+1,iris)}
      else if(e===2){P(c,ox+x,Y+y+1,K);P(c,ox+x+1,Y+y,K);P(c,ox+x+2,Y+y+1,K)}
      else if(e===3){R(c,ox+x,Y+y+1,2,1,K);P(c,ox+(flip?x+2:x-1),Y+y,K)}
      else{R(c,ox+x,Y+y-1,2,3,K);P(c,ox+x,Y+y-1,W);P(c,ox+x+1,Y+y,iris);P(c,ox+x,Y+y+1,iris);P(c,ox+x+1,Y+y+1,hshift(iris,.15))}};
    const mc='#9a3e4c',blush=mix(sk[1],'#ff6f6f',.32);
    if(side){eye(t.eyes===2?2:3,7,false);P(c,ox+5,Y+9,blush);P(c,ox+6,Y+9,blush);
      if(t.mouth===2){P(c,ox+3,Y+10,K);P(c,ox+4,Y+10,mc)}else if(t.mouth===3){P(c,ox+3,Y+10,K);P(c,ox+4,Y+10,W)}else P(c,ox+3,Y+10,K)}
    else{
      const lx=t.eyes===2?3:4,rx=t.eyes===2?9:10;eye(lx,7,false);eye(t.eyes===0?11:rx,7,true);if(t.eyes===0){P(c,ox+4,Y+7,sk[1]);}
      if(t.eyes===0){R(c,ox+5,Y+7,0,0,K)}
      R(c,ox+3,Y+9,2,1,blush);R(c,ox+11,Y+9,2,1,blush);
      const m=t.mouth;
      if(m===0){P(c,ox+6,Y+9,sk[2]);R(c,ox+7,Y+10,2,1,mc);P(c,ox+9,Y+9,sk[2])}
      else if(m===1){R(c,ox+7,Y+10,2,1,K)}
      else if(m===2){R(c,ox+7,Y+9,2,1,K);R(c,ox+7,Y+10,2,1,mc)}
      else{R(c,ox+6,Y+9,4,1,K);R(c,ox+7,Y+10,2,1,W);P(c,ox+6,Y+10,K);P(c,ox+9,Y+10,K)}}
  }
  stampHair(c,t,side?H[2]:up?H[1]:H[0],ox,Y);
  // accessories
  const acc=(a)=>{const S=side;
    if(a===1&&!up){const fr='#3a2c48',gl='#cfeef6';if(S){stamp(c,['kkkk','kggk','kkkkkkk'],{k:fr,g:gl},ox+1,Y+6)}else{stamp(c,['.kkkk..kkkk.','.kgGk..kgGk.','.kkkkkkkkkk.'],{k:fr,g:gl,G:'#9fd6ea'},ox+2,Y+6)}}
    if(a===2){const cc='#e9675a',r2=rampOf(cc);if(S){stamp(c,['....kkkkkkk.....','...kdCCCCCCk....','..kdCCCWCCCck...','.kCCCCCCCCCck...','kccccccccccccck.'],{k:K,C:cc,d:r2[0],c:r2[2],W:'#ffffff'},ox,Y)}else if(up){stamp(c,['...kkkkkkkkk....','..kdCCCCCCCCk...','.kdCCCCCCCCCck..','.kCCCCCCCCCCck..','.kcccckkkkccck..'],{k:K,C:cc,d:r2[0],c:r2[2]},ox,Y)}else{stamp(c,['...kkkkkkkkk....','..kdCCCCCCCCk...','.kdCCCCWWCCCck..','.kCCCCCCCCCCck..','kccccccccccccck.','.kkkkkkkkkkkkk..'],{k:K,C:cc,d:r2[0],c:r2[2],W:'#ffffff'},ox,Y)}}
    if(a===3){R(c,ox+2,Y+5,12,1,'#ffcf4a');R(c,ox+2,Y+6,12,1,'#d9a53a');if(!up&&!S){P(c,ox+12,Y+4,'#ffcf4a');P(c,ox+13,Y+4,'#d9a53a')}}
    if(a===4){const hb='#3a3346',cup='#7fdcc0';R(c,ox+3,Y+1,10,1,hb);R(c,ox+2,Y+2,1,2,hb);R(c,ox+13,Y+2,1,2,hb);if(S){stamp(c,['kkk','kAk','kak','kkk'],{k:hb,a:cup,A:'#c9f5e6'},ox+9,Y+6)}else if(!up){stamp(c,['kk','ka','kA','kk'],{k:hb,a:cup,A:'#c9f5e6'},ox,Y+6);stamp(c,['kk','ak','Ak','kk'],{k:hb,a:cup,A:'#c9f5e6'},ox+14,Y+6)}else{stamp(c,['kk','ak','ak','kk'],{k:hb,a:cup},ox,Y+6);stamp(c,['kk','ka','ka','kk'],{k:hb,a:cup},ox+14,Y+6)}}
    if(a===5&&!up){stamp(c,['.pp.','pyYp','pYyp','.pp.'],{p:'#f37aa8',y:'#ffe27a',Y:'#fff6c0'},ox+(S?8:10),Y+2)}
    if(a===6&&!up){stamp(c,['..y..','.yYy.','yYWYy','.yYy.','..y..'],{y:'#e8b23a',Y:'#ffd84a',W:'#fffbe6'},ox+(S?2:2),Y+2)}
    if(a===7){const v='#5b9be0',vr=rampOf(v);stamp(c,['..kkkkkkkkkkk...','.kVVVVVVVVVVVVk.'],{k:K,V:v},ox,Y+3);if(!up&&!S)stamp(c,['.kvvvvvvvvvvvvk.','..kkkkkkkkkkkk..'],{k:K,v:vr[2]},ox,Y+5);if(S&&!up)stamp(c,['kvvvvk','.kkkk.'],{k:K,v:vr[2]},ox-1,Y+5)}
    if(a===8){const bc='#7fdcc0',br=rampOf(bc);stamp(c,['......kk........','.....kWWk.......','...kkkWWkkkk....','..kBbBbBbBbBk...','.kBbBbBbBbBbBk..','.kdddddddddddk..'],{k:K,W:'#fbf1dc',B:bc,b:br[2],d:br[3]},ox+(S?0:1),Y-1)}
    if(a===9){stamp(c,['..k...k...k..','.kYk.kYk.kYk.','.kyykyyykyyk.','.kyyyyryyyyk.','.kYYYYYYYYYk.','.kkkkkkkkkkk.'],{k:'#6b4a1a',y:'#ffd24d',Y:'#fff0a0',r:'#e04a6a'},ox+1,Y-2)}
    if(a===10){stamp(c,['...hHHHHHHh...','..H........H..','...hHHHHHHh...'],{h:'#ffe27a',H:'#fff6c0'},ox+1,Y-2)}};
  acc(t.acc2);acc(t.acc);
}
const sheetCache=new Map();
function sheet(id){if(sheetCache.has(id))return sheetCache.get(id);const t=traits(id);const[c,x]=mk(SW*3,SH*4);
  ['down','up','left'].forEach((d,row)=>{for(let f=0;f<3;f++)drawRes(x,t,d,f,f*SW,row*SH+SPAD)});
  for(let f=0;f<3;f++){x.save();x.translate((f+1)*SW,3*SH);x.scale(-1,1);x.drawImage(c,f*SW,2*SH,SW,SH,0,0,SW,SH);x.restore()}
  sheetCache.set(id,c);return c}
const DIRROW={down:0,up:1,left:2,right:3};

/* ---------- card art (64x64) ---------- */
const cardCache=new Map();
function cardArt(id){if(cardCache.has(id))return cardCache.get(id);const t=traits(id);const[c,x]=mk(64,64);const r=rng(id*31+9);const isG=id<=SUPPLY;const rar=isG?t.rar:-1;
  const sky={0:['#bfe3fb','#9fd0f2','#86c0ea'],1:['#c8f2e2','#96e2c8','#6fcfb0'],2:['#5a4a9a','#4a3a86','#3a2c70'],3:['#fff1b8','#ffd770','#f7b83e'],[-1]:['#e4dcf2','#d4c8ea','#c4b6e0']}[rar];
  for(let y=0;y<64;y++)R(x,0,y,64,1,y<18?sky[0]:y<36?sky[1]:sky[2]);
  for(let y=16;y<20;y++)for(let xx=0;xx<64;xx++)if((xx+y)%2===0)P(x,xx,y,sky[1]);for(let y=34;y<38;y++)for(let xx=0;xx<64;xx++)if((xx+y)%2===0)P(x,xx,y,sky[2]);
  if(rar===0||rar===-1){for(const[cx,cy,w]of[[14,12,9],[46,20,12],[30,6,7]]){ell(x,cx,cy,w,2.5,'#ffffff');ell(x,cx-w/3,cy-2,w/2,2.4,'#ffffff');R(x,cx-w+2,cy+1,w*2-4,1,'#e6f2fb')}}
  if(rar===1){for(let i=0;i<6;i++){const lx=4+r()*52|0,ly=4+r()*26|0;stamp(x,['k...k','.k.k.','..k..'],{k:'#2f6a5a'},lx,ly)}}
  if(rar===2){for(let i=0;i<22;i++){const sx=2+r()*60|0,sy=2+r()*36|0;P(x,sx,sy,r()<.3?'#fff6c0':'#c9bff0')}ell(x,50,11,5,5,'#fff3c0');ell(x,52,9,4,4,sky[0])}
  if(rar===3){for(let a=0;a<24;a++){if(a%2)continue;const ang=a/24*Math.PI*2;for(let d=6;d<50;d++){const px=32+Math.cos(ang)*d|0,py=28+Math.sin(ang)*d|0;P(x,px,py,'#fff3b8');P(x,32+Math.cos(ang+.06)*d|0,28+Math.sin(ang+.06)*d|0,'#ffe590')}}}
  // the sea and a jetty to stand on
  const sea=rar===2?['#26265a','#1c1c44','#4a4aa0']:rar===3?['#e8b04a','#c98a2a','#fff0a0']:rar===1?['#3fc0c8','#2fa0aa','#bff8e8']:rar===-1?['#7aa8d0','#5a88b8','#d8ecf8']:['#4f9fd0','#3f86bd','#d8f2fc'];
  for(let y=38;y<64;y++)R(x,0,y,64,1,y<41?sea[2]:y<46?sea[0]:sea[1]);for(let i=0;i<10;i++){const wx=2+r()*58|0,wy=42+r()*8|0;R(x,wx,wy,3,1,sea[2])}
  R(x,0,47,64,6,'#8a5a33');for(let xx=0;xx<64;xx+=8){R(x,xx,47,1,6,'#6a4426')}R(x,0,47,64,1,'#c8955a');R(x,0,52,64,1,'#5a3a22');for(const px of[5,58]){R(x,px,44,3,10,'#5a3a22');R(x,px,44,3,1,'#8a5a33')}
  ell(x,32,51,11,2.5,'rgba(42,30,51,.3)');
  x.drawImage(sheet(id),0,0,SW,SH,16,-1,SW*2,SH*2);
  if(rar>=2){for(let i=0;i<8;i++){const sx=4+r()*56|0,sy=4+r()*40|0;stamp(x,['.y.','yWy','.y.'],{y:rar===3?'#fff3b8':'#e8dcff',W:'#ffffff'},sx-1,sy-1)}}
  // frame
  const fc=isG?RARCOL[rar]:'#b8a8dc',fr=rampOf(fc);R(x,0,0,64,1,K);R(x,0,63,64,1,K);R(x,0,0,1,64,K);R(x,63,0,1,64,K);
  R(x,1,1,62,1,fr[0]);R(x,1,1,1,62,fr[0]);R(x,62,1,1,62,fr[2]);R(x,1,62,62,1,fr[2]);R(x,2,2,60,1,K);R(x,2,2,1,58,K);R(x,61,2,1,58,K);
  for(const[cx,cy]of[[1,1],[59,1],[1,59],[59,59]])stamp(x,['.kk.','kyYk','kYyk','.kk.'],{k:K,y:fc,Y:fr[0]},cx,cy);
  // name plate
  R(x,3,52,58,9,K);R(x,4,53,56,7,'#2c2440');R(x,4,53,56,1,'#3a3054');
  if(isG){drawText(x,tag(id),6,54,fc);const rn=['COMMON','UNCOMMON','RARE','LEGEND'][rar];drawText(x,rn,59-textW(rn),54,'#fbf1dc')}else{drawText(x,t.name,32-textW(t.name)/2|0,54,'#fbf1dc')}
  if(isG){stamp(x,['..k..','.kyk.','kyYyk','.kyk.','..k..'],{k:K,y:fc,Y:'#ffffff'},55,5)}
  cardCache.set(id,c);return c}
/* ---------- ground (pixel buffer, world-space noise, grass edge transitions) ---------- */
const GR={base:'#6cad5b',lt:'#79b962',dk:'#5f9f53',lip:'#477f49',hl:'#94cd70',blade:'#4f8f4c',bladeL:'#9ad375'};
const colCache=new Map();function c32(hex){let v=colCache.get(hex);if(v===undefined){const n=parseInt(hex.slice(1),16);v=(255<<24)|((n&255)<<16)|(n&0xff00)|(n>>16&255);colCache.set(hex,v)}return v}
function mkBuf(w,h){const[c,x]=mk(w,h);const id=x.createImageData(w,h);return{c,x,w,h,id,u:new Uint32Array(id.data.buffer),set(px,py,hex){if(px<0||py<0||px>=w||py>=h)return;this.u[py*w+px]=c32(hex)},get(px,py){return this.u[py*w+px]},flush(){x.putImageData(id,0,0)}}}
const GRF={base:'#5c9a52',lt:'#6aa85a',dk:'#4f8a4b',lip:'#3a6a40',hl:'#7cb862',blade:'#3f7a45',bladeL:'#86c06a'};
let GZONE=null; // world gen sets this: (wx,wy)=>forestness 0..1
function grassPal(wx,wy){if(!GZONE)return GR;return GZONE(wx,wy)>.5+(hash2(wx,wy,41)-.5)*.18?GRF:GR}
function grassAt(wx,wy){const G=grassPal(wx,wy);const n=vnoise(wx,wy,11,3)*.75+vnoise(wx,wy,4,8)*.25+(hash2(wx,wy,5)-.5)*.1;return n>.66?G.lt:n<.33?G.dk:G.base}
function tileAt(S,i,j){return(i<0||j<0||i>=S.w||j>=S.h)?'g':S.g[j*S.w+i]}
const isGrassT=t=>t==='g';
function drawTile(B,S,type,tx,ty){
  if(drawTileX(B,S,type,tx,ty))return;
  const x0=tx*16,y0=ty*16;const set=(i,j,col)=>B.set(x0+i,y0+j,col);const h=(i,j,s=0)=>hash2(x0+i,y0+j,s);
  if(type==='g'){for(let j=0;j<16;j++)for(let i=0;i<16;i++)set(i,j,grassAt(x0+i,y0+j));const GP=grassPal(x0+8,y0+8);
    if(h(0,0,7)<.5){const ix=2+(h(1,0,7)*10|0),iy=5+(h(2,0,7)*8|0);[[0,0,GP.blade],[1,-1,GP.bladeL],[1,0,GP.blade],[2,-2,GP.bladeL],[2,-1,GP.blade],[2,0,GP.blade],[3,-1,GP.bladeL],[3,0,GP.blade],[4,0,GP.blade]].forEach(([a,b,c])=>set(ix+a,iy+b,c))}
    if(h(0,0,9)<.06){const ix=3+(h(1,1,9)*9|0),iy=3+(h(2,1,9)*9|0);const fc=h(3,3,9)<.5?['#fff8ec','#e8dcd0']:['#ffe27a','#e0b84a'];set(ix,iy,fc[0]);set(ix+2,iy+1,fc[0]);set(ix+1,iy+2,fc[0]);set(ix+1,iy+1,'#f2a65a');set(ix+3,iy+3,GP.blade)}
    return}
  if(type==='w'){const P=PAL.dirt;for(let j=0;j<16;j++)for(let i=0;i<16;i++){const row=j>>3,off=((ty*2+row)&1)*4,bx=(i+off)&7,by=j&7;const sid=hash2(Math.floor((x0+i+off)/8),Math.floor((y0+j)/8),4);let col;if(bx===7||by===7)col=P[2];else if(by===0||bx===0)col=P[5];else if(by===6||bx===6)col=P[3];else col=sid<.5?P[4]:hshift(P[4],-.03);if(col===P[4]&&h(i,j,2)<.06)col=P[5];set(i,j,col)}return}
  if(type==='p'){const P=PAL.stone;const a='#ece4d6',b='#e0d6c4';for(let j=0;j<16;j++)for(let i=0;i<16;i++){const bx=i&7,by=j&7,q=((i>>3)+(j>>3))&1;let col=q?a:b;if(bx===7||by===7)col='#c4b7a0';else if(bx===0||by===0)col=q?'#f7f1e6':'#ece4d6';else if(bx===6||by===6)col=q?'#d6cab4':'#cfc2aa';set(i,j,col)}return}
  if(type==='s'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#cfcbc6';if(i===0||j===0)col='#e2dfdb';if(i===15||j===15)col='#b4afa9';if(h(i,j,3)<.05)col='#c2beb8';set(i,j,col)}
    const R2=(i,j)=>tileAt(S,i,j)==='r';if(R2(tx,ty+1))for(let i=0;i<16;i++){set(i,13,'#e8e5e1');set(i,14,'#a9a49e');set(i,15,'#8a857f')}if(R2(tx,ty-1))for(let i=0;i<16;i++){set(i,0,'#8a857f');set(i,1,'#e8e5e1')}if(R2(tx+1,ty))for(let j=0;j<16;j++){set(14,j,'#a9a49e');set(15,j,'#8a857f')}if(R2(tx-1,ty))for(let j=0;j<16;j++){set(0,j,'#8a857f');set(1,j,'#e8e5e1')}return}
  if(type==='r'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const n=h(i,j,6);set(i,j,n<.08?'#57556b':n>.94?'#45435a':'#4d4b62')}
    if(ty===17&&(tx<18||tx>29)&&tx%2===0){for(let i=2;i<12;i++){set(i,15,'#f2d98a');set(i,16-16+15,'#f2d98a')}for(let i=2;i<12;i++)B.set(x0+i,y0+16,'#d9bc6a')}
    if(tx===23&&ty>=23&&ty%2===0){for(let j=2;j<12;j++){set(15,j,'#f2d98a');B.set(x0+16,y0+j,'#d9bc6a')}}return}
  if(type==='y'||type==='q'){const P=PAL.dirt;const mid=type==='q'?'#c9a272':'#cfae80';for(let j=0;j<16;j++)for(let i=0;i<16;i++){const n=vnoise(x0+i,y0+j,9,type==='q'?11:12)*.7+vnoise(x0+i,y0+j,3,5)*.3+(h(i,j,1)-.5)*.08;set(i,j,n>.7?P[4]:n<.26?hshift(mid,-.06):mid)}if(h(0,0,13)<.18){const cx=2+(h(1,0,13)*10|0),cy=3+(h(2,0,13)*10|0);for(let k=0;k<4;k++)set(cx+k,cy+(k>>1),P[2])}
    for(let k=0;k<(type==='q'?3:2);k++){if(h(k,9,4)<.55){const px=1+(h(k,1,4)*12|0),py=1+(h(k,2,4)*12|0);set(px,py,PAL.stone[4]);set(px+1,py,PAL.stone[3]);set(px,py+1,PAL.stone[2]);set(px+1,py+1,PAL.stone[1]);set(px+2,py+1,P[2])}}return}
  if(type==='d'){const W=PAL.wood;for(let j=0;j<16;j++)for(let i=0;i<16;i++){const pj=j%4,seam=((i+(Math.floor((y0+j)/4)*5))%16)===0;let col=pj===0?W[4]:pj===3?W[1]:W[3];if(seam)col=W[1];if(pj===1&&(i===3||i===12))col=W[2];set(i,j,col)}
    if(tileAt(S,tx,ty+1)!=='d')for(let i=0;i<16;i++){set(i,13,W[2]);set(i,14,W[1]);set(i,15,W[0])}return}
  if(type==='f'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const r=j%4;let col=r===0?'#b07a52':r===3?'#6b4430':'#8f5f40';if(h(i,j,2)<.07)col='#a06c48';set(i,j,col)}return}
  if(type==='b'){for(let j=0;j<16;j++)for(let i=0;i<16;i++)set(i,j,h(i,j,2)<.2?'#6b4430':'#7d5238');return}
  if(type==='a'){const Wt=PAL.water;for(let j=0;j<16;j++)for(let i=0;i<16;i++){const n=vnoise(x0+i,y0+j,9,21);set(i,j,n>.68?Wt[4]:n<.3?Wt[2]:Wt[3])}
    const up=tileAt(S,tx,ty-1)!=='a',lf=tileAt(S,tx-1,ty)!=='a',rt=tileAt(S,tx+1,ty)!=='a',dn=tileAt(S,tx,ty+1)!=='a';
    if(up)for(let i=0;i<16;i++){set(i,0,Wt[1]);set(i,1,Wt[1]);set(i,2,Wt[2]);if(h(i,0,3)<.5)set(i,3,Wt[5])}
    if(lf)for(let j=0;j<16;j++){set(0,j,Wt[1]);set(1,j,Wt[2])}if(rt)for(let j=0;j<16;j++){set(15,j,Wt[2]);set(14,j,Wt[3])}if(dn)for(let i=0;i<16;i++){set(i,15,Wt[4]);set(i,14,Wt[5])}return}
  if(type==='hw'){if(ty===0){for(let j=0;j<16;j++)for(let i=0;i<16;i++)set(i,j,j<2?'#6a5a8e':j>13?'#2e2440':'#4a3c68');return}
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){const wy=(ty-1)*16+j;let col='#f6e2c6';if(((x0+i)%8)<2)col='#efd5b4';if(((x0+i+4)%8)===0&&(wy%8)===3)col='#e2bf96';
      if(ty===1&&j<2)col='#c9a98a';
      if(ty===2){if(j===6)col='#d39a77';else if(j===7)col='#8f5f43';else if(j>7&&j<14){const px=(x0+i)%16;col=(px===0||j===8)?'#c48a6c':(px===15||j===13)?'#7f4f3a':'#a8745a'}else if(j>=14)col=j===14?'#6b4430':'#4a2e22'}
      set(i,j,col)}return}
  if(type==='hf'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){const row=Math.floor((y0+j)/4),pj=(y0+j)%4;const off=(row*7)%16;const seam=((x0+i+off)%32)===0;const ph=hash2(Math.floor((x0+i+off)/32),row,3);let col=ph<.33?'#d9a46c':ph<.66?'#cf9a62':'#dcab74';if(pj===3)col='#a8744a';else if(pj===0)col=hshift(col,.04);if(seam)col='#a8744a';if(hash2(x0+i,y0+j,6)<.02&&pj===1)col=hshift(col,-.05);set(i,j,col)}
    if(ty===3)for(let i=0;i<16;i++){set(i,0,'#8f6440');set(i,1,'#b0804f')}
    if(tileAt(S,tx-1,ty)==='hs')for(let j=0;j<16;j++)set(0,j,'#a8744a');if(tileAt(S,tx+1,ty)==='hs')for(let j=0;j<16;j++){set(15,j,'#a8744a');set(14,j,hshift('#cf9a62',-.05))}return}
  if(type==='hs'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#2e2440';const inner=tx===0?i>=13:i<=2;if(inner)col=(tx===0?i===13:i===2)?'#6a5a8e':'#4a3c68';set(i,j,col)}return}
  if(type==='hd'){for(let j=0;j<16;j++)for(let i=0;i<16;i++){let col='#a8744a';if(j>=3&&j<=13){col=((i+j)%4<2)?'#5fb79c':'#4f9a86';if(j===3||j===13)col='#3f7a6a'}set(i,j,col)}return}
}
// grass lips over neighbouring tiles
function grassEdges(B,S){const W=S.w;for(let ty=0;ty<S.h;ty++)for(let tx=0;tx<W;tx++){const t=S.g[ty*W+tx];if(t==='g'||t[0]==='h'||NOLIP.has(t))continue;const x0=tx*16,y0=ty*16;const lip=(i,j,col)=>B.set(x0+i,y0+j,col);
  const N=isGrassT(tileAt(S,tx,ty-1)),Sd=isGrassT(tileAt(S,tx,ty+1)),E=isGrassT(tileAt(S,tx+1,ty)),Wt=isGrassT(tileAt(S,tx-1,ty));
  const dep=(k,s)=>2+(vnoise(k,s,5,31)>.55?1:0)+(vnoise(k,s,3,33)>.8?1:0);
  const shade=(i,j)=>{const v=B.get(x0+i,y0+j);const r=v&255,g=v>>8&255,b=v>>16&255;B.u[(y0+j)*B.w+x0+i]=(255<<24)|((b*.78|0)<<16)|((g*.76|0)<<8)|(r*.8|0)};
  if(N)for(let i=0;i<16;i++){const d=dep(x0+i,y0);for(let j=0;j<d;j++)lip(i,j,grassAt(x0+i,y0+j));lip(i,d-1,grassPal(x0+i,y0).lip);if(t!=='a'&&t!=='A')shade(i,d);}
  if(Sd)for(let i=0;i<16;i++){const d=dep(x0+i,y0+16);for(let j=0;j<d;j++)lip(i,15-j,grassAt(x0+i,y0+15-j));lip(i,16-d,grassPal(x0+i,y0+15).hl)}
  if(Wt)for(let j=0;j<16;j++){const d=dep(x0,y0+j);for(let i=0;i<d;i++)lip(i,j,grassAt(x0+i,y0+j));lip(d-1,j,grassPal(x0,y0+j).lip);if(t!=='a'&&t!=='A')shade(d,j)}
  if(E)for(let j=0;j<16;j++){const d=dep(x0+16,y0+j);for(let i=0;i<d;i++)lip(15-i,j,grassAt(x0+15-i,y0+j));lip(16-d,j,grassPal(x0+15,y0+j).lip)}
}}

/* ---------- trees, bushes, rocks ---------- */
function canopy(W,H,circles,ramp,o={}){const[c,x]=mk(W,H);const inBig=(px,py)=>circles.some(b=>{const dx=(px-b.x)/b.r,dy=(py-b.y)/(b.ry||b.r);return dx*dx+dy*dy<=1});
  let minX=W,maxX=0,minY=H,maxY=0;for(const b of circles){minX=Math.min(minX,b.x-b.r);maxX=Math.max(maxX,b.x+b.r);minY=Math.min(minY,b.y-(b.ry||b.r));maxY=Math.max(maxY,b.y+(b.ry||b.r))}
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,rx=(maxX-minX)/2,ry=(maxY-minY)/2;
  const r=rng(o.seed||7);const cl=[];const st=o.step||4.6,cr=o.cr||3.9;
  for(let y=minY;y<=maxY;y+=st*.85)for(let xx=minX;xx<=maxX;xx+=st){const px=xx+(r()-.5)*st*.7+((Math.round(y/st)%2)?st/2:0),py=y+(r()-.5)*st*.6;if(!inBig(px,py))continue;const edge=!inBig(px+st*.8,py)||!inBig(px-st*.8,py)||!inBig(px,py-st*.8)||!inBig(px,py+st*.8);cl.push({x:px,y:py,rad:cr+r()*1.0-(edge?.4:0)})}
  cl.sort((a,b)=>a.y-b.y||a.x-b.x);
  const buf=new Array(W*H).fill(null),own=new Int16Array(W*H).fill(-1);
  cl.forEach((k,ki)=>{const nx=(k.x-cx)/rx,ny=(k.y-cy)/ry;let g=-.6*nx-.85*ny+(r()-.5)*.3+(o.bias||0);const bi=g>.55?4:g>.05?3:g>-.5?2:1;
    for(let y=Math.floor(k.y-k.rad);y<=Math.ceil(k.y+k.rad);y++)for(let xx=Math.floor(k.x-k.rad);xx<=Math.ceil(k.x+k.rad);xx++){if(xx<0||y<0||xx>=W||y>=H)continue;const dx=xx+.5-k.x,dy=y+.5-k.y;const d=Math.hypot(dx,dy);if(d>k.rad)continue;let ci=bi;const s2=dx*.7+dy*.85;if(s2>k.rad*.55)ci=Math.max(1,bi-1);else if(s2<-k.rad*.45&&d>k.rad*.3)ci=Math.min(5,bi+1);if(bi===4&&s2<-k.rad*.6)ci=5;buf[y*W+xx]=ramp[ci];own[y*W+xx]=ki}});
  // crease: back-clump pixels touching a front clump below/right get a darker line
  const idx=new Map(ramp.map((c,i)=>[c,i]));const crease=[];
  for(let y=0;y<H-1;y++)for(let xx=0;xx<W-1;xx++){const i=y*W+xx;const a=own[i];if(a<0)continue;const b1=own[i+W],b2=own[i+1];if((b1>a&&b1>=0)||(b2>a&&b2>=0&&hash2(xx,y,3)<.5)){const ci=idx.get(buf[i])||2;crease.push([i,ramp[Math.max(1,ci-(ci>=4?2:1))]])}}
  for(const[i,col]of crease)buf[i]=col;
  for(let i=0;i<W*H;i++)if(buf[i]){x.fillStyle=buf[i];x.fillRect(i%W,i/W|0,1,1)}
  x.fillStyle=ramp[0];for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const i=y*W+xx;if(own[i]<0)continue;const e=xx===0||own[i-1]<0||xx===W-1||own[i+1]<0||y===0||own[i-W]<0||y===H-1||own[i+W]<0;if(e)x.fillRect(xx,y,1,1)}
  return c}
const TRUNK=['...kkkkkk...','...kwWWwk...','...kwWWwk...','...kwWWck...','...kwWWck...','..kwwWWcck..','.kwwWWWWcck.','.kkkkkkkkkk.'];
function artTree(v){const W=44,H=48;const[c,x]=mk(W,H);ell(x,22,44,14,3.5,SHADOW);
  const wr=PAL.wood;const ramp=v===1?PAL.blossom:v===2?PAL.autumn:PAL.leaf;
  stamp(x,['....kkkkkk....','....kwWWwk....','....kwWWck....','....kwWWck....','....kwWWck....','...kwwWWcck...','..kwwWWWWcck..','.kwk.kkkk.kck.','.kk........kk.'],{k:wr[0],w:wr[3],W:wr[4],c:wr[2]},15,36);
  if(v===3){const tiers=[[22,1,7,15],[22,9,12,26],[22,19,16,38]];const[pc,px]=mk(W,40);
    for(const[cx,top,half,bot]of tiers){for(let y=top;y<=bot;y++){const k=(y-top)/(bot-top);const hw=Math.round(1+k*half);for(let xx=cx-hw;xx<=cx+hw;xx++){const rel=(xx-cx)/hw;const wav=((xx+y*2)%5===0);let col=rel<-.4?ramp[4]:rel<.2?ramp[3]:ramp[2];if(y>=bot-1)col=ramp[1];else if(y>=bot-3&&(xx%3===0))col=ramp[2];if(wav&&rel<0)col=ramp[5];px.fillStyle=col;px.fillRect(xx,y,1,1)}}}
    const d=px.getImageData(0,0,W,40).data;px.fillStyle=ramp[0];for(let y=0;y<40;y++)for(let xx=0;xx<W;xx++){if(!d[(y*W+xx)*4+3])continue;const n=(i,j)=>i<0||j<0||i>=W||j>=40||!d[(j*W+i)*4+3];if(n(xx-1,y)||n(xx+1,y)||n(xx,y-1)||n(xx,y+1))px.fillRect(xx,y,1,1)}
    x.drawImage(pc,0,0);return c}
  const r=rng(v*977+13);const j=()=>(r()-.5)*2;
  const cl=[{x:22+j(),y:10,r:8},{x:15+j(),y:14,r:8},{x:29+j(),y:14,r:8},{x:12,y:22,r:7.5},{x:32,y:22,r:7.5},{x:22,y:20,r:13,ry:11},{x:16,y:28,r:7},{x:28,y:28,r:7},{x:22,y:30,r:6}];
  x.drawImage(canopy(W,42,cl,ramp,{seed:v*31+5}),0,0);
  if(v===1||v===4){const fr=rng(v);for(let i=0;i<14;i++){const px=9+fr()*26|0,py=5+fr()*26|0;const d=x.getImageData(px,py,1,1).data;if(d[3]){if(v===1){P(x,px,py,'#ffffff')}else{stamp(x,['kr','rR'],{k:'#7a2a2a',r:'#e9675a',R:'#ff9f8a'},px,py)}}}}
  return c}
function artBush(fl){const[c,x]=mk(22,17);ell(x,11,15,10,2.2,SHADOW);x.drawImage(canopy(22,15,[{x:6.5,y:9,r:5.5},{x:15.5,y:9,r:5.5},{x:11,y:7,r:6.5}],PAL.leaf,{seed:fl?11:3,cr:2.6,step:3.4}),0,0);if(fl){for(const[a,b]of[[5,6],[12,4],[16,8],[8,10],[13,11]]){stamp(x,['.f.','fyf','.f.'],{f:fl,y:'#fff6c0'},a-1,b-1)}}return c}
function artRock(ore,hp){const[c,x]=mk(22,18);ell(x,11,15,10,2.5,SHADOW);const cl=hp>=3?[{x:8,y:10,r:7,ry:6},{x:14,y:9,r:7,ry:6.5},{x:11,y:7,r:6}]:hp===2?[{x:8,y:11,r:6.5,ry:5},{x:14,y:10,r:6.5,ry:5.5}]:[{x:11,y:12,r:7,ry:4.5}];
  x.drawImage(blobs(22,17,cl,PAL.stone,{seed:ore?9:4,noise:.12,vgrad:.3}),0,0);
  if(hp<3){P(x,10,8+(3-hp),PAL.stone[0]);P(x,11,9+(3-hp),PAL.stone[0]);P(x,11,10+(3-hp),PAL.stone[0])}
  if(ore){stamp(x,['.k.','kak','kAk','kak','kkk'],{k:'#1f5a6a',a:'#7fe8f0',A:'#d6fbff'},7,hp>=3?5:8);stamp(x,['.k.','kpk','kPk','kkk'],{k:'#4a2a6a',p:'#b98bff',P:'#e8d6ff'},13,hp>=3?6:9)}
  return c}

/* ---------- small props (hand maps) ---------- */
function artLamp(){const[c,x]=mk(12,33);ell(x,6,31.5,5,1.4,SHADOW);stamp(x,["....kkkk....","...kmMMmk...","..kkkkkkkk..",".kmMMMMMMmk.","..kYwwwwYk..","..kYwWWwYk..","..kYwwwwYk..","..kyYYYYyk..",".kmMMMMMMmk.","..kkkkkkkk..","....kMmk....","....kMmk...."].concat(Array(16).fill("....kMmk....")).concat(["...kkMmkk...","...kMMmmk...","..kmMMMmmk..",".kkkkkkkkkk."]),{k:'#2e2a3e',M:'#7d7a9a',m:'#4d4a64',Y:'#ffd76a',y:'#e8a93c',w:'#fff3c0',W:'#ffffff'},0,0);return c}
function artBench(){const[c,x]=mk(26,17);ell(x,13,15,12,2,SHADOW);stamp(x,["..kkkkkkkkkkkkkkkkkkkkkk..",".kWWWWWWWWWWWWWWWWWWWWWWk.",".kwwwwwwwwwwwwwwwwwwwwwwk.",".kkkkkkkkkkkkkkkkkkkkkkkk.",".kWWWWWWWWWWWWWWWWWWWWWWk.",".kwwwwwwwwwwwwwwwwwwwwwwk.","kkkkkkkkkkkkkkkkkkkkkkkkkk","kmkWWWWWWWWWWWWWWWWWWWWkmk","kmkwwwwwwwwwwwwwwwwwwwwkmk","kmkddddddddddddddddddddkmk","kmkkkkkkkkkkkkkkkkkkkkkkmk","kmk.kmk............kmk.kmk","kkk.kmk............kmk.kkk","....kkk............kkk...."],{k:'#2e2433',W:'#dcaa72',w:'#b9845a',d:'#8f5f43',m:'#5d5a78'},0,0);for(let i=4;i<24;i+=5){P(x,i,1,'#ecc48e');P(x,i,4,'#ecc48e');P(x,i,7,'#ecc48e')}return c}
function artMailbox(col){const r=rampOf(col);return pm(['.......kk...','..kkkkkkfk..','.kLLLLLLkfk.','kLCCCCCCCkk.','kCCCCCCCCck.','kCCkkkkCCck.','kCCCCCCCCck.','kccccccccck.','.kkkkkkkkk..','....kwk.....','....kwk.....','....kwk.....','....kwk.....','...kkwkk....','...kkkkk....'],{k:K,L:r[0],C:col,c:r[2],f:'#ffcf4a',w:'#8f5f43'})}
function artFence(){return pm(['.kk..........kk.','kWWk........kWWk','kWwkkkkkkkkkkWwk','kWwWWWWWWWWWWWwk','kWwwwwwwwwwwwWwk','kWwkkkkkkkkkkWwk','kWwWWWWWWWWWWWwk','kWwwwwwwwwwwwWwk','kWwkkkkkkkkkkWwk','kWwk........kWwk','kkkk........kkkk'],{k:'#5a4040',W:'#fff4e0',w:'#d9c6b0'})}
function artFenceV(){return pm(['.kk.','kWWk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kWwk','kkkk'],{k:'#5a4040',W:'#fff4e0',w:'#d9c6b0'})}
function artCar(col){const r=rampOf(col);const[c,x]=mk(34,19);ell(x,17,16,16,2.6,SHADOW);stamp(x,["...........kkkkkkkkkkkk...........","..........kGgggggkGgggggk.........",".........kGgggggGkGggggggk........","........kGGGGGGGGkGGGGGGGGk.......","...kkkkkkkkkkkkkkkkkkkkkkkkkkkk...","..kLLLLLLLLLLLLLLLLLLLLLLLLLLLLk..",".kLCCCCCCCCCCCCCCCCCCCCCCCCCCCCLk.",".kCCCCCCCCCCCCkCCCCCCCCCCCCCCCCyk.","kCCCCCCCCCCCCCkCCCCCCCCCCCCCCCCyk.","kCCCCCCCCCCCCCkCCCCCCCCCCCCCCCCCk.","krCCCCCCCCCCCCkCCCCCCCCCCCCCCCCCk.","kccccccccccccccccccccccccccccccck.","kdddkkkkkddddddddddddddkkkkkdddk..",".kkkkTTTkkkkkkkkkkkkkkkkkTTTkkk...","....kTtTk...............kTtTk.....",".....kkk.................kkk......"],{k:K,G:'#d6f2f8',g:'#8fcfe3',L:r[0],C:col,c:r[2],d:r[3],y:'#fff3b8',r:'#ff7a6b',T:'#3a3346',t:'#a9a5b6'},0,0);
  P(x,12,1,'#ffffff');P(x,13,2,'#ffffff');P(x,19,1,'#ffffff');R(x,10,8,3,1,r[2]);R(x,18,8,3,1,r[2]);return c}
function artSign(txt){txt=String(txt).toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());const w=Math.max(20,textWM(txt)+10);const[c,x]=mk(w,25);ell(x,w/2,23,5,1.5,SHADOW);const W=PAL.wood;R(x,w/2-2,13,4,11,K);R(x,w/2-1,13,2,10,W[2]);R(x,1,1,w-2,14,K);R(x,0,2,w,12,K);R(x,1,2,w-2,12,W[4]);R(x,1,2,w-2,1,W[5]);R(x,1,13,w-2,1,W[2]);P(x,2,3,W[2]);P(x,w-3,3,W[2]);P(x,2,12,W[2]);P(x,w-3,12,W[2]);drawTextM(x,txt,5,4,'#4a2f22');return c}
function artHydrant(){const[c,x]=mk(12,15);ell(x,6,13,5,1.6,SHADOW);stamp(x,["....kkkk....","...kRRrrk...","..kkkkkkkk..","...kRRrrk...",".kkkRRrrkkk.","kRRkRRrrkrrk","kkkkRRrrkkkk","...kRRrrk...","...kRWrrk...","...kRRrrk...","..kkkkkkkk..","..kdddddddk.","..kkkkkkkkk."],{k:K,R:'#ff8a7a',r:'#d9564a',W:'#ffd0c8',d:'#a8403a'},0,0);return c}
function artCrate(){return pm(['kkkkkkkkkkkkkk','kWWWWWWWWWWWWk','kWkkkkkkkkkkwk','kWkwWWWWWWwkwk','kWkWkwwwwkWkwk','kWkWwkwwkwWkwk','kWkWwwkkwwWkwk','kWkWwwkkwwWkwk','kWkWwkwwkwWkwk','kWkWkwwwwkWkwk','kWkwWWWWWWwkwk','kWkkkkkkkkkkwk','kwwwwwwwwwwwwk','kkkkkkkkkkkkkk'],{k:'#4a2e28',W:'#d19c68',w:'#a8754d'})}
function artLogs(){const[c,x]=mk(34,22);ell(x,17,20,15,2.5,SHADOW);const W=PAL.wood;R(x,3,8,28,10,K);R(x,4,9,26,8,W[2]);R(x,4,9,26,2,W[3]);for(const[lx,ly]of[[1,10],[11,10],[21,10],[6,3],[16,3]]){ell(x,lx+5,ly+5,5.5,5,K);ell(x,lx+5,ly+5,4.5,4,W[5]);ell(x,lx+5,ly+5,3,2.6,W[4]);ell(x,lx+5,ly+5,1.6,1.4,W[3]);P(x,lx+4,ly+3,'#fff0d0')}return c}
function artSaw(){const[c,x]=mk(26,19);ell(x,13,17,12,2,SHADOW);const W=PAL.wood;
  for(const lx of[3,19]){R(x,lx,7,4,10,K);R(x,lx+1,7,2,9,W[3]);P(x,lx+1,7,W[4])}for(const lx of[5,21]){R(x,lx-1,8,1,9,K)}
  R(x,4,12,18,3,K);R(x,5,13,16,1,W[2]);
  R(x,1,4,24,4,K);R(x,2,5,22,1,W[5]);R(x,2,6,22,1,W[4]);
  stamp(x,['kkkkkkkkkkkk.....','kssssssssssskkkk.','kSSSSSSSSSSSkhhk.','kvkvkvkvkvkvkhhk.','..........kkkkk..'],{k:K,s:'#e4e2ee',S:'#b9b6ca',v:'#8f8aa6',h:'#c4664f'},5,0);
  for(const[a,b]of[[2,17],[6,18],[19,17],[23,18]])P(x,a,b,'#f2d9a8');return c}
function artCrop(kind,stage){const L={k:'#24442f',g:'#3f7a45',G:'#579a4f',l:'#79b85a',m:'#a7d872'};
  const mound=(x)=>stamp(x,['....kkkkkk....','..kkddddddkk..','.kdDDDDDDDDdk.','.kkkkkkkkkkkk.'],{k:'#4a2e22',d:'#8f5f40',D:'#a8744e'},1,12);
  const[c,x]=mk(16,16);
  if(stage===0){mound(x);P(x,7,13,'#c49a6a');P(x,9,13,'#c49a6a');return c}
  if(stage===1){mound(x);stamp(x,['..k..k..','.klkklk.','.kGlGlk.','..kGGk..','...kk...'],L,4,8);return c}
  const leaves=(ox,oy)=>stamp(x,['....k....k....','...klk..klk...','..kmGlkkmGlk..','.kmGgGkkGgGlk.','kmGggGlmGgggGk','kGgkkGgGgkkgGk','.kk..kGGk..kk.','.....kggk.....','......kk......'],L,ox,oy);
  if(stage===2){mound(x);leaves(1,4);return c}
  mound(x);
  if(kind===0){leaves(1,4);const tom=(tx,ty)=>stamp(x,['.kGk.','kRRrk','kRWRk','krRRk','.kkk.'],{k:'#5a1e22',G:'#579a4f',R:'#e9675a',r:'#b5473c',W:'#ffb3a6'},tx,ty);tom(2,5);tom(9,4);tom(6,8);return c}
  if(kind===1){stamp(x,['......kk......','.....kGk......','..kkkkGkkkk...','.kOWOoOOoOOk..','kOWOOoOOoOOOk.','kOOOOoOOoOOOk.','kOOOOoOOoOOok.','koooooooooook.','.kkkkkkkkkkk..'],{k:'#5a2e14',G:'#579a4f',O:'#f0943f',o:'#c06a28',W:'#ffc98a'},1,6);stamp(x,['..k..','.klk.','klGlk','.kk..'],L,10,4);return c}
  stamp(x,['.k...k...k....','kYk.kYk.kYk...','kyk.kyk.kyk...','kYk.kYk.kYk.k.','kyk.kyk.kykkYk','.kGk.kGk.kGkyk','..kGkkGkkGkkYk','...kGGkGGk.kGk','....kGGGk..kG.','.....kGk...k..'],Object.assign({},L,{Y:'#fff0a0',y:'#e8c34a'}),1,2);return c}
function artScare(){const[c,x]=mk(20,32);ell(x,10,30,6,1.6,SHADOW);stamp(x,['......kkkkk.........','....kkHHHHHkk.......','...kHHhHHHhHHk......','..kkkkkkkkkkkkk.....','.....kyyyyyk........','....kyYyyyYyk.......','....kyykyykyk.......','....kyyyyyyyk.......','.....kyrrryk........','..kkkkkRRRkkkkk.....','.kwwwkRRrRRkwwwk....','kwwwwkRRRRRkwwwwk...','.kkk.kRRrRRk.kkk....','.....kRRRRRk........','.....kRrRRRk........','.....krrrrrk........','......kkwkk.........','.......kwk..........','.......kwk..........','.......kwk..........','.......kwk..........','.......kwk..........','......kkwkk.........','.....kkkkkkk........'],{k:K,H:'#c98a4b',h:'#9b6a3c',y:'#f2d35b',Y:'#fff0a0',r:'#b5473c',R:'#e9675a',w:'#c99a63'},1,4);P(x,7,12,'#4a2f22');return c}
function artHay(){return pm(['..kkkkkkkkkkkkkk..','.kYYYYYYYYYYYYYYk.','kYyyyYyyyYyyyYyyyk','kyyyyyyyyyyyyyyyyk','kyyyyYyyyyyyYyyyyk','kyyyyyyyyyyyyyyyyk','kddddddddddddddddk','kyyyYyyyyyyYyyyyyk','kyyyyyyyyyyyyyyyyk','kddddddddddddddddk','.kkkkkkkkkkkkkkkk.'],{k:'#6b4a1a',Y:'#fff0a0',y:'#f2d35b',d:'#c9a032'})}
function artSpeaker(){return pm(['kkkkkkkkkkkk','kmMMMMMMMMmk','kMkkkkkkkkMk','kMkddddddkMk','kMkdssssdkMk','kMkdssssdkMk','kMkddddddkMk','kMkkkkkkkkMk','kMkkkkkkkkMk','kMkddddddddk','kMkdssssssdk','kMkdsSSSSsdk','kMkdsSssSsdk','kMkdsSSSSsdk','kMkdssssssdk','kMkddddddddk','kMMMMMMMMMMk','kmmmmmmmmmmk','kkkkkkkkkkkk'],{k:K,M:'#5a5070',m:'#3a3346',d:'#2a2236',s:'#433a55',S:'#7fdcc0'})}
function artMic(){const[c,x]=mk(10,24);ell(x,5,22,4,1.3,SHADOW);stamp(x,['..kkkkk...','.kwWwWwk..','.kWwWwWk..','.kwWwWwk..','..kkkkk...','...kmk....','...kmk....','...kMk....'].concat(Array(11).fill('...kmk....')).concat(['..kkmkk...','.kmmMmmk..','kkkkkkkkk.']),{k:K,W:'#e4e2ee',w:'#9d9ab3',m:'#4d4a64',M:'#8f8aa6'},0,0);return c}
function artBanner(){const[c,x]=mk(128,26);R(x,0,0,2,26,K);R(x,126,0,2,26,K);R(x,2,2,124,14,K);const b='#c39bff',br=rampOf(b);R(x,3,3,122,12,b);R(x,3,3,122,2,br[0]);R(x,3,13,122,2,br[2]);for(let i=0;i<122;i+=8){R(x,3+i,15,5,3,b);R(x,4+i,18,3,1,b);P(x,5+i,19,b);R(x,3+i,15,5,1,br[2])}const s='SATURDAY STAGE';const[tc,tx]=mk(textW(s),5);drawText(tx,s,0,0,'#2b2130');x.drawImage(tc,0,0,textW(s),5,64-textW(s),5,textW(s)*2,10);return c}
function artStallV7(){const[c,x]=mk(36,32);ell(x,18,30,16,2.5,SHADOW);const W=PAL.wood;R(x,3,8,3,22,K);R(x,4,9,1,21,W[3]);R(x,30,8,3,22,K);R(x,31,9,1,21,W[3]);
  R(x,0,0,36,11,K);for(let i=0;i<34;i+=6){R(x,1+i,1,3,9,'#ff8a7a');R(x,1+i,1,3,2,'#ffb3a6');R(x,4+i,1,3,9,'#fff2d6');R(x,4+i,1,3,2,'#ffffff')}R(x,1,8,34,2,'rgba(42,30,51,.25)');for(let i=0;i<36;i+=6){R(x,i+1,11,3,1,'#ff8a7a');P(x,i+2,12,'#ff8a7a');R(x,i+4,11,3,1,'#fff2d6');P(x,i+5,12,'#fff2d6');P(x,i,11,K)}
  R(x,1,18,34,11,K);R(x,2,19,32,9,W[3]);R(x,2,19,32,2,W[4]);R(x,2,26,32,2,W[2]);for(let i=0;i<5;i++){const cc=['#e9675a','#ffcf4a','#7cc46a','#ff9b3d','#c39bff'][i];ell(x,7+i*5.5,17,2.8,2.8,K);ell(x,7+i*5.5,17,2,2,cc);P(x,6+i*5.5|0,16,lite(cc,.25))}return c}
function artBusStop(){const[c,x]=mk(40,38);ell(x,18,35,17,2.2,SHADOW);
  R(x,2,9,3,27,K);R(x,3,9,1,26,'#7d7a9a');R(x,29,9,3,27,K);R(x,30,9,1,26,'#7d7a9a');
  R(x,5,11,24,17,K);R(x,6,12,22,15,'#a8dcee');R(x,6,12,22,3,'#d6f2f8');for(let k=0;k<7;k++){P(x,9+k,13+k,'#ecfafd');P(x,10+k,13+k,'#ecfafd')}R(x,6,19,22,1,'#7d7a9a');
  R(x,9,15,15,8,K);R(x,10,16,13,6,'#ffcf4a');R(x,10,16,13,1,'#fff0a0');drawText(x,'BUS',11,17,'#2b2130');
  R(x,4,26,26,4,K);R(x,5,27,24,1,PAL.wood[4]);R(x,5,28,24,1,PAL.wood[2]);R(x,7,30,2,5,K);R(x,25,30,2,5,K);
  R(x,0,2,34,8,K);R(x,1,3,32,2,'#7fb4ee');R(x,1,5,32,2,'#5b9be0');R(x,1,7,32,2,'#3f6fb0');R(x,1,3,32,1,'#c4dcf8');
  R(x,35,4,2,32,K);ell(x,36,5,4,4,K);ell(x,36,5,3,3,'#e9675a');drawText(x,'B',35,3,'#ffffff');return c}
function artFountain(fr){const[c,x]=mk(64,52);const S=PAL.stone,Wt=PAL.water;ell(x,33,47,30,5,SHADOW);
  ell(x,32,33,31,15,K);ell(x,32,33,30,14,S[3]);ell(x,32,32,30,13,S[4]);ell(x,32,32,29,12,S[5]);ell(x,32,33,26,10,K);ell(x,32,34,25,9,Wt[3]);ell(x,32,35,23,7,Wt[2]);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+fr*.3;const rr=8+((fr+i)%4)*3;const px=32+Math.cos(a)*rr*1.8|0,py=34+Math.sin(a)*rr*.6|0;P(x,px,py,Wt[5]);P(x,px+1,py,Wt[4])}
  R(x,27,13,10,22,K);R(x,28,14,8,21,S[4]);R(x,28,14,2,21,S[5]);R(x,34,14,2,21,S[2]);ell(x,32,14,9,3.5,K);ell(x,32,13,8,2.5,S[5]);ell(x,32,14,6,1.5,Wt[3]);
  for(let i=0;i<6;i++){const k=((fr*2+i*3)%12)/12;const side=i%2?1:-1;const px=32+side*(2+k*9),py=12-Math.sin(k*Math.PI)*9+k*14;P(x,px|0,py|0,Wt[5]);P(x,(px|0)+side,(py|0)+1,Wt[4])}
  R(x,31,3,2,10,Wt[4]);P(x,31,2,Wt[5]);P(x,32,1+(fr%2),Wt[5]);return c}
function artMine(){const[c,x]=mk(96,60);ell(x,48,56,46,4,SHADOW);const cl=[{x:20,y:34,r:20,ry:18},{x:76,y:34,r:20,ry:18},{x:48,y:24,r:26,ry:20},{x:30,y:44,r:16,ry:12},{x:66,y:44,r:16,ry:12}];x.drawImage(blobs(96,56,cl,PAL.stone,{seed:12,noise:.18,vgrad:.4}),0,0);
  const W=PAL.wood;R(x,30,22,36,34,K);R(x,32,24,32,32,W[2]);R(x,36,28,24,28,'#14101c');R(x,36,28,24,4,'#241c30');R(x,33,23,30,4,W[4]);R(x,33,23,30,1,W[5]);R(x,32,27,4,29,W[3]);R(x,60,27,4,29,W[2]);
  R(x,41,46,14,9,K);R(x,42,47,12,5,PAL.stone[3]);R(x,42,47,12,1,PAL.stone[5]);ell(x,44,55,2,2,K);ell(x,52,55,2,2,K);R(x,43,44,4,3,'#7fe8f0');R(x,48,45,3,2,'#b98bff');
  const s='MINE';R(x,38,13,textW(s)+8,10,K);R(x,39,14,textW(s)+6,8,W[4]);drawText(x,s,42,16,'#4a2f22');return c}
function artBillboard(left){const[c,x]=mk(36,46);ell(x,19,44,14,2,SHADOW);R(x,8,26,4,18,K);R(x,9,26,2,18,'#7d7a98');R(x,24,26,4,18,K);R(x,25,26,2,18,'#7d7a98');R(x,0,0,36,28,K);R(x,1,1,34,26,'#5b4a78');R(x,1,1,34,1,'#7a68a0');R(x,3,3,30,22,'#0f1a14');
  for(let y=3;y<25;y+=2)R(x,3,y,30,1,'rgba(143,255,176,.04)');drawText(x,'TODAY',8,5,'#8fffb0');const s=String(left).padStart(2,'0');const[tc,tx]=mk(textW(s),5);drawText(tx,s,0,0,left>0?'#8fffb0':'#ff7a6b');x.drawImage(tc,0,0,textW(s),5,18-textW(s),12,textW(s)*2,10);return c}
function artTower(stage){const[c,x]=mk(36,92);ell(x,18,89,17,3,SHADOW);const S=PAL.stone,W=PAL.wood;
  if(stage===0){R(x,2,78,32,11,PAL.dirt[2]);R(x,2,78,32,1,PAL.dirt[4]);for(let i=2;i<34;i+=6){R(x,i,71,3,17,K);R(x,i+1,72,1,15,'#fff4e0')}R(x,2,75,32,3,K);R(x,2,76,32,1,'#fff4e0');const s='SITE';R(x,9,60,textW(s)+8,10,K);R(x,10,61,textW(s)+6,8,'#ffcf4a');drawText(x,s,13,63,'#2b2130');R(x,17,70,2,8,K);return c}
  const top=stage===1?60:stage===2?52:24;
  if(stage>=2){R(x,4,top,28,88-top,K);for(let y=top+1;y<88;y++){const row=Math.floor((y-top-1)/5),off=(row%2)*4;for(let xx=5;xx<31;xx++){const bx=(xx-5+off)%8,by=(y-top-1)%5;P(x,xx,y,bx===7||by===4?S[2]:by===0?S[5]:xx<9?S[4]:xx>26?S[3]:S[4])}}R(x,14,73,8,15,K);R(x,15,74,6,14,W[2]);R(x,15,74,6,2,W[3]);P(x,19,81,'#ffd65a')}
  if(stage===1||stage===2){const st=stage===1?40:24;for(const px of[2,31]){R(x,px,st,3,88-st,K);R(x,px+1,st,1,88-st,W[4])}for(let y=st;y<88;y+=10){R(x,2,y,32,2,K);R(x,3,y,30,1,W[4])}}
  if(stage>=3){R(x,1,8,34,18,K);for(let y=9;y<25;y++){R(x,2,y,32,1,y<13?'#7a52a0':y>21?'#3f2a58':'#5b3a7e')}for(let i=2;i<34;i+=4)R(x,i,9,1,16,'#4a3068');R(x,15,0,6,10,K);R(x,16,1,4,8,'#ffcf4a');R(x,16,1,1,8,'#fff2b0');
    ell(x,18,40,9.5,9.5,K);ell(x,18,40,8.5,8.5,stage>=4?'#fff2d6':S[2]);ell(x,17,39,7,7,stage>=4?'#ffffff':S[3]);if(stage>=4){R(x,18,34,1,7,K);R(x,18,40,5,1,K);for(let a=0;a<12;a++)P(x,18+Math.cos(a/12*6.283)*7|0,40+Math.sin(a/12*6.283)*7|0,'#5b3a6e');stamp(x,['kkkk','krrk','kr..','k...'],{k:K,r:'#ff7a6b'},0,3);stamp(x,['kkkk','kmmk','..mk','...k'],{k:K,m:'#7fdcc0'},32,3)}}
  return c}

function artPlanter(fl){const[c,x]=mk(18,22);ell(x,9,20,8,1.8,SHADOW);const S=PAL.stone;R(x,1,10,16,10,K);R(x,2,11,14,8,S[3]);R(x,2,11,14,1,S[5]);R(x,2,18,14,1,S[1]);R(x,8,11,1,8,S[2]);R(x,2,10,14,2,'#6b4430');
  x.drawImage(canopy(18,13,[{x:5,y:8,r:4.5},{x:13,y:8,r:4.5},{x:9,y:6,r:5}],PAL.leaf,{seed:21,cr:2.4,step:3}),0,0);for(const[a,b]of[[4,4],[9,2],[13,5],[7,7],[11,8]])stamp(x,['.f.','fyf','.f.'],{f:fl,y:'#fff6c0'},a-1,b-1);return c}
/* ---------- buildings ---------- */
function artWindow(trim,opt={}){const tr=rampOf(trim);const[c,x]=mk(18,18);const o=1;
  if(opt.shutter){const sc=opt.shutter,sr=rampOf(sc);for(const sx of[0,14]){R(x,sx,1,4,12,K);R(x,sx+1,2,2,10,sc);R(x,sx+1,2,2,1,sr[0]);for(let y=4;y<12;y+=2)R(x,sx+1,y,2,1,sr[2])}}
  R(x,o+1,0,14,14,K);R(x,o+2,1,12,12,tr[1]);R(x,o+2,1,12,1,tr[0]);R(x,o+13,1,1,12,tr[2]);
  R(x,o+3,2,10,10,K);for(let j=0;j<9;j++)R(x,o+4,3+j,8,1,j<2?'#d6f2f8':j<5?'#a8dcee':'#86c4e0');
  for(let k=0;k<4;k++){P(x,o+5+k,7-k,'#ecfafd');P(x,o+6+k,7-k,'#ecfafd')}P(x,o+10,10,'#ecfafd');
  if(opt.curtain){const cc=opt.curtain,cr=rampOf(cc);R(x,o+4,3,2,9,cc);R(x,o+10,3,2,9,cc);R(x,o+4,3,8,1,cr[0]);P(x,o+5,11,cr[2]);P(x,o+10,11,cr[2])}
  R(x,o+7,3,2,9,tr[1]);R(x,o+4,7,8,1,tr[1]);P(x,o+7,3,tr[0]);
  R(x,o+0,13,16,3,K);R(x,o+1,13,14,1,tr[0]);R(x,o+1,14,14,1,tr[2]);
  if(opt.flowers){R(x,o+1,16,14,2,K);R(x,o+2,16,12,1,PAL.wood[3]);for(let i=0;i<7;i++){const fc=['#ff7a6b','#ffcf4a','#f08bbf','#fbf1dc'][i%4];P(x,o+2+i*2,13,'#3f7a45');P(x,o+2+i*2,12,fc);P(x,o+3+i*2,13,'#579a4f')}}
  return c}
function artDoor(col,h,opt={}){const r=rampOf(col);const[c,x]=mk(14,h);R(x,0,0,14,h,K);R(x,1,1,12,h-1,'#fff4e0');R(x,1,1,12,1,'#ffffff');R(x,12,1,1,h-1,'#d9c6b0');R(x,2,2,10,h-2,K);R(x,3,3,8,h-3,col);R(x,3,3,8,1,r[0]);R(x,3,3,1,h-3,r[0]);R(x,10,3,1,h-3,r[2]);
  const ph=Math.floor((h-9)/2);R(x,4,4,6,4,K);R(x,5,5,4,2,'#a8dcee');P(x,5,5,'#ecfafd');for(const py of[9,10+ph]){R(x,4,py,6,ph-1,r[2]);R(x,5,py+1,4,ph-3,col);R(x,5,py+1,4,1,r[0])}
  P(x,9,Math.floor(h/2)+2,'#ffd65a');P(x,9,Math.floor(h/2)+3,'#b8902a');return c}
function wallFill(x,W,y0,y1,o){const wall=o.wall,wr=rampOf(wall);const mat=o.mat||'siding';
  for(let y=y0;y<y1;y++){for(let xx=1;xx<W-1;xx++){let col=wall;const ry=y-y0;
    if(mat==='siding'){const by=ry%5;col=by===0?wr[0]:by===4?wr[2]:wall}
    else if(mat==='brick'){const row=Math.floor(ry/4),by=ry%4,bx=(xx+(row%2)*4)%8;col=by===3||bx===7?wr[3]:by===0?wr[0]:(hash2(Math.floor((xx+(row%2)*4)/8),row,5)<.3?wr[2]:wall)}
    else if(mat==='plaster'){const n=vnoise(xx,y,6,4);col=n>.78?hshift(wall,.04):n<.2?hshift(wall,-.04):wall;if(hash2(xx,y,9)<.015)col=hshift(wall,-.07)}
    else if(mat==='logs'){const row=Math.floor((y-y0)/5),by=(y-y0)%5;col=by===0?wr[0]:by===4?wr[3]:by===3?wr[2]:wall;if(xx<3||xx>W-4){col=by===4?wr[3]:(by===0||by===1)?wr[0]:wr[1]}}
    else if(mat==='stone'){const row=Math.floor((y-y0)/6),by=(y-y0)%6;const off=(row%2)*5;const bx=(xx+off)%10;const sid=hash2(Math.floor((xx+off)/10),row,7);col=by===5||bx===9?wr[3]:by===0||bx===0?wr[0]:(sid<.33?wr[2]:sid>.8?hshift(wall,.05):wall)}
    else if(mat==='planks'){const bx=xx%6;col=bx===0?wr[3]:bx===1?wr[0]:bx===5?wr[2]:wall;if(hash2(xx,Math.floor(y/9),3)<.04&&bx>1)col=wr[2]}
    P(x,xx,y,col)}}}
function artBuilding(w,h,r,o){
  const W=w*16,RH=r*16+4,H=(h+r)*16;const[c,x]=mk(W,H);
  const rr=rampOf(o.roof),trim=o.trim||'#fff4e0',tr=rampOf(trim);
  // roof: scalloped shingle courses, light near the ridge, dark at the eave
  R(x,0,0,W,RH,K);
  if(o.flat){const st=PAL.stone;for(let y=1;y<RH-1;y++)R(x,1,y,W-2,1,y<4?st[5]:y%6===0?st[2]:y>RH-8?st[3]:st[4]);for(let xx=4;xx<W-4;xx+=8)R(x,xx,RH-8,4,3,st[2]);R(x,1,RH-4,W-2,1,st[5]);R(x,1,RH-3,W-2,2,st[2]);}else{const rows=RH-6;
  for(let y=4;y<RH-4;y++){const ry=(y-4)%4,row=Math.floor((y-4)/4),off=(row%2)*3;const k=(y-4)/rows;const base=k<.28?rr[0]:k<.7?rr[1]:rr[2];const lo=k<.28?rr[1]:k<.7?rr[2]:rr[3];const hi=k<.28?hshift(o.roof,.2,-10):rr[0];
    for(let xx=1;xx<W-1;xx++){const sx=(xx+off)%6;let col=base;if(ry===0)col=(sx>0&&sx<5)?hi:lo;else if(sx===0)col=lo;if(ry===3&&(sx===0||sx===5))col=lo;if(ry===3&&sx>0&&sx<5)col=base;
      if(xx<3)col=k<.5?rr[1]:rr[2];if(xx>W-4)col=rr[3];P(x,xx,y,col)}}
  R(x,1,1,W-2,3,rr[2]);R(x,1,1,W-2,1,rr[1]);R(x,1,3,W-2,1,rr[3]);for(let i=3;i<W-3;i+=3)P(x,i,2,rr[1]);R(x,1,1,2,3,rr[3]);}
  if(o.dormer){const dw=20,dx=(W-dw)/2|0,dy=RH-34;R(x,dx,dy+6,dw,16,K);R(x,dx+1,dy+7,dw-2,14,o.wall);R(x,dx+1,dy+7,dw-2,1,rampOf(o.wall)[0]);x.drawImage(artWindow(trim),dx+1,dy+8,18,12);
    for(let i=0;i<7;i++){R(x,dx-1+i,dy+6-i,dw+2-i*2,1,K)}for(let i=0;i<6;i++){R(x,dx+i+1,dy+6-i,dw-i*2-2,1,i<2?rr[2]:rr[1])}R(x,dx-2,dy+6,dw+4,2,K);R(x,dx-1,dy+6,dw+2,1,tr[1])}
  R(x,0,RH-5,W,4,K);R(x,1,RH-4,W-2,1,tr[0]);R(x,1,RH-3,W-2,1,tr[1]);R(x,1,RH-2,W-2,1,tr[2]);
  if(o.chimney){const B=['#c4664f','#a24f3e','#7f3a30'];R(x,W-18,-1,10,13,K);for(let y=0;y<11;y++)for(let xx=W-17;xx<W-9;xx++){const by=y%3,bx=(xx+(Math.floor(y/3)%2)*2)%4;P(x,xx,y,by===2||bx===3?B[2]:xx<W-15?B[0]:B[1])}R(x,W-19,0,12,3,K);R(x,W-18,0,10,1,'#b5b1c8');R(x,W-18,1,10,1,'#8f8aa6')}
  // wall
  const wy=RH-1;R(x,0,wy,W,H-wy,K);wallFill(x,W,wy,H-1,o);
  R(x,1,wy,W-2,3,'rgba(42,30,51,.35)');R(x,1,wy+3,W-2,1,'rgba(42,30,51,.15)');
  if(o.mat!=='planks')for(const px of[1,W-3]){R(x,px,wy,2,H-wy-1,tr[1]);R(x,px,wy,1,H-wy-1,tr[0]);R(x,px+1,wy,1,H-wy-1,tr[2])}
  if(o.wainscot){const wc=o.wainscot,wr2=rampOf(wc);for(let y=H-18;y<H-6;y++){const row=Math.floor((y-H+18)/4),by=(y-H+18)%4;for(let xx=3;xx<W-3;xx++){const bx=(xx+(row%2)*4)%8;P(x,xx,y,by===3||bx===7?wr2[3]:by===0?wr2[0]:wc)}}R(x,3,H-19,W-6,1,tr[1])}
  R(x,1,H-6,W-2,5,PAL.stone[3]);for(let xx=1;xx<W-1;xx++){P(x,xx,H-6,PAL.stone[5]);if(xx%7===0)R(x,xx,H-5,1,4,PAL.stone[2])}R(x,1,H-2,W-2,1,PAL.stone[2]);
  const dh=Math.min(21,H-6-(o.awning?wy+11:wy+6));const top=Math.max(o.awning?wy+12:wy+6,H-6-dh-1);
  if(o.display){for(const col of o.display){const dx=col*16+2,dw=28,dy=top-1,dhh=H-6-dy-1;R(x,dx,dy,dw,dhh,K);R(x,dx+1,dy+1,dw-2,dhh-2,tr[1]);R(x,dx+2,dy+2,dw-4,dhh-4,K);R(x,dx+3,dy+3,dw-6,dhh-6,'#bfe6f0');R(x,dx+3,dy+3,dw-6,2,'#e6f7fb');
      if(o.displayKind==='furn'){stamp(x,['.kkkkkkkkkk.','kAAAAAAAAAAk','kAkaaaakaaAk','kaaaaaaaaaak','kkkkkkkkkkkk','.k........k.'],{k:K,A:'#a9a0f2',a:'#7a6fe0'},dx+3,dy+dhh-11);stamp(x,['.kkkk.','kyYYyk','.kkkk.','..kk..','..kk..','..kk..','..kk..','.kkkk.'],{k:K,y:'#ffd76a',Y:'#fff3c0'},dx+17,dy+dhh-13);R(x,dx+3,dy+dhh-5,dw-6,1,PAL.wood[2])}
      else if(o.displayKind==='appl'){stamp(x,['kkkkkkk','kWWWWWk','kWWWkWk','kdddddk','kWWWWWk','kWWWkWk','kWWWkWk','kkkkkkk'],{k:K,W:'#ffffff',d:'#b5c0cc'},dx+3,dy+dhh-11);stamp(x,['kkkkkkkkkkk','kbbbbbbbbbk','kbBbbbbbbbk','kbbbbbbbbbk','kkkkkkkkkkk','....kkk....'],{k:K,b:'#2a3d66',B:'#5f86c4'},dx+12,dy+dhh-12);R(x,dx+3,dy+dhh-5,dw-6,1,'#9d9ab3')}
      else for(let sy=dy+8;sy<dy+dhh-4;sy+=6){R(x,dx+3,sy,dw-6,1,PAL.wood[2]);for(let k=0;k<5;k++){const gc=['#e9675a','#ffcf4a','#7cc46a','#ff9b3d','#c39bff'][(k+sy)%5];R(x,dx+4+k*4,sy-3,3,3,gc);P(x,dx+4+k*4,sy-3,lite(gc,.25))}}
      for(let k=0;k<5;k++){P(x,dx+6+k,dy+4+k,'#ffffff')}}}
  for(const col of(o.win||[]))x.drawImage(artWindow(trim,{flowers:o.flowers,curtain:o.curtain,shutter:o.shutter}),col*16-1,top);
  for(const col of(o.win2||[]))x.drawImage(artWindow(trim,{curtain:o.curtain2||o.curtain,flowers:o.flowers}),col*16-1,wy+7);
  if(o.floorband){R(x,1,wy+26,W-2,2,tr[1]);R(x,1,wy+26,W-2,1,tr[0]);R(x,1,wy+28,W-2,1,'rgba(42,30,51,.2)')}
  for(const cx of(o.columns||[])){const st=PAL.stone;R(x,cx-1,wy+2,8,H-wy-8,K);R(x,cx,wy+3,6,H-wy-10,st[4]);R(x,cx,wy+3,2,H-wy-10,st[5]);R(x,cx+5,wy+3,1,H-wy-10,st[2]);R(x,cx-2,wy+2,10,3,st[5]);R(x,cx-2,wy+4,10,1,st[2]);R(x,cx-2,H-9,10,3,st[3])}
  if(o.barn){const dx=o.door*16-3;const bw=22,dc=o.doorC||'#a8402f';R(x,dx,H-6-dh-2,bw,dh+7,K);R(x,dx+1,H-5-dh-2,bw-2,dh+6,'#fff4e0');R(x,dx+3,H-3-dh-2,bw-6,dh+3,dc);R(x,dx+3,H-3-dh-2,bw-6,1,lite(dc,.12));const hh=dh+3;for(let i=0;i<hh;i++){const k=Math.floor(i*(bw-6)/hh);P(x,dx+3+k,H-5-dh+i,'#fff4e0');P(x,dx+bw-4-k,H-5-dh+i,'#fff4e0')}R(x,dx+10,H-5-dh,2,dh+3,'#fff4e0')}
  else{const dx=o.door*16+1;x.drawImage(artDoor(o.doorC||'#8a5a3c',dh+6),dx,H-6-dh);R(x,o.door*16,H-3,16,3,K);R(x,o.door*16+1,H-3,14,1,PAL.stone[5]);R(x,o.door*16+1,H-2,14,1,PAL.stone[3]);
    if(o.hood){const hc=o.hood,hr=rampOf(hc);const hy=H-6-dh-7;R(x,dx-3,hy,20,6,K);R(x,dx-2,hy+1,18,1,hr[0]);R(x,dx-2,hy+2,18,2,hc);R(x,dx-2,hy+4,18,1,hr[2]);for(let i=0;i<18;i+=3)P(x,dx-2+i,hy+5,hr[3]);R(x,dx-2,hy+6,1,3,K);R(x,dx+15,hy+6,1,3,K);P(x,dx-1,hy+6,K);P(x,dx+14,hy+6,K);R(x,dx-1,hy+6,16,1,'rgba(42,30,51,.3)')}
    if(o.lamp){const lx=dx+15,ly=H-6-dh+2;stamp(x,['.kk.','kyYk','kYyk','.kk.','..k.'],{k:K,y:'#ffd76a',Y:'#fff3c0'},lx,ly)}
    if(o.plants){for(const px of[dx-9,dx+15]){stamp(x,['..kkk...','.kGgGk..','kGgmGgk.','kgGGGgk.','.kkkkk..','.kTttk..','.kTttk..','..kkk...'],{k:K,G:'#579a4f',g:'#3f7a45',m:'#79b85a',T:'#e08a5f',t:'#b8603f'},px,H-13)}}}
  if(o.awning){const[a1,a2]=o.awning;for(let i=2;i<W-2;i+=4){const ac=((i-2)/4)%2?a2:a1,ar=rampOf(ac);R(x,i,wy+3,4,7,ac);R(x,i,wy+3,4,1,ar[0]);R(x,i,wy+8,4,2,ar[2]);R(x,i+1,wy+10,2,1,ac);P(x,i,wy+10,K);P(x,i+3,wy+10,K);P(x,i+1,wy+11,K);P(x,i+2,wy+11,K)}R(x,2,wy+2,W-4,1,K);R(x,2,wy+12,W-4,1,'rgba(42,30,51,.22)')}
  if(o.label){const s=o.label,lw=textW(s)+8,lx=(W-lw)/2|0,ly=RH-15;const lb=o.labelBg||'#fff4e0',lr=rampOf(lb);R(x,lx-2,ly+4,2,2,K);R(x,lx+lw,ly+4,2,2,K);R(x,lx,ly,lw,11,K);R(x,lx+1,ly+1,lw-2,9,lb);R(x,lx+1,ly+1,lw-2,1,lr[0]);R(x,lx+1,ly+9,lw-2,1,lr[2]);drawText(x,s,lx+4,ly+3,o.labelFg||'#2b2130')}
  return c}

const BLD={
  h1:[5,3,3,{wall:'#8fd0c4',roof:'#4b6aa8',door:2,win:[0,4],flowers:1,doorC:'#e9675a',dormer:1,lamp:1,plants:1,hood:'#fff4e0'}],
  h2:[5,3,3,{wall:'#f6dfb0',roof:'#c45a4a',door:2,win:[0,4],chimney:1,mat:'plaster',flowers:1,wainscot:'#b8735a',hood:'#c45a4a',lamp:1}],
  h3:[5,3,3,{wall:'#d8c6ea',roof:'#5f8a5a',door:2,win:[0,4],curtain:'#f08bbf',doorC:'#5b9be0',plants:1,dormer:1}],
  shop:[6,3,3,{wall:'#d9866a',roof:'#e07a4f',door:3,display:[0,4],mat:'brick',awning:['#e66a5a','#fff1d8'],label:'MARKET',lamp:1}],
  post:[6,3,3,{wall:'#a9c9e8',roof:'#3f5f8f',door:3,win:[1,5],mat:'plaster',label:'POST',labelBg:'#ffcf4a',hood:'#ffcf4a',wainscot:'#5f86c4',doorC:'#3f5f8f'}],
  barn:[5,3,2,{wall:'#c9503f',roof:'#6b4b3a',door:2,barn:1,doorC:'#a8402f',label:'BARN',mat:'planks'}]};
/* ---------- capsule machine ---------- */
const CAPCOLS=[['#ff7a6b','#fbf1dc'],['#7fdcc0','#fbf1dc'],['#ffcf4a','#fbf1dc'],['#c39bff','#fbf1dc'],['#6fb2ff','#fbf1dc'],['#f08bbf','#fbf1dc']];
const CREAM_R=['#ffffff','#f4ead6','#d9cbb0','#a89a84'];
const capCache=new Map();
function capsuleImg(rad,cols){const key=rad+cols[0]+cols[1];if(capCache.has(key))return capCache.get(key);const s=Math.ceil(rad)*2+2;const[c,x]=mk(s,s);const cx=s/2,cy=s/2;const top=rampOf(cols[0]),bot=cols[1]==='#fbf1dc'?CREAM_R:rampOf(cols[1]);
  const inside=(xx,y)=>{const dx=(xx+.5-cx)/rad,dy=(y+.5-cy)/rad;return dx*dx+dy*dy<=.94};
  for(let y=0;y<s;y++)for(let xx=0;xx<s;xx++){if(!inside(xx,y))continue;const dx=(xx+.5-cx)/rad,dy=(y+.5-cy)/rad;const nz=Math.sqrt(Math.max(0,1-dx*dx-dy*dy));const L=-dx*.55-dy*.7+nz*.45;const rp=y+.5<cy?top:bot;let col=L>.62?rp[0]:L>.12?rp[1]:L>-.3?rp[2]:rp[3];P(x,xx,y,col)}
  const sy=Math.floor(cy);for(let xx=0;xx<s;xx++)if(inside(xx,sy))P(x,xx,sy,top[3]);
  for(let y=0;y<s;y++)for(let xx=0;xx<s;xx++){if(!inside(xx,y))continue;if(!inside(xx-1,y)||!inside(xx+1,y)||!inside(xx,y-1)||!inside(xx,y+1))P(x,xx,y,y<cy?top[3]:'#7d6f62')}
  const hx=Math.round(cx-rad*.42),hy=Math.round(cy-rad*.5);P(x,hx,hy,'#ffffff');if(rad>=4.5)P(x,hx+1,hy,'#ffffff');if(rad>=7){P(x,hx,hy+1,'#ffffff');P(x,hx+2,hy,'#fff6e0');P(x,hx-1,hy+2,'#fff6e0')}
  capCache.set(key,c);return c}
function drawCapsule(c,cx,cy,rad,cols){const im=capsuleImg(rad,cols);c.drawImage(im,Math.round(cx-im.width/2),Math.round(cy-im.height/2))}
const MACHINE={body:'#f2b33d',trim:'#5b3a6e',cream:'#fff2d6'};
// vending machine: 4 shelves x 4 slots. Shelf 0 = gold row ... shelf 3 = bronze row
const SHELF_Y=[37,51,65,79],SLOT_X=[11,20,29,38];
function slotColor(r,cI){return CAPCOLS[(r*3+cI*2)%CAPCOLS.length]}
function drawMachine(c,ox,oy,t,st){st=st||{};const shake=st.shake?Math.round(Math.sin(t*70)*st.shake):0;ox+=shake;const M=MACHINE;const br=rampOf(M.body),trr=rampOf(M.trim);const chrome=['#ffffff','#e4e2ee','#b9b6ca','#8f8aa6'];
  ell(c,ox+32,oy+108,31,3.6,SHADOW);
  // plinth + feet
  R(c,ox+3,oy+99,58,7,K);R(c,ox+4,oy+100,56,5,trr[1]);R(c,ox+4,oy+100,56,1,trr[0]);R(c,ox+4,oy+104,56,1,trr[2]);R(c,ox+6,oy+106,8,2,K);R(c,ox+50,oy+106,8,2,K);
  // cabinet
  R(c,ox+1,oy+17,62,83,K);for(let y=18;y<99;y++){R(c,ox+2,oy+y,60,1,M.body)}R(c,ox+2,oy+18,3,81,br[0]);R(c,ox+2,oy+18,1,81,hshift(M.body,.2,-8));R(c,ox+58,oy+18,4,81,br[2]);R(c,ox+61,oy+18,1,81,br[3]);R(c,ox+2,oy+18,60,2,'rgba(42,30,51,.3)');
  // header light box
  R(c,ox,oy,64,18,K);R(c,ox+1,oy+1,62,16,M.trim);R(c,ox+1,oy+1,62,1,trr[0]);R(c,ox+3,oy+3,58,12,K);
  const glow=st.flash?(Math.floor(t*12)%2?'#fff6c0':'#ffd76a'):'#ffe08a';for(let y=0;y<10;y++)R(c,ox+4,oy+4+y,56,1,y<2?'#fff3c0':y<6?glow:'#ffc94a');
  const tw=textW('REEL');const[tc,tx]=mk(tw,5);drawText(tx,'REEL',0,0,'#d9962a');c.drawImage(tc,0,0,tw,5,ox+32-tw,oy+5,tw*2,10);drawText(tx,'REEL',0,0,M.trim);c.drawImage(tc,0,0,tw,5,ox+32-tw,oy+4,tw*2,10);
  const chase=Math.floor(t*8);for(let i=0;i<15;i++){const on=(i+chase)%3===0||st.flash;const bx=ox+3+i*4;for(const by of[oy+1,oy+15]){P(c,bx,by,on?'#fffbe0':'#a8814f');P(c,bx+1,by,on?'#ffd76a':'#7a5a38')}}
  // glass window + interior
  const gx=ox+4,gy=oy+21,gw=41,gh=64;R(c,gx,gy,gw,gh,K);R(c,gx+1,gy+1,gw-2,gh-2,chrome[1]);R(c,gx+1,gy+1,gw-2,1,chrome[0]);R(c,gx+1,gy+1,1,gh-2,chrome[0]);R(c,gx+gw-2,gy+1,1,gh-2,chrome[3]);R(c,gx+1,gy+gh-2,gw-2,1,chrome[3]);
  R(c,gx+3,gy+3,gw-6,gh-6,K);const ix=gx+4,iy=gy+4,iw=gw-8,ih=gh-8;
  for(let y=0;y<ih;y++)R(c,ix,iy+y,iw,1,y<1?'#fff6d8':y<4?'#4a3e6e':y<20?'#3a3058':'#2e2648');
  const flick=(Math.floor(t*3)%17===0)?'#d9cfa8':'#fff6d8';R(c,ix,iy,iw,1,flick);
  for(let r=0;r<4;r++){const sy=oy+SHELF_Y[r];
    // coils
    for(let cI=0;cI<4;cI++){const sx=ox+SLOT_X[cI];const spin=st.spin&&st.spin.row===r&&st.spin.col===cI?st.spin.p:0;for(let k=-4;k<=4;k++){const ph=((k+Math.floor(spin*12))%3+3)%3;P(c,sx+k,sy-1-(ph===0?1:0),'#8f8aa6')}}
    for(let cI=0;cI<4;cI++){const sx=ox+SLOT_X[cI];const isSel=(st.spin&&st.spin.row===r&&st.spin.col===cI);const gone=(st.fall&&st.fall.row===r&&st.fall.col===cI)||(st.empty&&st.empty.row===r&&st.empty.col===cI);if(gone)continue;
      let dx=0,dy=0;if(isSel){dy=Math.round(st.spin.p*1.5);dx=Math.round(Math.sin(st.spin.p*30)*.8)}drawCapsule(c,sx+dx,sy-5+dy,4,slotColor(r,cI))}
    R(c,ix,sy,iw,2,chrome[2]);R(c,ix,sy,iw,1,chrome[1]);
    const tagc=['#ffd24d','#c4d0dc','#d39252','#d39252'][r];for(let cI=0;cI<4;cI++){R(c,ox+SLOT_X[cI]-1,sy+2,3,2,tagc);P(c,ox+SLOT_X[cI]-1,sy+2,lite(tagc,.3))}}
  // falling capsule (inside glass, then into the bay)
  if(st.fall){const f=st.fall;const sx=ox+SLOT_X[f.col],sy0=oy+SHELF_Y[f.row]-5,sy1=oy+93;let y;const p=f.p;if(p<.6){const k=p/.6;y=sy0+(sy1-sy0)*k*k}else{const b=(p-.6)/.4;y=sy1-Math.abs(Math.sin(b*Math.PI*2))*5*(1-b)}const x0=sx+(ox+24-sx)*Math.min(1,p/.6);if(y<oy+84)drawCapsule(c,x0,y,4.5,f.cols)}
  // glass reflections
  c.fillStyle='rgba(255,255,255,.22)';for(let k=0;k<26;k++){c.fillRect(ix+3+k,iy+2+k*2,3,2)}c.fillStyle='rgba(255,255,255,.12)';for(let k=0;k<14;k++)c.fillRect(ix+14+k,iy+2+k*2,1,2);
  // control panel
  const px=ox+47,py=oy+21;R(c,px,py,13,64,K);R(c,px+1,py+1,11,62,trr[2]);R(c,px+1,py+1,11,1,trr[1]);R(c,px+11,py+1,1,62,trr[3]);
  R(c,px+2,py+3,9,9,K);R(c,px+3,py+4,7,7,'#0f1a14');const stock=st.stock==null?12:st.stock;const sv=String(stock).padStart(2,'0');drawText(c,sv,px+3,py+5,stock>0?'#8fffb0':'#ff7a6b');if(Math.floor(t*2)%2)P(c,px+9,py+10,'#8fffb0');
  const tierCols=['#ffd24d','#c4d0dc','#d39252'];for(let i=0;i<3;i++){const ty=py+15+i*9;const tI=2-i;const on=st.tier===tI?(Math.floor(t*10)%2===0):false;const tc2=tierCols[i],tr2=rampOf(tc2);R(c,px+2,ty,9,7,K);R(c,px+3,ty+1,7,5,on?tr2[0]:tc2);R(c,px+3,ty+1,7,1,on?'#ffffff':tr2[0]);R(c,px+3,ty+5,7,1,tr2[2]);if(on){R(c,px+1,ty-1,11,1,'rgba(255,246,192,.6)')}}
  R(c,px+2,py+43,9,11,K);R(c,px+3,py+44,7,9,chrome[1]);R(c,px+3,py+44,7,1,chrome[0]);R(c,px+6,py+45,1,7,'#14101c');if(st.slotGlow){R(c,px+5,py+44,3,1,'#fff6c0');P(c,px+6,py+43,'#fff6c0')}P(c,px+4,py+51,chrome[3]);P(c,px+8,py+51,chrome[3]);
  R(c,px+3,py+56,7,6,K);R(c,px+4,py+57,5,4,'#14101c');R(c,px+4,py+57,5,1,'#3a3058');
  // pickup bay
  R(c,ox+6,oy+87,38,11,K);R(c,ox+7,oy+88,36,9,chrome[2]);R(c,ox+7,oy+88,36,1,chrome[0]);R(c,ox+9,oy+89,32,7,'#14101c');
  if(st.bay||(st.fall&&st.fall.p>.6)){drawCapsule(c,ox+24,oy+93,4.5,(st.fall&&st.fall.cols)||st.bay)}
  const flap=st.fall&&st.fall.p>.55&&st.fall.p<.75;if(!flap){R(c,ox+9,oy+89,32,5,trr[2]);R(c,ox+9,oy+89,32,1,trr[1]);drawText(c,'PUSH',ox+18,oy+90,'#e4d6f2')}
  // side badge
  R(c,ox+46,oy+88,15,9,K);R(c,ox+47,oy+89,13,7,'#ffcf4a');R(c,ox+47,oy+89,13,1,'#fff0a0');drawText(c,'500',ox+48,oy+90,M.trim);
}

/* ---------- furniture ---------- */
const FURN={bed:{n:'Cozy Bed',w:2,h:2,cost:80},plant:{n:'Fern Pot',w:1,h:1,cost:20},rug:{n:'Round Rug',w:2,h:1,cost:25,flat:1},lamp:{n:'Floor Lamp',w:1,h:1,cost:30},table:{n:'Tea Table',w:2,h:1,cost:40},sofa:{n:'Sofa',w:2,h:1,cost:70},shelf:{n:'Bookshelf',w:2,h:1,cost:60},tv:{n:'TV Stand',w:2,h:1,cost:90},arcade:{n:'Arcade Cab',w:1,h:1,cost:150},tank:{n:'Fish Tank',w:2,h:1,cost:120},fridge:{n:'Fridge',w:1,h:1,cost:55},statue:{n:'Gold Statue',w:1,h:1,cost:400}};
const furnCache=new Map();
function artFurn(k){if(furnCache.has(k))return furnCache.get(k);let c,x;{const xf=artFurnX(k);if(xf){furnCache.set(k,xf);return xf}}const W=PAL.wood;
  if(k==='bed'){c=pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk','kddddddddddddddddddddddddddddddk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kffffffffffffffffffffffffffffffk','kfkkkkkkkkkkfffffkkkkkkkkkkkfffk','kfkpppppppppkfffkpppppppppkffffk','kfkPPPPPPPPPkfffkPPPPPPPPPkffffk','kfkkkkkkkkkkkfffkkkkkkkkkkkffffk','kffffffffffffffffffffffffffffffk','kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kbBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kBBbBBBBBbBBBBBBBbBBBBBBBbBBBBBk','kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kBBBBBBbBBBBBBBBbBBBBBBBbBBBBBBk','kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kBBbBBBBBbBBBBBBBbBBBBBBBbBBBBBk','kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk','kddddddddddddddddddddddddddddddk','kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','.kk..........................kk.'],{k:K,W:W[4],w:W[3],d:'#3f6fb0',D:'#2f5a96',f:'#fbf1dc',p:'#ffffff',P:'#e4e2ee',B:'#5b9be0',b:'#8fbff0'})}
  else if(k==='plant'){[c,x]=mk(16,24);ell(x,8,22,5,1.5,SHADOW);stamp(x,['.kkkkkkkk.','kTTTTTTTTk','kttttttttk','.kttttttk.','.kttttttk.','.kddddddk.','..kkkkkk..'],{k:K,T:'#f0916b',t:'#d9734f',d:'#a8543a'},3,15);x.drawImage(blobs(16,16,[{x:5,y:9,r:4.5},{x:11,y:9,r:4.5},{x:8,y:5,r:5}],PAL.leaf,{seed:2,vgrad:.3}),0,0)}
  else if(k==='rug'){[c,x]=mk(32,16);ell(x,16,8,15.5,7.5,'#8a3a48');ell(x,16,8,14.5,6.5,'#e9675a');ell(x,16,8,12,5,'#ffcf4a');ell(x,16,8,9,3.5,'#e9675a');ell(x,16,8,5,1.8,'#fbf1dc');for(let a=0;a<16;a++)P(x,16+Math.cos(a/16*6.283)*13.5|0,8+Math.sin(a/16*6.283)*5.8|0,'#fbf1dc')}
  else if(k==='lamp'){c=pm(['..kkkkkkkkkkkk..','.kYYYYYYYYYYYYk.','.kyYYYYYYYYYYyk.','kyyyyyyyyyyyyyyk','kddddddddddddddk','.kkkkkkkkkkkkkk.','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.......km.......','.....kkmmkk.....','....kmmmmmmk....','....kkkkkkkk....'],{k:K,Y:'#fff3b8',y:'#ffe27a',d:'#e0b84a',m:'#5d5a78'})}
  else if(k==='table'){c=pm(['..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..','.kWWWWWWWWWWWWWWWWWWWWWWWWWWWWk.','kWWWWWWWWWWWkkkkkkWWWWWWWWWWWWWk','kWWWWWWWWWWkffffffkWWWWWWWWWWWWk','kwWWWWWWWWWkfggggfkWWWWWWWWWWWwk','kwwwwwwwwwwwkkkkkkwwwwwwwwwwwwwk','kddddddddddddddddddddddddddddddk','.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.','..kdk....................kdk....','..kdk....................kdk....','..kdk....................kdk....','..kdk....................kdk....','..kdk....................kdk....','..kkk....................kkk....'],{k:K,W:W[4],w:W[3],d:W[2],f:'#fbf1dc',g:'#7fdcc0'})}
  else if(k==='sofa'){c=pm(['...kkkkkkkkkkkkkkkkkkkkkkkkkk...','..kLLLLLLLLLLLLLLLLLLLLLLLLLLk..','..kCCCCCCCCCCCCCCCCCCCCCCCCCCk..','..kCCCCCCCCCCCCCCCCCCCCCCCCCCk..','kkkcccccccccccccccccccccccccckkk','kLLkkkkkkkkkkkkkkkkkkkkkkkkkkLLk','kCCkLLLLLLLLLLLkLLLLLLLLLLLLkCCk','kCCkCCCCCCCCCCCkCCCCCCCCCCCCkCCk','kCCkCCCCCCCCCCCkCCCCCCCCCCCCkCCk','kCCkcccccccccccckccccccccccckCCk','kcckkkkkkkkkkkkkkkkkkkkkkkkkkcck','kddddddddddddddddddddddddddddddk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','.kmk........................kmk.','.kkk........................kkk.'],{k:K,L:'#a9a0f2',C:'#8a80ec',c:'#6a5fd0',d:'#5048a8',m:'#3a3346'})}
  else if(k==='shelf'){[c,x]=mk(32,32);ell(x,16,30,15,2,SHADOW);R(x,0,0,32,31,K);R(x,1,1,30,29,W[3]);R(x,1,1,30,1,W[4]);for(const y of[2,12,22]){R(x,2,y,28,8,W[1]);R(x,2,y+7,28,1,W[0]);for(let i=3;i<29;i+=3){const bc=['#e9675a','#5b9be0','#ffcf4a','#7cc46a','#c39bff'][i%5];const bh=7-(i%2);R(x,i,y+8-bh,2,bh-1,bc);P(x,i,y+8-bh,lite(bc,.2))}}}
  else if(k==='tv'){c=pm(['..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..','..kssssssssssssssssssssssssssk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbBBBbbbbbbbbbbbbbbbbbbbbsk..','..ksbBBbbbbbbbbbbbbbbbbbbbbbsk..','..ksbBbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..ksbbbbbbbbbbbbbbbbbbbbbbbbsk..','..kssssssssssssssssssssssssssk..','..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..','.............kkkkk..............','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWk','kwwwwwkkkkkkkkwwkkkkkkkkkwwwwwwk','kwwwwwkddddddkwwkddddddkwwwwwwwk','kwwwwwkddddddkwwkddddddkwwwwwwwk','kwwwwwkkkkkkkkwwkkkkkkkkwwwwwwwk','kddddddddddddddddddddddddddddddk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk'],{k:K,s:'#3a3346',b:'#2a3d66',B:'#5f86c4',W:W[4],w:W[3],d:W[1]})}
  else if(k==='arcade'){c=pm(['.kkkkkkkkkkkkkk.','kYYYYYYYYYYYYYYk','kyyyyyyyyyyyyyyk','kPkkkkkkkkkkkkpk','kPkbbbbbbbbbbkpk','kPkbGbbbbbbbbkpk','kPkbbbbbbYYbbkpk','kPkbbbbbbbbbbkpk','kPkbbbgbbbbbbkpk','kPkbbbbbbbbbbkpk','kPkkkkkkkkkkkkpk','kPPPPPPPPPPPPPpk','kkkkkkkkkkkkkkkk','kddddrdddddgdddk','kddddddddddddddk','kkkkkkkkkkkkkkkk','.kPPPPPPPPPPPPk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kPPPPPPPPPPPpk.','.kppppppppppppk.','.kkkkkkkkkkkkkk.'],{k:K,Y:'#ffe27a',y:'#ffcf4a',P:'#c76fd1',p:'#9a4aa8',b:'#14101c',G:'#7fdcc0',g:'#ff7a6b',d:'#2b2130',r:'#ff7a6b'})}
  else if(k==='tank'){c=pm(['kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kssssssssssssssssssssssssssssssk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAk','kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak','kaaaaaaaoooaaaaaaaaaaaaaaaaaaaak','kaaaaaaoooooOaaaaaaaaaaaaaaaaaak','kaaaaaaaoooaaaaaaaaaayyyaaaaaaak','kaaaaaaaaaaaaaaaaaaaayyyYaaaaaak','kaaagaaaaaaaaaaaaaaaaaaaaaagaaak','kaaggaaaaaaaaaaaaaaaaaaaaaaggaak','kaaagaaaaaaaaaaaaaaaaaaaaaagaaak','kddddddddddddddddddddddddddddddk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk','kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk','kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk','kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk'],{k:K,s:'#5d5a78',A:'#bfe6f0',a:'#5ea9d8',o:'#ff9b3d',O:'#2a1e33',y:'#ffcf4a',Y:'#2a1e33',g:'#579a4f',d:'#e6cfa4',m:'#3a3346'})}
  else if(k==='fridge'){c=pm(['.kkkkkkkkkkkkkk.','kWWWWWWWWWWWWWWk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwwwwk','kddddddddddddddk','kWwwwwwwwwwwwwwk','kWwwrrwwwwwwkwwk','kWwwrrwwwwwwkwwk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwkwwk','kWwwwwwwwwwwwwwk','kWwwwwwwwwwwwwwk','kWwwwwwwwwwwwwwk','kddddddddddddddk','kkkkkkkkkkkkkkkk'],{k:K,W:'#ffffff',w:'#e4eaf2',d:'#b5c0cc',r:'#ff7a6b'})}
  else if(k==='statue'){[c,x]=mk(16,34);ell(x,8,32,7,1.5,SHADOW);stamp(x,['kkkkkkkkkkkk','kSSSSSSSSSSk','ksssssssssssk','kkkkkkkkkkkk'.slice(0,12),'.kssssssssk.','.kkkkkkkkkk.'],{k:K,S:PAL.stone[4],s:PAL.stone[3]},2,27);const[tc,tx]=mk(SW,SH);tx.drawImage(sheet(1),0,0,SW,SH,0,0,SW,SH);const d=tx.getImageData(0,0,SW,SH);for(let i=0;i<d.data.length;i+=4){if(d.data[i+3]>0){const v=(d.data[i]+d.data[i+1]+d.data[i+2])/3;d.data[i]=Math.min(255,v*.9+110);d.data[i+1]=Math.min(255,v*.72+70);d.data[i+2]=Math.min(255,v*.25+15)}}tx.putImageData(d,0,0);x.drawImage(tc,0,1)}
  furnCache.set(k,c);return c}


