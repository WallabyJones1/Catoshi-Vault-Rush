/* ================= Gullhaven config: the one place for the token address, fees, pools and machine odds =================
   The game, server.js and the shared rules all read this. Amounts are whole $REEL unless a key says otherwise.
   To go live: put your SPL mint and wallets in server/config.json (or the GH_* env vars). The values here are the
   defaults and the play-mode settings; the server's config always wins. */
const CFG={
  NAME:'Gullhaven',TICKER:'$REEL',SOFT:'Shells',
  TOKEN:{
    chain:'solana',cluster:'mainnet-beta',
    mint:'',               // <- your $REEL SPL mint address
    decimals:6,            // SPL decimals of the mint
    treasury:'',           // wallet that receives deposits, licence and co-op fees (its $REEL token account is derived)
    payout:'',             // hot wallet the operator pays withdrawals and prizes from (keys never live in the game)
    nftCollection:'',      // Metaplex collection address for the Founding Fishers
    rpc:'https://api.mainnet-beta.solana.com',
    usdPerReel:0.00005,    // display only: 10,000 $REEL is about $0.50 at launch
    explorer:'https://solscan.io/tx/'
  },
  // one fishing licence per wallet + X account; the fee is split straight into the town's prize pools
  LICENCE:{fee:25000,split:{cup:.6,bounty:.25,machine:.15}},
  // co-op entry fees go to the co-op's treasury, with a cut to the Cup; members vote on how the treasury is spent
  COOP:{feeDefault:{brine:10000,gullwing:20000,reef:15000,deep:25000,mob:8000},feeMin:0,feeCap:200000,
    split:{treasury:.7,cup:.3},switchPerSeason:1,buckets:['fleet','bait','workshop','dividends','reserve']},
  // the daily Harbour Cup: paid out at 00:00 UTC from licence + co-op fees, never from new tokens
  // the AI crews decide the placings; the members' share of a prize goes to the real members who fished that day (by
  // points, at least minPts each). A co-op with no qualifying members rolls its members' share into tomorrow's Cup.
  CUP:{payoutFrac:.7,places:[.36,.24,.18,.13,.09],memberShare:.6,minPts:5,
    rarW:[1,3,9,30,120],firstBonus:6,legendBonus:200,softCap:[600,1500],taper:[1,.5,.2]},
  BOUNTY:{share:.5},       // a legendary catch takes half of the bounty pool
  // the Founding Fisher machine: 5 capsules, NFT chance rises with price so one NFT is about 200,000 $REEL (~$10) of pulls.
  // Every other capsule pays a multiple of its price from the prize pool. Wins are only offered while the pool can cover them.
  MACHINE:{seed:5000000,target:12000000,poolTake:.6,crewTake:.05,safety:3,
    drop:{n:1,size:100},  // the 500 are released 100 at a time; the operator opens the next drop
    tiers:[{k:'tide',n:'Tidepool',price:10000,nft:.05,col:'#7fdcc0'},{k:'reef',n:'Reef',price:20000,nft:.10,col:'#ff8a7a'},
           {k:'kelp',n:'Kelp',price:30000,nft:.15,col:'#9ccf6a'},{k:'wreck',n:'Wreck',price:40000,nft:.20,col:'#c9a0ff'},
           {k:'abyss',n:'Abyss',price:50000,nft:.25,col:'#ffd24d'}],
    // when no NFT: [multiple, weight]; a hot pool (above target) doubles the weight of the wins
    mults:[[.3,58],[.5,32],[2,8],[5,2]]},
  // your crew: every Founding Fisher you own, plus up to 3 hired deckhands, can be sent on auto-fish trips.
  // A trip fee goes 60% into the Crew Fund, 30% into today's Cup and 10% to your co-op. When the crew get back they
  // sell the catch for Shells, score half Cup points, and bring a $REEL cheque from the Crew Fund. The cheque's
  // average size (its return, "rtp") depends on who went: deckhands and Common fishers lose a little on average,
  // Rare and Legendary Founding Fishers come out ahead. Longer trips and higher levels pay a little more. The luck
  // table spreads each cheque around that average, and a fund below its target pays smaller cheques until it refills.
  CREW:{hireShells:[1500,4000,9000],maxHired:3,ptsShare:.5,nftBonus:1.2,
    split:{pool:.6,cup:.3,treasury:.1},
    rtp:{hand:.5,nft:[.75,.9,1.08,1.35]},lvlK:.01,lvlCap:.15,
    luck:[[.3,40],[.8,30],[1.5,18],[3,9],[8,3]],
    fund:{seed:6000000,target:6000000,safety:4},
    trips:[{k:'short',n:'Short trip',min:24,fee:2000,rolls:6,rtp:.9},{k:'half',n:'Half day',min:120,fee:5000,rolls:22,rtp:1},{k:'long',n:'Overnight',min:480,fee:12000,rolls:70,rtp:1.1}]},
  // everything else that feeds the daily Cup
  CUPFEED:{exchange:.5,machine:.05,derby:.5,cosmetic:1},
  DERBY:{entry:5000},
  COSMETIC:{boatName:5000,paint:8000},
  // Harbour Exchange (play mode AMM between Shells and $REEL); live mode only sells Shells for $REEL
  EXCHANGE:{pool0:{s:600000,r:3000000},fee:.01,dailyReelOut:60000},
  PLAY:{startReel:150000,startShells:250,faucet:100000}
};
const reelUsd=n=>n*CFG.TOKEN.usdPerReel;
const fmtUsd=n=>{const v=reelUsd(n);return v>=100?'$'+Math.round(v).toLocaleString('en-US'):v>=1?'$'+v.toFixed(2):'$'+v.toFixed(2)};
