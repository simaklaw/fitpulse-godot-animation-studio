import fs from 'node:fs';
import {parseOBJ} from './lib/render.mjs';
import {decodePNG} from './lib/decode.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_hi.obj','utf8'));
const alb=decodePNG(ROOT+'/assets/models/gym_trainer_atlas_albedo.png');
const nrm=decodePNG(ROOT+'/assets/models/gym_trainer_atlas_normal.png');
const W=720,H=720;
const {vs,uvs,groups,vn}=obj;
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const p of vs)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);}
const c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
const span=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
const nr=p=>{const l=Math.hypot(p[0],p[1],p[2])||1;return[p[0]/l,p[1]/l,p[2]/l];};
const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
const cr=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
const dt=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
const TINT={steel:1.0,rubber:1.0,leather:1.0,accent:1.0};
const L1=nr([.45,.88,.50]),L2=nr([-.65,.20,-.55]);
const shots=[[0,12],[35,14],[70,16],[115,18],[160,14],[200,12],[250,15],[300,13]];
for(let s=0;s<8;s++){
  const az=shots[s][0]*Math.PI/180, el=shots[s][1]*Math.PI/180, dist=span*1.75;
  const eye=[c[0]+Math.cos(az)*Math.cos(el)*dist,c[1]+Math.sin(el)*dist+0.15,c[2]+Math.sin(az)*Math.cos(el)*dist];
  const fw=nr(sub(c,eye)),right=nr(cr(fw,[0,1,0])),cup=cr(right,fw);
  const fl=(H/2)/Math.tan(Math.PI/4.8/2);
  const px=new Float32Array(W*H).fill(1e9);
  const img=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const gx=(x/W-.5)*2,gy=(y/H-.5)*2,r=Math.sqrt(gx*gx*.6+gy*gy);
    const b=Math.max(0,68-40*Math.min(1,r)),i=(y*W+x)*4;
    img[i]=Math.round(b*.96);img[i+1]=Math.round(b*1.0);img[i+2]=Math.round(b*1.10);img[i+3]=255;
  }
  for(const g of groups)for(const face of g.faces){
    const P=face.map(f=>vs[f.v]),N=face.map(f=>vn[f.v]);
    const scr=[],ts=[],sv=[];let bad=false;
    for(let k=0;k<P.length;k++){
      const rel=sub(P[k],eye),z=dt(rel,fw);
      if(z<.05){bad=true;break;}
      scr.push([W/2+fl*dt(rel,right)/z,H/2-fl*dt(rel,cup)/z,z]);
      ts.push(face[k].vt>=0?uvs[face[k].vt]:[.5,.5]);
      const n=N[k],vd=nr(sub(eye,P[k]));
      const l1=Math.max(0,dt(n,L1)),l2=Math.max(0,dt(n,L2));
      const hv=nr([L1[0]+vd[0],L1[1]+vd[1],L1[2]+vd[2]]);
      sv.push({l1,l2,sp:Math.pow(Math.max(0,dt(n,hv)),42),n});
    }
    if(bad)continue;
    for(let t=1;t<scr.length-1;t++){
      const A=scr[0],B=scr[t],C=scr[t+1];
      const minx=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0]))),maxx=Math.min(W-1,Math.ceil(Math.max(A[0],B[0],C[0])));
      const miny=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1]))),maxy=Math.min(H-1,Math.ceil(Math.max(A[1],B[1],C[1])));
      const den=((B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]));
      if(Math.abs(den)<1e-9)continue;
      for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
        const w0=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/den;
        const w1=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/den;
        const w2=1-w0-w1;
        if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;
        const z=w0*A[2]+w1*B[2]+w2*C[2],i=y*W+x;
        if(z>=px[i])continue;px[i]=z;
        const u=w0*ts[0][0]+w1*ts[t][0]+w2*ts[t+1][0];
        const v=w0*ts[0][1]+w1*ts[t][1]+w2*ts[t+1][1];
        const tx=Math.min(alb.w-1,Math.max(0,Math.floor(u*alb.w))),ty=Math.min(alb.h-1,Math.max(0,Math.floor(v*alb.h)));
        const base=alb.get(tx,ty);
        const nnx=w0*sv[0].n[0]+w1*sv[t].n[0]+w2*sv[t+1].n[0];
        const nny=w0*sv[0].n[1]+w1*sv[t].n[1]+w2*sv[t+1].n[1];
        const nnz=w0*sv[0].n[2]+w1*sv[t].n[2]+w2*sv[t+1].n[2];
        const pert=[(base[0]/255-.5)*.30+nnx,(base[1]/255-.5)*.30+nny,(base[2]/255-.5)*.30+nnz];
        const n2=nr(pert);
        const l1=Math.max(0,dt(n2,L1)),l2=Math.max(0,dt(n2,L2));
        const vd=nr(sub(eye,[x,y,1]));
        const hv=nr([L1[0]+vd[0],L1[1]+vd[1],L1[2]+vd[2]]);
        const sp=Math.pow(Math.max(0,dt(n2,hv)),44);
        const rim=Math.pow(1-Math.max(0,dt(n2,vd)),3)*0.18;
        for(let k=0;k<3;k++){
          const vv=base[k]*(.24+.78*l1+.22*l2)+255*sp*.40+255*rim;
          const cc=vv/(1+vv/1400);
          img[i*4+k]=Math.round(255*Math.pow(Math.min(1,cc/255),1/1.85));
        }
      }
    }
  }
  fs.writeFileSync(ROOT+'/assets/previews/final_'+s+'.png',encodePNG(img,W,H));
  console.log('final',s,fs.statSync(ROOT+'/assets/previews/final_'+s+'.png').size);
}
