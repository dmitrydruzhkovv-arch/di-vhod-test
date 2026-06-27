/* Входной тест ОГЭ 8→9 — v2 (ступень 1 воронки, лид-диагностика).
   Бренд-кит урока 3. Режим «молчит»: по ходу НЕ судим (нет верно/неверно, нет звука
   побед/поражений) — интерактив гейми, вердикт только в финальном профиле.
   Механики: собери целое · дуэль · поймай ошибку · лови абсурд · выбор.
   Математику не менять — числа/ответы дословно из ТЗ Методиста. */

'use strict';

const KEYS = ['A', 'B', 'C', 'D'];

/* ── БУМ-ЭФФЕКТ ───────────────────────────────────────────────────────────────
   Тест «молчит»: вердикта по ходу нет. Но на КАЖДУЮ кнопку даём вспышку-ромбы +
   звук «верно» — ученик не палит ошибку до финала, а тапать приятно. */
function lkFlash(el) { if (!el) return; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); }
function playSound(id) {
  const a = document.getElementById(id);
  if (!a) return;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}
function boom() { lkFlash(document.getElementById('lk-fx-ok')); playSound('snd-win'); }

/* ── РЕНДЕР МАТЕМАТИКИ ────────────────────────────────────────────────────── */
function makeFrac(n, d) {
  return `<span class="frac lk-mono"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
}
// **акцент**→.lk-hl · `моно`→.lk-mono · ^(…)→верхний индекс · 7/4→двухэтажная дробь
function fmtInline(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, (_, s) => `<span class="lk-hl">${s}</span>`)
    .replace(/`([^`]+)`/g, (_, s) => `<span class="lk-mono">${s}</span>`)
    .replace(/\^\(([^)]+)\)/g, (_, s) => `<sup>${s}</sup>`)
    .replace(/(\d+)\/(\d+)/g, (_, n, d) => makeFrac(n, d));
}
function fracTex([n, d]) { return makeFrac(n, d); }
// крупная двухэтажная дробь для примера (числитель/знаменатель — любой текст со степенями/корнями)
function bigFrac(num, den) {
  return `<span class="frac frac-lg lk-mono"><span class="fn">${fmtInline(num)}</span><span class="fd">${fmtInline(den)}</span></span>`;
}
// числовой ввод ученика: «1,5» / «1.5» / «4» → число; мусор → null
function parseNum(s) {
  s = String(s).trim().replace(',', '.').replace(/\s+/g, '');
  if (s === '') return null;
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}
function formatNum(x) { return String(x).replace('.', ','); }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function fracSum(list) {
  let n = 0, d = 1;
  for (const [a, b] of list) { n = n * b + a * d; d = d * b; }
  const g = gcd(n, d); return [n / g, d / g];
}

/* ── СОСТОЯНИЕ ────────────────────────────────────────────────────────────── */
let DATA = null;
let idx = 0;
const answers = {};      // id -> { ok, diag, station, kind, reflect? }
let current = null;      // { getResult(): {ok, diag} } активной механики

const screen = () => document.getElementById('screen');

/* ── ЗАГРУЗКА ─────────────────────────────────────────────────────────────── */
fetch('data.json?v=7')
  .then(r => r.json())
  .then(d => { DATA = d; render(); })
  .catch(() => { screen().innerHTML = '<p style="color:var(--lk-bad);padding:20px">Ошибка загрузки. Обнови страницу.</p>'; });

/* ── РЕНДЕР КАРТОЧКИ ──────────────────────────────────────────────────────── */
function render() {
  if (idx >= DATA.tasks.length) return showProfile();
  const t = DATA.tasks[idx];
  const n = DATA.tasks.length;

  document.getElementById('prog-label').textContent = `${idx + 1} из ${n}`;
  document.getElementById('prog-fill').style.width = `${(idx / n) * 100}%`;

  const figCls = t.id === 'q7b' ? 'qfig wide' : 'qfig';
  const fig = t.image ? `<div class="${figCls}"><img src="${t.image}" alt="чертёж к задаче"></div>` : '';

  screen().innerHTML = `
    <div class="task-card lk-card" id="card">
      <div class="task-head">
        <span class="task-label">${t.station} · <span class="og">${t.og} ОГЭ</span></span>
      </div>
      <p class="cond">${fmtInline(t.cond)}</p>
      ${fig}
      <div class="task-body" id="body"></div>
      <div id="reflectSlot"></div>
      <button class="lk-btn next-btn" id="next" disabled>${idx < n - 1 ? 'Дальше →' : 'Показать карту ✨'}</button>
    </div>`;
  window.scrollTo(0, 0);

  const body = document.getElementById('body');
  const next = document.getElementById('next');
  const enable = () => { next.disabled = false; };

  current = MECH[t.mechanic](t, body, enable);

  next.addEventListener('click', () => {
    const res = current.getResult();
    const r = document.getElementById('reflectInput');
    answers[t.id] = { ok: res.ok, diag: res.ok ? null : res.diag, station: t.station, kind: t.kind, pick: res.pick };
    if (r) answers[t.id].reflect = r.value.trim();
    idx++;
    render();
  });
}

// поле-объяснялка (reflect): ученик формулирует словами; молча сохраняем для Ди
function showReflect(t) {
  const slot = document.getElementById('reflectSlot');
  if (!slot || !t.reflect) return;
  slot.innerHTML = `
    <div class="reflect">
      <div class="rh">🖊 ${t.reflect.prompt}</div>
      <div class="rs">${fmtInline(t.reflect.starter)}</div>
      <input id="reflectInput" type="text" autocomplete="off" placeholder="${t.reflect.placeholder || ''}">
    </div>`;
}

/* ── МЕХАНИКИ ─────────────────────────────────────────────────────────────── */
const MECH = {

  // ВЫБОР: 4 карточки-кнопки, шаффл, нейтральная подсветка выбора.
  // keysOnly → только буквы A B C D сеткой 2×2 (варианты — на картинке-чертеже).
  choice(t, body, enable) {
    // при keysOnly буквы — это сами варианты, шаффлить нельзя (иначе разъедутся с картинкой)
    const shown = t.keysOnly ? t.options.map((o, i) => ({ ...o, _i: i }))
                             : shuffle(t.options.map((o, i) => ({ ...o, _i: i })));
    const cls = t.keysOnly ? 'opts abcd' : 'opts';
    body.innerHTML = `<div class="${cls}">${shown.map((o, i) =>
      t.keysOnly
        ? `<button class="opt" data-i="${i}"><span class="opt-key">${o.key}</span></button>`
        : `<button class="opt" data-i="${i}"><span class="opt-key">${KEYS[i]}</span><span>${fmtInline(o.text)}</span></button>`
    ).join('')}</div>`;
    let pick = null;
    body.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
      pick = shown[+btn.dataset.i];
      body.querySelectorAll('.opt').forEach(b => b.classList.remove('is-pick'));
      btn.classList.add('is-pick');
      boom();
      enable();
    }));
    return { getResult: () => {
      const ok = pick && pick.key === t.correct;
      return { ok: !!ok, diag: ok ? null : (t.traps && pick ? t.traps[pick.key] : null),
               pick: pick ? pick.key : null };
    }};
  },

  // ВПИШИ ОТВЕТ: свободный числовой ввод (без вариантов) — проверяем реальный счёт.
  input(t, body, enable) {
    body.innerHTML = `
      <div class="inp-expr">${bigFrac(t.expr.num, t.expr.den)}</div>
      <div class="inp-row">
        <input class="inp-field" id="inpField" type="text" inputmode="decimal" autocomplete="off" placeholder="ответ">
      </div>`;
    const field = body.querySelector('#inpField');
    let boomed = false;
    field.addEventListener('input', () => {
      if (field.value.trim()) { if (!boomed) { boom(); boomed = true; } enable(); }
    });
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('next').click(); }
    });
    return { getResult: () => {
      const v = parseNum(field.value);
      const ok = v !== null && Math.abs(v - t.answer) < 1e-9;
      return { ok, diag: ok ? null : t.diag, pick: field.value.trim() };
    }};
  },

  // ДУЭЛЬ: две крупные карты, тапни большую. Сторона = обыкновенная дробь [n,d]
  // ИЛИ десятичная/текст через leftText/rightText (тогда рисуем как есть).
  duel(t, body, enable) {
    const face = (side) => t[side + 'Text'] !== undefined ? fmtInline(t[side + 'Text']) : fracTex(t[side]);
    body.innerHTML = `
      <div class="duel">
        <div class="duel-card" data-side="left">${face('left')}</div>
        <div class="duel-vs">или</div>
        <div class="duel-card" data-side="right">${face('right')}</div>
      </div>`;
    let pick = null;
    body.querySelectorAll('.duel-card').forEach(card => card.addEventListener('click', () => {
      pick = card.dataset.side;
      body.querySelectorAll('.duel-card').forEach(c => c.classList.remove('is-pick'));
      card.classList.add('is-pick');
      boom();
      enable();
    }));
    return { getResult: () => ({ ok: pick === t.correctSide, diag: pick === t.correctSide ? null : t.diag, pick }) };
  },

  // ПОЙМАЙ ОШИБКУ: шаги-кнопки + «ошибок нет»; после выбора — reflect
  catch_step(t, body, enable) {
    const rows = t.steps.map((s, i) =>
      `<div class="cs-step" data-i="${i}"><span class="cs-num">${i + 1}</span><span>${fmtInline(s)}</span></div>`).join('');
    const noerr = t.noError ? `<div class="cs-step cs-noerr" data-i="none"><span>Ошибок нет</span></div>` : '';
    body.innerHTML = `<div class="cs-steps">${rows}${noerr}</div>`;
    let pick = null;
    body.querySelectorAll('.cs-step').forEach(row => row.addEventListener('click', () => {
      pick = row.dataset.i;
      body.querySelectorAll('.cs-step').forEach(r => r.classList.remove('is-pick'));
      row.classList.add('is-pick');
      showReflect(t);
      boom();
      enable();
    }));
    return { getResult: () => {
      const ok = pick !== null && pick !== 'none' && +pick === t.correctStep;
      return { ok, diag: ok ? null : t.diag, pick };
    }};
  },

  // ЛОВИ АБСУРД: чипы-суммы, мульти-выбор «что не может быть налогом»
  catch_absurd(t, body, enable) {
    body.innerHTML = `<div class="chips">${t.chips.map((c, i) =>
      `<div class="chip" data-i="${i}">${fmtInline(c.v)}</div>`).join('')}</div>`;
    const picked = new Set();
    body.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
      const i = +chip.dataset.i;
      if (picked.has(i)) { picked.delete(i); chip.classList.remove('is-pick'); }
      else { picked.add(i); chip.classList.add('is-pick'); boom(); }
      enable();
    }));
    return { getResult: () => {
      const ok = t.chips.every((c, i) => c.absurd === picked.has(i));
      return { ok, diag: ok ? null : t.diag, pick: [...picked] };
    }};
  },

  // СОБЕРИ ЦЕЛОЕ: полоса-картинка с пресетом (доли уже лежат) + пустой слот до целого.
  // Шкала сама не интерактивна — ДОБИРАЕШЬ доли по одной (можно несколько и повторно):
  // каждая ложится встык за предыдущей. Ровно до линии → снап+глоу, мало → слот виден,
  // много → красный «нахлёст» за линией. «↶ убрать» снимает последнюю.
  collect_one(t, body, enable) {
    const SCALE = 0.82;   // целое (=1) занимает 82% дорожки; справа — зона нахлёста
    let added = [];       // индексы добавленных плиток по порядку (повторы разрешены)
    body.innerHTML = `
      <div class="co-wrap">
        <div class="co-bar" id="co-bar"></div>
        <div class="co-target" id="co-target"></div>
      </div>
      <div class="co-hint">добавляй доли по одной, пока не заполнишь полосу ровно до целого</div>
      <div class="co-tiles">${t.tiles.map((f, i) =>
        `<div class="co-tile" data-i="${i}">+ ${fracTex(f)}</div>`).join('')}
        <div class="co-tile co-undo" id="co-undo">↶ убрать</div></div>`;
    const bar = body.querySelector('#co-bar');
    body.querySelector('#co-target').style.left = `${SCALE * 100}%`;
    const presetTotal = t.preset.reduce((s, f) => s + f[0] / f[1], 0);

    function seg(leftU, widthU, cls, label) {
      if (widthU <= 1e-9) return;
      const el = document.createElement('div');
      el.className = `co-seg ${cls}`;
      el.style.left = `${leftU * SCALE * 100}%`;
      el.style.width = `${widthU * SCALE * 100}%`;
      if (label) el.innerHTML = label;
      bar.appendChild(el);
    }
    function draw() {
      bar.innerHTML = '';
      bar.classList.remove('is-full');
      let acc = 0;
      t.preset.forEach(f => { seg(acc, f[0] / f[1], 'preset', makeFrac(f[0], f[1])); acc += f[0] / f[1]; });
      let total = presetTotal;
      added.forEach(i => {                       // каждая добранная доля — встык за предыдущей
        const f = t.tiles[i], v = f[0] / f[1];
        seg(total, Math.min(total + v, 1) - total, 'added', makeFrac(f[0], f[1]));
        total += v;
      });
      if (total > 1 + 1e-9) seg(1, total - 1, 'over', null);
      if (added.length && Math.abs(total - 1) < 1e-9) bar.classList.add('is-full');
      if (total < 1 - 1e-9) {   // ещё не дотянули — показываем пустой слот до линии целого
        const slot = document.createElement('div');
        slot.className = 'co-slot';
        slot.style.left = `${total * SCALE * 100}%`;
        slot.style.right = `${(1 - SCALE) * 100}%`;
        bar.appendChild(slot);
      }
    }
    body.querySelectorAll('.co-tile[data-i]').forEach(tile => tile.addEventListener('click', () => {
      added.push(+tile.dataset.i);
      draw();
      boom();
      enable();
    }));
    body.querySelector('#co-undo').addEventListener('click', () => {
      if (!added.length) return;
      added.pop();
      draw();
      enable();
    });
    draw();
    return { getResult: () => {
      const chosen = added.map(i => t.tiles[i]);
      const [n, d] = fracSum(t.preset.concat(chosen));
      return { ok: n === d, diag: n === d ? null : t.diag, pick: added.slice() };
    }};
  }
};

/* ── РАЗБОР ОДНОГО ЗАДАНИЯ (раскрывается на карте по тапу станции) ──────────── */
function rvRow(inner, isCorrect, isPicked) {
  const cls = isCorrect ? 'ok' : (isPicked ? 'bad' : '');
  const mk = isCorrect ? '✅' : (isPicked ? '✖' : '·');
  const tag = (isCorrect && isPicked) ? 'твой · верно'
            : isCorrect ? 'правильный'
            : isPicked ? 'твой выбор' : '';
  return `<div class="rv-opt ${cls}"><span class="mk">${mk}</span><span>${inner}</span>${tag ? `<span class="rv-tag">${tag}</span>` : ''}</div>`;
}

function renderReview(t) {
  const a = answers[t.id] || {};
  const pick = a.pick;
  let list = '', note = '';

  if (t.mechanic === 'choice') {
    list = t.options.map(o => rvRow(
      `<span class="opt-key" style="margin-right:8px">${o.key}</span>${fmtInline(o.text)}`,
      o.key === t.correct, pick === o.key)).join('');

  } else if (t.mechanic === 'duel') {
    list = ['left', 'right'].map(side => rvRow(
      t[side + 'Text'] !== undefined ? fmtInline(t[side + 'Text']) : fracTex(t[side]),
      side === t.correctSide, pick === side)).join('');

  } else if (t.mechanic === 'input') {
    const ans = (pick || '').trim();
    const right = !!a.ok;
    const yourRow = `<div class="rv-opt ${right ? 'ok' : (ans ? 'bad' : '')}"><span class="mk">${right ? '✅' : (ans ? '✖' : '·')}</span><span>Твой ответ: <b>${ans || '—'}</b></span><span class="rv-tag">${right ? 'верно' : 'твой ответ'}</span></div>`;
    const rightRow = right ? '' : `<div class="rv-opt ok"><span class="mk">✅</span><span>Верный ответ: <b>${formatNum(t.answer)}</b></span><span class="rv-tag">правильный</span></div>`;
    list = `<div class="inp-expr" style="margin:2px 0 13px">${bigFrac(t.expr.num, t.expr.den)}</div>${yourRow}${rightRow}`;

  } else if (t.mechanic === 'catch_step') {
    list = t.steps.map((s, i) => rvRow(
      `<span style="opacity:.7;margin-right:6px">${i + 1})</span>${fmtInline(s)}`,
      i === t.correctStep, String(pick) === String(i))).join('');
    if (t.noError) list += rvRow('Ошибок нет', false, pick === 'none');
    if (a.reflect) note = `<p class="rv-note">🖊 Своими словами: <b>${a.reflect}</b></p>`;

  } else if (t.mechanic === 'catch_absurd') {
    const picked = Array.isArray(pick) ? new Set(pick) : new Set();
    list = t.chips.map((c, i) => {
      const correct = c.absurd === picked.has(i);
      const tags = [];
      if (c.absurd) tags.push('ловушка');
      if (picked.has(i)) tags.push('ты поймал');
      const mk = correct ? '✅' : '✖';
      return `<div class="rv-opt ${correct ? 'ok' : 'bad'}"><span class="mk">${mk}</span><span>${fmtInline(c.v)}</span>${tags.length ? `<span class="rv-tag">${tags.join(' · ')}</span>` : ''}</div>`;
    }).join('');
    note = `<p class="rv-note">Поймать нужно было «ловушки» — суммы, что точно не могут быть налогом.</p>`;

  } else if (t.mechanic === 'collect_one') {
    const pickedArr = Array.isArray(pick) ? pick : [];
    list = t.tiles.map((f, i) => {
      const cnt = pickedArr.filter(x => x === i).length;
      const on = cnt > 0;
      return `<div class="rv-opt ${on ? 'pick' : ''}"><span class="mk">${on ? '👆' : '·'}</span><span>+ ${fracTex(f)}</span>${on ? `<span class="rv-tag">ты добавил${cnt > 1 ? ` ×${cnt}` : ''}</span>` : ''}</div>`;
    }).join('');
    const chosen = pickedArr.map(i => t.tiles[i]);
    const [n, d] = fracSum(t.preset.concat(chosen));
    note = `<p class="rv-note">Нужно собрать ровно <b>целое (1)</b>. Ты набрал: <b>${makeFrac(n, d)}</b> — ${n === d ? '✅ в точку.' : '❌ не целое.'}</p>`;
  }

  const okBadge = a.ok ? '✅ верно' : '❌ мимо';
  return `
    <div class="rv-card">
      <p class="rv-q">${fmtInline(t.cond)} <span class="rv-tag">${okBadge}</span></p>
      ${t.image ? `<div class="qfig${t.id === 'q7b' ? ' wide' : ''}" style="margin-bottom:12px"><img src="${t.image}" alt="чертёж"></div>` : ''}
      <div class="rv-list">${list}</div>
      ${note}
    </div>`;
}

/* ── ПРОФИЛЬ (итог, не балл) ──────────────────────────────────────────────── */
function showProfile() {
  document.getElementById('hw-header').hidden = true;
  screen().hidden = true;

  const tasks = DATA.tasks, n = tasks.length, stations = DATA.stationsOrder;
  const isOk = id => !!(answers[id] && answers[id].ok);

  // Слой 1 — карта станций
  const byStation = {};
  tasks.forEach(t => { (byStation[t.station] = byStation[t.station] || []).push(isOk(t.id)); });
  const status = {};
  stations.forEach(s => {
    const a = byStation[s] || []; const c = a.filter(Boolean).length;
    status[s] = a.length === 0 ? 'warn' : (c === a.length ? 'ok' : (c === 0 ? 'gap' : 'warn'));
  });

  // Слой 2 — диагнозы (станция отдельно от текста — спокойный ярлык в карточке B)
  const diags = [];
  tasks.forEach(t => { const a = answers[t.id]; if (a && !a.ok && a.diag) diags.push({ st: t.station, diag: a.diag }); });

  // Слой 3 — чувство vs техника · Слой 4 — потолок (первая не-крепкая станция)
  const senseMiss = tasks.filter(t => t.kind === 'sense' && !isOk(t.id)).length;
  const techMiss = tasks.filter(t => t.kind === 'tech' && !isOk(t.id)).length;
  const ci = stations.findIndex(s => status[s] !== 'ok');
  const strong = stations.filter(s => status[s] === 'ok');
  const total = tasks.filter(t => isOk(t.id)).length;

  // Карточка A — связный вердикт ОДНИМ абзацем (крепкие + потолок + чувство/техника).
  // Логика ветвления сохранена, просто склеена в текст, а не разбита на три карточки.
  const vParts = [];
  if (strong.length) vParts.push(`Фундамент держишь — ${strong.join(', ')} ${strong.length > 1 ? 'идут' : 'идёт'} уверенно.`);
  if (ci === -1) vParts.push('Пробелов на входе не вижу — чисто по всей карте.');
  else if (ci === 0) vParts.push('Первая трещина — уже в числах и дробях, это корень.');
  else vParts.push(`Первая трещина — в теме «${stations[ci]}».`);
  if (senseMiss === 0 && techMiss === 0) vParts.push('Берём темп повыше и целимся в верхние баллы ОГЭ. 🔥');
  else if (senseMiss === 0 && techMiss > 0) vParts.push('Число чувствуешь, дальше техника местами сыпется — это шлифуется под формат ОГЭ.');
  else if (techMiss === 0 && senseMiss > 0) vParts.push('Считаешь по правилам, но размер ответа чувствуешь не всегда — это быстро ставится.');
  else vParts.push('Начнём со смысла и прикидки, дальше техника — и баллы перестанут утекать на ровном месте.');
  const verdictPara = vParts.join(' ');

  // карта станций: строка кликабельна → раскрывает разбор заданий темы
  const tasksByStation = {};
  tasks.forEach(t => { (tasksByStation[t.station] = tasksByStation[t.station] || []).push(t); });
  const mapHtml = stations.map((s, si) => `
    <div class="pf-theme tap" data-st="${si}">
      <span class="dot ${status[s]}"></span>
      <span class="nm">${s}</span>
      <span class="st">${status[s] === 'ok' ? 'крепко' : status[s] === 'warn' ? 'шатко' : 'пробел'}</span>
      <span class="caret">▸</span>
    </div>
    <div class="pf-rev" data-rev="${si}">${(tasksByStation[s] || []).map(renderReview).join('')}</div>`).join('');

  // Карточка B — «Что закрываем летом» (пик экрана): диагнозы без дублей карты.
  const shownDiags = diags.slice(0, 4);
  const summerHtml = shownDiags.length ? `
    <div class="lk-card pf-card">
      <b>Что закрываем летом</b>
      <ul class="pf-diag">${shownDiags.map(d => `<li><span><span class="pf-st">${d.st}</span> — ${d.diag}</span></li>`).join('')}</ul>
      ${diags.length > shownDiags.length ? `<div class="pf-note" style="text-align:left;margin:8px 0 0">…и пара мелочей — разберём на пробном.</div>` : ''}
      <div class="pf-close">Это закрывается за лето, по шагам.</div>
    </div>` : `
    <div class="lk-card pf-card">
      <b>Что дальше</b>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.5">Явных дыр на входе нет — на пробном берём темп выше и целимся в верхние баллы.</p>
    </div>`;

  const pf = document.getElementById('profile');
  pf.innerHTML = `
    <div class="lk-kicker" style="margin-bottom:10px">Твоя карта · ${total} из ${n}</div>
    <h1 class="lk-h1 lk-glow" style="margin:0 0 14px">Вот где ты сейчас</h1>
    <div class="pf-legend">
      <span><span class="dot ok"></span>крепко</span>
      <span><span class="dot warn"></span>шатко</span>
      <span><span class="dot gap"></span>пробел</span>
    </div>
    <div class="pf-map">${mapHtml}</div>
    <div class="lk-card pf-card">${verdictPara}</div>
    ${summerHtml}
    <button class="lk-btn cta-btn" id="cta">${DATA.cta.label}</button>
    ${DATA.cta.note ? `<div class="pf-note" style="margin-top:10px">${DATA.cta.note}</div>` : ''}
    <div class="pf-note">Тест ничего не сохраняет на сервер — это только твоя картинка уровня.</div>
    <div class="lk-sign" style="margin-top:22px;justify-content:center">
      <span class="lk-badge lk-badge-l">Λ</span>
      <span class="lk-badge lk-badge-d"><span>D<span class="lk-dot">.</span></span></span>
    </div>
    <div style="height:28px"></div>`;
  pf.classList.add('show');
  window.scrollTo(0, 0);

  // раскрытие разбора по тапу на станцию (можно открыть хоть все)
  pf.querySelectorAll('.pf-theme.tap').forEach(row => row.addEventListener('click', () => {
    const rev = pf.querySelector(`.pf-rev[data-rev="${row.dataset.st}"]`);
    row.classList.toggle('open');
    if (rev) rev.classList.toggle('open');
  }));

  document.getElementById('cta').addEventListener('click', () => window.open(DATA.cta.url, '_blank'));
}
