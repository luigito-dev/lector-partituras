/* Importar MusicXML (.musicxml, .xml, .mxl) y convertirlo en notas editables.
   No es reconocimiento óptico: el archivo debe venir de un programa como Audiveris o MuseScore. */
'use strict';
async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede abrir archivos .mxl. Exporta el archivo como .musicxml (sin comprimir) o usa Chrome/Edge/Safari actualizados.');
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
async function readZip(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('El archivo .mxl no es un zip válido.');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {}, dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u.subarray(ds, ds + cs);
    files[name] = { meth, raw };
  }
  return { files, async get(name) { const f = files[name]; if (!f) return null; const b = f.meth === 0 ? f.raw : await inflateRaw(f.raw); return new TextDecoder().decode(b); } };
}
const TYPE2D = { whole: 'w', half: 'h', quarter: 'q', eighth: 'e', '16th': 's' };
function beatsToD(b) { const c = [['w', 4], ['h', 2], ['q', 1], ['e', .5], ['s', .25]]; let best = c[0]; c.forEach(x => { if (Math.abs(x[1] - b) < Math.abs(best[1] - b)) best = x; }); return best[0]; }
/* Divide una duración en tiempos en figuras (con puntillo cuando hace falta). */
function splitBeats(b) {
  const T = [[4, 'w', 0], [3, 'h', 1], [2, 'h', 0], [1.5, 'q', 1], [1, 'q', 0], [0.75, 'e', 1], [0.5, 'e', 0], [0.25, 's', 0]], out = [];
  let g = 0; while (b >= 0.25 - 1e-6 && g++ < 500) { const t = T.find(x => x[0] <= b + 1e-6); out.push([t[1], t[2]]); b -= t[0]; }
  return out.length ? out : [['q', 0]];
}
function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('score-partwise,score-timewise')) throw new Error('El archivo no es un MusicXML válido.');
  if (doc.querySelector('score-timewise')) throw new Error('Este MusicXML está en formato “timewise”, que no se admite. Expórtalo de nuevo como “partwise” (el normal).');
  const names = {}; doc.querySelectorAll('part-list score-part').forEach(sp => { names[sp.getAttribute('id')] = (sp.querySelector('part-name') || {}).textContent || sp.getAttribute('id'); });
  const parts = [];
  doc.querySelectorAll('score-partwise > part').forEach(part => {
    const id = part.getAttribute('id'), notes = [], MAXN = 800; let div = 1, chords = 0, odd = 0, dbl = 0, lost = 0, mbeats = 4, multi = 0, multiRests = 0;
    part.querySelectorAll('measure').forEach((me, mi) => {
      let firstInMeasure = mi > 0; multi = 0;
      [...me.children].forEach(el => {
        if (el.tagName === 'attributes') {
          const d = el.querySelector('divisions'); if (d) div = +d.textContent || 1;
          const tb = el.querySelector('time beats'), tt = el.querySelector('time beat-type'); if (tb && tt) { const b = parseFloat(tb.textContent), t = parseFloat(tt.textContent); if (b > 0 && t > 0) mbeats = b * 4 / t; }
          const mr = el.querySelector('multiple-rest'); if (mr) multi = parseInt(mr.textContent) || 0;
          return;
        }
        if (el.tagName !== 'note') return;
        const push = n => { if (firstInMeasure) { n.bar = 1; firstInMeasure = false; } notes.push(n); };
        const ty = (el.querySelector('type') || {}).textContent, dotted = !!el.querySelector('dot');
        const isRest = !!el.querySelector('rest');
        const beats = ((+(el.querySelector('duration') || {}).textContent) || div) / div;
        if (el.querySelector('chord')) { chords++; return; }
        if (el.querySelector('grace')) return;
        if (isRest) {
          const wholeMeasure = el.querySelector('rest').getAttribute('measure') === 'yes';
          if (wholeMeasure) {
            // Compás de silencio (puede ser un silencio de varios compases): se escribe un silencio por compás.
            const nM = Math.max(1, multi || 1); if (nM > 1) multiRests++;
            for (let k = 0; k < nM; k++) { let first = true; splitBeats(mbeats).forEach(x => { const r = { r: 1, d: x[0], ...(x[1] ? { dot: 1 } : {}) }; if (k > 0 && first) r.bar = 1; first = false; push(r); }); }
            return;
          }
          const meas = !ty || beats > 4;
          if (!meas) { push({ r: 1, d: TYPE2D[ty] || beatsToD(beats), ...(dotted ? { dot: 1 } : {}) }); return; }
          splitBeats(beats).forEach(x => push({ r: 1, d: x[0], ...(x[1] ? { dot: 1 } : {}) })); return;
        }
        const pc = el.querySelector('pitch'); if (!pc) return;
        const step = pc.querySelector('step').textContent.trim(), oct = +pc.querySelector('octave').textContent, alt = +((pc.querySelector('alter') || {}).textContent || 0);
        const idx = 'CDEFGAB'.indexOf(step); let n;
        if (alt === 1 || alt === -1 || alt === 0) n = { n: idx, o: oct, a: alt === 1 ? '#' : alt === -1 ? 'b' : 'n' };
        else { dbl++; n = noteFromMidi(12 * (oct + 1) + BASE[idx] + alt); }
        if (ty && TYPE2D[ty]) { n.d = TYPE2D[ty]; if (dotted) n.dot = 1; }
        else { odd++; const x = splitBeats(beats)[0]; n.d = x[0]; if (x[1]) n.dot = 1; }
        if (el.querySelector('time-modification')) odd++;
        if (el.querySelector('tie[type="start"]')) n.tie = 1;
        if (n.o >= 0 && n.o <= 7) push(n); else lost++;
      });
    });
    const w = [];
    if (multiRests) w.push(`${multiRests} silencio(s) de varios compases se escribieron como un silencio por compás.`);
    if (chords) w.push(`${chords} nota(s) de acordes se omitieron (se conserva la primera de cada acorde).`);
    if (odd) w.push(`${odd} figura(s) raras (tresillos u otras) se aproximaron.`);
    if (dbl) w.push(`${dbl} doble(s) alteración(es) se convirtieron a la nota equivalente.`);
    if (lost) w.push(`${lost} nota(s) con octava fuera de rango se omitieron.`);
    const out = notes.filter(n => !n.r).filter(n => { const m = midiOf(n); return m < MIN_MIDI || m > MAX_MIDI; }).length;
    if (out) w.push(`${out} nota(s) quedan fuera del rango práctico (Mi2–Si♭4): no tendrán posición.`);
    if (notes.length > MAXN) { w.push(`Se importaron solo los primeros ${MAXN} elementos.`); notes.length = MAXN; }
    parts.push({ id, name: names[id] || id, notes, warns: w });
  });
  return parts.filter(p => p.notes.length || true);
}
async function readMusicFile(file) {
  const ext = extOf(file.name);
  if (!['xml', 'musicxml', 'mxl'].includes(ext)) throw new Error(`“${file.name}” no es un archivo MusicXML (.musicxml, .xml o .mxl).`);
  if (file.size > 20 * 1024 * 1024) throw new Error('El archivo pesa más de 20 MB.');
  let text;
  if (ext === 'mxl') {
    const z = await readZip(await file.arrayBuffer());
    const c = await z.get('META-INF/container.xml'); let root = null;
    if (c) { const m = /full-path="([^"]+)"/.exec(c); if (m) root = m[1]; }
    if (!root) root = Object.keys(z.files).find(k => /\.(xml|musicxml)$/i.test(k) && !/^META-INF/i.test(k));
    if (!root) throw new Error('No se encontró la partitura dentro del .mxl.');
    text = await z.get(root);
  } else text = await file.text();
  return parseXml(text);
}
/* Interfaz: se monta dentro de un contenedor. onUse(notes, mode, name) recibe el resultado. */
function mxlWidget(root, onUse) {
  root.innerHTML = `<label class="b sec" id="mxl">🎼 Importar MusicXML<input type="file" accept=".musicxml,.xml,.mxl" hidden></label><div id="mxs" role="status" aria-live="polite"></div><div id="mxp"></div>`;
  const say = (t, c) => { $('#mxs', root).innerHTML = t ? `<div class="msg ${c || 'i'}">${t}</div>` : ''; };
  function present(parts, fname, auto) {
    $('#mxp', root).innerHTML = '';
    const usable = parts.filter(p => p.notes.length);
    if (!usable.length) return say('El archivo no tiene notas con altura (solo silencios o percusión).', 'e');
    say(auto ? `✔ Lectura automática terminada. <b>Revisa el resultado:</b> el reconocimiento puede equivocarse.` : `✔ Archivo leído: ${usable.length} parte(s) con notas.`, 'o');
    const show = k => {
      const p = usable[k], real = p.notes.filter(n => !n.r).length;
      $('#mxp', root).innerHTML = `${usable.length > 1 ? `<label class="f" style="margin:8px 0">Parte (instrumento)<select id="mpart">${usable.map((x, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(x.name)} (${x.notes.length} elementos)</option>`).join('')}</select></label>` : `<p class="sub">Parte: <b>${esc(p.name)}</b> · ${real} notas y ${p.notes.length - real} silencios</p>`}
      <div class="staffbox" style="max-height:340px">${scoreSVG(p.notes.slice(0, 40), { names: true, pos: true, hit: false, W: 420 })}</div>
      ${p.notes.length > 40 ? `<p class="sub">Vista previa de los primeros 40 elementos.</p>` : ''}
      ${p.warns.map(w => `<div class="msg e">⚠️ ${esc(w)}</div>`).join('')}
      <p class="sub">Revisa que sea la parte de trombón (clave de fa). La app no cambia la octava ni transpone.</p>
      <div class="row"><button class="b" id="muse">Reemplazar mi secuencia</button><button class="b sec" id="muapp">Agregar al final</button></div>`;
      const sel = $('#mpart', root); if (sel) sel.onchange = () => show(+sel.value);
      const nm = (fname || '').replace(/\.[^.]+$/, '');
      $('#muse', root).onclick = () => onUse(p.notes, 'replace', nm);
      $('#muapp', root).onclick = () => onUse(p.notes, 'append', nm);
    };
    show(Math.max(0, usable.findIndex(x => /tromb|tbn|bone/i.test(x.name))));
  }
  $('input', root).onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('#mxp', root).innerHTML = ''; say('Leyendo archivo…');
    try { present(await readMusicFile(f), f.name, false); } catch (err) { say('⚠️ ' + esc(err.message), 'e'); }
  };
  return { present, say };
}
