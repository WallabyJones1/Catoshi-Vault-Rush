/* ================= CATS: the playable coats, rival cats and Catoshi herself =================
   Drawn with the catalogue painter (PN) so they share the fish art's shading and outlines.
   catSide(coat,frame) -> 30x28 side view, sitting, facing right (frame 0/1 = tail swish, 2 = blink)
   catFace(coat)       -> 24x22 front portrait for the UI
   catoshiArt(frame)   -> 60x62 Catoshi on her gold coin (0 idle, 1 blink, 2 wave) */
const COATS=[
  {k:'ginger',n:'Ginger',name:'Marmalade',base:'#e8873a',stripe:'#b85a22',eye:'#9ccf4a'},
  {k:'black',n:'Black',name:'Midnight',base:'#2e2b36',eye:'#e8c040'},
  {k:'grey',n:'Grey',name:'Smokey',base:'#8a93a3',eye:'#e8b040'},
  {k:'tabby',n:'Brown Tabby',name:'Tiger',base:'#a07a50',stripe:'#4f3a26',eye:'#8cc850'},
  {k:'tux',n:'Tuxedo',name:'Domino',base:'#2e2b36',white:'tux',eye:'#9ccf4a'},
  {k:'calico',n:'Calico',name:'Patches',base:'#f1ece2',patch:['#e0853a','#2e2b36'],eye:'#e8b040'},
  {k:'tortie',n:'Tortoiseshell',name:'Toffee',base:'#33292a',mottle:'#c8692e',eye:'#e8a030'},
  {k:'cream',n:'Cream',name:'Biscuit',base:'#ecd0a0',stripe:'#d4a870',eye:'#c8a040'},
  {k:'siamese',n:'Siamese',name:'Mochi',base:'#efe2cb',point:'#4b3a33',eye:'#5aa8e8'},
  {k:'bicolor',n:'Ginger and White',name:'Pumpkin',base:'#e8873a',stripe:'#c06a2a',white:'bi',eye:'#e8b040'}];
const COATI=Object.fromEntries(COATS.map(c=>[c.k,c]));
const PINK='#e89aa0';
const hn=(x,y,s)=>{const v=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453;return v-Math.floor(v)};
function blotch(x,y,s){return Math.sin(x*.55+s)*Math.cos(y*.62+s*1.7)+.5*Math.sin((x+y)*.31+s*2.3)}
/* the coat colour of one pixel. region: head ear earIn muzzle chest body haunch leg paw tail ; u = tail position 0..1 */
function coatAt(cd,reg,x,y,u){
  if(reg==='earIn')return cd.k==='siamese'?shade(cd.point,.25):PINK;
  if(cd.point){ // siamese: dark points, soft body shading
    if(reg==='ear'||reg==='paw'||reg==='muzzle'||(reg==='tail'&&u>.25)||(reg==='leg'&&y>21))return cd.point;
    if(reg==='head'&&cd.face&&cd.face(x,y))return cd.point;
    return reg==='haunch'||reg==='body'?mix(cd.base,'#c8b090',.25):cd.base}
  if(cd.white==='tux'&&(reg==='chest'||reg==='paw'||reg==='muzzle'||(reg==='head'&&cd.blaze&&cd.blaze(x,y))))return '#f3f0ea';
  if(cd.white==='bi'&&(reg==='chest'||reg==='paw'||reg==='muzzle'||reg==='leg'||(reg==='haunch'&&y>21)||(reg==='tail'&&u>.85)))return '#f3f0ea';
  if(cd.patch){if(reg==='paw'||reg==='chest'||reg==='muzzle')return cd.base;const b=blotch(x,y,3.1);return b>.55?cd.patch[0]:b<-.65?cd.patch[1]:cd.base}
  if(cd.mottle){const b=blotch(x*1.3,y*1.3,1.7)+hn(x,y,2)*.6;return b>.55?cd.mottle:b>.35?shade(cd.mottle,-.25):cd.base}
  if(cd.stripe){
    if(reg==='tail')return (u*7)%1<.38?cd.stripe:cd.base;
    if(reg==='body'||reg==='haunch')return ((x+y*.45)%3.4)<1.05?cd.stripe:cd.base;
    if(reg==='head'&&cd.fore&&cd.fore(x,y))return cd.stripe;
    if(reg==='leg'&&y%3===0)return cd.stripe;
    if(reg==='chest'||reg==='muzzle')return mix(cd.base,'#fff3e0',.35);
    return cd.base}
  if(reg==='muzzle'&&cd.k!=='black'&&cd.k!=='tortie')return mix(cd.base,'#ffffff',.15);
  return cd.base}
const rampC=new Map();
function rampOfC(hex){let r=rampC.get(hex);if(!r){r=ramp5(hex);rampC.set(hex,r)}return r}
const shadeC=(hex,lit)=>rampPick(rampOfC(hex),lit);
/* ---------- side view (facing right) ---------- */
function catSidePN(k,frame){const cd=Object.assign({},COATI[k]);const N=PN(30,28);
  cd.fore=(x,y)=>y<8&&x>15&&x<21&&(x%2===0);cd.blaze=(x,y)=>x>20&&y>8;cd.face=(x,y)=>x>19&&y>7;
  const F=(reg)=>(nx,ny,lit,x,y)=>shadeC(coatAt(cd,reg,x,y,0),lit);
  // tail: curls up behind the back
  const sw=frame===1?1.5:0;
  const tp=t=>{const a=t*Math.PI*.95;return[8-Math.sin(a)*6.5-sw*t*t,23-t*13+Math.cos(a)*1.5-sw*t*.4]};
  N.tube(tp,t=>2-t*.6,(t,side,lit)=>shadeC(coatAt(cd,'tail',0,0,t),lit+.1),70,-1);
  N.ell(11,19.5,6.8,6.2,F('haunch'),0);           // haunch
  N.ell(9.5,25,3.8,1.6,F('paw'),1);               // back foot
  N.ell(15,15.5,5,7.2,F('body'),1);               // body / back
  N.ell(17.4,16.5,3.2,5.4,F('chest'),2);          // chest
  N.rect(19,19,2,6,(i,j)=>shadeC(coatAt(cd,'leg',19+i,19+j),-.25),1);   // far leg
  N.rect(16.5,19,2.4,6,(i,j)=>shadeC(coatAt(cd,'leg',16+i,19+j),.15-i*.2),3); // near leg
  N.rect(16.5,24.5,3,1.5,(i,j)=>shadeC(coatAt(cd,'paw',0,0),.3),4);
  N.rect(19.2,24.5,2.6,1.5,(i,j)=>shadeC(coatAt(cd,'paw',0,0),0),2);
  // head
  N.poly([[15.2,7],[16.2,1],[19.6,5.4]],(x,y)=>shadeC(coatAt(cd,'ear',x,y),.4),5);
  N.poly([[16.4,5.6],[16.8,3],[18.4,5.4]],(x,y)=>coatAt(cd,'earIn',x,y),6);
  N.poly([[19,5],[21.6,.8],[22.6,6.2]],(x,y)=>shadeC(coatAt(cd,'ear',x,y),0),4);
  N.ell(19.4,9.6,5.6,4.9,F('head'),5);
  N.ell(23.2,11.2,2.4,1.9,F('muzzle'),6);
  N.px(25.3,10.3,PINK,7);
  // eye
  if(frame===2){N.px(21,9,shade(coatAt(cd,'head',21,9),-.45),7);N.px(22,9,shade(coatAt(cd,'head',22,9),-.45),7)}
  else{N.px(21,8,cd.eye,7);N.px(21,9,cd.eye,7);N.px(22,8,'#1a1418',7);N.px(22,9,'#1a1418',7);N.px(21,8,mix(cd.eye,'#ffffff',.5),8)}
  N.outline();return N}
const catSideCache=new Map();
function catSide(k,frame=0){const key=k+frame;let c=catSideCache.get(key);if(!c){c=catSidePN(k,frame).canvas();catSideCache.set(key,c)}return c}
/* ---------- front portrait ---------- */
function catFacePN(k){const cd=Object.assign({},COATI[k]);const N=PN(24,22);
  cd.fore=(x,y)=>y<9&&x>8&&x<16&&(x%2===1);cd.blaze=(x,y)=>Math.abs(x+.5-12)<2.2-((10-y)*.05)&&y>7;cd.face=(x,y)=>Math.hypot(x+.5-12,(y+.5-14)*1.2)<4.6;
  const F=(reg)=>(nx,ny,lit,x,y)=>shadeC(coatAt(cd,reg,x,y,0),lit);
  N.poly([[3,9],[4,1],[10,5]],(x,y)=>shadeC(coatAt(cd,'ear',x,y),.35),0);
  N.poly([[21,9],[20,1],[14,5]],(x,y)=>shadeC(coatAt(cd,'ear',x,y),-.1),0);
  N.poly([[5,7.5],[5.2,3.6],[8.4,5.6]],PINK,1);N.poly([[19,7.5],[18.8,3.6],[15.6,5.6]],PINK,1);
  if(cd.k==='siamese'){N.poly([[5,7.5],[5.2,3.6],[8.4,5.6]],shade(cd.point,.25),2);N.poly([[19,7.5],[18.8,3.6],[15.6,5.6]],shade(cd.point,.25),2)}
  N.ell(12,12.5,9.2,7.8,F('head'),3);
  N.ell(12,16,4.6,3,F('muzzle'),4);
  // eyes
  for(const ex of [7,15]){N.rect(ex,11,3,3,cd.eye,5);N.px(ex+1,11,'#1a1418',6);N.px(ex+1,12,'#1a1418',6);N.px(ex+1,13,'#1a1418',6);N.px(ex,11,mix(cd.eye,'#ffffff',.55),6)}
  N.rect(11,15,2,1,PINK,6);N.px(11.5,16,shade(PINK,-.3),6);
  const mc=shade(coatAt(cd,'muzzle',11,17),-.45);N.px(10,17,mc,6);N.px(13,17,mc,6);
  N.outline();return N}
const faceCache=new Map();
function catFace(k){let c=faceCache.get(k);if(!c){c=catFacePN(k).canvas();faceCache.set(k,c)}return c}
/* ---------- Catoshi: an orange tabby in an oversized black hoodie, hood up, lit from the side by his Rush token ---------- */
const CATOSHI={fur:'#e88a3c',stripe:'#a9531c',cream:'#f7e2c4',eye:'#f4a72a',cloak:'#2b2930',hood:'#1b191f',rim:'#ff9a4a'};
function catoshiPN(frame){const N=PN(64,74);const C=CATOSHI;const H=ramp5(C.cloak);
  // cloth: lit softly from the upper left, with an orange rim on the right where the token glows
  const cloth=(edgeR)=>(nx,ny,lit,x,y)=>{if(nx>edgeR&&ny<.75)return mix(C.cloak,C.rim,Math.min(.7,.35+(nx-edgeR)*1.2));return rampPick(H,lit*.9+.05)};
  const tab=(x,y,band)=>(((x*.8+y*.5)%band)<band*.32)?C.stripe:C.fur;
  const fur=(lit,x,y,band=4)=>shadeC(tab(x,y,band),lit*.8+.12);
  // tail curling out from under the hoodie, ringed
  const tw=frame===1?2:0;
  N.tube(t=>[14-Math.sin(t*2.6)*9-tw*t,66-t*15-Math.sin(t*Math.PI)*2],t=>3.1-t*1.2,(t,sd,lit)=>shadeC((t*6)%1<.4?C.stripe:C.fur,lit+.1),80,-1);
  // the hoodie body: wide, soft, slumped
  N.ell(32,55,19.5,15.5,cloth(.78),0);
  N.poly([[13,56],[51,56],[54,70],[10,70]],(x,y)=>x>49?mix(C.cloak,C.rim,.35):shadeC(C.cloak,(x%9===4?-.5:-.05)-(y-56)*.015),0);
  // pocket seam
  for(let x=22;x<=42;x++)N.px(x,61+Math.round(Math.abs(x-32)*.05),shade(C.cloak,-.4),1);
  // sleeves reaching forward, tabby paws out of the cuffs
  for(const[sx,dir]of[[22,-1],[42,1]]){N.ell(sx,62,6,5.5,cloth(dir>0?.55:2),2);N.rect(sx-5,65,10,2,shade(C.cloak,-.35),3)}
  for(const px of[22,42]){N.ell(px,69.5,5.4,3.2,(nx,ny,lit,x,y)=>fur(lit+.25,x,y,3),4);for(const tx of[-2,0,2])N.px(px+tx,71,shade(C.stripe,-.25),5)}
  if(frame===2){N.ell(50,40,5,7,cloth(.3),6);N.ell(52,30,4.4,4,(nx,ny,lit,x,y)=>fur(lit+.25,x,y,3),7);N.px(51,29,PINK,8);N.px(53,29,PINK,8);N.px(52,31,PINK,8)}
  // the hood: a big rounded cowl with a soft peak drooping back
  N.ell(32,27,21,20,cloth(.8),5);
  N.ell(36,10,9,4.5,cloth(.8),5);N.ell(41,8,4,3,cloth(.8),5);
  N.ell(32,31,14.5,14.5,(nx,ny,lit)=>ny<-.2?shade(C.hood,-.2):C.hood,6);
  // rim of the hood opening catches a little light
  for(let a=Math.PI*1.05;a<Math.PI*1.95;a+=.03)N.px(32+Math.cos(a)*14.6,31+Math.sin(a)*14.6,a>Math.PI*1.6?mix(C.cloak,C.rim,.6):'#4a4752',7);
  // the face: round cheeks, tabby forehead, cream muzzle
  N.ell(32,35,11.5,10,(nx,ny,lit,x,y)=>{const fore=y<31&&Math.abs(x+.5-32)<5&&(x===29||x===32||x===35||(y<28&&x===31)||(y<28&&x===33));const cheek=Math.abs(nx)>.62&&(y===34||y===37);const rimR=nx>.72;return rimR?mix(C.fur,C.rim,.5):fore||cheek?shadeC(C.stripe,lit*.5):shadeC(C.fur,lit*.6+.1)},8);
  N.ell(32,40,5.6,3.6,(nx,ny,lit)=>shadeC(C.cream,lit*.4+.3),9);N.ell(32,43.2,3,1.4,(nx,ny,lit)=>shadeC(C.cream,lit*.3),9);
  // eyes: big amber almonds, sideways glance
  for(const ex of[24,35]){if(frame===1){N.rect(ex,35,6,1,'#5a3418',10);N.px(ex,34,'#5a3418',10);N.px(ex+5,34,'#5a3418',10)}
    else{N.rect(ex,32,6,4,C.eye,10);N.px(ex,32,null,10);N.rect(ex+1,31,4,1,C.eye,10);N.rect(ex+1,36,4,1,shade(C.eye,-.25),10);N.rect(ex+3,32,2,4,'#1a1214',11);N.px(ex+3,31,'#1a1214',11);N.px(ex+1,32,'#fff4d8',11);N.px(ex+1,33,'#fff4d8',11);
      for(let i=0;i<6;i++)N.px(ex+i,30+(i===0||i===5?1:0),'#3a2016',10)}}
  // nose, mouth, whiskers
  N.rect(31,38,3,1,'#e48a98',12);N.px(32,39,'#c86a7a',12);N.px(32,40,'#8a5a50',12);N.px(31,41,'#8a5a50',12);N.px(33,41,'#8a5a50',12);
  for(const[y,dy]of[[39,-1],[41,0],[43,1]]){for(let i=0;i<8;i++){N.px(27-i,y+Math.round(dy*i*.35),i<3?'#f3e6d4':'#c9bcae',13);N.px(37+i,y+Math.round(dy*i*.35),i<3?'#f3e6d4':'#c9bcae',13)}}
  N.outline('#141016');return N}
const catoshiCache=[];
function catoshiArt(f=0){return catoshiCache[f]||(catoshiCache[f]=catoshiPN(f).canvas())}
/* ---------- the Rush token: an orange coin with a lightning bolt ---------- */
const RUSH={body:'#f07a1e',bolt:'#fff1d6'};
function rushPN(d){const N=PN(d,d);const r=d/2,R=ramp5(RUSH.body);
  N.ell(r,r,r-.5,r-.5,(nx,ny,lit)=>rampPick(R,lit*.8+.1),0);
  N.ell(r,r,r-.5-Math.max(1,d*.1),r-.5-Math.max(1,d*.1),(nx,ny,lit)=>rampPick(R,-lit*.5),1);
  const k=d/16;const bolt=[[9.2,2.6],[4.6,8.8],[7.6,8.8],[6.4,13.4],[11.4,6.8],[8.4,6.8]].map(([x,y])=>[x*k,y*k]);
  N.poly(bolt,RUSH.bolt,2);
  N.outline('#5a2a10');return N}
const rushCache=new Map();
function rushToken(d=16){let c=rushCache.get(d);if(!c){c=rushPN(d).canvas();rushCache.set(d,c)}return c}
/* ---------- world sprites: little cats walking the town (3/4 top-down), and Catoshi in miniature ----------
   catWalk(coat,dir,frame): dir 0 down, 1 left, 2 right, 3 up; frame 0 stand, 1/2 steps. 20x20, feet at y=18. */
function catWalkPN(k,dir,fr){const cd=Object.assign({},COATI[k]);cd.fore=(x,y)=>false;cd.blaze=(x,y)=>dir===0&&Math.abs(x+.5-10)<1.6&&y>7;cd.face=(x,y)=>dir===0&&Math.hypot(x+.5-10,y+.5-10)<3.2;
  const N=PN(20,20);const C=(reg,x,y,lit,u)=>shadeC(coatAt(cd,reg,x,y,u||0),lit);const st=fr===0?0:fr===1?1:-1;
  if(dir===0||dir===3){const up=dir===3;
    N.tube(t=>[14+t*3.5,15-t*7+Math.sin(t*3)*1],t=>1.4-t*.4,(t,s,lit)=>C('tail',0,0,lit+.1,t),40,-1);
    N.ell(10,14.6,4.6,3.6,(nx,ny,lit,x,y)=>C(up?'body':'chest',x,y,lit),1);
    for(const[px,s]of[[8,st],[12,-st]])N.ell(px,18-(s>0?1:0),1.6,1.1,(nx,ny,lit)=>C('paw',0,0,lit+.2),2);
    N.poly([[4.2,7],[4.8,1.2],[8.6,4.2]],(x,y)=>C('ear',x,y,.3),3);N.poly([[15.8,7],[15.2,1.2],[11.4,4.2]],(x,y)=>C('ear',x,y,0),3);
    if(!up){N.poly([[5.4,5.6],[5.7,2.9],[7.6,4.4]],PINK,4);N.poly([[14.6,5.6],[14.3,2.9],[12.4,4.4]],PINK,4)}
    N.ell(10,8.4,6.2,5.2,(nx,ny,lit,x,y)=>C('head',x,y,lit),5);
    if(!up){N.ell(10,10.6,2.6,1.6,(nx,ny,lit)=>C('muzzle',10,11,lit+.2),6);for(const ex of[6,13]){N.px(ex,8,cd.eye,7);N.px(ex+1,8,'#1a1418',7);N.px(ex,9,shade(cd.eye,-.2),7);N.px(ex+1,9,'#1a1418',7)}N.px(9,10,PINK,7);N.px(10,10,PINK,7)}}
  else{N.tube(t=>[5-t*3,12.5-t*6],t=>1.3-t*.4,(t,s,lit)=>C('tail',0,0,lit+.1,t),40,-1);
    for(const[lx,s,far]of[[5.5,st,1],[7.5,-st,0],[11.5,-st,1],[13.5,st,0]])N.rect(lx+s*.8,14.5,1.6,3,(i,j)=>C('leg',lx,15+j,far?-.35:.1),far?0:2);
    N.ell(9.5,13,5.5,3.4,(nx,ny,lit,x,y)=>C(ny>.35?'chest':'body',x,y,lit),1);
    N.poly([[11.4,6],[12,1],[14.4,4.4]],(x,y)=>C('ear',x,y,.2),3);N.poly([[14,4.4],[16.6,1.2],[17,6]],(x,y)=>C('ear',x,y,0),3);
    N.ell(14.4,8.4,4.6,4.2,(nx,ny,lit,x,y)=>C('head',x,y,lit),4);N.ell(17.6,9.8,1.8,1.4,(nx,ny,lit)=>C('muzzle',18,10,lit+.2),5);N.px(16,8,cd.eye,6);N.px(16,7,cd.eye,6);N.px(19,9,PINK,6)}
  N.outline();const c=N.canvas();if(dir===1){const[m,x]=mk(20,20);x.translate(20,0);x.scale(-1,1);x.drawImage(c,0,0);return m}return c}
const walkCache=new Map();
function catWalk(k,dir,fr){const key=k+dir+fr;let c=walkCache.get(key);if(!c){c=catWalkPN(k,dir,fr);walkCache.set(key,c)}return c}
function catoshiMiniPN(fr){const N=PN(22,26);const C=CATOSHI;const H=ramp5(C.cloak);
  N.tube(t=>[16+t*4,23-t*7-Math.sin(t*3)],t=>1.6-t*.5,(t,s,lit)=>shadeC((t*5)%1<.4?C.stripe:C.fur,lit+.1),40,-1);
  N.ell(11,18.5,7.5,6.5,(nx,ny,lit)=>nx>.7?mix(C.cloak,C.rim,.4):rampPick(H,lit*.9),0);
  N.ell(8,24,2.4,1.5,(nx,ny,lit,x)=>shadeC(x%2?C.stripe:C.fur,lit+.2),2);N.ell(14,24,2.4,1.5,(nx,ny,lit,x)=>shadeC(x%2?C.stripe:C.fur,lit+.2),2);
  N.ell(11,9,8.6,8,(nx,ny,lit)=>nx>.72?mix(C.cloak,C.rim,.45):rampPick(H,lit*.9),3);N.ell(13,2.6,4,2,(nx,ny,lit)=>rampPick(H,lit*.9),3);
  N.ell(11,10.2,5.6,5.4,C.hood,4);
  N.ell(11,11,4.4,3.8,(nx,ny,lit,x,y)=>y<9&&x%2===0&&Math.abs(x-11)<3?shadeC(C.stripe,lit):shadeC(C.fur,lit*.6+.1),5);
  N.ell(11,12.6,2,1.2,C.cream,6);
  if(fr===1){N.px(8,10,'#5a3418',7);N.px(9,10,'#5a3418',7);N.px(13,10,'#5a3418',7);N.px(14,10,'#5a3418',7)}else{N.px(8,10,C.eye,7);N.px(9,10,'#1a1214',7);N.px(13,10,C.eye,7);N.px(14,10,'#1a1214',7)}
  N.px(11,12,'#e48a98',7);
  N.outline('#141016');return N}
const catoshiMiniCache=[];
function catoshiMini(f=0){return catoshiMiniCache[f]||(catoshiMiniCache[f]=catoshiMiniPN(f).canvas())}
/* ---------- Catoshi's golden chair and the basket beneath it ---------- */
function thronePN(){const N=PN(92,96);const G=ramp5('#f2c14e');const V=ramp5('#b8323a');
  const gold=(nx,ny,lit,x,y)=>rampPick(G,lit*.9+.1+(hash2(x,y,3)<.06?.5:0));
  // tall rounded back with a crest
  N.ell(46,20,30,18,gold,0);N.rect(16,20,60,46,(i,j)=>rampPick(G,.5-i/60*1.1-j*.004),0);
  N.ell(46,22,24,13,(nx,ny,lit)=>rampPick(V,lit*.7),1);N.rect(22,22,48,40,(i,j)=>rampPick(V,.35-i/48*.9),1);
  for(let y=26;y<60;y+=6)for(let x=26;x<68;x+=8){N.px(x+((y/6)%2)*4,y,rampPick(G,.4),2)}
  N.ell(46,5,9,8,gold,3);N.ell(46,5,5.5,5,'#f07a1e',4);N.poly([[47.6,1.6],[44,6],[46.2,6],[44.8,9.4],[48.4,4.6],[46.2,4.6]],'#fff1d6',5);
  for(const sx of[14,78]){N.ell(sx,16,4,4,gold,3)}
  // seat, cushion, armrests, legs
  N.rect(10,62,72,10,(i,j)=>rampPick(G,.6-j*.12),3);N.ell(46,62,30,6,(nx,ny,lit)=>rampPick(V,lit+.2),4);
  for(const ax of[6,74]){N.rect(ax,46,12,18,(i,j)=>rampPick(G,.55-i*.07-j*.01),5);N.ell(ax+6,46,6.5,4,gold,6)}
  for(const lx of[12,74]){N.rect(lx,72,7,22,(i,j)=>rampPick(G,.4-i*.15),2);N.ell(lx+3.5,93,5,2.5,gold,3)}
  N.rect(18,72,56,5,(i,j)=>rampPick(G,.1-j*.15),2);
  N.outline('#3a2a10');return N}
let throneC=null;function throneArt(){return throneC||(throneC=thronePN().canvas())}
function basketPN(n){const N=PN(34,22);const W=ramp5('#c8924a');
  if(n>0){const cols=['#7ab8d8','#e8c84a','#d8806a','#9ad0a0'];for(let i=0;i<Math.min(6,n);i++){const x=7+i*4,y=7-(i%2)*2;N.ell(x,y,3.4,2,cols[i%4],0);N.poly([[x+3,y],[x+6,y-2],[x+6,y+2]],shade(cols[i%4],-.2),0)}}
  N.poly([[2,8],[32,8],[29,21],[5,21]],(x,y)=>{const w=(x+(y%4<2?0:2))%4<2;return rampPick(W,(w?.4:-.1)-(y-8)*.05)},1);
  N.rect(1,7,32,3,(i,j)=>rampPick(W,.5-j*.3),2);
  N.outline('#3a2412');return N}
const basketC=new Map();function basketArt(n){const k=Math.min(6,n);if(!basketC.has(k))basketC.set(k,basketPN(k).canvas());return basketC.get(k)}
