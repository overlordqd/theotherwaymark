import * as THREE from 'three';
import { clamp, lerp, wrapA, rand, v3 } from './util';
import { makePerson, poseWalk, poseSit, look, type Person } from './figures';
import { footstep, pebbles, lampClick, type Surface } from './audio';
import type { World } from './world';

export const keys = new Set<string>();
const mouse = { dx: 0, dy: 0, wheel: 0, drag: false, locked: false };

export function bindInput(canvas: HTMLCanvasElement, isFree: () => boolean) {
  window.addEventListener('keydown', e => { if (!(e.target instanceof HTMLInputElement)) keys.add(e.code); });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('click', () => { if (isFree() && !mouse.locked) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { mouse.locked = document.pointerLockElement === canvas; });
  canvas.addEventListener('mousedown', e => { if (e.button === 2) mouse.drag = true; });
  window.addEventListener('mouseup', () => { mouse.drag = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousemove', e => { if (mouse.locked || mouse.drag) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
  canvas.addEventListener('wheel', e => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
}
export const releasePointer = () => { if (document.pointerLockElement) document.exitPointerLock(); };

/** Small stones kicked up by your boots: they hop, land and lie still for a moment. */
function makePebbles(scene: THREE.Scene) {
  const geo = new THREE.BoxGeometry(0.09, 0.07, 0.09), cols = ['#8a8378', '#9a9284', '#6f6a62', '#a39a88'];
  const pool = Array.from({ length: 36 }, (_, i) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: cols[i % 4] })); m.visible = false; scene.add(m); return { m, v: v3(0, 0, 0), life: 0, rest: false }; });
  let next = 0;
  return {
    kick(x: number, y: number, z: number, fx: number, fz: number, n: number) {
      for (let k = 0; k < n; k++) {
        const p = pool[next++ % pool.length]; p.m.visible = true; p.life = 1.6; p.rest = false; p.m.scale.setScalar(0.6 + rand() * 0.8);
        p.m.position.set(x + (rand() - 0.5) * 0.2, y + 0.06, z + (rand() - 0.5) * 0.2);
        const sp = 0.8 + rand() * 1.4, side = (rand() - 0.5) * 1.6;
        p.v.set(fx * sp + fz * side, 1 + rand() * 1.4, fz * sp - fx * side);
      }
    },
    update(dt: number, groundAt: (x: number, z: number) => number) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.life -= dt; if (p.life <= 0) { p.m.visible = false; continue; }
        if (!p.rest) {
          p.v.y -= 9.8 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 9; p.m.rotation.z += dt * 7;
          const g = groundAt(p.m.position.x, p.m.position.z) + 0.03;
          if (p.m.position.y < g) { p.m.position.y = g; if (Math.abs(p.v.y) < 1.2) p.rest = true; else { p.v.y *= -0.3; p.v.x *= 0.5; p.v.z *= 0.5; } }
        }
        if (p.life < 0.4) p.m.scale.multiplyScalar(0.92);
      }
    }
  };
}

export function makePlayer(W: World, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const hiker: Person = makePerson({ jacket: '#2f6f8f', collar: '#245a74', pack: '#d9822b', packDark: '#a65f1c', hat: '#b8443a', hatBand: '#8f3027', pom: '#e9dcc4', pants: '#3b3a40', skin: '#e2b48e', skinDark: '#c8946c', hair: '#4a3222', headlamp: true });
  scene.add(hiker.g);
  /* the soft spill of light a headlamp throws on the ground around you */
  const spill = new THREE.PointLight(0xffe8c8, 0, 7, 1.6); spill.position.set(0, 1.2, 0.8); hiker.g.add(spill);
  const stones = makePebbles(scene);
  const P = {
    hiker, x: 0, z: 0, yaw: 0, camYaw: 0, camPitch: 0.32, camDist: 6.5,
    energy: 92, speed: 0, climb: 0, sitting: false, frozen: false, lampOn: false, lampLevel: 0,
    lookTarget: null as THREE.Vector3 | null, distance: 0, running: false, sneaking: false,
    camPos: v3(0, 0, 0), camLook: v3(0, 0, 0), snap: true, camNear: 6.5
  };

  function place(x: number, z: number, yaw: number) { P.x = x; P.z = z; P.yaw = yaw; P.camYaw = yaw; P.snap = true; hiker.prev = null; }
  function surfaceAt(x: number, z: number): Surface {
    if (Math.hypot(x - W.lodge.door.x, z - W.lodge.door.z) < 2.5) return 'wood';
    if (Math.hypot(x - W.TOWN.x, z - W.TOWN.z) < 40) return 'stone';
    const s = W.streamAt(x, z); if (s.p && s.d < 2.2) return 'creek';
    if (W.forestAt(x, z) > 0.5) return 'soft';
    return W.trailDist(x, z) < 1.3 ? 'gravel' : 'soft';
  }
  function setLamp(on: boolean) { if (P.lampOn === on) return; P.lampOn = on; lampClick(on); }

  function update(dt: number, allowMove: boolean) {
    /* camera control */
    P.camYaw -= mouse.dx * 0.0032; P.camPitch = clamp(P.camPitch + mouse.dy * 0.0026, -0.15, 1.2); mouse.dx = mouse.dy = 0;
    P.camDist = clamp(P.camDist + mouse.wheel * 0.7, 2.6, 14); mouse.wheel = 0;

    /* movement relative to the camera */
    let mx = 0, mz = 0;
    if (allowMove && !P.frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx -= 1;
    }
    const moving = mx !== 0 || mz !== 0;
    if (moving && P.sitting) P.sitting = false;
    P.running = moving && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && P.energy > 8;
    P.sneaking = moving && (keys.has('KeyC') || keys.has('ControlLeft'));
    let target = 0;
    if (moving) {
      const fx = Math.sin(P.camYaw), fz = Math.cos(P.camYaw);
      let dx = fx * mz + fz * mx, dz = fz * mz - fx * mx; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const want = Math.atan2(dx, dz);
      P.yaw += wrapA(want - P.yaw) * (1 - Math.exp(-dt * 10));
      target = P.running ? 3.0 : P.sneaking ? 0.65 : 1.45;
      /* slopes: climbing slows you, too steep stops you */
      const h0 = W.heightAt(P.x, P.z), h1 = W.heightAt(P.x + dx * 0.6, P.z + dz * 0.6), g = (h1 - h0) / 0.6;
      if (g > 0) target *= clamp(1 - g * 1.4, 0.3, 1); else target *= clamp(1 + g * 0.5, 0.65, 1);
      if (P.energy < 25) target *= 0.72; if (P.energy < 8) target *= 0.6;
      P.speed = lerp(P.speed, target, 1 - Math.exp(-dt * 6));
      const step = P.speed * dt;
      if (g > 1.0) P.speed *= 0.3;
      const nx = P.x + dx * step, nz = P.z + dz * step;
      const ok = (x: number, z: number) => !W.blocked(x, z, 0.32) && (W.heightAt(x, z) - h0) / Math.max(1e-3, Math.hypot(x - P.x, z - P.z)) < 1.05;
      if (ok(nx, nz)) { P.x = nx; P.z = nz; } else if (ok(nx, P.z)) P.x = nx; else if (ok(P.x, nz)) P.z = nz; else P.speed = 0;
      P.distance += step;
      P.climb = Math.max(0, g) * P.speed;
    } else { P.speed = lerp(P.speed, 0, 1 - Math.exp(-dt * 8)); P.climb = 0; }

    /* energy: walking and climbing tire you, rest brings it back */
    const drain = (P.speed > 0.2 ? 0.035 : 0) + P.climb * 0.45 + (P.running ? 0.3 : 0);
    const gain = P.sitting ? 2.4 : P.speed < 0.1 ? 0.12 : 0;
    P.energy = clamp(P.energy - drain * dt + gain * dt, 0, 100);

    /* the hiker's body */
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    if (P.sitting) {
      const g = W.groundAt(P.x, P.z);
      poseSit(hiker, P.x, P.z, P.yaw, g, 0.34);
      hiker.legs.forEach(lg => { lg.hip.rotation.x = -1.4; lg.knee.rotation.x = 0.35; });
    } else {
      const lean = P.climb > 0.2 ? 0.12 : 0;
      const stepped = poseWalk(hiker, P.x, P.z, P.yaw, dt, W.groundAt, { lean, amp: P.running ? 0.75 : P.sneaking ? 0.3 : 0.5 });
      if (stepped) {
        const surf = surfaceAt(P.x, P.z);
        footstep(surf, P.sneaking ? 0.35 : P.running ? 1.25 : 1);
        if ((surf === 'gravel' || surf === 'stone' || surf === 'creek') && rand() < (P.running ? 0.9 : 0.45)) {
          const n = P.running ? 3 : 1 + Math.floor(rand() * 2);
          stones.kick(P.x + fx * 0.25, W.groundAt(P.x, P.z), P.z + fz * 0.25, -fx, -fz, n); pebbles(n);
        }
      }
    }
    look(hiker, P.lookTarget, dt, 0.9);
    stones.update(dt, W.groundAt);

    /* headlamp */
    if (keys.has('KeyL')) { keys.delete('KeyL'); setLamp(!P.lampOn); }
    const L = hiker.lamp!; L.on = P.lampOn;
    P.lampLevel = lerp(P.lampLevel, P.lampOn ? 1 : 0, 1 - Math.exp(-dt * 18));
    L.spot.intensity = P.lampLevel * 3.4; spill.intensity = P.lampLevel * 0.7; (L.beam.material as THREE.MeshBasicMaterial).opacity = P.lampLevel * 0.05;
    L.lensMat.color.setRGB(lerp(0.33, 1, P.lampLevel), lerp(0.34, 0.97, P.lampLevel), lerp(0.37, 0.88, P.lampLevel));

    /* camera: behind and above, never inside a hill */
    const tx = P.x, ty = hiker.g.position.y + 1.45, tz = P.z;
    /* pull the camera in if a tree crown or a building is between it and the hiker */
    let cd = P.camDist * lerp(1, 0.62, W.forestAt(P.x, P.z)); const cp = Math.cos(P.camPitch), spn = Math.sin(P.camPitch);
    for (let d = 1.2; d <= cd; d += 0.4) {
      const sx = tx - Math.sin(P.camYaw) * d * cp, sz = tz - Math.cos(P.camYaw) * d * cp, sy = ty + d * spn;
      if (W.occludes(sx, sy, sz)) { cd = Math.max(1.4, d - 0.5); break; }
    }
    P.camNear = lerp(P.camNear, cd, 1 - Math.exp(-dt * (cd < P.camNear ? 14 : 2.5))); cd = P.camNear;
    const cx = tx - Math.sin(P.camYaw) * cd * cp, cz = tz - Math.cos(P.camYaw) * cd * cp;
    let cy = ty + cd * spn; cy = Math.max(cy, W.heightAt(cx, cz) + 0.6);
    const goal = v3(cx, cy, cz), goalLook = v3(tx, ty, tz);
    if (P.snap) { P.camPos.copy(goal); P.camLook.copy(goalLook); P.snap = false; }
    else { const k = 1 - Math.exp(-dt * 10); P.camPos.lerp(goal, k); P.camLook.lerp(goalLook, k); }
    camera.position.copy(P.camPos); camera.lookAt(P.camLook);
    W.clearView(P.camPos, v3(tx, ty, tz));
  }

  function toggleSit() { if (P.speed < 0.3) P.sitting = !P.sitting; }
  return { P, place, update, setLamp, toggleSit, surfaceAt };
}
export type Player = ReturnType<typeof makePlayer>;
