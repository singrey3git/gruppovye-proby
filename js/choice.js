// Движок тестов с выбором ответа. Сверху задание, снизу варианты.
// pick = 1: один вариант (как радиокнопки). pick > 1: нужно отметить ровно столько вариантов,
// иначе «Ответить» не нажимается. Верно ли ответил, ребёнку не показывается.
(function (global) {
  'use strict';
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function word(n) { return ['', 'одну', 'две', 'три', 'четыре', 'пять'][n] || String(n); }

  function mount(root, opt) {
    var seq = opt.probes || [], emit = opt.onEvent || function () {};
    var need = opt.pick || 1, multi = need > 1;
    var idx = 0, t0 = 0, firstPick = null, picks = [], changes = 0, alive = true, timer = null, hintTimer = null;
    root.classList.add('cg');
    if (opt.layout) root.setAttribute('data-layout', opt.layout);
    root.innerHTML = '';
    var head = h('header', { class: 'probe-head' }, [
      h('div', { class: 'probe-title' }, [h('span', { class: 'kicker', text: 'Задание' }), h('span', { class: 'num' }), h('span', { class: 'of' })]),
      h('div', { class: 'segs', 'aria-hidden': 'true' })
    ]);
    var stim = h('div', { class: 'cg-stim' }, [h('img', { alt: 'Задание' })]);
    var ask = h('p', { class: 'cg-ask', text: opt.ask || 'Какая картинка подходит вместо знака вопроса? Нажми на неё.' });
    var count = multi ? h('p', { class: 'cg-count', role: 'status', 'aria-live': 'polite' }) : null;
    var opts = h('div', { class: 'cg-opts', role: multi ? 'group' : 'radiogroup', 'aria-label': 'Варианты ответа' });
    var go = h('button', { class: 'btn primary big', type: 'button', text: 'Ответить', disabled: 'disabled' });
    var wrap = h('section', { class: 'cg-screen' }, [head, stim, ask, opts, h('div', { class: 'cg-go' }, [count, go])]);
    root.appendChild(wrap);

    // Фигура в том же масштабе, что и части: ширина = scale × ширина плитки.
    function fit() {
      var p = seq[idx], img = stim.querySelector('img'), tile = opts.firstChild;
      if (!p || !p.scale || !tile) return;
      var w = Math.min(p.scale * tile.clientWidth, stim.clientWidth - 24);
      img.style.width = Math.round(w) + 'px';
      img.style.maxHeight = 'none';
    }
    window.addEventListener('resize', fit);
    function segs() {
      var box = head.querySelector('.segs');
      box.innerHTML = '';
      seq.forEach(function (p, i) { box.appendChild(h('span', { class: 'seg', 'data-s': i < idx ? 'done' : i === idx ? 'current' : '' })); });
    }
    function renderPicks() {
      Array.prototype.forEach.call(opts.children, function (b, i) { b.setAttribute('aria-checked', picks.indexOf(i) >= 0 ? 'true' : 'false'); });
      go.disabled = picks.length !== need;
      if (count) {
        count.classList.remove('warn');
        count.textContent = picks.length === need ? 'Выбрано ' + need + '. Можно отвечать.' : 'Выбрано ' + picks.length + ' из ' + need;
      }
    }
    function toggle(k) {
      if (firstPick === null) firstPick = performance.now() - t0;
      var at = picks.indexOf(k);
      if (!multi) {
        if (at >= 0) return;
        if (picks.length) changes++;
        picks = [k];
      } else if (at >= 0) {
        picks.splice(at, 1); changes++;
      } else if (picks.length >= need) {
        // Больше нельзя: подсказать, что сначала нужно снять одну картинку.
        count.textContent = 'Уже выбрано ' + need + '. Чтобы выбрать другую, сначала нажми на выбранную.';
        count.classList.add('warn');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { if (alive) renderPicks(); }, 2600);
        return;
      } else picks.push(k);
      renderPicks();
    }
    function show(i) {
      idx = i;
      var p = seq[i];
      picks = []; changes = 0; firstPick = null;
      root.style.setProperty('--pc', 'var(--h' + (i % 7) + ')');
      head.querySelector('.num').textContent = i + 1;
      head.querySelector('.of').textContent = 'из ' + seq.length;
      segs();
      var im = stim.querySelector('img');
      im.style.width = ''; im.style.maxHeight = '';
      im.src = p.img;
      opts.innerHTML = '';
      p.options.forEach(function (src, k) {
        var b = h('button', { type: 'button', class: 'cg-opt', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false', 'aria-label': 'Вариант ' + (k + 1) }, [h('img', { src: src, alt: '' })]);
        b.addEventListener('click', function () { toggle(k); });
        opts.appendChild(b);
      });
      renderPicks();
      fit();
      wrap.classList.remove('leaving');
      t0 = performance.now();
      emit('probe_start', { block: 'main', n: i + 1, id: p.id, options: p.options.length });
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    go.addEventListener('click', function () {
      if (picks.length !== need || go.disabled) return;
      go.disabled = true;
      var p = seq[idx], ms = Math.round(performance.now() - t0);
      var chosen = picks.map(function (k) { return k + 1; }).sort(function (a, b) { return a - b; });
      var ans = [].concat(p.answer);
      var hits = chosen.filter(function (n) { return ans.indexOf(n) >= 0; }).length;
      emit('probe_end', {
        block: 'main', n: idx + 1, id: p.id, status: 'answered',
        choice: multi ? chosen : chosen[0], answer: p.answer, hits: hits,
        correct: hits === ans.length && chosen.length === ans.length,
        ms: ms, plan: Math.round(firstPick), changes: changes, attempts: 1
      });
      wrap.classList.add('leaving');
      timer = setTimeout(function () {
        if (!alive) return;
        if (!opt.only && idx + 1 < seq.length) show(idx + 1);
        else { if (!opt.only) emit('finish', { total: seq.length }); if (opt.onFinish) opt.onFinish(); }
      }, 450);
    });
    show(Math.max(0, ((opt.startAt && opt.startAt.n) || 1) - 1));
    return { destroy: function () { alive = false; clearTimeout(timer); clearTimeout(hintTimer); window.removeEventListener('resize', fit); root.innerHTML = ''; } };
  }
  global.ChoiceGame = { mount: mount, word: word };
})(window);
