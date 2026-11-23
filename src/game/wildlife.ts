import * as THREE from 'three';
import { clamp, lerp, wrapA, rand, v3 } from './util';
import { makeDeer, makeKestrel } from './figures';
import { deerFlee, kestrel as kestrelCall } from './audio';
import type { World } from './world';

/**
 * Animals notice you before you reach them. Each has an alert distance (it looks up and watches)
 * and a flight distance (it runs). Walking slowly (C) halves both; running doubles them.
 */
interface Watcher { seen: number; logged: boolean }

export function makeWildlife(W: World, scene: THREE.Scene) {
  /* two red deer grazing by the creek downstream of the first crossing */
  const c = W.rp(W.firstCross);
  let anchor = W.streamPts[0];
  let bestE = 1e9;
  for (const p of W.streamPts) { const d = Math.hypot(p.x - c.x, p.z - c.z), e = Math.abs(d - 30); if (d > 22 && d < 40 && e < bestE) { bestE = e; anchor = p; } }
  const herd = [0, 1].map(k => {
    const d = makeDeer(); scene.add(d.g);
    if (k === 1) d.g.scale.setScalar(0.82);
    const x = anchor.x + 3 + k * 2.6, z = anchor.z + (k ? 2 : -1.5);
    return { d, x, z, yaw: rand() * 6.28, state: 'graze' as 'graze' | 'alert' | 'flee' | 'gone', t: 0, alertT: 0, vx: 0, vz: 0, phase: rand() * 10 };
  });
  const deerWatch: Watcher = { seen: 0, logged: false };

  /* a kestrel hovering over the meadow before the climb, calling now and then */
  const k = makeKestrel(); scene.add(k.g);
  const hoverAt = W.rp(Math.max(0.15, W.climbU - 0.06));
  const kes = { x: hoverAt.x + hoverAt.sx * 25, z: hoverAt.z + hoverAt.sz * 25, alt: 24, tx: 0, tz: 0, glide: 0, callIn: 6 + rand() * 10 };
  kes.tx = kes.x; kes.tz = kes.z;
  const kesWatch: Watcher = { seen: 0, logged: false };

  function update(dt: number, t: number, hour: number, pl: { x: number; z: number; speed: number; running: boolean; sneaking: boolean }, cam: THREE.Camera, onSee: (what: 'deer' | 'deerFled' | 'kestrel') => void) {
    const fear = pl.running ? 2 : pl.sneaking ? 0.5 : pl.speed < 0.1 ? 0.7 : 1;
    const camF = cam.getWorldDirection(new THREE.Vector3());
    const inView = (x: number, y: number, z: number, maxD: number) => { const d = v3(x - cam.position.x, y - cam.position.y, z - cam.position.z); const l = d.length(); return l < maxD && d.dot(camF) / l > 0.82; };

    let anyAlert = false;
    for (const h of herd) {
      const D = h.d, dist = Math.hypot(pl.x - h.x, pl.z - h.z);
      if (h.state === 'gone') { D.g.visible = false; continue; }
      if (h.state === 'graze' && dist < 42 * fear) { h.state = 'alert'; h.alertT = 0; }
      if (h.state === 'alert') {
        h.alertT += dt; anyAlert = true;
        if (dist < 22 * fear || (h.alertT > 6 && dist < 30 * fear)) {
          h.state = 'flee'; let ax = h.x - pl.x, az = h.z - pl.z; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
          const sd = rand() < 0.5 ? 1 : -1; h.vx = (ax * 0.8 - az * 0.3 * sd) * 7.5; h.vz = (az * 0.8 + ax * 0.3 * sd) * 7.5; h.t = 0;
          if (h === herd[0]) { const toD = v3(h.x - cam.position.x, 0, h.z - cam.position.z).normalize(), right = v3(-camF.z, 0, camF.x).normalize(); deerFlee(clamp(-toD.dot(right), -1, 1)); onSee('deerFled'); }
        } else if (h.alertT > 14 && dist > 50 * fear) h.state = 'graze';
      }
      if (h.state === 'flee') {
        h.t += dt; h.x += h.vx * dt; h.z += h.vz * dt;
        h.yaw = Math.atan2(h.vx, h.vz);
        if (h.t > 9) h.state = 'gone';
      }
      /* pose */
      const y = W.groundAt(h.x, h.z);
      const bound = h.state === 'flee' ? Math.abs(Math.sin(h.t * 7)) * 0.5 : 0;
      D.g.position.set(h.x, y + bound, h.z);
      if (h.state === 'alert') h.yaw += wrapA(Math.atan2(pl.x - h.x, pl.z - h.z) - h.yaw) * (1 - Math.exp(-dt * 2)) * 0.5;
      D.g.rotation.y = h.yaw;
      const headUp = h.state === 'graze' ? (Math.sin(t * 0.3 + h.phase) > 0.85 ? 1 : 0) : 1;
      const want = lerp(1.95 + Math.sin(t * 2.4 + h.phase) * 0.05, h.state === 'flee' ? 0.5 : 0.15, headUp);
      D.neck.rotation.x = lerp(D.neck.rotation.x, want, 1 - Math.exp(-dt * 5));
      D.legs.forEach((l, i) => { l.rotation.x = h.state === 'flee' ? Math.sin(h.t * 14 + (i < 2 ? 0 : Math.PI)) * 0.8 : 0; });
      if (h.state !== 'flee' && inView(h.x, y + 1, h.z, 60)) deerWatch.seen += dt;
    }
    if (!deerWatch.logged && deerWatch.seen > 1.2) { deerWatch.logged = true; onSee('deer'); }
    void anyAlert;

    /* kestrel: hovers with fast wingbeats, glides to a new spot now and then */
    if (hour > 6.5 && hour < 19.5) {
      k.g.visible = true;
      kes.glide -= dt;
      if (kes.glide < -12 - rand() * 10) { kes.glide = 4; const a = rand() * 6.28, r = 15 + rand() * 25; kes.tx = hoverAt.x + hoverAt.sx * 25 + Math.cos(a) * r; kes.tz = hoverAt.z + hoverAt.sz * 25 + Math.sin(a) * r; }
      const gliding = kes.glide > 0;
      kes.x = lerp(kes.x, kes.tx, gliding ? dt * 0.6 : dt * 0.05); kes.z = lerp(kes.z, kes.tz, gliding ? dt * 0.6 : dt * 0.05);
      const y = W.heightAt(kes.x, kes.z) + kes.alt + Math.sin(t * 1.3) * 0.3;
      k.g.position.set(kes.x + Math.sin(t * 2.1) * 0.15, y, kes.z);
      k.g.rotation.y = Math.atan2(pl.x - kes.x, pl.z - kes.z) + Math.PI * 0.5;
      const flap = gliding ? 0.15 : Math.sin(t * 28) * 0.7;
      k.wings[0].rotation.z = flap; k.wings[1].rotation.z = -flap;
      k.g.scale.setScalar(1.6);
      const dist = Math.hypot(pl.x - kes.x, pl.z - kes.z);
      kes.callIn -= dt;
      if (kes.callIn < 0) { kes.callIn = 22 + rand() * 30; if (dist < 160) { const toK = v3(kes.x - cam.position.x, 0, kes.z - cam.position.z).normalize(), right = v3(-camF.z, 0, camF.x).normalize(); kestrelCall(clamp(-toK.dot(right), -1, 1), dist); } }
      if (inView(kes.x, y, kes.z, 70)) kesWatch.seen += dt;
      if (!kesWatch.logged && kesWatch.seen > 1.5) { kesWatch.logged = true; onSee('kestrel'); }
    } else k.g.visible = false;
  }
  return { update, kestrelPos: () => k.g.position, herdPos: () => herd.find(h => h.state !== 'gone')?.d.g.position ?? null };
}
