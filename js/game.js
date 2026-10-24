// Движок проб «одним росчерком». Один экземпляр на ребёнка: EulerGame.mount(root, options).
// Логика перенесена из исходной страницы проб без изменений правил: протягивание линии,
// остановка и продолжение, тупик сбрасывает фигуру, отмена хода, пропуск после первой попытки.
(function (global) {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function buildAdj(n, E) {
    var adj = [], i;
    for (i = 0; i < n; i++) adj.push([]);
    E.forEach(function (e, k) {
      adj[e[0]].push({ to: e[1], e: k });
      adj[e[1]].push({ to: e[0], e: k });
    });
    return adj;
  }
  function lookup(adj, a, b, used) {
    var free = -1, any = -1;
    adj[a].forEach(function (x) {
      if (x.to === b) { any = x.e; if (!used[x.e]) free = x.e; }
    });
    return { free: free, any: any };
  }
  function hasMove(adj, v, used) {
    return adj[v].some(function (x) { return !used[x.e]; });
  }
  function fmt(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function eulerWalk(p) {
    var n = p.V.length, adj = buildAdj(n, p.E), odd = [], v;
    for (v = 0; v < n; v++) if (adj[v].length % 2) odd.push(v);
    var used = {}, ptr = [], st = [odd.length ? odd[0] : 0], out = [];
    for (v = 0; v < n; v++) ptr.push(0);
    while (st.length) {
      v = st[st.length - 1];
      while (ptr[v] < adj[v].length && used[adj[v][ptr[v]].e]) ptr[v]++;
      if (ptr[v] === adj[v].length) out.push(st.pop());
      else { var m = adj[v][ptr[v]]; used[m.e] = true; st.push(m.to); }
    }
    return out.reverse();
  }

  /* ---------- звук (общий для всех экземпляров) ---------- */
  var audioCtx = null;
  function ensureAudio(on) {
    if (!on) return null;
    try {
      if (!audioCtx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        audioCtx = new C();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { return null; }
    return audioCtx;
  }
  function tone(on, f1, f2, at, len, type, vol) {
    var a = ensureAudio(on);
    if (!a) return;
    try {
      var t0 = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + Math.min(len, 0.3));
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + len + 0.05);
    } catch (e) {}
  }
  function sndEdge(on) { tone(on, 720, 920, 0, 0.09, 'sine', 0.14); }
  function sndFail(on) { tone(on, 320, 0, 0, 0.16, 'sawtooth', 0.12); tone(on, 190, 0, 0.11, 0.16, 'sawtooth', 0.12); }
  function sndSad(on) { tone(on, 330, 277, 0, 0.2, 'triangle', 0.07); tone(on, 262, 196, 0.2, 0.3, 'triangle', 0.08); }
  function sndFanfare(on) {
    [523, 659, 784, 1047].forEach(function (f, i) { tone(on, f, 0, i * 0.1, 0.35, 'triangle', 0.18); });
    [523, 659, 784, 1047].forEach(function (f) { tone(on, f, 0, 0.42, 0.9, 'triangle', 0.1); });
    [1568, 2093, 1976, 2349].forEach(function (f, i) { tone(on, f, 0, 0.5 + i * 0.09, 0.25, 'sine', 0.05); });
  }

  var PRAISE = ['Супер!', 'Получилось!', 'Йуху!', 'Отлично!', 'Так держать!', 'Ура, есть!', 'Браво!'];
  var HAND = 'M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z';

  var TEMPLATE =
    '<section class="probe" data-r="probeScreen" aria-label="Проба">' +
      '<header class="probe-head">' +
        '<div class="probe-title"><span class="kicker" data-r="pKick">Проба</span><span class="num" data-r="pIdx">1</span><span class="of">из <span data-r="pTotal">1</span></span></div>' +
        '<div class="segs" data-r="segs" aria-hidden="true"></div>' +
      '</header>' +
      '<div class="stage">' +
        '<div class="boards" data-r="boards">' +
          '<div class="board" data-r="card1"><p class="cap" data-r="cap1" hidden>1. Квадрат</p>' +
            '<svg data-r="board" viewBox="0 0 640 520" role="group" aria-label="Фигура. Нажимайте на точки по очереди." data-phase="idle"></svg></div>' +
          '<div class="board" data-r="card2" hidden><p class="cap">2. Квадрат с хвостиком</p>' +
            '<svg data-r="board2" viewBox="0 0 640 520" role="group" aria-label="Фигура с хвостиком." data-phase="idle"></svg></div>' +
        '</div>' +
        '<div class="panel">' +
          '<dl class="stats" data-r="stats" data-timer="on">' +
            '<div class="stat"><dt>Попытка</dt><dd data-r="sAttempt">1</dd></div>' +
            '<div class="stat stat-time"><dt>Время</dt><dd data-r="sTime">0:00</dd></div>' +
            '<div class="stat"><dt>Линии</dt><dd data-r="sLines">0 / 0</dd></div>' +
          '</dl>' +
          '<p class="status" data-r="status" role="status" aria-live="polite"></p>' +
          '<div class="actions" data-r="actions"></div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    '<section class="finish" data-r="finishScreen" hidden>' +
      '<div class="finish-ico"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25l9 9 16-19"/></svg></div>' +
      '<h2>Все задания выполнены</h2>' +
      '<p>Спасибо! Можно закрыть эту страницу.</p>' +
    '</section>' +
    '<div class="cele" data-r="cele" hidden role="status" aria-live="polite">' +
      '<div class="cele-card">' +
        '<div class="cele-ico"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 25l9 9 16-19"/></svg></div>' +
        '<p class="cele-title" data-r="celeTitle">Супер!</p>' +
        '<p class="cele-sub" data-r="celeSub"></p>' +
        '<button class="btn primary" type="button" data-r="celeBtn" hidden>Начать основные пробы</button>' +
      '</div>' +
    '</div>' +
    '<div class="confetti" data-r="confetti" aria-hidden="true" hidden></div>';

  function mount(root, opt) {
    opt = opt || {};
    var cfg = { showTime: opt.showTime !== false, sound: opt.sound !== false };
    var TRAIN = opt.train || [], seq = opt.probes || [];
    var emit = opt.onEvent || function () {};
    root.classList.add('eg');
    root.innerHTML = TEMPLATE;
    var R = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-r]'), function (n) { R[n.getAttribute('data-r')] = n; });

    var idx = 0, results = [], S = null, tickTimer = null, flashTimer = null, alive = true;
    var clock = { t0: 0, paused: 0, pauseAt: null, frozen: null };
    var trainResults = [], tg = [];
    var demoRaf = null, demoEl = null, celeTimer = null, celeCb = null;

    function block() { return S && S.train ? 'train' : 'main'; }
    function num() { return S && S.train ? S.train : idx + 1; }

    function elapsed() {
      if (clock.frozen !== null) return clock.frozen;
      var now = clock.pauseAt !== null ? clock.pauseAt : performance.now();
      return now - clock.t0 - clock.paused;
    }
    function clockStart() { clock.t0 = performance.now(); clock.paused = 0; clock.pauseAt = null; clock.frozen = null; }
    function onVis() {
      if (!S || clock.frozen !== null) return;
      if (document.hidden) { if (clock.pauseAt === null) clock.pauseAt = performance.now(); }
      else if (clock.pauseAt !== null) { clock.paused += performance.now() - clock.pauseAt; clock.pauseAt = null; }
    }
    document.addEventListener('visibilitychange', onVis);
    function startTick() {
      stopTick();
      tickTimer = setInterval(function () {
        if (S && S.phase !== 'done' && S.phase !== 'skipped') R.sTime.textContent = fmt(elapsed());
      }, 250);
    }
    function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

    function newGame(p, svg) {
      var g = {
        probe: p, svg: svg, adj: buildAdj(p.V.length, p.E), used: [], nUsed: 0, cur: -1, start: -1,
        phase: 'idle', log: [], flash: '', nodes: [], usedLines: [], actSig: '', timeMs: 0,
        path: [], dragging: false, undos: 0, firstMove: null, rubber: null, btns: {}, train: 0, locked: false
      };
      for (var k = 0; k < p.E.length; k++) g.used.push(false);
      return g;
    }
    function setMode(m) {
      root.setAttribute('data-mode', m);
      var tr = m === 'train';
      R.card2.hidden = !tr;
      R.cap1.hidden = !tr;
      R.pKick.textContent = tr ? 'Обучение' : 'Проба';
      ['card1', 'card2'].forEach(function (id) { R[id].classList.remove('is-locked', 'is-done'); R[id].style.removeProperty('--bc'); });
      stopDemo();
    }
    function startedEvent() {
      emit('probe_start', { block: block(), n: num(), id: S.probe.id, file: S.probe.file, lines: S.probe.E.length });
      emitProgress();
    }
    function emitProgress() {
      if (S) emit('progress', { block: block(), n: num(), lines: S.nUsed, total: S.probe.E.length });
    }
    function showProbe(i) {
      hideCele();
      idx = i;
      var p = seq[i];
      root.style.setProperty('--pc', 'var(--h' + (i % 7) + ')');
      setMode('main');
      S = newGame(p, R.board);
      R.board.__game = S;
      R.probeScreen.hidden = false;
      R.finishScreen.hidden = true;
      R.pIdx.textContent = i + 1;
      R.pTotal.textContent = seq.length;
      R.stats.setAttribute('data-timer', cfg.showTime ? 'on' : 'off');
      buildSegs();
      buildBoard();
      clockStart();
      startTick();
      render();
      startedEvent();
    }
    function startMain(from) {
      hideCele();
      stopDemo();
      if ((from || 0) >= seq.length) { showFinish(false); return; }
      showProbe(from || 0);
    }
    function startTraining() {
      hideCele();
      trainResults = [];
      setMode('train');
      R.pTotal.textContent = TRAIN.length;
      R.stats.setAttribute('data-timer', cfg.showTime ? 'on' : 'off');
      tg = [];
      TRAIN.forEach(function (p, k) {
        var svg = k ? R.board2 : R.board;
        var g = newGame(p, svg);
        g.train = k + 1;
        g.locked = k > 0;
        svg.__game = g;
        S = g;
        buildBoard();
        R['card' + (k + 1)].style.setProperty('--bc', 'var(--h' + k + ')');
        tg.push(g);
      });
      activateTrain(0);
    }
    function activateTrain(k) {
      S = tg[k];
      S.locked = false;
      S.actSig = '';
      R.pIdx.textContent = k + 1;
      root.style.setProperty('--pc', 'var(--h' + k + ')');
      tg.forEach(function (g, i) {
        R['card' + (i + 1)].classList.toggle('is-locked', i > k);
        R['card' + (i + 1)].classList.toggle('is-done', i < k);
      });
      var box = R.segs;
      while (box.firstChild) box.removeChild(box.firstChild);
      tg.forEach(function (g, i) {
        var sg = document.createElement('span');
        sg.className = 'seg';
        sg.setAttribute('data-s', i < k ? 'done' : (i === k ? 'current' : ''));
        box.appendChild(sg);
      });
      clockStart();
      startTick();
      render();
      startedEvent();
      if (k === 0) {
        var me = S;
        setTimeout(function () { if (alive && S === me && me.phase === 'idle' && me.cur === -1) playDemo(); }, 700);
      }
    }

    /* ---------- подсказка-жест ---------- */
    function stopDemo() {
      if (demoRaf) { cancelAnimationFrame(demoRaf); demoRaf = null; }
      if (demoEl && demoEl.parentNode) demoEl.parentNode.removeChild(demoEl);
      demoEl = null;
    }
    function playDemo() {
      stopDemo();
      if (!S || !S.train || S.phase !== 'idle' || S.cur !== -1) return;
      var g = S, p = g.probe, pts = eulerWalk(p).map(function (v) { return p.V[v]; });
      var segs = [], total = 0, i;
      for (i = 1; i < pts.length; i++) {
        var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        segs.push(d); total += d;
      }
      var grp = el('g');
      var trail = el('path'); trail.setAttribute('class', 'demo-trail');
      var hand = el('g'); hand.setAttribute('class', 'demo-hand');
      var inner = el('g'); inner.setAttribute('transform', 'translate(-34.5,-18) scale(3)');
      inner.appendChild(el('path', { d: HAND })); hand.appendChild(inner);
      grp.appendChild(trail); grp.appendChild(hand);
      g.svg.appendChild(grp);
      demoEl = grp;
      var speed = 190, pre = 600, hold = 700, t0 = null;
      function frame(ts) {
        if (!demoEl) return;
        if (t0 === null) t0 = ts;
        var t = ts - t0, dist = Math.max(0, (t - pre) / 1000 * speed);
        if (dist > total) dist = total;
        var dd = 'M' + pts[0][0] + ' ' + pts[0][1], pos = pts[0], acc = 0;
        for (var k = 0; k < segs.length; k++) {
          var a = pts[k], b = pts[k + 1];
          if (dist >= acc + segs[k]) { dd += 'L' + b[0] + ' ' + b[1]; pos = b; acc += segs[k]; }
          else {
            var f = (dist - acc) / segs[k];
            pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            dd += 'L' + pos[0] + ' ' + pos[1];
            break;
          }
        }
        trail.setAttribute('d', dd);
        hand.setAttribute('transform', 'translate(' + pos[0] + ',' + pos[1] + ')');
        if (t < pre + total / speed * 1000 + hold) demoRaf = requestAnimationFrame(frame);
        else { demoRaf = null; stopDemo(); }
      }
      demoRaf = requestAnimationFrame(frame);
    }

    function buildSegs() {
      var box = R.segs;
      while (box.firstChild) box.removeChild(box.firstChild);
      seq.forEach(function (p, i) {
        var s = document.createElement('span');
        s.className = 'seg';
        if (i < idx) s.setAttribute('data-s', results[i] ? results[i].status : 'done');
        else if (i === idx) s.setAttribute('data-s', 'current');
        box.appendChild(s);
      });
    }
    function buildBoard() {
      var svg = S.svg;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var p = S.probe;
      var gBase = el('g'), gUsed = el('g'), gNodes = el('g');
      p.E.forEach(function (e) {
        var a = p.V[e[0]], b = p.V[e[1]];
        var at = { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
        var base = el('line', at); base.setAttribute('class', 'edge-base');
        var used = el('line', at); used.setAttribute('class', 'edge-used');
        gBase.appendChild(base);
        gUsed.appendChild(used);
        S.usedLines.push(used);
      });
      S.rubber = el('line', { x1: 0, y1: 0, x2: 0, y2: 0 });
      S.rubber.setAttribute('class', 'rubber');
      p.V.forEach(function (v, i) {
        var g = el('g');
        g.setAttribute('class', 'node');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', 'Точка ' + (i + 1));
        var pos = { cx: v[0], cy: v[1] };
        [['focusring', 29], ['halo', 30], ['startring', 25], ['dot', 17]].forEach(function (c) {
          var n = el('circle', pos); n.setAttribute('r', c[1]); n.setAttribute('class', c[0]); g.appendChild(n);
        });
        g.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onVertexKey(i); }
        });
        gNodes.appendChild(g);
        S.nodes.push(g);
      });
      svg.appendChild(gBase);
      svg.appendChild(gUsed);
      svg.appendChild(S.rubber);
      svg.appendChild(gNodes);
    }

    /* ---------- ввод ---------- */
    function svgPos(ev) {
      var svg = ev.currentTarget, pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      var m = svg.getScreenCTM();
      if (!m) return { x: -999, y: -999 };
      var q = pt.matrixTransform(m.inverse());
      return { x: q.x, y: q.y };
    }
    function vertexAt(pos) {
      var best = -1, bd = S.probe.hit || 38;
      S.probe.V.forEach(function (v, i) {
        var d = Math.hypot(pos.x - v[0], pos.y - v[1]);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    function startAt(v) {
      S.cur = S.start = v;
      S.phase = 'drawing';
      if (S.firstMove === null) S.firstMove = elapsed();
    }
    function setRubber(pos) {
      var A = S.probe.V[S.cur], r = S.rubber;
      if (!pos || !A) { r.style.opacity = 0; return; }
      r.setAttribute('x1', A[0]); r.setAttribute('y1', A[1]);
      r.setAttribute('x2', pos.x); r.setAttribute('y2', pos.y);
      r.style.opacity = 1;
    }
    function onDown(ev) {
      stopDemo();
      if (!S || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      var ph = S.phase;
      if (ph !== 'idle' && ph !== 'drawing') return;
      ev.preventDefault();
      ensureAudio(cfg.sound);
      var pos = svgPos(ev), v = vertexAt(pos);
      if (ph === 'idle') {
        if (v < 0) { sndFail(cfg.sound); return; }
        startAt(v);
      } else if (v !== S.cur) {
        sndFail(cfg.sound);
        return;
      }
      S.dragging = true;
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
      setRubber(pos);
      render();
    }
    function onMove(ev) {
      if (!S || !S.dragging) return;
      ev.preventDefault();
      var pos = svgPos(ev), v = vertexAt(pos);
      if (v >= 0 && v !== S.cur) {
        var r = lookup(S.adj, S.cur, v, S.used);
        if (r.free >= 0) { traverse(S.cur, v, r.free); return; }
      }
      setRubber(pos);
    }
    function onUp() {
      if (!S || !S.dragging) return;
      S.dragging = false;
      setRubber(null);
      render();
    }
    function onVertexKey(v) {
      if (!S) return;
      var ph = S.phase;
      if (ph === 'idle') { startAt(v); render(); return; }
      if (ph !== 'drawing' || v === S.cur) return;
      var r = lookup(S.adj, S.cur, v, S.used);
      if (r.free < 0) { flash(v, r.any >= 0 ? 'Эта линия уже пройдена.' : 'Эти точки не соединены линией.'); return; }
      traverse(S.cur, v, r.free);
    }
    function flash(v, text) {
      var n = S.nodes[v];
      n.classList.remove('shake');
      void n.getBoundingClientRect();
      n.classList.add('shake');
      S.flash = text;
      render();
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { if (S) { S.flash = ''; render(); } }, 1800);
    }
    function traverse(a, b, e) {
      var A = S.probe.V[a], B = S.probe.V[b], l = S.usedLines[e];
      S.used[e] = true;
      S.nUsed++;
      S.path.push({ e: e, from: a });
      S.cur = b;
      S.flash = '';
      l.setAttribute('x1', A[0]); l.setAttribute('y1', A[1]);
      l.setAttribute('x2', B[0]); l.setAttribute('y2', B[1]);
      var len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      l.style.strokeDasharray = len;
      l.style.strokeDashoffset = len;
      l.style.opacity = 1;
      void l.getBoundingClientRect();
      l.style.strokeDashoffset = 0;
      emitProgress();
      if (S.nUsed === S.probe.E.length) {
        S.dragging = false; setRubber(null);
        sndFanfare(cfg.sound);
        finish('done');
        celebrate();
      } else if (!hasMove(S.adj, S.cur, S.used)) {
        S.dragging = false; setRubber(null);
        deadEnd();
      } else {
        sndEdge(cfg.sound);
        if (S.dragging) setRubber(null);
      }
      render();
    }
    function deadEnd() {
      var me = S;
      S.phase = 'dead';
      S.flash = '';
      S.log.push({ o: 'dead', end: elapsed(), lines: S.nUsed });
      emit('attempt', { block: block(), n: num(), o: 'dead', lines: S.nUsed, total: S.probe.E.length, ms: Math.round(elapsed()) });
      sndSad(cfg.sound);
      setTimeout(function () { if (alive && S === me && S.phase === 'dead') resetAttempt(); }, 1700);
    }
    function resetAttempt() {
      for (var i = 0; i < S.used.length; i++) S.used[i] = false;
      S.nUsed = 0; S.cur = -1; S.start = -1; S.phase = 'idle'; S.flash = ''; S.path = []; S.dragging = false;
      setRubber(null);
      S.usedLines.forEach(function (l) { l.style.opacity = 0; l.style.strokeDasharray = ''; l.style.strokeDashoffset = ''; });
      render();
      emitProgress();
    }
    function restart() {
      if (S.phase !== 'drawing') return;
      if (S.nUsed > 0) {
        S.log.push({ o: 'restart', end: elapsed(), lines: S.nUsed });
        emit('attempt', { block: block(), n: num(), o: 'restart', lines: S.nUsed, total: S.probe.E.length, ms: Math.round(elapsed()) });
      }
      resetAttempt();
    }
    function undo() {
      if (!S || S.phase !== 'drawing' || !S.path.length) return;
      var m = S.path.pop(), l = S.usedLines[m.e];
      S.used[m.e] = false;
      S.nUsed--;
      S.cur = m.from;
      S.undos++;
      S.dragging = false;
      setRubber(null);
      l.style.opacity = 0; l.style.strokeDasharray = ''; l.style.strokeDashoffset = '';
      S.flash = '';
      render();
      emitProgress();
    }
    function skip() { finish('skipped'); next(); }
    function finish(status) {
      var end = elapsed();
      if (status === 'done') S.log.push({ o: 'done', end: end, lines: S.nUsed });
      else if (S.phase === 'drawing' && S.nUsed > 0) S.log.push({ o: 'skip', end: end, lines: S.nUsed });
      clock.frozen = end;
      S.phase = status;
      S.timeMs = end;
      S.flash = '';
      S.dragging = false;
      var r = {
        train: S.train, file: S.probe.file, status: status, attempts: S.log.length, ms: end,
        log: S.log.slice(), lines: S.probe.E.length, undos: S.undos, plan: S.firstMove
      };
      (S.train ? trainResults : results)[S.train ? S.train - 1 : idx] = r;
      emit('probe_end', {
        block: block(), n: num(), id: S.probe.id, file: S.probe.file, status: status, attempts: r.attempts,
        ms: Math.round(end), lines: r.lines, undos: r.undos, plan: r.plan === null ? null : Math.round(r.plan),
        log: r.log.map(function (a) { return { o: a.o, end: Math.round(a.end), lines: a.lines }; })
      });
      stopTick();
    }

    function hideCele() {
      clearTimeout(celeTimer); celeTimer = null; celeCb = null;
      R.cele.hidden = true; R.confetti.hidden = true;
      while (R.confetti.firstChild) R.confetti.removeChild(R.confetti.firstChild);
    }
    function celebrate() {
      var me = S, only = !!opt.only && !S.train, last = !S.train && !only && idx + 1 >= seq.length, ms = 2400, cb = advance;
      R.celeTitle.textContent = last ? 'Все пробы пройдены!' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
      R.celeSub.textContent = last ? '' : only ? 'Возвращаемся к карте заданий.' : 'Проба ' + (idx + 1) + ' из ' + seq.length + ' пройдена. Следующая сейчас появится.';
      R.celeBtn.hidden = true;
      if (me.train === 1) {
        R.celeSub.textContent = 'Теперь попробуйте фигуру с хвостиком.';
        ms = 1900;
        cb = function () { hideCele(); activateTrain(1); };
      } else if (me.train === 2) {
        R.celeTitle.textContent = 'Вы готовы!';
        R.celeSub.textContent = 'Обучение пройдено. Дальше основные пробы, ' + seq.length + ' фигур по очереди.';
        R.celeBtn.hidden = false;
        cb = null;
      }
      celeCb = cb;
      var box = R.confetti;
      while (box.firstChild) box.removeChild(box.firstChild);
      var cols = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--pc)'];
      for (var i = 0; i < 56; i++) {
        var p = document.createElement('i');
        p.style.left = (Math.random() * 100) + '%';
        p.style.background = cols[i % cols.length];
        p.style.setProperty('--d', (Math.random() * 0.5) + 's');
        p.style.setProperty('--t', (1.6 + Math.random() * 1.2) + 's');
        p.style.setProperty('--x', ((Math.random() - .5) * 240) + 'px');
        p.style.setProperty('--r', ((Math.random() - .5) * 1080) + 'deg');
        box.appendChild(p);
      }
      R.cele.hidden = false; box.hidden = false;
      clearTimeout(celeTimer);
      if (cb) celeTimer = setTimeout(function () { if (alive && S === me) cb(); }, ms);
    }
    function advance() { hideCele(); next(); }
    R.cele.addEventListener('click', function (ev) {
      if (ev.target === R.celeBtn) return;
      var f = celeCb; if (f && S && S.phase === 'done') f();
    });
    R.celeBtn.addEventListener('click', function () { hideCele(); startMain(0); });
    function next() {
      if (opt.only) { showFinish(false); return; }
      if (idx + 1 < seq.length) showProbe(idx + 1);
      else showFinish(true);
    }
    function showFinish(fresh) {
      hideCele();
      stopTick();
      S = null;
      R.probeScreen.hidden = true;
      R.finishScreen.hidden = !!opt.noFinish;
      if (fresh) emit('finish', { done: results.filter(function (r) { return r && r.status === 'done'; }).length, total: seq.length });
      if (opt.onFinish) opt.onFinish();
    }

    function actionsFor() {
      var ph = S.phase, list = [];
      if (ph === 'drawing' || ph === 'idle') {
        list.push({ k: 'undo', t: 'Отменить ход', c: 'secondary', f: undo, off: !(ph === 'drawing' && S.path.length) });
        list.push({ k: 'restart', t: 'Начать заново', c: 'secondary', f: restart, off: ph !== 'drawing' });
      }
      if (S.train && ph === 'idle') list.push({ k: 'demo', t: 'Показать, как', c: 'ghost', f: playDemo });
      if (!S.train && S.log.length >= 1 && (ph === 'idle' || ph === 'drawing' || ph === 'dead')) list.push({ k: 'skip', t: 'Пропустить пробу', c: 'ghost', f: skip });
      return list;
    }
    function render() {
      if (!S) return;
      var p = S.probe, ph = S.phase;
      var att = S.log.length + ((ph === 'idle' || ph === 'drawing') ? 1 : 0);
      R.sAttempt.textContent = att;
      R.sLines.textContent = S.nUsed + ' / ' + p.E.length;
      R.sTime.textContent = fmt(elapsed());
      var b = S.svg;
      b.setAttribute('data-phase', ph);
      b.parentNode.setAttribute('data-dead', ph === 'dead' ? '1' : '0');
      b.setAttribute('data-wait', (ph === 'drawing' && !S.dragging) ? '1' : '0');
      S.nodes.forEach(function (n, i) {
        n.classList.toggle('is-cur', i === S.cur);
        n.classList.toggle('is-start', i === S.start && ph !== 'idle');
      });
      var html;
      if (S.flash) html = S.flash;
      else if (ph === 'idle') html = S.train === 1 ? 'Нажмите на любую точку квадрата и, не отпуская, проведите линию по всем сторонам.' : S.train === 2 ? 'Теперь фигура с хвостиком. Подумайте, с какой точки лучше начать.' : 'Нажмите на любую точку и, не отпуская, ведите линию к соседним точкам.';
      else if (ph === 'drawing') html = S.dragging ? 'Ведите линию к соседней точке.' : 'Линия остановлена. Чтобы продолжить, нажмите на светящуюся точку.';
      else if (ph === 'dead') html = '<span class="bad">Тупик.</span> Из этой точки нет непройденных линий. Начинаем заново.';
      else if (ph === 'done') html = '<span class="good">Пройдено.</span> Все линии пройдены.' + (cfg.showTime ? ' Время ' + fmt(S.timeMs) + '.' : '');
      else html = 'Проба пропущена.';
      if (R.status.innerHTML !== html) R.status.innerHTML = html;
      var list = actionsFor();
      var sig = list.map(function (a) { return a.k; }).join();
      if (sig !== S.actSig) {
        S.actSig = sig;
        var box = R.actions;
        while (box.firstChild) box.removeChild(box.firstChild);
        S.btns = {};
        list.forEach(function (a) {
          var bt = document.createElement('button');
          bt.type = 'button';
          bt.className = 'btn ' + a.c;
          bt.textContent = a.t;
          bt.addEventListener('click', a.f);
          box.appendChild(bt);
          S.btns[a.k] = bt;
        });
      }
      list.forEach(function (a) { if (S.btns[a.k]) S.btns[a.k].disabled = !!a.off; });
    }
    function bindSvg(svg) {
      svg.addEventListener('pointerdown', function (ev) {
        var g = svg.__game;
        if (!g || g.locked) return;
        S = g;
        onDown(ev);
      });
      function guard(f) { return function (ev) { if (S && S.svg === svg) f(ev); }; }
      svg.addEventListener('pointermove', guard(onMove));
      svg.addEventListener('pointerup', guard(onUp));
      svg.addEventListener('pointercancel', guard(onUp));
      svg.addEventListener('lostpointercapture', guard(onUp));
    }
    bindSvg(R.board);
    bindSvg(R.board2);

    // Старт: с обучения или с указанной основной пробы (продолжение после перезагрузки).
    var from = opt.startAt || { block: TRAIN.length ? 'train' : 'main', n: 1 };
    if (from.block === 'train' && TRAIN.length) startTraining();
    else startMain((from.n || 1) - 1);

    return {
      destroy: function () {
        alive = false;
        stopTick(); stopDemo(); hideCele();
        document.removeEventListener('visibilitychange', onVis);
        root.innerHTML = '';
      }
    };
  }

  global.EulerGame = { mount: mount, fmt: fmt };
})(window);
