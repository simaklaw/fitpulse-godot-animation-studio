// Координатный спуск: быстро, без перебора.
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
function err(f,a,t,e,T){return len(sub(fk(f,a,t,e),T));}

const T=V(-0.30,0.24,0.10);
// Старт из нескольких точек, чтобы не застрять в локальном минимуме
let globalBest=null;
for(let sf=-80;sf<=80;sf+=20)
for(let sa=0;sa<=120;sa+=30)
for(let st=-90;st<=90;st+=45)
for(let se=60;se<=165;se+=20){
  let f=sf,a=sa,t=st,e=se;
  let cur=err(f,a,t,e,T);
  let step=8;
  while(step>0.05){
    let improved=false;
    for(const [df,da,dt,de] of [[step,0,0,0],[-step,0,0,0],[0,step,0,0],[0,-step,0,0],[0,0,step,0],[0,0,-step,0],[0,0,0,step],[0,0,0,-step]]){
      const nf=f+df,na=a+da,nt=t+dt,ne=e+de;
      const d=err(nf,na,nt,ne,T);
      if(d<cur){cur=d;f=nf;a=na;t=nt;e=ne;improved=true;}
    }
    if(!improved) step*=0.5;
  }
  if(!globalBest||cur<globalBest.cur) globalBest={cur,f,a,t,e};
}
console.log('Лучший результат координатного спуска:');
console.log(`  flex=${globalBest.f.toFixed(1)} abd=${globalBest.a.toFixed(1)} twist=${globalBest.t.toFixed(1)} elbow=${globalBest.e.toFixed(1)}`);
console.log(`  зазор ${(globalBest.cur*100).toFixed(2)} см`);
const p=fk(globalBest.f,globalBest.a,globalBest.t,globalBest.e);
console.log(`  кисть [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`);
console.log(`  цель  [${T.x.toFixed(3)}, ${T.y.toFixed(3)}, ${T.z.toFixed(3)}]`);
