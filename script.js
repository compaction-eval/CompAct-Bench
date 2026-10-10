(() => {
  'use strict';

  /* ------------------------------------------------------------------
     utils
     ------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const h = (tag, cls, html, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const onceVisible = (el, fn, opts = { threshold: .2 }) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(el); } });
    }, opts);
    io.observe(el);
  };
  const animateNum = (el, from, to, dur, fmt) => new Promise(res => {
    if (REDUCED || dur <= 0) { el.textContent = fmt(to); res(); return; }
    const t0 = performance.now();
    const f = now => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = fmt(lerp(from, to, ease(p)));
      if (p < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  let toastT = 0;
  const toast = msg => {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  };
  const copyText = async txt => {
    try { await navigator.clipboard.writeText(txt); return true; }
    catch (e) {
      const ta = h('textarea', null, null, document.body);
      ta.value = txt; ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove(); return ok;
    }
  };

  /* ------------------------------------------------------------------
     data · from the paper (Tables 1, 2, 6, 9, 11, 12, 13, 14, 16, 17)
     ------------------------------------------------------------------ */
  // name, cfg, search[25,50,75,all], coding[...], workspace[...], overall, CI{s,c,w,o}, IRC[median,q1,q3,inTol,calls]
  const MODELS = [
    ['Claude Opus 5', 'Max', [73.1, 57.7, 55.6, 62.0], [72.7, 80.6, 90.6, 81.2], [37.5, 55.6, 25.0, 40.0], 68.5, [[51.9, 72.2], [72.9, 88.5], [20.0, 60.0], [62.0, 74.5]], [.1011, .0987, .1027, 81.5, 11.8]],
    ['Gemini 3.8 Flash', 'High', [61.5, 57.7, 51.9, 57.0], [69.7, 67.7, 87.5, 75.0], [50.0, 77.8, 37.5, 56.0], 65.5, [[46.8, 67.1], [66.7, 83.3], [36.0, 76.0], [59.0, 72.0]], [.0984, .0973, .1000, 90.0, 7.5]],
    ['Kimi K3', 'Max', [65.4, 50.0, 37.0, 50.6], [75.8, 74.2, 87.5, 79.2], [25.0, 55.6, 12.5, 32.0], 62.0, [[39.2, 62.0], [70.8, 87.5], [16.0, 52.0], [55.5, 68.5]], [.0998, .0978, .1015, 84.5, 4.6]],
    ['GPT-5.6-Sol', 'Max', [61.5, 50.0, 44.4, 51.9], [63.6, 74.2, 90.6, 76.0], [12.5, 33.3, 12.5, 20.0], 59.5, [[40.5, 63.3], [67.7, 84.4], [4.0, 36.0], [53.0, 66.0]], [.0978, .0973, .0996, 94.5, 5.8]],
    ['DeepSeek V4 Pro', 'Max', [53.8, 46.2, 33.3, 44.3], [62.1, 72.6, 82.8, 72.4], [37.5, 55.6, 37.5, 44.0], 57.8, [[34.8, 53.8], [64.1, 80.2], [28.0, 60.0], [52.0, 63.5]], [.0986, .0975, .1005, 94.5, 5.1]],
    ['HY3', 'High', [50.0, 42.3, 40.7, 44.3], [60.6, 74.2, 84.4, 72.9], [37.5, 33.3, 50.0, 40.0], 57.5, [[32.9, 55.7], [64.6, 81.2], [20.0, 60.0], [51.0, 64.5]], [.0978, .0973, .0997, 94.5, 7.3]],
    ['GLM 5.3 Flash', 'Max', [57.7, 30.8, 29.6, 39.2], [69.7, 71.0, 87.5, 76.0], [25.0, 55.6, 37.5, 40.0], 57.0, [[27.8, 50.6], [67.7, 84.4], [20.0, 60.0], [50.5, 63.5]], [.0993, .0979, .1008, 93.0, 6.0]],
    ['Qwen 3.8 Flash', 'Max', [42.3, 26.9, 33.3, 34.2], [63.6, 80.6, 87.5, 77.1], [50.0, 22.2, 25.0, 32.0], 54.5, [[24.1, 44.3], [68.8, 85.4], [16.0, 52.0], [48.5, 61.0]], [.0991, .0976, .1003, 98.5, 4.7]],
    ['GLM 5.2', 'Max', [50.0, 42.3, 7.4, 32.9], [63.6, 74.2, 87.5, 75.0], [12.5, 44.4, 12.5, 24.0], 52.0, [[22.8, 43.0], [65.6, 83.3], [8.0, 40.0], [45.5, 58.5]], [.0985, .0973, .0999, 83.5, 9.5]],
    ['Gemini 3.1 Pro Preview', 'High', [38.5, 38.5, 40.7, 39.2], [60.6, 67.7, 84.4, 70.8], [12.5, 22.2, 12.5, 16.0], 51.5, [[29.1, 50.6], [61.5, 80.2], [4.0, 32.0], [45.0, 58.0]], [.0978, .0972, .0992, 83.5, 9.9]],
    ['Qwen 3.7 Plus', '64K', [34.6, 38.5, 22.2, 31.6], [51.5, 67.7, 81.2, 66.7], [12.5, 44.4, 37.5, 32.0], 48.5, [[21.5, 41.8], [57.3, 76.0], [16.0, 52.0], [42.0, 55.0]], [.0979, .0972, .0997, 82.0, 11.2]],
    ['Doubao Seed 2.1 Pro', 'High', [46.2, 30.8, 18.5, 31.6], [54.5, 67.7, 81.2, 67.7], [12.5, 0.0, 12.5, 8.0], 46.0, [[21.5, 41.8], [58.3, 77.1], [0.0, 20.0], [40.0, 52.5]], [.0990, .0972, .1038, 52.5, 8.5]]
  ].map(([n, cfg, s, c, w, o, ci, irc]) => ({ n, cfg, s, c, w, o, ci: { s: ci[0], c: ci[1], w: ci[2], o: ci[3] }, irc }));

  const DOM = {
    s: { name: 'Search', bench: 'BrowseComp', tasks: 79, rounds: 30.4, avg: 35.3, med: 23.0, tok: [8.2, 15.8, 29.3], full: [33.4, 32.2, 40.3], nb: [26, 26, 27], rb: [30.4, 28.0, 32.7], exec: 'Claude Opus 4.8', color: 'var(--d-s)', scolor: 'var(--ds-s)', state: 'Context-resident evidence' },
    c: { name: 'Coding', bench: 'SWE-bench', tasks: 96, rounds: 19.4, avg: 8.8, med: 7.7, tok: [2.3, 4.6, 5.5], full: [8.4, 9.2, 8.6], nb: [33, 31, 32], rb: [19.1, 19.4, 19.9], exec: 'Claude Opus 4.8', color: 'var(--d-c)', scolor: 'var(--ds-c)', state: 'Repository-backed progress' },
    w: { name: 'Workspace', bench: 'CompanyBench', tasks: 25, rounds: 58.5, avg: 122.8, med: 115.0, tok: [41.2, 64.8, 90.0], full: [128.1, 115.3, 125.8], nb: [8, 9, 8], rb: [57.9, 60.9, 56.4], exec: 'GPT-5.5 Codex', color: 'var(--d-w)', scolor: 'var(--ds-w)', state: 'Persistent workspace state' }
  };
  const KEYS = ['s', 'c', 'w'];
  const BND = ['25%', '50%', '75%'];
  const avgOf = (d, b) => MODELS.reduce((a, m) => a + m[d][b], 0) / MODELS.length;
  const overallAt = (m, b) => {
    if (b === 3) return m.o;
    const n = KEYS.map(k => DOM[k].nb[b]);
    return KEYS.reduce((a, k, i) => a + m[k][b] * n[i], 0) / n.reduce((a, x) => a + x, 0);
  };

  const ERR = [
    ['CO', 'Critical omission', 47.8, 48.8],
    ['FD', 'Factual distortion', 40.3, 35.2],
    ['PC', 'Premature commitment', 56.7, 46.0],
    ['LR', 'Lost resolution', 0.0, 3.6],
    ['PSL', 'Progress/state loss', 55.2, 44.6],
    ['CGD', 'Constraint/goal distortion', 25.4, 24.3]
  ];
  const BEH = ['Redundant tools', 'Reopened question', 'Unverified commit', 'Repeated work', 'Skipped work', 'Constraint deviation', 'Info. recovery'];
  const BEH_RATE = [76.3, 30.1, 45.9, 54.8, 9.8, 27.8, 95.1];
  const HEAT = {
    CO: [5.8, 3.4, -2.6, 18.2, 2.2, 6.7, 1.9],
    FD: [7.0, 1.8, 7.3, 7.4, 1.3, 0.0, 0.1],
    PC: [-7.0, 2.6, 5.2, -2.0, 4.2, -10.9, -0.5],
    LR: [12.7, -3.0, -0.1, 14.2, -7.2, -8.1, -3.8],
    PSL: [2.5, -2.1, 1.9, 13.8, 3.6, 8.3, 2.8],
    CGD: [2.8, 5.7, 10.5, 1.5, 1.8, 1.7, -2.4]
  };

  /* ------------------------------------------------------------------
     sound · tiny WebAudio blips, off by default
     ------------------------------------------------------------------ */
  const sfx = (() => {
    let ctx = null, on = false;
    const ensure = () => {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
      return ctx;
    };
    const tone = (f, d = .06, type = 'square', v = .03, slide) => {
      if (!on) return;
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
    };
    return {
      toggle() { on = !on; if (on) { const c = ensure(); if (c) c.resume(); tone(660, .08, 'square', .04); } return on; },
      click: () => tone(1800, .02, 'square', .02),
      tick: () => tone(2400, .012, 'square', .008),
      ok: () => { tone(880, .09, 'triangle', .05); setTimeout(() => tone(1320, .12, 'triangle', .05), 90); },
      bad: () => tone(170, .25, 'sawtooth', .035, 90),
      whir: () => tone(300, .35, 'sawtooth', .014, 900),
      stamp: () => tone(90, .18, 'square', .06, 50)
    };
  })();

  const hlFns = [];
  const onHL = f => hlFns.push(f);
  const hl = i => hlFns.forEach(f => f(i));

  window.CB = { $, $$, clamp, lerp, ease, easeIO, seg, sleep, rand, svg, h, store, onceVisible, animateNum, toast, copyText, REDUCED, MODELS, DOM, KEYS, BND, avgOf, overallAt, ERR, sfx, onHL, hl };

  /* ------------------------------------------------------------------
     chrome
     ------------------------------------------------------------------ */
  function chrome() {
    const root = document.documentElement;
    const applyTheme = t => { root.dataset.theme = t; };
    const saved = store.get('cb-theme');
    if (saved) applyTheme(saved);
    $('#themeBtn').addEventListener('click', () => {
      const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(t); store.set('cb-theme', t); sfx.click();
    });
    const sb = $('#soundBtn');
    sb.addEventListener('click', () => sb.setAttribute('aria-pressed', String(sfx.toggle())));
    const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

    /* Hy AI Studio reads ?prompt= on its chat home and pre-fills the input box
       (logged-in users only; it does not auto-send). The prompt is also copied
       on click so it can be pasted after logging in. Keep it free of "%":
       the site decodes the value a second time. */
    const ask = $('#askBtn');
    if (ask) {
      const site = 'https://compaction-eval.github.io/CompAct-Bench/';
      const prompt = `I'd like to discuss the paper "CompAct-Bench: A Benchmark for Working-Context Compaction in Long-Horizon Agent Tasks".\nPaper PDF: ${site}assets/compact-bench-paper.pdf\nProject page: ${site}\nPlease read it first, then answer my questions about it professionally in English, using markdown for structured answers.`;
      ask.href = `https://aistudio.tencent.com/?utm_source=hy&prompt=${encodeURIComponent(prompt)}`;
      ask.addEventListener('click', () => { copyText(prompt).then(ok => ok && toast('Prompt copied. Paste it into Hunyuan if the box is empty.')); });
    }

    /* nav: border after hero, progress, hide on scroll-down, active link */
    const nav = $('#nav'), prog = $('#progress'), met = $('#met'), hero = $('#top');
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = clamp(y / max, 0, 1);
      prog.style.transform = `scaleX(${p})`;
      if (met) met.textContent = String(Math.round(p * 999)).padStart(3, '0');
      nav.classList.toggle('is-paper', y > hero.offsetHeight - 70);
      if (y > 600 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 600) nav.classList.remove('is-hidden');
      lastY = y;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    const links = $$('.nav__links a');
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      const a = map.get(e.target.id); if (a) a.classList.add('is-active');
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

    const cb = $('#copyBtn');
    if (cb) cb.addEventListener('click', async () => {
      const ok = await copyText($('#bib').textContent);
      cb.textContent = ok ? 'Copied ✓' : 'Copy failed'; if (ok) sfx.ok();
      setTimeout(() => { cb.textContent = 'Copy'; }, 1600);
    });
  }

  /* ------------------------------------------------------------------
     §1 · animated Fig. 1
     ------------------------------------------------------------------ */
  function overview() {
    const host = $('#overview-fig'); if (!host) return;
    const C = { amber: '#8A6896', lit: 'rgba(138, 104, 150, .72)', dim: 'rgba(138, 104, 150, .14)', phos: '#5E7D4A', red: '#BF4D43', rep: 'rgba(190, 161, 193, .55)', s: '#BEA1C1', c: '#788C5D', w: '#6A9BCC' };
    const W = 1200, H = 470, N = 24, X0 = 262, STEP = 20, CW = 16;
    const IDX = [6, 12, 18], ROWY = [182, 272, 362], CX0 = 902, CX1 = 1118;
    const BOX = { x: 762, y: 166, w: 70, h: 262 };
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Animated overview: source tasks, a successful reference trajectory, compaction at the 25, 50 and 75 percent boundaries, and post-compaction execution with success or failure.' }, host);
    const defs = svg('defs', {}, s);
    const mk = svg('marker', { id: 'ovah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
    svg('path', { d: 'M0 0L10 5L0 10z', fill: C.amber }, mk);
    const T = (x, y, txt, cls, attrs = {}) => { const e = svg('text', Object.assign({ x, y, class: cls }, attrs), s); e.textContent = txt; return e; };
    const TS = (x, y, main, sub, cls, attrs = {}) => {
      const e = T(x, y, main, cls, attrs);
      const sp = svg('tspan', { 'baseline-shift': 'sub', 'font-size': '.72em' }, e); sp.textContent = sub;
      return e;
    };
    T(30, 36, '1 · Source tasks', 'ov-hd');
    T(X0, 36, '2 · Successful trajectory τ, kept if pass³', 'ov-hd');
    T(860, 36, '4 · Post-compaction execution', 'ov-hd');
    const chips = KEYS.map((k, i) => {
      const y = 58 + i * 92;
      const r = svg('rect', { x: 30, y, width: 190, height: 72, rx: 12, fill: C[k], 'fill-opacity': .06, stroke: C[k], 'stroke-width': 1 }, s);
      const t1 = T(46, y + 30, DOM[k].name, 'ov-txt'); t1.style.fill = C[k];
      T(46, y + 52, `${DOM[k].tasks} tasks · ${DOM[k].bench}`, 'ov-small');
      const dot = svg('circle', { cx: 204, cy: y + 16, r: 4, fill: C[k], opacity: 0 }, s);
      return { r, dot, y };
    });
    const conn = svg('path', { d: '', fill: 'none', stroke: C.amber, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', 'marker-end': 'url(#ovah)' }, s);
    const cells = [];
    for (let i = 0; i < N; i++) {
      const a = i % 2 === 0;
      cells.push(svg('rect', { x: X0 + i * STEP, y: a ? 70 : 80, width: CW, height: a ? 44 : 24, fill: C.dim }, s));
    }
    TS(X0, 134, 'a', '1', 'ov-small'); TS(X0 + STEP, 134, 'o', '1', 'ov-small');
    T(X0 + 11 * STEP, 134, '· · ·', 'ov-small'); TS(X0 + 23 * STEP, 134, 'a', 'T', 'ov-small');
    const pass = T(X0 + N * STEP + 6, 98, '✓ pass³', 'ov-txt', { opacity: 0 }); pass.style.fill = C.phos;
    IDX.forEach((ix, k) => {
      const bx = X0 + ix * STEP - 2;
      svg('line', { x1: bx, x2: bx, y1: 58, y2: ROWY[k] + 38, stroke: C.red, 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }, s);
      const t = T(bx + 4, 64, 'b=' + BND[k], 'ov-small'); t.style.fill = C.red;
    });
    const box = svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: 14, fill: 'rgba(172, 134, 185, .08)', stroke: C.amber, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' }, s);
    TS(BOX.x + BOX.w / 2, BOX.y - 12, '3 · C', 'φ', 'ov-hd', { 'text-anchor': 'middle' });
    T(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2 + 4, 'LLM', 'ov-big', { 'text-anchor': 'middle' });
    T(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2 + 26, 'r = 10%', 'ov-small', { 'text-anchor': 'middle' });
    const rows = IDX.map((ix, k) => {
      const y = ROWY[k];
      const full = ix * STEP - 4;
      TS(X0, y - 9, 'H', 'b', 'ov-small').appendChild(document.createTextNode(` · b = ${BND[k]} · ${ix} of ${N} steps`));
      const hb = svg('rect', { x: X0, y, width: 0, height: 30, fill: C.amber, rx: 2 }, s);
      const hbT = TS(X0 + 8, y + 20, 'H', 'b', 'ov-small', { opacity: 0 }); hbT.style.fill = '#FAF9F5';
      const arr = svg('line', { x1: BOX.x + BOX.w + 4, x2: 855, y1: y + 15, y2: y + 15, stroke: C.amber, 'stroke-width': 1.2, 'marker-end': 'url(#ovah)', opacity: .25 }, s);
      const mb = svg('rect', { x: 860, y, width: 0, height: 30, fill: C.phos, rx: 2 }, s);
      const mbT = TS(866, y + 20, 'M', 'b', 'ov-small', { opacity: 0 }); mbT.style.fill = '#FAF9F5';
      const rem = N - ix, cw = (CX1 - CX0) / rem, cc = [];
      for (let i = 0; i < rem; i++) cc.push(svg('rect', { x: CX0 + i * cw, y: y + 4, width: Math.max(2, cw - 3), height: 22, fill: C.dim }, s));
      const lamp = svg('circle', { cx: 1152, cy: y + 15, r: 13, fill: 'none', stroke: C.dim, 'stroke-width': 2 }, s);
      const lampT = T(1152, y + 20, '', 'ov-txt', { 'text-anchor': 'middle' });
      const cap = T(1152, y + 46, '', 'ov-small', { 'text-anchor': 'middle' });
      return { ix, y, full, rem, hb, hbT, mb, mbT, cc, lamp, lampT, cap, arr };
    });
    T(30, 372, 'Running accuracy', 'ov-hd');
    const accT = T(30, 412, '--.-%', 'ov-big'); accT.style.fill = C.phos;
    const loopT = T(30, 434, 'Loop 0', 'ov-small');
    T(30, 456, 'Acc = successful continuations / all instances', 'ov-small');

    const LEN = 9.2;
    let loop = 0, dom = 's', plan = [], ok = 0, n = 0, counted = [];
    const newLoop = () => {
      dom = KEYS[loop % 3]; loop++;
      counted = [false, false, false];
      plan = IDX.map((ix, k) => {
        const rem = N - ix;
        if (Math.random() < avgOf(dom, k) / 100) return { ok: true, k: Math.max(1, Math.round(rem * rand(.35, .85))) };
        const early = Math.random() < .35;
        return { ok: false, early, k: early ? Math.max(1, Math.round(rem * rand(.2, .5))) : rem };
      });
      loopT.textContent = `Loop ${loop} · ${DOM[dom].bench}`;
      chips.forEach((c, i) => {
        const on = KEYS[i] === dom;
        c.r.setAttribute('fill-opacity', on ? .2 : .04);
        c.r.setAttribute('stroke-width', on ? 2.4 : 1);
        c.dot.setAttribute('opacity', on ? 1 : 0);
      });
      const cy = chips[KEYS.indexOf(dom)].y + 36;
      conn.setAttribute('d', `M222 ${cy} C 244 ${cy}, 232 92, ${X0 - 8} 92`);
    };
    const render = t => {
      const fade = 1 - seg(t, LEN - .5, LEN);
      cells.forEach((c, i) => { c.setAttribute('fill', t > .3 + i * (1.5 / N) ? C.lit : C.dim); c.setAttribute('opacity', fade); });
      pass.setAttribute('opacity', seg(t, 1.85, 2.1) * fade);
      let glow = false;
      rows.forEach((r, k) => {
        const base = 2.1 + k * .75, pl = plan[k];
        const grow = ease(seg(t, base, base + .4));
        const q = easeIO(seg(t, base + .6, base + 1.3));
        const w = r.full * grow;
        const wq = lerp(w, Math.max(14, r.full * .1), q);
        const x = lerp(X0, BOX.x + BOX.w / 2 - wq / 2, q);
        r.hb.setAttribute('x', x.toFixed(1));
        r.hb.setAttribute('width', Math.max(0, wq).toFixed(1));
        r.hb.setAttribute('opacity', ((1 - seg(q, .75, 1)) * fade).toFixed(3));
        r.hbT.setAttribute('opacity', (grow * (1 - seg(q, 0, .3)) * fade).toFixed(3));
        if (t > base + .9 && t < base + 1.5) glow = true;
        const mg = ease(seg(t, base + 1.3, base + 1.6));
        r.mb.setAttribute('width', (36 * mg).toFixed(1));
        r.mb.setAttribute('opacity', fade);
        r.mbT.setAttribute('opacity', seg(t, base + 1.5, base + 1.7) * fade);
        r.arr.setAttribute('opacity', ((.25 + .75 * seg(t, base + 1.2, base + 1.4)) * fade).toFixed(3));
        const cs = base + 1.7, ce = cs + 1.3;
        const filled = Math.round(seg(t, cs, ce) * pl.k);
        r.cc.forEach((c, i) => {
          let f = C.dim;
          if (i < filled) {
            if (pl.ok) f = C.phos;
            else if (i === pl.k - 1 && filled === pl.k) f = C.red;
            else f = (!pl.early && i % 3 === 2 && i > pl.k * .35) ? C.rep : C.amber;
          }
          c.setAttribute('fill', f); c.setAttribute('opacity', fade);
        });
        const done = t >= ce + .1;
        const col = pl.ok ? C.phos : C.red;
        r.lamp.setAttribute('stroke', done ? col : C.dim);
        r.lamp.setAttribute('fill', done ? (pl.ok ? 'rgba(94, 125, 74, .18)' : 'rgba(191, 77, 67, .18)') : 'none');
        r.lamp.setAttribute('opacity', fade);
        r.lampT.textContent = done ? (pl.ok ? '✓' : '✗') : '';
        r.lampT.style.fill = col;
        r.cap.textContent = done ? (pl.ok ? 'Complete' : pl.early ? 'Early stop' : 'Budget out') : '';
        r.cap.style.fill = col;
        r.cap.setAttribute('opacity', fade);
        if (done && !counted[k]) {
          counted[k] = true; n++; if (pl.ok) ok++;
          accT.textContent = (ok / n * 100).toFixed(1) + '%';
        }
      });
      box.setAttribute('fill', glow ? 'rgba(172, 134, 185, .22)' : 'rgba(172, 134, 185, .08)');
    };
    newLoop();
    if (REDUCED) { render(7.6); return; }
    let vis = false, t = 0, last = performance.now();
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: .1 }).observe(host);
    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (vis) { t += dt; if (t >= LEN) { t = 0; newLoop(); } render(t); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     §2 · cassettes, data card, IRC
     ------------------------------------------------------------------ */
  function carts() {
    const host = $('#carts'); if (!host) return;
    KEYS.forEach((k, i) => {
      const d = DOM[k];
      const el = h('div', 'cart reveal', null, host);
      el.dataset.d = String(i + 1);
      el.style.setProperty('--dc', d.color);
      el.innerHTML = `
        <div class="cart__shell">
          <div class="cart__label">
            <div class="cart__k"><span>${d.name}</span><span>Domain ${i + 1}</span></div>
            <div class="cart__n"><b>${d.tasks}</b><span>tasks</span></div>
            <div class="cart__name">${d.bench}</div>
            <div class="cart__win"><i></i><i></i></div>
            <div class="cart__stripe"></div>
          </div>
          <div class="cart__foot"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="cart__meta"><span>avg <b>${d.avg}K</b> tokens</span><span><b>${d.rounds}</b> rounds</span><span>${d.state}</span></div>`;
    });
  }

  function dataTable() {
    const t = $('#dataTable'); if (!t) return;
    let html = '<thead><tr><th>Domain</th><th>Boundary</th><th class="num"># Tasks</th><th class="num">Avg. rounds</th><th class="num">Avg. full tok</th><th class="num">Avg. H<sub>b</sub> tok</th><th>H<sub>b</sub> / full</th></tr></thead><tbody>';
    KEYS.forEach(k => {
      const d = DOM[k];
      html += `<tr class="grp"><td><i class="dk dk--${k}"></i><b>${d.name}</b> · ${d.bench}</td><td>All</td><td class="num"><b>${d.tasks}</b></td><td class="num"><b>${d.rounds}</b></td><td class="num"><b>${d.avg}K</b></td><td class="num">median ${d.med}K</td><td></td></tr>`;
      [0, 1, 2].forEach(b => {
        const r = d.tok[b] / d.full[b];
        html += `<tr><td></td><td>b = ${BND[b]}</td><td class="num">${d.nb[b]}</td><td class="num">${d.rb[b]}</td><td class="num">${d.full[b]}K</td><td class="num">${d.tok[b]}K</td><td><span class="spark" style="width:${(r * 120).toFixed(0)}px;--bc:${d.color}"></span>${(r * 100).toFixed(0)}%</td></tr>`;
      });
    });
    t.innerHTML = html + '</tbody>';
  }

  function irc() {
    const host = $('#irc'); if (!host) return;
    const lo = .0960, hi = .1050;
    const px = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
    h('div', 'irc__hd', 'Compactor', host); h('div', 'irc__hd', 'Median · IQR of r<sub>actual</sub>', host); h('div', 'irc__hd', 'In tol.', host);
    MODELS.forEach(m => {
      const [med, q1, q3, tol] = m.irc;
      h('div', 'irc__nm', `${m.n} <small class="mono" style="color:var(--muted)">${m.cfg}</small>`, host);
      const tr = h('div', 'irc__tr', null, host);
      const band = h('i', 'irc__band', null, tr); band.style.left = px(.097); band.style.width = `calc(${px(.103)} - ${px(.097)})`;
      h('i', 'irc__tgt', null, tr).style.left = px(.1);
      const iqr = h('i', 'irc__iqr', null, tr); iqr.style.left = px(q1); iqr.style.width = `calc(${px(q3)} - ${px(q1)})`;
      const md = h('i', 'irc__med', null, tr); md.style.left = px(med); md.title = `median ${med}`;
      h('div', 'irc__tol' + (tol < 70 ? ' lo' : ''), tol.toFixed(1) + '%', host);
    });
    h('div', null, '', host);
    const ax = h('div', 'irc__ax', null, host);
    [.097, .1, .103].forEach(v => { const s = h('span', null, v.toFixed(3), ax); s.style.left = px(v); });
    onceVisible(host, () => host.classList.add('in'), { threshold: .2 });
  }

  /* ------------------------------------------------------------------
     §3 · leaderboard
     ------------------------------------------------------------------ */
  function leaderboard() {
    const host = $('#lbTable'), panel = $('.lb'), status = $('#lbStatus');
    if (!host) return;
    const COLS = [['s', 'Search', 'var(--d-s)'], ['c', 'Coding', 'var(--d-c)'], ['w', 'Workspace', 'var(--d-w)'], ['o', 'Overall', 'var(--ink)']];
    const st = { b: 3, key: 'o', open: -1 };
    const RH = 46, DH = 158;
    const head = h('div', 'lb__head', '<span>#</span><span>Compactor</span>', host);
    const sortBtns = COLS.map(([k, n]) => {
      const b = h('button', k === 'o' ? 'is-on' : '', n, h('span', null, null, head));
      b.addEventListener('click', () => { st.key = k; sfx.click(); render(); });
      return b;
    });
    const body = h('div', 'lb__body', null, host);
    const val = (m, k, b) => k === 'o' ? overallAt(m, b) : m[k][b];
    const rows = MODELS.map((m, i) => {
      const r = h('div', 'lb__row', `<span class="lb__rk">00</span><span class="lb__nm">${m.n}<small>${m.cfg}</small></span>` +
        COLS.map(([k, , col]) => `<span class="lb__c" data-k="${k}"><span class="lb__v">0.0</span><span class="lb__bar" style="--bc:${col}"><i></i><s></s></span><span class="lb__ci-t"></span></span>`).join(''), body);
      r.setAttribute('role', 'row');
      r.addEventListener('mouseenter', () => hl(i));
      r.addEventListener('mouseleave', () => hl(-1));
      r.addEventListener('click', () => { st.open = st.open === i ? -1 : i; sfx.click(); render(); });
      return r;
    });
    const detail = h('div', 'lb__detail', null, body);
    onHL(i => rows.forEach((r, j) => r.classList.toggle('is-hl', j === i)));

    const fillDetail = i => {
      const m = MODELS[i];
      const grp = (k, name, col) => `<div><h5>${name} · by boundary</h5><div class="lb__dbars">${[0, 1, 2].map(b => `<div><b>${m[k][b].toFixed(1)}</b><i style="height:${(m[k][b] * .5).toFixed(1)}px;--bc:${col};background:${col}"></i><span>${BND[b]}</span></div>`).join('')}</div></div>`;
      detail.innerHTML = `<div class="lb__dgrid">${grp('s', 'Search', 'var(--d-s)')}${grp('c', 'Coding', 'var(--d-c)')}${grp('w', 'Workspace', 'var(--d-w)')}</div>
        <div class="panel__cap" style="margin-top:8px">IRC · median r<sub>actual</sub> = ${m.irc[0].toFixed(4)} · IQR [${m.irc[1].toFixed(4)}, ${m.irc[2].toFixed(4)}] · ${m.irc[3]}% within tolerance · ${m.irc[4]} calls / instance</div>`;
    };

    const render = () => {
      const b = st.b;
      sortBtns.forEach((btn, i) => btn.classList.toggle('is-on', COLS[i][0] === st.key));
      const order = MODELS.map((m, i) => [val(m, st.key, b), i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
      let y = 0;
      order.forEach(([, i], rank) => {
        const r = rows[i], m = MODELS[i];
        r.style.transform = `translateY(${y}px)`;
        y += RH;
        if (st.open === i) { detail.style.transform = `translateY(${y}px)`; y += DH; }
        r.classList.toggle('is-top', rank === 0);
        $('.lb__rk', r).textContent = String(rank + 1).padStart(2, '0');
        $$('.lb__c', r).forEach(c => {
          const k = c.dataset.k, v = val(m, k, b);
          c.classList.toggle('sorted', k === st.key);
          const ve = $('.lb__v', c);
          animateNum(ve, parseFloat(ve.textContent) || 0, v, 700, x => x.toFixed(1));
          $('.lb__bar i', c).style.width = v + '%';
          const s = $('.lb__bar s', c), ct = $('.lb__ci-t', c);
          const ci = b === 3 ? m.ci[k] : null;
          s.classList.toggle('has', !!ci); ct.classList.toggle('has', !!ci);
          if (ci) { s.style.left = ci[0] + '%'; s.style.width = (ci[1] - ci[0]) + '%'; ct.textContent = `[${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]`; }
        });
      });
      detail.classList.toggle('on', st.open >= 0);
      if (st.open >= 0) fillDetail(st.open);
      body.style.height = y + 'px';
      const keyName = COLS.find(c => c[0] === st.key)[1];
      status.textContent = (b === 3 ? 'All boundaries' : `b = ${BND[b]} · overall is micro-avg`) + ` · sorted by ${keyName.toLowerCase()}`;
    };
    $$('#lbBoundary button').forEach(btn => btn.addEventListener('click', () => {
      st.b = +btn.dataset.b;
      $$('#lbBoundary button').forEach(x => x.classList.toggle('is-on', x === btn));
      sfx.click(); render();
    }));
    const ci = $('#lbCI');
    const setCI = () => panel.classList.toggle('ci-on', ci.checked);
    ci.addEventListener('change', setCI); setCI();
    body.style.height = MODELS.length * RH + 'px';
    rows.forEach((r, i) => { r.style.transform = `translateY(${i * RH}px)`; });
    onceVisible(host, render, { threshold: .15 });
  }

  function multiples() {
    const grid = $('#bndCharts'), leg = $('#bndLegend'), read = $('#bndRead'), wrap = $('.multi');
    if (!grid) return;
    const W = 300, H = 232, X = [56, 152, 248];
    const y = v => 200 - v / 100 * 172;
    const q = (arr, p) => {
      const a = [...arr].sort((m, n) => m - n);
      const pos = (a.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
      return a[lo] + (a[hi] - a[lo]) * (pos - lo);
    };
    const lines = [];
    KEYS.forEach((k, di) => {
      const d = DOM[k];
      const card = h('div', 'mcard', null, grid);
      h('div', 'mcard__t', `<span>${d.name} · ${d.bench}</span><b style="color:${d.color}">${avgOf(k, 0).toFixed(1)} → ${avgOf(k, 2).toFixed(1)}</b>`, card);
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}` }, card);
      [0, 25, 50, 75, 100].forEach(v => {
        svg('line', { x1: 32, x2: W - 14, y1: y(v), y2: y(v), class: 'mgrid' }, s);
        const t = svg('text', { x: 26, y: y(v) + 3, 'text-anchor': 'end', class: 'maxis' }, s); t.textContent = v;
      });
      X.forEach((x, bi) => { const t = svg('text', { x, y: 222, 'text-anchor': 'middle', class: 'maxis' }, s); t.textContent = 'b=' + BND[bi]; });
      const lo = [0, 1, 2].map(b => q(MODELS.map(m => m[k][b]), .25));
      const hi = [0, 1, 2].map(b => q(MODELS.map(m => m[k][b]), .75));
      const pts = X.map((x, b) => `${x},${y(hi[b])}`).concat([2, 1, 0].map(b => `${X[b]},${y(lo[b])}`)).join(' ');
      svg('polygon', { points: pts, class: 'mband' }, s).style.fill = d.color;
      lines[di] = MODELS.map(m => svg('polyline', { points: X.map((x, b) => `${x},${y(m[k][b])}`).join(' '), class: 'mline' }, s));
      const av = svg('polyline', { points: X.map((x, b) => `${x},${y(avgOf(k, b))}`).join(' '), class: 'mavg' }, s);
      av.style.stroke = d.color;
      const marks = [];
      X.forEach((x, b) => {
        const v = avgOf(k, b);
        const c = svg('circle', { cx: x, cy: y(v), r: 5, class: 'mdot' }, s); c.style.fill = d.color;
        const t = svg('text', { x, y: y(v) - 11, 'text-anchor': 'middle', class: 'mval' }, s); t.style.fill = d.color; t.textContent = v.toFixed(1);
        marks.push(c, t);
      });
      const all = [...lines[di], av];
      if (!REDUCED) {
        all.forEach(pl => { const L = pl.getTotalLength(); pl.style.strokeDasharray = L; pl.style.strokeDashoffset = L; });
        marks.forEach(e => { e.style.opacity = 0; e.style.transition = 'opacity .5s 1.2s'; });
        onceVisible(card, () => {
          all.forEach((pl, i) => {
            pl.style.transition = `stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1) ${i * 45}ms, stroke .25s, stroke-width .25s, opacity .25s`;
            requestAnimationFrame(() => { pl.style.strokeDashoffset = '0'; });
          });
          marks.forEach(e => { e.style.opacity = 1; });
          setTimeout(() => all.forEach(pl => { pl.style.strokeDasharray = 'none'; }), 2200);
        }, { threshold: .3 });
      }
    });
    let pinned = -1;
    const chips = MODELS.map((m, mi) => {
      const c = h('button', 'chip', m.n, leg);
      c.addEventListener('mouseenter', () => hl(mi));
      c.addEventListener('mouseleave', () => hl(pinned));
      c.addEventListener('click', () => { pinned = pinned === mi ? -1 : mi; hl(pinned); });
      return c;
    });
    const fmt = a => a.slice(0, 3).map(v => v.toFixed(1)).join(' → ');
    const idle = 'Thick line = mean over 12 compactors · band = middle 50% of models · hover or click a model';
    read.innerHTML = idle;
    onHL(i => {
      wrap.classList.toggle('has-hl', i >= 0);
      lines.forEach(arr => arr.forEach((pl, mi) => pl.classList.toggle('is-hl', mi === i)));
      chips.forEach((c, mi) => c.classList.toggle('is-on', mi === i));
      if (i >= 0) {
        const m = MODELS[i];
        read.innerHTML = `<b>${m.n} (${m.cfg})</b> · Search ${fmt(m.s)} · Coding ${fmt(m.c)} · Workspace ${fmt(m.w)} · Overall <b>${m.o.toFixed(1)}%</b>`;
      } else read.innerHTML = idle;
    });
  }

  /* ------------------------------------------------------------------
     §4 · token circles, persistence, failure analysis
     ------------------------------------------------------------------ */
  function reels() {
    const g = $('#reels'); if (!g) return;
    h('div', 'reels__hd', '', g);
    KEYS.forEach(k => { h('div', 'reels__hd', DOM[k].name, g).style.color = DOM[k].scolor; });
    const packs = [];
    [0, 1, 2].forEach(b => {
      h('div', 'reels__rw', BND[b], g);
      KEYS.forEach(k => {
        const tok = DOM[k].tok[b];
        const R = 14 + 42 * Math.sqrt(tok / 90);
        const cell = h('div', 'reel-c', null, g);
        const s = svg('svg', { viewBox: '-60 -60 120 120', role: 'img', 'aria-label': `${DOM[k].name} at ${BND[b]}: ${tok}K tokens` }, cell);
        svg('circle', { r: 57, fill: 'none', stroke: 'rgba(20, 20, 19, .1)', 'stroke-dasharray': '2 4' }, s);
        const pack = svg('circle', { r: 14, class: 'pack', 'stroke-width': 1.2 }, s);
        pack.style.fill = `color-mix(in srgb, ${DOM[k].color} 22%, transparent)`;
        pack.style.stroke = DOM[k].color;
        svg('circle', { r: 3.5 }, s).style.fill = DOM[k].color;
        h('b', null, tok.toFixed(1) + 'K', cell).style.color = DOM[k].scolor;
        packs.push([pack, R]);
      });
    });
    onceVisible(g, () => packs.forEach(([p, R], i) => setTimeout(() => { p.style.r = R.toFixed(1) + 'px'; p.setAttribute('r', R.toFixed(1)); }, REDUCED ? 0 : i * 90)), { threshold: .3 });
  }

  function persist() {
    const mk = (host, series, gains) => {
      if (!host) return;
      [0, 1, 2].forEach(gi => {
        const col = h('div', 'gb', null, host);
        h('div', 'gb__x', BND[gi], col);
        let max = 0;
        series.forEach(sr => {
          const v = sr.v[gi]; max = Math.max(max, v);
          const b = h('div', 'gb__b', `<span>${v.toFixed(1)}</span>`, col);
          b.style.setProperty('--bc', sr.c); b.dataset.h = v;
        });
        const gn = gains[gi];
        const chip = h('div', 'gb__gain' + (gn < 0 ? ' neg' : ''), (gn > 0 ? '+' : '') + gn.toFixed(1), col);
        chip.style.top = `calc(${(100 - max).toFixed(1)}% - 46px)`;
      });
      host.after(h('div', 'gkey', series.map(s => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join('') + '<span><i style="background:var(--red)"></i>gain from M<sub>b</sub></span>'));
      onceVisible(host, () => $$('.gb', host).forEach((col, i) => setTimeout(() => {
        col.classList.add('in');
        $$('.gb__b', col).forEach(b => { b.style.height = b.dataset.h + '%'; });
      }, REDUCED ? 0 : i * 160)), { threshold: .35 });
    };
    mk($('#persistCoding'), [
      { n: 'w/o H<sub>b</sub> · initial state', c: 'var(--line-2)', v: [48.5, 35.5, 15.6] },
      { n: 'w/o H<sub>b</sub> · boundary state', c: 'color-mix(in srgb, var(--d-c) 40%, var(--card))', v: [66.7, 58.1, 71.9] },
      { n: 'with M<sub>b</sub>', c: 'var(--d-c)', v: [64.0, 72.7, 86.1] }
    ], [-2.7, 14.6, 14.2]);
    mk($('#persistSearch'), [
      { n: 'w/o H<sub>b</sub>', c: 'var(--line-2)', v: [26.9, 15.4, 7.4] },
      { n: 'with M<sub>b</sub>', c: 'var(--d-s)', v: [52.9, 42.6, 34.6] }
    ], [26.0, 27.2, 27.2]);
  }

  function failures() {
    const bar = $('#audit'), key = $('#auditKey');
    if (bar) {
      const S = [['Preserved', 69.1, 'var(--d-c)'], ['Omitted', 25.3, 'var(--orange)'], ['Distorted', 5.6, 'var(--bad)'], ['Uncertain', 0.1, 'var(--muted)']];
      const segs = S.map(([n, v, c]) => {
        const d = h('div', null, v > 20 ? `${v}% ${n.toLowerCase()}` : v >= 5 ? `${v}` : '', bar);
        d.style.background = c; d.title = `${n} ${v}%`;
        return [d, v];
      });
      key.innerHTML = S.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n} ${v}%</span>`).join('');
      onceVisible(bar, () => segs.forEach(([d, v]) => { d.style.width = v + '%'; }), { threshold: .4 });
    }
    const fly = $('#butterfly');
    if (fly) {
      h('div', 'fly__hd', '<span>Early failure</span><span></span><span>Budget exhaustion</span>', fly);
      const sc = 1.25, bars = [];
      ERR.forEach(([k, n, e, b]) => {
        const row = h('div', 'fly__row' + (e - b > 5 ? ' hot' : ''), `<div class="fly__l"><i></i><em></em></div><div class="fly__lab">${k}<small>${n}</small></div><div class="fly__r"><i></i><em></em></div>`, fly);
        const [li, ri] = $$('i', row), [le, re] = $$('em', row);
        le.textContent = e.toFixed(1); re.textContent = b.toFixed(1);
        le.style.right = `calc(${(e * sc).toFixed(1)}% + 6px)`;
        re.style.left = `calc(${(b * sc).toFixed(1)}% + 6px)`;
        bars.push([li, e * sc], [ri, b * sc]);
      });
      h('div', 'fly__any', 'Any of the six errors: <b>92.5%</b> of early failures · <b>85.8%</b> of budget-exhausted cases', fly);
      onceVisible(fly, () => bars.forEach(([el, w], i) => setTimeout(() => { el.style.width = w.toFixed(1) + '%'; }, REDUCED ? 0 : i * 60)), { threshold: .3 });
    }
    const heat = $('#heat'), read = $('#heatRead');
    if (heat) {
      h('div', 'heat__h', '', heat);
      BEH.forEach(b => h('div', 'heat__h', b, heat));
      const cells = [];
      const idle = 'Strongest signals: <b>CO → repeated work +18.2</b> · <b>PSL → repeated work +13.8</b> · <b>CGD → unverified commit +10.5</b>';
      ERR.forEach(([k, n], ri) => {
        h('div', 'heat__r', k, heat);
        HEAT[k].forEach((v, ci) => {
          const a = Math.min(1, Math.abs(v) / 18);
          const c = h('div', 'heat__c', (v > 0 ? '+' : '') + v.toFixed(1), heat);
          c.style.background = `rgba(${v >= 0 ? '138,104,150' : '120,140,93'},${(.08 + a * .85).toFixed(3)})`;
          c.style.color = a > .45 ? '#fff' : 'var(--ink)';
          c.style.transitionDelay = `${(ri * 7 + ci) * 18}ms`;
          c.addEventListener('mouseenter', () => {
            cells.forEach(x => x.el.classList.toggle('dim', x.r !== ri && x.c !== ci));
            read.innerHTML = `<b>${k}</b> ${n} → <b>${BEH[ci]}</b>: ${(v > 0 ? '+' : '') + v.toFixed(1)} pts when present · overall rate ${BEH_RATE[ci]}%`;
          });
          cells.push({ el: c, r: ri, c: ci });
        });
      });
      heat.addEventListener('mouseleave', () => { cells.forEach(x => x.el.classList.remove('dim')); read.innerHTML = idle; });
      read.innerHTML = idle;
      onceVisible(heat, () => {
        heat.classList.add('in');
        setTimeout(() => cells.forEach(x => { x.el.style.transitionDelay = '0ms'; }), 1600);
      }, { threshold: .3 });
    }
  }

  /* ------------------------------------------------------------------
     reveal / counters / math
     ------------------------------------------------------------------ */
  function reveal() {
    $$('.reveal').forEach(el => onceVisible(el, () => el.classList.add('in'), { threshold: .08, rootMargin: '0px 0px -6% 0px' }));
    $$('[data-count]').forEach(el => onceVisible(el, () => {
      const raw = el.dataset.count, target = parseFloat(raw);
      const dec = (raw.split('.')[1] || '').length;
      const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      animateNum(el, 0, target, 1500, v => pre + v.toFixed(dec) + suf);
    }, { threshold: .5 }));
  }
  function math() {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }], throwOnError: false });
  }

  chrome();
  math();
  overview();
  carts();
  dataTable();
  irc();
  leaderboard();
  multiples();
  reels();
  persist();
  failures();
  reveal();
})();
