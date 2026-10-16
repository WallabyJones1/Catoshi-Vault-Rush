/* ================= the Founding Fishers: 500 original pixel NFTs (no names, just numbers) ================= */
const SUPPLY=500;
const RAR=['Common','Uncommon','Rare','Legendary'];
const RARCOL=['#9fc4ea','#7fdcc0','#c39bff','#ffd24d'];
const RARITY=(()=>{const a=[];for(let i=0;i<15;i++)a.push(3);for(let i=0;i<60;i++)a.push(2);for(let i=0;i<125;i++)a.push(1);while(a.length<SUPPLY)a.push(0);const r=rng(500777);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return[0,...a]})();
const SKINS=['#f8dcc0','#efc39d','#dba77a','#bb8158','#90603f','#6c4532'];
const HAIR_C=['#3d3048','#5a3a2a','#8a5a33','#c9894a','#e8c87a','#3d3f5c'];
const HAIR_U=['#d25b5b','#5b8fd2','#9a6ad8','#e9e6ef'];
const HAIR_R=['#58c9a8','#f08bbf','#ff9b3d'];
const SHIRTS=['#e9675a','#f2a541','#f6d65a','#7cc36b','#4fae9c','#5b9be0','#7a6fe0','#c76fd1','#f28cb1','#f4efe4','#3d4a63','#9c6b4a'];
const PANTS=['#3d4a78','#2f3346','#6b5a4a','#4f6b4a','#8a3f4a','#d8d2c4'];
const PERS=['Cheerful','Shy','Bold','Dreamy','Tidy','Curious','Chill','Sparky'];
const JOBS=['lumber','fisher','miner','farmer','courier','shop','builder','entertainer'];
const JOBNAME={lumber:'Lumberjack',fisher:'Fisher',miner:'Miner',farmer:'Farmer',builder:'Builder',courier:'Courier',shop:'Shopkeeper',entertainer:'Entertainer'};
const EYES=['Dot','Tall','Happy','Sleepy','Wide'];
const MOUTH=['Smile','Flat','Open','Grin'];
const ACC=['None','Glasses','Cap','Headband','Headphones','Flower','Star clip','Visor','Beanie','Crown','Halo'];
const PATTERN=['Plain','Stripes','Overalls','Hoodie'];
const traitCache=new Map();
function traits(id){
  if(traitCache.has(id))return traitCache.get(id);
  const r=rng(Math.imul(id,2654435761)^0x5eed1);
  const rar=id>=1&&id<=SUPPLY?RARITY[id]:0;
  const t={id,rar};
  t.skin=pick(r,SKINS);
  t.hs=Math.floor(r()*6);
  let pool=HAIR_C.slice();if(rar>=1&&r()<.55)pool=HAIR_U;if(rar>=2&&r()<.65)pool=HAIR_R;
  t.hair=pick(r,pool);if(rar===3&&r()<.5)t.hair='prism';
  t.eyes=Math.floor(r()*5);t.mouth=Math.floor(r()*4);
  t.shirt=pick(r,SHIRTS);t.pants=pick(r,PANTS);t.pat=Math.floor(r()*4);
  const accPool=rar===0?[0,0,0,0,1,2,3]:rar===1?[0,0,1,2,3,4,5,6]:rar===2?[1,2,4,5,6,7,8]:[9,10];
  t.acc=pick(r,accPool);t.acc2=rar===3?pick(r,[1,4,5,6]):0;
  t.pers=pick(r,PERS);t.ability=pick(r,JOBS);
  t.name=(id>=1&&id<=SUPPLY)?nftName(id):'Fisher';
  traitCache.set(id,t);return t}
const tag=id=>'#'+String(id).padStart(3,'0');
function nftName(id){return'Founding Fisher '+tag(id)}
const isNft=id=>id>=1&&id<=SUPPLY;


