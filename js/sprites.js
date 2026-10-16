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
  h: '#7a3f22',                 // cabello de las variantes
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
  druid: [
    '..t.......t....',
    '..tt.....tt....',
    '...tLLLLLt.....',
    '...LLLLLLL.....',
    '..LLsssssLL....',
    '..LskssksL..l..',
    '..LsssssssL.lL.',
    '...LmmmmmL...t.',
    '..DLLmmmLLD..t.',
    '.DDLLLLLLLDD.t.',
    '.s.DLLyLLD.s.t.',
    '...DLLLLLLD..t.',
    '...DDLLLLDD....',
    '...DD....DD....',
    '..TTT....TTT...',
  ],
  berserker: [
    '..w.......w....',
    '..ww.....ww....',
    '...wGGGGGw.....',
    '...GgggggG.....',
    '...GkSSSkG.....',
    '...SsssssS.....',
    '...SrrrrrS..g..',
    '..ssSrrrSss.gg.',
    '.sssssssssss.t.',
    '.ss.sSsSs.ss.t.',
    '.s..ttYYtt..st.',
    '....RRRRRR...t.',
    '....RR..RR.....',
    '....tt..tt.....',
    '...TTT..TTT....',
  ],
  elf: [
    '.....yyyyy.....',
    '....yyyyyyy....',
    '...yysssssyy...',
    '..sysksssksys..',
    '...yssssssy....',
    '...yysSSsyy....',
    '....yLLLLy..t..',
    '...LLLlLLLL..t.',
    '..sLLLlLLLLs.t.',
    '..s.LLlLLL.s.t.',
    '....tttYtt...t.',
    '....LLLLLL..t..',
    '....LL..LL.....',
    '....tt..tt.....',
    '...TTT..TTT....',
  ],
  undead: [
    '...............',
    '.....nnnnn.....',
    '....nnnnnnn..gg',
    '...nnmmmmmnn.g.',
    '...nmlmmmlmn.t.',
    '...nnmmkmmnn.t.',
    '....nmmmmmn..t.',
    '...PPnnnnnPP.t.',
    '..PPPPmPmPPPPt.',
    '..m.PPPPPPP.mt.',
    '....PPMMMPP..t.',
    '....PPPPPPP..t.',
    '...PPPPPPPPP...',
    '...PPPPPPPPP...',
    '...P.P.P.P.P...',
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
  sporeling: [
    '...rrrrr...',
    '..rrwrrwr..',
    '.rrrrrrrrr.',
    'rrwrrrrrwrr',
    '..mmmmmmm..',
    '..mkmmmkm..',
    '..mmmmmmm..',
    '...mmkmm...',
    '...m...m...',
    '..mm...mm..',
  ],
  eel: [
    '............bb..',
    '..........bbbbb.',
    '.bbb....bbbbkbbw',
    'bbBbb..bbBbbbbbb',
    'BbbbBbbbbbBbb...',
    '.BBbbBBbbBB.....',
    '...BBBBBB.......',
  ],
  spider: [
    '.k.........k.',
    '..k..PPP..k..',
    '...kPPPPPk...',
    'kk.PPyPyPP.kk',
    '..kPPPPPPPk..',
    '.k..PPPPP..k.',
    'k...kPPPk...k',
    '...k.....k...',
  ],
  eye: [
    '....pppp....',
    '..pppppppp..',
    '.ppwwwwwwpp.',
    'ppwwwrrwwwpp',
    'pwwwrkkrwwwp',
    'pwwwrkkrwwwp',
    'ppwwwrrwwwpp',
    '.ppwwwwwwpp.',
    '..pppppppp..',
    '..p.p..p.p..',
    '.p..p..p..p.',
  ],
  devourer: [
    '....nnnnnnnn....',
    '..nnnnnnnnnnnn..',
    '.nnnynnnnnnynnn.',
    'nnnnnnnnnnnnnnnn',
    'nnkkkkkkkkkkkknn',
    'nkwkwkwkwkwkwkkn',
    'nkkkkkkkkkkkkkkn',
    'nkkrkkkkkkkkrkkn',
    'nkwkwkwkwkwkwkkn',
    'nnkkkkkkkkkkkknn',
    '.nnnnnnnnnnnnnn.',
    '..nn.nn..nn.nn..',
  ],
  motherRoot: [
    '.....l.ll.l.....',
    '....llrllrll....',
    '...lrrrllrrrl...',
    '..lrrryrryrrrl..',
    '...lrrrllrrrl...',
    '....llrllrll....',
    '......LLLL......',
    '..T..LkLLkL..T..',
    '.TT..LLLLLL..TT.',
    '.T.TTLLkkLLTT.T.',
    'T...TLLLLLLT...T',
    '...TTTLLLLTTT...',
    '..TT.TTTTTT.TT..',
    '.TT..T.TT.T..TT.',
    'TT..TT.TT.TT..TT',
    'T..TT..TT..TT..T',
  ],
  voice: [
    '..p..p....p..p..',
    '..pp.pp..pp.pp..',
    '...pPPPPPPPPp...',
    '..PPPPPPPPPPPP..',
    '.PPwwwwwwwwwwPP.',
    'PPwwwwrrrrwwwwPP',
    'PwwwwrrkkrrwwwwP',
    'PwwwwrkkkkrwwwwP',
    'PwwwwrrkkrrwwwwP',
    'PPwwwwrrrrwwwwPP',
    '.PPwwwwwwwwwwPP.',
    '..PPPPPPPPPPPP..',
    '..P.P..PP..P.P..',
    '.P..P.P..P.P..P.',
    'P..P..P..P..P..P',
  ],
  shroom: [
    '...cccccc...',
    '..cwcccccc..',
    '.cccccbcccc.',
    'cccbcccccwcc',
    'cccccccbcccc',
    '.BBBBBBBBBB.',
    '....mmmm....',
    '....mmmm....',
    '....mMmm....',
    '....mmmm....',
    '...mmmmmm...',
  ],
  root: [
    '....TTTT......',
    '..TTttTTT.....',
    '.TTt...tTT....',
    'TTt.....tTT...',
    'Tt.......tTT..',
    'Tt........tTT.',
    'TT.........TT.',
  ],
  obelisk: [
    '...p...',
    '..pPp..',
    '..pPp..',
    '.pPPPp.',
    '.pPkPp.',
    '.pPPPp.',
    '.pPkPp.',
    '.pPPPp.',
    '.pPPPp.',
    '.PPPPP.',
    'PPPPPPP',
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

// ---------------------------------------------------------------- animaciones
// Cada estado (idle, walk, attack, cast) es una lista de fotogramas. Un fotograma es
// { fila: 'texto' } = filas que cambian respecto al dibujo base, o un array completo.
// Mismo ancho y alto que el base para que el sprite no "salte" al cambiar de fotograma.
const ANIM = {
  warrior: {
    idle: { fps: 2.5, frames: [{}, { 0: '.......rr......', 1: '......rrR......' }] },
    walk: { fps: 9, frames: [
      { 13: '...GGG...gg....', 14: '.........GGG...' },
      {},
      { 13: '....gg...GGG...', 14: '...GGG.........' },
      {},
    ] },
    attack: { frames: [
      { 0: '......rr....wg.', 1: '.....rrR....wg.', 2: '....gggggg..wg.', 3: '...gwgggggggss.' },
      { 7: '..RgwggggwgRsww', 8: '.RRgggrrgggRsgg' },
      { 10: '.R.ss.rrr.ss.ss', 11: '....ttYYYtt..wg', 12: '....GGg.gGG..wg' },
    ] },
  },
  mage: {
    idle: { fps: 2, frames: [{}, { 0: '.......P.......', 1: '.......PPp.....', 8: '....PPwwwwwPP.w' }] },
    walk: { fps: 8, frames: [
      { 13: '...PPPPPPPPPP.t', 14: '..PPPP....PPP..' },
      { 8: '....PPwwwwwPP..', 9: '...PPPPwwwPPP.c', 10: '...sPPPPPPPPscc' },
      { 14: '...PPP....PPPP.' },
      { 8: '....PPwwwwwPP..', 9: '...PPPPwwwPPP.c', 10: '...sPPPPPPPPscc' },
    ] },
    attack: { frames: [
      { 6: '.....sesssse.cc', 7: '.....swwwwws.ct', 8: '....PPwwwwwPPst', 9: '...PPPPwwwPPP.t', 10: '...sPPPPPPPP..t', 11: '....PPPyyyPP...', 12: '....PPPPPPPP...' },
      { 5: '...yyyyyyyyyyyw', 6: '.....sesssse.ww', 7: '.....swwwwws.wt', 8: '....PPwwwwwPPst', 9: '...PPPPwwwPPP.t', 10: '...sPPPPPPPP..t', 11: '....PPPyyyPP...', 12: '....PPPPPPPP...' },
      {},
    ] },
  },
  rogue: {
    idle: { fps: 2, frames: [{}, {}, {}, { 4: '....DkkkkkkD...' }] },
    walk: { fps: 10, frames: [
      { 12: '.....DD..TTT...', 13: '....TTT........' },
      {},
      { 12: '....TTT..DD....', 13: '.........TTT...' },
      {},
    ] },
    attack: { frames: [
      { 8: '..TTDDLLLLDDTTs', 9: '..ss.DDggDD....' },
      { 9: '..ss.DDggDDssgw' },
      {},
    ] },
  },
  druid: {
    idle: { fps: 2, frames: [{}, { 5: '..LskssksL...l.', 6: '..LsssssssL.Ll.' }] },
    walk: { fps: 8, frames: [
      { 13: '..TTT....DD....', 14: '.........TTT...' },
      {},
      { 13: '...DD....TTT...', 14: '..TTT..........' },
      {},
    ] },
    attack: { frames: [
      { 10: '.l.DLLyLLD.l.t.' },
      { 9: '.DDLLLLLLLDDlt.', 10: '...DLLyLLD.ll..' },
      {},
    ] },
  },
  berserker: {
    idle: { fps: 2, frames: [{}, { 4: '...GSSSSSG.....' }, {}, {}] },
    walk: { fps: 9, frames: [
      { 13: '...TTT..tt.....', 14: '........TTT....' },
      {},
      { 13: '....tt..TTT....', 14: '...TTT.........' },
      {},
    ] },
    attack: { frames: [
      { 3: '...GgggggG..gg.', 4: '...GkSSSkG.ggt.', 5: '...SsssssS..t..', 6: '...SrrrrrS.s...', 7: '..ssSrrrSssst..', 8: '.sssssssssss...', 9: '.ss.sSsSs.ss...', 10: '.s..ttYYtt..s..', 11: '....RRRRRR.....' },
      { 6: '...SrrrrrS.....', 7: '..ssSrrrSss....', 8: '.sssssssssssst.', 9: '.ss.sSsSs.sstgg', 10: '.s..ttYYtt...gg', 11: '....RRRRRR.....' },
      {},
    ] },
  },
  elf: {
    idle: { fps: 2, frames: [{}, { 0: '....yyyyy......' }] },
    walk: { fps: 10, frames: [
      { 13: '...TTT..tt.....', 14: '........TTT....' },
      {},
      { 13: '....tt..TTT....', 14: '...TTT.........' },
      {},
    ] },
    attack: { frames: [
      { 8: '..sLLLlLLLLsst.' },
      { 8: '..sLLLlLLLL.wwt' },
      {},
    ] },
  },
  undead: {
    idle: { fps: 3, frames: [{}, { 4: '...nmwmmmwmn.t.', 14: '....P.P.P.P.P..' }] },
    walk: { fps: 6, frames: [
      { 13: '..PPPPPPPPP....', 14: '..P.P.P.P.P....' },
      {},
      { 13: '....PPPPPPPPP..', 14: '....P.P.P.P.P..' },
      {},
    ] },
    attack: { frames: [
      { 2: '....nnnnnnn.ggg', 3: '...nnmmmmmnnt..', 9: '..m.PPPPPPP..m.' },
      { 2: '....nnnnnnn....', 3: '...nnmmmmmnn...', 4: '...nmlmmmlmn...', 5: '...nnmmkmmnn...', 6: '....nmmmmmn....', 7: '...PPnnnnnPP...', 8: '..PPPPmPmPPPP..', 9: '..m.PPPPPPP.mtt', 10: '....PPMMMPP..gg', 11: '....PPPPPPP.gg.' },
      {},
    ] },
  },
  // ------- jefes (se reutilizan con su paleta) -------
  motherRoot: {
    idle: { fps: 2, frames: [{}, { 0: '....l.ll.l......', 15: '.T..TT..TT..TT..' }] },
    walk: { fps: 4, frames: [{ 15: 'T..TT..TT..TT..T' }, { 14: '.TT..TT.TT..TT..', 15: '.T..TT..TT..TT..' }] },
    cast: { fps: 6, frames: [
      { 3: '..lrrrwrrwrrrl..', 7: '..T..LyLLyL..T..' },
      { 2: '..lrrrrllrrrrl..', 4: '..lrrrrllrrrrl..', 7: '..T..LyLLyL..T..' },
    ] },
    attack: { fps: 8, frames: [{ 7: '..T..LyLLyL..T..', 9: '.T.TTLLrrLLTT.T.' }, { 7: '..T..LyLLyL..T..' }] },
  },
  voice: {
    idle: { fps: 3, frames: [{}, { 12: '...P.P.PP.P.P...', 13: '..P..P.PP.P..P..', 14: '.P..P..PP..P..P.' }] },
    walk: { fps: 5, frames: [{}, { 12: '...P.P.PP.P.P...', 13: '..P..P.PP.P..P..', 14: '.P..P..PP..P..P.' }] },
    cast: { fps: 8, frames: [
      { 6: 'PwwwwrrwwrrwwwwP', 7: 'PwwwwrwwwwrwwwwP', 8: 'PwwwwrrwwrrwwwwP' },
      { 0: '.p..p......p..p.', 1: '..pp.pp..pp.pp..' },
    ] },
    attack: { fps: 10, frames: [{ 5: 'PPwwwrrrrrrwwwPP', 9: 'PPwwwrrrrrrwwwPP' }, {}] },
  },
  slime: {
    idle: { fps: 3, frames: [null, 'squash'] },
    walk: { fps: 4, frames: [null, 'squash', null, 'stretch'] },
    attack: { fps: 8, frames: ['stretch', 'open'] },
  },
  lich: {
    idle: { fps: 3, frames: [{}, { 4: '..mmwmmmwmm....', 14: '...P.P.P.P.P...' }] },
    walk: { fps: 6, frames: [{ 14: '...P.P.P.P.P...' }, {}, { 13: '..PPPPPPPPP....', 14: '.P.P.P.P.P.....' }, {}] },
    cast: { fps: 7, frames: [
      { 3: '..mmkkmkkmm..c.', 4: '..mmcmmmcmm..b.', 5: '.m.mmmkmmm.m.t.', 6: '.m..mmmmm..m.t.', 7: '.mPPPPPPPPPm.t.', 8: '..PPmPPPmPP..t.', 9: '..P.PPPPP.P....', 10: '....PPPPP......' },
      { 3: '..mmkkmkkmm..w.', 4: '..mmwmmmwmm..c.', 5: '.m.mmmkmmm.m.t.', 6: '.m..mmmmm..m.t.', 7: '.mPPPPPPPPPm.t.', 8: '..PPmPPPmPP..t.', 9: '..P.PPPPP.P....', 10: '....PPPPP......' },
    ] },
  },
  golem: {
    idle: { fps: 2, frames: [{}, { 2: '...GgwGgwGG.....' }] },
    walk: { fps: 5, frames: [
      { 10: '...GGGG.GgG.....', 11: '.........GGGG...' },
      {},
      { 10: '....GgG.GGGG....', 11: '...GGGG.........' },
      {},
    ] },
    attack: { fps: 6, frames: [
      { 1: 'Gg.GgggggGG.gG..', 2: 'GgGGgyGgyGGGgG..', 3: 'GgGGggggggGGgG..', 5: '....GGggGG......', 6: '....GggggG......', 7: '....GggggG......', 8: '....GGGGGG......' },
      { 2: '...GgwGgwGG.....', 8: 'GGG.GGGGGG.GGG..' },
    ] },
  },
};
// fotogramas completos con nombre (el limo se aplasta y se estira entero)
const ANIM_FULL = {
  slime: {
    squash: [
      '................',
      '.....lllllwl....',
      '...llllllwwlll..',
      '..llllllllllll..',
      '.lllkkllkklllLL.',
      '.lllkkllkkllLLL.',
      '.LllllllllllLLL.',
      '.LLllkkkklLLLLL.',
      '..LLLLLLLLLLLL..',
      '...LLLLLLLLLL...',
    ],
    stretch: [
      '.....llllw......',
      '....lllllwwl....',
      '....llllllll....',
      '...lllllllll....',
      '...lkkllkkllL...',
      '...lkkllkklLL...',
      '...llllllllLL...',
      '...LlkkkklLLL...',
      '....LLLLLLLL....',
      '.....LLLLLL.....',
    ],
    open: [
      '......llll......',
      '....llllwlll....',
      '...lllllwwlll...',
      '..lllllllllll...',
      '..llkkllkklllL..',
      '..llkkllkkllLL..',
      '..lllkkkkkllLL..',
      '..LllkrrrklLLL..',
      '...LLkkkkLLLL...',
      '....LLLLLLLL....',
    ],
  },
};
// Variantes (p. ej. Maga): una capa encima del dibujo base y de TODOS sus fotogramas.
// '.' = transparente; cualquier otra letra pinta encima (pelo, labios, quitar barba…).
const VARIANTS = {
  warriorF:   { of: 'warrior',   over: { 4: '..h.........h..', 5: '..h.........h..', 6: '..hh...r...hh..', 7: '.hh.........hh.', 8: '.h...........h.' } },
  mageF:      { of: 'mage',      over: { 6: '....h.......h..', 7: '....h.ssrss.h..', 8: '....h.PPPPP.h..', 9: '.......PPP.....' } },
  rogueF:     { of: 'rogue',     over: { 4: '...o.......o...', 5: '...o.......o...', 6: '...oo.....oo...', 7: '..o.........o..', 8: '..o.........o..' } },
  druidF:     { of: 'druid',     over: { 4: '.h.........h...', 5: '.h.........h...', 6: '.h....r....h...', 7: '.h..LLLLL......', 8: '.....LLL.......' } },
  berserkerF: { of: 'berserker', over: { 4: '..r.......r....', 5: '..r.......r....', 6: '..r.sssss.r....', 7: '..r..srs.......', 8: '...RRRRRRR.....' } },
  elfF:       { of: 'elf',       over: { 5: '......rr.......', 6: '...y......y....', 7: '..y........y...' } },
  undeadF:    { of: 'undead',    over: { 5: '..m.........m..', 6: '...m.......m...', 7: '..m.........m..', 8: '.m.............' } },
};
const sprBase = b => (VARIANTS[b] ? VARIANTS[b].of : b);
function withVariant(b, rows) {
  const V = VARIANTS[b]; if (!V) return rows;
  return rows.map((row, i) => {
    const o = V.over[i]; if (!o) return row;
    let out = ''; for (let k = 0; k < row.length; k++) out += o[k] && o[k] !== '.' ? o[k] : row[k];
    return out;
  });
}
function frameRows(base, st, fi) {
  const f = ANIM[base][st].frames[fi];
  if (f === null || f === undefined) return RAW[base];
  if (typeof f === 'string') return ANIM_FULL[base][f];
  if (Array.isArray(f)) return f;
  return RAW[base].map((row, i) => f[i] !== undefined ? f[i] : row);
}

// Máquina de estados: `want` es el estado de fondo (idle/walk); animPlay fuerza uno
// (attack/cast) que se mantiene hasta acabar y luego vuelve solo al de fondo.
function animTick(o, dt, want) {
  const a = o.anim || (o.anim = { st: 'idle', t: 0, lock: 0, dur: 0 });
  a.t += dt; a.lock -= dt;
  const next = a.lock > 0 ? a.st : want;
  if (next !== a.st) { a.st = next; a.t = 0; a.dur = 0; }
}
function animPlay(o, st, dur) {
  const a = o.anim || (o.anim = { st: 'idle', t: 0, lock: 0, dur: 0 });
  a.st = st; a.t = 0; a.lock = dur; a.dur = dur;
}
// sprite del fotograma actual; si no hay animación para ese estado, cae a idle y luego al dibujo base
function animSpr(base, pal, elite, a) {
  const A = ANIM[sprBase(base)];
  if (!A || !a) return getSpr(base, pal, elite);
  const st = A[a.st] ? a.st : a.st === 'cast' && A.attack ? 'attack' : a.st === 'attack' && A.cast ? 'cast' : 'idle';
  const S_ = A[st]; if (!S_) return getSpr(base, pal, elite);
  const n = S_.frames.length;
  const fi = a.dur > 0 && a.st === st ? Math.min(n - 1, Math.floor(a.t / a.dur * n)) : Math.floor(a.t * (S_.fps || 8)) % n;   // jugada: repartida en su duración
  return getSpr(base, pal, elite, st, fi);
}

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
function getSpr(base, pal, elite, st, fi) {
  const key = base + (pal ? JSON.stringify(pal) : '') + (elite ? '#E' : '') + (st ? '|' + st + fi : '');
  let s = SPR[key];
  if (s) return s;
  const b0 = sprBase(base);
  const c = rasterize(withVariant(base, st ? frameRows(b0, st, fi) : RAW[b0]), pal, elite ? '#ffd43b' : '#140c1c');
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
