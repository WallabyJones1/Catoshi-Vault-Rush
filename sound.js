(function () {
  'use strict';
  const settings = window.RushAudioConfig || {};
  const button = document.getElementById('sound-toggle');
  let muted = false, context = null, master = null, noiseBuffer = null;
  let music = null, playing = false, voices = 0, lastCoin = -1;
  try { muted = localStorage.getItem('rush-muted') === '1'; } catch (_) {}
  const volume = value => Math.max(0, Math.min(1, Number(value) || 0));
  function updateButton() {
    button.textContent = 'SOUND ' + (muted ? 'OFF' : 'ON');
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? 'Enable game audio' : 'Mute game audio');
  }
  function syncMusic() {
    if (!music) return;
    music.muted = muted;
    if (playing && !muted && !document.hidden) music.play().catch(() => {});
    else music.pause();
  }
  function unlock() {
    if (muted) return;
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          context = new AudioContext(); master = context.createGain();
          master.gain.value = volume(settings.effectsVolume ?? .32);
          master.connect(context.destination);
          noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
      }
      if (context?.state === 'suspended') context.resume().catch(() => {});
      if (!music && ['music.mp3','music.ogg','music.wav'].includes(settings.musicSrc)) {
        music = new Audio(settings.musicSrc); music.loop = true;
        music.volume = volume(settings.musicVolume ?? .20); music.preload = 'auto';
        // This first play comes directly from a gesture, including on iPhone.
        music.play().then(() => { if (!playing || muted) music.pause(); }).catch(() => {});
      }
      syncMusic();
    } catch (_) { /* Audio support never blocks gameplay. */ }
  }
  function envelope(gain, start, duration, level) {
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level), start + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  }
  function tone(frequency, end, duration, level, delay = 0, type = 'sine') {
    if (muted || !context || context.state !== 'running' || voices >= 12) return;
    voices++;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    envelope(gain, start, duration, level);
    oscillator.connect(gain); gain.connect(master);
    oscillator.onended = () => { voices--; oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  function noise(duration, level, cutoff) {
    if (muted || !context || context.state !== 'running' || voices >= 12) return;
    voices++;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    envelope(gain, context.currentTime, duration, level);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    source.onended = () => { voices--; source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(); source.stop(context.currentTime + duration + .02);
  }
  function effect(event) {
    if (muted || !playing || document.hidden) return;
    if (event.type === 'coin') {
      if (!context || context.currentTime - lastCoin < .045) return;
      lastCoin = context.currentTime;
      tone(920, 1140, .09, .13); tone(1380, 1550, .10, .07, .035);
    } else if (event.type === 'jump') { tone(180, 410, .12, .14, 0, 'triangle'); }
    else if (event.type === 'land') { noise(.09, .10, 600); tone(90, 48, .09, .14); }
    else if (event.type === 'stumble') { noise(.16, .16, 950); tone(140, 55, .15, .18, 0, 'triangle'); }
    else if (event.type === 'crash') { noise(.32, .23, 650); tone(100, 30, .35, .23); }
    else if (event.type === 'trick' && /BACKFLIP/.test(event.text)) {
      [420, 560, 840].forEach((pitch, i) => tone(pitch, pitch * 1.02, .13, .11, i * .065, 'triangle'));
    } else if (event.type === 'trick' && event.text === 'RUSH BOOST') {
      tone(170, 620, .25, .13, 0, 'triangle'); noise(.15, .07, 1600);
    } else if (event.type === 'trick' && event.text === 'CABLE GRIND') { noise(.12, .06, 2200); }
  }
  function burst() { if (!muted && playing) { noise(.4, .22, 750); tone(130, 35, .38, .24); tone(260, 580, .24, .09, .07, 'triangle'); } }
  function setPlaying(value) { playing = value; syncMusic(); }
  button.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('rush-muted', muted ? '1' : '0'); } catch (_) {}
    if (master) master.gain.value = muted ? 0 : volume(settings.effectsVolume ?? .32);
    if (!muted) unlock(); syncMusic(); updateButton();
  });
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', syncMusic);
  updateButton();
  window.RushSound = { unlock, effect, burst, setPlaying };
})();
