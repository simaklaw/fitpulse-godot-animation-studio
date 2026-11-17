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
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0},O_F={x:0,y:-0.30,z:0};
const BAR={x:0,y:0.14,z:0.07};
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function chain(lift,retr,abd,flex,twist,elbow){
 let B=yxz(0,-retr*D,-lift*D);
 let p=add(O_C,mv(B,O_U));
 const sh=p;
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 const elb=add(p,mv(B,O_F));
 const Bd=mm(B,yxz(elbow*D,0,0));
 const c=add(elb,mv(Bd,{x:0,y:-0.335,z:0}));
 return {c,elb,sh};
}
let best=null,cnt=0;
for(let l=0;l<=45;l+=5)for(let r=0;r<=40;r+=5)
 for(let a=20;a<=120;a+=5)for(let f=-20;f<=60;f+=5)for(let tw=-120;tw<=120;tw+=10)
  for(let e=80;e<=150;e+=5){
   const o=chain(l,r,a,f,tw,e);const err=d(o.c,BAR);
   if(err<0.015)cnt++;
   if(!best||err<best.err)best={err,l,r,a,f,tw,e,o};
  }
console.log('resheniy<1.5cm:',cnt);
console.log('BEST:',(best.err*100).toFixed(2),'sm',JSON.stringify({lift:best.l,retr:best.r,abd:best.a,flex:best.f,twist:best.tw,elbow:best.e}));
console.log('hand',`[${best.o.c.x.toFixed(3)},${best.o.c.y.toFixed(3)},${best.o.c.z.toFixed(3)}]`,'elbow',`[${best.o.elb.x.toFixed(2)},${best.o.elb.y.toFixed(2)},${best.o.elb.z.toFixed(2)}]`);
console.log('shoulder',`[${best.o.sh.x.toFixed(2)},${best.o.sh.y.toFixed(2)},${best.o.sh.z.toFixed(2)}]`);
