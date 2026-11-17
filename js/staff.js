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
  if (o.dot) s += `<circle cx="${x + 12}" cy="${(d >= 18 && d <= 26 && (d - 18) % 2 === 0) ? y - 5 : y}" r="2" fill="${col}"/>`;
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
    const acc = (!n.r && n.a !== 'n') ? 14 : 0, w = NW[n.d] + acc + (n.bar ? 8 : 0);
    if (x + w > MAXX && cur.length) { sys.push(cur); cur = []; x = START; }
    cur.push({ i, x: x + acc + (n.bar ? 8 : 0) + NW[n.d] / 2 - 6, bar: !!n.bar });
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
      const n = notes[p.i], m = n.r ? 0 : midiOf(n);
      const on = opts.cur === p.i, sel = opts.sel === p.i;
      s += `<g class="nt${on ? ' on' : ''}${sel ? ' sel' : ''}" data-i="${p.i}">`;
      if (opts.hit !== false) s += `<rect class="col" x="${p.x - NW[n.d] / 2 - 4}" y="${yb - 100}" width="${NW[n.d] + 8}" height="${SYS_H - 8}" rx="8"/>`;
      if (p.bar) s += `<line x1="${p.x - NW[n.d] / 2 - 4}" x2="${p.x - NW[n.d] / 2 - 4}" y1="${yb}" y2="${yb - 40}" stroke="#241a33" stroke-width="1.3"/>`;
      if (n.r) {
        s += restShapes(n.d, p.x, yb);
        if (n.dot) s += `<circle cx="${p.x + 12}" cy="${yb - 25}" r="2" fill="#241a33"/>`;
      } else s += noteSVG(n, p.x, yb, { dur: n.d, dot: n.dot });
      if (n.tie && !n.r) {
        const nx = sys[k].find(q => q.i === p.i + 1), y0 = ys(dIdx(n), yb) + (dIdx(n) >= 22 ? -9 : 9), up = dIdx(n) >= 22 ? -1 : 1, x2 = nx ? nx.x : p.x + 26;
        s += `<path d="M${p.x + 4} ${y0}Q${(p.x + x2) / 2} ${y0 + up * 12} ${x2 - 4} ${y0}" fill="none" stroke="#241a33" stroke-width="1.6"/>`;
      }
      if (opts.names !== false) s += `<text x="${p.x}" y="${yb + 78}" text-anchor="middle" font-size="${n.r ? 11 : 14}" font-weight="${n.r ? 400 : 700}" fill="#241a33">${n.r ? 'silencio' : esc(label(n))}</text>`;
      if (opts.pos && !n.r) {
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

/* Silencios: formas dibujadas con la 3.ª línea (central) en la posición (x, yb-20). */
function restShapes(kind, x, yb, col) {
  col = col || '#241a33'; const mid = yb - 20;
  if (kind === 'w') return `<rect x="${x - 9}" y="${yb - 30}" width="18" height="6" fill="${col}"/>`;
  if (kind === 'h') return `<rect x="${x - 9}" y="${mid - 6}" width="18" height="6" fill="${col}"/>`;
  const t = `translate(${x - 38} ${yb - 60})`;
  if (kind === 'q') return `<path transform="${t}" d="M36 22l9 11-6 7 8 9c-6-2-9 1-7 6" fill="none" stroke="${col}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (kind === 'e') return `<g transform="${t}"><circle cx="38" cy="30" r="3.4" fill="${col}"/><path d="M40 30c4 0 6-3 8-6M48 24L38 52" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/></g>`;
  return `<g transform="${t}"><circle cx="38" cy="30" r="3.2" fill="${col}"/><circle cx="35" cy="40" r="3.2" fill="${col}"/><path d="M40 30c4 0 6-3 8-6M37 40c4 0 6-3 9-6M48 24L36 54" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/></g>`;
}
function restSVG(kind) {
  const yb = 60, L = [0, 1, 2, 3, 4].map(i => `<line x1="2" x2="78" y1="${yb - i * 10}" y2="${yb - i * 10}" stroke="#241a33" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 80 70" style="width:100%;max-width:120px;height:auto" role="img" aria-label="silencio">${L}${restShapes(kind, 40, yb)}</svg>`;
}

/* Diagrama del trombón (dibujo propio, estilo plano). La vara completa se desplaza: la barra morada marca
   dónde empieza la vara exterior en la posición p (1 a 7). o.mini = sin rótulos; o.hideNum = oculta los números. */
function slideSVG(p, o) {
  o = o || {};
  const K = 3.2, XS = 292, L = 178, YB = 100, YU = 140, YL = 200;
  const xm = q => XS + CMS[q - 1] * K, M = xm(p), E = M + L;
  const G = '#f9b934', D = '#dc9a1f', GR = '#d4d4d9', GD = '#9a9aa6', PU = '#5b2a86';
  const tube = (x1, x2, y, h) => `<rect x="${x1}" y="${y - h / 2 - 2}" width="${x2 - x1}" height="${h + 4}" rx="3" fill="${D}"/><rect x="${x1}" y="${y - h / 2}" width="${x2 - x1}" height="${h}" rx="2" fill="${G}"/>`;
  const inner = (x1, x2, y) => `<rect x="${x1}" y="${y - 6}" width="${x2 - x1}" height="12" fill="${GD}"/><rect x="${x1}" y="${y - 4}" width="${x2 - x1}" height="8" fill="${GR}"/>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 10 700 280" role="img" aria-label="Trombón con la vara en posición ${p}" style="width:100%;height:auto;display:block">`;
  // campana
  s += `<path d="M104 ${YB - 7}C250 ${YB - 8} 360 ${YB - 18} 414 14C442 54 442 118 414 160C360 118 250 ${YB + 6} 104 ${YB + 7}Z" fill="${G}" stroke="${D}" stroke-width="3" stroke-linejoin="round"/>`;
  s += `<ellipse cx="416" cy="87" rx="12" ry="73" fill="#e39f26" stroke="${D}" stroke-width="3"/>`;
  // curva izquierda (campana ↔ vara) y conexiones
  const bend = `M108 ${YB}H${50 + 49}A49 49 0 0 0 ${99} ${YL}H${XS}`;
  s += `<path d="M108 ${YB}H99A49 49 0 0 0 99 ${YL}H${XS}" fill="none" stroke="${D}" stroke-width="18"/><path d="M108 ${YB}H99A49 49 0 0 0 99 ${YL}H${XS}" fill="none" stroke="${G}" stroke-width="14"/>`;
  s += tube(104, 112, (YB + YL) / 2, YL - YB - 4);
  s += tube(258, 266, (YU + YL) / 2, YL - YU - 4);
  // boquilla y tubo superior fijo
  s += `<rect x="196" y="${YU - 13}" width="26" height="26" rx="4" fill="${GR}" stroke="${GD}" stroke-width="2"/><rect x="222" y="${YU - 6}" width="30" height="12" fill="${GR}" stroke="${GD}" stroke-width="1.5"/>`;
  s += tube(252, XS, YU, 14);
  // tubos internos (plateados) visibles entre las zapatas y la vara
  s += inner(XS, M, YU) + inner(XS, M, YL);
  s += `<rect x="${XS - 8}" y="${YU - 11}" width="8" height="22" rx="2" fill="${GD}"/><rect x="${XS - 8}" y="${YL - 11}" width="8" height="22" rx="2" fill="${GD}"/>`;
  // vara exterior (completa, con su curva)
  s += tube(M, E, YU, 14) + tube(M, E, YL, 14);
  s += `<path d="M${E} ${YU}A${(YL - YU) / 2} ${(YL - YU) / 2} 0 0 1 ${E} ${YL}" fill="none" stroke="${D}" stroke-width="18"/><path d="M${E} ${YU}A${(YL - YU) / 2} ${(YL - YU) / 2} 0 0 1 ${E} ${YL}" fill="none" stroke="${G}" stroke-width="14"/>`;
  s += `<rect x="${M - 4}" y="${YU - 12}" width="8" height="${YL - YU + 24}" rx="3" fill="${PU}"/>`;
  // números
  for (let q = 1; q <= 7; q++) {
    const x = xm(q), on = q === p;
    if (!on) s += `<line x1="${x}" x2="${x}" y1="${YL + 16}" y2="${YL + 34}" stroke="#d4cfdd" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    if (!o.hideNum) s += `<text x="${x}" y="${YL + 62}" font-size="${on ? 24 : 18}" font-weight="${on ? 800 : 500}" text-anchor="middle" fill="${on ? PU : '#aaa4b6'}">${q}</text>`;
    else if (on) s += `<line x1="${x}" x2="${x}" y1="${YL + 16}" y2="${YL + 44}" stroke="${PU}" stroke-width="3"/>`;
  }
  if (!o.mini) s += `<text x="${xm(1)}" y="${YL + 84}" font-size="12" text-anchor="middle" fill="#6a5f7a">vara cerrada</text><text x="${xm(7)}" y="${YL + 84}" font-size="12" text-anchor="middle" fill="#6a5f7a">vara extendida</text>`;
  return s + '</svg>';
}
