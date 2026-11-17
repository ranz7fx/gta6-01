// SOLMAR HEAT — entrypoint (Node 22, standard library only).
//
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/, no network request at all), and this program hands it in. It copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library.
//
// The game itself: an original open-world crime game set in Solmar, a sun-soaked
// coastal city. Drive and walk a 7x7-block city with traffic, pedestrians, a beach
// and a pier; steal cars, outrun the Solmar PD across five wanted levels, run five
// story jobs for Mama Rosa, collect street cash, and repair at Pay 'n Spray.
// HUD with minimap, wanted stars, cash, health, speed and mission objectives;
// day/night cycle with golden hour and neon nights; synthesized WebAudio sound.
// Screenshots are real renders of the game (see shots.json for the four staged
// views: police chase, beach on foot, night run, aerial city).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an empty game: the entry is only valid with
// a playable index.html and at least the cover screenshot.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}
if (!existsSync(join(here, 'screenshots', '1-cover.jpg'))) {
  throw new Error('screenshots/1-cover.jpg (the cover) is missing — take the screenshots first');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
