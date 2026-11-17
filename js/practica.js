/* Módulo 7: práctica para principiantes (no es una evaluación académica). */
'use strict';
const LEVELS = {
  principiante: { name: 'Principiante', pool: [46, 48, 50, 53, 55, 57, 58], desc: 'Siete notas cómodas: Si♭2 a Si♭3 (escala de Si♭ mayor sin Mi♭).' },
  basico: { name: 'Básico', pool: range(43, 62), desc: 'De Sol2 a Re4, con sostenidos y bemoles.' },
  intermedio: { name: 'Intermedio', pool: range(40, 70), desc: 'Todo el rango práctico: Mi2 a Si♭4.' }
};
const TYPES = {
  nota: { name: 'Reconocer la nota', icon: '👀', desc: 'Mira la nota en clave de fa y di cómo se llama.' },
  pos: { name: 'Nota → posición', icon: '🎺', desc: 'Di en qué posición de la vara se toca la nota.' },
  np: { name: 'Posición → nota', icon: '↔️', desc: 'Dada una posición, elige una nota que se toque allí.' },
  oido: { name: 'Escucha e identifica', icon: '👂', desc: 'Escucha una nota y di cuál es.' },
  seq: { name: 'Leer una secuencia', icon: '🎼', desc: 'Lee 4 notas y marca sus posiciones, con tempo ajustable.' },
  diag: { name: 'Las siete posiciones', icon: '📏', desc: 'Mira la vara y di qué posición es.' }
};
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeQ(type, level) {
  const pool = LEVELS[level].pool;
  const mkNote = m => ({ ...noteFromMidi(m), d: 'q' });
  if (type === 'nota' || type === 'oido') {
    const m = rnd(pool), n = mkNote(m), L = label(n);
    const labs = [...new Set(pool.map(x => label(noteFromMidi(x))).concat(NAMES))].filter(x => x !== L);
    return { type, n, opts: shuffle([L, ...shuffle(labs).slice(0, 3)]), ans: L };
  }
  if (type === 'pos') { const n = mkNote(rnd(pool)); return { type, n, opts: [1, 2, 3, 4, 5, 6, 7], ans: posInfo(midiOf(n)).main }; }
  if (type === 'diag') { const p = 1 + Math.floor(Math.random() * 7); return { type, p, opts: [1, 2, 3, 4, 5, 6, 7], ans: p }; }
  if (type === 'np') {
    const ps = [...new Set(pool.map(x => posInfo(x).main))], p = rnd(ps);
    const good = rnd(pool.filter(x => posInfo(x).main === p));
    const bad = shuffle(pool.filter(x => posInfo(x).main !== p && posInfo(x).alt !== p && label(noteFromMidi(x)) !== label(noteFromMidi(good)))).slice(0, 3);
    const o = shuffle([good, ...bad]).map(x => labelO(noteFromMidi(x)));
    return { type, p, opts: o, ans: labelO(noteFromMidi(good)), good };
  }
  if (type === 'seq') {
    let m = rnd(pool); const ns = [];
    for (let i = 0; i < 4; i++) { ns.push(mkNote(m)); const k = pool.indexOf(m); m = pool[Math.max(0, Math.min(pool.length - 1, k + rnd([-2, -1, -1, 1, 1, 2])))]; }
    return { type, ns, got: [], opts: [1, 2, 3, 4, 5, 6, 7] };
  }
}

VIEWS.practica = m => {
  let level = 'principiante', type = 'nota', qs = [], i = 0, ok = 0, ans = null, saved = false;
  const total = t => t === 'seq' ? 4 : 8;

  function menu() {
    Player.stop(true);
    m.innerHTML = `<h1>🎯 Práctica</h1>
    <div class="msg i">Practica sin presión. Estos ejercicios te ayudan a aprender; <b>no son una evaluación</b> ni dan una calificación.</div>
    <div class="card"><h2>1. Elige tu nivel</h2><div class="seg" id="lv">${Object.keys(LEVELS).map(k => `<button data-k="${k}" class="${k === level ? 'on' : ''}">${LEVELS[k].name}</button>`).join('')}</div><p class="sub" id="ld">${LEVELS[level].desc}</p></div>
    <div class="card"><h2>2. Elige un ejercicio</h2><div class="grid" style="grid-template-columns:1fr 1fr">${Object.keys(TYPES).map(k => `<button class="tile ${k === type ? '' : ''}" data-t="${k}" style="min-height:96px;${k === type ? 'border-color:var(--pu);background:var(--pul)' : ''}"><span class="ic">${TYPES[k].icon}</span><b>${TYPES[k].name}</b><span class="d">${TYPES[k].desc}</span></button>`).join('')}</div></div>
    <button class="b go" id="st" style="width:100%">▶ Empezar</button>`;
    $$('#lv button').forEach(b => b.onclick = () => { level = b.dataset.k; menu(); });
    $$('.tile', m).forEach(b => b.onclick = () => { type = b.dataset.t; menu(); });
    $('#st').onclick = start;
  }
  function start() {
    qs = []; for (let k = 0; k < total(type); k++) qs.push(makeQ(type, level));
    i = 0; ok = 0; saved = false; show();
  }
  function head() { return `<div class="row" style="justify-content:space-between"><b>${LEVELS[level].name} · ${TYPES[type].name}</b><span class="pill">${Math.min(i + 1, qs.length)} / ${qs.length}</span></div>`; }
  function fb(good, html) { return `<div class="msg ${good ? 'o' : 'e'}" role="status"><b>${good ? '✔ ¡Muy bien!' : '✘ Todavía no.'}</b> ${html}</div>`; }
  function next(label) { return `<div class="row" style="margin-top:10px"><button class="b" id="nx">${label || (i + 1 < qs.length ? 'Siguiente ▶' : 'Ver resultado')}</button></div>`; }
  function bindNext() { $('#nx').onclick = () => { i++; ans = null; i < qs.length ? show() : end(); }; }
  function posExpl(n) { const mi = midiOf(n), pi = posInfo(mi); return `${labelO(n)} se toca en la posición <b>${pi.main}</b> (vara a ≈ ${CMS[pi.main - 1]} cm de la 1).${altText(mi) ? ' ' + altText(mi) : ''}`; }

  function show() {
    const q = qs[i]; ans = null;
    let body = '';
    if (q.type === 'nota') body = `<h2>¿Qué nota es?</h2><div class="staffbox" style="max-width:380px;margin:auto">${scoreSVG([q.n], { W: 300, names: false, hit: false })}</div><div class="opts" id="op">${q.opts.map(o => `<button class="b sec" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    if (q.type === 'pos') body = `<h2>¿En qué posición de la vara se toca?</h2><div class="staffbox" style="max-width:380px;margin:auto">${scoreSVG([q.n], { W: 300, names: true, hit: false })}</div><div class="opts seven" id="op">${q.opts.map(o => `<button class="b sec" data-v="${o}">${o}</button>`).join('')}</div>`;
    if (q.type === 'diag') body = `<h2>¿Qué posición muestra el dibujo?</h2>${slideSVG(q.p, { mini: true, hideNum: true })}<div class="opts seven" id="op">${q.opts.map(o => `<button class="b sec" data-v="${o}">${o}</button>`).join('')}</div>`;
    if (q.type === 'np') body = `<h2>¿Cuál de estas notas se toca en la posición ${q.p}?</h2><div style="max-width:520px;margin:auto">${slideSVG(q.p)}</div><div class="opts" id="op">${q.opts.map(o => `<button class="b sec" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    if (q.type === 'oido') body = `<h2>Escucha la nota. ¿Cuál es?</h2><div class="row"><button class="b go" id="hear">🔊 Escuchar</button><span class="sub">Sonido sintetizado. Puedes repetirlo.</span></div><div class="opts" id="op">${q.opts.map(o => `<button class="b sec" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="rev"></div>`;
    if (q.type === 'seq') body = `<h2>Lee la secuencia y marca la posición de cada nota</h2><div class="staffbox">${scoreSVG(q.ns, { names: false, hit: false, id: 'qseq' })}</div>
      <div class="card" style="margin:10px 0"><div class="row"><button class="b sm go" id="lis">▶ Escuchar a tempo</button><button class="b sm sec" id="stp">⏹ Stop</button><label class="row" style="gap:6px"><input type="checkbox" id="mt"> Metrónomo</label></div>
      <label class="f" style="margin-top:6px"><span>Tempo: <b id="bv">${Player.bpm}</b> BPM</span><input type="range" id="bp" min="30" max="160" value="${Math.min(160, Player.bpm)}"></label></div>
      <p id="prog" class="sub"></p><div class="opts seven" id="op">${q.opts.map(o => `<button class="b sec" data-v="${o}">${o}</button>`).join('')}</div><div id="rev"></div>`;
    m.innerHTML = `<h1>🎯 Práctica</h1>${head()}<div class="card" id="qb">${body}<div id="fb"></div></div>
     <div class="row"><button class="b sec sm" id="quit">← Salir al menú</button></div>`;
    $('#quit').onclick = menu;
    if (q.type === 'oido') $('#hear').onclick = () => { try { playOne(q.n); } catch (e) { alert(e.message); } };
    if (q.type === 'seq') {
      Player.load(q.ns); Player.onMark = k => { $$('#qseq .nt').forEach(g => g.classList.toggle('on', +g.dataset.i === k)); };
      $('#lis').onclick = () => { try { Player.stop(true); Player.load(q.ns); Player.play(); } catch (e) { alert(e.message); } };
      $('#stp').onclick = () => Player.stop();
      $('#bp').oninput = e => { Player.setBpm(+e.target.value); $('#bv').textContent = Player.bpm; };
      $('#mt').onchange = e => Player.setMetro(e.target.checked);
      progress();
    }
    $$('#op button').forEach(b => b.onclick = () => answer(b));
  }
  function progress() { const q = qs[i]; $('#prog').textContent = `Nota ${q.got.length + 1} de ${q.ns.length}: ¿en qué posición se toca?`; }
  function lock(right, picked) { $$('#op button').forEach(b => { b.disabled = true; if (b.dataset.v === String(right)) b.classList.add('right'); else if (b === picked) b.classList.add('wrong'); }); }

  function answer(b) {
    const q = qs[i], v = b.dataset.v;
    if (q.type === 'seq') {
      const k = q.got.length, n = q.ns[k], right = posInfo(midiOf(n)).main;
      q.got.push(+v); b.classList.add(+v === right ? 'right' : 'wrong'); setTimeout(() => b.classList.remove('right', 'wrong'), 450);
      $('#rev').insertAdjacentHTML('beforeend', `<div class="msg ${+v === right ? 'o' : 'e'}">${k + 1}. ${esc(label(n))}: ${+v === right ? '✔' : '✘ elegiste ' + v + ';'} ${posExpl(n)}</div>`);
      if (q.got.length < q.ns.length) { progress(); return; }
      const all = q.ns.every((n2, j) => q.got[j] === posInfo(midiOf(n2)).main); if (all) ok++;
      $$('#op button').forEach(x => x.disabled = true); $('#prog').textContent = '';
      $('#fb').innerHTML = fb(all, all ? 'Leíste toda la secuencia correctamente.' : 'Revisa las notas marcadas arriba y vuelve a intentarlo con otra secuencia.') + next();
      bindNext(); return;
    }
    let good = false, expl = '';
    if (q.type === 'nota') { good = v === q.ans; expl = good ? `${labelO(q.n)} está ${staffPlace(dIdx(q.n))}.` : `La respuesta es <b>${esc(q.ans)}</b>: ${labelO(q.n)} está ${staffPlace(dIdx(q.n))}.`; }
    if (q.type === 'pos') { good = +v === q.ans; expl = (good ? '' : `La respuesta es la posición <b>${q.ans}</b>. `) + posExpl(q.n); }
    if (q.type === 'diag') { good = +v === q.ans; expl = `${good ? '' : `Era la posición <b>${q.ans}</b>. `}En la posición ${q.p} la vara está a ≈ ${CMS[q.p - 1]} cm de la posición 1 (${q.p === 1 ? 'cerrada' : 'cada posición baja medio tono'}).`; }
    if (q.type === 'np') { good = v === q.ans; expl = `${good ? '' : `La respuesta es <b>${esc(q.ans)}</b>. `}En la posición ${q.p} se tocan, entre otras: ${posNotes(q.p).slice(0, 6).map(x => labelO(noteFromMidi(x))).join(', ')}.`; }
    if (q.type === 'oido') { good = v === q.ans; expl = `Era <b>${labelO(q.n)}</b> (${fmtHz(freqOf(midiOf(q.n)))}), ${staffPlace(dIdx(q.n))}; se toca en posición ${posInfo(midiOf(q.n)).main}.`; $('#rev').innerHTML = `<div class="staffbox" style="max-width:380px;margin:10px auto 0">${scoreSVG([q.n], { W: 300, names: true, hit: false })}</div>`; }
    if (good) ok++;
    lock(q.ans, b);
    $('#fb').innerHTML = fb(good, expl) + next(); bindNext();
  }
  function end() {
    Player.stop(true);
    if (!saved) { saved = true; Hist.add({ type: 'ejercicio', name: TYPES[type].name, data: { level, type, levelName: LEVELS[level].name, typeName: TYPES[type].name, ok, total: qs.length } }); }
    const f = ok === qs.length ? '¡Excelente práctica!' : ok >= qs.length / 2 ? 'Vas bien. Repite para afianzar.' : 'Sigue practicando: repetir ayuda mucho. Prueba el nivel anterior o repasa la Guía.';
    m.innerHTML = `<h1>🎯 Práctica terminada</h1><div class="card ok"><div class="big">${ok} de ${qs.length}</div><p>${f}</p><p class="sub">Esto es solo práctica, no una evaluación. Se guardó en tu historial (solo en este dispositivo).</p></div>
     <div class="row"><button class="b" id="again">🔁 Practicar de nuevo</button><button class="b sec" id="men">Menú de práctica</button><button class="b sec" id="gd">📖 Ver la guía</button></div>`;
    $('#again').onclick = start; $('#men').onclick = menu; $('#gd').onclick = () => go('guia');
  }
  if (App.practiceStart) { level = App.practiceStart.level; type = App.practiceStart.type; App.practiceStart = null; start(); } else menu();
};
