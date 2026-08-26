// Shared board renderer for the app-screen replicas — mirrors
// apps/mobile/src/components/Goban.tsx (nightLuxe + lacquer themes,
// coordinates outside the slab, warm last-move glow, cropped views).

function drawGoban(el, opts) {
  const size = opts.size || 9;
  const v = opts.view || { c0: 0, r0: 0, c1: size - 1, r1: size - 1 };
  const CELL = 24, PAD = 26;
  const showCoords = !opts.view;
  const GUT = 22;
  const px = (i) => PAD + i * CELL;
  const woodX = px(v.c0) - PAD, woodY = px(v.r0) - PAD;
  const woodW = px(v.c1) - px(v.c0) + PAD * 2, woodH = px(v.r1) - px(v.r0) + PAD * 2;
  const minX = woodX - GUT, minY = woodY - GUT;
  const W = woodW + GUT * 2, H = woodH + GUT * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `${minX} ${minY} ${W} ${H}`);
  svg.setAttribute('width', opts.width || 363);
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  el.appendChild(svg);
  const mk = (n, a, text) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  };
  svg.innerHTML = `<defs>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6F5638"/><stop offset="0.45" stop-color="#77603F"/><stop offset="1" stop-color="#624B32"/>
    </linearGradient>
    <radialGradient id="bs" cx="0.36" cy="0.28" r="0.95">
      <stop offset="0" stop-color="#7A7A7A"/><stop offset="0.18" stop-color="#262626"/><stop offset="0.65" stop-color="#101010"/><stop offset="1" stop-color="#0B0B0B"/>
    </radialGradient>
    <radialGradient id="ws" cx="0.36" cy="0.28" r="0.95">
      <stop offset="0" stop-color="#F4F3EF"/><stop offset="0.3" stop-color="#E0DEDA"/><stop offset="1" stop-color="#C9C7C2"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,236,205,0.05)"/>
      <stop offset="0.5" stop-color="rgba(255,236,205,0)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0.06)"/>
    </linearGradient>
  </defs>`;
  const woodRect = mk('rect', { x: woodX, y: woodY, width: woodW, height: woodH, rx: 10, fill: 'url(#wood)' });
  woodRect.style.filter = 'drop-shadow(0 9px 20px rgba(0,0,0,0.6))';
  // single soft linear sheen — no radial geometry on the wood
  const sheen = mk('rect', { x: woodX, y: woodY, width: woodW, height: woodH, rx: 10,
                             fill: 'url(#sheen)' });
  // fine jittered vertical grain strokes
  const grainAlpha = (opts.width || 363) < 250 ? 0.045 : 0.068;
  let gx = woodX + 4;
  let seed = 7;
  while (gx < woodX + woodW - 4) {
    seed = (seed * 16807) % 2147483647;
    mk('line', { x1: gx, y1: woodY + 2, x2: gx + (seed % 3) - 1, y2: woodY + woodH - 2,
                 stroke: `rgba(40,28,16,${grainAlpha})`, 'stroke-width': 1 });
    gx += 6 + (seed % 9);
  }
  [0.09, 0.22, 0.38, 0.47, 0.63, 0.78, 0.9].forEach((t, i) => {
    mk('rect', { x: woodX + woodW * t, y: woodY, width: 1 + (i % 3) * 1.4, height: woodH,
                 fill: '#5E4426', opacity: 0.12 * (0.6 + (i % 2) * 0.5) });
  });
  mk('rect', { x: woodX + 1, y: woodY + 1, width: woodW - 2, height: woodH - 2, rx: 9.5,
               fill: 'none', stroke: 'rgba(45,30,12,0.33)', 'stroke-width': 2 });

  for (let c = v.c0; c <= v.c1; c++) {
    mk('line', { x1: px(c), y1: px(v.r0) - (v.r0 > 0 ? 14 : 0), x2: px(c), y2: px(v.r1) + (v.r1 < size - 1 ? 14 : 0),
                 stroke: 'rgba(46,32,16,0.85)',
                 'stroke-width': 1 });
  }
  for (let r = v.r0; r <= v.r1; r++) {
    mk('line', { x1: px(v.c0) - (v.c0 > 0 ? 14 : 0), y1: px(r), x2: px(v.c1) + (v.c1 < size - 1 ? 14 : 0), y2: px(r),
                 stroke: 'rgba(46,32,16,0.85)',
                 'stroke-width': 1 });
  }
  const hoshi = size === 9 ? [[2,2],[6,2],[4,4],[2,6],[6,6]]
    : size === 19 ? [3,9,15].flatMap((a)=>[3,9,15].map((b)=>[a,b])) : [];
  hoshi.filter(([c,r]) => c>=v.c0&&c<=v.c1&&r>=v.r0&&r<=v.r1)
    .forEach(([c,r]) => mk('circle', { cx: px(c), cy: px(r), r: 2.6, fill: '#241A0C' }));
  const COLS = 'ABCDEFGHJKLMNOPQRST';
  for (let c = v.c0; c <= v.c1; c++) mk('text', { x: px(c), y: woodY - 9, 'text-anchor': 'middle',
    'font-size': 9.5, fill: '#8A867E', 'font-family': 'InterV' }, COLS[c]);
  for (let r = v.r0; r <= v.r1; r++) for (const tx of [woodX - 11, woodX + woodW + 11])
    mk('text', { x: tx, y: px(r) + 3.5, 'text-anchor': 'middle', 'font-size': 9.5,
      fill: '#8A867E', 'font-family': 'InterV' }, String(size - r));
  const R = 9.6; // 0.80 × cell (CELL 24), per mockup measurement
  for (const s of opts.stones || []) {
    mk('ellipse', { cx: px(s.c) + 1.2, cy: px(s.r) + 2.4, rx: R + 0.6, ry: R - 0.2,
                    fill: 'rgba(15,9,3,0.55)' });
    mk('circle', { cx: px(s.c), cy: px(s.r), r: R, fill: s.color === 'b' ? 'url(#bs)' : 'url(#ws)',
                   stroke: s.color === 'w' ? '#B5AD98' : 'none', 'stroke-width': 0.4 });
    if (s.color === 'w') {
      const streak = mk('ellipse', { cx: px(s.c) - 2.2, cy: px(s.r) - 3.4, rx: 5.6, ry: 1.6,
                                     fill: '#FFFFFF', opacity: 0.30 });
      streak.setAttribute('transform', `rotate(-30 ${px(s.c) - 2.2} ${px(s.r) - 3.4})`);
    } else {
      mk('ellipse', { cx: px(s.c) - 3.4, cy: px(s.r) - 4.2, rx: 3.2, ry: 2.2,
                      fill: '#FFFFFF', opacity: 0.22 });
    }
  }
  if (opts.lastMove) {
    const { c, r } = opts.lastMove;
    const halo1 = mk('circle', { cx: px(c), cy: px(r), r: R + 5, fill: 'none', stroke: 'rgba(255,200,150,0.34)', 'stroke-width': 8 });
    halo1.style.filter = 'blur(3px)';
    const halo3 = mk('circle', { cx: px(c), cy: px(r), r: R + 1.5, fill: 'none', stroke: 'rgba(235,200,165,0.62)', 'stroke-width': 2.6 });
    halo3.style.filter = 'blur(0.4px)';
  }
  for (const m of opts.marks || []) {
    mk('circle', { cx: px(m.c), cy: px(m.r), r: 8.5, fill: '#9A7B50', opacity: 0.92,
                   stroke: '#4A3A26', 'stroke-width': 1 });
    mk('text', { x: px(m.c), y: px(m.r) + 4, 'text-anchor': 'middle', 'font-size': 12,
                 'font-weight': 800, fill: '#7C6EE0', 'font-family': 'InterV' }, m.label);
  }
  for (const g of opts.ghosts || []) {
    mk('circle', { cx: px(g.c), cy: px(g.r), r: R, opacity: 0.42,
                   fill: g.color === 'b' ? '#262626' : '#F2F0EC' });
  }
}
