# The Other Waymarks: design

Working design for the game. The showreel in `showreel/` is the reference for how it should feel.

## The pitch

A quiet hiking game in the browser. You follow a marked trail through a generated valley, from village to lake, from dawn to a full-moon night. You notice things and write them down, decide where to sleep, and slowly realise someone else has been walking this trail, leaving marks of their own.

Touchstones: the warmth of *A Short Hike*, the colour and grounded mystery of *Firewatch*, the minimal seasonal calm of *Proteus*, and the unease of *Twin Peaks* (season 3 especially), carried mostly by sound.

## Tone pillars

1. **Mostly warm, sometimes wrong.** About 95% of the time it is birdsong, wind, footsteps and kind people. The strange 5% works because of the rest.
2. **Unease, never danger.** No monsters, no game over, no jump scares. Footprints, a moved tent, a story that does not add up.
3. **Never explain.** Strange things connect to the mystery but nobody says "that was X".
4. **Silence is a sound.** All the birds stopping at once is scarier than any noise.
5. **The player sets the pace.** The mystery is there when you want it. You can ignore it and just walk.

## The look

- Low-poly flat-shaded 3D, rendered at low resolution (about 260 pixel rows) and scaled up with nearest-neighbour, plus a light ordered dither and vignette.
- Colour comes from time of day: keyframed sky, fog, sun and ambient colours (orange dawn, pale noon, purple dusk, blue moonlight).
- Chunky, readable figures built from boxes, with knees, elbows, hands, faces and detailed packs.
- UI is a paper journal: typewriter font (Special Elite), handwriting for photo captions (Caveat), Karla for controls.

## The world

Everything grows from one seed number (`#valley-4821`):
- a valley with ridged mountains, snow on the peaks and a lake at the far end;
- a village at the start (houses, church, inn, street lamp), with a generated name;
- a creek that the trail crosses on stepping stones and that feeds the lake;
- meadows with flowers, a dense forest belt before the lake, a clearing for camp;
- the trail, waymarked red and white every 24 m.

Story beats are placed with **anchors**: the story asks for "a rock beside the trail before the climb" or "the highest point after the meeting", and the generator finds a fitting spot in this valley.

## Systems

### Walking and tiredness
- Breath (short term, steep climbs) and day fatigue (distance, climb, hours awake).
- Shown on the hiker, not as a health bar: slower walk, heavier steps and breathing, softer screen edges. Exhaustion slows you down; it never ends the game.

### Looking at things
The hiker turns head and a little of the body toward anything worth noticing: animals, other hikers, views, marks, sounds in the dark. In the game this is also how you notice: things you look at long enough go into the journal.

### Light
- Day light depends on sun height; at night the moon phase sets how much you can see (full moon about 0.45, new moon about 0.05).
- Canopy density darkens the forest and shapes the sound.
- The headlamp comes on when light at the hiker drops low enough (with a short delay, like a person noticing), and goes off again in the open.

### Days, moon and seasons
- A day is about 20 real minutes. A year is compressed to 30–40 game days.
- Full moon lets you walk at night without a lamp; some events only happen near it. On a new moon the sky is black, the stars and the galaxy band come out, and you need the headlamp in the open too.
- A campfire counts as light: sitting by it, the hiker switches the headlamp off.
- Seasons change the map (snow closes passes, spring melt swells crossings) and the journal (who you can meet).

### Sleeping
Tent (any flat, dry spot off the trail; partial rest; stars, animals at night) or a room in a village (full rest, food, people). The daily decision: push on before dark, or camp here.

### The journal
Pages for animals, hikers, sounds, photos, clues and each day's walk. Photos are real captures of the frame. Entries are written in the hiker's voice.

### Other hikers
Generated walkers with names, trail names and their own pace, met again over several days. Short conversations with a choice of questions; each answer reveals a different part of their journey and is written down.

## Sound and music

Everything is synthesised in the browser with the Web Audio API.

### Ambience by time of day

| Time | What you hear |
|---|---|
| Dawn | church bells, a rooster from the village, blackbirds and robins |
| Morning | chaffinches, the creek where it is close |
| Noon | cicadas in the open, a buzzard circling, woodpeckers near trees |
| Afternoon and evening | wood pigeons, blackbirds singing late |
| Dusk and night | owls, crickets in the open, frogs at the lake |

Environment shapes it: the forest muffles wind and adds echo, the creek and lake get louder as you approach, crickets thin out under trees.

### Music: moods as modes

Guitar arpeggios and strums (Karplus-Strong) over a slow, filtered synth pad.

| Mood | Mode | Used for |
|---|---|---|
| dawn, view | Lydian | open, floating |
| morning | Mixolydian | easy walking |
| noon, camp | Dorian | warm, wistful |
| evening | Aeolian | melancholy |
| mark | Phrygian | something is off (blue marks, painted waymark, a warning) |
| forest, dread | Locrian | the dark and the unknown; pad only at the worst moments |
| heaven | Lydian, high, slow, soft triangle pad | wonder: the aurora |

No music at night outside except for wonder; silence and the soundscape do the work.

**Atmosphere layer.** A low, slowly filtered synth bed (a tritone over a sub bass) swells only in the high-intensity moments: the record in the trees, footsteps around the tent, the last photo on the SD card. Otherwise it stays silent; the ambience is right as it is.

**Owner notes on sound (2026-11-23):** ambience levels are good. The old tent-shaking sound (sharp noise clicks) was not; it is now soft nylon rustle with low thumps of the fabric pulling taut.

## The mystery (draft)

**The other waymarks.** A hiker went missing on this trail a year ago. Faded blue marks leave the official route. Following them is optional and a little risky. They lead to pages of the missing hiker's journal (and cassette tapes of their field recordings), which mention animals, places and people you are meeting too.

**The SD card.** Found in the dirt early on. You try to find the owner in the next villages; innkeepers recognise the hiker in the early photos and give you a name and route. The later photos line up with places you have walked, and the last one shows your own camp, from the trees, from tonight. Inspired by the feeling of found-camera cases (Kris Kremers and Lisanne Froon, Panama, 2014) but fully our own fiction: never recreate real people, their photos or their story.

**Decided (owner, 2026-11-23): supernatural, mystical, cosmic.** Not everything in this world is explainable, and the game never tries. Strange things can be wondrous (an aurora where none is possible) as well as unsettling (something walking around the tent). Keep both registers: awe and unease.

### Pacing of strange things
Uncanny events do not happen every day. Most days are warm and ordinary; a strange night comes every few days at most, and a wondrous one can come on a quiet day. The showreel shows this: day 1 ends in wonder (the aurora), the uncanny events come on day 3.

### Peculiar events on the road
Rare, never explained, one or two a day:
- a red-and-white mark painted over in blue, still wet;
- a cairn knocked down in the evening, rebuilt by morning, pointing off-trail;
- waymark distances counting down to a place no map has;
- a signpost turned overnight;
- a fresh campfire, still warm, nobody around, one boot print;
- one stretch of forest where the birds always stop;
- a hiker seen ahead of you after they went the other way;
- a hut logbook whose last entry is in your handwriting;
- at night: a record playing in the trees that starts skipping; a light high on the mountain; footsteps circling the tent; a deep call echoing from far away; a tap on the fabric by your head.

### Nights
- **Waking in the tent:** it is pitch black, because you were asleep; only natural light through the fabric, and your phone when you tap it. In the tent: phone, wallet, compact camera, bag, water bottle, headlamp. You find the headlamp to see, crawl to the door, unzip and look outside with the beam.
- **Getting up at night:** a beer by the fire, an early night, and the need to pee wakes you. Outside it is pitch black (no moon) and the stars are overwhelming. Sometimes the sky does something it should not: an aurora this far south, with heavenly music.

## Working agreement

The owner directs and reviews; Claude builds. The owner is a web developer new to game code and may touch up parts later, so keep the code readable and explain non-obvious game techniques in comments. Desktop (keyboard and mouse) comes first; touch follows.

## Roadmap

1. **Project setup** (done): Vite, TypeScript, showreel in the repo, Pages deploy.
2. **First playable slice, one day in one valley (about 20 minutes):**
   1. walking with keyboard and touch, third-person camera, following waymarks;
   2. tiredness, the clock, the headlamp on a key;
   3. noticing (look at things to log them), photos;
   4. the journal screen;
   5. tent or inn, sleep, wake to day 2;
   6. story events as data placed by anchors.
3. Days 2–3: villages, asking about the SD card, Moth again.
4. Seasons and moon phases, saving, the ending.
