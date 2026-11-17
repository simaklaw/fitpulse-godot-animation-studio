const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const T3=A=>[[A[0][0],A[1][0],A[2][0]],[A[0][1],A[1][1],A[2][1]],[A[0][2],A[1][2],A[2][2]]];
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=v=>{const l=len(v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
const L1=0.30,L2=0.335,CLAV=[-0.03,0.17,0],S0=[-0.17,0,0];
const T=[-0.30,0.14,0.07];

function fullFK(lift,ret,flex,twist,abd,elb){
 const Bc=yxz(0,-ret*D,-lift*D);
 const S=ad(CLAV,mv(Bc,S0));
 const Bcu=mul(Bc,yxz(flex*D,-twist*D,-abd*D));
 const E=ad(S,mv(Bcu,[0,-L1,0]));
 const Bcue=mul(Bcu,yxz(elb*D,0,0));
 const H=ad(E,mv(Bcue,[0,-L2,0]));
 return {S,E,H};
}
// Для заданных lift,ret: цель T. Найдём flex/twist/abd так, чтобы направление S->E
// было произвольным (2 DOF достаточно), а elb подобран из позиции.
// Ключ: сначала выбираем E на окружности, затем решаем направление, затем elb.
function solveFor(lift,ret,thetaDeg){
 const Bc=yxz(0,-ret*D,-lift*D);
 const S=ad(CLAV,mv(Bc,S0));
 const v=sub(T,S),d=len(v);
 if(d>L1+L2-1e-6||d<Math.abs(L1-L2)+1e-6)return null;
 const a=(L1*L1-L2*L2+d*d)/(2*d);
 const h=Math.sqrt(Math.max(0,L1*L1-a*a));
 const u=nrm(v),C=ad(S,[u[0]*a,u[1]*a,u[2]*a]);
 let p=cross(u,[0,1,0]); if(len(p)<1e-6)p=cross(u,[1,0,0]); p=nrm(p);
 const q=cross(u,p);
 const ct=Math.cos(thetaDeg*D),st=Math.sin(thetaDeg*D);
 const E=[C[0]+h*(p[0]*ct+q[0]*st),C[1]+h*(p[1]*ct+q[1]*st),C[2]+h*(p[2]*ct+q[2]*st)];
 // требуемое направление d1 = norm(E-S)
 const d1=nrm(sub(E,S));
 // ищем flex/twist/abd, чтобы Bc*Bu*(0,-1,0) = d1
 // w = Bc^T * d1
 const w=mv(T3(Bc),d1);
 let best=null;
 for(let f=-180;f<=180;f+=3)for(let t=-180;t<=180;t+=9)for(let ab=-120;ab<=120;ab+=3){
  const g=mv(yxz(f*D,-t*D,-ab*D),[0,-1,0]);
  const e=len(sub(g,w));
  if(!best||e<best.e)best={e,f,t,ab};
 }
 // уточнение
 for(const st2 of [2,1,0.3,0.1]){
  let imp=true;
  while(imp){imp=false;
   for(const k of ['f','t','ab'])for(const sg of [-1,1]){
    const c={...best};c[k]=best[k]+sg*st2;
    const g=mv(yxz(c.f*D,-c.t*D,-c.ab*D),[0,-1,0]);
    const e=len(sub(g,w));
    if(e<best.e-1e-12){best=c;imp=true;}
   }}}
 // угол локтя из треугольника S-E-T (внутренний угол в локте)
 const v1=nrm(sub(S,E)),v2=nrm(sub(T,E));
 const cs=v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2];
 const elb=Math.acos(Math.max(-1,Math.min(1,cs)))/D;
 const r=fullFK(lift,ret,best.f,best.t,best.ab,elb);
 return {lift,ret,theta:thetaDeg,flex:best.f,twist:best.t,abd:best.ab,elb,err:len(sub(r.H,T)),r};
}
let out=null;
for(let lift=-20;lift<=40;lift+=5){
 for(let ret=-20;ret<=30;ret+=5){
  for(let th=0;th<360;th+=20){
   const r=solveFor(lift,ret,th);
   if(!r)continue;
   // анатомические фильтры: локоть ниже плеча, сзади, twist разумный
   if(!(r.r.S[1]-r.r.E[1]>0.02))continue;
   if(!(r.r.E[2]-r.r.S[2]>0.0))continue;
   const score=r.err*1000+Math.abs(lift-20)*0.4+Math.abs(ret-5)*0.3+Math.abs(r.twist-100)*0.05;
   if(!out||score<out.score)out={score,...r};
  }
 }}
if(!out){console.log('НЕТ РЕШЕНИЯ');process.exit(0);}
console.log('err mm',(out.err*1000).toFixed(2));
console.log('lift',out.lift,'ret',out.ret,'theta',out.theta);
console.log('flex',out.flex.toFixed(1),'twist',out.twist.toFixed(1),'abd',out.abd.toFixed(1),'elbow',out.elb.toFixed(1));
console.log('S',out.r.S.map(v=>v.toFixed(3)).join(','));
console.log('E',out.r.E.map(v=>v.toFixed(3)).join(','));
console.log('H',out.r.H.map(v=>v.toFixed(3)).join(','),'target',T.join(','));
