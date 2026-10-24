// Интерфейс: страница преподавателя (вход, запуски, карта прохождений) и экран ребёнка.
// Ссылка вида ...?s=КОД (или #s-КОД) открывает экран ребёнка, без кода открывается страница преподавателя.
(function () {
  'use strict';
  var B = null;

  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'on') for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function plural(n, a, b, c) {
    var m = n % 100, k = n % 10;
    if (m > 10 && m < 20) return c;
    if (k === 1) return a;
    if (k > 1 && k < 5) return b;
    return c;
  }
  var fmt = EulerGame.fmt;
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var ORD = ['Первое', 'Второе', 'Третье', 'Четвёртое', 'Пятое', 'Шестое'];
  var INTRO = {
    euler: 'Нужно пройти по всем линиям фигуры по одному разу, не отрывая палец или мышку.',
    matrix: 'Посмотри на картинки наверху и найди закономерность. Внизу выбери картинку, которая подходит вместо знака вопроса, и нажми «Ответить».',
    cubes: 'Наверху будет развёртка кубика, а внизу три кубика. Представь, что развёртку сложили. Выбери кубик, который получится, и нажми «Ответить».',
    parts: 'Наверху будет фигура, а внизу шесть частей. Найди три части, из которых можно сложить эту фигуру. Отметь три картинки и нажми «Ответить».'
  };
  function store(kind) {
    try { var s = window[kind]; var t = '__t'; s.setItem(t, t); s.removeItem(t); return s; } catch (e) { return null; }
  }
  function sget(s, k) { try { return s ? JSON.parse(s.getItem(k)) : null; } catch (e) { return null; } }
  function sset(s, k, v) { try { if (s) { if (v === null) s.removeItem(k); else s.setItem(k, JSON.stringify(v)); } } catch (e) {} }

  /* ---------- тесты линейки ---------- */
  function testById(id) { return TESTS.filter(function (t) { return t.id === id; })[0]; }
  // Запуски, созданные до появления второго теста, не хранят список: считаем, что в них все тесты.
  function sessionTests(opts) {
    var ids = (opts && opts.tests) || TESTS.map(function (t) { return t.id; });
    return ids.map(testById).filter(Boolean);
  }
  function evTest(d) { return (d && d.test) || 'euler'; }
  function list(v) { return [].concat(v === undefined || v === null ? [] : v); }
  function nums(v) { return list(v).join(', '); }
  // Подписи вариантов как в исходнике (у кубиков a, b, c), иначе номера.
  function lab(T, n) { return T && T.labels ? T.labels[n - 1] || n : n; }
  function numsT(T, v) { return list(v).map(function (n) { return lab(T, n); }).join(', '); }

  // Возраст на дату: полных лет и месяцев.
  function ageAt(birth, at) {
    if (!birth) return null;
    var b = new Date(birth + 'T00:00:00'), d = at ? new Date(at) : new Date();
    if (isNaN(b)) return null;
    var m = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
    if (d.getDate() < b.getDate()) m--;
    if (m < 0) return null;
    return { y: Math.floor(m / 12), m: m % 12 };
  }
  function ageText(a) {
    if (!a) return '';
    return a.y + ' ' + plural(a.y, 'год', 'года', 'лет') + (a.m ? ' ' + a.m + ' мес.' : '');
  }
  function ageCode(a) { return a ? a.y + ';' + a.m : ''; }
  function birthText(s) {
    if (!s) return '';
    var p = s.split('-');
    return (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0];
  }
  function clock(iso) {
    var d = new Date(iso);
    function z(x) { return (x < 10 ? '0' : '') + x; }
    return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
  }
  function dateText(iso) {
    var d = new Date(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + clock(iso).slice(0, 5);
  }
  function show(id) {
    ['boot', 'tAuth', 'tHome', 'tSession', 'kidPage'].forEach(function (s) { $(s).hidden = s !== id; });
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function columns(opts) {
    var cols = [];
    sessionTests(opts).forEach(function (T) {
      if (T.kind === 'euler') {
        if (opts.train !== false) T.train.forEach(function (p, i) {
          cols.push({ test: T, key: T.id + ':t' + (i + 1), block: 'train', n: i + 1, short: 'Об. ' + (i + 1), name: p.file, sub: p.E.length + ' лин.', probe: p });
        });
        T.probes.forEach(function (p, i) {
          cols.push({ test: T, key: T.id + ':m' + (i + 1), block: 'main', n: i + 1, short: 'П' + (i + 1), name: p.file, sub: p.E.length + ' лин.', probe: p });
        });
      } else {
        T.probes.forEach(function (p, i) {
          cols.push({ test: T, key: T.id + ':m' + (i + 1), block: 'main', n: i + 1, short: 'Зад. ' + (i + 1), name: 'Задание ' + (i + 1), sub: (list(p.answer).length > 1 ? 'ответы ' : 'ответ ') + list(p.answer).map(function (n) { return lab(T, n); }).join(','), probe: p });
        });
      }
      cols.push({ test: T, key: T.id + ':total', total: true });
    });
    return cols;
  }
  function keyOf(d) { return evTest(d) + ':' + (d.block === 'train' ? 't' : 'm') + d.n; }
  function probeName(d) {
    var T = testById(evTest(d));
    if (T && T.kind === 'choice') return 'задание ' + d.n;
    return d.block === 'train' ? 'обучающая проба ' + d.n : 'проба ' + d.n;
  }
  function ordinal(n) { return n + '-й'; }
  function sessionUrl(code) {
    var pub = (window.APP_CONFIG || {}).PUBLIC_URL;
    if (pub) return pub.split('#')[0] + '#s-' + code;
    var base = location.href.split('#')[0].split('?')[0];
    return base + '?s=' + code;
  }
  function copyText(text, input, msgEl, okText, onFail) {
    function manual() {
      if (onFail) onFail();
      if (input) { input.focus(); input.select(); }
      if (msgEl) msgEl.textContent = 'Выделено. Нажмите Ctrl+C (на телефоне — «Копировать»).';
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { if (msgEl) msgEl.textContent = okText || 'Скопировано.'; }, manual);
      } else manual();
    } catch (e) { manual(); }
  }
  var CHECK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25l9 9 16-19"/></svg>';

  /* ======================= Экран ребёнка ======================= */
  // KidApp работает внутри любого контейнера: на отдельной странице по ссылке
  // и в панели проверки у преподавателя.
  // Этапы: r1 — проходит тесты по порядку; results — видит свои результаты (по разрешению преподавателя);
  // r2 — второй этап: может открыть любое задание любого теста и решить его ещё раз.
  function isOk(T, d) { return T.kind === 'choice' ? !!d.correct : d.status === 'done'; }
  function roundOf(d) { return d && d.round === 2 ? 2 : 1; }

  function KidApp(box, code, persist) {
    var kid = B.kid(), game = null, session = null, stage = 'r1', mine = [], pin = '';
    var mode = 'start';   // start | r1 | after | item
    var key = 'eg-kid:' + code;
    box.classList.add('kid');
    kid.onStage(function (st) { stage = st; if (mode === 'after') afterRound1(); });

    function tests() { return sessionTests(session.opts); }
    function screen(nodes) {
      if (game) { game.destroy(); game = null; }
      clear(box); nodes.forEach(function (n) { if (n) box.appendChild(n); });
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    function log(kind, data) { mine.push({ kind: kind, data: data }); kid.log(kind, data); }
    function errorScreen(text, retry) {
      screen([h('section', { class: 'kid-card' }, [
        h('h1', { text: 'Не получилось войти' }),
        h('p', { class: 'lead', text: text }),
        retry ? h('button', { class: 'btn secondary', type: 'button', text: 'Попробовать ещё раз', on: { click: retry } }) : null
      ])]);
    }
    // Полоска «Тест 1 из 4» над заданиями: видно, где ребёнок, но переключаться нельзя.
    function testBar(ti) {
      var ts = tests();
      var steps = h('ol', { class: 'kb-steps', 'aria-hidden': 'true' });
      ts.forEach(function (T, i) {
        steps.appendChild(h('li', { 'data-s': i < ti ? 'done' : i === ti ? 'current' : '' }, [h('span', { text: String(i + 1) }), h('em', { text: T.title })]));
      });
      return h('div', { class: 'kid-bar' }, [
        h('p', { class: 'kb-now' }, [h('b', { text: 'Тест ' + (ti + 1) + ' из ' + ts.length }), ' · ' + ts[ti].title]),
        steps,
        pinNote()
      ]);
    }

    function pinNote() {
      return pin ? h('p', { class: 'kb-pin', title: 'Если страница закроется, открой ссылку снова и введи этот номер' }, ['Твой номер: ', h('b', { text: pin })]) : null;
    }
    function joinScreen() {
      var now = new Date().getFullYear();
      var day = h('select', { id: 'kDay-' + code, 'aria-label': 'День' }, [h('option', { value: '', text: 'День' })]);
      for (var d = 1; d <= 31; d++) day.appendChild(h('option', { value: d, text: d }));
      var mon = h('select', { id: 'kMon-' + code, 'aria-label': 'Месяц' }, [h('option', { value: '', text: 'Месяц' })]);
      MONTHS.forEach(function (m, i) { mon.appendChild(h('option', { value: i + 1, text: m })); });
      var yr = h('select', { id: 'kYear-' + code, 'aria-label': 'Год' }, [h('option', { value: '', text: 'Год' })]);
      for (var y = now - 3; y >= now - 18; y--) yr.appendChild(h('option', { value: y, text: y }));
      var name = h('input', { id: 'kName-' + code, type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Например, Маша' });
      var err = h('p', { class: 'form-err', role: 'alert' });
      var btn = h('button', { class: 'btn primary big', type: 'submit', text: 'Начать' });
      var form = h('form', { class: 'kid-form', novalidate: true }, [
        h('div', { class: 'field' }, [h('label', { for: name.id, text: 'Как тебя зовут?' }), name]),
        h('fieldset', { class: 'field' }, [h('legend', { text: 'Дата рождения' }), h('div', { class: 'dob' }, [day, mon, yr])]),
        err, btn
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var n = name.value.replace(/\s+/g, ' ').trim();
        err.textContent = '';
        if (!n) { err.textContent = 'Напиши своё имя.'; name.focus(); return; }
        if (!day.value || !mon.value || !yr.value) { err.textContent = 'Выбери день, месяц и год рождения.'; return; }
        var dt = new Date(+yr.value, +mon.value - 1, +day.value);
        if (dt.getMonth() !== +mon.value - 1) { err.textContent = 'Такого дня в этом месяце нет. Проверь дату.'; return; }
        var birth = yr.value + '-' + ('0' + mon.value).slice(-2) + '-' + ('0' + day.value).slice(-2);
        btn.disabled = true; btn.textContent = 'Входим…';
        kid.join(code, n, birth).then(function (r) {
          if (persist) sset(persist, key, { pid: r.pid, token: r.token, name: n });
          stage = 'r1'; pin = r.pin || '';
          var first = tests()[0];
          runTest(0, { block: first.kind === 'euler' && session.opts.train !== false ? 'train' : 'main', n: 1 });
        }, function (e) {
          btn.disabled = false; btn.textContent = 'Начать';
          err.textContent = e.message;
        });
      });
      // Вернуться по номеру, если ребёнок уже начинал, а страница закрылась.
      var pinIn = h('input', { id: 'kPin-' + code, type: 'text', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', placeholder: '0000' });
      var pinErr = h('p', { class: 'form-err', role: 'alert' });
      var pinBtn = h('button', { class: 'btn secondary', type: 'submit', text: 'Продолжить' });
      var back = h('form', { class: 'kid-back', novalidate: true }, [
        h('label', { for: pinIn.id, text: 'Уже начинал(а)? Введи свой номер из 4 цифр' }),
        h('div', { class: 'row' }, [pinIn, pinBtn]), pinErr
      ]);
      back.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = pinIn.value.replace(/\D/g, '');
        pinErr.textContent = '';
        if (v.length !== 4) { pinErr.textContent = 'Номер состоит из 4 цифр.'; pinIn.focus(); return; }
        pinBtn.disabled = true;
        kid.rejoin(code, v).then(function (r) {
          if (persist) sset(persist, key, { pid: r.pid, token: r.token });
          resumeWith(r.pid, r.token);
        }, function (e) { pinBtn.disabled = false; pinErr.textContent = e.message; });
      });
      screen([h('section', { class: 'kid-card' }, [
        h('p', { class: 'badge', text: session.title || 'Групповое тестирование' }),
        h('h1', { text: 'Привет!' }),
        h('p', { class: 'lead', text: 'Напиши своё имя и выбери дату рождения. Если нужно, попроси взрослого помочь.' }),
        form, back
      ])]);
      setTimeout(function () { try { name.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }

    // Экран между тестами: короткое объяснение следующего теста.
    function betweenScreen(ti) {
      mode = 'r1';
      var T = tests()[ti];
      var go = h('button', { class: 'btn primary big', type: 'button', text: 'Дальше' });
      go.addEventListener('click', function () { runTest(ti, { block: 'main', n: 1 }); });
      screen([testBar(ti), h('section', { class: 'kid-card' }, [
        h('p', { class: 'badge', text: 'Тест ' + (ti + 1) + ' из ' + tests().length }),
        h('h1', { text: 'Молодец! Теперь новое задание' }),
        h('p', { class: 'lead', text: INTRO[T.id] || '' }),
        h('div', { class: 'actions' }, [go])
      ])]);
    }

    function mountEngine(root, T, opts) {
      if (T.kind === 'euler') {
        return EulerGame.mount(root, {
          train: opts.train || [], probes: T.probes,
          showTime: session.opts.showTime !== false, sound: session.opts.sound !== false,
          noFinish: true, only: opts.only, startAt: opts.at, onEvent: opts.onEvent, onFinish: opts.onFinish
        });
      }
      return ChoiceGame.mount(root, { probes: T.probes, pick: T.pick, layout: T.layout, ask: T.ask, only: opts.only, startAt: opts.at, onEvent: opts.onEvent, onFinish: opts.onFinish });
    }

    function runTest(ti, at) {
      mode = 'r1';
      var T = tests()[ti];
      var root = h('div', { class: 'eg-root' });
      screen([testBar(ti), root]);
      game = mountEngine(root, T, {
        train: session.opts.train !== false ? T.train : [], at: at,
        onEvent: function (kind, data) {
          data.test = T.id;
          if (kind === 'progress') { kid.presence({ test: T.id, block: data.block, n: data.n, lines: data.lines, total: data.total }); return; }
          log(kind, data);
          if (kind === 'probe_start') kid.presence({ test: T.id, block: data.block, n: data.n, lines: 0, total: data.lines || 0 });
        },
        onFinish: function () {
          if (ti + 1 < tests().length) betweenScreen(ti + 1);
          else afterRound1();
        }
      });
    }

    /* ---------- после первого этапа ---------- */
    // Результаты по каждому заданию: первый этап и последняя попытка во втором.
    function results() {
      var out = {};
      tests().forEach(function (T) { out[T.id] = T.probes.map(function () { return { r1: null, r2: null, tries2: 0 }; }); });
      mine.forEach(function (e) {
        var d = e.data || {}, T = testById(evTest(d));
        if (e.kind !== 'probe_end' || !T || d.block === 'train' || !out[T.id] || !out[T.id][d.n - 1]) return;
        var r = out[T.id][d.n - 1], ok = isOk(T, d);
        if (roundOf(d) === 2) { r.r2 = ok; r.tries2++; } else r.r1 = ok;
      });
      return out;
    }
    function afterRound1() {
      mode = 'after';
      kid.presence({ finished: true, stage: stage });
      if (stage === 'r2') return roundTwoMap();
      if (stage === 'results') return resultsScreen();
      screen([h('section', { class: 'finish' }, [
        h('div', { class: 'finish-ico', html: CHECK }),
        h('h2', { text: 'Все задания выполнены' }),
        h('p', { text: 'Спасибо! Подожди немного: преподаватель скоро покажет тебе результаты.' }),
        pinNote()
      ])]);
    }
    function resultGrid(res, clickable) {
      var wrap = h('div', { class: 'kr-tests' });
      tests().forEach(function (T, ti) {
        var rows = res[T.id], right = 0, now = 0;
        rows.forEach(function (r) { if (r.r1) right++; if (r.r2 === null ? r.r1 : r.r2) now++; });
        var tiles = h('div', { class: 'kr-tiles' });
        rows.forEach(function (r, i) {
          var last = r.r2 === null ? r.r1 : r.r2;
          var st = last === true ? 'ok' : last === false ? 'bad' : 'none';
          var label = (T.kind === 'euler' ? 'Проба ' : 'Задание ') + (i + 1) + ': ' + (st === 'ok' ? 'верно' : st === 'bad' ? 'ошибка' : 'не решено') + (r.r2 !== null ? ', решено ещё раз' : '');
          var tile = h(clickable ? 'button' : 'div', { class: 'kr-tile', 'data-s': st, 'data-again': r.r2 !== null ? '1' : null, type: clickable ? 'button' : null, 'aria-label': label, title: label }, [
            h('span', { class: 'kr-n', text: String(i + 1) }),
            h('span', { class: 'kr-mark', 'aria-hidden': 'true', text: st === 'ok' ? '✓' : st === 'bad' ? '✗' : '–' })
          ]);
          if (clickable) tile.addEventListener('click', function () { runItem(ti, i + 1); });
          tiles.appendChild(tile);
        });
        var sum = right + ' из ' + rows.length + ' верно';
        if (clickable && now !== right) sum += ', после второго этапа ' + now;
        wrap.appendChild(h('section', { class: 'kr-test' }, [
          h('div', { class: 'kr-head' }, [h('h3', { text: (ti + 1) + '. ' + T.title }), h('p', { class: 'kr-sum', text: sum })]),
          tiles
        ]));
      });
      return wrap;
    }
    function resultsScreen() {
      var res = results(), right = 0, all = 0;
      tests().forEach(function (T) { res[T.id].forEach(function (r) { all++; if (r.r1) right++; }); });
      screen([h('section', { class: 'kid-results' }, [
        h('p', { class: 'badge', text: 'Результаты' }),
        h('h1', { text: 'Правильно ' + right + ' из ' + all }),
        pinNote(),
        h('p', { class: 'lead', text: 'Зелёные задания решены верно, красные с ошибкой. Скоро можно будет попробовать ещё раз.' }),
        resultGrid(res, false)
      ])]);
    }
    function roundTwoMap() {
      mode = 'after';
      kid.presence({ round: 2, map: true });
      screen([h('section', { class: 'kid-results' }, [
        h('p', { class: 'badge r2', text: 'Второй этап' }),
        h('h1', { text: 'Попробуй ещё раз' }),
        pinNote(),
        h('p', { class: 'lead', text: 'Нажми на любое задание, чтобы решить его снова. Красные решены с ошибкой, но можно перерешать и зелёные.' }),
        resultGrid(results(), true)
      ])]);
    }
    function runItem(ti, n) {
      mode = 'item';
      var T = tests()[ti];
      var back = h('button', { class: 'btn ghost small', type: 'button', text: '← К карте заданий' });
      back.addEventListener('click', roundTwoMap);
      var root = h('div', { class: 'eg-root' });
      screen([h('div', { class: 'kid-bar r2' }, [
        h('p', { class: 'kb-now' }, [h('b', { text: 'Второй этап' }), ' · ' + T.title + ', ' + (T.kind === 'euler' ? 'проба ' : 'задание ') + n]),
        pinNote(), back
      ]), root]);
      game = mountEngine(root, T, {
        only: true, at: { block: 'main', n: n },
        onEvent: function (kind, data) {
          data.test = T.id; data.round = 2;
          if (kind === 'progress') { kid.presence({ round: 2, test: T.id, block: data.block, n: data.n, lines: data.lines, total: data.total }); return; }
          if (kind === 'finish') return;
          log(kind, data);
          if (kind === 'probe_start') kid.presence({ round: 2, test: T.id, block: data.block, n: data.n, lines: 0, total: data.lines || 0 });
        },
        onFinish: roundTwoMap
      });
    }

    // С какого места продолжить первый этап после перезагрузки.
    function resumePoint(events) {
      var ts = tests();
      for (var ti = 0; ti < ts.length; ti++) {
        var T = ts[ti], mainDone = 0, trainDone = 0, fin = false;
        events.forEach(function (e) {
          if (evTest(e.data) !== T.id || roundOf(e.data) === 2) return;
          if (e.kind === 'finish') fin = true;
          if (e.kind === 'probe_end') {
            if (e.data.block === 'train') trainDone = Math.max(trainDone, e.data.n);
            else mainDone = Math.max(mainDone, e.data.n);
          }
        });
        if (fin || mainDone >= T.probes.length) continue;
        if (T.kind === 'euler') {
          var need = session.opts.train !== false ? T.train.length : 0;
          if (mainDone > 0 || trainDone >= need) return { ti: ti, at: { block: 'main', n: mainDone + 1 } };
          return { ti: ti, at: { block: 'train', n: 1 } };
        }
        return { ti: ti, at: { block: 'main', n: mainDone + 1 } };
      }
      return null;
    }

    function resumeWith(pid, token) {
      kid.resume(pid, token).then(function (r) {
        session = r.session;
        stage = r.participant.stage || 'r1';
        pin = r.participant.pin || '';
        mine = (r.events || []).map(function (e) { return { kind: e.kind, data: e.data || {} }; });
        var rp = resumePoint(mine);
        if (!rp) { afterRound1(); return; }
        runTest(rp.ti, rp.at);
      }, function () { sset(persist, key, null); begin(); });
    }
    function begin() {
      screen([h('p', { class: 'muted pad', text: 'Загружаем…' })]);
      var saved = persist ? sget(persist, key) : null;
      if (saved && saved.pid) { resumeWith(saved.pid, saved.token); return; }
      kid.getSession(code).then(function (s) {
        if (!s) return errorScreen('Тест с кодом ' + code + ' не найден. Проверьте ссылку у преподавателя.');
        session = s;
        joinScreen();
        if (s.status !== 'open') {
          var f = box.querySelector('.kid-form');
          if (f) f.replaceWith(h('p', { class: 'closed-note', text: 'Вход для новых участников закрыт. Если ты уже начинал(а), введи свой номер ниже.' }));
        }
      }, function (e) { errorScreen(e.message, begin); });
    }
    begin();
    return { destroy: function () { if (game) game.destroy(); kid.close(); clear(box); } };
  }

  /* ======================= Преподаватель ======================= */
  var user = null, cur = null, unwatch = null;

  function initAuth() {
    $('authForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = $('aName').value.replace(/\s+/g, ' ').trim();
      $('aErr').textContent = '';
      if (!name) { $('aErr').textContent = 'Напишите своё имя.'; $('aName').focus(); return; }
      var bt = $('aSubmit'); bt.disabled = true;
      B.signIn(name).then(function (u) {
        bt.disabled = false;
        user = u;
        enterSpace();
      }, function (e) { bt.disabled = false; $('aErr').textContent = e.message; });
    });
    $('kidCodeForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = $('kidCode').value.replace(/[^a-z0-9]/gi, '').toUpperCase();
      if (c.length !== 6) { $('kidCodeErr').textContent = 'Код состоит из 6 букв и цифр.'; return; }
      location.href = sessionUrl(c);
    });
  }
  function defaultTitle() {
    var d = new Date();
    return 'Группа, ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  function defaultOpts() {
    return { tests: TESTS.map(function (t) { return t.id; }), train: true, showTime: true, sound: true };
  }
  // Сразу в рабочее пространство: последний открытый запуск или новый.
  function enterSpace() {
    show('boot');
    B.listSessions().then(function (rows) {
      var open = rows.filter(function (s) { return s.status === 'open'; })[0];
      if (open) return openSession(open);
      return B.createSession(defaultTitle(), defaultOpts()).then(openSession);
    }, function (e) { $('boot').textContent = e.message; });
  }

  function openHome() {
    if (unwatch) { unwatch(); unwatch = null; }
    closeDrawer(true);
    cur = null;
    show('tHome');
    $('whoName').textContent = user.name;
    $('nTitle').value = defaultTitle();
    var list = clear($('sessList'));
    list.appendChild(h('p', { class: 'muted', text: 'Загружаем…' }));
    B.listSessions().then(function (rows) {
      clear(list);
      if (!rows.length) { list.appendChild(h('p', { class: 'muted', text: 'Здесь появятся ваши прошлые запуски теста.' })); return; }
      rows.forEach(function (s) {
        var b = h('button', { class: 'sess-row', type: 'button' }, [
          h('span', { class: 'sess-title', text: s.title || 'Без названия' }),
          h('span', { class: 'sess-meta', text: dateText(s.created_at) + ' · ' + sessionTests(s.opts).map(function (t) { return t.title; }).join(', ') }),
          h('span', { class: 'code', text: s.code }),
          h('span', { class: 'pill ' + (s.status === 'open' ? 'on' : 'off'), text: s.status === 'open' ? 'вход открыт' : 'вход закрыт' })
        ]);
        b.addEventListener('click', function () { openSession(s); });
        list.appendChild(b);
      });
    }, function (e) { clear(list); list.appendChild(h('p', { class: 'form-err', text: e.message })); });
  }

  function initHome() {
    var box = $('nTests');
    TESTS.forEach(function (T, i) {
      var id = 'nTest-' + T.id;
      box.appendChild(h('label', { class: 'check', for: id }, [
        h('input', { id: id, type: 'checkbox', checked: true, 'data-test': T.id }),
        h('span', { text: (i + 1) + '. ' + T.title }, [h('small', { text: T.probes.length + ' ' + plural(T.probes.length, 'задание', 'задания', 'заданий') })])
      ]));
    });
    $('logout').addEventListener('click', function () { B.signOut().then(function () { user = null; $('aName').value = ''; show('tAuth'); }); });
    $('newForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ids = Array.prototype.filter.call(box.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-test'); });
      $('nErr').textContent = '';
      if (!ids.length) { $('nErr').textContent = 'Выберите хотя бы один тест.'; return; }
      var bt = $('nStart'); bt.disabled = true;
      var opts = { tests: ids, train: $('nTrain').checked, showTime: $('nTime').checked, sound: $('nSound').checked };
      B.createSession($('nTitle').value.trim(), opts).then(function (s) { bt.disabled = false; openSession(s); },
        function (e) { bt.disabled = false; $('nErr').textContent = e.message; });
    });
  }

  /* ---------- карта прохождений ---------- */
  // Строки — задания, сгруппированные по тестам. Столбцы — дети, у каждого два столбца: 1-й и 2-й этап.
  var STAGE = {
    r1: { pill: '1-й этап', next: 'results', btn: 'Показать результаты' },
    results: { pill: 'видит результаты', next: 'r2', btn: 'Открыть 2-й этап' },
    r2: { pill: '2-й этап открыт', next: null, btn: '' }
  };
  function openSession(s) {
    if (unwatch) { unwatch(); unwatch = null; }
    closeDrawer(true);
    closePreview();
    cur = { s: s, tests: sessionTests(s.opts || {}), cols: columns(s.opts || {}), parts: {}, order: [], seen: {}, pending: [], presence: {}, feed: [] };
    show('tSession');
    $('sTitle').textContent = s.title || 'Без названия';
    $('sTests').textContent = cur.tests.map(function (t, i) { return (i + 1) + '. ' + t.title; }).join(' → ');
    $('sCode').textContent = s.code;
    $('sLink').value = sessionUrl(s.code);
    $('openTab').href = sessionUrl(s.code);
    $('sDate').textContent = dateText(s.created_at);
    $('copyMsg').textContent = '';
    $('exportMsg').textContent = '';
    renderStatus();
    renderAll();
    var watchingNow = s;
    B.loadSession(s).then(function (d) {
      if (!cur || cur.s !== watchingNow) return;
      d.participants.forEach(addParticipant);
      d.events.forEach(function (e) { applyEvent(e, true); });
      renderAll();
    });
    unwatch = B.watchSession(s, {
      onParticipant: function (p) { if (!cur) return; addParticipant(p, true); renderAll(); },
      onEvent: function (e) { if (!cur) return; applyEvent(e, false); renderAll(); },
      onPresence: function (p) { if (!cur) return; cur.presence = p; renderAll(); },
      onStage: function (pid, st) { if (!cur || !cur.parts[pid]) return; cur.parts[pid].stage = st; renderAll(); },
      onStatus: function (st) { $('live').setAttribute('data-st', st); $('liveText').textContent = st === 'live' ? 'обновляется в реальном времени' : st === 'off' ? 'нет связи' : 'подключаемся…'; }
    });
  }
  function renderStatus() {
    var open = cur.s.status === 'open';
    $('sStatus').className = 'pill ' + (open ? 'on' : 'off');
    $('sStatus').textContent = open ? 'вход открыт' : 'вход закрыт';
    $('sToggle').textContent = open ? 'Закрыть вход' : 'Открыть вход снова';
  }
  function addParticipant(p, live) {
    if (cur.parts[p.id]) return;
    cur.parts[p.id] = { p: p, age: ageAt(p.birth, p.joined_at), cells: {}, cells2: {}, cur: null, cur2: null, fin: {}, stage: p.stage || 'r1' };
    cur.order.push(p.id);
    if (live) feed(p.joined_at, p.id, 'подключился(-ась), ' + ageText(cur.parts[p.id].age), 'join');
    var wait = cur.pending.filter(function (e) { return e.participant_id === p.id; });
    cur.pending = cur.pending.filter(function (e) { return e.participant_id !== p.id; });
    wait.forEach(function (e) { applyEvent(e, !live); });
  }
  function isFinished(P) { return cur.tests.every(function (t) { return P.fin[t.id]; }); }
  function blank() { return { state: 'pending', fails: [], attempts: 0, tries: 0 }; }
  function cell(map, k) { return map[k] || (map[k] = blank()); }
  function applyEvent(e, quiet) {
    var id = e.id !== undefined ? e.id : JSON.stringify(e);
    if (cur.seen[id]) return;
    var P = cur.parts[e.participant_id];
    if (!P) { cur.pending.push(e); return; }
    cur.seen[id] = 1;
    var d = e.data || {}, k, c, T = testById(evTest(d)), choice = T && T.kind === 'choice';
    var r2 = roundOf(d) === 2, map = r2 ? P.cells2 : P.cells;
    var pre = (r2 ? '2-й этап: ' : '') + (cur.tests.length > 1 && T ? T.short + ', ' : '');
    if (e.kind === 'probe_start') {
      k = keyOf(d); c = cell(map, k);
      if (r2) { P.cur2 = k; c.open = true; c.fails = []; } else { if (c.state === 'pending') c.state = 'current'; P.cur = k; }
      if (quiet) return;
      if (r2) feed(e.created_at, e.participant_id, pre + 'открыл(а) ' + probeName(d), 'start');
      else if (choice) { if (d.n === 1) feed(e.created_at, e.participant_id, 'перешёл(-ла) к тесту «' + T.title + '»', 'start'); }
      else feed(e.created_at, e.participant_id, pre + 'начал(а) ' + (d.block === 'train' ? 'обучающую пробу ' : 'пробу ') + d.n, 'start');
    } else if (e.kind === 'attempt') {
      c = cell(map, keyOf(d));
      c.fails.push(d.o);
      if (!quiet) feed(e.created_at, e.participant_id, pre + probeName(d) + ': ' + (d.o === 'dead' ? 'тупик' : 'начал(а) заново') + ', ' + d.lines + ' из ' + d.total + ' линий', 'bad');
    } else if (e.kind === 'probe_end') {
      k = keyOf(d); c = cell(map, k);
      if (r2) { if (P.cur2 === k) P.cur2 = null; c.open = false; c.tries++; } else if (P.cur === k) P.cur = null;
      c.ms = d.ms; c.plan = d.plan; c.attempts = d.attempts;
      if (choice) {
        c.state = d.correct ? 'right' : 'wrong'; c.choice = d.choice; c.answer = d.answer; c.changes = d.changes; c.hits = d.hits;
        var many = list(d.answer).length > 1;
        if (!quiet) feed(e.created_at, e.participant_id, pre + probeName(d) + ': ' + (many ? 'выбраны ' : 'выбран вариант ') + numsT(T, d.choice) +
          (d.correct ? ', верно' : ', неверно (' + (many ? 'верных ' + (d.hits || 0) + ' из ' + list(d.answer).length + ', правильные ' : 'правильный ') + numsT(T, d.answer) + ')') + ', ' + fmt(d.ms), d.correct ? 'good' : 'bad');
      } else {
        c.state = d.status; c.undos = d.undos; c.log = d.log || [];
        if (!quiet) feed(e.created_at, e.participant_id, d.status === 'done'
          ? pre + probeName(d) + ' пройдена с ' + ordinal(d.attempts) + ' попытки за ' + fmt(d.ms)
          : pre + probeName(d) + ' пропущена после ' + d.attempts + ' ' + plural(d.attempts, 'попытки', 'попыток', 'попыток'), d.status === 'done' ? 'good' : 'skip');
      }
    } else if (e.kind === 'finish' && !r2) {
      P.fin[evTest(d)] = true; P.cur = null;
      if (!quiet) feed(e.created_at, e.participant_id, isFinished(P) ? 'закончил(а) все тесты' : 'закончил(а) тест «' + (T ? T.title : '') + '»', 'good');
    }
  }
  function feed(at, pid, text, kind) {
    cur.feed.unshift({ at: at || new Date().toISOString(), pid: pid, text: text, kind: kind });
    if (cur.feed.length > 80) cur.feed.length = 80;
  }
  function clickable(node, fn) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.classList.add('clickable');
    node.addEventListener('click', fn);
    node.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } });
    return node;
  }
  function okState(c) { return c.state === 'done' || c.state === 'right'; }
  function cellTitle(c, col, round) {
    var t = (round === 2 ? '2-й этап. ' : '') + col.name;
    if (col.test.kind === 'choice') {
      if (c.state === 'right' || c.state === 'wrong') t += ' — выбрано ' + numsT(col.test, c.choice) + (c.state === 'right' ? ', верно' : ', неверно') + ', ' + fmt(c.ms);
      else if (c.state === 'current' || c.open) t += ' — решает сейчас';
      else t += round === 2 ? ' — не перерешивал(а)' : ' — ещё не начато';
    } else {
      if (c.state === 'done') t += ' — пройдена с ' + ordinal(c.attempts) + ' попытки, ' + fmt(c.ms);
      else if (c.state === 'skipped') t += ' — пропущена';
      else if (c.state === 'current' || c.open) t += ' — проходит сейчас';
      else t += round === 2 ? ' — не перепроходил(а)' : ' — ещё не начата';
      if (c.fails.length) t += '. Неудачных попыток: ' + c.fails.length;
    }
    if (round === 2 && c.tries > 1) t += '. Решал(а) во 2-м этапе ' + c.tries + ' раза';
    return t + '. Нажмите, чтобы открыть.';
  }
  function cellNode(P, col, round, pr) {
    var c = (round === 2 ? P.cells2 : P.cells)[col.key] || blank();
    var live = round === 2 ? P.cur2 === col.key && !(pr && pr.map) : c.state === 'current';
    var marks = h('span', { class: 'marks' }), sub = '';
    c.fails.forEach(function () { marks.appendChild(h('i', { class: 'm-bad' })); });
    if (okState(c)) marks.appendChild(h('i', { class: 'm-ok' }));
    if (c.state === 'wrong') marks.appendChild(h('i', { class: 'm-bad' }));
    if (c.state === 'skipped') marks.appendChild(h('i', { class: 'm-skip' }));
    // Под клеткой всегда время: видна динамика. Что именно выбрано — в превью по нажатию.
    if (okState(c) || c.state === 'skipped' || c.state === 'wrong') sub = fmt(c.ms || 0);
    if (live) {
      var prOk = pr && evTest(pr) === col.test.id && pr.block === col.block && pr.n === col.n && (round === 2) === (pr.round === 2);
      sub = col.test.kind === 'euler' && prOk ? pr.lines + '/' + pr.total : round === 2 ? 'решает…' : '…';
    }
    var td = h('td', {
      class: 'cell' + (round === 2 ? ' r2' : ''), 'data-state': live ? 'current' : c.state,
      'data-first': !live && ((c.state === 'done' && c.attempts === 1) || c.state === 'right') ? '1' : null,
      'data-wrong': !live && c.state === 'wrong' ? '1' : null, title: cellTitle(c, col, round)
    }, [marks, h('span', { class: 'sub', text: sub })]);
    return clickable(td, function () { openPreview(col, P, round); });
  }
  function setStage(pids, st) {
    pids.forEach(function (pid) {
      var P = cur.parts[pid]; if (!P) return;
      P.stage = st;
      B.setStage(cur.s, pid, st);
      feed(null, pid, st === 'results' ? 'теперь видит свои результаты' : 'может перерешивать задания (2-й этап)', 'join');
    });
    renderAll();
  }
  function renderAll() {
    if (!cur) return;
    var thead = clear($('mapThead')), body = clear($('mapBody')), now = 0, online = 0, done = 0;
    var r1 = h('tr'), r2 = h('tr', { class: 'sub-h' });
    r1.appendChild(h('th', { class: 'item-col', scope: 'col', rowspan: '2', text: 'Задание' }));
    cur.order.forEach(function (pid) {
      var P = cur.parts[pid], pr = cur.presence[pid], on = !!pr, fin = isFinished(P), S = STAGE[P.stage] || STAGE.r1;
      if (on) online++;
      if (fin) done++; else if (P.cur) now++;
      var act = null;
      if (S.next && (fin || P.stage !== 'r1')) act = h('button', { class: 'btn small ' + (P.stage === 'r1' ? 'primary' : 'secondary'), type: 'button', text: S.btn, on: { click: function () { setStage([pid], S.next); } } });
      var state = P.stage === 'r1' ? (fin ? 'закончил(а) все тесты' : P.cur ? 'проходит' : 'подключился(-ась)') : S.pill;
      r1.appendChild(h('th', { scope: 'colgroup', colspan: '2', class: 'kid-col', 'data-online': on ? '1' : '0' }, [
        h('div', { class: 'kid-head' }, [
          h('span', { class: 'dot', title: on ? 'на связи' : 'не на связи' }),
          h('span', { class: 'kid-name', text: P.p.name }),
          h('span', { class: 'kid-age', text: ageText(P.age) || 'возраст не указан', title: P.p.birth ? 'Дата рождения: ' + birthText(P.p.birth) : '' }),
          P.p.pin ? h('span', { class: 'kid-pin', title: 'Номер для возврата: ребёнок вводит его по той же ссылке', text: '№ ' + P.p.pin }) : null,
          h('span', { class: 'kid-stage', 'data-st': P.stage, text: state }),
          act
        ])
      ]));
      r2.appendChild(h('th', { scope: 'col', class: 'st-h', text: '1-й этап' }));
      r2.appendChild(h('th', { scope: 'col', class: 'st-h r2', text: '2-й этап' }));
    });
    thead.appendChild(r1);
    if (cur.order.length) thead.appendChild(r2);
    var span = 1 + cur.order.length * 2;
    cur.tests.forEach(function (T, ti) {
      body.appendChild(h('tr', { class: 'grp' }, [h('th', { scope: 'rowgroup', colspan: String(span), text: (ti + 1) + '. ' + T.title })]));
      cur.cols.filter(function (c) { return c.test === T; }).forEach(function (col) {
        var tr = h('tr', { class: col.total ? 'tot' : col.block === 'train' ? 'train' : '' });
        if (col.total) {
          tr.appendChild(h('th', { scope: 'row', class: 'item-col', text: 'Итог' }));
          cur.order.forEach(function (pid) {
            var P = cur.parts[pid], ok1 = 0, ok2 = 0, n = 0, ms = 0, any2 = false;
            cur.cols.forEach(function (c) {
              if (c.test !== T || c.total || c.block !== 'main') return;
              n++;
              var a = P.cells[c.key] || blank(), b = P.cells2[c.key];
              if (okState(a)) ok1++;
              if (a.ms) ms += a.ms;
              if (b && b.tries) any2 = true;
              if (b && b.tries ? okState(b) : okState(a)) ok2++;
            });
            tr.appendChild(h('td', { class: 'total' }, [h('strong', { text: ok1 + ' из ' + n }), h('small', { text: P.fin[T.id] ? fmt(ms) : '' })]));
            tr.appendChild(h('td', { class: 'total r2' }, any2 ? [h('strong', { text: ok2 + ' из ' + n }), h('small', { text: ok2 > ok1 ? '+' + (ok2 - ok1) : ok2 < ok1 ? '−' + (ok1 - ok2) : 'без изменений' })] : []));
          });
        } else {
          tr.appendChild(clickable(h('th', { scope: 'row', class: 'item-col', title: 'Показать: ' + col.name }, [
            h('span', { class: 'it-name', text: col.short }), h('small', { text: col.sub })
          ]), function () { openPreview(col, null, 1); }));
          cur.order.forEach(function (pid) {
            var P = cur.parts[pid], pr = cur.presence[pid];
            tr.appendChild(cellNode(P, col, 1, pr));
            if (col.block === 'train') tr.appendChild(h('td', { class: 'cell r2 na' }));
            else tr.appendChild(cellNode(P, col, 2, pr));
          });
        }
        body.appendChild(tr);
      });
    });
    $('mapEmpty').hidden = cur.order.length > 0;
    $('cJoined').textContent = cur.order.length;
    $('cOnline').textContent = online;
    $('cNow').textContent = now;
    $('cDone').textContent = done;
    // Кнопки для всех сразу.
    var toRes = cur.order.filter(function (pid) { var P = cur.parts[pid]; return P.stage === 'r1' && isFinished(P); });
    var toR2 = cur.order.filter(function (pid) { return cur.parts[pid].stage === 'results'; });
    var bar = clear($('stageBar'));
    bar.hidden = !cur.order.length;
    bar.appendChild(h('p', { class: 'stage-hint', text: 'Результаты и второй этап ребёнок увидит только после вашего нажатия.' }));
    bar.appendChild(h('button', { class: 'btn primary small', type: 'button', disabled: toRes.length ? null : 'disabled', text: 'Показать результаты закончившим' + (toRes.length ? ' (' + toRes.length + ')' : ''), on: { click: function () { setStage(toRes, 'results'); } } }));
    bar.appendChild(h('button', { class: 'btn secondary small', type: 'button', disabled: toR2.length ? null : 'disabled', text: 'Открыть 2-й этап' + (toR2.length ? ' (' + toR2.length + ')' : ''), on: { click: function () { setStage(toR2, 'r2'); } } }));
    var f = clear($('feed'));
    if (!cur.feed.length) f.appendChild(h('li', { class: 'muted', text: 'Пока тихо. Здесь будут события по мере прохождения.' }));
    cur.feed.forEach(function (x) {
      var P = cur.parts[x.pid];
      f.appendChild(h('li', { 'data-k': x.kind }, [
        h('time', { text: clock(x.at) }),
        h('span', {}, [h('b', { text: P ? P.p.name : '' }), ' ' + x.text])
      ]));
    });
    if (pv.open) refreshPreview();
  }

  /* ---------- превью пробы ---------- */
  var pv = { open: false, col: null, P: null, round: 1, last: null };
  function figureSvg(p) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 640 520'); svg.setAttribute('class', 'pv-fig'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Фигура: ' + p.V.length + ' точек, ' + p.E.length + ' линий');
    p.E.forEach(function (e) {
      var a = p.V[e[0]], b = p.V[e[1]], l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
      l.setAttribute('class', 'edge-base'); svg.appendChild(l);
    });
    p.V.forEach(function (v) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', v[0]); c.setAttribute('cy', v[1]); c.setAttribute('r', 15); c.setAttribute('class', 'pv-dot');
      svg.appendChild(c);
    });
    return svg;
  }
  function logText(log) {
    var prev = 0, NAMES = { dead: 'тупик', restart: 'заново', done: 'пройдено', skip: 'пропуск' };
    return (log || []).map(function (a, k) {
      var d = a.end - prev; prev = a.end;
      return (k + 1) + ' — ' + NAMES[a.o] + ', ' + a.lines + ' лин., ' + fmt(d);
    }).join(' · ');
  }
  function kv(label, value) { return h('div', {}, [h('dt', { text: label }), h('dd', { text: value })]); }
  function kidFacts(col, P, round) {
    var c = (round === 2 ? P.cells2 : P.cells)[col.key] || blank(), p = col.probe, f = [];
    if (col.test.kind === 'euler') {
      var res = c.state === 'done' ? 'пройдена с ' + ordinal(c.attempts) + ' попытки за ' + fmt(c.ms)
        : c.state === 'skipped' ? 'пропущена после ' + c.attempts + ' ' + plural(c.attempts, 'попытки', 'попыток', 'попыток')
        : c.state === 'current' || c.open ? 'проходит сейчас' + (c.fails.length ? ', неудачных попыток: ' + c.fails.length : '')
        : round === 2 ? 'не перепроходил(а)' : 'ещё не начата';
      f.push(kv('Результат', res));
      if (c.log && c.log.length) f.push(kv('Попытки', logText(c.log)));
      if (c.plan !== null && c.plan !== undefined) f.push(kv('До первого хода', (c.plan / 1000).toFixed(1).replace('.', ',') + ' с'));
      if (c.undos !== undefined) f.push(kv('Отмен хода', String(c.undos)));
    } else {
      var many = list(p.answer).length > 1;
      var r = c.state === 'right' ? 'верно, выбрано ' + numsT(col.test, c.choice)
        : c.state === 'wrong' ? 'неверно: выбрано ' + numsT(col.test, c.choice) + (many ? ', верных ' + (c.hits || 0) + ' из ' + list(p.answer).length + ', правильные ' : ', правильный ') + numsT(col.test, p.answer)
        : c.open || c.state === 'current' ? 'решает сейчас' : round === 2 ? 'не перерешивал(а)' : 'ещё не начато';
      f.push(kv('Результат', r));
      if (c.ms) f.push(kv('Время', fmt(c.ms)));
      if (c.plan !== null && c.plan !== undefined) f.push(kv('До первого выбора', (c.plan / 1000).toFixed(1).replace('.', ',') + ' с'));
      if (c.changes !== undefined) f.push(kv('Менял(а) выбор', c.changes ? c.changes + ' ' + plural(c.changes, 'раз', 'раза', 'раз') : 'нет'));
    }
    if (round === 2 && c.tries > 1) f.push(kv('Решал(а) во 2-м этапе', c.tries + ' ' + plural(c.tries, 'раз', 'раза', 'раз')));
    return { c: c, facts: f };
  }
  function previewBody(col, P, round) {
    var p = col.probe, out = [];
    var k1 = P ? kidFacts(col, P, 1) : null, k2 = P && col.block === 'main' ? kidFacts(col, P, 2) : null;
    var shown = round === 2 ? k2 : k1;
    if (col.test.kind === 'euler') {
      var odd = 0, deg = p.V.map(function () { return 0; });
      p.E.forEach(function (e) { deg[e[0]]++; deg[e[1]]++; });
      deg.forEach(function (d) { if (d % 2) odd++; });
      out.push(h('div', { class: 'pv-figwrap' }, [figureSvg(p)]));
      out.push(h('dl', { class: 'pv-facts' }, [
        kv('Линий', String(p.E.length)), kv('Точек', String(p.V.length)),
        kv('Решение', odd ? 'путь: начать с одной из двух нечётных точек' : 'цикл: можно начать с любой точки'),
        kv('Файл', p.file)
      ]));
    } else {
      var sImg = h('img', { src: p.img, alt: 'Задание ' + col.n });
      if (p.scale) { sImg.setAttribute('data-scale', p.scale); sImg.style.maxHeight = 'none'; }
      out.push(h('div', { class: 'pv-stim' }, [sImg]));
      var opts = h('ol', { class: 'pv-opts', 'data-layout': col.test.layout || null });
      var c = shown ? shown.c : null;
      p.options.forEach(function (src, k) {
        var n = k + 1, isAns = list(p.answer).indexOf(n) >= 0, isPick = !!c && list(c.choice).indexOf(n) >= 0;
        var tags = [];
        if (isAns) tags.push(h('span', { class: 'tag ok', text: 'правильный' }));
        if (isPick) tags.push(h('span', { class: 'tag ' + (isAns ? 'ok' : 'bad'), text: 'выбор ребёнка' }));
        opts.appendChild(h('li', { class: (isAns ? 'is-answer ' : '') + (isPick && !isAns ? 'is-wrong' : '') }, [
          h('div', { class: 'pv-opt-img' }, [h('img', { src: src, alt: 'Вариант ' + lab(col.test, n) })]),
          h('div', { class: 'pv-opt-cap' }, [h('b', { text: String(lab(col.test, n)) })].concat(tags))
        ]));
      });
      out.push(opts);
    }
    if (P) {
      var tabs = null;
      if (k2) {
        tabs = h('div', { class: 'pv-tabs', role: 'tablist' }, [1, 2].map(function (r) {
          return h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': r === round ? 'true' : 'false', text: r + '-й этап',
            on: { click: function () { pv.round = r; pv.last = null; refreshPreview(); } } });
        }));
      }
      out.push(h('section', { class: 'pv-kid' }, [
        h('div', { class: 'pv-kid-h' }, [h('h4', { text: P.p.name + (P.age ? ', ' + ageText(P.age) : '') }), tabs]),
        h('dl', { class: 'pv-facts' }, shown ? shown.facts : [])
      ]));
    }
    return out;
  }
  function refreshPreview() {
    var sig = pv.round + (pv.P ? JSON.stringify([pv.P.cells[pv.col.key] || null, pv.P.cells2[pv.col.key] || null, pv.P.cur2]) : '');
    if (sig === pv.last) return;
    pv.last = sig;
    $('pvTitle').textContent = (pv.col.test.kind === 'choice' ? 'Задание ' : pv.col.block === 'train' ? 'Обучающая проба ' : 'Проба ') + pv.col.n + (pv.P && pv.round === 2 ? ' · 2-й этап' : '');
    var body = clear($('pvBody'));
    previewBody(pv.col, pv.P, pv.round).forEach(function (n) { body.appendChild(n); });
    fitPreview();
  }
  function fitPreview() {
    var img = document.querySelector('#pvBody .pv-stim img[data-scale]'), tile = document.querySelector('#pvBody .pv-opt-img');
    if (!img || !tile) return;
    img.style.width = Math.round(Math.min(+img.getAttribute('data-scale') * tile.clientWidth, img.parentNode.clientWidth - 20)) + 'px';
  }
  window.addEventListener('resize', function () { if (pv.open) fitPreview(); });
  function openPreview(col, P, round) {
    pv.open = true; pv.col = col; pv.P = P; pv.round = round || 1; pv.last = null;
    $('pvKick').textContent = col.test.title + (col.block === 'train' ? ', обучение' : '');
    $('pv').hidden = false;
    refreshPreview();
    pv.ret = document.activeElement;
    try { $('pvClose').focus({ preventScroll: true }); } catch (e) {}
  }
  function closePreview() {
    if (!pv.open) return;
    pv.open = false; $('pv').hidden = true;
    try { if (pv.ret) pv.ret.focus({ preventScroll: true }); } catch (e) {}
  }
  function initPreview() {
    $('pvClose').addEventListener('click', closePreview);
    $('pv').addEventListener('click', function (ev) { if (ev.target === $('pv')) closePreview(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePreview(); });
  }

  /* ---------- выгрузка для Excel ---------- */
  function cellTsv(s) {
    s = String(s === null || s === undefined ? '' : s).replace(/[\t\r\n]+/g, ' ');
    return /^[=+\-@]/.test(s) ? "'" + s : s;
  }
  function sec(ms) { return ms === null || ms === undefined ? '' : (ms / 1000).toFixed(1).replace('.', ','); }
  function buildTsv() {
    var rows = [['Сессия', 'Участник', 'Номер', 'Дата рождения', 'Возраст (лет;мес)', 'Этап', 'Тест', 'Блок', '№', 'Проба', 'Результат', 'Попыток', 'Неудачных', 'Время, с',
      'Линий в фигуре', 'Выбран вариант', 'Правильный вариант', 'До первого хода / выбора, с', 'Отмен ходов', 'Смен выбора', 'Ход попыток', 'Раз решал во 2-м этапе']];
    [1, 2].forEach(function (round) {
      cur.order.forEach(function (pid) {
        var P = cur.parts[pid];
        cur.cols.forEach(function (col) {
          if (col.total) return;
          var c = (round === 2 ? P.cells2 : P.cells)[col.key], choice = col.test.kind === 'choice';
          if (round === 2 && (!c || !c.tries)) return;
          var st = c ? c.state : 'pending';
          var res = { pending: choice ? 'не начато' : 'не начата', current: choice ? 'не закончено' : 'не закончена', done: 'пройдена', skipped: 'пропущена', right: 'верно', wrong: 'неверно' }[st];
          rows.push([cur.s.title, P.p.name, P.p.pin || '', P.p.birth || '', ageCode(P.age), round, col.test.title, col.block === 'train' ? 'обучение' : 'основной', col.n,
            choice ? 'задание ' + col.n : col.name, res,
            c && c.attempts ? c.attempts : '', c && !choice ? c.fails.length : '', c && c.ms ? Math.round(c.ms / 1000) : '',
            choice ? '' : col.probe.E.length, c && c.choice ? numsT(col.test, c.choice) : '', choice ? numsT(col.test, col.probe.answer) : '',
            c ? sec(c.plan) : '', c && c.undos !== undefined ? c.undos : '', c && c.changes !== undefined ? c.changes : '', c && !choice ? logText(c.log) : '',
            round === 2 ? c.tries : '']);
        });
      });
    });
    return rows.map(function (r) { return r.map(cellTsv).join('\t'); }).join('\n');
  }

  function initSession() {
    $('back').addEventListener('click', openHome);
    $('copyLink').addEventListener('click', function () { copyText($('sLink').value, $('sLink'), $('copyMsg'), 'Ссылка скопирована. Отправьте её детям.'); });
    $('sToggle').addEventListener('click', function () {
      var bt = $('sToggle'); bt.disabled = true;
      B.setStatus(cur.s, cur.s.status === 'open' ? 'closed' : 'open').then(function () { bt.disabled = false; renderStatus(); }, function () { bt.disabled = false; });
    });
    $('exportBtn').addEventListener('click', function () {
      var t = buildTsv(), ta = $('tsv');
      ta.value = t;
      copyText(t, null, $('exportMsg'), 'Скопировано. Вставьте в Excel или Google Таблицы.', function () { ta.hidden = false; ta.focus(); ta.select(); });
    });
    $('exportShow').addEventListener('click', function () {
      var ta = $('tsv'); ta.value = buildTsv(); ta.hidden = !ta.hidden; if (!ta.hidden) { ta.focus(); ta.select(); }
    });
    $('tryKid').addEventListener('click', function () { openDrawer(true); });
  }

  /* ---------- панель проверки: экран ребёнка прямо на странице ---------- */
  var kids = [], activeKid = -1;
  function openDrawer(addNew) {
    $('drawer').hidden = false;
    document.body.classList.add('has-drawer');
    if (addNew || !kids.length) addKid();
  }
  function closeDrawer(destroy) {
    $('drawer').hidden = true;
    document.body.classList.remove('has-drawer');
    if (destroy) {
      kids.forEach(function (k) { k.app.destroy(); if (k.box.parentNode) k.box.parentNode.removeChild(k.box); });
      kids = []; activeKid = -1; renderKidTabs();
    }
  }
  function addKid() {
    var box = h('div', { class: 'drawer-kid' });
    $('drawerBody').appendChild(box);
    kids.push({ box: box, app: KidApp(box, cur.s.code, null) });
    selectKid(kids.length - 1);
  }
  function selectKid(i) {
    activeKid = i;
    kids.forEach(function (k, j) { k.box.hidden = j !== i; });
    renderKidTabs();
  }
  function renderKidTabs() {
    var t = clear($('drawerTabs'));
    kids.forEach(function (k, i) {
      t.appendChild(h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': i === activeKid ? 'true' : 'false', text: 'Ребёнок ' + (i + 1), on: { click: function () { selectKid(i); } } }));
    });
    t.appendChild(h('button', { type: 'button', class: 'tab add', text: '+ ещё', title: 'Добавить ещё одного ребёнка', on: { click: addKid } }));
  }
  function initDrawer() {
    $('drawerClose').addEventListener('click', function () { closeDrawer(false); });
  }

  /* ======================= Запуск ======================= */
  function routeCode() {
    var m = /[?&]s=([A-Za-z0-9]{6})/.exec(location.search) || /^#s-([A-Za-z0-9]{6})$/.exec(location.hash);
    return m ? m[1].toUpperCase() : null;
  }
  Backend.init().then(function (b) {
    B = b;
    document.documentElement.setAttribute('data-backend', b.mode);
    var code = routeCode();
    if (code) {
      document.title = 'Групповые пробы — вход';
      show('kidPage');
      KidApp($('kidPage'), code, store(b.mode === 'demo' ? 'sessionStorage' : 'localStorage'));
      return;
    }
    initAuth(); initHome(); initSession(); initDrawer(); initPreview();
    B.getUser().then(function (u) {
      user = u;
      if (u) enterSpace(); else show('tAuth');
    });
  }, function (e) {
    $('boot').textContent = e.message;
  });
})();
