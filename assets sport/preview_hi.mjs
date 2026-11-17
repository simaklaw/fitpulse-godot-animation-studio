import fs from 'node:fs';
import {parseOBJ} from './lib/render.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_hi.obj','utf8'));
const W=720,H=720;
const {vs,groups,vn}=obj;
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const p of vs)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);}
const c=[0,1.1,0],span=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
const nr=p=>{const l=Math.hypot(p[0],p[1],p[2])||1;return[p[0]/l,p[1]/l,p[2]/l];};
const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
const cr=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
const dt=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
const shots=[0,45,90,135,180,225,270,315];
for(let s=0;s<8;s++){
  const a=shots[s]*Math.PI/180,e=Math.PI/9,dist=span*1.9;
  const eye=[c[0]+Math.cos(a)*Math.cos(e)*dist,c[1]+Math.sin(e)*dist,c[2]+Math.sin(a)*Math.cos(e)*dist];
  const fw=nr(sub(c,eye)),right=nr(cr(fw,[0,1,0])),cup=cr(right,fw);
  const fl=(H/2)/Math.tan(Math.PI/4.6/2);
  const px=new Float32Array(W*H).fill(1e9);
  const img=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;img[i]=26;img[i+1]=28;img[i+2]=34;img[i+3]=255;}
  const L1=nr([.5,.9,.4]),L2=nr([-.6,.3,-.6]);
  for(const g of groups)for(const face of g.faces){
    const P=face.map(f=>vs[f.v]),N=face.map(f=>vn[f.v]);
    const scr=[],sv=[];
    let bad=false;
    for(let k=0;k<P.length;k++){
      const rel=sub(P[k],eye),z=dt(rel,fw);
      if(z<.05){bad=true;break;}
      scr.push([W/2+fl*dt(rel,right)/z,H/2-fl*dt(rel,cup)/z,z]);
      const n=N[k],vd=nr(sub(eye,P[k]));
      const l1=Math.max(0,dt(n,L1)),l2=Math.max(0,dt(n,L2));
      const hv=nr([L1[0]+vd[0],L1[1]+vd[1],L1[2]+vd[2]]);
      sv.push({l1,l2,sp:Math.pow(Math.max(0,dt(n,hv)),36)});
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
        const l1=w0*sv[0].l1+w1*sv[t].l1+w2*sv[t+1].l1;
        const l2=w0*sv[0].l2+w1*sv[t].l2+w2*sv[t+1].l2;
        const sp=w0*sv[0].sp+w1*sv[t].sp+w2*sv[t+1].sp;
        const base=g.name==='steel'?[186,190,198]:g.name==='rubber'?[54,55,58]:g.name==='leather'?[150,120,96]:[224,120,32];
        for(let k=0;k<3;k++){
          const vv=base[k]*(.20+.85*l1+.25*l2)+255*sp*.35;
          img[i*4+k]=Math.round(Math.min(255,vv));
        }
      }
    }
  }
  fs.writeFileSync(ROOT+'/assets/previews/hi_'+s+'.png',encodePNG(img,W,H));
  console.log('shot',s);
}
