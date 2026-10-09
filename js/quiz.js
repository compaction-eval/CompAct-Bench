/* §7 · Which compactor are you? Answers accumulate a Search / Coding /
   Workspace vector that is matched against the z-scored Table 2 profiles. */
(() => {
  'use strict';
  const CB = window.CB;
  if (!CB) return;
  const { $, $$, h, sfx, sleep, toast, copyText, MODELS, REDUCED } = CB;
  const box = $('#quizBox');
  if (!box) return;

  const Q = [
    ['Your laptop dies mid-task. Before rebooting, you scribble one sticky note. It says:', [
      ['Every link I opened, and what each one ruled out.', [2, 0, 0]],
      ['“See git diff.” The work is already on disk.', [-1, 2, 0]],
      ['Which files I touched and who is waiting on what.', [0, 0, 2]],
      ['Nothing. I will remember.', [-1, -1, -1]]]],
    ['A colleague asks how the investigation is going. You say:', [
      ['Here is what is confirmed, and here is what is still a hunch.', [2, 0, 1]],
      ['It is solved. Probably.', [-2, 0, -1]],
      ['The failing test tells the whole story.', [0, 2, 0]],
      ['Let me pull up the status board.', [0, 0, 2]]]],
    ['Packing a carry-on for ten days:', [
      ['Write a full list, then cut it by 90%.', [1, 1, 1]],
      ['Essentials only. Everything else exists at the destination.', [-1, 2, -1]],
      ['Everything, then sit on the suitcase.', [0, -1, -1]],
      ['Labeled pouches per day, per meeting, per city.', [0, 0, 2]]]],
    ['Your detective notebook is mostly:', [
      ['Dead ends, crossed out, each with the reason.', [2, 1, 0]],
      ['One name, circled twice.', [-1, -1, -1]],
      ['A sketch of the crime scene as it is right now.', [0, 2, 1]],
      ['A table of suspects, alibis and deadlines.', [1, 0, 2]]]],
    ['You must turn a 300-page report into one page. You keep:', [
      ['The open questions, and the evidence behind each.', [2, 0, 1]],
      ['The conclusions. Nobody reads the rest.', [-1, 1, -1]],
      ['Pointers: the page where each answer lives.', [0, 2, 0]],
      ['Every deadline and every stakeholder.', [0, 0, 2]]]],
    ['Pick a superpower:', [
      ['Never repeat a failed search.', [2, 0, 0]],
      ['Leave every codebase better than you found it.', [0, 2, 0]],
      ['Juggle twenty tabs and five tools without dropping one.', [0, 0, 2]],
      ['Answer first, verify later.', [-1, 0, -1]]]]
  ];
  const AX = ['s', 'c', 'w'], AXN = { s: 'Search', c: 'Coding', w: 'Workspace' }, AXC = { s: 'var(--d-s)', c: 'var(--d-c)', w: 'var(--d-w)' };
  const ARCH = {
    s: ['The Archivist', 'You keep the evidence trail alive: what was searched, what was ruled out, and what is still only a hunch.'],
    c: ['The Engineer', 'You trust what is persisted. If it is on disk, you leave a pointer instead of a copy.'],
    w: ['The Operator', 'You track state across many moving parts: files, people, deadlines and tools.']
  };
  const stats = AX.map(a => {
    const v = MODELS.map(m => m[a][3]);
    const mu = v.reduce((x, y) => x + y, 0) / v.length;
    const sd = Math.sqrt(v.reduce((x, y) => x + (y - mu) ** 2, 0) / v.length);
    return { mu, sd };
  });
  const Z = MODELS.map(m => AX.map((a, i) => (m[a][3] - stats[i].mu) / stats[i].sd));
  const rankIn = (a, m) => [...MODELS].sort((x, y) => y[a][3] - x[a][3]).indexOf(m) + 1;

  let step = 0, vec = [0, 0, 0], busy = false;

  const patchSVG = '<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" stroke="#faf9f5" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function intro() {
    box.innerHTML = `
      <div class="panel__hd"><span class="panel__id">Quiz</span><span class="panel__t">What kind of compactor are you?</span><span class="panel__st">6 questions</span></div>
      <div class="qz__body">
        <div><div class="qz__n">Intro</div><h3 class="qz__q">Before the context window fills up, every agent needs someone to decide what survives. Let’s find out what kind of compactor you would be.</h3></div>
        <div class="qz__opts"><button class="qz__opt" id="qzGo" type="button"><b>→</b><span>Begin</span></button>
        <p class="qz__note">Your answers stay in this browser. Matching uses the Search / Coding / Workspace accuracies from Table 2, z-scored across the 12 compactors.</p></div>
      </div>`;
    $('#qzGo').addEventListener('click', () => { sfx.click(); step = 0; vec = [0, 0, 0]; ask(); });
  }

  function ask() {
    const [q, opts] = Q[step];
    box.innerHTML = `
      <div class="panel__hd"><span class="panel__id">Quiz</span><span class="panel__t">Question ${step + 1} of ${Q.length}</span><span class="panel__st">${Math.round(step / Q.length * 100)}% done</span></div>
      <div class="qz__prog">${Q.map((_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>
      <div class="qz__body">
        <div><div class="qz__n">${step + 1}.</div><h3 class="qz__q">${q}</h3></div>
        <div class="qz__opts">${opts.map((o, i) => `<button class="qz__opt" type="button" data-i="${i}"><b>${'ABCD'[i]}</b><span>${o[0]}</span></button>`).join('')}</div>
      </div>`;
    $$('.qz__opt', box).forEach(b => b.addEventListener('click', async () => {
      if (busy) return; busy = true;
      b.classList.add('pick'); sfx.tick();
      const w = opts[+b.dataset.i][1];
      vec = vec.map((v, i) => v + w[i]);
      await sleep(REDUCED ? 0 : 320);
      busy = false; step++;
      step < Q.length ? ask() : result();
    }));
  }

  function result() {
    const u = vec.map(v => v / 3);
    const dist = Z.map(z => Math.hypot(z[0] - u[0], z[1] - u[1], z[2] - u[2]));
    const order = dist.map((d, i) => [d, i]).sort((a, b) => a[0] - b[0]);
    const mi = order[0][1], m = MODELS[mi], z = Z[mi], alt = MODELS[order[1][1]];
    const match = Math.round(Math.max(52, 100 - order[0][0] * 18));
    const bestAx = AX[z.indexOf(Math.max(...z))], worstAx = AX[z.indexOf(Math.min(...z))];
    const [arch, archLine] = ARCH[bestAx];
    const id = (mi * 7919 + vec.reduce((a, v) => a * 31 + v + 7, 3)).toString(16).toUpperCase().slice(-5).padStart(5, '0');
    sfx.ok();
    box.innerHTML = `
      <div class="panel__hd"><span class="panel__id">Quiz</span><span class="panel__t">Your result</span><span class="panel__st"><i class="led on"></i>Match found</span></div>
      <div class="qz__res">
        <div class="badge3d" id="qzBadge">
          <div class="badge">
            <div class="badge__top"><span>CompAct-Bench<br>Compactor profile</span>${patchSVG}</div>
            <div class="badge__stripes"></div>
            <div class="badge__body">
              <small>You compact like</small>
              <div class="badge__name">${m.n}</div>
              <div class="badge__cfg">reasoning: ${m.cfg} · overall ${m.o.toFixed(1)}%</div>
              <div class="badge__arch">${arch}</div>
              <div class="badge__photo"><svg viewBox="0 0 200 92" aria-hidden="true">
                <rect x="1" y="1" width="198" height="90" rx="14" fill="#f0eee6"/>
                ${Array.from({ length: 10 }, (_, i) => `<rect x="${16 + i * 12}" y="${30 - (i % 3) * 4}" width="9" height="${22 + (i % 3) * 8}" rx="2.5" fill="${['#d97757', '#788c5d', '#6a9bcc'][i % 3]}" opacity=".55"/>`).join('')}
                <path d="M140 46 h10" stroke="#73726c" stroke-width="1.6" stroke-linecap="round"/><path d="M147 42 l4 4 -4 4" fill="none" stroke="#73726c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="160" y="36" width="22" height="20" rx="4" fill="${AXC[bestAx].replace('var(--d-s)', '#d97757').replace('var(--d-c)', '#788c5d').replace('var(--d-w)', '#6a9bcc')}"/>
                <text x="16" y="80" font-family="Source Serif 4, Georgia, serif" font-style="italic" font-size="12" fill="#3d3d3a">10 tokens in, 1 out · r = 10%</text>
              </svg></div>
              <div class="badge__bars">${AX.map(a => `<div class="bbar"><span>${AXN[a]}</span><i><s style="--bc:${AXC[a]};background:${AXC[a]}" data-w="${m[a][3]}"></s></i><b>${m[a][3].toFixed(1)}</b></div>`).join('')}</div>
            </div>
            <div class="badge__foot"><span>No. ${id}</span><span>${match}% match</span></div>
          </div>
        </div>
        <div class="qz__rtext">
          <h3>${arch}.</h3>
          <p>${archLine}</p>
          <p>Your closest profile is <b>${m.n} (${m.cfg})</b>: strongest on <b>${AXN[bestAx]}</b> relative to the field (${m[bestAx][3].toFixed(1)}%, #${rankIn(bestAx, m)} of 12), and comparatively weaker on <b>${AXN[worstAx]}</b> (${m[worstAx][3].toFixed(1)}%). Overall post-compaction accuracy: <b>${m.o.toFixed(1)}%</b>.</p>
          <div class="qz__alt">Runner-up: <b>${alt.n} (${alt.cfg})</b> · your vector S ${vec[0] >= 0 ? '+' : ''}${vec[0]} / C ${vec[1] >= 0 ? '+' : ''}${vec[1]} / W ${vec[2] >= 0 ? '+' : ''}${vec[2]}</div>
          <div class="btns">
            <button class="btn btn--sm btn--solid" id="qzShare" type="button">Copy my result</button>
            <button class="btn btn--sm" id="qzAgain" type="button">Retake</button>
            <a class="btn btn--sm" href="#play">Now try the real seat →</a>
          </div>
          <p class="qz__note">For fun only. Profiles reflect one benchmark at one retention ratio, not general model quality.</p>
        </div>
      </div>`;
    requestAnimationFrame(() => setTimeout(() => $$('.bbar s', box).forEach(s => { s.style.width = s.dataset.w + '%'; }), 50));
    const badge = $('#qzBadge');
    badge.addEventListener('mousemove', e => {
      const r = badge.getBoundingClientRect();
      badge.style.setProperty('--bry', ((e.clientX - r.left) / r.width * 2 - 1) * 12 + 'deg');
      badge.style.setProperty('--brx', -((e.clientY - r.top) / r.height * 2 - 1) * 10 + 'deg');
    });
    badge.addEventListener('mouseleave', () => { badge.style.setProperty('--bry', '0deg'); badge.style.setProperty('--brx', '0deg'); });
    $('#qzAgain').addEventListener('click', () => { sfx.click(); step = 0; vec = [0, 0, 0]; ask(); });
    $('#qzShare').addEventListener('click', async () => {
      const txt = `I compact like ${m.n} (${m.cfg}): ${arch} · match ${match}% · CompAct-Bench ${location.href.split('#')[0]}#quiz`;
      toast((await copyText(txt)) ? 'Result copied' : 'Copy failed');
    });
  }

  intro();
})();
