// Координатный спуск В АНАТОМИЧЕСКИХ пределах.
// Плечо: сгибание -20..90 (назад почти нельзя), отведение 0..110 (наружу), 
// скрутка -70..70 (внутренняя/наружная ротация), локоть 60..160.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);
function rot(axis,ang){const c=Math.cos(ang),s=Math.sin(ang);
  if(axis==='x')return[1,0,0,0,c,-s,0,s,c];
  if(axis==='y')return[c,0,s,0,1,0,-s,0,c];
  return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];
  return R;}
function mv(M,v){return V(M[0]*v.x+M[1]*v.y+M[2]*v.z,M[3]*v.x+M[4]*v.y+M[5]*v.z,M[6]*v.x+M[7]*v.y+M[8]*v.z);}
const eulerYXZ=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const D=Math.PI/180;

const SHOULDER=V(-0.20,0.17,0.0);
const O_FORE=V(0.0,-0.30,0.0),O_HAND=V(0.0,-0.26,0.0),O_HANDMESH=V(0.0,-0.075,0.0);

function fk(f,a,t,e){
  const upB=eulerYXZ(f*D,-t*D,-a*D);
  const foreB=eulerYXZ(e*D,0,0);
  let B=upB;
  let p=add(SHOULDER,mv(B,O_FORE));
  B=mm(B,foreB);
  p=add(p,mv(B,O_HAND));
  p=add(p,mv(B,O_HANDMESH));
  return p;
}

const LIM={f:[-20,90],a:[0,110],t:[-70,70],e:[60,160]};
const clamp=(v,r)=>Math.max(r[0],Math.min(r[1],v));
function err(f,a,t,e,T){
  f=clamp(f,LIM.f);a=clamp(a,LIM.a);t=clamp(t,LIM.t);e=clamp(e,LIM.e);
  return {d:len(sub(fk(f,a,t,e),T)),f,a,t,e};
}

const T=V(-0.30,0.24,0.10);
let gb=null;
for(let sf=-20;sf<=90;sf+=15)
for(let sa=0;sa<=110;sa+=20)
for(let st=-70;st<=70;st+=20)
for(let se=60;se<=160;se+=20){
  let f=sf,a=sa,t=st,e=se,step=10;
  let cur=err(f,a,t,e,T).d;
  while(step>0.05){
    let imp=false;
    for(const [df,da,dt,de] of [[step,0,0,0],[-step,0,0,0],[0,step,0,0],[0,-step,0,0],[0,0,step,0],[0,0,-step,0],[0,0,0,step],[0,0,0,-step]]){
      const r=err(f+df,a+da,t+dt,e+de,T);
      if(r.d<cur){cur=r.d;f=r.f;a=r.a;t=r.t;e=r.e;imp=true;}
    }
    if(!imp) step*=0.5;
  }
  if(!gb||cur<gb.d) gb={d:cur,f,a,t,e};
}
console.log('Лучшее В АНАТОМИЧЕСКИХ ПРЕДЕЛАХ:');
console.log(`  flex=${gb.f.toFixed(1)} abd=${gb.a.toFixed(1)} twist=${gb.t.toFixed(1)} elbow=${gb.e.toFixed(1)}`);
console.log(`  зазор ${(gb.d*100).toFixed(1)} см`);
const p=fk(gb.f,gb.a,gb.t,gb.e);
console.log(`  кисть [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`);
console.log(`  цель  [${T.x}, ${T.y}, ${T.z}]`);
