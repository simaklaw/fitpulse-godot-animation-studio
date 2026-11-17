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
function clavB(lift,ret){return yxz(0,-ret*D,-lift*D);}
// углы плеча из требуемого направления d1 (локальный -Y уходит в d1)
function solveShoulder(Bc,d1){
 const w=mv(T3(Bc),d1);
 // B*(0,-1,0)=w, B=Ry*Rx*Rz
 // Rx*Rz*(0,-1,0) = (sinZ, -cosZ*cosX, -cosZ*sinX)... вычисляем численно + уточнение
 let best=null;
 for(let f=-180;f<=180;f+=2)for(let t=-180;t<=180;t+=10)for(let ab=-90;ab<=90;ab+=2){
  const B=yxz(f*D,-t*D,-ab*D);
  const g=mv(B,[0,-1,0]);
  const e=len(sub(g,w));
  if(!best||e<best.e)best={e,f,t,ab};
 }
 for(const step of [5,2,1,0.5,0.2,0.1]){
  let imp=true;
  while(imp){imp=false;
   for(const k of ['f','t','ab']){
    for(const sg of [-1,1]){
     const c={...best};c[k]=best[k]+sg*step;
     const g=mv(yxz(c.f*D,-c.t*D,-c.ab*D),[0,-1,0]);
     const e=len(sub(g,w));
     if(e<best.e-1e-12){best=c;imp=true;}
    }}}}
 return best;
}
// полный FK-тест
function fk(lift,ret,flex,twist,abd,elb){
 const Bc=clavB(lift,ret);
 const sh=ad(CLAV,mv(Bc,S0));
 const Bcu=mul(Bc,yxz(flex*D,-twist*D,-abd*D));
 const el=ad(sh,mv(Bcu,[0,-L1,0]));
 const hd=ad(el,mv(mul(Bcu,yxz(elb*D,0,0)),[0,-L2,0]));
 return {sh,el,hd};
}
// перебор lift/ret, для каждого — лучший theta на окружности (с учётом, что затем
// решаем ориентацию и локоть; проверяем ИТОГОВЫЙ FK)
let out=null;
for(let lift=-10;lift<=40;lift+=1){
 for(let ret=-10;ret<=30;ret+=1){
  const Bc=clavB(lift,ret);
  const S=ad(CLAV,mv(Bc,S0));
  const v=sub(T,S),d=len(v);
  if(d>L1+L2-1e-4||d<Math.abs(L1-L2)+1e-4)continue;
  const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const u=nrm(v),C=ad(S,[u[0]*a,u[1]*a,u[2]*a]);
  let p=cross(u,[0,1,0]); if(len(p)<1e-6)p=cross(u,[1,0,0]); p=nrm(p);
  const q=cross(u,p);
  for(let th=0;th<360;th+=10){
   const c=Math.cos(th*D),s=Math.sin(th*D);
   const E=[C[0]+h*(p[0]*c+q[0]*s),C[1]+h*(p[1]*c+q[1]*s),C[2]+h*(p[2]*c+q[2]*s)];
   if(!(S[1]-E[1]>0.03&&E[2]-S[2]>0.02))continue; // локоть ниже и сзади
   const sh=solveShoulder(Bc,nrm(sub(E,S)));
   if(sh.e>0.002)continue;
   // угол локтя из треугольника: между (E->S) и (E->T)
   const v1=sub(S,E),v2=sub(T,E);
   const cosE=(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/(len(v1)*len(v2));
   const elb=Math.acos(Math.max(-1,Math.min(1,cosE)))/D;
   const r=fk(lift,ret,sh.f,sh.t,sh.ab,elb);
   const err=len(sub(r.hd,T));
   const score=err*1000+Math.abs(lift-20)+Math.abs(ret)*0.5;
   if(!out||score<out.score)out={score,err,lift,ret,flex:sh.f,twist:sh.t,abd:sh.ab,elb,r};
  }
 }}
if(!out){console.log('НЕТ РЕШЕНИЯ');process.exit(0);}
console.log('ITOG err mm',(out.err*1000).toFixed(2));
console.log('scapula_lift',out.lift,'scapula_retraction',out.ret);
console.log('shoulder_flexion',out.flex.toFixed(1),'shoulder_twist',out.twist.toFixed(1),'shoulder_abduction',out.abd.toFixed(1));
console.log('elbow_flexion',out.elb.toFixed(1));
console.log('shoulder',out.r.sh.map(v=>v.toFixed(3)).join(','));
console.log('elbow',out.r.el.map(v=>v.toFixed(3)).join(','));
console.log('hand',out.r.hd.map(v=>v.toFixed(3)).join(','),' target',T.join(','));
