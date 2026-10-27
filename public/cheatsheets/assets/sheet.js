/* Cheatsheets — shared behaviour: theme, density, contents rail + scrollspy, search, copy, diagrams, print. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem('cs.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('cs.' + k, v); } catch (e) {} }
  };
  const root = document.documentElement;

  /* ---------- theme + density ---------- */
  const savedTheme = store.get('theme');
  if (savedTheme) root.dataset.theme = savedTheme;
  const savedDensity = store.get('density');
  if (savedDensity) root.dataset.density = savedDensity;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const themeBtn = $('#themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      store.set('theme', root.dataset.theme);
      renderDiagrams(true);
    });
    const densBtn = $('#densBtn');
    const syncDens = () => { if (densBtn) densBtn.textContent = root.dataset.density === 'compact' ? 'Comfortable' : 'Compact'; };
    syncDens();
    if (densBtn) densBtn.addEventListener('click', () => {
      root.dataset.density = root.dataset.density === 'compact' ? '' : 'compact';
      store.set('density', root.dataset.density); syncDens();
    });

    buildRail();
    wrapCode();
    initSearch();
    initDetails();
    initNavDrawer();
    initToTop();
    renderDiagrams(false);
    initReadbar();
    initProblemBank();
    initGuide();
    initShortcuts();
    initResume();
    initPacking();
    openHashTarget();
    window.addEventListener('hashchange', openHashTarget);
  }

  /* ---------- contents rail ---------- */
  function buildRail() {
    const list = $('#railList');
    if (!list) return;
    const secs = $$('main section.sec[id]');
    secs.forEach(sec => {
      const h2 = $('h2', sec); if (!h2) return;
      const li = document.createElement('li');
      const n = $('.n', h2);
      const label = h2.dataset.label || h2.textContent.replace(n ? n.textContent : '', '').replace(/NEW$/, '').trim();
      li.innerHTML = `<a href="#${sec.id}"><span class="n">${n ? n.textContent : ''}</span><span></span></a>`;
      li.querySelector('a span:last-child').textContent = label;
      const cards = $$('.card[id] > h3', sec);
      if (cards.length) {
        const ol = document.createElement('ol');
        cards.forEach(h3 => {
          const a = document.createElement('a');
          a.href = '#' + h3.parentElement.id;
          a.textContent = h3.dataset.label || h3.firstChild.textContent.trim() || h3.textContent.trim();
          const l2 = document.createElement('li'); l2.appendChild(a); ol.appendChild(l2);
        });
        li.appendChild(ol);
      }
      li.dataset.sec = sec.id;
      list.appendChild(li);
    });
    // scrollspy
    const items = $$('#railList > li');
    let current = null;
    const setActive = id => {
      if (id === current) return; current = id;
      items.forEach(li => li.classList.toggle('active', li.dataset.sec === id));
      const act = items.find(li => li.dataset.sec === id);
      if (act && !document.body.classList.contains('nav-open')) {
        const rail = $('.rail'); const r = act.getBoundingClientRect(); const rr = rail.getBoundingClientRect();
        if (r.top < rr.top || r.bottom > rr.bottom) rail.scrollTop += r.top - rr.top - 80;
      }
    };
    const secObs = new IntersectionObserver(entries => {
      const vis = secs.filter(s => { const r = s.getBoundingClientRect(); return r.top < window.innerHeight * 0.35 && r.bottom > 80; });
      if (vis.length) setActive(vis[vis.length - 1].id);
    }, { rootMargin: '-60px 0px -55% 0px', threshold: [0, 0.01, 1] });
    secs.forEach(s => secObs.observe(s));
    window.addEventListener('scroll', throttle(() => {
      const vis = secs.filter(s => { const r = s.getBoundingClientRect(); return r.top < window.innerHeight * 0.35 && r.bottom > 80; });
      if (vis.length) setActive(vis[vis.length - 1].id);
      // card highlight
      const cards = $$('.card[id]', $('#' + current) || document);
      let on = null;
      for (const c of cards) { const r = c.getBoundingClientRect(); if (r.top < window.innerHeight * 0.4) on = c.id; }
      $$('.rail ol ol a').forEach(a => a.classList.toggle('on', on && a.getAttribute('href') === '#' + on));
    }, 120), { passive: true });
    if (secs[0]) setActive(secs[0].id);
  }

  /* ---------- code copy ---------- */
  function wrapCode() {
    $$('pre.code').forEach(pre => {
      const w = document.createElement('div'); w.className = 'codewrap'; if (pre.dataset.lang) w.dataset.lang = pre.dataset.lang; if (pre.dataset.hl) w.dataset.hl = pre.dataset.hl;
      pre.parentNode.insertBefore(w, pre); w.appendChild(pre);
      const b = document.createElement('button'); b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
      b.addEventListener('click', () => {
        const done = () => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1400); };
        const fallback = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; setTimeout(() => b.textContent = 'Copy', 1400); };
        try { navigator.clipboard.writeText(pre.innerText).then(done, fallback); } catch (e) { fallback(); }
      });
      w.appendChild(b);
    });
  }

  /* ---------- search ---------- */
  function initSearch() {
    const input = $('#q'); if (!input) return;
    const count = $('#qcount'); const kbd = $('.search kbd');
    const cards = $$('main .card');
    const secs = $$('main section.sec');
    const empty = $('.search-empty');
    cards.forEach(c => { c._text = c.textContent.toLowerCase(); });
    let marks = [];
    const clearMarks = () => {
      marks.forEach(m => { const p = m.parentNode; if (!p) return; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
      marks = [];
    };
    const highlight = (el, terms) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement.closest('pre.mermaid,script,style,.copy') || !n.nodeValue.trim()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
      nodes.forEach(n => {
        if (marks.length > 600) return;
        if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
        const frag = document.createDocumentFragment(); let last = 0; const v = n.nodeValue; let m;
        while ((m = re.exec(v))) {
          frag.appendChild(document.createTextNode(v.slice(last, m.index)));
          const mk = document.createElement('mark'); mk.textContent = m[0]; frag.appendChild(mk); marks.push(mk);
          last = m.index + m[0].length;
        }
        frag.appendChild(document.createTextNode(v.slice(last)));
        n.parentNode.replaceChild(frag, n);
      });
    };
    const run = () => {
      const q = input.value.trim().toLowerCase();
      clearMarks();
      $$('.is-hidden').forEach(e => e.classList.remove('is-hidden'));
      if (!q) {
        document.body.classList.remove('searching');
        count.textContent = ''; if (kbd) kbd.hidden = false;
        if (empty) empty.classList.remove('show');
        if (window.__csRefit) setTimeout(window.__csRefit, 0);
        return;
      }
      document.body.classList.add('searching'); if (kbd) kbd.hidden = true;
      const terms = q.split(/\s+/).filter(Boolean);
      let shown = 0;
      cards.forEach(c => {
        const ok = terms.every(t => c._text.includes(t));
        if (!ok) { c.classList.add('is-hidden'); return; }
        shown++;
        const head = (c.querySelector('h3') || {}).textContent || '';
        const headHit = terms.every(t => head.toLowerCase().includes(t));
        if (!headHit) {
          // narrow tables to matching rows
          $$('table', c).forEach(tb => {
            const rows = $$('tr', tb).filter(r => !r.querySelector('th'));
            const hits = rows.filter(r => terms.some(t => r.textContent.toLowerCase().includes(t)));
            if (hits.length && hits.length < rows.length) rows.forEach(r => { if (!hits.includes(r)) r.classList.add('is-hidden'); });
          });
          $$('details', c).forEach(d => { if (terms.some(t => d.textContent.toLowerCase().includes(t))) d.open = true; });
        }
        highlight(c, terms);
      });
      secs.forEach(s => {
        const any = $$('.card', s).some(c => !c.classList.contains('is-hidden'));
        s.classList.toggle('is-hidden', !any);
      });
      $$('#railList > li').forEach(li => {
        const s = document.getElementById(li.dataset.sec);
        li.classList.toggle('is-hidden', s && s.classList.contains('is-hidden'));
      });
      count.textContent = shown + (shown === 1 ? ' card' : ' cards');
      if (window.__csRefit) setTimeout(window.__csRefit, 0);
      if (empty) empty.classList.toggle('show', shown === 0);
    };
    input.addEventListener('input', debounce(run, 160));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { input.value = ''; run(); input.blur(); }
      if (e.key === 'Enter') { const first = cards.find(c => !c.classList.contains('is-hidden')); if (first) first.scrollIntoView({ block: 'start' }); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
    });
    // ?q= deep link from the hub
    const pq = new URLSearchParams(location.search).get('q');
    if (pq) { input.value = pq; run(); }
  }

  /* ---------- details ---------- */
  function initDetails() {
    const set = o => $$('main details').forEach(d => d.open = o);
    window.setAll = set; // keeps old inline handlers working
    const ex = $('#expandAll'), co = $('#collapseAll');
    if (ex) ex.addEventListener('click', () => set(true));
    if (co) co.addEventListener('click', () => set(false));
    window.addEventListener('beforeprint', () => set(true));
  }

  function openHashTarget() {
    const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    const el = document.getElementById(id); if (!el) return;
    let d = el.closest('details'); while (d) { d.open = true; d = d.parentElement.closest('details'); }
    setTimeout(() => el.scrollIntoView({ block: 'start' }), 30);
  }

  /* ---------- mobile drawer ---------- */
  function initNavDrawer() {
    const b = $('#menuBtn'); if (!b) return;
    const close = () => { document.body.classList.remove('nav-open'); b.setAttribute('aria-expanded', 'false'); };
    b.addEventListener('click', () => { const o = document.body.classList.toggle('nav-open'); b.setAttribute('aria-expanded', String(o)); });
    $('.scrim').addEventListener('click', close);
    $('.rail').addEventListener('click', e => { if (e.target.closest('a')) close(); });
  }

  function initToTop() {
    const b = $('.totop'); if (!b) return;
    window.addEventListener('scroll', throttle(() => b.classList.toggle('show', scrollY > 900), 200), { passive: true });
    b.addEventListener('click', () => scrollTo({ top: 0 }));
  }

  /* ---------- mermaid diagrams ---------- */
  const minScale = () => (innerWidth < 700 ? 0.6 : 0.74);
  function hex(c) {
    c = (c || '').trim();
    if (c[0] === '#') { if (c.length === 4) c = '#' + [...c.slice(1)].map(x => x + x).join(''); return c.slice(0, 7); }
    const m = c.match(/[\d.]+/g); if (m && m.length >= 3) return '#' + m.slice(0, 3).map(v => Math.round(+v).toString(16).padStart(2, '0')).join('');
    return '#888888';
  }
  function mix(a, b, t) {
    a = hex(a); b = hex(b);
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v * t + pb[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }
  function palette() {
    const cs = getComputedStyle(document.body), g = n => cs.getPropertyValue(n).trim() || '#888888';
    return { dark: isDark(), bg: g('--surface'), bg2: g('--surface-2'), fg: g('--fg'), fg2: g('--fg-2'), line: g('--line'), accent: g('--accent'),
      hues: ['--c-b', '--c-p', '--c-g', '--c-o', '--c-t', '--c-r', '--c-y'].map(g) };
  }
  const FONT = '"IBM Plex Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  function mermaidConfig() {
    const P = palette(), d = P.dark;
    const node = mix(P.accent, P.bg, d ? 0.2 : 0.1), border = mix(P.accent, P.bg, d ? 0.6 : 0.45);
    const line = mix(P.fg, P.bg, 0.42);
    const tv = {
      darkMode: d, background: P.bg, fontFamily: FONT, fontSize: '14px',
      primaryColor: node, primaryBorderColor: border, primaryTextColor: P.fg,
      secondaryColor: mix(P.hues[2], P.bg, d ? 0.2 : 0.1), secondaryBorderColor: mix(P.hues[2], P.bg, 0.45), secondaryTextColor: P.fg,
      tertiaryColor: P.bg2, tertiaryBorderColor: P.line, tertiaryTextColor: P.fg,
      mainBkg: node, nodeBorder: border, nodeTextColor: P.fg, textColor: P.fg, titleColor: P.fg,
      lineColor: line, defaultLinkColor: line, edgeLabelBackground: P.bg,
      clusterBkg: P.bg2, clusterBorder: P.line,
      noteBkgColor: mix(P.hues[6], P.bg, d ? 0.22 : 0.14), noteBorderColor: mix(P.hues[6], P.bg, 0.5), noteTextColor: P.fg,
      actorBkg: node, actorBorder: border, actorTextColor: P.fg, actorLineColor: mix(P.fg, P.bg, 0.28),
      signalColor: mix(P.fg, P.bg, 0.6), signalTextColor: P.fg, labelBoxBkgColor: P.bg2, labelBoxBorderColor: P.line,
      labelTextColor: P.fg, loopTextColor: P.fg, activationBkgColor: P.bg2, activationBorderColor: border, sequenceNumberColor: P.bg,
      stateBkg: node, stateBorder: border, labelColor: P.fg, altBackground: P.bg2, compositeBackground: P.bg2,
      transitionColor: line, transitionLabelColor: P.fg2, specialStateColor: P.fg, innerEndBackground: P.fg, stateLabelColor: P.fg,
      classText: P.fg
    };
    for (let i = 0; i < 12; i++) {
      const h = P.hues[i % P.hues.length];
      tv['cScale' + i] = mix(h, P.bg, d ? 0.34 : 0.22); tv['cScaleLabel' + i] = P.fg; tv['cScalePeer' + i] = mix(h, P.bg, 0.6);
    }
    return {
      startOnLoad: false, securityLevel: 'loose', theme: 'base', themeVariables: tv, fontFamily: FONT,
      flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', nodeSpacing: 30, rankSpacing: 40, padding: 10 },
      sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 40, messageMargin: 32, boxMargin: 8, noteMargin: 8 },
      state: { useMaxWidth: false }, class: { useMaxWidth: false }, mindmap: { useMaxWidth: false, padding: 10 }
    };
  }
  function prepare(src) {
    const P = palette(), d = P.dark;
    return src.replace(/__DF__/g, mix(P.fg, P.bg, d ? 0.1 : 0.045)).replace(/__DS__/g, mix(P.fg, P.bg, d ? 0.38 : 0.3)).replace(/__FG__/g, P.fg);
  }
  window.__cs = { mermaidConfig, prepare };

  function wrap(p) {
    if (p.parentElement.classList.contains('mm-wrap')) return p.parentElement;
    const w = document.createElement('div'); w.className = 'mm-wrap';
    p.parentNode.insertBefore(w, p); w.appendChild(p);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mm-expand'; b.title = 'Open full screen';
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/></svg><span>Expand</span>';
    b.addEventListener('click', () => openViewer(p));
    const bar = document.createElement('div'); bar.className = 'mm-bar';
    const hint = document.createElement('span'); hint.className = 'mm-hint'; hint.innerHTML = '<span class="tip-hint">' + (matchMedia('(hover: none)').matches ? 'Tap' : 'Hover') + ' a box for an explanation</span><span class="scroll-hint">Wide diagram: scroll sideways or expand</span>';
    bar.appendChild(hint); bar.appendChild(b); w.appendChild(bar);
    return w;
  }
  function natural(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width) return [vb.width, vb.height];
    const r = svg.getBBox(); return [r.width, r.height];
  }
  // fitting is split into a read pass and a write pass so many diagrams cost one layout, not one each
  function fitPlan(p) {
    const svg = p.querySelector('svg'); if (!svg) return null;
    const [W] = natural(svg);
    const cs = getComputedStyle(p);
    const box = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (box <= 0) return { p, svg, skip: true };
    let w = Math.min(W, box);
    if (w < W * minScale()) w = W * minScale();
    return { p, svg, w, box };
  }
  function fitApply(x) {
    if (!x) return;
    if (x.skip) { x.p.dataset.needfit = '1'; return; }
    delete x.p.dataset.needfit;
    x.svg.removeAttribute('height');
    x.svg.style.width = Math.round(x.w) + 'px'; x.svg.style.maxWidth = 'none'; x.svg.style.height = 'auto';
    x.p.parentElement.classList.toggle('scrolls', x.w > x.box + 1);
  }
  function fit(p) { fitApply(fitPlan(p)); }
  window.__csRefit = () => { $$('pre.mermaid').map(fitPlan).forEach(fitApply); };

  let renderSeq = 0;
  // hold each diagram's final height before it renders, so nothing jumps when it appears
  function reservePlan(p) {
    if (!window.mermaid || p.dataset.processed === 'true' || !p.dataset.w) return null;
    const W = +p.dataset.w, H = +p.dataset.h, cs = getComputedStyle(p);
    const box = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (box <= 0) return null;
    let w = Math.min(W, box); if (w < W * minScale()) w = W * minScale();
    return [p, Math.round(H * w / W + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + (w > box + 1 ? 8 : 0))];
  }
  const reserveApply = x => { if (x) { x[0].style.height = x[1] + 'px'; x[0].classList.add('mm-pending'); } };
  function reserve(p) { reserveApply(reservePlan(p)); }
  const unreserve = p => { p.style.height = ''; p.classList.remove('mm-pending'); };
  window.__csReserve = () => { $$('pre.mermaid.mm-pending, pre.mermaid[data-w]:not([data-processed])').map(reservePlan).forEach(reserveApply); };

  async function renderDiagrams(rerender) {
    const pres = $$('pre.mermaid');
    if (!pres.length) return;
    pres.forEach(p => { if (p.dataset.src === undefined) p.dataset.src = p.textContent; wrap(p); });
    if (!rerender) window.__csReserve();
    if (!window.mermaid) {
      if (!rerender) pres.forEach(p => {
        p.textContent = prepare(p.dataset.src);
        const w = p.parentElement; if (w.querySelector('.diagram-fallback')) return;
        const n = document.createElement('div'); n.className = 'diagram-fallback';
        n.textContent = 'Diagram shown as source: the renderer needs an internet connection.';
        w.insertBefore(n, p);
      });
      return;
    }
    const seq = ++renderSeq;
    try {
      if (document.fonts && document.fonts.load) await Promise.race([
        Promise.all(['400 14px "IBM Plex Sans"', '500 14px "IBM Plex Sans"'].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 2000))]);
    } catch (e) {}
    if (seq !== renderSeq) return;
    window.mermaid.initialize(mermaidConfig());
    // render diagrams nearest the viewport first
    const mid = scrollY + innerHeight / 2;
    const order = pres.map((p, i) => [Math.abs(p.getBoundingClientRect().top + scrollY - mid), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    for (const i of order) {
      if (seq !== renderSeq) return;
      const p = pres[i], id = `mmd${seq}x${i}`;
      try {
        const out = await window.mermaid.render(id, prepare(p.dataset.src));
        p.innerHTML = out.svg; p.dataset.processed = 'true'; p.classList.remove('mm-error'); unreserve(p);
        if (out.bindFunctions) out.bindFunctions(p);
        fit(p);
        bindTips(p);
        await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 120 }) : setTimeout(r, 16)));
      } catch (e) {
        const stray = document.getElementById('d' + id); if (stray) stray.remove();
        p.classList.add('mm-error'); unreserve(p); p.textContent = p.dataset.src; console.warn('diagram failed', i, e);
      }
    }
    document.body.classList.add('diagrams-ready');
  }
  window.addEventListener('resize', debounce(() => window.__csRefit(), 200));
  document.addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS' && e.target.open) $$('pre.mermaid[data-needfit]', e.target).forEach(fit); }, true);

  /* ---------- balanced card packing ----------
     A plain CSS grid aligns every row to its tallest card, which leaves holes under short cards
     and next to a card that ends up alone in its row. On wide screens each grid is regrouped into
     bands: full-width cards, and column bands filled masonry-style (each card drops into the
     shortest column; the last few are arranged so the columns finish level, and the last card in
     each column stretches to the band's bottom edge). A card left alone is paired with the next
     card from further down, or widened to the full row when there is nothing to pair it with.
     Narrow diagrams in wide cards get their notes beside them instead of below. */
  const PK = { grids: [], width: 0, timer: 0 };
  const isCard = el => el.classList && el.classList.contains('card');
  const shown = el => el.getClientRects().length > 0;
  const promotable = el => isCard(el) && !el.querySelector('.ladder, .mm-wrap, .code-pair, .codewrap');

  function unside(c) {
    if (!c._sideKids) return;
    c.classList.remove('side'); c.style.removeProperty('--dw');
    (c._sideMoved || []).slice().reverse().forEach(([el, parent, next]) => { parent.insertBefore(el, next && next.parentNode === parent ? next : null); parent.classList.remove('side-empty'); });
    c.replaceChildren(...c._sideKids); c._sideKids = null; c._sideMoved = null;
  }
  function unpackGrid(G) {
    if (!G._kids) G._kids = Array.from(G.children);
    G._kids.forEach(c => { if (isCard(c)) { c.classList.remove('pk-wide'); unside(c); } });
    if (!G.classList.contains('pk')) return;
    G.classList.remove('pk');
    G.replaceChildren(...G._kids);
  }

  // Masonry with an even finish: greedy shortest-column placement, then the last few cards are
  // tried in every arrangement and the one whose columns end most level wins.
  function masonry(hs, k, gap) {
    const n = hs.length, T = Math.min(n, k === 2 ? 7 : 5);
    const cols = Array.from({ length: k }, () => []), H = new Array(k).fill(0);
    const put = (i, c) => { H[c] += (cols[c].length ? gap : 0) + hs[i]; cols[c].push(i); };
    const shortest = h => h.reduce((b, v, j) => (v < h[b] - 1 ? j : b), 0);
    for (let i = 0; i < n - T; i++) put(i, shortest(H));
    // greedy choice for the tail, used to break ties toward the natural reading order
    const gH = H.slice(), gCnt = cols.map(c => c.length), greedy = [];
    for (let i = n - T; i < n; i++) { const c = shortest(gH); greedy.push(c); gH[c] += (gCnt[c] ? gap : 0) + hs[i]; gCnt[c]++; }
    let best = null;
    for (let code = 0, total = Math.pow(k, T); code < total; code++) {
      const h = H.slice(), cnt = cols.map(c => c.length); let x = code, dev = 0;
      for (let t = 0; t < T; t++) { const c = x % k; x = Math.floor(x / k); h[c] += (cnt[c] ? gap : 0) + hs[n - T + t]; cnt[c]++; if (c !== greedy[t]) dev++; }
      const max = Math.max(...h);
      const score = h.reduce((a, v) => a + max - v, 0) + cnt.filter(v => !v).length * 1e6 + dev * 6;
      if (!best || score < best.score) best = { score, code };
    }
    let x = best.code;
    for (let t = 0; t < T; t++) { put(n - T + t, x % k); x = Math.floor(x / k); }
    const max = Math.max(...H);
    return { cols, max, waste: H.reduce((a, v) => a + max - v, 0) };
  }

  function planGrid(items, k, gap) {
    // 1. bands of normal cards between full-width cards; a band too small to fill the row
    //    borrows the next normal cards from below the following full card(s)
    let blocks = [], pend = [], defer = [];
    const flush = () => { if (pend.length) blocks.push({ band: pend }); pend = []; defer.forEach(it => blocks.push({ full: it })); defer = []; };
    items.forEach((it, idx) => {
      if (it.full) {
        if (pend.length && pend.length < k && defer.length < 3 && items.slice(idx + 1).some(o => !o.full)) defer.push(it);
        else { flush(); blocks.push({ full: it }); }
      } else {
        pend.push(it);
        if (defer.length && pend.length >= k) flush();
      }
    });
    flush();
    // 2. a single card still alone joins the previous band if one is close, otherwise spans the row
    for (let b = 0; b < blocks.length; b++) {
      const B = blocks[b];
      if (!B.band || B.band.length !== 1 || k < 2) continue;
      let p = b - 1; while (p >= 0 && blocks[p].full && b - p <= 3) p--;
      if (p >= 0 && blocks[p].band && blocks[p].band.length >= k && b - p <= 4) { blocks[p].band.push(B.band[0]); blocks.splice(b, 1); b--; continue; }
      blocks[b] = { full: B.band[0], promoted: true };
    }
    // 3. lay out each band; if the last card leaves a ragged finish and reads well at full width, widen it
    const out = [];
    blocks.forEach(B => {
      if (B.full) { out.push(B); return; }
      const cards = B.band, n = cards.length;
      // code needs room: a band that is mostly code cards whose lines overflow gets one column fewer
      let kk = Math.min(k, n);
      if (kk >= 3 && cards.filter(c => c.wideCode).length * 2 >= n) kk--;
      if (n < kk || (n === kk && kk < k)) { out.push({ cols: cards.map((c, i) => [i]), cards }); return; }
      const M = masonry(cards.map(c => c.h1), kk, gap);
      const last = cards[n - 1];
      if (n - 1 >= kk && last.promote && last.hF < last.h1 * 0.8) {
        const M2 = masonry(cards.slice(0, -1).map(c => c.h1), kk, gap);
        if (M2.waste + 40 < M.waste) { out.push({ cols: M2.cols, cards: cards.slice(0, -1) }); out.push({ full: last, promoted: true }); return; }
      }
      out.push({ cols: M.cols, cards });
    });
    return out;
  }

  // the narrowest a card may become: diagrams keep their natural size, code keeps most of its width
  function minWidth(el) {
    if (!isCard(el)) return 0;
    const pad = 2 * (parseFloat(getComputedStyle(el).paddingLeft) || 14) + 2;
    let m = 0;
    el.querySelectorAll('pre.mermaid[data-w]').forEach(p => { m = Math.max(m, +p.dataset.w + 26 + pad); });
    if (el.querySelector('pre.code, .codewrap, .ladder')) m = Math.max(m, el.offsetWidth * 0.92);
    // tables need about 125px per column to stay readable
    el.querySelectorAll('table').forEach(t => { const r = t.rows[0]; if (r) m = Math.max(m, r.cells.length * 125 + pad + 4); });
    return m;
  }
  // Give taller columns a little more width and shorter ones a little less so a band's columns
  // finish level. Each column's height is modelled as A + B / width (text and tables reflow
  // roughly that way); the model is fitted from real measurements and refined twice.
  function colModels(cols, cards, eq, gap) {
    return cols.map(col => {
      let A = (col.length - 1) * gap, B = 0, lo = Math.max(0.85 * eq, 300);
      col.forEach(i => {
        const c = cards[i];
        if (c.hF < c.h1 - 6 && c.wF > c.w1 + 20) { const b = (c.h1 - c.hF) / (1 / c.w1 - 1 / c.wF); B += b; A += c.hF - b / c.wF; }
        else A += c.h1;
        lo = Math.max(lo, c.minW || 0);
      });
      return { A, B, lo: Math.min(lo, 1.3 * eq), hi: Math.max(1.35 * eq, lo) };
    });
  }
  function solveWidths(C, avail) {
    const H = (c, w) => c.A + c.B / w;
    const need = T => {
      let s = 0;
      for (const c of C) {
        if (c.B <= 0) { if (c.A > T + 0.5) return Infinity; s += c.lo; continue; }
        if (T <= c.A) return Infinity;
        const w = Math.max(c.lo, c.B / (T - c.A)); if (w > c.hi + 0.01) return Infinity; s += w;
      }
      return s;
    };
    let lo = 0, hi = Math.max(...C.map(c => H(c, c.lo))) + 1;
    if (!(need(hi) <= avail + 0.5)) return null;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (need(m) <= avail) hi = m; else lo = m; }
    const ws = C.map(c => (c.B <= 0 ? c.lo : Math.max(c.lo, c.B / (hi - c.A))));
    const left = avail - ws.reduce((x, y) => x + y, 0);
    const fixed = C.map((c, i) => (c.B <= 0 ? i : -1)).filter(i => i >= 0), tgt = fixed.length ? fixed : C.map((c, i) => i);
    tgt.forEach(i => { ws[i] += left / tgt.length; });
    return ws;
  }
  const colHeights = band => Array.from(band.children).map(col => {
    const cs = Array.from(col.children); return cs.reduce((a, c) => a + c.offsetHeight, 0) + (cs.length - 1) * band._gap;
  });
  const bandWaste = (hs, ws) => { const m = Math.max(...hs); return hs.reduce((a, h, i) => a + (m - h) * ws[i], 0); };
  function balanceBands(bands) {
    // bands: [{ band, cols, cards, avail, gap }] already in the page at equal widths, stretch disabled
    bands.forEach(b => { b.eq = b.avail / b.cols.length; b.tries = [{ ws: b.cols.map(() => b.eq), hs: colHeights(b.band) }]; b.C = colModels(b.cols, b.cards, b.eq, b.gap); });
    const apply = (b, ws) => { b.band.style.gridTemplateColumns = ws.map(w => w.toFixed(1) + 'fr').join(' '); };
    for (let round = 0, R = window.__pkRounds || 3; round < R; round++) {
      const live = bands.filter(b => !b.done);
      live.forEach(b => {
        const last = b.tries[b.tries.length - 1];
        if (bandWaste(last.hs, last.ws) < 12000) { b.done = true; return; }
        if (round > 0) {
          // refit each column from its two latest measurements
          const prev = b.tries[b.tries.length - 2];
          b.C = b.C.map((c, i) => {
            const w0 = prev.ws[i], h0 = prev.hs[i], w1 = last.ws[i], h1 = last.hs[i];
            if (Math.abs(1 / w0 - 1 / w1) < 1e-5) return { ...c, A: h1 - c.B / w1 };
            const B = Math.max(0, (h0 - h1) / (1 / w0 - 1 / w1));
            return { ...c, B, A: h1 - B / w1 };
          });
        }
        const ws = solveWidths(b.C, b.avail);
        if (!ws) { b.done = true; return; }
        b.next = ws; apply(b, ws);
      });
      const moved = live.filter(b => !b.done && b.next);
      moved.forEach(b => { b.tries.push({ ws: b.next, hs: colHeights(b.band) }); b.next = null; });
    }
    bands.forEach(b => {
      const best = b.tries.reduce((x, y) => (bandWaste(y.hs, y.ws) < bandWaste(x.hs, x.ws) - 4000 ? y : x));
      if (best === b.tries[0]) b.band.style.gridTemplateColumns = ''; else apply(b, best.ws);
    });
  }

  const wideCode = el => isCard(el) && Array.from(el.querySelectorAll('pre.code')).some(p => p.scrollWidth > p.clientWidth * 1.15 + 20);
  const hasCode = el => !!(el.matches && el.matches('pre.code, .codewrap, .code-pair')) || !!(el.querySelector && el.querySelector('pre.code, .codewrap, .code-pair'));
  function sideBySide(c) {
    // a narrow diagram in a wide card: put the card's notes beside it. Notes are taken in order
    // until the first code block, which stays below at full width so code keeps its width.
    const wraps = c.querySelectorAll(':scope > .mm-wrap');
    if (wraps.length !== 1) return;
    const w = wraps[0], p = w.querySelector('pre.mermaid'); if (!p || !p.dataset.w) return;
    const cs = getComputedStyle(c);
    const inner = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const W = +p.dataset.w + 26;
    if (inner < 760 || W > inner * 0.6 || inner - W < 340) return;
    const kids = Array.from(c.children), take = [], moved = [];
    for (const e of kids) {
      if (e === w || e.tagName === 'H3') continue;
      if (!hasCode(e)) { take.push(e); continue; }
      // a column layout whose first column is plain notes: borrow just that column
      if (e.classList.contains('wt-cols') && e.children.length > 1 && !hasCode(e.children[0])) {
        const first = e.children[0]; moved.push([first, e, first.nextSibling]); take.push(first);
      }
      break;
    }
    const text = take.reduce((a, e) => a + e.textContent.length, 0);
    if (text < 260) return;
    c._sideKids = kids; c._sideMoved = moved;
    const body = document.createElement('div'); body.className = 'side-body';
    take.forEach(e => body.appendChild(e));
    c.insertBefore(body, w.nextSibling);
    c.style.setProperty('--dw', Math.round(W) + 'px');
    c.classList.add('side');
    // still room beside the diagram: borrow trailing notes (a heading and its list) from the columns
    // below, but only when that empties a column (the rest reflows wider) or shortens the tallest one
    const room = () => w.offsetHeight - body.offsetHeight;
    const fits = els => {
      const holder = document.createElement('div'); els.forEach(e => holder.appendChild(e.cloneNode(true)));
      holder.style.cssText = 'position:absolute;visibility:hidden;width:' + body.clientWidth + 'px';
      body.appendChild(holder); const h = holder.offsetHeight; holder.remove(); return h <= room() + 40;
    };
    const cols = Array.from(c.querySelectorAll(':scope > .wt-cols > div'));
    const contentH = x => { const ch = x.children; return ch.length ? ch[ch.length - 1].getBoundingClientRect().bottom - ch[0].getBoundingClientRect().top : 0; };
    const tallest = Math.max(0, ...cols.map(contentH));
    for (const col of cols) {
      if (room() < 60) break;
      const ch = Array.from(col.children), mine = [];
      for (let i = ch.length - 2; i >= 0; i -= 2) {
        if (ch[i].tagName === 'H4' && /^(UL|OL)$/.test(ch[i + 1].tagName) && !hasCode(ch[i + 1])) mine.unshift([ch[i], ch[i + 1]]); else break;
      }
      if (!mine.length) continue;
      const whole = mine.length * 2 === ch.length;
      if (!whole && contentH(col) < tallest - 2) continue;
      const take2 = whole ? (fits(mine.flat()) ? mine : []) : mine.filter(() => true);
      for (const [h, l] of take2) {
        if (!whole && !fits([h, l])) break;
        moved.push([h, col, h.nextSibling], [l, col, l.nextSibling]);
        body.append(h, l);
      }
      if (!col.children.length) col.classList.add('side-empty');
    }
  }

  function relayout() {
    if (!PK.grids.length) PK.grids = $$('main .sec > :is(.grid, .g2, .g3)');
    if (document.body.classList.contains('printing')) return;
    // remember what is at the top of the screen so it stays put
    const topY = (parseFloat(getComputedStyle(root).getPropertyValue('--top')) || 52) + 4;
    let anchor = null;
    if (scrollY > 0) for (const c of $$('main .card, main .sec > h2')) { const r = c.getBoundingClientRect(); if (r.bottom > topY && r.height) { anchor = [c, r.top]; break; } }
    root.classList.add('pk-busy');
    const T = window.__pkDebug ? [['start', performance.now()]] : null, mark = n => T && T.push([n, performance.now()]);

    mark('anchor'); PK.grids.forEach(unpackGrid);
    $$('main .card.full, main .sec > .card').forEach(unside);
    if (window.__csReserve) window.__csReserve();
    mark('unpack'); // measure every grid in its natural layout, then once more with all cards at full width
    const jobs = PK.grids.map(G => {
      const t = getComputedStyle(G).gridTemplateColumns;
      const k = t && t !== 'none' ? t.trim().split(/\s+/).length : 1;
      const kids = G._kids.filter(e => e.parentNode === G);
      const vis = kids.filter(shown);
      return { G, k, gap: parseFloat(getComputedStyle(G).rowGap) || 14, items: vis.map(el => ({ el, full: !isCard(el) || el.classList.contains('full'), h1: el.offsetHeight, w1: el.offsetWidth, minW: minWidth(el), promote: promotable(el), wideCode: wideCode(el) })), hidden: kids.filter(e => !vis.includes(e)) };
    }).filter(j => j.k >= 2 && j.items.length);
    mark('measure1'); jobs.forEach(j => j.G.classList.add('pk-probe'));
    jobs.forEach(j => j.items.forEach(it => { it.hF = it.el.offsetHeight; it.wF = it.el.offsetWidth; }));
    jobs.forEach(j => j.G.classList.remove('pk-probe'));

    mark('probe'); const bands = [];
    jobs.forEach(j => {
      const plan = planGrid(j.items, j.k, j.gap);
      const frag = document.createDocumentFragment();
      plan.forEach(B => {
        if (B.full) { if (B.promoted) B.full.el.classList.add('pk-wide'); frag.appendChild(B.full.el); return; }
        const band = document.createElement('div'); band.className = 'pk-band';
        band.style.setProperty('--k', B.cols.length);
        band._gap = j.gap;
        B.cols.forEach(col => { const d = document.createElement('div'); d.className = 'pk-col'; col.forEach(i => d.appendChild(B.cards[i].el)); band.appendChild(d); });
        frag.appendChild(band);
        if (B.cols.length > 1) bands.push({ band, cols: B.cols, cards: B.cards, gap: j.gap, G: j.G });
      });
      j.hidden.forEach(e => frag.appendChild(e));
      j.G.replaceChildren(frag);
      j.G.classList.add('pk');
    });
    mark('build'); // even out each band's columns by nudging their widths (measured with stretching switched off)
    jobs.forEach(j => j.G.classList.add('pk-measure'));
    bands.forEach(b => { b.avail = b.G.clientWidth - (b.cols.length - 1) * b.gap; });
    balanceBands(bands);
    jobs.forEach(j => j.G.classList.remove('pk-measure'));
    mark('balance'); if (innerWidth > 900) $$('main .card.full, main .card.pk-wide, main .sec > .card').forEach(sideBySide);
    mark('side'); if (window.__csReserve) window.__csReserve();
    if (window.__csRefit) window.__csRefit(); mark('refit');

    if (anchor) { const d = anchor[0].getBoundingClientRect().top - anchor[1]; if (Math.abs(d) > 1) scrollBy(0, d); }
    requestAnimationFrame(() => root.classList.remove('pk-busy'));
    PK.width = innerWidth;
    if (T) { mark('end'); window.__pkTimes = T.map((x, i) => i ? x[0] + ' ' + Math.round(x[1] - T[i - 1][1]) : '').join(' | '); }
  }
  const schedule = (ms = 120) => { clearTimeout(PK.timer); PK.timer = setTimeout(relayout, ms); };
  window.__csRelayout = relayout;
  function initPacking() {
    relayout();
    // text metrics change once the web fonts arrive; repack then (only if they were still loading)
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => schedule(0));
    window.addEventListener('resize', () => { if (innerWidth !== PK.width) schedule(180); });
    // search and study filters hide cards or table rows; density changes every height
    const hid = s => /\b(is-hidden|st-hidden|st-sec-hidden|searching|st-filtering)\b/g;
    const sig = s => ((s || '').match(hid()) || []).sort().join(' ');
    new MutationObserver(ms => {
      if (ms.some(m => sig(m.oldValue) !== sig(m.target.getAttribute('class')))) schedule(document.body.classList.contains('searching') ? 220 : 60);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    new MutationObserver(() => schedule(30)).observe(root, { attributes: true, attributeFilter: ['data-density'] });
    window.addEventListener('beforeprint', () => { document.body.classList.add('printing'); PK.grids.forEach(unpackGrid); $$('main .card.side').forEach(unside); });
    window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); relayout(); });
  }



  /* ---------- problem bank filter ---------- */
  function initProblemBank() {
    const card = $('.pf-card'); if (!card) return;
    const input = $('#pf', card), count = $('#pfc', card), rows = $$('#ptab tbody tr, #ptab tr', card).filter(r => !r.querySelector('th'));
    let group = '';
    const run = () => {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      let n = 0;
      rows.forEach(r => {
        const ok = (!group || r.dataset.g === group) && terms.every(t => r.textContent.toLowerCase().includes(t));
        r.classList.toggle('pf-hide', !ok); if (ok) n++;
      });
      count.textContent = n + (n === 1 ? ' problem' : ' problems');
    };
    input.addEventListener('input', debounce(run, 120));
    $$('.pf-chips button', card).forEach(b => b.addEventListener('click', () => {
      group = b.dataset.g; $$('.pf-chips button', card).forEach(x => x.setAttribute('aria-pressed', String(x === b))); run();
    }));
  }

  /* ---------- first-visit guide, shortcuts, resume ---------- */
  const SHEET = (document.body.className.match(/\bs-(\w+)/) || [])[1] || 'x';
  function initGuide() {
    const hero = $('.hero'); if (!hero) return;
    let seen = null; try { seen = localStorage.getItem('cs.guideSeen'); } catch (e) {}
    const g = document.createElement('div'); g.className = 'guide'; g.hidden = !!seen;
    g.innerHTML = '<b>How to use these sheets</b><ul>' +
      '<li><kbd>/</kbd> searches every card on the page</li>' +
      '<li>Hover a diagram box, a ladder step or a <abbr class="gl">dotted</abbr> abbreviation for an explanation</li>' +
      '<li>Mark cards <em>Known</em> or <em>Review</em>; <em>Study</em> filters them and starts flashcards</li>' +
      '<li>The bar under the top shows where you are; <kbd>[</kbd> <kbd>]</kbd> jump between sections, <kbd>?</kbd> lists all shortcuts</li>' +
      '</ul><button type="button" class="g-close">Got it</button>';
    hero.after(g);
    $('.g-close', g).addEventListener('click', () => { g.hidden = true; try { localStorage.setItem('cs.guideSeen', '1'); } catch (e) {} });
  }
  function initShortcuts() {
    const secs = () => $$('main section.sec[id]').filter(s => s.offsetParent !== null);
    const curIdx = () => { const y = scrollY + 120; let i = 0; secs().forEach((s, k) => { if (s.getBoundingClientRect().top + scrollY <= y) i = k; }); return i; };
    let help = null;
    const toggleHelp = () => {
      if (!help) {
        help = document.createElement('div'); help.id = 'kbd-help'; help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'Keyboard shortcuts');
        help.innerHTML = '<div class="kh-box"><b>Keyboard shortcuts</b><table>' +
          [['/', 'Search this sheet'], ['Esc', 'Clear search, close panels'], ['[ / ]', 'Previous / next section'], ['t', 'Toggle dark mode'],
           ['s', 'Open the Study menu'], ['f', 'Start flashcards'], ['?', 'Show or hide this list'],
           ['Space / 1 / 2', 'In flashcards: show, again, got it']].map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('') +
          '</table><button type="button" class="kh-close">Close</button></div>';
        document.body.appendChild(help);
        help.addEventListener('click', e => { if (e.target === help || e.target.closest('.kh-close')) help.classList.remove('open'); });
      }
      help.classList.toggle('open');
    };
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (document.getElementById('drill') && document.getElementById('drill').classList.contains('open')) return;
      const list = secs();
      if (e.key === ']' || e.key === '[') {
        e.preventDefault();
        const i = Math.max(0, Math.min(list.length - 1, curIdx() + (e.key === ']' ? 1 : -1)));
        list[i].scrollIntoView({ block: 'start' });
      } else if (e.key === '?') { e.preventDefault(); toggleHelp(); }
      else if (e.key === 't') { const b = $('#themeBtn'); if (b) b.click(); }
      else if (e.key === 's') { const b = $('#studyBtn'); if (b) { e.preventDefault(); b.click(); } }
      else if (e.key === 'f') { const b = $('#stDrill'); if (b) { e.preventDefault(); b.click(); } }
      else if (e.key === 'Escape' && help) help.classList.remove('open');
    });
  }
  function initResume() {
    const secs = $$('main section.sec[id]'); if (secs.length < 3) return;
    const key = 'cs.last.' + SHEET;
    let saved = null; try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    window.addEventListener('scroll', debounce(() => {
      const y = scrollY + 140; let cur = null;
      secs.forEach(s => { if (s.offsetParent !== null && s.getBoundingClientRect().top + scrollY <= y) cur = s; });
      if (!cur || scrollY < 300) return;
      const h2 = $('h2', cur), n = $('.n', h2);
      try { localStorage.setItem(key, JSON.stringify({ id: cur.id, label: (n ? n.textContent + ' · ' : '') + (h2.dataset.label || ''), t: Date.now() })); } catch (e) {}
    }, 400), { passive: true });
    if (!saved || location.hash || location.search || !document.getElementById(saved.id) || saved.id === secs[0].id) return;
    const toast = document.createElement('div'); toast.className = 'resume';
    toast.innerHTML = '<span>Continue where you left off</span><a href="#' + saved.id + '"></a><button type="button" aria-label="Dismiss">×</button>';
    $('a', toast).textContent = saved.label;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const close = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); };
    $('a', toast).addEventListener('click', close);
    $('button', toast).addEventListener('click', close);
    setTimeout(close, 12000);
  }

  /* ---------- diagram explanations (hover / focus / tap) ---------- */
  let TIPS = null;
  function tipsFor(key) {
    if (TIPS === null) { try { TIPS = JSON.parse(document.getElementById('cs-tips').textContent); } catch (e) { TIPS = {}; } }
    return TIPS[key] || null;
  }
  function setTip(el, tip, title) {
    if (!el || !tip) return;
    el.setAttribute('data-tip', tip);
    if (title) el.setAttribute('data-tip-title', title);
    el.setAttribute('tabindex', '0');
    el.classList.add('has-tip');
  }
  const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  // node labels may contain <br>: read them with line breaks turned into spaces
  const labelTxt = el => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith(' '));
    c.querySelectorAll('tspan').forEach(s => s.append(' '));
    return txt(c);
  };
  function bindTips(p) {
    const map = tipsFor(p.dataset.key); if (!map) return;
    const svg = p.querySelector('svg'); if (!svg) return;
    let n = 0;
    svg.querySelectorAll('g.node[id]').forEach(g => {
      const m = g.id.match(/^(?:flowchart|state|classId)-(.+)-\d+$/);
      if (m && map[m[1]]) { setTip(g, map[m[1]], g.id.startsWith('flowchart-') ? (labelTxt(g.querySelector('.nodeLabel, .label, text')) || m[1]) : m[1]); n++; }
    });
    svg.querySelectorAll('text.actor').forEach(t => {
      const k = 'p:' + txt(t); if (!map[k]) return;
      setTip(t, map[k], txt(t)); const r = t.previousElementSibling; if (r && r.tagName === 'rect') setTip(r, map[k], txt(t)); n++;
    });
    svg.querySelectorAll('text.messageText').forEach(t => { const k = 'm:' + txt(t); if (map[k]) { setTip(t, map[k], txt(t)); n++; } });
    svg.querySelectorAll('text.noteText').forEach(t => {
      const k = 'n:' + txt(t); if (!map[k]) return;
      setTip(t, map[k], 'Note'); const r = t.previousElementSibling; if (r && r.tagName === 'rect') setTip(r, map[k], 'Note'); n++;
    });
    p.parentElement.classList.toggle('has-tips', n > 0);
  }

  let tipEl = null, tipFor = null, hideTimer = 0;
  function showTip(el) {
    clearTimeout(hideTimer);
    if (!tipEl) {
      tipEl = document.createElement('div'); tipEl.id = 'cs-tip'; tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    if (tipFor === el && tipEl.classList.contains('show')) return;
    tipFor = el;
    const title = el.getAttribute('data-tip-title') || txt(el.querySelector('.l-t b, b, span:last-child')) || '';
    tipEl.innerHTML = (title ? '<b></b>' : '') + '<p></p>';
    if (title) tipEl.querySelector('b').textContent = title;
    tipEl.querySelector('p').textContent = el.getAttribute('data-tip');
    tipEl.classList.add('show');
    const r = el.getBoundingClientRect(), tw = Math.min(340, innerWidth - 24);
    tipEl.style.maxWidth = tw + 'px';
    const h = tipEl.offsetHeight, w = tipEl.offsetWidth;
    let x = r.left + r.width / 2 - w / 2; x = Math.max(12, Math.min(innerWidth - w - 12, x));
    let y = r.top - h - 10, below = false;
    if (y < 60) { y = r.bottom + 10; below = true; }
    if (y + h > innerHeight - 8) y = Math.max(60, innerHeight - h - 8);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    tipEl.classList.toggle('below', below);
    tipEl.style.setProperty('--ax', Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x)) + 'px');
    el.setAttribute('aria-describedby', 'cs-tip');
  }
  function hideTip(now) {
    clearTimeout(hideTimer);
    const go = () => { if (tipEl) tipEl.classList.remove('show'); if (tipFor) tipFor.removeAttribute('aria-describedby'); tipFor = null; };
    if (now) go(); else hideTimer = setTimeout(go, 120);
  }
  const tipTarget = e => e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', e => { lastPointer = e.pointerType; }, true);
  document.addEventListener('mouseover', e => { if (lastPointer === 'touch') return; const t = tipTarget(e); if (t) showTip(t); });
  document.addEventListener('mouseout', e => { if (lastPointer === 'touch') return; const t = tipTarget(e); if (t && !t.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', e => { if (lastPointer === 'touch') return; const t = tipTarget(e); if (t) showTip(t); });
  document.addEventListener('keydown', () => { lastPointer = 'keyboard'; }, true);
  document.addEventListener('focusout', e => { if (tipTarget(e)) hideTip(); });
  document.addEventListener('click', e => {
    const t = tipTarget(e);
    if (lastPointer === 'touch') { if (t) { if (tipFor === t) hideTip(true); else showTip(t); } else hideTip(true); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(true); });
  window.addEventListener('scroll', () => hideTip(true), { passive: true });

  /* ---------- reading progress bar ---------- */
  function initReadbar() {
    const secs = $$('main section.sec[id]'); const top = $('.topbar');
    if (!secs.length || !top) return;
    const bar = document.createElement('div'); bar.className = 'readbar';
    bar.innerHTML = secs.map(s => `<a class="rb-seg" href="#${s.id}"><i></i></a>`).join('') + '<span class="rb-label" aria-hidden="true"></span>';
    top.appendChild(bar);
    const segs = $$('.rb-seg', bar), label = $('.rb-label', bar);
    secs.forEach((s, i) => {
      const h2 = $('h2', s);
      const name = (h2 && (h2.dataset.label || h2.textContent)) || '';
      segs[i].setAttribute('aria-label', 'Jump to ' + name);
      segs[i].dataset.name = name;
    });
    let geo = [], cur = -1, labelTimer = 0;
    const measure = () => {
      geo = secs.map(s => ({ top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight, hidden: s.offsetParent === null }));
      const total = geo.reduce((a, g) => a + (g.hidden ? 0 : g.h), 0) || 1;
      segs.forEach((sg, i) => { sg.style.flexGrow = geo[i].hidden ? 0 : Math.max(geo[i].h / total, 0.004); sg.hidden = geo[i].hidden; });
      update();
    };
    const update = () => {
      const y = scrollY + top.offsetHeight + innerHeight * 0.3;
      let idx = -1;
      geo.forEach((g, i) => {
        const f = g.hidden ? 0 : Math.max(0, Math.min(1, (y - g.top) / g.h));
        segs[i].firstChild.style.width = (f * 100) + '%';
        segs[i].classList.toggle('done', f >= 1);
        if (!g.hidden && y >= g.top && y < g.top + g.h) idx = i;
      });
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) idx = segs.length - 1;
      segs.forEach((sg, i) => sg.classList.toggle('cur', i === idx));
      if (idx !== cur) {
        cur = idx;
        if (idx >= 0 && scrollY > 200) {
          const n = $('.n', $('h2', secs[idx]));
          label.textContent = (n ? n.textContent + '  ' : '') + segs[idx].dataset.name;
          label.classList.add('show'); clearTimeout(labelTimer);
          labelTimer = setTimeout(() => label.classList.remove('show'), 1600);
        }
      }
    };
    let raf = 0;
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
    window.addEventListener('resize', debounce(measure, 150));
    document.addEventListener('toggle', debounce(measure, 100), true);
    new ResizeObserver(debounce(measure, 200)).observe($('main'));
    segs.forEach(sg => {
      sg.addEventListener('mouseenter', () => { label.textContent = sg.dataset.name; label.classList.add('show'); clearTimeout(labelTimer); });
      sg.addEventListener('mouseleave', () => { labelTimer = setTimeout(() => label.classList.remove('show'), 400); });
    });
    measure();
  }

  /* ---------- full-screen diagram viewer ---------- */
  function openViewer(p) {
    const src = p.querySelector('svg'); if (!src) return;
    let lb = $('#mm-viewer');
    if (!lb) {
      lb = document.createElement('div'); lb.id = 'mm-viewer'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
      lb.innerHTML = '<div class="v-bar"><b class="v-title"></b><div class="v-tools">' +
        '<button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="fit">Fit</button>' +
        '<button type="button" data-z="one">100%</button><button type="button" data-z="in" aria-label="Zoom in">+</button>' +
        '<button type="button" data-z="close" aria-label="Close">Close</button></div></div><div class="v-stage"><div class="v-canvas"></div></div>' +
        '<div class="v-hint">Drag to pan · scroll or pinch to zoom · Esc to close</div>';
      document.body.appendChild(lb);
      const st = { s: 1, x: 0, y: 0, W: 0, H: 0 };
      lb._st = st;
      const stage = $('.v-stage', lb), canvas = $('.v-canvas', lb);
      const apply = () => { canvas.style.transform = `translate(${st.x}px,${st.y}px) scale(${st.s})`; };
      const fitView = () => { const r = stage.getBoundingClientRect(); st.s = Math.min(r.width / st.W, r.height / st.H) * 0.94; st.x = (r.width - st.W * st.s) / 2; st.y = (r.height - st.H * st.s) / 2; apply(); };
      const zoomAt = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx = cx ?? r.width / 2; cy = cy ?? r.height / 2; const ns = Math.min(6, Math.max(0.1, st.s * f)); st.x = cx - (cx - st.x) * (ns / st.s); st.y = cy - (cy - st.y) * (ns / st.s); st.s = ns; apply(); };
      lb._fit = fitView;
      lb.addEventListener('click', e => {
        const z = e.target.closest('[data-z]'); if (!z) return;
        const k = z.dataset.z;
        if (k === 'close') closeViewer(); else if (k === 'fit') fitView(); else if (k === 'in') zoomAt(1.25); else if (k === 'out') zoomAt(0.8);
        else if (k === 'one') { const r = stage.getBoundingClientRect(); st.s = 1; st.x = (r.width - st.W) / 2; st.y = Math.max(16, (r.height - st.H) / 2); apply(); }
      });
      stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      const pts = new Map(); let last = null, pinch = null;
      stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; stage.classList.add('drag'); });
      stage.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const [a, b] = [...pts.values()]; const dist = Math.hypot(a[0] - b[0], a[1] - b[1]); const r = stage.getBoundingClientRect();
          if (pinch) zoomAt(dist / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch = dist; return; }
        if (last) { st.x += e.clientX - last[0]; st.y += e.clientY - last[1]; last = [e.clientX, e.clientY]; apply(); }
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { last = null; stage.classList.remove('drag'); } else last = [...pts.values()][0]; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      document.addEventListener('keydown', e => { if (lb.classList.contains('open')) { if (e.key === 'Escape') closeViewer(); if (e.key === '+' || e.key === '=') zoomAt(1.25); if (e.key === '-') zoomAt(0.8); if (e.key === '0') fitView(); } });
      window.addEventListener('resize', () => { if (lb.classList.contains('open')) fitView(); });
    }
    const card = p.closest('.card'); const h3 = card && card.querySelector('h3');
    $('.v-title', lb).textContent = h3 ? (h3.dataset.label || h3.textContent) : 'Diagram';
    const [W, H] = natural(src);
    const clone = src.cloneNode(true);
    clone.setAttribute('width', W); clone.setAttribute('height', H); clone.style.width = W + 'px'; clone.style.height = H + 'px'; clone.style.maxWidth = 'none';
    const canvas = $('.v-canvas', lb); canvas.innerHTML = ''; canvas.appendChild(clone);
    lb._st.W = W; lb._st.H = H;
    lb._return = document.activeElement;
    lb.classList.add('open'); document.documentElement.classList.add('viewer-open');
    lb._fit();
    $('[data-z="close"]', lb).focus();
  }
  function closeViewer() {
    const lb = $('#mm-viewer'); if (!lb) return;
    lb.classList.remove('open'); document.documentElement.classList.remove('viewer-open');
    $('.v-canvas', lb).innerHTML = '';
    if (lb._return && lb._return.focus) lb._return.focus();
  }

  function debounce(f, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; }
  function throttle(f, ms) { let t = 0, p; return (...a) => { const n = Date.now(); if (n - t > ms) { t = n; f(...a); } else { clearTimeout(p); p = setTimeout(() => { t = Date.now(); f(...a); }, ms); } }; }
})();
