import fs from 'node:fs';
import {parseOBJ} from './lib/render.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer.obj','utf8'));
const MAT={steel:[176,180,187],rubber:[48,49,52],leather:[124,92,64],accent:[226,104,32]};
const srgb=c=>{let v=Math.max(0,c);v=v/(1+v/900);return Math.round(255*Math.pow(Math.min(1,v/255),1/1.9));};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const l=Math.hypot(...a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
const vcol=obj.vs.map(()=>null);
for(const g of obj.groups){
  const base=MAT[g.name]||[160,160,160];
  for(const f of g.faces)for(const idx of f){
    if(!vcol[idx.v])vcol[idx.v]=[0,0,0,0];
    const a=vcol[idx.v];a[0]+=base[0];a[1]+=base[1];a[2]+=base[2];a[3]++;
  }
}
const L1=norm([.55,.85,.45]),L2=norm([-.6,.25,-.5]);
const verts=[],colors=[];
for(let i=0;i<obj.vs.length;i++){
  const a=vcol[i]||[160,160,160,1];const n=a[3]||1;
  const base=[a[0]/n,a[1]/n,a[2]/n];
  const nn=obj.vn[i]||[0,1,0];
  const lam=Math.max(0,dot(nn,L1))*.75+Math.max(0,dot(nn,L2))*.22+0.34;
  verts.push(obj.vs[i]);
  colors.push(base.map(c=>srgb(c*lam)));
}
const faces=[];
for(const g of obj.groups)for(const f of g.faces)for(let t=1;t<f.length-1;t++)faces.push([f[0].v,f[t].v,f[t+1].v]);
const header='ply\nformat binary_little_endian 1.0\ncomment FitPulse gym trainer\nelement vertex '+verts.length+'\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face '+faces.length+'\nproperty list uchar int vertex_indices\nend_header\n';
const parts=[Buffer.from(header,'ascii')];
for(let i=0;i<verts.length;i++){const b=Buffer.alloc(15);b.writeFloatLE(verts[i][0],0);b.writeFloatLE(verts[i][1],4);b.writeFloatLE(verts[i][2],8);b[12]=colors[i][0];b[13]=colors[i][1];b[14]=colors[i][2];parts.push(b);}
for(const f of faces){const b=Buffer.alloc(13);b[0]=3;b.writeInt32LE(f[0],1);b.writeInt32LE(f[1],5);b.writeInt32LE(f[2],9);parts.push(b);}
const out=Buffer.concat(parts);
fs.writeFileSync(ROOT+'/assets/models/gym_trainer.ply',out);
console.log('PLY verts',verts.length,'tris',faces.length,(out.length/1024).toFixed(1)+'KB');
