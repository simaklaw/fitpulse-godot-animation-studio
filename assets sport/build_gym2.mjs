import fs from 'node:fs';
import {Mesh} from './lib/mesh.mjs';
import {buildAtlas,encodePNG} from './lib/tex.mjs';
const OUT='/storage/emulated/0/Documents/fitpulse/assets/models';
const RUBBER=[0.02,0.02,0.46,0.46];
const STEEL=[0.54,0.02,0.98,0.46];
const LEATHER=[0.02,0.54,0.46,0.98];
const ACCENT=[0.54,0.54,0.98,0.98];
const m=new Mesh();
// ---------- base frame ----------
const railY=0.075,railX=0.44,railLen=1.72;
for(const s of [-1,1]){
  m.rbox(s*railX,railY,0,0.10,0.13,railLen,0.012,'steel',STEEL);
}
for(const z of [-0.66,0,0.66]) m.rbox(0,railY+0.01,z,railX*2-0.06,0.10,0.09,0.010,'steel',STEEL);
// feet
for(const sx of [-1,1])for(const sz of [-1,1]){
  m.rbox(sx*railX,0.025,sz*0.80,0.20,0.05,0.20,0.012,'rubber',RUBBER);
}
// end caps / bolt plates
for(const sx of [-1,1])for(const sz of [-1,1]) m.bolt(sx*railX,railY+0.08,sz*0.78,'y',0.014,0.03,'steel',STEEL);
// ---------- uprights ----------
const colZ=-0.58,colH=2.16,colX=0.47;
for(const s of [-1,1]){
  m.rbox(s*colX,colH/2,colZ,0.11,colH,0.11,0.014,'steel',STEEL);
  // column bolt plates
  for(let i=0;i<5;i++) m.bolt(s*colX,colH*0.18+i*0.36,colZ+0.056,'z',0.012,0.014,'steel',STEEL);
}
// top beam + gussets
m.rbox(0,colH-0.055,colZ,colX*2+0.12,0.11,0.11,0.012,'steel',STEEL);
for(const s of [-1,1]) m.rbox(s*(colX-0.10),colH-0.20,colZ,0.22,0.20,0.10,0.012,'steel',STEEL);
// pulley housing + wheel
getPulley();
function getPulley(){
  m.rbox(0,colH-0.30,colZ,0.16,0.30,0.15,0.02,'steel',STEEL);
  m.cylHole(0,colH-0.30,colZ+0.075,'z',0.085,0.022,0.06,24,'steel',STEEL);
  m.torus(0,colH-0.30,colZ+0.075,'z',0.088,0.020,24,10,'rubber',RUBBER);
  m.cyl(0,colH-0.30,colZ+0.075,'z',0.024,0.024,0.10,16,'steel',STEEL);
}
// ---------- guide rods ----------
for(const s of [-1,1]){
  m.cyl(s*0.17,1.06,colZ,'y',0.020,0.020,1.62,14,'steel',STEEL);
  m.rbox(s*0.17,0.26,colZ,0.075,0.06,0.075,0.010,'steel',STEEL);
}
// ---------- weight stack ----------
const nPlates=10,pT=0.055,stackBase=0.30;
for(let i=0;i<nPlates;i++){
  const y=stackBase+i*pT+pT/2;
  m.rbox(0,y,colZ,0.34,pT*0.80,0.30,0.012,'rubber',RUBBER);
  m.rbox(0,y,colZ,0.345,pT*0.22,0.305,0.008,'steel',STEEL);
  // selector holes visible on front
  m.bolt(0,y,colZ+0.152,'z',0.013,0.012,'steel',STEEL);
}
const stackTop=stackBase+nPlates*pT;
m.rbox(0,stackTop+0.05,colZ,0.36,0.09,0.32,0.014,'steel',STEEL);
m.cyl(0,1.06,colZ,'y',0.018,0.018,1.55,12,'steel',STEEL);
// selector pin
m.cyl(0,stackBase+pT*6.0,colZ+0.17,'z',0.016,0.016,0.14,12,'accent',ACCENT);
m.cyl(0.0,stackBase+pT*6.0,colZ+0.24,'z',0.026,0.026,0.035,12,'accent',ACCENT);
// ---------- seat ----------
const seatZ=0.14;
m.cyl(0,0.36,seatZ,'y',0.055,0.055,0.56,16,'steel',STEEL);
m.rbox(0,0.20,seatZ,0.30,0.06,0.30,0.012,'steel',STEEL);
for(const s of [-1,1]) m.bolt(s*0.10,0.17,seatZ,'y',0.012,0.03,'steel',STEEL);
m.rbox(0,0.665,seatZ,0.48,0.09,0.44,0.035,'leather',LEATHER);
m.rbox(0,0.612,seatZ,0.45,0.025,0.41,0.010,'accent',ACCENT);
// thigh roll
m.cyl(0,0.76,seatZ+0.34,'x',0.095,0.095,0.36,20,'leather',LEATHER);
for(const s of [-1,1]) m.cyl(s*0.185,0.76,seatZ+0.34,'x',0.052,0.052,0.03,12,'rubber',RUBBER);
// roll support arms
for(const s of [-1,1]) m.rbox(s*0.16,0.60,seatZ+0.30,0.05,0.22,0.05,0.008,'steel',STEEL);
// ---------- back pad (contoured segments) ----------
for(let i=0;i<5;i++){
  const y=1.02+i*0.155;
  const w=0.46-0.03*Math.abs(i-2.4);
  m.rbox(0,y,colZ+0.34,0.47,0.15,0.085,0.030,'leather',LEATHER);
  m.rbox(0,y-0.077,colZ+0.34,0.45,0.012,0.080,0.004,'accent',ACCENT);
}
// back pad mounting plate
m.rbox(0,1.36,colZ+0.28,0.30,0.72,0.035,0.010,'steel',STEEL);
// ---------- lat bar + cable ----------
const barY=1.80,barZ=0.46;
m.cyl(0,barY,barZ,'x',0.024,0.024,0.62,16,'steel',STEEL);
for(const s of [-1,1]){
  // angled grip ends
  m.cyl(s*0.375,barY,barZ,'x',0.030,0.030,0.17,16,'rubber',RUBBER);
  m.torus(s*0.30,barY,barZ,'x',0.032,0.008,18,8,'accent',ACCENT);
}
// cable from pulley to bar (slight sag curve)
const cablePts=[];
for(let i=0;i<=8;i++){
  const t=i/8;
  const y=colH-0.30+(barY-(colH-0.30))*t;
  const z=colZ+0.075+(barZ-(colZ+0.075))*t;
  cablePts.push([0,y,z]);
}
m.tube(cablePts,0.010,8,'steel',STEEL);
// cable clip + swivel
m.rbox(0,barY+0.02,barZ,0.05,0.06,0.05,0.008,'accent',ACCENT);
m.torus(0,barY-0.03,barZ,'x',0.030,0.008,16,8,'steel',STEEL);
// ---------- accessories ----------
for(const s of [-1,1]){
  // peg handles on columns
  m.cyl(s*(colX+0.085),1.10,colZ,'x',0.022,0.022,0.16,12,'steel',STEEL);
  m.cyl(s*(colX+0.17),1.10,colZ,'x',0.030,0.030,0.10,14,'accent',ACCENT);
  // bottle holder plate lower
  m.rbox(s*(colX-0.02),0.55,colZ+0.20,0.10,0.16,0.10,0.010,'steel',STEEL);
}
// nameplate
m.rbox(0,1.62,colZ+0.075,0.34,0.13,0.02,0.006,'accent',ACCENT);
m.rbox(0,1.62,colZ+0.088,0.28,0.07,0.008,0.004,'steel',STEEL);
// floor rubber mat hint (thin)
// ---------- output ----------
const st=m.stats();console.log('stats',JSON.stringify(st));
fs.writeFileSync(OUT+'/gym_trainer_hi.obj',m.toOBJ('gym_trainer_hi'));
const atlas=buildAtlas();
fs.writeFileSync(OUT+'/gym_trainer_atlas_albedo.png',encodePNG(atlas.albedo,atlas.size,atlas.size));
fs.writeFileSync(OUT+'/gym_trainer_atlas_normal.png',encodePNG(atlas.normal,atlas.size,atlas.size));
console.log('obj KB',(fs.statSync(OUT+'/gym_trainer_hi.obj').size/1024).toFixed(1));
