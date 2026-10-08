(() => {
  'use strict';

  /* ------------------------------------------------------------
     utils
     ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     data · from the paper (Tables 1, 2, 13, 14, 16, 17; Fig. 3)
     ------------------------------------------------------------ */
  const MODELS = [
    ['Claude Opus 5', 'Max', [73.1, 57.7, 55.6, 62.0], [72.7, 80.6, 90.6, 81.2], [37.5, 55.6, 25.0, 40.0], 68.5],
    ['Gemini 3.8 Flash', 'High', [61.5, 57.7, 51.9, 57.0], [69.7, 67.7, 87.5, 75.0], [50.0, 77.8, 37.5, 56.0], 65.5],
    ['Kimi K3', 'Max', [65.4, 50.0, 37.0, 50.6], [75.8, 74.2, 87.5, 79.2], [25.0, 55.6, 12.5, 32.0], 62.0],
    ['GPT-5.6-Sol', 'Max', [61.5, 50.0, 44.4, 51.9], [63.6, 74.2, 90.6, 76.0], [12.5, 33.3, 12.5, 20.0], 59.5],
    ['DeepSeek V4 Pro', 'Max', [53.8, 46.2, 33.3, 44.3], [62.1, 72.6, 82.8, 72.4], [37.5, 55.6, 37.5, 44.0], 57.8],
    ['HY3', 'High', [50.0, 42.3, 40.7, 44.3], [60.6, 74.2, 84.4, 72.9], [37.5, 33.3, 50.0, 40.0], 57.5],
    ['GLM 5.3 Flash', 'Max', [57.7, 30.8, 29.6, 39.2], [69.7, 71.0, 87.5, 76.0], [25.0, 55.6, 37.5, 40.0], 57.0],
    ['Qwen 3.8 Flash', 'Max', [42.3, 26.9, 33.3, 34.2], [63.6, 80.6, 87.5, 77.1], [50.0, 22.2, 25.0, 32.0], 54.5],
    ['GLM 5.2', 'Max', [50.0, 42.3, 7.4, 32.9], [63.6, 74.2, 87.5, 75.0], [12.5, 44.4, 12.5, 24.0], 52.0],
    ['Gemini 3.1 Pro Preview', 'High', [38.5, 38.5, 40.7, 39.2], [60.6, 67.7, 84.4, 70.8], [12.5, 22.2, 12.5, 16.0], 51.5],
    ['Qwen 3.7 Plus', '64K', [34.6, 38.5, 22.2, 31.6], [51.5, 67.7, 81.2, 66.7], [12.5, 44.4, 37.5, 32.0], 48.5],
    ['Doubao Seed 2.1 Pro', 'High', [46.2, 30.8, 18.5, 31.6], [54.5, 67.7, 81.2, 67.7], [12.5, 0.0, 12.5, 8.0], 46.0]
  ].map(([n, cfg, s, c, w, o]) => ({ n, cfg, s, c, w, o }));

  const DOM = {
    s: { name: 'Search', bench: 'BrowseComp', tasks: 79, rounds: 30.4, avg: 35.3, med: 23.0, T: 30, tok: [8.2, 15.8, 29.3], exec: 'Claude Opus 4.8', color: 'var(--d-s)', scolor: 'var(--ds-s)', state: 'Context-resident evidence. What was found lives only in the conversation.' },
    c: { name: 'Coding', bench: 'SWE-bench', tasks: 96, rounds: 19.4, avg: 8.8, med: 7.7, T: 19, tok: [2.3, 4.6, 5.5], exec: 'Claude Opus 4.8', color: 'var(--d-c)', scolor: 'var(--ds-c)', state: 'Repository-backed progress. Edits persist on disk across the boundary.' },
    w: { name: 'Workspace', bench: 'CompanyBench', tasks: 25, rounds: 58.5, avg: 122.8, med: 115.0, T: 58, tok: [41.2, 64.8, 90.0], exec: 'GPT-5.5 Codex', color: 'var(--d-w)', scolor: 'var(--ds-w)', state: 'Persistent workspace state across files and heterogeneous tools.' }
  };
  const KEYS = ['s', 'c', 'w'];
  const BND = ['25%', '50%', '75%'];
  const avgOf = (d, b) => MODELS.reduce((a, m) => a + m[d][b], 0) / MODELS.length;

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

  const CASES = [
    {
      tab: '01 · Distortion → early stop', ok: false, stamp: 'FAIL',
      meta: [['DOMAIN', 'Search · BrowseComp'], ['BOUNDARY', '50%'], ['OUTCOME', 'Early failure'], ['ERROR', 'Premature commitment']],
      task: '“… second person mentioned exactly as stated in the acknowledgments …”',
      hb: '&lt;Assistant&gt; “… but the requested format … doesn\'t match. <mark class="g">This may be a different review.</mark> … search for other Hall reviews ….”',
      mb: 'Key tool calls &amp; results:\n… the Introduction section body … could not be retrieved …\n<mark>This confirmed the correct target review is the separate Evolutionary Biology article.</mark> …\n\nContinuation needs: Verify … full acknowledgments text; confirm second person\'s exact name format. …',
      cont: '&lt;System&gt; “… When facing uncertain information, use search tools to confirm …”\n\n&lt;Assistant&gt; <mark>“D. Meulemans Medeiros”</mark>',
      verdict: 'Unverified clues were compressed into a settled conclusion, causing confirmation of the wrong hypothesis. The history said <b>“may be a different review”</b>; the compacted context said <b>“confirmed”</b>. The executor trusted it and answered. (Paper Fig. 1)'
    },
    {
      tab: 'A · Small state → harmless', ok: true, stamp: 'PASS',
      meta: [['INSTANCE', 'BrowseComp search_00228'], ['T', '14'], ['BOUNDARY', 'after action 3 · budget 11'], ['M_b', '1.25k–1.32k chars']],
      task: 'Find Person A: an AMS Fellow (elected 2005–2020) with a 1983 Ph.D., co-author of a 1990–2005 paper with a Rollo Davidson Prize winner and with someone whose 1990s paper title ends in “Line”. (abridged)',
      hb: 'Round 1 · search\nRollo Davidson Prize winners list; research paper title ending with word “Line” 1990s probability\n\nRound 2 · visit Wikipedia\n→ 1991 Sznitman; 1992 Burdzy; 1993 Ben Arous &amp; Pemantle; … 1995 Biane &amp; Peres; … 2004 Holroyd, Benjamini.\n\nRound 3 · search\n“Line” paper, AMS fellow PhD 1983 → <mark>nothing relevant</mark>',
      mb: '[DeepSeek V4 Pro · 1,315 chars]\nVisiting the Wikipedia page then yielded the full prize list 1991–2004 …\n\n<mark class="g">Goal: identify a Rollo Davidson Prize winner between 1995–2004 and a research paper title ending with the word “Line”. Prize winner list obtained, but paper title still not found.</mark>',
      cont: 'Round 1\n“The three-author paper is likely … by Russell Lyons, Robin Pemantle, and Yuval Peres (Annals of Probability, 1995).”\n\nRound 2\n“All criteria are confirmed.”\n→ <mark class="g">Russell David Lyons</mark>',
      verdict: 'All twelve compactors reach <b>100%</b> strict Avg@3. Continuations finish in <b>2–5 actions</b> where the source needed 11. A compact statement of what is still open is enough: small state, nothing unresolved to misdescribe.'
    },
    {
      tab: 'B · Long history → recovery', ok: true, stamp: '91.7%',
      meta: [['INSTANCE', 'BrowseComp search_00166'], ['T', '194'], ['BOUNDARY', '75% · budget 49'], ['PREFIX', '≈703k chars · 290 tool calls']],
      task: 'An academic once described a critic as a gift to the world. … A sixteen-page article about the critic\'s impact was published in a journal. … What is the name of the article\'s publisher? (abridged)',
      hb: 'Round 3 · search hit (cnn.com, 2013)\n<mark class="g">Chinua Achebe</mark> … “He was a gift to the world,” he said.\n— no follow-up on Achebe.\n\nRounds 4–21 · 36 queries\nBloom, de Man, Trilling, Said, Frye, Leavis, Kael, Sontag …\n\nRound 22 · search hit\n“Changing the Canon: Chinua Achebe\'s Women …” (vc.bridgew.edu)\n— <mark>never opened</mark>.\n\nRounds 23–145 · about 140 more queries. No candidate.',
      mb: '[GPT-5.6-Sol]\nPromotes both unopened hits, the obituary quotation and the target article, and <mark class="g">labels the chain unconfirmed</mark>.\n\n[the other eleven compactors]\nRestate the search and the open clues without naming the article.',
      cont: 'GPT-5.6-Sol context\n→ verified in 3 actions.\n\nTen of the other eleven\n→ still succeed in 9–30 actions.\n\nGLM 5.2\n→ <mark>exhausts the 49-action budget</mark>.\n\nAnswer: <mark class="g">Virtual Commons – Bridgewater State University</mark>',
      verdict: 'Strict Avg@3 ≈ <b>91.7%</b>, median <b>14 actions</b> vs. 49 for the source. 145 rounds of history had collapsed into a low-dimensional task state: good compaction consolidates and reviews; it does not need to invent evidence.'
    }
  ];

  /* ------------------------------------------------------------
     sound · tiny WebAudio blips, off by default
     ------------------------------------------------------------ */
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
      whir: () => tone(300, .35, 'sawtooth', .014, 900)
    };
  })();

  /* highlight bus · board, legend and charts share one selected model */
  const hlFns = [];
  const onHL = f => hlFns.push(f);
  const hl = i => hlFns.forEach(f => f(i));

  /* ------------------------------------------------------------
     boot · CRT power-on
     ------------------------------------------------------------ */
  function boot() {
    const el = $('#boot');
    const ready = () => document.body.classList.add('is-ready');
    let seen = false;
    try { seen = sessionStorage.getItem('cb-boot') === '1'; } catch (e) { /* ignore */ }
    if (!el) { ready(); return; }
    if (seen || REDUCED || /[?&]noboot\b/.test(location.search)) { el.remove(); ready(); return; }
    try { sessionStorage.setItem('cb-boot', '1'); } catch (e) { /* ignore */ }
    document.body.classList.add('booting');

    const log = $('#bootLog'), bar = $('#bootBar');
    const lines = [
      'CB-200 TAPE OPERATING SYSTEM   v2026.10',
      'FUDAN NLP  ·  TENCENT HUNYUAN  ·  TSINGHUA SIGS',
      '',
      '> MOUNT TAPE  COMPACT-BENCH ......... [OK]',
      '> SEARCH 079  CODING 096  WORKSP 025  [OK]',
      '> LOAD 12 COMPACTORS ................ [OK]',
      '> RETENTION TARGET  r = 10% ......... [OK]',
      '> REWIND ◀◀◀◀◀◀◀◀◀◀◀◀   PLAY ▶'
    ];
    const total = lines.reduce((a, l) => a + Math.max(1, l.length), 0);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const fmtLine = s => esc(s).replace('[OK]', '<span class="ok">[OK]</span>');
    let li = 0, ci = 0, typed = 0, finished = false, html = '';
    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add('off');
      document.body.classList.remove('booting');
      setTimeout(ready, 380);
      setTimeout(() => el.remove(), 1300);
    };
    const step = () => {
      if (finished) return;
      for (let k = 0; k < 3 && li < lines.length; k++) {
        ci++; typed++;
        if (ci >= lines[li].length) { html += fmtLine(lines[li]) + '\n'; li++; ci = 0; }
      }
      const cur = li < lines.length ? esc(lines[li].slice(0, ci)) : '';
      log.innerHTML = html + cur + '█';
      bar.style.width = Math.min(100, typed / total * 100) + '%';
      if (li < lines.length) requestAnimationFrame(step);
      else setTimeout(finish, 420);
    };
    requestAnimationFrame(step);
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
  }

  /* ------------------------------------------------------------
     chrome · theme, sound, title split, kimi, ticker, nav, cursor
     ------------------------------------------------------------ */
  function chrome() {
    const root = document.documentElement;
    const meta = $('meta[name="theme-color"]');
    const applyTheme = t => { root.dataset.theme = t; if (meta) meta.setAttribute('content', t === 'dark' ? '#11100e' : '#ece6d9'); };
    const saved = store.get('cb-theme');
    if (saved) applyTheme(saved);
    $('#themeBtn').addEventListener('click', () => {
      const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(t); store.set('cb-theme', t); sfx.click();
    });
    const sb = $('#soundBtn');
    sb.addEventListener('click', () => sb.setAttribute('aria-pressed', String(sfx.toggle())));

    const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

    const mark = $('.t-mark');
    if (mark) {
      const txt = mark.textContent.trim();
      mark.textContent = '';
      mark.setAttribute('aria-label', txt);
      [...txt].forEach((ch, i) => {
        const s = h('span', 'ch', ch, mark);
        s.style.setProperty('--i', i);
        s.setAttribute('aria-hidden', 'true');
      });
    }

    const kimi = $('#kimiBtn');
    if (kimi) {
      const pdf = 'https://compaction-eval.github.io/CompAct-Bench/assets/compact-bench-paper.pdf';
      const prompt = `The paper we will discuss is "CompAct-Bench: A Benchmark for Working-Context Compaction in Long-Horizon Agent Tasks". The PDF link is ${pdf}. Please answer my questions about this paper.`;
      const sys = 'You are an academic assistant. The conversation will focus on the paper provided. Answer professionally in English, use markdown format for structured responses, and avoid first person.';
      kimi.href = `https://kimi.com/_prefill_chat?prefill_prompt=${encodeURIComponent(prompt)}&system_prompt=${encodeURIComponent(sys)}&send_immediately=true`;
    }

    const tk = $('#ticker'); if (tk) tk.innerHTML += tk.innerHTML;

    /* nav: progress, tape counter, hide on scroll-down, active link */
    const nav = $('#nav'), prog = $('#progress'), counter = $('#tapeCounter'), bgType = $('.hero__bgtype');
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = clamp(y / max, 0, 1);
      prog.style.transform = `scaleX(${p})`;
      counter.textContent = String(Math.round(p * 999)).padStart(3, '0');
      if (y > 520 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 520) nav.classList.remove('is-hidden');
      if (bgType && y < window.innerHeight * 1.2) bgType.style.transform = `translate3d(0, ${y * .28}px, 0)`;
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

    /* crosshair cursor */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !REDUCED) {
      const c = $('#cursor');
      let x = -100, y = -100, cx = -100, cy = -100;
      window.addEventListener('mousemove', e => {
        x = e.clientX; y = e.clientY;
        c.classList.toggle('is-hover', !!e.target.closest('a, button, .chip, .heat__c, .brow, .tab, .key'));
      });
      const loop = () => {
        cx += (x - cx) * .28; cy += (y - cy) * .28;
        c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        requestAnimationFrame(loop);
      };
      loop();
    }

    /* magnetic buttons */
    if (!REDUCED) {
      $$('.btn').forEach(b => {
        b.addEventListener('mousemove', e => {
          const r = b.getBoundingClientRect();
          b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + 'px');
          b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px');
        });
        b.addEventListener('mouseleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
      });
    }

    /* copy bibtex */
    const cb = $('#copyBtn');
    if (cb) cb.addEventListener('click', async () => {
      const pre = $('#bib');
      try { await navigator.clipboard.writeText(pre.textContent); }
      catch (e) {
        const r = document.createRange(); r.selectNodeContents(pre);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        document.execCommand('copy'); s.removeAllRanges();
      }
      cb.textContent = 'Copied ✓'; sfx.ok();
      setTimeout(() => { cb.textContent = 'Copy'; }, 1600);
    });
  }

  /* ------------------------------------------------------------
     hero · cassette reels with constant linear tape speed
     ------------------------------------------------------------ */
  function heroDeck() {
    const reelL = $('#reelL'), reelR = $('#reelR'), tapeL = $('#tapeL'), tapeR = $('#tapeR'), bridge = $('#tapeBridge'), flash = $('.head-flash');
    const lcdHb = $('#lcdHb'), lcdMb = $('#lcdMb'), lcdR = $('#lcdR'), vu = $('#vu'), hero = $('#top'), tilt = $('#heroTilt');
    if (!reelL) return;
    const bars = Array.from({ length: 28 }, () => h('i', null, null, vu));
    const combos = [];
    KEYS.forEach(d => [0, 1, 2].forEach(b => combos.push([d, b, rand(9.6, 10.4)])));
    let ci = 2;
    const RL0 = 46, RL1 = 22, RR0 = 20;
    const RR1 = Math.sqrt(RR0 * RR0 + .1 * (RL0 * RL0 - RL1 * RL1));
    const PLAY = 5.4, REW = 1.1;
    let aL = 0, aR = 0, phase = 0, level = 0, last = performance.now(), visible = true, flashed = false;
    let lastScroll = window.scrollY, boost = 0;

    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);

    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const sy = window.scrollY;
      boost = Math.max(boost * .9, Math.abs(sy - lastScroll) * 6);
      lastScroll = sy;
      if (visible) {
        phase += dt;
        let p, rew = false;
        if (phase < PLAY) { p = phase / PLAY; flashed = false; }
        else if (phase < PLAY + REW) {
          rew = true; p = 1 - easeIO((phase - PLAY) / REW);
          if (!flashed) { flashed = true; flash.classList.remove('on'); void flash.getBoundingClientRect(); flash.classList.add('on'); }
        } else { phase = 0; p = 0; ci = (ci + 1) % combos.length; }

        const rL = lerp(RL0, RL1, p), rR = lerp(RR0, RR1, p);
        tapeL.setAttribute('r', rL.toFixed(2));
        tapeR.setAttribute('r', rR.toFixed(2));
        bridge.setAttribute('d', `M236 ${(176 + rL).toFixed(1)} L364 ${(176 + rR).toFixed(1)}`);
        const v = rew ? -520 : 42 + boost;
        aL += (v / rL) * dt * 57.3;
        aR += (v * .35 / rR) * dt * 57.3;
        reelL.style.transform = `rotate(${aL % 360}deg)`;
        reelR.style.transform = `rotate(${aR % 360}deg)`;

        const [d, b, rr] = combos[ci];
        const tok = DOM[d].tok[b];
        const shown = rew ? tok : tok * clamp(p * 1.1, 0, 1);
        lcdHb.textContent = shown.toFixed(1) + 'K';
        lcdMb.textContent = (shown * rr / 100).toFixed(2) + 'K';
        lcdR.textContent = `${({ s: 'SRCH', c: 'CODE', w: 'WKSP' })[d]} ${BND[b]} · r=${rr.toFixed(1)}%`;

        const target = rew ? .15 + Math.random() * .1 : clamp(.42 + .32 * Math.sin(now / 170) * Math.sin(now / 530) + rand(-.16, .16) + boost / 3000, 0, 1);
        level = lerp(level, target, .35);
        const n = Math.round(level * bars.length);
        bars.forEach((el, i) => { el.className = i < n ? (i >= bars.length - 5 ? 'on hot' : 'on') : ''; });
      }
      requestAnimationFrame(frame);
    };
    if (REDUCED) {
      lcdHb.textContent = '29.3K'; lcdMb.textContent = '2.93K';
    } else requestAnimationFrame(frame);

    if (!REDUCED && window.matchMedia('(hover: hover)').matches) {
      hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width * 2 - 1;
        const dy = (e.clientY - r.top) / r.height * 2 - 1;
        tilt.style.transform = `rotateY(${(dx * 9).toFixed(2)}deg) rotateX(${(-dy * 7).toFixed(2)}deg)`;
      });
      hero.addEventListener('mouseleave', () => { tilt.style.transform = ''; });
    }
  }

  /* ------------------------------------------------------------
     teaser · animated paper Fig. 1
     ------------------------------------------------------------ */
  function overview() {
    const host = $('#overview'); if (!host) return;
    const C = { amber: '#ffb000', lit: 'rgba(255,176,0,.72)', dim: 'rgba(255,176,0,.12)', phos: '#8dff5a', red: '#ff4d2e', rep: 'rgba(255,145,71,.5)', s: '#ff9147', c: '#52e6aa', w: '#86b4ff' };
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

    T(30, 36, '01 · SOURCE TASKS', 'ov-hd');
    T(X0, 36, '02 · SUCCESSFUL TRAJECTORY τ · KEPT IF pass³', 'ov-hd');
    T(860, 36, '04 · POST-COMPACTION EXECUTION', 'ov-hd');

    const chips = KEYS.map((k, i) => {
      const y = 58 + i * 92;
      const r = svg('rect', { x: 30, y, width: 190, height: 72, rx: 6, fill: C[k], 'fill-opacity': .05, stroke: C[k], 'stroke-width': 1 }, s);
      const t1 = T(46, y + 30, DOM[k].name.toUpperCase(), 'ov-txt'); t1.style.fill = C[k];
      T(46, y + 52, `${String(DOM[k].tasks).padStart(3, '0')} TASKS · ${DOM[k].bench}`, 'ov-small');
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

    const box = svg('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: 8, fill: 'rgba(255,176,0,.05)', stroke: C.amber, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' }, s);
    TS(BOX.x + BOX.w / 2, BOX.y - 12, '03 · C', 'φ', 'ov-hd', { 'text-anchor': 'middle' });
    T(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2 + 4, 'LLM', 'ov-big', { 'text-anchor': 'middle' });
    T(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2 + 26, 'r = 10%', 'ov-small', { 'text-anchor': 'middle' });

    const rows = IDX.map((ix, k) => {
      const y = ROWY[k];
      const full = ix * STEP - 4;
      TS(X0, y - 9, 'H', 'b', 'ov-small').appendChild(document.createTextNode(` · b = ${BND[k]} · ${ix} of ${N} steps`));
      const hb = svg('rect', { x: X0, y, width: 0, height: 30, fill: C.amber, rx: 2 }, s);
      const hbT = TS(X0 + 8, y + 20, 'H', 'b', 'ov-small', { opacity: 0 }); hbT.style.fill = '#1a1205';
      const arr = svg('line', { x1: BOX.x + BOX.w + 4, x2: 855, y1: y + 15, y2: y + 15, stroke: C.amber, 'stroke-width': 1.2, 'marker-end': 'url(#ovah)', opacity: .25 }, s);
      const mb = svg('rect', { x: 860, y, width: 0, height: 30, fill: C.phos, rx: 2 }, s);
      const mbT = TS(866, y + 20, 'M', 'b', 'ov-small', { opacity: 0 }); mbT.style.fill = '#0c1a06';
      const rem = N - ix, cw = (CX1 - CX0) / rem, cc = [];
      for (let i = 0; i < rem; i++) cc.push(svg('rect', { x: CX0 + i * cw, y: y + 4, width: Math.max(2, cw - 3), height: 22, fill: C.dim }, s));
      const lamp = svg('circle', { cx: 1152, cy: y + 15, r: 13, fill: 'none', stroke: C.dim, 'stroke-width': 2 }, s);
      const lampT = T(1152, y + 20, '', 'ov-txt', { 'text-anchor': 'middle' });
      const cap = T(1152, y + 46, '', 'ov-small', { 'text-anchor': 'middle' });
      return { ix, y, full, rem, hb, hbT, mb, mbT, cc, lamp, lampT, cap, arr };
    });

    T(30, 372, 'RUNNING Acc', 'ov-hd');
    const accT = T(30, 412, '--.-%', 'ov-big'); accT.style.fill = C.phos;
    const loopT = T(30, 434, 'LOOP 000', 'ov-small');
    T(30, 456, 'Acc = successful continuations / all instances · sampled from the paper\'s mean accuracy', 'ov-small');

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
      loopT.textContent = `LOOP ${String(loop).padStart(3, '0')} · ${DOM[dom].bench.toUpperCase()}`;
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
      cells.forEach((c, i) => {
        c.setAttribute('fill', t > .3 + i * (1.5 / N) ? C.lit : C.dim);
        c.setAttribute('opacity', fade);
      });
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
          c.setAttribute('fill', f);
          c.setAttribute('opacity', fade);
        });
        const done = t >= ce + .1;
        const col = pl.ok ? C.phos : C.red;
        r.lamp.setAttribute('stroke', done ? col : C.dim);
        r.lamp.setAttribute('fill', done ? (pl.ok ? 'rgba(141,255,90,.18)' : 'rgba(255,77,46,.18)') : 'none');
        r.lamp.setAttribute('opacity', fade);
        r.lampT.textContent = done ? (pl.ok ? '✓' : '✗') : '';
        r.lampT.style.fill = col;
        r.cap.textContent = done ? (pl.ok ? 'COMPLETE' : pl.early ? 'EARLY STOP' : 'BUDGET OUT') : '';
        r.cap.style.fill = col;
        r.cap.setAttribute('opacity', fade);
        if (done && !counted[k]) {
          counted[k] = true; n++; if (pl.ok) ok++;
          accT.textContent = (ok / n * 100).toFixed(1) + '%';
        }
      });
      box.setAttribute('fill', glow ? 'rgba(255,176,0,.18)' : 'rgba(255,176,0,.05)');
    };

    newLoop();
    if (REDUCED) { render(7.6); return; }
    let vis = false, t = 0, last = performance.now();
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: .1 }).observe(host);
    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (vis) {
        t += dt;
        if (t >= LEN) { t = 0; newLoop(); }
        render(t);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------
     §2 · tape spec cards (Table 1)
     ------------------------------------------------------------ */
  function tapes() {
    const host = $('#tapes'); if (!host) return;
    KEYS.forEach((k, i) => {
      const d = DOM[k];
      const card = h('div', 'tcard reveal', null, host);
      card.dataset.d = String(i + 1);
      card.style.setProperty('--dc', d.color);
      card.innerHTML = `
        <div class="tcard__lbl">
          <div class="tcard__k"><span>${d.name}</span><span>SIDE ${'ABC'[i]}</span></div>
          <div class="tcard__n"><b>${d.tasks}</b><span>TASKS</span></div>
          <div class="tcard__name">${d.bench}</div>
          <div class="tcard__stripe"></div>
          <dl>
            <dt>Avg. rounds</dt><dd>${d.rounds}</dd>
            <dt>Avg. tokens</dt><dd>${d.avg}K</dd>
            <dt>Median tokens</dt><dd>${d.med}K</dd>
            <dt>Executor</dt><dd>${d.exec}</dd>
          </dl>
          <div class="tcard__state">${d.state}</div>
        </div>
        <div class="tcard__len"><span>LEN</span><div class="bar"><i></i></div><span>${d.avg}K</span></div>`;
      const bar = $('.bar i', card);
      onceVisible(card, () => { bar.style.width = (Math.sqrt(d.avg / 122.8) * 100).toFixed(1) + '%'; }, { threshold: .4 });
    });
  }

  /* ------------------------------------------------------------
     §3 · bench deck · playable instance
     ------------------------------------------------------------ */
  function machine() {
    const R = {
      head: $('#bmHead'), ref: $('#bmRef'), refEnd: $('#bmRefEnd'), hb: $('#bmHb'), hbTxt: $('#bmHbTxt'), mb: $('#bmMb'), ratio: $('#bmRatio'),
      lanes: [0, 1, 2].map(i => $('#bmLane' + i)), ends: [0, 1, 2].map(i => $('#bmEnd' + i)),
      log: $('#bmLog'), model: $('#bmModel'), paper: $('#bmPaper'), mine: $('#bmMine'), mineN: $('#bmMineN'), ticks: $('#bmTicks'),
      run: $('#bmRun'), auto: $('#bmAuto'), prev: $('#bmPrev'), next: $('#bmNext'), slide: $('#bmBoundary')
    };
    if (!R.head) return null;
    const leds = {};
    $$('.led').forEach(l => { leds[l.dataset.led] = l; });
    const led = (k, on) => { if (leds[k]) leds[k].classList.toggle('on', on); };
    const st = { d: 's', b: 0, m: 0, busy: false, tally: {}, ticks: [] };
    const FR = [.25, .5, .75];
    const tickEls = Array.from({ length: 40 }, () => h('i', null, null, R.ticks));
    let cut = null;

    const geo = () => { const d = DOM[st.d]; const T = d.T; const b = Math.round(T * FR[st.b]); return { d, T, b, budget: T - b }; };
    const key = () => st.d + st.b + st.m;
    const prob = () => MODELS[st.m][st.d][st.b] / 100;

    const logLine = (txt, cls = '') => {
      $$('.caret', R.log).forEach(e => e.classList.remove('caret'));
      const div = h('div', cls ? cls + ' caret' : 'caret', null, R.log);
      div.textContent = txt;
      while (R.log.children.length > 6) R.log.firstChild.remove();
    };
    const updateMine = () => {
      const t = st.tally[key()];
      if (!t || !t.n) { R.mine.textContent = '--.-'; R.mineN.textContent = '0 / 0'; }
      else { R.mine.textContent = (t.ok / t.n * 100).toFixed(1); R.mineN.textContent = `${t.ok} / ${t.n}`; }
    };
    const pushTick = ok => {
      st.ticks.push(ok); if (st.ticks.length > 40) st.ticks.shift();
      tickEls.forEach((e, i) => { const v = st.ticks[i]; e.className = v === undefined ? '' : (v ? 'ok' : 'bad'); });
    };
    const record = ok => {
      const k = key(); const t = st.tally[k] || (st.tally[k] = { ok: 0, n: 0 });
      t.n++; if (ok) t.ok++; pushTick(ok);
    };
    const draw = () => {
      if (Math.random() < prob()) return { ok: true };
      const pe = st.d === 's' ? [.21, .12, .04][st.b] : .4;
      return { ok: false, early: Math.random() < pe };
    };
    const setBusy = b => {
      st.busy = b;
      [R.run, R.auto, R.prev, R.next, ...$$('#bmDomain .key'), ...$$('button', R.slide)].forEach(x => { x.disabled = b; });
    };

    const build = () => {
      const { d, T, b, budget } = geo();
      R.head.innerHTML = `<span>TAPE <b>${d.bench}</b></span><span>T = <b>${T}</b></span><span>b = <b>${BND[st.b]}</b> · ACTION <b>${b}</b></span><span>BUDGET T−b = <b>${budget}</b></span><span>EXECUTOR <b>${d.exec}</b> · FIXED</span>`;
      R.ref.innerHTML = '';
      for (let i = 0; i < T; i++) h('i', 'c ' + (i % 2 ? 'o' : 'a'), null, R.ref);
      cut = h('i', 'bm-cut', null, R.ref);
      cut.style.left = `calc(${(b / T * 100).toFixed(2)}% - 1px)`;
      R.refEnd.textContent = ''; R.refEnd.className = 'bm-end';
      R.hb.style.width = '0'; R.hb.classList.remove('squash'); R.mb.classList.remove('on');
      R.hbTxt.textContent = ''; R.ratio.textContent = ''; R.ratio.className = 'bm-end';
      R.lanes.forEach((ln, j) => {
        ln.innerHTML = '';
        for (let i = 0; i <= budget; i++) h('i', 'c void', null, ln);
        R.ends[j].textContent = ''; R.ends[j].className = 'bm-end';
      });
      const m = MODELS[st.m];
      R.model.innerHTML = `<b>${m.n}</b><small>${m.cfg.toUpperCase()} · #${String(st.m + 1).padStart(2, '0')}/12</small>`;
      R.model.classList.remove('flip'); void R.model.offsetWidth; R.model.classList.add('flip');
      R.paper.textContent = (prob() * 100).toFixed(1);
      updateMine();
    };

    const runLane = async (j, r, budget) => {
      const cs = $$('.c', R.lanes[j]), end = R.ends[j];
      await sleep(j * 140);
      cs[0].className = 'c mb';
      const k = r.ok ? Math.max(1, Math.ceil(budget * rand(.3, .85)))
        : r.early ? Math.max(1, Math.ceil(budget * rand(.15, .5))) : budget;
      const dt = REDUCED ? 0 : Math.min(90, 1300 / budget) * rand(.8, 1.25);
      for (let i = 1; i <= k; i++) {
        const last = i === k;
        if (r.ok) cs[i].className = 'c ok';
        else if (last) cs[i].className = 'c bad';
        else cs[i].className = 'c ' + (!r.early && i > budget * .35 && i % 3 === 0 ? 'rep' : 'on');
        if (i % 3 === 0) sfx.tick();
        if (dt) await sleep(dt);
      }
      if (r.ok) { end.textContent = `✓ DONE · ${k} ACT`; end.classList.add('ok'); logLine(`  RUN ${j + 1}: TASK COMPLETE IN ${k}/${budget} ACTIONS`, 'g'); }
      else if (r.early) { end.textContent = '✗ EARLY STOP'; end.classList.add('bad'); logLine(`  RUN ${j + 1}: PREMATURE COMMIT AT ACTION ${k}`, 'r'); }
      else { end.textContent = '✗ BUDGET OUT'; end.classList.add('bad'); logLine(`  RUN ${j + 1}: REPEATED WORK · ${budget}/${budget} ACTIONS SPENT`, 'r'); }
    };

    const run = async () => {
      if (st.busy) return;
      setBusy(true);
      R.run.classList.add('is-down'); setTimeout(() => R.run.classList.remove('is-down'), 140);
      build();
      const { d, T, b, budget } = geo();
      const m = MODELS[st.m];
      const cells = $$('.c', R.ref);
      led('rec', true);
      logLine(`> MOUNT τ ${d.bench.toUpperCase()} · T=${T} · REFERENCE PASS³`);
      const sp = REDUCED ? 0 : 700 / T;
      for (let i = 0; i < T; i++) { cells[i].classList.add('on'); if (i % 2 === 0) sfx.tick(); if (sp) await sleep(sp); }
      R.refEnd.textContent = '✓ PASS³'; R.refEnd.classList.add('ok');
      await sleep(250);

      led('cut', true); sfx.click(); cut.classList.add('on');
      cells.forEach((c, i) => { c.classList.remove('on'); c.classList.add(i < b ? 'hb' : 'rest'); });
      const tok = d.tok[st.b];
      logLine(`> CUT AT b=${BND[st.b]} · ACTION ${b}/${T} · H_b ≈ ${tok}K TOK`, 'd');
      await sleep(500);

      led('cmp', true); sfx.whir();
      R.hb.style.width = (b / T * 100).toFixed(2) + '%';
      R.hbTxt.textContent = `H_b · ${tok}K TOK`;
      await sleep(800);
      R.hb.classList.add('squash'); R.mb.classList.add('on');
      const rr = rand(9.5, 10.4);
      await animateNum(R.ratio, 100, rr, 900, v => `r = ${v.toFixed(1)}%`);
      R.ratio.classList.add('ok');
      logLine(`> C_φ = ${m.n.toUpperCase()} · M_b ≈ ${(tok * rr / 100).toFixed(2)}K TOK`);
      await sleep(200);

      led('run', true);
      const res = [0, 1, 2].map(() => draw());
      await Promise.all(res.map((r, j) => runLane(j, r, budget)));
      const okN = res.filter(r => r.ok).length;
      res.forEach(r => record(r.ok)); updateMine();
      logLine(`> Avg@3 = ${okN}/3 · PAPER Acc = ${(prob() * 100).toFixed(1)}%`, okN >= 2 ? 'g' : 'r');
      if (okN >= 2) sfx.ok(); else sfx.bad();
      ['rec', 'cut', 'cmp', 'run'].forEach(k => led(k, false));
      setBusy(false);
    };

    const auto = async () => {
      if (st.busy) return;
      setBusy(true); build(); led('run', true);
      const N = 20; let ok = 0;
      logLine(`> AUTO × ${N} INSTANCES · ${N * 3} CONTINUATIONS`, 'd');
      for (let i = 0; i < N * 3; i++) {
        const r = draw(); record(r.ok); if (r.ok) ok++;
        updateMine();
        if (i % 3 === 2) sfx.tick();
        if (!REDUCED) await sleep(26);
      }
      const rate = ok / N / 3;
      logLine(`> ${ok}/${N * 3} OK = ${(rate * 100).toFixed(1)}% · PAPER ${(prob() * 100).toFixed(1)}%`, Math.abs(rate - prob()) < .1 ? 'g' : 'd');
      led('run', false); setBusy(false);
    };

    $$('#bmDomain .key').forEach(k => k.addEventListener('click', () => {
      if (st.busy) return;
      st.d = k.dataset.v;
      $$('#bmDomain .key').forEach(x => x.classList.toggle('is-on', x === k));
      sfx.click(); build(); logLine(`> LOAD TAPE ${DOM[st.d].bench.toUpperCase()}`, 'd');
    }));
    $$('button', R.slide).forEach(btn => btn.addEventListener('click', () => {
      if (st.busy) return;
      st.b = +btn.dataset.v;
      R.slide.style.setProperty('--i', st.b);
      $$('button', R.slide).forEach(x => x.setAttribute('aria-checked', String(x === btn)));
      sfx.click(); build(); logLine(`> SET BOUNDARY b = ${BND[st.b]}`, 'd');
    }));
    R.prev.addEventListener('click', () => { if (st.busy) return; st.m = (st.m + MODELS.length - 1) % MODELS.length; sfx.click(); build(); });
    R.next.addEventListener('click', () => { if (st.busy) return; st.m = (st.m + 1) % MODELS.length; sfx.click(); build(); });
    R.run.addEventListener('click', run);
    R.auto.addEventListener('click', auto);

    build();
    led('pwr', true);
    logLine('> CB-200 READY · PRESS REC', 'd');
    onceVisible($('#deck'), () => setTimeout(run, 450), { threshold: .45 });

    return {
      load(i) {
        if (st.busy) return;
        st.m = i; build();
        logLine(`> LOADED ${MODELS[i].n.toUpperCase()} FROM LEADERBOARD`, 'd');
        document.getElementById('machine').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      }
    };
  }

  /* ------------------------------------------------------------
     §4 · leaderboard with re-sorting channels
     ------------------------------------------------------------ */
  function board(api) {
    const rowsEl = $('#boardRows'), tabsEl = $('#boardTabs'), note = $('#boardNote');
    if (!rowsEl) return;
    const CH = [
      { name: 'Overall', col: 'var(--ink)', get: m => m.o },
      { name: 'Search', col: 'var(--d-s)', get: m => m.s[3] },
      { name: 'Coding', col: 'var(--d-c)', get: m => m.c[3] },
      { name: 'Workspace', col: 'var(--d-w)', get: m => m.w[3] }
    ];
    const RH = 44;
    rowsEl.style.height = MODELS.length * RH + 'px';
    const rows = MODELS.map((m, i) => {
      const r = h('div', 'brow', `<span class="brow__rk">${String(i + 1).padStart(2, '0')}</span><span class="brow__nm">${m.n}<small>${m.cfg}</small></span><span class="brow__tr"><i class="brow__fill"></i><i class="brow__mean"></i></span><span class="brow__v">0.0</span>`, rowsEl);
      r.style.transform = `translateY(${i * RH}px)`;
      r.title = 'Click to load this compactor into the bench deck';
      r.addEventListener('mouseenter', () => hl(i));
      r.addEventListener('mouseleave', () => hl(-1));
      r.addEventListener('click', () => { sfx.click(); if (api) api.load(i); });
      return r;
    });
    onHL(i => rows.forEach((r, j) => r.classList.toggle('is-hl', j === i)));
    let cur = 0, timer = null;
    const tabs = CH.map((c, i) => {
      const b = h('button', 'tab', `${i ? `<i style="background:${c.col}"></i>` : ''}${c.name}`, tabsEl);
      b.addEventListener('click', () => { clearInterval(timer); timer = null; set(i); sfx.click(); });
      return b;
    });
    const set = ci => {
      cur = ci;
      const c = CH[ci];
      tabs.forEach((t, i) => t.classList.toggle('is-on', i === ci));
      const vals = MODELS.map(c.get);
      const order = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      order.forEach(([v, i], rank) => {
        const r = rows[i];
        r.style.transform = `translateY(${rank * RH}px)`;
        r.classList.toggle('is-top', rank === 0);
        $('.brow__rk', r).textContent = String(rank + 1).padStart(2, '0');
        const f = $('.brow__fill', r);
        f.style.width = v + '%';
        f.style.setProperty('--bc', c.col);
        $('.brow__mean', r).style.left = mean.toFixed(2) + '%';
        const ve = $('.brow__v', r);
        animateNum(ve, parseFloat(ve.textContent) || 0, v, 900, x => x.toFixed(1));
      });
      note.innerHTML = `MEAN <b>${mean.toFixed(1)}%</b> · RANGE ${Math.min(...vals).toFixed(1)}–${Math.max(...vals).toFixed(1)} · CLICK A ROW TO LOAD IT IN THE DECK`;
    };
    onceVisible(rowsEl, () => {
      set(0);
      if (!REDUCED) timer = setInterval(() => set((cur + 1) % CH.length), 4200);
    }, { threshold: .3 });
  }

  /* ------------------------------------------------------------
     §4 · boundary small multiples (Table 13 / Fig. 2)
     ------------------------------------------------------------ */
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
      const a0 = avgOf(k, 0), a2 = avgOf(k, 2);
      h('div', 'mcard__t', `<span>${d.name} · ${d.bench}</span><b style="color:${d.color}">${a0.toFixed(1)} → ${a2.toFixed(1)}</b>`, card);
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}` }, card);
      [0, 25, 50, 75, 100].forEach(v => {
        svg('line', { x1: 32, x2: W - 14, y1: y(v), y2: y(v), class: 'mgrid' }, s);
        const t = svg('text', { x: 26, y: y(v) + 3, 'text-anchor': 'end', class: 'maxis' }, s); t.textContent = v;
      });
      X.forEach((x, bi) => { const t = svg('text', { x, y: 222, 'text-anchor': 'middle', class: 'maxis' }, s); t.textContent = 'b=' + BND[bi]; });
      const lo = [0, 1, 2].map(b => q(MODELS.map(m => m[k][b]), .25));
      const hi = [0, 1, 2].map(b => q(MODELS.map(m => m[k][b]), .75));
      const pts = X.map((x, b) => `${x},${y(hi[b])}`).concat([2, 1, 0].map(b => `${X[b]},${y(lo[b])}`)).join(' ');
      const band = svg('polygon', { points: pts, class: 'mband' }, s); band.style.fill = d.color;
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
    const idle = 'Thick line = mean over 12 compactors · shaded band = middle 50% of models · hover or click a model';
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

  /* ------------------------------------------------------------
     §5 · H_b reels (Fig. 3) and persistence bars (Table 14)
     ------------------------------------------------------------ */
  function reels() {
    const g = $('#reels'); if (!g) return;
    h('div', 'reels__hd', '', g);
    KEYS.forEach(k => { const e = h('div', 'reels__hd', DOM[k].name.toUpperCase(), g); e.style.color = DOM[k].scolor; });
    const packs = [];
    [0, 1, 2].forEach(b => {
      h('div', 'reels__rw', BND[b], g);
      KEYS.forEach(k => {
        const tok = DOM[k].tok[b];
        const R = 14 + 42 * Math.sqrt(tok / 90);
        const cell = h('div', 'reel-c', null, g);
        const s = svg('svg', { viewBox: '-60 -60 120 120', role: 'img', 'aria-label': `${DOM[k].name} at ${BND[b]}: ${tok}K tokens` }, cell);
        svg('circle', { r: 57, fill: 'none', stroke: 'rgba(255,176,0,.16)', 'stroke-dasharray': '2 4' }, s);
        const pack = svg('circle', { r: 14, class: 'pack', fill: '#3b2617', stroke: 'rgba(255,176,0,.4)', 'stroke-width': .6 }, s);
        const spin = svg('g', { class: 'spin' }, s);
        svg('circle', { r: 13, fill: '#efe7d6' }, spin);
        svg('circle', { r: 5, fill: '#100f0c' }, spin);
        svg('path', { d: 'M0 -12V-7M0 12V7M-12 0H-7M12 0H7', stroke: '#100f0c', 'stroke-width': 3 }, spin);
        spin.style.setProperty('--spd', (R / 20 * 2.2).toFixed(2) + 's');
        const lab = h('b', null, tok.toFixed(1) + 'K', cell); lab.style.color = DOM[k].scolor;
        packs.push([pack, R]);
      });
    });
    onceVisible(g, () => packs.forEach(([p, R], i) => setTimeout(() => {
      p.style.r = R.toFixed(1) + 'px';
      p.setAttribute('r', R.toFixed(1));
    }, REDUCED ? 0 : i * 90)), { threshold: .3 });
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
          b.style.setProperty('--bc', sr.c);
          b.dataset.h = v;
        });
        const gn = gains[gi];
        const chip = h('div', 'gb__gain' + (gn < 0 ? ' neg' : ''), (gn > 0 ? '+' : '') + gn.toFixed(1), col);
        chip.style.top = `calc(${(100 - max).toFixed(1)}% - 46px)`;
      });
      const key = h('div', 'gkey', series.map(s => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join('') + '<span><i style="background:var(--c-red)"></i>gain from M<sub>b</sub></span>');
      host.after(key);
      onceVisible(host, () => $$('.gb', host).forEach((col, i) => setTimeout(() => {
        col.classList.add('in');
        $$('.gb__b', col).forEach(b => { b.style.height = b.dataset.h + '%'; });
      }, REDUCED ? 0 : i * 160)), { threshold: .35 });
    };
    mk($('#persistCoding'), [
      { n: 'w/o H<sub>b</sub> · initial state', c: 'var(--line-2)', v: [48.5, 35.5, 15.6] },
      { n: 'w/o H<sub>b</sub> · boundary state', c: 'color-mix(in srgb, var(--d-c) 40%, var(--panel))', v: [66.7, 58.1, 71.9] },
      { n: 'with M<sub>b</sub>', c: 'var(--d-c)', v: [64.0, 72.7, 86.1] }
    ], [-2.7, 14.6, 14.2]);
    mk($('#persistSearch'), [
      { n: 'w/o H<sub>b</sub>', c: 'var(--line-2)', v: [26.9, 15.4, 7.4] },
      { n: 'with M<sub>b</sub>', c: 'var(--d-s)', v: [52.9, 42.6, 34.6] }
    ], [26.0, 27.2, 27.2]);
  }

  /* ------------------------------------------------------------
     §6 · audit bar, butterfly (Table 16), heatmap (Table 17)
     ------------------------------------------------------------ */
  function failures() {
    const bar = $('#audit'), key = $('#auditKey');
    if (bar) {
      const S = [['Preserved', 69.1, 'var(--d-c)'], ['Omitted', 25.3, 'var(--c-orange)'], ['Distorted', 5.6, 'var(--c-red)'], ['Uncertain', 0.1, 'var(--muted)']];
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
          c.style.background = `rgba(${v >= 0 ? '226,56,27' : '16,145,106'},${(.08 + a * .85).toFixed(3)})`;
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

  /* ------------------------------------------------------------
     §7 · cases with typewriter playback
     ------------------------------------------------------------ */
  const typeInto = async (el, html, cancelled) => {
    el.innerHTML = html;
    if (REDUCED) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; let n;
    while ((n = walker.nextNode())) { nodes.push([n, n.nodeValue]); n.nodeValue = ''; }
    el.classList.add('typing');
    for (const [node, full] of nodes) {
      for (let i = 0; i < full.length; i += 4) {
        if (cancelled()) return;
        node.nodeValue = full.slice(0, i + 4);
        await new Promise(r => requestAnimationFrame(r));
      }
      node.nodeValue = full;
    }
    el.classList.remove('typing');
  };

  function cases() {
    const tabsEl = $('#caseTabs'), card = $('#caseCard');
    if (!card) return;
    let token = 0;
    const tabs = CASES.map((c, i) => {
      const b = h('button', 'tab', c.tab, tabsEl);
      b.addEventListener('click', () => { sfx.click(); show(i); });
      return b;
    });
    const show = async i => {
      const my = ++token, c = CASES[i];
      tabs.forEach((t, j) => t.classList.toggle('is-on', j === i));
      card.innerHTML = `
        <div class="case__meta">${c.meta.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>
        <p class="case__task"><em>TASK</em>${c.task}</p>
        <div class="case__grid">
          <div class="case__col screen"><h4><span>H<sub>b</sub> · BEFORE COMPACTION</span><span>◀◀ REWIND</span></h4><div class="case__txt"></div></div>
          <div class="case__col screen"><h4><span>M<sub>b</sub> · COMPACTED</span><span>≈10%</span></h4><div class="case__txt"></div></div>
          <div class="case__col screen"><h4><span>CONTINUATION</span><span>▶ PLAY</span></h4><div class="case__txt"></div></div>
        </div>
        <div class="case__verdict"><div class="stamp ${c.ok ? 'ok' : 'bad'}">${c.stamp}</div><p>${c.verdict}</p></div>`;
      const txts = $$('.case__txt', card), stamp = $('.stamp', card);
      const parts = [c.hb, c.mb, c.cont];
      for (let k = 0; k < 3; k++) {
        if (my !== token) return;
        await typeInto(txts[k], parts[k], () => my !== token);
      }
      if (my !== token) return;
      stamp.classList.add('on');
      if (c.ok) sfx.ok(); else sfx.bad();
    };
    onceVisible(card, () => show(0), { threshold: .2 });
  }

  /* ------------------------------------------------------------
     reveal + counters
     ------------------------------------------------------------ */
  function reveal() {
    $$('.reveal').forEach(el => {
      if (el.classList.contains('wipe')) {
        // a fully clipped element never reports as intersecting, so watch its container
        onceVisible(el.parentElement, () => el.classList.add('in'), { threshold: 0, rootMargin: '0px 0px -12% 0px' });
      } else onceVisible(el, () => el.classList.add('in'), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    });
    $$('[data-count]').forEach(el => onceVisible(el, () => {
      const raw = el.dataset.count, target = parseFloat(raw);
      const dec = (raw.split('.')[1] || '').length;
      const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      animateNum(el, 0, target, 1500, v => pre + v.toFixed(dec) + suf);
    }, { threshold: .5 }));
  }

  function math() {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(document.body, {
      delimiters: [{ left: '$$', right: '$$', display: true }],
      throwOnError: false
    });
  }

  /* ------------------------------------------------------------
     init
     ------------------------------------------------------------ */
  chrome();
  boot();
  math();
  heroDeck();
  overview();
  tapes();
  const deckApi = machine();
  board(deckApi);
  multiples();
  reels();
  persist();
  failures();
  cases();
  reveal();
})();
