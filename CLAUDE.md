# The Other Waymarks: brief for Claude Code

A quiet hiking game with a mystery, in the browser. The full design is in `docs/DESIGN.md`; read it before changing gameplay, sound or story. Where this file and the design disagree, the design wins, then tell the owner.

## Where things are

```
index.html          landing page (links to the showreel until the game is playable)
src/main.ts         landing page script; the game entry will live in src/
showreel/index.html the working prototype: one self-contained page, about 5 minutes,
                    plays by itself. Reference for look, sound and pacing.
docs/DESIGN.md      design: tone, world, systems, wildlife, weather, music, mystery, roadmap
docs/CHARACTERS.md  the thirteen people of the valley: who they are, what they know
.github/workflows/pages.yml  builds and deploys to GitHub Pages on pushes to main
```

## Build and run

- `npm install`, then `npm run dev` (Vite). `npm run build` type-checks `src/` and builds to `dist/`.
- The showreel loads three.js r128 from cdnjs and is not type-checked; it is a reference, not the base of the game. Port pieces from it into `src/` as typed modules when the game needs them.
- three.js is pinned to `0.128.0` on purpose: newer versions change colour management and light units, which changes the look. Upgrade only deliberately, and compare against the showreel.

## Checking changes

There is no audio output in the cloud container: check that sound code runs without errors, and say plainly that it has not been listened to.

For visuals, render headless with Playwright and swiftshader, `chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`, and look at screenshots. When the CDN is blocked, route `https://cdnjs.cloudflare.com/**` to `node_modules/three/build/three.min.js`. The showreel exposes `window.__reel.jump(scene, seconds)`, `seek(seconds)` and `state()` for this.

## Rules (ask the owner before changing)

- **Tone:** mostly warm, sometimes wrong. Unease, never danger: no monsters, no game over, no jump scares. Never explain the strange things. The world is supernatural, mystical and cosmic: strange can be wondrous as well as unsettling.
- **Pacing:** uncanny events do not happen every day; a strange night every few days at most.
- **Generated, not downloaded:** terrain, names and all sound come from code and a seed. Any recorded audio or art added later must be our own or properly licensed.
- **Music follows the mood through modes** (see the table in the design). Phrygian and Locrian are kept for the uneasy moments so they keep their effect.
- **Real cases are inspiration only.** The SD card thread is inspired by found-camera cases; never use real names, photos or stories in the game.
- **Do not recreate existing games** (names, characters, art, music, levels). Touchstones are for feel only.
- Low-resolution pixelated rendering, flat shading, time-of-day colour. Keep the UI as a paper journal.

## Conventions

- TypeScript, strict. Small modules by system (world, figures, audio, music, journal, events).
- No new dependencies without a reason.
- Player-facing text: plain, sentence case, in the hiker's voice for journal entries and captions.
- Keep keyboard focus visible, respect reduced motion, work at phone width.
