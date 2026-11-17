/* Módulo 4 (editor manual), 5 (posiciones por nota) y 6 (audio) dentro del editor. */
'use strict';
VIEWS.editor = m => {
  const cur = App.cur; let showNames = true, showPos = true;
  m.innerHTML = `<h1>✏️ Editor de notas</h1>
  <p class="sub">Escribe las notas de tu partitura una por una. Toca el pentagrama para elegir la altura, o usa los botones.</p>
  ${App.pages.length ? `<details class="card" open><summary>📄 Mi partitura cargada (para copiar las notas)</summary><div class="row" style="margin:6px 0"><select id="rp" aria-label="Página">${App.pages.map((p, i) => `<option value="${i}">Pág. ${i + 1}</option>`).join('')}</select></div><div class="pv"><div class="pvin" style="width:100%"><img id="rim" alt="Partitura cargada" src="${App.pages[Math.min(App.pageSel, App.pages.length - 1)].url}"></div></div><p class="sub">Esta imagen es solo de referencia: la app no la ha leído.</p></details>` : ''}
  <div class="card"><div class="row"><label class="f grow">Nombre de la partitura<input type="text" id="ttl" maxlength="60" placeholder="Ej.: Lección 1" value="${esc(App.title)}"></label></div>
   <div class="row" style="margin:8px 0"><label class="row" style="gap:6px"><input type="checkbox" id="tn" checked> Mostrar nombres</label><label class="row" style="gap:6px"><input type="checkbox" id="tp" checked> Mostrar posiciones (P1–P7)</label></div>
   <div class="staffbox" id="stf"></div>
   <p class="sub" id="cnt"></p></div>
  <div class="card player" aria-label="Reproductor">
   <div class="now" id="now" aria-live="polite">Listo para reproducir.</div>
   <div class="row"><button class="b" id="pp">▶ Play</button><button class="b sec" id="pa">⏸ Pausa</button><button class="b sec" id="ps">⏹ Stop</button>
    <label class="row" style="gap:6px"><input type="checkbox" id="mt"> Metrónomo</label></div>
   <div class="row" style="margin-top:6px"><label class="f grow"><span>Tempo: <b id="bv"></b> BPM</span><input type="range" id="bp" min="30" max="200" step="1"></label><label class="f grow">Volumen<input type="range" id="vl" min="0" max="100" value="${Math.round(Eng.vol * 100)}"></label></div>
   <div class="sub">🔈 Sonido sintetizado por el navegador (no es una grabación de trombón).</div>
  </div>
  <div class="card"><h2>Nota a agregar</h2><div id="pk"></div>
   <div class="row" style="margin-top:12px">
    <button class="b" id="add">＋ Añadir nota</button><button class="b sec" id="chg">✎ Cambiar la seleccionada</button><button class="b sec" id="del">🗑 Eliminar</button>
    <button class="b sec sm" id="mvl">◀</button><button class="b sec sm" id="mvr">▶</button><button class="b sec sm" id="clr">Vaciar todo</button>
   </div><div id="emsg"></div></div>
  <div class="card" id="info"></div>
  <div class="card"><h2>Secuencia</h2><div class="chips" id="seq"></div></div>
  <div class="card"><h2>Guardar y exportar</h2><div class="row">
   <button class="b" id="sv">💾 Guardar en historial</button><button class="b sec" id="xp">🖼 Descargar imagen (PNG)</button><button class="b sec" id="xd">📄 Descargar PDF</button><button class="b sec" id="xr">🖨 Imprimir</button></div>
   <div id="xmsg"></div></div>`;

  const seq = () => App.seq;
  const note = () => ({ n: cur.n, o: cur.o, a: cur.a, d: cur.d });
  const msg = (t, c) => { $('#emsg').innerHTML = t ? `<div class="msg ${c || 'i'}">${t}</div>` : ''; };
  function drawStaff(curIdx) {
    $('#stf').innerHTML = scoreSVG(seq(), { W: $('#stf').clientWidth < 560 ? 420 : 760, names: showNames, pos: showPos, cur: curIdx, sel: App.sel, id: 'stsvg' });
    const tot = seq().reduce((s, n) => s + DURS[n.d].beats, 0);
    $('#cnt').textContent = seq().length ? `${seq().length} nota(s) · ${tot} tiempos` : '';
  }
  function drawSeq() {
    $('#seq').innerHTML = seq().length ? seq().map((n, i) => { const pi = posInfo(midiOf(n)); return `<span class="chip ${i === App.sel ? 'on' : ''}" data-i="${i}" style="cursor:pointer">${i + 1}. ${esc(labelO(n))} · ${DURS[n.d].name.toLowerCase()} · ${pi.inRange ? 'P' + pi.main : 'fuera de rango'}</span>`; }).join('') : '<span class="sub">La secuencia está vacía.</span>';
    $$('#seq .chip').forEach(c => c.onclick = () => select(+c.dataset.i));
  }
  function drawInfo() {
    $('#info').innerHTML = `<h2>Nota elegida: posición de la vara</h2>` + noteInfoHTML(note());
  }
  function drawPicker() { picker($('#pk'), cur, { dur: true }, () => { drawInfo(); }); }
  function refresh() { saveDraft(); Player.load(seq()); drawStaff(-1); drawSeq(); drawInfo(); bindStaff(); }
  function select(i) {
    App.sel = i; if (i >= 0) Object.assign(cur, seq()[i]);
    drawPicker(); drawStaff(-1); drawSeq(); drawInfo(); bindStaff();
  }
  function bindStaff() {
    const sv = $('#stsvg'); if (!sv) return;
    sv.onclick = e => {
      const g = e.target.closest('.nt');
      if (g) { select(+g.dataset.i); try { playOne(seq()[+g.dataset.i]); } catch (x) { } return; }
      const r = sv.getBoundingClientRect(), vb = sv.viewBox.baseVal, k = vb.width / r.width, yv = (e.clientY - r.top) * k;
      const s = Math.max(0, Math.min(sysCount(seq()) - 1, Math.floor(yv / SYS_H))), yb = s * SYS_H + BOT;
      const d = Math.max(7, Math.min(41, 18 + Math.round((yb - yv) / 5)));
      cur.o = Math.floor(d / 7); cur.n = d % 7; App.sel = -1;
      drawPicker(); drawStaff(-1); drawInfo(); bindStaff(); drawSeq();
      try { playOne(note()); } catch (x) { }
    };
  }
  $('#ttl').oninput = e => { App.title = e.target.value; saveDraft(); };
  $('#tn').onchange = e => { showNames = e.target.checked; drawStaff(-1); bindStaff(); };
  $('#tp').onchange = e => { showPos = e.target.checked; drawStaff(-1); bindStaff(); };
  if ($('#rp')) $('#rp').onchange = e => { $('#rim').src = App.pages[+e.target.value].url; };
  $('#add').onclick = () => {
    const n = note(), at = App.sel >= 0 ? App.sel + 1 : seq().length;
    seq().splice(at, 0, n); App.sel = at; const pi = posInfo(midiOf(n));
    refresh(); drawPicker(); drawSeq();
    msg(pi.inRange ? `Se añadió ${esc(labelO(n))} (posición ${pi.main}).` : `Se añadió ${esc(labelO(n))}, pero está fuera del rango práctico (Mi2–Si♭4): no tiene posición asignada.`, pi.inRange ? 'o' : 'e');
    try { playOne(n); } catch (x) { }
  };
  $('#chg').onclick = () => { if (App.sel < 0) return msg('Primero toca una nota en el pentagrama o en la secuencia.', 'e'); seq()[App.sel] = note(); refresh(); msg('Nota cambiada.', 'o'); };
  $('#del').onclick = () => { if (App.sel < 0) return msg('Primero toca la nota que quieres eliminar.', 'e'); seq().splice(App.sel, 1); App.sel = Math.min(App.sel, seq().length - 1); refresh(); drawPicker(); msg('Nota eliminada.', 'o'); };
  const mv = d => { const i = App.sel, j = i + d; if (i < 0 || j < 0 || j >= seq().length) return msg('Selecciona una nota para moverla.', 'e'); const t = seq()[i]; seq()[i] = seq()[j]; seq()[j] = t; App.sel = j; refresh(); };
  $('#mvl').onclick = () => mv(-1); $('#mvr').onclick = () => mv(1);
  let clrArm = false;
  $('#clr').onclick = () => { if (!seq().length) return; if (!clrArm) { clrArm = true; $('#clr').textContent = '¿Seguro? Toca otra vez'; setTimeout(() => { clrArm = false; $('#clr').textContent = 'Vaciar todo'; }, 3000); return; } App.seq = []; App.sel = -1; refresh(); drawPicker(); $('#clr').textContent = 'Vaciar todo'; clrArm = false; msg('Secuencia vaciada.', 'o'); };

  /* reproductor */
  const ps = () => { const s = Player.state; $('#pp').disabled = s === 'play'; $('#pa').disabled = s !== 'play'; $('#ps').disabled = s === 'stop'; $('#pp').textContent = s === 'pause' ? '▶ Continuar' : '▶ Play'; };
  Player.onState = ps;
  Player.onMark = i => {
    $$('#stf .nt').forEach(g => g.classList.toggle('on', +g.dataset.i === i));
    if (i >= 0) { const n = seq()[i], pi = posInfo(midiOf(n)); $('#now').textContent = `♪ Suena: ${labelO(n)} · ${DURS[n.d].name.toLowerCase()} · ${pi.inRange ? 'posición ' + pi.main : 'fuera de rango'}`; const g = $(`#stf .nt[data-i="${i}"]`); if (g) { const bx = $('#stf'), r = g.getBoundingClientRect(), br = bx.getBoundingClientRect(); if (r.right > br.right || r.left < br.left) bx.scrollLeft += r.left - br.left - 40; } }
    else $('#now').textContent = Player.state === 'pause' ? 'En pausa.' : 'Listo para reproducir.';
  };
  Player.onEnd = () => { $('#now').textContent = 'Terminó la secuencia.'; };
  Player.load(seq());
  $('#bp').value = Player.bpm; $('#bv').textContent = Player.bpm;
  $('#bp').oninput = e => { Player.setBpm(+e.target.value); $('#bv').textContent = Player.bpm; saveDraft(); };
  $('#vl').oninput = e => { try { Eng.ensure(); } catch (x) { } Eng.setVol(e.target.value / 100); };
  $('#mt').onchange = e => Player.setMetro(e.target.checked);
  $('#pp').onclick = () => { if (!seq().length) { $('#now').textContent = 'Agrega al menos una nota para reproducir.'; return; } try { Player.play(); } catch (x) { $('#now').textContent = x.message; } };
  $('#pa').onclick = () => { Player.pause(); $('#now').textContent = 'En pausa.'; };
  $('#ps').onclick = () => { Player.stop(); $('#now').textContent = 'Detenido.'; };

  /* guardar y exportar */
  const xm = (t, c) => { $('#xmsg').innerHTML = `<div class="msg ${c || 'i'}">${t}</div>`; };
  $('#sv').onclick = () => {
    if (!seq().length) return xm('No hay notas que guardar.', 'e');
    const ok = Hist.add({ type: 'partitura', name: App.title.trim() || 'Partitura sin título', data: { seq: JSON.parse(JSON.stringify(seq())), bpm: Player.bpm } });
    xm(ok ? '✔ Guardado en el historial de este dispositivo.' : 'No se pudo guardar (el navegador no permite almacenamiento local).', ok ? 'o' : 'e');
  };
  const needNotes = () => { if (!seq().length) { xm('No hay notas que exportar.', 'e'); return false; } return true; };
  const eo = () => ({ names: showNames, pos: showPos, title: App.title.trim() || 'Partitura' });
  $('#xp').onclick = async () => { if (!needNotes()) return; try { xm('Creando imagen…'); await exportPNG(seq(), eo()); xm('✔ Imagen creada. Revisa tus descargas.', 'o'); } catch (e) { xm('No se pudo crear la imagen: ' + esc(e.message), 'e'); } };
  $('#xd').onclick = async () => { if (!needNotes()) return; try { xm('Creando PDF…'); await exportPDF(seq(), eo()); xm('✔ PDF creado. Revisa tus descargas.', 'o'); } catch (e) { xm('No se pudo crear el PDF: ' + esc(e.message), 'e'); } };
  $('#xr').onclick = () => { if (!needNotes()) return; printScore(seq(), eo()); };

  drawPicker(); refresh(); ps();
};
