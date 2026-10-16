/* ================= utilities ================= */
const TILE=16, OL='#2b2130';
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return[c,x]}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;if(amt<0){r*=1+amt;g*=1+amt;b*=1+amt}else{r+=(255-r)*amt;g+=(255-g)*amt;b+=(255-b)*amt}return'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
function R(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
function P(c,x,y,col){c.fillStyle=col;c.fillRect(x,y,1,1)}
function RR(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x+1,y,w-2,h);c.fillRect(x,y+1,w,h-2)}
function ell(c,cx,cy,rx,ry,col){c.fillStyle=col;for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++){const dy=(y+.5-cy)/ry;if(Math.abs(dy)>1)continue;const hw=rx*Math.sqrt(1-dy*dy);const x0=Math.round(cx-hw),x1=Math.round(cx+hw);if(x1>x0)c.fillRect(x0,y,x1-x0,1)}}
function ring(c,cx,cy,rx,ry,col,fill){ell(c,cx,cy,rx,ry,col);ell(c,cx,cy,rx-1,ry-1,fill)}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const dayKey=(d=new Date())=>d.toISOString().slice(0,10);
function secureRand(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296}
const $=id=>document.getElementById(id);

/* ================= 3x5 bitmap font ================= */
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110','#':'010111010111010','-':'000000111000000','.':'000000000000010','!':'010010010000010','?':'110001010000010','/':'001001010100100',':':'000010000010000','+':'000010111010000',',':'000000000010100',"'":'010010000000000','%':'101001010100101','$':'011110010011110','(':'010100100100010',')':'010001001001010','<':'001010100010001','>':'100010001010100','=':'000111000111000','&':'010101010101011','*':'000101010101000'};
const WIDE={'#':['01010','11111','01010','11111','01010']};
function textW(s){s=String(s).toUpperCase();let w=0;for(const ch of s)w+=WIDE[ch]?6:4;return w-1}
function drawText(c,s,x,y,col,sh){s=String(s).toUpperCase();if(sh){drawText(c,s,x+1,y+1,sh)}c.fillStyle=col;for(const ch of s){const wg=WIDE[ch];if(wg){for(let j=0;j<5;j++)for(let i=0;i<5;i++)if(wg[j][i]==='1')c.fillRect(x+i,y+j,1,1);x+=6;continue}const g=FONT[ch];if(g){for(let i=0;i<15;i++)if(g[i]==='1')c.fillRect(x+i%3,y+(i/3|0),1,1)}x+=4}}

/* ================= tiny icons 7x7 ================= */
const ICONS={
 miner:['..###..','.#...#.','....#..','...#...','..#....','.#.....','#......'],
 farmer:['...#...','..#.#..','...#...','..#.#..','...#...','...#...','...#...'],
 builder:['#####..','#####..','..#....','..#....','..#....','..#....','..#....'],
 courier:['#######','##...##','#.#.#.#','#..#..#','#.....#','#######','.......'],
 shop:['..###..','.#...#.','#..#..#','#..#..#','#..#..#','.#...#.','..###..'],
 star:['...#...','...#...','#######','.#####.','..###..','.##.##.','.#...#.'],
 heart:['.##.##.','#######','#######','.#####.','..###..','...#...','.......'],
 note:['...####','...#..#','...#..#','...#..#','.###.##','####.##','.##....'],
 wave:['.#.#.#.','.#.#.#.','.#####.','######.','.#####.','..####.','...###.']
};
ICONS.entertainer=ICONS.note;
function drawIcon(c,name,x,y,col){const g=ICONS[name];if(!g)return;c.fillStyle=col;for(let j=0;j<7;j++)for(let i=0;i<7;i++)if(g[j][i]==='#')c.fillRect(x+i,y+j,1,1)}

