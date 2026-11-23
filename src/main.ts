import * as THREE from 'three';
import { $, clamp, v3 } from './game/util';
import { makeRenderer } from './game/render';
import { buildWorld } from './game/world';
import { applyTime, lightAt, fmtClock } from './game/sky';
import { makePlayer, bindInput, keys, releasePointer } from './game/player';
import { makeWildlife } from './game/wildlife';
import { makePeople, type NPC } from './game/people';
import { makeTent, makeFire, headOf } from './game/figures';
import { initAudio, soundscape, setMuted, suspend, musicMoment, bell, zipper, now } from './game/audio';
import { caption, toast, prompt, hud, dialog, addEntry, openJournal, journal } from './game/ui';

/* ---------- setup ---------- */
const canvas = $<HTMLCanvasElement>('#view');
const R = makeRenderer(canvas);
const scene = new THREE.Scene();
const hm = /valley-(\d{1,6})/.exec(location.hash);
const SEED = hm ? parseInt(hm[1], 10) : 4821;
const W = buildWorld(SEED, scene);
const player = makePlayer(W, scene, R.camera);
const wild = makeWildlife(W, scene);
const people = makePeople(W, scene);
const tent = makeTent(); tent.visible = false; scene.add(tent);
const fire = makeFire(); fire.g.position.set(W.camp.x, W.heightAt(W.camp.x, W.camp.z), W.camp.z); scene.add(fire.g);

/* ---------- game state ---------- */
const G = {
  started: false, paused: false, journalOpen: false, talking: false, pitched: false, ended: false,
  hour: 7.3, day: 1, rate: 0.025, moonlight: 0.05, clock: 0,
  noticed: new Set<string>(), darkHint: false, mood: 'morning' as string | null
};
const moonLabel = 'New moon';
/* start on the lodge porch steps, facing the trail */
{
  /* out in the yard, looking back at the lodge and Cindy on the porch; the trail is behind you */
  const d = W.lodge.door, out = Math.atan2(Math.sin(W.lodge.yaw), Math.cos(W.lodge.yaw));
  const x = d.x + Math.sin(out) * 7.5, z = d.z + Math.cos(out) * 7.5;
  player.place(x, z, out + Math.PI);
  player.P.camYaw = out + Math.PI + 0.35; player.P.camPitch = 0.22; player.P.camDist = 7;
}
bindInput(canvas, () => G.started && !G.paused && !G.journalOpen && !G.talking);

const time = () => fmtClock(G.hour);
function note(key: string, kind: 'People' | 'Animals' | 'Noticed', title: string, text: string) {
  if (G.noticed.has(key)) return; G.noticed.add(key); addEntry({ kind, title, text, time: time() });
}

/* ---------- things worth noticing along the way ---------- */
interface Poi { key: string; pos: THREE.Vector3; radius: number; needLook: boolean; fire: () => void }
const shoulder = W.rp(W.shoulderU), crossing = W.rp(W.firstCross), lakeEdge = W.rp(0.965);
const pois: Poi[] = [
  { key: 'crossing', pos: v3(crossing.x, crossing.y, crossing.z), radius: 4, needLook: false, fire: () => caption('Stepping stones. The water is cold enough to hurt.') },
  { key: 'mark', pos: W.markRock.clone().setY(W.markRock.y + 0.6), radius: 7, needLook: true, fire: () => { caption('A mark on this rock. Faded blue. It isn’t on my map.', 6); note('mark', 'Noticed', 'Faded blue waymark', 'on a rock before the climb. Not on my map.'); musicMoment('mark', 35); } },
  { key: 'view', pos: v3(shoulder.x, shoulder.y + 1.5, shoulder.z), radius: 9, needLook: false, fire: () => { caption('The whole valley from up here. That’s ' + W.lakeName + ' down there.', 6); note('view', 'Noticed', 'The view from the shoulder', W.lakeName + ' far below, the village behind me.'); musicMoment('view', 55); } },
  { key: 'logging', pos: W.logging.clone().setY(W.logging.y + 1), radius: 17, needLook: true, fire: () => { caption('An old logging winch. The forest has nearly finished taking it back.', 6); note('logging', 'Noticed', 'Old logging winch', 'rusted through, a young pine growing out of the boiler.'); } },
  { key: 'lake', pos: v3(lakeEdge.x, lakeEdge.y, lakeEdge.z), radius: 8, needLook: false, fire: () => caption(W.lakeName + '. Still as glass.', 5) }
];

/* ---------- conversations ---------- */
function nearestTalker(): NPC | null {
  let best: NPC | null = null, bd = 3.6;
  for (const n of people.all) { if (!n.canTalk() || !n.fig.g.visible) continue; const d = Math.hypot(n.pos().x - player.P.x, n.pos().z - player.P.z); if (d < bd) { bd = d; best = n; } }
  return best;
}
function talkTo(n: NPC) {
  G.talking = true; n.talking = true; player.P.frozen = true; releasePointer();
  const c = n.conversation();
  dialog.run(c, () => {
    G.talking = false; n.talking = false; player.P.frozen = false;
    if (c.nameKnown || n.met) note('person-' + n.id, 'People', c.nameKnown ? n.name : n.unknown, n.id === 'cindy' ? 'runs the lodge with her family. Reads the sky better than the radio.' : 'walking down from the pass. Turned back this year: the hut is boarded up.');
  });
}

/* ---------- the camp at the lake ---------- */
function pitchCamp() {
  G.pitched = true; player.P.frozen = true; releasePointer(); prompt(null);
  const fade = $('#fade'); fade.style.transition = 'opacity 1.2s'; fade.style.opacity = '1';
  zipper();
  setTimeout(() => {
    const c = W.camp, F = W.F, Fp = W.Fp;
    tent.position.set(c.x + Fp.x * 2.6 + F.x * 1.6, W.heightAt(c.x + Fp.x * 2.6 + F.x * 1.6, c.z + Fp.z * 2.6 + F.z * 1.6) + 0.03, c.z + Fp.z * 2.6 + F.z * 1.6);
    tent.rotation.y = Math.atan2(-Fp.x, -Fp.z); tent.visible = true;
    fire.on = 1;
    player.place(c.x - F.x * 1.35, c.z - F.z * 1.35, Math.atan2(F.x, F.z));
    player.P.sitting = true; player.P.camDist = 6; player.P.camPitch = 0.28; player.P.camYaw = Math.atan2(F.x, F.z) - 0.55;
    G.hour = Math.max(G.hour, 21.05); player.setLamp(false); G.mood = 'camp';
    fade.style.opacity = '0';
    caption(fmtClock(G.hour) + '. Tent up, fire lit. A good first day.', 6);
    setTimeout(() => { player.P.frozen = false; showEnd(); }, 11000);
  }, 1400);
}
function showEnd() {
  if (G.ended) return; G.ended = true; releasePointer();
  const km = (player.P.distance / 1000).toFixed(1);
  $('#endStats').textContent = `You walked ${km} km, met ${people.all.filter(p => p.met).length} people and wrote ${journal.length} things in your journal.`;
  $('#end').hidden = false;
}
$('#bStay').addEventListener('click', () => { $('#end').hidden = true; });
$('#bAgain').addEventListener('click', () => location.reload());

/* ---------- start, pause, journal ---------- */
function begin() {
  initAudio(); G.started = true; $('#start').hidden = true; $('#hud').hidden = false;
  bell(now() + 0.6); bell(now() + 3.4);
  setTimeout(() => caption(fmtClock(G.hour) + '. Breakfast at ' + W.lodgeName + ', ' + W.town + '. Time to walk.', 6), 900);
  setTimeout(() => toast('How to play', 'WASD to walk, mouse to look (click the view first). E to talk, J for the journal, Esc to pause.', 9), 6500);
  canvas.requestPointerLock?.();
}
$('#bBegin').addEventListener('click', begin);
function setPaused(p: boolean) { G.paused = p; $('#pause').hidden = !p; suspend(p); if (p) releasePointer(); }
$('#bResume').addEventListener('click', () => { setPaused(false); canvas.requestPointerLock?.(); });
let muted = false;
$('#bMute').addEventListener('click', () => { muted = !muted; setMuted(muted); $('#bMute').textContent = muted ? 'Sound on' : 'Sound off'; });
window.addEventListener('keydown', e => {
  if (!G.started) return;
  if (!$('#dialog').hidden) {
    dialog.key?.(e);
    if (dialog.next && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dialog.next(); }
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.journalOpen) { G.journalOpen = false; openJournal(false); } else setPaused(!G.paused); }
  if (e.code === 'KeyJ' && !G.paused) { G.journalOpen = !G.journalOpen; openJournal(G.journalOpen); if (G.journalOpen) releasePointer(); }
  if (e.code === 'KeyR' && !G.paused && !G.talking) player.toggleSit();
  if (e.code === 'KeyE' && !G.paused && !G.talking && !G.journalOpen) {
    const n = nearestTalker(); if (n) { talkTo(n); return; }
    if (!G.pitched && Math.hypot(player.P.x - W.camp.x, player.P.z - W.camp.z) < 10) pitchCamp();
  }
});
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.started && !G.paused && !G.journalOpen && !G.talking && !G.ended && !G.pitched) setPaused(true); });

/* ---------- the loop ---------- */
let last = performance.now();
function frame(t: number) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (t - last) / 1000); last = t;
  const frozen = !G.started || G.paused || G.journalOpen;
  if (frozen) dt = 0;
  G.clock += dt;
  if (G.started && !G.paused && !G.journalOpen) G.hour += dt * G.rate * (G.talking ? 0.3 : 1);
  if (G.hour >= 24) { G.hour -= 24; G.day++; }

  player.update(dt, G.started && !G.talking);
  const { nightF } = applyTime(W, G.hour, R.camera, G.moonlight);
  W.update(G.clock, nightF);
  fire.update(dt, G.clock);
  const pl = player.P;
  people.all.forEach(n => n.update(dt, G.clock, pl, G.hour));
  wild.update(dt, G.clock, G.hour, pl, R.camera, what => {
    if (what === 'deer') note('deer', 'Animals', 'Red deer', 'two, grazing by the creek. They watched me before I saw them.');
    if (what === 'deerFled') { caption('They saw me first.', 3); note('deer', 'Animals', 'Red deer', 'by the creek. Gone before I got close.'); }
    if (what === 'kestrel') note('kestrel', 'Animals', 'Kestrel', 'hovering over the meadow, wings a blur, calling kee-kee-kee.');
  });

  /* what the hiker looks at: people, animals, marks */
  let tgtLook: THREE.Vector3 | null = null, bd = 1e9;
  for (const n of people.all) { if (!n.fig.g.visible) continue; const d = Math.hypot(n.pos().x - pl.x, n.pos().z - pl.z); if (d < 9 && d < bd) { bd = d; tgtLook = headOf(n.fig); } }
  if (!tgtLook) { const hp = wild.herdPos(); if (hp && Math.hypot(hp.x - pl.x, hp.z - pl.z) < 45) tgtLook = hp.clone().setY(hp.y + 1.3); }
  if (!tgtLook) { const kp = wild.kestrelPos(); if (G.hour > 6.5 && G.hour < 19.5 && Math.hypot(kp.x - pl.x, kp.z - pl.z) < 45) tgtLook = kp.clone(); }
  if (!tgtLook) for (const p of pois) if (p.needLook && Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) < p.radius) tgtLook = p.pos;
  pl.lookTarget = tgtLook;

  /* noticing */
  if (G.started && !G.talking) {
    const camF = R.camera.getWorldDirection(new THREE.Vector3());
    for (const p of pois) {
      if (G.noticed.has('poi-' + p.key)) continue;
      const d = Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z); if (d > p.radius) continue;
      if (p.needLook) { const to = p.pos.clone().sub(R.camera.position); if (to.normalize().dot(camF) < 0.75 && d > 3) continue; }
      G.noticed.add('poi-' + p.key); p.fire();
    }
  }

  /* prompts */
  if (G.started && !G.talking && !G.paused) {
    const n = nearestTalker();
    if (n) prompt('<kbd>E</kbd> Talk to ' + (n.met ? n.name : n.unknown.toLowerCase()));
    else if (!G.pitched && Math.hypot(pl.x - W.camp.x, pl.z - W.camp.z) < 10) prompt('<kbd>E</kbd> Pitch the tent here');
    else prompt(null);
  }

  /* light: the hint to use the headlamp, once */
  const fireLight = fire.on * clamp(1 - Math.hypot(pl.x - W.camp.x, pl.z - W.camp.z) / 5, 0, 1) * 0.5;
  const lit = lightAt(W, pl.x, pl.z, G.moonlight) + fireLight;
  if (G.started && !G.darkHint && lit < 0.2 && !pl.lampOn) { G.darkHint = true; caption('Getting dark. The headlamp is in the lid pocket. (L)', 6); }

  /* music mood follows the time of day */
  if (!G.pitched) G.mood = G.hour < 8 ? 'dawn' : G.hour < 11 ? 'morning' : G.hour < 16 ? 'noon' : G.hour < 20.5 ? 'evening' : null;
  if (Math.hypot(pl.x - W.lodge.x, pl.z - W.lodge.z) < 22 && G.hour < 9) G.mood = 'lodge';
  if (G.started && !G.paused) soundscape(dt, G.clock, {
    hour: G.hour, nightF, forest: W.forestAt(pl.x, pl.z),
    creekDist: W.streamAt(pl.x, pl.z).d, lakeDist: Math.max(0, Math.hypot(pl.x - W.LAKE.x, pl.z - W.LAKE.z) - 24), townDist: Math.hypot(pl.x - W.TOWN.x, pl.z - W.TOWN.z),
    wind: 0.2 + W.heightAt(pl.x, pl.z) / 120, fire: fire.on * clamp(1 - Math.hypot(pl.x - W.camp.x, pl.z - W.camp.z) / 30, 0, 1),
    breathing: (pl.climb > 0.35 || pl.energy < 20 || pl.running) && pl.speed > 0.3 ? 1 : 0,
    mood: G.mood, music: G.mood === 'camp' ? 0.6 : 0.5
  });

  hud(G.day, time(), pl.energy, pl.lampOn, moonLabel);
  R.post.uniforms.vig.value = W.forestAt(R.camera.position.x, R.camera.position.z) > 0.4 ? 1.3 : nightF > 0.5 ? 1.15 : 0.9;
  R.render(scene);
}
requestAnimationFrame(frame);

/* for automated checks: move around and set the clock without playing */
(window as unknown as { __game: unknown }).__game = {
  begin, keys,
  state: () => ({ hour: G.hour, x: player.P.x, z: player.P.z, energy: player.P.energy, u: W.trailU(player.P.x, player.P.z), journal: journal.map(j => j.title), talking: G.talking, pitched: G.pitched, lamp: player.P.lampOn }),
  teleport(u: number, side = 0) { const r = W.rp(u); player.place(r.x + r.sx * side, r.z + r.sz * side, Math.atan2(r.tx, r.tz)); },
  setHour(h: number) { G.hour = h; },
  talk() { const n = nearestTalker(); if (n) talkTo(n); return !!n; },
  pitch: pitchCamp,
  thaliaTo(u: number) { const s = people.thaliaState; s.active = true; s.u = u; people.thalia.fig.g.visible = true; }
};
