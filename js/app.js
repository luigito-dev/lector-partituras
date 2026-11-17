/* Aplicación: estado, navegación, Inicio, Posiciones, Guía e Historial. */
'use strict';
const App = {
  seq: [], sel: -1, title: '',
  cur: { n: 3, o: 3, a: 'n', d: 'q' },
  pages: [], pageSel: 0,
  pos: { n: 3, o: 3, a: 'n' },
  pendingAction: null
};
const VIEWS = {};
const NAV = [['inicio', '🏠', 'Inicio'], ['cargar', '📷', 'Partitura'], ['editor', '✏️', 'Editor'], ['posiciones', '🎺', 'Posiciones'], ['practica', '🎯', 'Práctica'], ['guia', '📖', 'Guía'], ['historial', '🕘', 'Historial']];

/* ---------- almacenamiento local ---------- */
const Store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const Hist = {
  all() { return Store.get('lpt_hist', []); },
  add(it) { const a = this.all(); it.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); it.date = new Date().toISOString(); a.unshift(it); return Store.set('lpt_hist', a.slice(0, 40)); },
  del(id) { Store.set('lpt_hist', this.all().filter(x => x.id !== id)); },
  clear() { Store.set('lpt_hist', []); }
};
function saveDraft() { Store.set('lpt_draft', { seq: App.seq, title: App.title, bpm: Player.bpm }); }
(function loadDraft() {
  const d = Store.get('lpt_draft', null);
  if (d && Array.isArray(d.seq)) { App.seq = d.seq.filter(validNote); App.title = d.title || ''; if (d.bpm) Player.bpm = d.bpm; }
})();
function validNote(n) { return n && DURS[n.d] && (n.r || (n.n >= 0 && n.n <= 6 && n.o >= 0 && n.o <= 7 && 'n#b'.includes(n.a))); }

/* ---------- navegación ---------- */
function go(v, act) { App.pendingAction = act || null; if (location.hash === '#/' + v) render(); else location.hash = '#/' + v; }
function render() {
  const v = (location.hash.replace('#/', '') || 'inicio');
  const name = VIEWS[v] ? v : 'inicio';
  Player.stop(true); Player.onMark = null; Player.onState = null; Player.onEnd = null;
  $('#nav').innerHTML = '<div class="brand">🎼 Lector de partituras<small>para trombón tenor en Si♭</small></div>' +
    NAV.map(n => `<button data-v="${n[0]}" class="${n[0] === name ? 'on' : ''}" aria-label="${n[2]}" ${n[0] === name ? 'aria-current="page"' : ''}><span class="ic">${n[1]}</span><span>${n[2]}</span></button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => go(b.dataset.v));
  const m = $('#main'); m.innerHTML = '';
  try { VIEWS[name](m); } catch (e) { m.innerHTML = `<div class="card err">Ocurrió un error al mostrar esta pantalla: ${esc(e.message)}</div>`; console.error(e); }
  window.scrollTo(0, 0);
  const act = App.pendingAction; App.pendingAction = null;
  if (act) { const el = $('#' + act); if (el) el.click(); }
}
window.addEventListener('hashchange', render);
window.addEventListener('error', e => { const m = $('#main'); if (m && !$('#errbar')) m.insertAdjacentHTML('afterbegin', `<div id="errbar" class="msg e">Algo falló: ${esc(e.message)}. Recarga la página si algo no responde.</div>`); });

/* ---------- selector de nota reutilizable ---------- */
function picker(root, st, opt, onChange) {
  opt = opt || {};
  root.innerHTML = `<div class="row"><div><div class="sub"><b>Nota</b></div><div class="seg" data-k="n">${NAMES.map((n, i) => `<button type="button" data-v="${i}" class="${st.n === i ? 'on' : ''}">${n}</button>`).join('')}</div></div></div>
  <div class="row" style="margin-top:8px"><div><div class="sub"><b>Alteración</b></div><div class="seg" data-k="a">${[['n', '♮ natural'], ['#', '♯ sostenido'], ['b', '♭ bemol']].map(a => `<button type="button" data-v="${a[0]}" class="${st.a === a[0] ? 'on' : ''}">${a[1]}</button>`).join('')}</div></div>
  <label class="f">Octava<select data-k="o">${[1, 2, 3, 4, 5].map(o => `<option value="${o}" ${st.o === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
  ${opt.dur ? `<div style="margin-top:8px"><div class="sub"><b>Duración</b></div><div class="seg" data-k="d">${Object.keys(DURS).map(k => `<button type="button" data-v="${k}" class="${st.d === k ? 'on' : ''}">${DURS[k].name}<small style="font-weight:400"> · ${DURS[k].beats} t</small></button>`).join('')}</div>
   <div class="row" style="margin-top:8px"><label class="row" style="gap:6px"><input type="checkbox" data-x="dot" ${st.dot ? 'checked' : ''}> Con puntillo (+½)</label><label class="row" style="gap:6px"><input type="checkbox" data-x="tie" ${st.tie ? 'checked' : ''}> Ligada con la siguiente</label><label class="row" style="gap:6px"><input type="checkbox" data-x="r" ${st.r ? 'checked' : ''}> Es un silencio</label></div></div>` : ''}`;
  $$('.seg', root).forEach(sg => $$('button', sg).forEach(b => b.onclick = () => {
    const k = sg.dataset.k; st[k] = k === 'n' ? +b.dataset.v : b.dataset.v;
    picker(root, st, opt, onChange); onChange(k);
  }));
  const so = $('select', root); so.onchange = () => { st.o = +so.value; onChange('o'); };
  $$('input[data-x]', root).forEach(c => c.onchange = () => { st[c.dataset.x] = c.checked; onChange(c.dataset.x); });
}

/* ---------- panel de información de una nota ---------- */
function noteInfoHTML(n) {
  if (n.r) return `<div class="big">Silencio de ${DURS[n.d].name.toLowerCase()}${n.dot ? ' con puntillo' : ''}</div><div class="sub">Dura ${beatsOf(n)} tiempo(s). No se toca ninguna nota: la vara descansa.</div>`;
  const m = midiOf(n), pi = posInfo(m), f = freqOf(m);
  let h = `<div class="big">${esc(labelO(n))}</div><div class="sub">Nombre: <b>${esc(label(n))}</b> · Octava: <b>${n.o}</b> · Frecuencia aproximada: <b>${fmtHz(f)}</b></div>`;
  if (!pi.inRange) return h + `<div class="msg e" style="margin-top:8px">⚠️ ${rangeMsg(m)}</div>`;
  h += `<div style="margin:8px 0"><span class="pill">Posición principal: ${pi.main}</span>${pi.alt ? ' <span class="pill" style="background:#fff">Alternativa: ' + pi.alt + '</span>' : ''} <span class="sub">(≈ ${CMS[pi.main - 1]} cm desde la posición 1)</span></div>`;
  h += slideSVG(pi.main);
  const t = altText(m); if (t) h += `<div class="msg i">💡 ${t}</div>`;
  return h;
}

/* ================= INICIO ================= */
VIEWS.inicio = m => {
  m.innerHTML = `<h1>🎼 Lector de partituras para trombón</h1>
  <p class="sub">Para estudiantes principiantes de trombón tenor en Si♭ (sin trigger), en clave de fa. ¿Qué quieres hacer?</p>
  <div class="grid" style="margin-top:12px">
   <button class="tile" data-go="cargar"><span class="ic">📄</span><b>Leer una partitura</b><span class="d">Mira tu partitura y escribe sus notas para oírlas.</span></button>
   <button class="tile" data-go="cargar" data-act="cam"><span class="ic">📷</span><b>Tomar una fotografía</b><span class="d">Usa la cámara de tu teléfono.</span></button>
   <button class="tile" data-go="cargar" data-act="fil"><span class="ic">🖼️</span><b>Subir imagen o PDF</b><span class="d">JPG, PNG, WebP o PDF.</span></button>
   <button class="tile" data-go="editor"><span class="ic">✏️</span><b>Escribir notas</b><span class="d">Agrega notas, escúchalas y mira su posición.</span></button>
   <button class="tile" data-go="practica"><span class="ic">🎯</span><b>Practicar</b><span class="d">Notas, posiciones y oído, por niveles.</span></button>
   <button class="tile" data-go="guia"><span class="ic">📖</span><b>Guía de posiciones</b><span class="d">Las 7 posiciones de la vara y teoría básica.</span></button>
  </div>
  <div class="card warn"><b>Importante: esta app todavía NO lee partituras automáticamente.</b><p>No incluye un motor de reconocimiento óptico (OMR). Cuando subes una foto o PDF, la app te la muestra y tú escribes las notas en el editor. Nunca inventa notas.</p></div>
  <div class="card"><b>Tus datos están en tu dispositivo.</b><p class="sub">No necesitas cuenta. El historial se guarda solo en este navegador y este dispositivo. Las fotos no se guardan.</p></div>
  <div class="card"><b>Sobre el sonido.</b><p class="sub">El sonido es <b>sintetizado</b> por el navegador; no es una grabación real de trombón.</p></div>`;
  $$('.tile', m).forEach(t => t.onclick = () => go(t.dataset.go, t.dataset.act));
};

/* ================= POSICIONES ================= */
VIEWS.posiciones = m => {
  const st = App.pos;
  m.innerHTML = `<h1>🎺 Posiciones de la vara</h1>
  <p class="sub">Trombón tenor en Si♭ sin trigger, clave de fa, sonido real (sin transposición). Elige una nota:</p>
  <div class="card"><div id="pk"></div><div class="row" style="margin-top:10px"><button class="b" id="pl">🔊 Escuchar</button><span class="sub">Sonido sintetizado.</span></div></div>
  <div class="card" id="pinfo"></div>
  <div class="card"><h2>Las siete posiciones</h2><p class="sub">Toca un número para ver qué notas se tocan allí (posición principal).</p>
   <div class="seg" id="p7">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button data-p="${i}">${i}</button>`).join('')}</div><div id="p7i" style="margin-top:10px"></div></div>
  <div class="card"><h2>Tabla de notas y posiciones (Mi2 – Si♭4)</h2>
   <p class="sub">Basada en una tabla de digitaciones para trombón tenor en Si♭ sin trigger. Toca una fila para verla arriba.</p>
   <div class="tblwrap"><table class="tbl"><thead><tr><th>Nota</th><th>Hz</th><th>Posición</th><th>Alt.</th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const info = () => { $('#pinfo').innerHTML = noteInfoHTML({ ...st, d: 'q' }); $$('#tb tr').forEach(r => r.classList.toggle('sel', +r.dataset.m === midiOf(st))); };
  const pk = () => picker($('#pk'), st, {}, info);
  pk(); info();
  $('#pl').onclick = () => { try { playOne(st); } catch (e) { alert(e.message); } };
  let rows = ''; for (let mi = MIN_MIDI; mi <= MAX_MIDI; mi++) { const n = noteFromMidi(mi), pi = posInfo(mi); rows += `<tr class="cl" data-m="${mi}"><td><b>${labelO(n)}</b></td><td>${freqOf(mi).toFixed(1)}</td><td><b>${pi.main}</b></td><td>${pi.alt || '—'}</td></tr>`; }
  $('#tb').innerHTML = rows;
  $$('#tb tr').forEach(r => r.onclick = () => { Object.assign(st, noteFromMidi(+r.dataset.m)); pk(); info(); window.scrollTo(0, 0); });
  $$('#p7 button').forEach(b => b.onclick = () => {
    const p = +b.dataset.p; $$('#p7 button').forEach(x => x.classList.toggle('on', x === b));
    $('#p7i').innerHTML = `<div style="max-width:420px">${slideSVG(p, { mini: true })}</div><div class="sub">Vara a ≈ ${CMS[p - 1]} cm de la posición 1. Notas en la posición ${p}:</div><div class="chips" style="margin-top:6px">${posNotes(p).map(mi => `<span class="chip" data-m="${mi}" style="cursor:pointer">${labelO(noteFromMidi(mi))}</span>`).join('')}</div>`;
    $$('#p7i .chip').forEach(c => c.onclick = () => { Object.assign(st, noteFromMidi(+c.dataset.m)); pk(); info(); window.scrollTo(0, 0); });
  });
};

/* ================= GUÍA ================= */
VIEWS.guia = m => {
  const nn = (n, o, a, d) => ({ n, o, a: a || 'n', d: d || 'w' });
  const lines = [nn(4, 2), nn(6, 2), nn(1, 3), nn(3, 3), nn(5, 3)];
  const spaces = [nn(5, 2), nn(0, 3), nn(2, 3), nn(4, 3)];
  const figs = ['w', 'h', 'q', 'e', 's'].map(k => ({ n: 1, o: 3, a: 'n', d: k }));
  const fnames = { w: 'Redonda', h: 'Blanca', q: 'Negra', e: 'Corchea', s: 'Semicorchea' };
  const accs = [nn(3, 3, '#', 'q'), nn(6, 2, 'b', 'q'), nn(3, 3, 'n', 'q')];
  m.innerHTML = `<h1>📖 Guía de referencia</h1>
  <div class="card"><h2>1. El pentagrama en clave de fa</h2>
   <p>El trombón lee en <b>clave de fa</b> (la que tiene dos puntos alrededor de la 4.ª línea: Fa). Las líneas se cuentan desde abajo.</p>
   <h3>Líneas (de abajo hacia arriba): Sol, Si, Re, Fa, La</h3><div class="staffbox">${scoreSVG(lines, { hit: false })}</div>
   <h3>Espacios (de abajo hacia arriba): La, Do, Mi, Sol</h3><div class="staffbox">${scoreSVG(spaces, { hit: false })}</div>
   <p class="sub">El Do central (Do4) está en la primera línea adicional <i>encima</i> del pentagrama. El número que acompaña a cada nota es su <b>octava</b> (Do3 es una octava más grave que Do4).</p></div>
  <div class="card"><h2>2. Figuras y duraciones</h2><p class="sub">Los “tiempos” suponen que la negra vale 1 tiempo.</p>
   <div class="staffbox">${scoreSVG(figs, { names: false, hit: false })}</div>
   <table class="tbl"><thead><tr><th>Figura</th><th>Tiempos</th></tr></thead><tbody>${['w', 'h', 'q', 'e', 's'].map(k => `<tr><td>${fnames[k]}</td><td><b>${DURS[k].beats}</b></td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h2>3. Silencios</h2><p class="sub">Cada silencio dura lo mismo que su figura.</p>
   <div class="grid" style="grid-template-columns:repeat(3,1fr)">${['w', 'h', 'q', 'e', 's'].map(k => `<div style="text-align:center">${restSVG(k)}<div class="sub"><b>Silencio de ${fnames[k].toLowerCase()}</b><br>${DURS[k].beats} t</div></div>`).join('')}</div></div>
  <div class="card"><h2>4. Alteraciones</h2>
   <div class="staffbox">${scoreSVG(accs, { hit: false })}</div>
   <ul><li><b>♯ Sostenido:</b> sube la nota medio tono (la vara se acerca: posición más corta).</li><li><b>♭ Bemol:</b> baja la nota medio tono (la vara se alarga).</li><li><b>♮ Becuadro:</b> cancela una alteración.</li></ul>
   <p class="sub">En esta app la alteración vale solo para la nota donde está escrita.</p></div>
  <div class="card"><h2>5. Las siete posiciones de la vara</h2>
   <p class="sub">Posición 1: vara cerrada. Cada posición siguiente baja la nota medio tono. Centímetros aproximados desde la posición 1.</p>
   ${[1, 2, 3, 4, 5, 6, 7].map(p => `<div style="border-top:1px solid var(--ln);padding:8px 0"><div class="row"><b style="font-size:18px;color:var(--pu)">Posición ${p}</b><span class="sub">≈ ${CMS[p - 1]} cm</span></div><div style="max-width:520px">${slideSVG(p, { mini: true })}</div><div class="chips">${posNotes(p).map(mi => `<span class="chip">${labelO(noteFromMidi(mi))}</span>`).join('')}</div></div>`).join('')}</div>
  <div class="card gold"><h2>6. Consejos y errores frecuentes</h2>
   <ul><li>Calienta antes de tocar y practica despacio con metrónomo.</li><li>Mueve la vara con rapidez y suavidad; mantén el soplo constante al cambiar de posición.</li><li><b>Error frecuente:</b> leer en clave de sol. En clave de fa la línea de abajo es Sol (no Mi).</li><li><b>Error frecuente:</b> olvidar que una alteración afecta solo a esa nota.</li><li><b>Error frecuente:</b> quedarse corto en las posiciones 6 y 7; extiende bien el brazo.</li><li>Las posiciones son aproximadas: afina siempre con el oído o un afinador. Las notas agudas (como Fa♯4 y Sol4) suelen sonar bajas.</li><li>Pide a tu profesor que revise tu postura y tu embocadura.</li></ul></div>`;
};

/* ================= HISTORIAL ================= */
VIEWS.historial = m => {
  const items = Hist.all();
  m.innerHTML = `<h1>🕘 Historial</h1>
  <div class="msg i">📱 Se guarda <b>solo en este dispositivo y navegador</b>. No hay cuenta ni nube. Si borras los datos del navegador, se pierde. Las fotos y PDF no se guardan.</div>
  <div id="hl"></div>${items.length ? '<button class="b sec sm" id="hall">Borrar todo el historial</button>' : ''}`;
  const hl = $('#hl');
  if (!items.length) hl.innerHTML = '<div class="card">Aún no hay nada guardado. Guarda una partitura desde el Editor, o termina una práctica.</div>';
  items.forEach(it => {
    const d = new Date(it.date).toLocaleString('es');
    const det = it.type === 'partitura' ? `${it.data.seq.length} notas · ${it.data.bpm} BPM` : `${it.data.levelName} · ${it.data.typeName} · ${it.data.ok} de ${it.data.total}`;
    hl.insertAdjacentHTML('beforeend', `<div class="hist" data-id="${it.id}"><div><b>${it.type === 'partitura' ? '🎼' : '🎯'} ${esc(it.name)}</b><div class="sub">${esc(det)} · ${esc(d)}</div></div><div class="row"><button class="b sm op">Abrir</button><button class="b sm sec del">Eliminar</button></div></div>`);
  });
  $$('.hist', hl).forEach(el => {
    const it = items.find(x => x.id === el.dataset.id);
    $('.op', el).onclick = () => {
      if (it.type === 'partitura') { App.seq = it.data.seq.filter(validNote); App.title = it.name; Player.bpm = it.data.bpm; App.sel = -1; saveDraft(); go('editor'); }
      else { App.practiceStart = { level: it.data.level, type: it.data.type }; go('practica'); }
    };
    const d = $('.del', el); let armed = false;
    d.onclick = () => { if (!armed) { armed = true; d.textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { armed = false; d.textContent = 'Eliminar'; }, 3000); return; } Hist.del(it.id); render(); };
  });
  const ha = $('#hall');
  if (ha) { let ar = false; ha.onclick = () => { if (!ar) { ar = true; ha.textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { ar = false; ha.textContent = 'Borrar todo el historial'; }, 3000); return; } Hist.clear(); render(); }; }
};

document.addEventListener('DOMContentLoaded', () => { if (!location.hash) location.hash = '#/inicio'; else render(); });
if (document.readyState !== 'loading' && !$('#main').innerHTML) { if (!location.hash) location.hash = '#/inicio'; else render(); }
