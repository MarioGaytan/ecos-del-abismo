'use strict';
// =====================================================================
//  MOTOR — bucle, entrada, jugador, enemigos, combate, director,
//  jefes y render. Todo en Canvas 2D con pools y rejilla espacial.
// =====================================================================

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let W = 1280, H = 720, DPR = 1, ZOOM = 1;
let mode = 'menu';           // menu | play | levelup | pause | cross | over
let S = null, P = null;
const cam = { x: WORLD / 2, y: WORLD / 2 };
let SRC = 'prim';            // fuente de daño actual (para el desglose)
const TAU = Math.PI * 2;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = a => a[Math.floor(Math.random() * a.length)];
function wpick(list, wf) {
  let tot = 0; for (const x of list) tot += wf(x);
  let r = Math.random() * tot;
  for (const x of list) { r -= wf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function compact(arr, keep) { let j = 0; for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i]; arr.length = j; }

// ---------------- Guardado ----------------
const SAVE_KEY = 'ecos_abismo_v1';
let SAVE = { souls: 0, meta: {}, custom: {}, unlocked: {}, best: 0, wins: 0, settings: { quality: 'high', sfx: true, music: true, auto: false, dmgNums: true, fps: false } };
try {
  const d = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (d) SAVE = Object.assign(SAVE, d, { settings: Object.assign(SAVE.settings, d.settings || {}) });
} catch (e) { /* almacenamiento no disponible */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
// Personalización guardada por clase: { pal: {ranura: índice}, prim: 0|1, sec: 0|1 }
function heroCustom(cls) {
  const c = SAVE.custom[cls] || (SAVE.custom[cls] = { pal: {}, prim: 0, sec: 0 });
  c.pal = c.pal || {};
  return c;
}
function heroPal(cls) {
  const cu = heroCustom(cls), pal = {};
  for (const slot of CUSTOM[cls]) {
    const o = slot.opts[cu.pal[slot.id] || 0] || slot.opts[0];
    slot.keys.forEach((k, i) => { pal[k] = o.c[i]; });
  }
  return pal;
}
const LOWQ = () => SAVE.settings.quality === 'low';

// ---------------- Tamaño de pantalla ----------------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, LOWQ() ? 1 : 1.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const touchy = typeof TOUCH !== 'undefined' && TOUCH.on;
  ZOOM = clamp(Math.min(W / 1280, H / 740), touchy ? 0.5 : 0.62, 1.6);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// ---------------- Entrada ----------------
const keys = {};
const mouse = { x: 0, y: 0, l: false, r: false };
window.addEventListener('keydown', e => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  AU.init();
  onKey(e.code);
});
window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') UI.hideStats(); });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  AU.init();
  if (e.button === 0) mouse.l = true;
  if (e.button === 2) { mouse.r = true; if (mode === 'play') trySecondary(); }
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  mouse.l = mouse.r = false;
  if (mode === 'play') UI.pause();
});

function onKey(c) {
  if (mode === 'play') {
    if (c === 'Space' || c === 'ShiftLeft' || c === 'ShiftRight') doDash();
    else if (c === 'KeyQ') tryUlt();
    else if (c === 'KeyE') trySecondary();
    else if (c === 'Escape' || c === 'KeyP') UI.pause();
    else if (c === 'Tab') UI.showStats();
    else if (c === 'KeyF') { SAVE.settings.auto = !SAVE.settings.auto; persist(); banner(SAVE.settings.auto ? 'Auto-ataque ACTIVADO' : 'Auto-ataque DESACTIVADO', '', 1.2); }
    else if (c === 'KeyM') { SAVE.settings.music = !SAVE.settings.music; SAVE.settings.sfx = SAVE.settings.music; persist(); banner(SAVE.settings.sfx ? 'Sonido ON' : 'Sonido OFF', '', 1); }
  } else UI.onKey(c);
}

// ---------------- Rejilla espacial (enemigos) ----------------
const CELL = 96;
let GC = 0, GR = 0, grid = [];
function gridInit() {
  GC = Math.ceil(WORLD / CELL) + 1; GR = GC;
  grid = new Array(GC * GR); for (let i = 0; i < grid.length; i++) grid[i] = [];
}
function gridBuild() {
  for (let i = 0; i < grid.length; i++) grid[i].length = 0;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const cx = clamp(Math.floor(e.x / CELL), 0, GC - 1), cy = clamp(Math.floor(e.y / CELL), 0, GR - 1);
    grid[cy * GC + cx].push(e);
  }
}
const QBUF = [];
function query(x, y, r, out) {
  out = out || QBUF; out.length = 0;
  r += 60; // margen para enemigos grandes
  const x0 = clamp(Math.floor((x - r) / CELL), 0, GC - 1), x1 = clamp(Math.floor((x + r) / CELL), 0, GC - 1);
  const y0 = clamp(Math.floor((y - r) / CELL), 0, GR - 1), y1 = clamp(Math.floor((y + r) / CELL), 0, GR - 1);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = grid[cy * GC + cx];
    for (let i = 0; i < c.length; i++) out.push(c[i]);
  }
  return out;
}
// Rejilla estática de obstáculos
const PCELL = 160;
let PG = [], PGC = 0;
function propGridBuild() {
  PGC = Math.ceil(WORLD / PCELL) + 1;
  PG = new Array(PGC * PGC); for (let i = 0; i < PG.length; i++) PG[i] = [];
  for (const p of S.props) {
    if (!p.solid) continue;
    PG[clamp(Math.floor(p.y / PCELL), 0, PGC - 1) * PGC + clamp(Math.floor(p.x / PCELL), 0, PGC - 1)].push(p);
  }
}
function collideProps(o) {
  const cx = Math.floor(o.x / PCELL), cy = Math.floor(o.y / PCELL);
  for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
    if (xx < 0 || yy < 0 || xx >= PGC || yy >= PGC) continue;
    for (const p of PG[yy * PGC + xx]) {
      const dx = o.x - p.x, dy = o.y - p.y, rr = o.r + p.r, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), k = (rr - d) / d; o.x += dx * k; o.y += dy * k; }
    }
  }
}
function insideProp(x, y, r) {
  const cx = Math.floor(x / PCELL), cy = Math.floor(y / PCELL);
  for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
    if (xx < 0 || yy < 0 || xx >= PGC || yy >= PGC) continue;
    for (const p of PG[yy * PGC + xx]) { const rr = r + p.r; if ((x - p.x) ** 2 + (y - p.y) ** 2 < rr * rr) return true; }
  }
  return false;
}

// =====================================================================
//  PARTIDA
// =====================================================================
// Curva de experiencia: niveles rápidos al principio y cada vez más lentos (fin del bosque ≈ nivel 14-16 en Normal)
function xpNeed(l) { return Math.floor(12 + l * 7 + Math.pow(l, 1.85)); }

function startRun(clsId, startLvl, endless) {
  const C0 = CLASSES[clsId], cu = heroCustom(clsId);
  const C = Object.assign({}, C0, { prim: C0.prims[cu.prim] || C0.prims[0], sec: C0.secs[cu.sec] || C0.secs[0] });
  P = {
    cls: clsId, C, x: WORLD / 2, y: WORLD / 2, r: 13, face: 1, aim: 0, moving: false,
    lvl: 1, xp: 0, xpNext: xpNeed(1), ups: {}, weapons: [],
    schools: Object.fromEntries(SCHOOL_KEYS.map(k => [k, 0])),
    atkT: 0, secT: 0, ult: 0, ultT: 0, dashCh: 1, dashRe: 0, dashT: 0, dvx: 0, dvy: 0,
    iframes: 0, hurtFlash: 0, walkT: 0, critCharges: 0, stormT: 1.5, frostT: 0, whirl: 0, whirlT: 0,
    rerolls: 1, revive: 0, pal: heroPal(clsId), vx: 0, vy: 0, chillT: 0, terrT: 0, warcryT: 0, smokeT: 0, zoneSlow: 1, healAcc: 0, hyb: {}, powerT: 0, dashId: 0,
  };
  P.b = {
    dmg: 1, atkSpd: 1, area: 1, projSpd: 1, proj: 0, pierce: 0,
    crit: C.crit + (C.prim.id === 'ballesta' ? 0.15 : 0), critMult: 2, maxHp: C.hp, regen: 0, armor: C.armor,
    lifesteal: 0, dodge: 0, speed: 1, magnet: 95,
    xp: 1, cdr: 0, dashes: 1, luck: 0,
    burnCh: 0, burnDmg: 1, burnBonus: 0, slow: 0, freezeCh: 0, chainCh: 0, chainJumps: 2, chainDmg: 0.6,
    thorns: 0, souls: 1, shield: C.shield || 0, shRegen: 1,
  };
  P.schools[C.school] = 1;
  recalc();
  P.hp = P.s.maxHp; P.dashCh = P.s.dashes; P.sh = P.s.shieldMax; P.shDelay = 0; P.healBudget = 0; P.woundT = 0; P.campT = 0; P.anchor = null;
  P.dpsEst = estimateDps();
  const DF = DIFFS[SAVE.settings.diff] || DIFFS.normal;
  S = { kills: 0, souls: 0, runTime: 0, mods: { hp: DF.hp, spawn: DF.spawn, xp: DF.xp, dmg: DF.dmg, soul: 1 }, diff: DF, endless: !!endless, press: 0, pressT: 0, pendingLv: 0, startLvl: endless ? 0 : startLvl, cleared: 0, dmgDone: 0, dmgBy: {}, chestQueue: [], soulsEarned: 0, shopBuys: {}, combo: 0, comboT: 0, bestCombo: 0, hemo: 0 };
  if (!endless && startLvl > 0) {  // niveles de prueba: empiezas con subidas de nivel acumuladas
    S.pendingLv = startLvl === 1 ? 9 : 19;
    P.lvl += S.pendingLv; P.xpNext = xpNeed(P.lvl);
  }
  loadLevel(endless ? -1 : startLvl);
  mode = 'play';
}

// Nivel "virtual" del modo Hordas Infinitas: sus valores cambian con el tiempo y el bioma que pisas
function makeEndlessLevel() {
  return Object.assign({}, LEVELS[0], {
    n: 'Hordas Infinitas', sub: 'Modo infinito', events: [], boss: 'slimeKing',
    hp: 1, dmg: 1, rate: 1, xp: 1,
  });
}
// Patrones de suelo de los 3 biomas (se crean una vez)
let GROUND_PATS = null;
function groundPats() {
  if (GROUND_PATS) return GROUND_PATS;
  return (GROUND_PATS = LEVELS.map((L, i) => {
    const p = ctx.createPattern(makeGround(L.ground, 7 + i * 13), 'repeat');
    if (p.setTransform) p.setTransform(new DOMMatrix().scale(3));
    return p;
  }));
}

function loadLevel(i) {
  const endless = i < 0, L = endless ? makeEndlessLevel() : LEVELS[i];
  Object.assign(S, {
    lvlIdx: endless ? 0 : i, L, t: 0, curBio: 0, nextBoss: 180, bossN: 0, asc: 0, evT: 45, puzzles: 0, time: 0, phase: 'waves', enemies: [], proj: [], eproj: [], parts: [], texts: [],
    gems: [], picks: [], fx: [], boss: null, portal: null, spawnAcc: 0, evIdx: 0, booms: [],
    slowmo: 0, shake: 0, banner: null, nextId: 1, embers: [], timeSlow: 0,
  });
  genMap(L, endless);                 // define WORLD según el modo
  P.x = WORLD / 2 + TILE / 2; P.y = WORLD / 2 + TILE / 2; P.dashT = 0; P.iframes = 1.5; P.vx = P.vy = 0;
  cam.x = P.x; cam.y = P.y;
  S.props = MAP.props; S.decals = MAP.decals; S.shrines = MAP.shrines;
  for (const ch of MAP.chests) S.picks.push(ch);
  propGridBuild();
  gridInit();
  S.groundPats = groundPats();
  if (endless) banner('∞ Hordas Infinitas', 'Bosque, cripta y forja en un solo mapa. ¿Cuánto resistes?', 3.5, '#ffb020');
  else banner(L.n, L.sub + ' — explora, sobrevive ' + LEVEL_TIME + 's y derrota al jefe', 3);
  AU.music(L.music);
}

// --------- Estadísticas efectivas (base + escuelas) ---------
function recalc() {
  const b = P.b, sc = P.schools, s = Object.assign({}, b);
  if (sc.fuego >= 3) s.burnCh += 0.2;
  if (sc.fuego >= 9) { s.burnCh = Math.max(1, s.burnCh); s.burnDmg *= 2; }
  if (sc.hielo >= 3) s.slow += 0.3;
  if (sc.hielo >= 6) s.freezeCh += 0.12;
  if (sc.hielo >= 9) s.armor += 5;
  if (sc.tormenta >= 3) s.chainCh += 0.15;
  if (sc.tormenta >= 6) s.chainJumps += 3;
  if (sc.sangre >= 3) s.lifesteal += 0.03;
  if (sc.sangre >= 6) s.maxHp += 50;
  if (sc.sombra >= 3) s.crit += 0.1;
  if (sc.sombra >= 6) s.critMult += 1;
  if (sc.sombra >= 9) s.dodge += 0.2;
  if (sc.arcano >= 3) s.proj += 1;
  if (sc.arcano >= 6) s.cdr += 0.2;
  // sinergias híbridas
  const H = P.hyb = {};
  for (const h of HYBRIDS) if (sc[h.a] >= 3 && sc[h.b] >= 3) H[h.id] = true;
  if (H.brasaosc) s.critMult += 0.1;
  if (H.supercond) s.chainJumps += 2;
  if (H.corhielo) s.armor += 3;
  if (H.prisma) { s.pierce += 1; s.slow += 0.15; }
  if (H.adrenalina) { s.atkSpd += 0.15; s.speed += 0.1; }
  if (H.sobrecarga) { s.proj += 1; s.chainCh += 0.1; }
  if (H.hemomancia) s.area += 0.2;
  if (H.ilusion) { s.crit += 0.1; s.critMult += 0.3; s.cdr += 0.1; }
  s.dodge = Math.min(0.6, s.dodge); s.cdr = Math.min(0.65, s.cdr); s.slow = Math.min(0.7, s.slow);
  s.crit = Math.min(0.8, s.crit); s.critMult = Math.min(4, s.critMult); s.proj = Math.min(6, s.proj);
  s.area = Math.min(2.6, s.area); s.lifesteal = Math.min(0.12, s.lifesteal);
  s.shield = Math.min(0.8, s.shield); s.shieldMax = Math.round(s.maxHp * s.shield);
  s.chainCh = Math.min(0.5, s.chainCh); s.chainJumps = Math.min(6, s.chainJumps); s.chainDmg = Math.min(1, s.chainDmg);
  if (s.atkSpd > 2) s.atkSpd = 2 + (s.atkSpd - 2) * 0.5;   // más allá de x2, rinde la mitad
  s.maxHp = Math.round(s.maxHp);
  const prev = P.s ? P.s.maxHp : s.maxHp;
  P.s = s;
  if (P.hp !== undefined) {
    if (s.maxHp > prev) P.hp += s.maxHp - prev;
    P.hp = Math.min(P.hp, s.maxHp);
  }
}
function addSchool(sch, n) {
  if (!sch) return;
  const before = P.schools[sch], oldH = Object.assign({}, P.hyb);
  P.schools[sch] += n;
  for (const th of [3, 6, 9]) {
    if (before < th && P.schools[sch] >= th) {
      const SC = SCHOOLS[sch];
      banner(`${SC.ic} ${SC.n} ${['I', 'II', 'III'][th / 3 - 1]}`, SC.tiers[th / 3 - 1], 2.6, SC.c);
      AU.sfx('tier');
      ring(P.x, P.y, 20, 260, 0.6, SC.c);
    }
  }
  recalc();
  for (const h of HYBRIDS) if (P.hyb[h.id] && !oldH[h.id]) {
    banner(`${h.ic} Sinergia: ${h.n}`, h.d, 3, '#ffb020');
    ring(P.x, P.y, 20, 320, 0.7, '#ffb020', 8);
    AU.sfx('tier');
  }
}

// =====================================================================
//  EFECTOS VISUALES
// =====================================================================
function banner(t, sub, dur, col) { if (S) S.banner = { t, sub, life: dur || 2, max: dur || 2, col: col || '#fff' }; }
function part(x, y, col, n, spd, life, size, grav) {
  const cap = LOWQ() ? 300 : 700;
  for (let i = 0; i < n && S.parts.length < cap; i++) {
    const a = Math.random() * TAU, v = Math.random() * spd;
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * rnd(0.6, 1), max: life, s: size || 3, col, g: grav || 0 });
  }
}
function txt(x, y, t, col, size) {
  if (!SAVE.settings.dmgNums && size < 18) return;
  if (S.texts.length > (LOWQ() ? 60 : 140)) return;
  S.texts.push({ x: x + rnd(-8, 8), y, t, col, s: size || 14, life: 0.7, vy: -60 });
}
function ring(x, y, r0, r1, life, col, w) { S.fx.push({ k: 'ring', x, y, r0, r1, t: 0, life, col, w: w || 4 }); }
function bolt(x0, y0, x1, y1, col) {
  const pts = [x0, y0], n = 6;
  for (let i = 1; i < n; i++) { const f = i / n; pts.push(x0 + (x1 - x0) * f + rnd(-14, 14), y0 + (y1 - y0) * f + rnd(-14, 14)); }
  pts.push(x1, y1);
  S.fx.push({ k: 'bolt', pts, t: 0, life: 0.16, col: col || '#ffe14a' });
}
function shake(v) { S.shake = Math.max(S.shake, v); }

// =====================================================================
//  COMBATE
// =====================================================================
function critChance() { return P.s.crit + (P.ultT > 0 && P.cls === 'picaro' ? 1 : 0); }
function dmgMul() { return P.s.dmg * (P.powerT > 0 ? 1.4 : 1) * (P.perfectT > 0 ? 1.25 : 1) * (P.warcryT > 0 ? 1.25 : 1) * (P.ultT > 0 && P.cls === 'guerrero' ? 1.6 : 1) * (P.schools.sangre >= 9 ? 1 + (1 - P.hp / P.s.maxHp) : 1); }

function hitEnemy(e, base, o) {
  o = o || {};
  if (e.dead || e.untarget) return;
  let d, crit = false;
  if (o.raw) d = base;
  else {
    d = base * dmgMul();
    if (e.burnT > 0) d *= 1 + P.s.burnBonus;
    if (P.hyb.termico && e.burnT > 0 && (e.slowT > 0 || e.freezeT > 0)) d *= 1.5;
    crit = o.crit !== undefined ? o.crit : Math.random() < critChance() + (o.critB || 0);
    if (crit) { d *= P.s.critMult; if (P.hyb.filogel && (e.slowT > 0 || e.freezeT > 0)) d *= 1.75; }
    d *= rnd(0.9, 1.1);
  }
  const dealt = Math.min(d, Math.max(0, e.hp)), src = o.src || SRC;
  e.hp -= d; e.flash = 0.08; S.dmgDone += dealt;
  S.dmgBy[src] = (S.dmgBy[src] || 0) + dealt;
  if (crit) { if (P.hyb.brasaosc) ignite(e); if (P.hyb.vampiro) heal(1); }
  if (o.burn && P.hyb.hirviente) heal(Math.min(d * 0.05, 2));
  if (crit) txt(e.x, e.y - e.r - 6, Math.round(d) + '!', '#ffd43b', 18);
  else txt(e.x, e.y - e.r - 6, Math.round(d), o.col || '#ffffff', 13);
  if (o.kb && !e.boss) {
    const k = o.kb * (1 - (e.def.kres || 0)) * (e.elite ? 0.3 : 1);
    e.kvx += o.kx * k; e.kvy += o.ky * k;
  }
  if (!o.noProc) {
    const s = P.s;
    if (Math.random() < s.burnCh) ignite(e);
    if (s.slow > 0) { e.slowT = 2; e.slowAmt = Math.max(e.slowAmt, s.slow); }
    if (!e.boss && Math.random() < s.freezeCh) e.freezeT = 1.3;
    if (S.chainT <= 0 && Math.random() < s.chainCh) { S.chainT = 0.06; chain(e, d * s.chainDmg, s.chainJumps); }   // máx. ~16 cadenas/seg
    const ls = s.lifesteal + (P.ultT > 0 && P.cls === 'guerrero' ? 0.05 : 0);
    if (ls > 0) heal(Math.min(d * ls, 6));
  }
  if (o.heal) heal(o.heal);
  AU.sfx(crit ? 'crit' : 'hit');
  if (e.hp <= 0) killEnemy(e);
}
function ignite(e) {
  e.burnT = 3;
  e.burnDps = Math.max(e.burnDps, 7 * P.s.burnDmg * P.s.dmg * (1 + P.lvl * 0.05));
}
function chain(from, dmg, jumps) {
  let cur = from; const hit = [from.id];
  for (let j = 0; j < jumps; j++) {
    let best = null, bd = 220 * 220;
    for (const e of query(cur.x, cur.y, 220)) {
      if (e.dead || e.untarget || hit.includes(e.id)) continue;
      const d2 = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    if (!best) break;
    bolt(cur.x, cur.y, best.x, best.y);
    hit.push(best.id);
    hitEnemy(best, dmg * (P.hyb.plasma ? 1.5 : 1), { raw: true, noProc: true, col: '#ffe14a', src: 'chain' });
    if (!best.dead) {
      if (P.hyb.plasma) ignite(best);
      if (P.hyb.supercond && !best.boss) best.freezeT = Math.max(best.freezeT, 0.5);
    }
    cur = best;
  }
  AU.sfx('zap');
}
// Curación: las "de golpe" (corazón, fuente, elixir…) son libres; las pasivas (robo de vida,
// regeneración, vampirismo…) comparten un tope por segundo y se reducen a la mitad tras recibir un golpe.
function healCap() { return P.s.maxHp * 0.025 + 2; }
function heal(v, burst) {
  if (P.hp >= P.s.maxHp) return;
  if (!burst) {
    if (P.woundT > 0) v *= 0.5;                 // herida reciente
    v = Math.min(v, P.healBudget);
    P.healBudget -= v;
    if (v <= 0) return;
  }
  P.hp = Math.min(P.s.maxHp, P.hp + v);
  P.healAcc += v;
}
function aoe(x, y, r, dmg, o) {
  for (const e of query(x, y, r).slice()) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d < r + e.r) hitEnemy(e, dmg, Object.assign({ kx: dx / (d || 1), ky: dy / (d || 1) }, o));
  }
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  S.kills++;
  S.combo++; S.comboT = 2.5; S.bestCombo = Math.max(S.bestCombo, S.combo);
  if ([25, 50, 100, 200, 400, 800].includes(S.combo)) comboMilestone(S.combo);
  if (P.hyb.hemomancia && S.kills % 25 === 0) S.hemo++;
  P.ult = Math.min(100, P.ult + (e.elite ? 12 : e.boss ? 0 : 0.8));
  part(e.x, e.y, e.def.blood || '#fff', LOWQ() ? 4 : 9, 160, 0.45, 3);
  AU.sfx('kill');
  if (e.boss) { bossDefeated(e); return; }
  // botín
  dropGem(e.x, e.y, e.xp);
  const luck = 1 + P.s.luck / 100;
  const count = k => { let c = 0; for (const p of S.picks) if (p.k === k) c++; return c; };
  if (Math.random() < 0.012 * luck && count('heart') < 3) { const sp = safeSpot(e.x, e.y); S.picks.push({ k: 'heart', x: sp.x, y: sp.y, life: 15 }); }
  if (Math.random() < 0.07 * luck) S.picks.push({ k: 'soul', x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6), v: e.elite ? 6 : 1, life: 30 });
  if (Math.random() < 0.0025 * luck && count('magnet') < 1) { const sp = safeSpot(e.x, e.y); S.picks.push({ k: 'magnet', x: sp.x, y: sp.y, life: 20 }); }
  if (e.guardian) { for (let i = 0; i < 8; i++) S.picks.push({ k: 'soul', x: e.x + rnd(-40, 40), y: e.y + rnd(-40, 40), v: 2 }); }
  else if (e.elite && (!e.randomElite || Math.random() < 0.35)) { const sp = safeSpot(e.x, e.y); S.picks.push({ k: 'chest', x: sp.x, y: sp.y, tier: 1 }); banner('¡Élite derrotado!', 'Recoge el cofre', 1.5, '#ffd43b'); }
  // escuelas
  const sc = P.schools;
  if (sc.fuego >= 6 && e.burnT > 0) S.booms.push({ x: e.x, y: e.y, r: 70 * P.s.area, d: (15 + P.lvl * 2.5) * P.s.dmg * (1 + P.s.burnBonus * 0.5), src: 'fuego' });   // escala con el jugador, no con el enemigo (evita reacciones en cadena infinitas)
  if (sc.hielo >= 6 && e.freezeT > 0) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; addProj({ x: e.x, y: e.y, a, spd: 420, dmg: 9, col: '#8ff3ff', k: 'shard', life: 0.5, pierce: 1, r: 6, src: 'hielo' }); }
  }
  if (sc.sangre >= 6) heal(1);
  if (e.def.split) for (let i = 0; i < 3; i++) {
    const n = spawnEnemy(e.def.split, e.x + rnd(-20, 20), e.y + rnd(-20, 20));
    if (n) { n.kvx = rnd(-200, 200); n.kvy = rnd(-200, 200); }
  }
}
function comboMilestone(n) {
  const rw = {
    25: ['+15 de definitiva', () => { P.ult = Math.min(100, P.ult + 15); }],
    50: ['Curación 20% y +15 definitiva', () => { heal(P.s.maxHp * 0.2, true); P.ult = Math.min(100, P.ult + 15); }],
    100: ['¡Imán total y +10 almas!', () => { for (const g of S.gems) g.mag = true; S.souls += 10; }],
    200: ['¡Cofre gratis!', () => { S.picks.push({ k: 'chest', x: P.x + rnd(-60, 60), y: P.y + rnd(-60, 60), tier: 1 }); }],
    400: ['¡Subida de nivel extra!', () => { S.pendingLv++; }],
    800: ['¡LEYENDA! Cofre del jefe', () => { S.picks.push({ k: 'chest', x: P.x + 50, y: P.y, tier: 3 }); }],
  }[n];
  rw[1]();
  banner(`🔥 ¡Racha x${n}!`, rw[0], 2, '#ff9a3a');
  AU.sfx('tier');
}
function comboMul() { return 1 + Math.min(S.combo, 30) * 0.005; }   // máximo +15%
// Los voladores (el Liche, murciélagos…) pueden morir sobre un muro: el cofre se mueve al suelo más cercano
function safeSpot(x, y) {
  if (!isWall(x, y) && MAP.flow[tIdx(x, y)] >= 0) return { x, y };
  return randomFloorAround(x, y, 40, 260, 40) || randomFloorAround(P.x, P.y, 40, 160, 40) || { x: P.x, y: P.y };
}
function dropGem(x, y, v) {
  v *= S.L.xp * S.mods.xp;
  S.gems.push({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), v, mag: false, sp: 0, life: 40 });   // si no la recoges en 40s, se desvanece
}

function hurtPlayer(d, src, dot) {
  if (!dot && (P.iframes > 0 || (P.ultT > 0 && P.cls === 'picaro') || P.dashT > 0)) return;
  if (!dot && (P.smokeT > 0 || Math.random() < P.s.dodge)) { txt(P.x, P.y - 30, 'Esquiva', '#c38bff', 14); P.iframes = 0.25; AU.sfx('dodge'); return; }
  if (P.inZone === 'maldita') d *= 1.3;
  const arm = P.s.armor + (P.warcryT > 0 ? 8 : 0);
  d = Math.max(d * 0.25, d - arm);
  P.woundT = 1.5;
  P.shDelay = 4 / P.s.shRegen;                  // el escudo espera 4 s sin golpes para reconstruirse
  if (P.sh > 0) {
    const ab = Math.min(P.sh, d); P.sh -= ab; d -= ab;
    if (!dot) txt(P.x, P.y - 44, '-' + Math.round(ab), '#8ff3ff', 14);
    if (P.sh <= 0) {                             // escudo roto
      P.sh = 0; ring(P.x, P.y, 10, 70, 0.35, '#8ff3ff', 5);
      part(P.x, P.y - 10, '#bfefff', 18, 260, 0.5, 4); AU.sfx('crit');
      txt(P.x, P.y - 58, '¡Escudo roto!', '#8ff3ff', 18);
    }
    if (d <= 0) { if (!dot) { P.iframes = 0.35; AU.sfx('hit'); } return; }
  }
  P.hp -= d;
  if (!dot) {
    P.iframes = 0.55; P.hurtFlash = 0.25; shake(8); AU.sfx('hurt');
    txt(P.x, P.y - 30, '-' + Math.round(d), '#ff4a4a', 16);
    if (src && P.s.thorns > 0 && !src.dead) hitEnemy(src, P.s.thorns, { noProc: true, src: 'espinas' });
    if (P.hyb.corhielo) {
      for (const e of query(P.x, P.y, 170)) if (!e.boss && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 170 * 170) e.freezeT = 1.2;
      ring(P.x, P.y, 10, 170, 0.35, '#8ff3ff');
    }
    if (P.schools.sangre >= 9) { aoe(P.x, P.y, 170 * P.s.area, 35, { noProc: true, col: '#ff3b5c', kb: 300, src: 'sangre' }); ring(P.x, P.y, 10, 170 * P.s.area, 0.35, '#ff3b5c'); }
  }
  if (P.hp <= 0) {
    if (P.revive > 0) {
      P.revive--; P.hp = P.s.maxHp * 0.5; P.iframes = 2.5;
      banner('🪶 ¡Fénix!', 'Has renacido', 2, '#ffb020');
      aoe(P.x, P.y, 300, 200, { noProc: true, kb: 600, src: 'fenix' }); ring(P.x, P.y, 10, 300, 0.6, '#ffb020', 8);
    } else { P.hp = 0; gameOver(false); }
  }
}

// =====================================================================
//  JUGADOR
// =====================================================================
function mouseWorld() { return { x: cam.x + (mouse.x - W / 2) / ZOOM, y: cam.y + (mouse.y - H / 2) / ZOOM }; }

function updatePlayer(dt) {
  const s = P.s;
  let mx = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  let my = ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - ((keys.KeyW || keys.ArrowUp) ? 1 : 0);
  const l = Math.hypot(mx, my); if (l) { mx /= l; my /= l; }
  if (TOUCH.on && (TOUCH.mx || TOUCH.my)) { mx = TOUCH.mx; my = TOUCH.my; }   // stick izquierdo (analógico)
  P.mx = mx; P.my = my; P.moving = mx !== 0 || my !== 0;
  const mw = mouseWorld();
  P.aim = Math.atan2(mw.y - P.y, mw.x - P.x);
  P.face = Math.cos(P.aim) >= 0 ? 0 : 1;

  SRC = 'prim';
  P.iframes -= dt; P.hurtFlash -= dt; P.secT -= dt; P.powerT -= dt; P.perfectT = (P.perfectT || 0) - dt; P.perfectCd = (P.perfectCd || 0) - dt;
  if (P.s.singular) { P.singT = (P.singT || 12) - dt; if (P.singT <= 0) { P.singT = 12; for (const g of S.gems) g.mag = true; ring(P.x, P.y, 10, 300, 0.5, '#7a5aff', 6); } }
  if (P.ultT > 0) { P.ultT -= dt; ultTick(dt); }
  if (P.dashCh < s.dashes) { P.dashRe += dt; if (P.dashRe >= dashCd()) { P.dashRe = 0; P.dashCh++; } }

  if (P.dashT > 0) {
    P.dashT -= dt;
    P.x += P.dvx * dt; P.y += P.dvy * dt;
    if (Math.random() < 0.8) part(P.x, P.y, P.schools.tormenta >= 6 ? '#ffe14a' : '#c9d6ff', 1, 30, 0.3, 4);
    if (P.hyb.fantasma) for (const e of query(P.x, P.y, 40).slice()) {
      if (e.dead || e.dashHit === P.dashId || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > (40 + e.r) ** 2) continue;
      e.dashHit = P.dashId;
      hitEnemy(e, 25, { src: 'fantasma', col: '#c38bff' });
    }
  } else {
    const tt = tileAt(P.x, P.y);
    const spd = P.C.spd * s.speed * (P.ultT > 0 && P.cls === 'picaro' ? 1.4 : 1) * P.zoneSlow
      * (tt === TSLOW ? 0.55 : 1) * (P.chillT > 0 ? 0.5 : 1);
    const acc = tt === TICE ? 2.2 : 40;   // en hielo cuesta frenar y girar
    P.vx += (mx * spd - P.vx) * Math.min(1, dt * acc); P.vy += (my * spd - P.vy) * Math.min(1, dt * acc);
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (tt === TSLOPE) { const a = MAP.dir[tIdx(P.x, P.y)] || 0; P.x += Math.cos(a) * 130 * dt; P.y += Math.sin(a) * 130 * dt; }
    if (tt === THURT) { P.terrT -= dt; if (P.terrT <= 0) { P.terrT = 0.5; hurtPlayer(terAt(P.x, P.y).hurt[2] * 0.5 * S.L.dmg, null, true); } }
    if (P.moving) P.walkT += dt * 12;
  }
  P.zoneSlow = 1;
  P.chillT -= dt; P.warcryT -= dt; P.smokeT -= dt;
  collideProps(P);
  collideWalls(P);
  P.x = clamp(P.x, 30, WORLD - 30); P.y = clamp(P.y, 30, WORLD - 30);
  if (s.regen > 0) heal(s.regen * dt);

  // ataque primario
  P.atkT -= dt;
  if ((mouse.l || SAVE.settings.auto) && P.atkT <= 0) {
    const rate = P.C.prim.rate * s.atkSpd * (P.ultT > 0 && P.cls === 'guerrero' ? 1.5 : 1) * (P.powerT > 0 ? 1.25 : 1)
      * (P.hyb.adrenalina && P.hp < s.maxHp * 0.5 ? 1.15 : 1);
    P.atkT = 1 / rate;
    primary();
  }
  if (mouse.r) trySecondary();
  if (P.whirl > 0) {
    P.whirlT -= dt;
    if (P.whirlT <= 0) {
      P.whirl--; P.whirlT = 0.18; SRC = 'sec';
      const R = 140 * s.area;
      aoe(P.x, P.y, R, P.C.prim.dmg * 1.1, { kb: 350 });
      S.fx.push({ k: 'spin', x: P.x, y: P.y, r: R, t: 0, life: 0.2, col: '#ffffff' });
      AU.sfx('slash');
    }
  }
  // escuelas de nivel III
  if (P.schools.tormenta >= 9) {
    P.stormT -= dt;
    if (P.stormT <= 0) {
      P.stormT = 1.5;
      for (const e of nearest(P.x, P.y, 3, 520)) { bolt(e.x, e.y - 400, e.x, e.y, '#fff7a0'); hitEnemy(e, 40, { col: '#ffe14a', src: 'tormenta' }); }
      AU.sfx('zap');
    }
  }
  if (P.schools.hielo >= 9) {
    P.frostT -= dt;
    if (P.frostT <= 0) {
      P.frostT = 0.5;
      for (const e of query(P.x, P.y, 200)) if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 200 * 200) { e.slowT = 1; e.slowAmt = Math.max(e.slowAmt, 0.45); }
    }
  }
  // feedback de curación
  if (P.healAcc >= 5) { txt(P.x, P.y - 34, '+' + Math.round(P.healAcc), '#5bff8a', 13); P.healAcc = 0; }
  const cap = healCap();
  P.healBudget = Math.min(cap, P.healBudget + cap * dt);
  P.woundT -= dt;
  if (s.shieldMax > 0) {
    if (P.shDelay > 0) P.shDelay -= dt;
    else if (P.sh < s.shieldMax) {
      if (P.sh === 0) { AU.sfx('pick'); ring(P.x, P.y, 40, 10, 0.4, '#8ff3ff', 3); }
      P.sh = Math.min(s.shieldMax, P.sh + s.shieldMax * 0.5 * s.shRegen * dt);   // se llena en ~2 s
    }
  } else P.sh = 0;
  // Grietas del Abismo: quedarse quieto más de 5 s abre grietas bajo tus pies
  if (!P.anchor || (P.x - P.anchor.x) ** 2 + (P.y - P.anchor.y) ** 2 > 190 * 190) { P.anchor = { x: P.x, y: P.y }; P.campT = 0; }
  else if (S.t > 15 && S.phase !== 'cleared') {
    P.campT += dt;
    if (P.campT > 5) {
      P.crackT = (P.crackT || 0) - dt;
      if (P.crackT <= 0) {
        P.crackT = Math.max(0.7, 1.6 - (P.campT - 5) * 0.08);   // cada vez más seguido
        if (!S.crackWarned) { S.crackWarned = true; banner('⚠ El Abismo se agrieta', 'No te quedes quieto: muévete por el mapa', 2.4, '#ff5a3a'); }
        const n = P.campT > 12 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const x = P.x + (i ? rnd(-140, 140) : rnd(-40, 40)), y = P.y + (i ? rnd(-140, 140) : rnd(-40, 40));
          S.fx.push({ k: 'warn', x, y, r: 95, t: 0, delay: 1.05, dmg: P.s.maxHp * 0.14 + P.s.armor, col: '#ff3a1a' });
        }
      }
    }
  }
}

function dashCd() { return 1.3 * (1 - P.s.cdr * 0.5) * (P.hyb.fantasma ? 0.6 : 1); }
function addProj(o) {
  const cap = LOWQ() ? 350 : 700;
  if (S.proj.length >= cap) return;
  const sp = o.spd * (o.noSpd ? 1 : P.s.projSpd);
  S.proj.push({
    x: o.x, y: o.y, vx: Math.cos(o.a) * sp, vy: Math.sin(o.a) * sp, r: o.r || 7, dmg: o.dmg,
    pierce: o.pierce || 0, life: o.life * (o.noSpd ? 1 : Math.sqrt(P.s.projSpd)), col: o.col, k: o.k, hits: [],
    homing: o.homing || (P.schools.arcano >= 9 ? 4 : 0), bounce: o.bounce !== undefined ? o.bounce : (P.schools.arcano >= 9 ? 1 : 0),
    src: o.src || SRC, ignite: o.ignite, critB: o.critB || 0, forceCrit: o.forceCrit, heal: o.heal || 0, boom: o.boom || 0, kb: o.kb || 60, tgt: null, tt: 0,
  });
}

function primary() {
  const s = P.s, a = P.aim, C = P.C;
  SRC = 'prim';
  let forceCrit;
  if (P.critCharges > 0) { P.critCharges--; forceCrit = true; }
  if (C.prim.id === 'lanza') {
    const big = P.ultT > 0 ? 1.35 : 1, len = 175 * s.area * big, ca = Math.cos(a), sa = Math.sin(a);
    for (const e of query(P.x, P.y, len).slice()) {
      const dx = e.x - P.x, dy = e.y - P.y, along = dx * ca + dy * sa, perp = Math.abs(-dx * sa + dy * ca);
      if (along < -10 || along > len + e.r || perp > 24 * big + e.r) continue;
      hitEnemy(e, C.prim.dmg, { kx: ca, ky: sa, kb: 260, crit: forceCrit });
    }
    S.fx.push({ k: 'thrust', x: P.x, y: P.y, a, len, t: 0, life: 0.14, col: P.ultT > 0 ? '#ff5a3a' : '#ffffff' });
    for (let i = 0; i < s.proj; i++) {
      const off = (i - (s.proj - 1) / 2) * 0.12;
      addProj({ x: P.x, y: P.y, a: a + off, spd: 760, dmg: C.prim.dmg * 0.6, col: '#dfe8ff', k: 'bolt2', life: 0.35, pierce: 5 + s.pierce, r: 9, kb: 150, forceCrit });
    }
    AU.sfx('slash');
  } else if (C.prim.id === 'fuego') {
    const n = 1 + s.proj;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.16;
      addProj({ x: P.x, y: P.y - 6, a: a + off, spd: 420, dmg: C.prim.dmg, col: '#ff8a2a', k: 'fireball', life: 1.3, pierce: 0, r: 11, boom: 62, ignite: true, homing: P.schools.arcano >= 9 ? 4 : 0.6, forceCrit });
    }
    AU.sfx('shoot');
  } else if (C.prim.id === 'ballesta') {
    const n = 1 + s.proj;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.08;
      addProj({ x: P.x, y: P.y - 4, a: a + off, spd: 1000, dmg: C.prim.dmg, col: '#ffe9a8', k: 'bolt2', life: 0.8, pierce: 3 + s.pierce, r: 7, kb: 140, forceCrit });
    }
    AU.sfx('dagger');
  } else if (P.cls === 'guerrero') {
    const big = P.ultT > 0 ? 1.35 : 1;
    const R = 100 * s.area * big, half = 1.05;
    for (const e of query(P.x, P.y, R).slice()) {
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d > R + e.r) continue;
      if (Math.abs(angDiff(Math.atan2(dy, dx), a)) > half + e.r / Math.max(d, 1)) continue;
      hitEnemy(e, C.prim.dmg, { kx: dx / (d || 1), ky: dy / (d || 1), kb: 420, crit: forceCrit });
    }
    S.fx.push({ k: 'arc', x: P.x, y: P.y, a, r: R, half, t: 0, life: 0.16, col: P.ultT > 0 ? '#ff5a3a' : '#ffffff' });
    for (let i = 0; i < s.proj; i++) {
      const off = (i - (s.proj - 1) / 2) * 0.25;
      addProj({ x: P.x, y: P.y, a: a + off, spd: 520, dmg: C.prim.dmg * 0.6, col: '#dfe8ff', k: 'wave', life: 0.45, pierce: 3 + s.pierce, r: 16, kb: 200, forceCrit });
    }
    AU.sfx('slash');
  } else if (P.cls === 'mago') {
    const n = 1 + s.proj;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.13;
      addProj({ x: P.x, y: P.y - 6, a: a + off, spd: 540, dmg: C.prim.dmg, col: '#b066ff', k: 'bolt', life: 1.1, pierce: s.pierce, r: 8, homing: P.schools.arcano >= 9 ? 5 : 1.2, forceCrit });
    }
    AU.sfx('shoot');
  } else {
    const n = 2 + s.proj;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.09;
      addProj({ x: P.x, y: P.y - 4, a: a + off + rnd(-0.03, 0.03), spd: 720, dmg: C.prim.dmg, col: '#e0e6ff', k: 'dagger', life: 0.7, pierce: s.pierce, r: 6, forceCrit });
    }
    AU.sfx('dagger');
  }
}

function trySecondary() {
  if (P.secT > 0) return;
  const s = P.s;
  P.secT = P.C.sec.cd * (1 - s.cdr);
  SRC = 'sec';
  const id = P.C.sec.id;
  if (id === 'torbellino') { P.whirl = 3; P.whirlT = 0; }
  else if (id === 'grito') {
    const R = 230 * s.area;
    for (const e of query(P.x, P.y, R).slice()) {
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d > R + e.r) continue;
      hitEnemy(e, 20, { kx: dx / (d || 1), ky: dy / (d || 1), kb: 650 });
      if (!e.boss && !e.dead) e.freezeT = Math.max(e.freezeT, 1);
    }
    P.warcryT = 6;
    ring(P.x, P.y, 10, R, 0.45, '#ff5a3a', 10); shake(8); AU.sfx('ult');
  } else if (id === 'parpadeo') {
    const mw = mouseWorld();
    let dx = mw.x - P.x, dy = mw.y - P.y; const d = Math.hypot(dx, dy) || 1, D = Math.min(d, 340);
    dx /= d; dy /= d;
    let tx = P.x + dx * D, ty = P.y + dy * D;
    for (let k = 0; k < 20 && (isWall(tx, ty) || isWall(tx + 14, ty) || isWall(tx - 14, ty) || isWall(tx, ty + 14) || isWall(tx, ty - 14)); k++) { tx -= dx * 18; ty -= dy * 18; }
    const R = 120 * s.area;
    aoe(P.x, P.y, R, 30, { kb: 300 }); ring(P.x, P.y, 10, R, 0.35, '#b066ff', 6);
    part(P.x, P.y, '#b066ff', 16, 220, 0.4, 4);
    P.x = tx; P.y = ty; P.vx = P.vy = 0; P.iframes = Math.max(P.iframes, 0.4);
    aoe(P.x, P.y, R, 30, { kb: 300 }); ring(P.x, P.y, 10, R, 0.35, '#b066ff', 6);
    AU.sfx('dash');
  } else if (id === 'humo') {
    S.fx.push({ k: 'smoke', x: P.x, y: P.y, r: 165 * s.area, t: 0, life: 4, tick: 0 });
    P.smokeT = 2.5;
    part(P.x, P.y, '#9a9aa8', 30, 200, 0.8, 6);
    AU.sfx('dash');
  } else if (id === 'nova') {
    const R = 220 * s.area;
    for (const e of query(P.x, P.y, R).slice()) {
      const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
      if (d > R + e.r) continue;
      hitEnemy(e, 34, { kx: dx / (d || 1), ky: dy / (d || 1), kb: 250 });
      if (!e.boss && !e.dead) e.freezeT = 1.8;
    }
    ring(P.x, P.y, 10, R, 0.4, '#8ff3ff', 10);
    part(P.x, P.y, '#cfffff', 30, 380, 0.5, 4);
    AU.sfx('boom');
  } else {
    const n = 16 + s.proj * 2;
    for (let i = 0; i < n; i++) addProj({ x: P.x, y: P.y, a: i / n * TAU, spd: 650, dmg: 13, col: '#c38bff', k: 'dagger', life: 0.6, pierce: 2 + s.pierce, r: 6 });
    AU.sfx('slash');
  }
}

function tryUlt() {
  if (P.ult < 100 || P.ultT > 0) return;
  P.ult = 0;
  P.ultT = { guerrero: 8, mago: 5, picaro: 6 }[P.cls];
  P.ultAcc = 0;
  banner(P.C.ult.n, '', 1.6, '#ffb020');
  ring(P.x, P.y, 10, 380, 0.6, '#ffb020', 10);
  shake(10);
  AU.sfx('ult');
}
function ultTick(dt) {
  if (P.cls === 'mago') {
    P.ultAcc -= dt;
    if (P.ultAcc <= 0) {
      P.ultAcc = 0.12;
      const vis = S.enemies.filter(e => !e.dead && Math.abs(e.x - cam.x) < W / ZOOM / 2 && Math.abs(e.y - cam.y) < H / ZOOM / 2);
      const tg = vis.length ? pick(vis) : null;
      const x = tg ? tg.x : P.x + rnd(-300, 300), y = tg ? tg.y : P.y + rnd(-200, 200);
      S.fx.push({ k: 'meteor', x, y, r: 90 * P.s.area, dmg: 55, t: 0, delay: 0.45, col: '#ff8a2a', own: true, src: 'ult' });
    }
  }
}

function doDash() {
  if (P.dashCh <= 0 || P.dashT > 0) return;
  P.dashCh--;
  let dx = P.mx, dy = P.my;
  if (!dx && !dy) { dx = Math.cos(P.aim); dy = Math.sin(P.aim); }
  const sp = 1300;
  P.dvx = dx * sp; P.dvy = dy * sp; P.dashT = 0.15; P.dashId++; P.iframes = Math.max(P.iframes, 0.45);
  AU.sfx('dash');
  // Esquiva perfecta: si había una bala o un enemigo encima justo al hacer dash
  let close = S.eproj.some(b => (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < 85 * 85);
  if (!close) for (const e of S.enemies) if (!e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < (e.r + P.r + 26) ** 2) { close = true; break; }
  if (close && P.perfectCd <= 0) {
    P.perfectCd = 1.2; P.perfectT = 3; P.iframes = Math.max(P.iframes, 0.8);
    P.dashCh = Math.min(P.s.dashes, P.dashCh + 1);       // te devuelve la carga
    S.slowmo = Math.max(S.slowmo, 0.35);
    txt(P.x, P.y - 40, '¡Esquiva perfecta!', '#8ff3ff', 18);
    ring(P.x, P.y, 10, 140, 0.35, '#8ff3ff', 5);
    aoe(P.x, P.y, 120 * P.s.area, 20 + P.lvl * 3, { kb: 500, noProc: true, src: 'dash', col: '#8ff3ff' });   // onda de choque que escala con el nivel
    AU.sfx('tier');
  }
  if (P.schools.sombra >= 9) P.critCharges = 3;
  if (P.schools.tormenta >= 6) {
    for (const e of nearest(P.x, P.y, 4, 320)) { bolt(P.x, P.y, e.x, e.y); hitEnemy(e, 30, { col: '#ffe14a', src: 'tormenta' }); }
  }
}

function nearest(x, y, n, maxR) {
  const arr = [];
  for (const e of query(x, y, maxR)) {
    if (e.dead || e.untarget) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 < maxR * maxR) arr.push([d2, e]);
  }
  arr.sort((a, b) => a[0] - b[0]);
  return arr.slice(0, n).map(a => a[1]);
}

// =====================================================================
//  ARMAS AUTOMÁTICAS
// =====================================================================
function updateWeapons(dt) {
  const s = P.s;
  for (const w of P.weapons) {
    const L = w.lvl, ev = w.evo;
    w.t -= dt; SRC = w.id;
    switch (w.id) {
      case 'orbes': {
        const n = 1 + L + (ev ? 3 : 0);
        const R = (72 + L * 6) * s.area * (ev ? 1.35 : 1);
        w.ang = (w.ang || 0) + dt * (2.4 + L * 0.2);
        const dmg = (9 + L * 4) * (ev ? 2 : 1), hr = (ev ? 20 : 13) * Math.sqrt(s.area);
        w.pts = [];
        for (let i = 0; i < n; i++) {
          const a = w.ang + i * TAU / n, x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
          w.pts.push(x, y);
          for (const e of query(x, y, hr)) {
            if (e.dead || (e.x - x) ** 2 + (e.y - y) ** 2 > (hr + e.r) ** 2) continue;
            if ((e.orbT || 0) > S.time) continue;
            e.orbT = S.time + 0.4;
            hitEnemy(e, dmg, { kx: Math.cos(a), ky: Math.sin(a), kb: 160 });
            if (!e.dead && (ev || Math.random() < 0.3)) ignite(e);
          }
        }
        break;
      }
      case 'aura': {
        w.R = (85 + L * 15) * s.area * (ev ? 1.6 : 1);
        if (w.t <= 0) {
          w.t = 0.5;
          const dmg = (4 + L * 3) * (ev ? 2.2 : 1);
          for (const e of query(P.x, P.y, w.R).slice()) {
            if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > (w.R + e.r) ** 2) continue;
            hitEnemy(e, dmg, { noProc: true, col: '#8ff3ff' });
            e.slowT = 1; e.slowAmt = Math.max(e.slowAmt, ev ? 0.5 : 0.3);
            if (ev && !e.boss && Math.random() < 0.08) e.freezeT = 1.2;
          }
        }
        break;
      }
      case 'rayos': {
        if (w.t <= 0) {
          w.t = (2.0 - L * 0.18) * (1 - s.cdr) * (ev ? 0.5 : 1);
          const dmg = (16 + L * 8) * (ev ? 1.8 : 1);
          for (const e of nearest(P.x, P.y, L + 1 + (ev ? 2 : 0), 480)) {
            bolt(P.x, P.y - 20, e.x, e.y);
            hitEnemy(e, dmg, { col: '#ffe14a' });
            if (ev && !e.dead) chain(e, dmg * 0.7 * dmgMul(), 4);
            SRC = w.id;
          }
          AU.sfx('zap');
        }
        break;
      }
      case 'dagas': {
        if (w.t <= 0) {
          w.t = 1.0 * (1 - s.cdr);
          const n = L + 1 + (ev ? L + 1 : 0);
          const tg = nearest(P.x, P.y, n, 500);
          for (let i = 0; i < n; i++) {
            const e = tg[i % Math.max(1, tg.length)];
            const a = e ? Math.atan2(e.y - P.y, e.x - P.x) + rnd(-0.08, 0.08) : rnd(0, TAU);
            addProj({ x: P.x, y: P.y, a, spd: 640, dmg: (8 + L * 3) * (ev ? 1.8 : 1), col: '#c38bff', k: 'gdagger', life: 0.8, pierce: 1 + Math.floor(L / 2), r: 6, critB: 0.2, forceCrit: ev || undefined });
          }
        }
        break;
      }
      case 'craneos': {
        if (w.t <= 0) {
          w.t = 2.4 * (1 - s.cdr);
          const n = L + (ev ? L : 0);
          for (let i = 0; i < n; i++) addProj({ x: P.x, y: P.y, a: rnd(0, TAU), spd: 300, dmg: (14 + L * 6) * (ev ? 1.8 : 1), col: '#ff3b5c', k: 'skull', life: 2.5, r: 9, homing: 7, heal: 1, boom: ev ? 70 : 0, bounce: 0 });
        }
        break;
      }
      case 'meteoro': {
        if (w.t <= 0) {
          w.t = (3.6 - L * 0.3) * (1 - s.cdr);
          const n = 1 + (L >= 3 ? 1 : 0) + (ev ? 2 : 0);
          const cand = S.enemies.filter(e => !e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 600 * 600);
          for (let i = 0; i < n; i++) {
            const e = cand.length ? pick(cand) : null;
            const x = e ? e.x : P.x + rnd(-250, 250), y = e ? e.y : P.y + rnd(-250, 250);
            S.fx.push({ k: 'meteor', x, y, r: (70 + L * 10) * s.area * (ev ? 1.4 : 1), dmg: (30 + L * 15) * (ev ? 2 : 1), t: 0, delay: 0.55, col: '#6aa8ff', own: true, src: 'meteoro' });
          }
        }
        break;
      }
    }
  }
}

// =====================================================================
//  PROYECTILES
// =====================================================================
function updateProj(dt) {
  for (const p of S.proj) {
    p.life -= dt;
    if (p.life <= 0) continue;
    if (p.homing) {
      p.tt -= dt;
      if (p.tt <= 0 || !p.tgt || p.tgt.dead) {
        p.tt = 0.15;
        const n = nearest(p.x, p.y, 1, 340);
        p.tgt = n[0] || null;
      }
      if (p.tgt) {
        const sp = Math.hypot(p.vx, p.vy);
        const want = Math.atan2(p.tgt.y - p.y, p.tgt.x - p.x), cur = Math.atan2(p.vy, p.vx);
        const na = cur + clamp(angDiff(want, cur), -p.homing * dt, p.homing * dt);
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 0 || p.y < 0 || p.x > WORLD || p.y > WORLD) { p.life = 0; continue; }
    if (p.k !== 'skull' && isWall(p.x, p.y)) {   // los muros bloquean proyectiles
      p.life = 0; part(p.x, p.y, p.col, 3, 80, 0.2, 3);
      if (p.boom) { aoe(p.x, p.y, p.boom * P.s.area, p.dmg * 0.6, { noProc: true, src: p.src }); ring(p.x, p.y, 5, p.boom * P.s.area, 0.25, p.col); }
      continue;
    }
    for (const e of query(p.x, p.y, p.r)) {
      if (e.dead || e.untarget || p.hits.includes(e.id)) continue;
      const rr = e.r + p.r;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
      p.hits.push(e.id);
      const sp = Math.hypot(p.vx, p.vy) || 1;
      hitEnemy(e, p.dmg, { kx: p.vx / sp, ky: p.vy / sp, kb: p.kb, critB: p.critB, crit: p.forceCrit, heal: p.heal, src: p.src });
      if (p.ignite && !e.dead) ignite(e);
      if (P.hyb.piroclasto && p.k !== 'shard' && S.booms.length < 40) S.booms.push({ x: p.x, y: p.y, r: 45 * P.s.area, d: p.dmg * dmgMul() * 0.4, src: 'piroclasto', small: true });
      if (p.boom) { aoe(p.x, p.y, p.boom * P.s.area, p.dmg * 0.6, { noProc: true, col: p.col, src: p.src }); ring(p.x, p.y, 5, p.boom * P.s.area, 0.25, p.col); }
      if (p.pierce > 0) { p.pierce--; continue; }
      if (p.bounce > 0) {
        p.bounce--;
        const n = nearest(p.x, p.y, 4, 300).find(o => !p.hits.includes(o.id));
        if (n) { const a = Math.atan2(n.y - p.y, n.x - p.x); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.life = Math.max(p.life, 0.5); continue; }
      }
      p.life = 0; break;
    }
  }
  compact(S.proj, p => p.life > 0);

  for (const b of S.eproj) {
    b.life -= dt;
    const tsl = S.timeSlow > 0 ? 0.5 : 1;
    b.x += b.vx * dt * tsl; b.y += b.vy * dt * tsl;
    if (isWall(b.x, b.y)) { b.life = 0; continue; }
    const rr = b.r + P.r - 3;
    if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < rr * rr) {
      if (P.dashT <= 0 && P.iframes <= 0) { hurtPlayer(b.dmg, null); b.life = 0; }
    }
  }
  compact(S.eproj, b => b.life > 0);
}
function eShoot(x, y, a, spd, dmg, col, r) {
  if (S.eproj.length > 500) return;
  S.eproj.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: r || 7, dmg, col, life: 4 });
}

// =====================================================================
//  ENEMIGOS
// =====================================================================
// =====================================================================
//  RITMO DE COMBATE — estima tu DPS a un solo objetivo y acerca la vida
//  y el daño de los enemigos a unos tiempos objetivo:
//    normal 1-3 s · élite ~10 s · jefe 30 s o más · un golpe normal ≈ 6% de tu vida.
//  Es una media geométrica entre la fórmula de dificultad y el objetivo,
//  así mejorar tu daño o tu vida SIGUE notándose, pero nada se vuelve esponja.
// =====================================================================
function estimateDps() {
  const s = P.s, C = P.C, L = l => l;
  const crit = 1 + Math.min(0.8, s.crit) * (s.critMult - 1);
  const per = { mandoble: 1, lanza: 1, arcano: 1 + s.proj * 0.4, fuego: 1.4 + s.proj * 0.4, dagas: 1.6 + s.proj * 0.35, ballesta: 1 + s.proj * 0.4 }[C.prim.id] || 1;
  let dps = C.prim.dmg * C.prim.rate * s.atkSpd * per;
  const cd = Math.max(0.35, 1 - s.cdr);
  for (const w of P.weapons) {
    const l = L(w.lvl), ev = w.evo ? 2 : 1;
    dps += ev * ({
      orbes: (9 + 4 * l) * 1.2, aura: (4 + 3 * l) * 1.6, rayos: (16 + 8 * l) / ((2 - 0.18 * l) * cd),
      dagas: (8 + 3 * l) * (l + 1) * 0.5 / cd, craneos: (14 + 6 * l) * l / (2.4 * cd),
      meteoro: (30 + 15 * l) * (l >= 3 ? 2 : 1) / ((3.6 - 0.3 * l) * cd),
    }[w.id] || 0);
  }
  dps *= s.dmg * crit;
  if (s.burnCh > 0) dps += 7 * s.burnDmg * s.dmg * (1 + P.lvl * 0.05) * Math.min(1, s.burnCh);
  return dps * (1 + Math.min(0.5, s.chainCh) * Math.min(1, s.chainDmg) * 0.5);
}
// mezcla: valor de la fórmula ↔ objetivo, acotado a [objetivo·lo, objetivo·hi]
const pace = (formula, target, lo, hi) => clamp(Math.sqrt(Math.max(1, formula) * target), target * lo, target * hi);
function enemyHpTarget(d, elite) {
  const ttk = elite ? 10 : 2.4 * Math.pow(clamp(d.hp / 20, 0.4, 4), 0.5);   // limo ≈ 1.9 s, gólem ≈ 3.5 s
  return (P.dpsEst || 30) * ttk;
}
function enemyDmgTarget(d, elite) {
  return P.s.maxHp * 0.06 * clamp(d.dmg / 9, 0.6, 2.2) * (elite ? 1.4 : 1);
}

function spawnEnemy(type, x, y, elite) {
  const d = ENEMIES[type];
  const tm = S.endless ? 1 : 1 + S.t / 60 * 0.45, pr = S.press || 0;
  const ls = lvlScale();
  const hpF = d.hp * S.L.hp * tm * S.mods.hp * ls * (1 + pr * 0.6) * (elite ? 9 : 1);
  const dmgF = d.dmg * S.L.dmg * S.mods.dmg * (S.endless ? 1 : 1 + S.t / LEVEL_TIME * 0.3) * (1 + pr * 0.25) * (1 + (ls - 1) * 0.5) * (elite ? 1.5 : 1);
  const DF = S.diff || DIFFS.normal;
  const hp = pace(hpF, enemyHpTarget(d, elite) * DF.hp * (1 + pr * 0.4), 0.5, 2.2);
  const e = {
    id: S.nextId++, type, def: d, x, y, r: d.r * (elite ? 1.4 : 1), hp, maxHp: hp,
    spd: d.spd * rnd(0.9, 1.1), dmg: pace(dmgF, enemyDmgTarget(d, elite) * DF.dmg, 0.5, 1.8),
    xp: d.xp * (elite ? 15 : 1) / (1 + pr * 0.5) / (1 + P.lvl * 0.012) / (1 + (S.asc || 0) * 0.15),    sc: d.sc * (elite ? 1.4 : 1), spr: getSpr(d.spr, d.pal, elite), elite: !!elite,
    kvx: 0, kvy: 0, flash: 0, slowT: 0, slowAmt: 0, freezeT: 0, burnT: 0, burnDps: 0, burnTick: 0.5,
    t: rnd(0.5, 2), st: 'move', face: 0, wob: Math.random() * TAU, dead: false, z: 0,
  };
  S.enemies.push(e);
  return e;
}
function spawnRandomAround(type, elite) {
  const R = Math.hypot(W, H) / 2 / ZOOM + 60;
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * TAU, rr = R + rnd(0, 260);
    const x = clamp(P.x + Math.cos(a) * rr, 40, WORLD - 40), y = clamp(P.y + Math.sin(a) * rr, 40, WORLD - 40);
    if ((x - P.x) ** 2 + (y - P.y) ** 2 < 250 * 250) continue;
    const i = tIdx(x, y);
    if (i < 0 || MAP.t[i] === TW || (!ENEMIES[type].fly && (MAP.flow[i] < 0 || MAP.flow[i] > 26))) continue;
    if (!ENEMIES[type].fly && insideProp(x, y, ENEMIES[type].r)) continue;
    return spawnEnemy(type, x, y, elite);
  }
  return null;
}

function lvlScale() { return 1 + Math.max(0, P.lvl - 10) * 0.04; }   // el Abismo crece contigo
function director(dt) {
  const L = S.L, t = S.t;
  const maxE = LOWQ() ? 230 : 380;
  if (S.phase === 'waves') {
    const base = S.endless ? Math.min(15 + S.asc * 2, 1.4 + t * 0.022 + (t / 150) ** 2 * 0.4) : 1.0 + t * 0.05 + (t / 60) ** 2 * 0.6;
    const rate = base * L.rate * S.mods.spawn * (1 + S.press * 0.8) * (1 + P.lvl * 0.012);   // más monstruos a más nivel
    S.spawnAcc += rate * dt;
    const avail = L.spawns.filter(s => t >= s.t);
    while (S.spawnAcc >= 1) {
      S.spawnAcc--;
      if (S.enemies.length >= maxE) continue;
      // tras una ascensión, las hordas del infinito mezclan enemigos de los 3 biomas
      const list = S.endless && S.asc > 0 && Math.random() < 0.3 ? pick(LEVELS).spawns.filter(s => t >= s.t) : avail;
      const eliteCh = 0.001 + P.lvl * 0.0001 + (S.asc || 0) * 0.002;
      const e = spawnRandomAround(wpick(list.length ? list : avail, s => s.w).e, Math.random() < eliteCh);
      if (e && e.elite) e.randomElite = true;
    }
    const ev = L.events[S.evIdx];
    if (ev && t >= ev.t) {
      S.evIdx++;
      if (ev.k === 'ring') {
        banner('¡Horda!', 'Te están rodeando', 1.6, '#ff6a5a');
        for (let i = 0; i < ev.n; i++) {
          const a = i / ev.n * TAU, R = 420;
          const x = clamp(P.x + Math.cos(a) * R, 40, WORLD - 40), y = clamp(P.y + Math.sin(a) * R, 40, WORLD - 40);
          if (!isWall(x, y)) spawnEnemy(ev.e, x, y);
        }
      } else if (ev.k === 'elite') {
        banner('¡Élite!', 'Un enemigo poderoso se acerca', 1.8, '#ffd43b');
        spawnRandomAround(ev.e, true);
      }
    }
    if (!S.endless && t >= LEVEL_TIME) startBoss();
  } else if (S.phase === 'boss') {
    S.spawnAcc += (1.6 + S.lvlIdx * 0.6) * dt;
    const avail = L.spawns;
    while (S.spawnAcc >= 1) { S.spawnAcc--; if (S.enemies.length < maxE * 0.5) spawnRandomAround(wpick(avail, s => s.w).e); }
  }
}

// Presión del Abismo: si arrasas con todo sin recibir daño, el Abismo se enfada
// (más enemigos, más resistentes). Si vas mal, se calma. Mantiene el reto sin romperlo.
function pressureTick(dt) {
  S.pressT -= dt;
  if (S.pressT > 0) return;
  S.pressT = 1;
  P.dpsEst = P.dpsEst ? P.dpsEst * 0.7 + estimateDps() * 0.3 : estimateDps();
  const hpF = P.hp / P.s.maxHp;
  let near = 0; for (const e of S.enemies) if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 520 * 520) near++;
  if (hpF > 0.7 && near < 14) S.press += 0.035;
  else if (hpF < 0.35) S.press -= 0.1;
  else if (near > 40) S.press -= 0.03;
  S.press = clamp(S.press, 0, 1);
}
// Modo infinito: dificultad que sube sin parar, bioma según dónde estés, jefes cada 3 min
function endlessTick(dt) {
  const t = S.t, thr = Math.floor(t / 30);
  S.threat = thr + 1;
  S.L.hp = Math.pow(1.1, t / 30) * (1 + t / 120);
  S.L.dmg = Math.pow(1.06, t / 30);
  S.L.xp = 1 + t / 420;
  S.lvlIdx = Math.min(2, Math.floor(t / 240));
  const b = bioAt(P.x, P.y);
  if (b !== S.curBio) {
    S.curBio = b;
    const LB = LEVELS[b];
    Object.assign(S.L, { biome: LB.biome, bg: LB.bg, spawns: LB.spawns, music: LB.music });
    if (S.phase !== 'boss') AU.music(LB.music);
    banner(LB.n, 'Nuevo bioma: otros enemigos y peligros', 1.6, '#ccc');
  }
  if (S.phase === 'waves') {
    S.nextBoss -= dt;
    if (S.nextBoss <= 0) { S.L.boss = ['slimeKing', 'lich', 'forge'][S.bossN % 3]; startBoss(); }
    S.evT -= dt;
    if (S.evT <= 0) {
      S.evT = rnd(35, 55);
      const ty = pick(S.L.spawns).e;
      if (Math.random() < 0.6) {
        banner('¡Horda!', 'Te están rodeando', 1.6, '#ff6a5a');
        const n = Math.min(60, 18 + thr * 2);
        for (let i = 0; i < n; i++) { const a = i / n * TAU, x = clamp(P.x + Math.cos(a) * 420, 40, WORLD - 40), y = clamp(P.y + Math.sin(a) * 420, 40, WORLD - 40); if (!isWall(x, y)) spawnEnemy(ty, x, y); }
      } else { banner('¡Élite!', 'Un enemigo poderoso se acerca', 1.8, '#ffd43b'); spawnRandomAround(ty, true); }
    }
  }
}

function updateEnemies(dt) {
  const px = P.x, py = P.y;
  for (const e of S.enemies) {
    if (e.dead) continue;
    if (e.boss) { updateBoss(e, dt); continue; }
    e.flash -= dt;
    // estados
    if (e.burnT > 0) {
      e.burnT -= dt; e.burnTick -= dt;
      if (e.burnTick <= 0) { e.burnTick = 0.5; hitEnemy(e, e.burnDps * 0.5, { raw: true, noProc: true, col: '#ff8a2a', src: 'burn', burn: true }); if (e.dead) continue; }
      if (Math.random() < 0.15) part(e.x + rnd(-6, 6), e.y - e.r, '#ff8a2a', 1, 20, 0.4, 3, -80);
    } else e.burnDps = 0;
    if (e.slowT > 0) e.slowT -= dt; else e.slowAmt = 0;
    let mv = (1 - e.slowAmt) * (S.timeSlow > 0 ? 0.5 : 1);
    if (e.freezeT > 0) { e.freezeT -= dt; mv = 0; }
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
    let nx = dx / d, ny = dy / d, vx = 0, vy = 0;
    e.face = dx >= 0 ? 0 : 1;
    const D = e.def, walker = !D.fly && D.ai !== 'ghost';
    if (walker && navDir(e)) { nx = NAV[0]; ny = NAV[1]; }   // rodea muros con el campo de flujo
    if (walker) {
      const tt = MAP.t[tIdx(e.x, e.y)];
      if (tt === TSLOW) mv *= 0.6;
      else if (tt === TSLOPE) { const a = MAP.dir[tIdx(e.x, e.y)]; e.x += Math.cos(a) * 90 * dt; e.y += Math.sin(a) * 90 * dt; }
      else if (tt === THURT) { e.terrT = (e.terrT || 0) - dt; if (e.terrT <= 0) { e.terrT = 0.5; hitEnemy(e, 8 * (1 + S.lvlIdx), { raw: true, noProc: true, src: 'terreno', col: '#ff9a6a' }); if (e.dead) continue; } }
    }
    if (e.guardian) guardianTick(e, dt);
    if (mv > 0) {
      e.t -= dt;
      switch (D.ai) {
        case 'chase': case 'ghost': vx = nx * e.spd; vy = ny * e.spd; break;
        case 'bat': {
          e.wob += dt * 6;
          vx = (nx + Math.cos(e.wob) * 0.6 * -ny) * e.spd; vy = (ny + Math.cos(e.wob) * 0.6 * nx) * e.spd; break;
        }
        case 'ranged': case 'radial': {
          const pref = D.range;
          const k = d > pref + 40 ? 1 : d < pref - 60 ? -0.8 : 0;
          vx = (nx * k - ny * 0.35) * e.spd; vy = (ny * k + nx * 0.35) * e.spd;
          if (e.t <= 0 && d < pref + 220) {
            e.t = D.fire * rnd(0.85, 1.15);
            const bd = e.dmg * 0.8;
            if (D.ai === 'radial') { const off = Math.random() * TAU; for (let i = 0; i < D.n; i++) eShoot(e.x, e.y, off + i / D.n * TAU, D.bspd, bd, D.bcol); }
            else { const n = D.spread || 1; for (let i = 0; i < n; i++) eShoot(e.x, e.y, Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.22, D.bspd, bd, D.bcol); }
            if (e.elite && !e.guardian) for (let i = 0; i < 6; i++) eShoot(e.x, e.y, i / 6 * TAU, D.bspd * 0.8, bd, D.bcol);
            AU.sfx('ebullet');
          }
          break;
        }
        case 'charger': {
          if (e.st === 'move') {
            vx = nx * e.spd; vy = ny * e.spd;
            if (e.t <= 0 && d < 380) { e.st = 'wind'; e.t = 0.6; e.ca = Math.atan2(dy, dx); }
          } else if (e.st === 'wind') {
            if (e.t <= 0) { e.st = 'charge'; e.t = 0.55; }
          } else if (e.st === 'charge') {
            vx = Math.cos(e.ca) * e.spd * 5.5; vy = Math.sin(e.ca) * e.spd * 5.5;
            if (Math.random() < 0.5) part(e.x, e.y + e.r * 0.5, '#a08060', 1, 40, 0.3, 4);
            if (e.t <= 0) { e.st = 'move'; e.t = rnd(2, 3.5); }
          }
          break;
        }
        case 'exploder': {
          vx = nx * e.spd; vy = ny * e.spd;
          if (d < e.r + P.r + 14) {
            e.dead = true;
            ring(e.x, e.y, 5, 70, 0.3, '#ff8a2a', 6);
            part(e.x, e.y, '#ffb050', 14, 220, 0.4, 4);
            AU.sfx('boom');
            if (d < 75) hurtPlayer(e.dmg, null);
            dropGem(e.x, e.y, e.xp);
            continue;
          }
          break;
        }
      }
    }
    e.x += (vx * mv + e.kvx) * dt; e.y += (vy * mv + e.kvy) * dt;
    const kd = Math.exp(-dt * 9); e.kvx *= kd; e.kvy *= kd;
    // separación ligera entre vecinos
    const cx = clamp(Math.floor(e.x / CELL), 0, GC - 1), cy = clamp(Math.floor(e.y / CELL), 0, GR - 1);
    const cell = grid[cy * GC + cx];
    let checks = 0;
    for (let i = 0; i < cell.length && checks < 6; i++) {
      const o = cell[i]; if (o === e || o.dead || o.boss) continue;
      checks++;
      const ox = e.x - o.x, oy = e.y - o.y, rr = e.r + o.r, q = ox * ox + oy * oy;
      if (q < rr * rr && q > 0.01) { const dd = Math.sqrt(q), k = (rr - dd) / dd * 0.5; e.x += ox * k; e.y += oy * k; }
    }
    if (walker) {
      collideProps(e); collideWalls(e);
      if (isWall(e.x, e.y)) { const f = randomFloorAround(e.x, e.y, 30, 200, 8); if (f) { e.x = f.x; e.y = f.y; } }  // rescate si quedó dentro de un muro
    }
    e.x = clamp(e.x, 20, WORLD - 20); e.y = clamp(e.y, 20, WORLD - 20);
    // contacto
    const rr = e.r + P.r;
    if ((e.x - px) ** 2 + (e.y - py) ** 2 < rr * rr) hurtPlayer(e.dmg, e);
  }
  // explosiones diferidas (fuego II) — evita recursión en cadena
  if (S.booms.length) {
    const list = S.booms.splice(0, 30);
    for (const b of list) {
      aoe(b.x, b.y, b.r, b.d, { raw: true, noProc: true, col: '#ff8a2a', src: b.src });
      ring(b.x, b.y, 5, b.r, b.small ? 0.2 : 0.3, '#ff7a2f', b.small ? 3 : 6);
      if (!b.small) { part(b.x, b.y, '#ffb050', LOWQ() ? 5 : 10, 200, 0.4, 4); AU.sfx('boom'); }
    }
  }
  while (S.hemo > 0) {  // Hemomancia: nova de sangre cada 25 bajas
    S.hemo--;
    const R = 200 * P.s.area;
    aoe(P.x, P.y, R, 40, { noProc: true, col: '#ff3b5c', kb: 300, src: 'hemomancia' });
    ring(P.x, P.y, 10, R, 0.4, '#ff3b5c', 8);
  }
  compact(S.enemies, e => !e.dead);
}

// =====================================================================
//  JEFES
// =====================================================================
function startBoss() {
  S.phase = 'boss';
  const B = BOSSES[S.L.boss];
  const sp = randomFloorAround(P.x, P.y, 360, 480, 40) || { x: P.x + 200, y: P.y };
  const x = sp.x, y = sp.y;
  const hpF = B.hp * S.mods.hp * (S.endless ? (0.6 + S.bossN * 0.55) * Math.max(1, S.L.hp * 0.35) : (S.startLvl > 0 && S.lvlIdx === S.startLvl ? 0.8 : 1));
  P.dpsEst = estimateDps();
  const ttk = S.endless ? 32 + S.bossN * 8 : [30, 38, 46][S.lvlIdx] || 40;   // segundos de tu DPS
  const hp = pace(hpF, P.dpsEst * ttk * (S.diff || DIFFS.normal).hp, 0.7, 1.8);
  const e = {
    id: S.nextId++, boss: true, bid: S.L.boss, B, def: { blood: '#fff', kres: 1 }, x, y, r: B.r, hp, maxHp: hp,
    spd: B.spd, dmg: pace(B.dmg * S.L.dmg * S.mods.dmg, P.s.maxHp * 0.16 * (S.diff || DIFFS.normal).dmg, 0.6, 1.6), sc: B.sc, spr: getSpr(B.spr, B.pal), kvx: 0, kvy: 0, flash: 0,
    slowT: 0, slowAmt: 0, freezeT: 0, burnT: 0, burnDps: 0, burnTick: 0.5, st: 'intro', t: 1.5, atk: 2.5,
    face: 0, z: 0, phase2: false, ang: 0, alpha: 1, dead: false,
  };
  S.enemies.push(e); S.boss = e;
  banner('⚠ ' + B.n + ' ⚠', '¡El jefe ha llegado!', 3, '#ff4a4a');
  shake(14); AU.sfx('boss'); AU.music(3);
  ring(x, y, 10, 300, 0.8, '#ff4a4a', 10);
}

function bossWarn(x, y, r, delay, dmg, then) { S.fx.push({ k: 'warn', x, y, r, t: 0, delay, dmg, then }); }
function zone(x, y, r, life, dps, col, slow) { S.fx.push({ k: 'zone', x, y, r, t: 0, life, dps, col, slow, tick: 0 }); }

function updateBoss(b, dt) {
  b.flash -= dt;
  if (b.burnT > 0) { b.burnT -= dt; b.burnTick -= dt; if (b.burnTick <= 0) { b.burnTick = 0.5; hitEnemy(b, b.burnDps * 0.5, { raw: true, noProc: true, col: '#ff8a2a', src: 'burn', burn: true }); } }
  if (b.slowT > 0) b.slowT -= dt; else b.slowAmt = 0;
  if (b.dead) return;
  if (!b.phase2 && b.hp < b.maxHp * 0.5) {
    b.phase2 = true; banner('¡' + b.B.n + ' enfurece!', 'Fase 2', 2, '#ff4a4a'); shake(12); AU.sfx('boss');
    ring(b.x, b.y, 10, 260, 0.6, '#ff4a4a', 10);
  }
  const p2 = b.phase2, dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  const aP = Math.atan2(dy, dx), sl = (1 - b.slowAmt * 0.5) * (S.timeSlow > 0 ? 0.6 : 1);
  b.face = dx >= 0 ? 0 : 1;
  b.t -= dt;
  if (b.st === 'intro') { if (b.t <= 0) { b.st = 'move'; b.t = 1.5; } return; }

  if (b.bid === 'slimeKing') {
    if (b.st === 'move') {
      b.x += nx * b.spd * sl * (p2 ? 1.3 : 1) * dt; b.y += ny * b.spd * sl * (p2 ? 1.3 : 1) * dt;
      if (b.t <= 0) {
        if (Math.random() < 0.6) {
          b.st = 'jump'; b.t = 1.1; b.jx = b.x; b.jy = b.y;
          b.tx = clamp(P.x + (P.mx || 0) * 80, 100, WORLD - 100); b.ty = clamp(P.y + (P.my || 0) * 80, 100, WORLD - 100);
          if (isWall(b.tx, b.ty)) { b.tx = P.x; b.ty = P.y; }
          bossWarn(b.tx, b.ty, 150, 1.1, b.dmg * 1.2);
          b.untarget = true;
        } else { b.st = 'spit'; b.t = 0.3; b.n = p2 ? 3 : 2; }
      }
    } else if (b.st === 'jump') {
      const f = 1 - b.t / 1.1;
      b.x = b.jx + (b.tx - b.jx) * f; b.y = b.jy + (b.ty - b.jy) * f; b.z = Math.sin(f * Math.PI) * 220;
      if (b.t <= 0) {
        b.z = 0; b.untarget = false; shake(14); AU.sfx('boom');
        part(b.x, b.y, '#5be34a', 30, 300, 0.6, 5);
        const n = p2 ? 22 : 14, off = Math.random();
        for (let i = 0; i < n; i++) eShoot(b.x, b.y, off + i / n * TAU, 210, b.dmg * 0.6, '#7ee36b', 9);
        for (let i = 0; i < (p2 ? 4 : 2); i++) spawnEnemy('slime', b.x + rnd(-60, 60), b.y + rnd(-60, 60));
        b.st = 'move'; b.t = p2 ? 1.8 : 2.8;
      }
    } else if (b.st === 'spit') {
      if (b.t <= 0) {
        const n = p2 ? 7 : 5;
        for (let i = 0; i < n; i++) eShoot(b.x, b.y, aP + (i - (n - 1) / 2) * 0.18, 270, b.dmg * 0.6, '#7ee36b', 8);
        AU.sfx('ebullet');
        b.n--; b.t = 0.45;
        if (b.n <= 0) { b.st = 'move'; b.t = p2 ? 1.8 : 2.6; }
      }
    }
  } else if (b.bid === 'lich') {
    if (b.st === 'move') {
      const want = 200, k = d > want + 40 ? 1 : d < want - 60 ? -0.6 : 0;   // cerca suficiente para que el cuerpo a cuerpo pueda alcanzarlo
      b.ang += dt * 0.8;
      b.x += (nx * k - ny * 0.6) * b.spd * sl * dt; b.y += (ny * k + nx * 0.6) * b.spd * sl * dt;
      if (b.t <= 0) { b.st = pick(['spiral', 'spiral', 'summon', 'zones', 'tele']); b.t = { spiral: 3, summon: 0.6, zones: 0.5, tele: 0.5 }[b.st]; b.acc = 0; }
    } else if (b.st === 'spiral') {
      b.acc -= dt;
      if (b.acc <= 0) {
        b.acc = p2 ? 0.07 : 0.09; b.ang += 0.23;
        const arms = p2 ? 4 : 2;
        for (let i = 0; i < arms; i++) eShoot(b.x, b.y, b.ang + i / arms * TAU, 175, b.dmg * 0.55, '#8ff3ff', 8);
      }
      if (b.t <= 0) { b.st = 'move'; b.t = p2 ? 1.2 : 1.8; }
    } else if (b.st === 'summon') {
      if (b.t <= 0) {
        for (let i = 0; i < (p2 ? 7 : 5); i++) { const a = i / 5 * TAU; spawnEnemy(p2 ? 'wraith' : 'skel', b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 80); }
        ring(b.x, b.y, 10, 120, 0.4, '#b066ff', 6);
        b.st = 'move'; b.t = 1.5;
      }
    } else if (b.st === 'zones') {
      if (b.t <= 0) {
        const n = p2 ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const x = clamp(P.x + (i ? rnd(-220, 220) : 0), 50, WORLD - 50), y = clamp(P.y + (i ? rnd(-220, 220) : 0), 50, WORLD - 50);
          bossWarn(x, y, 90, 1.0, b.dmg, () => zone(x, y, 90, 5, 10 * S.L.dmg, '#8ff3ff', 0.5));
        }
        b.st = 'move'; b.t = 1.8;
      }
    } else if (b.st === 'tele') {
      b.alpha = Math.max(0.1, b.t / 0.5); b.untarget = true;
      if (b.t <= 0) {
        const tp = randomFloorAround(P.x, P.y, 280, 340, 30) || { x: b.x, y: b.y };
        b.x = tp.x; b.y = tp.y;
        b.alpha = 1; b.untarget = false;
        const n = p2 ? 24 : 16;
        for (let i = 0; i < n; i++) eShoot(b.x, b.y, i / n * TAU, 200, b.dmg * 0.55, '#c38bff', 8);
        part(b.x, b.y, '#b066ff', 20, 200, 0.5, 4);
        b.st = 'move'; b.t = 1.4;
      }
    }
  } else if (b.bid === 'forge') {
    const sp = p2 ? 1.3 : 1;
    if (b.st === 'move') {
      b.x += nx * b.spd * sl * sp * dt; b.y += ny * b.spd * sl * sp * dt;
      if (b.t <= 0) { b.st = pick(['charge', 'waves', 'meteors', p2 ? 'summon' : 'charge']); b.t = { charge: 0.85, waves: 0.4, meteors: 0.4, summon: 0.5 }[b.st]; b.ca = aP; b.n = 3; }
    } else if (b.st === 'charge') {
      b.ca = b.t > 0.35 ? aP : b.ca;
      if (b.t <= 0) { b.st = 'dash'; b.t = 0.75; b.trail = 0; }
    } else if (b.st === 'dash') {
      b.x += Math.cos(b.ca) * 900 * dt; b.y += Math.sin(b.ca) * 900 * dt;
      b.trail -= dt;
      if (b.trail <= 0) { b.trail = 0.07; zone(b.x, b.y, 45, 3, 18 * S.L.dmg, '#ff6a1a', 0); }
      if (b.t <= 0 || collideWalls(b) || b.x < 80 || b.y < 80 || b.x > WORLD - 80 || b.y > WORLD - 80) { b.st = 'move'; b.t = p2 ? 1.0 : 1.6; shake(10); AU.sfx('boom'); }
    } else if (b.st === 'waves') {
      if (b.t <= 0) {
        const n = p2 ? 32 : 24, off = b.n * 0.13;
        for (let i = 0; i < n; i++) eShoot(b.x, b.y, off + i / n * TAU, 190, b.dmg * 0.5, '#ff8a2a', 9);
        if (p2) for (let i = -2; i <= 2; i++) eShoot(b.x, b.y, aP + i * 0.12, 300, b.dmg * 0.5, '#ffd43b', 7);
        AU.sfx('ebullet');
        b.n--; b.t = 0.5;
        if (b.n <= 0) { b.st = 'move'; b.t = 1.5; }
      }
    } else if (b.st === 'meteors') {
      if (b.t <= 0) {
        const n = p2 ? 14 : 9;
        for (let i = 0; i < n; i++) {
          const x = clamp(P.x + (i ? rnd(-260, 260) : 0), 50, WORLD - 50), y = clamp(P.y + (i ? rnd(-260, 260) : 0), 50, WORLD - 50);
          S.fx.push({ k: 'meteor', x, y, r: 80, dmg: b.dmg, t: 0, delay: 0.9 + i * 0.08, col: '#ff6a1a', own: false });
        }
        b.st = 'move'; b.t = 2;
      }
    } else if (b.st === 'summon') {
      if (b.t <= 0) { for (let i = 0; i < 6; i++) spawnEnemy('imp', b.x + rnd(-80, 80), b.y + rnd(-80, 80)); b.st = 'move'; b.t = 1.2; }
    }
  }
  if (b.st !== 'dash' && b.st !== 'jump' && b.st !== 'tele') { collideProps(b); collideWalls(b); }
  b.x = clamp(b.x, 60, WORLD - 60); b.y = clamp(b.y, 60, WORLD - 60);
  if (b.z < 30 && !b.untarget) {
    const rr = b.r * 0.8 + P.r;
    if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < rr * rr) hurtPlayer(b.dmg * (b.st === 'dash' ? 1.4 : 1), b);
  }
}

function bossDefeated(b) {
  S.boss = null; S.phase = S.endless ? 'waves' : 'cleared'; S.slowmo = 1.4; S.cleared++;
  if (S.endless) {
    S.bossN++; S.nextBoss = 180; S.asc = (S.asc || 0) + 1;
    S.mods.spawn *= 1.15; S.mods.hp *= 1.12; P.rerolls++;
    setTimeout(() => banner('🜂 Ascensión ' + S.asc, 'Más enemigos, más élites y hordas mezcladas · +1 re-tirada', 3, '#ff9a3a'), 2500);
  }
  shake(20); AU.sfx('boom');
  for (let i = 0; i < 4; i++) ring(b.x, b.y, 10, 200 + i * 90, 0.6 + i * 0.2, ['#fff', '#ffd43b', '#ff8a2a', '#ff4a4a'][i], 8);
  part(b.x, b.y, '#ffd43b', 60, 500, 1.2, 5);
  for (const e of S.enemies) if (!e.dead && !e.boss) { e.dead = true; part(e.x, e.y, e.def.blood || '#fff', 3, 120, 0.4, 3); }
  S.eproj.length = 0;
  const cs = safeSpot(b.x, b.y);
  S.picks.push({ k: 'chest', x: cs.x, y: cs.y, tier: 3 });
  for (let i = 0; i < 12; i++) S.picks.push({ k: 'soul', x: b.x + rnd(-80, 80), y: b.y + rnd(-80, 80), v: 3 + S.lvlIdx * 2 });
  for (let i = 0; i < 8; i++) dropGem(b.x + rnd(-90, 90), b.y + rnd(-90, 90), 20);
  const pp = randomFloorAround(b.x, b.y, 120, 200, 30) || { x: b.x, y: b.y };
  S.portal = { x: pp.x, y: pp.y, t: 0 };
  banner('¡' + b.B.n + ' derrotado!', S.endless ? 'Abre el cofre: el portal lleva al Altar de Almas' : S.lvlIdx < 2 ? 'Abre el cofre y entra al portal' : 'Entra al portal para escapar del Abismo', 4, '#ffd43b');
  AU.music(S.L.music);
}

// =====================================================================
//  RECOGIBLES, EFECTOS
// =====================================================================
function updatePickups(dt) {
  const mg = P.s.magnet, mg2 = mg * mg;
  for (const g of S.gems) {
    const dx = P.x - g.x, dy = P.y - g.y, d2 = dx * dx + dy * dy;
    if (!g.mag && d2 < mg2) g.mag = true;
    if (!g.mag) { g.life -= dt; if (g.life <= 0) { g.v = 0; continue; } }
    if (g.mag) {
      g.sp = Math.min(g.sp + 1800 * dt, 1100);
      const d = Math.sqrt(d2) || 1;
      g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
      if (d < P.r + 10) { gainXp(g.v); g.v = 0; AU.sfx('gem'); }
    }
  }
  compact(S.gems, g => g.v > 0);
  if (S.gems.length > 260) {  // fusión de gemas para ahorrar recursos
    const far = S.gems.splice(0, 60);
    const tot = far.reduce((a, g) => a + g.v, 0);
    S.gems.push({ x: far[0].x, y: far[0].y, v: tot * 0.5, mag: false, sp: 0, life: 20 });
  }
  for (const p of S.picks) {
    if (p.life !== undefined) { p.life -= dt; if (p.life <= 0) { p.done = true; continue; } }   // temporales
    const dx = P.x - p.x, dy = P.y - p.y, d2 = dx * dx + dy * dy;
    if (p.k === 'soul' && d2 < mg2) { const d = Math.sqrt(d2) || 1; p.x += dx / d * 600 * dt; p.y += dy / d * 600 * dt; }
    if (d2 < (P.r + 18) ** 2) {
      p.done = true;
      if (p.k === 'heart') { heal(P.s.maxHp * 0.2, true); AU.sfx('pick'); ring(P.x, P.y, 5, 50, 0.3, '#5bff8a'); }
      else if (p.k === 'soul') { const v = p.v * P.s.souls * S.mods.soul * (P.inZone === 'maldita' ? 1.6 : 1); S.souls += v; S.soulsEarned += v; AU.sfx('gem'); }
      else if (p.k === 'magnet') { for (const g of S.gems) g.mag = true; AU.sfx('pick'); banner('🧲 ¡Imán!', '', 1); }
      else if (p.k === 'chest') { AU.sfx('chest'); UI.openLevelUp(p.tier === 3 ? 'boss' : p.tier === 2 ? 'puzzle' : 'chest'); }
    }
  }
  compact(S.picks, p => !p.done);
  for (const sh of S.shrines) {
    if (sh.used) continue;
    if (sh.guard) { sh.prog = 0; continue; }
    const near = (P.x - sh.x) ** 2 + (P.y - sh.y) ** 2 < 60 * 60;
    sh.prog = near ? sh.prog + dt / 1.2 : Math.max(0, sh.prog - dt);
    if (near && Math.random() < 0.4) part(sh.x + rnd(-20, 20), sh.y, SHRINES[sh.type].c, 1, 30, 0.6, 3, -120);
    if (sh.prog >= 1 && mode === 'play') activateShrine(sh);
  }
  if (S.portal) {
    S.portal.t += dt;
    const dx = P.x - S.portal.x, dy = P.y - S.portal.y;
    if (dx * dx + dy * dy < 50 * 50 && mode === 'play') {
      const bc = S.picks.find(p => p.k === 'chest' && p.tier === 3);
      if (bc) { bc.x = P.x; bc.y = P.y; }   // se recoge en el siguiente fotograma y luego se cruza
      else enterPortal();
    }
  }
}
function activateShrine(sh) {
  sh.used = true;
  const SH = SHRINES[sh.type];
  banner(SH.n, SH.d, 2.5, SH.c);
  ring(sh.x, sh.y, 10, 280, 0.6, SH.c, 8);
  part(sh.x, sh.y - 30, SH.c, 30, 260, 0.7, 4);
  AU.sfx('chest');
  switch (sh.type) {
    case 'poder': P.powerT = 25; break;
    case 'fuente': P.b.maxHp += 10; recalc(); heal(P.s.maxHp * 0.6, true); break;
    case 'saber': UI.openLevelUp('chest'); break;
    case 'tiempo': S.timeSlow = 8; break;
    case 'maldito': {
      const types = S.L.spawns.map(s => s.e);
      for (let i = 0; i < 2; i++) {
        const a = rnd(0, TAU);
        spawnEnemy(pick(types), clamp(P.x + Math.cos(a) * 350, 60, WORLD - 60), clamp(P.y + Math.sin(a) * 350, 60, WORLD - 60), true);
      }
      for (let i = 0; i < 10; i++) S.picks.push({ k: 'soul', x: sh.x + rnd(-50, 50), y: sh.y + rnd(-50, 50), v: 2 });
      shake(10);
      break;
    }
  }
}
function gainXp(v) {
  P.xp += v * P.s.xp * comboMul() * (P.inZone === 'maldita' ? 1.2 : 1);
  while (P.xp >= P.xpNext) {
    P.xp -= P.xpNext; P.lvl++; P.xpNext = xpNeed(P.lvl);
    S.pendingLv++;
    if (P.lvl % 10 === 0) { banner('⚠ El Abismo se fortalece', 'Nivel ' + P.lvl + ': los enemigos son más duros y numerosos', 2.4, '#ff6a5a'); AU.sfx('boss'); }
  }
}

function updateFx(dt) {
  for (const f of S.fx) {
    f.t += dt;
    if (f.k === 'meteor' && !f.done && f.t >= f.delay) {
      f.done = true; f.life = f.t + 0.35;
      if (f.own) { aoe(f.x, f.y, f.r, f.dmg, { kb: 250, src: f.src }); }
      else {
        if ((P.x - f.x) ** 2 + (P.y - f.y) ** 2 < (f.r + P.r) ** 2) hurtPlayer(f.dmg, null);
        zone(f.x, f.y, f.r * 0.6, 2.5, 12 * S.L.dmg, '#ff6a1a', 0);
      }
      part(f.x, f.y, f.col, LOWQ() ? 8 : 18, 280, 0.5, 4);
      shake(f.own ? 3 : 6); AU.sfx('boom');
    }
    if (f.k === 'warn' && !f.done && f.t >= f.delay) {
      f.done = true; f.life = f.t + 0.25;
      if ((P.x - f.x) ** 2 + (P.y - f.y) ** 2 < (f.r + P.r) ** 2) hurtPlayer(f.dmg, null);
      if (f.then) f.then();
    }
    if (f.k === 'smoke') {
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.5;
        for (const e of query(f.x, f.y, f.r).slice()) {
          if (e.dead || (e.x - f.x) ** 2 + (e.y - f.y) ** 2 > f.r * f.r) continue;
          e.slowT = 1; e.slowAmt = Math.max(e.slowAmt, 0.5);
          hitEnemy(e, 10, { noProc: true, src: 'sec', col: '#a8e0a0' });
        }
      }
    }
    if (f.k === 'zone') {
      const inside = (P.x - f.x) ** 2 + (P.y - f.y) ** 2 < (f.r + P.r * 0.5) ** 2;
      if (inside) {
        if (f.slow) P.zoneSlow = Math.min(P.zoneSlow, 1 - f.slow);
        f.tick -= dt;
        if (f.tick <= 0 && f.dps) { f.tick = 0.5; hurtPlayer(f.dps * 0.5, null, true); }
      }
    }
  }
  compact(S.fx, f => f.k === 'meteor' || f.k === 'warn' ? !(f.done && f.t >= f.life) : f.t < f.life);

  for (const p of S.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.94; p.vy *= p.g ? 1 : 0.94; }
  compact(S.parts, p => p.life > 0);
  for (const t of S.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.92; }
  compact(S.texts, t => t.life > 0);
  if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }

  // ambiente: brasas / nieve / luciérnagas
  if (!LOWQ() && S.embers.length < 50 && Math.random() < 0.5) {
    const b = S.L.biome;
    S.embers.push({ x: cam.x + rnd(-W, W) / ZOOM / 2, y: cam.y + rnd(-H, H) / ZOOM / 2, vx: rnd(-15, 15), vy: b === 'forge' ? rnd(-50, -20) : b === 'crypt' ? rnd(15, 40) : rnd(-10, 10), life: rnd(2, 5), col: b === 'forge' ? '#ff8a2a' : b === 'crypt' ? '#cfe8ff' : '#d8ff7a' });
  }
  for (const m of S.embers) { m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt; }
  compact(S.embers, m => m.life > 0);
}

// =====================================================================
//  FLUJO DE NIVELES
// =====================================================================
function enterPortal() {
  AU.sfx('portal');
  if (!S.endless && S.lvlIdx >= LEVELS.length - 1) { gameOver(true); return; }
  UI.openCross();
}
function applyPath(id) {
  const b = P.b;
  switch (id) {
    case 'guerra': S.pendingLv += 3; S.mods.hp *= 1.15; break;
    case 'santuario': b.maxHp += 30; recalc(); P.hp = P.s.maxHp; break;
    case 'pacto': b.dmg += 0.3; b.maxHp *= 0.85; recalc(); break;
    case 'maldito': S.mods.spawn *= 1.35; S.mods.hp *= 1.25; S.mods.xp *= 1.5; S.mods.soul *= 2; break;
    case 'reliquia': S.chestQueue.push('boss'); break;
    case 'forja':
      if (P.weapons.length) for (const w of P.weapons) w.lvl = Math.min(5, w.lvl + 1);
      else S.chestQueue.push('chest');
      break;
    case 'destino': P.rerolls += 3; b.luck += 20; recalc(); break;
  }
  S.souls += 25 * (S.lvlIdx + 1);
  heal(P.s.maxHp * 0.3, true);
  if (S.endless) { S.portal = null; P.iframes = 2; }   // en el infinito se sigue en el mismo mapa
  else loadLevel(S.lvlIdx + 1);
  mode = 'play';
  recalc();
  for (const q of S.chestQueue.splice(0)) UI.openLevelUp(q);
}

function gameOver(win) {
  mode = 'over';
  const earned = Math.round((S.soulsEarned + (win ? 150 : 0) + S.cleared * 30 + (S.endless ? S.t / 6 : 0)) * S.diff.ess);   // Esencia: solo cosmética
  if (S.endless) SAVE.bestEndless = Math.max(SAVE.bestEndless || 0, Math.floor(S.t));
  SAVE.souls += earned;
  SAVE.best = Math.max(SAVE.best || 0, S.kills);
  if (win) SAVE.wins = (SAVE.wins || 0) + 1;
  persist();
  AU.stopMusic();
  AU.sfx(win ? 'chest' : 'hurt');
  UI.showOver(win, earned);
}

// =====================================================================
//  BUCLE PRINCIPAL
// =====================================================================
let last = performance.now(), fps = 60, fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  fpsAcc += rdt; fpsN++; if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (mode === 'play' && S && !keys.Tab) {
    let dt = rdt;
    if (S.slowmo > 0) { S.slowmo -= rdt; dt *= 0.3; }
    update(dt);
  }
  if (S && mode !== 'menu') render(rdt); else renderMenuBg(rdt);
}
function update(dt) {
  touchUpdate();
  S.chainT = (S.chainT || 0) - dt;
  S.t += dt; S.time += dt; S.runTime += dt;
  if (S.timeSlow > 0) S.timeSlow -= dt;
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
  updatePlayer(dt);
  updateWorld(dt);
  pressureTick(dt);
  if (S.endless) endlessTick(dt);
  gridBuild();
  director(dt);
  updateWeapons(dt);
  updateEnemies(dt);
  updateProj(dt);
  updatePickups(dt);
  updateFx(dt);
  // cámara con ligera anticipación hacia el ratón
  const mw = mouseWorld();
  const tx = P.x + (mw.x - P.x) * 0.12, ty = P.y + (mw.y - P.y) * 0.12;
  cam.x += (tx - cam.x) * Math.min(1, dt * 8); cam.y += (ty - cam.y) * Math.min(1, dt * 8);
  S.shake = Math.max(0, S.shake - dt * 40);
  if (S.pendingLv > 0 && mode === 'play') UI.openLevelUp('level');
}

// =====================================================================
//  RENDER
// =====================================================================
function drawSpr(spr, x, y, sc, dir, o) {
  const w = spr.w * sc, h = spr.h * sc;
  let img = spr.c[dir];
  if (o) {
    if (o.white) img = sprWhite(spr, dir);
    else if (o.tint) img = sprTint(spr, dir, o.tint);
  }
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
}
function shadow(x, y, rx) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.38, 0, 0, TAU); ctx.fill();
}

function render() {
  const L = S.L;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = L.bg; ctx.fillRect(0, 0, W, H);
  const sx = S.shake ? rnd(-S.shake, S.shake) : 0, sy = S.shake ? rnd(-S.shake, S.shake) : 0;
  const cx = cam.x + sx / ZOOM, cy = cam.y + sy / ZOOM;
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (W / 2 - cx * ZOOM), DPR * (H / 2 - cy * ZOOM));
  ctx.imageSmoothingEnabled = false;
  const vw = W / ZOOM / 2 + 80, vh = H / ZOOM / 2 + 120;
  const x0 = cx - vw, x1 = cx + vw, y0 = cy - vh, y1 = cy + vh;
  const vis = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

  // suelo
  drawGround(x0, y0, x1, y1);

  // decoración del suelo
  for (const d of S.decals) {
    if (!vis(d.x, d.y, 10)) continue;
    ctx.fillStyle = d.col;
    if (d.k === 0) { ctx.fillRect(d.x, d.y, d.s, d.s * 2); ctx.fillRect(d.x + d.s * 1.5, d.y + d.s, d.s, d.s * 1.5); }
    else if (d.k === 1) ctx.fillRect(d.x, d.y, d.s * 2, d.s);
    else { ctx.globalAlpha = 0.5; ctx.fillRect(d.x, d.y, d.s * 4, 2); ctx.fillRect(d.x + d.s * 2, d.y + 2, 2, d.s * 2); ctx.globalAlpha = 1; }
  }
  // grietas de lava pulsantes (forja)
  ctx.globalAlpha = 0.25 + Math.sin(S.time * 2) * 0.1; ctx.fillStyle = '#ff5a1a';
  for (const d of S.decals) if (d.lava && vis(d.x, d.y, 10)) ctx.fillRect(d.x, d.y, d.s * 4, 2);
  ctx.globalAlpha = 1;

  drawTerrain(x0, y0, x1, y1);
  drawTrapsZones(vis);
  drawPuzzles(vis);
  // zonas y advertencias (capa de suelo)
  for (const f of S.fx) {
    if (f.k === 'smoke') {
      const a = Math.min(1, (f.life - f.t)) * 0.45;
      for (let k = 0; k < 7; k++) {
        const ang = k / 7 * TAU + f.t * 0.4, rr = f.r * 0.55;
        ctx.fillStyle = `rgba(150,150,165,${a * 0.6})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr * 0.7, f.r * 0.5, 0, TAU); ctx.fill();
      }
    } else if (f.k === 'zone') {
      const a = Math.min(1, (f.life - f.t) * 2) * 0.35;
      ctx.fillStyle = rgba(f.col, a); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    } else if ((f.k === 'warn' || (f.k === 'meteor' && !f.own)) && !f.done) {
      const p = f.t / f.delay;
      ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,60,40,0.35)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * p, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,70,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
    } else if (f.k === 'meteor' && f.own && !f.done) {
      ctx.strokeStyle = rgba(f.col, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.t / f.delay), 0, TAU); ctx.stroke();
    } else if (f.k === 'line') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = 'rgba(255,60,30,0.25)'; ctx.fillRect(0, -f.w / 2, f.len, f.w);
      ctx.restore();
    }
  }
  // línea de embestida del jefe
  if (S.boss && S.boss.st === 'charge') {
    const b = S.boss;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ca);
    ctx.fillStyle = 'rgba(255,60,30,0.25)'; ctx.fillRect(0, -b.r * 0.7, 650, b.r * 1.4);
    ctx.restore();
  }
  // aura de escarcha
  const aura = P.weapons.find(w => w.id === 'aura');
  if (aura && aura.R) {
    ctx.fillStyle = aura.evo ? 'rgba(143,243,255,0.13)' : 'rgba(143,243,255,0.08)';
    ctx.beginPath(); ctx.arc(P.x, P.y, aura.R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(143,243,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y, aura.R, S.time, S.time + TAU * 0.8); ctx.stroke();
  }

  // gemas y recogibles
  const gemSpr = [getSpr('gem', { b: '#3a9a3f', c: '#7ee36b' }), getSpr('gem'), getSpr('gem', { b: '#6a2fb3', c: '#b066ff' }), getSpr('gem', { b: '#8e1f2a', c: '#ff5a5a' })];
  for (const g of S.gems) {
    if (!vis(g.x, g.y, 10)) continue;
    const tier = g.v < 3 ? 0 : g.v < 12 ? 1 : g.v < 50 ? 2 : 3;
    if (g.life < 6 && !g.mag) ctx.globalAlpha = Math.floor(S.time * 8) % 2 ? 0.35 : 0.9;   // parpadea antes de desvanecerse
    drawSpr(gemSpr[tier], g.x, g.y + 4 + Math.sin(S.time * 4 + g.x) * 2, 2 + tier * 0.4, 0);
    ctx.globalAlpha = 1;
  }
  for (const p of S.picks) {
    if (!vis(p.x, p.y, 20)) continue;
    const bob = Math.sin(S.time * 3 + p.x) * 3;
    ctx.globalAlpha = p.life !== undefined && p.life < 4 ? (Math.floor(S.time * 8) % 2 ? 0.3 : 1) : 1;
    if (p.k === 'soul') {
      ctx.drawImage(glowSpr('#b066ff'), p.x - 14, p.y - 14 + bob, 28, 28);
      ctx.fillStyle = '#e8d0ff'; ctx.fillRect(p.x - 3, p.y - 3 + bob, 6, 6);
    } else if (p.k === 'chest') {
      ctx.drawImage(glowSpr(p.tier === 3 ? '#ffb020' : '#ffd43b'), p.x - 50, p.y - 60, 100, 100);
      shadow(p.x, p.y + 2, 20);
      drawSpr(getSpr('chest'), p.x, p.y + bob * 0.5, p.tier === 3 ? 4.5 : 3.5, 0);
    } else {
      shadow(p.x, p.y + 6, 9);
      drawSpr(getSpr(p.k), p.x, p.y + 4 + bob, 3, 0);
    }
  }
  ctx.globalAlpha = 1;
  // santuarios
  for (const sh of S.shrines) {
    if (!vis(sh.x, sh.y, 60)) continue;
    const SH = SHRINES[sh.type], col = sh.used ? '#4a4458' : SH.c, bob = sh.used ? 0 : Math.sin(S.time * 2.5 + sh.x) * 4;
    if (!sh.used) ctx.drawImage(glowSpr(col), sh.x - 55, sh.y - 95 + bob, 110, 110);
    shadow(sh.x, sh.y + 8, 28);
    ctx.fillStyle = '#1b1424'; ctx.fillRect(sh.x - 26, sh.y - 8, 52, 18);
    ctx.fillStyle = '#3d3550'; ctx.fillRect(sh.x - 24, sh.y - 6, 48, 14);
    ctx.fillStyle = '#2a2433'; ctx.fillRect(sh.x - 18, sh.y - 14, 36, 8);
    const cy = sh.y - 22 + bob;
    ctx.fillStyle = '#1b1424';
    ctx.beginPath(); ctx.moveTo(sh.x, cy - 44); ctx.lineTo(sh.x + 15, cy - 20); ctx.lineTo(sh.x, cy + 2); ctx.lineTo(sh.x - 15, cy - 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(sh.x, cy - 40); ctx.lineTo(sh.x + 12, cy - 20); ctx.lineTo(sh.x, cy - 1); ctx.lineTo(sh.x - 12, cy - 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(sh.x - 5, cy - 30, 4, 10);
    if (sh.guard && !sh.used) { ctx.strokeStyle = 'rgba(255,176,32,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(sh.x, sh.y, 52, S.time, S.time + TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (sh.prog > 0 && !sh.used) {
      ctx.strokeStyle = col; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 46, -Math.PI / 2, -Math.PI / 2 + TAU * sh.prog); ctx.stroke();
    }
    if (!sh.used && (P.x - sh.x) ** 2 + (P.y - sh.y) ** 2 < 220 * 220) {
      ctx.textAlign = 'center'; ctx.font = 'bold 13px Silkscreen, monospace';
      ctx.fillStyle = '#000'; ctx.fillText(SH.n, sh.x + 1, sh.y - 79 + bob);
      ctx.fillStyle = col; ctx.fillText(SH.n, sh.x, sh.y - 80 + bob);
      ctx.font = '11px "Segoe UI", sans-serif'; ctx.fillStyle = sh.guard ? '#ffb020' : '#ddd';
      ctx.fillText(sh.guard ? '🛡 Derrota al guardián para activarlo' : SH.d + ' — quédate encima', sh.x, sh.y - 64 + bob);
    }
  }
  // portal
  if (S.portal) {
    const pt = S.portal, t = S.time;
    ctx.drawImage(glowSpr('#b066ff'), pt.x - 90, pt.y - 90, 180, 180);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = ['#b066ff', '#6aa8ff', '#ffffff'][i]; ctx.lineWidth = 4 - i;
      ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 46 - i * 10, 26 - i * 6, 0, t * (2 + i) + i, t * (2 + i) + i + TAU * 0.75); ctx.stroke();
    }
  }

  // objetos ordenados por profundidad (Y) — efecto 2.5D
  const list = [];
  for (const p of S.props) if (vis(p.x, p.y, 120)) list.push(p);
  pushWalls(list, x0, y0, x1, y1);
  for (const e of S.enemies) if (!e.dead && vis(e.x, e.y, 120)) list.push(e);
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  for (const o of list) {
    if (o.kind === 'wall') drawWall(o);
    else if (o.kind === 'prop') {
      shadow(o.x, o.y, o.r * 1.1);
      drawSpr(o.spr, o.x, o.y + o.r * 0.35, o.sc, 0);
    } else if (o === P) drawPlayer();
    else drawEnemy(o);
  }

  // orbes
  const orb = P.weapons.find(w => w.id === 'orbes');
  if (orb && orb.pts) {
    const big = orb.evo ? 1.6 : 1;
    for (let i = 0; i < orb.pts.length; i += 2) {
      ctx.drawImage(glowSpr(orb.evo ? '#ff3b1a' : '#ff8a2a'), orb.pts[i] - 22 * big, orb.pts[i + 1] - 22 * big, 44 * big, 44 * big);
      ctx.fillStyle = orb.evo ? '#2a0a0a' : '#ffe08a'; ctx.beginPath(); ctx.arc(orb.pts[i], orb.pts[i + 1], 6 * big, 0, TAU); ctx.fill();
    }
  }

  // proyectiles del jugador
  for (const p of S.proj) {
    if (!vis(p.x, p.y, 30)) continue;
    if (p.k === 'dagger' || p.k === 'gdagger') {
      const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
      ctx.strokeStyle = p.col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - ux * 12, p.y - uy * 12); ctx.lineTo(p.x + ux * 6, p.y + uy * 6); ctx.stroke();
      if (p.k === 'gdagger') ctx.drawImage(glowSpr(p.col), p.x - 12, p.y - 12, 24, 24);
    } else if (p.k === 'bolt2') {
      const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
      ctx.strokeStyle = p.col; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x - ux * 22, p.y - uy * 22); ctx.lineTo(p.x + ux * 8, p.y + uy * 8); ctx.stroke();
      ctx.drawImage(glowSpr(p.col), p.x - 14, p.y - 14, 28, 28);
    } else if (p.k === 'fireball') {
      ctx.drawImage(glowSpr('#ff6a1a'), p.x - 26, p.y - 26, 52, 52);
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.fill();
      if (Math.random() < 0.5) part(p.x, p.y, '#ff8a2a', 1, 30, 0.3, 3);
    } else if (p.k === 'wave') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = 'rgba(220,235,255,0.85)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, p.r + 6, a - 1, a + 1); ctx.stroke();
    } else {
      const g = p.k === 'skull' ? 34 : 28;
      ctx.drawImage(glowSpr(p.col), p.x - g / 2, p.y - g / 2, g, g);
      ctx.fillStyle = p.k === 'skull' ? '#ffe0e0' : '#ffffff';
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
  }

  // efectos
  ctx.globalCompositeOperation = 'lighter';
  for (const f of S.fx) {
    const k = f.t / f.life;
    if (f.k === 'ring') {
      ctx.strokeStyle = rgba(f.col, 1 - k); ctx.lineWidth = f.w;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * Math.sqrt(k), 0, TAU); ctx.stroke();
    } else if (f.k === 'arc') {
      ctx.strokeStyle = rgba(f.col, 0.9 * (1 - k)); ctx.lineWidth = 14 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.75 + k * 0.25), f.a - f.half, f.a + f.half); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffffff', 0.6 * (1 - k));
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.5, f.a - f.half * 0.8, f.a + f.half * 0.8); ctx.stroke();
    } else if (f.k === 'thrust') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = rgba(f.col, 0.85 * (1 - k)); ctx.fillRect(10, -6 * (1 - k) - 2, f.len * (0.6 + 0.4 * k), 12 * (1 - k) + 4);
      ctx.fillStyle = rgba('#ffffff', 1 - k); ctx.beginPath(); ctx.moveTo(f.len * (0.6 + 0.4 * k) + 10, -10); ctx.lineTo(f.len * (0.6 + 0.4 * k) + 30, 0); ctx.lineTo(f.len * (0.6 + 0.4 * k) + 10, 10); ctx.fill();
      ctx.restore();
    } else if (f.k === 'spin') {
      ctx.strokeStyle = rgba(f.col, 0.7 * (1 - k)); ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.4 * k), 0, TAU); ctx.stroke();
    } else if (f.k === 'bolt') {
      ctx.strokeStyle = rgba(f.col, 1 - k); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.pts[0], f.pts[1]);
      for (let i = 2; i < f.pts.length; i += 2) ctx.lineTo(f.pts[i], f.pts[i + 1]);
      ctx.stroke();
    } else if (f.k === 'meteor' && !f.done) {
      const p = f.t / f.delay, h = (1 - p) * 420;
      ctx.drawImage(glowSpr(f.col), f.x - 26 + h * 0.4, f.y - 26 - h, 52, 52);
    } else if ((f.k === 'meteor' || f.k === 'warn') && f.done) {
      const q = 1 - (f.life - f.t) / 0.35;
      ctx.drawImage(glowSpr(f.col || '#ff4a2a'), f.x - f.r * 1.4, f.y - f.r * 1.4, f.r * 2.8, f.r * 2.8);
      ctx.strokeStyle = rgba(f.col || '#ff4a2a', 1 - q); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + q * 0.6), 0, TAU); ctx.stroke();
    }
  }
  // balas enemigas
  for (const b of S.eproj) {
    if (!vis(b.x, b.y, 20)) continue;
    ctx.drawImage(glowSpr(b.col), b.x - b.r * 2.4, b.y - b.r * 2.4, b.r * 4.8, b.r * 4.8);
  }
  // partículas
  for (const p of S.parts) {
    ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  for (const m of S.embers) { ctx.fillStyle = m.col; ctx.globalAlpha = Math.min(1, m.life) * 0.7; ctx.fillRect(m.x, m.y, 2, 2); }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const b of S.eproj) { if (vis(b.x, b.y, 20)) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill(); } }

  drawFog(x0, y0, x1, y1);
  // números de daño
  ctx.textAlign = 'center';
  for (const t of S.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2.5);
    ctx.font = `bold ${t.s}px Silkscreen, monospace`;
    ctx.fillStyle = '#000'; ctx.fillText(t.t, t.x + 1.5, t.y + 1.5);
    ctx.fillStyle = t.col; ctx.fillText(t.t, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // ---------- capa de pantalla ----------
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  lighting();
  drawHUD();
}

function drawPlayer() {
  const spr = getSpr(P.C.spr, P.pal);
  if (P.warcryT > 0) ctx.drawImage(glowSpr('#ff3a2a'), P.x - 44, P.y - 64, 88, 88);
  if (P.smokeT > 0) ctx.globalAlpha = 0.5;
  const bob = P.moving ? Math.abs(Math.sin(P.walkT)) * 3 : Math.sin(S.time * 2) * 1;
  shadow(P.x, P.y + 10, 16);
  if (P.dashT > 0) { ctx.globalAlpha = 0.4; drawSpr(spr, P.x - P.dvx * 0.02, P.y + 12 - P.dvy * 0.02, 3, P.face); ctx.globalAlpha = 1; }
  if (P.powerT > 0) ctx.drawImage(glowSpr('#ff5a3a'), P.x - 40, P.y - 60, 80, 80);
  if (P.ultT > 0) ctx.drawImage(glowSpr(P.cls === 'picaro' ? '#6a2fb3' : P.cls === 'mago' ? '#ff8a2a' : '#ff3b1a'), P.x - 50, P.y - 70, 100, 100);
  const blink = P.iframes > 0 && Math.floor(S.time * 20) % 2 === 0;
  if (P.ultT > 0 && P.cls === 'picaro') ctx.globalAlpha = 0.55;
  if (!blink || P.dashT > 0) drawSpr(spr, P.x, P.y + 12 - bob, 3, P.face, P.hurtFlash > 0 ? { tint: '#ff4a4a' } : null);
  ctx.globalAlpha = 1;
  // escudo de energía: burbuja visible, más opaca cuanto más lleno
  if (P.s.shieldMax > 0) {
    const f = P.sh / P.s.shieldMax;
    if (f > 0) {
      const pulse = 1 + Math.sin(S.time * 4) * 0.04;
      ctx.drawImage(glowSpr('#5ad8ff'), P.x - 40 * pulse, P.y - 46 * pulse, 80 * pulse, 80 * pulse);
      ctx.strokeStyle = rgba('#8ff3ff', 0.25 + f * 0.6); ctx.lineWidth = 2 + f * 2;
      ctx.beginPath(); ctx.arc(P.x, P.y - 6, 30 * pulse, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.35 * f); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y - 6, 30 * pulse, S.time * 2, S.time * 2 + 1.2); ctx.stroke();
    } else if (P.shDelay <= 0.8) {                // a punto de reconstruirse: parpadea
      ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(143,243,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y - 6, 30, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // indicador de apuntado
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(P.x, P.y, 34, P.aim - 0.25, P.aim + 0.25); ctx.stroke();
}

function drawEnemy(e) {
  const spr = e.spr, sc = e.sc;
  const hop = e.boss ? 0 : (e.def.fly ? Math.sin(S.time * 6 + e.id) * 4 + 8 : Math.abs(Math.sin(S.time * 8 + e.id)) * 2);
  shadow(e.x, e.y + e.r * 0.55, e.r * (e.z ? Math.max(0.4, 1 - e.z / 300) : 1));
  const y = e.y + e.r * 0.6 - hop - (e.z || 0);
  if (e.alpha !== undefined || e.def.alpha) ctx.globalAlpha = (e.alpha !== undefined ? e.alpha : 1) * (e.def.alpha || 1);
  let o = null;
  if (e.flash > 0) o = { white: true };
  else if (e.freezeT > 0) o = { tint: '#9fe8ff' };
  else if (e.st === 'wind' || (e.boss && e.st === 'charge')) o = Math.floor(S.time * 16) % 2 ? { tint: '#ff4a4a' } : null;
  drawSpr(spr, e.x, y, sc, e.face, o);
  if (e.boss && e.B.crown) drawSpr(getSpr('crown'), e.x, y - spr.h * sc + 6, sc * 0.75, 0);
  ctx.globalAlpha = 1;
  if (e.burnT > 0) ctx.drawImage(glowSpr('#ff7a2f'), e.x - e.r, y - e.r * 2.2, e.r * 2, e.r * 2);
  if (e.elite) {
    const w = e.r * 2.4;
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - w / 2 - 1, y - spr.h * sc - 9, w + 2, 6);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(e.x - w / 2, y - spr.h * sc - 8, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}

function lighting() {
  const b = S.L.biome;
  const px = W / 2 + (P.x - cam.x) * ZOOM, py = H / 2 + (P.y - cam.y) * ZOOM;
  let g;
  if (b === 'crypt') {
    g = ctx.createRadialGradient(px, py, 140 * ZOOM, px, py, 560 * ZOOM);
    g.addColorStop(0, 'rgba(5,8,22,0)'); g.addColorStop(1, 'rgba(5,8,22,0.82)');
  } else if (b === 'forge') {
    g = ctx.createRadialGradient(px, py, 260 * ZOOM, px, py, 820 * ZOOM);
    g.addColorStop(0, 'rgba(40,5,0,0)'); g.addColorStop(1, 'rgba(60,8,0,0.6)');
  } else {
    g = ctx.createRadialGradient(px, py, 240 * ZOOM, px, py, 820 * ZOOM);
    g.addColorStop(0, 'rgba(5,20,10,0)'); g.addColorStop(1, 'rgba(5,18,8,0.6)');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (P.hp / P.s.maxHp < 0.3) { // pulso rojo de vida baja
    const a = 0.18 + Math.sin(S.time * 6) * 0.08;
    const r = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    r.addColorStop(0, 'rgba(255,0,0,0)'); r.addColorStop(1, `rgba(255,0,0,${a})`);
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
  if (P.hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,40,${P.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
}

function bar(x, y, w, h, f, col, bg) {
  ctx.fillStyle = '#0b0710'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg || '#2a2030'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(f, 0, 1), h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * clamp(f, 0, 1), h / 3);
}
function hudText(t, x, y, size, col, align) {
  ctx.font = `${size}px Silkscreen, monospace`; ctx.textAlign = align || 'left';
  ctx.fillStyle = '#000'; ctx.fillText(t, x + 2, y + 2);
  ctx.fillStyle = col || '#fff'; ctx.fillText(t, x, y);
}

function drawHUD() {
  const s = P.s, T = TOUCH.on, rx = T ? W - 58 - TOUCH.safe.r : W - 14;   // en móvil se deja la columna de botones
  // XP
  bar(0, 0, W, 8, P.xp / P.xpNext, '#4aa3ff', '#101830');
  hudText('NV ' + P.lvl, 14, 30, 16, '#8fd0ff');
  // vida
  bar(14, 40, 240, 16, P.hp / s.maxHp, P.woundT > 0 ? '#b0283a' : '#e0344a');
  if (s.shieldMax > 0) { ctx.fillStyle = 'rgba(143,243,255,0.85)'; ctx.fillRect(14, 40, 240 * (P.sh / s.shieldMax), 4); }
  hudText(Math.ceil(P.hp) + ' / ' + s.maxHp + (s.shieldMax > 0 ? '  🛡' + Math.ceil(P.sh) : ''), 134, 54, 12, '#fff', 'center');
  // ultimate
  bar(14, 64, 240, 8, P.ultT > 0 ? 1 : P.ult / 100, P.ultT > 0 ? '#ffb020' : P.ult >= 100 ? '#ffd43b' : '#a07020');
  hudText(P.ult >= 100 && P.ultT <= 0 ? (T ? '' : '[Q] ') + P.C.ult.n + ' ¡LISTA!' : (T ? '' : 'Q · ') + P.C.ult.n, 14, 88, 11, P.ult >= 100 ? '#ffd43b' : '#c9b080');
  // habilidades
  let ax = 14;
  const ab = (label, key, f, ready) => {
    ctx.fillStyle = '#0b0710'; ctx.fillRect(ax, 96, 72, 26);
    ctx.fillStyle = ready ? '#3b2a55' : '#1c1528'; ctx.fillRect(ax + 2, 98, 68, 22);
    if (!ready) { ctx.fillStyle = '#6a2fb3'; ctx.fillRect(ax + 2, 98, 68 * f, 22); }
    hudText(key + ' ' + label, ax + 36, 114, 10, ready ? '#fff' : '#aaa', 'center');
    ax += 78;
  };
  if (!T) {
    ab('Hab.', 'RMB', 1 - Math.max(0, P.secT) / (P.C.sec.cd * (1 - s.cdr)), P.secT <= 0);
    ab('Dash ' + P.dashCh + '/' + s.dashes, '', P.dashRe / dashCd(), P.dashCh > 0);
  }
  // buffs activos
  let by2 = T ? 200 : 140;
  if (P.perfectT > 0) { hudText('✦ ESQUIVA PERFECTA +25% daño ' + Math.ceil(P.perfectT) + 's', 14, by2, 11, '#8ff3ff'); by2 += 16; }
  if (P.powerT > 0) { hudText('⚔ PODER ' + Math.ceil(P.powerT) + 's', 14, by2, 11, '#ff7a5a'); by2 += 16; }
  if (S.timeSlow > 0) { hudText('⏳ TIEMPO LENTO ' + Math.ceil(S.timeSlow) + 's', 14, by2, 11, '#c9d6ff'); by2 += 16; }
  // temporizador / jefe
  if (S.endless && !S.boss) {
    const tt = Math.floor(S.t);
    hudText(`${Math.floor(tt / 60)}:${String(tt % 60).padStart(2, '0')}`, W / 2, 40, 26, '#fff', 'center');
    hudText('∞ AMENAZA ' + S.threat + (S.asc ? ' · ASCENSIÓN ' + S.asc : '') + ' · jefe en ' + Math.ceil(S.nextBoss) + 's', W / 2, 60, 11, '#ffb070', 'center');
  } else if (S.phase === 'waves') {
    const rem = Math.max(0, LEVEL_TIME - S.t);
    hudText(`${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`, W / 2, 40, 26, rem < 15 ? '#ff6a5a' : '#fff', 'center');
    hudText(S.L.n.toUpperCase(), W / 2, 60, 11, '#aab', 'center');
  } else if (S.boss) {
    let bw = Math.min(600, W - 600), by = 44;
    if (T) bw = clamp(W - 560, 140, 420);
    else if (bw < 220) { bw = W - 300; by = 140; }   // pantallas angostas: barra bajo las habilidades
    hudText(S.boss.B.n.toUpperCase(), W / 2, by - 8, 16, '#ff6a5a', 'center');
    bar(W / 2 - bw / 2, by, bw, 14, S.boss.hp / S.boss.maxHp, S.boss.phase2 ? '#ff3b1a' : '#c0392b');
  } else if (S.phase === 'cleared') hudText('¡Nivel completado!', W / 2, 40, 20, '#ffd43b', 'center');
  if (S.press > 0.12) {   // indicador de presión adaptativa
    const pw = 90, px = W / 2 - pw / 2, py = S.endless ? 66 : 66;
    ctx.fillStyle = '#0b0710'; ctx.fillRect(px - 1, py - 1, pw + 2, 5);
    ctx.fillStyle = S.press > 0.66 ? '#ff3b3b' : S.press > 0.33 ? '#ff9a3a' : '#ffd43b'; ctx.fillRect(px, py, pw * S.press, 3);
    if (!T || S.combo < 5) hudText('IRA DEL ABISMO', W / 2, py + 14, 8, '#c88', 'center');
  }
  // derecha
  hudText('☠ ' + S.kills, rx, 32, 15, '#fff', 'right');
  hudText('✦ ' + Math.floor(S.souls) + ' almas', rx, 52, 13, '#d0a0ff', 'right');
  if (SAVE.settings.fps) hudText(fps + ' fps · ' + S.enemies.length + ' enem.', T ? W / 2 : rx, T ? H - 8 : 72, 11, '#8f8', T ? 'center' : 'right');
  if (SAVE.settings.auto && !T) hudText('AUTO [F]', rx, SAVE.settings.fps ? 90 : 72, 11, '#ffd43b', 'right');
  // armas (en móvil arriba a la izquierda, para dejar libre el pulgar)
  let wx = 14; const wy = T ? 96 : H - 54;
  ctx.font = '22px "Segoe UI Emoji", sans-serif';
  for (const w of P.weapons) {
    ctx.fillStyle = '#0b0710'; ctx.fillRect(wx, wy, 44, 44);
    ctx.fillStyle = w.evo ? '#5a3a10' : '#241a33'; ctx.fillRect(wx + 2, wy + 2, 40, 40);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = '22px "Segoe UI Emoji", sans-serif'; ctx.fillText(WEAPONS[w.id].ic, wx + 22, wy + 30);
    hudText(w.evo ? '★' : String(w.lvl), wx + 38, wy + 42, 10, w.evo ? '#ffd43b' : '#fff', 'right');
    wx += 50;
  }
  // escuelas
  let sx = 14; const sy = T ? 146 : H - 76;
  for (const k of SCHOOL_KEYS) {
    const v = P.schools[k]; if (!v) continue;
    const SC = SCHOOLS[k];
    ctx.fillStyle = '#0b0710'; ctx.fillRect(sx, sy, 58, 18);
    ctx.fillStyle = rgba(SC.c, 0.35); ctx.fillRect(sx + 1, sy + 1, 56 * Math.min(1, v / 9), 16);
    ctx.font = '12px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(SC.ic, sx + 3, sy + 14);
    hudText(String(v), sx + 52, sy + 14, 11, v >= 9 ? '#ffd43b' : v >= 6 ? SC.c : '#fff', 'right');
    sx += 62;
  }
  // sinergias activas (encima de las escuelas)
  const hy = HYBRIDS.filter(h => P.hyb[h.id]);
  if (hy.length) {
    ctx.font = '15px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'left';
    const hy0 = T ? sy + 22 : sy - 26;
    hy.forEach((h, i) => { ctx.fillStyle = '#3a2a10'; ctx.fillRect(14 + i * 26, hy0, 24, 22); ctx.fillStyle = '#fff'; ctx.fillText(h.ic, 17 + i * 26, hy0 + 17); });
  }
  // racha
  if (S.combo >= 5) {
    const c = S.combo, col = c >= 200 ? '#ff4aff' : c >= 100 ? '#ff4a4a' : c >= 50 ? '#ff9a3a' : c >= 25 ? '#ffd43b' : '#ffffff';
    const pulse = 1 + Math.max(0, S.comboT - 2.3) * 1.5;
    const cx2 = T ? W / 2 + 50 : W - 20, cy2 = T ? 98 : H * 0.42;   // en móvil, bajo el temporizador
    hudText('x' + c, cx2, cy2, Math.round((T ? 22 : 28) * pulse), col, 'right');
    hudText('RACHA +' + Math.round((comboMul() - 1) * 100) + '% EXP', cx2, cy2 + 16, 10, '#ccc', 'right');
    ctx.fillStyle = col; ctx.fillRect(cx2 - 100, cy2 + 22, 100 * (S.comboT / 2.5), 3);
  }
  const hint = P.campT > 4 && S.t > 15 ? ['⚠ ¡Muévete! El Abismo castiga a quien se queda quieto', '#ff7a5a'] : terrainHint();
  if (hint) hudText(hint[0], W / 2, T ? H - 26 : H - 22, 12, hint[1], 'center');
  drawMinimap();
  if (!T) hudText('TAB: build · ESC: pausa', W - 14, H - 14, 10, '#778', 'right');
  // indicadores fuera de pantalla
  const ind = [];
  for (const p of S.picks) if (p.k === 'chest' && (!p.hidden || revealedAt(p.x, p.y))) ind.push([p.x, p.y, '#ffd43b']);
  if (S.portal) ind.push([S.portal.x, S.portal.y, '#b066ff']);
  if (S.boss) ind.push([S.boss.x, S.boss.y, '#ff4a4a']);
  for (const e of S.enemies) if (e.elite) ind.push([e.x, e.y, '#ffb020']);
  for (const [x, y, col] of ind) {
    const sx2 = W / 2 + (x - cam.x) * ZOOM, sy2 = H / 2 + (y - cam.y) * ZOOM;
    if (sx2 > 0 && sx2 < W && sy2 > 0 && sy2 < H) continue;
    const a = Math.atan2(sy2 - H / 2, sx2 - W / 2);
    const ex = clamp(W / 2 + Math.cos(a) * W, 30, W - 30);
    let ey = clamp(H / 2 + Math.sin(a) * H, 110, H - 90);
    if (ex < 280 && ey < 175) ey = 175;            // no tapar vida/habilidades
    if (!T && ex < 420 && ey > H - 130) ey = H - 130;    // ni armas/escuelas
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // banner
  if (S.banner) {
    const b = S.banner, a = Math.min(1, b.life * 2, (b.max - b.life) * 4 + 0.2);
    ctx.globalAlpha = a;
    const small = H < 520;   // teléfonos en horizontal
    hudText(b.t, W / 2, H * (small ? 0.36 : 0.27), small ? 18 : 30, b.col, 'center');
    if (b.sub) hudText(b.sub, W / 2, H * (small ? 0.36 : 0.27) + (small ? 18 : 28), small ? 10 : 14, '#ddd', 'center');
    ctx.globalAlpha = 1;
  }
  if (T) { touchDraw(); return; }
  // cursor de mira
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff4a6a'; ctx.fillRect(mouse.x - 1.5, mouse.y - 1.5, 3, 3);
}

function drawMinimap() {
  const T = TOUCH.on, mm = T ? Math.min(120, Math.round(H * 0.27)) : Math.min(170, Math.round(H * 0.24));
  const x0 = T ? W - TOUCH.safe.r - 58 - mm : W - mm - 14, y0 = T ? 76 : H - mm - 30, k = mm / WORLD;   // en móvil, arriba a la derecha
  ctx.fillStyle = 'rgba(4,2,8,0.85)'; ctx.fillRect(x0 - 2, y0 - 2, mm + 4, mm + 4);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(MAP.fogC, x0, y0, mm, mm);
  ctx.strokeStyle = '#3b2a55'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 2, y0 - 2, mm + 4, mm + 4);
  ctx.fillStyle = 'rgba(255,90,90,0.75)';
  for (const e of S.enemies) if ((e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 900 * 900) ctx.fillRect(x0 + e.x * k - 1, y0 + e.y * k - 1, 2, 2);
  for (const z of MAP.zones) if (revealedAt(z.x, z.y)) { ctx.strokeStyle = ZONES[z.type].c; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + z.x * k, y0 + z.y * k, z.r * k, 0, TAU); ctx.stroke(); }
  for (const pz of MAP.puzzles) if (!pz.solved && revealedAt(pz.x, pz.y)) { ctx.fillStyle = '#5bffd0'; ctx.fillRect(x0 + pz.x * k - 3, y0 + pz.y * k - 3, 6, 6); ctx.fillStyle = '#000'; ctx.fillRect(x0 + pz.x * k - 1, y0 + pz.y * k - 1, 2, 2); }
  for (const sh of S.shrines) if (revealedAt(sh.x, sh.y)) { ctx.fillStyle = sh.used ? '#4a4458' : SHRINES[sh.type].c; ctx.fillRect(x0 + sh.x * k - 3, y0 + sh.y * k - 3, 6, 6); }
  for (const e of S.enemies) if (e.elite && revealedAt(e.x, e.y)) { ctx.fillStyle = '#ffb020'; ctx.fillRect(x0 + e.x * k - 2, y0 + e.y * k - 2, 5, 5); }
  for (const p of S.picks) if (p.k === 'chest' && revealedAt(p.x, p.y)) { ctx.fillStyle = '#ffd43b'; ctx.fillRect(x0 + p.x * k - 3, y0 + p.y * k - 3, 6, 6); }
  if (S.boss) { ctx.fillStyle = '#ff2a2a'; ctx.fillRect(x0 + S.boss.x * k - 4, y0 + S.boss.y * k - 4, 8, 8); }
  if (S.portal) { ctx.fillStyle = Math.floor(S.time * 4) % 2 ? '#b066ff' : '#fff'; ctx.fillRect(x0 + S.portal.x * k - 4, y0 + S.portal.y * k - 4, 8, 8); }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + (cam.x - W / ZOOM / 2) * k, y0 + (cam.y - H / ZOOM / 2) * k, W / ZOOM * k, H / ZOOM * k);
  ctx.fillStyle = '#fff'; ctx.fillRect(x0 + P.x * k - 2, y0 + P.y * k - 2, 5, 5);
  const pctx = Math.round(MAP.fog.reduce((a, v) => a + v, 0) / MAP.fog.length * 100);
  hudText('Explorado ' + pctx + '%', x0, y0 - 6, 10, '#aab');
}

// Fondo animado del menú
const menuParts = [];
function renderMenuBg(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c0716'); g.addColorStop(1, '#2a0f1e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (menuParts.length < 90) menuParts.push({ x: Math.random() * W, y: H + 10, v: rnd(20, 70), s: rnd(2, 4), c: pick(['#ff8a2a', '#b066ff', '#ffd43b', '#6aa8ff']) });
  for (const p of menuParts) { p.y -= p.v * dt; p.x += Math.sin(p.y / 50) * 0.3; ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.y / H); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;
  compact(menuParts, p => p.y > -10);
}

resize();
requestAnimationFrame(frame);
