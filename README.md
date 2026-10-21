# ATLAS RUSH

A cinematic, mobile-first 3D geography arcade game. Fly around a photoreal Earth, identify the
glowing mystery country, and get swept straight to the next one. Build your personal **World
Atlas**, turn mistakes into knowledge with **Echo Rounds**, and unlock **Capitals** and
**Neighbors** modes as you learn.

- All **195 sovereign states** (193 UN members + Holy See + Palestine), selected uniformly at random
- **Arcade** (5 lives, streak multipliers up to 3×) and **Practice** (no lives, free hints, reveal answers)
- **Progressive hints**: continent → neighbors (highlighted on the globe) → first letter → capital
- **World Atlas** with per-country learning records and Unknown / Learning / Mastered status
- **Echo Rounds**: replay only the countries you missed until they're mastered
- Unlockable **Capital Mode** (25 unique countries) and **Neighbors Mode** (60)
- Works offline after load; no backend, accounts or paid APIs. Progress lives in `localStorage`.

## Quick start

Requires Node.js 20.19+ (or 22+).

```bash
npm install
npm run dev          # http://localhost:5173 (also exposed on your LAN for phone testing)
```

Production build:

```bash
npm run build        # type-checks, then bundles to dist/
npm run preview      # serves dist/ at http://localhost:4173
```

`dist/` is a static site — host it anywhere (Netlify, GitHub Pages, S3, `npx serve dist`).

### Checks

```bash
npm test             # unit tests (Vitest): scoring, aliases, hints, selection, reducer, data integrity…
npm run typecheck
npm run lint
npm run e2e          # headless browser smoke test on a phone-sized viewport (see below)
npm run e2e:sweep    # flies to all 195 countries and checks each is framed on screen
```

The browser tests use `playwright-core` with a local Chromium. Set `CHROME_PATH` if Chromium
isn't found automatically. They start their own dev server and write screenshots to
`e2e/output/`.

## How to play

1. The globe flies to a random country and outlines it in cyan.
2. Type the country's name (case, accents, punctuation and spacing don't matter) and press
   **Enter** or the arrow button. Common variants are accepted — `USA`, `Czech Republic`,
   `Turkey`, `Ivory Coast`, `Burma`, `Holland`… Ambiguous names like “Congo” or misspelled
   names never cost a life; you'll be asked to be more specific.
3. Read the feedback card (capital, neighbors, continent), then tap **Next country**.

**Scoring (Arcade):** 100 base points × streak multiplier. The multiplier counts the current
answer: answers 1–2 of a streak score 1×, answers 3–6 score 2×, the 7th onwards 3×. A miss
resets it. Each hint lowers the maximum base points: 70 → 45 → 25 → 10.

**Mastery:** a country is *Learning* once identified, and *Mastered* after three correct rounds,
at least two of them without hints. Every miss goes to Echo Rounds; a country graduates from
Echo Rounds when it's mastered.

Drag to rotate the globe, pinch or scroll to zoom. Settings (gear icon) control animations
(follows the OS reduced-motion setting by default), sound, vibration, graphics quality, and
contain **Reset progress**.

## Project structure

```
scripts/                 data pipeline (fetch + build the geographic datasets)
public/data/             world.topo.json — simplified country polygons (generated)
public/textures/         NASA Blue Marble earth textures
src/data/                country metadata (generated JSON) + typed access helpers
src/globe/               3D globe: GlobeStage (React), GlobeEngine (imperative controller),
  camera/                cinematic flight math (pure, tested) + CameraDirector
  layers/                Three.js layers: borders, target highlight/beacon, atlas paint, stars
  FallbackGlobe.tsx      Canvas 2D globe used when WebGL is unavailable
src/game/                game state machine (reducer), challenges, scoring, hints, selection,
  validation/            answer normalization, curated aliases, capital aliases, matching
  useGame.ts             wires the reducer to the globe, progress, sound and haptics
src/progress/            learning records, mastery, Echo Rounds, unlocks, atlas summary
src/persistence/         versioned localStorage schema + migration
src/feedback/            synthesized sound effects (Web Audio) and haptics
src/screens/             Home, Game (HUD / guess panel / feedback), Game Over, Atlas, Echo, Settings
src/ui/                  shared components and hooks (viewport/keyboard handling, etc.)
e2e/                     headless browser smoke test and 195-country sweep
```

Game phases: `HOME → CAMERA_TRANSITION → GUESSING → ANSWER_REVEAL → (next round | GAME_OVER)`.
Every reducer action is guarded by phase and round id, so double submissions and stale camera
completions are ignored.

## Geographic data

| Data | Source | License |
| --- | --- | --- |
| Country polygons, label points | [Natural Earth](https://www.naturalearthdata.com/) 1:50m Admin 0 – Countries, v5.1.2 | Public domain |
| Names, official names, alternate spellings, capitals, land borders, regions, flags, languages, currencies | [mledoze/countries](https://github.com/mledoze/countries) via the `world-countries` npm package (v5.1.0) | ODbL 1.0 |
| Earth imagery | NASA Blue Marble (as distributed with the `three-globe` package) | Public domain |

Regenerate the data (needs network access to GitHub for Natural Earth):

```bash
npm run data         # = data:fetch (download Natural Earth) + data:build
```

`scripts/build-data.mjs` cross-references both datasets explicitly and **fails the build** if any
of the 195 states lacks geometry, a capital or a camera focus, or if land borders are asymmetric.
Notable reconciliation steps:

- Matching uses `ISO_A3`, then `ISO_A3_EH`, then `ADM0_A3` (Natural Earth gives France and Norway
  `ISO_A3 = -99`).
- Somaliland is merged into Somalia and Northern Cyprus into Cyprus (UN-recognised borders);
  Australia's external territories are merged into Australia.
- `world-countries` flags Vatican City as a UN member; the 195 are built from the UN member list
  plus an explicit observer list (Holy See, Palestine) and the count is asserted.
- Border corrections: Sri Lanka–India removed (no land border); France–Brazil and France–Suriname
  added (French Guiana is part of France and of France's polygon).
- Polygons are simplified with mapshaper (`keep-shapes`, so microstates survive) to ~39k vertices
  and stored as quantized TopoJSON (~310 KB) so shared borders are drawn once.
- Camera framing per country uses the area-weighted centroid of the main landmass and its angular
  radius; distant territories (French Guiana, Hawaii, the Aleutians) don't pull the camera away,
  and archipelagos (Indonesia, Kiribati) are framed as a whole when no island dominates.
- 43 non-sovereign or disputed areas (Greenland, Taiwan, Western Sahara, Puerto Rico, Kosovo…)
  are drawn as neutral land and are never targets. Typing one is recognised and explained.

Curated answer aliases live in `src/game/validation/aliases.ts` and capital alternates in
`src/game/validation/capitals.ts`; unit tests check that every country's common and official
names resolve to it and that no name maps to two countries unintentionally.

## Mobile & performance notes

- One WebGL globe for the whole session; rounds only swap a single highlight mesh. All borders are
  drawn in two draw calls (merged fat-line + line meshes). Next-round geometry is pre-built during
  the reveal.
- Pixel ratio capped per quality profile (High 2×, Balanced 1.5×, Battery saver 1× with a 2K
  texture, no bump/specular maps and no backdrop blur). “Auto” picks a profile from device hints.
- Rendering pauses when the tab is hidden. A lost WebGL context shows a notice; if it isn't
  restored within 5 s the game switches to the Canvas 2D globe without losing the session.
- The layout tracks `visualViewport`, so the answer box and Submit button stay above the iOS/Android
  keyboard, and the globe re-centres in the remaining space. Safe-area insets are respected.
- On touch devices the keyboard isn't opened automatically at each round, so the flight stays
  visible; tap the answer box when ready. On desktop the box is focused automatically and Enter
  advances from the feedback card.

## Known limitations

- Borders and continent assignments reflect the datasets' (largely UN) conventions; disputed areas
  (e.g. Kashmir, Crimea, Western Sahara) follow Natural Earth's default view. Transcontinental
  countries get a note in the continent hint.
- The 1:50m polygons are simplified; very small islands may be omitted from some archipelagos, and
  microstates are marked with a pulsing beacon rather than a visible outline.
- iOS Safari has no vibration API, so haptics only work on Android browsers that support it.
- Flag Mode is reserved for a future release (flag emoji and ISO codes are already in the data).
- Headless browser tests use software WebGL; they verify behaviour and framing, not device frame rates.
