// Почему ноль? Смотрим, КУДА вообще может попасть кисть при разумных углах.
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

// Границы достижимого облака
let minX=99,maxX=-99,minY=99,maxY=-99,minZ=99,maxZ=-99;
for(let flex=-80;flex<=100;flex+=5)
for(let abd=0;abd<=120;abd+=5)
for(let tw=-100;tw<=100;tw+=10)
for(let el=60;el<=170;el+=5){
  const p=fk(flex,abd,tw,el);
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
  minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
}
console.log('Достижимое облако кисти (Chest-локально):');
console.log(`  X: [${minX.toFixed(3)}, ${maxX.toFixed(3)}]`);
console.log(`  Y: [${minY.toFixed(3)}, ${maxY.toFixed(3)}]`);
console.log(`  Z: [${minZ.toFixed(3)}, ${maxZ.toFixed(3)}]`);
console.log('');
console.log('Цель грифа [-0.30, 0.24, 0.10]:');
console.log(`  X=-0.30 в диапазоне? ${-0.30>=minX&&-0.30<=maxX}`);
console.log(`  Y= 0.24 в диапазоне? ${0.24>=minY&&0.24<=maxY}`);
console.log(`  Z= 0.10 в диапазоне? ${0.10>=minZ&&0.10<=maxZ}`);
console.log('');
console.log('Вывод: рука в текущих каналах НЕ МОЖЕТ подняться выше Y=',maxY.toFixed(3));
console.log('Причина: shoulder_flexion вращает вокруг X, но НЕ ПОДНИМАЕТ руку');
console.log('вверх — для подъёма нужен абдукция (axis Z), а её знак уводит руку вниз.');
