// Аналитика: для каждых (flex,abd,twist) локоть вычисляется из условия
// |плечо→цель| = |L1 + поворот(L2)|. Перебираем только 3 угла плеча грубо.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function rot(axis,ang){const c=Math.cos(ang),s=Math.sin(ang);
  if(axis==='x')return[1,0,0,0,c,-s,0,s,c];
  if(axis==='y')return[c,0,s,0,1,0,-s,0,c];
  return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];
  return R;}
function mv(M,v){return V(M[0]*v.x+M[1]*v.y+M[2]*v.z,M[3]*v.x+M[4]*v.y+M[5]*v.z,M[6]*v.x+M[7]*v.y+M[8]*v.z);}
const eulerYXZ=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const D=Math.PI/180, R2D=180/Math.PI;

const SHOULDER=V(-0.20,0.17,0.0);
const O_FORE=V(0.0,-0.30,0.0),O_HAND=V(0.0,-0.26,0.0),O_HANDMESH=V(0.0,-0.075,0.0);
const TARGET=V(-0.22,0.24,0.10);
const L1=0.30, L2=len(O_FORE)+len(O_HAND)+len(O_HANDMESH);

// Кисть = upperArm_origin + B*(L2 вниз). Нам нужно попасть в TARGET.
// Значит B*(0,-L2,0) должен равняться TARGET - SHOULDER - смещению? 
// Проще: кисть = SHOULDER + B*V(0,-L2,0), где B — итоговый поворот руки.
// Ищем B (из flex/abd/twist) такое, что |TARGET-SHOULDER| = L2 (при выпрямленном)
// Но у нас ещё локоть сгибается -> две кости. Делаем честный FK.

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

// Грубый перебор только по 3 углам плеча (шаг 2°), локоть не перебираем — 
// а сразу считаем: сколько нужно, чтобы расстояние совпало.
let best=null;
for(let flex=-90;flex<=120;flex+=2)
for(let abd=-20;abd<=140;abd+=2)
for(let tw=-120;tw<=120;tw+=3){
  const upB=eulerYXZ(flex*D,-tw*D,-abd*D);
  // Позиция локтя при данном повороте плеча
  const elbowPos=add(SHOULDER,mv(upB,O_FORE));
  // Нужно: |TARGET - elbowPos| = L2 (расстояние локоть→кисть фиксировано)
  const d=len(sub(TARGET,elbowPos));
  const err=Math.abs(d-L2);
  if(!best||err<best.err) best={err,flex,abd,tw,d,L2,elbowPos};
}
console.log('Лучшее по 3 углам плеча (локоть подобран автоматически):');
console.log(`  flex=${best.flex} abd=${best.abd} twist=${best.tw}`);
console.log(`  расстояние локоть→цель=${best.d.toFixed(4)} м, нужно L2=${best.L2.toFixed(4)} м`);
console.log(`  ошибка=${(best.err*100).toFixed(2)} см`);
console.log('');
console.log('Это значит: при данных углах плеча цель НЕ достижима локтем —',
  best.err>0.01?'ошибка велика':'почти точно');
