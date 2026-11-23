import * as THREE from 'three';
import { v3 } from './util';
import { makePerson, poseWalk, poseStand, look, headOf, type Person } from './figures';
import { footstep } from './audio';
import type { Conversation } from './ui';
import type { World } from './world';

export interface NPC {
  id: string; fig: Person; name: string; unknown: string; met: boolean; talking: boolean; done: boolean;
  pos: () => THREE.Vector3; conversation: () => Conversation; update: (dt: number, t: number, pl: { x: number; z: number }, hour: number) => void; canTalk: () => boolean;
}

export function makePeople(W: World, scene: THREE.Scene) {
  /* Cindy, on the lodge porch in the morning */
  const cindy = makePerson({ jacket: '#a8503a', collar: '#8a3f2c', pack: '', packDark: '', hat: '', pants: '#3b3530', skin: '#e8bf9a', skinDark: '#cf9f7c', hair: '#6a3a22', ponytail: true, apron: '#efe6d2', noPack: true });
  scene.add(cindy.g);
  const cPos = W.lodge.porch.clone();
  const cYaw = W.lodge.yaw;
  const cindyNPC: NPC = {
    id: 'cindy', fig: cindy, name: 'Cindy', unknown: 'Girl at the lodge', met: false, talking: false, done: false,
    pos: () => cindy.g.position,
    canTalk: () => !cindyNPC.done,
    update(dt, _t, pl) {
      poseStand(cindy, cPos.x, cPos.z, cYaw, W.groundAt(cPos.x, cPos.z));
      const near = Math.hypot(pl.x - cPos.x, pl.z - cPos.z) < 9;
      look(cindy, near ? v3(pl.x, W.groundAt(pl.x, pl.z) + 1.6, pl.z) : null, dt, 0.9);
    },
    conversation: () => ({
      unknown: cindyNPC.unknown, name: 'Cindy', nameKnown: cindyNPC.met, ask: 2,
      open: [['*', cindyNPC.met ? 'Back already? Forgot something?' : 'Morning! Coffee’s still warm, if you want one before you go.']],
      topics: [
        { q: 'Where does the trail go?', lines: [['*', 'Red and white, all the way to ' + W.lakeName + '. A long day if you stop for every view, and you should.'], ['*', 'The pass is beyond the lake, but the hut up there is shut this year. Howard won’t say why.']] },
        { q: 'What’s the weather doing?', lines: [['*', 'Clear today. Look up tonight: if you see thin high cloud, mare’s tails, it rains by tomorrow afternoon.'], ['*', 'Don’t trust the radio. Trust the sky.']] },
        { q: 'Is this your place?', reveal: true, lines: [['*', 'My family’s. Mum cooks, Dad bakes, I do everything else.'], ['*', 'I’m Cindy. Everyone who walks through here gets a coffee and a drawing in my book. You too, when you come back.']] }
      ],
      close: [['*', cindyNPC.met ? 'Go on, you’ll lose the light.' : 'Follow the red and white. And come back and tell me how the lake looked.']],
      onEnd: () => { cindyNPC.met = true; cindyNPC.done = true; }
    })
  };

  /* Thalia, coming down the trail from the pass around midday */
  const thalia = makePerson({ jacket: '#c9a43a', collar: '#a8862a', pack: '#4e6b47', packDark: '#3a5236', hat: '#7a6a4e', hatType: 'brim', pants: '#4a4237', skin: '#c99a76', skinDark: '#a87a58', hair: '#2a201a', ponytail: true, mat: '#8a4a3a' });
  scene.add(thalia.g); thalia.g.visible = false;
  const th = { u: 0, active: false, gone: false, stopped: false, passing: false };
  const thaliaNPC: NPC = {
    id: 'thalia', fig: thalia, name: 'Thalia', unknown: 'Woman in yellow', met: false, talking: false, done: false,
    pos: () => thalia.g.position,
    canTalk: () => th.active && !thaliaNPC.done,
    update(dt, _t, pl, hour) {
      const pu = W.trailU(pl.x, pl.z);
      if (!th.active && !th.gone && pu > W.meetU - 0.12 && pu < W.meetU + 0.05 && hour > 9) { th.active = true; th.u = Math.min(1, pu + 26 / W.L); thalia.g.visible = true; thalia.prev = null; }
      if (!th.active) return;
      const r = W.rp(th.u), dist = Math.hypot(pl.x - r.x, pl.z - r.z);
      /* she walks down; she stops for you if you are close, and walks on when you have talked or left */
      const stop = !thaliaNPC.done && dist < 3.2 && !th.passing;
      if (thaliaNPC.talking || stop) th.stopped = true; else if (th.stopped && (thaliaNPC.done || dist > 6)) { th.stopped = false; th.passing = true; }
      if (!th.stopped && !thaliaNPC.talking) th.u -= 1.1 * dt / W.L;
      const rr = W.rp(th.u), x = rr.x - rr.sx * 0.6, z = rr.z - rr.sz * 0.6;
      const stepped = poseWalk(thalia, x, z, Math.atan2(-rr.tx, -rr.tz), thaliaNPC.talking || th.stopped ? 0 : dt, W.groundAt);
      if (thaliaNPC.talking || th.stopped) poseStand(thalia, x, z, Math.atan2(pl.x - x, pl.z - z), W.groundAt(x, z));
      if (stepped && dist < 25) footstep('gravel', 0.4);
      look(thalia, dist < 10 ? v3(pl.x, W.groundAt(pl.x, pl.z) + 1.6, pl.z) : null, dt, 0.8);
      if (th.u < 0.02 || (th.passing && dist > 90)) { th.active = false; th.gone = true; thalia.g.visible = false; }
    },
    conversation: () => ({
      unknown: thaliaNPC.unknown, name: 'Thalia', ask: 2,
      open: [['*', 'Hello. You’re heading up? Late start.']],
      topics: [
        { q: 'Where did you start?', lines: [['*', 'Down on the coast, three weeks ago. I walk to my sister’s every August, over the pass.'], ['*', 'Twenty years now. Not this year.']] },
        { q: 'Why are you turning back?', lines: [['*', 'The hut at the pass is boarded up. In August.'], ['*', 'Someone was sleeping in it anyway. I didn’t stay to meet them.']] },
        { q: 'Is the lake far?', lines: [['*', 'Down through the trees, past the old logging winch. You’ll be there by evening.'], ['*', 'Camp on the near shore. It’s the quietest place I know.']] }
      ],
      close: [['*', 'I’m Thalia, by the way. Good walking.']],
      onEnd: () => { thaliaNPC.met = true; thaliaNPC.done = true; }
    })
  };

  const all = [cindyNPC, thaliaNPC];
  return { all, cindy: cindyNPC, thalia: thaliaNPC, thaliaState: th, headOf };
}
