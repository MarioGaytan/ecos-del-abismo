'use strict';
// =====================================================================
//  DATOS DEL JUEGO — clases, escuelas, mejoras, armas, enemigos,
//  jefes, niveles, caminos y mejoras permanentes. Editar aquí para
//  balancear sin tocar el motor.
// =====================================================================

let WORLD = 80 * 64;         // tamaño del mapa en px (lo ajusta genMap: 64 baldosas en campaña, 110 en hordas infinitas)
const LEVEL_TIME = 150;      // segundos de oleadas antes del jefe

const pct = v => Math.round(v * 100) + '%';
const num = v => (Math.round(v * 10) / 10).toString();

const RAR = [
  { n: 'Común', c: '#c8c8d0', m: 1 },
  { n: 'Raro', c: '#4aa3ff', m: 1.5 },
  { n: 'Épico', c: '#b066ff', m: 1.7 },
  { n: 'Legendario', c: '#ffb020', m: 2.2 },
];

// Escuelas (afinidades): acumular puntos (3/6/9) desbloquea bonos de hiperespecialización.
// opp = afinidad opuesta: al despertar una (su primer punto) la otra queda SELLADA el resto de la partida.
// Rayo, Sangre y Arcano no tienen opuesto: combinan con todo.
const SCHOOLS = {
  fuego:    { n: 'Fuego',     ic: '🔥', c: '#ff7a2f', opp: 'hielo',  tiers: ['+20% prob. de quemar', 'Los enemigos en llamas EXPLOTAN al morir', 'Siempre quemas y la quemadura hace x2'] },
  hielo:    { n: 'Hielo',     ic: '❄️', c: '#8ff3ff', opp: 'fuego',  tiers: ['Tus golpes ralentizan 30%', '+12% congelar; los congelados estallan en esquirlas', '+5 armadura y aura gélida que ralentiza todo'] },
  tierra:   { n: 'Tierra',    ic: '🪨', c: '#d0a868', opp: 'viento', tiers: ['+15% prob. de agrietar el suelo al golpear: barro que ralentiza y daña', 'Al recibir daño se alzan pilares de roca a tu alrededor (cada 6s)', 'Terremoto cada 5s: daño en área y aturde'] },
  viento:   { n: 'Viento',    ic: '🌪️', c: '#a8ffe0', opp: 'tierra', tiers: ['+15% velocidad; tu dash arrolla y empuja', '+1 carga de dash; tras cada dash, +30% vel. ataque 2s', 'Un tornado orbita a tu alrededor, atrae y daña'] },
  luz:      { n: 'Luz',       ic: '✨', c: '#fff3b0', opp: 'sombra', tiers: ['Cada 15 bajas, un destello te cura 3% y ciega a los cercanos', '+15% daño a élites y jefes; los cegados reciben +25% daño', 'Juicio: cada 2.5s un rayo de luz castiga al enemigo más fuerte'] },
  sombra:   { n: 'Oscuridad', ic: '🌑', c: '#c38bff', opp: 'luz',    tiers: ['+10% prob. de crítico', 'Los críticos hacen +100% daño', '+20% esquiva; tras un dash, 3 críticos garantizados'] },
  tormenta: { n: 'Rayo',      ic: '⚡', c: '#ffe14a', tiers: ['+15% prob. de rayo en cadena', '+3 saltos de cadena; tu dash electrocuta', 'Cada 1.5s cae un rayo triple'] },
  sangre:   { n: 'Sangre',    ic: '🩸', c: '#ff3b5c', tiers: ['+3% robo de vida', '+50 vida máx. y cada muerte te cura', 'Más daño cuanto menos vida; nova de sangre al ser golpeado'] },
  arcano:   { n: 'Arcano',    ic: '🔮', c: '#6aa8ff', tiers: ['+1 proyectil', '-20% enfriamientos', 'Proyectiles teledirigidos que rebotan'] },
};
const SCHOOL_KEYS = Object.keys(SCHOOLS);

// Dificultad: multiplica experiencia, vida/daño/aparición de enemigos y la Esencia ganada.
// chest: prob. de cofre de los élites (minijefes) · hearts: corazones a la vez · heal: multiplicador de curación
// anti-farmeo: shrines = santuarios que puedes activar por nivel (o por ciclo en el infinito) · bossT: segundos
// antes de que el jefe entre en furia · exitT: segundos que tienes tras vencer al jefe antes de que el portal te absorba
const DIFFS = {
  facil:     { n: 'Fácil',     ic: '🌱', d: '+25% exp · enemigos más débiles', xp: 1.25, hp: 0.75, dmg: 0.7, spawn: 0.85, ess: 0.7, shrines: 4, bossT: 180, exitT: 40, chest: 1 },
  normal:    { n: 'Normal',    ic: '⚔️', d: 'La experiencia pensada',          xp: 1,    hp: 1,    dmg: 1,   spawn: 1,    ess: 1,   shrines: 3, bossT: 150, exitT: 30, chest: 0.7 },
  dificil:   { n: 'Difícil',   ic: '🔥', d: '-15% exp · enemigos más duros',   xp: 0.85, hp: 1.35, dmg: 1.3, spawn: 1.15, ess: 1.4, shrines: 3, bossT: 120, exitT: 25, chest: 0.4 },
  pesadilla: { n: 'Pesadilla', ic: '💀', d: '-25% exp · solo builds rotas',     xp: 0.75, hp: 1.8,  dmg: 1.6, spawn: 1.3,  ess: 2,   shrines: 2, bossT: 100, exitT: 20, chest: 0.2 },
  tryhard:   { noTree: true, n: 'Tryhard',   ic: '👹', d: '1 corazón a la vez · sin imanes · -50% curación', xp: 0.65, hp: 2.2, dmg: 1.9, spawn: 1.45, ess: 3, shrines: 2, bossT: 80, exitT: 15, chest: 0.12,
               hearts: 1, heartCh: 0.5, noMagnet: true, heal: 0.5, rerolls: 0, elite: 2, magnet: 0.7, tryhard: true },
};

const CLASSES = {
  guerrero: {
    n: 'Guerrero', spr: 'warrior', melee: true,
    variants: [{ id: 'm', n: 'Guerrero' }, { id: 'f', n: 'Guerrera', spr: 'warriorF' }], hp: 140, spd: 205, armor: 3, crit: 0.05, school: 'sangre',
    desc: 'Cuerpo a cuerpo devastador. Tajos amplios con gran empuje. Los proyectiles extra se vuelven ondas de corte.',
    prims: [
      { id: 'mandoble', n: 'Mandoble', rate: 1.7, dmg: 26, d: 'Tajo amplio en arco con gran empuje.' },
      { id: 'lanza', n: 'Lanza', rate: 2.2, dmg: 21, d: 'Estocada larga y estrecha que atraviesa a todos en línea.' },
    ],
    secs: [
      { id: 'torbellino', n: 'Torbellino', cd: 6, d: 'Giras golpeando todo a tu alrededor 3 veces.' },
      { id: 'grito', n: 'Grito de Guerra', cd: 10, d: 'Aturde y repele a los cercanos; 6s de +25% daño y +8 armadura.' },
      { id: 'salto', n: 'Salto Sísmico', cd: 7, cost: 250, d: 'Saltas hacia el cursor (puedes subir riscos) y al caer aplastas y aturdes.' },
    ],
    ult: { n: 'Furia del Titán', dur: 8, col: '#ff3b1a', d: '8s: +60% daño, +50% vel. ataque, +5% robo de vida, más alcance.' },
  },
  mago: {
    n: 'Mago', spr: 'mage',
    variants: [{ id: 'm', n: 'Mago' }, { id: 'f', n: 'Maga', spr: 'mageF' }], hp: 95, spd: 215, armor: 0, crit: 0.05, school: 'arcano', shield: 0.15,
    desc: 'Proyectiles arcanos a distancia. Frágil pero escala de forma explosiva con proyectiles y área.',
    prims: [
      { id: 'arcano', n: 'Proyectil Arcano', rate: 2.6, dmg: 15, d: 'Proyectiles rápidos que buscan levemente al objetivo.' },
      { id: 'fuego', n: 'Bola de Fuego', rate: 1.4, dmg: 22, d: 'Lenta, explota en área y quema.' },
    ],
    secs: [
      { id: 'nova', n: 'Nova Helada', cd: 8, d: 'Explosión de hielo que daña y congela a los cercanos.' },
      { id: 'parpadeo', n: 'Parpadeo', cd: 5, d: 'Te teletransportas al cursor con una explosión al salir y al llegar.' },
      { id: 'vortice', n: 'Prisión Arcana', cd: 9, cost: 250, d: 'Un vórtice en el cursor atrae y tritura a los enemigos 3s y luego estalla.' },
    ],
    ult: { n: 'Lluvia de Meteoros', dur: 5, col: '#ff8a2a', d: '5s de meteoros cayendo sobre todos los enemigos visibles.' },
  },
  picaro: {
    n: 'Pícaro', spr: 'rogue',
    variants: [{ id: 'm', n: 'Pícaro' }, { id: 'f', n: 'Pícara', spr: 'rogueF' }], hp: 105, spd: 240, armor: 1, crit: 0.15, school: 'sombra',
    desc: 'Rápido y letal. Lanza dagas a gran cadencia y vive de los críticos y la esquiva.',
    prims: [
      { id: 'dagas', n: 'Dagas', rate: 3.8, dmg: 8, d: 'Ráfagas de 2 dagas a gran cadencia.' },
      { id: 'ballesta', n: 'Ballesta', rate: 1.5, dmg: 30, d: 'Virotes pesados que perforan 3 enemigos; +15% crítico.' },
    ],
    secs: [
      { id: 'abanico', n: 'Abanico de Cuchillas', cd: 5, d: 'Lanza 16 cuchillas en todas direcciones.' },
      { id: 'humo', n: 'Bomba de Humo', cd: 9, d: 'Nube que envenena y ralentiza; 2.5s de esquiva total.' },
      { id: 'senuelo', n: 'Señuelo', cd: 10, cost: 250, d: 'Dejas un clon que atrae a los enemigos 4s y luego explota; te vuelves difuso 1s.' },
    ],
    ult: { n: 'Danza Sombría', dur: 6, col: '#6a2fb3', d: '6s: invulnerable, 100% crítico y +40% velocidad.' },
  },
  // ------- clases que se compran con Esencia (cost) -------
  // aff: afinidad fija (empieza con 1 punto y sella su opuesta) · pool: afinidades que pueden salir en las cartas
  druida: {
    n: 'Druida', spr: 'druid', hp: 120, spd: 210, armor: 2, crit: 0.05, school: 'tierra', cost: 500, melee: true,
    variants: [{ id: 'm', n: 'Druida' }, { id: 'f', n: 'Druida', spr: 'druidF' }],
    trait: 'Savia: +0.8 vida/seg',
    desc: 'Guardián del bosque con afinidad de Tierra. Controla el campo con espinas y raíces y aguanta como un oso.',
    prims: [
      { id: 'espinas', n: 'Espinas', rate: 1.5, dmg: 15, d: 'Brotan espinas del suelo en línea hacia el cursor.' },
      { id: 'enredadera', n: 'Látigo de Enredadera', rate: 1.8, dmg: 19, d: 'Latigazo de alcance medio que ralentiza.' },
    ],
    secs: [
      { id: 'oso', n: 'Forma de Oso', cd: 12, d: '6s: +12 armadura, +25% daño y te haces enorme (algo más lento).' },
      { id: 'raices', n: 'Raíces Atrapadoras', cd: 8, d: 'Raíces en el cursor inmovilizan 2.5s a los enemigos de la zona.' },
    ],
    ult: { n: 'Bosque Viviente', dur: 7, col: '#5bd48a', d: '7s: raíces brotan bajo los enemigos cercanos y te curas 2%/s.' },
  },
  berserker: {
    n: 'Berserker', spr: 'berserker', hp: 170, spd: 215, armor: 2, crit: 0.08, school: 'sangre', cost: 600, melee: true, noShield: true,
    variants: [{ id: 'm', n: 'Berserker' }, { id: 'f', n: 'Berserker', spr: 'berserkerF' }],
    trait: 'Furia: hasta +50% daño cuanta menos vida · nunca tiene escudo',
    desc: 'Guerrero salvaje de Sangre. Cuanto más herido, más letal. Sin escudo: vive al límite.',
    prims: [
      { id: 'hacha', n: 'Hachas Gemelas', rate: 1.9, dmg: 17, d: 'Giro de 360° que golpea todo a tu alrededor.' },
      { id: 'mazazo', n: 'Mazazo', rate: 1.1, dmg: 40, d: 'Golpe frontal lento que aturde y empuja muchísimo.' },
    ],
    secs: [
      { id: 'carga', n: 'Carga Brutal', cd: 6, d: 'Embistes hacia el cursor arrollando a todos a tu paso.' },
      { id: 'rugido', n: 'Rugido Sanguinario', cd: 11, d: 'Te curas 12% y los cercanos huyen aterrados 2.5s.' },
    ],
    ult: { n: 'Frenesí', dur: 7, col: '#ff3b1a', d: '7s: +40% vel. ataque, +5% robo de vida y no puedes morir.' },
  },
  elfo: {
    n: 'Elfo', spr: 'elf', hp: 100, spd: 235, armor: 0, crit: 0.15, school: null, cost: 500,
    variants: [{ id: 'm', n: 'Elfo' }, { id: 'f', n: 'Elfa', spr: 'elfF' }],
    trait: 'Sin afinidad: ninguna sale favorecida · +30% rango de recogida',
    desc: 'Arquero veloz sin afinidad fija: construye lo que quieras. Mantén la distancia y castiga desde lejos.',
    prims: [
      { id: 'arco', n: 'Arco Largo', rate: 1.6, dmg: 24, d: 'Flecha veloz que atraviesa a 2 enemigos.' },
      { id: 'rafaga', n: 'Ráfaga', rate: 1.5, dmg: 11, d: 'Tres flechas en abanico.' },
    ],
    secs: [
      { id: 'trampa', n: 'Trampa de Lianas', cd: 7, d: 'Trampa en el cursor: al pisarla inmoviliza 3s a todos los cercanos.' },
      { id: 'atras', n: 'Salto Atrás', cd: 5, d: 'Saltas hacia atrás y disparas 5 flechas hacia el cursor.' },
    ],
    ult: { n: 'Lluvia de Flechas', dur: 6, col: '#7ee36b', d: '6s: flechas caen del cielo sobre todos los enemigos visibles.' },
  },
  nomuerto: {
    n: 'No-Muerto', spr: 'undead', hp: 130, spd: 200, armor: 1, crit: 0.05, school: 'sombra', cost: 700,
    pool: ['sombra', 'sangre', 'hielo', 'arcano', 'tormenta'],
    variants: [{ id: 'm', n: 'No-Muerto' }, { id: 'f', n: 'No-Muerta', spr: 'undeadF' }],
    trait: 'Robo de vida doble · los corazones curan la mitad · solo Oscuridad, Sangre, Hielo, Arcano y Rayo',
    desc: 'Nigromante que vuelve de la tumba. Drena vida y levanta esqueletos que luchan por él. La Luz le está vedada.',
    prims: [
      { id: 'toque', n: 'Toque Necrótico', rate: 2.2, dmg: 16, d: 'Proyectil que busca al enemigo y te cura un poco al impactar.' },
      { id: 'guadana', n: 'Guadaña', rate: 1.4, dmg: 22, d: 'Tajo amplio de guadaña.' },
    ],
    secs: [
      { id: 'invocar', n: 'Alzar Esqueletos', cd: 12, d: 'Levantas 3 esqueletos aliados durante 10s.' },
      { id: 'drenar', n: 'Drenar Vida', cd: 8, d: 'Haz que daña a los de delante y te cura el 30% del daño.' },
    ],
    ult: { n: 'Ejército de Huesos', dur: 6, col: '#7ee36b', d: 'Levantas 8 esqueletos y tus aliados hacen +50% daño.' },
  },
};

// m = multiplicador por rareza. Cada mejora suma 1 punto a su escuela (legendaria: 2).
const UPGRADES = [
  { id: 'poder', n: 'Poder Bruto', ic: '💪', sch: null, max: 10, tx: m => `+${pct(0.10 * m)} daño`, ap: (b, m) => b.dmg += 0.10 * m },
  { id: 'iman', n: 'Imán', ic: '🧲', sch: null, max: 8, tx: m => `+${pct(0.4 * m)} rango de recogida`, ap: (b, m) => b.magnet *= 1 + 0.4 * m },
  { id: 'singularidad', n: 'Singularidad', ic: '🌀', sch: null, max: 1, minR: 2, tx: () => 'Cada 12s atraes TODAS las gemas del mapa', ap: b => b.singular = 1 },
  { id: 'sabid', n: 'Sabiduría', ic: '📜', sch: null, max: 4, tx: m => `+${pct(0.08 * m)} experiencia`, ap: (b, m) => b.xp += 0.08 * m },
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
  { id: 'condensador', n: 'Condensador', ic: '🔋', sch: 'tormenta', max: 4, tx: m => `El escudo se reconstruye ${pct(0.3 * m)} más rápido`, ap: (b, m) => b.shRegen += 0.3 * m },
  { id: 'dashx', n: 'Paso Relámpago', ic: '💨', sch: 'tormenta', max: 3, minR: 1, tx: () => '+1 carga de dash', ap: b => b.dashes += 1 },

  { id: 'colmillos', n: 'Colmillos', ic: '🦇', sch: 'sangre', max: 6, tx: m => `+${pct(0.015 * m)} robo de vida`, ap: (b, m) => b.lifesteal += 0.015 * m },
  { id: 'vigor', n: 'Vigor', ic: '💗', sch: 'sangre', max: 6, tx: m => `+${Math.round(22 * m)} vida máx. y te cura`, ap: (b, m) => b.maxHp += 22 * m, heal: m => 22 * m },
  { id: 'frenesi', n: 'Frenesí', ic: '😤', sch: 'sangre', max: 6, tx: m => `+${pct(0.1 * m)} velocidad de ataque`, ap: (b, m) => b.atkSpd += 0.1 * m },
  { id: 'regen', n: 'Regeneración', ic: '✚', sch: 'sangre', max: 6, tx: m => `+${num(0.6 * m)} vida/seg`, ap: (b, m) => b.regen += 0.6 * m },
  { id: 'espinas', n: 'Espinas', ic: '🌵', sch: 'sangre', max: 5, tx: m => `Devuelves ${Math.round(20 * m)} daño al ser golpeado`, ap: (b, m) => b.thorns += 20 * m },

  { id: 'ojo', n: 'Ojo Certero', ic: '🎯', sch: 'sombra', max: 7, tx: m => `+${pct(0.06 * m)} prob. de crítico`, ap: (b, m) => b.crit += 0.06 * m },
  { id: 'letal', n: 'Golpe Letal', ic: '☠️', sch: 'sombra', max: 6, tx: m => `+${pct(0.3 * m)} daño crítico`, ap: (b, m) => b.critMult += 0.3 * m },
  { id: 'evasion', n: 'Evasión', ic: '🌫️', sch: 'sombra', max: 5, tx: m => `+${pct(0.05 * m)} esquiva`, ap: (b, m) => b.dodge += 0.05 * m },
  { id: 'asesino', n: 'Instinto Asesino', ic: '🔪', sch: 'sombra', max: 6, tx: m => `+${pct(0.08 * m)} vel. ataque, +${pct(0.03 * m)} crítico`, ap: (b, m) => { b.atkSpd += 0.08 * m; b.crit += 0.03 * m; } },

  { id: 'grieta', n: 'Grieta', ic: '🪨', sch: 'tierra', max: 5, tx: m => `+${pct(0.06 * m)} prob. de agrietar el suelo al golpear (barro que ralentiza y daña)`, ap: (b, m) => b.quakeCh += 0.06 * m },
  { id: 'roca', n: 'Piel de Roca', ic: '🗿', sch: 'tierra', max: 6, tx: m => `+${num(3 * m)} armadura`, ap: (b, m) => b.armor += 3 * m },
  { id: 'puno', n: 'Puño Sísmico', ic: '👊', sch: 'tierra', max: 6, tx: m => `+${pct(0.1 * m)} área y +${pct(0.04 * m)} daño`, ap: (b, m) => { b.area += 0.1 * m; b.dmg += 0.04 * m; } },

  { id: 'brisa', n: 'Brisa', ic: '🍃', sch: 'viento', max: 6, tx: m => `+${pct(0.08 * m)} velocidad de movimiento`, ap: (b, m) => b.speed += 0.08 * m },
  { id: 'vendaval', n: 'Vendaval', ic: '🌬️', sch: 'viento', max: 6, tx: m => `+${pct(0.07 * m)} vel. ataque y +${pct(0.1 * m)} vel. de proyectil`, ap: (b, m) => { b.atkSpd += 0.07 * m; b.projSpd += 0.1 * m; } },
  { id: 'pluma', n: 'Pluma', ic: '🪶', sch: 'viento', max: 5, tx: m => `El dash recarga ${pct(0.1 * m)} más rápido, +${pct(0.03 * m)} esquiva`, ap: (b, m) => { b.dashCdr += 0.1 * m; b.dodge += 0.03 * m; } },

  { id: 'fe', n: 'Fe', ic: '🙏', sch: 'luz', max: 6, tx: m => `+${Math.round(14 * m)} vida máx. y +${num(0.4 * m)} vida/seg`, ap: (b, m) => { b.maxHp += 14 * m; b.regen += 0.4 * m; }, heal: m => 14 * m },
  { id: 'santo', n: 'Castigo Sagrado', ic: '⚜️', sch: 'luz', max: 5, tx: m => `+${pct(0.12 * m)} daño a élites y jefes`, ap: (b, m) => b.eliteDmg += 0.12 * m },
  { id: 'resplandor', n: 'Resplandor', ic: '🌟', sch: 'luz', max: 4, tx: m => `+${pct(0.07 * m)} prob. de cegar al golpear (no disparan y van lentos)`, ap: (b, m) => b.blindCh += 0.07 * m },

  { id: 'barrera', n: 'Barrera de Energía', ic: '🔰', sch: 'arcano', max: 5, tx: m => `Escudo de energía: ${pct(0.12 * m)} de tu vida máx. Absorbe daño y se reconstruye solo`, ap: (b, m) => b.shield += 0.12 * m },
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
  pedrada:   { n: 'Rocas Errantes', ic: '🪨', sch: 'tierra', d: 'Rocas caen sobre los enemigos y agrietan el suelo.', evo: 'Avalancha', evoD: '+2 rocas, daño x2 y grietas más grandes.' },
  cuchillas: { n: 'Cuchillas de Viento', ic: '🌬️', sch: 'viento', d: 'Ráfagas cortantes que atraviesan y empujan.', evo: 'Huracán', evoD: 'Doble de ráfagas y atraviesan todo.' },
  halo:      { n: 'Halo Sagrado', ic: '😇', sch: 'luz', d: 'Pulsos de luz a tu alrededor que dañan y ciegan.', evo: 'Supernova', evoD: '+50% radio, daño x2 y ciegan más tiempo.' },
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
  // Raíces Hundidas
  sporeling:{ spr: 'sporeling', pal: { r: '#3ad8c0', w: '#bfffef' }, hp: 26, spd: 74, dmg: 11, r: 14, xp: 2, ai: 'chase', sc: 2.7, split: 'sporelet', blood: '#3ad8c0' },
  sporelet: { spr: 'sporeling', pal: { r: '#8ad83a' }, hp: 6, spd: 118, dmg: 6, r: 9, xp: 0.5, ai: 'chase', sc: 1.6, blood: '#8ad83a' },
  glowbat:  { spr: 'bat', pal: { P: '#1a6a6a', y: '#5ad8c0' }, hp: 12, spd: 170, dmg: 7, r: 11, xp: 1, ai: 'bat', sc: 2.2, blood: '#5ad8c0', fly: true },
  spider:   { spr: 'spider', hp: 22, spd: 80, dmg: 9, r: 14, xp: 2, ai: 'ranged', sc: 2.6, range: 300, fire: 2.0, bspd: 250, bcol: '#e0f0e8', spread: 2, blood: '#8ad83a' },
  eel:      { spr: 'eel', hp: 50, spd: 70, dmg: 16, r: 16, xp: 3, ai: 'charger', sc: 2.8, blood: '#3ad8c0' },
  rootgolem:{ spr: 'golem', pal: { G: '#3a2a1a', g: '#6a8a3a', y: '#5ad8c0' }, hp: 170, spd: 46, dmg: 22, r: 24, xp: 8, ai: 'chase', sc: 3.8, kres: 0.3, blood: '#6a8a3a' },
  // El Corazón del Abismo
  voidling: { spr: 'slime', pal: { l: '#6a3a9a', L: '#2a1240', w: '#ff3bd0', k: '#ff3bd0' }, hp: 22, spd: 92, dmg: 11, r: 13, xp: 2, ai: 'chase', sc: 2.5, blood: '#b066ff' },
  voidbat:  { spr: 'bat', pal: { P: '#2a1240', y: '#ff3bd0' }, hp: 14, spd: 180, dmg: 8, r: 11, xp: 1, ai: 'bat', sc: 2.2, blood: '#b066ff', fly: true },
  eye:      { spr: 'eye', hp: 26, spd: 70, dmg: 10, r: 13, xp: 2, ai: 'ranged', sc: 2.6, range: 340, fire: 2.2, bspd: 240, bcol: '#ff3bd0', fly: true, blood: '#ff3bd0' },
  echo:     { spr: 'skel', hp: 40, spd: 125, dmg: 15, r: 14, xp: 3, ai: 'chase', sc: 2.9, blood: '#b066ff', echo: true },
  devourer: { spr: 'devourer', hp: 180, spd: 60, dmg: 26, r: 26, xp: 9, ai: 'charger', sc: 3.4, kres: 0.35, blood: '#b066ff' },
  fireskel: { spr: 'skel', pal: { m: '#4a3a3a', M: '#2a1a1a', k: '#ff8a2a' }, hp: 30, spd: 92, dmg: 12, r: 14, xp: 2, ai: 'chase', sc: 2.8, blood: '#ff8a2a' },
};

const BOSSES = {
  slimeKing: { n: 'Rey Limo', spr: 'slime', pal: { l: '#5be34a', L: '#227a2f' }, sc: 9, r: 54, hp: 3800, dmg: 22, spd: 70, crown: true },
  lich:      { n: 'Liche de Escarcha', spr: 'lich', pal: { P: '#2b5fb3', p: '#4aa3ff' }, sc: 6, r: 40, hp: 8500, dmg: 20, spd: 95 },
  motherRoot:{ n: 'Madre Raíz', spr: 'motherRoot', pal: { r: '#c83ad8', y: '#ffd43b', L: '#3a7a3f', l: '#7ee36b' }, sc: 7.5, r: 60, hp: 26000, dmg: 34, spd: 50 },
  voice:     { n: 'La Voz del Abismo', spr: 'voice', pal: { P: '#3a1a5a', p: '#b066ff', w: '#e8d8ff', r: '#ff3bd0' }, sc: 6.5, r: 58, hp: 40000, dmg: 38, spd: 85, fly: true },
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
    hp: 1, dmg: 1, rate: 1, xp: 1, boss: 'slimeKing', music: 0, bossTtk: 30, testLv: 0, depth: 0,
  },
  {
    n: 'Cripta Helada', sub: 'Nivel 2', biome: 'crypt', bg: '#0d1220',
    ground: ['#262a3a', '#2c3144', '#20232f', '#33384d', '#1b1e29'],
    props: [['tomb', 45], ['pillar', 30], ['crystal', 30]],
    decal: ['#b5ab8f', '#8ff3ff', '#3a3f55'],
    spawns: [{ e: 'skel', w: 10, t: 0 }, { e: 'icebat', w: 6, t: 8 }, { e: 'ghost', w: 6, t: 20 }, { e: 'wraith', w: 3, t: 40 }, { e: 'archer', w: 3, t: 55 }, { e: 'icegolem', w: 2, t: 80 }],
    events: [{ t: 30, k: 'ring', e: 'icebat', n: 28 }, { t: 55, k: 'elite', e: 'wraith' }, { t: 85, k: 'ring', e: 'skel', n: 40 }, { t: 110, k: 'elite', e: 'icegolem' }, { t: 128, k: 'ring', e: 'ghost', n: 30 }],
    hp: 2.4, dmg: 1.35, rate: 1.15, xp: 1.6, boss: 'lich', music: 1, bossTtk: 38, testLv: 9, depth: 300,
  },
  {
    n: 'Forja Infernal', sub: 'Nivel 3', biome: 'forge', bg: '#1a0c0a',
    ground: ['#3a1e18', '#43231b', '#2e1712', '#512a1e', '#24120e'],
    props: [['spike', 55], ['rock', 30]],
    decal: ['#ff6a1a', '#c0392b', '#2a1410'],
    spawns: [{ e: 'imp', w: 9, t: 0 }, { e: 'fireskel', w: 9, t: 0 }, { e: 'fireel', w: 4, t: 20 }, { e: 'lavaslime', w: 3, t: 40 }, { e: 'magma', w: 3, t: 60 }],
    events: [{ t: 25, k: 'ring', e: 'imp', n: 30 }, { t: 50, k: 'elite', e: 'magma' }, { t: 80, k: 'ring', e: 'fireskel', n: 44 }, { t: 105, k: 'elite', e: 'fireel' }, { t: 125, k: 'ring', e: 'imp', n: 50 }],
    hp: 5.2, dmg: 1.8, rate: 1.3, xp: 2.4, boss: 'forge', music: 2, bossTtk: 46, testLv: 19, depth: 650,
  },
  {
    n: 'Raíces Hundidas', sub: 'Nivel 4', biome: 'roots', bg: '#0a1416',
    ground: ['#1e3438', '#22403e', '#1a2e30', '#284a48', '#152628'],
    props: [['shroom', 50], ['root', 35], ['rock', 15]],
    decal: ['#3ad8c0', '#1a5a5a', '#8ad83a'],
    spawns: [{ e: 'sporeling', w: 10, t: 0 }, { e: 'glowbat', w: 6, t: 8 }, { e: 'spider', w: 4, t: 25 }, { e: 'eel', w: 4, t: 45 }, { e: 'rootgolem', w: 2, t: 75 }],
    events: [{ t: 25, k: 'ring', e: 'glowbat', n: 32 }, { t: 50, k: 'elite', e: 'spider' }, { t: 80, k: 'ring', e: 'sporeling', n: 40 }, { t: 105, k: 'elite', e: 'eel' }, { t: 128, k: 'elite', e: 'rootgolem' }],
    hp: 8.5, dmg: 2.2, rate: 1.4, xp: 3.2, boss: 'motherRoot', music: 4, bossTtk: 52, testLv: 27, depth: 1100,
  },
  {
    n: 'El Corazón del Abismo', sub: 'Nivel 5', biome: 'void', bg: '#08040e',
    ground: ['#241a32', '#2a1e3a', '#20162c', '#342646', '#1a1224'],
    props: [['obelisk', 45], ['crystal', 35, { c: '#e0c8ff', b: '#b066ff', B: '#6a2fb3', w: '#ffffff' }], ['rock', 20]],
    decal: ['#b066ff', '#3a2450', '#ff3bd0'],
    spawns: [{ e: 'voidling', w: 10, t: 0 }, { e: 'voidbat', w: 6, t: 8 }, { e: 'eye', w: 5, t: 20 }, { e: 'echo', w: 4, t: 40 }, { e: 'devourer', w: 2, t: 70 }],
    events: [{ t: 25, k: 'ring', e: 'voidbat', n: 36 }, { t: 50, k: 'elite', e: 'echo' }, { t: 80, k: 'ring', e: 'voidling', n: 46 }, { t: 105, k: 'elite', e: 'devourer' }, { t: 128, k: 'ring', e: 'eye', n: 24 }],
    hp: 13, dmg: 2.6, rate: 1.5, xp: 4, boss: 'voice', music: 5, bossTtk: 60, testLv: 34, depth: 1700,
  },
];

// Encrucijada entre niveles: el jugador elige un camino.
const PATHS = [
  { id: 'guerra', n: 'Sendero de Guerra', ic: '⚔️', d: '+3 subidas de nivel ahora. Enemigos +15% vida.' },
  { id: 'santuario', n: 'Santuario', ic: '⛲', d: 'Curación total y +30 vida máxima.' },
  { id: 'pacto', n: 'Pacto de Sangre', ic: '🩸', d: '+30% daño permanente, pero -15% vida máxima.' },
  { id: 'maldito', n: 'Camino Maldito', ic: '💀', d: 'Enemigos +35% más y +25% vida. +25% exp y almas x2.' },
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
  druida: [
    { id: 'robe', n: 'Túnica', keys: ['L', 'D'], opts: [
      { n: 'Bosque', c: ['#3a9a3f', '#215e2b'] },
      { n: 'Otoño', c: ['#c87a2a', '#7a4a1a'] },
      { n: 'Musgo', c: ['#7a9a3a', '#4a5a1a'] },
      { n: 'Invierno', c: ['#8ab0c8', '#4a6a8a'], cost: 120 },
      { n: 'Espíritu', c: ['#b066ff', '#6a2fb3'], cost: 250 } ] },
    { id: 'antler', n: 'Cuernos y báculo', keys: ['t', 'T'], opts: [
      { n: 'Roble', c: ['#8a5a3b', '#5a3825'] },
      { n: 'Hueso', c: ['#e8e0c8', '#b5ab8f'] },
      { n: 'Ébano', c: ['#3a2a20', '#1a1410'], cost: 100 },
      { n: 'Oro', c: ['#ffd43b', '#b8860b'], cost: 200 } ] },
  ],
  berserker: [
    { id: 'hair', n: 'Barba y cabello', keys: ['r'], opts: [
      { n: 'Fuego', c: ['#d63c3c'] },
      { n: 'Rubio', c: ['#e8c050'] },
      { n: 'Castaño', c: ['#7a3f22'] },
      { n: 'Ceniza', c: ['#c8c8d0'], cost: 100 },
      { n: 'Sangre', c: ['#7a0a1a'], cost: 200 } ] },
    { id: 'pants', n: 'Pantalón', keys: ['R'], opts: [
      { n: 'Carmesí', c: ['#8e1f2a'] },
      { n: 'Cuero', c: ['#5a3825'] },
      { n: 'Lobo', c: ['#4a4458'] },
      { n: 'Pieles', c: ['#c8b088'], cost: 120 } ] },
  ],
  elfo: [
    { id: 'tunic', n: 'Túnica', keys: ['L', 'l'], opts: [
      { n: 'Bosque', c: ['#3a9a3f', '#7ee36b'] },
      { n: 'Noche', c: ['#2b5fb3', '#4aa3ff'] },
      { n: 'Otoño', c: ['#c87a2a', '#ffb060'] },
      { n: 'Plata', c: ['#8a9ab8', '#d8e4f4'], cost: 120 },
      { n: 'Real', c: ['#6a2fb3', '#b066ff'], cost: 250 } ] },
    { id: 'hair', n: 'Cabello', keys: ['y'], opts: [
      { n: 'Dorado', c: ['#ffd43b'] },
      { n: 'Plateado', c: ['#e0e6ff'] },
      { n: 'Negro', c: ['#2a2433'] },
      { n: 'Cobre', c: ['#c86a2a'], cost: 80 },
      { n: 'Lunar', c: ['#8ff3ff'], cost: 150 } ] },
  ],
  nomuerto: [
    { id: 'hood', n: 'Capucha', keys: ['n'], opts: [
      { n: 'Abismo', c: ['#1d2f6b'] },
      { n: 'Ceniza', c: ['#4a4458'] },
      { n: 'Sangre', c: ['#5a1020'] },
      { n: 'Pantano', c: ['#215e2b'], cost: 120 },
      { n: 'Hueso', c: ['#b5ab8f'], cost: 200 } ] },
    { id: 'eyes', n: 'Ojos', keys: ['l'], opts: [
      { n: 'Necro', c: ['#7ee36b'] },
      { n: 'Escarcha', c: ['#8ff3ff'] },
      { n: 'Brasa', c: ['#ff8a2a'] },
      { n: 'Vacío', c: ['#b066ff'], cost: 100 },
      { n: 'Sangre', c: ['#ff3b3b'], cost: 150 } ] },
  ],
};


// Sinergias híbridas: 3 puntos en AMBAS escuelas las activan. Recompensa builds mixtas.
const HYBRIDS = [
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
  // afinidades nuevas (nunca con su opuesta)
  { id: 'magma',     a: 'tierra',   b: 'fuego',    n: 'Magma',               ic: '🌋', d: 'Tus grietas son de lava: queman a quien las pisa.' },
  { id: 'permafrost',a: 'tierra',   b: 'hielo',    n: 'Permafrost',          ic: '🧊', d: '+4 armadura y tus grietas ralentizan el doble.' },
  { id: 'arenisca',  a: 'tierra',   b: 'tormenta', n: 'Tormenta de Arena',   ic: '🏜️', d: '+10% prob. de rayo en cadena y +2 armadura.' },
  { id: 'raices',    a: 'tierra',   b: 'sangre',   n: 'Raíces Sedientas',    ic: '🌱', d: '+30 vida máx. y +2 armadura.' },
  { id: 'geomancia', a: 'tierra',   b: 'arcano',   n: 'Geomancia',           ic: '🗻', d: '+15% área.' },
  { id: 'incendio',  a: 'viento',   b: 'fuego',    n: 'Incendio',            ic: '🔥', d: '+15% prob. de quemar y +10% velocidad.' },
  { id: 'ventisca',  a: 'viento',   b: 'hielo',    n: 'Ventisca',            ic: '🌨️', d: '+10% velocidad y tus golpes ralentizan +10%.' },
  { id: 'huracan',   a: 'viento',   b: 'tormenta', n: 'Ojo del Huracán',     ic: '🌀', d: '+1 salto de cadena y +10% vel. ataque.' },
  { id: 'remolino',  a: 'viento',   b: 'sangre',   n: 'Remolino Carmesí',    ic: '💨', d: '+10% vel. ataque y +1% robo de vida.' },
  { id: 'cefiro',    a: 'viento',   b: 'sombra',   n: 'Céfiro',              ic: '🍂', d: '+8% esquiva y +5% crítico.' },
  { id: 'corriente', a: 'viento',   b: 'arcano',   n: 'Corriente',           ic: '🎐', d: '+20% vel. de proyectil y +1 perforación.' },
  { id: 'solar',     a: 'luz',      b: 'fuego',    n: 'Llamarada Solar',     ic: '☀️', d: 'Tu luz quema y +10% prob. de quemar.' },
  { id: 'aurora',    a: 'luz',      b: 'hielo',    n: 'Aurora',              ic: '🌌', d: 'Los cegados además van 40% más lentos.' },
  { id: 'sacro',     a: 'luz',      b: 'sangre',   n: 'Sangre Sagrada',      ic: '🕊️', d: '+2% robo de vida y +0.5 vida/seg.' },
  { id: 'divino',    a: 'luz',      b: 'tormenta', n: 'Rayo Divino',         ic: '🌩️', d: '+5% prob. de rayo en cadena y +15% daño de cadena.' },
  { id: 'runas',     a: 'luz',      b: 'arcano',   n: 'Runas Sagradas',      ic: 'ᛟ', d: '+10% área y -10% enfriamientos.' },
];

// =====================================================================
//  META-PROGRESIÓN — todo se paga con Esencia (la misma de los cosméticos)
//  y se guarda en SAVE.unlocked con claves 'tree.x', 'abil.clase.sec.i',
//  'class.x' y 'relic.x'. En Tryhard el árbol no se aplica.
// =====================================================================
const ROUTES = {
  sup: { n: 'Supervivencia', ic: '🛡️', c: '#5bff8a' },
  pod: { n: 'Poder',         ic: '⚔️', c: '#ff7a5a' },
  exp: { n: 'Exploración',   ic: '🧭', c: '#6aa8ff' },
};
// Árbol de rutas: tier = fila (1 arriba); req = basta con UNO de esos nodos; relic = solo se obtiene con una reliquia.
// ap(P) se aplica al empezar la partida, antes de calcular las estadísticas (P.b son las estadísticas base).
const TREE = [
  { id: 's1', route: 'sup', tier: 1, n: 'Piel Curtida',     ic: '🧥', cost: 80,  req: [],           d: '+8% vida máxima',                          ap: P => { P.b.maxHp *= 1.08; } },
  { id: 's2', route: 'sup', tier: 2, n: 'Pies Ligeros',     ic: '👢', cost: 110, req: ['s1'],       d: '+5% velocidad de movimiento',              ap: P => { P.b.speed += 0.05; } },
  { id: 's3', route: 'sup', tier: 2, n: 'Segundo Aliento',  ic: '💨', cost: 140, req: ['s1'],       d: '+0.5 vida/seg',                            ap: P => { P.b.regen += 0.5; } },
  { id: 's4', route: 'sup', tier: 3, n: 'Corazón Firme',    ic: '❤️', cost: 180, req: ['s2', 's3'], d: 'Los corazones curan un 25% más',           ap: P => { P.heartMul = (P.heartMul || 1) * 1.25; } },
  { id: 's5', route: 'sup', tier: 4, n: 'Armadura Heredada', ic: '🛡️', cost: 240, req: ['s4'],      d: '+2 armadura',                              ap: P => { P.b.armor += 2; } },
  { id: 's6', route: 'sup', tier: 4, n: 'Pluma Ancestral',  ic: '🪶', relic: 'pluma', req: ['s4'],  d: 'Empiezas con 1 resurrección',              ap: P => { P.revive += 1; } },

  { id: 'p1', route: 'pod', tier: 1, n: 'Filo Afilado',     ic: '🗡️', cost: 80,  req: [],           d: '+6% daño',                                 ap: P => { P.b.dmg += 0.06; } },
  { id: 'p2', route: 'pod', tier: 2, n: 'Mano Rápida',      ic: '✋', cost: 120, req: ['p1'],       d: '+6% velocidad de ataque',                  ap: P => { P.b.atkSpd += 0.06; } },
  { id: 'p3', route: 'pod', tier: 2, n: 'Ojo de Halcón',    ic: '🦅', cost: 120, req: ['p1'],       d: '+4% crítico',                              ap: P => { P.b.crit += 0.04; } },
  { id: 'p4', route: 'pod', tier: 3, n: 'Despertar',        ic: '🌟', cost: 250, req: ['p2', 'p3'], d: 'Empiezas con +1 punto en la afinidad de tu héroe', ap: P => { if (P.C.school) P.schools[P.C.school] += 1; } },
  { id: 'p5', route: 'pod', tier: 4, n: 'Furia Latente',    ic: '🔥', cost: 200, req: ['p4'],       d: 'La definitiva empieza cargada al 50%',     ap: P => { P.ult = 50; } },
  { id: 'p6', route: 'pod', tier: 4, n: 'Corona Rota',      ic: '👑', relic: 'corona', req: ['p4'], d: '+10% daño a jefes',                        ap: P => { P.bossDmg = (P.bossDmg || 0) + 0.1; } },

  { id: 'e1', route: 'exp', tier: 1, n: 'Bolsa de Almas',   ic: '👝', cost: 80,  req: [],           d: '+10% almas',                               ap: P => { P.b.souls += 0.1; } },
  { id: 'e2', route: 'exp', tier: 2, n: 'Dado Viejo',       ic: '🎲', cost: 150, req: ['e1'],       d: '+1 re-tirada al empezar',                  ap: P => { P.rerolls += 1; } },
  { id: 'e3', route: 'exp', tier: 2, n: 'Brújula',          ic: '🧭', cost: 100, req: ['e1'],       d: '+25% rango de recogida',                   ap: P => { P.b.magnet *= 1.25; } },
  { id: 'e4', route: 'exp', tier: 3, n: 'Suerte del Errante', ic: '🍀', cost: 180, req: ['e2', 'e3'], d: '+10 suerte (mejores rarezas)',          ap: P => { P.b.luck += 10; } },
  { id: 'e5', route: 'exp', tier: 4, n: 'Ojo del Explorador', ic: '👁️', cost: 150, req: ['e4'],     d: 'Revelas el mapa 2 baldosas más lejos',     ap: P => { P.visBonus = (P.visBonus || 0) + 2; } },
  { id: 'e6', route: 'exp', tier: 4, n: 'Llave Maestra',    ic: '🗝️', relic: 'llave', req: ['e4'], d: '+1 santuario activable por nivel',        ap: P => { P.shrBonus = (P.shrBonus || 0) + 1; } },
];
const TREE_BY = Object.fromEntries(TREE.map(t => [t.id, t]));

// Reliquias: objetos raros que caen en salas secretas, puzles, cumbres, criptas y jefes.
// Al recogerlas desbloquean para siempre lo que indica `key` (aunque mueras en esa partida).
const RELICS = [
  { id: 'pluma',   n: 'Pluma Ancestral',       ic: '🪶', key: 'tree.s6',             d: 'Nodo del árbol: empiezas con 1 resurrección' },
  { id: 'corona',  n: 'Corona Rota',           ic: '👑', key: 'tree.p6',             d: 'Nodo del árbol: +10% daño a jefes' },
  { id: 'llave',   n: 'Llave Maestra',         ic: '🗝️', key: 'tree.e6',             d: 'Nodo del árbol: +1 santuario por nivel' },
  { id: 'tomoG',   n: 'Tomo del Terremoto',    ic: '📕', key: 'abil.guerrero.sec.2', d: 'Habilidad del Guerrero: Salto Sísmico' },
  { id: 'tomoM',   n: 'Tomo del Vórtice',      ic: '📘', key: 'abil.mago.sec.2',     d: 'Habilidad del Mago: Prisión Arcana' },
  { id: 'tomoP',   n: 'Tomo de las Sombras',   ic: '📗', key: 'abil.picaro.sec.2',   d: 'Habilidad del Pícaro: Señuelo' },
];
// probabilidad de reliquia según de dónde sale
const RELIC_CH = { secreta: 0.35, puzle: 0.25, cumbre: 0.3, cripta: 0.35, jefe: 0.15 };

// Santuarios del mapa: quédate encima para activarlos (un solo uso).
const SHRINES = {
  poder:   { n: 'Santuario de Poder', c: '#ff5a3a', d: '+40% daño y +25% vel. ataque durante 25s' },
  fuente:  { n: 'Fuente de Vida', c: '#5bff8a', d: 'Cura 60% y +10 vida máxima' },
  saber:   { n: 'Altar del Saber', c: '#4aa3ff', d: 'Abre un cofre de mejora' },
  tiempo:  { n: 'Reloj Roto', c: '#c9d6ff', d: 'Los enemigos van a la mitad de velocidad 8s' },
  maldito: { n: 'Altar Maldito', c: '#b066ff', d: '¡Invoca 2 élites! (cofres y almas extra)' },
};
