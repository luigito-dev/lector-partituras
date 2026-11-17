/* Módulo 10: exportación a imagen (PNG), PDF e impresión. Todo se genera en el navegador. */
'use strict';
function chunks(notes, per) { const n = sysCount(notes), r = []; for (let i = 0; i < n; i += per) r.push([i, Math.min(n, i + per)]); return r; }
function exportSvg(notes, o, from, to) {
  const s = scoreSVG(notes, { names: o.names, pos: o.pos, title: o.title, from, to, hit: false, empty: false });
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(s);
  return { svg: s.replace('<svg xmlns', `<svg width="${vb[1]}" height="${vb[2]}" xmlns`), w: +vb[1], h: +vb[2] };
}
function svgToCanvas(sv, scale) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = sv.w * scale; c.height = sv.h * scale; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res(c); };
    im.onerror = () => rej(new Error('el navegador no pudo dibujar la partitura'));
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sv.svg);
  });
}
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function fname(t, ext) { return (t || 'partitura').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() + '.' + ext; }
async function exportPNG(notes, o) {
  const c = await svgToCanvas(exportSvg(notes, o, 0, sysCount(notes)), 2);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) throw new Error('no se pudo crear el archivo');
  saveBlob(blob, fname(o.title, 'png')); return blob;
}
function b64bytes(d) { const b = atob(d.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function buildPdf(imgs) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = b => { if (typeof b === 'string') b = enc.encode(b); parts.push(b); len += b.length; };
  push(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10])); // %PDF-1.4 + marca binaria
  const n = imgs.length;
  offs[1] = len; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2] = len; push(`2 0 obj\n<< /Type /Pages /Kids [${imgs.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ')}] /Count ${n} >>\nendobj\n`);
  imgs.forEach((im, i) => {
    const po = 3 + 3 * i, co = po + 1, io = po + 2, W = 515, H = W * im.h / im.w, y = 842 - 40 - H;
    offs[po] = len; push(`${po} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>\nendobj\n`);
    const cs = `q ${W} 0 0 ${H.toFixed(2)} 40 ${y.toFixed(2)} cm /Im0 Do Q`;
    offs[co] = len; push(`${co} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    offs[io] = len; push(`${io} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
    push(im.bytes); push('\nendstream\nendobj\n');
  });
  const xs = len, total = 3 * n + 3; let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) x += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
  push(x); push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xs}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
async function exportPDF(notes, o) {
  const imgs = [];
  for (const [a, b] of chunks(notes, 5)) {
    const sv = exportSvg(notes, o, a, b), c = await svgToCanvas(sv, 2);
    imgs.push({ bytes: b64bytes(c.toDataURL('image/jpeg', 0.92)), w: c.width, h: c.height });
  }
  const blob = buildPdf(imgs); saveBlob(blob, fname(o.title, 'pdf')); return blob;
}
function preparePrint(notes, o) {
  const pa = $('#printarea');
  pa.innerHTML = chunks(notes, 5).map(([a, b]) => `<div class="sys">${scoreSVG(notes, { names: o.names, pos: o.pos, title: o.title, from: a, to: b, hit: false, empty: false })}</div>`).join('') + `<p style="font:12px system-ui;color:#555">Trombón tenor en Si♭ · clave de fa · P = posición de la vara</p>`;
}
function printScore(notes, o) { preparePrint(notes, o); window.print(); }
