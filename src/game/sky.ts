import * as THREE from 'three';
import { lerp, smooth } from './util';
import type { World } from './world';

/* Colours of the day, keyed by hour: sky top, horizon, sun or moon light (colour, strength), ambient (colour, strength). */
const KEYS = ([
  [0,    '#070b1c', '#17223f', '#7d93c8', 0.5,  '#2a3560', 0.6],
  [4.5,  '#0a0f24', '#26294d', '#7d93c8', 0.4,  '#2c3058', 0.55],
  [5.6,  '#1f2550', '#a0607a', '#c98a8a', 0.35, '#5a4a70', 0.6],
  [6.6,  '#3c5c96', '#f3a35c', '#ffb27a', 0.95, '#7a6a86', 0.7],
  [8.5,  '#5b8fcc', '#d7e4e2', '#fff0d6', 1.05, '#9fb0bf', 0.75],
  [13,   '#4a88cc', '#dcebf1', '#ffffff', 1.12, '#a9bccb', 0.8],
  [16.5, '#5a84bf', '#eed9ae', '#ffe2a8', 1.05, '#a8a8b0', 0.75],
  [18.8, '#3d4378', '#f08d5a', '#ff8a52', 0.9,  '#8a6a80', 0.7],
  [20,   '#262a55', '#a35f7c', '#d07a7a', 0.35, '#584a74', 0.6],
  [21.3, '#0b1230', '#25325e', '#8ea4d8', 0.55, '#2c3866', 0.62],
  [24,   '#070b1c', '#17223f', '#7d93c8', 0.5,  '#2a3560', 0.6]
] as const).map(k => ({ h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), light: new THREE.Color(k[3]), li: k[4], amb: new THREE.Color(k[5]), ai: k[6] }));

const tA = new THREE.Color(), tB = new THREE.Color(), tC = new THREE.Color(), tD = new THREE.Color();
export const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
export const light = { nightF: 0, dayLight: 1, canopyCam: 0 };

/**
 * Sets sky, fog, sun or moon and ambient light for an hour of the day.
 * moonlight is how bright the night is: about 0.45 at full moon, 0.05 at new moon.
 */
export function applyTime(W: World, hour: number, camera: THREE.Camera, moonlight: number) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smooth(0, 1, (hour - a.h) / (b.h - a.h));
  tA.copy(a.top).lerp(b.top, t); tB.copy(a.hor).lerp(b.hor, t); tC.copy(a.light).lerp(b.light, t); tD.copy(a.amb).lerp(b.amb, t);
  const li = lerp(a.li, b.li, t), ai = lerp(a.ai, b.ai, t);
  const ang = (hour - 5.8) / 14.6 * Math.PI;
  sunDir.set(-Math.cos(ang), Math.sin(ang) * 0.82, -0.45).normalize();
  moonDir.set(Math.cos(ang), -Math.sin(ang) * 0.82 + 0.12, 0.45).normalize();
  const nightF = 1 - smooth(-0.14, 0.06, sunDir.y);
  const canopyCam = W.forestAt(camera.position.x, camera.position.z);
  const dayLight = smooth(-0.16, 0.22, sunDir.y), shade = canopyCam * (0.4 + 0.4 * (1 - dayLight));
  const moonK = moonlight / 0.45, moonDim = lerp(1, 0.42, nightF * (1 - moonK));
  tA.multiplyScalar(moonDim); tB.multiplyScalar(moonDim); tD.multiplyScalar(moonDim);
  const s = (W.sky.material as THREE.ShaderMaterial).uniforms;
  s.top.value.copy(tA); s.hor.value.copy(tB); s.sunDir.value.copy(sunDir); s.sunCol.value.copy(tC); s.sunVis.value = 1 - nightF;
  const fog = W.sky.parent ? (W.sky.parent as THREE.Scene).fog as THREE.FogExp2 : null;
  if (fog) { fog.color.copy(tB).multiplyScalar(0.92 * (1 - 0.7 * shade)); fog.density = lerp(0.0042, 0.0062, nightF) + shade * 0.014; }
  W.hemi.color.copy(tD); W.hemi.groundColor.copy(tD).multiplyScalar(0.45); W.hemi.intensity = ai * (1 - shade);
  W.dir.color.copy(tC); W.dir.intensity = li * Math.max(0, 1 - 1.1 * shade) * lerp(1, moonK, nightF);
  const ld = nightF > 0.5 ? moonDir : sunDir;
  W.dir.target.position.copy(camera.position); W.dir.position.copy(camera.position).addScaledVector(ld, 200);
  (W.stars.material as THREE.PointsMaterial).opacity = smooth(0.55, 1, nightF) * lerp(0.9, 1, 1 - moonK) * (1 - canopyCam * 0.7);
  W.winMat.color.set(0x39404c).lerp(tA.set(0xffc66e), smooth(0.25, 0.8, nightF));
  W.lampLight.intensity = smooth(0.3, 0.9, nightF) * 1.4;
  W.lodgeLight.intensity = smooth(0.2, 0.8, nightF) * 1.6;
  W.flowerMat.color.setScalar(lerp(1, 0.22, nightF));
  W.waterMat.color.copy(s.top.value).lerp(tB, 0.45).multiplyScalar(0.95);
  W.waterMat.specular.copy(tC); W.creekMat.specular.copy(tC).multiplyScalar(0.35);
  W.creekMat.color.copy(W.waterMat.color).lerp(tA.set(0x9fc0d0), 0.35 * (1 - nightF));
  W.sky.position.copy(camera.position); W.stars.position.copy(camera.position);
  light.nightF = nightF; light.dayLight = dayLight; light.canopyCam = canopyCam;
  return { nightF, dayLight, moonK };
}

/** How much light reaches a spot: daylight, else moonlight, less under trees, more by a fire. */
export function lightAt(W: World, x: number, z: number, moonlight: number) {
  return Math.max(light.dayLight, moonlight * light.nightF) * (1 - 0.7 * W.forestAt(x, z));
}

export function fmtClock(h: number) { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
