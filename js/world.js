'use strict';
// =====================================================================
//  MUNDO PROCEDURAL — cuevas por autómata celular + plazas y túneles,
//  terreno especial (lento, dañino, pendientes, hielo), trampas,
//  zonas especiales, santuarios con guardián, cofres escondidos,
//  niebla de guerra y campo de flujo (BFS) para que los enemigos
//  rodeen los muros. Cada baldosa tiene su bioma, así el modo de
//  Hordas Infinitas mezcla bosque, cripta y forja en un solo mapa.
// =====================================================================

const TILE = 80;
let MAPN = 64;                                  // baldosas por lado (WORLD = TILE * MAPN)
const TF = 0, TW = 1, TSLOW = 2, THURT = 3, TSLOPE = 4, TICE = 5;
const TRAP_PERIOD = 2.8;
const BIOME_KEYS = ['forest', 'crypt', 'forge'];   // mismo orden que LEVELS

const TERRAIN = {
  forest: { top: ['#2c4a26', '#365c2e', '#24401f', '#41693a'], face: ['#1a2a17', '#13200f'], rim: '#5a9a4a', slow: ['Pantano', '#2a3a1c'], hurt: ['Zarzas venenosas', '#8a3a9a', 9], slope: 'Ladera', ice: null, trap: 'spikes', fogc: '#05090a' },
  crypt:  { top: ['#4a5068', '#555c78', '#3e4359', '#626a88'], face: ['#23263a', '#1a1c2b'], rim: '#8a92b8', slow: ['Nieve profunda', '#b8c8e8'], hurt: ['Runas malditas', '#6a3aff', 11], slope: 'Escalinata', ice: 'Hielo resbaladizo', trap: 'frost', fogc: '#04050c' },
  forge:  { top: ['#4a2a22', '#5a3326', '#3a201a', '#6a3a2a'], face: ['#24120e', '#1a0c09'], rim: '#a0583a', slow: ['Ceniza', '#6a5a52'], hurt: ['Lava', '#ff5a1a', 18], slope: 'Pendiente de escoria', ice: null, trap: 'vent', fogc: '#0a0403' },
};
const ZONES = {
  sagrada: { n: 'Arboleda Sagrada', c: '#5bff8a', d: 'Regeneras 2% de vida por segundo' },
  maldita: { n: 'Zona Maldita', c: '#b066ff', d: '+35% exp y +60% almas, pero recibes +30% daño' },
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
function bioAt(x, y) { const i = tIdx(x, y); return i < 0 ? 0 : MAP.bio[i]; }
function terAt(x, y) { return TERRAIN[BIOME_KEYS[bioAt(x, y)]]; }
const hash2 = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

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
// BFS con alturas: dos baldosas vecinas se conectan si sus niveles coinciden (una rampa
// abarca su nivel y el siguiente). `closed` bloquea las salas secretas aún sin descubrir.
function bfsH(t, h, rp, closed, sx, sy, out) {
  const n = MAPN; out.fill(-1);
  const q = new Int32Array(n * n); let hd = 0, e = 0;
  const s = sy * n + sx; if (t[s] === TW) return out;
  out[s] = 0; q[e++] = s;
  const go = (j, d, lo, hi) => {
    if (t[j] === TW || out[j] >= 0 || (closed && closed[j])) return;
    const jl = h[j]; if (jl > hi || jl + (rp[j] ? 1 : 0) < lo) return;
    out[j] = d; q[e++] = j;
  };
  while (hd < e) {
    const i = q[hd++], x = i % n, y = (i / n) | 0, d = out[i] + 1, lo = h[i], hi = lo + (rp[i] ? 1 : 0);
    if (x > 0) go(i - 1, d, lo, hi);
    if (x < n - 1) go(i + 1, d, lo, hi);
    if (y > 0) go(i - n, d, lo, hi);
    if (y < n - 1) go(i + n, d, lo, hi);
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
// endless = true → mapa de 110×110 (unas 3 veces el área) con los 3 biomas mezclados
function genMap(L, endless) {
  const n = MAPN = endless ? 110 : 64;
  WORLD = n * TILE;
  const N = n * n, c = n >> 1, A = N / (64 * 64);
  let t;
  const carve = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1) t[y * n + x] = TF; };
  const tunnel = (x0, y0, x1, y1) => {           // túnel serpenteante de 2 baldosas
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 600) {
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
    // quitar muros sueltos de 1 baldosa (se veían raros)
    for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
      const i = y * n + x; if (t[i] !== TW) continue;
      const nb = (t[i - 1] === TW) + (t[i + 1] === TW) + (t[i - n] === TW) + (t[i + n] === TW);
      if (nb <= 1) t[i] = TF;
    }
    carve(c, c, 6);
    const plazas = Math.round(8 * A);
    for (let k = 0; k < plazas; k++) {
      const px = 8 + Math.floor(Math.random() * (n - 16)), py = 8 + Math.floor(Math.random() * (n - 16));
      carve(px, py, 3 + Math.floor(Math.random() * 3));
      tunnel(px, py, c, c);
    }
    const d = bfs(t, c, c, new Int32Array(N));
    let floor = 0;
    for (let i = 0; i < N; i++) { if (t[i] !== TW && d[i] < 0) t[i] = TW; if (t[i] !== TW) floor++; }
    if (floor / N > 0.42) break;
  }

  // bioma por baldosa: uniforme en campaña, regiones de Voronoi en modo infinito
  const bio = new Uint8Array(N);
  if (!endless) bio.fill(Math.max(0, BIOME_KEYS.indexOf(L.biome)));
  else {
    const seeds = [{ x: c, y: c, b: 0 }];
    const order = [1, 2, 0, 1, 2, 1, 2, 0, 1, 2];
    for (const b of order) {
      for (let s = 0; s < 30; s++) {
        const x = 6 + Math.random() * (n - 12), y = 6 + Math.random() * (n - 12);
        if (seeds.every(q => Math.hypot(q.x - x, q.y - y) > n / 5)) { seeds.push({ x, y, b }); break; }
      }
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const jx = x + Math.sin(y * 0.35) * 2.2, jy = y + Math.cos(x * 0.3) * 2.2;   // bordes orgánicos
      let best = 1e9, b = 0;
      for (const q of seeds) { const d2 = (q.x - jx) ** 2 + (q.y - jy) ** 2; if (d2 < best) { best = d2; b = q.b; } }
      bio[y * n + x] = b;
    }
  }
  const TERi = i => TERRAIN[BIOME_KEYS[bio[i]]];

  const dir = new Float32Array(N);
  const D = bfs(t, c, c, new Int32Array(N));
  const floorTiles = []; for (let i = 0; i < N; i++) if (t[i] === TF) floorTiles.push(i);
  const rndFloor = m => { for (let k = 0; k < 60; k++) { const i = pick(floorTiles); if (t[i] === TF && D[i] >= m) return i; } return pick(floorTiles); };

  // terreno especial en manchas
  const blob = (type, count, rmin, rmax, onlyBio) => {
    for (let k = 0; k < count; k++) {
      const i = rndFloor(9), cx = i % n, cy = (i / n) | 0, r = rmin + Math.random() * (rmax - rmin), a = Math.random() * TAU;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const j = y * n + x, dd = Math.hypot(x - cx, y - cy);
        if (onlyBio !== undefined && bio[j] !== onlyBio) continue;
        if (t[j] === TF && dd <= r && (dd < r - 1 || Math.random() < 0.6) && D[j] >= 7) { t[j] = type; dir[j] = a; }
      }
    }
  };
  blob(TSLOW, Math.round(10 * A), 2, 4.5);
  blob(THURT, Math.round(7 * A), 1, 2.5);
  blob(TSLOPE, Math.round(7 * A), 2, 3.5);
  if (endless) blob(TICE, Math.round(7 * A), 3, 5, 1);
  else if (TERRAIN[L.biome].ice) blob(TICE, 7, 3, 5);

  // santuarios: muestreo del punto más lejano entre sí y del inicio
  const nShr = endless ? 12 : 5;
  const types = []; while (types.length < nShr) types.push(...Object.keys(SHRINES).sort(() => Math.random() - 0.5));
  const sIdx = [];
  for (let k = 0; k < nShr; k++) {
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
    const type = types[k];
    shrines.push({ type, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, prog: 0, used: false, guard: type !== 'maldito', g: null });
    const ring = [];
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
      const dd = Math.hypot(x - tx, y - ty);
      if (dd >= 2 && dd <= 3.2 && x > 1 && y > 1 && x < n - 2 && y < n - 2 && t[y * n + x] === TF) ring.push([x, y]);
    }
    ring.sort(() => Math.random() - 0.5).slice(0, 9).forEach(([x, y]) => traps.push(mkTrap(x, y, TERi(y * n + x).trap)));
  });
  for (let k = 0; k < Math.round(14 * A); k++) {
    const i = rndFloor(7), cx = i % n, cy = (i / n) | 0;
    const m = 2 + Math.floor(Math.random() * 4);
    for (let q = 0; q < m; q++) {
      const x = cx + Math.floor(rnd(-2, 3)), y = cy + Math.floor(rnd(-2, 3));
      if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && t[y * n + x] === TF && !traps.some(tr => tr.tx === x && tr.ty === y)) traps.push(mkTrap(x, y, TERi(y * n + x).trap));
    }
  }
  // zonas especiales
  const zones = [];
  const nZ = endless ? 10 : 4;
  for (let z = 0; z < nZ; z++) {
    const type = z % 2 ? 'maldita' : 'sagrada';
    for (let s = 0; s < 40; s++) {
      const i = rndFloor(10), x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE;
      if (shrines.some(sh => Math.hypot(sh.x - x, sh.y - y) < 7 * TILE) || zones.some(q => Math.hypot(q.x - x, q.y - y) < 10 * TILE)) continue;
      zones.push({ type, x, y, r: rnd(3.5, 5) * TILE });
      break;
    }
  }
  // puzles: runas de memoria y braseros, lejos de santuarios
  const puzzles = [], nPz = endless ? 6 : 2;
  for (let k = 0; k < nPz; k++) {
    let best = -1, bs = -1;
    for (let s = 0; s < 200; s++) {
      const i = pick(floorTiles); if (D[i] < 10) continue;
      const x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE;
      let md = 1e9;
      for (const sh of shrines) md = Math.min(md, Math.hypot(sh.x - x, sh.y - y));
      for (const pz of puzzles) md = Math.min(md, Math.hypot(pz.x - x, pz.y - y));
      if (md < 8 * TILE) continue;
      const score = Math.min(md, 25 * TILE) + Math.random() * TILE * 4;
      if (score > bs) { bs = score; best = i; }
    }
    if (best < 0) continue;
    const tx = best % n, ty = (best / n) | 0;
    for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) if (x > 1 && y > 1 && x < n - 2 && y < n - 2 && (x - tx) ** 2 + (y - ty) ** 2 <= 10) t[y * n + x] = TF;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    if (k % 2 === 0) {
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      const offs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
      puzzles.push({ type: 'runas', x: cx, y: cy, order, step: 0, solved: false, cool: 0,
        plates: offs.map(([ox, oy], j) => ({ x: cx + ox * TILE, y: cy + oy * TILE, sym: j, lit: false, on: false })) });
    } else {
      const braz = [];
      for (let q = 0; q < 4; q++) {
        for (let s = 0; s < 40; s++) {
          const a = q / 4 * TAU + rnd(-0.4, 0.4), r = rnd(4, 7);
          const bx = Math.round(tx + Math.cos(a) * r), by = Math.round(ty + Math.sin(a) * r);
          if (bx < 2 || by < 2 || bx >= n - 2 || by >= n - 2 || t[by * n + bx] === TW || D[by * n + bx] < 0) continue;
          t[by * n + bx] = TF;
          braz.push({ x: (bx + 0.5) * TILE, y: (by + 0.5) * TILE, t: 0 });
          break;
        }
      }
      if (braz.length === 4) puzzles.push({ type: 'braseros', x: cx, y: cy, braz, solved: false });
    }
  }
  for (let q = traps.length - 1; q >= 0; q--) if (puzzles.some(pz => Math.hypot(pz.x - traps[q].x, pz.y - traps[q].y) < 3.5 * TILE)) traps.splice(q, 1);
  // cofres escondidos en callejones sin salida
  const chests = [], nCh = endless ? 8 : 3;
  const deadEnds = floorTiles.filter(i => {
    if (t[i] !== TF || D[i] < 10) return false;
    const x = i % n, y = (i / n) | 0; let w = 0;
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (t[(y + yy) * n + x + xx] === TW) w++;
    return w >= 5;
  }).sort(() => Math.random() - 0.5);
  for (const i of deadEnds) {
    if (chests.length >= nCh) break;
    const x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE;
    if (chests.some(ch => Math.hypot(ch.x - x, ch.y - y) < 15 * TILE)) continue;
    chests.push({ k: 'chest', x, y, tier: 1, hidden: true });
  }
  // decoración sólida según el bioma de cada baldosa
  const props = [];
  for (let k = 0; k < Math.round(320 * A); k++) {
    const i = pick(floorTiles); if (t[i] !== TF || D[i] < 5) continue;
    const x = (i % n + rnd(0.2, 0.8)) * TILE, y = (((i / n) | 0) + rnd(0.2, 0.8)) * TILE;
    if (shrines.some(sh => Math.hypot(sh.x - x, sh.y - y) < 3.2 * TILE) || chests.some(ch => Math.hypot(ch.x - x, ch.y - y) < TILE)) continue;
    if (puzzles.some(pz => Math.hypot(pz.x - x, pz.y - y) < 3.5 * TILE)) continue;
    if (traps.some(tr => Math.hypot(tr.x - x, tr.y - y) < TILE * 0.8)) continue;
    const [type] = wpick(LEVELS[bio[i]].props, p => p[1]);
    const sc = { tree: 5, rock: 4, mush: 3.5, tomb: 4, pillar: 4.5, crystal: 4.5, spike: 5 }[type] * rnd(0.85, 1.15);
    const r = { tree: 16, rock: 20, mush: 10, tomb: 14, pillar: 16, crystal: 13, spike: 18 }[type] * sc / 4.5;
    if (props.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + r + 30) ** 2)) continue;
    props.push({ kind: 'prop', type, x, y, r, sc, spr: getSpr(type), solid: true });
  }
  const decals = [];
  for (let k = 0; k < Math.round(2200 * A); k++) {
    const i = pick(floorTiles), b = bio[i], kk = Math.floor(Math.random() * 3);
    decals.push({ x: (i % n + Math.random()) * TILE, y: (((i / n) | 0) + Math.random()) * TILE, col: pick(LEVELS[b].decal), k: kk, s: rnd(2, 4) | 0, lava: b === 2 && kk === 2 });
  }

  // salas secretas talladas en la roca y alturas (mesetas, cumbres, criptas hundidas)
  const sec = new Uint8Array(N);
  const secRooms = genSecrets(t, n, D, floorTiles, sec, chests, decals, endless);
  const HG = genHeights(t, n, bio, D, secRooms, shrines, puzzles, chests, endless, c);
  // en las rampas no hay trampas ni decoración que estorbe el paso
  const nearRamp = (x, y, r) => {
    for (let ty = Math.floor((y - r) / TILE) - 1; ty <= Math.floor((y + r) / TILE) + 1; ty++) for (let tx = Math.floor((x - r) / TILE) - 1; tx <= Math.floor((x + r) / TILE) + 1; tx++) {
      if (tx < 0 || ty < 0 || tx >= n || ty >= n || !HG.ramp[ty * n + tx]) continue;
      if (Math.abs(x - clamp(x, tx * TILE, tx * TILE + TILE)) < r + 30 && Math.abs(y - clamp(y, ty * TILE, ty * TILE + TILE)) < r + 30) return true;
    }
    return false;
  };
  for (let q = traps.length - 1; q >= 0; q--) if (HG.ramp[traps[q].ty * n + traps[q].tx]) traps.splice(q, 1);
  for (let q = props.length - 1; q >= 0; q--) if (nearRamp(props[q].x, props[q].y, props[q].r)) props.splice(q, 1);
  for (const f of HG.feats) if (f.type !== 'meseta') for (let q = props.length - 1; q >= 0; q--) if (Math.hypot(props[q].x - f.x, props[q].y - f.y) < 130) props.splice(q, 1);

  MAP = {
    n, t, bio, dir, D, traps, zones, shrines, chests, props, decals, endless, puzzles,
    h: HG.h, ramp: HG.ramp, feats: HG.feats, sec, secRooms, secClosed: sec.map(v => (v ? 1 : 0)),
    flow: new Int32Array(N).fill(-1), fver: 0, ptx: -1, pty: -1,
    fog: new Uint8Array(N), fogImg: new ImageData(n, n), fogC: newCanvas(n, n),
  };
  MAP.flow = bfsH(t, MAP.h, MAP.ramp, MAP.secClosed, c, c, MAP.flow);
  return MAP;
}

function mkTrap(tx, ty, kind) {
  return { tx, ty, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, kind, off: Math.random() * TRAP_PERIOD, state: 0, cyc: -1 };
}

// ---------------------------------------------------------------- salas secretas
// Se tallan dentro de macizos de muro, con una sola entrada de 1 baldosa. Hasta que el jugador
// la cruza se dibujan como muro (los enemigos no pueden entrar); la entrada se ve agrietada y
// con escombros delante: no está señalada, pero un ojo atento la distingue.
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N, E, S, O
function genSecrets(t, n, D, floorTiles, sec, chests, decals, endless) {
  const rooms = [], want = endless ? 5 : 2;
  const isW = (x, y) => x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || t[y * n + x] === TW;
  // todas las combinaciones válidas (suelo → entrada de 1 baldosa → sala rodeada de roca); luego se eligen al azar
  const cands = [];
  for (const fi of floorTiles) {
    if (t[fi] === TW || D[fi] < 9) continue;
    const fx = fi % n, fy = (fi / n) | 0;
    for (let dk = 0; dk < 4; dk++) {
      const [dx, dy] = DIRS4[dk], ex = fx + dx, ey = fy + dy;
      if (!isW(ex, ey) || !isW(ex - dy, ey + dx) || !isW(ex + dy, ey - dx)) continue;
      for (const [rw, rh] of [[4, 3], [3, 4], [3, 3], [3, 2], [2, 3]]) {
        const rx0 = dk === 1 ? ex + 1 : dk === 3 ? ex - rw : ex - (rw >> 1);
        const ry0 = dk === 0 ? ey - rh : dk === 2 ? ey + 1 : ey - (rh >> 1);
        if (rx0 < 3 || ry0 < 3 || rx0 + rw > n - 3 || ry0 + rh > n - 3) continue;
        let ok = true;
        for (let y = ry0 - 1; ok && y <= ry0 + rh; y++) for (let x = rx0 - 1; x <= rx0 + rw; x++) if (!isW(x, y)) { ok = false; break; }
        if (ok) { cands.push({ fx, fy, ex, ey, dx, dy, dk, rw, rh, rx0, ry0, w: (dk === 0 ? 3 : 1) * rw * rh }); break; }
      }
    }
  }
  while (rooms.length < want && cands.length) {
    let tot = 0; for (const q of cands) tot += q.w;
    let r = Math.random() * tot, qi = 0;
    while (r > cands[qi].w && qi < cands.length - 1) { r -= cands[qi].w; qi++; }
    const { fx, fy, ex, ey, dx, dy, dk, rw, rh, rx0, ry0 } = cands.splice(qi, 1)[0];
    let ok = true;
    for (let y = ry0 - 1; ok && y <= ry0 + rh; y++) for (let x = rx0 - 1; x <= rx0 + rw; x++) if (!isW(x, y) || sec[y * n + x]) { ok = false; break; }
    if (!ok || rooms.some(R => Math.hypot(R.cx - (rx0 + rw / 2), R.cy - (ry0 + rh / 2)) < 12)) continue;
    const id = rooms.length + 1, tiles = [], ei = ey * n + ex;
    for (let y = ry0; y < ry0 + rh; y++) for (let x = rx0; x < rx0 + rw; x++) { const j = y * n + x; t[j] = TF; sec[j] = id; tiles.push(j); }
    t[ei] = TF; sec[ei] = id; tiles.push(ei);
    const R = { id, tiles, ei, ex, ey, fx, fy, dk, cx: rx0 + rw / 2, cy: ry0 + rh / 2, found: false };
    rooms.push(R);
    chests.push({ k: 'chest', x: R.cx * TILE, y: R.cy * TILE, tier: 2, hidden: true, secret: id });
    // escombros delante de la entrada y huesos/monedas dentro
    for (let k = 0; k < 6; k++) decals.push({ x: (fx + 0.5 + dx * 0.35 + rnd(-0.35, 0.35)) * TILE, y: (fy + 0.5 + dy * 0.35 + rnd(-0.3, 0.3)) * TILE, col: pick(['#6a6a72', '#4a4a52', '#8a8478', '#5a544c']), k: 1, s: 3 + ((Math.random() * 2) | 0) });
    for (let k = 0; k < 10; k++) decals.push({ x: (rx0 + Math.random() * rw) * TILE, y: (ry0 + Math.random() * rh) * TILE, col: pick(['#d8d0c0', '#ffd43b', '#b8b0a0']), k: (Math.random() * 2) | 0, s: 2 + ((Math.random() * 2) | 0) });
  }
  return rooms;
}
function discoverSecret(R) {
  if (R.found) return;
  R.found = true;
  for (const j of R.tiles) { MAP.secClosed[j] = 0; if (MAP.fog[j]) fogPaint(j); }
  MAP.fogC.getContext('2d').putImageData(MAP.fogImg, 0, 0);
  MAP.ptx = -1;                                   // recalcula el campo de flujo
  S.secrets = (S.secrets || 0) + 1;
  banner('🗝 ¡Sala secreta!', 'Has encontrado un pasadizo oculto', 2.4, '#ffd43b');
  ring(R.cx * TILE, R.cy * TILE, 10, 220, 0.6, '#ffd43b', 6);
  part(R.ex * TILE + TILE / 2, R.ey * TILE + TILE / 2, '#8a8478', 18, 200, 0.6, 4);
  AU.sfx('chest');
}

// ---------------------------------------------------------------- alturas
// Nivel 1 = suelo base. Bosque y forja tienen mesetas (2) y a veces cumbres (3); la cripta tiene
// criptas hundidas (0). Las rampas (MAP.ramp = 1 + dirección hacia arriba) unen un nivel con el
// siguiente. Al final se garantiza que todo el suelo sea alcanzable (añadiendo rampas o aplanando).
function genHeights(t, n, bio, D, secRooms, shrines, puzzles, chests, endless, c) {
  const N = n * n, h = new Uint8Array(N).fill(1), ramp = new Uint8Array(N), forbid = new Uint8Array(N), feats = [];
  const A = N / 4096, tI = v => Math.floor(v / TILE), floor = j => t[j] !== TW;
  const mark = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < n && y < n && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1) forbid[y * n + x] = 1; };
  mark(c, c, 7);
  for (const sh of shrines) mark(tI(sh.x), tI(sh.y), 4);
  for (const pz of puzzles) { mark(tI(pz.x), tI(pz.y), 4); if (pz.braz) for (const b of pz.braz) mark(tI(b.x), tI(b.y), 2); }
  for (const ch of chests) mark(tI(ch.x), tI(ch.y), 1);
  for (const R of secRooms) { mark(R.fx, R.fy, 2); for (const j of R.tiles) forbid[j] = 1; }
  const nb4 = (j, f) => { const x = j % n; if (j >= n) f(j - n, 0); if (x < n - 1) f(j + 1, 1); if (j < N - n) f(j + n, 2); if (x > 0) f(j - 1, 3); };
  const floors = []; for (let j = 0; j < N; j++) if (floor(j)) floors.push(j);
  const farFromFeats = (x, y, d) => feats.every(f => Math.hypot(f.tx - x, f.ty - y) >= d);

  // meseta irregular de nivel lv sobre baldosas de nivel lv-1
  const raise = (cx, cy, rad, lv, ok) => {
    const k = 2 + ((Math.random() * 3) | 0), ph = Math.random() * TAU, R = Math.ceil(rad * 1.3) + 1;
    let out = [];
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2) continue;
      const j = y * n + x;
      if (!floor(j) || forbid[j] || h[j] !== lv - 1 || !ok(j)) continue;
      const rr = rad * (1 + 0.28 * Math.sin(Math.atan2(y - cy, x - cx) * k + ph));
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rr * rr) { h[j] = lv; out.push(j); }
    }
    for (let pass = 0; pass < 3; pass++) out = out.filter(j => {   // fuera salientes de una baldosa
      let s = 0; nb4(j, i => { if (!floor(i) || h[i] >= lv) s++; });
      if (s <= 1) { h[j] = lv - 1; return false; }
      return true;
    });
    return out;
  };
  const centroid = tiles => {
    let sx = 0, sy = 0; for (const j of tiles) { sx += j % n; sy += (j / n) | 0; }
    sx /= tiles.length; sy /= tiles.length;
    let best = tiles[0], bd = 1e9;
    for (const j of tiles) { const d = (j % n - sx) ** 2 + (((j / n) | 0) - sy) ** 2; if (d < bd) { bd = d; best = j; } }
    return best;
  };

  // mesetas y cumbres (bosque y forja)
  const nPl = endless ? Math.round(4.5 * A) : bio[c * n + c] === 0 ? 6 : bio[c * n + c] === 2 ? 5 : 0;
  for (let k = 0, tries = 0; k < nPl && tries < 400; tries++) {
    const j = pick(floors), cx = j % n, cy = (j / n) | 0;
    if (bio[j] === 1 || D[j] < 10 || forbid[j] || h[j] !== 1 || !farFromFeats(cx, cy, 9)) continue;
    const b = bio[j];
    const out = raise(cx, cy, 2.6 + Math.random() * 2.4, 2, i => bio[i] === b);
    if (out.length < 10) { for (const i of out) h[i] = 1; continue; }
    k++;
    const f = { type: 'meseta', lv: 2, tiles: out, tx: cx, ty: cy };
    if (out.length >= 22 && (k === 1 || Math.random() < (b === 0 ? 0.5 : 0.35))) {
      const inner = new Set(out.filter(i => { let ok = true; nb4(i, q => { if (floor(q) && h[q] < 2) ok = false; }); return ok; }));
      if (inner.size >= 5) {
        const m = centroid([...inner]);
        const top = raise(m % n, (m / n) | 0, 1.6 + Math.random() * 0.9, 3, i => inner.has(i));
        if (top.length >= 4) {
          const tc = centroid(top);
          Object.assign(f, { type: 'cima', lv: 3, top, x: (tc % n + 0.5) * TILE, y: (((tc / n) | 0) + 0.5) * TILE });
          chests.push({ k: 'chest', x: f.x, y: f.y + 10, tier: 2, summit: true });
        } else for (const i of top) h[i] = 2;
      }
    }
    if (!f.x) { const m = centroid(out); f.x = (m % n + 0.5) * TILE; f.y = (((m / n) | 0) + 0.5) * TILE; }
    feats.push(f);
  }
  // criptas hundidas (cripta): salas rectangulares un nivel por debajo
  const nPit = endless ? Math.round(2 * A) : bio[c * n + c] === 1 ? 3 : 0;
  for (let k = 0, tries = 0; k < nPit && tries < 600; tries++) {
    const j = pick(floors), cx = j % n, cy = (j / n) | 0;
    if (bio[j] !== 1 || D[j] < 10 || !farFromFeats(cx, cy, 10)) continue;
    const rw = 5 + ((Math.random() * 3) | 0), rh = 4 + ((Math.random() * 2) | 0), x0 = cx - (rw >> 1), y0 = cy - (rh >> 1);
    if (x0 < 3 || y0 < 3 || x0 + rw > n - 3 || y0 + rh > n - 3) continue;
    const tiles = [];
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) {
      const i = y * n + x;
      if (!floor(i) || forbid[i] || h[i] !== 1 || bio[i] !== 1) { tiles.length = 0; y = 1e9; break; }
      tiles.push(i);
    }
    if (!tiles.length) continue;
    for (const i of tiles) { h[i] = 0; if (t[i] === TSLOPE) t[i] = TF; }
    k++;
    feats.push({ type: 'cripta', lv: 0, tiles, tx: cx, ty: cy, x0, y0, w: rw, h: rh, x: (x0 + rw / 2) * TILE, y: (y0 + rh / 2) * TILE, trig: false, done: false });
  }

  // rampas: la baldosa baja q mira (dirección d) a la alta; mejor si detrás de q hay suelo del mismo nivel
  const rampScore = (q, d) => {
    if (ramp[q] || !floor(q)) return -1;
    const [dx, dy] = DIRS4[d], qx = q % n, qy = (q / n) | 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n) ? -1 : y * n + x;
    const b = at(qx - dx, qy - dy), s1 = at(qx - dy, qy + dx), s2 = at(qx + dy, qy - dx);
    let sc = Math.random();
    if (b >= 0 && floor(b) && h[b] === h[q] && !ramp[b]) sc += 4;
    for (const s of [s1, s2]) if (s >= 0 && floor(s)) sc += h[s] === h[q] ? 1.5 : 0.5;
    if (forbid[q]) sc -= 1;
    return sc;
  };
  const putRamp = (q, d) => {
    ramp[q] = d + 1; if (t[q] !== TF) t[q] = TF;
    const [dx, dy] = DIRS4[d], qx = q % n, qy = (q / n) | 0;
    for (const sgn of [1, -1]) {                     // rampa de 2 baldosas de ancho si cabe
      const sx = qx - dy * sgn, sy = qy + dx * sgn, s = sy * n + sx, p = (sy + dy) * n + sx + dx;
      if (sx < 1 || sy < 1 || sx >= n - 1 || sy >= n - 1 || !floor(s) || !floor(p) || ramp[s] || h[s] !== h[q] || h[p] !== h[q] + 1) continue;
      if (Math.random() < 0.75) { ramp[s] = d + 1; if (t[s] !== TF) t[s] = TF; }
      break;
    }
  };
  // candidatas entre dos conjuntos (unreached → reached)
  const reach = new Int32Array(N);
  for (let it = 0; it < 200; it++) {
    bfsH(t, h, ramp, null, c, c, reach);
    let best = -1, bq = -1, bd = 0, any = false;
    for (const j of floors) {
      if (reach[j] >= 0) continue;
      any = true;
      nb4(j, (i, d) => {
        if (!floor(i) || reach[i] < 0) return;
        let q, dd;
        if (h[i] - h[j] === 1) { q = j; dd = d; } else if (h[j] - h[i] === 1) { q = i; dd = (d + 2) % 4; } else return;
        const sc = rampScore(q, dd);
        if (sc > best) { best = sc; bq = q; bd = dd; }
      });
    }
    if (!any) break;
    if (bq >= 0) { putRamp(bq, bd); continue; }
    for (const j of floors) if (reach[j] < 0) { h[j] = 1; ramp[j] = 0; }   // sin arreglo posible: se aplana
  }
  // segunda rampa en las mesetas y criptas grandes (más rutas = más estrategia)
  for (const f of feats) {
    if (f.tiles.length < 16 || Math.random() < 0.25) continue;
    const mine = new Set(f.tiles), cand = [];
    let rs = [];
    for (const j of f.tiles) nb4(j, (i, d) => {
      if (ramp[i] || ramp[j]) rs.push(j);
      if (!floor(i) || mine.has(i) || h[i] === h[j]) return;
      const q = h[i] < h[j] ? i : j, dd = h[i] < h[j] ? (d + 2) % 4 : d;
      if (Math.abs(h[i] - h[j]) === 1) cand.push([q, dd]);
    });
    let best = -1, pickC = null;
    for (const [q, d] of cand) {
      const qx = q % n, qy = (q / n) | 0;
      if (rs.some(r => Math.hypot(r % n - qx, ((r / n) | 0) - qy) < 5)) continue;
      const sc = rampScore(q, d); if (sc > best) { best = sc; pickC = [q, d]; }
    }
    if (pickC && best > 3) putRamp(pickC[0], pickC[1]);
  }
  return { h, ramp, feats };
}

// ---------------------------------------------------------------- texturas de muros
// 4 variantes de techo y 3 de fachada por bioma, cacheadas para toda la sesión
const WALLTEX = {};
function wallTex(b) {
  if (WALLTEX[b]) return WALLTEX[b];
  const TER = TERRAIN[BIOME_KEYS[b]];
  const tops = [], faces = [];
  for (let v = 0; v < 4; v++) tops.push(makeWallTop(b, TER));
  for (let v = 0; v < 3; v++) faces.push(makeWallFace(b, TER, v));
  return (WALLTEX[b] = { tops, faces });
}
function makeWallTop(b, TER) {
  const c = newCanvas(TILE, TILE), x = c.getContext('2d');
  const px = (cx, cy, r, col) => { x.fillStyle = col; for (let yy = -r; yy <= r; yy += 4) for (let xx = -r; xx <= r; xx += 4) if (xx * xx + yy * yy <= r * r) x.fillRect(((cx + xx - 2) % TILE + TILE) % TILE, ((cy + yy - 2) % TILE + TILE) % TILE, 4, 4); };
  if (b === 0) {          // follaje denso: copas de árbol superpuestas (envuelven en los bordes para que encajen)
    x.fillStyle = '#1a3316'; x.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 8; i++) {
      const cx = Math.random() * TILE, cy = Math.random() * TILE, r = 13 + Math.random() * 9;
      px(cx, cy, r, '#1f3c1a'); px(cx - 3, cy - 3, r - 5, '#2b5524'); px(cx - 6, cy - 6, r - 11, '#3a6e30');
      px(cx - 8, cy - 8, 3, '#5a9a48');
    }
  } else if (b === 1) {   // losas de piedra con grietas y musgo frío
    x.fillStyle = '#23263a'; x.fillRect(0, 0, TILE, TILE);
    for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
      const bx = k * 28 + (r % 2) * 14 + 2, by = r * 20 + 2;
      x.fillStyle = pick(TER.top); x.fillRect(bx, by, 25, 17);
      x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(bx, by, 25, 2);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx, by + 15, 25, 2);
      if (Math.random() < 0.25) { x.fillStyle = '#1a1c2b'; x.fillRect(bx + 6 + Math.random() * 12, by + 4, 2, 9); }
      if (Math.random() < 0.15) { x.fillStyle = 'rgba(143,243,255,0.35)'; x.fillRect(bx + 3, by + 3, 6, 3); }
    }
  } else {                // basalto en placas con vetas de lava
    x.fillStyle = TER.top[0]; x.fillRect(0, 0, TILE, TILE);          // base intermedia: sin costuras entre baldosas
    for (let i = 0; i < 9; i++) px(Math.random() * TILE, Math.random() * TILE, 8 + Math.random() * 8, pick(TER.top));
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 5; i++) x.fillRect(Math.floor(Math.random() * 20) * 4, Math.floor(Math.random() * 20) * 4, 8, 2);
    for (let i = 0; i < 3; i++) {
      let cx = Math.random() * 80, cy = Math.random() * 80;
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 3 ? '#ff5a1a' : '#ffb040'; x.fillRect(cx, cy, 4, 4); cx += rnd(-4, 8); cy += rnd(-4, 8); }
    }
  }
  return c;
}
const WALLH = 30;
function makeWallFace(b, TER, v) {
  const h = WALLH, c = newCanvas(TILE, h), x = c.getContext('2d');
  x.fillStyle = TER.face[0]; x.fillRect(0, 0, TILE, h);
  if (b === 0) {            // raíces y troncos
    x.fillStyle = '#2a1c12';
    for (let k = 0; k < 4; k++) { const rx = 6 + k * 20 + Math.random() * 6; x.fillRect(rx, 0, 6, h - 4); x.fillStyle = '#3a281a'; x.fillRect(rx + 1, 0, 2, h - 6); x.fillStyle = '#2a1c12'; }
    x.fillStyle = '#1f3c1a'; for (let k = 0; k < 10; k++) x.fillRect(Math.random() * 76, Math.random() * 8, 4, 4);
  } else if (b === 1) {     // sillería
    x.fillStyle = TER.face[1];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) x.fillRect(col * 16 + (row % 2) * 8, row * 10 + 9, 14, 1);
    if (v === 0) { x.fillStyle = '#5a3a20'; x.fillRect(36, 8, 8, 14); x.fillStyle = '#ffb040'; x.fillRect(37, 3, 6, 6); }   // antorcha
  } else {                  // basalto con goteo de lava
    x.fillStyle = TER.face[1];
    for (let k = 0; k < 6; k++) x.fillRect(k * 14 + Math.random() * 4, 0, 2, h);
    if (v !== 2) { x.fillStyle = '#ff5a1a'; const lx = 10 + Math.random() * 56; x.fillRect(lx, 0, 4, 10 + Math.random() * 12); x.fillStyle = '#ffd43b'; x.fillRect(lx + 1, 0, 2, 5); }
  }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, h - 6, TILE, 6);
  return c;
}

// ---------------------------------------------------------------- física
// Alturas: los que caminan (jugador y enemigos de a pie) llevan `lv` (su nivel) y `ti` (baldosa
// actual). Una baldosa de otro nivel es un muro para ellos, salvo que haya rampa; con `drop`
// (el dash) pueden saltar a una baldosa más baja y `fell` acumula los niveles caídos.
let SOL_LO = 0, SOL_HI = 0;
function solidFor(o, j) {
  if (MAP.t[j] === TW) return true;
  if (MAP.secClosed[j] && o !== P) return true;          // salas secretas: solo el jugador las abre
  if (o.lv === undefined) return false;
  const jl = MAP.h[j];
  return jl > SOL_HI || (jl + (MAP.ramp[j] ? 1 : 0) < SOL_LO && !o.drop);
}
function syncLv(o) {
  const i = tIdx(o.x, o.y);
  o.ti = i < 0 ? 0 : i; o.lv = MAP.h[o.ti]; o.lx = o.x; o.ly = o.y; o.fell = 0;
}
// mueve en pasos cortos: nada atraviesa muros ni se queda dentro de ellos, aunque vaya muy rápido
function moveBy(o, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  dx /= steps; dy /= steps;
  for (let k = 0; k < steps; k++) { o.x += dx; o.y += dy; collideWalls(o); }
}
function collideWalls(o) {
  const r = o.r, n = MAPN;
  if (o.lv !== undefined) {
    const c = o.ti;
    if (MAP.ramp[c]) { SOL_LO = MAP.h[c]; SOL_HI = SOL_LO + 1; } else SOL_LO = SOL_HI = o.lv;
  }
  const x0 = Math.floor((o.x - r) / TILE), x1 = Math.floor((o.x + r) / TILE);
  const y0 = Math.floor((o.y - r) / TILE), y1 = Math.floor((o.y + r) / TILE);
  let hit = false;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx >= 0 && ty >= 0 && tx < n && ty < n && !solidFor(o, ty * n + tx)) continue;
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
  if (o.lv !== undefined) settleLv(o);
  else if (isWall(o.x, o.y) && o.lx !== undefined) { o.x = o.lx; o.y = o.ly; }
  else { o.lx = o.x; o.ly = o.y; }
  return hit;
}
// tras moverse: actualiza el nivel; si un empujón lo metió donde no debía, vuelve a su última posición válida
function settleLv(o) {
  const c = tIdx(o.x, o.y);
  if (c === o.ti) { o.lx = o.x; o.ly = o.y; return; }
  const pc = o.ti, lo = MAP.ramp[pc] ? MAP.h[pc] : o.lv, hi = MAP.ramp[pc] ? lo + 1 : o.lv;
  if (c < 0 || MAP.t[c] === TW || (MAP.secClosed[c] && o !== P)) { o.x = o.lx; o.y = o.ly; return; }
  const jl = MAP.h[c], jh = jl + (MAP.ramp[c] ? 1 : 0);
  if (jl > hi || (jh < lo && !o.drop)) { o.x = o.lx; o.y = o.ly; return; }
  if (jh < lo) o.fell = (o.fell || 0) + lo - jh;
  o.lv = clamp(o.lv, jl, jh); o.ti = c; o.lx = o.x; o.ly = o.y;
}
// ¿pueden tocarse cuerpo a cuerpo? (no desde lo alto de un risco)
function sameLevel(a, b) {
  if (a.lv === undefined || b.lv === undefined) return true;
  const d = Math.abs(a.lv - b.lv);
  return d === 0 || (d === 1 && (MAP.ramp[a.ti] || MAP.ramp[b.ti]));
}
// ¿se puede pasar de la baldosa i a la vecina j? (campo de flujo de los enemigos)
function linkT(i, j) {
  if (MAP.t[j] === TW || MAP.secClosed[j]) return false;
  const a = MAP.h[i], b = MAP.h[j];
  return b <= a + (MAP.ramp[i] ? 1 : 0) && b + (MAP.ramp[j] ? 1 : 0) >= a;
}

// campo de flujo hacia el jugador (se recalcula al cambiar de baldosa)
function updateFlow() {
  const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE);
  if (tx === MAP.ptx && ty === MAP.pty) return;
  MAP.ptx = tx; MAP.pty = ty;
  bfsH(MAP.t, MAP.h, MAP.ramp, MAP.secClosed, clamp(tx, 0, MAPN - 1), clamp(ty, 0, MAPN - 1), MAP.flow);
  MAP.fver++;
  reveal(tx, ty, P.lv >= 2 ? 7.5 + (P.lv - 1) * 2.5 : P.lv === 0 ? 6 : 7.5);   // desde lo alto ves más lejos
}
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
      if (f[j] < 0 || !linkT(i, j)) continue;
      if (dx && dy && (!linkT(i, ty * n + x) || !linkT(i, y * n + tx))) continue;
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
function reveal(tx, ty, R) {
  const n = MAPN, fog = MAP.fog;
  R = R || 7.5;
  let changed = false;
  for (let y = Math.floor(ty - R); y <= ty + R; y++) for (let x = Math.floor(tx - R); x <= tx + R; x++) {
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const i = y * n + x;
    if (fog[i] || (x - tx) ** 2 + (y - ty) ** 2 > R * R) continue;
    fog[i] = 1; changed = true;
    fogPaint(i);
  }
  if (changed) MAP.fogC.getContext('2d').putImageData(MAP.fogImg, 0, 0);
}
// color de una baldosa en el minimapa (las salas secretas se ven como muro hasta descubrirlas)
const LV_LIFT = [0.9, 1.6, 2.0, 2.4];
function fogPaint(i) {
  const d = MAP.fogImg.data, tt = MAP.secClosed[i] ? TW : MAP.t[i], TER = TERRAIN[BIOME_KEYS[MAP.bio[i]]];
  const col = tt === TW ? TER.top[1] : MAP.ramp[i] ? '#a89a78' : tt === TSLOW ? TER.slow[1] : tt === THURT ? TER.hurt[1] : tt === TICE ? '#bfe8ff' : tt === TSLOPE ? '#7a7a6a' : LEVELS[MAP.bio[i]].ground[0];
  const [r, g, b] = hexRGB(col);
  const lift = tt === TW ? 0.7 : LV_LIFT[MAP.h[i]] || 1.6;
  d[i * 4] = Math.min(255, r * lift); d[i * 4 + 1] = Math.min(255, g * lift); d[i * 4 + 2] = Math.min(255, b * lift); d[i * 4 + 3] = 255;
}

// ---------------------------------------------------------------- lógica por fotograma
function updateWorld(dt) {
  const pi = tIdx(P.x, P.y);
  if (pi >= 0 && MAP.secClosed[pi]) discoverSecret(MAP.secRooms[MAP.sec[pi] - 1]);
  updateFlow();
  updatePuzzles(dt);
  updateFeats();
  P.inZone = null;
  for (const z of MAP.zones) if ((P.x - z.x) ** 2 + (P.y - z.y) ** 2 < z.r * z.r) { P.inZone = z.type; z.seen = true; }
  if (P.inZone === 'sagrada') heal(P.s.maxHp * 0.02 * dt);
  for (const sh of MAP.shrines) {
    if (sh.used || !sh.guard) continue;
    if (!sh.g && (P.x - sh.x) ** 2 + (P.y - sh.y) ** 2 < 430 * 430) spawnGuardian(sh);
    else if (sh.g && sh.g.dead) {
      sh.guard = false;
      banner('✔ Santuario liberado', 'Quédate encima para activar ' + SHRINES[sh.type].n, 2, '#5bff8a');
      ring(sh.x, sh.y, 10, 200, 0.5, '#5bff8a', 6);
    }
  }
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

// ---------------------------------------------------------------- puzles
const RUNE_SYM = ['◆', '▲', '●', '■'], RUNE_COL = ['#ff5a8a', '#ffd43b', '#5bff8a', '#6aa8ff'];
function solvePuzzle(pz) {
  pz.solved = true; S.puzzles = (S.puzzles || 0) + 1;
  const sp = safeSpot(pz.x, pz.y);
  S.picks.push({ k: 'chest', x: sp.x, y: sp.y, tier: 2 });
  for (let i = 0; i < 8; i++) S.picks.push({ k: 'soul', x: pz.x + rnd(-60, 60), y: pz.y + rnd(-60, 60), v: 2 });
  banner('🧩 ¡Puzle resuelto!', 'Recoge el cofre: mejora épica o superior', 2.4, '#5bffd0');
  ring(pz.x, pz.y, 10, 260, 0.6, '#5bffd0', 8);
  AU.sfx('chest');
}
function updatePuzzles(dt) {
  for (const pz of MAP.puzzles) {
    if (pz.solved) continue;
    const near = (P.x - pz.x) ** 2 + (P.y - pz.y) ** 2 < 600 * 600;
    if (!near) continue;
    if (pz.type === 'runas') {
      pz.cool -= dt;
      for (const pl of pz.plates) {
        const on = (P.x - pl.x) ** 2 + (P.y - pl.y) ** 2 < 34 * 34;
        if (on && !pl.on && !pl.lit && pz.cool <= 0) {
          if (pz.order[pz.step] === pl.sym) {
            pl.lit = true; pz.step++; AU.sfx('pick');
            part(pl.x, pl.y, RUNE_COL[pl.sym], 10, 120, 0.4, 3);
            if (pz.step >= 4) solvePuzzle(pz);
          } else {                                   // error: se reinicia y aparecen enemigos
            pz.step = 0; pz.cool = 1; for (const q of pz.plates) q.lit = false;
            banner('✖ Secuencia incorrecta', 'Mira la tablilla de nuevo', 1.5, '#ff6a5a');
            AU.sfx('hurt');
            for (let i = 0; i < 4; i++) { const sp = randomFloorAround(pz.x, pz.y, 120, 260, 10); if (sp) spawnEnemy(pick(S.L.spawns).e, sp.x, sp.y); }
          }
        }
        pl.on = on;
      }
    } else {
      let lit = 0;
      for (const b of pz.braz) {
        b.t -= dt;
        if ((P.x - b.x) ** 2 + (P.y - b.y) ** 2 < 46 * 46) { if (b.t <= 0) AU.sfx('pick'); b.t = 12; }
        if (b.t > 0) lit++;
      }
      if (lit === 4) solvePuzzle(pz);
    }
  }
}
function puzzleHint() {
  for (const pz of MAP.puzzles) {
    if (pz.solved || (P.x - pz.x) ** 2 + (P.y - pz.y) ** 2 > 330 * 330) continue;
    if (pz.type === 'runas') return ['🧩 Runas de memoria: acércate a la tablilla y pisa las losas en ese orden (' + pz.step + '/4)', '#5bffd0'];
    const lit = pz.braz.filter(b => b.t > 0).length;
    return ['🧩 Braseros: enciende los 4 a la vez, cada uno dura 12s (' + lit + '/4)', '#ffb040'];
  }
  return null;
}
function drawPuzzles(vis) {
  for (const pz of MAP.puzzles) {
    if (!vis(pz.x, pz.y, 600)) continue;
    if (pz.type === 'runas') {
      // tablilla: muestra la secuencia de símbolos uno a uno cuando estás cerca
      const near = (P.x - pz.x) ** 2 + (P.y - pz.y) ** 2 < 200 * 200;
      shadow(pz.x, pz.y + 6, 24);
      ctx.fillStyle = '#1b1424'; ctx.fillRect(pz.x - 22, pz.y - 46, 44, 50);
      ctx.fillStyle = pz.solved ? '#2a4a3a' : '#3d3550'; ctx.fillRect(pz.x - 19, pz.y - 43, 38, 44);
      ctx.textAlign = 'center'; ctx.font = 'bold 22px "Segoe UI Symbol", sans-serif';
      if (pz.solved) { ctx.fillStyle = '#5bffd0'; ctx.fillText('✔', pz.x, pz.y - 14); }
      else if (near) {
        const k = Math.floor(S.time / 0.8) % 5;          // 4 símbolos y una pausa
        if (k < 4) { const sy = pz.order[k]; ctx.drawImage(glowSpr(RUNE_COL[sy]), pz.x - 30, pz.y - 52, 60, 60); ctx.fillStyle = RUNE_COL[sy]; ctx.fillText(RUNE_SYM[sy], pz.x, pz.y - 14); ctx.font = '10px Silkscreen, monospace'; ctx.fillStyle = '#ddd'; ctx.fillText((k + 1) + 'º', pz.x, pz.y - 1); }
      } else { ctx.fillStyle = '#8a80a0'; ctx.fillText('?', pz.x, pz.y - 14); }
      for (const pl of pz.plates) {
        ctx.fillStyle = '#1b1424'; ctx.fillRect(pl.x - 28, pl.y - 28, 56, 56);
        ctx.fillStyle = pl.lit || pz.solved ? rgba(RUNE_COL[pl.sym], 0.55) : '#2e2840'; ctx.fillRect(pl.x - 25, pl.y - 25, 50, 50);
        if (pl.lit) ctx.drawImage(glowSpr(RUNE_COL[pl.sym]), pl.x - 40, pl.y - 40, 80, 80);
        ctx.font = 'bold 26px "Segoe UI Symbol", sans-serif'; ctx.fillStyle = RUNE_COL[pl.sym]; ctx.textAlign = 'center';
        ctx.fillText(RUNE_SYM[pl.sym], pl.x, pl.y + 9);
      }
    } else {
      for (const b of pz.braz) {
        if (!vis(b.x, b.y, 60)) continue;
        shadow(b.x, b.y + 6, 18);
        ctx.fillStyle = '#1b1424'; ctx.fillRect(b.x - 14, b.y - 34, 28, 38);
        ctx.fillStyle = '#4a4458'; ctx.fillRect(b.x - 11, b.y - 31, 22, 32);
        ctx.fillStyle = '#2a2433'; ctx.fillRect(b.x - 16, b.y - 38, 32, 8);
        if (b.t > 0 || pz.solved) {
          const f = 0.8 + Math.sin(S.time * 14 + b.x) * 0.2;
          ctx.drawImage(glowSpr('#ff9a2a'), b.x - 34 * f, b.y - 76, 68 * f, 68);
          ctx.fillStyle = '#ffd43b'; ctx.fillRect(b.x - 5, b.y - 54 * f, 10, 16 * f);
          if (!pz.solved) { ctx.strokeStyle = '#ffb040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y - 14, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (b.t / 12)); ctx.stroke(); }
        } else { ctx.fillStyle = '#6a5a52'; ctx.fillRect(b.x - 6, b.y - 42, 12, 4); }
      }
    }
  }
}

// ---------------------------------------------------------------- cumbres y criptas
// Cumbre: cofre épico a la vista; al subir a la meseta salta una emboscada.
// Cripta hundida: al bajar, los muertos despiertan; si los vences, el sarcófago se abre (cofre épico).
function ambushTypes(bi) {
  const L = LEVELS[bi];
  const ok = L.spawns.map(s => s.e).filter(e => !ENEMIES[e].fly && ENEMIES[e].ai !== 'ghost' && !ENEMIES[e].split);
  return ok.length ? ok : ['skel'];
}
function ambush(f, tiles, nMobs, title, sub) {
  const n = MAPN, types = ambushTypes(MAP.bio[tiles[0]]), mobs = [];
  const spots = tiles.filter(j => { const d = Math.hypot((j % n + 0.5) * TILE - P.x, (((j / n) | 0) + 0.5) * TILE - P.y); return d > 150 && d < 520; });
  const pool = spots.length >= 3 ? spots : tiles;
  for (let k = 0; k < nMobs; k++) {
    const j = pick(pool), x = (j % n + rnd(0.25, 0.75)) * TILE, y = (((j / n) | 0) + rnd(0.25, 0.75)) * TILE;
    const e = spawnEnemy(pick(types), x, y, k === 0);
    mobs.push(e);
    part(x, y, '#c8c0d8', 8, 120, 0.5, 3, -60);
  }
  f.mobs = mobs;
  banner(title, sub, 2.4, '#ff8a5a');
  AU.sfx('boss'); shake(8);
}
function updateFeats() {
  const n = MAPN, extra = S.endless ? Math.min(4, S.asc || 0) : S.lvlIdx;
  for (const f of MAP.feats) {
    if (f.done) continue;
    if (f.type === 'cripta') {
      if (!f.trig) {
        const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE);
        if (P.lv === 0 && tx >= f.x0 && ty >= f.y0 && tx < f.x0 + f.w && ty < f.y0 + f.h) {
          f.trig = true;
          ambush(f, f.tiles, 5 + extra, '⚰ ¡Los muertos despiertan!', 'Acaba con ellos y el sarcófago se abrirá');
        }
      } else if (f.mobs.every(e => e.dead)) {
        f.done = true;
        S.picks.push({ k: 'chest', x: f.x, y: f.y + 34, tier: 2 });
        for (let i = 0; i < 8; i++) S.picks.push({ k: 'soul', x: f.x + rnd(-60, 60), y: f.y + rnd(-40, 60), v: 2 });
        banner('⚰ El sarcófago se abre', 'Recoge el cofre: mejora épica o superior', 2.2, '#ffd43b');
        ring(f.x, f.y, 10, 200, 0.6, '#ffd43b', 6); AU.sfx('chest');
      }
    } else if (f.type === 'cima') {
      if (P.lv >= 2 && (f.tiles.includes(P.ti) || f.top.includes(P.ti))) {
        f.done = true;
        ambush(f, f.tiles.concat(f.top), 3 + extra, '⛰ ¡Emboscada en la cumbre!', 'El cofre de la cima está custodiado');
      }
    }
  }
}
function drawFeats(vis) {
  for (const f of MAP.feats) {
    if (!vis(f.x, f.y, 300)) continue;
    if (f.type === 'cripta') {
      // velas en las esquinas y sarcófago en el centro
      for (const [cx, cy] of [[f.x0, f.y0], [f.x0 + f.w, f.y0], [f.x0, f.y0 + f.h], [f.x0 + f.w, f.y0 + f.h]]) {
        const x = cx * TILE + (cx === f.x0 ? 22 : -22), y = cy * TILE + (cy === f.y0 ? 30 : -16);
        const fl = 0.85 + Math.sin(S.time * 9 + x) * 0.15;
        ctx.drawImage(glowSpr('#ffb040'), x - 22 * fl, y - 34, 44 * fl, 44);
        ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 3, y - 12, 6, 12); ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 2, y - 17 * fl, 4, 5);
      }
      const x = f.x, y = f.y;
      shadow(x, y + 22, 40);
      ctx.fillStyle = '#1a1c2b'; ctx.fillRect(x - 38, y - 22, 76, 46);
      ctx.fillStyle = '#4a5068'; ctx.fillRect(x - 35, y - 19, 70, 40);
      const lid = f.done ? 26 : 0;
      ctx.fillStyle = '#626a88'; ctx.fillRect(x - 33 + lid, y - 26 - lid * 0.3, 66, 30);
      ctx.fillStyle = '#8a92b8'; ctx.fillRect(x - 33 + lid, y - 26 - lid * 0.3, 66, 4);
      ctx.fillStyle = '#2a2f45'; ctx.fillRect(x - 3 + lid, y - 20 - lid * 0.3, 6, 18); ctx.fillRect(x - 10 + lid, y - 14 - lid * 0.3, 20, 5);   // cruz
      if (f.trig && !f.done) { ctx.globalAlpha = 0.4 + Math.sin(S.time * 5) * 0.2; ctx.drawImage(glowSpr('#8a6aff'), x - 50, y - 50, 100, 80); ctx.globalAlpha = 1; }
    } else if (f.type === 'cima') {
      // mástil con estandarte: se ve desde lejos
      const x = f.x + 34, y = f.y - 6, w = Math.sin(S.time * 3) * 3;
      shadow(x, y + 4, 10);
      ctx.fillStyle = '#3a281a'; ctx.fillRect(x - 2, y - 58, 4, 60);
      ctx.fillStyle = f.done ? '#ff4a4a' : '#ffd43b';
      ctx.beginPath(); ctx.moveTo(x + 2, y - 58); ctx.lineTo(x + 30, y - 50 + w); ctx.lineTo(x + 2, y - 40); ctx.fill();
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(x - 8, y - 4, 16, 6);
    }
  }
}

function spawnGuardian(sh) {
  const spawns = MAP.endless ? LEVELS[MAP.bio[tIdx(sh.x, sh.y)]].spawns : S.L.spawns;
  const heavy = spawns.map(s => s.e).filter(t => !['imp', 'bat', 'icebat', 'slime'].includes(t));
  const p = randomFloorAround(sh.x, sh.y, 60, 150) || { x: sh.x, y: sh.y + 90 };
  const e = spawnEnemy(pick(heavy.length ? heavy : ['skel']), p.x, p.y, true);
  e.guardian = true; e.maxHp = Math.max(e.maxHp * 1.4, (P.dpsEst || 30) * 18); e.hp = e.maxHp; e.sc *= 1.15; e.r *= 1.12; e.gT = 2.5;   // ~18 s de tu DPS
  sh.g = e;
  banner('🛡 Guardián del santuario', 'Derrótalo para poder activar ' + SHRINES[sh.type].n, 2.2, '#ffb020');
  ring(e.x, e.y, 10, 160, 0.5, '#ffb020', 6);
  AU.sfx('boss');
}
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
const visTiles = (x0, y0, x1, y1, pad) => [
  Math.max(0, Math.floor(x0 / TILE)), Math.min(MAPN - 1, Math.floor(x1 / TILE)),
  Math.max(0, Math.floor((y0 - (pad || 0)) / TILE)), Math.min(MAPN - 1, Math.floor((y1 + (pad || 0)) / TILE)),
];
// suelo: en campaña un solo patrón; en el modo infinito, el patrón del bioma de cada baldosa
function drawGround(x0, y0, x1, y1) {
  if (!MAP.endless) {
    ctx.fillStyle = S.groundPats[MAP.bio[0]];
    ctx.fillRect(Math.max(0, x0), Math.max(0, y0), Math.min(WORLD, x1) - Math.max(0, x0), Math.min(WORLD, y1) - Math.max(0, y0));
    return;
  }
  const [tx0, tx1, ty0, ty1] = visTiles(x0, y0, x1, y1), n = MAPN;
  for (let b = 0; b < 3; b++) {
    ctx.fillStyle = S.groundPats[b];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (MAP.bio[ty * n + tx] === b) ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
  }
}
function drawTerrain(x0, y0, x1, y1) {
  const n = MAPN, tm = S.time;
  const [tx0, tx1, ty0, ty1] = visTiles(x0, y0, x1, y1);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * n + tx, tt = MAP.t[i]; if (tt === TF || tt === TW) continue;
    const TER = TERRAIN[BIOME_KEYS[MAP.bio[i]]], x = tx * TILE, y = ty * TILE;
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
      const a = MAP.dir[i];
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y, TILE, TILE);
      ctx.save(); ctx.translate(x + TILE / 2, y + TILE / 2); ctx.rotate(a);
      const o = (tm * 40) % 26;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 4;
      for (let k = -1; k <= 1; k++) { const p = k * 26 + o - 13; ctx.beginPath(); ctx.moveTo(p - 8, -14); ctx.lineTo(p + 4, 0); ctx.lineTo(p - 8, 14); ctx.stroke(); }
      ctx.restore();
    }
  }
  // sombra que proyectan los muros sobre el suelo (da profundidad)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!wallLike(ty * n + tx) || ty + 1 >= n || wallLike((ty + 1) * n + tx)) continue;
    ctx.fillRect(tx * TILE, (ty + 1) * TILE, TILE, 14);
  }
}
// ---------------------------------------------------------------- alturas (dibujo)
// Cada nivel tiñe el suelo (más claro arriba, oscuro en las criptas); donde una baldosa alta
// queda al norte de una baja se ve el risco (FACE_H px por nivel); los demás bordes llevan
// un brillo arriba y sombra abajo. Las rampas son escalones con barandillas.
const FACE_H = 28;
const CLIFFTEX = {};
function cliffTex(b) {
  if (CLIFFTEX[b]) return CLIFFTEX[b];
  const TER = TERRAIN[BIOME_KEYS[b]], h = FACE_H * 3, c = newCanvas(TILE * 2, h), x = c.getContext('2d');
  x.fillStyle = b === 0 ? '#3a2e22' : TER.face[0]; x.fillRect(0, 0, TILE * 2, h);
  if (b === 0) {            // tierra con piedras y raíces
    for (let k = 0; k < 26; k++) { x.fillStyle = pick(['#4a3a2a', '#2a2018', '#5a5048']); x.fillRect(Math.floor(Math.random() * 40) * 4, Math.floor(Math.random() * 16) * 4, 8, 4); }
    x.fillStyle = '#24401f'; for (let k = 0; k < 12; k++) x.fillRect(Math.random() * 156, 0, 4, 4 + Math.random() * 10);
  } else if (b === 1) {     // sillería
    x.fillStyle = TER.face[1];
    for (let row = 0; row < 7; row++) { x.fillRect(0, row * 10 + 9, TILE * 2, 1); for (let col = 0; col < 10; col++) x.fillRect(col * 16 + (row % 2) * 8, row * 10, 1, 10); }
  } else {                  // basalto con vetas
    x.fillStyle = TER.face[1]; for (let k = 0; k < 12; k++) x.fillRect(k * 14 + Math.random() * 4, 0, 2, h);
    for (let k = 0; k < 3; k++) { x.fillStyle = '#ff5a1a'; const lx = 10 + Math.random() * 140; x.fillRect(lx, Math.random() * 30, 3, 10 + Math.random() * 14); }
  }
  return (CLIFFTEX[b] = c);
}
function drawHeights(x0, y0, x1, y1) {
  const n = MAPN, h = MAP.h, rp = MAP.ramp;
  const [tx0, tx1, ty0, ty1] = visTiles(x0, y0, x1, y1);
  const fl = j => !wallLike(j);
  const top = j => h[j] + (rp[j] ? 1 : 0);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * n + tx; if (!fl(i)) continue;
    const L = h[i], x = tx * TILE, y = ty * TILE;
    if (L !== 1 && !rp[i]) { ctx.fillStyle = L === 0 ? 'rgba(4,4,14,0.45)' : L === 2 ? 'rgba(255,248,215,0.12)' : 'rgba(255,248,215,0.22)'; ctx.fillRect(x, y, TILE, TILE); }
    if (rp[i]) drawRamp(i, x, y);
  }
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * n + tx; if (!fl(i)) continue;
    const L = h[i], T = top(i), x = tx * TILE, y = ty * TILE, b = MAP.bio[i], TER = TERRAIN[BIOME_KEYS[b]];
    // norte más alto → risco sobre esta baldosa
    if (ty > 0) {
      const j = i - n;
      if (fl(j) && h[j] > T) {
        const fh = FACE_H * Math.min(3, h[j] - L);
        ctx.drawImage(cliffTex(b), (tx % 2) * TILE, 0, TILE, fh, x, y, TILE, fh);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + fh - 4, TILE, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + fh, TILE, 10);
        ctx.fillStyle = rgba(TER.rim, 0.8); ctx.fillRect(x, y - 2, TILE, 3);
      } else if (fl(j) && top(j) < L) {          // borde norte de la meseta
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y - 3, TILE, 3);
        ctx.fillStyle = rgba(TER.rim, 0.7); ctx.fillRect(x, y, TILE, 4);
      }
    }
    // lados: brillo en el borde alto, sombra en el bajo
    for (const [dx, xe] of [[-1, x], [1, x + TILE]]) {
      const nx = tx + dx; if (nx < 0 || nx >= n) continue;
      const j = i + dx; if (!fl(j) || linkT(i, j)) continue;
      if (h[j] < L) {                              // borde lateral: brillo, línea oscura y sombra sobre lo bajo
        ctx.fillStyle = rgba(TER.rim, 0.65); ctx.fillRect(dx < 0 ? xe : xe - 4, y, 4, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(dx < 0 ? xe - 3 : xe, y, 3, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx < 0 ? xe - 14 : xe + 3, y, 11, TILE);
      }
    }
  }
}
function drawRamp(i, x, y) {
  const d = MAP.ramp[i] - 1, TER = TERRAIN[BIOME_KEYS[MAP.bio[i]]];
  ctx.save(); ctx.translate(x + TILE / 2, y + TILE / 2); ctx.rotate(d * Math.PI / 2);
  // en coordenadas locales la rampa sube hacia -y
  for (let k = 0; k < 5; k++) {
    const sy = 40 - (k + 1) * 16;
    ctx.fillStyle = `rgba(255,248,215,${0.04 + k * 0.035})`; ctx.fillRect(-40, sy, 80, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-40, sy + 13, 80, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-40, sy, 80, 2);
  }
  ctx.fillStyle = TER.face[0];
  const n = MAPN, side = (sx, sy) => { const tx = Math.floor(x / TILE) + sx, ty = Math.floor(y / TILE) + sy; return tx >= 0 && ty >= 0 && tx < n && ty < n && MAP.ramp[ty * n + tx] === MAP.ramp[i]; };
  const [px, py] = DIRS4[(d + 1) % 4];          // vecino a la "derecha" local (+x)
  if (!side(px, py)) ctx.fillRect(34, -40, 6, 80);
  if (!side(-px, -py)) ctx.fillRect(-40, -40, 6, 80);
  ctx.restore();
}
function pushWalls(list, x0, y0, x1, y1) {
  const n = MAPN, [tx0, tx1, ty0, ty1] = visTiles(x0, y0, x1, y1 + 40);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
    if (wallLike(ty * n + tx)) list.push({ kind: 'wall', tx, ty, y: (ty + 1) * TILE - 1 });
}
// muro de verdad o sala secreta aún cerrada (se dibuja igual que la roca)
const wallLike = i => MAP.t[i] === TW || MAP.secClosed[i] === 1;
// ¿este objeto (dibujado después del jugador) le tapa? entonces se vuelve translúcido
function coversPlayer(x0, y0, x1, y1) { return P.x + 20 > x0 && P.x - 20 < x1 && P.y + 14 > y0 && P.y - 46 < y1; }
function drawWall(o) {
  const n = MAPN, tx = o.tx, ty = o.ty, x = tx * TILE, y = ty * TILE, t = MAP.t, i = ty * n + tx;
  const b = MAP.bio[i], tex = wallTex(b), h = hash2(tx, ty), TER = TERRAIN[BIOME_KEYS[b]];
  const W_ = (xx, yy) => xx < 0 || yy < 0 || xx >= n || yy >= n || wallLike(yy * n + xx);
  const up = W_(tx, ty - 1), dn = W_(tx, ty + 1), lf = W_(tx - 1, ty), rt = W_(tx + 1, ty);
  const top = y - WALLH;
  const see = o.y > P.y && coversPlayer(x, top, x + TILE, y + TILE);
  if (see) { ctx.globalAlpha = 0.38; if (P.x > x && P.x < x + TILE && P.y - 18 > top) P.occl = true; }   // tapa el centro del jugador: silueta
  ctx.drawImage(tex.tops[h % 4], x, top);
  if (!dn) {
    const fv = (h >>> 3) % 3;
    ctx.drawImage(tex.faces[fv], x, y + TILE - WALLH);
    if (b === 1 && fv === 0) ctx.drawImage(glowSpr('#ffb040'), x + 22, y + TILE - WALLH - 18, 36, 36);   // antorcha encendida
    if (b === 2 && fv !== 2) ctx.drawImage(glowSpr('#ff5a1a'), x + 10, y + TILE - WALLH - 6, 60, 30);
  }
  // bordes: brillo arriba, sombra a los lados expuestos
  if (!up) { ctx.fillStyle = TER.rim; ctx.globalAlpha = 0.55; ctx.fillRect(x, top, TILE, 3); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  if (!lf) ctx.fillRect(x, top, 4, TILE);
  if (!rt) ctx.fillRect(x + TILE - 4, top, 4, TILE);
  // esquinas redondeadas (escalones de píxel) donde el muro termina
  const pat = S.groundPats[b];
  const stair = (cx, cy, sx, sy) => {
    ctx.fillStyle = pat;
    ctx.fillRect(cx, cy, 12 * sx, 4 * sy); ctx.fillRect(cx, cy, 8 * sx, 8 * sy); ctx.fillRect(cx, cy, 4 * sx, 12 * sy);
  };
  if (!up && !lf) stair(x, top, 1, 1);
  if (!up && !rt) stair(x + TILE, top, -1, 1);
  // entrada de sala secreta: roca agrietada y una corriente de aire tenue
  if (MAP.sec[i] && MAP.secClosed[i] && MAP.secRooms[MAP.sec[i] - 1].ei === i) drawSecretCracks(x, y, top, !dn, b);
  ctx.globalAlpha = 1;
}
function drawSecretCracks(x, y, top, faceVisible, b) {
  const crack = b === 0 ? '#060c05' : b === 1 ? '#0b0c16' : '#0e0403', edge = b === 0 ? '#6a9a50' : b === 1 ? '#a8b0d0' : '#c87a50';
  const zig = (sx, sy, pts) => {
    let cx = sx, cy = sy;
    for (const [dx, dy] of pts) { ctx.fillStyle = edge; ctx.fillRect(cx + 4, cy, 2, 4); ctx.fillStyle = crack; ctx.fillRect(cx, cy, 4, 4); cx += dx; cy += dy; }
  };
  zig(x + 22, top + 10, [[4, 4], [4, 0], [0, 4], [4, 4], [-4, 4], [0, 4], [4, 4], [0, 4]]);
  zig(x + 54, top + 14, [[-4, 4], [0, 4], [-4, 4], [4, 4], [0, 4], [-4, 4], [0, 4]]);
  zig(x + 36, top + 30, [[4, 0], [4, 4], [4, 0], [0, 4]]);
  if (faceVisible) {           // fachada: un arco tapiado con piedras sueltas
    const fy = y + TILE - WALLH;
    ctx.fillStyle = '#07050a'; ctx.fillRect(x + 22, fy + 6, 36, WALLH - 6); ctx.fillRect(x + 26, fy + 2, 28, 4); ctx.fillRect(x + 32, fy - 2, 16, 4);
    const st = b === 1 ? ['#6a7090', '#555c78'] : b === 0 ? ['#5a4a34', '#4a3a28'] : ['#6a4030', '#5a3326'];
    for (let k = 0; k < 7; k++) { ctx.fillStyle = st[k % 2]; ctx.fillRect(x + 24 + (k % 4) * 8, fy + 8 + Math.floor(k / 4) * 9, 7, 7); }
  }
  const a = 0.18 + Math.sin(S.time * 2.2 + x) * 0.1;
  const pa = ctx.globalAlpha; ctx.globalAlpha = pa * a;
  ctx.drawImage(glowSpr(b === 2 ? '#ffb070' : '#bfe8ff'), x + 10, faceVisible ? y + 20 : top + 10, 60, 50);
  ctx.globalAlpha = pa;
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
    if (tr.state === 1) ctx.drawImage(glowSpr('#ff3a2a'), x - 30, y - 30, 60, 60);
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
  const n = MAPN, fog = MAP.fog, [tx0, tx1, ty0, ty1] = visTiles(x0, y0, x1, y1, 40);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * n + tx;
    if (fog[i]) continue;
    ctx.fillStyle = TERRAIN[BIOME_KEYS[MAP.bio[i]]].fogc;
    ctx.fillRect(tx * TILE - 1, ty * TILE - WALLH - 1, TILE + 2, TILE + 2);
  }
}
function heightHint() {
  const n = MAPN, i = P.ti;
  if (MAP.ramp[i]) return [MAP.bio[i] === 1 ? 'Escalera: une dos niveles' : 'Rampa: une dos niveles', '#e8dcc0'];
  // al borde de un risco: avisa de que el dash salta
  const tx = i % n, ty = (i / n) | 0, lx = P.x - tx * TILE, ly = P.y - ty * TILE;
  for (const [d, near] of [[0, ly < 30], [1, lx > TILE - 30], [2, ly > TILE - 30], [3, lx < 30]]) {
    if (!near) continue;
    const [dx, dy] = DIRS4[d], x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const j = y * n + x;
    if (!wallLike(j) && MAP.h[j] + (MAP.ramp[j] ? 1 : 0) < P.lv) return ['⬇ Risco: usa el dash para saltar abajo (la caída hace daño)', '#ffb070'];
  }
  if (P.lv === 0) return ['⚰ Cripta hundida: sal por la escalera', '#a8a0d8'];
  if (P.lv >= 2) return ['⛰ Terreno elevado: +15% daño a los de abajo y ves más lejos', '#ffe9a8'];
  return null;
}
function terrainHint() {
  if (!MAP) return null;
  const ph = puzzleHint(); if (ph) return ph;
  const tt = tileAt(P.x, P.y), TER = terAt(P.x, P.y);
  if (P.inZone) return [ZONES[P.inZone].n + ': ' + ZONES[P.inZone].d, ZONES[P.inZone].c];
  const hh = heightHint(); if (hh) return hh;
  if (tt === TSLOW) return [TER.slow[0] + ': -45% velocidad', '#d8d0b0'];
  if (tt === THURT) return [TER.hurt[0] + ': daño continuo (también a enemigos)', TER.hurt[1]];
  if (tt === TICE) return [TER.ice + ': cuesta frenar', '#bfe8ff'];
  if (tt === TSLOPE) return [TER.slope + ': te empuja cuesta abajo', '#ddd'];
  if (P.chillT > 0) return ['Congelado: -50% velocidad', '#8ff3ff'];
  return null;
}
