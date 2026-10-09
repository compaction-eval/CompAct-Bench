/* §6 · Compactor seat. The player is C_φ: pick fragments of H_b, choose a
   phrasing for each (shorter = cheaper, but may lose facts or distort status),
   stay within 10% capacity, then a deterministic executor resumes under T − b.
   Mechanics mirror the paper's error taxonomy: CO, LR, PSL, PC/FD, CGD. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB) return;
  const { $, $$, h, sleep, sfx, store, animateNum, MODELS, DOM, REDUCED, toast, copyText } = CB;

  const ROLE = {
    critical: ['Critical evidence', 'var(--bad)'],
    constraint: ['Task constraint', 'var(--ds-w)'],
    rejected: ['Dead end · resolved', '#c98478'],
    hunch: ['Unverified hunch', 'var(--rose)'],
    thread: ['Open threads', 'var(--ds-c)'],
    persisted: ['State on disk · pointer', 'var(--ds-c)'],
    noise: ['Noise', 'var(--muted)']
  };
  const ERRLAB = { critical: 'CO', rejected: 'LR', thread: 'PSL', persisted: 'PSL', constraint: 'CO' };

  const MISSIONS = [
    {
      id: 'S-25', dom: 's', b: 0, title: 'The “Line” paper', budget: 6, base: 3, cap: 1000,
      task: 'Find Person A: elected AMS Fellow between 2005 and 2020, Ph.D. in Mathematics in 1983, co-author (1990–2005) of a three-author paper with a Rollo Davidson Prize winner and with Person C, whose 1990s paper title ends with the word “Line”. Give Person A’s full name.',
      baseActs: ['Infer the trio from the prize list: Lyons · Pemantle · Peres (1995)', 'Verify: Lyons Ph.D. 1983, AMS Fellow 2013 · Pemantle “…contains a line” (1997)', 'Submit · Russell David Lyons'],
      win: 'Russell David Lyons ✓',
      frags: [
        { id: 's1', r: 'R02', tag: 'Visit · Wikipedia', role: 'critical', pen: ['Search “Rollo Davidson Prize winners” again', 'Re-open the Wikipedia list', 'Re-read the 1991–2004 winners', 'Re-derive candidate co-authors'],
          vars: [{ k: 'FULL', t: 'Rollo Davidson Prize 1991–2004: Sznitman ’91 · Burdzy ’92 · Ben Arous & Pemantle ’93 · Mountford & Saloff-Coste ’94 · Biane & Peres ’95 · … · Benjamini & Holroyd ’04', c: 420 }, { k: 'SHORT', t: 'Prize winners list obtained.', c: 110, loses: true }] },
        { id: 's2', r: 'TASK', tag: 'Task detail', role: 'constraint', fail: 'Submit “Russell Lyons” → judge: incomplete name ✗',
          vars: [{ k: 'FULL', t: 'Answer format: Person A’s full name, middle name included.', c: 120 }] },
        { id: 's3', r: 'R01', tag: 'Search', role: 'rejected', pen: ['Retry “paper title ends with Line 1990s probability”', '→ APA style guides again. Dead end.'],
          vars: [{ k: 'FULL', t: 'Query “paper title ends with Line 1990s probability” → APA style guides, IEEE manual. Dead end.', c: 230 }, { k: 'SHORT', t: 'One search failed.', c: 80, loses: true }] },
        { id: 's4', r: 'R03', tag: 'Executor thought', role: 'hunch', chk: ['Check Burdzy: no 1983 Ph.D. / AMS match → drop'], distort: ['Trust M_b “Person A = Burdzy” → submit Krzysztof Burdzy ✗'],
          vars: [{ k: 'TENTATIVE', t: 'Hunch, unverified: Burdzy might be Person A (Ph.D. year unknown).', c: 170 }, { k: 'CONFIRMED', t: 'Person A = Burdzy.', c: 60, distort: true }] },
        { id: 's5', r: 'R03', tag: 'Status', role: 'thread', pen: ['Re-plan: which clues are still unmatched?'],
          vars: [{ k: 'FULL', t: 'Still open: (1) find Person C’s “…Line” paper; (2) match AMS Fellow + 1983 Ph.D.', c: 200 }, { k: 'SHORT', t: 'Keep searching.', c: 50, loses: true }] },
        { id: 's6', r: 'R01', tag: 'Raw results', role: 'noise', vars: [{ k: 'FULL', t: 'Full SERP dump: 10 results × 2 queries with snippets and URLs.', c: 2900 }] },
        { id: 's7', r: 'R02', tag: 'Page body', role: 'noise', vars: [{ k: 'FULL', t: 'Wikipedia page chrome: navigation, references, categories, edit links.', c: 3400 }] },
        { id: 's8', r: 'R03', tag: 'Tool metadata', role: 'noise', vars: [{ k: 'FULL', t: 'Search API JSON: ranks, dates and cache ids for 5 calls.', c: 2300 }] },
        { id: 's9', r: 'R01', tag: 'Query log', role: 'noise', vars: [{ k: 'FULL', t: 'Exact query strings issued in rounds 1–3.', c: 260 }] }
      ]
    },
    {
      id: 'C-75', dom: 'c', b: 2, title: 'The missing factor', budget: 8, base: 4, cap: 1100,
      task: 'sympy#18895: factor(z, extension=[I]) drops the factor y − 1 for z = expand((x − 1)(y − 1)). Fix it so the hidden tests pass. The repository is untouched at the boundary.',
      baseActs: ['Open dmp_sqf_part (sqfreetools.py:229)', 'Edit: gcd over dmp_diff_in(f, 1, j, u, K) for every j', 'Add dmp_diff_in to the imports', 'Run repro → (x − 1)(y − 1) · submit'],
      win: 'hidden tests pass ✓',
      frags: [
        { id: 'c1', r: 'R13', tag: 'Probe', role: 'critical', pen: ['grep _symbolic_factor / dmp_factor_list again', 'Re-read dmp_sqf_part', 'Re-run the ℚ⟨i⟩ probe'],
          vars: [{ k: 'FULL', t: 'Root cause: dmp_sqf_part takes gcd(f, ∂f/∂x₀). It differentiates the first variable only.', c: 300 }, { k: 'SHORT', t: 'The bug is somewhere in the square-free code.', c: 90, loses: true }] },
        { id: 'c2', r: 'R14', tag: 'grep', role: 'critical', pen: ['grep -n "def dmp_diff" densetools.py', 'sed -n 182,300p densetools.py', 'Re-read the dmp_diff_in signature'],
          vars: [{ k: 'FULL', t: 'Helper exists: dmp_diff_in(f, m, j, u, K) at densetools.py:239 differentiates w.r.t. x_j.', c: 240 }, { k: 'SHORT', t: 'There is a derivative helper in densetools.', c: 100, loses: true }] },
        { id: 'c3', r: 'R10', tag: 'File on disk', role: 'persisted', pen: ['Write a fresh repro script'],
          vars: [{ k: 'FULL', t: 'Repro saved on disk: /tmp/repro_18895.py.', c: 120 }] },
        { id: 'c4', r: 'R07', tag: 'Dead end', role: 'rejected', pen: ['Try patching dmp_ext_factor again', '→ no effect; revert'],
          vars: [{ k: 'FULL', t: 'Patching dmp_ext_factor (factortools.py:1138) does not help. The factor is lost earlier, in sqf_part.', c: 260 }, { k: 'SHORT', t: 'Looked at factortools.', c: 70, loses: true }] },
        { id: 'c5', r: 'R16', tag: 'Executor thought', role: 'hunch', chk: ['Test j = 1 only on a 3-variable case → fails; loop over all j'], distort: ['Apply the j = 1 patch from M_b, skip verification', 'Submit → hidden 3-variable test fails ✗'],
          vars: [{ k: 'TENTATIVE', t: 'Hunch, unverified: dmp_diff_in for variable j = 1 only might suffice.', c: 200 }, { k: 'CONFIRMED', t: 'Fix: use dmp_diff_in for variable 1.', c: 70, distort: true }] },
        { id: 'c6', r: 'R20', tag: 'Tests', role: 'thread', pen: ['Locate the relevant test files'],
          vars: [{ k: 'FULL', t: 'Relevant tests: test_sqfreetools.py, test_polytools.py::test_issue_5786 (XFAIL).', c: 200 }, { k: 'SHORT', t: 'Run the tests.', c: 50, loses: true }] },
        { id: 'c7', r: 'R12', tag: 'sed output', role: 'noise', vars: [{ k: 'FULL', t: '120 lines of sqfreetools.py printed by sed.', c: 4200 }] },
        { id: 'c8', r: 'R09', tag: 'grep output', role: 'noise', vars: [{ k: 'FULL', t: '63 grep matches across sympy/polys/.', c: 3300 }] },
        { id: 'c9', r: 'R21', tag: 'git log', role: 'noise', vars: [{ k: 'FULL', t: 'git log -5 with full commit messages.', c: 2180 }] }
      ]
    },
    {
      id: 'W-50', dom: 'w', b: 1, title: 'Quarter close', budget: 7, base: 3, cap: 900,
      task: 'Compile the Q3 vendor invoices in /finance/q3 into a report, exclude any vendor whose contract has ended, and send it to the CFO in the format she asked for.',
      baseActs: ['Export /reports/q3_vendors.xlsx with export_pdf', 'Email the PDF to dana.wu@corp.example', 'Confirm the sent item · submit'],
      win: 'evaluator: report accepted ✓',
      frags: [
        { id: 'w1', r: 'R31', tag: 'File on disk', role: 'persisted', pen: ['ls /reports … is there a draft?', 'Re-check the invoice totals'],
          vars: [{ k: 'FULL', t: 'Report built: /reports/q3_vendors.xlsx · 41 invoices · totals checked.', c: 220 }, { k: 'SHORT', t: 'Report started.', c: 70, loses: true }] },
        { id: 'w2', r: 'R12', tag: 'Email · Legal', role: 'constraint', fail: 'Submit → report still lists Acme Logistics ✗', pen: ['Search mail for “contract ended”', 'Read the Legal thread · Acme Logistics'],
          vars: [{ k: 'FULL', t: 'Exclude Acme Logistics: contract ended 2026-07-12.', c: 180 }, { k: 'SHORT', t: 'Exclude one vendor (see email).', c: 60, loses: true }] },
        { id: 'w3', r: 'R05', tag: 'Email · CFO', role: 'critical', pen: ['Look up the CFO in the directory', 'Re-read her request: PDF, not XLSX'],
          vars: [{ k: 'FULL', t: 'CFO = dana.wu@corp.example · wants a PDF, not XLSX.', c: 160 }, { k: 'SHORT', t: 'Send it to the CFO.', c: 50, loses: true }] },
        { id: 'w4', r: 'R27', tag: 'Executor thought', role: 'hunch', chk: ['Compare #2291 vs #2219: different amounts → keep both'], distort: ['Delete invoice #2291 as M_b instructs', 'Export & send → evaluator: Q3 total off by $18,400 ✗'],
          vars: [{ k: 'TENTATIVE', t: 'Unverified: invoice #2291 may duplicate #2219. Compare amounts before deleting.', c: 210 }, { k: 'CONFIRMED', t: '#2291 is a duplicate. Delete it.', c: 80, distort: true }] },
        { id: 'w5', r: 'R29', tag: 'Dead end', role: 'rejected', pen: ['Try libreoffice --convert-to pdf', '→ command not found; look for another tool'],
          vars: [{ k: 'FULL', t: 'libreoffice --convert-to pdf fails (not installed). Use the export_pdf tool.', c: 230 }, { k: 'SHORT', t: 'PDF export had issues.', c: 80, loses: true }] },
        { id: 'w6', r: 'R02', tag: 'Mail dump', role: 'noise', vars: [{ k: 'FULL', t: 'Full email thread export: 23 messages with signatures.', c: 3500 }] },
        { id: 'w7', r: 'R08', tag: 'Directory listing', role: 'noise', vars: [{ k: 'FULL', t: 'ls -R /finance: 318 files.', c: 2600 }] },
        { id: 'w8', r: 'R01', tag: 'Tool schemas', role: 'noise', vars: [{ k: 'FULL', t: 'JSON schemas for 14 workspace tools.', c: 1900 }] }
      ]
    }
  ];
  MISSIONS.forEach(m => { m.total = m.frags.reduce((a, f) => a + f.vars[0].c, 0); });

  /* ---------- simulation ---------- */
  const simulate = (m, picks) => {
    const acts = [], errs = [], notes = {};
    let distortF = null, cgdF = null;
    m.frags.forEach(f => {
      const vk = picks[f.id];
      const v = vk == null ? null : f.vars.find(x => x.k === vk);
      if (f.role === 'noise') { notes[f.id] = v ? ['kept', 'Costly. No effect on the run.'] : ['ok', 'Dropped. Correct.']; return; }
      if (f.role === 'hunch') {
        if (!v) { notes[f.id] = ['ok', 'Dropped. Fine: the hunch was wrong anyway.']; return; }
        if (v.distort) { distortF = f; errs.push('PC'); notes[f.id] = ['bad', 'Distorted: an unverified hunch was handed over as fact.']; return; }
        f.chk.forEach(t => acts.push({ k: 'chk', t }));
        notes[f.id] = ['warn', `Kept as tentative: +${f.chk.length} verification action.`];
        return;
      }
      const missing = !v || v.loses;
      if (f.role === 'constraint' && !v) { cgdF = f; errs.push('CGD'); notes[f.id] = ['bad', 'Dropped: the executor no longer knows the requirement.']; return; }
      if (missing) {
        f.pen.forEach(t => acts.push({ k: 'rep', t }));
        errs.push(ERRLAB[f.role]);
        notes[f.id] = ['bad', `${v ? 'Shortened past the key fact' : 'Omitted'}: +${f.pen.length} action${f.pen.length > 1 ? 's' : ''} to recover.`];
      } else notes[f.id] = ['ok', 'Carried forward.'];
    });
    let outcome, used;
    if (distortF) {
      const seq = distortF.distort.map((t, i, a) => ({ k: i === a.length - 1 ? 'bad' : 'ok', t }));
      return { outcome: 'early', acts: seq, used: seq.length, errs: [...new Set(errs)], notes };
    }
    m.baseActs.forEach(t => acts.push({ k: 'ok', t }));
    if (acts.length > m.budget) {
      const seq = acts.slice(0, m.budget);
      seq[seq.length - 1] = { k: 'bad', t: seq[seq.length - 1].t + ' → budget exhausted' };
      outcome = 'budget'; used = m.budget;
      return { outcome, acts: seq, used, errs: [...new Set(errs)], notes };
    }
    if (cgdF) {
      acts[acts.length - 1] = { k: 'bad', t: cgdF.fail };
      return { outcome: 'cgd', acts, used: acts.length, errs: [...new Set(errs)], notes };
    }
    acts[acts.length - 1] = { k: 'ok', t: acts[acts.length - 1].t + ' → ' + m.win };
    return { outcome: 'ok', acts, used: acts.length, errs: [...new Set(errs)], notes };
  };
  const costOf = (m, picks) => m.frags.reduce((a, f) => { const vk = picks[f.id]; const v = vk == null ? null : f.vars.find(x => x.k === vk); return a + (v ? v.c : 0); }, 0);
  const solveOpt = m => {
    let best = null;
    const opts = m.frags.map(f => [null, ...f.vars.map(v => v.k)]);
    const picks = {};
    const rec = (i, cost) => {
      if (cost > m.cap) return;
      if (i === m.frags.length) {
        const r = simulate(m, picks);
        if (r.outcome !== 'ok') return;
        if (!best || r.used < best.used || (r.used === best.used && cost < best.cost)) best = { used: r.used, cost, picks: { ...picks } };
        return;
      }
      const f = m.frags[i];
      for (const o of opts[i]) {
        if (o == null) delete picks[f.id]; else picks[f.id] = o;
        const v = o == null ? null : f.vars.find(x => x.k === o);
        rec(i + 1, cost + (v ? v.c : 0));
      }
      delete picks[f.id];
    };
    rec(0, 0);
    return best;
  };
  MISSIONS.forEach(m => { m.opt = solveOpt(m); m.par = m.opt ? m.opt.used : m.base; });

  const RANKS = {
    S: ['S', 'Master Compactor', 'You carried exactly what the next action needed and nothing else. That is the paper’s definition of a good compactor: prospective, not just faithful.'],
    A: ['A', 'Line Supervisor', 'The run landed, but some actions went into recovering things you could have carried. Under a matched budget, information you drop has to be paid for twice.'],
    B: ['B', 'Survivor', 'Success with little margin. Several recoveries ate into T − b; one more omission and this would have been a budget exhaustion.'],
    early: ['F', 'Overconfident Oracle', 'You stated an unverified hunch as fact, and the executor believed you. This is premature commitment, the signature of early failures (56.7% of them carry PC).'],
    hoard: ['F', 'Hoarder', 'Raw dumps are the most expensive fragments and carry nothing the executor needs. They crowded out the evidence, and repeated work exhausted the budget.'],
    budget: ['F', 'Amnesiac', 'Omissions forced the executor to reconstruct state it once had: repeated searches, re-read files, reopened dead ends. Critical omission lifts repeated work by +18.2 pts in the paper.'],
    cgd: ['F', 'Goal Drifter', 'Everything ran, but the final answer violated a requirement that only lived in the history. Constraint/goal distortion is the quiet failure mode.']
  };
  const rankOf = (m, r, picks) => {
    if (r.outcome === 'ok') return r.used <= m.par ? RANKS.S : r.used <= m.par + 2 ? RANKS.A : RANKS.B;
    if (r.outcome === 'early') return RANKS.early;
    if (r.outcome === 'cgd') return RANKS.cgd;
    const noisy = m.frags.some(f => f.role === 'noise' && picks[f.id] && f.vars[0].c > 1000);
    return noisy ? RANKS.hoard : RANKS.budget;
  };

  /* ---------- UI ---------- */
  const tabsEl = $('#missions'), game = $('#game');
  if (!tabsEl || !game) return;
  const results = JSON.parse(store.get('cb-missions') || '{}');
  let cur = 0, picks = {}, running = false, locked = false;

  const tabs = MISSIONS.map((m, i) => {
    const d = DOM[m.dom];
    const b = h('button', 'mission', '', tabsEl);
    b.style.setProperty('--dc', d.color);
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { if (running) return; sfx.click(); load(i); });
    return b;
  });
  const paintTabs = () => tabs.forEach((b, i) => {
    const m = MISSIONS[i], d = DOM[m.dom], r = results[m.id];
    b.classList.toggle('is-on', i === cur);
    b.innerHTML = `<small>Mission ${m.id} · ${d.name} · b = ${CB.BND[m.b]}</small><b>${m.title}</b><span>Budget ${m.budget} actions · capacity ${m.cap.toLocaleString()} chars · par ${m.par}</span>` +
      (r ? `<em class="${r.ok ? 'pass' : 'fail'}">${r.rank}</em>` : '<em>New</em>');
  });

  function load(i) {
    cur = i; picks = {}; locked = false;
    const m = MISSIONS[i], d = DOM[m.dom];
    paintTabs();
    const order = [...m.frags].sort((a, b) => (a.r === 'TASK' ? -1 : b.r === 'TASK' ? 1 : a.r.localeCompare(b.r)));
    game.innerHTML = `
      <div class="panel__hd"><span class="panel__id">Mission ${m.id}</span><span class="panel__t">${d.bench} · compactor seat</span><span class="panel__st"><i class="led amber"></i><span id="gStatus">Awaiting M_b</span></span></div>
      <div class="brief">
        <div class="brief__task"><small>Task t · executor ${d.exec} · boundary b = ${CB.BND[m.b]}</small><p>${m.task}</p></div>
        <div class="brief__specs">
          <div class="spec"><span>H_b</span><b>${(m.total / 1000).toFixed(1)}k</b></div>
          <div class="spec"><span>Capacity</span><b>${(m.cap / 1000).toFixed(1)}k</b></div>
          <div class="spec"><span>Budget T−b</span><b>${m.budget}</b></div>
          <div class="spec"><span>Par</span><b>${m.par}</b></div>
        </div>
      </div>
      <div class="workbench">
        <div>
          <div class="wb__hd"><b>H<sub>b</sub> · history before the boundary</b><span>click to add</span></div>
          <div class="frags" id="gFrags">${order.map(f => `
            <button class="frag${f.vars[0].c > 1000 ? ' heavy' : ''}" data-id="${f.id}" type="button">
              <span class="frag__r">${f.r}</span>
              <span class="frag__t"><small>${f.tag}</small>${f.vars[0].t}<span class="frag__role" style="color:${ROLE[f.role][1]}">${ROLE[f.role][0]}</span></span>
              <span class="frag__c">${f.vars[0].c.toLocaleString()}</span>
            </button>`).join('')}</div>
        </div>
        <div class="capsule">
          <div class="wb__hd"><b>M<sub>b</sub> · your compacted context</b><span>r ≤ 10%</span></div>
          <div class="screen gauge">
            <div class="gauge__row"><span>Chars used</span><b id="gUsed">0</b><span>/ ${m.cap.toLocaleString()}</span></div>
            <div class="gauge__bar" id="gBar">${'<i></i>'.repeat(40)}</div>
            <div class="gauge__cap"><span>0</span><span id="gRatio">r = 0.0%</span><span>10% cap</span></div>
          </div>
          <div class="picked" id="gPicked"></div>
          <div class="cap-actions">
            <button class="btn btn--sm" id="gReset" type="button">Clear</button>
            <button class="btn btn--sm btn-commit" id="gCommit" type="button" disabled>Commit and resume →</button>
          </div>
        </div>
      </div>
      <div class="screen runner" id="gRunner" hidden>
        <div class="runner__hd"><span>Executor · ${d.exec} · resuming from M_b</span><span>Actions <b id="gAct">0</b> / ${m.budget}</span></div>
        <div class="track" id="gTrack">${Array.from({ length: m.budget }, (_, k) => `<i data-n="${k + 1}"></i>`).join('')}</div>
        <div class="track__key"><span><i style="background:var(--phos)"></i>progress</span><span><i style="background:repeating-linear-gradient(45deg,#dcc4f0 0 3px,rgba(220, 196, 240, .4) 3px 6px)"></i>repeated / recovery</span><span><i style="background:var(--ds-w)"></i>verification</span><span><i style="background:var(--bad)"></i>failure</span></div>
        <div class="rlog" id="gLog"></div>
      </div>
      <div class="debrief" id="gDebrief" hidden></div>`;
    $$('.frag', game).forEach(el => el.addEventListener('click', () => toggle(el.dataset.id)));
    $('#gReset').addEventListener('click', () => { if (running) return; picks = {}; sfx.click(); paint(); });
    $('#gCommit').addEventListener('click', commit);
    paint();
  }

  function toggle(id) {
    if (running || locked) return;
    const f = MISSIONS[cur].frags.find(x => x.id === id);
    if (picks[id]) delete picks[id]; else picks[id] = f.vars[0].k;
    sfx.click(); paint();
  }

  function paint() {
    const m = MISSIONS[cur];
    const used = costOf(m, picks), over = used > m.cap;
    const usedEl = $('#gUsed');
    animateNum(usedEl, parseInt(usedEl.textContent.replace(/,/g, ''), 10) || 0, used, 300, v => Math.round(v).toLocaleString());
    usedEl.classList.toggle('over', over);
    $('#gRatio').textContent = `r = ${(used / m.total * 100).toFixed(1)}%`;
    const bars = $$('#gBar i'), n = Math.round(Math.min(used / m.cap, 1) * bars.length);
    bars.forEach((b, i) => { b.className = i < n ? (over ? 'over' : 'on') : ''; });
    $$('.frag', game).forEach(el => el.classList.toggle('is-in', !!picks[el.dataset.id]));
    const box = $('#gPicked');
    const chosen = m.frags.filter(f => picks[f.id]);
    if (!chosen.length) box.innerHTML = '<div class="picked__empty">Empty capsule.<br>Pick fragments from H<sub>b</sub>. Choose a phrasing for each.<br>Stay under the 10% capacity.</div>';
    else {
      box.innerHTML = chosen.map(f => {
        const v = f.vars.find(x => x.k === picks[f.id]);
        return `<div class="pk" data-id="${f.id}"><div class="pk__top"><span class="pk__txt">${v.t}</span><button class="pk__x" type="button" aria-label="Remove">×</button></div>` +
          (f.vars.length > 1 ? `<div class="pk__vars">${f.vars.map(x => `<button type="button" data-k="${x.k}" class="${x.k === v.k ? 'is-on' : ''}">${x.k.charAt(0) + x.k.slice(1).toLowerCase()} · ${x.c}</button>`).join('')}</div>` : '') + '</div>';
      }).join('');
      $$('.pk', box).forEach(pk => {
        const id = pk.dataset.id;
        $('.pk__x', pk).addEventListener('click', () => toggle(id));
        $$('.pk__vars button', pk).forEach(b => b.addEventListener('click', () => { if (running || locked) return; picks[id] = b.dataset.k; sfx.tick(); paint(); }));
      });
    }
    $('#gCommit').disabled = running || locked || !chosen.length || over;
    $('#gStatus').textContent = over ? 'Over capacity' : chosen.length ? 'Ready to commit' : 'Awaiting M_b';
  }

  async function commit() {
    if (running) return;
    const m = MISSIONS[cur], d = DOM[m.dom];
    const r = simulate(m, picks), used = costOf(m, picks);
    running = true; paint();
    $$('.frag', game).forEach(el => el.classList.add('locked'));
    const runner = $('#gRunner'), log = $('#gLog'), track = $$('#gTrack i'), act = $('#gAct'), deb = $('#gDebrief');
    runner.hidden = false; deb.hidden = true; log.innerHTML = '';
    track.forEach(t => { t.className = ''; t.title = ''; });
    $('#gStatus').textContent = 'Executor running';
    runner.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' });
    const line = (txt, cls = '') => { const el = h('div', cls, null, log); el.textContent = txt; while (log.children.length > 8) log.firstChild.remove(); };
    line(`› load M_b · ${used.toLocaleString()} chars · r = ${(used / m.total * 100).toFixed(1)}%`, 'd');
    line(`› restore boundary state b = ${CB.BND[m.b]} · budget ${m.budget}`, 'd');
    sfx.whir();
    await sleep(REDUCED ? 0 : 600);
    for (let k = 0; k < r.acts.length; k++) {
      const a = r.acts[k];
      track[k].className = a.k; track[k].title = a.t;
      act.textContent = k + 1;
      line(`  ${String(k + 1).padStart(2, '0')} ${a.t}`, a.k === 'ok' ? 'g' : a.k === 'bad' ? 'r' : a.k === 'chk' ? 'b' : '');
      a.k === 'bad' ? sfx.bad() : sfx.tick();
      await sleep(REDUCED ? 0 : 520);
    }
    const ok = r.outcome === 'ok';
    const rank = rankOf(m, r, picks);
    line(ok ? `› task complete · ${r.used}/${m.budget} actions · par ${m.par}` : `› run failed · ${({ early: 'early stop', budget: 'budget exhausted', cgd: 'requirement violated' })[r.outcome]}`, ok ? 'g' : 'r');
    if (ok) sfx.ok(); else sfx.stamp();
    results[m.id] = { ok, rank: rank[0] }; store.set('cb-missions', JSON.stringify(results));
    paintTabs();

    // reveal roles + per-fragment verdicts
    const fr = $('#gFrags'); fr.classList.add('revealed');
    $$('.frag', fr).forEach(el => {
      const n = r.notes[el.dataset.id];
      if (n) $('.frag__role', el).textContent += ` · ${n[1]}`;
    });

    const field = MODELS.map(x => x[m.dom][m.b]);
    const mean = field.reduce((a, b) => a + b, 0) / field.length;
    const best = MODELS.reduce((a, x) => (x[m.dom][m.b] > a[m.dom][m.b] ? x : a));
    deb.hidden = false;
    deb.innerHTML = `
      <div class="stamp ${ok ? 'ok' : 'bad'} slam">${ok ? 'Pass' : 'Fail'}</div>
      <div>
        <div class="debrief__rank"><small>Rank ${rank[0]}</small><h4>${rank[1]}</h4><p>${rank[2]}</p></div>
        <div class="tags">${r.errs.length ? r.errs.map(e => `<span style="--pc:var(--bad)">${e}</span>`).join('') : '<span style="--pc:var(--phos)">No compaction errors</span>'}</div>
        <div class="debrief__grid">
          <div class="dbx"><span>Actions used</span><b>${r.used} / ${m.budget}</b></div>
          <div class="dbx"><span>Capacity used</span><b>${(used / m.cap * 100).toFixed(0)}%</b></div>
          <div class="dbx"><span>Par</span><b>${m.par}${ok ? (r.used <= m.par ? ' ★' : ' +' + (r.used - m.par)) : ''}</b></div>
        </div>
        <div class="field">
          <div class="field__t">Field reference · 12 compactors on ${d.name} at b = ${CB.BND[m.b]} (Table 13) · mean ${mean.toFixed(1)}% · best ${best.n} ${best[m.dom][m.b].toFixed(1)}%</div>
          <div class="field__strip">${field.map((v, i) => `<i style="left:${v}%;height:${(20 + i % 3 * 8)}px" title="${MODELS[i].n} ${v.toFixed(1)}%"></i>`).join('')}<i class="mean" style="left:${mean}%"></i></div>
          <div class="field__ax"><span>0%</span><span>50%</span><span>100%</span></div>
        </div>
        <div class="debrief__btns">
          <button class="btn btn--sm btn--solid" id="gRetry" type="button">Retry mission</button>
          <button class="btn btn--sm" id="gOpt" type="button">Show a par solution</button>
          <button class="btn btn--sm" id="gNext" type="button">Next mission →</button>
          <button class="btn btn--sm" id="gShare" type="button">Copy result</button>
        </div>
      </div>`;
    $('#gRetry').addEventListener('click', () => { sfx.click(); load(cur); });
    $('#gNext').addEventListener('click', () => { sfx.click(); load((cur + 1) % MISSIONS.length); game.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); });
    $('#gOpt').addEventListener('click', () => {
      sfx.click(); load(cur);
      picks = { ...m.opt.picks }; paint();
      toast(`Par ${m.par}: ${m.opt.cost.toLocaleString()} chars. Commit to watch it run.`);
    });
    $('#gShare').addEventListener('click', async () => {
      const txt = `CompAct-Bench · Mission ${m.id} (${d.name}, b = ${CB.BND[m.b]}): ${ok ? 'pass' : 'fail'} in ${r.used}/${m.budget} actions · rank ${rank[0]} “${rank[1]}” · ${location.href.split('#')[0]}#play`;
      toast((await copyText(txt)) ? 'Result copied' : 'Copy failed');
    });
    $('#gStatus').textContent = ok ? 'Mission complete' : 'Mission failed';
    running = false; locked = true;
    $('#gCommit').disabled = true;
    $('#gReset').disabled = true;
  }

  load(0);
})();
