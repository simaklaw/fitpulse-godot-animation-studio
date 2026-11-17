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
const O_CLAV=V(-0.03,0.17,0.0),O_UPARM=V(-0.17,0.0,0.0);
const O_FORE=V(0.0,-0.30,0.0),O_HAND=V(0.0,-0.26,0.0),O_HANDMESH=V(0.0,-0.075,0.0);
const SHOULDER=add(O_CLAV,O_UPARM);
function fk(f,a,t,e){
  const upB=eulerYXZ(f*D,-t*D,-a*D);
  const foreB=eulerYXZ(e*D,0,0);
  let B=upB, p=add(SHOULDER,mv(B,O_FORE));
  B=mm(B,foreB);
  p=add(p,mv(B,O_HAND)); p=add(p,mv(B,O_HANDMESH));
  return p;}
const targets=[['гриф у трапеций',V(-0.26,0.24,0.06)],['широкий хват',V(-0.34,0.20,0.04)],['узкий хват',V(-0.20,0.22,0.09)]];
for(const [name,T] of targets){
  let best=null;
  for(let f=-40;f<=80;f+=2)
  for(let a=0;a<=110;a+=2)
  for(let t=-100;t<=60;t+=2)
  for(let e=30;e<=170;e+=2){
    const p=fk(f,a,t,e), d=len(sub(p,T));
    if(!best||d<best.d) best={d,f,a,t,e,p};
  }
  console.log(`${name}: зазор ${(best.d*100).toFixed(1)} см | flex=${best.f} abd=${best.a} twist=${best.t} elbow=${best.e} | кисть [${best.p.x.toFixed(3)},${best.p.y.toFixed(3)},${best.p.z.toFixed(3)}]`);
}
