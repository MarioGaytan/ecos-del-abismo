'use strict';
// =====================================================================
//  MUNDO PROCEDURAL — cuevas por autómata celular + plazas y túneles,
//  terreno especial (lento, dañino, pendientes, hielo), trampas,
//  zonas especiales, santuarios con guardián, cofres escondidos,
//  niebla de guerra y campo de flujo (BFS) para que los enemigos
//  rodeen los muros. Cada partida genera mapas distintos.
// =====================================================================

const TILE = 80, MAPN = 64;                    // WORLD = TILE * MAPN
const TF = 0, TW = 1, TSLOW = 2, THURT = 3, TSLOPE = 4, TICE = 5;
const TRAP_PERIOD = 2.8;

const TERRAIN = {
  forest: { top: ['#2c4a26', '#365c2e', '#24401f', '#41693a'], face: ['#1a2a17', '#13200f'], slow: ['Pantano', '#2a3a1c', 'Te ralentiza'], hurt: ['Zarzas venenosas', '#8a3a9a', 9], slope: 'Ladera', ice: null, trap: 'spikes', fogc: '#05090a' },
  crypt:  { top: ['#4a5068', '#555c78', '#3e4359', '#626a88'], face: ['#23263a', '#1a1c2b'], slow: ['Nieve profunda', '#b8c8e8', 'Te ralentiza'], hurt: ['Runas malditas', '#6a3aff', 11], slope: 'Escalinata', ice: 'Hielo resbaladizo', trap: 'frost', fogc: '#04050c' },
  forge:  { top: ['#4a2a22', '#5a3326', '#3a201a', '#6a3a2a'], face: ['#24120e', '#1a0c09'], slow: ['Ceniza', '#6a5a52', 'Te ralentiza'], hurt: ['Lava', '#ff5a1a', 18], slope: 'Pendiente de escoria', ice: null, trap: 'vent', fogc: '#0a0403' },
};
const ZONES = {
  sagrada: { n: 'Arboleda Sagrada', c: '#5bff8a', d: 'Regeneras 2% de vida por segundo' },
  maldita: { n: 'Zona Maldita', c: '#b066ff', d: '+60% exp y almas, pero recibes +30% daño' },
};
let MAP = null;

// ---------------------------------------------------------------- utilidades
const tIdx = (x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return (tx < 0 || ty < 0 || tx >= MAPN || ty >= MAPN) ? -1 : ty * MAPN + tx;
};
function tileAt(x, y) { const i = tIdx(x, y); return i < 0 ? TW : MAP.t[i]; }
function isWall(x, y) { return tileAt(x, y) === TW; }
function revealedAt(x, y) { const i = tIdx(x, y); return i >= 0 && MAP.fog[i] === 1; }

function bfs(t, sx, sy, out) {
  const n = MAPN; out.fill(-1);
  const q = new Int32Array(n * n); let h = 0, e = 0;
  const s = sy * n + sx; if (t[s] === TW) return out;
  out[s] = 0; q[e++] = s;
  while (h < e) {
    const i = q[h++], x = i % n, y = (i / n) | 0, d = out[i] + 1;
    if (x > 0 && t[i - 1] !== TW && out[i - 1] < 0) { out[i - 1] = d; q[e++] = i - 1; }
    if (x < n - 1 && t[i + 1] !== TW && out[i + 1] < 0) { out[i + 1] = d; q[e++] = i + 1; }
    if (y > 0 && t[i - n] !== TW && out[i - n] < 0) { out[i - n] = d; q[e++] = i - n; }
    if (y < n - 1 && t[i + n] !== TW && out[i + n] < 0) { out[i + n] = d; q[e++] = i + n; }
  }
  return out;
}
function randomFloorAround(x, y, rmin, rmax, tries) {
  for (let k = 0; k < (tries || 12); k++) {
    const a = Math.random() * TAU, r = rnd(rmin, rmax);
    const px = clamp(x + Math.cos(a) * r, 60, WORLD - 60), py = clamp(y + Math.sin(a) * r, 60, WORLD - 60);
    const i = tIdx(px, py);
    if (i >= 0 && MAP.t[i] !== TW && MAP.flow[i] >= 0) return { x: px, y: py };
  }
  return null;
}

// ---------------------------------------------------------------- generación
function genMap(L) {
  const n = MAPN, N = n * n, c = n >> 1, TER = TERRAIN[L.biome];
  let t;
  const carve = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1) t[y * n + x] = TF; };
  const tunnel = (x0, y0, x1, y1) => {           // túnel serpenteante de 2 baldosas
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 400) {
      if (Math.random() < 0.6) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
      if (Math.random() < 0.15) x += Math.random() < 0.5 ? -1 : 1;
      x = clamp(x, 2, n - 3); y = clamp(y, 2, n - 3);
      carve(x, y, 1);
    }
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    t = new Uint8Array(N);
    const dens = 0.45 - attempt * 0.02;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      t[y * n + x] = (x < 2 || y < 2 || x >= n - 2 || y >= n - 2 || Math.random() < dens) ? TW : TF;
    for (let it = 0; it < 5; it++) {
      const nt = new Uint8Array(N);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2) { nt[y * n + x] = TW; continue; }
        let w = 0;
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) w += t[(y + yy) * n + x + xx] === TW ? 1 : 0;
        nt[y * n + x] = w >= 5 ? TW : TF;
      }
      t = nt;
    }
    // plazas abiertas conectadas al centro por túneles
    carve(c, c, 6);
    for (let k = 0; k < 8; k++) {
      const px = 8 + Math.floor(Math.random() * (n - 16)), py = 8 + Math.floor(Math.random() * (n - 16));
      carve(px, py, 3 + Math.floor(Math.random() * 3));
      tunnel(px, py, c, c);
    }
    // todo lo que no se pueda alcanzar se vuelve muro
    const d = bfs(t, c, c, new Int32Array(N));
    let floor = 0;
    for (let i = 0; i < N; i++) { if (t[i] !== TW && d[i] < 0) t[i] = TW; if (t[i] !== TW) floor++; }
    if (floor / N > 0.42) break;
  }
  const dir = new Float32Array(N);
  const D = bfs(t, c, c, new Int32Array(N));
  const floorTiles = []; for (let i = 0; i < N; i++) if (t[i] === TF) floorTiles.push(i);
  const farFromStart = (i, m) => D[i] >= m;
  const rndFloor = m => { for (let k = 0; k < 60; k++) { const i = pick(floorTiles); if (t[i] === TF && farFromStart(i, m)) return i; } return pick(floorTiles); };

  // terreno especial en manchas
  const blob = (type, count, rmin, rmax) => {
    for (let k = 0; k < count; k++) {
      const i = rndFloor(9), cx = i % n, cy = (i / n) | 0, r = rmin + Math.random() * (rmax - rmin), a = Math.random() * TAU;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const j = y * n + x, dd = Math.hypot(x - cx, y - cy);
        if (t[j] === TF && dd <= r && (dd < r - 1 || Math.random() < 0.6) && D[j] >= 7) { t[j] = type; dir[j] = a; }
      }
    }
  };
  blob(TSLOW, 10, 2, 4.5);
  blob(THURT, 7, 1, 2.5);
  blob(TSLOPE, 7, 2, 3.5);
  if (TER.ice) blob(TICE, 7, 3, 5);

  // santuarios: muestreo del punto más lejano entre sí y del inicio
  const shrineTypes = Object.keys(SHRINES).sort(() => Math.random() - 0.5);
  const sIdx = [];
  for (let k = 0; k < 5; k++) {
    let best = -1, bs = -1;
    for (let s = 0; s < 250; s++) {
      const i = pick(floorTiles); if (D[i] < 14) continue;
      const x = i % n, y = (i / n) | 0;
      let md = 1e9; for (const j of sIdx) md = Math.min(md, Math.hypot(x - j % n, y - ((j / n) | 0)));
      const score = Math.min(md, 30) + D[i] * 0.15;
      if (score > bs) { bs = score; best = i; }
    }
    if (best >= 0) sIdx.push(best);
  }
  const shrines = [], traps = [];
  sIdx.forEach((i, k) => {
    const tx = i % n, ty = (i / n) | 0;
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && t[y * n + x] !== TW) t[y * n + x] = TF;
    const type = shrineTypes[k % shrineTypes.length];
    const sh = { type, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, prog: 0, used: false, guard: type !== 'maldito', g: null };
    shrines.push(sh);
    // anillo de trampas alrededor del santuario
    const ring = [];
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
      const dd = Math.hypot(x - tx, y - ty);
      if (dd >= 2 && dd <= 3.2 && x > 1 && y > 1 && x < n - 2 && y < n - 2 && t[y * n + x] === TF) ring.push([x, y]);
    }
    ring.sort(() => Math.random() - 0.5).slice(0, 9).forEach(([x, y]) => traps.push(mkTrap(x, y, TER.trap)));
  });
  // grupos de trampas en pasillos
  for (let k = 0; k < 14; k++) {
    const i = rndFloor(7), cx = i % n, cy = (i / n) | 0;
    const m = 2 + Math.floor(Math.random() * 4);
    for (let q = 0; q < m; q++) {
      const x = cx + Math.floor(rnd(-2, 3)), y = cy + Math.floor(rnd(-2, 3));
      if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && t[y * n + x] === TF && !traps.some(tr => tr.tx === x && tr.ty === y)) traps.push(mkTrap(x, y, TER.trap));
    }
  }
  // zonas especiales
  const zones = [];
  for (const type of ['sagrada', 'maldita', 'sagrada', 'maldita']) {
    for (let s = 0; s < 40; s++) {
      const i = rndFloor(10), x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE;
      if (shrines.some(sh => Math.hypot(sh.x - x, sh.y - y) < 7 * TILE) || zones.some(z => Math.hypot(z.x - x, z.y - y) < 10 * TILE)) continue;
      zones.push({ type, x, y, r: rnd(3.5, 5) * TILE });
      break;
    }
  }
  // cofres escondidos en callejones sin salida
  const chests = [];
  const deadEnds = floorTiles.filter(i => {
    if (t[i] !== TF || D[i] < 10) return false;
    const x = i % n, y = (i / n) | 0; let w = 0;
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (t[(y + yy) * n + x + xx] === TW) w++;
    return w >= 5;
  }).sort(() => Math.random() - 0.5);
  for (const i of deadEnds) {
    if (chests.length >= 3) break;
    const x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE;
    if (chests.some(ch => Math.hypot(ch.x - x, ch.y - y) < 15 * TILE)) continue;
    chests.push({ k: 'chest', x, y, tier: 1, hidden: true });
  }
  // decoración sólida (árboles, rocas…) sobre suelo normal
  const props = [];
  for (let k = 0; k < 320; k++) {
    const i = pick(floorTiles); if (t[i] !== TF || D[i] < 5) continue;
    const x = (i % n + rnd(0.2, 0.8)) * TILE, y = (((i / n) | 0) + rnd(0.2, 0.8)) * TILE;
    if (shrines.some(sh => Math.hypot(sh.x - x, sh.y - y) < 3.2 * TILE) || chests.some(ch => Math.hypot(ch.x - x, ch.y - y) < TILE)) continue;
    if (traps.some(tr => Math.hypot(tr.x - x, tr.y - y) < TILE * 0.8)) continue;
    const [type] = wpick(L.props, p => p[1]);
    const sc = { tree: 5, rock: 4, mush: 3.5, tomb: 4, pillar: 4.5, crystal: 4.5, spike: 5 }[type] * rnd(0.85, 1.15);
    const r = { tree: 16, rock: 20, mush: 10, tomb: 14, pillar: 16, crystal: 13, spike: 18 }[type] * sc / 4.5;
    if (props.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + r + 30) ** 2)) continue;
    props.push({ kind: 'prop', type, x, y, r, sc, spr: getSpr(type), solid: true });
  }
  const decals = [];
  for (let k = 0; k < 2200; k++) {
    const i = pick(floorTiles);
    decals.push({ x: (i % n + Math.random()) * TILE, y: (((i / n) | 0) + Math.random()) * TILE, col: pick(L.decal), k: Math.floor(Math.random() * 3), s: rnd(2, 4) | 0 });
  }

  MAP = {
    t, dir, D, traps, zones, shrines, chests, props, decals, TER,
    flow: new Int32Array(N).fill(-1), fver: 0, ptx: -1, pty: -1,
    fog: new Uint8Array(N), fogImg: new ImageData(n, n), fogC: newCanvas(n, n),
    wallTop: makeWallTop(TER), wallFace: makeWallFace(TER),
  };
  MAP.flow = bfs(t, c, c, MAP.flow);
  return MAP;
}

function mkTrap(tx, ty, kind) {
  return { tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, kind, off: Math.random() * TRAP_PERIOD, state: 0, cyc: -1 };
}

// texturas de muro por bioma (se generan una vez por nivel)
function makeWallTop(TER) {
  const c = newCanvas(TILE, TILE), x = c.getContext('2d');
  const px = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy += 4) for (let xx = -r; xx <= r; xx += 4) if (xx * xx + yy * yy <= r * r) x.fillRect(cx + xx - 2, cy + yy - 2, 4, 4); };
  if (TER === TERRAIN.forest) {          // follaje denso
    x.fillStyle = '#10200d'; x.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 9; i++) { const cx = 8 + Math.random() * 64, cy = 8 + Math.random() * 64, r = 12 + Math.random() * 10; px(cx, cy, r, '#1f3c1a'); px(cx - 3, cy - 3, r - 5, '#2d5a26'); px(cx - 6, cy - 6, 4, '#4a8a3c'); }
  } else if (TER === TERRAIN.crypt) {    // bloques de piedra
    x.fillStyle = '#2a2e40'; x.fillRect(0, 0, TILE, TILE);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
      const bx = k * 28 - (r % 2) * 14 + 2, by = r * 20 + 2;
      x.fillStyle = pick(TER.top); x.fillRect(bx, by, 24, 16);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(bx, by, 24, 3);
    }
  } else {                               // basalto con grietas de lava
    x.fillStyle = '#1e100c'; x.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 7; i++) px(8 + Math.random() * 64, 8 + Math.random() * 64, 10 + Math.random() * 8, pick(TER.top));
    x.fillStyle = '#ff5a1a';
    for (let i = 0; i < 3; i++) { let cx = Math.random() * 80, cy = Math.random() * 80; for (let k = 0; k < 6; k++) { x.fillRect(cx, cy, 4, 4); cx += rnd(-4, 8); cy += rnd(-4, 8); } }
  }
  return c;
}
function makeWallFace(TER) {
  const h = 30, c = newCanvas(TILE, h), x = c.getContext('2d');
  x.fillStyle = TER.face[0]; x.fillRect(0, 0, TILE, h);
  x.fillStyle = TER.face[1];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) x.fillRect(col * 16 + (row % 2) * 8, row * 10 + 9, 14, 1);
  for (let i = 0; i < 30; i++) x.fillRect(Math.floor(Math.random() * 20) * 4, Math.floor(Math.random() * 7) * 4, 4, 2);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, h - 6, TILE, 6);
  return c;
}

// ---------------------------------------------------------------- física
function collideWalls(o) {
  const r = o.r, n = MAPN, t = MAP.t;
  const x0 = Math.floor((o.x - r) / TILE), x1 = Math.floor((o.x + r) / TILE);
  const y0 = Math.floor((o.y - r) / TILE), y1 = Math.floor((o.y + r) / TILE);
  let hit = false;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx >= 0 && ty >= 0 && tx < n && ty < n && t[ty * n + tx] !== TW) continue;
    const px = clamp(o.x, tx * TILE, tx * TILE + TILE), py = clamp(o.y, ty * TILE, ty * TILE + TILE);
    const dx = o.x - px, dy = o.y - py, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.y += dy * k; }
    else {
      const ax = o.x - (tx + 0.5) * TILE, ay = o.y - (ty + 0.5) * TILE;
      if (Math.abs(ax) > Math.abs(ay)) o.x = ax > 0 ? (tx + 1) * TILE + r : tx * TILE - r;
      else o.y = ay > 0 ? (ty + 1) * TILE + r : ty * TILE - r;
    }
  }
  return hit;
}

// campo de flujo hacia el jugador (se recalcula al cambiar de baldosa)
function updateFlow() {
  const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE);
  if (tx === MAP.ptx && ty === MAP.pty) return;
  MAP.ptx = tx; MAP.pty = ty;
  bfs(MAP.t, clamp(tx, 0, MAPN - 1), clamp(ty, 0, MAPN - 1), MAP.flow);
  MAP.fver++;
  reveal(tx, ty);
}
// dirección de navegación para un enemigo; devuelve false si debe ir directo
const NAV = [0, 0];
function navDir(e) {
  const n = MAPN, tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
  if (tx < 0 || ty < 0 || tx >= n || ty >= n) return false;
  const i = ty * n + tx, f = MAP.flow, cur = f[i];
  if (cur <= 2) return false;
  if (e.navI !== i || e.navV !== MAP.fver) {
    let best = cur, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const j = y * n + x;
      if (MAP.t[j] === TW || f[j] < 0) continue;
      if (dx && dy && (MAP.t[ty * n + x] === TW || MAP.t[y * n + tx] === TW)) continue;
      if (f[j] < best) { best = f[j]; bx = dx; by = dy; }
    }
    e.navI = i; e.navV = MAP.fver;
    e.gx = (tx + bx + 0.5) * TILE; e.gy = (ty + by + 0.5) * TILE;
    if (!bx && !by) e.gx = null;
  }
  if (e.gx === null) return false;
  const dx = e.gx - e.x, dy = e.gy - e.y, l = Math.hypot(dx, dy) || 1;
  NAV[0] = dx / l; NAV[1] = dy / l;
  return true;
}

// ---------------------------------------------------------------- niebla
function reveal(tx, ty) {
  const n = MAPN, R = 7.5, fog = MAP.fog, d = MAP.fogImg.data, TER = MAP.TER;
  let changed = false;
  for (let y = Math.floor(ty - R); y <= ty + R; y++) for (let x = Math.floor(tx - R); x <= tx + R; x++) {
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const i = y * n + x;
    if (fog[i] || (x - tx) ** 2 + (y - ty) ** 2 > R * R) continue;
    fog[i] = 1; changed = true;
    const tt = MAP.t[i];
    const col = tt === TW ? TER.top[1] : tt === TSLOW ? TER.slow[1] : tt === THURT ? TER.hurt[1] : tt === TICE ? '#bfe8ff' : tt === TSLOPE ? '#7a7a6a' : S.L.ground[0];
    const [r, g, b] = hexRGB(col);
    const lift = tt === TW ? 0.7 : 1.6;
    d[i * 4] = Math.min(255, r * lift); d[i * 4 + 1] = Math.min(255, g * lift); d[i * 4 + 2] = Math.min(255, b * lift); d[i * 4 + 3] = 255;
  }
  if (changed) MAP.fogC.getContext('2d').putImageData(MAP.fogImg, 0, 0);
}

// ---------------------------------------------------------------- lógica por fotograma
function updateWorld(dt) {
  updateFlow();
  // zonas especiales
  P.inZone = null;
  for (const z of MAP.zones) if ((P.x - z.x) ** 2 + (P.y - z.y) ** 2 < z.r * z.r) { P.inZone = z.type; z.seen = true; }
  if (P.inZone === 'sagrada') heal(P.s.maxHp * 0.02 * dt);
  // guardianes de santuario
  for (const sh of MAP.shrines) {
    if (sh.used || !sh.guard) continue;
    if (!sh.g && (P.x - sh.x) ** 2 + (P.y - sh.y) ** 2 < 430 * 430) spawnGuardian(sh);
    else if (sh.g && sh.g.dead) {
      sh.guard = false;
      banner('✔ Santuario liberado', 'Quédate encima para activar ' + SHRINES[sh.type].n, 2, '#5bff8a');
      ring(sh.x, sh.y, 10, 200, 0.5, '#5bff8a', 6);
    }
  }
  // trampas
  const lvlMul = 1 + S.lvlIdx * 0.7;
  for (const tr of MAP.traps) {
    const ph = (S.time + tr.off) % TRAP_PERIOD, cyc = Math.floor((S.time + tr.off) / TRAP_PERIOD);
    tr.state = ph < TRAP_PERIOD - 1.0 ? 0 : ph < TRAP_PERIOD - 0.55 ? 1 : 2;
    if (tr.state !== 2) continue;
    const near = (P.x - tr.x) ** 2 + (P.y - tr.y) ** 2;
    const R = tr.kind === 'vent' ? 46 : 38;
    if (near < (R + P.r) ** 2) {
      hurtPlayer((tr.kind === 'vent' ? 16 : 12) * S.L.dmg, null);
      if (tr.kind === 'frost') P.chillT = 1.2;
    }
    if (tr.cyc !== cyc && near < 1400 * 1400) {    // también daña a los enemigos: ¡atráelos!
      tr.cyc = cyc;
      for (const e of query(tr.x, tr.y, R).slice()) {
        if (e.dead || e.boss || e.def.fly || (e.x - tr.x) ** 2 + (e.y - tr.y) ** 2 > (R + e.r) ** 2) continue;
        hitEnemy(e, 30 * lvlMul, { raw: true, noProc: true, src: 'trampas', col: '#ffb070' });
        if (tr.kind === 'frost' && !e.dead) e.freezeT = 1;
        if (tr.kind === 'vent' && !e.dead) ignite(e);
      }
      if (near < 600 * 600) part(tr.x, tr.y, tr.kind === 'vent' ? '#ff8a2a' : tr.kind === 'frost' ? '#bfefff' : '#d8d0c0', 5, 120, 0.35, 3, tr.kind === 'vent' ? -200 : 0);
    }
  }
}

function spawnGuardian(sh) {
  const heavy = S.L.spawns.map(s => s.e).filter(t => !['imp', 'bat', 'icebat', 'slime'].includes(t));
  const p = randomFloorAround(sh.x, sh.y, 60, 150) || { x: sh.x, y: sh.y + 90 };
  const e = spawnEnemy(pick(heavy.length ? heavy : ['skel']), p.x, p.y, true);
  e.guardian = true; e.maxHp *= 2; e.hp = e.maxHp; e.sc *= 1.15; e.r *= 1.12; e.gT = 2.5;
  sh.g = e;
  banner('🛡 Guardián del santuario', 'Derrótalo para poder activar ' + SHRINES[sh.type].n, 2.2, '#ffb020');
  ring(e.x, e.y, 10, 160, 0.5, '#ffb020', 6);
  AU.sfx('boss');
}
// ataque especial de los guardianes (lo llama updateEnemies)
function guardianTick(e, dt) {
  e.gT -= dt;
  if (e.gT > 0) return;
  e.gT = 3.2;
  const n = 12, off = Math.random() * TAU;
  for (let i = 0; i < n; i++) eShoot(e.x, e.y, off + i / n * TAU, 200, e.dmg * 0.5, '#ffb020', 8);
  ring(e.x, e.y, 10, 90, 0.3, '#ffb020', 4);
  AU.sfx('ebullet');
}

// ---------------------------------------------------------------- render
function drawTerrain(x0, y0, x1, y1) {
  const n = MAPN, TER = MAP.TER, tm = S.time;
  const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(n - 1, Math.floor(x1 / TILE));
  const ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(n - 1, Math.floor(y1 / TILE));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const tt = MAP.t[ty * n + tx]; if (tt === TF || tt === TW) continue;
    const x = tx * TILE, y = ty * TILE;
    if (tt === TSLOW) {
      ctx.fillStyle = rgba(TER.slow[1], 0.55); ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = rgba(TER.slow[1], 0.9);
      for (let k = 0; k < 5; k++) ctx.fillRect(x + ((tx * 37 + k * 23) % 70) + 4, y + ((ty * 53 + k * 31) % 70) + 4, 6, 3);
    } else if (tt === THURT) {
      const a = 0.45 + Math.sin(tm * 3 + tx + ty) * 0.12;
      ctx.fillStyle = rgba(TER.hurt[1], a); ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = rgba('#ffffff', 0.15);
      ctx.fillRect(x + ((tx * 29) % 60) + 6, y + ((ty * 41 + Math.floor(tm * 20)) % 70) + 4, 4, 4);
    } else if (tt === TICE) {
      ctx.fillStyle = 'rgba(190,232,255,0.45)'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 10 + (tx * 13) % 30, y + 14, 22, 3); ctx.fillRect(x + 30, y + 50 + (ty * 7) % 16, 30, 3);
    } else if (tt === TSLOPE) {
      const a = MAP.dir[ty * n + tx];
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y, TILE, TILE);
      ctx.save(); ctx.translate(x + TILE / 2, y + TILE / 2); ctx.rotate(a);
      const o = (tm * 40) % 26;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 4;
      for (let k = -1; k <= 1; k++) { const p = k * 26 + o - 13; ctx.beginPath(); ctx.moveTo(p - 8, -14); ctx.lineTo(p + 4, 0); ctx.lineTo(p - 8, 14); ctx.stroke(); }
      ctx.restore();
    }
  }
}
function pushWalls(list, x0, y0, x1, y1) {
  const n = MAPN;
  const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(n - 1, Math.floor(x1 / TILE));
  const ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(n - 1, Math.floor((y1 + 40) / TILE));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
    if (MAP.t[ty * n + tx] === TW) list.push({ kind: 'wall', tx, ty, y: (ty + 1) * TILE - 1 });
}
const WALLH = 30;
function drawWall(o) {
  const n = MAPN, x = o.tx * TILE, y = o.ty * TILE, t = MAP.t;
  const below = o.ty + 1 >= n || t[(o.ty + 1) * n + o.tx] === TW;
  ctx.drawImage(MAP.wallTop, x, y - WALLH);
  if (!below) ctx.drawImage(MAP.wallFace, x, y + TILE - WALLH);
  // bordes del techo donde no hay muro vecino
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  if (o.ty > 0 && t[(o.ty - 1) * n + o.tx] !== TW) ctx.fillRect(x, y - WALLH, TILE, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  if (o.tx > 0 && t[o.ty * n + o.tx - 1] !== TW) ctx.fillRect(x, y - WALLH, 4, TILE);
  if (o.tx < n - 1 && t[o.ty * n + o.tx + 1] !== TW) ctx.fillRect(x + TILE - 4, y - WALLH, 4, TILE);
}
function drawTrapsZones(vis) {
  for (const z of MAP.zones) {
    if (!vis(z.x, z.y, z.r)) continue;
    const Z = ZONES[z.type];
    ctx.fillStyle = rgba(Z.c, 0.07 + Math.sin(S.time * 2) * 0.02);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
    ctx.setLineDash([14, 10]); ctx.strokeStyle = rgba(Z.c, 0.45); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, S.time * 0.1, S.time * 0.1 + TAU); ctx.stroke(); ctx.setLineDash([]);
    if (mode === 'play' && Math.random() < 0.3) part(z.x + rnd(-z.r, z.r) * 0.7, z.y + rnd(-z.r, z.r) * 0.7, Z.c, 1, 10, 1.2, 3, -30);
  }
  for (const tr of MAP.traps) {
    if (!vis(tr.x, tr.y, 50)) continue;
    const x = tr.x, y = tr.y;
    ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 26, y - 26, 52, 52);
    ctx.fillStyle = tr.state === 1 ? '#6a2020' : '#3a3346'; ctx.fillRect(x - 23, y - 23, 46, 46);
    ctx.fillStyle = '#120c18';
    for (let k = 0; k < 9; k++) ctx.fillRect(x - 17 + (k % 3) * 14, y - 17 + Math.floor(k / 3) * 14, 6, 6);
    if (tr.state === 1) { ctx.drawImage(glowSpr('#ff3a2a'), x - 30, y - 30, 60, 60); }
    if (tr.state === 2) {
      if (tr.kind === 'spikes') {
        ctx.fillStyle = '#e8e0d0';
        for (let k = 0; k < 9; k++) { const sx = x - 14 + (k % 3) * 14, sy = y - 14 + Math.floor(k / 3) * 14; ctx.beginPath(); ctx.moveTo(sx - 5, sy + 4); ctx.lineTo(sx, sy - 14); ctx.lineTo(sx + 5, sy + 4); ctx.fill(); }
      } else if (tr.kind === 'vent') {
        ctx.drawImage(glowSpr('#ff8a2a'), x - 46, y - 90, 92, 110);
        ctx.fillStyle = 'rgba(255,220,120,0.8)'; ctx.fillRect(x - 8, y - 60, 16, 60);
      } else {
        ctx.drawImage(glowSpr('#8ff3ff'), x - 44, y - 44, 88, 88);
        ctx.strokeStyle = '#e0ffff'; ctx.lineWidth = 3;
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); ctx.stroke(); }
      }
    }
  }
}
function drawFog(x0, y0, x1, y1) {
  const n = MAPN, fog = MAP.fog;
  const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(n - 1, Math.floor(x1 / TILE));
  const ty0 = Math.max(0, Math.floor((y0 - 40) / TILE)), ty1 = Math.min(n - 1, Math.floor((y1 + 40) / TILE));
  ctx.fillStyle = MAP.TER.fogc;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (fog[ty * n + tx]) continue;
    ctx.fillRect(tx * TILE - 1, ty * TILE - WALLH - 1, TILE + 2, TILE + 2);
  }
}
// texto de ayuda sobre el terreno que pisa el jugador
function terrainHint() {
  if (!MAP) return null;
  const tt = tileAt(P.x, P.y), TER = MAP.TER;
  if (P.inZone) return [ZONES[P.inZone].n + ': ' + ZONES[P.inZone].d, ZONES[P.inZone].c];
  if (tt === TSLOW) return [TER.slow[0] + ': -45% velocidad', '#d8d0b0'];
  if (tt === THURT) return [TER.hurt[0] + ': daño continuo (también a enemigos)', TER.hurt[1]];
  if (tt === TICE) return [TER.ice + ': cuesta frenar', '#bfe8ff'];
  if (tt === TSLOPE) return [TER.slope + ': te empuja cuesta abajo', '#ddd'];
  if (P.chillT > 0) return ['Congelado: -50% velocidad', '#8ff3ff'];
  return null;
}
