/* ================= ART: the catalogue (fish, legends, treasure, coral, shells, pearls, curios, sets, junk) =================
   Every entry is drawn in code from its art string, at a native 32x32 (legends 48x48) and scaled up crisply by the UI.
   Fish come from one parametric body (profile curves for back and belly, a polygon tail, fins, eye, pattern) with
   presets per body shape; long fish are posed on a diagonal with a rotsprite-style rotation so they fill the frame.
   Crabs, squid, rays, seahorses, eels and the other odd shapes have their own painters, as do all the finds.
   catArt(id,variant) -> canvas ; variant: '' | 'g' golden | 'a' albino | 's' silhouette (not found yet) */
// ---- a tiny painter: a colour per pixel, then an outline pass ----
function PN(w,h){return{w,h,c:new Array(w*h).fill(null),z:new Int8Array(w*h),
  px(x,y,col,z=0){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=this.w||y>=this.h||!col)return;const i=y*this.w+x;if(this.c[i]&&z<this.z[i])return;this.c[i]=col;this.z[i]=z},
  get(x,y){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=this.w||y>=this.h)return null;return this.c[y*this.w+x]},
  // shaded ellipse: f(nx,ny,lit) picks a colour; lit is -1 (shadow) .. 1 (light from the top-left)
  ell(cx,cy,rx,ry,f,z=0){for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){const nx=(x+.5-cx)/rx,ny=(y+.5-cy)/ry,d=nx*nx+ny*ny;if(d>1)continue;const nz=Math.sqrt(1-d);const lit=-nx*.55-ny*.7+nz*.45-.2;this.px(x,y,typeof f==='string'?f:Array.isArray(f)?rampPick(f,lit):f(nx,ny,lit,x,y),z)}},
  poly(pts,f,z=0){let y0=1e9,y1=-1e9;for(const p of pts){y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}for(let y=Math.floor(y0);y<=Math.ceil(y1);y++){const xs=[];const yy=y+.5;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))xs.push(a[0]+(yy-a[1])/(b[1]-a[1])*(b[0]-a[0]))}xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2)for(let x=Math.round(xs[k]);x<Math.round(xs[k+1]);x++)this.px(x,y,typeof f==='string'?f:f(x,y),z)}},
  line(x0,y0,x1,y1,col,th=1,z=0){const n=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)))*2+1;for(let i=0;i<=n;i++){const k=i/n,x=x0+(x1-x0)*k,y=y0+(y1-y0)*k;const cc=typeof col==='string'?col:col(k);if(th<=1)this.px(x,y,cc,z);else for(let dy=0;dy<th;dy++)for(let dx=0;dx<th;dx++)this.px(x+dx-(th-1)/2,y+dy-(th-1)/2,cc,z)}},
  rect(x,y,w,h,col,z=0){for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.px(x+i,y+j,typeof col==='string'?col:Array.isArray(col)?rampPick(col,.3-j/Math.max(1,h)*.8):col(i,j),z)},
  // a tube along a curve: pt(t)->[x,y], rad(t)->radius, col(t,side,lit)->colour
  tube(pt,rad,col,n=60,z=0){for(let i=0;i<=n;i++){const t=i/n;const[x,y]=pt(t);const r=rad(t);const[x2,y2]=pt(Math.min(1,t+.01));const ang=Math.atan2(y2-y,x2-x);for(let yy=Math.floor(y-r-1);yy<=Math.ceil(y+r+1);yy++)for(let xx=Math.floor(x-r-1);xx<=Math.ceil(x+r+1);xx++){const dx=xx+.5-x,dy=yy+.5-y;if(dx*dx+dy*dy>r*r)continue;const side=(-Math.sin(ang)*dx+Math.cos(ang)*dy)/Math.max(.5,r);this.px(xx,yy,col(t,side,-side*.8+(-dx-dy)*.04),z)}}},
  // outline: empty pixels touching paint become a darkened version of what they touch
  outline(col){const W=this.w,H=this.h;const add=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(this.c[y*W+x])continue;let n=null;for(const[dx,dy]of[[0,-1],[-1,0],[1,0],[0,1]]){const v=this.get(x+dx,y+dy);if(v){n=v;if(dy>=0)break}}if(n)add.push([x,y,col||mix(K,n,.16)])}for(const[x,y,c]of add){this.c[y*W+x]=c;this.z[y*W+x]=-1}return this},
  canvas(){const[c,x]=mk(this.w,this.h);const id=x.createImageData(this.w,this.h);const u=new Uint32Array(id.data.buffer);for(let i=0;i<this.c.length;i++)if(this.c[i])u[i]=c32(this.c[i]);x.putImageData(id,0,0);return c}}}
function ramp5(hex){return[hshift(hex,.17,-12,-.04),hshift(hex,.08,-6,-.02),hex,hshift(hex,-.13,10,.05),hshift(hex,-.27,20,.08)]}
const rampPick=(r,lit)=>lit>.62?r[0]:lit>.25?r[1]:lit>-.18?r[2]:lit>-.55?r[3]:r[4];
const DITH=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
const dith=(x,y)=>(DITH[y&3][x&3]+.5)/16;
// rotsprite-lite: scale2x twice, rotate (nearest), sample back down
function scale2x(a,w,h){const o=new Array(w*h*4).fill(null);const g=(x,y)=>x<0||y<0||x>=w||y>=h?null:a[y*w+x];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const P=g(x,y),A=g(x,y-1),B=g(x+1,y),C=g(x-1,y),D=g(x,y+1);let e0=P,e1=P,e2=P,e3=P;if(C===A&&C!==D&&A!==B)e0=A;if(A===B&&A!==C&&B!==D)e1=B;if(D===C&&D!==B&&C!==A)e2=C;if(B===D&&B!==A&&D!==C)e3=D;const i=(y*2)*(w*2)+x*2;o[i]=e0;o[i+1]=e1;o[i+w*2]=e2;o[i+w*2+1]=e3}return o}
function rotPN(N,ang,W,H,ox=0,oy=0){let a=N.c,w=N.w,h=N.h;a=scale2x(a,w,h);w*=2;h*=2;a=scale2x(a,w,h);w*=2;h*=2;const O=PN(W,H);const ca=Math.cos(-ang),sa=Math.sin(-ang);const scx=w/2,scy=h/2;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=(x+.5-W/2-ox)*4,dy=(y+.5-H/2-oy)*4;const sx=Math.floor(scx+dx*ca-dy*sa),sy=Math.floor(scy+dx*sa+dy*ca);if(sx<0||sy<0||sx>=w||sy>=h)continue;const v=a[sy*w+sx];if(v)O.px(x,y,v)}return O}
const rotPt=(x,y,ang,sw,sh,W,H,ox=0,oy=0)=>{const dx=x-sw/2,dy=y-sh/2;return[W/2+ox+dx*Math.cos(ang)-dy*Math.sin(ang),H/2+oy+dx*Math.sin(ang)+dy*Math.cos(ang)]};
function bboxPN(N){let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<N.h;y++)for(let x=0;x<N.w;x++)if(N.c[y*N.w+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}return{x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1}}

/* ---------------- the parametric fish ---------------- */
// presets: h = body height/length, p = where it is tallest, a/b = head/tail profile exponents, pt = tail-stalk thickness,
// tl = tail share of total length, tail kind, dor/anal fins [from,to,height,kind], eye position/size
const FISHP={
  torp:{h:.36,p:.36,a:.72,b:1.15,pt:.26,tl:.2,tail:'fork',dor:[[.3,.52,.55,'spiny'],[.6,.78,.38,'soft']],anal:[[.62,.78,.32,'soft']],eye:.11,ey:-.22,es:1},
  deep:{h:.56,p:.4,a:.55,b:1.1,pt:.22,tl:.2,tail:'fork',dor:[[.2,.78,.34,'spiny']],anal:[[.56,.8,.32,'soft']],eye:.15,ey:-.3,es:1.1},
  gar:{h:.2,p:.55,a:1,b:1.2,pt:.45,tl:.15,tail:'fork',dor:[[.68,.84,.7,'soft']],anal:[[.66,.84,.6,'soft']],eye:.2,ey:-.2,es:1,beak:.25},
  jacket:{h:.5,p:.42,a:.7,b:1,pt:.32,tl:.18,tail:'round',dor:[[.24,.28,.9,'spine'],[.55,.82,.32,'soft']],anal:[[.55,.82,.32,'soft']],eye:.17,ey:-.34,es:1,mouth:'small'},
  disc:{h:.86,p:.45,a:.5,b:.8,pt:.22,tl:.2,tail:'square',dor:[[.15,.85,.28,'spiny']],anal:[[.5,.85,.24,'soft']],eye:.16,ey:-.25,es:1.1},
  grouper:{h:.44,p:.42,a:.45,b:1,pt:.34,tl:.18,tail:'round',dor:[[.25,.82,.22,'spiny']],anal:[[.6,.8,.24,'soft']],eye:.12,ey:-.38,es:1,mouth:'big'},
  shark:{h:.3,p:.38,a:.85,b:1.25,pt:.22,tl:.28,tail:'hetero',dor:[[.32,.5,1.0,'shark'],[.72,.79,.38,'shark']],anal:[[.7,.78,.25,'shark']],eye:.1,ey:-.12,es:.7,belly:'shark',gills:5,pelvic:.56},
  tuna:{h:.34,p:.42,a:.7,b:1.6,pt:.12,tl:.22,tail:'lunate',dor:[[.3,.44,.45,'spiny'],[.56,.64,.5,'soft']],anal:[[.58,.66,.45,'soft']],eye:.1,ey:-.12,es:.9,finlets:1},
  flathead:{h:.2,p:.3,a:.5,b:1,pt:.38,tl:.17,tail:'round',dor:[[.28,.42,.55,'spiny'],[.48,.84,.45,'soft']],anal:[[.5,.84,.4,'soft']],eye:.14,ey:-.7,es:1,flat:1},
  puffer:{h:.66,p:.45,a:.45,b:.9,pt:.26,tl:.18,tail:'round',dor:[[.68,.8,.35,'soft']],anal:[[.66,.78,.3,'soft']],eye:.2,ey:-.32,es:1.25,mouth:'small'},
  clown:{h:.5,p:.4,a:.5,b:.9,pt:.34,tl:.18,tail:'round',dor:[[.25,.45,.35,'soft'],[.47,.82,.4,'soft']],anal:[[.6,.82,.36,'soft']],eye:.15,ey:-.2,es:1.15,pect:1.2},
  trigger:{h:.64,p:.45,a:.6,b:.8,pt:.22,tl:.17,tail:'square',dor:[[.28,.33,.7,'spine'],[.56,.82,.45,'soft']],anal:[[.54,.82,.42,'soft']],eye:.27,ey:-.42,es:1,mouth:'small'},
  parrot:{h:.46,p:.42,a:.48,b:1,pt:.3,tl:.17,tail:'square',dor:[[.2,.82,.22,'soft']],anal:[[.6,.82,.22,'soft']],eye:.14,ey:-.3,es:1,mouth:'beak'},
  hump:{h:.5,p:.42,a:.4,b:1,pt:.32,tl:.16,tail:'round',dor:[[.28,.82,.24,'soft']],anal:[[.6,.82,.24,'soft']],eye:.15,ey:-.15,es:.9,hump:.34,mouth:'lips'},
  boar:{h:.66,p:.45,a:.5,b:.8,pt:.22,tl:.18,tail:'square',dor:[[.2,.5,.6,'spiny'],[.52,.82,.32,'soft']],anal:[[.56,.82,.32,'soft']],eye:.22,ey:-.15,es:1.1,snout:.12},
  dory:{h:.76,p:.48,a:.5,b:.8,pt:.2,tl:.17,tail:'round',dor:[[.2,.5,.7,'filament'],[.55,.82,.22,'soft']],anal:[[.56,.82,.22,'soft']],eye:.2,ey:-.25,es:1.1,mouth:'pout'},
  bat:{h:.72,p:.45,a:.5,b:.8,pt:.25,tl:.18,tail:'square',dor:[[.25,.8,1.1,'soft']],anal:[[.35,.8,1,'soft']],eye:.18,ey:-.1,es:1.1},
  lion:{h:.46,p:.42,a:.6,b:1,pt:.28,tl:.16,tail:'round',dor:[[.18,.5,1.3,'rays'],[.52,.82,.35,'soft']],anal:[[.6,.8,.35,'soft']],eye:.14,ey:-.25,es:1,pect:2.4,pectK:'rays'},
  idol:{h:.95,p:.48,a:.6,b:.8,pt:.22,tl:.18,tail:'square',dor:[[.3,.6,.9,'filament']],anal:[[.45,.8,.55,'soft']],eye:.22,ey:-.15,es:1,snout:.1},
  mahi:{h:.34,p:.15,a:.35,b:1.1,pt:.18,tl:.2,tail:'deepfork',dor:[[.06,.82,.4,'soft']],anal:[[.5,.82,.32,'soft']],eye:.07,ey:.05,es:.9},
  marlin:{h:.24,p:.38,a:.8,b:1.5,pt:.12,tl:.2,tail:'lunate',dor:[[.18,.5,1,'soft'],[.7,.74,.3,'soft']],anal:[[.6,.68,.4,'soft']],eye:.15,ey:-.1,es:.8,bill:.3},
  sail:{h:.24,p:.38,a:.8,b:1.5,pt:.12,tl:.2,tail:'lunate',dor:[[.14,.66,1.9,'sail']],anal:[[.6,.68,.4,'soft']],eye:.15,ey:-.1,es:.8,bill:.3},
  flying:{h:.28,p:.36,a:.75,b:1.2,pt:.24,tl:.22,tail:'deepfork',dor:[[.58,.7,.3,'soft']],anal:[[.6,.7,.3,'soft']],eye:.12,ey:-.15,es:1.1,wing:1},
  lantern:{h:.36,p:.32,a:.6,b:1.2,pt:.28,tl:.2,tail:'fork',dor:[[.4,.56,.4,'soft']],anal:[[.6,.76,.32,'soft']],eye:.12,ey:-.15,es:1.8},
  angler:{h:.66,p:.35,a:.4,b:1,pt:.3,tl:.18,tail:'round',dor:[[.6,.78,.3,'soft']],anal:[[.62,.78,.28,'soft']],eye:.22,ey:-.48,es:.8,mouth:'angler',lure:1},
  chimaera:{h:.26,p:.3,a:.55,b:1.6,pt:.06,tl:.12,tail:'point',dor:[[.2,.3,.9,'spine'],[.38,.9,.25,'low']],anal:[],eye:.12,ey:-.25,es:1.7,pect:1.8},
  saw:{h:.2,p:.42,a:.9,b:1.2,pt:.24,tl:.2,tail:'hetero',dor:[[.4,.52,.7,'shark'],[.68,.76,.5,'shark']],anal:[],eye:.1,ey:-.35,es:.6,belly:'shark',saw:.32,gills:0},
  odd:{h:.66,p:.45,a:.5,b:.9,pt:.24,tl:.2,tail:'round',dor:[[.15,.85,.45,'soft']],anal:[[.45,.85,.4,'soft']],eye:.22,ey:-.15,es:1.4,odd:1}};
const FISHX={slim:{hk:.82},big:{hk:1.1},long:{hk:.78},deepfork:{tail:'deepfork'},snapper:{forehead:1},barra:{concave:.55,tail:'round'},thread:{thread:1},yfin:{yfin:1},blunt:{a:.5},sleek:{hk:.9},
  sixgill:{gills:6},bigeye:{es:1.8},blueeye:{es:1.6,eyeCol:'#4ad0ff'},nofin:{nofin:1},crown:{crown:1}};
function parseArt(art){const a=String(art).split('|');return{shape:a[0],back:a[1],side:a[2],belly:a[3],pat:a[4]||'none',pc:a[5]||'#000',fin:a[6]||a[1],ex:(a[7]||'').split(' ').filter(Boolean)}}
function profile(u,p,a,b,pt){if(u<=0)return 0;if(u>=1)return pt;if(u<p)return Math.pow(Math.sin(u/p*Math.PI/2),a);const s=(u-p)/(1-p);return pt+(1-pt)*Math.pow(Math.cos(s*Math.PI/2),b)}
// draw a horizontal fish (head left) into a painter; returns the painter and the head features for a post-rotation pass
function fishBody(A,W,H0,L){const P=Object.assign({},FISHP[A.shape]||FISHP.torp);for(const e of A.ex)Object.assign(P,FISHX[e]||{});P.h*=P.hk||1;
  const N=PN(W,H0);const extra=(P.beak||P.bill||P.saw||P.snout||0);const BL=L/((1+P.tl/(1-P.tl))+extra);const TLt=BL*P.tl/(1-P.tl);const x0=(W-L)/2+extra*BL,x1=x0+BL,x2=x1+TLt;
  const H=BL*P.h/2,cy=H0/2;const back=ramp5(A.back),side=ramp5(A.side),bel=ramp5(A.belly),fin=ramp5(A.fin);
  const topAt=u=>{let f=profile(u,P.p*(P.forehead?.75:1),P.a*(P.forehead?.55:1),P.b,P.pt);if(P.concave&&u<.32)f*=1-P.concave*.3*Math.sin(u/.32*Math.PI);if(P.hump&&u<.5)f+=P.hump*Math.max(0,Math.sin((u-.03)/.42*Math.PI))*.7;return cy-H*f*(P.flat?.8:1)};
  const botAt=u=>cy+H*profile(u,P.p,P.a*.9,P.b,P.pt)*(P.flat?.55:1);
  // tail polygon
  const ph=H*P.pt,th=Math.max(H*1.05,BL*.18)*(P.tail==='lunate'?1.2:1);const fcol=(x,y)=>((x+y)%2===0?fin[3]:fin[2]);let tp;
  switch(P.tail){case'deepfork':tp=[[x1-1,cy-ph],[x2,cy-th*1.1],[x2-TLt*.15,cy-th*.95],[x1+TLt*.3,cy],[x2-TLt*.15,cy+th*.95],[x2,cy+th*1.1],[x1-1,cy+ph]];break;
    case'round':tp=[[x1-1,cy-ph]];for(let i=0;i<=8;i++){const a=-Math.PI/2+i/8*Math.PI;tp.push([x1+TLt*.35+Math.cos(a)*TLt*.65,cy+Math.sin(a)*th*.82])}tp.push([x1-1,cy+ph]);break;
    case'square':tp=[[x1-1,cy-ph],[x2,cy-th*.8],[x2-1,cy],[x2,cy+th*.8],[x1-1,cy+ph]];break;
    case'lunate':tp=[[x1-1,cy-ph],[x2-TLt*.15,cy-th*1.05],[x2+.5,cy-th*1.0],[x1+TLt*.62,cy],[x2+.5,cy+th*1.0],[x2-TLt*.15,cy+th*1.05],[x1-1,cy+ph]];break;
    case'hetero':tp=[[x1-1,cy-ph],[x2,cy-th*1.25],[x2-TLt*.08,cy-th*1.05],[x1+TLt*.55,cy+th*.05],[x1+TLt*.42,cy+th*.62],[x1-1,cy+ph]];break;
    case'point':tp=[[x1-1,cy-ph],[x2,cy],[x1-1,cy+ph]];break;
    default:tp=[[x1-1,cy-ph],[x2,cy-th],[x2-TLt*.08,cy-th*.88],[x1+TLt*.45,cy],[x2-TLt*.08,cy+th*.88],[x2,cy+th],[x1-1,cy+ph]]}
  N.poly(tp,fcol,1);if(P.tail!=='point')for(let y=0;y<H0;y++)for(let x=Math.floor(x2-2);x<=Math.ceil(x2);x++)if(N.get(x,y)&&!N.get(x+1,y))N.px(x,y,fin[1],1);
  // dorsal and anal fins: solid membrane, spiky crest for spiny fins
  const finAt=(u0,u1,hh,kind,top)=>{for(let x=Math.floor(x0+u0*BL);x<=Math.ceil(x0+u1*BL);x++){const u=(x+.5-x0)/BL,s=clamp((u-u0)/Math.max(.001,u1-u0),0,1);let hgt;
      switch(kind){case'spiny':hgt=Math.min(1,s*3.5)*(1-s*.35);break;case'shark':hgt=s<.4?s/.4:Math.pow(Math.max(0,1-(s-.4)/.6),1.3);break;case'spine':hgt=1;break;case'sail':hgt=Math.min(1,s*6)*(1-s*.5);break;case'filament':hgt=s<.3?Math.min(1,s*5):Math.max(.25,1-(s-.3)*1.3);break;case'rays':hgt=Math.min(1,s*3)*(.75+.25*Math.abs(Math.sin(s*12)));break;case'low':hgt=.75;break;default:hgt=Math.sin(Math.min(1,s)*Math.PI)*.85+(s<.5?.15:0)}
      const fh=hgt*hh*H*1.8*(P.flat?.85:1);if(fh<.7)continue;const base=top?topAt(Math.min(1,u)):botAt(Math.min(1,u));const n=Math.max(1,Math.round(fh));
      for(let k=0;k<n;k++){if((kind==='spiny'||kind==='rays'||kind==='filament')&&k===n-1&&n>=3&&x%2===1)continue;const sk=kind==='shark'?Math.round(k*.55):0;const y=top?Math.floor(base)-k:Math.floor(base)+k+1;
        N.px(x+sk,y,k===n-1?fin[1]:(kind==='rays'||kind==='filament')&&x%2===0?pcR[2]:fin[x%2===0&&kind!=='shark'?3:2],1)}}};
  const pcR=ramp5(A.pc==='#000'?A.fin:A.pc);
  if(!P.nofin){for(const d of P.dor)finAt(d[0],d[1],d[2],d[3],true);for(const d of P.anal)finAt(d[0],d[1],d[2],d[3],false)}
  // body with three-tone counter-shading, dithered seams and a light from the top-left
  for(let x=Math.floor(x0);x<=Math.ceil(x1);x++){const u=(x+.5-x0)/BL;if(u<0||u>1.03)continue;const t=topAt(Math.min(u,1)),b=botAt(Math.min(u,1));
    for(let y=Math.floor(t);y<=Math.ceil(b);y++){if(y+.5<t||y+.5>b+.4)continue;const v=((y+.5)-t)/Math.max(.5,b-t)*2-1;let base=v<-.28?back:v<.4?side:bel;if(P.belly==='shark'&&v>.15)base=bel;
      const b1=Math.abs(v+.28),b2=Math.abs(v-.4);if(b1<.12&&dith(x,y)<.5-b1*3.5)base=v<-.28?side:back;if(b2<.12&&dith(x,y)<.5-b2*3.5)base=v<.4?bel:side;
      let lit=-v*.55-u*.2+.18;if(v<-.82)lit+=.45;if(v>.8)lit-=.7;if(u<.06)lit-=.15;N.px(x,y,rampPick(base,lit),2)}}
  if(P.beak){const n=P.beak*BL;for(let i=1;i<=n;i++){N.px(x0-i,cy-1,back[2],2);if(i<n*.8)N.px(x0-i,cy,'#d8d0b0',2)}}
  if(P.bill){const n=P.bill*BL;for(let i=1;i<=n;i++)N.px(x0-i,cy-H*.15-(i<2?1:0),i<n*.5?back[2]:back[3],2)}
  if(P.saw){const n=P.saw*BL;for(let i=1;i<=n;i++){N.px(x0-i,cy-1,back[2],2);N.px(x0-i,cy,back[1],2);if(i%3===1){N.px(x0-i,cy-2,'#f4f0e4',2);N.px(x0-i,cy+1,'#f4f0e4',2)}}}
  if(P.snout){const n=P.snout*BL;for(let i=1;i<=n;i++){N.px(x0-i,cy-H*.12,side[2],2);N.px(x0-i,cy-H*.12+1,side[3],2)}}
  // pattern
  const pc=ramp5(A.pc==='#000'?A.back:A.pc);
  for(let x=Math.floor(x0);x<=Math.ceil(x1);x++){const u=(x+.5-x0)/BL;if(u<0||u>1)continue;const t=topAt(u),b=botAt(u);for(let y=Math.floor(t)+1;y<Math.ceil(b);y++){if(!N.get(x,y))continue;const v=((y+.5)-t)/Math.max(.5,b-t)*2-1;let on=0;const hh=hash2(x,y,7);
      switch(A.pat){case'stripes':on=Math.abs(((v+1)*3)%1-.5)<.14&&v>-.85&&v<.6&&u>.22;break;case'bars':{const n=A.shape==='disc'||A.shape==='idol'||A.shape==='clown'?3:A.shape==='deep'?5:6;on=u>.2&&Math.abs((u*n+.25)%1-.5)<.17;break}
        case'spots':on=hh<.12&&u>.18&&v<.7&&v>-.85;break;case'lat':on=Math.abs(v+.02)<.14&&u>.15;break;case'scales':on=((x+(y%2)*2)%4===0)&&(y%2===0)&&v>-.7&&v<.65&&u>.2;break;
        case'band':on=u>.42&&u<.6;break;case'tang':on=Math.abs(v+.05-.3*Math.sin(u*5.5))<.2&&u>.25&&u<.9;break;case'clown':{const d=Math.min(Math.abs(u-.22),Math.abs(u-.52),Math.abs(u-.9));on=d<.06?1:d<.095?2:0;break}
        case'dory':{const r=Math.hypot((u-.5)*BL,(v-.05)*(b-t)/2);on=r<BL*.08?1:r<BL*.11?2:0;break}case'blotch':on=vnoise(x,y,3,5)>.6&&v<.8;break;
        case'glow':on=v>.4&&v<.72&&(x%3===0)&&u>.15;break;case'wavy':on=v<-.15&&Math.abs(Math.sin(u*26+v*6))<.28;break;case'oblique':on=v<-.05&&Math.abs(((u*5+v*1.3)%1)-.5)<.15;break;
        case'belly':on=v>.1&&Math.abs(((v-.1)*4.5)%1-.5)<.16;break;case'shoulder':on=u>.18&&u<.32&&v<-.05&&v>-.8;break;case'harness':on=(Math.abs(u-.3)<.06||Math.abs(u-.62)<.05||(Math.abs(v+.5)<.16&&u>.3&&u<.62))&&v<.4;break;
        case'lines':on=Math.abs(Math.sin(u*20+Math.sin(v*4)*2))<.2&&u<.65;break;case'prism':on=3;break}
      if(!on)continue;if(on===3){N.px(x,y,hslToHex(u*300+v*90+200,.7,.7),3);continue}if(on===2){N.px(x,y,A.pat==='clown'?'#1e1a20':pc[4],3);continue}
      N.px(x,y,A.pat==='glow'?(x%2?'#ffffff':A.pc):rampPick(pc,-v*.6+.15),3)}}
  // fins on the side and below
  if(!P.nofin){const px0=x0+.27*BL,py0=cy+H*.15,pl=(P.pect||1)*BL*.13;
    if(P.wing)N.poly([[px0,py0-1],[px0+BL*.5,py0-H*1.9],[px0+BL*.78,py0-H*1.1],[px0+BL*.3,py0+1]],(x,y)=>((x+y)%2?fin[1]:fin[0]),5);
    else if(P.pectK==='rays'){for(let i=0;i<7;i++){const a=-.6+i*.3;N.line(px0,py0,px0+Math.cos(a)*pl*1.5,py0+Math.sin(a)*pl*1.1+pl*.35,i%2?fin[1]:pc[2],1,5)}}
    else N.poly([[px0,py0-1.2],[px0+pl,py0+pl*.3],[px0+pl*.7,py0+pl*.75],[px0,py0+1.2]],(x,y)=>(y%2?fin[2]:fin[1]),5);
    if(P.pelvic)N.poly([[x0+P.pelvic*BL,botAt(P.pelvic)-.5],[x0+(P.pelvic+.12)*BL,botAt(P.pelvic)+H*.5],[x0+(P.pelvic+.14)*BL,botAt(P.pelvic+.1)-.5]],fin[3],1);
    if(P.thread)for(let i=0;i<3;i++)N.line(px0+i,botAt(.28),px0+i+3,botAt(.28)+H*.9,side[1],1,4);
    if(P.yfin){N.poly([[x0+.56*BL,topAt(.56)+.5],[x0+.72*BL,topAt(.56)-H*1.3],[x0+.65*BL,topAt(.62)+.5]],'#f0d040',1);N.poly([[x0+.6*BL,botAt(.6)-.5],[x0+.76*BL,botAt(.6)+H*1.3],[x0+.69*BL,botAt(.66)-.5]],'#f0d040',1)}
    if(P.finlets)for(let i=0;i<4;i++){const u=.8+i*.05;N.px(x0+u*BL,topAt(u)-1,'#f0d040',1);N.px(x0+u*BL,botAt(u)+1,'#f0d040',1)}}
  // gill line, mouth (eye comes after any rotation)
  const gu=A.shape==='shark'||A.shape==='saw'?.2:.22;
  if(P.gills>0){for(let i=0;i<P.gills;i++){const x=Math.round(x0+(gu+i*.022)*BL);for(let y=Math.round(cy-H*.35);y<=Math.round(cy+H*.12);y++)if(N.get(x,y))N.px(x,y,back[4],4)}}
  else if(A.shape!=='chimaera'){const gx=x0+gu*BL;for(let y=Math.round(topAt(gu)+H*.3);y<=Math.round(botAt(gu)-H*.25);y++){const k=(y-cy)/H;const x=Math.round(gx-Math.abs(k)*BL*.05);if(N.get(x,y))N.px(x,y,rampPick(side,-.65),4)}}
  if(P.mouth==='big'||P.mouth==='angler'){const w=P.mouth==='angler'?BL*.3:BL*.15;const my=cy+H*(P.mouth==='angler'?.2:.1);for(let i=0;i<w;i++){N.px(x0+i,my,'#2a1418',4);if(P.mouth==='angler'&&i%2===0){N.px(x0+i,my-1,'#f4f0e8',4);N.px(x0+i+1,my+1,'#f4f0e8',4)}}}
  else if(P.mouth==='lips'){N.px(x0,cy+H*.02,'#c88080',4);N.px(x0+1,cy+H*.02,'#c88080',4);N.px(x0,cy+H*.2,'#2a1418',4)}
  else if(P.mouth==='beak'){N.px(x0,cy,'#f0f0e0',4);N.px(x0+1,cy,'#f0f0e0',4);N.px(x0,cy+H*.18,'#2a1418',4)}
  else if(!P.beak&&!P.bill&&!P.saw&&!P.snout){N.px(x0+(P.mouth==='small'?0:1),cy+H*(P.flat?.1:.16),rampPick(side,-.75),4)}
  if(P.fringe)for(let i=0;i<5;i++)N.px(x0+1+i*1.5,botAt(.06+i*.025)+1,back[1],4);
  const feat={eye:[x0+P.eye*BL,cy+P.ey*H*(P.flat?.75:1)],er:Math.max(1,BL*.055*(P.es||1)),eyeCol:P.eyeCol||(P.belly==='shark'?'#2a2a30':'#f0e6b0'),lure:P.lure?[x0+BL*.25,topAt(.25),x0-2,topAt(.25)-H*.95]:null,odd:P.odd?[[x0+.36*BL,cy-.35*H],[x0+.56*BL,cy+.12*H]]:null,crown:P.crown?[x0+BL*.18,topAt(.18)-1]:null,pc:A.pc,back:A.back};
  return{N,feat,len:L+(P.saw||P.bill||P.beak?0:0),H,BL,aspect:(L)/(2*H*(1+(P.dor[0]?P.dor[0][2]:0)*.6))}}
function drawEye(N,x,y,r,col){if(r<1.6){N.px(x,y,'#141018',6);if(r>1.2)N.px(x+1,y,'#141018',6);N.px(x,y-1,mix('#141018',col,.4),5);return}for(let yy=Math.floor(y-r);yy<=Math.ceil(y+r);yy++)for(let xx=Math.floor(x-r);xx<=Math.ceil(x+r);xx++){const d=Math.hypot(xx+.5-x,yy+.5-y)/r;if(d>1)continue;N.px(xx,yy,d>.82?'#1a1418':d>.48?col:'#141018',6)}N.px(Math.floor(x-r*.3),Math.floor(y-r*.3),'#ffffff',7)}
// pose and finish a fish at size S (tilted when long and thin)
function drawFish(A,S){const P=FISHP[A.shape]||FISHP.torp;const hk=A.ex.reduce((m,e)=>m*((FISHX[e]&&FISHX[e].hk)||1),1);const asp=1/(P.h*hk)*(1+(P.tl||.2));const tilt=asp>2.6;
  if(!tilt){let L=S*.94,fb;for(let k=0;k<8;k++){fb=fishBody(A,S,S,L);const bb=bboxPN(fb.N);if(bb.w<=S-2&&bb.h<=S-2&&bb.x0>=1&&bb.y0>=1&&bb.x1<=S-2&&bb.y1<=S-2)break;L*=.94}const f=fb.feat;drawEye(fb.N,f.eye[0],f.eye[1],f.er*1.0,f.eyeCol);extras(fb.N,f,(x,y)=>[x,y]);fb.N.outline();return fb.N}
  const ang=Math.atan(.62)*(asp>4.5?1.08:asp>3.4?1:.9);const SW=Math.ceil(S*1.6),SH=S;let L=SW*.9,fb,O,bb;
  for(let k=0;k<12;k++){fb=fishBody(A,SW,SH,L);O=rotPN(fb.N,ang,S+8,S+8);bb=bboxPN(O);if(bb.w<=S-3&&bb.h<=S-3)break;L*=.95}
  const ox=Math.round((S+8)/2-(bb.x0+bb.x1+1)/2),oy=Math.round((S+8)/2-(bb.y0+bb.y1+1)/2)+0;O=rotPN(fb.N,ang,S,S,ox,oy);const tf=(x,y)=>rotPt(x,y,ang,SW,SH,S,S,ox,oy);
  const f=fb.feat;const[ex,ey]=tf(f.eye[0],f.eye[1]);drawEye(O,ex,ey,f.er,f.eyeCol);extras(O,f,tf);O.outline();return O}
function extras(N,f,tf){if(f.lure){const[a,b]=tf(f.lure[0],f.lure[1]),[c,d]=tf(f.lure[2],f.lure[3]);N.line(a,b,c,d,'#6a5a6a',1,4);N.ell(c-.5,d-.5,1.7,1.7,(nx,ny,l)=>l>.25?'#ffffff':f.pc==='#000'?'#8af0ff':f.pc,6)}
  if(f.odd)for(const[x,y]of f.odd){const[a,b]=tf(x,y);N.ell(a,b,1.6,1.6,(nx,ny)=>Math.hypot(nx,ny)>.65?'#1a1418':'#ff7a6b',6);N.px(a-1,b-1,'#ffffff',7)}
  if(f.crown){const[a,b]=tf(f.crown[0],f.crown[1]);for(let i=-2;i<=2;i++){N.px(a+i,b,'#ffd24d',8);if(i%2===0)N.px(a+i,b-1,'#ffd24d',8)}N.px(a,b-2,'#fff3b0',8)}}

/* ---------------- creatures that are not fish-shaped ---------------- */
const CREATURE={
  crab(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),cx=S/2,cy=S*.56,blue=A.back.startsWith('#4a7');
    // legs: three each side, jointed, the back pair as paddles on swimmer crabs
    for(const sd of[-1,1])for(let i=0;i<3;i++){const ay=cy+(i-.6)*3.2*k,ax=cx+sd*7*k;const kx=ax+sd*(5+i)*k,ky=ay-(1-i)*1.5*k+2*k;const fx=kx+sd*(2.5+i*.6)*k,fy=ky+(4+i*.6)*k;N.line(ax,ay,kx,ky,c[3],Math.max(1,Math.round(1.6*k)),1);N.line(kx,ky,fx,fy,c[3],Math.max(1,Math.round(1.2*k)),1);if(blue&&i===2)N.ell(fx,fy,2.2*k,1.4*k,l,2)}
    // claws on arms reaching forward
    for(const sd of[-1,1]){const ax=cx+sd*6*k,ay=cy-3*k,ex=cx+sd*9.5*k,ey=cy-8*k;N.line(ax,ay,ex,ey,c[2],Math.round(2*k),1);N.ell(ex+sd*1.5*k,ey-3*k,3.6*k,4.2*k,c,3);N.poly([[ex+sd*.5*k,ey-6.5*k],[ex+sd*1.5*k,ey-9.5*k],[ex+sd*2.6*k,ey-6*k]],c[1],4);N.poly([[ex+sd*2*k,ey-6*k],[ex+sd*4.2*k,ey-8.5*k],[ex+sd*4.4*k,ey-4.5*k]],c[2],4);N.px(ex+sd*1.2*k,ey-6*k,mix(c[4],'#000',.3),5)}
    // carapace: wide, with side points on swimmer crabs
    N.ell(cx,cy,8.5*k,6*k,(nx,ny,lit)=>rampPick(c,lit+(ny<-.5?.2:0)),5);if(blue){N.poly([[cx-8*k,cy-1*k],[cx-12*k,cy-2.5*k],[cx-8*k,cy+1.5*k]],c[2],5);N.poly([[cx+8*k,cy-1*k],[cx+12*k,cy-2.5*k],[cx+8*k,cy+1.5*k]],c[3],5)}
    if(A.pat==='spots')for(let i=0;i<9;i++){const a=hash2(i,3,9)*6.28,r=hash2(i,4,9)*.8;N.px(cx+Math.cos(a)*r*7*k,cy+Math.sin(a)*r*4.5*k,l[0],6)}
    for(const sd of[-1,1]){N.px(cx+sd*2.5*k,cy-6.5*k,c[3],6);N.px(cx+sd*2.5*k,cy-7.5*k,'#141018',6)}N.line(cx-3*k,cy+2*k,cx+3*k,cy+2*k,c[3],1,6);return N.outline()},
  lobster(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),cx=S/2;
    for(const sd of[-1,1]){N.line(cx+sd*2*k,9*k,cx+sd*11*k,1*k,c[1],1,0);N.line(cx+sd*11*k,1*k,cx+sd*14*k,6*k,c[1],1,0);N.line(cx+sd*1.5*k,9*k,cx+sd*5*k,3*k,c[2],1,0)}
    for(const sd of[-1,1])for(let i=0;i<4;i++){const y=(12+i*2.4)*k;N.line(cx+sd*3*k,y,cx+sd*(8+i*.4)*k,y+3*k,c[3],1,1);N.line(cx+sd*(8+i*.4)*k,y+3*k,cx+sd*(8.5+i*.6)*k,y+6*k,c[3],1,1)}
    N.ell(cx,12*k,4.4*k,6*k,c,3);for(let i=0;i<5;i++){const y=(17.5+i*2.4)*k,w=(4-i*.45)*k;N.ell(cx,y,w,1.6*k,(nx,ny,lit)=>rampPick(c,lit+(ny<0?.25:-.2)),4)}
    N.poly([[cx,28*k],[cx-5*k,31*k],[cx-1.5*k,29*k]],c[1],4);N.poly([[cx,28*k],[cx+5*k,31*k],[cx+1.5*k,29*k]],c[2],4);N.poly([[cx-1.5*k,28*k],[cx+1.5*k,28*k],[cx,31.5*k]],c[1],4);
    for(let i=0;i<6;i++)N.px(cx+(hash2(i,1,4)-.5)*6*k,(8+hash2(i,2,4)*8)*k,l[0],5);N.px(cx-2*k,7*k,'#141018',6);N.px(cx+2*k,7*k,'#141018',6);return N.outline()},
  squid(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),big=A.ex.includes('legend');
    // mantle up and to the right, fins at the tip, arms trailing down-left
    const ax=21*k,ay=9*k,bx=12*k,by=19*k;
    for(let i=0;i<8;i++){const a=2.1+i*.13,len=(7+hash2(i,1,5)*3)*k;N.tube(t=>[bx-1*k+Math.cos(a)*len*t+Math.sin(t*5+i)*1.2*k,by+1*k+Math.sin(a)*len*t*.9+t*2*k],t=>Math.max(.5,1.2*k*(1-t*.8)),(t,sd,lit)=>i%2&&t>.3&&t<.9&&sd>.4?l[0]:rampPick(c,lit-.2),18,1)}
    for(const sd of[0,1]){const a=2.3+sd*.4;N.tube(t=>[bx+Math.cos(a)*14*k*t+Math.sin(t*4)*1.5*k,by+Math.sin(a)*11*k*t+t*t*4*k],t=>t>.85?1.3*k:.6*k,(t,s2,lit)=>rampPick(c,lit-.3),26,1)}
    N.tube(t=>[bx+(ax-bx)*t,by+(ay-by)*t],t=>(t<.15?3.6+t*4:4.2*(1-Math.pow(Math.max(0,t-.2)/.8,1.8)*.85))*k,(t,sd,lit)=>rampPick(c,lit+(sd<0?.2:-.1)),40,3);
    N.poly([[ax-2*k,ay+4.5*k],[ax+5.5*k,ay-2*k],[ax+1*k,ay-1*k]],c[1],2);N.poly([[ax-5*k,ay+.5*k],[ax+.5*k,ay-6.5*k],[ax-.5*k,ay-1.5*k]],c[2],2);
    for(let i=0;i<10;i++){const t=hash2(i,2,6)*.8+.15;N.px(bx+(ax-bx)*t+(hash2(i,3,6)-.5)*4*k,by+(ay-by)*t+(hash2(i,4,6)-.5)*4*k,A.pc==='#000'?c[3]:A.pc,5)}
    drawEye(N,bx+.5*k,by-1.2*k,1.8*k,big?'#ffd24d':'#e8e0f0');return N.outline()},
  cuttle(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),cx=S*.56,cy=S*.5;
    for(let i=0;i<8;i++){const y=cy+(i-3.5)*1.1*k;N.line(cx-10*k,y,cx-14*k-(i%3)*k,y+(i-3.5)*.6*k,c[3],1,1)}
    N.ell(cx,cy,11.5*k,7.5*k,(nx,ny,lit)=>Math.hypot(nx,ny)>.84?(((nx*12|0)+(ny*12|0))%2?l[0]:l[1]):rampPick(c,lit),2);
    if(A.pat==='bars')for(let x=Math.floor(cx-7*k);x<cx+9*k;x++)for(let y=Math.floor(cy-5*k);y<cy+5*k;y++){if(Math.abs(Math.sin(x*.9*(32/S)+y*.3))<.25&&N.get(x,y))N.px(x,y,c[4],3)}
    const ex=cx-6*k,ey=cy-2.5*k;N.ell(ex,ey,2*k,1.6*k,'#f0e0b0',4);N.px(ex-.5*k,ey,'#141018',5);N.px(ex+.5*k,ey+.5,'#141018',5);N.px(ex,ey+.5*k,'#141018',5);return N.outline()},
  octo(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),cx=S/2,cy=S*.36,big=A.ex.includes('legend');
    for(let i=0;i<8;i++){const sd=i<4?-1:1,j=i%4;const a0=Math.PI/2+sd*(.25+j*.32);N.tube(t=>[cx+Math.cos(a0)*(4+t*11)*k+sd*Math.sin(t*6+j)*2*k,cy+5*k+Math.sin(a0)*(3+t*13)*k-Math.max(0,t-.7)*6*k],t=>Math.max(.55,2.2*k*(1-t*.85)),(t,s2,lit)=>(s2>.35&&((t*20|0)%2)&&t<.85)?l[0]:rampPick(c,lit-.15),34,1)}
    N.ell(cx,cy,7.5*k,8.5*k,(nx,ny,lit)=>rampPick(c,lit+.05),3);if(A.pat==='spots')for(let i=0;i<10;i++){const a=hash2(i,7,3)*6.28,r=hash2(i,8,3)*.75;N.px(cx+Math.cos(a)*r*6*k,cy+Math.sin(a)*r*7*k-1*k,A.pc,4)}
    for(const sd of[-1,1]){N.ell(cx+sd*3.5*k,cy+3.5*k,1.6*k,1.6*k,big?'#ffd24d':'#f0e0b0',5);N.rect(cx+sd*3.5*k-1*k,cy+3.5*k,Math.max(1,2*k),1,'#141018',6)}if(big){for(let i=-2;i<=2;i++)N.px(cx+i*k,cy-9*k,'#ffd24d',6);N.px(cx,cy-10*k,'#fff3b0',6)}return N.outline()},
  seahorse(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side);const sp=t=>{const a=t*Math.PI*1.25;return[S*.5+Math.sin(a)*4.5*k-(t>.75?(t-.75)*16*k:0),S*.12+t*20*k+(t>.8?-(t-.8)*25*k:0)]};
    N.tube(t=>{if(t<.78)return sp(t/.78*.78);const q=(t-.78)/.22;const[bx,by]=sp(.78);return[bx-Math.sin(q*Math.PI*1.4)*4*k,by+Math.sin(q*Math.PI*.9)*5*k-q*q*2*k]},t=>Math.max(.6,(t<.1?2.6+t*8:t<.55?3.4+Math.sin((t-.1)/.45*Math.PI)*1.8:3.2*(1-(t-.55)/.45*.8))*k),(t,sd,lit)=>((t*26|0)%3===0&&t>.12)?c[3]:rampPick(c,lit+(sd<0?.2:0)),70,2);
    const[hx,hy]=sp(.03);N.line(hx-2*k,hy+1*k,hx-7*k,hy+3*k,c[2],Math.max(1,Math.round(2*k)),3);N.poly([[hx+1*k,hy-3*k],[hx+3*k,hy-5*k],[hx+3*k,hy-2*k]],c[1],3);
    const[fx,fy]=sp(.45);N.poly([[fx+3*k,fy-2*k],[fx+7*k,fy],[fx+3*k,fy+4*k]],(x,y)=>y%2?l[1]:l[0],1);drawEye(N,hx,hy,1.4*k,'#f0e6b0');return N.outline()},
  dragon(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.fin),pc=ramp5(A.pc);const sp=t=>[4*k+t*24*k,S*.45+Math.sin(t*Math.PI*1.6)*4*k+(t>.85?(t-.85)*20*k:0)];
    for(let i=0;i<7;i++){const t=.15+i*.11;const[x,y]=sp(t);const up=i%2;N.poly([[x,y],[x+(up?2:-1)*k,y+(up?-6:6)*k],[x+3*k,y+(up?-4:4)*k]],(xx,yy)=>((xx+yy)%2?l[1]:l[2]),1)}
    N.tube(sp,t=>Math.max(.6,(t<.12?1.2:t<.5?2.6:2.6*(1-(t-.5)*1.7))*k),(t,sd,lit)=>((t*18|0)%3===0)?pc[2]:rampPick(c,lit),60,2);const[hx,hy]=sp(.12);N.line(hx-1*k,hy,hx-5*k,hy+1*k,c[3],1,3);drawEye(N,hx+1*k,hy-1*k,1.2*k,'#f0e6b0');return N.outline()},
  ray(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),cx=S*.45,cy=S*.4,eagle=A.ex.includes('eagle');
    N.tube(t=>[cx+3*k+t*13*k,cy+6*k+t*14*k+Math.sin(t*4)*1.2*k],t=>Math.max(.5,(1-t)*1.4*k),(t)=>t<.1?c[3]:c[4],44,0);
    const shape=(x,y)=>{const nx=(x+.5-cx)/(13*k),ny=(y+.5-cy)/(9.5*k);if(eagle){const w=Math.abs(nx);return ny>-.55+w*.25&&ny<.75-w*.85&&w<1}const ax=Math.abs(nx);return Math.pow(ax,1.5)+Math.pow(Math.abs(ny+(ny<0?ax*.25:0)),1.7)<=1&&!(ny<-.7&&ax<.08)};
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){if(!shape(x,y))continue;const nx=(x+.5-cx)/(13*k),ny=(y+.5-cy)/(9.5*k);let lit=-ny*.7-nx*.25+.05-Math.abs(nx)*.35;const rim=!shape(x-1,y)||!shape(x+1,y)||!shape(x,y-1)||!shape(x,y+1);N.px(x,y,rim?l[2]:rampPick(c,lit),2)}
    if(eagle)N.ell(cx,cy-6.5*k,2.4*k,2.6*k,c,3);
    if(A.pat==='spots')for(let i=0;i<18;i++){const x=cx+(hash2(i,1,8)-.5)*20*k,y=cy+(hash2(i,2,8)-.5)*10*k;if(N.get(x,y))N.px(x,y,A.pc,3)}
    for(const sd of[-1,1]){N.px(cx+sd*2.2*k,cy-3*k,'#141018',4);N.px(cx+sd*2.2*k,cy-2*k,l[1],4)}return N.outline()},
  guitar(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),pc=ramp5(A.pc==='#000'?A.back:A.pc);const ang=Math.atan(.8);const tf=(x,y)=>[S/2+(x)*Math.cos(ang)-(y)*Math.sin(ang),S/2+(x)*Math.sin(ang)+(y)*Math.cos(ang)];
    const P2=pts=>pts.map(([x,y])=>tf(x*k,y*k));
    N.poly(P2([[13,-1],[19,-4.5],[18,0],[19,4.5],[13,1]]),c[3],1);
    N.poly(P2([[-16,0],[-12,-4],[-7,-8],[-1,-7.5],[2,-3],[13,-1.6],[14,0],[13,1.6],[2,3],[-1,7.5],[-7,8],[-12,4]]),(x,y)=>{const[u,v]=[(x-S/2)*Math.cos(-ang)-(y-S/2)*Math.sin(-ang),(x-S/2)*Math.sin(-ang)+(y-S/2)*Math.cos(-ang)];return rampPick(c,-v*.09/k-u*.025/k+.15)},2);
    for(const[a,b]of[[4,7.5],[9,11.5]])N.poly(P2([[a,-.6],[a+1.6,-5],[b,-.6]]),c[3],3);
    if(A.pat==='lines')for(let i=0;i<50;i++){const t=i/50;const[x,y]=tf((-13+t*14)*k,Math.sin(t*14)*3.2*k);N.px(x,y,pc[2],4)}
    const[e1x,e1y]=tf(-9*k,-2*k),[e2x,e2y]=tf(-9*k,2*k);N.px(e1x,e1y,'#141018',5);N.px(e2x,e2y,'#141018',5);return N.outline()},
  eel(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),l=ramp5(A.side),nofin=A.ex.includes('nofin');const sp=t=>[4*k+t*25*k,S*.42+Math.sin(t*Math.PI*2.1)*5.5*k*(0.4+t*.6)];
    if(!nofin)N.tube(sp,t=>t<.25?0:(2.6+.9)*k*(1-t*.45),(t,sd)=>sd<0?l[1]:c[3],70,1);
    N.tube(sp,t=>Math.max(.6,(t<.08?1.4+t*12:2.6*(1-Math.pow(t,2.5)*.85))*k),(t,sd,lit)=>{const v=rampPick(c,lit+(sd<0?.25:-.1));return A.pat==='spots'&&hash2(Math.round(t*90),Math.round(sd*3),3)<.25?ramp5(A.pc)[1]:v},90,2);
    const[hx,hy]=sp(.04);N.line(hx-1*k,hy+1*k,hx+3*k,hy+1.5*k,'#2a1418',1,4);drawEye(N,hx+1.5*k,hy-1*k,1.1*k,'#f0e6b0');return N.outline()},
  ribbon(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),sp=t=>[3*k+t*26*k,S*.62-t*14*k+Math.sin(t*Math.PI*2)*3*k];
    N.tube(sp,t=>t<.1?0:2.4*k*(1-t*.4),(t,sd)=>sd<0?ramp5(A.fin)[1]:null,60,1);N.tube(sp,t=>Math.max(.6,(t<.06?1+t*16:1.8*(1-Math.pow(t,3)*.7))*k),(t,sd,lit)=>rampPick(c,lit+(sd<0?.4:-.2)),80,2);
    const[hx,hy]=sp(.03);N.px(hx-.5*k,hy+1*k,'#ffffff',4);N.px(hx+1*k,hy+1.2*k,'#ffffff',4);drawEye(N,hx+1.6*k,hy-.6*k,1.3*k,'#e8e8f0');return N.outline()},
  oar(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),sp=t=>[2*k+t*28*k,S*.66-t*20*k+Math.sin(t*Math.PI*2.4)*3*k];
    N.tube(sp,t=>Math.max(.6,(t<.05?1.5+t*20:2.6*(1-Math.pow(t,2)*.7))*k),(t,sd,lit)=>{if(sd<-.55&&t>.06)return'#e04a4a';return hash2(Math.round(t*70),Math.round(sd*4),5)<.18?ramp5(A.pc)[2]:rampPick(c,lit+(sd<0?.3:-.1))},90,2);
    const[hx,hy]=sp(.02);for(let i=0;i<5;i++)N.line(hx+1*k,hy-1*k,hx+(1+i)*k,hy-(5+i*.6)*k,'#e04a4a',1,3);drawEye(N,hx+.5*k,hy,1.2*k,'#e8e8f0');return N.outline()},
  gulper(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),sp=t=>[5*k+t*24*k,S*.38+t*12*k+Math.sin(t*9)*1.5*k*t];
    N.tube(sp,t=>Math.max(.5,(t<.35?6-t*12:1.8*(1-t))*k),(t,sd,lit)=>rampPick(c,lit*.7),80,2);const[hx,hy]=sp(.02);N.poly([[hx-2*k,hy-1*k],[hx+9*k,hy+1*k],[hx-2*k,hy+5*k]],'#120a14',4);N.line(hx-2*k,hy-1.5*k,hx+9*k,hy+.5*k,c[1],1,5);
    const[tx,ty]=sp(1);N.ell(tx,ty,1.4*k,1.4*k,'#ff7aa0',3);drawEye(N,hx-.5*k,hy-3*k,.9*k,'#8af0ff');return N.outline()},
  wobbe(A,S){const N=PN(S,S),k=S/32,c=ramp5(A.back),pc=ramp5(A.pc);const ang=Math.atan(.8);const tf=(x,y)=>[S/2+x*Math.cos(ang)-y*Math.sin(ang),S/2+x*Math.sin(ang)+y*Math.cos(ang)];const P2=pts=>pts.map(([x,y])=>tf(x*k,y*k));
    N.poly(P2([[-14,-5],[-10,-7],[-4,-6],[0,-11],[3,-5],[8,-3],[12,-2],[16,-3],[17,0],[16,3],[12,2],[8,3],[3,5],[0,11],[-4,6],[-10,7],[-14,5],[-15,0]]),(x,y)=>{const v=vnoise(x,y,2.2,9);return v>.58?pc[2]:v<.3?c[3]:c[2]},2);
    for(let i=0;i<7;i++){const[x,y]=tf(-15*k,(i-3)*1.6*k);N.px(x-1,y,c[1],3)}for(const sd of[-1,1]){const[x,y]=tf(-10*k,sd*3*k);N.px(x,y,'#141018',4)}return N.outline()}};
CREATURE.saw=null;

/* ---------------- finds: treasure, coral, shells, pearls, curios, sets, junk (32x32) ---------------- */
const GOLD=ramp5('#e0aa30'),BRASS=ramp5('#c89a48'),SILVER=ramp5('#b8bcc8'),IRON=ramp5('#5a5a66'),WOOD=ramp5('#9a6a42'),RUST=ramp5('#9a5a3a');
const cyl=(N,x0,y0,x1,y1,r,rp,z=2)=>N.tube(t=>[x0+(x1-x0)*t,y0+(y1-y0)*t],()=>r,(t,sd,lit)=>rampPick(rp,-sd*.9+.1),Math.ceil(Math.hypot(x1-x0,y1-y0))*2+2,z);
function boxShape(N,x,y,w,h,d,front,top,side,z=2){N.poly([[x,y+d],[x+d,y],[x+d+w,y],[x+w,y+d]],(xx,yy)=>rampPick(top,.3+(xx-x)/w*.1),z);N.rect(x,y+d,w,h,(i,j)=>rampPick(front,-.05-j/h*.3),z);N.poly([[x+w,y+d],[x+w+d,y],[x+w+d,y+h],[x+w,y+h+d]],(xx,yy)=>rampPick(side,-.5),z)}
const FIND={
  crate(N){boxShape(N,5,10,19,15,5,WOOD,WOOD,WOOD);for(let j=0;j<3;j++)N.rect(5,15+j*5,19,1,WOOD[4],3);N.line(6,15,23,29,WOOD[3],1,3);for(let i=0;i<6;i++)N.px(7+hash2(i,1,2)*15,16+hash2(i,2,2)*8,i%2?'#e8e0c8':'#6a9a5a',4)},
  tackle(N){const G=ramp5('#4a8a5a');boxShape(N,4,13,22,12,4,G,G,G);N.rect(4,19,22,1,G[4],3);N.rect(13,18,4,3,SILVER[1],4);N.line(11,13,13,8,IRON[2],1,1);N.line(13,8,19,8,IRON[2],1,1);N.line(19,8,21,13,IRON[2],1,1);N.px(8,12,'#e04a3a',4);N.px(9,11,'#f0d040',4);N.px(22,12,'#ffffff',4)},
  chest(N,a){const b=ramp5(a[1]||'#8a5a3a'),t=ramp5(a[2]||'#c0b08a');N.ell(16,13,12,6,(nx,ny,l)=>ny>.3?null:rampPick(b,l+.2),2);N.rect(4,13,24,4,(i,j)=>rampPick(b,.1-j*.1),2);N.rect(4,17,24,10,(i,j)=>rampPick(b,-.1-j*.05),2);
    for(const x of[7,23])N.rect(x,8,3,19,(i,j)=>rampPick(t,i===0?.4:-.1),3);N.rect(4,16,24,2,(i)=>t[2],3);N.rect(14,15,4,5,t[1],4);N.px(15,17,'#141018',5);N.px(16,17,'#141018',5);N.px(15,18,'#141018',5);
    if(a[3]==='gold')for(let i=0;i<9;i++)N.ell(8+i*2,11-(i%3),1.6,1.2,GOLD,1);if(a[3]==='glow')for(let i=0;i<14;i++){const g=hash2(i,4,4);N.px(3+g*26,4+hash2(i,5,4)*6,'#8af0ff',0)}
    if(!a[3])for(let i=0;i<7;i++)N.px(5+hash2(i,1,3)*22,18+hash2(i,2,3)*8,'#e8e0c8',4)},
  lockbox(N){boxShape(N,6,13,18,11,4,IRON,IRON,IRON);N.rect(6,18,18,1,IRON[4],3);N.ell(15,24,3.5,3.5,BRASS,4);N.ell(15,24,1.6,1.6,'#2a2028',5);N.ell(15,19,2.6,3,(nx,ny,l)=>Math.hypot(nx,ny)<.6?null:rampPick(BRASS,l),3)},
  compass(N){N.ell(16,16,11,11,BRASS,1);N.ell(16,16,8.5,8.5,(nx,ny,l)=>l>.5?'#f8f4e0':'#ece4c8',2);for(let i=0;i<8;i++){const a=i/8*6.28;N.px(16+Math.cos(a)*7,16+Math.sin(a)*7,'#6a5a40',3)}N.line(16,16,20,10,'#d83a3a',1,4);N.line(16,16,12,22,'#4a4a5a',1,4);N.px(16,16,'#2a2028',5);N.ell(16,4.5,2,2,BRASS,2);N.px(13,10,'#ffffff',5)},
  spyglass(N){cyl(N,6,24,26,8,3.6,BRASS);cyl(N,4,25.5,9,21.5,2.7,BRASS,3);cyl(N,22,10.5,27,6.5,3.4,ramp5('#6a3a2a'),3);for(const t of[.35,.62]){const x=6+20*t,y=24-16*t;N.line(x-3,y-3,x+3,y+3,BRASS[4],1,4)}},
  watch(N){N.line(16,3,10,6,SILVER[2],1,1);N.line(10,6,6,4,SILVER[2],1,1);N.ell(16,6,2.2,2.2,GOLD,2);N.ell(16,18,10,10,GOLD,2);N.ell(16,18,7.5,7.5,(nx,ny,l)=>l>.5?'#fffaf0':'#f0e8d8',3);for(let i=0;i<12;i++){const a=i/12*6.28;N.px(16+Math.cos(a)*6,18+Math.sin(a)*6,'#3a3040',4)}N.line(16,18,16,13,'#2a2028',1,5);N.line(16,18,20,19,'#2a2028',1,5)},
  locket(N){for(let i=0;i<14;i++)N.px(9+i*.9,3+Math.sin(i*.5)*2+i*.4,SILVER[i%2],1);N.poly([[16,29],[6,18],[6,13],[10,10],[16,14],[22,10],[26,13],[26,18]],(x,y)=>rampPick(SILVER,-(x-16)*.05-(y-18)*.07+.1),2);N.ell(11,15,2,2,SILVER[0],3);N.line(16,15,16,25,SILVER[3],1,3)},
  strongbox(N){boxShape(N,4,12,22,13,4,IRON,IRON,IRON);for(const x of[6,15,24])N.rect(x,16,1,13,BRASS[3],3);N.rect(4,19,22,2,BRASS[2],3);for(let i=0;i<7;i++)N.px(5+i*3,17,BRASS[0],4);N.rect(13,21,4,4,BRASS[1],4);N.px(14,22,'#141018',5);N.px(15,23,'#141018',5)},
  bell(N){N.ell(16,6,3,3,(nx,ny)=>Math.hypot(nx,ny)<.5?null:BRASS[2],1);N.poly([[11,8],[21,8],[24,22],[27,25],[5,25],[8,22]],(x,y)=>rampPick(ramp5('#c08a3a'),-(x-14)*.07+.1),2);N.rect(5,24,22,2,BRASS[3],3);N.rect(9,13,14,1,BRASS[1],3);N.ell(16,27,2.4,2,IRON,2);N.px(12,11,'#fff0c0',4)},
  figurehead(N){const sk=ramp5('#c8a070'),hr=ramp5('#6a4a2a'),dr=ramp5('#4a7a8a');N.ell(16,24,11,8,(nx,ny,l)=>rampPick(dr,l),1);N.ell(16,11,6,7,(nx,ny,l)=>rampPick(sk,l),2);N.ell(14,8,7,6,(nx,ny,l)=>ny<.2||nx<-.5?rampPick(hr,l):null,3);N.tube(t=>[10-t*2,10+t*14],t=>2.2-t,(t,s,l)=>rampPick(hr,l),20,3);N.px(17,11,'#3a2a2a',4);N.px(19,11,'#3a2a2a',4);N.px(18,14,'#9a5a4a',4);for(let i=0;i<6;i++)N.px(8+hash2(i,1,5)*16,18+hash2(i,2,5)*10,'#e8e0c8',5)},
  sextant(N){for(let a=0;a<=1;a+=.02){const ang=.5+a*1.6;N.px(16+Math.cos(ang)*12,6+Math.sin(ang)*12,BRASS[a<.5?1:2],2);N.px(16+Math.cos(ang)*11,6+Math.sin(ang)*11,BRASS[3],2)}N.line(16,6,8,16,BRASS[2],2,2);N.line(16,6,24,16,BRASS[2],2,2);N.line(16,6,21,22,BRASS[1],1,3);N.rect(14,3,4,5,'#a8d0e8',4);cyl(N,6,12,11,10,1.6,IRON,3)},
  pendant(N){for(let i=0;i<20;i++){const a=i/19*Math.PI;N.px(16+Math.cos(a)*9,4+Math.sin(a)*6,'#8a5a3a',1)}N.ell(16,19,6.5,9,(nx,ny,l)=>ny<-.75&&Math.abs(nx)>.3?null:rampPick(ramp5('#3aa070'),l),2);N.ell(16,19,2,3,ramp5('#6ad0a0'),3);N.ell(16,9,1.6,1.6,GOLD,3)},
  key(N){N.ell(9,9,6,6,(nx,ny,l)=>Math.hypot(nx,ny)<.45?null:rampPick(BRASS,l),2);N.ell(9,9,1.4,1.4,BRASS[3],3);cyl(N,12,12,26,26,1.6,BRASS);N.rect(21,24,3,4,BRASS[2],2);N.rect(24,21,4,3,BRASS[2],2)},
  cutlass(N){for(let i=0;i<20;i++){const t=i/19;const x=9+t*18,y=24-t*18+Math.sin(t*3)*-2;N.px(x,y,SILVER[0],2);N.px(x+1,y+1,SILVER[2],2);N.px(x+1,y,SILVER[1],2)}N.ell(8,25,4,3,(nx,ny,l)=>Math.hypot(nx,ny)<.55?null:rampPick(BRASS,l),3);cyl(N,4,29,8,25,1.4,ramp5('#4a2a1a'),3)},
  idol(N){const G=GOLD;N.rect(9,24,14,4,(i,j)=>rampPick(G,-.3),1);N.ell(16,19,6,7,G,2);N.ell(16,10,7,7,G,3);N.rect(11,9,3,2,'#3aa070',4);N.rect(18,9,3,2,'#3aa070',4);N.rect(13,14,6,1,G[4],4);for(let i=0;i<4;i++)N.px(11+i*3,4,G[0],4)},
  crown(N){const G=GOLD;N.poly([[5,26],[5,12],[10,18],[16,8],[22,18],[27,12],[27,26]],(x,y)=>rampPick(G,-(x-12)*.05-(y-16)*.06+.1),2);N.rect(5,22,22,4,(i,j)=>rampPick(G,j<1?.6:-.3),3);for(const[x,c]of[[10,'#d83a4a'],[16,'#3a8ad8'],[22,'#3aa070']])N.ell(x,24,1.6,1.6,ramp5(c),4);N.ell(16,12,1.6,1.6,ramp5('#c83aa0'),4);for(let i=0;i<5;i++)N.px(6+hash2(i,1,6)*20,14+hash2(i,2,6)*8,'#e8e0c8',5)},
  // coral
  branch(N,a){const col=a[1],rain=a[2]==='rainbow',glow=a[2]==='glow';const R=ramp5(col);const tip=(x,y,d)=>rain?hslToHex(x*9+y*5,.7,.68):d>3?R[0]:R[1];
    const br=(x,y,ang,len,d)=>{if(d>4||len<2)return;const x2=x+Math.cos(ang)*len,y2=y+Math.sin(ang)*len;N.line(x,y,x2,y2,rain?hslToHex(x*9+y*6,.65,.6):d<2?R[2]:R[1],d<2?3:2,2);if(d>=3)N.px(x2,y2,tip(x2,y2,d),3);br(x2,y2,ang-.45-hash2(d,x|0,3)*.3,len*.72,d+1);br(x2,y2,ang+.45+hash2(d,y|0,4)*.3,len*.72,d+1)};
    N.ell(16,28,7,2,R[4],1);br(16,28,-Math.PI/2,8,0);if(glow)for(let i=0;i<12;i++)N.px(4+hash2(i,1,1)*24,4+hash2(i,2,1)*20,'#e8ffff',0)},
  brain(N,a){const R=ramp5(a[1]);N.ell(16,19,13,10,(nx,ny,l,x,y)=>Math.abs(Math.sin(x*.9+Math.sin(y*.7)*2.4))<.3?R[3]:rampPick(R,l),2)},
  plate(N,a){const R=ramp5(a[1]);for(let i=0;i<3;i++)N.ell(16+(i-1)*3,24-i*6,13-i*2.5,3.2,(nx,ny,l)=>ny>.3?R[3]:rampPick(R,l+(nx*nx>.7?-.2:.1)),2+i);N.rect(15,12,3,16,R[3],1)},
  mushroom(N,a){const R=ramp5(a[1]);N.ell(16,18,13,9,(nx,ny,l)=>{const ang=Math.atan2(ny,nx);return Math.abs(Math.sin(ang*14))<.25&&Math.hypot(nx,ny)>.2?R[3]:rampPick(R,l)},2);N.ell(16,18,2.5,1.6,R[4],3)},
  bubble(N,a){const R=ramp5(a[1]);for(let i=0;i<9;i++){const x=8+hash2(i,1,7)*16,y=12+hash2(i,2,7)*14,r=3+hash2(i,3,7)*3;N.ell(x,y,r,r,(nx,ny,l)=>l>.55?'#ffffff':rampPick(R,l),2+i%3)}},
  fan(N,a){const R=ramp5(a[1]);N.rect(15,22,3,8,R[3],1);for(let y=4;y<24;y++)for(let x=3;x<29;x++){const dx=(x-16)/13,dy=(y-24)/19;if(dx*dx+dy*dy>1)continue;if((x+y)%3===0||(x-y+40)%3===0)N.px(x,y,rampPick(R,-dy*.3-.1),2)}},
  pillar(N,a){const R=ramp5(a[1]);for(const[x,h]of[[9,18],[15,24],[21,15],[25,10]])N.tube(t=>[x+Math.sin(t*3)*.6,28-t*h],()=>2.6,(t,sd,l)=>((t*h)|0)%3===0?R[1]:rampPick(R,-sd*.8+.1),h*2,2)},
  pipe(N,a){const R=ramp5(a[1]);for(let i=0;i<9;i++){const x=6+i*2.6,h=8+hash2(i,1,9)*14;N.rect(x,28-h,2,h,(ii,j)=>j%4===0?R[1]:ii?R[3]:R[2],2);N.px(x,28-h,R[4],3);N.px(x+1,28-h,R[4],3)}N.rect(4,26,25,3,R[3],3)},
  // shells
  shfan(N,a){const R=ramp5(a[1]),D=ramp5(a[2]);N.poly([[16,28],[3,14],[6,7],[16,4],[26,7],[29,14]],(x,y)=>{const ang=Math.atan2(y-28,x-16);return Math.abs(Math.sin(ang*16))<.3?D[2]:rampPick(R,-(y-16)*.06+.1)},2);N.rect(12,27,8,3,D[2],3)},
  spiral(N,a){const R=ramp5(a[1]),D=ramp5(a[2]);for(let i=0;i<5;i++){const r=10-i*1.8;N.ell(15+i*.8,24-i*4,r,r*.62,(nx,ny,l)=>ny>.5?D[3]:rampPick(R,l),2+i)}N.ell(11,25,4,2.6,D[1],7);for(let i=0;i<5;i++)N.line(6+i*1.5,24-i*4.2,23-i*1.6,24-i*4.2,D[2],1,8)},
  dollar(N,a){const R=ramp5(a[1]),D=a[2];N.ell(16,16,12,12,R,2);for(let i=0;i<5;i++){const an=i/5*6.28-1.57;for(let r=2;r<8;r++)N.px(16+Math.cos(an)*r+Math.cos(an+1.57)*(r>4?1:0),16+Math.sin(an)*r,D,3)}N.ell(16,16,1.5,1.5,D,3)},
  star(N,a){const R=ramp5(a[1]);const pts=[];for(let i=0;i<10;i++){const an=i/10*6.28-1.57,r=i%2?5:13;pts.push([16+Math.cos(an)*r,17+Math.sin(an)*r])}N.poly(pts,(x,y)=>rampPick(R,-(x-16)*.06-(y-17)*.08+(hash2(x,y,2)<.2?.5:0)),2)},
  cowrie(N,a){const R=ramp5(a[1]),D=ramp5(a[2]);N.ell(16,17,12,9,(nx,ny,l)=>a[3]==='spots'&&hash2(Math.round(nx*9),Math.round(ny*9),4)<.3?D[2]:rampPick(R,l+.1),2);N.px(10,12,'#ffffff',3);N.px(11,12,'#ffffff',3);N.line(8,22,24,22,D[3],1,3);for(let i=0;i<7;i++)N.px(9+i*2.3,23,D[1],3)},
  murex(N,a){const R=ramp5(a[1]),D=ramp5(a[2]);N.ell(16,17,7,10,R,2);for(let i=0;i<6;i++){const y=9+i*3;N.line(10,y,4,y-2,D[2],1,1);N.line(22,y,28,y-2,D[2],1,1)}N.line(16,27,16,31,D[2],1,1);N.ell(14,19,2.5,4,D[1],3)},
  abalone(N,a){const R=ramp5(a[1]);N.ell(16,17,13,10,(nx,ny,l,x,y)=>Math.hypot(nx+.15,ny)<.72?hslToHex(170+x*6+y*4,.45,.72):rampPick(R,l),2);for(let i=0;i<5;i++)N.px(7+i*3.5,10+i*.8,'#2a3a40',3)},
  conch(N,a){const R=ramp5(a[1]),D=ramp5(a[2]);N.poly([[5,10],[18,4],[28,12],[26,22],[16,28],[8,22]],(x,y)=>rampPick(R,-(x-14)*.05-(y-14)*.06+.1),2);N.ell(17,17,6,7,D,3);for(let i=0;i<4;i++)N.px(8+i*4,8-i*.5,R[0],4)},
  cone(N,a){const R=ramp5(a[1]),D=a[2];N.poly([[8,8],[24,8],[16,29]],(x,y)=>hash2(x>>1,y>>1,5)<.32?D:rampPick(R,-(x-16)*.06+.1),2);N.ell(16,8,8,3,R,3);N.px(16,6,D,4)},
  tall(N,a){const R=ramp5(a[1]);for(let i=0;i<7;i++)N.ell(16,27-i*3.4,6.5-i*.8,2.4,(nx,ny,l)=>ny>.4?R[3]:rampPick(R,l),2+i);N.line(16,3,16,5,R[2],1,9)},
  nautilus(N,a){const R=ramp5(a[1]),D=ramp5(a[2]),paper=a[3]==='paper';N.ell(16,17,12,11,(nx,ny,l,x,y)=>{const an=Math.atan2(ny,nx);if(!paper&&nx>.05&&Math.abs(Math.sin(an*5+Math.hypot(nx,ny)*7))<.32)return D[2];return rampPick(R,l)},2);
    for(let t=0;t<14;t+=.1){const r=t*.75,an=t*.9;N.px(13+Math.cos(an)*r,17+Math.sin(an)*r,paper?R[3]:D[3],3)}N.ell(8,19,3,5,'#3a2a2a',4)},
  pearl(N,a){const col=a[0],R=ramp5(col),baroque=a[1]==='baroque',glow=a[1]==='glow';if(glow)N.ell(16,16,13,13,(nx,ny)=>(Math.round(nx*9)+Math.round(ny*9))%3===0?'#c8e0ff':null,0);
    if(baroque){N.ell(15,15,7,9,R,2);N.ell(19,20,5,5,R,3)}else N.ell(16,16,8,8,(nx,ny,l)=>l>.72?'#ffffff':l>.5?R[0]:rampPick(R,l),2);N.px(13,12,'#ffffff',4);N.px(12,13,R[0],4)},
  glass(N,a){const R=ramp5(a[1]);N.poly([[6,14],[14,6],[25,9],[27,19],[18,26],[8,22]],(x,y)=>(x*3+y*5)%7===0?R[0]:rampPick(R,-(x-16)*.04-(y-16)*.05+.1),2);N.line(10,12,17,9,'#ffffff',1,3)},
  carving(N){const R=WOOD;N.tube(t=>[5+t*22,18+Math.sin(t*3.2)*-4],t=>t<.75?3.8*Math.sin(Math.min(1,t*2.4+.2)*Math.PI*.6)+1:1,(t,s,l)=>rampPick(R,l),40,2);N.poly([[25,13],[30,9],[29,16]],R[2],2);N.px(9,15,'#2a1a10',3);for(let i=0;i<4;i++)N.px(12+i*3,20,R[3],3)},
  anchor(N){const R=RUST;cyl(N,16,6,16,26,1.8,R);N.ell(16,5,3,3,(nx,ny)=>Math.hypot(nx,ny)<.45?null:R[2],2);cyl(N,9,10,23,10,1.4,R);N.tube(t=>[5+t*22,20+Math.sin(t*Math.PI)*6],()=>1.7,(t,s,l)=>rampPick(R,-s*.8),40,2);N.poly([[3,18],[7,17],[5,22]],R[2],3);N.poly([[29,18],[25,17],[27,22]],R[3],3)},
  cannonball(N){N.ell(16,18,10,10,(nx,ny,l)=>hash2(Math.round(nx*7),Math.round(ny*7),2)<.2?RUST[2]:rampPick(IRON,l),2);N.ell(16,29,8,1.5,'#3a2a2a',1)},
  ammonite(N){const S2=ramp5('#a89a80'),R=ramp5('#c8a878');N.ell(16,17,13,11,S2,1);for(let t=0;t<16;t+=.06){const r=t*.68,an=t*1.1;N.px(16+Math.cos(an)*r,17+Math.sin(an)*r*.9,(t*10|0)%5===0?R[3]:R[1],2)}},
  shipbottle(N){const G=ramp5('#7ac0b0');N.ell(16,18,8,11,(nx,ny,l)=>l>.6?'#e8fff8':G[2]+'',1);N.rect(13,3,6,5,G[2],1);N.rect(13,1,6,3,ramp5('#b08a5a')[1],2);N.rect(12,20,8,3,WOOD[2],3);N.line(16,20,16,11,'#e8e0d0',1,3);N.poly([[16,12],[16,19],[21,18]],'#fbf6ea',3);N.poly([[15,13],[15,19],[11,18]],'#e8e0c8',3);N.rect(10,24,12,2,'#5aa0c8',2)},
  tooth(N){const R=ramp5('#d8ccb0');N.poly([[16,3],[26,24],[22,28],[10,28],[6,24]],(x,y)=>rampPick(R,-(x-14)*.06-(y-14)*.05+.1),2);for(let y=6;y<24;y+=2){N.px(6+(y-3)*.5,y,R[4],3);N.px(26-(y-3)*.48,y,R[4],3)}N.rect(9,25,14,3,ramp5('#8a7a68')[2],3)},
  ambergris(N){const R=ramp5('#a8a080');N.ell(15,18,11,8,(nx,ny,l,x,y)=>vnoise(x,y,3,4)>.62?ramp5('#c8b878')[1]:rampPick(R,l),2);N.ell(21,13,5,4,R,3)},
  helmet(N){N.ell(16,15,11,11,BRASS,2);N.ell(16,15,5,5,(nx,ny,l)=>Math.hypot(nx,ny)>.78?BRASS[3]:l>.3?'#c8e8f0':'#5a8aa0',3);for(let i=0;i<8;i++){const an=i/8*6.28;N.px(16+Math.cos(an)*5,15+Math.sin(an)*5,BRASS[0],4)}N.ell(7,15,2.5,3,BRASS,4);N.ell(25,15,2.5,3,BRASS,4);N.rect(6,25,20,4,(i,j)=>rampPick(BRASS,-.2),1)},
  comb(N){const R=ramp5('#d8c8e8');N.ell(16,11,12,6,(nx,ny,l,x)=>ny>.4?null:hslToHex(260+x*5,.4,.8),2);N.rect(4,13,24,2,R[2],2);for(let i=0;i<12;i++)N.rect(5+i*2,15,1,9-(i%2),R[1],2);N.ell(16,9,2,2,ramp5('#f8f0ff'),3)},
  // sets
  bottle(N,a){const G=ramp5('#4a9a6a');N.ell(15,18,7,10,(nx,ny,l)=>l>.55?'#c8f0d8':nx<.2&&nx>-.4&&ny>-.5&&ny<.6?(l>.1?'#f4ead0':'#e0d0a8'):G[2],1);N.rect(12,4,6,6,G[2],1);N.rect(12,2,6,3,ramp5('#b08a5a')[1],2);N.line(14,12,14,24,'#c8a878',1,3);
    const n=String(a[1]||'');if(n){N.rect(19,20,n.length>1?10:7,8,(i,j)=>i===0||j===0?'#8a6a40':'#fbf6ea',4);let xx=21;for(const ch of n){const g=FONT[ch];for(let q=0;q<15;q++)if(g[q]==='1')N.px(xx+q%3,22+(q/3|0),'#4a2a1a',5);xx+=4}}},
  coin(N,a){const R=ramp5(a[1]);N.ell(16,16,11,11,R,2);N.ell(16,16,8.5,8.5,(nx,ny,l)=>rampPick(R,-l*.5-.05),3);for(let i=0;i<24;i++){const an=i/24*6.28;N.px(16+Math.cos(an)*10,16+Math.sin(an)*10,R[i%2?3:1],3)}
    const em=COIN_EM[a[2]||0]||COIN_EM[0];const ox=16-Math.floor(em[0].length/2),oy=16-Math.floor(em.length/2);em.forEach((row,j)=>{for(let i=0;i<row.length;i++){if(row[i]==='#'){N.px(ox+i,oy+j,R[0],4);N.px(ox+i+1,oy+j+1,R[4],3)}}});N.px(10,9,'#ffffff',5)},
  lure(N,a){const k=a[1],R=ramp5(a[2]);if(k==='spoon'){N.ell(16,16,6,11,(nx,ny,l)=>rampPick(R,l+(nx<0?.25:-.1)),2);N.ell(16,5,1.5,1.5,(nx,ny)=>Math.hypot(nx,ny)<.5?null:SILVER[2],3);N.line(16,27,16,30,SILVER[2],1,1);N.line(14,30,18,30,SILVER[2],1,1);N.px(14,29,SILVER[2],1);N.px(18,29,SILVER[2],1)}
    else if(k==='jig'){N.ell(16,10,5,5,R,2);N.tube(t=>[16,13+t*14],t=>3-t*2.4,(t,s,l)=>rampPick(R,-s),30,1);N.line(16,26,13,30,SILVER[2],1,2)}
    else if(k==='popper'){N.tube(t=>[6+t*20,16],t=>t<.2?4:4-t*2.5,(t,s,l)=>t<.12?ramp5('#f0e8d8')[2]:rampPick(R,-s*.8+.1),40,2);N.ell(8,16,2.5,3.5,'#2a1a14',3);for(let i=0;i<5;i++)N.line(26,16,30,12+i*2,['#e04a3a','#ffffff'][i%2],1,1);N.px(11,14,'#141018',4)}
    else if(k==='spinner'){N.line(4,16,28,16,SILVER[2],1,1);N.ell(13,12,4,7,(nx,ny,l)=>rampPick(R,l),2);N.tube(t=>[18+t*7,16],()=>2,(t,s,l)=>rampPick(R,-s),14,2);N.line(27,16,29,19,SILVER[1],1,1)}
    else if(k==='minnow'){N.tube(t=>[5+t*22,16+Math.sin(t*3.14)*-1],t=>t<.15?2.5+t*8:4.2*(1-t*.6),(t,s,l)=>s<-.2?rampPick(R,l+.2):s<.3?'#e8e8e0':'#fbf6ea',40,2);N.poly([[5,17],[1,20],[5,19]],'#e8e8e0',3);N.px(9,15,'#141018',4);N.line(14,21,13,25,SILVER[2],1,1);N.line(24,20,25,24,SILVER[2],1,1)}
    else if(k==='squidjig'){N.tube(t=>[16,5+t*18],t=>t<.2?2.5:3.2-t*1.5,(t,s,l)=>rampPick(R,-s),30,2);for(let i=0;i<7;i++)N.line(13+i,24,12+i*1.2,29,'#c8c8d0',1,1);N.ell(16,9,1.6,1.6,'#ffffff',3)}
    else{N.tube(t=>[10+t*12,18-t*6],t=>2.5-t*1.5,(t,s,l)=>rampPick(R,-s),20,2);for(let i=0;i<6;i++)N.line(10,18,4+i,10+i*.5,['#ffd24d','#c83a3a','#3a8ad8'][i%3],1,1);N.line(22,12,26,10,SILVER[2],1,1);N.px(26,11,SILVER[2],1)}},
  // junk
  boot(N){const R=ramp5('#5a3a2a');N.poly([[9,4],[19,4],[19,19],[27,21],[29,26],[27,28],[9,28]],(x,y)=>rampPick(R,-(x-14)*.04-(y-14)*.05),2);N.rect(9,26,20,2,'#2a1a14',3);for(let i=0;i<4;i++){N.px(17,8+i*3,'#e8e0c8',3);N.px(11,8+i*3,'#e8e0c8',3)}N.px(14,14,'#6a9a5a',4);N.px(15,15,'#6a9a5a',4)},
  can(N){cyl(N,16,6,16,26,7,SILVER);N.ell(16,6,7,2,SILVER[1],3);N.rect(9,12,14,8,(i,j)=>rampPick(ramp5('#c83a3a'),i<4?.3:i>10?-.4:0),3);N.rect(12,15,8,2,'#fbf6ea',4);N.px(20,23,RUST[2],4);N.px(10,24,RUST[1],4)},
  weed(N){for(let i=0;i<7;i++){const x0=6+i*3;N.tube(t=>[x0+Math.sin(t*5+i)*3,28-t*(16+hash2(i,1,3)*8)],t=>2.2-t*1.4,(t,s,l)=>rampPick(ramp5(i%2?'#4a7a3a':'#6a8a3a'),-s*.6),30,2+i%2)}},
  line(N){for(let i=0;i<5;i++){const cx=10+hash2(i,1,2)*12,cy=10+hash2(i,2,2)*12,r=4+hash2(i,3,2)*5;for(let a=0;a<6.28;a+=.08)N.px(cx+Math.cos(a)*r,cy+Math.sin(a*1.3)*r*.7,i%2?'#d8e0e8':'#a8d0e0',2)}N.line(6,26,12,20,'#e8e0d0',1,3);N.px(5,27,SILVER[2],3)},
  bag(N){const R=ramp5('#e8e4dc');N.poly([[7,6],[12,4],[13,9],[19,9],[20,4],[25,6],[27,27],[5,27]],(x,y)=>rampPick(R,-(x-14)*.04-(y-12)*.04+(hash2(x,y,3)<.15?-.4:0)),2);N.rect(8,16,16,1,R[3],3);N.rect(12,18,8,4,'#3a8ad8',3)},
  rod(N){N.line(4,28,28,4,'#3a3a40',1,2);N.line(5,28,16,17,'#3a3a40',2,2);N.ell(9,24,3,3,SILVER,3);N.rect(18,13,3,3,'#e04a3a',1);N.line(20,12,27,11,'#e8e0d0',1,1);N.line(14,18,13,23,'#e8e0d0',1,1)},
  tyre(N){N.ell(16,16,13,13,(nx,ny,l)=>{const d=Math.hypot(nx,ny);return d<.48?null:d<.58?'#5a5a60':((Math.atan2(ny,nx)*12|0)%2?'#2a2a30':rampPick(ramp5('#3a3a42'),l))},2);N.ell(16,16,6,6,(nx,ny)=>Math.hypot(nx,ny)<.75?null:'#6a6a70',3)},
  trolley(N){const R=SILVER;for(let i=0;i<6;i++)N.line(6+i*3.4,8,8+i*3,22,R[2],1,2);for(let j=0;j<4;j++)N.line(5,8+j*4.6,26,8+j*4.4,R[1],1,2);N.line(26,8,30,5,R[2],1,2);N.line(7,22,24,22,R[3],1,2);for(const x of[9,22])N.ell(x,26,2.4,2.4,IRON,3);N.px(14,12,RUST[2],4);N.px(20,16,'#6a9a5a',4)},
  bike(N){for(const x of[8,24])N.ell(x,21,6.5,6.5,(nx,ny)=>{const d=Math.hypot(nx,ny);return d>.82?'#2a2a30':d<.18?SILVER[2]:((Math.atan2(ny,nx)*8|0)%2?null:SILVER[3])},2);const F=ramp5('#d83a3a');N.line(8,21,15,21,F[2],1,3);N.line(15,21,21,12,F[2],1,3);N.line(8,21,12,12,F[2],1,3);N.line(12,12,21,12,F[2],1,3);N.line(21,12,24,21,F[2],1,3);N.line(12,12,11,9,F[3],1,3);N.rect(9,8,5,2,'#3a3a40',4);N.line(21,12,21,8,F[3],1,3);N.line(19,8,24,8,'#3a3a40',1,4)},
  duck(N){const Y=ramp5('#f0c838');N.ell(17,21,10,7,Y,2);N.ell(11,11,6,6,Y,3);N.poly([[5,12],[0,13],[5,15]],'#f08a2a',4);N.px(10,9,'#141018',5);N.px(10,8,'#ffffff',5);N.ell(19,19,5,3,(nx,ny,l)=>rampPick(Y,l-.3),4)}};
const FIND_ART={fan:'shfan'};
const COIN_EM=[['..#..','.###.','#.#.#','..#..','.#.#.'],['#...#','.#.#.','..#..'],['..#..','.###.','.#.#.','.###.','.#.#.','.###.','#####'],['..#..','.#.#.','#####','.#.#.','..#..'],['.###.','#.#.#','#.#.#','.#.#.','..#..'],['#.#.#','#####','#####'],['.##..','#####','.##..'],['.##.','#...','.##.','...#','.##.'],['#.#.#','.###.','#####','.###.'],['.###.','#.#..','.###.','..#.#','.###.']];

/* ---------------- dispatch, variants, cache ---------------- */
const CAT_SIZE=e=>e.cat==='legend'?48:32;
function catPN(e){const S=CAT_SIZE(e);if(e.cat==='fish'||e.cat==='legend'){const A=parseArt(e.art);const cr=CREATURE[A.shape];if(cr)return cr(A,S);return drawFish(A,S)}
  const N=PN(32,32);const a=String(e.art).split('|');let k=a[0];let args=a;
  if(e.cat==='pearl'){k='pearl'}else if(e.cat==='junk'){k=a[1];args=a.slice(1)}else if(e.cat==='shell'&&k==='fan')k='shfan';else if(k==='coin')args=[a[0],a[1],COINS.findIndex(q=>slug(q[0])===e.id)];
  const f=FIND[k];if(f)f(N,args);else N.ell(16,16,8,8,ramp5('#c8c0b0'),2);N.outline();return N}
const VAR_G=['#3a2006','#6a4410','#a8701a','#e0a830','#ffd24d','#fff0a0'],VAR_A=['#5a3a42','#a8808a','#d8b8be','#f0dcdf','#fff4f4','#ffffff'];
function lum(hex){const n=parseInt(hex.slice(1),16);return((n>>16)*.3+(n>>8&255)*.55+(n&255)*.15)/255}
const catCache=new Map();
function catArt(id,v){v=v||'';const key=id+'|'+v;let c=catCache.get(key);if(c)return c;const e=CATI[id];if(!e)return null;
  let base=catCache.get(id+'|pn');if(!base){base=catPN(e);catCache.set(id+'|pn',base)}
  if(!v){c=base.canvas()}
  else{const N=PN(base.w,base.h);for(let i=0;i<base.c.length;i++){const col=base.c[i];if(!col)continue;const L=lum(col);let out;
      if(v==='s')out=base.z[i]===-1?'#121c30':'#2a3c5c';
      else if(v==='g')out=base.z[i]===-1?'#3a2006':VAR_G[Math.min(5,Math.floor(L*5.2)+1)];
      else out=base.z[i]===-1?'#7a5058':col==='#141018'?'#d0283c':VAR_A[Math.min(5,Math.floor(L*4.6)+2)];
      N.c[i]=out}
    if(v==='g')for(let i=0;i<6;i++){const x=Math.floor(hash2(i,id.length,3)*base.w),y=Math.floor(hash2(i,7,id.length)*base.h);if(N.c[y*base.w+x])N.c[y*base.w+x]='#ffffff'}
    c=N.canvas()}
  catCache.set(key,c);return c}
// small horizontal swimmers for tanks and the water (facing left; flip for right)
const swimCache=new Map();
function swimArt(id){let c=swimCache.get(id);if(c)return c;const e=CATI[id];if(!e)return null;const A=parseArt(e.art);
  if(FISHP[A.shape]&&e.cat!=='legend'){const L=e.sz?clamp(10+Math.log2(e.sz[1]/10)*4,12,30):16;const W=Math.ceil(L)+4,H=Math.ceil(L*.8)+4;const fb=fishBody(A,W,H,L);drawEye(fb.N,fb.feat.eye[0],fb.feat.eye[1],Math.max(1,fb.feat.er*.9),fb.feat.eyeCol);fb.N.outline();c=fb.N.canvas()}
  else{const src=catArt(id);const k=e.cat==='legend'?.6:.6;const[cc,x]=mk(Math.round(src.width*k),Math.round(src.height*k));x.imageSmoothingEnabled=false;x.drawImage(src,0,0,cc.width,cc.height);c=cc}
  swimCache.set(id,c);return c}
