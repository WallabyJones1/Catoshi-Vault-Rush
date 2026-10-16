/* ================= the Gullhaven catalogue: every Logbook entry =================
   217 entries: 96 fish, 9 legendaries, 20 treasures, 16 corals, 16 shells, 8 pearls, 12 curios, 30 set pieces, 10 junk.
   Conditions are space-separated tokens, all of which must hold:
     time   any day night dawn dusk dawn/dusk dusk/night midnight
     tide   rising falling high low kingtide
     sky    calm windy rain storm fog afterstorm
     season spring summer autumn winter          moon newmoon fullmoon
     method pot release deepreel lamp            bait squidjig weedbait crabbait (preferred, not required)
     where  birds debris schools (only near those features) */
const CRAR=['Common','Uncommon','Rare','Epic','Legendary'];
const CRARCOL=['#c9c6d8','#7fdcc0','#6fb2ff','#c39bff','#ffd24d'];
const ZONES={
  harbour:{n:'Harbour and Piers',short:'Harbour',depth:2,need:0,col:'#4f9fd0'},
  shallows:{n:'Sandy Shallows',short:'Shallows',depth:2,need:0,col:'#7fd0d8'},
  estuary:{n:'Mangrove Estuary',short:'Estuary',depth:1,need:1,col:'#6a9a7a'},
  reef:{n:'Coral Reef',short:'Reef',depth:4,need:2,col:'#3fc0c8'},
  kelp:{n:'Kelp Forest',short:'Kelp',depth:7,need:2,col:'#3f8a6a'},
  wreck:{n:'Wreck Graveyard',short:'Wrecks',depth:12,need:3,col:'#4a6a8a'},
  blue:{n:'Open Blue',short:'Open Blue',depth:30,need:4,col:'#2f5fb0'},
  deep:{n:'The Deep',short:'The Deep',depth:80,need:5,col:'#26265a'},
  beach:{n:'Beach',short:'Beach'},rocks:{n:'Rock platform',short:'Rocks'},any:{n:'Anywhere',short:'Anywhere'},unknown:{n:'Unknown',short:'?'}};
const ZONE_ORDER=['harbour','shallows','estuary','reef','kelp','wreck','blue','deep'];
/* fish: [name, zone, rarity, conditions, minCm, maxCm, art] ; art = shape|back|side|belly|pattern|patCol|fin(|extra) */
const FISH_RAW=[
 ['Yellowtail Scad','harbour',0,'any',14,30,'torp|#5f8fa0|#b9cdd6|#eef3f4|lat|#e8c84a|#e8c84a'],
 ['Silver Mullet','harbour',0,'day',20,45,'torp|#6d7f8f|#c3ccd4|#eef1f3|stripes|#9aa6b2|#8b97a3'],
 ['Garfish','harbour',0,'day calm',20,40,'gar|#5fa08f|#c8e0d8|#f2f8f5|none|#e05050|#6fb5a0'],
 ['Leatherjacket','harbour',0,'any',15,35,'jacket|#8a7a50|#c4b07a|#e8dcb4|spots|#6a5a38|#d8a040'],
 ['Tarwhine','harbour',0,'day',18,35,'deep|#8f9aa8|#c8cfd8|#eef0f3|stripes|#d8b860|#e8c860'],
 ['Yellowfin Bream','harbour',1,'dawn/dusk rising',20,45,'deep|#7d8a6a|#c0c4a8|#ecebdc|none|#000|#f0d040'],
 ['Luderick','harbour',1,'day high weedbait',25,50,'deep|#3f4a46|#6a7a70|#a8b4aa|bars|#2a3330|#3f4a46'],
 ['Old Wife','harbour',1,'night',20,40,'disc|#e8e2d0|#e8e2d0|#f4f0e4|bars|#2a2a2a|#e8b040'],
 ['Southern Calamari','harbour',1,'dusk/night squidjig',20,45,'squid|#c8a0d0|#e0c4e4|#f4ecf6|spots|#8a4a9a|#c8a0d0'],
 ['Fiddler Ray','harbour',2,'night low',60,120,'guitar|#a89070|#c8b490|#f0e8dc|lines|#5a6a8a|#a89070'],
 ['Port Jackson Shark','harbour',2,'night winter',80,165,'shark|#a08a6a|#bca88a|#efe6d6|harness|#4a3a2a|#a08a6a|blunt'],
 ['Pot-bellied Seahorse','harbour',3,'day calm summer release',15,35,'seahorse|#e0b040|#f0cc60|#f8e0a0|none|#b08020|#e0b040'],
 ['Sand Whiting','shallows',0,'day rising',20,45,'torp|#c8b890|#e8dcc0|#f6f0e4|none|#000|#d8c8a0|slim'],
 ['Swallowtail Dart','shallows',0,'day',25,50,'deep|#6f8fa8|#d0dce4|#f4f6f8|spots|#2a3a4a|#e8d070|deepfork'],
 ['Tailor','shallows',0,'dawn/dusk',30,70,'torp|#3f6f8a|#a8c4d0|#e8f0f2|none|#000|#6f8f6a'],
 ['Australian Salmon','shallows',1,'autumn windy',40,80,'torp|#3a5f6a|#9fb8b8|#e4ecea|spots|#2a3a3a|#c8a050'],
 ['Dusky Flathead','shallows',1,'day low',35,90,'flathead|#6a5a48|#9a8a70|#d8ccb4|spots|#4a3a2a|#8a7a60'],
 ['Trumpeter Whiting','shallows',1,'spring',20,35,'torp|#c8b890|#e8dcc0|#f6f0e4|stripes|#b8985a|#d8c8a0|slim'],
 ['Blue Swimmer Crab','shallows',1,'pot summer',12,20,'crab|#4a7ad0|#6a9ae0|#e8f0fa|spots|#ffffff|#3a5ab0'],
 ['Gummy Shark','shallows',2,'night',80,160,'shark|#8a96a6|#a8b2c0|#eef0f4|spots|#ffffff|#8a96a6'],
 ['Shovelnose Ray','shallows',2,'day calm',70,140,'guitar|#b8a078|#d0bc96|#f4ece0|none|#000|#b8a078'],
 ['Mulloway','shallows',2,'night rising rain',60,150,'torp|#8a8a90|#b0a490|#e4e0d8|none|#000|#a08868|big'],
 ['Smooth Stingray','shallows',3,'night winter',120,250,'ray|#4a4a50|#5a5a62|#d8d4d0|none|#000|#4a4a50'],
 ['Bronze Whaler','shallows',3,'dusk storm',150,300,'shark|#8a7a5a|#a8966e|#e8e4d8|none|#000|#8a7a5a'],
 ['Diamond-scale Mullet','estuary',0,'any',25,55,'torp|#5a7080|#a8b8c4|#e4eaee|scales|#7f909e|#6a7a88'],
 ['Grunter Bream','estuary',0,'day',20,40,'deep|#8a8070|#b8ac98|#ece6dc|spots|#5a4a3a|#a89a80'],
 ['Toadfish','estuary',0,'any',10,25,'puffer|#8a8a50|#a8a870|#f0f0e0|spots|#3a3a2a|#8a8a50'],
 ['Archerfish','estuary',1,'day summer',15,30,'deep|#b8c4a0|#d8e0c4|#f4f6ec|bars|#2a2a2a|#c8b860'],
 ['Estuary Cod','estuary',1,'dawn',40,90,'grouper|#8a7a5a|#a89870|#e0d6c0|spots|#5a4a3a|#8a7a5a'],
 ['Mud Crab','estuary',1,'pot rain',15,25,'crab|#4a5a3a|#6a7a50|#c8c4a0|none|#000|#3a4a2a'],
 ['Mangrove Jack','estuary',2,'night summer',30,70,'deep|#b0503a|#c86a4a|#ecc4b0|none|#000|#c06040|snapper'],
 ['Barramundi','estuary',2,'night rain',50,120,'torp|#6a7a6a|#b8c4bc|#ecf0ec|none|#000|#6a7a6a|barra'],
 ['Threadfin Salmon','estuary',2,'rising',40,100,'torp|#8a98a8|#c4ccd4|#eef0f2|none|#000|#d8d0b8|thread'],
 ['Tarpon','estuary',3,'dawn summer',80,180,'torp|#3f5a7a|#c4d0dc|#f0f4f8|scales|#a8b8c8|#6a7a8a|big'],
 ['Bull Shark','estuary',3,'night storm',150,300,'shark|#8a8e96|#a2a6ae|#e8eaee|none|#000|#8a8e96|blunt'],
 ['Green Sawfish','estuary',3,'summer rain release',200,500,'saw|#7a8a6a|#94a280|#e4e8d8|none|#000|#7a8a6a'],
 ['Clownfish','reef',0,'day',6,11,'clown|#f08030|#f49a48|#fbd0a0|clown|#ffffff|#f08030'],
 ['Blue Tang','reef',0,'day',15,30,'deep|#2f5fd0|#4a7ae0|#7a9ae8|tang|#1a1a3a|#f0d020'],
 ['Moorish Idol','reef',1,'day',15,23,'idol|#f4f0e0|#f4f0e0|#ffffff|bars|#1a1a1a|#f0d040'],
 ['Triggerfish','reef',1,'day',25,50,'trigger|#c8b890|#d8cca8|#f0ead8|lines|#3a6ad0|#3a3a5a'],
 ['Parrotfish','reef',1,'day high',30,70,'parrot|#3fb8a0|#5ccab2|#a8e8d8|scales|#f080a0|#f080a0'],
 ['Spangled Emperor','reef',1,'dawn',30,80,'deep|#a8b0a0|#c4c8bc|#ecece6|spots|#4a8ad0|#d86040'],
 ['Painted Sweetlips','reef',1,'dusk',30,70,'deep|#e8d8a0|#f0e4b8|#f8f2dc|spots|#e07040|#e8c870'],
 ['Coral Trout','reef',2,'dawn/dusk',40,100,'grouper|#d84838|#e05a48|#f0a090|spots|#4ab0e8|#d84838'],
 ['Red Emperor','reef',2,'night',40,100,'deep|#e05a48|#e87060|#f8d0c8|bars|#f4e8e0|#e05a48'],
 ['Lionfish','reef',2,'night calm',20,38,'lion|#d86a48|#e48060|#f4d8c8|bars|#f4ece0|#d86a48'],
 ['Giant Trevally','reef',3,'dawn windy',70,170,'deep|#5a6470|#9aa4ae|#d8dce0|none|#000|#3a4048|big'],
 ['Humphead Wrasse','reef',3,'day summer release',100,230,'hump|#3a8a80|#4aa098|#a0d8d0|lines|#2a5a6a|#3a7a90'],
 ['Sweep','kelp',0,'day',20,40,'deep|#6a7aa0|#8a98b8|#c8d0e0|none|#000|#5a6a90'],
 ['Morwong','kelp',0,'day',30,60,'deep|#c8b8a0|#d8ccb8|#f0eae0|bars|#4a3a2a|#e07040'],
 ['Herring Cale','kelp',0,'day',25,50,'torp|#6a5a3a|#8a7a58|#c8bc9c|stripes|#4a3a2a|#7a6a4a|slim'],
 ['Tommy Ruff','kelp',0,'dusk',15,30,'torp|#6a8a7a|#b8ccc4|#eef4f2|spots|#3a4a40|#c8c060'],
 ['Magpie Perch','kelp',1,'day',25,45,'deep|#f0ece4|#f0ece4|#ffffff|bars|#1a1a1a|#e08040'],
 ['Crimson-banded Wrasse','kelp',1,'day',25,50,'torp|#e8d0b0|#f0dcc4|#faf0e4|band|#c83a3a|#3a6ad0'],
 ['Boarfish','kelp',1,'winter',30,60,'boar|#d8c8b0|#e4d8c4|#f4ecdc|bars|#2a2a2a|#d8b040'],
 ['Southern Rock Lobster','kelp',1,'pot winter',25,50,'lobster|#c84a2a|#d86a40|#f0b090|none|#000|#a83a20'],
 ['Pink Snapper','kelp',2,'dawn afterstorm',40,120,'deep|#e8a0a0|#f0b8b8|#fae4e4|spots|#6ab0e8|#e8a0a0|snapper'],
 ['John Dory','kelp',2,'dusk calm',30,65,'dory|#c8c0a8|#d8d0bc|#eee8dc|dory|#1a1a1a|#a8a088'],
 ['Eastern Blue Groper','kelp',2,'day crabbait',50,120,'grouper|#2f5fb0|#3f70c0|#8aa8e0|none|#000|#2a4a90'],
 ['Weedy Seadragon','kelp',3,'calm release',30,45,'dragon|#e0a040|#ecb860|#f8e0a8|bars|#7a4ab0|#c06030'],
 ['Batfish','wreck',0,'day',25,50,'bat|#8a8a80|#a8a89c|#e0e0d8|bars|#4a4a40|#6a6a60'],
 ['Squirrelfish','wreck',0,'night',15,30,'deep|#e04a3a|#e86a5a|#f8c8c0|stripes|#f4e0e0|#e04a3a|bigeye'],
 ['Moray Eel','wreck',1,'night',80,200,'eel|#6a7a3a|#7e8e4c|#b8c08a|spots|#3a4a2a|#6a7a3a'],
 ['Cuttlefish','wreck',1,'dusk',20,50,'cuttle|#a88a6a|#c0a484|#ecdcc8|bars|#6a5a4a|#a88a6a'],
 ['Octopus','wreck',1,'pot',40,120,'octo|#c8603a|#d87850|#f0b898|spots|#a04a2a|#c8603a'],
 ['Amberjack','wreck',1,'day',50,120,'torp|#6a6a70|#a8acb4|#e4e6ea|band|#d8a040|#7a7a80|big'],
 ['Samson Fish','wreck',1,'dawn',60,150,'deep|#7a8080|#a0a8a8|#e0e4e4|bars|#4a5050|#c0a050'],
 ['Pearl Perch','wreck',2,'night',30,70,'deep|#b8c0c8|#d0d6dc|#f4f6f8|shoulder|#2a2a2a|#c8ccd4'],
 ['Goldband Snapper','wreck',2,'dawn',40,90,'deep|#e05a48|#e87868|#f8d0c8|stripes|#f0c040|#e05a48|snapper'],
 ['Black Jewfish','wreck',2,'night newmoon',80,150,'torp|#4a4a40|#6a6a5a|#b8b4a4|none|#000|#4a4a40|big'],
 ['Spotted Wobbegong','wreck',2,'night',120,300,'wobbe|#b8985a|#c8aa70|#e8dcc0|blotch|#6a5030|#b8985a'],
 ['Spotted Eagle Ray','wreck',3,'day calm',150,300,'ray|#3a4a6a|#4a5a7a|#e8ecf0|spots|#ffffff|#3a4a6a|eagle'],
 ['Flying Fish','blue',0,'day calm',20,40,'flying|#3a6ab0|#c8d8ec|#f0f4fa|none|#000|#8ab0e0'],
 ['Skipjack Tuna','blue',0,'day schools',40,90,'tuna|#2a3a6a|#c0c8d4|#eef0f4|belly|#4a5a7a|#3a4a7a'],
 ['Bonito','blue',0,'dawn',40,80,'tuna|#3a5a7a|#c8d0d8|#eef2f4|oblique|#2a3a5a|#4a6a8a'],
 ['Mahi-mahi','blue',1,'summer debris',70,150,'mahi|#3ab070|#f0d040|#f8ec98|spots|#3a8ad0|#3a9ad0'],
 ['Yellowtail Kingfish','blue',1,'dawn/dusk',70,150,'torp|#3a5a8a|#d8dce4|#f2f4f6|lat|#f0d040|#f0d040|big'],
 ['Spanish Mackerel','blue',1,'autumn',80,180,'torp|#4a6a8a|#b8c8d8|#eef2f6|wavy|#8aa0b8|#4a6a8a|long'],
 ['Wahoo','blue',2,'windy',100,200,'torp|#2a4a8a|#a8bcd8|#e8eef6|bars|#5a7ab8|#2a4a8a|long'],
 ['Yellowfin Tuna','blue',2,'dawn birds',80,200,'tuna|#2a3a6a|#c8d0dc|#f0f2f6|lat|#f0d040|#f0d040|yfin'],
 ['Striped Marlin','blue',3,'day summer',200,350,'marlin|#2a3a6a|#a8b8d0|#eef2f6|bars|#8ab8e8|#2a3a6a'],
 ['Sailfish','blue',3,'calm summer',180,300,'sail|#2a3a6a|#a8b8d0|#eef2f6|bars|#8ab8e8|#3a5ab0'],
 ['Southern Bluefin Tuna','blue',3,'winter',150,240,'tuna|#1a2a5a|#b8c4d4|#eef0f4|none|#000|#2a3a6a|yfin'],
 ['Shortfin Mako','blue',3,'storm',200,380,'shark|#2f5a9a|#4a74b0|#f0f2f6|none|#000|#2f5a9a|sleek'],
 ['Lanternfish','deep',0,'night',5,15,'lantern|#3a3a5a|#4a4a6a|#8a8aa8|glow|#8af0ff|#3a3a5a'],
 ['Hagfish','deep',0,'any',30,80,'eel|#c8a0a0|#d4b0b0|#ecd8d8|none|#000|#c8a0a0|nofin'],
 ['Gemfish','deep',1,'winter',60,120,'torp|#5a5a6a|#a8b0b8|#e4e8ec|none|#000|#5a5a6a|long'],
 ['Pink Ling','deep',1,'any',60,150,'eel|#e8a0a0|#f0b8b0|#f8e0dc|spots|#c87070|#e8a0a0'],
 ['Frostfish','deep',1,'night winter',100,200,'ribbon|#d8e0e8|#e8eef4|#ffffff|none|#000|#b8c4d0'],
 ['Blue-eye Trevalla','deep',2,'dawn deepreel',60,140,'deep|#4a5a6a|#8a98a8|#d0d8e0|none|#000|#4a5a6a|blueeye'],
 ['Hapuku','deep',2,'deepreel',80,180,'grouper|#5a5a50|#76766a|#c4c4b4|none|#000|#4a4a40'],
 ['Ghost Shark','deep',2,'night',60,120,'chimaera|#c8c8d0|#d8d8e0|#f4f4f8|lines|#6a6a7a|#b8b8c8'],
 ['Anglerfish','deep',3,'night lamp',30,100,'angler|#3a2a3a|#4a3a4a|#6a5a6a|glow|#8af0ff|#3a2a3a'],
 ['Gulper Eel','deep',3,'night newmoon',60,180,'gulper|#1a1a2a|#2a2a3a|#4a4a5a|none|#000|#1a1a2a'],
 ['Oarfish','deep',3,'storm',300,800,'oar|#d8dce4|#e8ecf0|#ffffff|spots|#9aa4b4|#e04a4a'],
 ['Bluntnose Sixgill Shark','deep',3,'night winter',300,480,'shark|#5a5048|#6e645a|#c8c0b4|none|#000|#5a5048|sixgill']];
/* legendaries: [name, zone, conditions, what it is, minCm, maxCm, art] */
const LEGEND_RAW=[
 ['Old Gravel-Jaw','wreck','storm','A 2.5-metre groper that has broken every line in town',220,260,'grouper|#3a3a30|#4e4e40|#9a9680|spots|#1a1a14|#2a2a20|legend'],
 ['The Lantern Queen','deep','midnight newmoon','A giant anglerfish whose lure lights the whole trench',120,160,'angler|#4a1a4a|#5e2a5e|#8a5a8a|glow|#ffd24d|#4a1a4a|crown'],
 ['Silverback','blue','dawn winter','A record southern bluefin that leads the winter run',260,300,'tuna|#2a3a5a|#e0e8f0|#ffffff|none|#000|#ffd24d|yfin legend'],
 ['Mangrove Marjorie','estuary','night rain summer','A 1.8-metre barramundi the old-timers named after a lost boat',170,190,'torp|#8a7a3a|#d8c890|#f8f0d0|none|#000|#a89040|barra legend'],
 ['The Pale Duchess','shallows','fog low','An albino stingray that glides through the fog',260,300,'ray|#f4f0f0|#f8f6f6|#ffffff|none|#000|#e8d8e0|legend'],
 ['Kingtide','harbour','kingtide','A golden kingfish that swims under the piers once a moon',150,180,'torp|#d8a020|#ffd24d|#fff0b0|lat|#ffffff|#ffd24d|big legend'],
 ['The Bell Ringer','wreck','midnight','A giant octopus living in a sunken bell tower',350,450,'octo|#6a3a8a|#8a50a8|#c8a0d8|spots|#ffd24d|#6a3a8a|legend'],
 ['The Shelf Leviathan','deep','storm night fullmoon','A giant squid that rises past the shelf edge',900,1300,'squid|#a8302a|#c84a40|#f0a090|spots|#ffd24d|#a8302a|legend'],
 ['The Odd One','unknown','oddone','Nobody has a photo. Everybody has a story.',111,111,'odd|#c39bff|#7fdcc0|#ffd24d|prism|#ff7a6b|#6fb2ff|legend']];
/* other finds: [name, rarity, how, where, art] ; how = comb salvage dive pot snag hook bin */
const TREASURE_RAW=[
 ['Driftwood Crate',0,'comb','beach','crate'],['Lost Tackle Box',0,'hook','harbour','tackle'],['Barnacled Chest',1,'salvage','wreck','chest|#8a6a4a|#c0b08a'],['Smuggler\'s Lockbox',1,'salvage','estuary','lockbox'],
 ['Brass Compass',1,'salvage','wreck','compass'],['Spyglass',1,'comb','beach','spyglass'],['Antique Pocket Watch',1,'snag','reef','watch'],['Silver Locket',1,'hook','harbour','locket'],
 ['Captain\'s Strongbox',2,'salvage','wreck','strongbox'],['Royal Navy Coffer',2,'salvage','blue','chest|#2f4f8f|#ffd24d'],['Ship\'s Bell',2,'salvage','wreck','bell'],['Ship\'s Figurehead',2,'salvage','wreck','figurehead'],
 ['Sextant',2,'snag','kelp','sextant'],['Jade Pendant',2,'snag','reef','pendant'],['Lighthouse Keeper\'s Key',2,'comb','rocks','key'],['Captain\'s Cutlass',2,'salvage','wreck','cutlass'],
 ['Pirate Doubloon Chest',3,'salvage storm','wreck','chest|#6a3a2a|#ffd24d|gold'],['Sunken Altar Chest',3,'salvage','deep','chest|#3a3a5a|#8af0ff|glow'],['Golden Idol',3,'snag','reef','idol'],['Crown of the Drowned King',3,'salvage night','deep','crown']];
const CORAL_RAW=[
 ['Staghorn Coral',0,'reef','branch|#e8c8a0'],['Brain Coral',0,'reef','brain|#d8b890'],['Plate Coral',1,'reef','plate|#c8a878'],['Mushroom Coral',1,'reef','mushroom|#e8a0a8'],
 ['Bubble Coral',1,'reef','bubble|#f0e0c8'],['Sea Fan',1,'kelp','fan|#c86a9a'],['Fire Coral',1,'reef','branch|#f08a3a'],['Pillar Coral',2,'reef','pillar|#d8c8a8'],
 ['Organ Pipe Coral',2,'reef','pipe|#c84a3a'],['Blue Coral',2,'reef','branch|#4a8ad0'],['Pink Lace Coral',2,'wreck','fan|#f0a0c8'],['Black Coral',3,'deep','branch|#2a2430'],
 ['Red Precious Coral',3,'wreck','branch|#d8302a'],['Gold Coral',3,'deep','branch|#e8b830'],['Glowing Deepwater Coral',3,'deep night','branch|#5ae8f0|glow'],['Rainbow Coral',4,'reef spawn','branch|#ff7a6b|rainbow']];
const SHELL_RAW=[
 ['Cockle',0,'beach','fan|#e8d0b0|#c8a080'],['Scallop',0,'beach','fan|#f0a070|#d07040'],['Turban Shell',0,'rocks','spiral|#a89878|#7a6a50'],['Sand Dollar',0,'beach','dollar|#e8dcc0|#c8b890'],
 ['Sea Star',1,'rocks','star|#e8783a|#c0502a'],['Cowrie',1,'beach','cowrie|#e8d8b8|#a07850'],['Murex',1,'rocks','murex|#e8e0d0|#a89880'],['Abalone',1,'rocks','abalone|#8ab0b8|#c89ad8'],
 ['Volute',2,'beach afterstorm','spiral|#e8c890|#b06a3a'],['Conch',2,'reef','conch|#f4c8b0|#e08a6a'],['Cone Shell',2,'rocks','cone|#f0e8d8|#8a4a2a'],['Tiger Cowrie',2,'reef','cowrie|#e8e0d0|#4a3a2a|spots'],
 ['Precious Wentletrap',2,'beach afterstorm','tall|#f4f0e8|#c8c0b0'],['Nautilus',3,'deep pot','nautilus|#f4ece0|#b0603a'],['Paper Nautilus',3,'beach afterstorm winter','nautilus|#fbf8f0|#d8d0c0|paper'],['Golden Cowrie',3,'reef night','cowrie|#f0b040|#c07820']];
const PEARL_RAW=[['White Pearl',1,'#f4f4f8'],['Cream Pearl',1,'#f4ecd8'],['Pink Pearl',2,'#f8d0dc'],['Baroque Pearl',2,'#e8e4d8|baroque'],['Black Pearl',3,'#3a3a4a'],['Golden Pearl',3,'#f0c860'],['Blue Pearl',3,'#a0c8f0'],['Moon Pearl',4,'#e8f0ff|glow']];
const CURIO_RAW=[
 ['Green Sea Glass',0,'beach','glass|#6ac080'],['Driftwood Carving',1,'beach','carving'],['Blue Sea Glass',1,'beach','glass|#5a9ae0'],['Rusted Anchor',1,'wreck','anchor'],
 ['Cannonball',1,'wreck','cannonball'],['Red Sea Glass',2,'beach','glass|#e05050'],['Ammonite Fossil',2,'rocks low','ammonite'],['Ship in a Bottle',2,'beach','shipbottle'],
 ['Megalodon Tooth',3,'deep','tooth'],['Ambergris',3,'beach afterstorm','ambergris'],['Brass Diving Helmet',3,'wreck','helmet'],['Mermaid\'s Comb',3,'rocks fog dawn','comb']];
const BOTTLE_LETTERS=[['To whoever finds this','harbour',0],['The night the lamp went out','shallows',0],['Five boats, one harbour','estuary',1],['The bell under the water','wreck',1],['Gravel-Jaw takes the Mary Ann','wreck',1],['A golden fish at the king tide','harbour',1],
 ['Fog and the pale lady','shallows',2],['What the keeper saw in the trench','deep',2],['The co-op wars','kelp',2],['A truce at the lighthouse','reef',2],['The odd one','blue',3],['Where I hid the key','rocks',3]];
const COINS=[['Shell Bead Token',0,'beach','#e8d8c0'],['Founders\' Penny',0,'harbour','#c87840'],['Harbour Ha\'penny',1,'harbour','#b8703a'],['Lighthouse Florin',1,'rocks','#c8c8d0'],['Storm-Year Crown',2,'beach afterstorm','#d8d8e0'],
 ['Co-op Union Token',2,'estuary','#a8a070'],['Silver Gull Dollar',2,'wreck','#e0e4ec'],['Pirate Piece of Eight',3,'wreck','#d8d8d0'],['Golden Sovereign',3,'deep','#f0c040'],['The First $REEL',4,'gift','#ffd24d']];
const LURES=[['Red Devil Spoon',0,'harbour','spoon|#e04a3a'],['Bone Jig',0,'shallows','jig|#f0e8d8'],['Feather Popper',1,'reef','popper|#f0a040'],['Copper Spinner',1,'estuary','spinner|#c87840'],
 ['Painted Wooden Minnow',2,'kelp','minnow|#3a8ad0'],['Old Faithful Brass Spoon',2,'wreck','spoon|#d8b040'],['Glow-eye Squid Jig',3,'deep','squidjig|#8af0ff'],['The Gilded Fly',3,'blue','fly|#ffd24d']];
const JUNK_RAW=[['Old Boot',0,'boot'],['Tin Can',0,'can'],['Seaweed Clump',0,'weed'],['Tangled Line',0,'line'],['Plastic Bag',0,'bag'],['Broken Rod',1,'rod'],['Car Tyre',1,'tyre'],['Shopping Trolley',1,'trolley'],['Bicycle',2,'bike'],['Rubber Duck',2,'duck']];
/* ---------- build the catalogue ---------- */
const slug=s=>s.toLowerCase().replace(/\$/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const CAT=[];const CATI={};
const CAT_TABS=[['fish','Fish'],['legend','Legends'],['treasure','Treasure'],['coral','Coral'],['shell','Shells'],['pearl','Pearls'],['curio','Curios'],['set','Sets'],['junk','Junk']];
const FISH_PRICE=[12,35,110,380,2500],FIND_PRICE={treasure:[30,80,220,700,2000],coral:[15,40,120,400,1500],shell:[6,20,70,300,900],pearl:[30,60,180,600,2000],curio:[10,40,150,600,1500],set:[15,40,120,400,0],junk:[1,3,5,5,5]};
function addEntry(e){e.no=CAT.length+1;CAT.push(e);CATI[e.id]=e;return e}
for(const[n,z,r,c,a,b,art]of FISH_RAW)addEntry({id:slug(n),n,cat:'fish',z,r,how:/\bpot\b/.test(c)?'pot':'fish',c,sz:[a,b],price:FISH_PRICE[r],art});
for(const[n,z,c,what,a,b,art]of LEGEND_RAW)addEntry({id:slug(n),n,cat:'legend',z,r:4,how:'fish',c,sz:[a,b],price:FISH_PRICE[4],art,what});
for(const[n,r,how,z,art]of TREASURE_RAW){const[h0,...rest]=how.split(' ');addEntry({id:slug(n),n,cat:'treasure',z,r,how:h0,c:rest.join(' ')||'any',price:FIND_PRICE.treasure[r],art})}
for(const[n,r,where,art]of CORAL_RAW){const[z,...rest]=where.split(' ');addEntry({id:slug(n),n,cat:'coral',z,r,how:'snag',c:rest.join(' ')||'any',price:FIND_PRICE.coral[r],art})}
for(const[n,r,where,art]of SHELL_RAW){const[z,...rest]=where.split(' ');const how=z==='beach'||z==='rocks'?'comb':rest.includes('pot')?'pot':'snag';addEntry({id:slug(n),n,cat:'shell',z,r,how,c:rest.filter(t=>t!=='pot').join(' ')||'any',price:FIND_PRICE.shell[r],art})}
for(const[n,r,art]of PEARL_RAW)addEntry({id:slug(n),n,cat:'pearl',z:'any',r,how:'oyster',c:n==='Moon Pearl'?'fullmoon night':'any',price:FIND_PRICE.pearl[r],art});
for(const[n,r,where,art]of CURIO_RAW){const[z,...rest]=where.split(' ');addEntry({id:slug(n),n,cat:'curio',z,r,how:z==='beach'||z==='rocks'?'comb':'salvage',c:rest.join(' ')||'any',price:FIND_PRICE.curio[r],art})}
BOTTLE_LETTERS.forEach(([t,z,r],i)=>addEntry({id:'letter_'+(i+1),n:`Letter ${i+1}: ${t}`,short:`Letter ${i+1}`,cat:'set',set:'bottles',z,r,how:z==='rocks'?'comb':'hook',c:'any',price:0,art:'bottle|'+(i+1)}));
for(const[n,r,where,col]of COINS){const[z,...rest]=where.split(' ');addEntry({id:slug(n),n,cat:'set',set:'coins',z,r,how:z==='beach'||z==='rocks'?'comb':z==='gift'?'gift':'salvage',c:rest.join(' ')||'any',price:r<4?FIND_PRICE.set[r]:0,art:'coin|'+col})}
for(const[n,r,z,art]of LURES)addEntry({id:slug(n),n,cat:'set',set:'lures',z,r,how:'snag',c:'any',price:FIND_PRICE.set[r]+10,art:'lure|'+art});
for(const[n,r,art]of JUNK_RAW)addEntry({id:slug(n),n,cat:'junk',z:'any',r,how:'hook',c:'any',price:FIND_PRICE.junk[r],art:'junk|'+art});
const SETS={bottles:{n:'Messages in Bottles',reward:'The bottle story and the lighthouse key room',shells:1500},coins:{n:'Old Gullhaven Coins',reward:'The First $REEL',shells:1000},lures:{n:'Vintage Lures',reward:'A trophy lure case and 1,000 Shells',shells:1000}};
/* ---------- conditions ---------- */
const TOKENS_TIME=new Set(['any','day','night','dawn','dusk','dawn/dusk','dusk/night','midnight']);
function condParts(c){const p={time:null,tide:null,sky:null,season:null,moon:null,method:[],bait:null,where:null,flags:[]};
  for(const t of String(c||'').split(' ')){if(!t)continue;if(TOKENS_TIME.has(t))p.time=t;else if(['rising','falling','high','low','kingtide'].includes(t))p.tide=t;else if(['calm','windy','rain','storm','fog','afterstorm'].includes(t))p.sky=t;
    else if(['spring','summer','autumn','winter'].includes(t))p.season=t;else if(['newmoon','fullmoon'].includes(t))p.moon=t;else if(['squidjig','weedbait','crabbait'].includes(t))p.bait=t;else if(['birds','debris','schools'].includes(t))p.where=t;
    else if(['pot','release','deepreel','lamp'].includes(t))p.method.push(t);else p.flags.push(t)}if(p.time==='any')p.time=null;return p}
for(const e of CAT){e.cp=condParts(e.c);e.release=e.cp.method.includes('release')}
const BAIT_NAME={squidjig:'a squid jig',weedbait:'weed bait',crabbait:'crab bait'};
const TIME_PH={day:'by day',night:'at night',dawn:'at dawn',dusk:'at dusk','dawn/dusk':'at dawn or dusk','dusk/night':'from dusk into the night',midnight:'around midnight'};
const TIDE_PH={rising:'on a rising tide',falling:'on a falling tide',high:'at high tide',low:'at low tide',kingtide:'on a king tide'};
const SKY_PH={calm:'in calm weather',windy:'when the wind is up',rain:'in the rain',storm:'in a storm',fog:'in the fog',afterstorm:'after a storm'};
const SEASON_PH={spring:'in spring',summer:'in summer',autumn:'in autumn',winter:'in winter'};
const MOON_PH={newmoon:'under a new moon',fullmoon:'under a full moon'};
const WHERE_PH={birds:'Look for diving birds.',debris:'Look near floating debris.',schools:'Look for bait schools.'};
function zonePh(z){if(z==='beach')return'on the beach';if(z==='rocks')return'on the rock platform';if(z==='any')return'';if(!ZONES[z])return'';const n=ZONES[z].n;return'in '+(/^The /.test(n)?n:'the '+n)}
function hintFor(e){const p=e.cp;if(p.flags.includes('oddone'))return'Rumoured to bite once a year. Nobody agrees where.';
  if(e.how==='gift')return'Given, never found. Complete the coin set.';
  let lead;if(e.how==='pot')lead='Turns up in pots';else if(e.how==='comb')lead=e.z==='rocks'?'Found in the rock pools':'Washes up';else if(e.how==='salvage')lead='Salvaged from the seabed';else if(e.how==='snag')lead='Snagged on a line';else if(e.how==='oyster')lead='Found inside a pearl oyster';else if(e.how==='hook')lead=e.cat==='junk'?'Hooked by accident':'Hooked now and then';else lead=e.cat==='legend'?'Sighted':'Bites';
  const bits=[lead];if(p.time)bits.push(TIME_PH[p.time]);
  if(e.how==='comb'&&e.z==='beach')bits.push('on the beach at low tide');else{const zp=zonePh(e.z);if(zp)bits.push(zp)}
  if(p.tide)bits.push(TIDE_PH[p.tide]);if(p.sky)bits.push(SKY_PH[p.sky]);if(p.season)bits.push(SEASON_PH[p.season]);if(p.moon)bits.push(MOON_PH[p.moon]);
  let s=bits.join(' ')+'.';if(p.flags.includes('spawn'))s=s.replace(/\.$/,' during the coral spawn (full-moon summer nights).');
  if(p.bait)s+=` Likes ${BAIT_NAME[p.bait]}.`;if(p.where)s+=' '+WHERE_PH[p.where];
  if(p.method.includes('deepreel'))s+=' Needs a deep reel.';if(p.method.includes('lamp'))s+=' Needs a deck lamp.';if(e.release)s+=' Protected: log it, then let it go.';
  return s}
for(const e of CAT)e.hint=hintFor(e);
const catOf=c=>CAT.filter(e=>e.cat===c);
