import * as THREE from 'three';
import { clamp, lerp, smooth, win, hx, mix3, v3, mulberry32, makeNoise, mkHash, nearest, type RGB, type Pt } from './util';
import { lam, facet, GLOW_PALE } from './figures';

const PRE = ['Elm', 'Ash', 'Birch', 'Wren', 'Lark', 'Fen', 'Rowan', 'Alder', 'Heath', 'Holly', 'Marl', 'Thorn'];
const SUF = ['brook', 'ford', 'mere', 'wick', 'stead', 'combe', 'holt', 'well'];
const LAKES = ['Lake Orsa', 'Lake Imra', 'Velde Tarn', 'Lake Senn', 'Holm Tarn', 'Lake Avel', 'Grey Tarn', 'Lake Morrin'];
const LODGES = ['The Hollow Lodge', 'The Old Mill Lodge', 'The Larch House', 'The Stag and Lantern', 'The Waymark Inn', 'The Valley House'];

export interface Blocker { x: number; z: number; r: number }

/**
 * Grows the whole valley from one seed: terrain, creek, lake, forest, village with its lodge,
 * the trail and its waymarks, a forgotten logging site, and the sky.
 */
export function buildWorld(seed: number, scene: THREE.Scene) {
  const noise = makeNoise(seed), rnd = mulberry32(seed * 7 + 13);
  const fbm = (x: number, y: number, o: number) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  const ridged = (x: number, y: number, o: number) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { let v = 1 - Math.abs(noise(x * f + i * 17.1, y * f - i * 9.3)); v *= v; s += a * v; n += a; a *= 0.5; f *= 2.1; } return s / n; };
  const s1 = rnd() * 6.28, s2 = rnd() * 6.28;
  const valleyX = (z: number) => 35 * Math.sin(z / 110 + s1) + 15 * Math.sin(z / 47 + s2);
  const town = PRE[Math.floor(rnd() * PRE.length)] + SUF[Math.floor(rnd() * SUF.length)];
  const lakeName = LAKES[Math.floor(rnd() * LAKES.length)];
  const lodgeName = LODGES[Math.floor(rnd() * LODGES.length)];
  const LAKE = { x: valleyX(160) + 28, z: 160 };
  const TOWN = { x: valleyX(-238), z: -238, h: 0 };

  /* the trail, independent of terrain */
  const ctrl: THREE.Vector3[] = [];
  for (let k = 0; k <= 26; k++) {
    const z = lerp(-226, 128, k / 26);
    const off = 6 * Math.sin(z / 23 + s2) + 78 * Math.exp(-Math.pow((z + 10) / 75, 2));
    ctrl.push(new THREE.Vector3(valleyX(z) + off, 0, z));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const M = 1400;
  const T = curve.getSpacedPoints(M - 1) as (THREE.Vector3 & { i: number })[];
  T.forEach((p, i) => { p.i = i; });
  const L = curve.getLength();

  /* the creek crosses the trail early on and feeds the lake */
  const cp = T[Math.floor(0.12 * (M - 1))];
  const cOff = cp.x - valleyX(cp.z), cZ = cp.z;
  const streamX = (z: number) => lerp(valleyX(z) + cOff + 9 * Math.sin((z - cZ) / 37), LAKE.x, smooth(95, 150, z));
  const S0 = -205, S1 = 150;
  const streamFade = (z: number) => smooth(S0, S0 + 20, z) * (1 - smooth(140, S1, z));

  function baseH(x: number, z: number) {
    const d = Math.abs(x - valleyX(z));
    let h = 3 * fbm(x * 0.012, z * 0.012, 3);
    const t = smooth(16, 150, d);
    const r = ridged(x * 0.0055 + 11, z * 0.0055 - 7, 4);
    const m = 125 * r * r + 22 * fbm(x * 0.02 + 3, z * 0.02, 3);
    h += t * d * 0.14 + t * t * m;
    const lx = x - LAKE.x, lz = z - LAKE.z; h -= 14 * Math.exp(-(lx * lx + lz * lz) / 900);
    if (z > S0 && z < S1 + 10) { const dx = x - streamX(z); h -= 1.8 * Math.exp(-dx * dx / 12) * streamFade(z); }
    return h;
  }
  TOWN.h = baseH(TOWN.x, TOWN.z);
  const H = (x: number, z: number) => { const h = baseH(x, z); const tx = x - TOWN.x, tz = z - TOWN.z; const w = Math.exp(-(tx * tx + tz * tz) / 2025); return h * (1 - w) + TOWN.h * w; };

  const SIZE = 820, N = 205, STEP = SIZE / N, HALF = SIZE / 2, NP = N + 1;
  const hs = new Float32Array(NP * NP);
  for (let j = 0; j < NP; j++) for (let i = 0; i < NP; i++) hs[j * NP + i] = H(-HALF + i * STEP, -HALF + j * STEP);
  /** Height of the drawn terrain surface (exactly matches the triangles). */
  function heightAt(x: number, z: number) {
    const fx = clamp((x + HALF) / STEP, 0, N - 1e-4), fz = clamp((z + HALF) / STEP, 0, N - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const h00 = hs[j * NP + i], h10 = hs[j * NP + i + 1], h01 = hs[(j + 1) * NP + i], h11 = hs[(j + 1) * NP + i + 1];
    return (u + v < 1) ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
  }
  const waterY = heightAt(LAKE.x, LAKE.z) + 5;
  T.forEach(p => { p.y = heightAt(p.x, p.z); });

  const trailHash = mkHash(T, 8);
  const trailDist = (x: number, z: number) => nearest(trailHash, x, z).d;
  /** Point on the trail at fraction u (0 = village, 1 = lake), with tangent and side vectors. */
  function rp(u: number) {
    const f = clamp(u, 0, 1) * (M - 1), i = Math.min(Math.floor(f), M - 2), t = f - i;
    const a = T[i], b = T[i + 1], x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    const i0 = Math.max(i - 4, 0), i1 = Math.min(i + 5, M - 1);
    let tx = T[i1].x - T[i0].x, tz = T[i1].z - T[i0].z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { x, y: heightAt(x, z), z, tx, tz, sx: -tz, sz: tx };
  }
  /** Fraction along the trail of the trail point nearest to (x, z). */
  const trailU = (x: number, z: number) => { const n = nearest(trailHash, x, z); return n.p ? n.p.i / (M - 1) : -1; };

  const streamPts: (Pt & { y: number })[] = [];
  for (let z = S0 + 8; z < S1; z += 1.6) {
    const x = streamX(z), y = heightAt(x, z) + 0.5;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < 40 && y < waterY + 0.3) break;
    streamPts.push({ x, y, z });
  }
  for (let i = 2; i < streamPts.length; i++) { const a = streamPts[i - 1]; if (streamPts[i].y > a.y) streamPts[i].y = a.y; }
  const streamHash = mkHash(streamPts, 8);
  const streamAt = (x: number, z: number) => nearest(streamHash, x, z);

  /* terrain mesh */
  const C: Record<string, RGB> = { grassA: hx('#6f9a50'), grassB: hx('#86a95a'), grassC: hx('#5b8346'), meadow: hx('#9aae5e'), forest: hx('#4a6a3a'), alpine: hx('#8f9b62'), rock: hx('#857d71'), rock2: hx('#6c665f'), snow: hx('#e8edf0'), sand: hx('#a8956c'), lakebed: hx('#5f6b55'), bank: hx('#7d7558') };
  const forestBelt = (x: number, z: number) => { const n = nearest(trailHash, x, z); if (!n.p) return 0; const u = n.p.i / (M - 1); return win(u, 0.8, 0.955, 0.02) * (1 - smooth(14, 40, n.d)); };
  const pos = new Float32Array(N * N * 18), col = new Float32Array(N * N * 18);
  let o = 0;
  function face(ax: number, az: number, ah: number, bx: number, bz: number, bh: number, cx: number, cz: number, ch: number, ny: number) {
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, mh = (ah + bh + ch) / 3;
    const n1 = noise(mx * 0.03, mz * 0.03), n2 = noise(mx * 0.13 + 5, mz * 0.13);
    let c: RGB;
    const ld = Math.hypot(mx - LAKE.x, mz - LAKE.z);
    if (ld < 60 && mh < waterY + 0.7) c = mh < waterY - 0.5 ? C.lakebed : C.sand;
    else if (mh > 95 + n1 * 12 && ny > 0.55) c = C.snow;
    else if (ny < 0.7) c = mix3(C.rock, C.rock2, (n2 + 1) / 2);
    else if (mh > 58 + n1 * 12) c = mix3(C.alpine, C.rock, clamp((mh - 58) / 40, 0, 1) * 0.8);
    else { c = mix3(C.grassA, C.grassB, (n1 + 1) / 2); if (n2 > 0.45 && mh < 14) c = C.meadow; if (ny < 0.85) c = mix3(c, C.grassC, 0.6); }
    if (mz > S0 && mz < S1 && streamFade(mz) > 0.5 && Math.abs(mx - streamX(mz)) < 3.2) c = C.bank;
    const fb = forestBelt(mx, mz); if (fb > 0) c = mix3(c, C.forest, fb);
    const j = 1 + (rnd() - 0.5) * 0.08;
    const v = [ax, ah, az, bx, bh, bz, cx, ch, cz];
    for (let k = 0; k < 3; k++) { pos[o] = v[k * 3]; pos[o + 1] = v[k * 3 + 1]; pos[o + 2] = v[k * 3 + 2]; col[o] = c[0] * j; col[o + 1] = c[1] * j; col[o + 2] = c[2] * j; o += 3; }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = -HALF + i * STEP, z0 = -HALF + j * STEP, x1 = x0 + STEP, z1 = z0 + STEP;
    const h00 = hs[j * NP + i], h10 = hs[j * NP + i + 1], h01 = hs[(j + 1) * NP + i], h11 = hs[(j + 1) * NP + i + 1];
    face(x0, z0, h00, x0, z1, h01, x1, z0, h10, STEP / Math.hypot(STEP, h10 - h00, h01 - h00));
    face(x1, z0, h10, x0, z1, h01, x1, z1, h11, STEP / Math.hypot(STEP, h01 - h11, h10 - h11));
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })));

  /* the trail itself */
  {
    const dirtA = hx('#b39a72'), dirtB = hx('#a58d68'), duff = hx('#6e5a40');
    const P: number[] = [], Cc: number[] = [];
    const edge = (p: { x: number; z: number }, sx: number, sz: number, w: number) => { const x = p.x + sx * w, z = p.z + sz * w; return [x, heightAt(x, z) + 0.12, z]; };
    let prev: number[][] | null = null;
    for (let k = 0; k < M; k += 2) {
      const u = k / (M - 1), r = rp(u), w = k < 60 ? 1.4 : 0.85;
      const l = edge(r, r.sx, r.sz, w), rr = edge(r, r.sx, r.sz, -w);
      if (prev) {
        const c = mix3((k / 2) % 7 < 4 ? dirtA : dirtB, duff, win(u, 0.8, 0.955, 0.02));
        [prev[0], l, prev[1], prev[1], l, rr].forEach(v => { P.push(v[0], v[1], v[2]); Cc.push(c[0], c[1], c[2]); });
      }
      prev = [l, rr];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })));
  }

  /* water */
  const waterMat = new THREE.MeshPhongMaterial({ color: 0x5a7fa0, specular: 0xffffff, shininess: 90, flatShading: true, transparent: true, opacity: 0.92 });
  const wg = new THREE.CircleGeometry(52, 40); wg.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, waterMat); water.position.set(LAKE.x, waterY, LAKE.z); scene.add(water);
  const creekMat = new THREE.MeshPhongMaterial({ color: 0x6f95ad, specular: 0x555555, shininess: 30, flatShading: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  {
    const P: number[] = [];
    for (let i = 1; i < streamPts.length; i++) {
      const a = streamPts[i - 1], b = streamPts[i];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, sx = -dz / l * 1.7, sz = dx / l * 1.7;
      [[a.x + sx, a.y, a.z + sz], [b.x + sx, b.y, b.z + sz], [a.x - sx, a.y, a.z - sz], [a.x - sx, a.y, a.z - sz], [b.x + sx, b.y, b.z + sz], [b.x - sx, b.y, b.z - sz]].forEach(v => P.push(v[0], v[1], v[2]));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, creekMat));
  }
  /* sun glinting on moving water: small sparkles that flash and fade */
  const glints: { s: THREE.Sprite; ph: number; rate: number }[] = [];
  {
    const add = (x: number, y: number, z: number) => { const m = new THREE.SpriteMaterial({ map: GLOW_PALE, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); const s = new THREE.Sprite(m); s.position.set(x, y + 0.05, z); s.scale.setScalar(0.35 + rnd() * 0.3); scene.add(s); glints.push({ s, ph: rnd() * 100, rate: 0.7 + rnd() * 1.6 }); };
    for (let k = 0; k < 140; k++) { const p = streamPts[Math.floor(rnd() * streamPts.length)]; add(p.x + (rnd() - 0.5) * 2.4, p.y, p.z + (rnd() - 0.5) * 2.4); }
    for (let k = 0; k < 90; k++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 34; add(LAKE.x + Math.cos(a) * r, waterY, LAKE.z + Math.sin(a) * r); }
  }
  const crossings: number[] = [];
  {
    let prevD: number | null = null;
    for (let k = 0; k < M; k++) {
      const p = T[k]; if (p.z < S0 + 10 || p.z > S1 - 5) { prevD = null; continue; }
      const d = p.x - streamX(p.z);
      if (prevD !== null && Math.sign(d) !== Math.sign(prevD)) crossings.push(k / (M - 1));
      prevD = d;
    }
    const sg = facet(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 7));
    crossings.forEach(u => {
      const r = rp(u), s = streamAt(r.x, r.z); if (!s.p || s.d > 3) return;
      for (let k = -2; k <= 2; k++) {
        const x = r.x + r.tx * k * 0.9 + (rnd() - 0.5) * 0.2, z = r.z + r.tz * k * 0.9 + (rnd() - 0.5) * 0.2;
        const stn = new THREE.Mesh(sg, lam('#8e877b')); stn.position.set(x, s.p.y - 0.06, z); stn.rotation.y = rnd() * 3; scene.add(stn);
      }
    });
  }
  /** Height you stand on: terrain, stepping stones over the creek, a little higher on the trail. */
  function groundAt(x: number, z: number) {
    let h = heightAt(x, z);
    const s = streamAt(x, z); if (s.p && s.d < 2.4) h = Math.max(h, (s.p.y ?? h) + 0.09);
    if (trailDist(x, z) < 1.1) h += 0.08;
    return h;
  }

  /* camp spot at the trail end, by the lake */
  const end = rp(1), back = rp(0.955);
  const F = v3(back.x - end.x, 0, back.z - end.z).normalize(), Fp = v3(-F.z, 0, F.x);
  const camp = { x: end.x, z: end.z };

  /* places along the trail */
  const firstCross = crossings.find(u => u > 0.05 && u < 0.3) || 0.12;
  let climbU = 0.32, best = -1;
  for (let u = firstCross + 0.08; u < 0.5; u += 0.004) { const a = rp(u), b = rp(u + 12 / L); const g = b.y - a.y; if (g > best) { best = g; climbU = u; } }
  climbU = clamp(climbU - 8 / L, firstCross + 0.08, 0.5);
  const markU = clamp(climbU - 45 / L, firstCross + 0.04, climbU - 0.02);
  const meetU = climbU + 4 / L;
  let shoulderU = meetU + 0.05, sb = -1e9;
  for (let u = meetU + 25 / L; u < 0.72; u += 0.003) { const y = rp(u).y; if (y > sb) { sb = y; shoulderU = u; } }

  const blockers: Blocker[] = [];

  /* the village and the family lodge */
  const winMat = new THREE.MeshBasicMaterial({ color: 0x39404c });
  const lampLight = new THREE.PointLight(0xffc87a, 0, 55, 1.6);
  const lodgeLight = new THREE.PointLight(0xffc27a, 0, 18, 1.8);
  const smokeG = new THREE.BufferGeometry(), smokeP = new Float32Array(40 * 3); smokeG.setAttribute('position', new THREE.BufferAttribute(smokeP, 3));
  const smoke = new THREE.Points(smokeG, new THREE.PointsMaterial({ color: 0xd8d4cc, size: 0.5, transparent: true, opacity: 0.35, depthWrite: false }));
  const smokeLife = Array.from({ length: 40 }, () => rnd());
  let lodge = { x: 0, z: 0, y: 0, door: v3(0, 0, 0), porch: v3(0, 0, 0), yaw: 0 };
  {
    const wallCols = ['#e8e0cf', '#efe6d2', '#e3d3b0', '#d9cbb3', '#ece4d8'];
    const roofCols = ['#8a3b2e', '#6b4a3a', '#55606b', '#7a3a30'];
    const winG = new THREE.BoxGeometry(0.8, 0.9, 0.12);
    const house = (x: number, z: number, w: number, d: number, hgt: number, rot: number, wall: string, roof: string, tower = false) => {
      const g = new THREE.Group(), y = heightAt(x, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), lam(wall)); body.position.y = hgt / 2 - 0.3; g.add(body);
      const rg = facet(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4)); rg.rotateY(Math.PI / 4);
      const roofM = new THREE.Mesh(rg, lam(roof)); roofM.scale.set(w * 1.18, tower ? 5 : Math.max(w, d) * 0.55, d * 1.18); roofM.position.y = hgt - 0.3 + roofM.scale.y / 2; g.add(roofM);
      if (!tower) { const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), lam('#6b5f55')); chim.position.set(w * 0.25, hgt + 0.6, 0); g.add(chim); }
      const nx = Math.max(1, Math.floor(w / 2.2));
      for (let f = 0; f < nx; f++) for (const side of [1, -1]) { const wm = new THREE.Mesh(winG, winMat); wm.position.set((f - (nx - 1) / 2) * 2, Math.min(hgt * 0.55, 2.2), side * (d / 2 + 0.04)); g.add(wm); }
      g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
      blockers.push({ x, z, r: (w + d) * 0.27 });
      return g;
    };
    [-262, -255, -248, -241, -219, -212].forEach((z, k) => {
      const side = k % 2 ? 1 : -1, d = 10 + rnd() * 4, x = valleyX(z) + side * d;
      house(x, z, 5 + rnd() * 2.5, 5 + rnd() * 2, 3.6 + rnd() * 1.8, side > 0 ? -Math.PI / 2 : Math.PI / 2, wallCols[k % 5], roofCols[k % 4]);
    });
    const cz = -250, cxp = valleyX(cz) - 24;
    house(cxp, cz, 3.2, 3.2, 12, 0, '#e4dccb', '#4f5961', true);
    house(cxp + 6, cz, 5, 9, 5.5, 0, '#e4dccb', '#4f5961');
    /* the lodge: two storeys, a porch with tables, warm windows, a sign and a smoking chimney */
    const lz = -232, lx = valleyX(lz) - 13, ly = heightAt(lx, lz), rot = Math.PI / 2;
    const lg = house(lx, lz, 11, 7, 6.4, rot, '#e6d6b8', '#6b3a2c');
    const P = new THREE.Group(); P.position.set(lx, ly, lz); P.rotation.y = rot; scene.add(P);
    const pB = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); P.add(m); return m; };
    pB(11.4, 0.2, 2.6, '#7a5a3c', 0, -0.2, 4.7);
    pB(11.6, 0.15, 2.9, '#5e3a2a', 0, 2.75, 4.75);
    [-5.4, -1.8, 1.8, 5.4].forEach(x => pB(0.18, 2.9, 0.18, '#5e4630', x, 1.25, 5.9));
    pB(1.2, 2.1, 0.08, '#4a2f20', 0, 0.75, 3.54);
    pB(2.4, 0.6, 0.08, '#3a2a1e', 0, 3.3, 3.6); pB(2.1, 0.08, 0.1, '#d9c27a', 0, 3.3, 3.66);
    [[-3.6, 4.6], [3.4, 4.6]].forEach(([x, z]) => { pB(1.2, 0.08, 0.8, '#8a6a48', x, 0.55, z); pB(0.1, 0.6, 0.1, '#5e4630', x, 0.25, z); pB(1.2, 0.06, 0.3, '#7a5a3c', x, 0.32, z + 0.65); pB(1.2, 0.06, 0.3, '#7a5a3c', x, 0.32, z - 0.65); });
    pB(0.36, 0.3, 0.36, '#9a6a40', -3.6, 0.74, 4.5); pB(0.12, 0.14, 0.12, '#e8e0d0', 3.6, 0.66, 4.4);
    for (let k = 0; k < 5; k++) pB(0.42, 0.42, 0.42, '#a8743c', 5.0 - (k % 2) * 0.45, 0.2 + Math.floor(k / 2) * 0.42, 3.8);
    const plant = (x: number) => { pB(0.5, 0.4, 0.5, '#8a4a30', x, 0.2, 5.7); pB(0.6, 0.5, 0.6, '#5f8a42', x, 0.6, 5.7); };
    plant(-5.6); plant(5.6);
    lg.updateMatrixWorld(); P.updateMatrixWorld();
    const door = P.localToWorld(v3(0, 0, 4.9)), porch = P.localToWorld(v3(-2.2, 0, 4.9));
    lodge = { x: lx, z: lz, y: ly, door, porch, yaw: rot };
    lodgeLight.position.copy(P.localToWorld(v3(0, 2.2, 5))); scene.add(lodgeLight);
    smoke.position.copy(P.localToWorld(v3(0, 0, 0))); smoke.position.y = ly + 8.5; smoke.position.add(v3(0, 0, 0)); scene.add(smoke);
    const lpx = valleyX(-226) + 2.6, lpy = heightAt(lpx, -226);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 0.15), lam('#33302c')); pole.position.set(lpx, lpy + 1.7, -226); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), winMat); bulb.position.set(lpx, lpy + 3.5, -226); scene.add(bulb);
    lampLight.position.set(lpx, lpy + 4, -226); scene.add(lampLight);
  }

  /* waymarks: red and white, every 24 m */
  {
    const postG = new THREE.BoxGeometry(0.16, 1.15, 0.16), bandG = new THREE.BoxGeometry(0.19, 0.13, 0.19);
    for (let m = 34; m < L - 8; m += 24) {
      const r = rp(m / L), sd = (Math.floor(m / 24) % 2 ? 1 : -1) * 1.25, x = r.x + r.sx * sd, z = r.z + r.sz * sd, y = heightAt(x, z);
      const s = streamAt(x, z); if (s.p && s.d < 3) continue;
      const p = new THREE.Mesh(postG, lam('#6e5a44')); p.position.set(x, y + 0.5, z); scene.add(p);
      const w = new THREE.Mesh(bandG, lam('#f1ece2')); w.position.set(x, y + 1.0, z); scene.add(w);
      const rd = new THREE.Mesh(bandG, lam('#c4432f')); rd.position.set(x, y + 0.87, z); scene.add(rd);
    }
  }
  /* one faded blue mark beside the trail, for those who notice */
  const stop = rp(markU);
  const rs = heightAt(stop.x + stop.sx * 6, stop.z + stop.sz * 6) > heightAt(stop.x - stop.sx * 6, stop.z - stop.sz * 6) ? 1 : -1;
  const markRock = v3(stop.x + stop.sx * rs * 1.9, 0, stop.z + stop.sz * rs * 1.9); markRock.y = heightAt(markRock.x, markRock.z);
  {
    const rg = facet(new THREE.DodecahedronGeometry(1, 0)), s = 0.85;
    const r = new THREE.Mesh(rg, lam('#8a8479')); r.scale.set(s, s * 0.75, s); r.position.set(markRock.x, markRock.y + s * 0.3, markRock.z); scene.add(r);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.32 * s, 0.06), lam('#8fb2d8'));
    const yaw = Math.atan2(stop.x - markRock.x, stop.z - markRock.z);
    m.position.set(markRock.x + Math.sin(yaw) * s * 0.93, markRock.y + s * 0.55, markRock.z + Math.cos(yaw) * s * 0.93); m.rotation.y = yaw; scene.add(m);
    blockers.push({ x: markRock.x, z: markRock.z, r: 0.8 });
  }

  /* an old logging winch in the forest, long abandoned and taken back by moss and ferns */
  const logU = 0.87, lr = rp(logU);
  const lside = heightAt(lr.x + lr.sx * 12, lr.z + lr.sz * 12) < heightAt(lr.x - lr.sx * 12, lr.z - lr.sz * 12) ? 1 : -1;
  const logging = v3(lr.x + lr.sx * lside * 11, 0, lr.z + lr.sz * lside * 11); logging.y = heightAt(logging.x, logging.z);
  {
    const G = new THREE.Group(); G.position.copy(logging); G.rotation.y = Math.atan2(lr.tx, lr.tz) + 0.4; scene.add(G);
    const rust = '#7a4630', rust2 = '#5e3826', moss = '#5d7a3a', wood = '#4a3a2a';
    const bx = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); m.rotation.y = ry; G.add(m); return m; };
    const cyl = (r: number, l: number, c: string, x: number, y: number, z: number, axis: 'x' | 'y' | 'z') => { const m = new THREE.Mesh(facet(new THREE.CylinderGeometry(r, r, l, 9)), lam(c)); m.position.set(x, y, z); if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2; G.add(m); return m; };
    bx(0.4, 0.35, 4.6, wood, -0.8, 0.12, 0); bx(0.4, 0.35, 4.6, wood, 0.8, 0.1, 0);
    cyl(0.62, 2.2, rust, 0, 0.95, -0.9, 'z');
    cyl(0.18, 2.4, rust2, 0, 2.2, -1.9, 'y');
    cyl(0.5, 1.5, rust2, 0, 0.9, 1.0, 'x');
    cyl(0.62, 0.1, rust, -0.8, 0.9, 1.0, 'x'); cyl(0.62, 0.1, rust, 0.8, 0.9, 1.0, 'x');
    cyl(0.32, 0.08, '#4e3020', 0.95, 0.9, 0.3, 'x');
    bx(1.4, 0.12, 1.3, moss, 0, 1.58, -0.9); bx(1.1, 0.1, 0.9, moss, 0, 1.38, 1.0); bx(0.3, 0.08, 4.5, moss, -0.8, 0.32, 0);
    const tree = new THREE.Mesh(facet(new THREE.ConeGeometry(0.7, 2.4, 6)), lam('#3d6b45')); tree.position.set(0.1, 2.9, -0.9); G.add(tree);
    const trunk = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 5)), lam('#5a4330')); trunk.position.set(0.1, 1.9, -0.9); G.add(trunk);
    for (let k = 0; k < 9; k++) { const c = bx(0.06, 0.06, 0.7, '#3a3632', 0, 0.06, 2 + k * 0.62, Math.sin(k) * 0.3); c.rotation.x = Math.sin(k * 1.3) * 0.1; }
    for (let k = 0; k < 5; k++) { bx(1.6, 0.1, 0.18, wood, 2.6, 0.03, -2 + k * 0.7); }
    bx(0.08, 0.09, 3.4, rust2, 2.1, 0.12, -0.6); bx(0.08, 0.09, 3.4, rust2, 3.1, 0.12, -0.6);
    const fernG = facet(new THREE.ConeGeometry(0.5, 0.5, 5));
    for (let k = 0; k < 16; k++) { const f = new THREE.Mesh(fernG, lam('#55803f')); const a = rnd() * 6.28, d = 1 + rnd() * 2.6; f.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); f.scale.setScalar(0.6 + rnd() * 0.8); G.add(f); }
    blockers.push({ x: logging.x, z: logging.z, r: 2.2 });
  }

  /* trees */
  const treeSpots: (Pt & { r: number; id: number })[] = [];
  /* for each tree: where its parts live in the instanced meshes, so trees can be hidden from the camera */
  const treeParts: { im: THREE.InstancedMesh; i: number; m: THREE.Matrix4 }[][] = [];
  const spots: [number, number, number, number, boolean, boolean?][] = [];
  {
    const pineG = facet(new THREE.ConeGeometry(1.6, 4.6, 6)); pineG.translate(0, 3.4, 0);
    const pine2G = facet(new THREE.ConeGeometry(1.15, 3.0, 6)); pine2G.translate(0, 5.6, 0);
    const trunkG = facet(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 5)); trunkG.translate(0, 0.8, 0);
    const leafG = facet(new THREE.IcosahedronGeometry(1.9, 0)); leafG.translate(0, 3.3, 0);
    const okSpot = (x: number, z: number, minTrail: number) => {
      const h = heightAt(x, z);
      if (Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h) > 0.75 || h > 64 + noise(x * 0.02, z * 0.02) * 12) return null;
      if (trailDist(x, z) < minTrail) return null;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < 34 || Math.hypot(x - TOWN.x, z - TOWN.z) < 42 || Math.hypot(x - end.x, z - end.z) < 22 || Math.hypot(x - logging.x, z - logging.z) < 5) return null;
      const s = streamAt(x, z); if (s.p && s.d < 3.5) return null;
      return h;
    };
    for (let k = 0; k < 9000 && spots.length < 2500; k++) {
      const z = -HALF + 20 + rnd() * (SIZE - 40), x = valleyX(z) + (rnd() - 0.5) * 2 * 330;
      const h = okSpot(x, z, 4); if (h === null) continue;
      if (fbm(x * 0.011 + 40, z * 0.011, 3) < -0.05 + rnd() * 0.25) continue;
      spots.push([x, h, z, rnd(), h < 16 && rnd() < 0.45]);
    }
    for (let k = 0; k < 4000; k++) {
      const u = lerp(0.8, 0.955, rnd()), r = rp(u), sd = (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 24);
      const x = r.x + r.sx * sd + (rnd() - 0.5) * 4, z = r.z + r.sz * sd + (rnd() - 0.5) * 4;
      const h = okSpot(x, z, 2.2); if (h === null) continue;
      spots.push([x, h, z, rnd(), rnd() < 0.2, true]);
    }
    const pines = spots.filter(s => !s[4]), broad = spots.filter(s => s[4]);
    const UP = v3(0, 1, 0);
    const mk = (geo: THREE.BufferGeometry, list: typeof spots, colorFn: (s: typeof spots[number], c: THREE.Color) => THREE.Color) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color();
      list.forEach((s, i) => { const k = (s[5] ? 0.95 : 0.7) + s[3] * 0.75; sc.set(k, k * (0.9 + s[3] * 0.3), k); q.setFromAxisAngle(UP, s[3] * 6.28); m4.compose(v3(s[0], s[1] - 0.2, s[2]), q, sc); im.setMatrixAt(i, m4); im.setColorAt(i, colorFn(s, c)); const id = spots.indexOf(s); (treeParts[id] ||= []).push({ im, i, m: m4.clone() }); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
    };
    const pineCols = ['#2e5a3d', '#36654a', '#28503a', '#3d6b45'].map(h => new THREE.Color(h));
    const leafCols = ['#5e8a42', '#6f9648', '#577f3e', '#8a9a46'].map(h => new THREE.Color(h));
    mk(pineG, pines, (s, c) => c.copy(pineCols[Math.floor(s[3] * 4) % 4]).multiplyScalar(s[5] ? 0.8 : 1));
    mk(pine2G, pines, (s, c) => c.copy(pineCols[Math.floor(s[3] * 4) % 4]).multiplyScalar(s[5] ? 0.85 : 1.08));
    mk(trunkG, spots, (_s, c) => c.set('#5a4330'));
    mk(leafG, broad, (s, c) => c.copy(leafCols[Math.floor(s[3] * 4) % 4]));
    spots.forEach((s, id) => treeSpots.push({ x: s[0], z: s[2], r: 0.45, id }));
  }
  const treeHash = mkHash(treeSpots, 6);
  const FC = 6, fgrid = new Map<string, number>();
  spots.forEach(s => { const k = Math.floor(s[0] / FC) + ',' + Math.floor(s[2] / FC); fgrid.set(k, (fgrid.get(k) || 0) + 1); });
  /** How enclosed by forest a spot is, 0 (open) to 1 (dense canopy). Drives darkness and sound. */
  function forestAt(x: number, z: number) { const ci = Math.floor(x / FC), cj = Math.floor(z / FC); let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) n += fgrid.get((ci + a) + ',' + (cj + b)) || 0; return clamp((n - 4) / 30, 0, 1); }

  /* rocks; the big ones block the way */
  {
    const g = facet(new THREE.DodecahedronGeometry(1, 0)), list: number[][] = [];
    for (let k = 0; k < 3000 && list.length < 520; k++) {
      const z = -HALF + rnd() * SIZE, x = valleyX(z) + (rnd() - 0.5) * 600, h = heightAt(x, z);
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < 30 || trailDist(x, z) < 2.5 || Math.hypot(x - TOWN.x, z - TOWN.z) < 40) continue;
      if (h < 10 && rnd() < 0.7) continue;
      list.push([x, h, z, 0.4 + rnd() * rnd() * 2.6, rnd()]);
    }
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach((s, i) => { q.setFromEuler(new THREE.Euler(s[4] * 3, s[4] * 7, s[4] * 2)); m4.compose(v3(s[0], s[1], s[2]), q, v3(s[3], s[3] * 0.6, s[3] * 0.9)); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(s[4] > 0.5 ? '#8c867c' : '#77726a')); if (s[3] > 0.9) blockers.push({ x: s[0], z: s[2], r: s[3] * 0.85 }); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
  }
  const blockHash = mkHash(blockers, 12);

  /* flowers in the open, ferns under the trees */
  const flowerMat = new THREE.PointsMaterial({ size: 0.11, vertexColors: true, sizeAttenuation: true });
  {
    const P: number[] = [], Cc: number[] = [], cols = ['#f4f1e4', '#f2d35c', '#b496d6', '#e9a0b4'].map(hx);
    for (let k = 0; k < 9000 && P.length < 3600 * 3; k++) {
      const z = lerp(-230, 150, rnd()), x = valleyX(z) + (rnd() - 0.5) * 90, h = heightAt(x, z);
      if (noise(x * 0.05, z * 0.05) < 0.1 || trailDist(x, z) < 1.2 || (h < waterY + 0.6 && Math.hypot(x - LAKE.x, z - LAKE.z) < 50) || forestBelt(x, z) > 0.3) continue;
      const s = streamAt(x, z); if (s.p && s.d < 2.2) continue;
      P.push(x, h + 0.15, z); const c = cols[Math.floor(rnd() * 4)]; Cc.push(c[0], c[1], c[2]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    scene.add(new THREE.Points(g, flowerMat));
    const fernG = facet(new THREE.ConeGeometry(0.55, 0.5, 5)); fernG.translate(0, 0.2, 0);
    const ferns: number[][] = [];
    for (let k = 0; k < 2500 && ferns.length < 700; k++) { const u = lerp(0.8, 0.955, rnd()), r = rp(u), sd = (rnd() < 0.5 ? -1 : 1) * (1.4 + rnd() * 16); const x = r.x + r.sx * sd, z = r.z + r.sz * sd; if (trailDist(x, z) < 1.3) continue; ferns.push([x, heightAt(x, z), z, rnd()]); }
    const im = new THREE.InstancedMesh(fernG, new THREE.MeshLambertMaterial({ color: 0x55803f }), ferns.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = v3(0, 1, 0);
    ferns.forEach((f, i) => { q.setFromAxisAngle(UP, f[3] * 6); const s = 0.6 + f[3]; m4.compose(v3(f[0], f[1], f[2]), q, v3(s, s * 0.8, s)); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; scene.add(im);
  }

  /* sky, stars, moon, lights, fog */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunVis: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, hor, sunCol, sunDir; uniform float sunVis; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(hor, top, smoothstep(-0.02, 0.55, h));
        c = mix(c, hor * 0.7, smoothstep(0.0, -0.3, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 6.0) * 0.28 + smoothstep(0.9993, 0.9996, s) * 1.6) * sunVis;
        gl_FragColor = vec4(c, 1.0); }`
  }));
  sky.renderOrder = -10; scene.add(sky);
  const starG = new THREE.BufferGeometry(), sp: number[] = [];
  for (let k = 0; k < 1400; k++) { const a = rnd() * 6.28, e = Math.asin(0.05 + rnd() * 0.95); sp.push(Math.cos(a) * Math.cos(e) * 1000, Math.sin(e) * 1000, Math.sin(a) * Math.cos(e) * 1000); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xe8ecff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -9; scene.add(stars);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.7); scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1); scene.add(dir, dir.target);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.005);

  /**
   * Hides the trees standing between the camera and the hiker (and right around the camera),
   * so you can always see yourself in the forest. They come back as soon as they are out of the way.
   */
  const hidden = new Set<number>(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function clearView(from: THREE.Vector3, to: THREE.Vector3) {
    const want = new Set<number>(), dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / 1.5));
    for (let k = 0; k <= steps; k++) {
      const f = k / steps, x = from.x + dx * f, z = from.z + dz * f, ci = Math.floor(x / 6), cj = Math.floor(z / 6);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = treeHash.m.get((ci + a) + ',' + (cj + b)); if (l) for (const t of l) { if (Math.hypot(t.x - x, t.z - z) < (f > 0.85 ? 1.7 : 3.6)) want.add(t.id); } }
    }
    const touched = new Set<THREE.InstancedMesh>();
    hidden.forEach(id => { if (!want.has(id)) { treeParts[id]?.forEach(p => { p.im.setMatrixAt(p.i, p.m); touched.add(p.im); }); hidden.delete(id); } });
    want.forEach(id => { if (!hidden.has(id)) { treeParts[id]?.forEach(p => { p.im.setMatrixAt(p.i, ZERO); touched.add(p.im); }); hidden.add(id); } });
    touched.forEach(im => { im.instanceMatrix.needsUpdate = true; });
  }
  /** True if the point is inside a building: the camera must not be there. */
  function occludes(x: number, y: number, z: number) {
    const above = y - heightAt(x, z);
    const ci = Math.floor(x / 12), cj = Math.floor(z / 12);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = blockHash.m.get((ci + a) + ',' + (cj + b)); if (l) for (const q of l) if (q.r > 2 && above < 9 && Math.hypot(q.x - x, q.z - z) < q.r + 0.6) return true; }
    return false;
  }
  /** True if a figure of radius r can stand at (x, z): no tree trunk, house or big rock in the way. */
  function blocked(x: number, z: number, r: number) {
    const t = nearest(treeHash, x, z); if (t.p && t.d < t.p.r + r) return true;
    const ci = Math.floor(x / 12), cj = Math.floor(z / 12);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = blockHash.m.get((ci + a) + ',' + (cj + b)); if (l) for (const q of l) if (Math.hypot(q.x - x, q.z - z) < q.r + r) return true; }
    if (Math.abs(x) > HALF - 30 || Math.abs(z) > HALF - 30) return true;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < 60 && heightAt(x, z) < waterY - 0.25) return true;
    return false;
  }

  function update(t: number, nightF: number) {
    /* sparkles on the water: only with the sun up */
    const day = 1 - nightF;
    for (const gl of glints) { const v = Math.max(0, Math.sin(t * gl.rate + gl.ph)); (gl.s.material as THREE.SpriteMaterial).opacity = day * Math.pow(v, 14) * 0.9; }
    /* chimney smoke drifts */
    for (let k = 0; k < 40; k++) { smokeLife[k] += 0.004 + (k % 5) * 0.0008; if (smokeLife[k] > 1) smokeLife[k] = 0; const e = smokeLife[k]; smokeP[k * 3] = Math.sin(k * 2.3) * 0.3 + e * 2.2; smokeP[k * 3 + 1] = e * 7; smokeP[k * 3 + 2] = Math.cos(k * 1.7) * 0.3 + e * 0.8; }
    smokeG.attributes.position.needsUpdate = true;
  }

  return {
    seed, town, lakeName, lodgeName, heightAt, groundAt, rp, trailU, trailDist, L, M, T, waterY,
    LAKE: v3(LAKE.x, waterY, LAKE.z), TOWN, lodge, camp, F, Fp, end, firstCross, markU, markRock, stop, rs, climbU, meetU, shoulderU, logging,
    streamAt, streamPts, forestAt, blocked, occludes, clearView, sky, stars, hemi, dir, winMat, lampLight, lodgeLight, flowerMat, waterMat, creekMat, water, update
  };
}
export type World = ReturnType<typeof buildWorld>;
