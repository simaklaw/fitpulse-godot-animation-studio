// LOD-2: strict <=2000 triangle build of the lat-pulldown trainer.
// Sharp-edged boxes (qbox, 12 tris) for the structural frame, low-segment
// cylinders (6-8 seg) for the round parts, and the chamfered rbox only where
// a soft silhouette actually matters (pads, grip collars).
import fs from 'node:fs';
import {Mesh} from './lib/mesh.mjs';

const OUT='/storage/emulated/0/Documents/fitpulse/assets/models';
const RUBBER=[0.02,0.02,0.46,0.46];
const STEEL=[0.54,0.02,0.98,0.46];
const LEATHER=[0.02,0.54,0.46,0.98];
const ACCENT=[0.54,0.54,0.98,0.98];

const m=new Mesh();
const S=6;   // main cylinder segments
const S8=8;

// ---------- floor frame ----------
const railY=0.075,railX=0.44,railLen=1.72;
for(const s of [-1,1]) m.qbox(s*railX,railY,0,0.10,0.13,railLen,'steel',STEEL);
for(const z of [-0.66,0,0.66]) m.qbox(0,railY+0.01,z,railX*2-0.06,0.10,0.09,'steel',STEEL);
for(const sx of [-1,1])for(const sz of [-1,1])
  m.qbox(sx*railX,0.025,sz*0.80,0.20,0.05,0.20,'rubber',RUBBER);

// ---------- uprights + top beam ----------
const colZ=-0.58,colH=2.16,colX=0.47;
for(const s of [-1,1]) m.qbox(s*colX,colH/2,colZ,0.11,colH,0.11,'steel',STEEL);
m.qbox(0,colH-0.055,colZ,colX*2+0.12,0.11,0.11,'steel',STEEL);
for(const s of [-1,1]) m.qbox(s*(colX-0.10),colH-0.20,colZ,0.22,0.20,0.10,'steel',STEEL);

// ---------- pulley ----------
m.qbox(0,colH-0.30,colZ,0.16,0.30,0.15,'steel',STEEL);
m.cyl(0,colH-0.30,colZ+0.075,'z',0.085,0.085,0.06,S8,'steel',STEEL);
m.cyl(0,colH-0.30,colZ+0.075,'z',0.026,0.026,0.10,S,'steel',STEEL);

// ---------- guide rods ----------
for(const s of [-1,1]) m.cyl(s*0.17,1.06,colZ,'y',0.020,0.020,1.62,S,'steel',STEEL);

// ---------- weight stack: 6 plates, thin geometry ----------
const nPlates=6,pT=0.075,stackBase=0.34;
for(let i=0;i<nPlates;i++){
  const y=stackBase+i*pT+pT/2;
  m.qbox(0,y,colZ,0.34,pT*0.80,0.30,'rubber',RUBBER);
  m.qbox(0,y,colZ,0.345,pT*0.22,0.305,'steel',STEEL);
}
const stackTop=stackBase+nPlates*pT;
m.qbox(0,stackTop+0.05,colZ,0.36,0.09,0.32,'steel',STEEL);
m.cyl(0,1.06,colZ,'y',0.018,0.018,1.55,S,'steel',STEEL);
// selector pin
const pinY=stackBase+pT*3.0;
m.cyl(0,pinY,colZ+0.17,'z',0.016,0.016,0.14,S,'accent',ACCENT);
m.cyl(0,pinY,colZ+0.24,'z',0.026,0.026,0.035,S,'accent',ACCENT);

// ---------- seat (padded, keeps chamfer) ----------
const seatZ=0.30;
m.rbox(0,0.52,seatZ,0.46,0.10,0.40,0.045,'leather',LEATHER);
m.qbox(0,0.46,seatZ,0.14,0.14,0.14,'steel',STEEL);
m.qbox(0,0.40,seatZ+0.28,0.30,0.10,0.10,'steel',STEEL);
// knee roller
m.cyl(0,0.72,seatZ+0.34,'x',0.075,0.075,0.40,S8,'leather',LEATHER);
for(const s of [-1,1]) m.qbox(s*0.16,0.60,seatZ+0.30,0.05,0.22,0.05,'steel',STEEL);

// ---------- back pad: 3 contoured segments ----------
for(let i=0;i<3;i++){
  const y=1.06+i*0.20;
  m.rbox(0,y,colZ+0.34,0.47,0.18,0.085,0.030,'leather',LEATHER);
}
m.qbox(0,1.36,colZ+0.28,0.30,0.72,0.035,'steel',STEEL);

// ---------- lat bar + cable ----------
const barY=1.80,barZ=0.46;
m.cyl(0,barY,barZ,'x',0.024,0.024,0.62,S8,'steel',STEEL);
for(const s of [-1,1]) m.cyl(s*0.375,barY,barZ,'x',0.030,0.030,0.17,S8,'rubber',RUBBER);
const cablePts=[];
for(let i=0;i<=3;i++){
  const t=i/3;
  cablePts.push([0,colH-0.30+(barY-(colH-0.30))*t,colZ+0.075+(barZ-(colZ+0.075))*t]);
}
m.tube(cablePts,0.010,4,'steel',STEEL);
m.qbox(0,barY+0.02,barZ,0.05,0.06,0.05,'accent',ACCENT);

// ---------- side pegs ----------
for(const s of [-1,1]){
  m.cyl(s*(colX+0.085),1.10,colZ,'x',0.022,0.022,0.16,S,'steel',STEEL);
  m.cyl(s*(colX+0.17),1.10,colZ,'x',0.030,0.030,0.10,S,'accent',ACCENT);
}

// ---------- dedupe identical faces ----------
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
console.log('LOD2 stats',JSON.stringify(st));
if(st.tris>2000){
  console.log('OVER BUDGET by',st.tris-2000);
} else {
  console.log('OK, headroom',2000-st.tris);
}
fs.writeFileSync(OUT+'/gym_trainer_lod.obj',m.toOBJ('gym_trainer_lod'));
console.log('written',(fs.statSync(OUT+'/gym_trainer_lod.obj').size/1024).toFixed(1)+'KB');
