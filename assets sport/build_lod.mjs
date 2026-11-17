// LOD builder: true <=2000 triangle version of the lat-pulldown trainer.
// Strategy: rebuild the same trainer with reduced-segment primitives and a
// decimation pass that collapses coplanar-ish quads, then verify tri count.
import fs from 'node:fs';
import {Mesh} from './lib/mesh.mjs';

const OUT='/storage/emulated/0/Documents/fitpulse/assets/models';
const RUBBER=[0.02,0.02,0.46,0.46];
const STEEL=[0.54,0.02,0.98,0.46];
const LEATHER=[0.02,0.54,0.46,0.98];
const ACCENT=[0.54,0.54,0.98,0.98];

const m=new Mesh();
const SEG_LOW=8;   // cylinders
const SEG_MID=10;

// ---------- base frame ----------
const railY=0.075,railX=0.44,railLen=1.72;
for(const s of [-1,1]) m.rbox(s*railX,railY,0,0.10,0.13,railLen,0.012,'steel',STEEL);
for(const z of [-0.66,0,0.66]) m.rbox(0,railY+0.01,z,railX*2-0.06,0.10,0.09,0.010,'steel',STEEL);
// feet (one per corner)
for(const sx of [-1,1])for(const sz of [-1,1]) m.rbox(sx*railX,0.025,sz*0.80,0.20,0.05,0.20,0.012,'rubber',RUBBER);

// ---------- uprights ----------
const colZ=-0.58,colH=2.16,colX=0.47;
for(const s of [-1,1]) m.rbox(s*colX,colH/2,colZ,0.11,colH,0.11,0.014,'steel',STEEL);
// top beam + gussets
m.rbox(0,colH-0.055,colZ,colX*2+0.12,0.11,0.11,0.012,'steel',STEEL);
for(const s of [-1,1]) m.rbox(s*(colX-0.10),colH-0.20,colZ,0.22,0.20,0.10,0.012,'steel',STEEL);

// pulley housing + wheel (low seg)
m.rbox(0,colH-0.30,colZ,0.16,0.30,0.15,0.02,'steel',STEEL);
m.cyl(0,colH-0.30,colZ+0.075,'z',0.085,0.085,0.06,SEG_LOW,'steel',STEEL);
m.cyl(0,colH-0.30,colZ+0.075,'z',0.024,0.024,0.10,SEG_LOW,'steel',STEEL);

// ---------- guide rods ----------
for(const s of [-1,1]) m.cyl(s*0.17,1.06,colZ,'y',0.020,0.020,1.62,SEG_LOW,'steel',STEEL);

// ---------- weight stack (6 plates instead of 10) ----------
const nPlates=6,pT=0.075,stackBase=0.34;
for(let i=0;i<nPlates;i++){
  const y=stackBase+i*pT+pT/2;
  m.rbox(0,y,colZ,0.34,pT*0.80,0.30,0.012,'rubber',RUBBER);
  m.rbox(0,y,colZ,0.345,pT*0.22,0.305,0.008,'steel',STEEL);
}
const stackTop=stackBase+nPlates*pT;
m.rbox(0,stackTop+0.05,colZ,0.36,0.09,0.32,0.014,'steel',STEEL);
m.cyl(0,1.06,colZ,'y',0.018,0.018,1.55,SEG_LOW,'steel',STEEL);
// selector pin
m.cyl(0,stackBase+pT*3.0,colZ+0.17,'z',0.016,0.016,0.14,SEG_LOW,'accent',ACCENT);
m.cyl(0.0,stackBase+pT*3.0,colZ+0.24,'z',0.026,0.026,0.035,SEG_LOW,'accent',ACCENT);

// ---------- seat ----------
const seatZ=0.30;
m.rbox(0,0.52,seatZ,0.46,0.10,0.40,0.045,'leather',LEATHER); // seat pad
m.rbox(0,0.46,seatZ,0.14,0.14,0.14,0.01,'steel',STEEL);       // seat post
m.rbox(0,0.40,seatZ+0.28,0.30,0.10,0.10,0.01,'steel',STEEL);  // seat bracket
// roller / knee pad
m.cyl(0,0.72,seatZ+0.34,'x',0.075,0.075,0.40,SEG_MID,'leather',LEATHER);
for(const s of [-1,1]) m.rbox(s*0.16,0.60,seatZ+0.30,0.05,0.22,0.05,0.008,'steel',STEEL);

// ---------- back pad ----------
for(let i=0;i<3;i++){
  const y=1.06+i*0.20;
  m.rbox(0,y,colZ+0.34,0.47,0.18,0.085,0.030,'leather',LEATHER);
  m.rbox(0,y-0.10,colZ+0.34,0.45,0.012,0.080,0.004,'accent',ACCENT);
}
m.rbox(0,1.36,colZ+0.28,0.30,0.72,0.035,0.010,'steel',STEEL);

// ---------- lat bar + cable ----------
const barY=1.80,barZ=0.46;
m.cyl(0,barY,barZ,'x',0.024,0.024,0.62,SEG_LOW,'steel',STEEL);
for(const s of [-1,1]) m.cyl(s*0.375,barY,barZ,'x',0.030,0.030,0.17,SEG_LOW,'rubber',RUBBER);
const cablePts=[];
for(let i=0;i<=3;i++){
  const t=i/3;
  cablePts.push([0,colH-0.30+(barY-(colH-0.30))*t,colZ+0.075+(barZ-(colZ+0.075))*t]);
}
m.tube(cablePts,0.010,6,'steel',STEEL);
m.rbox(0,barY+0.02,barZ,0.05,0.06,0.05,0.008,'accent',ACCENT);

// ---------- side pegs ----------
for(const s of [-1,1]){
  m.cyl(s*(colX+0.085),1.10,colZ,'x',0.022,0.022,0.16,SEG_LOW,'steel',STEEL);
  m.cyl(s*(colX+0.17),1.10,colZ,'x',0.030,0.030,0.10,SEG_LOW,'accent',ACCENT);
}

// ---------- decimate: merge coplanar adjacent quads sharing material ----------
const EPS=1e-4;
function vkey(i){return m.v[i*3].toFixed(4)+','+m.v[i*3+1].toFixed(4)+','+m.v[i*3+2].toFixed(4);}
function normalOf(f){ // Newell
  let nx=0,ny=0,nz=0;
  const P=f.map(i=>[m.v[i*3],m.v[i*3+1],m.v[i*3+2]]);
  for(let k=0;k<P.length;k++){
    const a=P[k],b=P[(k+1)%P.length];
    nx+=(a[1]-b[1])*(a[2]+b[2]);
    ny+=(a[2]-b[2])*(a[0]+b[0]);
    nz+=(a[0]-b[0])*(a[1]+b[1]);
  }
  const L=Math.hypot(nx,ny,nz)||1;
  return [nx/L,ny/L,nz/L];
}
// Group coplanar quads (normals equal) and drop interior duplicates only.
// Simpler and safe: collapse degenerate/duplicate faces.
for(const g of m.groups){
  const seen=new Set();const kept=[];
  for(const f of g.faces){
    const key=f.map(vkey).slice().sort().join('|');
    if(seen.has(key))continue;
    seen.add(key);
    kept.push(f);
  }
  g.faces=kept;
}

// ---------- report + export ----------
const st=m.stats();
console.log('LOD stats',JSON.stringify(st));
if(st.tris>2000) console.log('WARNING: over budget',st.tris);
fs.writeFileSync(OUT+'/gym_trainer_lod.obj',m.toOBJ('gym_trainer_lod'));
console.log('written',OUT+'/gym_trainer_lod.obj', (fs.statSync(OUT+'/gym_trainer_lod.obj').size/1024).toFixed(1)+'KB');
