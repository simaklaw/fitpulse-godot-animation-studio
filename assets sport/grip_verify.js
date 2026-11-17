// Верификация FK на вырожденных случаях, где ответ известен заранее.
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

// Полный FK от Chest, точно как в build_bone_rotations.
function handCenter(flex,abd,twist,elbow){
  const clavB=eulerYXZ(0,0,0);           // ключица нейтральна
  const upB=eulerYXZ(flex*D,-twist*D,-abd*D);
  const foreB=eulerYXZ(elbow*D,0,0);
  let B=clavB;
  let p=O_CLAV;                           // начало ключицы (в Chest)
  p=add(p,mv(B,O_UPARM));                 // плечевой сустав
  B=mm(B,upB);
  p=add(p,mv(B,O_FORE));                  // локоть
  B=mm(B,foreB);
  p=add(p,mv(B,O_HAND));                  // запястье
  p=add(p,mv(B,O_HANDMESH));              // центр кисти
  return p;
}

console.log('=== ПРОВЕРКА 1: всё по нулям (рука вниз вдоль тела) ===');
const z=handCenter(0,0,0,0);
console.log(`  кисть [${z.x.toFixed(3)}, ${z.y.toFixed(3)}, ${z.z.toFixed(3)}]`);
console.log('  ожидание: X=-0.20 (плечо), Y=0.17-0.635=-0.465, Z=0');
console.log('');

console.log('=== ПРОВЕРКА 2: локоть 90°, плечо 0 ===');
const e90=handCenter(0,0,0,90);
console.log(`  кисть [${e90.x.toFixed(3)}, ${e90.y.toFixed(3)}, ${e90.z.toFixed(3)}]`);
console.log('  предплечье должно уйти вперёд (-Z) при сгибе 90°');
console.log('');

console.log('=== ПРОВЕРКА 3: плечо вперёд 90° ===');
const f90=handCenter(90,0,0,0);
console.log(`  кисть [${f90.x.toFixed(3)}, ${f90.y.toFixed(3)}, ${f90.z.toFixed(3)}]`);
console.log('  рука должна смотреть вперёд: Z отрицательный, Y около 0.17');
