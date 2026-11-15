/* Study buddy: narrates the sheet section by section with the browser's speech voices,
   following along on the page (scroll + highlight) with live captions. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const N = window.CS_NARR || {};
  const SHEET = (document.body.className.match(/\bs-(\w+)/) || [])[1] || 'x';
  const synth = window.speechSynthesis;
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('cs.narr.' + k) || 'null'); localStorage.setItem('cs.narr.' + k, JSON.stringify(v)); } catch (e) { return null; } };

  /* ---------- speech text: spoken forms for symbols and abbreviations (captions keep the original) ---------- */
  const inr = n => { const v = +n.replace(/,/g, ''); const f = x => String(+x.toFixed(2)); return v >= 1e7 ? f(v / 1e7) + ' crore' : f(v / 1e5) + ' lakh'; };
  const SAY = [
    [/\b\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d+)?\b(?!\s?(?:crore|lakh))/g, m => inr(m.replace(/\.\d+$/, ''))],
    [/\b([01]\d|2[0-3]):([0-5]\d)\b/g, (m, h, mi) => { h = +h; const ap = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return mi === '00' ? `${hh} ${ap}` : `${hh}:${mi} ${ap}`; }],
    [/\bPEG\b/g, 'P E G'], [/\bAIS\b/g, 'A I S'], [/\bSTT\b/g, 'S T T'], [/\bMTM\b/g, 'mark to market'],
    [/₹\s?(\d[\d,.]*\d|\d)(\s(?:crore|lakh))?/g, (m, n, u) => n + (u || '') + ' rupees'],
    [/\$([\d,.]+)/g, '$1 dollars'],
    [/\bO\(([^)]*)\)/g, (m, x) => 'O of ' + x.replace(/\^2|²/g, ' squared').replace(/\*/g, ' times ').replace(/\blog\b/g, 'log')],
    [/(\w)²/g, '$1 squared'], [/(\w)³/g, '$1 cubed'],
    [/→|⇒/g, ', then '], [/←/g, ' from '], [/×/g, ' times '], [/÷/g, ' divided by '], [/≈|~(?=\d)/g, 'about '],
    [/≤/g, ' at most '], [/≥/g, ' at least '], [/≠/g, ' not equal to '], [/±/g, ' plus or minus '], [/−/g, ' minus '],
    [/\be\.g\.,?/gi, 'for example,'], [/\bi\.e\.,?/gi, 'that is,'], [/\betc\./gi, 'and so on.'], [/\bvs\.?\b/g, 'versus'],
    [/(\d)\s?ms\b/g, '$1 milliseconds'], [/(\d)\s?KB\b/g, '$1 kilobytes'], [/(\d)\s?MB\b/g, '$1 megabytes'], [/(\d)\s?GB\b/g, '$1 gigabytes'], [/(\d)\s?TB\b/g, '$1 terabytes'],
    [/(\d)k\b/g, '$1 thousand'], [/\b(\d+)M\b/g, '$1 million'], [/\b(\d+)B\b/g, '$1 billion'],
    [/\bEV\/EBITDA\b/g, 'E V to ee-bit-dah'], [/\bEV\/EBIT\b/g, 'E V to ee-bit'], [/\bROE\b/g, 'R O E'], [/\bROA\b/g, 'R O A'], [/\bROCE\b/g, 'R O C E'], [/\bROIC\b/g, 'R O I C'], [/\bEBITDA\b/g, 'ee-bit-dah'],
    [/\bEBIT\b/g, 'ee-bit'], [/\bWACC\b/g, 'wack'], [/\bNOPAT\b/g, 'no-pat'], [/\bVWAP\b/g, 'V-WAP'], [/\bCAGR\b/g, 'kagger'],
    [/\bSaaS\b/g, 'sass'], [/\bNoSQL\b/g, 'no-sequel'], [/\bSQL\b/g, 'sequel'], [/\bgRPC\b/g, 'G R P C'], [/\bJWT\b/g, 'J W T'],
    [/\bLoRA\b/g, 'lora'], [/\bQLoRA\b/g, 'Q-lora'], [/\bCHoCH\b/g, 'change of character'], [/\bPACELC\b/g, 'pass-elk'],
    [/\bDSU\b/g, 'D S U'], [/\bLRU\b/g, 'L R U'], [/\bLFU\b/g, 'L F U'], [/\bOOP\b/g, 'O O P'], [/\bDAG\b/g, 'dag'],
    [/\bHH\/HL\b/g, 'higher highs and higher lows'], [/\bLH\/LL\b/g, 'lower highs and lower lows'], [/\bR:R\b/g, 'reward to risk'],
    [/\bP\/E\b/g, 'P E'], [/\bP\/B\b/g, 'P B'], [/\bCASA\b/g, 'casa'],
    [/\bUS\b/g, 'U S'], [/\bIT\b/g, 'I T'], [/\bIV\b/g, 'I V'], [/\bIO\b/g, 'I O'], [/\bNP\b/g, 'N P'], [/\bUSE\b/g, 'U S E'],
    [/\bIDs\b/g, 'I Ds'], [/\bID\b/g, 'I D'], [/\bInd AS\b/g, 'Ind A S'],
    [/(\d)%/g, '$1 percent'], [/&/g, ' and '], [/\s\/\s/g, ' or '], [/[`*_#]/g, ''], [/\s+/g, ' ']
  ];
  const PAUSE = '⏸';
  const speakable = t => SAY.reduce((s, [a, b]) => s.replace(a, b), t).trim();
  const SPLIT = /(?<=[.!?])\s+(?=["“(A-Z0-9])/;
  // long sentences are cut at ; : or commas so no single utterance runs much past ~15 seconds (some voices stop there)
  const wc = x => x.split(/\s+/).length;
  function chunk(s) {
    if (wc(s) <= 32) return [s];
    for (const re of [/(?<=;)\s+/, /(?<=:)\s+/, /(?<=,)\s+/]) {
      const parts = s.split(re);
      if (parts.length < 2) continue;
      const out = []; let cur = '';
      parts.forEach(pt => { const nx = cur ? cur + ' ' + pt : pt; if (cur && wc(nx) > 30) { out.push(cur); cur = pt; } else cur = nx; });
      if (cur) out.push(cur);
      if (out.length > 1) return out.flatMap(chunk);
    }
    return [s];
  }
  const sentences = p => p.split(SPLIT).map(x => x.trim()).filter(Boolean).flatMap(chunk);

  /* ---------- playlist ---------- */
  function buildPlaylist() {
    const list = [];
    $$('main section.sec[data-sid]').forEach(sec => {
      const segs = (N[sec.dataset.origin] || {})[sec.dataset.sid];
      if (!segs) return;
      const h2 = $('h2', sec), num = h2 && $('.n', h2);
      const entry = { sec, title: (num ? num.textContent + ' · ' : '') + (h2 ? h2.dataset.label || '' : ''), segs: [] };
      segs.forEach(([ck, paras]) => {
        const card = ck ? (sec.querySelector('.card[data-ck="' + ck + '"]') || null) : null;
        const sents = []; paras.forEach(p => sentences(p).forEach(s => sents.push(s)));
        if (sents.length) entry.segs.push({ ck, card, sents, label: card ? ((($('h3', card) || {}).dataset || {}).label || '') : '' });
      });
      if (entry.segs.length) list.push(entry);
    });
    return list;
  }

  let PL = [], pos = { s: 0, g: 0, t: 0 }, playing = false, follow = true, rate = LS('rate') || 1, voice = null, utter = null, timer = null, gen = 0, readMode = false;
  const visible = el => !!(el && el.getClientRects().length && !el.closest('.is-hidden'));
  const segOK = (s, g) => { const sg = PL[s] && PL[s].segs[g]; return sg && visible(PL[s].sec) && (!sg.card || visible(sg.card)); };
  const wordsLeft = () => { let w = 0; for (let s = pos.s; s < PL.length; s++) PL[s].segs.forEach((sg, g) => { if (s > pos.s || g >= pos.g) sg.sents.forEach(t => w += t.split(' ').length); }); return w; };

  /* ---------- voices ---------- */
  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
    if (!vs.length) return null;
    const saved = LS('voice'); const sv = saved && vs.find(v => v.name === saved);
    if (sv) return sv;
    const score = v => (/premium/i.test(v.name) ? 60 : 0) + (/enhanced|natural|neural/i.test(v.name) ? 40 : 0) + (/google (uk|us) english/i.test(v.name) ? 30 : 0)
      + (/samantha|daniel|karen|moira|serena|ava|zoe|evan|nathan|aria|jenny|guy|sonia|libby|ryan/i.test(v.name) ? 20 : 0)
      + (/en[-_](us|gb)/i.test(v.lang) ? 5 : 0) + (v.localService ? 2 : 0) - (/compact|eloquence|grandma|grandpa|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|ralph|kathy|bahh/i.test(v.name) ? 100 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0];
  }

  /* ---------- UI ---------- */
  const ICON = {
    play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4c0 .6.6.9 1.1.6l8-5.2a.7.7 0 0 0 0-1.2l-8-5.2c-.5-.3-1.1 0-1.1.6z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>',
    prev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3v10M13 3.5 6.5 8l6.5 4.5z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12.5 3v10M3 3.5 9.5 8 3 12.5z" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.5h2.5"/></svg>',
    fwd: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5"/></svg>',
    head: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 10V8a5.5 5.5 0 0 1 11 0v2"/><rect x="2" y="9.5" width="3" height="4.5" rx="1.2"/><rect x="11" y="9.5" width="3" height="4.5" rx="1.2"/></svg>',
    min: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8h8"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    text: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4h10M3 7h10M3 10h7M3 13h5"/></svg>'
  };
  let P = null;
  function buildPanel() {
    P = document.createElement('aside');
    P.id = 'buddy'; P.className = 'buddy'; P.hidden = true;
    P.setAttribute('aria-label', 'Study buddy narration');
    P.innerHTML = `
      <div class="bd-head">
        <div class="bd-avatar" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19"/><path class="cap" d="M8 15 20 9l12 6-12 6z"/><path class="cap" d="M13 18v5c0 2 3.2 3.5 7 3.5s7-1.5 7-3.5v-5"/><path class="tassel" d="M32 15v6"/></svg><span class="bd-bars"><i></i><i></i><i></i><i></i></span></div>
        <div class="bd-who"><b>Buddy</b><span class="bd-state">Ready when you are</span></div>
        <button type="button" class="bd-ic bd-tx" title="Show the full script for this section" aria-label="Show transcript" aria-pressed="false">${ICON.text}</button>
        <button type="button" class="bd-ic bd-min" title="Minimise" aria-label="Minimise">${ICON.min}</button>
        <button type="button" class="bd-ic bd-x" title="Stop and close (Esc)" aria-label="Stop and close">${ICON.close}</button>
      </div>
      <div class="bd-body">
        <a class="bd-where" href="#"></a>
        <div class="bd-card"></div>
        <p class="bd-cap" aria-live="off"></p>
        <div class="bd-script" hidden></div>
        <div class="bd-prog"><span class="bd-bar"><i></i></span><span class="bd-left"></span></div>
        <div class="bd-ctl">
          <button type="button" class="bd-b bd-ps" title="Previous section" aria-label="Previous section">${ICON.prev}</button>
          <button type="button" class="bd-b bd-pb" title="Back one sentence" aria-label="Back one sentence">${ICON.back}</button>
          <button type="button" class="bd-b bd-play" title="Play or pause (L)" aria-label="Play">${ICON.play}</button>
          <button type="button" class="bd-b bd-nf" title="Skip to the next card" aria-label="Next card">${ICON.fwd}</button>
          <button type="button" class="bd-b bd-ns" title="Next section" aria-label="Next section">${ICON.next}</button>
        </div>
        <div class="bd-opts">
          <label>Speed <select class="bd-rate">${[0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75].map(r => `<option value="${r}">${r}×</option>`).join('')}</select></label>
          <label class="bd-vl">Voice <select class="bd-voice"></select></label>
          <button type="button" class="bd-follow" hidden>Follow along</button>
        </div>
        <p class="bd-note" hidden></p>
      </div>`;
    document.body.appendChild(P);
    const rs = $('.bd-rate', P); rs.value = String(rate);
    rs.addEventListener('change', () => { rate = +rs.value; LS('rate', rate); if (playing) restartSentence(); updProg(); });
    $('.bd-voice', P).addEventListener('change', e => { voice = synth.getVoices().find(v => v.name === e.target.value) || voice; LS('voice', voice && voice.name); if (playing) restartSentence(); });
    $('.bd-play', P).addEventListener('click', toggle);
    $('.bd-ps', P).addEventListener('click', () => jumpSection(-1));
    $('.bd-ns', P).addEventListener('click', () => jumpSection(1));
    $('.bd-pb', P).addEventListener('click', () => step(-1));
    $('.bd-nf', P).addEventListener('click', () => nextCard());
    $('.bd-x', P).addEventListener('click', closePanel);
    $('.bd-min', P).addEventListener('click', () => { P.classList.toggle('mini'); });
    $('.bd-tx', P).addEventListener('click', e => { const b = e.currentTarget, o = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(o)); $('.bd-script', P).hidden = !o; P.classList.toggle('tx', o); renderScript(); });
    $('.bd-follow', P).addEventListener('click', () => { follow = true; $('.bd-follow', P).hidden = true; focusCurrent(true); });
    $('.bd-where', P).addEventListener('click', e => { e.preventDefault(); follow = true; $('.bd-follow', P).hidden = true; focusCurrent(true); });
    $('.bd-script', P).addEventListener('click', e => { const sp = e.target.closest('[data-g]'); if (!sp) return; pos.g = +sp.dataset.g; pos.t = +sp.dataset.t; follow = true; $('.bd-follow', P).hidden = true; show(); if (playing) restartSentence(); else focusCurrent(true); });
    fillVoices();
  }
  function fillVoices() {
    if (!P || !synth) return;
    const sel = $('.bd-voice', P);
    const vs = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
    voice = voice && vs.includes(voice) ? voice : pickVoice();
    sel.innerHTML = vs.map(v => `<option value="${v.name.replace(/"/g, '&quot;')}">${v.name.replace(/</g, '&lt;')} (${v.lang})</option>`).join('');
    if (voice) sel.value = voice.name;
    $('.bd-vl', P).hidden = !vs.length;
  }

  /* ---------- page following ---------- */
  let lastCard = null, autoScrollUntil = 0;
  function focusCurrent(force) {
    const e = PL[pos.s]; if (!e) return;
    const sg = e.segs[pos.g]; const target = (sg && sg.card) || e.sec;
    if (lastCard !== (sg && sg.card)) {
      if (lastCard) lastCard.classList.remove('narr-on');
      lastCard = sg && sg.card; if (lastCard) lastCard.classList.add('narr-on');
    }
    $$('section.narr-sec-on').forEach(x => { if (x !== e.sec) x.classList.remove('narr-sec-on'); });
    e.sec.classList.add('narr-sec-on');
    if (!follow && !force) return;
    const r = target.getBoundingClientRect(), top = 64, vh = innerHeight - (P && !P.classList.contains('mini') && innerWidth < 760 ? P.offsetHeight : 0);
    const inView = r.top >= top - 4 && (r.bottom <= vh - 12 || r.top < vh * 0.35);
    if (inView && !force) return;
    autoScrollUntil = Date.now() + 1200;
    const y = target === e.sec ? r.top + scrollY - top : r.top + scrollY - Math.max(top + 8, Math.min((vh - r.height) / 2, vh * 0.22));
    scrollTo({ top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  const userScrolled = () => { if (!playing || Date.now() < autoScrollUntil || !follow) return; follow = false; if (P) $('.bd-follow', P).hidden = false; };
  ['wheel', 'touchmove'].forEach(ev => addEventListener(ev, userScrolled, { passive: true }));
  addEventListener('keydown', e => { if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key) && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) userScrolled(); });

  /* ---------- rendering ---------- */
  function show() {
    const e = PL[pos.s]; if (!e || !P) return;
    const sg = e.segs[pos.g];
    $('.bd-where', P).textContent = e.title;
    const cd = $('.bd-card', P); cd.textContent = sg && sg.label ? sg.label : (pos.g === 0 ? 'Introduction' : 'Wrap-up');
    const cur = sg ? sg.sents[pos.t] || '' : '';
    $('.bd-cap', P).textContent = cur === PAUSE ? 'Your turn: answer out loud, then listen…' : cur;
    renderScript(); updProg();
  }
  let scriptFor = -1;
  function renderScript() {
    const box = $('.bd-script', P); if (!box || box.hidden) return;
    const e = PL[pos.s]; if (!e) return;
    if (scriptFor !== pos.s) {
      scriptFor = pos.s;
      box.innerHTML = e.segs.map((sg, g) => `<div class="bd-sg">${sg.label ? `<b>${esc(sg.label)}</b>` : ''}<p>${sg.sents.map((t, i) => `<span data-g="${g}" data-t="${i}">${t === PAUSE ? '…' : esc(t)}</span>`).join(' ')}</p></div>`).join('');
    }
    $$('span.on', box).forEach(x => x.classList.remove('on'));
    const cur = box.querySelector(`span[data-g="${pos.g}"][data-t="${pos.t}"]`);
    if (cur) { cur.classList.add('on'); const br = box.getBoundingClientRect(), cr = cur.getBoundingClientRect(); if (cr.top < br.top || cr.bottom > br.bottom) box.scrollTop += cr.top - br.top - 40; }
  }
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function updProg() {
    if (!P) return;
    let tot = 0, done = 0;
    PL.forEach((e, s) => e.segs.forEach((sg, g) => { const n = sg.sents.length; tot += n; if (s < pos.s || (s === pos.s && g < pos.g)) done += n; else if (s === pos.s && g === pos.g) done += pos.t; }));
    $('.bd-bar i', P).style.width = (tot ? done * 100 / tot : 0) + '%';
    const mins = Math.round(wordsLeft() / (155 * rate));
    $('.bd-left', P).textContent = `Section ${pos.s + 1} of ${PL.length} · ${mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min'} left`;
  }
  function setState(txt) { if (P) $('.bd-state', P).textContent = txt; }
  function setPlayingUI(on) {
    if (!P) return;
    P.classList.toggle('speaking', on);
    const b = $('.bd-play', P); b.innerHTML = on ? ICON.pause : ICON.play; b.setAttribute('aria-label', on ? 'Pause' : 'Play');
    const tb = $('#listenBtn'); if (tb) { tb.classList.toggle('on', on); tb.setAttribute('aria-pressed', String(on)); }
    setState(on ? 'Explaining…' : (readMode ? 'Read-along paused' : 'Paused'));
  }

  /* ---------- engine ---------- */
  function normalise() {
    // move to the first playable sentence at or after pos
    while (PL[pos.s]) {
      const e = PL[pos.s];
      if (!visible(e.sec)) { pos.s++; pos.g = 0; pos.t = 0; continue; }
      if (pos.g >= e.segs.length) { pos.s++; pos.g = 0; pos.t = 0; continue; }
      if (!segOK(pos.s, pos.g)) { pos.g++; pos.t = 0; continue; }
      if (pos.t >= e.segs[pos.g].sents.length) { pos.g++; pos.t = 0; continue; }
      return true;
    }
    return false;
  }
  function speakCurrent() {
    clearTimeout(timer);
    if (!normalise()) { finish(); return; }
    show(); focusCurrent(false); save();
    const text = PL[pos.s].segs[pos.g].sents[pos.t];
    const my = ++gen;
    if (text === PAUSE) { timer = setTimeout(() => { if (my === gen && playing) advance(); }, 4500 / rate); return; }
    if (readMode) { timer = setTimeout(() => { if (my === gen && playing) advance(); }, Math.max(1800, text.split(' ').length * 380 / rate)); return; }
    const u = new SpeechSynthesisUtterance(speakable(text));
    u.rate = rate; if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
    u.onend = () => { if (my === gen && playing) advance(); };
    u.onerror = ev => { if (my !== gen || !playing) return; if (ev.error === 'interrupted' || ev.error === 'canceled') return; advance(); };
    utter = u; // keep a reference: some browsers drop events for collected utterances
    synth.speak(u);
    // watchdog: a few engines stall without firing onend
    const est = (text.split(' ').length / (2.6 * rate)) * 1000 + 4000;
    timer = setTimeout(() => { if (my === gen && playing && !synth.speaking) advance(); }, est);
  }
  function advance() {
    const e = PL[pos.s]; if (!e) return finish();
    const prevSec = pos.s;
    pos.t++;
    if (pos.t >= e.segs[pos.g].sents.length) { pos.g++; pos.t = 0; }
    if (pos.g >= e.segs.length) { pos.s++; pos.g = 0; pos.t = 0; }
    if (pos.s !== prevSec && PL[pos.s]) { // short breath between sections
      clearTimeout(timer); const my = ++gen; timer = setTimeout(() => { if (my === gen && playing) speakCurrent(); }, 900); return;
    }
    speakCurrent();
  }
  function stopSpeech() { gen++; clearTimeout(timer); if (synth && !readMode) synth.cancel(); }
  function play() {
    if (!PL.length) return;
    if (!P) buildPanel();
    P.hidden = false; document.body.classList.add('buddy-open');
    playing = true; setPlayingUI(true);
    if (synth && !readMode) { synth.cancel(); setTimeout(() => { if (playing) speakCurrent(); }, 60); } else speakCurrent();
  }
  function pause() { playing = false; stopSpeech(); setPlayingUI(false); save(); }
  function toggle() { if (playing) pause(); else play(); }
  function restartSentence() { stopSpeech(); setTimeout(() => { if (playing) speakCurrent(); }, 60); }
  function step(d) { // one sentence back (or forward)
    stopSpeech();
    if (d < 0) {
      if (pos.t > 0) pos.t--;
      else { let s = pos.s, g = pos.g - 1; while (s >= 0) { if (g < 0) { s--; g = s >= 0 ? PL[s].segs.length - 1 : -1; continue; } if (segOK(s, g)) break; g--; } if (s >= 0) { pos.s = s; pos.g = g; pos.t = PL[s].segs[g].sents.length - 1; } }
    }
    follow = true; if (P) $('.bd-follow', P).hidden = true;
    if (playing) speakCurrent(); else { normalise(); show(); focusCurrent(true); }
  }
  function nextCard() { stopSpeech(); pos.g++; pos.t = 0; follow = true; if (P) $('.bd-follow', P).hidden = true; if (!normalise()) return finish(); if (playing) speakCurrent(); else { show(); focusCurrent(true); } }
  function jumpSection(d) {
    stopSpeech();
    if (d < 0 && (pos.g > 0 || pos.t > 0)) { pos.g = 0; pos.t = 0; }
    else { pos.s = Math.max(0, Math.min(PL.length - 1, pos.s + d)); pos.g = 0; pos.t = 0; }
    if (d < 0) while (pos.s > 0 && !visible(PL[pos.s].sec)) pos.s--;
    follow = true; if (P) $('.bd-follow', P).hidden = true;
    if (playing) speakCurrent(); else { normalise(); show(); focusCurrent(true); }
  }
  function startAt(si) { stopSpeech(); pos = { s: si, g: 0, t: 0 }; follow = true; if (P) $('.bd-follow', P).hidden = true; play(); }
  function finish() {
    playing = false; stopSpeech(); setPlayingUI(false);
    if (lastCard) lastCard.classList.remove('narr-on'); lastCard = null;
    setState('That was the whole sheet. Well done!');
    if (P) { $('.bd-cap', P).textContent = 'We have reached the end of this sheet. Press play to start again from the top, or pick a section and press its Listen button.'; }
    pos = { s: 0, g: 0, t: 0 }; LS('pos.' + SHEET, null);
  }
  function closePanel() { pause(); if (P) P.hidden = true; document.body.classList.remove('buddy-open'); if (lastCard) lastCard.classList.remove('narr-on'); lastCard = null; $$('section.narr-sec-on').forEach(x => x.classList.remove('narr-sec-on')); }
  function save() { const e = PL[pos.s]; if (e) LS('pos.' + SHEET, { sid: e.sec.dataset.sid, o: e.sec.dataset.origin, g: pos.g, t: pos.t, at: Date.now() }); }
  function sectionInView() {
    const y = scrollY + 140; let idx = 0;
    PL.forEach((e, i) => { if (visible(e.sec) && e.sec.getBoundingClientRect().top + scrollY <= y) idx = i; });
    return idx;
  }

  /* ---------- entry points ---------- */
  function init() {
    PL = buildPlaylist();
    if (!PL.length) return;
    readMode = !synth || typeof SpeechSynthesisUtterance === 'undefined';
    // top-bar button
    const right = $('.topbar .tb-right');
    if (right) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'listenBtn'; b.className = 'iconbtn listen-btn'; b.title = 'Listen: your study buddy explains this sheet (L)';
      b.setAttribute('aria-pressed', 'false'); b.innerHTML = ICON.head + '<span>Listen</span>';
      right.insertBefore(b, $('.study-wrap', right) || right.firstElementChild);
      b.addEventListener('click', () => {
        if (playing) { pause(); return; }
        if (!P || P.hidden) {
          const saved = LS('pos.' + SHEET);
          const here = sectionInView();
          // resume a stopped lesson if the reader is still in that section; otherwise start where they are reading
          if (saved && PL[here] && PL[here].sec.dataset.sid === saved.sid && PL[here].sec.dataset.origin === saved.o) pos = { s: here, g: saved.g || 0, t: saved.t || 0 };
          else pos = { s: here, g: 0, t: 0 };
        }
        follow = true; play();
      });
    }
    // per-section listen buttons
    PL.forEach((e, i) => {
      const h2 = $('h2', e.sec); if (!h2) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'narr-sec'; b.title = 'Listen to this section'; b.innerHTML = ICON.play + '<span>Listen</span>';
      b.setAttribute('aria-label', 'Listen to section: ' + (h2.dataset.label || ''));
      b.addEventListener('click', ev => { ev.preventDefault(); startAt(i); });
      h2.appendChild(b);
    });
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (document.getElementById('drill') && document.getElementById('drill').classList.contains('open')) return;
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); const b = $('#listenBtn'); if (playing) pause(); else if (b) b.click(); }
      else if (e.key === 'Escape' && P && !P.hidden && playing) pause();
    });
    if (synth) {
      if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', fillVoices); else synth.onvoiceschanged = fillVoices;
      setTimeout(() => { if (!synth.getVoices().length && !voice) { readMode = true; if (P) { const n = $('.bd-note', P); n.hidden = false; n.textContent = 'No speech voices found in this browser, so Buddy will show the captions as a read-along instead.'; } } }, 2500);
    }
    // stop speaking when the page goes away
    addEventListener('pagehide', () => { if (synth) synth.cancel(); });
    window.__csNarr = { play, pause, startAt, state: () => ({ playing, pos: { ...pos }, sections: PL.length, follow, readMode }), playlist: () => PL, speakable };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
