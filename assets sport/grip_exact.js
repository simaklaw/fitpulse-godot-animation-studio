// Точное решение: для каждого направления предплечья ищем угол плеча
// аналитически, без плотного перебора.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);
const scale=(a,s)=>V(a.x*s,a.y*s,a.z*s);
function rot(axis,ang){const c=Math.cos(ang),s=Math.sin(ang);
  if(axis==='x')return[1,0,0,0,c,-s,0,s,c];
  if(axis==='y')return[c,0,s,0,1,0,-s,0,c];
  return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];
  return R;}
function mv(M,v){return V(M[0]*v.x+M[1]*v.y+M[2]*v.z,M[3]*v.x+M[4]*v.y+M[5]*v.z,M[6]*v.x+M[7]*v.y+M[8]*v.z);}
const eulerYXZ=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const D=Math.PI/180,R2D=180/Math.PI;

const O_CLAV=V(-0.03,0.17,0.0),O_UPARM=V(-0.17,0.0,0.0);
const O_FORE=V(0.0,-0.30,0.0),O_HAND=V(0.0,-0.26,0.0),O_HANDMESH=V(0.0,-0.075,0.0);
const SHOULDER=add(O_CLAV,O_UPARM);   // [-0.20, 0.17, 0]
const L2=len(O_FORE)+len(O_HAND)+len(O_HANDMESH);

console.log('Плечевой сустав:',`[${SHOULDER.x},${SHOULDER.y},${SHOULDER.z}]`);
console.log('Длина рука-кисть L2 =',L2.toFixed(3),'м');
console.log('');

// Проверяем: какая точка на грифе (X фиксирован по ширине хвата)
// реально достижима. Гриф — линия вдоль X на высоте Y и глубине Z.
// Ищем по сетке Y,Z при фиксированном X хвата.
for(const gripX of [-0.20,-0.22,-0.26]){
  let best=null;
  for(let Y=0.10;Y<=0.35;Y+=0.005)
  for(let Z=-0.10;Z<=0.20;Z+=0.005){
    const T=V(gripX,Y,Z);
    const d=len(sub(T,SHOULDER));
    const err=Math.abs(d-L2);
    if(!best||err<best.err) best={err,Y,Z,d};
  }
  console.log(`Хват X=${gripX}: достижимая при выпрямленной руке точка`);
  console.log(`  Y=${best.Y.toFixed(3)} Z=${best.Z.toFixed(3)} | расстояние ${best.d.toFixed(3)} м | ошибка ${(best.err*100).toFixed(1)} см`);
}
console.log('');
console.log('Для справки: при согнутом локте кисть может быть БЛИЖЕ к плечу, чем L2.');
console.log('Минимальное расстояние (полный сгиб):',Math.abs(0.30-L2).toFixed(3),'м');
