/* Audio: Web Audio API. Sonido SINTETIZADO (no es una grabación de trombón). */
'use strict';
const Eng = (() => {
  let ctx = null, master = null, vol = 0.7, voices = [];
  function ensure() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) throw new Error('Este navegador no permite audio (Web Audio).');
      ctx = new C(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function setVol(v) { vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.01); }
  function tone(m, t, dur) {
    const c = ensure(), f = freqOf(m);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.7;
    const a = Math.min(0.05, dur / 3), r = Math.min(0.08, dur / 2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + a);
    g.gain.setValueAtTime(0.28, Math.max(t + a, t + dur - r)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    const v = { o1, o2, g }; voices.push(v);
    o1.onended = () => { voices = voices.filter(x => x !== v); };
  }
  function click(t, accent) {
    const c = ensure(), o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.06);
  }
  function stopAll() {
    const now = ctx ? ctx.currentTime : 0;
    voices.forEach(v => { try { v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(v.g.gain.value, now); v.g.gain.linearRampToValueAtTime(0.0001, now + 0.04); v.o1.stop(now + 0.06); v.o2.stop(now + 0.06); } catch (e) { } });
    voices = [];
  }
  return { ensure, setVol, tone, click, stopAll, now: () => ctx ? ctx.currentTime : 0, get vol() { return vol; }, get ctx() { return ctx; } };
})();

/* Reproductor de secuencias: Play / Pausa / Stop, tempo (BPM), metrónomo. */
const Player = {
  notes: [], starts: [], total: 0, bpm: 80, metro: false, state: 'stop',
  t0: 0, startBeat: 0, nextNote: 0, nextClick: 0, timer: null, timeouts: [],
  onMark: null, onState: null, onEnd: null,
  load(notes) {
    this.stop(true);
    this.notes = notes; this.starts = []; let b = 0;
    notes.forEach(n => { this.starts.push(b); b += DURS[n.d].beats; });
    this.total = b;
  },
  _set(s) { this.state = s; if (this.onState) this.onState(s); },
  play() {
    if (!this.notes.length) return false;
    try { Eng.ensure(); } catch (e) { throw e; }
    if (this.state === 'play') return true;
    const sb = this.state === 'pause' ? this.startBeat : 0;
    const spb = 60 / this.bpm;
    this.startBeat = sb;
    this.t0 = Eng.now() + 0.1 - sb * spb;
    this.nextNote = Math.max(0, this.starts.findIndex(x => x >= sb - 1e-6));
    this.nextClick = Math.ceil(sb - 1e-6);
    this._set('play');
    clearInterval(this.timer);
    this.timer = setInterval(() => this._tick(), 25);
    this._tick();
    return true;
  },
  _tick() {
    const now = Eng.now(), spb = 60 / this.bpm, hz = now + 0.2;
    while (this.nextNote < this.notes.length && this.t0 + this.starts[this.nextNote] * spb < hz) {
      const i = this.nextNote, n = this.notes[i], t = Math.max(this.t0 + this.starts[i] * spb, now);
      const dur = DURS[n.d].beats * spb;
      Eng.tone(midiOf(n), t, Math.max(0.08, dur * 0.96));
      this.timeouts.push(setTimeout(() => { if (this.state === 'play') { this.cur = i; if (this.onMark) this.onMark(i); } }, Math.max(0, (t - now) * 1000)));
      this.nextNote++;
    }
    while (this.nextClick < Math.ceil(this.total - 1e-6) && this.t0 + this.nextClick * spb < hz) {
      if (this.metro) Eng.click(Math.max(this.t0 + this.nextClick * spb, now), this.nextClick % 4 === 0);
      this.nextClick++;
    }
    if (this.nextNote >= this.notes.length && now > this.t0 + this.total * spb + 0.05) {
      this._finish();
    }
  },
  _clear() { clearInterval(this.timer); this.timer = null; this.timeouts.forEach(clearTimeout); this.timeouts = []; },
  _finish() { this._clear(); this.startBeat = 0; this.cur = -1; this._set('stop'); if (this.onMark) this.onMark(-1); if (this.onEnd) this.onEnd(); },
  pause() {
    if (this.state !== 'play') return;
    const spb = 60 / this.bpm, beat = (Eng.now() - this.t0) / spb;
    let i = 0; for (let k = 0; k < this.starts.length; k++) if (this.starts[k] <= beat + 1e-6) i = k;
    this.startBeat = this.starts[i] || 0;
    this._clear(); Eng.stopAll(); this._set('pause');
  },
  stop(silent) {
    this._clear(); Eng.stopAll(); this.startBeat = 0; this.cur = -1;
    const was = this.state; this.state = 'stop';
    if (!silent) { if (this.onState) this.onState('stop'); if (this.onMark) this.onMark(-1); }
    else if (was !== 'stop' && this.onState) this.onState('stop');
  },
  setBpm(b) {
    b = Math.max(30, Math.min(200, Math.round(b)));
    if (this.state === 'play') { const spb = 60 / this.bpm, beat = (Eng.now() - this.t0) / spb; this.bpm = b; this.t0 = Eng.now() - beat * (60 / b); }
    else this.bpm = b;
  },
  setMetro(v) { this.metro = !!v; }
};
/* Toca una sola nota (1.2 s). */
function playOne(n) { Eng.ensure(); Eng.tone(midiOf(n), Eng.now() + 0.03, 1.2); }
function playMidi(m) { Eng.ensure(); Eng.tone(m, Eng.now() + 0.03, 1.2); }
