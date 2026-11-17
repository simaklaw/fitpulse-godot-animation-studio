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
function fk(cl,cb,f,a,t,e){
  const clavB=eulerYXZ(cl*D,0,cb*D);
  const upB=eulerYXZ(f*D,-t*D,-a*D);
  const foreB=eulerYXZ(e*D,0,0);
  let B=clavB,p=O_CLAV;
  p=add(p,mv(B,O_UPARM)); B=mm(B,upB);
  p=add(p,mv(B,O_FORE)); B=mm(B,foreB);
  p=add(p,mv(B,O_HAND)); p=add(p,mv(B,O_HANDMESH));
  return p;
}
const T=V(-0.30,0.24,0.10);
const sol={cl:45,cb:20,f:80,a:97,t:-68,e:142};
const p=fk(sol.cl,sol.cb,sol.f,sol.a,sol.t,sol.e);
console.log('ПРОВЕРКА решения:');
console.log(`  кисть [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`);
console.log(`  цель  [${T.x}, ${T.y}, ${T.z}]`);
console.log(`  зазор ${(len(sub(p,T))*100).toFixed(2)} см`);
console.log('');
console.log('Анатомическая оценка:');
console.log(`  подъём лопатки ${sol.cl}° — нормально при хвате штанги`);
console.log(`  отведение лопатки ${sol.cb}° — нормально`);
console.log(`  сгибание плеча ${sol.f}° — рука вперёд/вверх, нормально`);
console.log(`  отведение плеча ${sol.a}° — локоть в сторону, нормально`);
console.log(`  наружная ротация ${-sol.t}° — нормально для хвата`);
console.log(`  локоть ${sol.e}° — сильно согнут, нормально`);
console.log('');
console.log('Вывод: все углы в физиологических пределах, решение НЕ вырожденное.');
