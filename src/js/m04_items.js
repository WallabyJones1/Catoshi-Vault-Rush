/* ================= gear, bait and boats (shared with the server) ================= */
const GEAR={
  rod:[{n:'Bamboo Rod',price:0,cast:.55,power:1},{n:'Glass Rod',price:400,cast:.7,power:1.25},{n:'Graphite Rod',price:1600,cast:.82,power:1.55},{n:'Boron Rod',price:5500,cast:.92,power:1.9},{n:'Gullwing Custom',price:16000,cast:1,power:2.35}],
  reel:[{n:'Sidecast Reel',price:0,drag:1,speed:1},{n:'Spin Reel',price:300,drag:1.2,speed:1.15},{n:'Baitcaster',price:1300,drag:1.45,speed:1.3},{n:'Deep Reel',price:4200,drag:1.7,speed:1.45,deep:1},{n:'Electric Deep Reel',price:13000,drag:2.05,speed:1.75,deep:1}],
  line:[{n:'4 kg mono',price:0,str:1},{n:'8 kg mono',price:250,str:1.45},{n:'15 kg braid',price:1100,str:2.1},{n:'40 kg braid',price:4200,str:3.2}],
  hook:[{n:'Plain hooks',price:0,snag:0},{n:'Reef hooks',price:650,snag:.55},{n:'Wreck hooks',price:2600,snag:.85}],
  engine:[{n:'Oars',price:0,speed:1,burn:0},{n:'15 hp outboard',price:900,speed:1.7,burn:1},{n:'60 hp outboard',price:4500,speed:2.4,burn:1.6},{n:'Twin 150s',price:18000,speed:3.2,burn:2.4}],
  tank:[{n:'Jerry can',price:0,cap:40},{n:'Small tank',price:600,cap:100},{n:'Long-range tank',price:3000,cap:220},{n:'Ocean tank',price:11000,cap:420}],
  ice:[{n:'Esky',price:0,keep:1},{n:'Ice box',price:800,keep:2.5},{n:'Slurry tank',price:6000,keep:6}],
  sonar:[{n:'Fish finder',price:1200,lvl:1},{n:'Colour sonar',price:5000,lvl:2},{n:'Side-scan sonar',price:15000,lvl:3}],
  lamp:[{n:'Deck lamp',price:1500,lvl:1},{n:'Floodlight rig',price:7000,lvl:2}]};
const GEAR_NAME={rod:'Rod',reel:'Reel',line:'Line',hook:'Hooks',engine:'Engine',tank:'Fuel tank',ice:'Ice',sonar:'Sonar',lamp:'Deck lamp'};
const GEAR_SHOP={tackle:['rod','reel','line','hook'],boatyard:['engine','tank','ice','sonar','lamp']};
// bait: lures are kept unless the line snaps; everything else is used up one per cast
const BAIT={
  dough:{n:'Bread dough',price:0,pack:0,r:[1.25,.8,.35,.15],d:'Free and endless. Small fish love it.'},
  worm:{n:'Beach worms',price:20,pack:10,r:[1,1.25,.9,.5],z:{shallows:1.6,harbour:1.3},d:'Whiting, bream and flathead.'},
  prawn:{n:'Live prawns',price:35,pack:10,r:[1,1.3,1.15,.8],d:'Everything eats prawns.'},
  pilchard:{n:'Pilchards',price:40,pack:10,r:[.8,1.2,1.4,1.3],like:['shark','torp','tuna'],d:'Oily. Sharks, tailor and kingfish.'},
  squid:{n:'Squid strips',price:45,pack:10,r:[.9,1.2,1.45,1.2],z:{reef:1.3,kelp:1.3,wreck:1.3},d:'Snapper, emperor and groper.'},
  weedbait:{n:'Weed bait',price:15,pack:10,r:[1,1,1,1],d:'Luderick only eat weed.'},
  crabbait:{n:'Crab bait',price:50,pack:8,r:[.8,1.2,1.4,1.3],d:'Gropers and big reef fish. Also good in pots.'},
  squidjig:{n:'Squid jig',price:220,pack:1,lure:1,r:[.7,1.2,1.2,1],like:['squid','cuttle','octo'],d:'Calamari and cuttlefish. Reusable.'},
  popper:{n:'Popper',price:300,pack:1,lure:1,r:[.6,1.1,1.6,1.7],like:['deep','tuna','mahi'],z:{reef:1.3,blue:1.2},d:'Surface strikes: trevally, mahi, tuna. Reusable.'},
  metal:{n:'Metal slice',price:180,pack:1,lure:1,r:[.9,1.3,1.3,1.1],like:['torp','tuna'],d:'Fast fish: tailor, salmon, bonito. Reusable.'},
  livebait:{n:'Live yakka',price:120,pack:5,r:[.5,1,1.8,2.4],like:['shark','torp','marlin','sail','tuna'],d:'Big predators. Marlin and sharks.'},
  glow:{n:'Glow lure',price:650,pack:1,lure:1,r:[.8,1.2,1.6,2],z:{deep:1.6},night:1.5,d:'Deep and night water. Reusable.'}};
const BAIT_ORDER=['dough','worm','prawn','pilchard','squid','weedbait','crabbait','squidjig','popper','metal','livebait','glow'];
const BOATS=[
  {k:'row',n:'Rowboat',price:600,tier:1,hold:6,storm:0,spd:1,len:22,hull:'#c86a3a'},
  {k:'dinghy',n:'Dinghy',price:3200,tier:2,hold:10,storm:1,spd:1.05,len:26,hull:'#e8e2d0'},
  {k:'skiff',n:'Skiff',price:12500,tier:3,hold:16,storm:2,spd:1.12,len:30,hull:'#3f86bd'},
  {k:'trawler',n:'Trawler',price:42000,tier:4,hold:24,storm:3,spd:1.1,len:38,hull:'#c84a3a'},
  {k:'cutter',n:'Deep-sea Cutter',price:125000,tier:5,hold:34,storm:4,spd:1.25,len:44,hull:'#2a3a5a'}];
const BOATI=Object.fromEntries(BOATS.map(b=>[b.k,b]));
const POTS={max:3,price:400,soakMin:120}; // soak in town minutes before a pot fills
const HULL_PAINT=['#c86a3a','#e8e2d0','#3f86bd','#c84a3a','#2a3a5a','#5fae6a','#f0c040','#8a5ac8','#e88aa8','#3a3a40'];
