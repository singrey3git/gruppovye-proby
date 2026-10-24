// Хранилище и связь в реальном времени. Два варианта с одинаковым набором функций:
//  - DemoBackend: всё в этом браузере (localStorage + BroadcastChannel между вкладками);
//  - SupabaseBackend: настоящая база, дети заходят со своих устройств.
(function (global) {
  'use strict';

  var ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function makeCode() {
    var s = '';
    for (var i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
    return s;
  }
  function uid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  var ERR = {
    session_not_found: 'Тест с таким кодом не найден. Проверьте ссылку у преподавателя.',
    session_closed: 'Вход в этот тест закрыт преподавателем.',
    session_full: 'В этом тесте уже слишком много участников.',
    pin_not_found: 'Такого номера в этом тесте нет. Проверь цифры или спроси преподавателя.',
    name_required: 'Напишите имя.',
    bad_token: 'Не получилось продолжить. Войдите заново.'
  };
  function niceError(e) {
    var m = (e && (e.message || e.msg)) || String(e || '');
    for (var k in ERR) if (m.indexOf(k) >= 0) return new Error(ERR[k]);
    if (/Anonymous sign-ins are disabled/i.test(m)) return new Error('В Supabase не включён анонимный вход (Authentication → Sign In / Providers → Allow anonymous sign-ins).');
    if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Нет связи с сервером. Проверьте интернет.');
    return new Error(m || 'Что-то пошло не так.');
  }

  /* ================= Демо ================= */
  function DemoBackend() {
    var KEY = 'egdemo:v1', mem = null, bc = null, listeners = [];
    try { bc = new BroadcastChannel('egdemo'); bc.onmessage = function (e) { fire(e.data); }; } catch (e) {}
    // Запасной канал между вкладками: событие storage (на случай, если BroadcastChannel недоступен).
    try {
      window.addEventListener('storage', function (e) {
        if (e.key === 'egdemo:msg' && e.newValue) try { fire(JSON.parse(e.newValue).m); } catch (x) {}
      });
    } catch (e) {}
    function fire(msg) { listeners.slice().forEach(function (f) { try { f(msg); } catch (e) { console.error(e); } }); }
    function post(msg) {
      fire(msg);
      if (bc) try { bc.postMessage(msg); } catch (e) {}
      try { localStorage.setItem('egdemo:msg', JSON.stringify({ m: msg, r: Math.random() })); } catch (e) {}
    }
    function load() {
      try { var s = localStorage.getItem(KEY); if (s) { mem = JSON.parse(s); return mem; } } catch (e) {}
      return mem || (mem = { teachers: {}, me: null, sessions: [], participants: [], events: [], seq: 0 });
    }
    function save(d) { mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    function pub(s) { return s ? { code: s.code, title: s.title, opts: s.opts, status: s.status } : null; }
    function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 60); }); }

    var api = {
      mode: 'demo',
      getUser: function () { var d = load(); return wait(d.me ? d.teachers[d.me] || null : null); },
      signIn: function (name) {
        var d = load(), key = name.trim().toLowerCase();
        if (!d.teachers[key]) d.teachers[key] = { id: 't:' + key, name: name.trim() };
        d.me = key; save(d);
        return wait(d.teachers[key]);
      },
      signOut: function () { var d = load(); d.me = null; save(d); return wait(true); },
      listSessions: function () {
        var d = load(), me = d.me && d.teachers[d.me];
        return wait(d.sessions.filter(function (s) { return me && s.teacher_id === me.id; }).reverse());
      },
      createSession: function (title, opts) {
        var d = load(), me = d.teachers[d.me];
        var code; do { code = makeCode(); } while (d.sessions.some(function (s) { return s.code === code; }));
        var s = { id: uid(), code: code, teacher_id: me.id, title: title, opts: opts, status: 'open', created_at: new Date().toISOString() };
        d.sessions.push(s); save(d);
        return wait(s);
      },
      setStatus: function (s, status) {
        var d = load();
        d.sessions.forEach(function (x) { if (x.id === s.id) x.status = status; });
        save(d); s.status = status;
        return wait(s);
      },
      loadSession: function (s) {
        var d = load();
        return wait({
          participants: d.participants.filter(function (p) { return p.session_id === s.id; }),
          events: d.events.filter(function (e) { return e.session_id === s.id; })
        });
      },
      setStage: function (s, pid, stage) {
        var d = load();
        d.participants.forEach(function (p) { if (p.id === pid) p.stage = stage; });
        save(d);
        post({ type: 'stage', code: s.code, pid: pid, stage: stage });
        return wait(true);
      },
      watchSession: function (s, h) {
        var seen = {};
        function onMsg(m) {
          if (m.type === 'stage' && m.code === s.code) { if (h.onStage) h.onStage(m.pid, m.stage); return; }
          if (m.type === 'participant' && m.row.session_id === s.id) h.onParticipant(m.row);
          else if (m.type === 'event' && m.row.session_id === s.id) h.onEvent(m.row);
          else if (m.type === 'presence' && m.code === s.code) { seen[m.pid] = { at: Date.now(), state: m.state }; push(); }
          else if (m.type === 'leave' && m.code === s.code) { delete seen[m.pid]; push(); }
        }
        function push() {
          var out = {}, now = Date.now();
          for (var k in seen) if (now - seen[k].at < 9000) out[k] = seen[k].state;
          h.onPresence(out);
        }
        listeners.push(onMsg);
        var t = setInterval(push, 2000);
        if (h.onStatus) h.onStatus('live');
        return function () { clearInterval(t); listeners = listeners.filter(function (f) { return f !== onMsg; }); };
      },
      kid: function () {
        var me = null, code = null, last = null, hb = null, stageFns = [];
        listeners.push(function (m) {
          if (m.type === 'stage' && me && m.pid === me.id) stageFns.forEach(function (f) { f(m.stage); });
        });
        return {
          onStage: function (f) { stageFns.push(f); },
          getSession: function (c) {
            var d = load(), s = d.sessions.filter(function (x) { return x.code === String(c).toUpperCase(); })[0];
            return wait(pub(s));
          },
          join: function (c, name, birth) {
            var d = load(), s = d.sessions.filter(function (x) { return x.code === String(c).toUpperCase(); })[0];
            if (!s) return Promise.reject(niceError('session_not_found'));
            if (s.status !== 'open') return Promise.reject(niceError('session_closed'));
            var pin; do { pin = ('000' + Math.floor(Math.random() * 10000)).slice(-4); }
            while (d.participants.some(function (x) { return x.session_id === s.id && x.pin === pin; }));
            var p = { id: uid(), session_id: s.id, name: name, birth: birth, token: uid(), stage: 'r1', pin: pin, joined_at: new Date().toISOString() };
            d.participants.push(p); save(d);
            me = p; code = s.code;
            post({ type: 'participant', row: p });
            return wait({ pid: p.id, token: p.token, pin: pin });
          },
          rejoin: function (c, pin) {
            var d = load(), s = d.sessions.filter(function (x) { return x.code === String(c).toUpperCase(); })[0];
            var p = s && d.participants.filter(function (x) { return x.session_id === s.id && x.pin === pin; })[0];
            if (!p) return Promise.reject(niceError('pin_not_found'));
            return wait({ pid: p.id, token: p.token, pin: p.pin });
          },
          resume: function (pid, token) {
            var d = load(), p = d.participants.filter(function (x) { return x.id === pid && x.token === token; })[0];
            if (!p) return Promise.reject(niceError('bad_token'));
            var s = d.sessions.filter(function (x) { return x.id === p.session_id; })[0];
            me = p; code = s.code;
            return wait({ participant: p, session: pub(s), events: d.events.filter(function (e) { return e.participant_id === pid; }) });
          },
          log: function (kind, data) {
            var d = load();
            var row = { id: ++d.seq, session_id: me.session_id, participant_id: me.id, kind: kind, data: data, created_at: new Date().toISOString() };
            d.events.push(row); save(d);
            post({ type: 'event', row: row });
            return Promise.resolve(row.id);
          },
          presence: function (state) {
            last = state;
            post({ type: 'presence', code: code, pid: me.id, state: state });
            if (!hb) hb = setInterval(function () { if (last) post({ type: 'presence', code: code, pid: me.id, state: last }); }, 3000);
          },
          close: function () {
            clearInterval(hb); hb = null;
            if (me) post({ type: 'leave', code: code, pid: me.id });
          }
        };
      }
    };
    return api;
  }

  /* ================= Supabase ================= */
  function SupabaseBackend(url, key) {
    var sb = global.supabase.createClient(url, key, { auth: { persistSession: true, storageKey: 'eg-auth' } });
    function ok(res) { if (res.error) throw niceError(res.error); return res.data; }
    var liveCh = null;
    function toUser(u) { return u ? { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || 'Преподаватель' } : null; }

    return {
      mode: 'supabase',
      getUser: function () {
        return sb.auth.getSession().then(function (r) { return toUser(r.data && r.data.session && r.data.session.user); });
      },
      // Анонимный вход: имя хранится в профиле, доступ к своим запускам остаётся в этом браузере.
      signIn: function (name) {
        name = name.trim();
        return sb.auth.getSession().then(function (r) {
          var u = r.data && r.data.session && r.data.session.user;
          if (u) return sb.auth.updateUser({ data: { name: name } }).then(function (x) { return toUser(ok(x).user); });
          return sb.auth.signInAnonymously({ options: { data: { name: name } } }).then(function (x) { return toUser(ok(x).user); });
        });
      },
      signOut: function () { return sb.auth.signOut(); },
      listSessions: function () {
        return sb.from('sessions').select('*').order('created_at', { ascending: false }).then(ok);
      },
      createSession: function (title, opts) {
        function attempt(n) {
          return sb.from('sessions').insert({ code: makeCode(), title: title, opts: opts }).select().single().then(function (r) {
            if (r.error && r.error.code === '23505' && n < 5) return attempt(n + 1);
            return ok(r);
          });
        }
        return attempt(0);
      },
      setStatus: function (s, status) {
        return sb.from('sessions').update({ status: status }).eq('id', s.id).select().single().then(function (r) { s.status = ok(r).status; return s; });
      },
      loadSession: function (s) {
        return Promise.all([
          sb.from('participants').select('id,session_id,name,birth,stage,pin,joined_at').eq('session_id', s.id).order('joined_at').then(ok),
          sb.from('events').select('*').eq('session_id', s.id).order('id').limit(10000).then(ok)
        ]).then(function (a) { return { participants: a[0], events: a[1] }; });
      },
      setStage: function (s, pid, stage) {
        return sb.from('participants').update({ stage: stage }).eq('id', pid).then(function (r) {
          ok(r);
          if (liveCh) liveCh.send({ type: 'broadcast', event: 'stage', payload: { pid: pid, stage: stage } });
          return true;
        });
      },
      watchSession: function (s, h) {
        var ch = sb.channel('room:' + s.code, { config: { presence: { key: 'teacher' } } });
        liveCh = ch;
        ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: 'session_id=eq.' + s.id }, function (p) { h.onParticipant(p.new); })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: 'session_id=eq.' + s.id }, function (p) { h.onEvent(p.new); })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participants', filter: 'session_id=eq.' + s.id }, function (p) { if (h.onStage) h.onStage(p.new.id, p.new.stage); })
          .on('presence', { event: 'sync' }, function () {
            var st = ch.presenceState(), out = {};
            Object.keys(st).forEach(function (k) {
              if (k === 'teacher') return;
              var metas = st[k]; if (metas && metas.length) out[k] = metas[metas.length - 1];
            });
            h.onPresence(out);
          })
          .subscribe(function (status) { if (h.onStatus) h.onStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'off' : 'wait'); });
        return function () { if (liveCh === ch) liveCh = null; sb.removeChannel(ch); };
      },
      kid: function () {
        var pid = null, token = null, ch = null, last = null, joined = false, stageFns = [], stageNow = null, poll = null;
        function gotStage(st) { if (st && st !== stageNow) { stageNow = st; stageFns.forEach(function (f) { f(st); }); } }
        function startPoll() {
          if (poll) return;
          // Запасной путь: раз в 15 секунд спросить этап, если сообщение по каналу потерялось.
          poll = setInterval(function () {
            sb.rpc('kid_state', { p_pid: pid, p_token: token }).then(function (r) { if (!r.error && r.data) gotStage(r.data); });
          }, 15000);
        }
        var queue = [], busy = false;
        function flush() {
          if (busy || !queue.length) return;
          busy = true;
          var item = queue[0];
          sb.rpc('log_event', { p_pid: pid, p_token: token, p_kind: item.kind, p_data: item.data }).then(function (r) {
            busy = false;
            if (r.error) { item.tries = (item.tries || 0) + 1; if (item.tries > 20) queue.shift(); setTimeout(flush, Math.min(8000, 500 * item.tries)); return; }
            queue.shift(); flush();
          }, function () { busy = false; setTimeout(flush, 2000); });
        }
        function openChannel(code) {
          ch = sb.channel('room:' + code, { config: { presence: { key: pid } } });
          ch.on('broadcast', { event: 'stage' }, function (m) { if (m.payload && m.payload.pid === pid) gotStage(m.payload.stage); });
          startPoll();
          ch.subscribe(function (status) {
            if (status === 'SUBSCRIBED') { joined = true; if (last) ch.track(last); }
          });
        }
        return {
          getSession: function (code) {
            return sb.rpc('session_info', { p_code: code }).then(function (r) { return ok(r) || null; });
          },
          join: function (code, name, birth) {
            return sb.rpc('join_session', { p_code: code, p_name: name, p_birth: birth }).then(function (r) {
              var d = ok(r); pid = d.pid; token = d.token; stageNow = 'r1'; openChannel(code.toUpperCase()); return d;
            });
          },
          rejoin: function (code, pin) {
            return sb.rpc('rejoin_session', { p_code: code, p_pin: pin }).then(ok);
          },
          resume: function (p, t) {
            return sb.rpc('resume_participant', { p_pid: p, p_token: t }).then(function (r) {
              var d = ok(r); pid = p; token = t; stageNow = d.participant.stage || 'r1'; openChannel(d.session.code); return d;
            });
          },
          onStage: function (f) { stageFns.push(f); },
          log: function (kind, data) { queue.push({ kind: kind, data: data }); flush(); return Promise.resolve(); },
          presence: function (state) { last = state; if (ch && joined) ch.track(state); },
          close: function () { clearInterval(poll); if (ch) sb.removeChannel(ch); }
        };
      }
    };
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Не удалось загрузить библиотеку Supabase.')); };
      document.head.appendChild(s);
    });
  }

  global.Backend = {
    init: function () {
      var c = global.APP_CONFIG || {};
      if (c.SUPABASE_URL && c.SUPABASE_KEY) {
        return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0/dist/umd/supabase.js')
          .then(function () { return SupabaseBackend(c.SUPABASE_URL, c.SUPABASE_KEY); });
      }
      return Promise.resolve(DemoBackend());
    }
  };
})(window);
