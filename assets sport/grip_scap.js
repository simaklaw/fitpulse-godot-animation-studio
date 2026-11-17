// Добавляем движение ЛОПАТКИ (ключицы): подъём и отведение назад.
// Ключица идёт от грудины к плечевому суставу; при хвате штанги она
// поднимается и уходит назад — это реальная анатомия, а не костыль.
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

// scapLift: подъём ключицы (X, + = вверх), scapBack: отведение назад (Z)
function fk(clavLift,clavBack,f,a,t,e){
  const clavB=eulerYXZ(clavLift*D,0,clavBack*D);
  const upB=eulerYXZ(f*D,-t*D,-a*D);
  const foreB=eulerYXZ(e*D,0,0);
  let B=clavB;
  let p=O_CLAV;
  p=add(p,mv(B,O_UPARM));   // плечевой сустав
  B=mm(B,upB);
  p=add(p,mv(B,O_FORE));
  B=mm(B,foreB);
  p=add(p,mv(B,O_HAND));
  p=add(p,mv(B,O_HANDMESH));
  return p;
}

const T=V(-0.30,0.24,0.10);
let gb=null;
for(let cl=0;cl<=35;cl+=5)
for(let cb=0;cb<=30;cb+=5)
for(let f=-20;f<=80;f+=10)
for(let a=0;a<=100;a+=10)
for(let t=-60;t<=60;t+=15)
for(let e=60;e<=160;e+=10){
  const p=fk(cl,cb,f,a,t,e);
  const d=len(sub(p,T));
  if(!gb||d<gb.d) gb={d,cl,cb,f,a,t,e,p};
}
console.log('С движением лопатки:');
console.log(`  clavLift=${gb.cl} clavBack=${gb.cb} flex=${gb.f} abd=${gb.a} twist=${gb.t} elbow=${gb.e}`);
console.log(`  зазор ${(gb.d*100).toFixed(1)} см | кисть [${gb.p.x.toFixed(3)}, ${gb.p.y.toFixed(3)}, ${gb.p.z.toFixed(3)}]`);
