// Финальный поиск: гриф на трапециях, кисть СНАРУЖИ плеча (X = 0.22).
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

const O_CLAV=V(-0.03,0.17,0.0), O_UPARM=V(-0.17,0.0,0.0);
const O_FORE=V(0.0,-0.30,0.0), O_HAND=V(0.0,-0.26,0.0), O_HANDMESH=V(0.0,-0.075,0.0);
// Цель: кисть СНАРУЖИ плеча (левая рука -> X отрицательный)
const TARGET=V(-0.22, 0.24, 0.10);

function handCenter(flex,abd,twist,elbow){
  const upB=eulerYXZ(flex*D,-twist*D,-abd*D);
  const foreB=eulerYXZ(elbow*D,0,0);
  let p=O_CLAV,B=eulerYXZ(0,0,0);
  p=add(p,mv(B,O_UPARM)); B=mm(B,upB);
  p=add(p,mv(B,O_FORE)); B=mm(B,foreB);
  p=add(p,mv(B,O_HAND)); p=add(p,mv(B,O_HANDMESH));
  return p;
}

const results=[];
for(let flex=-70;flex<=100;flex+=2)
for(let abd=0;abd<=120;abd+=2)
for(let tw=-90;tw<=90;tw+=3)
for(let el=0;el<=155;el+=2){
  const p=handCenter(flex,abd,tw,el);
  const e=len(sub(p,TARGET));
  if(e<0.02) results.push({e,flex,abd,tw,el,p});
}
results.sort((a,b)=>a.e-b.e);
console.log('Найдено решений с зазором < 2 см:', results.length);
for(const r of results.slice(0,8)){
  console.log(`  flex=${r.flex} abd=${r.abd} twist=${r.tw} elbow=${r.el} -> зазор ${(r.e*100).toFixed(1)} см`);
}
