/* Everything you hear is synthesised here with the Web Audio API: no sound files. */
import { clamp, win, smooth, rand } from './util';

type Loop = { s: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode };
interface Engine {
  ctx: AudioContext; master: GainNode; fx: GainNode; verbIn: GainNode; musicBus: GainNode; white: AudioBuffer;
  wind: Loop; air: Loop; lake: Loop; creek: Loop; creek2: Loop; fireBed: Loop;
  plucks: Map<number, AudioBuffer>;
}
let E: Engine | null = null;
export const audioOn = () => !!E;
export const now = () => (E ? E.ctx.currentTime : 0);

export function initAudio() {
  if (E) { if (E.ctx.state === 'suspended') E.ctx.resume(); return; }
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor(), sr = ctx.sampleRate;
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const len = sr * 3;
    const white = ctx.createBuffer(1, len, sr), wd = white.getChannelData(0); for (let i = 0; i < len; i++) wd[i] = rand() * 2 - 1;
    const brown = ctx.createBuffer(1, len, sr), bd = brown.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (rand() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    /* a long, soft reverb: the valley */
    const irLen = Math.floor(sr * 3.6), ir = ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < irLen; i++) { lp = lp * 0.6 + (rand() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / irLen, 2.6) * (i < sr * 0.02 ? i / (sr * 0.02) : 1); } }
    const conv = ctx.createConvolver(); conv.buffer = ir; const verbIn = ctx.createGain(); const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
    verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(master);
    const loop = (buf: AudioBuffer, type: BiquadFilterType, f: number, q: number): Loop => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(0, rand() * 2); return { s, f: fl, g }; };
    const fx = ctx.createGain(); fx.connect(master);
    const musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master); const ms = ctx.createGain(); ms.gain.value = 0.35; musicBus.connect(ms); ms.connect(verbIn);
    E = {
      ctx, master, fx, verbIn, musicBus, white, plucks: new Map(),
      wind: loop(brown, 'lowpass', 500, 0.5), air: loop(white, 'bandpass', 700, 0.4), lake: loop(brown, 'lowpass', 700, 0.7),
      creek: loop(white, 'bandpass', 1500, 0.9), creek2: loop(brown, 'bandpass', 500, 0.8), fireBed: loop(white, 'lowpass', 280, 0.7)
    };
  } catch { E = null; }
}
export function setMuted(m: boolean) { if (E) E.master.gain.setTargetAtTime(m ? 0 : 0.9, E.ctx.currentTime, 0.1); }
export function suspend(p: boolean) { if (E) { if (p) E.ctx.suspend(); else E.ctx.resume(); } }

const tgt = (p: AudioParam, v: number, tc = 0.6) => { if (E) p.setTargetAtTime(v, E.ctx.currentTime, tc); };
function outNode(pan: number | null, wet = 0) {
  const ctx = E!.ctx, g = ctx.createGain(); let o: AudioNode = g;
  if (pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); o = p; }
  o.connect(E!.fx);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; o.connect(s); s.connect(E!.verbIn); }
  return g;
}
interface BurstOpts { when?: number; type?: BiquadFilterType; freq?: number; q?: number; gain: number; attack?: number; dur: number; pan?: number | null; wet?: number; dest?: AudioNode }
function burst(o: BurstOpts) {
  const ctx = E!.ctx, t = o.when || ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = E!.white;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  s.connect(f); f.connect(g); g.connect(o.dest || outNode(o.pan ?? null, o.wet)); s.start(t, rand() * 2.5, o.dur + 0.05);
}
interface ToneOpts { when?: number; f: number; f2?: number; glide?: number; dur: number; gain: number; attack?: number; wave?: OscillatorType; vib?: number; vibDepth?: number; pan?: number | null; wet?: number; dest?: AudioNode }
function tone(o: ToneOpts) {
  const ctx = E!.ctx, t = o.when || ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = o.wave || 'sine'; osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibDepth || 20; l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + o.dur + 0.1); }
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(o.dest || outNode(o.pan ?? null, o.wet)); osc.start(t); osc.stop(t + o.dur + 0.05);
}
const rp = () => rand() * 1.6 - 0.8;

/* ---------- birds and animals ---------- */
export function blackbird() { if (!E) return; const dest = outNode(rp(), 0.25 + rand() * 0.3); let t = now(); const n = 4 + Math.floor(rand() * 4), base = 1500 + rand() * 600;
  for (let k = 0; k < n; k++) { const f = base * (0.8 + rand() * 0.7), d = 0.12 + rand() * 0.16; tone({ when: t, f, f2: f * (0.85 + rand() * 0.35), dur: d, gain: 0.05, attack: 0.02, vib: 9, vibDepth: 25, dest }); t += d + 0.03 + rand() * 0.05; }
  for (let k = 0; k < 4; k++) { const f = 3600 + rand() * 1600; tone({ when: t, f, f2: f * 0.8, dur: 0.04, gain: 0.025, attack: 0.004, dest }); t += 0.05; } }
export function robin() { if (!E) return; const dest = outNode(rp(), 0.3); let t = now(); const n = 6 + Math.floor(rand() * 6);
  for (let k = 0; k < n; k++) { const f = 2600 + rand() * 4200, d = 0.05 + rand() * 0.07; tone({ when: t, f, f2: f * (0.75 + rand() * 0.6), dur: d, gain: 0.035, attack: 0.006, dest }); t += d + 0.02 + rand() * 0.04; } }
export function chaffinch() { if (!E) return; const dest = outNode(rp(), 0.25); let t = now(), f = 5200 + rand() * 600, gap = 0.11;
  for (let k = 0; k < 12; k++) { tone({ when: t, f, f2: f * 0.86, dur: 0.05, gain: 0.03, attack: 0.004, dest }); t += gap; gap *= 0.93; f *= 0.965; }
  tone({ when: t + 0.02, f: f * 1.15, f2: f * 0.6, dur: 0.22, gain: 0.04, attack: 0.01, dest }); }
export function rooster() { if (!E) return; const ctx = E.ctx, t = now(), dest = outNode(-0.5 + rand(), 0.7);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 1200; bpf.Q.value = 2.2; const g = ctx.createGain();
  let tt = t; o.frequency.setValueAtTime(520, t);
  ([[0.14, 520, 720], [0.1, 720, 640], [0.16, 640, 840], [0.65, 840, 560]] as const).forEach(([d, a, b]) => { o.frequency.setValueAtTime(a, tt); o.frequency.linearRampToValueAtTime(b, tt + d); tt += d; });
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.04); g.gain.setValueAtTime(0.03, tt - 0.25); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
  o.connect(bpf); bpf.connect(g); g.connect(dest); o.start(t); o.stop(tt + 0.2); }
export function woodPigeon() { if (!E) return; const dest = outNode(rp(), 0.45); let t = now(); const f = 400 + rand() * 60;
  ([[0.32, 1], [0.55, 1.08], [0.32, 1], [0.3, 0.98], [0.3, 0.98]] as const).forEach(([d, m], i) => { tone({ when: t, f: f * m, f2: f * m * 0.92, dur: d, gain: 0.05, attack: 0.08, dest }); t += d + (i === 2 ? 0.45 : 0.08); }); }
export function buzzard() { if (!E) return; const dest = outNode(rp(), 0.8); const f = 2000 + rand() * 300; tone({ f, f2: f * 0.6, dur: 1.2, glide: 1.1, gain: 0.03, attack: 0.15, vib: 6, vibDepth: 15, dest }); tone({ f: f * 2, f2: f * 1.2, dur: 1.0, glide: 1.0, gain: 0.006, attack: 0.15, dest }); }
/** Kestrel: a sharp, quick "kee-kee-kee-kee", from where the bird is. */
export function kestrel(pan: number, dist: number) { if (!E) return; const v = clamp(1.4 - dist / 120, 0.15, 1), dest = outNode(pan, 0.4); let t = now(); const f = 3100 + rand() * 300, n = 4 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) { tone({ when: t, f: f * 1.06, f2: f * 0.92, dur: 0.11, gain: 0.05 * v, attack: 0.006, wave: 'triangle', dest }); tone({ when: t, f: f * 2.1, dur: 0.06, gain: 0.008 * v, attack: 0.004, dest }); t += 0.15; } }
export function cicada() { if (!E) return; const ctx = E.ctx, t = now(), d = 1.5 + rand() * 3, s = ctx.createBufferSource(); s.buffer = E.white;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6200 + rand() * 1500; f.Q.value = 3.5;
  const am = ctx.createGain(); am.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28 + rand() * 20; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
  const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.05, t + 0.4); env.gain.setValueAtTime(0.05, t + d - 0.4); env.gain.linearRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(am); am.connect(env); env.connect(outNode(rand() * 1.8 - 0.9, 0.1)); s.start(t, rand() * 2); s.stop(t + d + 0.1); lfo.start(t); lfo.stop(t + d + 0.1); }
export function woodpecker() { if (!E) return; const dest = outNode(rp(), 0.6); let t = now(), gap = 0.05; for (let k = 0; k < 16; k++) { burst({ when: t, freq: 700 + rand() * 100, q: 2.5, gain: 0.09 * (1 - k / 22), dur: 0.025, attack: 0.001, dest }); t += gap; gap *= 1.015; } }
export function owl() { if (!E) return; const dest = outNode(rp(), 0.7); let t = now(); const f = 400 + rand() * 30;
  tone({ when: t, f, f2: f * 0.96, dur: 0.75, gain: 0.045, attack: 0.12, dest }); t += 1.6;
  for (let k = 0; k < 3; k++) { tone({ when: t, f: f * 0.92, dur: 0.12, gain: 0.03, attack: 0.02, dest }); t += 0.16; }
  tone({ when: t + 0.1, f, f2: f * 0.94, dur: 1.2, gain: 0.045, attack: 0.1, vib: 7, vibDepth: 30, dest }); }
export function frog() { if (!E) return; const dest = outNode(rand() * 1.2 - 0.6, 0.3); let t = now(); for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) { tone({ when: t, f: 140 + rand() * 30, dur: 0.14, gain: 0.04, attack: 0.01, wave: 'sawtooth', dest }); t += 0.22; } }
function cricket(pan: number, f: number, vol: number) { const dest = outNode(pan, 0.1); let t = now(); for (let k = 0; k < 3; k++) { tone({ when: t, f, dur: 0.03, gain: vol, attack: 0.004, dest }); t += 0.05; } }
function plip() { const f = 900 + rand() * 900; tone({ f, f2: f * 1.7, dur: 0.06, gain: 0.02 + rand() * 0.02, attack: 0.003, pan: rand() * 0.8 - 0.4, wet: 0.2 }); }
export function bell(when: number) { if (!E) return; const lp = E.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.connect(outNode(0, 0.6));
  ([[0.5, 0.5, 6], [1, 1, 4.5], [1.19, 0.55, 3.5], [1.56, 0.4, 2.8], [2, 0.32, 2.2], [2.51, 0.2, 1.6], [3.01, 0.14, 1.2]] as const).forEach(([r, a, d]) => tone({ when, f: 220 * r, dur: d, gain: 0.05 * a, attack: 0.004, dest: lp })); }
/** A deer's alarm: a hoarse bark, then the drum of hooves going away. */
export function deerFlee(pan: number) { if (!E) return; const dest = outNode(pan, 0.5); let t = now();
  for (let k = 0; k < 2; k++) { burst({ when: t, freq: 900, q: 1.2, gain: 0.16, attack: 0.01, dur: 0.22, dest }); tone({ when: t, f: 260, f2: 190, dur: 0.2, gain: 0.05, wave: 'sawtooth', attack: 0.01, dest }); t += 0.55; }
  t = now() + 0.2; for (let k = 0; k < 14; k++) { burst({ when: t, type: 'lowpass', freq: 160, gain: 0.12 * (1 - k / 16), dur: 0.06, attack: 0.002, dest }); t += 0.13 + (k % 2) * 0.05; } }

export type Surface = 'stone' | 'gravel' | 'soft' | 'creek' | 'wood';
export function footstep(surface: Surface, vol = 1) {
  if (!E) return; const p = (rand() - 0.5) * 0.3, v = vol;
  if (surface === 'soft') { burst({ freq: 600 + rand() * 300, q: 0.7, gain: 0.12 * v, dur: 0.12, pan: p }); burst({ when: now() + 0.03, freq: 3500 + rand() * 1500, q: 0.6, gain: 0.04 * v, dur: 0.09, pan: p }); return; }
  if (surface === 'wood') { burst({ type: 'lowpass', freq: 320, gain: 0.25 * v, dur: 0.09, pan: p }); burst({ freq: 1200, q: 2, gain: 0.05 * v, dur: 0.05, pan: p }); return; }
  if (surface === 'creek') { burst({ freq: 1900, q: 0.9, gain: 0.16 * v, dur: 0.08, pan: p }); for (let k = 0; k < 3; k++) { const f = 700 + rand() * 900; tone({ when: now() + 0.02 + k * 0.03, f, f2: f * 1.6, dur: 0.05, gain: 0.025 * v, attack: 0.002, pan: p }); } return; }
  burst({ freq: surface === 'stone' ? 1900 : 900 + rand() * 500, q: 0.9, gain: 0.2 * v, dur: 0.09, pan: p });
  burst({ type: 'lowpass', freq: 200, gain: 0.16 * v, dur: 0.07, pan: p });
  burst({ when: now() + 0.025, freq: 2600 + rand() * 800, q: 1.2, gain: 0.05 * v, dur: 0.035, pan: p });
}
/** Small stones kicked by a boot, ticking as they land. */
export function pebbles(n: number) { if (!E) return; for (let k = 0; k < n; k++) burst({ when: now() + 0.08 + rand() * 0.35, freq: 2800 + rand() * 2200, q: 2.5, gain: 0.04 + rand() * 0.04, dur: 0.02, attack: 0.001, pan: (rand() - 0.5) * 0.4 }); }
export function breath(heavy: number) { if (!E) return; burst({ freq: 1300, q: 0.5, gain: 0.03 * heavy, attack: 0.5, dur: 0.95 }); burst({ when: now() + 1.05, freq: 850, q: 0.5, gain: 0.045 * heavy, attack: 0.12, dur: 1.2 }); }
export function lampClick(on: boolean) { if (!E) return; tone({ f: on ? 2400 : 1800, dur: 0.03, gain: 0.08, attack: 0.001 }); burst({ freq: 3000, q: 2, gain: 0.08, dur: 0.02, attack: 0.001 }); }
export function page() { if (!E) return; burst({ freq: 3200, q: 0.4, gain: 0.03, attack: 0.05, dur: 0.35, pan: 0.4 }); }
export function zipper() { if (!E) return; let t = now(); for (let k = 0; k < 34; k++) { burst({ when: t, freq: 2600 + k * 40, q: 2, gain: 0.07, attack: 0.002, dur: 0.018 }); t += 0.03 - k * 0.0003; } }

/* ---------- music: guitar arpeggios over a soft pad, one mode per mood ---------- */
const MODES: Record<string, number[]> = { ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10] };
const PATTERNS: Record<string, (number | 'S' | 's' | null)[]> = { arpUp: [0, 1, 2, 3, 4, 5, 4, 3], arpUpDown: [0, 2, 3, 4, 5, 4, 3, 2], travis: [0, 3, 1, 4, 0, 3, 1, 5], arpWide: [0, 2, 4, 5, 3, 5, 4, 2], sparse: [0, null, 3, null, null, 4, null, null], strum: ['S', null, null, null, 's', null, 2, null] };
interface Mood { mode: string; root: number; prog: number[]; bpm: number; pat: string; guitar: number; pad: number; cut: number; dens: number }
export const MOODS: Record<string, Mood> = {
  dawn:    { mode: 'lydian',     root: 50, prog: [0, 1, 0, 4], bpm: 66, pat: 'arpUp',     guitar: 0.8, pad: 0.7, cut: 1500, dens: 0.9 },
  morning: { mode: 'mixolydian', root: 43, prog: [0, 6, 3, 0], bpm: 84, pat: 'travis',    guitar: 1,   pad: 0.5, cut: 1800, dens: 0.9 },
  noon:    { mode: 'dorian',     root: 45, prog: [0, 3, 0, 6], bpm: 72, pat: 'arpUpDown', guitar: 0.8, pad: 0.45, cut: 1400, dens: 0.6 },
  view:    { mode: 'lydian',     root: 50, prog: [0, 1, 5, 1], bpm: 76, pat: 'arpWide',   guitar: 1,   pad: 0.9, cut: 2200, dens: 1 },
  mark:    { mode: 'phrygian',   root: 40, prog: [0, 1, 0, 6], bpm: 54, pat: 'sparse',    guitar: 0.8, pad: 0.9, cut: 700,  dens: 0.8 },
  evening: { mode: 'aeolian',    root: 40, prog: [0, 5, 2, 6], bpm: 68, pat: 'arpUpDown', guitar: 0.9, pad: 0.6, cut: 1100, dens: 0.85 },
  lodge:   { mode: 'ionian',     root: 48, prog: [0, 3, 4, 0], bpm: 80, pat: 'travis',    guitar: 0.9, pad: 0.3, cut: 1600, dens: 0.85 },
  camp:    { mode: 'dorian',     root: 50, prog: [0, 3, 0, 4], bpm: 60, pat: 'strum',     guitar: 0.7, pad: 0.35, cut: 900, dens: 0.8 }
};
const MID = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const noteOf = (m: Mood, i: number) => m.root + MODES[m.mode][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
function chordOf(m: Mood, deg: number) { let r = noteOf(m, deg); const i3 = noteOf(m, deg + 2) - r, i5 = noteOf(m, deg + 4) - r, i7 = noteOf(m, deg + 6) - r; while (r < 40) r += 12; while (r >= 52) r -= 12; return { r, i3, i5, i7 }; }
function pluckBuf(midi: number) {
  const e = E!; const have = e.plucks.get(midi); if (have) return have;
  const sr = e.ctx.sampleRate, n = Math.max(2, Math.round(sr / MID(midi))), len = Math.floor(sr * 2.6), buf = e.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const ring = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { a = a * 0.5 + (rand() * 2 - 1) * 0.5; b = b * 0.5 + a * 0.5; ring[i] = b * 1.6; }
  let idx = 0; for (let i = 0; i < len; i++) { const x0 = ring[idx], x1 = ring[(idx + 1) % n]; ring[idx] = (x0 + x1) * 0.5 * 0.996; d[i] = x0; idx = (idx + 1) % n; }
  e.plucks.set(midi, buf); return buf;
}
function pluckAt(midi: number, when: number, gain: number, pan: number) {
  const ctx = E!.ctx, s = ctx.createBufferSource(); s.buffer = pluckBuf(midi);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const g = ctx.createGain(); g.gain.value = gain;
  s.connect(lp); lp.connect(g); const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(E!.musicBus); s.start(when);
}
function padChord(c: ReturnType<typeof chordOf>, t: number, dur: number, m: Mood) {
  const ctx = E!.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.setValueAtTime(m.cut * 0.7, t); lp.frequency.linearRampToValueAtTime(m.cut, t + dur * 0.6);
  const g = ctx.createGain(), v = 0.02 * m.pad; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 1.4); g.gain.setValueAtTime(v, t + dur - 1.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  lp.connect(g); g.connect(E!.musicBus);
  const dark = m.mode === 'locrian' || m.mode === 'phrygian';
  [c.r - 12, c.r + c.i3, c.r + c.i5, c.r + c.i7 - (dark ? 0 : 12)].forEach(n => [-7, 7].forEach(de => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = MID(n); o.detune.value = de; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }));
}
/* Music plays in passages, with rests in between, so it never becomes wallpaper. */
const music = { mood: '' as string, next: 0, step: 0, bar: 0, chord: null as null | ReturnType<typeof chordOf>, playing: false, phaseEnd: 0, gain: -1, override: '' as string, overrideEnd: 0 };
export function musicMoment(mood: string, secs: number) { music.override = mood; music.overrideEnd = now() + secs; music.playing = true; music.phaseEnd = now() + secs; }
function musicTick(baseMood: string | null, level: number) {
  const e = E!, t0 = e.ctx.currentTime;
  if (music.override && t0 > music.overrideEnd) music.override = '';
  const want = music.override || baseMood;
  if (t0 > music.phaseEnd) { music.playing = !music.playing; music.phaseEnd = t0 + (music.playing ? 70 + rand() * 50 : 40 + rand() * 50); }
  const on = want && (music.playing || music.override) ? level : 0;
  if (music.gain !== on) { music.gain = on; tgt(e.musicBus.gain, on * 0.9, on ? 2.5 : 3.5); }
  if (!want || !on) { music.mood = ''; return; }
  const m = MOODS[want], sd = 60 / m.bpm / 2;
  if (music.mood !== want) { music.mood = want; music.step = 0; music.bar = 0; music.next = Math.max(music.next, t0 + 0.05); }
  if (music.next < t0 - 0.5) music.next = t0 + 0.05;
  while (music.next < t0 + 0.2) {
    const t = music.next;
    if (music.step % 8 === 0) { music.chord = chordOf(m, m.prog[music.bar % m.prog.length]); if (m.pad > 0) padChord(music.chord, t, sd * 8 + 1.2, m); music.bar++; }
    const c = music.chord!, v = [c.r, c.r + c.i5, c.r + 12, c.r + 12 + c.i3, c.r + 12 + c.i5, c.r + 24];
    const ev = PATTERNS[m.pat][music.step % 8];
    if (ev != null && (music.step % 8 === 0 || rand() < m.dens)) {
      if (ev === 'S' || ev === 's') v.forEach((n, k) => pluckAt(n, t + k * 0.028, (ev === 'S' ? 0.07 : 0.045) * m.guitar, -0.3 + k * 0.12));
      else pluckAt(v[ev], t, (ev === 0 ? 0.11 : 0.085) * m.guitar, -0.25 + ev * 0.1);
    }
    music.step++; music.next += sd;
  }
}

/* ---------- the soundscape: what you hear depends on the hour and where you stand ---------- */
export interface Place { hour: number; nightF: number; forest: number; creekDist: number; lakeDist: number; townDist: number; wind: number; fire: number; breathing: number; mood: string | null; music: number }
const timers = { c: [0, 0, 0], breath: 0, acc: 0 };
export function soundscape(dt: number, time: number, P: Place) {
  if (!E) return;
  const h = P.hour, f = P.forest, open = 1 - f;
  const nearCreek = Math.exp(-P.creekDist / 10), nearLake = Math.exp(-P.lakeDist / 22), nearTown = Math.exp(-P.townDist / 120);
  timers.acc += dt;
  if (timers.acc > 0.1) {
    timers.acc = 0;
    const gust = 0.6 + 0.4 * Math.sin(time * 0.31) * Math.sin(time * 0.13 + 1);
    tgt(E.wind.g.gain, P.wind * 0.5 * gust * (1 - 0.65 * f), 0.8); tgt(E.wind.f.frequency, (300 + 500 * gust) * (1 - 0.5 * f), 0.8);
    tgt(E.air.g.gain, P.wind * 0.03 * gust * gust * open, 0.8);
    tgt(E.lake.g.gain, 0.3 * nearLake, 1);
    tgt(E.creek.g.gain, 0.09 * nearCreek * (0.75 + 0.25 * Math.sin(time * 1.7)), 0.3); tgt(E.creek2.g.gain, 0.22 * nearCreek, 0.5);
    tgt(E.fireBed.g.gain, P.fire * 0.12, 0.6);
  }
  const chance = (r: number) => rand() < r * dt;
  const dawn = win(h, 4.9, 7.4, 0.5), morn = win(h, 7.4, 11, 0.6), noon = win(h, 11, 16.2, 0.6), aft = win(h, 16.2, 19, 0.5), eve = win(h, 19, 20.6, 0.4), dusk = win(h, 20.3, 21.6, 0.3), night = smooth(21.2, 21.8, h) + (1 - smooth(4, 4.8, h));
  if (chance(dawn * 0.3 + aft * 0.08 + eve * 0.24)) blackbird();
  if (chance(dawn * 0.35 + morn * 0.12 + eve * 0.08)) robin();
  if (chance(dawn * 0.12 + morn * 0.28 + noon * 0.04 + aft * 0.05)) chaffinch();
  if (chance(dawn * 0.12 * nearTown)) rooster();
  if (chance(morn * 0.02 + aft * 0.07 + eve * 0.05)) woodPigeon();
  if (chance(noon * 0.035 * open)) buzzard();
  if (chance((noon * 0.4 + aft * 0.12) * open * (1 - nearTown))) cicada();
  if (chance((morn + noon + aft) * 0.05 * (f + 0.15))) woodpecker();
  if (chance((dusk * 0.06 + night * 0.03) * (0.3 + f))) owl();
  if (chance(night * 0.15 * nearLake)) frog();
  if (chance(nearCreek * 3)) plip();
  if (P.nightF > 0.45) {
    const k = open * smooth(0.45, 0.8, P.nightF);
    for (let i = 0; i < 3; i++) { timers.c[i] -= dt; if (timers.c[i] <= 0) { if (k > 0.1) cricket([-0.55, 0.6, 0.1][i], [4300, 4700, 3900][i], [0.022, 0.016, 0.008][i] * k); timers.c[i] = 0.5 + i * 0.07 + rand() * 0.2; } }
  }
  if (P.fire > 0 && chance(P.fire * 10)) burst({ type: 'highpass', freq: 1500 + rand() * 2500, gain: 0.03 + rand() * 0.12 * P.fire, dur: 0.006 + rand() * 0.02, pan: (rand() - 0.5) * 0.4, attack: 0.001 });
  if (P.breathing > 0) { timers.breath -= dt; if (timers.breath <= 0) { breath(P.breathing); timers.breath = 2.6; } }
  musicTick(P.mood, P.music);
}
