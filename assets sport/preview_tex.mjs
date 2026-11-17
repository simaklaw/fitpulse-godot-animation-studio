import fs from 'node:fs';
import {parseOBJ} from './lib/render.mjs';
import {decodePNG} from './lib/decode.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_hi.obj','utf8'));
const atlas=decodePNG(ROOT+'/assets/models/gym_trainer_atlas_albedo.png');
const W=720,H=720;
const shots=[0,45,90,135,180,225,270,315];
for(let i=0;i<8;i++){
  const img=renderTex(obj,W,H,shots[i],18,{zoom:2.2});
  fs.writeFileSync(ROOT+'/assets/previews/hi_tex_'+i+'.png',encodePNG(img,W,H));
  console.log('tex shot',i,fs.statSync(ROOT+'/assets/previews/hi_tex_'+i+'.png').size);
}
function renderTex(obj,W,H,az,el,opts){
  const {vs,uvs,groups,vn}=obj;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of vs)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);}
  const c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  const span=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
  const dist=span*(opts.zoom||2.2);
  const a=az*Math.PI/180,e=el*Math.PI/180;
  const eye=[c[0]+Math.cos(a)*Math.cos(e)*dist,c[1]+Math.sin(e)*dist+span*0.05,c[2]+Math.sin(a)*Math.cos(e)*dist];
  const target=[c[0],c[1],c[2]];
  const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
  const cr=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
  const dt=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
  const nr=p=>{const l=Math.hypot(p[0],p[1],p[2])||1;return[p[0]/l,p[1]/l,p[2]/l];};
  const fw=nr(sub(target,eye)),right=nr(cr(fw,[0,1,0])),cup=cr(right,fw);
  const fl=(H/2)/Math.tan(Math.PI/4.6/2);
  const px=new Float32Array(W*H).fill(1e9);
  const img=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const gx=(x/W-.5)*2,gy=(y/H-.5)*2,r=Math.sqrt(gx*gx*.55+gy*gy);
    const b=64-38*Math.min(1,r),i=(y*W+x)*4;
    img[i]=Math.min(255,b*1.0);img[i+1]=Math.min(255,b*1.03);img[i+2]=Math.min(255,b*1.12);img[i+3]=255;
  }
  const L1=nr([.55,.85,.45]),L2=nr([-.6,.25,-.5]);
  for(const g of groups)for(const face of g.faces){
    const P=face.map(f=>vs[f.v]),N=face.map(f=>vn[f.v]);
    const fn=nr(cr(sub(P[1],P[0]),sub(P[2],P[0])));
    if(dt(fn,nr(sub(eye,P[0])))<0)continue;
    const scr=[],ts=[];let bad=false;
    for(let k=0;k<P.length;k++){
      const rel=sub(P[k],eye),z=dt(rel,fw);
      if(z<.05){bad=true;break;}
      scr.push([W/2+fl*dt(rel,right)/z,H/2-fl*dt(rel,cup)/z,z]);
      const fi=face[k];const uv=fi.vt>=0?uvs[fi.vt]:[.5,.5];
      ts.push([uv[0],uv[1]]);
    }
    if(bad)continue;
    const sv=[];
    for(let k=0;k<N.length;k++){
      const n=N[k],vd=nr(sub(eye,P[k]));
      const l1=Math.max(0,dt(n,L1)),l2=Math.max(0,dt(n,L2));
      const hv=nr([L1[0]+vd[0],L1[1]+vd[1],L1[2]+vd[2]]);
      const sp=Math.pow(Math.max(0,dt(n,hv)),40);
      sv.push({l1,l2,sp});
    }
    for(let t=1;t<scr.length-1;t++)tri([0,t,t+1]);
    function tri(ix){
      const A=scr[ix[0]],B=scr[ix[1]],C=scr[ix[2]];
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
        const z=w0*A[2]+w1*B[2]+w2*C[2],i=y*W+x;
        if(z>=px[i])continue;
        px[i]=z;
        const u=w0*ts[ix[0]][0]+w1*ts[ix[1]][0]+w2*ts[ix[2]][0];
        const v=w0*ts[ix[0]][1]+w1*ts[ix[1]][1]+w2*ts[ix[2]][1];
        const tx=Math.min(atlas.w-1,Math.max(0,Math.floor(u*atlas.w)));
        const ty=Math.min(atlas.h-1,Math.max(0,Math.floor(v*atlas.h)));
        const base=atlas.get(tx,ty);
        const l1=w0*sv[ix[0]].l1+w1*sv[ix[1]].l1+w2*sv[ix[2]].l1;
        const l2=w0*sv[ix[0]].l2+w1*sv[ix[1]].l2+w2*sv[ix[2]].l2;
        const sp=w0*sv[ix[0]].sp+w1*sv[ix[1]].sp+w2*sv[ix[2]].sp;
        for(let k=0;k<3;k++){
          const vv=base[k]*(.22+.80*l1+.26*l2)+255*sp*.45;
          const cc=vv/(1+vv/1200);
          img[i*4+k]=Math.round(255*Math.pow(Math.min(1,cc/255),1/1.9));
        }
      }
    }
  }
  return img;
}
