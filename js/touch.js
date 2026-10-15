'use strict';
// =====================================================================
//  CONTROLES TÁCTILES — doble stick flotante + botones en pantalla.
//  Solo se activan en dispositivos táctiles; en PC no cambia nada.
//   · Pulgar izquierdo (mitad izquierda): mover.
//   · Pulgar derecho (mitad derecha): apuntar y disparar.
//     Si no lo usas, apunta solo al enemigo más cercano.
//   · Botones: Dash, Habilidad, Definitiva, Build y Pausa.
// =====================================================================

const TOUCH = {
  coarse: matchMedia('(pointer: coarse)').matches,
  on: false, mv: null, aim: null, mx: 0, my: 0, aiming: false, aimA: 0,
  btns: {}, lastTouch: 0, safe: { l: 0, r: 0, t: 0, b: 0 }, RS: 60, R: 34,
};
TOUCH.on = TOUCH.coarse || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);

// En el primer arranque en móvil, calidad baja por defecto (el jugador puede cambiarla en Opciones)
if (TOUCH.on && !SAVE.settings.qSet) { SAVE.settings.quality = 'low'; SAVE.settings.qSet = true; persist(); resize(); }

function touchLayout() {
  const cs = getComputedStyle(document.documentElement), f = v => parseFloat(cs.getPropertyValue(v)) || 0;
  const sf = TOUCH.safe; sf.l = f('--sal'); sf.r = f('--sar'); sf.t = f('--sat'); sf.b = f('--sab');
  const R = TOUCH.R = clamp(Math.min(W, H) * 0.085, 26, 46);
  TOUCH.RS = clamp(Math.min(W, H) * 0.14, 44, 80);
  const dx = W - sf.r - R * 1.9, dy = H - sf.b - R * 1.9;
  TOUCH.btns = {
    dash: { x: dx, y: dy, r: R * 1.25, ic: '💨' },
    sec: { x: dx - R * 2.9, y: dy + R * 0.35, r: R, ic: '✴️' },
    ult: { x: dx + R * 0.1, y: dy - R * 2.8, r: R, ic: '⭐' },
    pause: { x: W - sf.r - 26, y: sf.t + 26, r: 20, ic: '⏸' },
    build: { x: W - sf.r - 26, y: sf.t + 74, r: 20, ic: '📜' },
  };
}

function touchButtonAt(x, y) {
  for (const [k, b] of Object.entries(TOUCH.btns)) if ((x - b.x) ** 2 + (y - b.y) ** 2 < (b.r * 1.25) ** 2) return k;
  return null;
}
function touchAction(k) {
  if (k === 'dash') doDash();
  else if (k === 'sec') trySecondary();
  else if (k === 'ult') tryUlt();
  else if (k === 'pause') UI.pause();
  else if (k === 'build') { keys.Tab = true; UI.showStats(); }   // se cierra tocando la ventana
}

function onTouchStart(e) {
  e.preventDefault();
  AU.init();
  TOUCH.on = true; TOUCH.lastTouch = performance.now();
  if (mode !== 'play') return;
  touchLayout();
  for (const t of e.changedTouches) {
    const x = t.clientX, y = t.clientY, b = touchButtonAt(x, y);
    if (b) { TOUCH.btns[b].down = t.identifier; touchAction(b); continue; }
    if (x < W * 0.45 && !TOUCH.mv) TOUCH.mv = { id: t.identifier, ox: x, oy: y, x, y };
    else if (!TOUCH.aim) TOUCH.aim = { id: t.identifier, ox: x, oy: y, x, y };
  }
}
function onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    for (const s of [TOUCH.mv, TOUCH.aim]) {
      if (!s || s.id !== t.identifier) continue;
      s.x = t.clientX; s.y = t.clientY;
      // stick flotante: el origen sigue al dedo si se aleja demasiado
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), M = TOUCH.RS * 1.3;
      if (d > M) { s.ox = s.x - dx / d * M; s.oy = s.y - dy / d * M; }
    }
  }
}
function onTouchEnd(e) {
  e.preventDefault();
  AU.init();   // iOS desbloquea el audio en touchend
  for (const t of e.changedTouches) {
    if (TOUCH.mv && TOUCH.mv.id === t.identifier) TOUCH.mv = null;
    if (TOUCH.aim && TOUCH.aim.id === t.identifier) TOUCH.aim = null;
    for (const b of Object.values(TOUCH.btns)) if (b.down === t.identifier) b.down = undefined;
  }
}
cv.addEventListener('touchstart', onTouchStart, { passive: false });
cv.addEventListener('touchmove', onTouchMove, { passive: false });
cv.addEventListener('touchend', onTouchEnd, { passive: false });
cv.addEventListener('touchcancel', onTouchEnd, { passive: false });
// Si se usa un ratón real (laptop táctil), se vuelve al modo PC
cv.addEventListener('mousemove', () => { if (TOUCH.on && !TOUCH.coarse && performance.now() - TOUCH.lastTouch > 1000) TOUCH.on = false; });

// Lee los sticks una vez por fotograma y los traduce a movimiento, mira y disparo
function touchUpdate() {
  if (!TOUCH.on) return;
  touchLayout();
  TOUCH.mx = TOUCH.my = 0;
  if (TOUCH.mv) {
    let dx = (TOUCH.mv.x - TOUCH.mv.ox) / TOUCH.RS, dy = (TOUCH.mv.y - TOUCH.mv.oy) / TOUCH.RS;
    const l = Math.hypot(dx, dy);
    if (l > 0.15) { if (l > 1) { dx /= l; dy /= l; } TOUCH.mx = dx; TOUCH.my = dy; }
  }
  TOUCH.aiming = false;
  if (TOUCH.aim) {
    const dx = TOUCH.aim.x - TOUCH.aim.ox, dy = TOUCH.aim.y - TOUCH.aim.oy;
    if (Math.hypot(dx, dy) > TOUCH.RS * 0.25) { TOUCH.aiming = true; TOUCH.aimA = Math.atan2(dy, dx); }
  }
  const psx = W / 2 + (P.x - cam.x) * ZOOM, psy = H / 2 + (P.y - cam.y) * ZOOM;
  let target = null;
  const n = TOUCH.aiming ? null : nearest(P.x, P.y, 1, 520)[0];   // auto-apuntado
  if (TOUCH.aiming) target = [psx + Math.cos(TOUCH.aimA) * 220, psy + Math.sin(TOUCH.aimA) * 220];
  else if (n) target = [W / 2 + (n.x - cam.x) * ZOOM, H / 2 + (n.y - cam.y) * ZOOM];
  else if (TOUCH.mx || TOUCH.my) target = [psx + TOUCH.mx * 220, psy + TOUCH.my * 220];
  if (target) { mouse.x = target[0]; mouse.y = target[1]; }
  mouse.l = TOUCH.aiming || !!n;   // dispara al apuntar o si hay un enemigo cerca
}

function touchDraw() {
  if (!TOUCH.on) return;
  const RS = TOUCH.RS, sf = TOUCH.safe;
  const stick = (s, col, hx, hy, label) => {
    const ox = s ? s.ox : hx, oy = s ? s.oy : hy;
    ctx.globalAlpha = s ? 0.9 : 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, RS, 0, TAU); ctx.stroke();
    let kx = ox, ky = oy;
    if (s) { const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), m = Math.min(d, RS); if (d > 0) { kx += dx / d * m; ky += dy / d * m; } }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ky, RS * 0.42, 0, TAU); ctx.fill();
    if (!s) hudText(label, ox, oy + RS + 16, 10, '#ccc', 'center');
    ctx.globalAlpha = 1;
  };
  stick(TOUCH.mv, 'rgba(120,170,255,0.55)', sf.l + RS + 28, H - sf.b - RS - 34, 'MOVER');
  if (TOUCH.aim) stick(TOUCH.aim, 'rgba(255,110,110,0.55)');
  const s = P.s, B = TOUCH.btns;
  const btn = (b, frac, ready, extra) => {
    ctx.fillStyle = b.down !== undefined ? 'rgba(90,50,140,0.75)' : 'rgba(20,12,32,0.6)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    if (frac < 1) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2 + TAU * frac, -Math.PI / 2 + TAU); ctx.fill(); }
    ctx.strokeStyle = ready ? '#ffd43b' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = ready ? 3 : 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    ctx.font = Math.round(b.r * 0.85) + 'px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(b.ic, b.x, b.y + 1); ctx.textBaseline = 'alphabetic';
    if (extra) hudText(extra, b.x, b.y + b.r + 12, 9, '#ddd', 'center');
  };
  btn(B.dash, P.dashCh > 0 ? 1 : P.dashRe / dashCd(), P.dashCh > 0, 'DASH ' + P.dashCh + '/' + s.dashes);
  btn(B.sec, P.secT <= 0 ? 1 : 1 - P.secT / (P.C.sec.cd * (1 - s.cdr)), P.secT <= 0, P.C.sec.n.toUpperCase());
  btn(B.ult, P.ultT > 0 ? 1 : P.ult / 100, P.ult >= 100 && P.ultT <= 0, 'DEFINITIVA');
  btn(B.pause, 1, false); btn(B.build, 1, false);
}

// Orientación: en vertical se pausa y se muestra el aviso (CSS). En Android se intenta bloquear horizontal.
function checkOrientation() {
  if (TOUCH.on && H > W && mode === 'play') UI.pause();
}
window.addEventListener('resize', checkOrientation);
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') UI.pause(); });
function goFullscreenLandscape() {
  if (!TOUCH.on) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { });
  } catch (e) { /* iOS no lo permite: queda el aviso de girar */ }
}

// recalcula el zoom ahora que se sabe si es táctil
resize();
