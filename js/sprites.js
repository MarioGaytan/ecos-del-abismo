'use strict';
// =====================================================================
//  SPRITES — pixel art definido como texto. Cada letra = un color.
//  Se rasteriza una sola vez a canvas (con contorno automático),
//  se cachean versiones espejo, destello blanco y tintes.
// =====================================================================

const PAL = {
  k: '#1b1424', e: '#111111', w: '#f4f4f4',
  g: '#a9b3bd', G: '#5d6670',
  s: '#f0c39a', S: '#c98f6b',
  r: '#d63c3c', R: '#8e1f2a',
  o: '#ff8a2a', y: '#ffd43b', Y: '#b8860b',
  l: '#7ee36b', L: '#3a9a3f', D: '#215e2b',
  b: '#4aa3ff', B: '#2b5fb3', n: '#1d2f6b',
  p: '#b066ff', P: '#6a2fb3',
  c: '#8ff3ff',
  t: '#8a5a3b', T: '#5a3825',
  m: '#e8e0c8', M: '#b5ab8f',
};

const RAW = {
  warrior: [
    '......rr.......',
    '.....rrR.......',
    '....gggggg.....',
    '...gwggggggg...',
    '...gGkGGGkGg...',
    '...gGsssssGg...',
    '....GsssssG....',
    '..RgwggggwgR...',
    '.RRgggrrgggRR..',
    '.RRggrrrrggRR..',
    '.R.ss.rrr.ss.R.',
    '....ttYYYtt....',
    '....GGg.gGG....',
    '....gg...gg....',
    '...GGG...GGG...',
  ],
  mage: [
    '........P......',
    '.......PPp.....',
    '......PPPpP....',
    '.....PPPPPpP...',
    '....PPPPPPPPP..',
    '...yyyyyyyyyyy.',
    '.....sesssse...',
    '.....swwwwws...',
    '....PPwwwwwPP.c',
    '...PPPPwwwPPPcc',
    '...sPPPPPPPPsct',
    '....PPPyyyPP..t',
    '....PPPPPPPP..t',
    '...PPPPPPPPPP.t',
    '...PPPP...PPP..',
  ],
  rogue: [
    '......DDDD.....',
    '.....DDLLDD....',
    '....DDLLLLDD...',
    '....DkkkkkkD...',
    '....DkykkykD...',
    '....DDkkkkDD...',
    '.....DDDDDD....',
    '...TDDLLLLDDT..',
    '..TTDDLLLLDDTT.',
    '..ss.DDggDD.ss.',
    '.....TTYYTT....',
    '.....DDD.DD....',
    '.....DD..DD....',
    '....TTT..TTT...',
  ],
  slime: [
    '......llll......',
    '....llllwlll....',
    '...lllllwwlll...',
    '..lllllllllll...',
    '..llkkllkklllL..',
    '..llkkllkkllLL..',
    '..lllllllllLLL..',
    '..LllkkkklLLLL..',
    '...LLLLLLLLLL...',
    '....LLLLLLLL....',
  ],
  bat: [
    'P..............P',
    'PP....P..P....PP',
    'PPP...PPPP...PPP',
    'PPPP.PPPPPP.PPPP',
    'PPPPPPyPPyPPPPPP',
    '.PPPPPPPPPPPPPP.',
    '..PPP.PwwP.PPP..',
    '...P...PP...P...',
  ],
  skel: [
    '.....mmmmm.....',
    '....mmmmmmm....',
    '....mkkmkkm....',
    '....mkkmkkm....',
    '.....mmmmm.....',
    '......mkm......',
    '....mmmmmmm....',
    '...m.mkmkm.m...',
    '...m.mmmmm.m...',
    '...M..mkm..M...',
    '......mmm......',
    '.....m...m.....',
    '.....m...m.....',
    '....mm...mm....',
  ],
  ghost: [
    '.....ccccc.....',
    '....cwwwwwc....',
    '...cwwwwwwwc...',
    '...wwkwwwkww...',
    '...wwkwwwkww...',
    '...wwwwwwwww...',
    '...wwwwkwwww...',
    '...wwwwwwwww...',
    '...cwwwwwwwc...',
    '...cwcwwcwwc...',
    '...c.c.cc.c....',
  ],
  ghoul: [
    '.....LLLL......',
    '....LLLLLL.....',
    '....LrLLrL.....',
    '....LLLLLL.....',
    '.....LkkL......',
    '...TTTTTTTT....',
    '..LTTtTTTTTL...',
    '..L.TTTTtT.L...',
    '..L.TTTTTT.L...',
    '.....nnnn......',
    '.....n..n......',
    '....nn..nn.....',
  ],
  boar: [
    '..........TT....',
    '...TTTTTTTTTT...',
    '..TTtTTTTtTTTT..',
    '.TTTTTTTTTTkTTw.',
    '.TTTtTTTTTTTTTSS',
    '.TTTTTTTTTTTTwSk',
    '..TTTTTTTTTTT...',
    '..TT.TT..TT.TT..',
    '..kk.kk..kk.kk..',
  ],
  golem: [
    '....GGGGGG......',
    '...GgggggGG.....',
    '...GgyGgyGG.....',
    '...GggggggG.....',
    '.GGGGGGGGGGGG...',
    'GgggGGggGGgggG..',
    'GgggGggggGgggG..',
    'GgG.GggggG.GgG..',
    'GG..GGGGGG..GG..',
    '....GgG.GgG.....',
    '....GgG.GgG.....',
    '...GGGG.GGGG....',
  ],
  imp: [
    '..r........r...',
    '..rr......rr...',
    '...rrrrrrrr....',
    '...rryrrryr....',
    '...rrrrrrrr....',
    '....rrkkrr.....',
    '..r.rrrrrr.r...',
    '.rr.rRRRRr.rr..',
    '.....rRRr......',
    '.....r..r....r.',
    '....rr..rr..rr.',
  ],
  fireel: [
    '.......y.......',
    '......yoy......',
    '.....yoooy.....',
    '....yoooooy....',
    '...yooyooyoo...',
    '...oookookoo...',
    '...ooooooooo...',
    '...rooooooor...',
    '....rooooor....',
    '.....rroor.....',
    '......rrr......',
  ],
  wraith: [
    '.....nnnnn.....',
    '....nBBBBBn....',
    '...nBkkkkkBn...',
    '...nBkckckBn...',
    '...nBkkkkkBn...',
    '...nBBBBBBBn...',
    '..bnBBBBBBBnb..',
    '.bb.BBBBBBB.bb.',
    '....BBBBBBB....',
    '....BnBnBnB....',
    '....n.n.n.n....',
  ],
  lich: [
    '...y.y.y.y.....',
    '...yyyyyyy.....',
    '...mmmmmmm.....',
    '..mmkkmkkmm....',
    '..mmcmmmcmm....',
    '...mmmkmmm.....',
    '....mmmmm......',
    '..PPPPPPPPP..c.',
    '.PPPmPPPmPPP.b.',
    '.PP.PPPPP.PP.t.',
    '.m..PPPPP..m.t.',
    '....PPPPP....t.',
    '...PPPPPPP...t.',
    '..PPPPPPPPP....',
    '..P.P.P.P.P....',
  ],
  crown: [
    'y..y..y',
    'yy.y.yy',
    'yyyyyyy',
    'yrybyry',
  ],
  // ------- props -------
  tree: [
    '.......DD.......',
    '.....DDLLDD.....',
    '....DLLLLLLD....',
    '...DLLlLLLLLD...',
    '..DLLLLLLlLLLD..',
    '..DLlLLLLLLLLD..',
    '.DLLLLLLLlLLLLD.',
    '.DLLLlLLLLLLLLD.',
    '.DDLLLLLLLLLLDD.',
    '..DDLLLLLLlLDD..',
    '...DDDLLLLDDD...',
    '....DDDDDDDD....',
    '.......TT.......',
    '.......TT.......',
    '......TTTT......',
    '.....TT..TT.....',
  ],
  rock: [
    '....GGGG....',
    '..GGggggGG..',
    '.GggwgggggG.',
    'GggggggggGGG',
    'GgggggggGGGG',
    '.GGGGGGGGGG.',
  ],
  mush: [
    '..rrrrr..',
    '.rrwrrwr.',
    'rrrrrrrrr',
    '...mmm...',
    '...mmm...',
  ],
  tomb: [
    '..GGGG..',
    '.GggggG.',
    '.GgGGgG.',
    '.GggggG.',
    '.GgGGgG.',
    '.GggggG.',
    'GGGGGGGG',
  ],
  pillar: [
    'GGGGGGGG',
    '.gggggg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gGggGg.',
    '.gggggg.',
    'GGGGGGGG',
  ],
  crystal: [
    '...c...',
    '..ccb..',
    '..cwb..',
    '.ccwbb.',
    '.cwwbb.',
    'ccwwbbB',
    '.cwbbB.',
    '..BBB..',
  ],
  spike: [
    '....k....',
    '...kRk...',
    '..kRrRk..',
    '..kRorRk.',
    '.kRroRRk.',
    '.kRRrRRRk',
    'kRRRRRRRk',
  ],
  // ------- pickups -------
  gem: ['..b..', '.bcb.', 'bcwcb', '.bcb.', '..b..'],
  heart: ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  chest: [
    '.TTTTTTTT.',
    'TYTTTTTTYT',
    'TYYYYYYYYT',
    'TTTTyyTTTT',
    'TYTTkkTTYT',
    'TYTTTTTTYT',
    'TTTTTTTTTT',
  ],
  magnet: ['rr..bb', 'rr..bb', 'rr..bb', 'rr..bb', '.rrbb.', '..rb..'],
};

const SPR = {};

function hexRGB(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(h, a) {
  const [r, g, b] = hexRGB(h);
  return `rgba(${r},${g},${b},${a})`;
}
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rasterize(rows, pal, outline) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const W2 = w + 2, H2 = h + 2;
  const c = newCanvas(W2, H2);
  const x = c.getContext('2d');
  const img = x.createImageData(W2, H2);
  const d = img.data;
  const solid = new Uint8Array(W2 * H2);
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const col = (pal && pal[ch]) || PAL[ch];
      if (!col) continue;
      const [r, g, b] = hexRGB(col);
      const k = (j + 1) * W2 + (i + 1);
      d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255;
      solid[k] = 1;
    }
  }
  if (outline) {
    const [r, g, b] = hexRGB(outline);
    for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
      const k = j * W2 + i;
      if (solid[k]) continue;
      if ((i > 0 && solid[k - 1]) || (i < W2 - 1 && solid[k + 1]) || (j > 0 && solid[k - W2]) || (j < H2 - 1 && solid[k + W2])) {
        d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255;
      }
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
function flipCanvas(c) {
  const n = newCanvas(c.width, c.height), x = n.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  return n;
}
function tintCanvas(c, col) {
  const n = newCanvas(c.width, c.height), x = n.getContext('2d');
  x.drawImage(c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return n;
}

// Obtiene (y crea perezosamente) un sprite. key = base + variante.
function getSpr(base, pal, elite) {
  const key = base + (pal ? JSON.stringify(pal) : '') + (elite ? '#E' : '');
  let s = SPR[key];
  if (s) return s;
  const c = rasterize(RAW[base], pal, elite ? '#ffd43b' : '#140c1c');
  const f = flipCanvas(c);
  s = SPR[key] = { w: c.width, h: c.height, c: [c, f], wh: null, tints: {} };
  return s;
}
function sprWhite(s, dir) {
  if (!s.wh) s.wh = [tintCanvas(s.c[0], '#ffffff'), tintCanvas(s.c[1], '#ffffff')];
  return s.wh[dir];
}
function sprTint(s, dir, col) {
  let t = s.tints[col];
  if (!t) t = s.tints[col] = [tintCanvas(s.c[0], col), tintCanvas(s.c[1], col)];
  return t[dir];
}

// Halo de brillo radial cacheado por color.
const GLOW = {};
function glowSpr(col) {
  let g = GLOW[col];
  if (g) return g;
  g = newCanvas(64, 64);
  const x = g.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 0.9));
  gr.addColorStop(0.35, rgba(col, 0.35));
  gr.addColorStop(1, rgba(col, 0));
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (GLOW[col] = g);
}

// Suelo procedural en pixel art (se usa como patrón repetido).
function makeGround(cols, seed) {
  let s = seed || 1;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const N = 96;
  const c = newCanvas(N, N), x = c.getContext('2d');
  x.fillStyle = cols[0]; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = cols[1 + Math.floor(R() * (cols.length - 1))];
    const px = Math.floor(R() * N), py = Math.floor(R() * N);
    x.fillRect(px, py, R() < 0.8 ? 1 : 2, 1);
  }
  // manchas grandes y suaves
  for (let i = 0; i < 6; i++) {
    x.fillStyle = cols[1 + Math.floor(R() * (cols.length - 1))];
    const cx = Math.floor(R() * N), cy = Math.floor(R() * N), rr = 3 + Math.floor(R() * 5);
    for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) {
      if (xx * xx + yy * yy <= rr * rr && R() < 0.55) x.fillRect((cx + xx + N) % N, (cy + yy + N) % N, 1, 1);
    }
  }
  return c;
}
