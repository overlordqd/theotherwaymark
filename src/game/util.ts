import * as THREE from 'three';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smooth 0..1 ramp between a and b (Hermite), used everywhere for gentle transitions. */
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** 1 inside [a, b], easing in and out over e on each side. */
export const win = (h: number, a: number, b: number, e: number) => smooth(a - e, a, h) * (1 - smooth(b, b + e, h));
export const wrapA = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const rand = Math.random;

export type RGB = [number, number, number];
export const hx = (h: string): RGB => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export const mix3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Small fast seeded random generator: the same seed always grows the same valley. */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** 2D simplex noise, seeded. Returns roughly -1..1. */
export function makeNoise(seed: number) {
  const r = mulberry32(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (x: number, y: number) {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255; let n = 0, g: number[];
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { t0 *= t0; g = G[perm[ii + perm[jj]] & 7]; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { t1 *= t1; g = G[perm[ii + i1 + perm[jj + j1]] & 7]; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { t2 *= t2; g = G[perm[ii + 1 + perm[jj + 1]] & 7]; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  };
}

/** A grid of buckets for finding the nearest point (trail, creek, trees) quickly. */
export interface Pt { x: number; z: number; y?: number; i?: number }
export function mkHash<T extends Pt>(pts: T[], cell: number) {
  const m = new Map<string, T[]>();
  for (const p of pts) { const k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell); let l = m.get(k); if (!l) { l = []; m.set(k, l); } l.push(p); }
  return { m, cell };
}
export function nearest<T extends Pt>(h: { m: Map<string, T[]>; cell: number }, x: number, z: number) {
  const ci = Math.floor(x / h.cell), cj = Math.floor(z / h.cell); let best = 1e18, bp: T | null = null;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = h.m.get((ci + a) + ',' + (cj + b)); if (!l) continue;
    for (const p of l) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bp = p; } }
  }
  return { d: Math.sqrt(best), p: bp };
}

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
