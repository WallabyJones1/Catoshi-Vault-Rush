// Audio starts with the normal play/input gesture; no sound button.
// All gameplay effects use cached PCM immediately; WAVs are a fallback.
// Supplied soundtrack: kaapz – Cat Arpeggio. Set musicSrc to '' to disable music.
window.RushAudioConfig = { enabled: true, musicSrc: 'music.mp3', musicVolume: 0.16, effectsVolume: 0.12, coinVolume: 0.12 };
