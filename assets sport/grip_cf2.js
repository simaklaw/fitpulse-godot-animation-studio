const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm=v=>{const l=len(v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
const L1=0.30,L2=0.335,CLAV=[-0.03,0.17,0],S0=[-0.17,0,0];
function clavBasis(lift,ret){return yxz(0,-ret*D,-lift*D);}
function shoulder(Bc){return ad(CLAV,mv(Bc,S0));}
const T=[-0.30,0.14,0.07];

// Ищем lift/ret (шаг 1 град), затем для каждого — базис плеча по ориентации.
// Ориентация плеча: ось «вниз по руке» d1 = norm(elbow-S) должна лежать в конусе вокруг
// оси (T-S) с углом A. Плюс свободный поворот вокруг хорды -> параметризуем Bcu через
// ортонормированный базис: строим Bcu из d1 и произвольного «twist» вокруг d1,
// затем проверяем, что он реализуем (это всегда реализуемо — YXZ покрывает SO(3)).
// Значит достаточно решить по позиции: elbow должен лежать на окружности
// пересечения сфер r=L1 вокруг S и r=L2 вокруг T.
let best=null;
for(let lift=-15;lift<=45;lift+=1){
 for(let ret=-15;ret<=35;ret+=1){
  const Bc=clavBasis(lift,ret);
  const S=shoulder(Bc);
  const v=sub(T,S); const d=len(v);
  if(d>L1+L2-1e-4||d<Math.abs(L1-L2)+1e-4)continue;
  // параметр вдоль хорды
  const a=(L1*L1-L2*L2+d*d)/(2*d);
  const h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const u=nrm(v);
  const C=ad(S,[u[0]*a,u[1]*a,u[2]*a]);
  // проверяем, есть ли на окружности точка с приемлемым локтём «вниз-назад»
  // базис перпендикуляра
  let p=cross(u,[0,1,0]); if(len(p)<1e-6)p=cross(u,[1,0,0]); p=nrm(p);
  const q=cross(u,p);
  let local=null;
  for(let th=0;th<360;th+=3){
   const c=Math.cos(th*D),s=Math.sin(th*D);
   const E=[C[0]+h*(p[0]*c+q[0]*s),C[1]+h*(p[1]*c+q[1]*s),C[2]+h*(p[2]*c+q[2]*s)];
   // локоть должен быть НИЖЕ плеча и СЗАДИ (+z)
   const below=S[1]-E[1], behind=E[2]-S[2];
   if(below>0.02&&behind>0.02){
    const score=Math.abs(lift-20)+Math.abs(ret-0)+Math.abs(below-0.15)*100;
    if(!local||score<local.score)local={score,lift,ret,S,E,d,th};
   }
  }
  if(local&&(!best||local.score<best.score))best=local;
 }}
if(!best){console.log('нет решения с локтём ниже и сзади плеча');process.exit(0);}
console.log('lift',best.lift,'ret',best.ret,'d',best.d.toFixed(3));
console.log('shoulder',best.S.map(v=>v.toFixed(3)).join(','));
console.log('elbow',best.E.map(v=>v.toFixed(3)).join(','));
console.log('bar target',T.join(','));
// теперь подбираем rotation-углы плеча, дающие направление d1=norm(E-S)
const Bc=clavBasis(best.lift,best.ret);
const d1=nrm(sub(best.E,best.S));
// локальный вектор руки в покое = (0,-1,0); нужно Bcu*(0,-1,0)=d1 -> Bcu^T*d1=(0,-1,0)
// Bcu = Bc*Bu => Bu*(0,-1,0) = Bc^T*d1 = w
const w=mv([[Bc[0][0],Bc[1][0],Bc[2][0]],[Bc[0][1],Bc[1][1],Bc[2][1]],[Bc[0][2],Bc[1][2],Bc[2][2]]],d1);
console.log('w (required -Y dir in UpperArm frame)',w.map(v=>v.toFixed(3)).join(','));
// ищем flex/abd/twist грубо + уточнение
let bu=null;
for(let f=-180;f<=180;f+=5)for(let t=-180;t<=180;t+=15)for(let ab=-90;ab<=90;ab+=5){
 const B=yxz(f*D,-t*D,-ab*D);
 const got=mv(B,[0,-1,0]);
 const e=Math.hypot(got[0]-w[0],got[1]-w[1],got[2]-w[2]);
 if(!bu||e<bu.e)bu={e,f,t,ab};
}
console.log('dir err',(bu.e*1000).toFixed(0),'mm-ish; flex',bu.f,'twist',bu.t,'abd',bu.ab);
