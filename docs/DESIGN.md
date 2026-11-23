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

### Other people
Thirteen people can be met in the valley; their stories are in `docs/CHARACTERS.md`. You do not know a name until you are told it: until then the conversation box and the journal use a description ("woman in a yellow jacket"). Conversations offer two or three questions; choosing one continues at once, lines move on when read or on a click, Enter or Space, and people remember earlier meetings.

### Wildlife
Animals belong to a place and a time of day, and most of them leave when they notice you. Each species has:
- **an alert distance:** it lifts its head, freezes, stares (and often calls);
- **a flight distance:** it runs, flies or drops into a burrow, usually away from you and toward cover;
- **things that let you closer:** walking slowly, stopping, staying downwind, keeping off the skyline. Binoculars let you watch from beyond the alert distance without disturbing anything.

Seeing an animal long enough (in the open or through binoculars) writes it into the journal; hearing it writes a "heard, not seen" entry.

| Animal | Where and when | What it does when it notices you | Sound |
|---|---|---|---|
| Red deer | meadows and forest edge, dawn and dusk | stares, barks once, trots into the trees with a white rump flash | stags roar in the autumn rut: a long, deep bellow that carries for kilometres (synth: low sawtooth through a moving formant, long echo) |
| Roe deer | clearings and field edges, early morning | freezes, then bounds away in high leaps | a hoarse dog-like bark, repeated as it runs (short filtered noise bursts with a pitched body) |
| Chamois | steep rock and scree above the trees | runs across impossible slopes, stops on a ledge to look back | a sharp whistling hiss of alarm |
| Alpine ibex | rock bands near the pass, midday | the only one that often stays; watches you calmly, moves off slowly | clatter of hooves and falling stones; rarely a short sneeze-whistle |
| Alpine marmot | alpine meadows with boulders, sunny days | sits up, gives one piercing whistle, dives into its burrow; the whole colony whistles | a single very loud high whistle, repeated by others further off |
| Red fox | everywhere, mostly dusk and night | stops, looks back once, trots off unhurried; eyes shine in the headlamp | at night an eerie scream that sounds almost human (noisy high glide) |
| Badger | forest, after dark | shuffles away grunting; never runs far | snuffling, grunts, crashing through undergrowth |
| Wild boar | dense forest, night and dusk | a crash in the undergrowth you hear before you see anything | grunts, squeals, heavy movement (low noise with rhythmic grunts) |
| Brown hare | meadows, dusk | lies flat, then explodes away in a zigzag | silent; thump of feet |
| Red squirrel | conifers, all day | runs up the far side of a trunk, scolds from above | a fast chattering "chuk-chuk" |
| Pine marten | forest, dusk, rare | a dark streak across the trail and up a tree | almost silent |
| Wolf | heard, almost never seen; rare nights | never seen up close; tracks on a muddy path | a distant howl at night, answered by others far off |
| Bats | over the lake and clearings at dusk | ignore you | above hearing, except a faint tick near your head |
| Common frog, toad | lake shore and wet grass, night and after rain | hop away or freeze | frogs croak at the lake at night |
| Fire salamander | forest floor, only after rain | does not flee at all; walks slowly across the trail | silent |
| Adder | warm rocks, sunny mornings | slides away into the grass if you come close | a soft hiss if cornered |
| Brown trout | the creek | darts into the shadow of a stone | none (a splash at dusk when one rises) |

### Birds
The birds of a mountain valley with meadows, mixed forest, a creek and a lake. Each species belongs to habitats, a time of day and season, and has a call or song the game synthesises. Most are heard far more often than seen; spotting one usually needs the binoculars.

| Bird | Where | When | Call or song |
|---|---|---|---|
| Common buzzard | over meadows and slopes | warm middle of the day | a mewing "peee-oo", falling, carried far |
| Golden eagle | high over ridges | midday, rare | mostly silent; a thin yelp |
| Common kestrel | hovering over meadows | day | a sharp repeated "kee-kee-kee" |
| Common raven | cliffs, ridges, anywhere | all day | a deep hollow "kronk", knocking and gurgling calls |
| Alpine chough | flocks around peaks and the pass | day | rippling, high "zirr" and "chirrish" calls, many birds at once |
| Eurasian jay | oak and mixed forest | day | a harsh screech of alarm when you pass |
| Spotted nutcracker | conifers near the treeline | day | a dry rasping "kraak" |
| Great spotted woodpecker | forest | day | drumming bursts, a sharp "kik" |
| Black woodpecker | old forest | day | a loud whinnying "kree-kree-kree" and long, powerful drumming |
| Eurasian wren | undergrowth, creek banks | dawn, all day | a tiny bird with a huge, rattling trill |
| European robin | forest edge, village | dawn, dusk, even at night under lamps | a liquid, wistful warble |
| Common blackbird | village, forest edge | dawn and evening | slow, fluting phrases ending in a chatter; a ringing alarm at dusk |
| Song thrush | forest | dawn and evening | bright phrases, each repeated two or three times |
| Common chaffinch | everywhere with trees | morning | an accelerating trill with a flourish at the end |
| Great tit and coal tit | forest and village | morning | "teacher-teacher" (great tit), thin "seetoo-seetoo" (coal tit) |
| Goldcrest | conifers | day | so high and thin that some people cannot hear it |
| Black redstart | village roofs, rocks, the hut | dawn | a scratchy, crackling little song |
| White-throated dipper | on stones in the creek | day | a sharp "zit" as it flies low along the water; bobs on rocks |
| Grey wagtail | creek | day | a metallic "tsitsit" in flight |
| Common sandpiper | lake shore | day | a high "swee-wee-wee" as it flies low over the water |
| Grey heron | lake shallows | dawn and dusk | a harsh "fraank" when it takes off |
| Common swift | screaming over the village | summer evenings | shrill screaming parties |
| Barn swallow, house martin | village | day | twittering |
| Water pipit, skylark | alpine and valley meadows | morning | song flights: rising, hanging, falling songs |
| Yellowhammer | meadow edges, bushes | day | "a little bit of bread and no cheese" |
| Common cuckoo | forest edge | spring only | the famous two-note call |
| Wood pigeon | forest and village | afternoon, evening | a soft five-note cooing |
| Rock ptarmigan | high scree near the pass | rare | a croaking, belching call |
| Black grouse | treeline clearings | spring dawn | bubbling, cooing display |
| European nightjar | clearings and forest edge | summer dusk | a long, mechanical churring that rises and falls in the half-dark |
| Tawny owl | forest | night | "hoo… hu-hu-hoooo"; females answer "ke-wick" |
| Eurasian pygmy owl | conifers | dusk | a soft, regular whistle |
| Boreal owl | old conifer forest | night | a rapid, soft "po-po-po-po" |
| Eurasian eagle-owl | cliffs above the forest | night, rare | a very deep "oo-hu" that carries kilometres; easy to mistake for something else |

Notes for sound design:
- Birds react too: alarm calls ripple ahead of you along the trail (jay, blackbird, wren). In rain most birds go quiet and start again when it stops.
- The deepest natural calls (red deer rut, eagle-owl, wolf) sit close to the uncanny ones on purpose. The player should not always know which is which.

### Binoculars
- Raise and lower them with **B** or the right mouse button. The view narrows to two overlapping circles with soft dark edges, a fine focus ring, and about 7× magnification.
- The image sways with your breathing and pulse; it sways more when you are tired or have just climbed. Holding your breath (a key) steadies it for a few seconds.
- Keeping an animal or bird in view for a moment identifies it and writes it into the journal; the binoculars never disturb anything.
- Use them to scan ridges for blue marks, read a distant signpost, find the next hut, watch the sky at night (the light on the mountain, the aurora, Laure's misplaced stars).
- Sound narrows slightly toward what you look at, so a distant bird becomes clearer.

### The map
In the spirit of a paper map held in your hands:
- Press **M**: the hiker stops, unfolds the map, and the view tilts down to it, held in two hands, with a compass on top that points north.
- The map is drawn from the world seed: contour lines, the creek and the lake, peaks and passes with names, villages and huts, the red-and-white trail as a dashed line. It looks hand-drawn and printed, slightly worn at the folds.
- **Your walked path is drawn on it as a pencil line**, as you go. There is no "you are here" marker: the end of the pencil line and the landmarks around you are how you find yourself.
- Your journal marks appear in pencil too: where you camped, animals you saw, photos you took. The blue marks are not on the printed map; they appear only if you pencil them in yourself.
- More map sheets can be bought in villages. The old 1938 map from the inn shows paths that the new one does not.

### Weather
Weather changes slowly and announces itself. Nothing arrives all of a sudden.
- **States:** clear, fair with small clouds, overcast, valley fog, drizzle, rain, thunderstorm, clearing after rain.
- **It builds:** a storm takes one to three hours. Cumulus clouds tower in the afternoon, the light goes yellow and flat, distant thunder starts (low rumbles, far apart), birds fall silent, the wind turns and gusts, the temperature drops, the first heavy drops fall. Then the storm, then it moves on.
- **Thunder and lightning:** the delay from flash to thunder follows the distance (about 3 seconds per kilometre), so you can hear it come closer and go away. Lightning lights the whole valley for a moment.
- **Fog:** valley fog after clear, cold nights, lying on the lake and in the low ground at dawn, burning off by mid-morning. Above it, on the slopes, you can stand in sunshine over a sea of cloud. Cloud can also come down on the pass and hide the marks.
- **Rain:** streaks around you, splashes, darker wet ground and shining rocks, puddles, a louder creek afterwards. On the tent it is one of the best sounds in the game.
- **After rain:** if the sun comes out low behind you while it still rains ahead, a rainbow stands in the sky opposite the sun (about 42 degrees from that point). Birds start singing again; fire salamanders and snails come out; mushrooms the next day.
- **Effects on you:** getting wet and cold costs energy; you can shelter under trees, in a hut or in the tent. A storm on an open ridge makes the hiker crouch and hurry down, but it never kills or ends anything.
- **Reading it in advance:** high wispy clouds (mare's tails) and a halo round the moon mean change within a day or two; Cindy reads the sky better than the radio; Randall hears the forecast. Weather is generated per day from the seed with smooth transitions, so it feels random but is always fair.
- **Music in weather:** soft Dorian in rain, nothing in the storm but the storm, and a bright Lydian lift when the sun comes back.

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
   1. walking with keyboard and mouse, third-person camera, following waymarks;
   2. tiredness, the clock, the headlamp on a key;
   3. noticing (look at things to log them), photos, binoculars;
   4. the journal screen and the map with your pencil path;
   5. wildlife that notices you and leaves; the bird soundscape by habitat;
   6. weather: fog, overcast, rain, and a storm that builds;
   7. tent or inn, sleep, wake to day 2;
   8. story events as data placed by anchors.
3. Days 2–3: villages, asking about the SD card, Thalia, Cindy and Howard; meeting people again.
4. Seasons and moon phases, saving, the ending.
