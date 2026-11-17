/* Módulos 2 y 3: cámara/carga de partituras (imagen o PDF) y aviso sobre el reconocimiento (OMR). */
'use strict';
const OK_EXT = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 30 * 1024 * 1024, MAX_PAGES = 30, MAX_SIDE = 2400;
let pdfReady = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfReady) pdfReady = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { pdfReady = null; rej(new Error('No se pudo cargar el lector de PDF.')); };
    document.head.appendChild(s);
  });
  return pdfReady;
}
function extOf(n) { const m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
function checkFile(f) {
  const ext = extOf(f.name), mimeOk = OK_MIME.includes(f.type), extOk = OK_EXT.includes(ext);
  if (!(extOk && (mimeOk || !f.type))) return `“${f.name}” no es compatible. Usa imágenes JPG, JPEG, PNG o WebP, o un archivo PDF.`;
  if (f.size === 0) return `“${f.name}” está vacío.`;
  if (f.size > MAX_BYTES) return `“${f.name}” pesa más de 30 MB. Elige un archivo más pequeño.`;
  return '';
}
function imgToCanvas(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, MAX_SIDE / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url); res(c);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`No se pudo abrir “${file.name}”. Puede estar dañado.`)); };
    im.src = url;
  });
}
async function pdfToCanvases(file, say) {
  const lib = await loadPdfJs();
  const data = await file.arrayBuffer();
  let doc;
  try { doc = await lib.getDocument({ data }).promise; } catch (e) { throw new Error(`No se pudo abrir “${file.name}”. El PDF puede estar dañado o protegido con contraseña.`); }
  const out = [], n = Math.min(doc.numPages, MAX_PAGES);
  for (let i = 1; i <= n; i++) {
    say(`Leyendo “${file.name}”: página ${i} de ${n}…`);
    const pg = await doc.getPage(i), v0 = pg.getViewport({ scale: 1 }), sc = Math.min(2.5, 1600 / v0.width), vp = pg.getViewport({ scale: sc });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: g, viewport: vp }).promise; out.push(c);
  }
  if (doc.numPages > MAX_PAGES) out.warn = `El PDF tiene ${doc.numPages} páginas; se cargaron las primeras ${MAX_PAGES}.`;
  return out;
}
function rotCanvas(c, dir) {
  const r = document.createElement('canvas'); r.width = c.height; r.height = c.width;
  const g = r.getContext('2d'); g.translate(r.width / 2, r.height / 2); g.rotate(dir * Math.PI / 2); g.drawImage(c, -c.width / 2, -c.height / 2); return r;
}
function cropCanvas(c, x, y, w, h) {
  const r = document.createElement('canvas'); r.width = Math.max(1, Math.round(w)); r.height = Math.max(1, Math.round(h));
  r.getContext('2d').drawImage(c, x, y, w, h, 0, 0, r.width, r.height); return r;
}

VIEWS.cargar = m => {
  let zoom = 1, crop = false, rect = null, busy = false;
  m.innerHTML = `<h1>📷 Cargar una partitura</h1>
  <p class="sub">Toma una foto o sube una imagen o PDF. Podrás verla, girarla, recortarla y ampliarla.</p>
  <div class="card"><div class="row">
   <label class="b" id="cam">📷 Tomar foto<input type="file" accept="image/*" capture="environment" hidden></label>
   <label class="b sec" id="fil">🖼️ Elegir imagen o PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" multiple hidden></label>
  </div><p class="sub" style="margin-top:8px">En teléfono, “Tomar foto” abre la cámara trasera. En computadora abre el selector de archivos. Formatos: JPG, JPEG, PNG, WebP y PDF (hasta 30 MB).</p>
  <div id="st" role="status" aria-live="polite"></div></div>
  <div id="work"></div>
  <div class="card"><h2>¿Ya tienes un archivo MusicXML?</h2>
   <p class="sub">Si conviertes tu foto o PDF con un programa de reconocimiento (por ejemplo Audiveris o MuseScore), puedes importar aquí el resultado (.musicxml, .xml o .mxl) y la app lo convierte en notas editables, con posiciones y sonido.</p><div id="mxw"></div></div>
  <div class="card" id="omr"></div>`;
  const say = (t, cls) => { $('#st').innerHTML = t ? `<div class="msg ${cls || 'i'}">${t}</div>` : ''; };
  const work = $('#work');

  function draw() {
    const P = App.pages;
    if (!P.length) { work.innerHTML = ''; return; }
    if (App.pageSel >= P.length) App.pageSel = P.length - 1;
    const cur = P[App.pageSel];
    work.innerHTML = `<div class="card">
     <div class="thumbs">${P.map((p, i) => `<div class="thumb ${i === App.pageSel ? 'on' : ''}" data-i="${i}"><img alt="Página ${i + 1}" src="${p.url}"><div>Pág. ${i + 1}</div></div>`).join('')}</div>
     <div class="row" style="margin:8px 0">
      <button class="b sm sec" id="rl" aria-label="Girar a la izquierda">⟲ Girar</button><button class="b sm sec" id="rr" aria-label="Girar a la derecha">⟳ Girar</button>
      <button class="b sm sec" id="cr">${crop ? '✖ Cancelar recorte' : '✂️ Recortar'}</button>
      <button class="b sm sec" id="zi">🔍＋ Ampliar</button><button class="b sm sec" id="zo">🔍－ Reducir</button>
      <button class="b sm sec" id="mv1" ${App.pageSel === 0 ? 'disabled' : ''}>◀ Mover antes</button><button class="b sm sec" id="mv2" ${App.pageSel === P.length - 1 ? 'disabled' : ''}>Mover después ▶</button>
      <button class="b sm sec" id="rm">🗑 Eliminar página</button>
     </div>
     ${crop ? '<div class="msg i">Arrastra sobre la imagen para marcar la parte que quieres conservar. <button class="b sm go" id="ap" disabled>Aplicar recorte</button></div>' : ''}
     <div class="sub">Página ${App.pageSel + 1} de ${P.length} · ${esc(cur.name)} · ${cur.canvas.width}×${cur.canvas.height} px · ampliación ${Math.round(zoom * 100)} %</div>
     <div class="pv" id="pv"><div class="pvin" style="width:${zoom * 100}%"><img id="pim" alt="Vista previa de la partitura" src="${cur.url}">${crop ? '<div class="crop" id="cro"></div>' : ''}</div></div>
     <div class="msg i" style="margin-top:8px">✔ Imagen cargada. <b>Todavía no ha sido leída:</b> la app no reconoce las notas por sí sola.</div>
     <div class="row"><button class="b go" id="ted">✏️ Escribir las notas en el editor</button></div></div>`;
    $$('.thumb', work).forEach(t => t.onclick = () => { App.pageSel = +t.dataset.i; crop = false; rect = null; draw(); });
    $('#rl').onclick = () => edit(c => rotCanvas(c, -1)); $('#rr').onclick = () => edit(c => rotCanvas(c, 1));
    $('#cr').onclick = () => { crop = !crop; rect = null; draw(); };
    $('#zi').onclick = () => { zoom = Math.min(4, zoom + 0.5); draw(); }; $('#zo').onclick = () => { zoom = Math.max(0.5, zoom - 0.5); draw(); };
    $('#mv1').onclick = () => swap(-1); $('#mv2').onclick = () => swap(1);
    $('#rm').onclick = () => { const r = P.splice(App.pageSel, 1)[0]; say(`Se eliminó “${esc(r.name)}”.`, 'o'); crop = false; draw(); };
    $('#ted').onclick = () => go('editor');
    if (crop) bindCrop();
  }
  function setUrl(p) { p.url = p.canvas.toDataURL('image/jpeg', 0.9); }
  function edit(fn) { const p = App.pages[App.pageSel]; p.canvas = fn(p.canvas); setUrl(p); crop = false; rect = null; draw(); }
  function swap(d) { const P = App.pages, i = App.pageSel, j = i + d; if (j < 0 || j >= P.length) return;[P[i], P[j]] = [P[j], P[i]]; App.pageSel = j; draw(); }
  function bindCrop() {
    const ov = $('#cro'), im = $('#pim'); let a = null;
    const pt = e => { const b = ov.getBoundingClientRect(); return [Math.max(0, Math.min(b.width, e.clientX - b.left)), Math.max(0, Math.min(b.height, e.clientY - b.top))]; };
    const show = () => { ov.innerHTML = rect ? `<i style="left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px"></i>` : ''; $('#ap').disabled = !(rect && rect.w > 8 && rect.h > 8); };
    ov.onpointerdown = e => { ov.setPointerCapture(e.pointerId); a = pt(e); rect = { x: a[0], y: a[1], w: 0, h: 0 }; show(); };
    ov.onpointermove = e => { if (!a) return; const b = pt(e); rect = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }; show(); };
    ov.onpointerup = () => { a = null; };
    $('#ap').onclick = () => {
      if (!rect) return; const k = App.pages[App.pageSel].canvas.width / im.clientWidth;
      edit(c => cropCanvas(c, rect.x * k, rect.y * k, rect.w * k, rect.h * k)); say('Recorte aplicado.', 'o');
    };
    show();
  }
  async function addFiles(files) {
    if (busy) return; busy = true;
    const errs = []; let added = 0;
    for (const f of files) {
      const e = checkFile(f); if (e) { errs.push(e); continue; }
      if (App.pages.length >= MAX_PAGES) { errs.push(`Máximo ${MAX_PAGES} páginas.`); break; }
      try {
        say(`Cargando “${esc(f.name)}”…`);
        const cs = extOf(f.name) === 'pdf' ? await pdfToCanvases(f, say) : [await imgToCanvas(f)];
        if (cs.warn) errs.push(cs.warn);
        cs.forEach((c, i) => { const p = { id: Date.now() + Math.random(), name: cs.length > 1 ? `${f.name} (pág. ${i + 1})` : f.name, canvas: c }; setUrl(p); App.pages.push(p); added++; });
      } catch (err) { errs.push(err.message); }
    }
    busy = false;
    if (added) App.pageSel = App.pages.length - 1;
    say((added ? `<div>✔ Se agregaron ${added} página(s).</div>` : '') + errs.map(x => `<div style="color:#6b140f">⚠️ ${esc(x)}</div>`).join(''), errs.length && !added ? 'e' : added ? 'o' : 'i');
    draw();
  }
  $$('input[type=file]', m).forEach(inp => inp.onchange = () => { const fs = [...inp.files]; inp.value = ''; if (fs.length) addFiles(fs); });
  const W = mxlWidget($('#mxw'), (notes, mode, name) => { App.seq = mode === 'replace' ? notes.map(n => ({ ...n })) : App.seq.concat(notes.map(n => ({ ...n }))); if (mode === 'replace' && name) App.title = name; App.sel = -1; saveDraft(); go('editor'); });
  omrCard($('#omr'), () => App.pages, W, say);
  draw();
};

/* ---- Lectura automática (OMR) mediante un servidor propio ---- */
function omrCard(root, getPages, W, say) {
  let url = Store.get('lpt_omr', ''), cancel = false, running = false;
  const clean = u => u.trim().replace(/\/+$/, '');
  function draw() {
    root.innerHTML = url ? `<h2>🔍 Lectura automática</h2>
      <p class="sub">Servidor: <b>${esc(url)}</b></p>
      <p class="sub">Las páginas se envían a ese servidor para reconocer las notas y se borran allí al terminar. El reconocimiento puede equivocarse: siempre revisa el resultado.</p>
      <div class="row"><button class="b go" id="oread">🔍 Leer las páginas cargadas automáticamente</button><button class="b sec sm" id="otest">Probar conexión</button><button class="b sec sm" id="ochg">Cambiar servidor</button></div>
      <div id="oprog" role="status" aria-live="polite"></div>` :
    `<h2>🔍 Lectura automática: sin servidor</h2>
      <p>Leer partituras automáticamente (OMR) necesita un servidor con un motor de reconocimiento; no puede hacerse solo en esta página. <b>Mientras no conectes uno, la app no lee ni inventa notas</b>: puedes escribirlas en el Editor o importar un MusicXML.</p>
      <label class="f">Dirección de tu servidor de lectura (opcional)<input type="text" id="ourl" placeholder="https://tu-servidor.hf.space" inputmode="url" autocapitalize="off" spellcheck="false"></label>
      <div class="row" style="margin-top:8px"><button class="b sec" id="osave">Guardar y probar</button></div><div id="oprog" role="status"></div>`;
    const pg = t => { $('#oprog', root).innerHTML = t ? `<div class="msg i" style="margin-top:8px">${t}</div>` : ''; };
    if (!url) {
      $('#osave', root).onclick = async () => {
        const u = clean($('#ourl', root).value); if (!/^https?:\/\//i.test(u)) return pg('⚠️ Escribe una dirección que empiece con https://');
        pg('Probando conexión…'); try { await ping(u); url = u; Store.set('lpt_omr', u); draw(); $('#oprog', root).innerHTML = '<div class="msg o" style="margin-top:8px">✔ Conectado.</div>'; } catch (e) { pg('⚠️ ' + esc(e.message)); }
      }; return;
    }
    $('#ochg', root).onclick = () => { url = ''; Store.set('lpt_omr', ''); draw(); };
    $('#otest', root).onclick = async () => { pg('Probando conexión…'); try { const r = await ping(url); $('#oprog', root).innerHTML = `<div class="msg o" style="margin-top:8px">✔ El servidor responde (${r.en_cola || 0} en cola).</div>`; } catch (e) { pg('⚠️ ' + esc(e.message)); } };
    $('#oread', root).onclick = () => (running ? (cancel = true) : read(pg));
  }
  async function ping(u) {
    let last;
    for (let i = 0; i < 6; i++) {   // un servidor gratuito "dormido" tarda en despertar
      try { const r = await fetch(u + '/', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.ok) return j; } last = new Error('La dirección responde, pero no es un servidor de lectura.'); }
      catch (e) { last = new Error('No se pudo conectar. Si el servidor estaba dormido, espera un minuto y vuelve a probar.'); }
      await new Promise(r => setTimeout(r, 5000));
    }
    throw last;
  }
  const toBlob = c => new Promise(r => { const k = Math.min(1, 2200 / Math.max(c.width, c.height)); const t = document.createElement('canvas'); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); t.toBlob(r, 'image/jpeg', 0.9); });
  async function read(pg) {
    const pages = getPages(); if (!pages.length) return pg('⚠️ Primero toma una foto o sube una imagen o PDF.');
    running = true; cancel = false; $('#oread', root).textContent = '✖ Cancelar lectura';
    try {
      pg('Conectando con el servidor…'); await ping(url);
      const fd = new FormData(); for (let i = 0; i < pages.length; i++) fd.append('files', await toBlob(pages[i].canvas), `p${i + 1}.jpg`);
      pg('Enviando páginas…');
      const r = await fetch(url + '/api/jobs', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || 'El servidor rechazó el envío.');
      for (;;) {
        if (cancel) { pg('Lectura cancelada.'); break; }
        await new Promise(r => setTimeout(r, 3000));
        const sr = await fetch(url + '/api/jobs/' + j.id, { cache: 'no-store' }); const s = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(s.detail || 'Se perdió el trabajo en el servidor.');
        if (s.status === 'error') throw new Error(s.message || 'No se pudo leer la partitura.');
        if (s.status === 'done') { pg(''); const parts = parseXml(s.musicxml); (s.warnings || []).forEach(w => parts.forEach(p => p.warns.unshift(w))); W.present(parts, 'partitura leída', true); break; }
        pg(s.status === 'queued' ? 'En cola… esperando turno.' : `Leyendo página ${s.page} de ${s.total}… (tarda cerca de 30–60 s por página)`);
      }
    } catch (e) { pg('⚠️ ' + esc(e.message)); }
    running = false; const b = $('#oread', root); if (b) b.textContent = '🔍 Leer las páginas cargadas automáticamente';
  }
  draw();
}
