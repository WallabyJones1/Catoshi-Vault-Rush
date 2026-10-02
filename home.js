(function () {
  'use strict';
  const hero=document.getElementById('home-catoshi');
  if(!hero)return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const animated='catoshi-home-v2.webp',gif='catoshi-home-v2.gif',still='catoshi-home-still-v2.png';
  let fallback=false;
  function update(){hero.src=reduced?.matches?still:(fallback?gif:animated);}
  // The native image loops even without this script. Canvas and RAF are no
  // longer required for the homepage hero to appear or animate.
  function fallbackImage(){
    const source=hero.getAttribute('src');
    if(source===animated){fallback=true;hero.src=gif;}
    else if(source===gif)hero.src=still;
  }
  hero.addEventListener('error',fallbackImage);
  reduced?.addEventListener?.('change',update);
  if(reduced?.matches)update();
  else if(hero.complete&&hero.naturalWidth===0)fallbackImage();
})();
