# Plan de la actualización "Tryhard"

Propuesta de diseño y arquitectura para Ecos del Abismo, basada en el código actual
(`js/data.js` = datos y balance, `js/game.js` = motor, `js/world.js` = mapa, `js/ui.js` = menús,
`js/sprites.js` = arte en texto). La regla de siempre: **todo lo que se balancea vive en `data.js`**
y el motor solo lo interpreta.

Orden propuesto de implementación:

| Fase | Área | Por qué en este orden |
|---|---|---|
| 1 ✅ | Anti-farmeo (santuarios y jefe con tiempo) | Ya hecho y probado. |
| 2 ✅ | Afinidades y exclusividad | Cambia cómo se juega cada partida; las clases nuevas dependen de ello. |
| 3 ✅ | Animaciones (Animator) | Hay que tenerlo antes de dibujar héroes nuevos, para dibujarlos animados desde el principio. |
| 4 ✅ | Meta-progresión y tienda | Hace falta para que las clases nuevas se compren. |
| 5 ✅ | Clases nuevas, variantes y nombres | Usa las fases 2, 3 y 4. |
| 6 ✅ | Niveles 4 y 5 | Lo más grande en arte; aprovecha todo lo anterior (alturas, animaciones). |

---

## 1. Anti-farmeo ✅ (implementado)

**Problema real en el código:** tras vencer al jefe (`S.phase = 'cleared'`) no aparecen enemigos y no hay prisa,
así que se podían recorrer con calma santuarios, puzles, salas secretas y cofres. Durante el jefe, el director
sigue generando esbirros, así que alargar la pelea daba experiencia gratis.

**Solución (datos en `DIFFS`):**

| | Fácil | Normal | Difícil | Pesadilla | Tryhard |
|---|---|---|---|---|---|
| `shrines`: santuarios activables por nivel | 4 | 3 | 3 | 2 | 2 |
| `bossT`: segundos antes de la furia | 180 | 150 | 120 | 100 | 80 |
| `exitT`: segundos tras el jefe | 40 | 30 | 25 | 20 | 15 |

- `shrineLive(sh)` decide si un santuario se puede usar: sin usar, ventana abierta (`S.shrOpen`) y tope no alcanzado.
  Los apagados se dibujan grises con "(apagado)" y no invocan guardián.
- Al aparecer el jefe se cierran los santuarios. En el infinito, tras cada jefe se abre un ciclo nuevo
  (`S.shrUsed = 0`) y los que no usaste se reavivan.
- Jefe: `S.bossT` baja cada fotograma. Al llegar a 0, `bossEnrage()`: +50% daño, +30% velocidad, fase 2,
  el doble de esbirros y estos dan 0 de experiencia.
- Tras el jefe: `S.exitT` baja; a 0, `S.forceExit` hace que el portal te absorba (antes te entrega el cofre del jefe).
- HUD: contador de santuarios bajo el temporizador, reloj del jefe junto a su nombre y aviso del portal.

---

## 2. Afinidades mágicas y exclusividad ✅ (implementado)

> Hecho con los pares Fuego/Hielo, Tierra/Viento y Luz/Oscuridad (Rayo, Sangre y Arcano neutrales). Además de lo de abajo: 9 mejoras nuevas, 3 armas (Rocas Errantes, Cuchillas de Viento, Halo Sagrado) y 15 sinergias nuevas. Se quitó *Choque Térmico* (Fuego + Hielo), que ya no puede darse. Los pilares de Tierra son baldosas de muro temporales (`S.pillars` + `MAP.pil` para dibujarlas como columnas). El sello también cuenta el punto inicial de cada clase.

**Lo que ya existe:** `SCHOOLS` (fuego, hielo, tormenta, sangre, sombra, arcano) con bonos a 3/6/9 puntos,
`HYBRIDS` (sinergias de dos escuelas), y mejoras/armas etiquetadas con `sch`. Es la base perfecta: las
afinidades **son** las escuelas.

**Cambios de datos:**
```js
// data.js
SCHOOLS.tierra = { n: 'Tierra', ic: '🪨', c: '#b08850', opp: 'viento', tiers: [...] };
SCHOOLS.viento = { n: 'Viento', ic: '🌪️', c: '#bfffe0', opp: 'tierra', tiers: [...] };
SCHOOLS.luz    = { n: 'Luz',    ic: '✨', c: '#fff3b0', opp: 'sombra', tiers: [...] };
SCHOOLS.fuego.opp = 'hielo'; SCHOOLS.hielo.opp = 'fuego'; SCHOOLS.sombra.opp = 'luz';
SCHOOLS.sombra.n = 'Oscuridad';            // mismo id para no romper partidas guardadas
// tormenta (Rayo), sangre y arcano: neutrales (sin opuesto), así Rayo + Fuego es válido
```

**Lógica (motor):**
- `P.locked = new Set()`. En `applyChoice`, cuando una escuela pasa de 0 a 1 punto y tiene `opp`,
  se añade su opuesta a `P.locked` y sale un aviso ("❄ Hielo despierta: el Fuego queda sellado").
- `genChoices` descarta toda mejora o arma cuyo `sch` esté en `P.locked`. Las híbridas que dependan de una escuela
  sellada se descartan solas, porque piden 3 puntos en ambas.
- La carta que despertaría una afinidad con opuesto lleva la etiqueta "⚠ Sella Fuego", para que la decisión sea consciente.
- El panel TAB (build) muestra las selladas con 🔒.

**Efectos de las nuevas (3 / 6 / 9 puntos):**
- **Tierra (terreno temporal):** golpes que agrietan el suelo (barro lento 4 s) / pilares de roca temporales que
  bloquean a los enemigos / terremoto periódico.
  *Técnica:* una lista `MAP.tmp = [{ i, prevT, until }]` que cambia `MAP.t[i]` y lo restaura. Cada cambio sube `MAP.fver`
  y fuerza a recalcular el campo de flujo (`MAP.ptx = -1`). Nunca se levanta un pilar en la baldosa del jugador ni en una rampa.
- **Viento (velocidad):** +velocidad / dash extra que empuja / tornado que orbita.
- **Luz:** escudo al matar / los enemigos cegados no disparan / rayo sagrado.

**Decisión pendiente:** el kit inicial del Mago tiene Bola de Fuego y Nova Helada. Propongo que **el kit de clase sea
neutral** (no cuenta como afinidad); solo cuentan las cartas elegidas en la partida.

---

## 3. Clases, variantes y nombres

> ✅ Implementado. Variantes en `js/sprites.js` como capas (`VARIANTS`, `withVariant`) que funcionan con todos los fotogramas. Nombre en `SAVE.custom[cls].name`, limpiado con `cleanName` y mostrado con `esc`/canvas. Las 4 clases nuevas viven en `data.js` (`cost`, `school` o `null`, `pool`, `melee`, `noShield`, `trait`, `ult.dur/col`); sus ataques están en `primary()`, sus habilidades en `trySecondary()` y sus definitivas en `ultTick()`. Esqueletos aliados: `summonAllies`/`updateAllies`. Estados nuevos de enemigo: `rootT` (raíces) y `fearT` (miedo). El menú pasó a una cuadrícula compacta con una ficha del héroe elegido.

**Datos:**
```js
CLASSES.mago.variants = [ { id: 'm', n: 'Mago', spr: 'mage' }, { id: 'f', n: 'Maga', spr: 'mageF' } ];
CLASSES.druida = { n: 'Druida', aff: 'tierra', pool: null, cost: 600, ... };   // empieza con Tierra (y Viento sellado)
CLASSES.nomuerto = { n: 'No-Muerto', aff: 'sombra', pool: ['sombra', 'sangre', 'hielo', 'arcano'], ... };
```
- `aff`: afinidad predefinida. Al empezar: `P.schools[aff] = 1` y se sella su opuesta.
- `pool`: si existe, `genChoices` solo ofrece esas escuelas (más las mejoras neutras). Así la clase define qué opciones verás.
- La variante y el nombre se guardan en `SAVE.custom[cls] = { pal, prim, sec, var: 'f', name: 'Arwen' }`.
  `getSpr` recibe el `spr` de la variante. Los colores personalizables usan las mismas letras en ambas variantes,
  así que los cosméticos comprados sirven para las dos.
- **Nombre:** `<input maxlength="14">` en el panel Personalizar. Se pinta siempre con `textContent` o en el canvas,
  **nunca** con `innerHTML`, para que un nombre raro no rompa la página. Aparece en el HUD, en la pantalla final y en los récords.

**Clases nuevas (propuesta de rol):**

| Clase | Afinidad | Principal | Habilidad | Definitiva | Rasgo |
|---|---|---|---|---|---|
| Druida | Tierra | Espinas que brotan del suelo | Forma de oso (tanque 6 s) | Bosque viviente (raíces que atrapan) | Cura algo al pisar hierba |
| Berserker | Sangre | Hacha giratoria a corta distancia | Salto aplastante | Frenesí | Más daño cuanta menos vida; no puede tener escudo |
| Elfo | ninguna | Arco de disparo cargado | Trampa de lianas | Lluvia de flechas | +rango de recogida y +crítico a distancia |
| No-Muerto | Oscuridad | Toque necrótico (drena) | Invocar 3 esqueletos | Ejército de huesos | Los corazones curan la mitad, el robo de vida cuenta doble; Luz sellada |

*Técnica:* los ataques viven en `updatePlayer`/`updateWeapons` con un `switch` por `prim.id`, `sec.id` y la definitiva.
Cada clase nueva son unas 150–250 líneas más su sprite. Para las invocaciones del No-Muerto: una lista `S.allies`
que reutiliza `navDir` y `collideWalls` con el objetivo invertido.

---

## 4. Meta-progresión y economía ✅ (implementado)

> Hecho: `ROUTES`, `TREE` (18 nodos, 3 solo por reliquia), `RELICS` y `RELIC_CH` en `data.js`. Una 3ª habilidad por héroe con `cost: 250` (Salto Sísmico, Prisión Arcana y Señuelo). La base para bloquear héroes está lista: basta con poner `cost` en una clase y `classOwned()` la bloquea en el menú con su botón de compra. El árbol se aplica en `startRun` antes de `recalc()`, salvo en Tryhard (`noTree`). Las reliquias caen al recoger el cofre de una sala secreta o de una cumbre, al resolver un puzle, al abrir un sarcófago y al vencer a un jefe.

- **Moneda única:** la Esencia (`SAVE.souls`), la misma de los cosméticos.
- **Desbloqueos:** todo va al mapa existente `SAVE.unlocked` con claves con prefijo: `class.druida`,
  `abil.mago.sec.2`, `tree.vigor1`, `relic.x`. Al cargar una partida guardada, se rellenan los campos nuevos
  con valores por defecto (`SAVE.v = 2`).
- **Héroes:** guerrero, mago y pícaro gratis. Los demás muestran 🔒 y su precio en el menú.
  También se puede comprar una 3ª habilidad principal o secundaria por clase.
- **Árbol de rutas** (datos en `data.js`):
  ```js
  const TREE = [
    { id: 'vigor1', route: 'supervivencia', n: 'Piel curtida', d: '+5% vida', cost: 80, req: [], ap: b => b.maxHp *= 1.05 },
    { id: 'reroll', route: 'exploracion', n: 'Dado viejo', d: '+1 re-tirada', cost: 150, req: ['ojo1'], ap: (b, P) => P.rerolls++ },
    ...
  ];
  ```
  En `startRun` se aplican los nodos comprados a `P.b` antes de `recalc()`. Habría 3 rutas (Supervivencia, Poder,
  Exploración) con unos 8 nodos cada una, y una ventana nueva en el menú con los nodos dibujados como cuadrícula
  y líneas de requisito.
  **Para Tryhard:** propongo que el árbol funcione a la mitad o desactivado, para que el récord sea "puro".
- **Desbloqueos dentro de la partida:** las salas secretas, los puzles, las cumbres y los sarcófagos ya dan cofres.
  Se les añade una probabilidad de soltar una **reliquia** (`{ k: 'relic', id }`). Al recogerla, la reliquia se
  guarda en `SAVE.unlocked` para siempre y desbloquea un nodo del árbol o una habilidad
  ("📜 Reliquia: Grimorio de Escarcha — habilidad desbloqueada").
  Una tabla `RELICS` decide qué puede salir de cada fuente.

---

## 5. Animaciones (Animator) ✅ (implementado)

> Hecho en `js/sprites.js` (`ANIM`, `ANIM_FULL`, `frameRows`, `animTick`, `animPlay`, `animSpr`). Héroes: idle, walk y attack (el ataque principal, la habilidad y la definitiva lanzan `attack`; dura menos si atacas más rápido). Jefes: `BOSS_ANIM` en `game.js` traduce el estado de su IA a idle/walk/attack/cast; si falta un estado se usa el más parecido. El Rey Limo usa fotogramas completos (aplastarse, estirarse, boca abierta). Los enemigos comunes siguen con un fotograma.

**Hoy:** `RAW[base]` es un dibujo en texto; `getSpr` lo rasteriza una vez (y su espejo) y `drawSpr` lo pinta con un
pequeño balanceo. Es decir, un solo fotograma.

**Formato propuesto:** fotogramas como **diferencias sobre el dibujo base**, para no redibujar el sprite entero:
```js
const ANIM = {
  warrior: {
    idle:   { fps: 3,  frames: [ {}, { 0: '.....rr........' } ] },                       // el penacho se mueve
    walk:   { fps: 9,  frames: [ { 13: '...gg....gg...', 14: '..GGG.....GGG..' }, {}, { 13: '.....gg.gg....' }, {} ] },
    attack: { fps: 16, once: true, frames: [ { 7: '..RgwggggwgRWW.' }, { 6: '....GsssssGWWW' }, {} ] },
  },
};
```
`getSpr(base, pal, elite, anim, frame)` aplica las filas cambiadas sobre `RAW[base]` y guarda en caché cada combinación.

**Máquina de estados:**
```js
function animUpdate(o, dt, want) {           // want = 'idle' | 'walk'
  const a = o.anim || (o.anim = { st: 'idle', t: 0, lock: 0 });
  a.lock -= dt; a.t += dt;
  const next = a.lock > 0 ? a.st : want;      // el ataque bloquea hasta terminar
  if (next !== a.st) { a.st = next; a.t = 0; }
}
function animPlay(o, st, dur) { o.anim.st = st; o.anim.t = 0; o.anim.lock = dur; }   // al atacar
function animFrame(def, a) { const A = def[a.st]; const f = Math.floor(a.t * A.fps); return A.once ? Math.min(f, A.frames.length - 1) : f % A.frames.length; }
```
- **Héroes:** `want = P.moving ? 'walk' : 'idle'`. Al disparar el ataque principal se llama `animPlay(P, 'attack', min(0.25, 1/rate))`.
- **Jefes:** sus estados actuales (`st: 'dash' | 'jump' | 'cast' | 'intro'`) se traducen a animaciones (`dash → attack`,
  `cast → cast`), así la lógica de ataque no cambia.
- **Enemigos comunes:** 2 fotogramas de caminar, con la fase desfasada por `id` para que no se muevan todos sincronizados.

**Alternativa de arte:** como tienes LibreSprite, se puede pasar a hojas PNG (`sprites/warrior.png` + un JSON de
fotogramas). El Animator es el mismo; solo cambia de dónde salen las imágenes. Recomiendo seguir con el texto para
los enemigos y usar PNG para los héroes y jefes, que es donde más se nota.

---

## 6. Niveles 4 y 5: bajar al Abismo

> ✅ Implementado. Biomas `roots` y `void` (índices 3 y 4 de `BIOME_KEYS`/`LEVELS`), baldosa `TVOID` (bloquea a todos menos al jugador; el BFS y `linkT` la tratan como muro), `genRifts` (cada grieta solo se acepta si todo sigue siendo alcanzable a pie), `voidFall`, `crumbleAround` + `S.crumble`, ecos (`echoSpr`), jefes `motherRoot` y `voice` en `updateBoss`, pistas de música 4 y 5, y la caída de entrada con `S.introFall`. Los niveles tienen ahora `bossTtk`, `testLv` y `depth`. También están en el modo infinito: semillas de Voronoi para los 5 biomas, `genRifts(..., onlyBio)` abre grietas solo en las regiones de vacío y los jefes rotan con `LEVELS[S.bossN % LEVELS.length].boss`.

| | Nivel 4: Raíces Hundidas | Nivel 5: El Corazón del Abismo |
|---|---|---|
| Idea | Cavernas bajo la forja: hongos bioluminiscentes, agua negra, raíces gigantes | Plataformas de roca flotando sobre el vacío; el mapa baja en terrazas hacia el centro |
| Terreno | Agua (lenta, apaga quemaduras), esporas (veneno), lianas | **Grietas al vacío:** caer = daño y vuelves a tu última baldosa segura (usa el sistema de alturas) |
| Enemigos | Hongo que se divide, anguila que embiste desde el agua, araña de techo | Ojos flotantes, ecos del jugador (copian tu clase), devoradores |
| Jefe | Madre Raíz (invoca raíces, zonas de esporas) | La Voz del Abismo (fases según la terraza; arena que se desmorona) |
| Transición | El portal se convierte en una caída: pantalla en negro y apareces más abajo | Al vencer, salida final |

**Puntos del código que hay que generalizar (ahora están fijos para 3 niveles):**
- `BIOME_KEYS`, `TERRAIN`, `wallTex`, `cliffTex` y el color de la niebla: añadir 2 biomas.
- `[30, 38, 46][S.lvlIdx]` (duración del jefe) pasa a un campo `bossTtk` en cada nivel.
- `S.lvlIdx < 2` en el texto del jefe pasa a `LEVELS.length - 1`.
- Los niveles de prueba con 9 y 19 niveles pasan a un campo `testLv`.
- Las semillas de bioma del infinito (`order`) incluyen los biomas nuevos.
- `updateBoss`: un caso por `bid` para los ataques nuevos.
- `audio.js`: 2 pistas nuevas.

---

## Decisiones que necesito de ti

1. ✅ ¿Los pares opuestos son **Fuego/Hielo, Luz/Oscuridad, Tierra/Viento**, con Rayo, Sangre y Arcano neutrales?
2. ✅ "Sombra" pasa a llamarse **Oscuridad** y "Tormenta" a **Rayo**; Arcano se queda.
3. Anti-farmeo: lo apliqué a **todas las dificultades** con valores escalados. ¿O lo quieres solo en Tryhard?
4. Precios aproximados: héroe nuevo 500–900 Esencia, nodo del árbol 60–300, 3ª habilidad 250.
5. Arte: ¿sigo con sprites en texto, o pasamos los héroes y jefes a PNG hechos en LibreSprite?
6. ¿Te gustan los temas de los niveles 4 y 5?
