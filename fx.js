// ============================================================
// fx.js — Sound (WebAudio) + visual effects for Castle Chaos
// ============================================================

const FX = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // A single tone with an envelope
  tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  // Named sound cues
  sound(name) {
    switch (name) {
      case 'heal':    this.tone(523, 0.12, 'sine', 0.18); this.tone(784, 0.18, 'sine', 0.16, 0.10); break;
      case 'damage':  this.tone(180, 0.18, 'sawtooth', 0.22); this.tone(90, 0.22, 'square', 0.18, 0.05); break;
      case 'coins':   this.tone(880, 0.06, 'square', 0.12); this.tone(1175, 0.06, 'square', 0.12, 0.07); this.tone(1568, 0.08, 'square', 0.10, 0.14); break;
      case 'scam':    this.tone(330, 0.1, 'sawtooth', 0.2); this.tone(247, 0.18, 'sawtooth', 0.2, 0.09); this.tone(165, 0.25, 'square', 0.18, 0.2); break;
      case 'card':    this.tone(440, 0.07, 'triangle', 0.14); this.tone(660, 0.07, 'triangle', 0.12, 0.05); break;
      case 'shield':  this.tone(392, 0.1, 'sine', 0.16); this.tone(587, 0.16, 'sine', 0.16, 0.08); break;
      case 'win':     [523,659,784,1047].forEach((f,i)=>this.tone(f,0.18,'triangle',0.18,i*0.12)); break;
      case 'task':    this.tone(660, 0.05, 'square', 0.1); break;
      case 'done':    this.tone(784, 0.1, 'triangle', 0.16); this.tone(1047, 0.14, 'triangle', 0.14, 0.09); break;
      case 'click':   this.tone(520, 0.04, 'square', 0.08); break;
      case 'poison':  this.tone(200, 0.2, 'sawtooth', 0.2); this.tone(140, 0.3, 'sine', 0.16, 0.1); break;
      case 'gong':    this.tone(196, 0.5, 'sine', 0.22); this.tone(294, 0.6, 'sine', 0.14, 0.02); break;
    }
  },

  // Full-screen colored flash
  flash(color) {
    const el = document.getElementById('fx-flash');
    if (!el) return;
    el.style.background = color;
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  },

  // Shake the game board
  shake() {
    const el = document.getElementById('game-screen');
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  },

  // Floating text that drifts up and fades (centered by default)
  float(text, color = '#fff') {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    const d = document.createElement('div');
    d.className = 'fx-float';
    d.textContent = text;
    d.style.color = color;
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  },

  // Burst of emoji particles from center
  burst(emoji, n = 10) {
    const layer = document.getElementById('fx-layer');
    if (!layer) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fx-particle';
      p.textContent = emoji;
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const dist = 80 + Math.random() * 120;
      p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  },

  // Convenience combos used by the engine
  event(kind) {
    switch (kind) {
      case 'heal':   this.sound('heal');   this.flash('rgba(80,255,140,0.25)'); this.float('+HP', '#6bff8a'); break;
      case 'damage': this.sound('damage'); this.flash('rgba(255,60,60,0.3)');  this.shake(); this.float('-HP', '#ff6b6b'); break;
      case 'coins':  this.sound('coins');  this.float('+🪙', '#ffd86b'); break;
      case 'scam':   this.sound('scam');   this.flash('rgba(180,60,200,0.3)'); this.shake(); this.burst('🎭', 8); break;
      case 'shield': this.sound('shield'); this.flash('rgba(120,180,255,0.22)'); this.float('🛡️', '#6bb6ff'); break;
      case 'poison': this.sound('poison'); this.flash('rgba(140,80,200,0.3)'); this.float('☠️', '#b46bff'); break;
      case 'win':    this.sound('win');    this.burst('🎉', 16); break;
    }
  },
};
