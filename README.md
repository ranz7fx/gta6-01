# Solmar Heat — an open-world crime game (make.fun gta6-01 entry)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/ranz7fx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/ranz7fx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for [make.fun's gta6-01 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).

**Solmar Heat** is an original open-world crime game that runs entirely from
static files — no build step, no network request. You are Dario "Rio" Cruz, a
driver who came back to Solmar with $250 and a borrowed jacket. Drive the
avenues, dodge the Solmar PD, run five jobs for Mama Rosa, and turn that $250
into a legend.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| Mouse | Camera (click to lock) |
| E | Enter / exit car (stealing a parked car raises your wanted level) |
| Space | Handbrake drift |
| F | Punch (on foot) |
| M | Take the next job |
| R | Repair + clear wanted at Pay 'n Spray ($200, drive into the garage) |
| P | Pause |

## The city

- **Solmar**: a 7×7-block coastal city — downtown towers, Mercado Viejo,
  Solmar Trust Bank, the marina, the airfield, Solmar Bowl, the beach and the
  pier, all procedural (seeded, identical every load).
- **Traffic and pedestrians**: cars follow the street grid and stop at lights;
  pedestrians stroll the sidewalks and flee from fast cars.
- **Wanted system**: 0–5 stars. Stealing cars, hitting pedestrians and ramming
  cops raise the heat; Solmar PD pursuit cars chase and ram you. Lose them, or
  pay at Pay 'n Spray. Get caught on foot at 2+ stars and you're busted.
- **Five story jobs**: First Fare ($300), Hot Wheels ($600), Getaway ($900),
  Night Run ($1,200), The Big Score ($2,500) — with waypoint beacons, HUD
  objectives and a minimap.
- **Free-roam extras**: cash bundles on the street, stunt-friendly handbrake,
  day/night cycle (golden hour, neon nights), synthesized WebAudio sound
  (engine, sirens, pickups) and local progress saves.

## Screenshots

Four real renders of the game (see `shots.json` for the staged views):

1. `1-cover.jpg` — golden-hour police chase, 5 stars
2. `2-street.jpg` — on foot on the beach by the pier
3. `3-night.jpg` — night run downtown
4. `4-city.jpg` — aerial over downtown Solmar

## Structure

```
game/
  index.html            start screen, HUD, minimap
  vendor/three.module.min.js + three.core.min.js   (vendored three.js)
  src/
    config.js           palette, city layout, tuning, mission defs
    state.js            shared game state, seeded RNG, save/load
    city.js             streets, buildings, palms, beach, pier, sky, neon
    vehicles.js         car factory, arcade driving, traffic AI
    characters.js       Rio on foot, pedestrians
    police.js           wanted level, pursuit AI, busted/wasted
    missions.js         five-job chain, waypoint beacon, cash pickups
    hud.js              DOM HUD + minimap
    audio.js            synthesized WebAudio (no audio files)
    input.js            keyboard + pointer-lock mouse
    shots.js            deterministic screenshot staging (?shot=…)
    main.js             bootstrap, loop, chase camera, day/night
main.ts                 hands game/ + screenshots/ to /output with dossier.json
```

## License

MIT — see `LICENSE`. Solmar Heat is an original game: no real city, person or
franchise is depicted.
