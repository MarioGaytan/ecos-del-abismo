'use strict';
// =====================================================================
//  INTERFAZ — menú, selección de héroe, altar de almas, subida de
//  nivel (cartas), encrucijada, pausa, build y fin de partida.
// =====================================================================

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hide = id => $(id).classList.add('hidden');

const UI = {
  cls: 'guerrero', start: 0, endless: false, queue: [], choices: [], lvKind: 'level', paths: [], openedAt: 0,
  // evita elegir una carta por accidente con un toque que venía del juego
  guard() { return performance.now() - this.openedAt < 450; },

  // ------------------------------------------------ MENÚ
  buildMenu() {
    // héroes: cuadrícula compacta + ficha del elegido (también se pueden ver los bloqueados para comprarlos)
    const box = $('classes'); box.innerHTML = '';
    if (!CLASSES[this.cls]) this.cls = 'guerrero';
    for (const [id, C] of Object.entries(CLASSES)) {
      const owned = classOwned(id), SC = SCHOOLS[C.school];
      const d = document.createElement('div');
      d.className = 'cls' + (id === this.cls ? ' sel' : '') + (owned ? '' : ' lockd');
      const cvs = document.createElement('canvas'); cvs.width = 96; cvs.height = 96;
      drawPortrait(cvs, id);
      d.appendChild(cvs);
      d.insertAdjacentHTML('beforeend', `<h3>${esc(heroName(id))}</h3><small>${owned ? (SC ? SC.ic + ' ' + SC.n : '🌀 Libre') : '🔒 ✦' + C.cost}</small>`);
      d.onclick = () => { this.cls = id; AU.init(); AU.sfx('ui'); this.buildMenu(); };
      box.appendChild(d);
    }
    this.buildInfo();
    this.endless = !!SAVE.settings.endless;
    const md = $('modes'); md.innerHTML = '';
    [[false, '⚔ Campaña', LEVELS.length + ' niveles de descenso'], [true, '∞ Hordas infinitas', 'Mapa gigante mixto']].forEach(([v, n, sub]) => {
      const b = document.createElement('button');
      b.className = 'lv' + (this.endless === v ? ' sel' : '');
      b.innerHTML = `${n}<small>${sub}</small>`;
      b.onclick = () => { SAVE.settings.endless = v; persist(); AU.init(); AU.sfx('ui'); this.buildMenu(); };
      md.appendChild(b);
    });
    const df = $('diffs'); df.innerHTML = '';
    const cur = SAVE.settings.diff || 'normal';
    for (const [k, D] of Object.entries(DIFFS)) {
      const b = document.createElement('button');
      b.className = 'lv dif' + (D.tryhard ? ' th' : '') + (cur === k ? ' sel' : '');
      b.innerHTML = `${D.ic} ${D.n}<small>${D.d}<br>🎁 élite ${Math.round(D.chest * 100)}% · ✦ ${D.shrines} santuarios · ⏰ jefe ${D.bossT}s</small>`;
      b.onclick = () => { SAVE.settings.diff = k; persist(); AU.init(); AU.sfx('ui'); this.buildMenu(); };
      df.appendChild(b);
    }
    $('lvLabel').style.display = $('levels').style.display = this.endless ? 'none' : '';
    const lv = $('levels'); lv.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'lv' + (i === this.start ? ' sel' : '');
      b.innerHTML = `<b>${i + 1}</b> ${L.n}<small>${i === 0 ? 'Partida normal' : 'Prueba: empiezas con ' + L.testLv + ' niveles'}</small>`;
      b.onclick = () => { this.start = i; AU.init(); AU.sfx('ui'); this.buildMenu(); };
      lv.appendChild(b);
    });
    $('souls').textContent = Math.floor(SAVE.souls);
    const tn = TREE.filter(t => SAVE.unlocked['tree.' + t.id]).length;
    $('treeBtn').innerHTML = `🌳 Árbol de rutas <small>${tn}/${TREE.length}</small>`;
    const be = SAVE.bestEndless || 0;
    $('record').textContent = `Récord de bajas: ${SAVE.best || 0} · Victorias: ${SAVE.wins || 0} · Mejor tiempo infinito: ${Math.floor(be / 60)}:${String(be % 60).padStart(2, '0')}`;
  },
  buildInfo() {
    const id = this.cls, C = CLASSES[id], cu = heroCustom(id), owned = classOwned(id), SC = SCHOOLS[C.school];
    const secOk = i => !C.secs[i].cost || SAVE.unlocked['abil.' + id + '.sec.' + i];
    const sec = C.secs[cu.sec] && secOk(cu.sec) ? C.secs[cu.sec] : C.secs[0];
    const v = heroVariant(id), named = !!cu.name;
    const box = $('clsInfo');
    box.innerHTML = `<div><h3>${esc(heroName(id))}${named ? ` <small>${esc(v.n)}</small>` : ''}</h3>
      <p class="d">${C.desc}</p>
      <ul><li><b>Clic izq:</b> ${(C.prims[cu.prim] || C.prims[0]).n}</li><li><b>Clic der / E:</b> ${sec.n}</li><li><b>Q:</b> ${C.ult.n} — ${C.ult.d}</li></ul>
      <div class="st">❤ ${C.hp} · 👟 ${C.spd} · 🛡 ${C.armor} · ${SC ? `${SC.ic} ${SC.n} +1${SC.opp ? ` (sella ${SCHOOLS[SC.opp].n})` : ''}` : '🌀 Sin afinidad fija'}</div>
      ${C.trait ? `<div class="tr">✦ ${C.trait}</div>` : ''}</div>
      <div class="btns">${owned ? '<button class="custBtn">🎨 Personalizar</button>' : `<button class="custBtn buy"${SAVE.souls < C.cost ? ' disabled' : ''}>🔒 Comprar · ✦${C.cost}</button><small>Tienes ✦${Math.floor(SAVE.souls)}</small>`}</div>`;
    box.querySelector('.custBtn').onclick = () => {
      AU.init();
      if (owned) { this.openCustom(); return; }
      if (SAVE.souls < C.cost) { AU.sfx('hurt'); return; }
      SAVE.souls -= C.cost; SAVE.unlocked['class.' + id] = true; persist(); AU.sfx('chest');
      this.buildMenu();
    };
    $('playBtn').disabled = !owned;
    $('playBtn').textContent = owned ? '▶ JUGAR' : '🔒 Compra este héroe para jugar';
  },
  openMenu() {
    mode = 'menu'; S = null;
    ['levelup', 'cross', 'pause', 'over', 'stats', 'custom', 'opts'].forEach(hide);
    show('menu'); this.buildMenu();
    AU.stopMusic();
  },
  play() {
    if (!classOwned(this.cls)) { AU.sfx('hurt'); return; }
    AU.init(); AU.sfx('ui');
    goFullscreenLandscape();
    hide('menu');
    startRun(this.cls, this.start, this.endless);
  },

  // ------------------------------------------------ PERSONALIZACIÓN (cosmética + habilidades iniciales)
  openCustom() {
    const id = this.cls, C = CLASSES[id], cu = heroCustom(id);
    $('custTitle').textContent = '🎨 ' + heroVariant(id).n;
    $('custEss').textContent = Math.floor(SAVE.souls);
    drawPortrait($('custPrev'), id);
    const box = $('custBody'); box.innerHTML = '';
    // nombre del héroe
    const nr = document.createElement('div'); nr.className = 'slot';
    nr.innerHTML = '<div class="label">Nombre</div>';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.maxLength = 14; inp.className = 'nameIn'; inp.placeholder = heroVariant(id).n; inp.value = cu.name || '';
    inp.oninput = () => { cu.name = cleanName(inp.value); persist(); $('custTitle').textContent = '🎨 ' + heroName(id); };
    inp.onkeydown = ev => ev.stopPropagation();          // que Enter/teclas no lancen la partida
    inp.onchange = () => { inp.value = cu.name || ''; this.buildMenu(); };
    nr.appendChild(inp); box.appendChild(nr);
    // variante (Mago / Maga…)
    if (C.variants && C.variants.length > 1) {
      const vr = document.createElement('div'); vr.className = 'slot';
      vr.innerHTML = '<div class="label">Variante</div>';
      const sw = document.createElement('div'); sw.className = 'sw';
      for (const v of C.variants) {
        const b = document.createElement('button');
        b.className = 'swatch var' + (cu.var === v.id ? ' sel' : '');
        const pc = document.createElement('canvas'); pc.width = 48; pc.height = 48;
        const sp = getSpr(v.spr || C.spr, heroPal(id)), x = pc.getContext('2d'); x.imageSmoothingEnabled = false;
        const k = Math.floor(44 / Math.max(sp.w, sp.h)); x.drawImage(sp.c[0], (48 - sp.w * k) / 2, (48 - sp.h * k) / 2, sp.w * k, sp.h * k);
        b.appendChild(pc); b.insertAdjacentHTML('beforeend', esc(v.n) + (v.id === 'f' ? ' ♀' : ' ♂'));
        b.onclick = () => { cu.var = v.id; persist(); AU.sfx('ui'); this.openCustom(); };
        sw.appendChild(b);
      }
      vr.appendChild(sw); box.appendChild(vr);
    }
    for (const slot of CUSTOM[id]) {
      const row = document.createElement('div'); row.className = 'slot';
      row.innerHTML = `<div class="label">${slot.n}</div>`;
      const sw = document.createElement('div'); sw.className = 'sw';
      slot.opts.forEach((o, i) => {
        const key = id + '.' + slot.id + '.' + i, locked = o.cost && !SAVE.unlocked[key];
        const b = document.createElement('button');
        b.className = 'swatch' + ((cu.pal[slot.id] || 0) === i ? ' sel' : '') + (locked ? ' lock' : '');
        b.innerHTML = `<span style="background:linear-gradient(135deg,${o.c[0]} 50%,${o.c[1] || o.c[0]} 50%)"></span>${o.n}${locked ? `<small>🔒 ✦${o.cost}</small>` : ''}`;
        b.onclick = () => {
          if (locked) {
            if (SAVE.souls < o.cost) { AU.sfx('hurt'); return; }
            SAVE.souls -= o.cost; SAVE.unlocked[key] = true; AU.sfx('chest');
          } else AU.sfx('ui');
          cu.pal[slot.id] = i; persist(); this.openCustom();
        };
        sw.appendChild(b);
      });
      row.appendChild(sw); box.appendChild(row);
    }
    for (const [kind, list, label] of [['prim', C.prims, 'Ataque principal (clic izq.)'], ['sec', C.secs, 'Habilidad (clic der. / E)']]) {
      const row = document.createElement('div'); row.className = 'slot';
      row.innerHTML = `<div class="label">${label}</div>`;
      const sw = document.createElement('div'); sw.className = 'abil';
      list.forEach((a, i) => {
        const key = 'abil.' + id + '.' + kind + '.' + i, locked = a.cost && !SAVE.unlocked[key];
        const b = document.createElement('button');
        b.className = 'ab' + (cu[kind] === i && !locked ? ' sel' : '') + (locked ? ' lock' : '');
        b.innerHTML = `<b>${locked ? '🔒 ' : ''}${a.n}</b><small>${a.d}${a.cd ? ' · ' + a.cd + 's' : ''}${locked ? ` · <span class="souls">✦${a.cost}</span> (o encuentra su tomo)` : ''}</small>`;
        b.onclick = () => {
          if (locked) {
            if (SAVE.souls < a.cost) { AU.sfx('hurt'); return; }
            SAVE.souls -= a.cost; SAVE.unlocked[key] = true; AU.sfx('chest');
          } else AU.sfx('ui');
          cu[kind] = i; persist(); this.openCustom();
        };
        sw.appendChild(b);
      });
      row.appendChild(sw); box.appendChild(row);
    }
    show('custom');
    this.buildMenu();
  },

  // ------------------------------------------------ ÁRBOL DE RUTAS
  openTree() {
    const own = id => !!SAVE.unlocked['tree.' + id];
    $('treeEss').textContent = Math.floor(SAVE.souls);
    const box = $('treeBody'); box.innerHTML = '';
    for (const [rk, R] of Object.entries(ROUTES)) {
      const col = document.createElement('div'); col.className = 'route'; col.style.setProperty('--rc', R.c);
      col.innerHTML = `<h3>${R.ic} ${R.n}</h3>`;
      for (let tier = 1; tier <= 4; tier++) {
        const row = document.createElement('div'); row.className = 'trow';
        for (const t of TREE.filter(x => x.route === rk && x.tier === tier)) {
          const reqOk = !t.req.length || t.req.some(own), have = own(t.id);
          const b = document.createElement('button');
          b.className = 'node' + (have ? ' own' : t.relic ? ' relic' : reqOk ? ' avail' : ' lock');
          const need = t.req.map(r => TREE_BY[r].n).join(' o ');
          const price = have ? '✔ Tuyo' : t.relic ? '🔮 Solo con reliquia' : !reqOk ? '🔒 Requiere ' + need : `✦${t.cost}`;
          b.innerHTML = `<span class="ic">${t.ic}</span><b>${t.n}</b><small>${t.d}</small><i>${price}</i>`;
          if (!have && !t.relic && reqOk && SAVE.souls < t.cost) b.classList.add('poor');
          b.onclick = () => {
            if (have || t.relic || !reqOk) { AU.sfx('ui'); return; }
            if (SAVE.souls < t.cost) { AU.sfx('hurt'); return; }
            SAVE.souls -= t.cost; SAVE.unlocked['tree.' + t.id] = true; persist(); AU.sfx('chest');
            this.openTree(); this.buildMenu();
          };
          row.appendChild(b);
        }
        col.appendChild(row);
      }
      box.appendChild(col);
    }
    show('tree');
  },

  // ------------------------------------------------ OPCIONES
  openOpts() {
    const st = SAVE.settings;
    const rows = [
      ['quality', 'Calidad gráfica', st.quality === 'high' ? 'Alta' : 'Baja (más FPS)'],
      ['sfx', 'Efectos de sonido', st.sfx ? 'Sí' : 'No'],
      ['music', 'Música', st.music ? 'Sí' : 'No'],
      ['auto', 'Auto-ataque (F)', st.auto ? 'Sí' : 'No'],
      ['dmgNums', 'Números de daño', st.dmgNums ? 'Todos' : 'Solo críticos'],
      ['fps', 'Mostrar FPS', st.fps ? 'Sí' : 'No'],
    ];
    const box = $('optList'); box.innerHTML = '';
    for (const [k, n, v] of rows) {
      const b = document.createElement('button'); b.className = 'opt';
      b.innerHTML = `<span>${n}</span><b>${v}</b>`;
      b.onclick = () => {
        if (k === 'quality') { st.quality = st.quality === 'high' ? 'low' : 'high'; st.qSet = true; resize(); }
        else st[k] = !st[k];
        persist(); AU.sfx('ui'); this.openOpts();
      };
      box.appendChild(b);
    }
    show('opts');
  },

  // ------------------------------------------------ SUBIDA DE NIVEL
  openLevelUp(kind) {
    if (mode === 'levelup') { this.queue.push(kind); return; }
    if (kind === 'level') { if (S.pendingLv <= 0) return; S.pendingLv--; }
    mode = 'levelup';
    this.lvKind = kind;
    mouse.l = false;
    this.roll();
    $('lvTitle').textContent = kind === 'boss' ? '👑 Cofre del Jefe' : kind === 'puzzle' ? '🧩 ¡Puzle resuelto!' : kind === 'chest' ? '🎁 ¡Cofre!' : '⬆ ¡Nivel ' + (P.lvl - S.pendingLv) + '!';
    $('lvSub').textContent = kind === 'level' ? 'Elige una mejora. Especialízate: 3/6/9 puntos en una escuela desbloquean poderes.' : 'Recompensa de rareza superior';
    show('levelup');
    this.openedAt = performance.now();
    AU.sfx(kind === 'level' ? 'level' : 'chest');
  },
  roll() {
    const minR = this.lvKind === 'boss' || this.lvKind === 'puzzle' ? 2 : this.lvKind === 'chest' ? 1 : 0;
    const n = P.s.luck >= 50 ? 4 : 3;
    this.choices = genChoices(n, minR, this.lvKind === 'boss');
    const box = $('cards'); box.innerHTML = '';
    this.choices.forEach((c, i) => {
      const d = document.createElement('div');
      const R = RAR[c.r];
      d.className = 'card'; d.style.setProperty('--rc', R.c);
      d.innerHTML = `<div class="rar">${c.tag || R.n}</div><div class="ic">${c.ic}</div><h3>${c.n}</h3><p>${c.d}</p>${c.sch ? `<div class="sch" style="color:${SCHOOLS[c.sch].c}">${SCHOOLS[c.sch].ic} ${SCHOOLS[c.sch].n} ${P.schools[c.sch]}→${P.schools[c.sch] + c.pts}${nextTier(c.sch, c.pts)}${sealWarn(c.sch)}</div>` : '<div class="sch">Sin escuela</div>'}<kbd>${i + 1}</kbd>`;
      d.onclick = () => this.choose(i);
      box.appendChild(d);
    });
    $('rerollBtn').textContent = `🎲 Re-tirar [R] (${P.rerolls})`;
    $('rerollBtn').disabled = P.rerolls <= 0;
  },
  reroll() { if (P.rerolls <= 0) return; P.rerolls--; AU.sfx('ui'); this.roll(); },
  skip() { heal(P.s.maxHp * 0.15, true); S.souls += 3; this.closeLevelUp(); },
  choose(i) {
    if (this.guard()) return;
    const c = this.choices[i]; if (!c) return;
    applyChoice(c);
    AU.sfx('pick');
    this.closeLevelUp();
  },
  closeLevelUp() {
    hide('levelup');
    mode = 'play';
    if (this.queue.length) this.openLevelUp(this.queue.shift());
    else if (S.pendingLv > 0) this.openLevelUp('level');
  },

  // ------------------------------------------------ ENCRUCIJADA
  openCross() {
    mode = 'cross';
    const allMaxed = P.weapons.length >= 4 && P.weapons.every(w => w.lvl >= 5);
    const pool = PATHS.filter(p => !(p.id === 'forja' && allMaxed)).sort(() => Math.random() - 0.5).slice(0, 3);
    this.paths = pool;
    const next = LEVELS[S.lvlIdx + 1];
    $('crossSub').textContent = S.endless ? 'El Abismo no termina. Gasta tus almas y elige una bendición.' : `Siguiente: ${next.sub} — ${next.n}. Gasta tus almas y elige tu camino.`;
    this.openedAt = performance.now();
    this.buildShop();
    const box = $('paths'); box.innerHTML = '';
    pool.forEach((p, i) => {
      const d = document.createElement('div'); d.className = 'card path'; d.style.setProperty('--rc', '#b066ff');
      d.innerHTML = `<div class="ic">${p.ic}</div><h3>${p.n}</h3><p>${p.d}</p><kbd>${i + 1}</kbd>`;
      d.onclick = () => this.pickPath(i);
      box.appendChild(d);
    });
    show('cross');
  },
  buildShop() {
    $('shopSouls').textContent = Math.floor(S.souls);
    const box = $('shop'); box.innerHTML = '';
    for (const it of RUN_SHOP) {
      const n = S.shopBuys[it.id] || 0, cost = Math.round(it.cost * Math.pow(1.6, n)), maxed = it.max && n >= it.max;
      const b = document.createElement('button');
      b.className = 'shopItem';
      b.disabled = maxed || S.souls < cost;
      b.innerHTML = `<span class="ic">${it.ic}</span><b>${it.n}</b><small>${it.d}</small><i>${maxed ? 'AGOTADO' : '✦ ' + cost}</i>`;
      b.onclick = () => {
        if (maxed || S.souls < cost) return;
        S.souls -= cost; S.shopBuys[it.id] = n + 1;
        it.ap(); recalc(); AU.sfx('chest'); this.buildShop();
      };
      box.appendChild(b);
    }
  },
  pickPath(i) {
    if (this.guard()) return;
    const p = this.paths[i]; if (!p) return;
    hide('cross'); AU.sfx('portal');
    applyPath(p.id);
  },

  // ------------------------------------------------ PAUSA / STATS / FIN
  pause() {
    if (mode !== 'play') return;
    mode = 'pause'; show('pause');
  },
  resume() { hide('pause'); hide('opts'); mode = 'play'; },
  abandon() { hide('pause'); gameOver(false); },
  showStats() {
    if (!P || (mode !== 'play' && mode !== 'pause')) return;
    $('statsBody').innerHTML = buildSummary();
    show('stats');
  },
  hideStats() { if (mode !== 'pause') hide('stats'); },
  showOver(win, earned) {
    hide('stats');
    $('overTitle').textContent = win ? '🏆 ¡VICTORIA!' : S.endless ? '∞ FIN DE LAS HORDAS' : '💀 HAS CAÍDO';
    $('overTitle').style.color = win ? '#ffd43b' : '#ff5a5a';
    const t = S.runTime;
    $('overBody').innerHTML = `<div class="ostats">
      <div><b>${S.endless ? 'Amenaza ' + S.threat : S.L.n}</b><small>${S.endless ? 'Hordas infinitas' : 'Llegaste a'}</small></div>
      <div><b>${esc(P.name || heroVariant(P.cls).n)}</b><small>${esc(heroVariant(P.cls).n)}</small></div>
      <div><b>${S.diff.ic} ${S.diff.n}</b><small>Dificultad</small></div>
      <div><b>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</b><small>Tiempo</small></div>
      <div><b>${P.lvl}</b><small>Nivel</small></div>
      <div><b>${S.kills}</b><small>Bajas</small></div>
      <div><b>${Math.round(S.dmgDone).toLocaleString()}</b><small>Daño total</small></div>
      <div><b style="color:#ff9a3a">x${S.bestCombo}</b><small>Mejor racha</small></div>
      <div><b style="color:#d0a0ff">+${earned} ✦</b><small>Esencia</small></div>
      ${S.relics.length ? `<div><b style="color:#ff9af0">${S.relics.map(id => RELICS.find(r => r.id === id).ic).join(' ')}</b><small>Reliquias</small></div>` : ''}
    </div>` + buildSummary(true);
    show('over');
  },

  onKey(c) {
    if (mode === 'levelup') {
      if (/^Digit[1-4]$/.test(c)) this.choose(+c.slice(5) - 1);
      else if (c === 'KeyR') this.reroll();
      else if (c === 'KeyX') this.skip();
    } else if (mode === 'cross') {
      if (/^Digit[1-3]$/.test(c)) this.pickPath(+c.slice(5) - 1);
    } else if (mode === 'pause') {
      if (c === 'Escape' || c === 'KeyP') this.resume();
    } else if (mode === 'over') {
      if (c === 'Enter') { hide('over'); startRun(this.cls, this.start, this.endless); }
      if (c === 'Escape') this.openMenu();
    } else if (mode === 'menu') {
      if (c === 'Enter' && $('custom').classList.contains('hidden') && $('opts').classList.contains('hidden') && $('tree').classList.contains('hidden')) this.play();
      if (c === 'Escape') { hide('custom'); hide('opts'); hide('help'); }
    }
  },
};

function drawPortrait(cvs, id) {
  const x = cvs.getContext('2d'); x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, cvs.width, cvs.height);
  const sp = getSpr(heroSpr(id), heroPal(id)), sc = Math.floor(cvs.width * 0.94 / Math.max(sp.w, sp.h));
  x.drawImage(sp.c[0], (cvs.width - sp.w * sc) / 2, (cvs.height - sp.h * sc) / 2, sp.w * sc, sp.h * sc);
}
function nextTier(sch, pts) {
  const v = P.schools[sch], nv = v + pts;
  let out = '';
  for (const th of [3, 6, 9]) if (v < th && nv >= th) out += ` <b>· ¡DESBLOQUEA ${['I', 'II', 'III'][th / 3 - 1]}!</b>`;
  if (v < 3 && nv >= 3) for (const h of HYBRIDS) {
    const other = h.a === sch ? h.b : h.b === sch ? h.a : null;
    if (other && P.schools[other] >= 3) out += ` <b style="color:#ffb020">· Sinergia ${h.ic} ${h.n}</b>`;
  }
  return out;
}
function srcName(k) {
  const C = P.C;
  const m = { prim: C.prim.n, sec: C.sec.n, ult: C.ult.n, burn: 'Quemaduras', chain: 'Rayos en cadena', fuego: 'Explosiones ígneas', hielo: 'Esquirlas de hielo',
    tormenta: 'Rayos del cielo', sangre: 'Nova de sangre', aliados: 'Esqueletos aliados', tierra: 'Terremoto y pilares', grieta: 'Grietas de barro', viento: 'Ráfagas y tornado', luz: 'Juicio de luz', espinas: 'Espinas', trampas: 'Trampas (enemigos atraídos)', terreno: 'Terreno dañino', piroclasto: 'Piroclasto', fantasma: 'Paso Fantasma', hemomancia: 'Hemomancia', fenix: 'Fénix', dash: 'Esquiva perfecta' };
  return m[k] || (WEAPONS[k] ? WEAPONS[k].ic + ' ' + WEAPONS[k].n : k);
}
function dmgBreakdown() {
  const tot = Object.values(S.dmgBy).reduce((a, b) => a + b, 0) || 1;
  const rows = Object.entries(S.dmgBy).sort((a, b) => b[1] - a[1]).slice(0, 8);
  let h = '<h4>Daño por fuente</h4>';
  if (!rows.length) return h + '<div class="tier">Aún nada</div>';
  for (const [k, v] of rows) {
    const f = v / tot;
    h += `<div class="dmgrow"><span>${srcName(k)}</span><i style="width:${Math.max(2, f * 100)}%"></i><b>${pct(f)}</b></div>`;
  }
  return h;
}

// ------------------------------------------------ generación de cartas
function rollRarity(minR) {
  const L = P.s.luck;
  const w = [60, 28 + L * 0.4, 10 + L * 0.2, 2 + L * 0.06];
  for (let i = 0; i < minR; i++) w[i] = 0;
  let t = w.reduce((a, b) => a + b, 0), r = Math.random() * t;
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return i; }
  return 3;
}
// ¿Sirve esta mejora ahora? Oculta las que ya llegaron a su tope real o no combinan con tu build.
// la carta que despierta una afinidad con opuesto avisa de lo que se va a sellar
function sealWarn(sch) {
  const opp = SCHOOLS[sch].opp;
  if (!opp || P.schools[sch] > 0 || P.locked[opp]) return '';
  return ` <b style="color:#ff8a6a">· ⚠ Sella ${SCHOOLS[opp].ic} ${SCHOOLS[opp].n}</b>`;
}
function upgradeUseful(u) {
  const s = P.s, b = P.b, has = id => P.weapons.some(w => w.id === id);
  const shoots = !P.C.melee || s.proj > 0 || has('dagas') || has('craneos') || has('cuchillas');
  switch (u.id) {
    case 'evasion': return s.dodge < 0.6;
    case 'celer': return s.cdr < 0.65;
    case 'escarcha': return s.slow < 0.7;
    case 'ojo': return s.crit < 0.8;
    case 'asesino': case 'frenesi': return b.atkSpd < 3;
    case 'brasas': return s.burnCh < 1;
    case 'chispa': return s.chainCh < 1;
    case 'cero': return s.freezeCh < 0.5;
    case 'multi': return s.proj < 6;
    case 'amplif': return s.area < 2.6;
    case 'colmillos': return s.lifesteal < 0.12;
    case 'letal': return s.crit >= 0.08 && s.critMult < 4;
    case 'perfor': case 'velproj': return shoots;                       // sin proyectiles no sirven
    case 'corazon': case 'pirom': return s.burnCh > 0 || has('orbes');   // necesitan algo que queme
    case 'conductor': return s.chainCh > 0 || has('rayos');              // necesitan rayos en cadena
    case 'singularidad': return (P.ups.iman || 0) >= 3;
    case 'grieta': return s.quakeCh < 0.6;
    case 'resplandor': return s.blindCh < 0.5;
    case 'pluma': return s.dashCdr < 0.5;
    case 'condensador': return s.shield > 0;                            // sin escudo no sirve
    case 'barrera': return !P.C.noShield && s.shield < 0.8;
  }
  return true;
}
function genChoices(n, minR, bossChest) {
  const cand = [];
  for (const u of UPGRADES) {
    if ((P.ups[u.id] || 0) >= u.max || !upgradeUseful(u) || (u.sch && P.locked[u.sch]) || (u.sch && P.C.pool && !P.C.pool.includes(u.sch))) continue;
    let w = 10;
    if (u.sch) w *= 1 + P.schools[u.sch] * 0.18; // sesgo hacia tu especialización
    cand.push({ kind: 'up', u, w });
  }
  for (const [id, wd] of Object.entries(WEAPONS)) {
    if (P.locked[wd.sch] || (P.C.pool && !P.C.pool.includes(wd.sch))) continue;   // afinidad sellada o fuera de la clase
    const own = P.weapons.find(w => w.id === id);
    if (!own && P.weapons.length < 4) cand.push({ kind: 'wnew', id, wd, w: 9 + P.schools[wd.sch] * 2 });
    if (own && own.lvl < 5) cand.push({ kind: 'wup', id, wd, own, w: 16 });
    if (own && own.lvl >= 5 && !own.evo && P.schools[wd.sch] >= 6) cand.push({ kind: 'evo', id, wd, own, w: bossChest ? 500 : 40 });
  }
  const out = [];
  while (out.length < n && cand.length) {
    const c = wpick(cand, x => x.w);
    cand.splice(cand.indexOf(c), 1);
    let r = rollRarity(minR);
    let card;
    if (c.kind === 'up') {
      const u = c.u;
      if (u.minR && r < u.minR) r = u.minR;
      const m = RAR[r].m;
      card = { kind: 'up', id: u.id, r, ic: u.ic, n: u.n, d: u.tx(m), sch: u.sch, pts: r >= 3 ? 2 : 1, m };
    } else if (c.kind === 'wnew') {
      r = Math.max(r, 1);
      card = { kind: 'wnew', id: c.id, r, ic: c.wd.ic, n: c.wd.n, d: c.wd.d, sch: c.wd.sch, pts: r >= 3 ? 2 : 1, tag: 'Nueva arma' };
    } else if (c.kind === 'wup') {
      const lv = Math.min(5, c.own.lvl + (r >= 2 ? 2 : 1));
      card = { kind: 'wup', id: c.id, r, ic: c.wd.ic, n: c.wd.n + ' → Nv ' + lv, d: 'Más daño, cantidad y frecuencia.' + (lv === 5 ? ` Al Nv 5 + 6 pts de ${SCHOOLS[c.wd.sch].n}: evoluciona.` : ''), sch: c.wd.sch, pts: 1, lv, tag: 'Mejora de arma' };
    } else {
      card = { kind: 'evo', id: c.id, r: 3, ic: '★', n: c.wd.evo, d: c.wd.evoD, sch: c.wd.sch, pts: 1, tag: 'EVOLUCIÓN' };
    }
    out.push(card);
  }
  while (out.length < n) out.push({ kind: 'heal', r: 0, ic: '🍖', n: 'Festín', d: 'Cura 40% de vida y +5 almas.', pts: 0 });
  return out;
}
function applyChoice(c) {
  if (c.kind === 'up') {
    const u = UPG[c.id];
    u.ap(P.b, c.m);
    P.ups[c.id] = (P.ups[c.id] || 0) + 1;
    recalc();
    if (u.heal) heal(u.heal(c.m), true);
    addSchool(u.sch, c.pts);
  } else if (c.kind === 'wnew') {
    P.weapons.push({ id: c.id, lvl: 1, evo: false, t: 0.5 });
    addSchool(c.sch, c.pts);
  } else if (c.kind === 'wup') {
    P.weapons.find(w => w.id === c.id).lvl = c.lv;
    addSchool(c.sch, c.pts);
  } else if (c.kind === 'evo') {
    P.weapons.find(w => w.id === c.id).evo = true;
    banner('★ ' + c.n + ' ★', '¡Arma evolucionada!', 2.5, '#ffb020');
    ring(P.x, P.y, 10, 320, 0.7, '#ffb020', 10);
    addSchool(c.sch, c.pts);
  } else {
    heal(P.s.maxHp * 0.4, true); S.souls += 5;
  }
}

function buildSummary(compact) {
  const s = P.s;
  const rows = [
    ['Daño', pct(s.dmg)], ['Vel. ataque', pct(s.atkSpd)], ['Crítico', pct(Math.min(1, s.crit))], ['Daño crítico', 'x' + num(s.critMult)],
    ['Proyectiles extra', s.proj], ['Perforación', s.pierce], ['Área', pct(s.area)], ['Enfriamientos', '-' + pct(s.cdr)],
    ['Vida máx.', s.maxHp], ['Escudo', s.shieldMax ? s.shieldMax + ' (recarga x' + num(s.shRegen) + ')' : '—'], ['Curación pasiva máx.', num(healCap()) + '/s'], ['Regeneración', num(s.regen) + '/s'], ['Armadura', num(s.armor)], ['Robo de vida', pct(s.lifesteal)],
    ['Esquiva', pct(s.dodge)], ['Velocidad', pct(s.speed)], ['Prob. quemar', pct(Math.min(1, s.burnCh))], ['Ralentizar', pct(s.slow)],
    ['Congelar', pct(s.freezeCh)], ['Rayo en cadena', pct(s.chainCh) + ' · ' + s.chainJumps + ' saltos'], ['Suerte', Math.round(s.luck)], ['Experiencia', pct(s.xp)],
  ];
  let h = '<div class="sum">';
  h += '<div class="col"><h4>Escuelas</h4>';
  for (const k of SCHOOL_KEYS) {
    const v = P.schools[k], SC = SCHOOLS[k];
    if (P.locked[k]) { h += `<div class="schrow locked"><span>🔒 ${SC.n}</span><i></i><b>—</b></div><div class="tier">Sellada por ${SCHOOLS[P.locked[k]].ic} ${SCHOOLS[P.locked[k]].n}</div>`; continue; }
    h += `<div class="schrow" style="--sc:${SC.c}"><span>${SC.ic} ${SC.n}</span><i style="width:${Math.min(100, v / 9 * 100)}%"></i><b>${v}</b></div>`;
    SC.tiers.forEach((t, i) => { if (v >= (i + 1) * 3) h += `<div class="tier">✔ ${['I', 'II', 'III'][i]}: ${t}</div>`; });
  }
  h += '<h4>Sinergias</h4>';
  const act = HYBRIDS.filter(x => P.hyb[x.id]);
  if (!act.length) h += '<div class="tier">Ninguna: llega a 3 puntos en dos escuelas distintas</div>';
  for (const x of act) h += `<div class="tier"><b style="color:#ffb020">${x.ic} ${x.n}</b>: ${x.d}</div>`;
  h += '<h4>Armas</h4>';
  if (!P.weapons.length) h += '<div class="tier">Ninguna todavía</div>';
  for (const w of P.weapons) { const wd = WEAPONS[w.id]; h += `<div class="tier">${wd.ic} ${w.evo ? '<b style="color:#ffb020">★ ' + wd.evo + '</b>' : wd.n} — Nv ${w.lvl}</div>`; }
  h += '</div><div class="col">' + dmgBreakdown() + '</div>';
  if (!compact) {
    h += '<div class="col"><h4>Estadísticas</h4><table>';
    for (const [k, v] of rows) h += `<tr><td>${k}</td><td>${v}</td></tr>`;
    h += '</table></div>';
  }
  return h + '</div>';
}

window.addEventListener('load', () => {
  $('playBtn').onclick = () => UI.play();
  $('altarBtn').onclick = () => { AU.init(); UI.openCustom(); };
  $('treeBtn').onclick = () => { AU.init(); UI.openTree(); };
  $('optsBtn').onclick = () => { AU.init(); UI.openOpts(); };
  $('helpBtn').onclick = () => show('help');
  $('stats').onclick = () => { keys.Tab = false; hide('stats'); };   // en móvil se cierra tocándola
  $('fsBtn').onclick = () => goFullscreenLandscape(true);
  if (TOUCH.on) document.body.classList.add('touch');
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => hide(b.dataset.close));
  $('rerollBtn').onclick = () => UI.reroll();
  $('skipBtn').onclick = () => UI.skip();
  $('resumeBtn').onclick = () => UI.resume();
  $('pOptsBtn').onclick = () => UI.openOpts();
  $('abandonBtn').onclick = () => UI.abandon();
  $('retryBtn').onclick = () => { hide('over'); startRun(UI.cls, UI.start, UI.endless); };
  $('pFsBtn').onclick = () => goFullscreenLandscape(true);
  $('menuBtn').onclick = () => UI.openMenu();
  UI.openMenu();
});
