/* Datos musicales: notas, frecuencias y tabla de posiciones de la vara.
   Instrumento: trombón tenor en Si♭ SIN transpositor (trigger), clave de fa, sonido real (sin transposición). */
'use strict';
const NAMES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const BASE = [0, 2, 4, 5, 7, 9, 11];
const ACCV = { n: 0, '#': 1, b: -1 };
const ACCS = { n: '', '#': '♯', b: '♭' };
const DURS = {
  w: { beats: 4, name: 'Redonda' },
  h: { beats: 2, name: 'Blanca' },
  q: { beats: 1, name: 'Negra' },
  e: { beats: 0.5, name: 'Corchea' },
  s: { beats: 0.25, name: 'Semicorchea' }
};
const MIN_MIDI = 40, MAX_MIDI = 70; // Mi2 .. Si♭4 : rango práctico configurado
/* Posición principal de la vara para cada nota (índice = midi - 40). */
const POS = [7, 6, 5, 4, 3, 2, 1, 7, 6, 5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 3, 2, 3, 2, 1];
/* Posición alternativa (midi -> posición). */
const ALT = { 53: 6, 59: 7, 60: 6, 62: 4, 64: 7, 65: 6, 66: 5, 67: 4 };
/* Centímetros aproximados de la vara desde la posición 1. */
const CMS = [0, 8, 16.5, 25.5, 35, 45, 56];
/* Notas que, por ser armónicos agudos (7.º parcial), suelen sonar bajas. */
const LOWPARTIAL = { 66: true, 67: true };
const PCN = [[0, 'n'], [0, '#'], [1, 'n'], [2, 'b'], [2, 'n'], [3, 'n'], [3, '#'], [4, 'n'], [5, 'b'], [5, 'n'], [6, 'b'], [6, 'n']];

function beatsOf(n) { return DURS[n.d].beats * (n.dot ? 1.5 : 1); }
function midiOf(n) { return 12 * (n.o + 1) + BASE[n.n] + ACCV[n.a]; }
function freqOf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function noteFromMidi(m) { const p = PCN[((m % 12) + 12) % 12]; return { n: p[0], a: p[1], o: Math.floor(m / 12) - 1 }; }
function label(n) { return NAMES[n.n] + ACCS[n.a]; }
function labelO(n) { return label(n) + n.o; }
function dIdx(n) { return n.o * 7 + n.n; }
function posInfo(m) {
  const inRange = m >= MIN_MIDI && m <= MAX_MIDI;
  if (!inRange) return { inRange, main: null, alt: null };
  return { inRange, main: POS[m - MIN_MIDI], alt: ALT[m] || null, low: !!LOWPARTIAL[m] };
}
function posNotes(p) { const r = []; for (let m = MIN_MIDI; m <= MAX_MIDI; m++) if (POS[m - MIN_MIDI] === p) r.push(m); return r; }
function rangeMsg(m) {
  if (m < MIN_MIDI) return 'Esta nota es más grave que el rango práctico de la app (Mi2 a Si♭4). Se necesitaría una posición extendida o nota pedal; no se asigna posición.';
  if (m > MAX_MIDI) return 'Esta nota es más aguda que el rango práctico de la app (Mi2 a Si♭4). Está fuera del rango para principiantes; no se asigna posición.';
  return '';
}
function altText(m) {
  const i = posInfo(m); if (!i.inRange) return '';
  let t = '';
  if (i.alt) t += 'También puede tocarse en posición ' + i.alt + '. Usa la ' + i.main + ' como principal; la ' + i.alt + ' sirve para pasajes rápidos o para corregir la afinación.';
  if (i.low) t += (t ? ' ' : '') + 'Esta nota es un armónico agudo de su posición y suele sonar baja: sube un poco la afinación con los labios o acorta la vara unos milímetros.';
  return t;
}
/* Desviación entre posición y nota: comprueba con la serie armónica (independiente de la tabla). */
function seriesCheck(m, p) {
  const ped = 34 - (p - 1); // Si♭1 = midi 34 es el pedal de la 1.ª posición
  const off = m - ped;
  return [12, 19, 24, 28, 31, 34, 36].includes(off);
}
function staffPlace(d) {
  // d: índice diatónico; línea inferior (Sol2) = 18
  if (d < 18) { const k = (18 - d); return k % 2 === 0 ? 'en una línea adicional debajo del pentagrama' : 'en un espacio debajo del pentagrama o entre líneas adicionales'; }
  if (d > 26) return (d - 26) % 2 === 0 ? 'en una línea adicional encima del pentagrama' : 'en un espacio encima del pentagrama o entre líneas adicionales';
  if ((d - 18) % 2 === 0) return 'en la línea ' + ((d - 18) / 2 + 1) + ' del pentagrama (contando desde abajo)';
  return 'en el espacio ' + ((d - 19) / 2 + 1) + ' del pentagrama (contando desde abajo)';
}
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtHz(f) { return f.toFixed(1).replace('.', ',') + ' Hz'; }
