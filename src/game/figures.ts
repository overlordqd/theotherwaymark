import * as THREE from 'three';
import { clamp, lerp, wrapA } from './util';

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (c: string) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); matCache.set(c, m); } return m; };
export function facet<T extends THREE.BufferGeometry>(g: T): THREE.BufferGeometry { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
export function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
export const GLOW_WARM = glowTexture('rgba(255,210,140,1)', 'rgba(255,140,60,0.35)');
export const GLOW_PALE = glowTexture('rgba(255,248,225,1)', 'rgba(220,230,255,0.25)');

type Box = (w: number, h: number, d: number, col: string, x: number, y: number, z: number, parent: THREE.Object3D) => THREE.Mesh;
const B: Box = (w, h, d, col, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(col)); m.position.set(x, y, z); parent.add(m); return m; };

export interface PersonLook {
  jacket: string; collar?: string; pack: string; packDark: string; hat: string; hatBand?: string; pom?: string; hatType?: 'beanie' | 'brim';
  pants: string; skin: string; skinDark: string; hair: string; ponytail?: boolean; apron?: string; noPack?: boolean; headlamp?: boolean; mat?: string;
}
export const LEG = 0.95, HIP_Y = 0.96;

/** A person built from boxes, with joints at hips, knees, ankles, shoulders, elbows and neck. */
export function makePerson(c: PersonLook) {
  const g = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = HIP_Y; g.add(pelvis);
  B(0.4, 0.2, 0.26, c.pants, 0, 0.02, 0, pelvis);
  B(0.42, 0.05, 0.28, '#2b2622', 0, 0.12, 0, pelvis);
  const legs = [-0.11, 0.11].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, -0.02, 0); pelvis.add(hip);
    B(0.17, 0.46, 0.19, c.pants, 0, -0.23, 0, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.46, 0); hip.add(knee);
    B(0.15, 0.36, 0.16, c.pants, 0, -0.18, 0, knee);
    B(0.16, 0.06, 0.17, '#8d7b62', 0, -0.36, 0, knee);
    const foot = new THREE.Group(); foot.position.set(0, -0.4, 0); knee.add(foot);
    B(0.17, 0.11, 0.29, '#4a3424', 0, -0.035, 0.05, foot);
    B(0.18, 0.035, 0.31, '#221c18', 0, -0.09, 0.05, foot);
    return { hip, knee, foot };
  });
  const spine = new THREE.Group(); spine.position.y = 0.12; pelvis.add(spine);
  B(0.42, 0.24, 0.27, c.jacket, 0, 0.1, 0, spine);
  B(0.52, 0.36, 0.31, c.jacket, 0, 0.38, 0, spine);
  B(0.3, 0.07, 0.25, c.collar || c.jacket, 0, 0.58, 0, spine);
  if (c.apron) B(0.4, 0.5, 0.02, c.apron, 0, 0.2, 0.16, spine);
  if (!c.noPack) {
    B(0.03, 0.46, 0.012, '#1f1f22', 0.03, 0.3, 0.158, spine);
    [-0.15, 0.15].forEach(x => B(0.06, 0.44, 0.025, '#2a2a2a', x, 0.36, 0.165, spine));
    B(0.42, 0.56, 0.26, c.pack, 0, 0.36, -0.29, spine);
    B(0.4, 0.11, 0.29, c.packDark, 0, 0.68, -0.29, spine);
    B(0.3, 0.24, 0.07, c.packDark, 0, 0.24, -0.45, spine);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 6), lam('#b9c9cf')); bottle.position.set(0.25, 0.22, -0.29); spine.add(bottle);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 7), lam(c.mat || '#5b6b4a')); pad.rotation.z = Math.PI / 2; pad.position.set(0, 0.03, -0.31); spine.add(pad);
  }
  const arms = [-0.31, 0.31].map(x => {
    const sh = new THREE.Group(); sh.position.set(x, 0.5, 0); spine.add(sh);
    B(0.13, 0.31, 0.14, c.jacket, 0, -0.15, 0, sh);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    B(0.12, 0.25, 0.13, c.jacket, 0, -0.12, 0, el);
    B(0.125, 0.04, 0.135, c.collar || c.jacket, 0, -0.245, 0, el);
    B(0.09, 0.11, 0.1, c.skin, 0, -0.32, 0.01, el);
    return { sh, el };
  });
  const neck = new THREE.Group(); neck.position.y = 0.6; spine.add(neck);
  B(0.12, 0.08, 0.12, c.skin, 0, 0.04, 0, neck);
  const head = new THREE.Group(); head.position.y = 0.08; neck.add(head);
  B(0.28, 0.3, 0.28, c.skin, 0, 0.15, 0, head);
  B(0.3, 0.2, 0.1, c.hair, 0, 0.2, -0.11, head);
  [-0.15, 0.15].forEach(x => B(0.03, 0.14, 0.2, c.hair, x, 0.2, -0.03, head));
  [-0.065, 0.065].forEach(x => B(0.045, 0.045, 0.02, '#1d1a18', x, 0.17, 0.142, head));
  B(0.045, 0.06, 0.04, c.skinDark, 0, 0.12, 0.15, head);
  if (c.ponytail) B(0.08, 0.22, 0.08, c.hair, 0, 0.1, -0.2, head);
  if (c.hatType === 'brim') {
    B(0.3, 0.12, 0.3, c.hat, 0, 0.33, 0, head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 10), lam(c.hat)); brim.position.y = 0.28; head.add(brim);
  } else if (c.hatType !== undefined || c.hat) {
    B(0.31, 0.13, 0.31, c.hat, 0, 0.33, 0, head);
    B(0.32, 0.05, 0.32, c.hatBand || c.hat, 0, 0.27, 0, head);
    B(0.08, 0.08, 0.08, c.pom || c.hat, 0, 0.43, 0, head);
  }
  let lamp: { spot: THREE.SpotLight; lensMat: THREE.MeshBasicMaterial; beam: THREE.Mesh; on: boolean; level: number } | null = null;
  if (c.headlamp) {
    B(0.33, 0.03, 0.33, '#1e1e20', 0, 0.3, 0, head);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x55585e });
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.04), lensMat); lens.position.set(0, 0.3, 0.17); head.add(lens);
    const spot = new THREE.SpotLight(0xfff0d6, 0, 34, 0.42, 0.55, 1.3); spot.position.set(0, 0.3, 0.18); head.add(spot);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -1.2, 6); head.add(tgt); spot.target = tgt;
    const beamG = new THREE.ConeGeometry(1.5, 7, 10, 1, true); beamG.translate(0, -3.5, 0); beamG.rotateX(-Math.PI / 2 - 0.17);
    const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 0.3, 0.18); head.add(beam);
    lamp = { spot, lensMat, beam, on: false, level: 0 };
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; g.add(shadow);
  return { g, pelvis, spine, legs, arms, neck, head, lamp, shadow, phase: 0, amp: 0, yaw: 0, lookYaw: 0, lookPitch: 0, prev: null as null | { x: number; z: number } };
}
export type Person = ReturnType<typeof makePerson>;

/**
 * Walk cycle. Each leg swings from the hip; the knee bends only while the leg swings forward,
 * and the body sits on the ground under the foot that is standing, so feet never sink on slopes.
 * Returns true on the frame a foot touches down (for footstep sounds and kicked stones).
 */
export function poseWalk(fig: Person, x: number, z: number, yaw: number, dt: number, groundAt: (x: number, z: number) => number, opts: { lean?: number; amp?: number } = {}) {
  let moved = fig.prev ? Math.hypot(x - fig.prev.x, z - fig.prev.z) : 0; if (moved > 3) moved = 0;
  fig.prev = { x, z };
  const walking = dt > 0 && moved / dt > 0.12;
  fig.yaw = yaw; fig.g.rotation.y = yaw;
  const prevPhase = fig.phase;
  fig.phase += moved / 0.66 * Math.PI;
  fig.amp = lerp(fig.amp, walking ? (opts.amp ?? 0.5) : 0, dt > 0 ? 1 - Math.exp(-dt * 6) : 1);
  const A = fig.amp;
  let stanceTh = 0;
  fig.legs.forEach((lg, i) => {
    const ph = fig.phase + i * Math.PI, th = -A * Math.sin(ph), kn = A * 1.6 * Math.max(0, Math.cos(ph)) + 0.04;
    lg.hip.rotation.set(th, 0, 0); lg.knee.rotation.x = kn; lg.foot.rotation.x = -(th + kn) * 0.85;
    if (Math.cos(ph) <= 0) stanceTh = th;
  });
  fig.arms.forEach((a, i) => { const s = Math.sin(fig.phase) * (i ? -1 : 1); a.sh.rotation.set(A * 0.85 * s, 0, (i ? -1 : 1) * 0.06); a.el.rotation.x = -0.3 - A * 0.35 * Math.max(0, s); });
  fig.pelvis.position.y = HIP_Y - LEG * (1 - Math.cos(stanceTh)) + (walking ? 0 : Math.sin(performance.now() / 560) * 0.006);
  fig.spine.rotation.x = (opts.lean || 0) + A * 0.06;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), reach = LEG * Math.sin(-stanceTh);
  const g0 = groundAt(x, z), gs = groundAt(x + fx * reach, z + fz * reach), y = Math.max(g0, gs) + 0.01;
  fig.g.position.set(x, y, z); fig.shadow.position.y = g0 - y + 0.06;
  return walking && Math.floor(prevPhase / Math.PI) !== Math.floor(fig.phase / Math.PI);
}

export function poseSit(fig: Person, x: number, z: number, yaw: number, ground: number, seatY: number) {
  fig.prev = null; fig.amp = 0; fig.yaw = yaw;
  fig.g.position.set(x, ground, z); fig.g.rotation.y = yaw; fig.shadow.position.y = 0.06;
  fig.pelvis.position.y = seatY;
  fig.legs.forEach((lg, i) => { lg.hip.rotation.set(-1.45, 0, (i ? -1 : 1) * 0.08); lg.knee.rotation.x = 1.5; lg.foot.rotation.x = 0; });
  fig.arms.forEach((a, i) => { a.sh.rotation.set(-0.55, 0, (i ? -1 : 1) * 0.12); a.el.rotation.x = -0.9; });
  fig.spine.rotation.x = 0.16;
}

export function poseStand(fig: Person, x: number, z: number, yaw: number, ground: number) {
  fig.prev = null; fig.amp = 0; fig.yaw = yaw;
  fig.g.position.set(x, ground, z); fig.g.rotation.y = yaw; fig.shadow.position.y = 0.06;
  fig.pelvis.position.y = HIP_Y + Math.sin(performance.now() / 560) * 0.006;
  fig.legs.forEach(lg => { lg.hip.rotation.set(0, 0, 0); lg.knee.rotation.x = 0.04; lg.foot.rotation.x = 0; });
  fig.arms.forEach((a, i) => { a.sh.rotation.set(0, 0, (i ? -1 : 1) * 0.06); a.el.rotation.x = -0.3; });
  fig.spine.rotation.x = 0;
}

/** Turn the head, and a little of the body, toward whatever is worth looking at. */
export function look(fig: Person, target: THREE.Vector3 | null, dt: number, weight = 1) {
  let yaw = 0, pitch = 0;
  if (target) {
    const dx = target.x - fig.g.position.x, dy = target.y - (fig.g.position.y + 1.6), dz = target.z - fig.g.position.z;
    yaw = clamp(wrapA(Math.atan2(dx, dz) - fig.yaw), -1.45, 1.45) * weight;
    pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.45) * weight;
  }
  const k = dt > 0 ? 1 - Math.exp(-dt * 3.2) : 1;
  fig.lookYaw = lerp(fig.lookYaw, yaw, k); fig.lookPitch = lerp(fig.lookPitch, pitch, k);
  fig.spine.rotation.y = fig.lookYaw * 0.3; fig.neck.rotation.y = fig.lookYaw * 0.7; fig.head.rotation.x = -fig.lookPitch;
}
export const headOf = (f: Person) => new THREE.Vector3(f.g.position.x, f.g.position.y + 1.65, f.g.position.z);

export function makeDeer() {
  const g = new THREE.Group(), tan = '#9a5d36';
  const legs: THREE.Group[] = [];
  B(0.5, 0.5, 1.2, tan, 0, 1.02, 0, g); B(0.46, 0.2, 0.9, '#b07448', 0, 0.82, 0, g);
  [[-0.17, 0.46], [0.17, 0.46], [-0.17, -0.46], [0.17, -0.46]].forEach(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0.85, z); g.add(l); B(0.11, 0.45, 0.13, tan, 0, -0.2, 0, l); B(0.08, 0.42, 0.08, '#6e4126', 0, -0.62, 0, l); legs.push(l); });
  B(0.2, 0.22, 0.08, '#efe6d8', 0, 1.14, -0.62, g);
  const neck = new THREE.Group(); neck.position.set(0, 1.15, 0.5); g.add(neck);
  B(0.22, 0.48, 0.22, tan, 0, 0.2, 0.02, neck);
  B(0.24, 0.24, 0.3, tan, 0, 0.46, 0.08, neck);
  B(0.16, 0.16, 0.2, '#7a4a2c', 0, 0.42, 0.3, neck);
  B(0.06, 0.06, 0.04, '#1a1412', 0, 0.44, 0.41, neck);
  [-0.11, 0.11].forEach(x => { B(0.06, 0.18, 0.04, '#7d4a2b', x * 1.3, 0.64, 0.02, neck); B(0.04, 0.04, 0.02, '#1a1412', x * 0.8, 0.5, 0.23, neck); });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 10), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; shadow.scale.set(0.7, 1.2, 1); g.add(shadow);
  return { g, neck, legs };
}

/** A small falcon: body and two wings that beat fast while it hovers. */
export function makeKestrel() {
  const g = new THREE.Group();
  B(0.12, 0.1, 0.34, '#9a5a32', 0, 0, 0, g);
  B(0.08, 0.06, 0.16, '#6e6a66', 0, 0, -0.24, g);
  B(0.1, 0.09, 0.1, '#7a7470', 0, 0.03, 0.2, g);
  const wings = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.05, 0.02, 0.02); g.add(p); B(0.38, 0.02, 0.14, '#8a5230', s * 0.2, 0, 0, p); return p; });
  return { g, wings };
}

export function makeTent() {
  const w = 1.05, h = 1.15, l = 1.2;
  const v = [[-w, 0, l], [w, 0, l], [0, h, l], [-w, 0, -l], [w, 0, -l], [0, h, -l]];
  const tri = [[0, 2, 5], [0, 5, 3], [1, 4, 5], [1, 5, 2], [0, 1, 2], [3, 5, 4]];
  const p: number[] = []; tri.forEach(t => t.forEach(i => p.push(...v[i])));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xd06a2c, side: THREE.DoubleSide })));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), lam('#5a2e1a')); door.position.set(0, 0.35, l + 0.01); g.add(door);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.2, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);
  return g;
}

/** A campfire with flickering flames, a glow and rising embers. */
export function makeFire() {
  const g = new THREE.Group();
  for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), lam('#77726a')); s.position.set(Math.cos(k) * 0.5, 0.06, Math.sin(k) * 0.5); g.add(s); }
  for (let k = 0; k < 3; k++) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.9), lam('#4a3626')); lg.rotation.y = k * 2.1; lg.position.y = 0.08; g.add(lg); }
  const flame = new THREE.Mesh(facet(new THREE.ConeGeometry(0.28, 0.75, 5)), new THREE.MeshBasicMaterial({ color: 0xffb04a })); flame.position.y = 0.45; g.add(flame);
  const flame2 = new THREE.Mesh(facet(new THREE.ConeGeometry(0.16, 0.45, 5)), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); flame2.position.y = 0.36; g.add(flame2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_WARM, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); glow.scale.set(3.4, 3.4, 1); glow.position.y = 0.6; g.add(glow);
  const light = new THREE.PointLight(0xff9a4a, 0, 22, 2); light.position.y = 1; g.add(light);
  const eg = new THREE.BufferGeometry(), ep = new Float32Array(30 * 3); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.012, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(embers);
  const life = Array.from({ length: 30 }, () => Math.random());
  let on = 0;
  function update(dt: number, t: number) {
    const fl = 0.8 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.1 + Math.random() * 0.06;
    flame.visible = flame2.visible = glow.visible = embers.visible = on > 0.01;
    flame.scale.set(on, fl * on, on); flame2.scale.set(on, fl * on * 1.1, on);
    light.intensity = on * fl * 1.8; (glow.material as THREE.SpriteMaterial).opacity = on * 0.75 * fl;
    if (on > 0.01) {
      for (let k = 0; k < 30; k++) { life[k] += dt * (0.4 + (k % 5) * 0.08); if (life[k] > 1) life[k] = 0; const e = life[k]; ep[k * 3] = Math.sin(k * 3.1 + e * 4) * 0.25 * e; ep[k * 3 + 1] = 0.3 + e * 2.4; ep[k * 3 + 2] = Math.cos(k * 1.7 + e * 3) * 0.25 * e; }
      eg.attributes.position.needsUpdate = true;
    }
  }
  return { g, update, set on(v: number) { on = v; }, get on() { return on; } };
}
