// Реальный хват: кисти широко, гриф на трапециях. 
// Кисть снаружи: X = -0.30 (левая), гриф чуть выше плеча и сзади.
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
const L2=len(O_FORE)+len(O_HAND)+len(O_HANDMESH);

function fk(flex,abd,twist,elbow){
  const upB=eulerYXZ(flex*D,-twist*D,-abd*D);
  const foreB=eulerYXZ(elbow*D,0,0);
  let B=upB;
  let p=add(SHOULDER,mv(B,O_FORE));
  B=mm(B,foreB);
  p=add(p,mv(B,O_HAND));
  p=add(p,mv(B,O_HANDMESH));
  return p;
}

// Перебираем цель по Z (глубина) при фиксированном X и Y на линии грифа.
for(const gripX of [-0.26,-0.30,-0.34]){
for(const gripY of [0.20,0.24,0.28]){
  let best=null;
  for(let Z=-0.05;Z<=0.25;Z+=0.005){
    const T=V(gripX,gripY,Z);
    const d=len(sub(T,SHOULDER));
    if(d<Math.abs(0.30-L2)||d>0.30+L2) continue;
    // расстояние достижимо — ищем углы
    for(let flex=-60;flex<=80;flex+=2)
    for(let abd=-10;abd<=100;abd+=2)
    for(let tw=-100;tw<=100;tw+=5)
    for(let el=60;el<=160;el+=2){
      const p=fk(flex,abd,tw,el);
      const e=len(sub(p,T));
      if(!best||e<best.e) best={e,flex,abd,tw,el,Z};
    }
  }
  if(best&&best.e<0.03)
    console.log(`X=${gripX} Y=${gripY} -> Z=${best.Z.toFixed(3)} | flex=${best.flex} abd=${best.abd} twist=${best.tw} elbow=${best.el} | зазор ${(best.e*100).toFixed(1)} см`);
}}
