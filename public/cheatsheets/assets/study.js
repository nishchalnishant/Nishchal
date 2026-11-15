/* Cheatsheets — study mode: Known / Review marks, progress, filters, flashcard drill. Saved in this browser only. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = 'cs.study.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('cs.' + k); localStorage.setItem('cs.' + k, v); } catch (e) { return null; } };
  let S = load();
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  document.addEventListener('DOMContentLoaded', () => {
    const cards = $$('main .card[data-skey]');
    if (!cards.length) return;
    cards.forEach(addControl);
    initCodeTabs();
    initPanel(cards);
    applyFilter();
    refresh();
    window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); cards.forEach(paint); refresh(); applyFilter(); } });
  });

  /* ---------- per-card control ---------- */
  function addControl(card) {
    const h3 = $('h3', card); if (!h3) return;
    const box = document.createElement('span'); box.className = 'st-ctl';
    box.innerHTML = '<button type="button" class="st-k" title="Mark as known" aria-pressed="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.2 3L13 4.5"/></svg><span>Known</span></button>' +
      '<button type="button" class="st-r" title="Mark for review" aria-pressed="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/></svg><span>Review</span></button>';
    const anchor = $('.anchor', h3);
    h3.insertBefore(box, anchor || null);
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const want = b.classList.contains('st-k') ? 'k' : 'r';
      const k = card.dataset.skey;
      if (S[k] === want) delete S[k]; else S[k] = want;
      save(S); paint(card); refresh(); applyFilter();
    });
    paint(card);
  }
  function paint(card) {
    const v = S[card.dataset.skey];
    card.classList.toggle('st-known', v === 'k');
    card.classList.toggle('st-review', v === 'r');
    const k = $('.st-k', card), r = $('.st-r', card);
    if (k) k.setAttribute('aria-pressed', String(v === 'k'));
    if (r) r.setAttribute('aria-pressed', String(v === 'r'));
  }

  /* ---------- progress in rail + hero ---------- */
  function refresh() {
    const all = $$('main .card[data-skey]');
    const known = all.filter(c => S[c.dataset.skey] === 'k').length;
    const review = all.filter(c => S[c.dataset.skey] === 'r').length;
    const hero = $('#studyStat');
    if (hero) hero.innerHTML = `<b>${all.length ? Math.round(known * 100 / all.length) : 0}%</b>known`;
    const sum = $('#stSummary');
    if (sum) sum.textContent = `${known} known · ${review} to review · ${all.length - known - review} not started`;
    const btn = $('#studyBtn .st-count'); if (btn) btn.textContent = review ? String(review) : '';
    $$('#railList > li').forEach(li => {
      const sec = document.getElementById(li.dataset.sec); if (!sec) return;
      const cs = $$('.card[data-skey]', sec); if (!cs.length) return;
      const kn = cs.filter(c => S[c.dataset.skey] === 'k').length, rv = cs.filter(c => S[c.dataset.skey] === 'r').length;
      let bar = $(':scope > a .st-bar', li);
      if (!bar) { bar = document.createElement('span'); bar.className = 'st-bar'; bar.innerHTML = '<i class="k"></i><i class="r"></i>'; $(':scope > a', li).appendChild(bar); }
      bar.title = `${kn}/${cs.length} known${rv ? `, ${rv} to review` : ''}`;
      bar.children[0].style.width = (kn * 100 / cs.length) + '%';
      bar.children[1].style.width = (rv * 100 / cs.length) + '%';
      bar.classList.toggle('done', kn === cs.length);
      bar.classList.toggle('zero', !kn && !rv);
    });
  }

  /* ---------- filter ---------- */
  function applyFilter() {
    const f = pref('studyFilter') || 'all';
    $$('input[name="stf"]').forEach(i => { i.checked = i.value === f; });
    document.body.classList.toggle('st-filtering', f !== 'all');
    $$('main .card').forEach(c => {
      const v = S[c.dataset.skey];
      const show = f === 'all' || (f === 'review' && v === 'r') || (f === 'todo' && !v) || (f === 'known' && v === 'k');
      c.classList.toggle('st-hidden', !show);
    });
    $$('main section.sec').forEach(s => {
      const anyCard = $$('.card', s).length;
      const vis = $$('.card', s).some(c => !c.classList.contains('st-hidden'));
      s.classList.toggle('st-sec-hidden', anyCard > 0 && !vis);
      if (!anyCard) s.classList.toggle('st-sec-hidden', f !== 'all');
    });
    $$('#railList > li').forEach(li => { const s = document.getElementById(li.dataset.sec); li.classList.toggle('st-sec-hidden', !!s && s.classList.contains('st-sec-hidden')); });
    const note = $('#stFilterNote');
    if (note) {
      const n = $$('main .card:not(.st-hidden)').length;
      note.hidden = f === 'all';
      note.querySelector('span').textContent = `Showing ${n} ${f === 'review' ? 'cards to review' : f === 'known' ? 'known cards' : 'cards not started'}.`;
    }
    if (window.__csRefit) setTimeout(window.__csRefit, 0);
  }

  /* ---------- study panel (top bar) ---------- */
  function initPanel(cards) {
    const btn = $('#studyBtn'), panel = $('#studyPanel'); if (!btn || !panel) return;
    const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
    document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
    panel.addEventListener('change', e => { if (e.target.name === 'stf') { pref('studyFilter', e.target.value); applyFilter(); } });
    $('#stDrill').addEventListener('click', () => { close(); openDrill(); });
    $('#stReset').addEventListener('click', () => {
      const b = $('#stReset');
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again to clear this sheet'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset this sheet'; }, 3000); return; }
      cards.forEach(c => delete S[c.dataset.skey]); save(S); cards.forEach(paint); refresh(); applyFilter();
      delete b.dataset.armed; b.textContent = 'Reset this sheet';
    });
    const clr = $('#stFilterNote button'); if (clr) clr.addEventListener('click', () => { pref('studyFilter', 'all'); applyFilter(); });
  }

  /* ---------- code language tabs ---------- */
  function initCodeTabs() {
    const pairs = $$('.code-pair'); if (!pairs.length) return;
    const set = l => { document.documentElement.dataset.lang = l; pref('lang', l); $$('.lang-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === l))); };
    pairs.forEach(p => {
      const t = document.createElement('div'); t.className = 'lang-tabs'; t.setAttribute('role', 'group'); t.setAttribute('aria-label', 'Language');
      t.innerHTML = '<button type="button" data-l="py">Python</button><button type="button" data-l="java">Java</button>';
      t.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.l); });
      p.parentNode.insertBefore(t, p);
    });
    set(pref('lang') || 'py');
  }

  /* ---------- flashcard drill ---------- */
  function decks() {
    const out = [];
    const rowsFrom = (tables, ctxOf, frontRe) => {
      const items = [];
      tables.forEach(tb => {
        const trs = $$('tr', tb);
        const headRow = trs.find(r => r.querySelector('th'));
        const heads = headRow ? $$('th', headRow).map(th => th.textContent.trim()) : [];
        const fc = frontRe ? Math.max(0, heads.findIndex(h => frontRe.test(h))) : 0;
        trs.forEach(r => {
          if (r === headRow) return;
          const tds = $$('td', r); if (tds.length < 2) return;
          const front = (tds[fc] || tds[0]).textContent.trim(); if (!front || front.length > 160) return;
          const back = tds.map((td, i) => [heads[i] || '', td.innerHTML.trim(), i]).filter(x => x[2] !== fc && x[1]).map(x => [x[0], x[1]]);
          if (!back.length) return;
          items.push({ front, fh: heads[fc] || '', back, ctx: ctxOf(tb) });
        });
      });
      return items;
    };
    const ctx = tb => { const c = tb.closest('.card'); const h = c && $('h3', c); return h ? (h.dataset.label || h.textContent) : ''; };
    const cardTables = cs => cs.flatMap(c => $$('table', c));
    const all = $$('main .card');
    out.push({ id: 'all', name: 'Whole sheet', items: rowsFrom(cardTables(all), ctx) });
    const rv = all.filter(c => S[c.dataset.skey] === 'r');
    if (rv.length) out.push({ id: 'review', name: `Cards marked Review (${rv.length})`, items: rowsFrom(cardTables(rv), ctx) });
    const pt = $('#ptab'); if (pt) out.push({ id: 'problems', name: 'Problem bank', items: rowsFrom([pt], () => 'Problem bank', /problem/i) });
    $$('main section.sec').forEach(s => {
      const items = rowsFrom(cardTables($$('.card', s)), ctx);
      if (items.length >= 4) out.push({ id: 'sec:' + s.id, name: 'Section: ' + ($('h2', s).dataset.label || $('h2', s).textContent), items });
    });
    return out.filter(d => d.items.length);
  }

  let D = null;
  function openDrill() {
    let m = $('#drill');
    if (!m) {
      m = document.createElement('div'); m.id = 'drill'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Flashcards');
      m.innerHTML = `<div class="dr-box">
        <div class="dr-top"><select id="drDeck" aria-label="Deck"></select><span class="dr-prog" id="drProg"></span><button type="button" class="iconbtn" id="drClose">Close</button></div>
        <div class="dr-bar"><i id="drBar"></i></div>
        <div class="dr-card" id="drCard"></div>
        <div class="dr-actions" id="drActions"></div>
        <div class="dr-keys">Space: show answer · 1: again · 2: got it · Esc: close</div></div>`;
      document.body.appendChild(m);
      $('#drClose').addEventListener('click', closeDrill);
      m.addEventListener('click', e => { if (e.target === m) closeDrill(); });
      $('#drDeck').addEventListener('change', e => startDeck(e.target.value));
      document.addEventListener('keydown', e => {
        if (!m.classList.contains('open')) return;
        if (e.key === 'Escape') closeDrill();
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (D && !D.shown) reveal(); else if (D && D.shown) answer(true); }
        else if (e.key === '1' && D && D.shown) answer(false);
        else if (e.key === '2' && D && D.shown) answer(true);
      });
    }
    const ds = decks(); m._decks = ds;
    $('#drDeck').innerHTML = ds.map(d => `<option value="${esc(d.id)}">${esc(d.name)} · ${d.items.length}</option>`).join('');
    const last = pref('drillDeck'); const pick = ds.find(d => d.id === last) ? last : ds[0].id;
    $('#drDeck').value = pick;
    m.classList.add('open'); document.documentElement.classList.add('viewer-open');
    startDeck(pick);
  }
  function closeDrill() { const m = $('#drill'); if (m) m.classList.remove('open'); document.documentElement.classList.remove('viewer-open'); }
  function startDeck(id) {
    pref('drillDeck', id);
    const deck = $('#drill')._decks.find(d => d.id === id);
    const q = deck.items.slice();
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    D = { q, total: q.length, done: 0, again: 0, shown: false };
    show();
  }
  function show() {
    const card = $('#drCard'), act = $('#drActions');
    $('#drProg').textContent = `${D.done} / ${D.total} done`;
    $('#drBar').style.width = (D.done * 100 / D.total) + '%';
    if (!D.q.length) {
      card.innerHTML = `<div class="dr-end"><b>Deck complete</b><span>${D.total} cards · ${D.again} repeated</span></div>`;
      act.innerHTML = '<button type="button" class="dr-btn primary" id="drAgainDeck">Shuffle and restart</button>';
      $('#drAgainDeck').addEventListener('click', () => startDeck($('#drDeck').value));
      return;
    }
    const it = D.q[0]; D.shown = false;
    card.innerHTML = `<div class="dr-ctx">${esc(it.ctx)}${it.fh ? ' · ' + esc(it.fh) : ''}</div><div class="dr-front">${esc(it.front)}</div><div class="dr-back" hidden>${it.back.map(([h, v]) => `<div class="dr-row">${h ? `<span>${esc(h)}</span>` : ''}<div>${v}</div></div>`).join('')}</div>`;
    act.innerHTML = '<button type="button" class="dr-btn primary" id="drShow">Show answer</button>';
    $('#drShow').addEventListener('click', reveal);
    $('#drShow').focus();
  }
  function reveal() {
    D.shown = true; $('.dr-back', $('#drCard')).hidden = false;
    const act = $('#drActions');
    act.innerHTML = '<button type="button" class="dr-btn" id="drNo">Again</button><button type="button" class="dr-btn primary" id="drYes">Got it</button>';
    $('#drNo').addEventListener('click', () => answer(false)); $('#drYes').addEventListener('click', () => answer(true));
    $('#drYes').focus();
  }
  function answer(ok) {
    const it = D.q.shift();
    if (ok) D.done++; else { D.again++; D.q.splice(Math.min(D.q.length, 3 + Math.floor(Math.random() * 3)), 0, it); }
    show();
  }
})();

/* ---------- recall quiz: spaced repetition over each card's "Check yourself" questions ---------- */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = 'cs.srs.v1', DAY = 864e5, NEW_PER_SESSION = 20;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('cs.' + k); localStorage.setItem('cs.' + k, v); } catch (e) { return null; } };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let R = load(), Q = null, items = [];

  function collect() {
    return $$('main .card li[data-rq]').map(li => {
      const card = li.closest('.card'), h3 = card && $('h3', card), sec = li.closest('section.sec');
      const k = card && $('.rc-k', card);
      return { id: li.dataset.rq, li, card, sec: sec ? sec.id : '', q: $('.rc-q', li).innerHTML, a: $('.rc-a p', li).innerHTML,
        k: k ? k.innerHTML.replace(/<b>Takeaway<\/b>\s*/, '') : '', ctx: h3 ? (h3.dataset.label || h3.textContent) : '' };
    });
  }
  const isDue = (it, now) => R[it.id] && R[it.id].d <= now;
  const dueCount = () => { const now = Date.now(); return items.filter(it => isDue(it, now)).length; };
  function badge() {
    const n = dueCount(), el = $('#stDue'); if (el) el.textContent = n ? String(n) : '';
    const b = $('#stQuiz'); if (b) b.title = n ? `${n} question${n > 1 ? 's' : ''} due for review` : 'No reviews due; the quiz adds new questions';
  }
  function sched(id, g) { // g: 1 again, 2 hard, 3 good, 4 easy (SM-2 style, days)
    const r = R[id] || { n: 0, i: 0, e: 2.5 };
    if (g === 1) { r.n = 0; r.i = 0; r.e = Math.max(1.3, r.e - 0.2); }
    else {
      let i = r.n === 0 ? 1 : r.n === 1 ? 3 : Math.round(r.i * r.e);
      if (g === 2) { i = Math.max(1, Math.round((r.i || 1) * 1.2)); r.e = Math.max(1.3, r.e - 0.15); }
      if (g === 4) { i = Math.round(i * 1.3) + 1; r.e = Math.min(3, r.e + 0.15); }
      r.n++; r.i = i;
    }
    r.d = Date.now() + (g === 1 ? 10 * 60e3 : r.i * DAY);
    R[id] = r; save(R);
    return r;
  }
  const nextLabel = (id, g) => { const r = Object.assign({ n: 0, i: 0, e: 2.5 }, R[id]); if (g === 1) return '10 min';
    let i = r.n === 0 ? 1 : r.n === 1 ? 3 : Math.round(r.i * r.e); if (g === 2) i = Math.max(1, Math.round((r.i || 1) * 1.2)); if (g === 4) i = Math.round(i * 1.3) + 1;
    return i >= 30 ? Math.round(i / 30) + ' mo' : i + ' d'; };

  function decks() {
    const now = Date.now(), out = [];
    const due = items.filter(it => isDue(it, now)).sort((a, b) => R[a.id].d - R[b.id].d);
    const fresh = items.filter(it => !R[it.id]).slice(0, NEW_PER_SESSION);
    out.push({ id: 'due', name: `Due now ${due.length} + new ${fresh.length}`, items: due.concat(fresh), srs: true });
    out.push({ id: 'all', name: `Whole sheet (${items.length})`, items, shuffle: true });
    let S = {}; try { S = JSON.parse(localStorage.getItem('cs.study.v1') || '{}'); } catch (e) {}
    const rv = items.filter(it => it.card && S[it.card.dataset.skey] === 'r');
    if (rv.length) out.push({ id: 'review', name: `Cards marked Review (${rv.length})`, items: rv, shuffle: true });
    $$('main section.sec').forEach(s => { const its = items.filter(it => it.sec === s.id); const h = $('h2', s);
      if (its.length >= 3) out.push({ id: 'sec:' + s.id, name: 'Section: ' + (h ? (h.dataset.label || h.textContent) : s.id) + ` (${its.length})`, items: its, shuffle: true }); });
    return out;
  }

  function open() {
    let m = $('#rquiz');
    if (!m) {
      m = document.createElement('div'); m.id = 'rquiz'; m.className = 'drill-like'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Recall quiz');
      m.innerHTML = `<div class="dr-box">
        <div class="dr-top"><select id="rqDeck" aria-label="Deck"></select><span class="dr-prog" id="rqProg"></span><button type="button" class="iconbtn" id="rqClose">Close</button></div>
        <div class="dr-bar"><i id="rqBar"></i></div>
        <div class="dr-card" id="rqCard"></div>
        <div class="dr-actions" id="rqActions"></div>
        <div class="dr-keys">Space: show answer · 1 again · 2 hard · 3 good · 4 easy · Esc: close</div></div>`;
      document.body.appendChild(m);
      $('#rqClose').addEventListener('click', close);
      m.addEventListener('click', e => { if (e.target === m) close(); });
      $('#rqDeck').addEventListener('change', e => start(e.target.value));
      document.addEventListener('keydown', e => {
        if (!m.classList.contains('open') || e.target.tagName === 'SELECT') return;
        if (e.key === 'Escape') close();
        else if ((e.key === ' ' || e.key === 'Enter') && Q && !Q.shown) { e.preventDefault(); reveal(); }
        else if (Q && Q.shown && /^[1-4]$/.test(e.key)) grade(+e.key);
      });
    }
    m._decks = decks();
    $('#rqDeck').innerHTML = m._decks.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
    const last = pref('quizDeck'); const pick = m._decks.find(d => d.id === last && d.items.length) ? last : m._decks[0].id;
    $('#rqDeck').value = pick;
    m.classList.add('open'); document.documentElement.classList.add('viewer-open');
    start(pick);
  }
  function close() { const m = $('#rquiz'); if (m) m.classList.remove('open'); document.documentElement.classList.remove('viewer-open'); badge(); }
  function start(id) {
    pref('quizDeck', id);
    const d = $('#rquiz')._decks.find(x => x.id === id); const q = d.items.slice();
    if (d.shuffle) for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    Q = { q, total: q.length, done: 0, again: 0, shown: false, srs: !!d.srs };
    show();
  }
  function show() {
    const card = $('#rqCard'), act = $('#rqActions');
    $('#rqProg').textContent = `${Q.done} / ${Q.total}`;
    $('#rqBar').style.width = (Q.total ? Q.done * 100 / Q.total : 100) + '%';
    if (!Q.q.length) {
      const nd = items.filter(it => R[it.id]).map(it => R[it.id].d).filter(d => d > Date.now()).sort((a, b) => a - b)[0];
      const when = nd ? new Date(nd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
      card.innerHTML = `<div class="dr-end"><b>${Q.total ? 'Session complete' : 'Nothing due right now'}</b><span>${Q.total ? `${Q.total} questions · ${Q.again} repeated` : 'Pick another deck to practise anyway'}${when ? ` · next review ${esc(when)}` : ''}</span></div>`;
      act.innerHTML = ''; badge(); return;
    }
    const it = Q.q[0]; Q.shown = false;
    card.innerHTML = `<div class="dr-ctx">${esc(it.ctx)}${R[it.id] ? '' : ' · <b>new</b>'}</div><div class="dr-q">${it.q}</div>
      <div class="dr-ans" hidden>${it.a}${it.k ? `<div class="rc-k" style="margin-top:8px"><b>Takeaway</b> ${it.k}</div>` : ''}${it.card ? `<div style="margin-top:8px"><a href="#${esc(it.card.id)}" class="rq-go">Open the card</a></div>` : ''}</div>`;
    const go = $('.rq-go', card); if (go) go.addEventListener('click', () => close());
    act.innerHTML = '<button type="button" class="dr-btn primary" id="rqShow">Show answer</button>';
    $('#rqShow').addEventListener('click', reveal); $('#rqShow').focus();
  }
  function reveal() {
    Q.shown = true; $('.dr-ans', $('#rqCard')).hidden = false;
    const id = Q.q[0].id, L = ['Again', 'Hard', 'Good', 'Easy'];
    $('#rqActions').innerHTML = `<div class="dr-grade">${L.map((l, i) => `<button type="button" class="dr-btn${i === 2 ? ' primary' : ''}" data-g="${i + 1}">${l}<small>${nextLabel(id, i + 1)}</small></button>`).join('')}</div>`;
    $$('#rqActions [data-g]').forEach(b => b.addEventListener('click', () => grade(+b.dataset.g)));
    $('#rqActions [data-g="3"]').focus();
  }
  function grade(g) {
    const it = Q.q.shift(); sched(it.id, g);
    if (g === 1) { Q.again++; Q.q.splice(Math.min(Q.q.length, 3 + Math.floor(Math.random() * 3)), 0, it); } else Q.done++;
    show();
  }

  document.addEventListener('DOMContentLoaded', () => {
    items = collect();
    const btn = $('#stQuiz'); if (!btn || !items.length) return;
    btn.hidden = false;
    const fl = $('#stDrill'); if (fl) { fl.classList.remove('sp-primary'); fl.classList.add('sp-ghost'); }
    btn.addEventListener('click', () => { const p = $('#studyPanel'); if (p) p.hidden = true; open(); });
    badge();
    window.addEventListener('storage', e => { if (e.key === KEY) { R = load(); badge(); } });
  });
})();
