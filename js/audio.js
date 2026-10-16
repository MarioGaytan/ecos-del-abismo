'use strict';
// =====================================================================
//  AUDIO — todo sintetizado con WebAudio (0 archivos, 0 KB de assets).
// =====================================================================

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

const TRACKS = [
  // bosque: La menor, tranquilo pero con pulso
  { bpm: 112, root: 57, wave: 'triangle', bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, null, 3, null, 5], arp: [12, 15, 19, 24, 19, 15, 12, 15, 10, 14, 17, 22, 17, 14, 10, 14], kick: [0, 8], hat: [4, 12] },
  // cripta: Re menor, lento y frío
  { bpm: 92, root: 50, wave: 'sine', bass: [0, null, null, null, 1, null, null, null, 0, null, null, null, -2, null, null, null], arp: [12, 13, 17, 20, 24, 20, 17, 13, 12, 13, 17, 19, 22, 19, 17, 13], kick: [0], hat: [6, 14] },
  // forja: Mi frigio, agresivo
  { bpm: 140, root: 52, wave: 'sawtooth', bass: [0, 0, null, 0, 1, null, 0, null, 0, 0, null, 0, 3, null, 1, null], arp: [12, null, 13, null, 16, null, 19, null, 12, null, 13, null, 19, null, 16, null], kick: [0, 4, 8, 12], hat: [2, 6, 10, 14] },
  // jefe
  { bpm: 156, root: 45, wave: 'square', bass: [0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 3, 5, 3, 1], arp: [24, 27, 31, 27, 24, 27, 31, 34, 24, 27, 31, 27, 22, 25, 29, 25], kick: [0, 4, 8, 12], hat: [2, 6, 10, 14, 15] },
  // raíces hundidas: Do# menor, goteo lento y misterioso
  { bpm: 100, root: 49, wave: 'sine', bass: [0, null, null, null, null, null, 3, null, -2, null, null, null, null, null, -5, null], arp: [12, null, 19, 15, null, 24, null, 19, 12, null, 17, 14, null, 22, null, 17], kick: [0, 10], hat: [4, 7, 12, 15] },
  // corazón del abismo: Si bemol locrio, disonante y urgente
  { bpm: 126, root: 46, wave: 'sawtooth', bass: [0, null, 0, 1, null, 0, 6, null, 0, null, 0, 1, null, 6, 5, 1], arp: [12, 18, 13, 24, 18, 13, 25, 18, 12, 18, 13, 22, 18, 13, 24, 30], kick: [0, 6, 8, 14], hat: [2, 4, 10, 12] },
];

const AU = {
  ac: null, master: null, sg: null, mg: null, nbuf: null, last: {},
  track: -1, step: 0, nextT: 0, timer: null,

  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ac = this.ac;
    this.master = ac.createGain(); this.master.gain.value = 0.55; this.master.connect(ac.destination);
    this.sg = ac.createGain(); this.sg.gain.value = 0.5; this.sg.connect(this.master);
    this.mg = ac.createGain(); this.mg.gain.value = 0.16; this.mg.connect(this.master);
    const len = ac.sampleRate * 0.6;
    this.nbuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.nbuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  tone(f0, f1, dur, type, vol, dest, at) {
    const ac = this.ac, t = at || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sg);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, type, dest, at) {
    const ac = this.ac, t = at || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = this.nbuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 2000;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sg);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  },

  sfx(n) {
    if (!this.ac || !SAVE.settings.sfx) return;
    const now = performance.now();
    const gap = { hit: 55, shoot: 70, gem: 40, kill: 50, zap: 70, slash: 60, boom: 80, ebullet: 120 }[n] || 30;
    if (now - (this.last[n] || 0) < gap) return;
    this.last[n] = now;
    const r = Math.random() * 0.1 + 0.95;
    switch (n) {
      case 'shoot': this.tone(880 * r, 440, 0.07, 'square', 0.06); break;
      case 'slash': this.noise(0.12, 0.18, 3500, 'bandpass'); this.tone(300 * r, 120, 0.1, 'sawtooth', 0.05); break;
      case 'dagger': this.tone(1400 * r, 900, 0.05, 'triangle', 0.06); break;
      case 'hit': this.noise(0.05, 0.12, 1800); break;
      case 'crit': this.tone(1200, 600, 0.08, 'square', 0.07); this.noise(0.06, 0.12, 4000, 'highpass'); break;
      case 'kill': this.tone(500 * r, 120, 0.09, 'square', 0.05); break;
      case 'hurt': this.tone(220, 60, 0.25, 'sawtooth', 0.2); this.noise(0.2, 0.2, 900); break;
      case 'dash': this.noise(0.18, 0.15, 2500, 'bandpass'); this.tone(300, 900, 0.12, 'sine', 0.06); break;
      case 'gem': this.tone(1300 * r, 1900, 0.05, 'sine', 0.05); break;
      case 'level': [0, 4, 7, 12].forEach((s, i) => this.tone(midi(72 + s), midi(72 + s), 0.18, 'square', 0.07, null, this.ac.currentTime + i * 0.06)); break;
      case 'pick': this.tone(660, 990, 0.12, 'triangle', 0.1); break;
      case 'boom': this.noise(0.45, 0.35, 600); this.tone(120, 30, 0.4, 'sine', 0.3); break;
      case 'zap': this.noise(0.12, 0.15, 5000, 'highpass'); this.tone(1800, 200, 0.1, 'sawtooth', 0.05); break;
      case 'ebullet': this.tone(420, 300, 0.08, 'triangle', 0.04); break;
      case 'chest': [0, 7, 12, 16, 19].forEach((s, i) => this.tone(midi(67 + s), midi(67 + s), 0.25, 'triangle', 0.1, null, this.ac.currentTime + i * 0.07)); break;
      case 'ult': this.tone(110, 880, 0.6, 'sawtooth', 0.15); this.noise(0.6, 0.2, 1200); break;
      case 'boss': this.tone(80, 40, 1.2, 'sawtooth', 0.25); this.tone(83, 41, 1.2, 'sawtooth', 0.2); break;
      case 'portal': this.tone(200, 1600, 0.8, 'sine', 0.15); break;
      case 'ui': this.tone(900, 900, 0.04, 'square', 0.05); break;
      case 'tier': [0, 3, 7, 10, 14].forEach((s, i) => this.tone(midi(64 + s), midi(64 + s), 0.3, 'sawtooth', 0.06, null, this.ac.currentTime + i * 0.05)); break;
      case 'dodge': this.tone(1500, 2500, 0.08, 'sine', 0.06); break;
    }
  },

  music(track) {
    if (!this.ac) return;
    if (this.track === track) return;
    this.track = track; this.step = 0; this.nextT = this.ac.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },
  stopMusic() { this.track = -1; },
  tick() {
    if (this.track < 0 || !this.ac || !SAVE.settings.music) return;
    const T = TRACKS[this.track], sp = 60 / T.bpm / 4, ac = this.ac;
    if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + 0.02;
    while (this.nextT < ac.currentTime + 0.12) {
      const i = this.step % 16, t = this.nextT;
      const b = T.bass[i];
      if (b !== null) this.tone(midi(T.root - 12 + b), midi(T.root - 12 + b), sp * 1.8, 'triangle', 0.5, this.mg, t);
      const a = T.arp[i];
      if (a !== null && a !== undefined) this.tone(midi(T.root + a), midi(T.root + a), sp * 0.9, T.wave, 0.12, this.mg, t);
      if (T.kick.includes(i)) this.tone(140, 40, 0.15, 'sine', 0.7, this.mg, t);
      if (T.hat.includes(i)) this.noise(0.04, 0.12, 7000, 'highpass', this.mg, t);
      this.nextT += sp; this.step++;
    }
  },
};
