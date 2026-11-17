import fs from 'node:fs';
import {parseOBJ,render} from './lib/render_fix.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_lod.obj','utf8'));
const COL={steel:[0.80,0.81,0.84],rubber:[0.14,0.15,0.17],accent:[0.86,0.62,0.34],leather:[0.52,0.47,0.43]};
const hero=render(obj,760,940,42,16,COL,{zoom:1.5});
fs.writeFileSync(ROOT+'/assets/previews/lod3_hero.png',encodePNG(hero,760,940));
const views=[35,80,125,170,215,260,305,350];const W=400,H=460;const tiles=[];
for(const az of views){tiles.push(render(obj,W,H,az,18,COL,{zoom:1.6}));}
const cols=4,rows=2;const sheet=Buffer.alloc(cols*W*rows*H*4);
for(let t=0;t<8;t++){const cx=(t%cols)*W,cy=Math.floor(t/cols)*H;const sd=tiles[t];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const si=(y*W+x)*4,di=((cy+y)*cols*W+(cx+x))*4;for(let k=0;k<4;k++)sheet[di+k]=sd[si+k];}}
fs.writeFileSync(ROOT+'/assets/previews/lod3_sheet.png',encodePNG(sheet,cols*W,rows*H));
console.log('hero',fs.statSync(ROOT+'/assets/previews/lod3_hero.png').size,'sheet',fs.statSync(ROOT+'/assets/previews/lod3_sheet.png').size);
