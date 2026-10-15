'use strict';
// =====================================================================
//  DATOS DEL JUEGO — clases, escuelas, mejoras, armas, enemigos,
//  jefes, niveles, caminos y mejoras permanentes. Editar aquí para
//  balancear sin tocar el motor.
// =====================================================================

const WORLD = 80 * 64;       // tamaño del mapa (baldosa 80px × 64), generado proceduralmente
const LEVEL_TIME = 150;      // segundos de oleadas antes del jefe

const pct = v => Math.round(v * 100) + '%';
const num = v => (Math.round(v * 10) / 10).toString();

const RAR = [
  { n: 'Común', c: '#c8c8d0', m: 1 },
  { n: 'Raro', c: '#4aa3ff', m: 1.5 },
  { n: 'Épico', c: '#b066ff', m: 2.2 },
  { n: 'Legendario', c: '#ffb020', m: 3.2 },
];

// Escuelas: acumular puntos (3/6/9) desbloquea bonos de hiperespecialización.
const SCHOOLS = {
  fuego:    { n: 'Fuego',    ic: '🔥', c: '#ff7a2f', tiers: ['+20% prob. de quemar', 'Los enemigos en llamas EXPLOTAN al morir', 'Siempre quemas y la quemadura hace x2'] },
  hielo:    { n: 'Hielo',    ic: '❄️', c: '#8ff3ff', tiers: ['Tus golpes ralentizan 30%', '+12% congelar; los congelados estallan en esquirlas', '+5 armadura y aura gélida que ralentiza todo'] },
  tormenta: { n: 'Tormenta', ic: '⚡', c: '#ffe14a', tiers: ['+15% prob. de rayo en cadena', '+3 saltos de cadena; tu dash electrocuta', 'Cada 1.5s cae un rayo triple'] },
  sangre:   { n: 'Sangre',   ic: '🩸', c: '#ff3b5c', tiers: ['+3% robo de vida', '+50 vida máx. y cada muerte te cura', 'Más daño cuanto menos vida; nova de sangre al ser golpeado'] },
  sombra:   { n: 'Sombra',   ic: '🗡️', c: '#c38bff', tiers: ['+10% prob. de crítico', 'Los críticos hacen +100% daño', '+20% esquiva; tras un dash, 3 críticos garantizados'] },
  arcano:   { n: 'Arcano',   ic: '🔮', c: '#6aa8ff', tiers: ['+1 proyectil', '-20% enfriamientos', 'Proyectiles teledirigidos que rebotan'] },
};
const SCHOOL_KEYS = Object.keys(SCHOOLS);

const CLASSES = {
  guerrero: {
    n: 'Guerrero', spr: 'warrior', hp: 140, spd: 205, armor: 3, crit: 0.05, school: 'sangre',
    desc: 'Cuerpo a cuerpo devastador. Tajos amplios con gran empuje. Los proyectiles extra se vuelven ondas de corte.',
    prims: [
      { id: 'mandoble', n: 'Mandoble', rate: 1.7, dmg: 26, d: 'Tajo amplio en arco con gran empuje.' },
      { id: 'lanza', n: 'Lanza', rate: 2.2, dmg: 21, d: 'Estocada larga y estrecha que atraviesa a todos en línea.' },
    ],
    secs: [
      { id: 'torbellino', n: 'Torbellino', cd: 6, d: 'Giras golpeando todo a tu alrededor 3 veces.' },
      { id: 'grito', n: 'Grito de Guerra', cd: 10, d: 'Aturde y repele a los cercanos; 6s de +25% daño y +8 armadura.' },
    ],
    ult: { n: 'Furia del Titán', d: '8s: +60% daño, +50% vel. ataque, +5% robo de vida, más alcance.' },
  },
  mago: {
    n: 'Mago', spr: 'mage', hp: 95, spd: 215, armor: 0, crit: 0.05, school: 'arcano',
    desc: 'Proyectiles arcanos a distancia. Frágil pero escala de forma explosiva con proyectiles y área.',
    prims: [
      { id: 'arcano', n: 'Proyectil Arcano', rate: 2.6, dmg: 15, d: 'Proyectiles rápidos que buscan levemente al objetivo.' },
      { id: 'fuego', n: 'Bola de Fuego', rate: 1.4, dmg: 22, d: 'Lenta, explota en área y quema.' },
    ],
    secs: [
      { id: 'nova', n: 'Nova Helada', cd: 8, d: 'Explosión de hielo que daña y congela a los cercanos.' },
      { id: 'parpadeo', n: 'Parpadeo', cd: 5, d: 'Te teletransportas al cursor con una explosión al salir y al llegar.' },
    ],
    ult: { n: 'Lluvia de Meteoros', d: '5s de meteoros cayendo sobre todos los enemigos visibles.' },
  },
  picaro: {
    n: 'Pícaro', spr: 'rogue', hp: 105, spd: 240, armor: 1, crit: 0.15, school: 'sombra',
    desc: 'Rápido y letal. Lanza dagas a gran cadencia y vive de los críticos y la esquiva.',
    prims: [
      { id: 'dagas', n: 'Dagas', rate: 3.8, dmg: 8, d: 'Ráfagas de 2 dagas a gran cadencia.' },
      { id: 'ballesta', n: 'Ballesta', rate: 1.5, dmg: 30, d: 'Virotes pesados que perforan 3 enemigos; +15% crítico.' },
    ],
    secs: [
      { id: 'abanico', n: 'Abanico de Cuchillas', cd: 5, d: 'Lanza 16 cuchillas en todas direcciones.' },
      { id: 'humo', n: 'Bomba de Humo', cd: 9, d: 'Nube que envenena y ralentiza; 2.5s de esquiva total.' },
    ],
    ult: { n: 'Danza Sombría', d: '6s: invulnerable, 100% crítico y +40% velocidad.' },
  },
};

// m = multiplicador por rareza. Cada mejora suma 1 punto a su escuela (legendaria: 2).
const UPGRADES = [
  { id: 'poder', n: 'Poder Bruto', ic: '💪', sch: null, max: 12, tx: m => `+${pct(0.10 * m)} daño`, ap: (b, m) => b.dmg += 0.10 * m },
  { id: 'iman', n: 'Imán', ic: '🧲', sch: null, max: 5, tx: m => `+${pct(0.35 * m)} rango de recogida`, ap: (b, m) => b.magnet *= 1 + 0.35 * m },
  { id: 'sabid', n: 'Sabiduría', ic: '📜', sch: null, max: 6, tx: m => `+${pct(0.12 * m)} experiencia`, ap: (b, m) => b.xp += 0.12 * m },
  { id: 'suerte', n: 'Trébol', ic: '🍀', sch: null, max: 5, tx: m => `+${Math.round(12 * m)} suerte (mejores rarezas)`, ap: (b, m) => b.luck += 12 * m },

  { id: 'brasas', n: 'Brasas', ic: '🔥', sch: 'fuego', max: 6, tx: m => `+${pct(0.14 * m)} prob. de quemar`, ap: (b, m) => b.burnCh += 0.14 * m },
  { id: 'corazon', n: 'Corazón Ígneo', ic: '❤️‍🔥', sch: 'fuego', max: 6, tx: m => `+${pct(0.25 * m)} daño a enemigos en llamas`, ap: (b, m) => b.burnBonus += 0.25 * m },
  { id: 'pirom', n: 'Piromancia', ic: '🌋', sch: 'fuego', max: 6, tx: m => `+${pct(0.4 * m)} daño de quemadura, +${pct(0.05 * m)} daño`, ap: (b, m) => { b.burnDmg += 0.4 * m; b.dmg += 0.05 * m; } },

  { id: 'escarcha', n: 'Escarcha', ic: '🧊', sch: 'hielo', max: 5, tx: m => `Tus golpes ralentizan +${pct(0.1 * m)}`, ap: (b, m) => b.slow += 0.1 * m },
  { id: 'glacial', n: 'Armadura Glacial', ic: '🛡️', sch: 'hielo', max: 6, tx: m => `+${num(2.5 * m)} armadura, +${Math.round(10 * m)} vida máx.`, ap: (b, m) => { b.armor += 2.5 * m; b.maxHp += 10 * m; } },
  { id: 'cero', n: 'Cero Absoluto', ic: '❄️', sch: 'hielo', max: 5, minR: 1, tx: m => `+${pct(0.05 * m)} prob. de congelar`, ap: (b, m) => b.freezeCh += 0.05 * m },

  { id: 'chispa', n: 'Chispa', ic: '⚡', sch: 'tormenta', max: 6, tx: m => `+${pct(0.1 * m)} prob. de rayo en cadena`, ap: (b, m) => b.chainCh += 0.1 * m },
  { id: 'conductor', n: 'Conductor', ic: '🔌', sch: 'tormenta', max: 5, tx: m => `+${Math.max(1, Math.floor(m))} salto de cadena, +${pct(0.15 * m)} daño de cadena`, ap: (b, m) => { b.chainJumps += Math.max(1, Math.floor(m)); b.chainDmg += 0.15 * m; } },
  { id: 'pies', n: 'Pies de Trueno', ic: '👟', sch: 'tormenta', max: 6, tx: m => `+${pct(0.08 * m)} velocidad de movimiento`, ap: (b, m) => b.speed += 0.08 * m },
  { id: 'dashx', n: 'Paso Relámpago', ic: '💨', sch: 'tormenta', max: 3, minR: 1, tx: () => '+1 carga de dash', ap: b => b.dashes += 1 },

  { id: 'colmillos', n: 'Colmillos', ic: '🦇', sch: 'sangre', max: 6, tx: m => `+${pct(0.015 * m)} robo de vida`, ap: (b, m) => b.lifesteal += 0.015 * m },
  { id: 'vigor', n: 'Vigor', ic: '💗', sch: 'sangre', max: 8, tx: m => `+${Math.round(22 * m)} vida máx. y te cura`, ap: (b, m) => b.maxHp += 22 * m, heal: m => 22 * m },
  { id: 'frenesi', n: 'Frenesí', ic: '😤', sch: 'sangre', max: 8, tx: m => `+${pct(0.1 * m)} velocidad de ataque`, ap: (b, m) => b.atkSpd += 0.1 * m },
  { id: 'regen', n: 'Regeneración', ic: '✚', sch: 'sangre', max: 6, tx: m => `+${num(0.6 * m)} vida/seg`, ap: (b, m) => b.regen += 0.6 * m },
  { id: 'espinas', n: 'Espinas', ic: '🌵', sch: 'sangre', max: 5, tx: m => `Devuelves ${Math.round(20 * m)} daño al ser golpeado`, ap: (b, m) => b.thorns += 20 * m },

  { id: 'ojo', n: 'Ojo Certero', ic: '🎯', sch: 'sombra', max: 7, tx: m => `+${pct(0.06 * m)} prob. de crítico`, ap: (b, m) => b.crit += 0.06 * m },
  { id: 'letal', n: 'Golpe Letal', ic: '☠️', sch: 'sombra', max: 6, tx: m => `+${pct(0.3 * m)} daño crítico`, ap: (b, m) => b.critMult += 0.3 * m },
  { id: 'evasion', n: 'Evasión', ic: '🌫️', sch: 'sombra', max: 5, tx: m => `+${pct(0.05 * m)} esquiva`, ap: (b, m) => b.dodge += 0.05 * m },
  { id: 'asesino', n: 'Instinto Asesino', ic: '🔪', sch: 'sombra', max: 6, tx: m => `+${pct(0.08 * m)} vel. ataque, +${pct(0.03 * m)} crítico`, ap: (b, m) => { b.atkSpd += 0.08 * m; b.crit += 0.03 * m; } },

  { id: 'multi', n: 'Multidisparo', ic: '✳️', sch: 'arcano', max: 5, minR: 1, tx: m => `+${Math.max(1, Math.floor(m - 0.5))} proyectil`, ap: (b, m) => b.proj += Math.max(1, Math.floor(m - 0.5)) },
  { id: 'amplif', n: 'Amplificar', ic: '⭕', sch: 'arcano', max: 6, tx: m => `+${pct(0.12 * m)} área`, ap: (b, m) => b.area += 0.12 * m },
  { id: 'celer', n: 'Celeridad', ic: '⏳', sch: 'arcano', max: 6, tx: m => `-${pct(0.07 * m)} enfriamientos`, ap: (b, m) => b.cdr += 0.07 * m },
  { id: 'perfor', n: 'Perforación', ic: '📍', sch: 'arcano', max: 5, tx: m => `+${Math.max(1, Math.floor(m))} perforación`, ap: (b, m) => b.pierce += Math.max(1, Math.floor(m)) },
  { id: 'velproj', n: 'Impulso', ic: '🏹', sch: 'arcano', max: 5, tx: m => `+${pct(0.15 * m)} vel. y alcance de proyectil, +${pct(0.04 * m)} daño`, ap: (b, m) => { b.projSpd += 0.15 * m; b.dmg += 0.04 * m; } },
];
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// Armas automáticas (máx. 4). Nivel 5 + 6 puntos en su escuela → evolución.
const WEAPONS = {
  orbes:   { n: 'Orbes Ígneos', ic: '🔥', sch: 'fuego', d: 'Bolas de fuego orbitan a tu alrededor y queman.', evo: 'Sol Negro', evoD: '+3 orbes enormes, daño x2 y siempre queman.' },
  aura:    { n: 'Aura de Escarcha', ic: '❄️', sch: 'hielo', d: 'Aura helada que daña y ralentiza a los cercanos.', evo: 'Ventisca Eterna', evoD: 'Aura +60% radio, daño x2.2, congela.' },
  rayos:   { n: 'Báculo de Tormenta', ic: '⚡', sch: 'tormenta', d: 'Lanza rayos automáticos a los enemigos cercanos.', evo: 'Juicio del Cielo', evoD: 'Doble cadencia, +2 objetivos, encadena 4 veces.' },
  dagas:   { n: 'Dagas Fantasma', ic: '🗡️', sch: 'sombra', d: 'Dagas espectrales buscan al enemigo más cercano.', evo: 'Mil Filos', evoD: 'Doble de dagas y siempre son críticas.' },
  craneos: { n: 'Cráneos Sangrientos', ic: '💀', sch: 'sangre', d: 'Cráneos teledirigidos que te curan al impactar.', evo: 'Legión Carmesí', evoD: 'Doble de cráneos y explotan en área.' },
  meteoro: { n: 'Meteoro Arcano', ic: '☄️', sch: 'arcano', d: 'Invoca meteoros sobre grupos de enemigos.', evo: 'Cataclismo', evoD: '+2 meteoros, daño x2, área +40%.' },
};

// ai: chase | bat | ranged | charger | exploder | radial | ghost
const ENEMIES = {
  slime:    { spr: 'slime', hp: 12, spd: 78, dmg: 7, r: 13, xp: 1, ai: 'chase', sc: 2.5, blood: '#7ee36b' },
  bat:      { spr: 'bat', hp: 7, spd: 150, dmg: 5, r: 11, xp: 1, ai: 'bat', sc: 2.2, blood: '#b066ff', fly: true },
  ghoul:    { spr: 'ghoul', hp: 28, spd: 60, dmg: 10, r: 15, xp: 2, ai: 'chase', sc: 2.9, blood: '#3a9a3f' },
  archer:   { spr: 'skel', pal: { m: '#d9c9a0', k: '#3a2a1a' }, hp: 16, spd: 68, dmg: 8, r: 14, xp: 2, ai: 'ranged', sc: 2.7, range: 320, fire: 2.4, bspd: 230, bcol: '#e8e0c8', blood: '#e8e0c8' },
  boar:     { spr: 'boar', hp: 40, spd: 62, dmg: 14, r: 17, xp: 3, ai: 'charger', sc: 2.9, blood: '#8a5a3b' },
  bigslime: { spr: 'slime', pal: { l: '#3fcf8e', L: '#1d7a52' }, hp: 70, spd: 46, dmg: 12, r: 25, xp: 4, ai: 'chase', sc: 4.4, split: 'slime', blood: '#3fcf8e' },

  skel:     { spr: 'skel', hp: 24, spd: 82, dmg: 10, r: 14, xp: 2, ai: 'chase', sc: 2.8, blood: '#e8e0c8' },
  ghost:    { spr: 'ghost', hp: 18, spd: 96, dmg: 8, r: 14, xp: 2, ai: 'ghost', sc: 2.7, blood: '#8ff3ff', fly: true, alpha: 0.75 },
  icebat:   { spr: 'bat', pal: { P: '#2b8fd6', y: '#ffffff' }, hp: 10, spd: 165, dmg: 6, r: 11, xp: 1, ai: 'bat', sc: 2.2, blood: '#8ff3ff', fly: true },
  wraith:   { spr: 'wraith', hp: 30, spd: 72, dmg: 10, r: 15, xp: 3, ai: 'ranged', sc: 2.9, range: 300, fire: 2.6, bspd: 210, bcol: '#8ff3ff', spread: 3, fly: true, blood: '#4aa3ff' },
  icegolem: { spr: 'golem', pal: { G: '#4b6a8a', g: '#9fc6e8', y: '#8ff3ff' }, hp: 150, spd: 42, dmg: 20, r: 24, xp: 8, ai: 'chase', sc: 3.8, kres: 0.25, blood: '#9fc6e8' },

  imp:      { spr: 'imp', hp: 14, spd: 168, dmg: 16, r: 12, xp: 2, ai: 'exploder', sc: 2.5, blood: '#ff8a2a' },
  fireel:   { spr: 'fireel', hp: 34, spd: 62, dmg: 10, r: 15, xp: 3, ai: 'radial', sc: 2.9, range: 260, fire: 3.2, bspd: 180, bcol: '#ff8a2a', n: 8, fly: true, blood: '#ffd43b' },
  magma:    { spr: 'golem', pal: { G: '#5a1a1a', g: '#c0392b', y: '#ffd43b' }, hp: 120, spd: 56, dmg: 22, r: 24, xp: 7, ai: 'charger', sc: 3.8, kres: 0.3, blood: '#ff8a2a' },
  lavaslime:{ spr: 'slime', pal: { l: '#ff8a2a', L: '#c0392b', w: '#ffd43b' }, hp: 80, spd: 50, dmg: 14, r: 25, xp: 5, ai: 'chase', sc: 4.4, split: 'imp', blood: '#ff8a2a' },
  fireskel: { spr: 'skel', pal: { m: '#4a3a3a', M: '#2a1a1a', k: '#ff8a2a' }, hp: 30, spd: 92, dmg: 12, r: 14, xp: 2, ai: 'chase', sc: 2.8, blood: '#ff8a2a' },
};

const BOSSES = {
  slimeKing: { n: 'Rey Limo', spr: 'slime', pal: { l: '#5be34a', L: '#227a2f' }, sc: 9, r: 54, hp: 3800, dmg: 22, spd: 70, crown: true },
  lich:      { n: 'Liche de Escarcha', spr: 'lich', pal: { P: '#2b5fb3', p: '#4aa3ff' }, sc: 6, r: 40, hp: 8500, dmg: 20, spd: 95 },
  forge:     { n: 'Señor de la Forja', spr: 'golem', pal: { G: '#5a1a1a', g: '#c0392b', y: '#ffd43b' }, sc: 7.5, r: 60, hp: 16000, dmg: 30, spd: 80, crown: true },
};

const LEVELS = [
  {
    n: 'Bosque Sombrío', sub: 'Nivel 1', biome: 'forest', bg: '#14201a',
    ground: ['#2a3d27', '#304a2b', '#253522', '#36552f', '#1f2e1c'],
    props: [['tree', 70], ['rock', 25], ['mush', 25]],
    decal: ['#4a7a3a', '#5e9446', '#7a5a3a'],
    spawns: [{ e: 'slime', w: 10, t: 0 }, { e: 'bat', w: 6, t: 12 }, { e: 'ghoul', w: 6, t: 28 }, { e: 'archer', w: 3, t: 45 }, { e: 'boar', w: 3, t: 65 }, { e: 'bigslime', w: 2, t: 85 }],
    events: [{ t: 35, k: 'ring', e: 'bat', n: 22 }, { t: 60, k: 'elite', e: 'ghoul' }, { t: 90, k: 'ring', e: 'slime', n: 36 }, { t: 115, k: 'elite', e: 'boar' }, { t: 130, k: 'elite', e: 'bigslime' }],
    hp: 1, dmg: 1, rate: 1, xp: 1, boss: 'slimeKing', music: 0,
  },
  {
    n: 'Cripta Helada', sub: 'Nivel 2', biome: 'crypt', bg: '#0d1220',
    ground: ['#262a3a', '#2c3144', '#20232f', '#33384d', '#1b1e29'],
    props: [['tomb', 45], ['pillar', 30], ['crystal', 30]],
    decal: ['#b5ab8f', '#8ff3ff', '#3a3f55'],
    spawns: [{ e: 'skel', w: 10, t: 0 }, { e: 'icebat', w: 6, t: 8 }, { e: 'ghost', w: 6, t: 20 }, { e: 'wraith', w: 3, t: 40 }, { e: 'archer', w: 3, t: 55 }, { e: 'icegolem', w: 2, t: 80 }],
    events: [{ t: 30, k: 'ring', e: 'icebat', n: 28 }, { t: 55, k: 'elite', e: 'wraith' }, { t: 85, k: 'ring', e: 'skel', n: 40 }, { t: 110, k: 'elite', e: 'icegolem' }, { t: 128, k: 'ring', e: 'ghost', n: 30 }],
    hp: 2.4, dmg: 1.35, rate: 1.15, xp: 1.6, boss: 'lich', music: 1,
  },
  {
    n: 'Forja Infernal', sub: 'Nivel 3', biome: 'forge', bg: '#1a0c0a',
    ground: ['#3a1e18', '#43231b', '#2e1712', '#512a1e', '#24120e'],
    props: [['spike', 55], ['rock', 30]],
    decal: ['#ff6a1a', '#c0392b', '#2a1410'],
    spawns: [{ e: 'imp', w: 9, t: 0 }, { e: 'fireskel', w: 9, t: 0 }, { e: 'fireel', w: 4, t: 20 }, { e: 'lavaslime', w: 3, t: 40 }, { e: 'magma', w: 3, t: 60 }],
    events: [{ t: 25, k: 'ring', e: 'imp', n: 30 }, { t: 50, k: 'elite', e: 'magma' }, { t: 80, k: 'ring', e: 'fireskel', n: 44 }, { t: 105, k: 'elite', e: 'fireel' }, { t: 125, k: 'ring', e: 'imp', n: 50 }],
    hp: 5.2, dmg: 1.8, rate: 1.3, xp: 2.4, boss: 'forge', music: 2,
  },
];

// Encrucijada entre niveles: el jugador elige un camino.
const PATHS = [
  { id: 'guerra', n: 'Sendero de Guerra', ic: '⚔️', d: '+3 subidas de nivel ahora. Enemigos +15% vida.' },
  { id: 'santuario', n: 'Santuario', ic: '⛲', d: 'Curación total y +30 vida máxima.' },
  { id: 'pacto', n: 'Pacto de Sangre', ic: '🩸', d: '+30% daño permanente, pero -15% vida máxima.' },
  { id: 'maldito', n: 'Camino Maldito', ic: '💀', d: 'Enemigos +35% más y +25% vida. +50% exp y almas x2.' },
  { id: 'reliquia', n: 'Reliquia Antigua', ic: '🏺', d: 'Abres un cofre legendario.' },
  { id: 'forja', n: 'Yunque Rúnico', ic: '🔨', d: 'Todas tus armas suben +1 nivel (o recibes una nueva).' },
  { id: 'destino', n: 'Ojo del Destino', ic: '👁️', d: '+3 re-tiradas y +20 suerte.' },
];

// Altar de Almas POR PARTIDA: se compra en la encrucijada con las almas de esta run.
// El precio sube un 60% con cada compra del mismo objeto.
const RUN_SHOP = [
  { id: 'fuerza', n: 'Fuerza', ic: '💪', cost: 18, d: '+8% daño', ap: () => { P.b.dmg += 0.08; } },
  { id: 'vida', n: 'Vitalidad', ic: '💗', cost: 15, d: '+20 vida máx.', ap: () => { P.b.maxHp += 20; } },
  { id: 'celer', n: 'Celeridad', ic: '⚡', cost: 22, d: '+8% vel. de ataque', ap: () => { P.b.atkSpd += 0.08; } },
  { id: 'elixir', n: 'Elixir', ic: '🧪', cost: 12, d: 'Cura toda tu vida', ap: () => { P.hp = P.s.maxHp; } },
  { id: 'dado', n: 'Dado del Destino', ic: '🎲', cost: 12, d: '+2 re-tiradas', ap: () => { P.rerolls += 2; } },
  { id: 'trebol', n: 'Trébol', ic: '🍀', cost: 20, d: '+10 suerte', ap: () => { P.b.luck += 10; } },
  { id: 'pergamino', n: 'Pergamino', ic: '📜', cost: 30, d: 'Una mejora de rareza rara o superior', ap: () => { S.chestQueue.push('chest'); } },
  { id: 'fenix', n: 'Pluma de Fénix', ic: '🪶', cost: 70, max: 1, d: 'Revives una vez con 50% de vida', ap: () => { P.revive += 1; } },
];

// Personalización (cosmética): cada ranura cambia letras de la paleta del sprite.
// Las opciones con coste se desbloquean con Esencia (almas totales ganadas en todas tus partidas).
const CUSTOM = {
  guerrero: [
    { id: 'armor', n: 'Armadura', keys: ['g', 'G', 'w'], opts: [
      { n: 'Acero', c: ['#a9b3bd', '#5d6670', '#f4f4f4'] },
      { n: 'Bronce', c: ['#d08a4a', '#7a4a20', '#ffd0a0'] },
      { n: 'Jade', c: ['#5bd48a', '#2a7a4a', '#c8ffd8'], cost: 120 },
      { n: 'Oro', c: ['#ffd43b', '#b8860b', '#fff3b0'], cost: 250 },
      { n: 'Obsidiana', c: ['#4a4458', '#1f1a28', '#8a80a0'], cost: 400 } ] },
    { id: 'cape', n: 'Capa y penacho', keys: ['r', 'R'], opts: [
      { n: 'Carmesí', c: ['#d63c3c', '#8e1f2a'] },
      { n: 'Real', c: ['#4aa3ff', '#2b5fb3'] },
      { n: 'Bosque', c: ['#5be34a', '#227a2f'] },
      { n: 'Noche', c: ['#8a4aff', '#3a1060'], cost: 100 },
      { n: 'Solar', c: ['#ffb020', '#b06010'], cost: 200 } ] },
  ],
  mago: [
    { id: 'robe', n: 'Túnica', keys: ['P', 'p'], opts: [
      { n: 'Arcana', c: ['#6a2fb3', '#b066ff'] },
      { n: 'Glaciar', c: ['#2b5fb3', '#4aa3ff'] },
      { n: 'Ígnea', c: ['#8e1f2a', '#d63c3c'] },
      { n: 'Druida', c: ['#215e2b', '#3a9a3f'], cost: 100 },
      { n: 'Vacío', c: ['#1b1424', '#4a4458'], cost: 300 } ] },
    { id: 'trim', n: 'Ala del sombrero y orbe', keys: ['y', 'c'], opts: [
      { n: 'Oro y cian', c: ['#ffd43b', '#8ff3ff'] },
      { n: 'Plata y blanco', c: ['#c8d0d8', '#ffffff'] },
      { n: 'Rosa', c: ['#ff7ac8', '#ffc0e8'], cost: 80 },
      { n: 'Brasa', c: ['#ff8a2a', '#ffd43b'], cost: 150 } ] },
  ],
  picaro: [
    { id: 'hood', n: 'Capucha', keys: ['D', 'L'], opts: [
      { n: 'Bosque', c: ['#215e2b', '#3a9a3f'] },
      { n: 'Sombra', c: ['#2a2433', '#4a4458'] },
      { n: 'Sangre', c: ['#5a1020', '#8e1f2a'] },
      { n: 'Nieve', c: ['#8a9ab8', '#d8e4f4'], cost: 120 },
      { n: 'Dorada', c: ['#8a6a10', '#ffd43b'], cost: 300 } ] },
    { id: 'eyes', n: 'Mirada', keys: ['y'], opts: [
      { n: 'Ámbar', c: ['#ffd43b'] },
      { n: 'Fantasma', c: ['#8ff3ff'] },
      { n: 'Demonio', c: ['#ff3b3b'], cost: 80 },
      { n: 'Vacío', c: ['#b066ff'], cost: 150 } ] },
  ],
};


// Sinergias híbridas: 3 puntos en AMBAS escuelas las activan. Recompensa builds mixtas.
const HYBRIDS = [
  { id: 'termico',   a: 'fuego',    b: 'hielo',    n: 'Choque Térmico',      ic: '♨️', d: 'Los enemigos que arden y están ralentizados reciben +50% daño.' },
  { id: 'plasma',    a: 'fuego',    b: 'tormenta', n: 'Plasma',              ic: '🌩️', d: 'Los rayos en cadena queman y hacen +50% daño.' },
  { id: 'hirviente', a: 'fuego',    b: 'sangre',   n: 'Sangre Hirviente',    ic: '🫀', d: 'Las quemaduras te curan una parte del daño que hacen.' },
  { id: 'brasaosc',  a: 'fuego',    b: 'sombra',   n: 'Brasa Oscura',        ic: '🖤', d: 'Los críticos siempre queman. +10% daño crítico.' },
  { id: 'piroclasto',a: 'fuego',    b: 'arcano',   n: 'Piroclasto',          ic: '💥', d: 'Tus proyectiles explotan al impactar (40% de daño en área).' },
  { id: 'supercond', a: 'hielo',    b: 'tormenta', n: 'Superconductor',      ic: '🔷', d: 'Los rayos congelan brevemente y saltan +2 veces más.' },
  { id: 'corhielo',  a: 'hielo',    b: 'sangre',   n: 'Corazón de Escarcha', ic: '💙', d: 'Al recibir daño congelas a los enemigos cercanos. +3 armadura.' },
  { id: 'filogel',   a: 'hielo',    b: 'sombra',   n: 'Filo Gélido',         ic: '🧊', d: 'Los críticos contra enemigos ralentizados hacen +75% daño.' },
  { id: 'prisma',    a: 'hielo',    b: 'arcano',   n: 'Prisma',              ic: '🔹', d: '+1 perforación y tus golpes ralentizan +15%.' },
  { id: 'adrenalina',a: 'tormenta', b: 'sangre',   n: 'Adrenalina',          ic: '💉', d: '+15% vel. ataque y +10% velocidad; x2 bajo 50% de vida.' },
  { id: 'fantasma',  a: 'tormenta', b: 'sombra',   n: 'Paso Fantasma',       ic: '👻', d: 'El dash recarga 40% más rápido y daña a quien atraviesas.' },
  { id: 'sobrecarga',a: 'tormenta', b: 'arcano',   n: 'Sobrecarga',          ic: '🔋', d: '+1 proyectil y +10% prob. de rayo en cadena.' },
  { id: 'vampiro',   a: 'sangre',   b: 'sombra',   n: 'Vampirismo',          ic: '🧛', d: 'Cada crítico te cura 1 de vida.' },
  { id: 'hemomancia',a: 'sangre',   b: 'arcano',   n: 'Hemomancia',          ic: '🩸', d: '+20% área y cada 25 bajas lanzas una nova de sangre.' },
  { id: 'ilusion',   a: 'sombra',   b: 'arcano',   n: 'Ilusión',             ic: '🪞', d: '+10% crítico, +30% daño crítico y -10% enfriamientos.' },
];

// Santuarios del mapa: quédate encima para activarlos (un solo uso).
const SHRINES = {
  poder:   { n: 'Santuario de Poder', c: '#ff5a3a', d: '+40% daño y +25% vel. ataque durante 25s' },
  fuente:  { n: 'Fuente de Vida', c: '#5bff8a', d: 'Cura 60% y +10 vida máxima' },
  saber:   { n: 'Altar del Saber', c: '#4aa3ff', d: 'Abre un cofre de mejora' },
  tiempo:  { n: 'Reloj Roto', c: '#c9d6ff', d: 'Los enemigos van a la mitad de velocidad 8s' },
  maldito: { n: 'Altar Maldito', c: '#b066ff', d: '¡Invoca 2 élites! (cofres y almas extra)' },
};
