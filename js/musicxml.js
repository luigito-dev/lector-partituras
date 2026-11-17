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
function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('score-partwise,score-timewise')) throw new Error('El archivo no es un MusicXML válido.');
  if (doc.querySelector('score-timewise')) throw new Error('Este MusicXML está en formato “timewise”, que no se admite. Expórtalo de nuevo como “partwise” (el normal).');
  const names = {}; doc.querySelectorAll('part-list score-part').forEach(sp => { names[sp.getAttribute('id')] = (sp.querySelector('part-name') || {}).textContent || sp.getAttribute('id'); });
  const parts = [];
  doc.querySelectorAll('score-partwise > part').forEach(part => {
    const id = part.getAttribute('id'), notes = [], W = new Set(); let div = 1, rests = 0, chords = 0, dots = 0, ties = 0, odd = 0, dbl = 0;
    part.querySelectorAll('measure').forEach(me => {
      [...me.children].forEach(el => {
        if (el.tagName === 'attributes') { const d = el.querySelector('divisions'); if (d) div = +d.textContent || 1; return; }
        if (el.tagName !== 'note') return;
        if (el.querySelector('rest')) { rests++; return; }
        if (el.querySelector('chord')) { chords++; return; }
        if (el.querySelector('grace')) return;
        const pc = el.querySelector('pitch'); if (!pc) return;
        const step = pc.querySelector('step').textContent.trim(), oct = +pc.querySelector('octave').textContent, alt = +((pc.querySelector('alter') || {}).textContent || 0);
        const idx = 'CDEFGAB'.indexOf(step); let n;
        if (alt === 1 || alt === -1 || alt === 0) n = { n: idx, o: oct, a: alt === 1 ? '#' : alt === -1 ? 'b' : 'n' };
        else { dbl++; n = noteFromMidi(12 * (oct + 1) + BASE[idx] + alt); }
        const ty = (el.querySelector('type') || {}).textContent;
        if (el.querySelector('dot')) dots++;
        if (el.querySelector('tie[type="stop"]')) ties++;
        let d;
        if (ty && TYPE2D[ty]) d = TYPE2D[ty]; else { odd++; d = beatsToD(((+(el.querySelector('duration') || {}).textContent) || div) / div); }
        if (el.querySelector('time-modification')) odd++;
        n.d = d; if (n.o >= 0 && n.o <= 7) notes.push(n);
      });
    });
    const w = [];
    if (rests) w.push(`${rests} silencio(s) no se importan (la app aún no tiene silencios en el editor).`);
    if (chords) w.push(`${chords} nota(s) de acordes se omitieron (se conserva la primera de cada acorde).`);
    if (dots) w.push(`${dots} nota(s) con puntillo se importaron sin el puntillo (duración aproximada).`);
    if (ties) w.push(`${ties} ligadura(s): la nota ligada aparece repetida.`);
    if (odd) w.push(`${odd} figura(s) raras (tresillos u otras) se aproximaron.`);
    if (dbl) w.push(`${dbl} doble(s) alteración(es) se convirtieron a la nota equivalente.`);
    const out = notes.filter(n => { const m = midiOf(n); return m < MIN_MIDI || m > MAX_MIDI; }).length;
    if (out) w.push(`${out} nota(s) quedan fuera del rango práctico (Mi2–Si♭4): no tendrán posición.`);
    if (notes.length > 200) { w.push('Se importaron solo las primeras 200 notas.'); notes.length = 200; }
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
  $('input', root).onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('#mxp', root).innerHTML = ''; say('Leyendo archivo…');
    try {
      const parts = await readMusicFile(f); const usable = parts.filter(p => p.notes.length);
      if (!usable.length) return say('El archivo no tiene notas con altura (solo silencios o percusión).', 'e');
      say(`✔ Archivo leído: ${usable.length} parte(s) con notas.`, 'o');
      const show = k => {
        const p = usable[k];
        $('#mxp', root).innerHTML = `${usable.length > 1 ? `<label class="f" style="margin:8px 0">Parte (instrumento)<select id="mpart">${usable.map((x, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(x.name)} (${x.notes.length} notas)</option>`).join('')}</select></label>` : `<p class="sub">Parte: <b>${esc(p.name)}</b> · ${p.notes.length} notas</p>`}
        <div class="staffbox">${scoreSVG(p.notes.slice(0, 24), { names: true, pos: true, hit: false, W: 420 })}</div>
        ${p.notes.length > 24 ? `<p class="sub">Vista previa de las primeras 24 notas.</p>` : ''}
        ${p.warns.map(w => `<div class="msg e">⚠️ ${esc(w)}</div>`).join('')}
        <p class="sub">Revisa que sea la parte de trombón (clave de fa). La app no cambia la octava ni transpone.</p>
        <div class="row"><button class="b" id="muse">Reemplazar mi secuencia</button><button class="b sec" id="muapp">Agregar al final</button></div>`;
        const sel = $('#mpart', root); if (sel) sel.onchange = () => show(+sel.value);
        $('#muse', root).onclick = () => onUse(p.notes, 'replace', f.name.replace(/\.[^.]+$/, ''));
        $('#muapp', root).onclick = () => onUse(p.notes, 'append', f.name.replace(/\.[^.]+$/, ''));
      };
      show(Math.max(0, usable.findIndex(x => /tromb|tbn|bone/i.test(x.name))));
    } catch (err) { say('⚠️ ' + esc(err.message), 'e'); }
  };
}
