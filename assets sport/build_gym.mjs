// Procedural gym machine (cable/lat-pulldown trainer) generator
import fs from 'node:fs';
import {Mesh} from './lib/mesh.mjs';
import {buildAtlas,encodePNG} from './lib/tex.mjs';

const OUT='/storage/emulated/0/Documents/fitpulse/assets/models';
const PREV='/storage/emulated/0/Documents/fitpulse/assets/previews';

// UV quadrants in the atlas (u0,v0,u1,v1), flipped V for OBJ (image top-left)
const RUBBER=[0.02,0.02,0.46,0.46];
const STEEL =[0.54,0.02,0.98,0.46];
const LEATHER=[0.02,0.54,0.46,0.98];
const ACCENT=[0.54,0.54,0.98,0.98];

const m=new Mesh();

// ---- base frame: two side rails + cross members (steel)
const railY=0.06, railZ=0.34, railLen=1.7;
for(const s of [-1,1]){
  m.box(s*0.42, railY, 0, 0.08, 0.12, railLen, 'steel', STEEL);
}
m.box(0, railY+0.02, -0.62, 0.92, 0.10, 0.10, 'steel', STEEL);
m.box(0, railY+0.02,  0.62, 0.92, 0.10, 0.10, 'steel', STEEL);
m.box(0, railY, 0.72, 0.92, 0.10, 0.10, 'steel', STEEL);

// ---- rubber feet pads
for(const sx of [-1,1]) for(const sz of [-1,1]){
  m.box(sx*0.42, 0.02, sz*0.78, 0.16, 0.04, 0.16, 'rubber', RUBBER);
}

// ---- vertical columns (steel), back of machine at -Z
const colZ=-0.55, colH=2.1;
for(const s of [-1,1]){
  m.box(s*0.46, colH/2, colZ, 0.10, colH, 0.10, 'steel', STEEL);
}
// top cross beam + pulley mount
m.box(0, colH-0.08, colZ, 1.02, 0.10, 0.10, 'steel', STEEL);
m.box(0, colH-0.20, colZ, 0.14, 0.16, 0.14, 'steel', STEEL);

// ---- pulley wheel (steel, 16-gon disc on X axis)
m.cyl(0, colH-0.20, colZ, 'x', 0.13, 0.13, 0.06, 16, 'steel', STEEL);

// ---- guide rods for weight stack
for(const s of [-1,1]){
  m.cyl(s*0.16, 1.02, colZ, 'y', 0.018, 0.018, 1.55, 8, 'steel', STEEL);
}

// ---- weight stack: 8 plates (rubber/steel mix) + top plate
const plateH=0.055, plateW=0.30, plateD=0.30, stackBase=0.30;
for(let i=0;i<8;i++){
  const y=stackBase+i*plateH;
  m.box(0, y, colZ, plateW, plateH*0.86, plateD, i%2?'rubber':'rubber', RUBBER);
  m.box(0, y, colZ, plateW+0.006, plateH*0.86, plateD+0.006, 'steel', STEEL);
}
m.box(0, stackBase+8*plateH+0.03, colZ, 0.32, 0.06, 0.32, 'steel', STEEL);

// selector rod
m.cyl(0, 1.02, colZ, 'y', 0.016, 0.016, 1.5, 8, 'steel', STEEL);

// ---- seat post + seat (leather)
m.cyl(0, 0.35, 0.10, 'y', 0.05, 0.05, 0.5, 12, 'steel', STEEL);
m.box(0, 0.62, 0.10, 0.46, 0.08, 0.42, 'leather', LEATHER);
// seat bevel accent
m.box(0, 0.575, 0.10, 0.44, 0.02, 0.40, 'accent', ACCENT);

// ---- thigh support roll (front)
m.cyl(0, 0.72, 0.42, 'x', 0.09, 0.09, 0.34, 14, 'leather', LEATHER);

// ---- back pad (leather) leaning against columns
for(let i=0;i<4;i++){
  m.box(0, 0.95+i*0.16, colZ+0.30, 0.44, 0.15, 0.07, 'leather', LEATHER);
}

// ---- pulldown bar (steel with rubber grips)
const barY=1.72, barZ=0.42;
m.cyl(0, barY, barZ, 'x', 0.022, 0.022, 0.78, 10, 'steel', STEEL);
for(const s of [-1,1]){
  m.cyl(s*0.30, barY, barZ, 'x', 0.028, 0.028, 0.14, 10, 'rubber', RUBBER);
}
// cable (thin steel cylinder from pulley to bar)
m.cyl(0, (colH-0.20+barY)/2, (colZ+barZ)/2, 'y', 0.008, 0.008, Math.abs(colH-0.20-barY)*1.02, 6, 'steel', STEEL);

// ---- handle grips / pegs on columns (accent)
for(const s of [-1,1]){
  m.box(s*0.46, 0.85, colZ+0.12, 0.09, 0.09, 0.10, 'accent', ACCENT);
}

// ---- nameplate / logo block (accent)
m.box(0, 1.55, colZ+0.03, 0.30, 0.10, 0.03, 'accent', ACCENT);

const st=m.stats();
console.log('stats', JSON.stringify(st));

fs.writeFileSync(OUT+'/gym_trainer.obj', m.toOBJ('gym_trainer'));
const atlas=buildAtlas();
fs.writeFileSync(OUT+'/gym_trainer_atlas_albedo.png', encodePNG(atlas.albedo, atlas.size, atlas.size));
fs.writeFileSync(OUT+'/gym_trainer_atlas_normal.png', encodePNG(atlas.normal, atlas.size, atlas.size));
console.log('written', fs.readdirSync(OUT));
console.log('obj bytes', fs.statSync(OUT+'/gym_trainer.obj').size);
