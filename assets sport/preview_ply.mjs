import fs from 'node:fs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const buf=fs.readFileSync(ROOT+'/assets/models/gym_trainer.ply');
const hdrEnd=buf.indexOf('end_header\n')+11;
const hdr=buf.slice(0,hdrEnd).toString('ascii');
const nv=+(hdr.match(/element vertex (\d+)/)[1]);
const nf=+(hdr.match(/element face (\d+)/)[1]);
let off=hdrEnd;const vs=[],cs=[];
for(let i=0;i<nv;i++){vs.push([buf.readFloatLE(off),buf.readFloatLE(off+4),buf.readFloatLE(off+8)]);cs.push([buf[off+12],buf[off+13],buf[off+14]]);off+=15;}
const faces=[];
for(let i=0;i<nf;i++){const n=buf[off];const f=[];for(let k=0;k<n;k++)f.push(buf.readInt32LE(off+1+k*4));off+=1+n*4;faces.push(f);}
const W=720,H=720;
for(let s=0;s<8;s++){
  const az=s*45,el=18;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const p of vs)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);}
  const c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  const span=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
  const d=span*2.2,a=az*Math.PI/180,e=el*Math.PI/180;
  const eye=[c[0]+Math.cos(a)*Math.cos(e)*d,c[1]+Math.sin(e)*d+span*.05,c[2]+Math.sin(a)*Math.cos(e)*d];
  const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
  const cr=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
  const dt=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
  const nr=p=>{const l=Math.hypot(...p)||1;return[p[0]/l,p[1]/l,p[2]/l];};
  const fw=nr(sub(c,eye)),right=nr(cr(fw,[0,1,0])),cup=cr(right,fw);
  const fl=(H/2)/Math.tan(Math.PI/4.6/2);
  const px=new Float32Array(W*H).fill(1e9);
  const img=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const gx=(x/W-.5)*2,gy=(y/H-.5)*2,r=Math.sqrt(gx*gx*.55+gy*gy);const b=64-38*Math.min(1,r),i=(y*W+x)*4;img[i]=b;img[i+1]=Math.min(255,b*1.03);img[i+2]=Math.min(255,b*1.12);img[i+3]=255;}
  for(const f of faces){
    const P=f.map(i=>vs[i]),C=f.map(i=>cs[i]);
    const fn=nr(cr(sub(P[1],P[0]),sub(P[2],P[0])));
    if(dt(fn,nr(sub(eye,P[0])))<0)continue;
    const scr=[];let bad=false;
    for(const p of P){const rel=sub(p,eye),z=dt(rel,fw);if(z<.05){bad=true;break;}scr.push([W/2+fl*dt(rel,right)/z,H/2-fl*dt(rel,cup)/z,z]);}
    if(bad)continue;
    for(let t=1;t<scr.length-1;t++){
      const A=scr[0],B=scr[t],D=scr[t+1],CA=C[0],CB=C[t],CD=C[t+1];
      const minx=Math.max(0,Math.floor(Math.min(A[0],B[0],D[0]))),maxx=Math.min(W-1,Math.ceil(Math.max(A[0],B[0],D[0])));
      const miny=Math.max(0,Math.floor(Math.min(A[1],B[1],D[1]))),maxy=Math.min(H-1,Math.ceil(Math.max(A[1],B[1],D[1])));
      if(maxx<minx||maxy<miny)continue;
      const den=((B[1]-D[1])*(A[0]-D[0])+(D[0]-B[0])*(A[1]-D[1]));if(Math.abs(den)<1e-9)continue;
      for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
        const w0=((B[1]-D[1])*(x-D[0])+(D[0]-B[0])*(y-D[1]))/den;
        const w1=((D[1]-A[1])*(x-D[0])+(A[0]-D[0])*(y-D[1]))/den;
        const w2=1-w0-w1;
        if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;
        const z=w0*A[2]+w1*B[2]+w2*D[2],i=y*W+x;
        if(z>=px[i])continue;px[i]=z;
        for(let k=0;k<3;k++)img[i*4+k]=Math.round(w0*CA[k]+w1*CB[k]+w2*CD[k]);
      }
    }
  }
  fs.writeFileSync(ROOT+'/assets/previews/ply_'+s+'.png',encodePNG(img,W,H));
  console.log('ply shot',s,fs.statSync(ROOT+'/assets/previews/ply_'+s+'.png').size);
}
