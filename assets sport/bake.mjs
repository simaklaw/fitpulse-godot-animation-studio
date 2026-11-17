import fs from 'node:fs';
import { parseOBJ } from './lib/render.mjs';
import { decodePNG } from './lib/decode.mjs';

const ROOT = '/storage/emulated/0/Documents/fitpulse';
const obj = parseOBJ(fs.readFileSync(ROOT + '/assets/models/gym_trainer.obj', 'utf8'));
const albedo = decodePNG(ROOT + '/assets/models/gym_trainer_atlas_albedo.png');
const normal = decodePNG(ROOT + '/assets/models/gym_trainer_atlas_normal.png');

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const wrap=f=>{const x=f-Math.floor(f);return x<0?x+1:x;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const srgb=c=>{let v=Math.max(0,c);v=v/(1+v/900);return Math.round(255*Math.pow(Math.min(1,v/255),1/1.9));};

function sample(img,u,v){
  const x=clamp(Math.round(wrap(u)*img.w),0,img.w-1);
  const y=clamp(Math.round((1-wrap(v))*img.h),0,img.h-1);
  return img.get(x,y);
}

// per-vertex accumulators
const nv = obj.vs.length;
const albAcc = Array.from({length:nv},()=>[0,0,0,0]);
for (const g of obj.groups) {
  for (const f of g.faces) {
    for (const idx of f) {
      if (idx.vt < 0) continue;
      const uv = obj.uvs[idx.vt];
      const c = sample(albedo, uv[0], uv[1]);
      const a = albAcc[idx.v];
      a[0]+=c[0]; a[1]+=c[1]; a[2]+=c[2]; a[3]+=1;
    }
  }
}

const verts = [];
const colors = [];
for (let i=0;i<nv;i++){
  const a = albAcc[i];
  const n = a[3]||1;
  const base = [a[0]/n, a[1]/n, a[2]/n];
  const v = obj.vs[i];
  const nn = obj.vn[i];
  const lam = Math.max(0, dot(nn, norm([0.55,0.85,0.45]))) * 0.55 + Math.max(0, dot(nn, norm([-0.6,0.25,-0.5]))) * 0.18 + 0.38;
  const col = base.map(ch => srgb(ch*lam));
  verts.push(v);
  colors.push(col);
}

// faces (triangulated)
const faces = [];
for (const g of obj.groups) for (const f of g.faces) {
  for (let t=1;t<f.length-1;t++) faces.push([f[0].v, f[t].v, f[t+1].v]);
}

// write binary PLY with vertex colors
const header = `ply\nformat binary_little_endian 1.0\ncomment FitPulse gym trainer - baked vertex colors\nelement vertex ${verts.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${faces.length}\nproperty list uchar int vertex_indices\nend_header\n`;
const parts = [Buffer.from(header,'ascii')];
for (let i=0;i<verts.length;i++){
  const b = Buffer.alloc(15);
  b.writeFloatLE(verts[i][0],0); b.writeFloatLE(verts[i][1],4); b.writeFloatLE(verts[i][2],8);
  b[12]=colors[i][0]; b[13]=colors[i][1]; b[14]=colors[i][2];
  parts.push(b);
}
for (const f of faces){
  const b = Buffer.alloc(13);
  b[0]=3; b.writeInt32LE(f[0],1); b.writeInt32LE(f[1],5); b.writeInt32LE(f[2],9);
  parts.push(b);
}
const out = Buffer.concat(parts);
fs.writeFileSync(ROOT + '/assets/models/gym_trainer.ply', out);
console.log('PLY', verts.length, 'verts', faces.length, 'tris', (out.length/1024).toFixed(1)+'KB');
