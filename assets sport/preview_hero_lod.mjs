import fs from 'node:fs';
import {parseOBJ,render} from './lib/render.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_lod.obj','utf8'));
const COL={steel:[0.80,0.81,0.84],rubber:[0.14,0.15,0.17],accent:[0.86,0.62,0.34],leather:[0.52,0.47,0.43]};
const hero=render(obj,900,1100,42,16,COL,{zoom:1.5});
fs.writeFileSync(ROOT+'/assets/previews/lod3_hero.png',encodePNG(hero,900,1100));
console.log('hero bytes',fs.statSync(ROOT+'/assets/previews/lod3_hero.png').size);
