const D=Math.PI/180;
function rot(ax,a){const c=Math.cos(a),s=Math.sin(a);
 if(ax==='x')return[1,0,0,0,c,-s,0,s,c];
 if(ax==='y')return[c,0,s,0,1,0,-s,0,c];
 return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)
 R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return R;}
function mv(M,v){return{x:M[0]*v.x+M[1]*v.y+M[2]*v.z,y:M[3]*v.x+M[4]*v.y+M[5]*v.z,z:M[6]*v.x+M[7]*v.y+M[8]*v.z};}
const yxz=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0},O_F={x:0,y:-0.30,z:0},O_H={x:0,y:-0.26,z:0},O_HM={x:0,y:-0.075,z:0};
const BAR={x:0,y:0.14,z:0.07};
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function chain(lift,retr,abd,flex,twist,elbow){
 let B=yxz(0,-retr*D,-lift*D);
 let p=add(O_C,mv(B,O_U));
 const sh=p;
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 const elb=add(p,mv(B,O_F));
 let B2=mm(B,yxz(elbow*D,0,0));
 const wrist=add(elb,mv(B2,O_H));
 const c=add(wrist,mv(B2,O_HM));
 return {c,elb,sh};
}
let cands=[];
for(let l=5;l<=35;l+=5)for(let r=-10;r<=20;r+=5)
 for(let a=20;a<=90;a+=5)for(let f=-20;f<=40;f+=5)for(let tw=90;tw<=140;tw+=5)
  for(let e=110;e<=150;e+=5){
   const o=chain(l,r,a,f,tw,e);const err=d(o.c,BAR);
   if(err<0.02 && o.elb.y<o.sh.y-0.03 && Math.abs(o.elb.x)>0.13 && o.elb.z<0.0)
     cands.push({err,l,r,a,f,tw,e,o});
  }
cands.sort((x,y)=>x.err-y.err);
console.log('cands:',cands.length);
for(const c of cands.slice(0,10)){
 console.log(' gap',(c.err*100).toFixed(1),'sm',JSON.stringify({lift:c.l,retr:c.r,abd:c.a,flex:c.f,twist:c.tw,elbow:c.e}),'elbow',`[${c.o.elb.x.toFixed(2)},${c.o.elb.y.toFixed(2)},${c.o.elb.z.toFixed(2)}]`,'sh',`[${c.o.sh.x.toFixed(2)},${c.o.sh.y.toFixed(2)},${c.o.sh.z.toFixed(2)}]`);
}
