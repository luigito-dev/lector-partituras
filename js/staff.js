/* Dibujo vectorial: pentagrama en clave de fa, notas, silencios y diagrama de la vara. */
'use strict';
const SYS_H = 215;          // alto de un sistema (renglón) en unidades del viewBox
const BOT = 102;            // línea inferior del pentagrama dentro del sistema
const NW = { w: 62, h: 54, q: 46, e: 40, s: 38 };

function accSym(x, y, a, col) {
  col = col || '#241a33';
  if (a === '#') return `<g stroke="${col}" fill="none" stroke-linecap="round"><path d="M${x - 2.6} ${y - 10}V${y + 10}M${x + 2.6} ${y - 11}V${y + 9}" stroke-width="1.5"/><path d="M${x - 6} ${y - 2}L${x + 6} ${y - 5}M${x - 6} ${y + 4.5}L${x + 6} ${y + 1.5}" stroke-width="3"/></g>`;
  if (a === 'b') return `<g stroke="${col}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${x - 3} ${y - 14}V${y + 5}M${x - 3} ${y + 5}C${x + 8} ${y} ${x + 8} ${y - 9} ${x - 3} ${y - 4}" stroke-width="2"/></g>`;
  if (a === 'n') return `<g stroke="${col}" fill="none" stroke-linecap="round"><path d="M${x - 3} ${y - 10}V${y + 4}M${x + 3} ${y - 4}V${y + 10}" stroke-width="1.5"/><path d="M${x - 3} ${y - 3}L${x + 3} ${y - 5}M${x - 3} ${y + 5}L${x + 3} ${y + 3}" stroke-width="2.5"/></g>`;
  return '';
}
function bclef(x0, yb) {
  const yF = yb - 30; // 4.ª línea = Fa
  return `<g fill="#241a33" stroke="#241a33" stroke-linecap="round"><circle cx="${x0 + 6}" cy="${yF}" r="5.2" stroke="none"/>` +
    `<path d="M${x0 + 1.2} ${yF - 1}C${x0 + 2} ${yF - 15} ${x0 + 28} ${yF - 14} ${x0 + 27} ${yF + 2}C${x0 + 26} ${yF + 17} ${x0 + 12} ${yF + 29} ${x0 - 2} ${yF + 35}" fill="none" stroke-width="3.6"/>` +
    `<circle cx="${x0 + 35}" cy="${yF - 5.5}" r="2.6" stroke="none"/><circle cx="${x0 + 35}" cy="${yF + 5.5}" r="2.6" stroke="none"/></g>`;
}
function ys(d, yb) { return yb - (d - 18) * 5; }

function noteSVG(n, x, yb, o) {
  o = o || {};
  const d = dIdx(n), y = ys(d, yb), col = o.col || '#241a33';
  let s = '';
  // líneas adicionales
  if (d <= 16) for (let k = 16; k >= (d % 2 === 0 ? d : d + 1); k -= 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${ys(k, yb)}" y2="${ys(k, yb)}" stroke="${col}" stroke-width="1.4"/>`;
  if (d >= 28) for (let k = 28; k <= (d % 2 === 0 ? d : d - 1); k += 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${ys(k, yb)}" y2="${ys(k, yb)}" stroke="${col}" stroke-width="1.4"/>`;
  if (n.a !== 'n') s += accSym(x - 17, y, n.a, col);
  const open = (o.dur === 'w' || o.dur === 'h');
  s += `<ellipse class="hd" cx="${x}" cy="${y}" rx="6.6" ry="4.7" transform="rotate(-20 ${x} ${y})" fill="${open ? '#fff' : col}" stroke="${col}" stroke-width="${open ? 2 : 1}"/>`;
  if (o.dur !== 'w') {
    const down = d >= 22;
    const xs = down ? x - 6 : x + 6, y2 = down ? y + 34 : y - 34;
    s += `<line x1="${xs}" x2="${xs}" y1="${y}" y2="${y2}" stroke="${col}" stroke-width="1.5"/>`;
    const fl = o.dur === 'e' ? 1 : o.dur === 's' ? 2 : 0;
    for (let k = 0; k < fl; k++) {
      if (!down) s += `<path d="M${xs} ${y2 + k * 7}c1 8 11 11 9 22" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
      else s += `<path d="M${xs} ${y2 - k * 7}c1 -8 11 -11 9 -22" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  return s;
}

function layout(notes, W) {
  W = W || 760;
  const START = 66, MAXX = W - 18, sys = [];
  let cur = [], x = START;
  notes.forEach((n, i) => {
    const w = NW[n.d] + (n.a !== 'n' ? 14 : 0);
    if (x + w > MAXX && cur.length) { sys.push(cur); cur = []; x = START; }
    cur.push({ i, x: x + (n.a !== 'n' ? 14 : 0) + NW[n.d] / 2 - 6 });
    x += w;
  });
  sys.push(cur);
  return sys;
}

/* Devuelve el texto SVG de la partitura. opts: names, pos, cur, sel, hit, from, to, W, title, empty */
function scoreSVG(notes, opts) {
  opts = opts || {};
  const W = opts.W || 760, sys = layout(notes, W);
  const from = opts.from || 0, to = opts.to == null ? sys.length : opts.to;
  const cnt = to - from, topPad = opts.title ? 34 : 0;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${cnt * SYS_H + topPad}" role="img" aria-label="Partitura en clave de fa" ${opts.id ? 'id="' + opts.id + '"' : ''}>`;
  s += `<rect width="${W}" height="${cnt * SYS_H + topPad}" fill="#fff"/>`;
  if (opts.title) s += `<text x="${W / 2}" y="24" text-anchor="middle" font-size="18" font-weight="700" fill="#5b2a86">${esc(opts.title)}</text>`;
  for (let k = from; k < to; k++) {
    const yb = (k - from) * SYS_H + topPad + BOT;
    s += `<g class="sys">`;
    for (let L = 0; L < 5; L++) s += `<line x1="8" x2="${W - 8}" y1="${yb - L * 10}" y2="${yb - L * 10}" stroke="#241a33" stroke-width="1.1"/>`;
    s += `<line x1="8" x2="8" y1="${yb}" y2="${yb - 40}" stroke="#241a33" stroke-width="1.6"/>`;
    s += bclef(14, yb);
    if (!notes.length && opts.empty !== false) s += `<text x="${W / 2}" y="${yb - 56}" text-anchor="middle" font-size="15" fill="#6a5f7a">Aún no hay notas. Agrégalas con los controles.</text>`;
    sys[k].forEach(p => {
      const n = notes[p.i], m = midiOf(n);
      const on = opts.cur === p.i, sel = opts.sel === p.i;
      s += `<g class="nt${on ? ' on' : ''}${sel ? ' sel' : ''}" data-i="${p.i}">`;
      if (opts.hit !== false) s += `<rect class="col" x="${p.x - NW[n.d] / 2 - 4}" y="${yb - 100}" width="${NW[n.d] + 8}" height="${SYS_H - 8}" rx="8"/>`;
      s += noteSVG(n, p.x, yb, { dur: n.d });
      if (opts.names !== false) s += `<text x="${p.x}" y="${yb + 78}" text-anchor="middle" font-size="14" font-weight="700" fill="#241a33">${esc(label(n))}</text>`;
      if (opts.pos) {
        const pi = posInfo(m);
        s += `<text x="${p.x}" y="${yb + 98}" text-anchor="middle" font-size="13" font-weight="700" fill="#5b2a86">${pi.inRange ? 'P' + pi.main : '—'}</text>`;
      }
      s += `</g>`;
    });
    s += `</g>`;
  }
  return s + '</svg>';
}
function sysCount(notes, W) { return layout(notes, W).length; }

/* Silencios (símbolos simples) */
function restSVG(kind) {
  const L = [0, 1, 2, 3, 4].map(i => `<line x1="2" x2="78" y1="${20 + i * 10}" y2="${20 + i * 10}" stroke="#241a33" stroke-width="1"/>`).join('');
  let r = '';
  if (kind === 'w') r = '<rect x="30" y="30" width="20" height="6" fill="#241a33"/>';       // cuelga de la 4.ª línea
  if (kind === 'h') r = '<rect x="30" y="34" width="20" height="6" fill="#241a33"/>';       // sobre la 3.ª línea
  if (kind === 'q') r = '<path d="M36 22l9 11-6 7 8 9c-6-2-9 1-7 6" fill="none" stroke="#241a33" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>';
  if (kind === 'e') r = '<circle cx="38" cy="30" r="3.4" fill="#241a33"/><path d="M40 30c4 0 6-3 8-6M48 24L38 52" fill="none" stroke="#241a33" stroke-width="2.6" stroke-linecap="round"/>';
  if (kind === 's') r = '<circle cx="38" cy="30" r="3.2" fill="#241a33"/><circle cx="35" cy="40" r="3.2" fill="#241a33"/><path d="M40 30c4 0 6-3 8-6M37 40c4 0 6-3 9-6M48 24L36 54" fill="none" stroke="#241a33" stroke-width="2.6" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 80 70" style="width:100%;max-width:120px;height:auto" role="img" aria-label="silencio">${L}${r}</svg>`;
}

/* Diagrama horizontal del trombón con la vara en la posición p (1 a 7). */
function slideSVG(p, o) {
  o = o || {};
  const X0 = 400, K = 3.6, E = X0 + CMS[p - 1] * K;
  const br = '#e2b23c', st = '#8a6a10';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.mini ? '0 70 700 110' : '0 0 700 270'}" role="img" aria-label="Trombón con la vara en posición ${p}" style="width:100%;height:auto;display:block">`;
  s += `<path d="M130 134C100 137 85 151 48 173L48 81C85 103 100 117 130 120Z" fill="${br}" stroke="${st}" stroke-width="2"/>`;
  s += `<ellipse cx="48" cy="127" rx="9" ry="46" fill="none" stroke="${st}" stroke-width="1.5"/>`;
  s += `<rect x="130" y="105" width="72" height="44" rx="12" fill="${br}" stroke="${st}" stroke-width="2"/>`;
  s += `<g stroke-linecap="round" fill="none"><line x1="202" y1="112" x2="385" y2="112" stroke="${st}" stroke-width="10"/><line x1="202" y1="142" x2="385" y2="142" stroke="${st}" stroke-width="10"/><line x1="202" y1="112" x2="385" y2="112" stroke="${br}" stroke-width="6"/><line x1="202" y1="142" x2="385" y2="142" stroke="${br}" stroke-width="6"/>`;
  s += `<line x1="385" y1="112" x2="${E}" y2="112" stroke="${st}" stroke-width="7"/><line x1="385" y1="142" x2="${E}" y2="142" stroke="${st}" stroke-width="7"/><line x1="385" y1="112" x2="${E}" y2="112" stroke="#f3cf6b" stroke-width="3.5"/><line x1="385" y1="142" x2="${E}" y2="142" stroke="#f3cf6b" stroke-width="3.5"/>`;
  s += `<path d="M${E} 112A15 15 0 0 1 ${E} 142" stroke="${st}" stroke-width="7"/><path d="M${E} 112A15 15 0 0 1 ${E} 142" stroke="#f3cf6b" stroke-width="3.5"/></g>`;
  s += `<line x1="${E - 46}" x2="${E - 46}" y1="106" y2="148" stroke="${st}" stroke-width="4"/><circle cx="${E - 46}" cy="127" r="9" fill="#5b2a86"/>`;
  if (!o.mini) {
    s += `<text x="${E - 46}" y="94" font-size="13" text-anchor="middle" fill="#5b2a86" font-weight="700">mano</text>`;
    s += `<text x="48" y="205" font-size="12" text-anchor="middle" fill="#6a5f7a">campana</text><text x="166" y="98" font-size="12" text-anchor="middle" fill="#6a5f7a">cuerpo</text><text x="290" y="98" font-size="12" text-anchor="middle" fill="#6a5f7a">vara</text>`;
    s += `<line x1="${X0}" x2="${X0 + 56 * K}" y1="214" y2="214" stroke="#ddd3ea" stroke-width="2"/>`;
    CMS.forEach((c, i) => {
      const x = X0 + c * K, on = i + 1 === p;
      s += `<line x1="${x}" x2="${x}" y1="146" y2="205" stroke="${on ? '#c9962b' : '#ddd3ea'}" stroke-width="${on ? 2.5 : 1}" stroke-dasharray="${on ? '0' : '3 3'}"/>`;
      s += `<circle cx="${x}" cy="228" r="13" fill="${on ? '#5b2a86' : '#fff'}" stroke="#c9962b" stroke-width="2"/><text x="${x}" y="233" font-size="14" font-weight="700" text-anchor="middle" fill="${on ? '#fff' : '#241a33'}">${i + 1}</text>`;
    });
    s += `<text x="${X0}" y="262" font-size="11" text-anchor="middle" fill="#6a5f7a">cerrada</text><text x="${X0 + 56 * K}" y="262" font-size="11" text-anchor="middle" fill="#6a5f7a">extendida</text>`;
  } else {
    if (!o.hideNum) s += `<text x="${X0 + 220}" y="108" font-size="26" font-weight="800" fill="#5b2a86">${p}</text>`;
  }
  return s + '</svg>';
}
