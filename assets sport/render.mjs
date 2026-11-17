import {encodePNG} from './tex.mjs';
// Software rasterizer with per-vertex normals (smooth), z-buffer, 2-light shading.
export function parseOBJ(txt){
  const vs=[],uvs=[],groups=[];let cur=null;
  for(const line of txt.split('\n')){
    if(!line)continue;
    const t=line.split(/\s+/);
    if(t[0]==='v')vs.push([+t[1],+t[2],+t[3]]);
    else if(t[0]==='vt')uvs.push([+t[1],+t[2]]);
    else if(t[0]==='g'){cur={name:t[1],faces:[]};groups.push(cur);}
    else if(t[0]==='f'){
      const idx=t.slice(1).map(s=>{const p=s.split('/');return {v:+p[0]-1,vt:p[1]?+p[1]-1:-1};});
      cur.faces.push(idx);
    }
  }
  // accumulate vertex normals from faces
  const vn=vs.map(()=>[0,0,0]);
  for(const g of groups)for(const f of g.faces){
    const P=f.map(x=>vs[x.v]);
    for(let t=1;t<P.length-1;t++){
      const n=cross(sub(P[t],P[0]),sub(P[t+1],P[0]));
      for(const idx of [0,t,t+1]){const o=vn[f[idx].v];o[0]+=n[0];o[1]+=n[1];o[2]+=n[2];}
    }
  }
  for(const n of vn)normInPlace(n);
  return {vs,uvs,groups,vn};
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const len=(a)=>Math.sqrt(dot(a,a));const norm=(a)=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const normInPlace=(a)=>{const l=len(a)||1;a[0]/=l;a[1]/=l;a[2]/=l;};

function srgb(c){let v=Math.max(0,c);v=v/(1+v/900);return Math.round(255*Math.pow(Math.min(1,v/255),1/1.9));}

export function render(obj,W,H,az,el,matColors,opts){
  const {vs,groups,vn}=obj;
  opts=opts||{};
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of vs)for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p[i]);mx[i]=Math.max(mx[i],p[i]);}
  const c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  const span=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
  const dist=span*(opts.zoom||2.15);
  const a=az*Math.PI/180,e=el*Math.PI/180;
  const eye=[c[0]+Math.cos(a)*Math.cos(e)*dist,c[1]+Math.sin(e)*dist+span*0.06,c[2]+Math.sin(a)*Math.cos(e)*dist];
  const target=[c[0],c[1]+span*0.02,c[2]];
  const fw=norm(sub(target,eye));const right=norm(cross(fw,[0,1,0]));const cup=cross(right,fw);
  const fov=Math.PI/4.6;const fl=(H/2)/Math.tan(fov/2);
  const px=new Float32Array(W*H).fill(1e9);
  const img=Buffer.alloc(W*H*4);
  // studio gradient backdrop with vignette
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const gx=(x/W-0.5)*2,gy=(y/H-0.5)*2;
    const r=Math.sqrt(gx*gx*0.55+gy*gy);
    const base=64-38*Math.min(1,r);
    const i=(y*W+x)*4;
    img[i]=srgb(base*0.92);img[i+1]=srgb(base*0.95);img[i+2]=srgb(base*1.05);img[i+3]=255;
  }
  const L1=norm([0.55,0.85,0.45]);
  const L2=norm([-0.6,0.25,-0.5]);
  const camDir=norm(sub(target,eye));
  const keys=[],acc=[];
  for(const g of groups){
    const base=matColors[g.name]||[180,180,180];
    for(const face of g.faces){
      const P=face.map(f=>vs[f.v]);
      const N=face.map(f=>vn[f.v]);
      const viewDir=norm(sub(eye,P[0]));
      const fn=norm(cross(sub(P[1],P[0]),sub(P[2],P[0])));
      if(dot(fn,viewDir)<0)continue; // backface cull
      // project
      const scr=[];let bad=false;
      for(const p of P){
        const rel=sub(p,eye);const z=dot(rel,fw);
        if(z<0.05){bad=true;break;}
        scr.push([W/2+fl*dot(rel,right)/z, H/2-fl*dot(rel,cup)/z, z]);
      }
      if(bad)continue;
      const shadeV=[];
      for(const n of N){
        const lam1=Math.max(0,dot(n,L1));
        const lam2=Math.max(0,dot(n,L2));
        const hv=norm(add(L1,viewDir));
        const spec=Math.pow(Math.max(0,dot(n,hv)),42);
        const fres=Math.pow(1-Math.max(0,dot(n,viewDir)),3)*0.22;
        let col=[0,0,0];
        for(let k=0;k<3;k++){
          const ambient=0.20+0.10*Math.max(0,n[1]);
          const v=base[k]*(ambient+0.85*lam1+0.28*lam2)+255*spec*0.55+255*fres;
          col[k]=srgb(v);
        }
        shadeV.push(col);
      }
      for(let t=1;t<scr.length-1;t++){
        tri(scr[0],scr[t],scr[t+1],[shadeV[0],shadeV[t],shadeV[t+1]]);
      }
      function tri(A,B,C,cols){
        const minx=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0]))),maxx=Math.min(W-1,Math.ceil(Math.max(A[0],B[0],C[0])));
        const miny=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1]))),maxy=Math.min(H-1,Math.ceil(Math.max(A[1],B[1],C[1])));
        if(maxx<minx||maxy<miny)return;
        const den=((B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]));
        if(Math.abs(den)<1e-9)return;
        for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
          const w0=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/den;
          const w1=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/den;
          const w2=1-w0-w1;
          if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;
          const z=w0*A[2]+w1*B[2]+w2*C[2];
          const i=y*W+x;
          if(z<px[i]){
            px[i]=z;
            img[i*4]=Math.round(w0*cols[0][0]+w1*cols[1][0]+w2*cols[2][0]);
            img[i*4+1]=Math.round(w0*cols[0][1]+w1*cols[1][1]+w2*cols[2][1]);
            img[i*4+2]=Math.round(w0*cols[0][2]+w1*cols[1][2]+w2*cols[2][2]);
          }
        }
      }
    }
  }
  return img;
}
export {encodePNG};
