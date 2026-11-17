// LOD-3: enhanced lat-pulldown trainer, strict <=2000 triangles.
// Builds on LOD-2 and spends the remaining budget on mechanical detail that
// actually reads at distance: a grooved pulley, a second pulley at the bar,
// a longer weight stack with guide-rod bushings, a foot plate, adjustment
// holes, grip collars, cable rollers and welded corner gussets.
import fs from 'node:fs';
import {Mesh} from './lib/mesh.mjs';

const OUT='/storage/emulated/0/Documents/fitpulse/assets/models';
const RUBBER=[0.02,0.02,0.46,0.46];
const STEEL=[0.54,0.02,0.98,0.46];
const LEATHER=[0.02,0.54,0.46,0.98];
const ACCENT=[0.54,0.54,0.98,0.98];

const m=new Mesh();
const S=6, S8=8;
const parts={};
let mark=m.mark();
const tally=(name)=>{parts[name]=m.sinceMark();m._m={v:m.v.length};};

// ===================== frame =====================
const railY=0.075,railX=0.44,railLen=1.72;
for(const s of [-1,1]) m.qbox(s*railX,railY,0,0.10,0.13,railLen,'steel',STEEL);
for(const z of [-0.66,0,0.66]) m.qbox(0,railY+0.01,z,railX*2-0.06,0.10,0.09,'steel',STEEL);
for(const sx of [-1,1])for(const sz of [-1,1])
  m.qbox(sx*railX,0.025,sz*0.80,0.20,0.05,0.20,'rubber',RUBBER);

const colZ=-0.58,colH=2.16,colX=0.47;
for(const s of [-1,1]) m.qbox(s*colX,colH/2,colZ,0.11,colH,0.11,'steel',STEEL);
m.qbox(0,colH-0.055,colZ,colX*2+0.12,0.11,0.11,'steel',STEEL);
for(const s of [-1,1]) m.qbox(s*(colX-0.10),colH-0.20,colZ,0.22,0.20,0.10,'steel',STEEL);
// welded corner gussets where uprights meet the base
for(const s of [-1,1]){
  m.qbox(s*colX,0.20,colZ,0.11,0.20,0.10,'steel',STEEL);
  m.qbox(s*colX,0.20,colZ-0.06,0.10,0.18,0.12,'steel',STEEL);
}
// top corner gussets
for(const s of [-1,1]) m.qbox(s*(colX-0.07),colH-0.11,colZ,0.14,0.11,0.11,'steel',STEEL);
tally('frame');

// ===================== pulleys =====================
// main pulley: cast housing + grooved sheave + hub + axle
const pY=colH-0.30, pZ=colZ+0.075;
m.qbox(0,pY,colZ,0.16,0.30,0.15,'steel',STEEL);
m.cyl(0,pY,pZ,'z',0.085,0.085,0.055,S8,'steel',STEEL);          // sheave disc
m.torus(0,pY,pZ-0.028,'z',0.070,0.014,10,3,'steel',STEEL);      // cable groove front
m.torus(0,pY,pZ+0.028,'z',0.070,0.014,10,3,'steel',STEEL);      // cable groove back
m.cyl(0,pY,pZ,'z',0.030,0.030,0.10,S,'steel',STEEL);            // hub
m.cyl(0,pY,pZ+0.07,'z',0.022,0.022,0.03,S,'accent',ACCENT);     // axle cap
// small guide roller just below the sheave
tally('pulley');

// ===================== guide rods + bushings =====================
for(const s of [-1,1]) m.cyl(s*0.17,1.06,colZ,'y',0.020,0.020,1.62,S,'steel',STEEL);
// bushings: top (fixed to top beam) and bottom (in the stack base)
for(const s of [-1,1]) for(const y of [colH-0.20, 0.40]){
  m.cylHole(s*0.17,y,colZ,'y',0.042,0.021,0.055,S,'accent',ACCENT);
}
tally('guides');

// ===================== weight stack =====================
const nPlates=10,pT=0.072,stackBase=0.34;
for(let i=0;i<nPlates;i++){
  const y=stackBase+i*pT+pT/2;
  m.qbox(0,y,colZ,0.34,pT*0.80,0.30,'rubber',RUBBER);           // plate body
  m.qbox(0,y,colZ,0.345,pT*0.22,0.305,'steel',STEEL);           // bright insert band
}
const stackTop=stackBase+nPlates*pT;
m.qbox(0,stackTop+0.05,colZ,0.36,0.09,0.32,'steel',STEEL);      // top plate
tally('stack');

// selector shaft + pin
const selMark=m.mark();
m.cyl(0,1.06,colZ,'y',0.018,0.018,1.55,S,'steel',STEEL);
const pinY=stackBase+pT*6.0;
m.cyl(0,pinY,colZ+0.17,'z',0.016,0.016,0.14,S,'accent',ACCENT);
m.cyl(0,pinY,colZ+0.24,'z',0.026,0.026,0.035,S,'accent',ACCENT);
tally('selector');

// ===================== seat =====================
const seatZ=0.30;
m.rbox(0,0.52,seatZ,0.46,0.10,0.40,0.045,'leather',LEATHER);
m.qbox(0,0.46,seatZ,0.14,0.14,0.14,'steel',STEEL);
m.qbox(0,0.40,seatZ+0.28,0.30,0.10,0.10,'steel',STEEL);
// adjustment holes on the seat post (4 positions, short cylinders)
for(let i=0;i<4;i++) m.cyl(0.078,0.42+i*0.055,seatZ,'x',0.014,0.014,0.02,S,'accent',ACCENT);
// knee roller + arms
m.cyl(0,0.72,seatZ+0.34,'x',0.075,0.075,0.40,S8,'leather',LEATHER);
for(const s of [-1,1]) m.qbox(s*0.16,0.60,seatZ+0.30,0.05,0.22,0.05,'steel',STEEL);
// foot plate at the front of the base
m.qbox(0,0.16,0.80,0.52,0.035,0.26,'accent',ACCENT);
for(const sx of [-1,1])for(const sz of [-1,1])
  m.cyl(sx*0.21,0.185,0.80+sz*0.09,'y',0.012,0.012,0.03,S,'steel',STEEL);
tally('seat');

// ===================== back pad =====================
for(let i=0;i<3;i++){
  m.rbox(0,1.06+i*0.20,colZ+0.34,0.47,0.18,0.085,0.030,'leather',LEATHER);
}
m.qbox(0,1.36,colZ+0.28,0.30,0.72,0.035,'steel',STEEL);
tally('backpad');

// ===================== bar + cable =====================
const barY=1.80,barZ=0.46;
m.cyl(0,barY,barZ,'x',0.024,0.024,0.62,S8,'steel',STEEL);
// rubber grips with knurled collars
for(const s of [-1,1]){
  m.cyl(s*0.375,barY,barZ,'x',0.030,0.030,0.17,S8,'rubber',RUBBER);
  m.torus(s*0.285,barY,barZ,'x',0.032,0.010,8,2,'steel',STEEL);
}
// second pulley block hanging under the bar
m.qbox(0,barY+0.05,barZ,0.06,0.08,0.05,'steel',STEEL);
m.cyl(0,barY+0.05,barZ,'x',0.034,0.034,0.05,S8,'steel',STEEL);
// cable from top sheave down to the bar pulley, then to the stack
const cablePts=[];
for(let i=0;i<=3;i++){
  const t=i/3;
  cablePts.push([0,(colH-0.30)+(barY+0.05-(colH-0.30))*t,(colZ+0.075)+(barZ-(colZ+0.075))*t]);
}
m.tube(cablePts,0.010,4,'steel',STEEL);
// cable continuation down the back to the selector shaft
m.tube([[0,barY+0.05,barZ],[0,colH-0.42,colZ+0.14],[0,1.30,colZ+0.05]],0.009,4,'steel',STEEL);
// cable rollers guiding it near the top of the stack
for(const z of [colZ+0.10]){
  m.cyl(0,colH-0.42,z,'x',0.028,0.028,0.05,S8,'accent',ACCENT);
  m.qbox(0,colH-0.46,z,0.05,0.09,0.05,'steel',STEEL);
}
tally('bar');

// ===================== side pegs =====================
for(const s of [-1,1]){
  m.cyl(s*(colX+0.085),1.10,colZ,'x',0.022,0.022,0.16,S,'steel',STEEL);
  m.cyl(s*(colX+0.17),1.10,colZ,'x',0.030,0.030,0.10,S,'accent',ACCENT);
  m.torus(s*(colX+0.24),1.10,colZ,'x',0.032,0.010,8,2,'rubber',RUBBER);
}
tally('pegs');

// ===================== dedupe exact duplicate faces =====================
const vkey=i=>m.v[i*3].toFixed(4)+','+m.v[i*3+1].toFixed(4)+','+m.v[i*3+2].toFixed(4);
for(const g of m.groups){
  const seen=new Set(),kept=[];
  for(const f of g.faces){
    const k=f.map(vkey).sort().join('|');
    if(seen.has(k))continue;
    seen.add(k);kept.push(f);
  }
  g.faces=kept;
}

const st=m.stats();
console.log('parts',JSON.stringify(parts));
console.log('LOD3 stats',JSON.stringify(st));
if(st.tris>2000) console.log('OVER BUDGET by',st.tris-2000);
else console.log('OK, headroom',2000-st.tris);
fs.writeFileSync(OUT+'/gym_trainer_lod.obj',m.toOBJ('gym_trainer_lod'));
console.log('written',(fs.statSync(OUT+'/gym_trainer_lod.obj').size/1024).toFixed(1)+'KB');
