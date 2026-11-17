import fs from 'node:fs';
import path from 'node:path';
import { parseOBJ, render } from './lib/render.mjs';
import { encodePNG } from './lib/tex.mjs';

const ROOT = '/storage/emulated/0/Documents/fitpulse';
const obj = parseOBJ(fs.readFileSync(path.join(ROOT, 'assets/models/gym_trainer.obj'), 'utf8'));
const mats = {
  steel: [186, 190, 198],
  rubber: [58, 58, 64],
  leather: [122, 88, 62],
  accent: [235, 106, 30],
  default: [140, 140, 140],
};
const outDir = path.join(ROOT, 'assets/previews');
const W = 720, H = 720;
const shots = [0, 45, 90, 135, 180, 225, 270, 315];
for (let i = 0; i < shots.length; i++) {
  const t0 = Date.now();
  const img = render(obj, W, H, shots[i], 16, mats, { zoom: 2.25 });
  const p = path.join(outDir, 'gym_trainer_' + i + '.png');
  fs.writeFileSync(p, encodePNG(img, W, H));
  console.log('shot', i, 'az', shots[i], Date.now() - t0 + 'ms', fs.statSync(p).size);
}
console.log('DONE');
