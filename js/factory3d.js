/* Hero · 3D token production line (three.js r149, global build).
   Tokens hop off the H_b pile onto a conveyor; every ten are crushed by the
   compactor press into one M_b block (10%); the block rides into the executor
   terminal, which resumes the task and prints PASS or FAIL, then tosses a
   result card into the matching bin. Outcomes are sampled from the paper's
   mean post-compaction accuracy for each domain × boundary. */
(() => {
  'use strict';
  const CB = window.CB;
  const hero = document.getElementById('top');
  const canvas = document.getElementById('hero3d');
  if (!CB || !hero || !canvas) return;
  const { clamp, lerp, easeIO, rand, DOM, KEYS, BND, REDUCED, avgOf } = CB;
  const T = window.THREE;
  const fail = () => hero.classList.add('no-gl');
  if (!T) { fail(); return; }
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;

  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const BG = 0x081024;
  renderer.setClearColor(BG, 1);

  const scene = new T.Scene();
  scene.fog = new T.Fog(BG, 82, 135);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 240);

  /* ---------- helpers ---------- */
  const redraws = [];
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const run = () => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.clearRect(0, 0, w, h); draw(g, w, h); tex.needsUpdate = true;
    };
    run(); redraws.push(run); tex.redraw = run;
    return tex;
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraws.forEach(f => f()));
  const mStd = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .2 }, o));
  const M = {
    metal: mStd(0x2c2925, { metalness: .5, roughness: .42 }),
    metal2: mStd(0x3d3934, { metalness: .6, roughness: .36 }),
    cream: mStd(0xefe7d6, { roughness: .7, metalness: 0 }),
    beige: mStd(0xd8cfc2, { roughness: .62, metalness: 0 }),
    red: mStd(0xe2381b, { roughness: .42, metalness: .15 }),
    dark: mStd(0x07080b, { roughness: .9, metalness: 0 }),
    steel: mStd(0xbdb6aa, { metalness: .9, roughness: .28 })
  };
  const box = (w, h, d, mat, x, y, z, parent, shadow = true) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    (parent || scene).add(m);
    return m;
  };
  const backOut = t => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };

  /* ---------- layout constants ---------- */
  const BELT_Y = 1.3, BW = 2.6, V = 3.0, TS = .72;
  const PX = 0, CX = 7.8, BS = -5.4, BE = CX - 1.55;
  const P0 = new T.Vector3(BS + 1.4, 0, -5.0);
  const BIN_X = CX + 4.0;

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(0xdfe6ff, 0x0b1430, .55));
  const key = new T.DirectionalLight(0xfff0dc, 1.25);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 22, bottom: -22, near: 1, far: 90 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .03;
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0xff7a3a, .55); rim.position.set(-16, 9, -14); scene.add(rim);
  const pressLight = new T.PointLight(0xffb000, 0, 16, 2); pressLight.position.set(PX, 2.6, 2.2); scene.add(pressLight);
  const screenLight = new T.PointLight(0xffb000, .9, 9, 2); screenLight.position.set(CX + .6, 3.4, 2.2); scene.add(screenLight);

  /* ---------- floor ---------- */
  const floor = new T.Mesh(new T.PlaneGeometry(300, 300), mStd(0x0a1736, { roughness: .95, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new T.GridHelper(300, 150, 0x2f4a8c, 0x182a5c);
  grid.material.transparent = true; grid.material.opacity = .42; grid.position.y = .006; scene.add(grid);
  ['#f5b91d', '#ef7a1c', '#e2381b', '#8a3a1d'].forEach((c, i) => {
    const p = new T.Mesh(new T.PlaneGeometry(BIN_X + 3 - (BS - 4), .2), mStd(c, { roughness: .8, metalness: 0 }));
    p.rotation.x = -Math.PI / 2; p.position.set((BIN_X + 3 + BS - 4) / 2, .012, BW / 2 + 1.0 + i * .2);
    p.receiveShadow = true; scene.add(p);
  });
  const paint = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = 'rgba(239,231,214,.16)';
    g.font = '900 104px Archivo, Helvetica, Arial, sans-serif';
    g.textBaseline = 'middle'; g.fillText('CB-200 · r = 10%', 8, h / 2 + 4);
  });
  const paintMesh = new T.Mesh(new T.PlaneGeometry(13, 1.625), new T.MeshBasicMaterial({ map: paint, transparent: true, depthWrite: false }));
  paintMesh.rotation.x = -Math.PI / 2; paintMesh.position.set(PX + 2.5, .014, BW / 2 + 2.9); scene.add(paintMesh);
  const hazard = canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#16140f'; g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(40, 40, w - 80, h - 80); g.clip('evenodd');
    for (let x = -h; x < w + h; x += 44) { g.fillStyle = '#f5b91d'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22, 0); g.lineTo(x + 22 - h, h); g.lineTo(x - h, h); g.fill(); }
    g.restore();
  });
  const pad = new T.Mesh(new T.PlaneGeometry(7.6, 4.8), mStd(0xffffff, { map: hazard, roughness: .85, metalness: 0 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(PX, .016, 0); pad.receiveShadow = true; scene.add(pad);

  /* ---------- conveyor ---------- */
  const L = BE - BS, MID = (BS + BE) / 2;
  const beltTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#17171b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26262d';
    for (let i = 0; i < 8; i++) { const x = i * 32; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, h / 2); g.lineTo(x, h); g.lineTo(x + 8, h); g.lineTo(x + 22, h / 2); g.lineTo(x + 8, 0); g.fill(); }
  });
  beltTex.wrapS = T.RepeatWrapping; beltTex.repeat.set(L / 2, 1);
  const beltSide = mStd(0x111114, { roughness: .8 });
  const belt = new T.Mesh(new T.BoxGeometry(L, .16, BW), [beltSide, beltSide, mStd(0xffffff, { map: beltTex, roughness: .82, metalness: .1 }), beltSide, beltSide, beltSide]);
  belt.position.set(MID, BELT_Y - .08, 0); belt.receiveShadow = true; scene.add(belt);
  box(L + .6, .46, .24, M.metal2, MID, BELT_Y - .12, BW / 2 + .12);
  box(L + .6, .46, .24, M.metal2, MID, BELT_Y - .12, -BW / 2 - .12);
  box(L, .3, BW, M.dark, MID, BELT_Y - .36, 0, null, false);
  [BS, BE].forEach(x => { const r = new T.Mesh(new T.CylinderGeometry(.22, .22, BW + .1, 20), M.steel); r.rotation.x = Math.PI / 2; r.position.set(x, BELT_Y - .18, 0); scene.add(r); });
  for (let x = BS + .8; x < BE; x += 3.1) [-1, 1].forEach(s => box(.22, BELT_Y - .4, .22, M.metal, x, (BELT_Y - .4) / 2, s * (BW / 2 + .1)));


  /* ---------- tokens ---------- */
  const WORDS = ['search', 'grep', 'Lyons', '1983', 'PhD', 'def', 'sqf', 'spam', 'Line', 'verify', 'y−1', 'Peres', 'PDF', 'TODO', '404', '→', '{ }', 'ok', 'invoice', 'prize', 'AMS', 'diff', 'retry', 'cite'];
  const DCOL = ['#e0601a', '#0f8d67', '#2b62d4'];
  const tokMats = WORDS.map((w, i) => mStd(0xffffff, {
    roughness: .6, metalness: 0,
    map: canvasTex(128, 128, g => {
      g.fillStyle = '#efe7d6'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = DCOL[i % 3]; g.fillRect(0, 106, 128, 22);
      g.strokeStyle = '#191714'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
      g.fillStyle = '#191714'; g.font = `700 ${w.length > 5 ? 28 : w.length > 3 ? 36 : 46}px "JetBrains Mono", monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, 64, 56);
    })
  }));
  const tokGeo = new T.BoxGeometry(TS, TS, TS);
  const pool = [];
  const getTok = () => {
    let m = pool.pop();
    if (!m) { m = new T.Mesh(tokGeo, tokMats[0]); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    m.visible = true; m.material = tokMats[(Math.random() * tokMats.length) | 0];
    m.scale.set(1, 1, 1); m.rotation.set(0, 0, 0);
    return m;
  };
  const putTok = m => { m.visible = false; pool.push(m); };

  // the H_b pile
  for (let i = 0; i < 64; i++) {
    const m = new T.Mesh(tokGeo, tokMats[i % tokMats.length]);
    const r = Math.sqrt(Math.random()) * 2.7, a = Math.random() * Math.PI * 2;
    const hgt = Math.max(0, 1 - r / 2.7) * 2.3;
    m.position.set(P0.x + Math.cos(a) * r, TS / 2 + hgt * (.55 + Math.random() * .45), P0.z + Math.sin(a) * r * .8);
    m.rotation.set(rand(-.5, .5), rand(0, 6.28), rand(-.5, .5));
    m.castShadow = m.receiveShadow = true; scene.add(m);
  }

  /* ---------- press ---------- */
  const pressG = new T.Group(); pressG.position.set(PX, 0, 0); scene.add(pressG);
  box(.55, 7.0, .55, M.metal2, -3.0, 3.5, -1.95, pressG);
  box(.55, 7.0, .55, M.metal2, 3.0, 3.5, -1.95, pressG);
  box(6.8, .72, .82, M.metal, 0, 7.0, -1.95, pressG);
  box(1.3, .6, 2.5, M.metal, 0, 7.0, -.7, pressG);
  const cyl = new T.Mesh(new T.CylinderGeometry(.58, .58, 1.5, 24), M.red); cyl.position.set(0, 6.25, 0); cyl.castShadow = true; pressG.add(cyl);
  const rod = new T.Mesh(new T.CylinderGeometry(.19, .19, 1, 16), M.steel); rod.castShadow = true; pressG.add(rod);
  const head = new T.Group(); pressG.add(head);
  box(4.9, .56, 2.3, M.red, 0, 0, 0, head);
  const stripeTex = canvasTex(512, 32, (g, w, h) => {
    g.fillStyle = '#191714'; g.fillRect(0, 0, w, h);
    for (let x = -h; x < w + h; x += 32) { g.fillStyle = '#f5b91d'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - h, h); g.lineTo(x - h, h); g.fill(); }
  });
  const stripe = new T.Mesh(new T.PlaneGeometry(4.9, .22), new T.MeshStandardMaterial({ map: stripeTex, roughness: .6 }));
  stripe.position.set(0, -.12, 1.152); head.add(stripe);
  const HEAD_H = .56, HEAD_REST = 5.25;
  const HEAD_TOUCH = BELT_Y + TS + HEAD_H / 2, HEAD_HIT = BELT_Y + TS * .2 + HEAD_H / 2;
  const setHead = y => { head.position.y = y; const top = y + HEAD_H / 2, bot = 5.5; rod.scale.y = Math.max(.01, bot - top); rod.position.set(0, (bot + top) / 2, 0); };
  setHead(HEAD_REST);
  const ring = new T.Mesh(new T.RingGeometry(.5, .62, 40), new T.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(PX, BELT_Y + .02, 0); scene.add(ring);

  /* ---------- sparks ---------- */
  const NS = 320;
  const sPos = new Float32Array(NS * 3), sCol = new Float32Array(NS * 3), sVel = new Float32Array(NS * 3), sLife = new Float32Array(NS), sMax = new Float32Array(NS);
  const sGeo = new T.BufferGeometry();
  sGeo.setAttribute('position', new T.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new T.BufferAttribute(sCol, 3));
  const dot = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  scene.add(new T.Points(sGeo, new T.PointsMaterial({ size: 9, sizeAttenuation: false, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })));
  let sIdx = 0;
  const emitSparks = n => {
    for (let k = 0; k < n; k++) {
      const i = sIdx; sIdx = (sIdx + 1) % NS;
      const side = Math.random() < .5 ? -1 : 1;
      sPos[i * 3] = PX + side * rand(1.2, 2.5); sPos[i * 3 + 1] = BELT_Y + .2; sPos[i * 3 + 2] = rand(-1.1, 1.1);
      sVel[i * 3] = side * rand(1, 5.5); sVel[i * 3 + 1] = rand(2, 6.5); sVel[i * 3 + 2] = rand(-1.5, 3.5);
      sMax[i] = sLife[i] = rand(.45, 1.05);
    }
  };
  const stepSparks = dt => {
    for (let i = 0; i < NS; i++) {
      if (sLife[i] <= 0) { sCol[i * 3] = sCol[i * 3 + 1] = sCol[i * 3 + 2] = 0; continue; }
      sLife[i] -= dt;
      sVel[i * 3 + 1] -= 15 * dt;
      sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
      if (sPos[i * 3 + 1] < .05) { sPos[i * 3 + 1] = .05; sVel[i * 3 + 1] *= -.3; sVel[i * 3] *= .6; }
      const f = clamp(sLife[i] / sMax[i], 0, 1);
      sCol[i * 3] = f; sCol[i * 3 + 1] = .7 * f * f; sCol[i * 3 + 2] = .15 * f * f * f;
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.color.needsUpdate = true;
  };

  /* ---------- M_b blocks ---------- */
  const blockLabel = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#ffb000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#191714'; g.fillRect(0, h - 30, w, 30);
    g.font = '700 74px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('M_b', w / 2, h / 2 - 14);
    g.fillStyle = '#ffb000'; g.font = '700 22px "JetBrains Mono", monospace'; g.fillText('r = 10%', w / 2, h - 15);
  });
  const amberSide = new T.MeshStandardMaterial({ color: 0xffb000, emissive: 0xff8a00, emissiveIntensity: .45, roughness: .45 });
  const blockTop = new T.MeshStandardMaterial({ map: blockLabel, emissive: 0xffffff, emissiveMap: blockLabel, emissiveIntensity: .35, roughness: .5 });
  const blockGeo = new T.BoxGeometry(1.25, .5, .92);
  const blockMats = [amberSide, amberSide, blockTop, amberSide, amberSide, amberSide];
  const blocks = [];
  const spawnBlock = combo => {
    const m = new T.Mesh(blockGeo, blockMats); m.castShadow = true;
    m.position.set(PX, BELT_Y + .25, 0); m.scale.setScalar(.01); scene.add(m);
    blocks.push({ m, st: 'pop', t: 0, combo });
  };

  /* ---------- executor terminal ---------- */
  const stats = { pass: 0, fail: 0 };
  const combos = []; KEYS.forEach(d => [0, 1, 2].forEach(b => combos.push([d, b])));
  let comboI = (Math.random() * combos.length) | 0;
  const scr = { mode: 'idle', k: 0, B: 10, plan: { ok: true, early: false, k: 0 }, combo: combos[comboI], blink: true };
  const VT = '"VT323", "JetBrains Mono", monospace';
  const scrTex = canvasTex(512, 376, (g, w, h) => {
    g.fillStyle = '#0d0c08'; g.fillRect(0, 0, w, h);
    const amber = '#ffb000', dim = 'rgba(255,176,0,.55)';
    const [d, b] = scr.combo;
    g.fillStyle = dim; g.font = `26px ${VT}`;
    g.fillText(`EXECUTOR · ${DOM[d].bench.toUpperCase()} · b=${BND[b]}`, 26, 40);
    g.fillRect(26, 52, w - 52, 2);
    if (scr.mode === 'idle') {
      g.fillStyle = amber; g.font = `72px ${VT}`; g.fillText('READY' + (scr.blink ? '_' : ''), 26, 146);
      g.fillStyle = dim; g.font = `32px ${VT}`; g.fillText('AWAITING M_b ...', 26, 196);
      g.fillStyle = amber; g.fillText(`PASS ${String(stats.pass).padStart(3, '0')}   FAIL ${String(stats.fail).padStart(3, '0')}`, 26, 330);
    } else if (scr.mode === 'run') {
      g.fillStyle = amber; g.font = `32px ${VT}`;
      g.fillText('> LOAD M_b ............ OK', 26, 96);
      g.fillText(`> RESTORE STATE AT b=${BND[b]}`, 26, 130);
      g.fillText(`> RESUME · BUDGET T-b = ${scr.B}`, 26, 164);
      const gap = 6, cw = (w - 52 - (scr.B - 1) * gap) / scr.B, pl = scr.plan;
      for (let i = 0; i < scr.B; i++) {
        let col = 'rgba(255,176,0,.14)';
        if (i < scr.k) {
          if (pl.ok) col = '#8dff5a';
          else if (i === pl.k - 1 && scr.k >= pl.k) col = '#ff4d2e';
          else col = (!pl.early && i % 3 === 2) ? '#ff9147' : '#ffb000';
        }
        g.fillStyle = col; g.fillRect(26 + i * (cw + gap), 192, cw, 50);
      }
      g.fillStyle = amber; g.font = `46px ${VT}`;
      g.fillText(`ACTIONS ${String(scr.k).padStart(2, '0')} / ${scr.B}`, 26, 310);
    } else {
      const ok = scr.plan.ok, col = ok ? '#8dff5a' : '#ff4d2e';
      g.strokeStyle = col; g.lineWidth = 26; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      if (ok) { g.moveTo(186, 168); g.lineTo(236, 218); g.lineTo(330, 110); }
      else { g.moveTo(196, 102); g.lineTo(316, 222); g.moveTo(316, 102); g.lineTo(196, 222); }
      g.stroke();
      g.fillStyle = col; g.font = `48px ${VT}`; g.textAlign = 'center';
      g.fillText(ok ? 'PASS · TASK COMPLETE' : (scr.plan.early ? 'FAIL · EARLY STOP' : 'FAIL · BUDGET OUT'), w / 2, 316);
    }
    g.fillStyle = 'rgba(0,0,0,.28)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    const vg = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .9);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });

  const comp = new T.Group(); comp.position.set(CX, 0, 0); scene.add(comp);
  box(3.0, 2.0, 3.0, M.beige, 0, 1.0, 0, comp);
  box(.06, .78, 1.45, M.dark, -1.51, BELT_Y + .3, 0, comp, false);
  box(.06, .42, 1.1, M.dark, 1.51, 1.12, .5, comp, false);
  box(1.1, .08, .02, M.dark, -.5, 1.45, 1.51, comp, false);
  for (let i = 0; i < 5; i++) box(1.0, .05, .02, M.metal2, .7, .45 + i * .15, 1.51, comp, false);
  const ledMat = new T.MeshBasicMaterial({ color: 0x8dff5a, toneMapped: false });
  const led = new T.Mesh(new T.SphereGeometry(.08, 10, 8), ledMat); led.position.set(-1.1, 1.7, 1.52); comp.add(led);
  const mon = new T.Group(); mon.position.set(0, 2.0, -.3); mon.rotation.y = .4; comp.add(mon);
  box(1.3, .14, 1.1, M.beige, 0, .07, .1, mon);
  box(.5, .3, .4, M.beige, 0, .3, .1, mon);
  box(2.9, 2.3, 2.1, M.beige, 0, 1.6, 0, mon);
  box(2.56, 1.96, .1, M.metal, 0, 1.64, 1.04, mon, false);
  const screen = new T.Mesh(new T.PlaneGeometry(2.24, 1.64), new T.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  screen.position.set(0, 1.64, 1.1); mon.add(screen);
  const kb = box(2.4, .16, .78, M.cream, .3, 2.08, 1.08, comp); kb.rotation.y = .4;
  for (let r = 0; r < 3; r++) { const k = box(2.1, .03, .13, M.metal2, 0, .095, -.22 + r * .22, kb, false); k.castShadow = false; }

  /* result sprites */
  const glyph = ok => canvasTex(256, 256, g => {
    g.fillStyle = ok ? '#8dff5a' : '#ff4d2e'; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#0d0c08'; g.stroke();
    g.strokeStyle = '#0d0c08'; g.lineWidth = 30; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    if (ok) { g.moveTo(74, 132); g.lineTo(112, 172); g.lineTo(184, 88); } else { g.moveTo(84, 84); g.lineTo(172, 172); g.moveTo(172, 84); g.lineTo(84, 172); }
    g.stroke();
  });
  const mkSprite = ok => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glyph(ok), transparent: true, depthTest: false, toneMapped: false }));
    s.visible = false; s.renderOrder = 10; scene.add(s);
    return { s, t: 9 };
  };
  const spriteOK = mkSprite(true), spriteBad = mkSprite(false);
  const SPRITE_POS = new T.Vector3(CX + 2.6, 4.6, .8);

  /* bins + cards */
  const mkBin = (z, col) => {
    const g = new T.Group(); g.position.set(BIN_X, 0, z); scene.add(g);
    box(1.9, .1, 1.7, M.metal2, 0, .05, 0, g);
    box(1.9, 1.0, .1, M.metal2, 0, .5, -.8, g);
    box(1.9, .45, .1, M.metal2, 0, .225, .8, g);
    box(.1, 1.0, 1.7, M.metal2, -.9, .5, 0, g);
    box(.1, 1.0, 1.7, M.metal2, .9, .5, 0, g);
    box(2.0, .1, .12, mStd(col, { emissive: col, emissiveIntensity: .25 }), 0, .47, .84, g);
    return { g, stack: [] };
  };
  const binOK = mkBin(-1.2, 0x0f8d67), binBad = mkBin(1.2, 0xe2381b);
  const cardGeo = new T.BoxGeometry(.95, .12, .7);
  const cardOK = mStd(0x2fc48a, { emissive: 0x0f8d67, emissiveIntensity: .35 }), cardBad = mStd(0xe2381b, { emissive: 0xe2381b, emissiveIntensity: .3 });
  const flying = [];
  const ejectCard = ok => {
    const bin = ok ? binOK : binBad;
    if (bin.stack.length >= 8) { bin.stack.forEach(m => { scene.remove(m); }); bin.stack.length = 0; }
    const m = new T.Mesh(cardGeo, ok ? cardOK : cardBad); m.castShadow = true;
    const from = new T.Vector3(CX + 1.6, 1.12, .5);
    const to = new T.Vector3(BIN_X + rand(-.15, .15), .16 + bin.stack.length * .13, bin.g.position.z + rand(-.12, .12));
    m.position.copy(from); scene.add(m);
    flying.push({ m, from, to, t: 0, bin, spin: rand(-.4, .4) });
  };

  /* ---------- telemetry + tags ---------- */
  const tmPhase = document.getElementById('tmPhase'), tmHb = document.getElementById('tmHb'), tmMb = document.getElementById('tmMb');
  const binTxt = document.getElementById('tagBinsTxt');
  let phaseTxt = '';
  const setPhase = (txt, combo) => {
    const [d, b] = combo;
    const s = `${txt} · ${DOM[d].name.toUpperCase()} b=${BND[b]}`;
    if (tmPhase && s !== phaseTxt) { tmPhase.textContent = s; phaseTxt = s; }
    if (tmHb) tmHb.textContent = DOM[d].tok[b].toFixed(1) + 'K';
    if (tmMb) tmMb.textContent = (DOM[d].tok[b] * .1).toFixed(2) + 'K';
  };
  const updateBins = () => {
    const n = stats.pass + stats.fail;
    if (binTxt) binTxt.textContent = `PASS ${stats.pass} · FAIL ${stats.fail}` + (n ? ` · Acc ${(stats.pass / n * 100).toFixed(0)}%` : '');
  };
  const tags = [['tagPile', [P0.x, 3.8, P0.z]], ['tagPress', [PX, 7.7, -1.95]], ['tagComp', [CX - .2, 5.2, -.4]], ['tagBins', [BIN_X, 1.9, 0]]]
    .map(([id, p]) => ({ el: document.getElementById(id), v: new T.Vector3(...p) }));
  const tv = new T.Vector3();

  /* ---------- simulation ---------- */
  const SLOT = c => PX - 1.84 + c * .92;
  const ROWZ = [-.5, .5];
  const batches = [];
  let spawner = null, sim = 0, shake = 0;
  const newBatch = () => {
    comboI = (comboI + 1) % combos.length;
    const b = { toks: [], arrived: 0, pressed: false, combo: combos[comboI] };
    batches.push(b); spawner = { b, i: 0, next: sim };
    setPhase('TOKENS → BELT', b.combo);
  };
  const press = { st: 'idle', t: 0, b: null, hit: false, made: false };
  const compS = { st: 'idle', t: 0, blinkT: 0 };

  const compStart = combo => {
    const p = avgOf(combo[0], combo[1]) / 100;
    const ok = Math.random() < p, early = !ok && Math.random() < .35;
    const B = 10, k = ok ? 4 + ((Math.random() * 5) | 0) : early ? 2 + ((Math.random() * 3) | 0) : B;
    Object.assign(scr, { combo, plan: { ok, early, k }, B, k: 0, mode: 'run' });
    compS.st = 'run'; compS.t = 0; scrTex.redraw();
    setPhase('EXECUTOR RESUMING', combo);
  };

  const step = dt => {
    sim += dt;
    beltTex.offset.x -= V * dt / 2;

    // spawn tokens from the pile
    if (spawner && sim >= spawner.next) {
      const i = spawner.i++, col = 4 - (i >> 1), row = i & 1;
      const m = getTok();
      const from = new T.Vector3(P0.x + rand(-.5, .5), 2.4 + rand(0, .3), P0.z + rand(-.3, .3));
      const to = new T.Vector3(BS + 1.2 + rand(0, .6), BELT_Y + TS / 2, ROWZ[row]);
      m.position.copy(from);
      spawner.b.toks.push({ m, st: 'walk', t: 0, dur: 1.3 + rand(0, .18), from, to, slotX: SLOT(col), z: ROWZ[row], spin: rand(-1, 1) });
      spawner.next = sim + .28;
      if (spawner.i >= 10) spawner = null;
    }

    // tokens: hop, then ride
    for (const b of batches) for (const k of b.toks) {
      const p = k.m.position;
      if (k.st === 'walk') {
        k.t += dt;
        const u = Math.min(1, k.t / k.dur), hp = u * 3, f = hp % 1;
        p.x = lerp(k.from.x, k.to.x, u); p.z = lerp(k.from.z, k.to.z, u);
        p.y = lerp(k.from.y, k.to.y, u) + Math.sin(f * Math.PI) * (1.0 - u * .35);
        const sq = u < 1 ? Math.pow(Math.abs(Math.cos(f * Math.PI)), 10) : 0;
        k.m.scale.set(1 + sq * .22, 1 - sq * .3, 1 + sq * .22);
        k.m.rotation.y = k.spin * Math.sin(u * Math.PI) * 1.1;
        k.m.rotation.z = Math.sin(hp * Math.PI * 2) * .12 * (1 - u);
        if (u >= 1) { k.st = 'ride'; k.m.scale.set(1, 1, 1); k.m.rotation.set(0, 0, 0); p.copy(k.to); }
      } else if (k.st === 'ride') {
        p.x += V * dt; p.y = BELT_Y + TS / 2;
        if (p.x >= k.slotX) { p.x = k.slotX; k.st = 'wait'; b.arrived++; }
      }
    }

    // press
    if (press.st === 'idle') {
      const b = batches.find(x => !x.pressed && x.arrived === 10);
      if (b) { b.pressed = true; Object.assign(press, { st: 'run', t: 0, b, hit: false, made: false }); newBatch(); setPhase('COMPACT 10 → 1', b.combo); }
    } else {
      press.t += dt;
      const t = press.t, b = press.b;
      if (t < .32) setHead(lerp(HEAD_REST, HEAD_TOUCH, Math.pow(t / .32, 2.4)));
      else if (t < .5) {
        const k = easeIO((t - .32) / .18);
        setHead(lerp(HEAD_TOUCH, HEAD_HIT, k));
        if (!press.hit) {
          press.hit = true; emitSparks(120); pressLight.intensity = 6; shake = .16;
          ring.scale.setScalar(1); ring.material.opacity = 1; ring.userData.t = 0;
        }
        b.toks.forEach(tk => {
          const s = lerp(1, .2, k), q = tk.m.position;
          tk.m.scale.set(lerp(1, .92, k), s, lerp(1, .92, k));
          q.y = BELT_Y + TS * s / 2;
          q.x = lerp(tk.slotX, PX + (tk.slotX - PX) * .22, k);
          q.z = lerp(tk.z, tk.z * .3, k);
        });
      } else {
        if (!press.made) {
          press.made = true;
          b.toks.forEach(tk => putTok(tk.m)); b.toks.length = 0;
          batches.splice(batches.indexOf(b), 1);
          spawnBlock(b.combo);
        }
        setHead(lerp(HEAD_HIT, HEAD_REST, easeIO(Math.min(1, (t - .5) / 1.1))));
        if (t >= 1.65) { press.st = 'idle'; press.b = null; }
      }
    }
    pressLight.intensity = Math.max(0, pressLight.intensity - dt * 14);
    if (ring.material.opacity > 0) {
      ring.userData.t = (ring.userData.t || 0) + dt;
      const u = ring.userData.t / .55;
      ring.scale.setScalar(1 + u * 7); ring.material.opacity = Math.max(0, 1 - u);
    }

    // blocks
    let qi = 0;
    for (let i = 0; i < blocks.length; i++) {
      const bl = blocks[i], p = bl.m.position;
      bl.t += dt;
      if (bl.st === 'pop') {
        bl.m.scale.setScalar(Math.max(.01, backOut(Math.min(1, bl.t / .38))));
        if (bl.t >= .38) { bl.st = 'ride'; bl.m.scale.setScalar(1); }
      }
      if (bl.st === 'ride' || bl.st === 'pop') {
        if (bl.t > .25) p.x += V * dt;
        const stop = BE - .75 - qi * 1.5;
        if (p.x >= stop) {
          p.x = stop;
          if (qi === 0 && compS.st === 'idle') { bl.st = 'in'; bl.t = 0; bl.x0 = p.x; }
        }
        qi++;
      } else if (bl.st === 'in') {
        const u = Math.min(1, bl.t / .5);
        p.x = lerp(bl.x0, CX - .9, easeIO(u));
        bl.m.scale.setScalar(lerp(1, .7, u));
        if (u >= 1) { scene.remove(bl.m); blocks.splice(i, 1); i--; compStart(bl.combo); }
      }
    }

    // terminal
    if (compS.st === 'run') {
      compS.t += dt;
      const k = Math.min(scr.plan.k, Math.floor(clamp(compS.t / 1.9, 0, 1) * scr.plan.k + 1e-6));
      if (k !== scr.k) { scr.k = k; scrTex.redraw(); }
      if (compS.t >= 2.15) {
        const ok = scr.plan.ok;
        compS.st = 'result'; compS.t = 0; scr.mode = 'result'; scrTex.redraw();
        if (ok) stats.pass++; else stats.fail++;
        updateBins();
        const sp = ok ? spriteOK : spriteBad; sp.t = 0; sp.s.visible = true;
        ejectCard(ok);
        ledMat.color.setHex(ok ? 0x8dff5a : 0xff4d2e);
        screenLight.color.setHex(ok ? 0x8dff5a : 0xff4d2e);
        setPhase(ok ? 'PASS ✓' : (scr.plan.early ? 'FAIL ✗ EARLY STOP' : 'FAIL ✗ BUDGET OUT'), scr.combo);
      }
    } else if (compS.st === 'result') {
      compS.t += dt;
      if (compS.t >= 1.7) { compS.st = 'idle'; scr.mode = 'idle'; scrTex.redraw(); ledMat.color.setHex(0x8dff5a); screenLight.color.setHex(0xffb000); }
    } else {
      compS.blinkT += dt;
      if (compS.blinkT > .5) { compS.blinkT = 0; scr.blink = !scr.blink; scrTex.redraw(); }
    }
    screenLight.intensity = .7 + (compS.st === 'run' ? Math.sin(sim * 30) * .15 + .3 : 0);

    // result sprites
    [spriteOK, spriteBad].forEach(sp => {
      if (!sp.s.visible) return;
      sp.t += dt;
      const u = sp.t / 1.6;
      const sc = 2.6 * backOut(Math.min(1, sp.t / .35));
      sp.s.scale.set(sc, sc, 1);
      sp.s.position.copy(SPRITE_POS); sp.s.position.y += u * 1.6;
      sp.s.material.opacity = 1 - clamp((u - .6) / .4, 0, 1);
      if (u >= 1) sp.s.visible = false;
    });

    // cards
    for (let i = 0; i < flying.length; i++) {
      const c = flying[i];
      c.t += dt;
      const u = Math.min(1, c.t / .85);
      c.m.position.lerpVectors(c.from, c.to, u);
      c.m.position.y += Math.sin(u * Math.PI) * 1.8;
      c.m.rotation.x = u * Math.PI * 2; c.m.rotation.y = c.spin * u;
      if (u >= 1) { c.m.rotation.set(0, c.spin, 0); c.bin.stack.push(c.m); flying.splice(i, 1); i--; }
    }

    stepSparks(dt);
  };

  /* ---------- camera / layout ---------- */
  const DIR = new T.Vector3(.3, .62, 1).normalize(), DIST = 80;
  const FOCUS_X = (PX - 3 + BIN_X + 1.4) / 2;
  const base = new T.Vector3(), aimT = new T.Vector3(), camR = new T.Vector3(), camU = new T.Vector3();
  let W = 1, H = 1, hw = 1, hh = 1, mobile = false;
  const aim = t => { camera.position.copy(t).addScaledVector(DIR, DIST); camera.lookAt(t); camera.updateMatrixWorld(); };
  const layout = () => {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    const aspect = W / H;
    mobile = aspect < 1;
    const viewH = mobile ? 21 / aspect : Math.max(18.5, 31 / aspect);
    const want = mobile ? { x: 0, y: -.5 } : { x: .44, y: -.16 };
    hh = viewH / 2; hw = hh * aspect;
    Object.assign(camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    camera.updateProjectionMatrix();
    base.set(FOCUS_X, BELT_Y, 0);
    for (let k = 0; k < 2; k++) {
      aim(base);
      tv.set(FOCUS_X, BELT_Y, 0).project(camera);
      camR.setFromMatrixColumn(camera.matrixWorld, 0);
      camU.setFromMatrixColumn(camera.matrixWorld, 1);
      base.addScaledVector(camR, (tv.x - want.x) * hw).addScaledVector(camU, (tv.y - want.y) * hh);
    }
    aim(base);
    key.position.copy(base).add(tv.set(10, 24, 15));
    key.target.position.copy(base);
  };
  layout();
  window.addEventListener('resize', layout);

  let mx = 0, my = 0, tx = 0, ty = 0;
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width * 2 - 1; ty = (e.clientY - r.top) / r.height * 2 - 1;
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  const placeTags = () => {
    const minX = W * .5;
    tags.forEach(t => {
      if (!t.el) return;
      tv.copy(t.v).project(camera);
      const x = (tv.x * .5 + .5) * W, y = (-tv.y * .5 + .5) * H;
      const on = !mobile && x > minX && x < W - 30 && y > 90 && y < H - 150;
      t.el.style.left = x.toFixed(1) + 'px'; t.el.style.top = (y - 14).toFixed(1) + 'px';
      t.el.classList.toggle('on', on);
    });
  };

  const render = () => {
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    aimT.copy(base);
    if (shake > 0) { aimT.x += rand(-1, 1) * shake; aimT.y += rand(-1, 1) * shake; }
    camera.position.copy(aimT).addScaledVector(DIR, DIST).addScaledVector(camR, mx * 3).addScaledVector(camU, -my * 2);
    camera.lookAt(aimT);
    const sp = clamp(window.scrollY / H, 0, 1.2);
    canvas.style.opacity = String(clamp(1 - (sp - .55) * 1.8, 0, 1));
    renderer.render(scene, camera);
    placeTags();
  };

  // pre-warm so the line is already busy on first paint
  newBatch(); updateBins();
  for (let i = 0; i < 420; i++) step(1 / 30);
  shake = 0; pressLight.intensity = 0;

  if (REDUCED) {
    render();
    window.addEventListener('resize', () => render());
    return;
  }
  let visible = true, last = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (visible && !document.hidden) {
      step(dt);
      shake = Math.max(0, shake - dt * .8);
      render();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
