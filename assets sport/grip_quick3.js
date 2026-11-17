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
const clavB=(l,r)=>yxz(0,-r*D,-l*D);
// Ry*Rx*Rz*(0,-1,0)=w, при x=0:
// w = (sz*cos y, -cos z, -sz*sin y), sz=sin z
function solveDir(w){
 const cz=Math.max(-1,Math.min(1,-w[1]));
 const sz=Math.sqrt(Math.max(1e-12,1-cz*cz));
 const cy=w[0]/sz, sy=-w[2]/sz;
 return {t:Math.acos(cz)/D, ab:Math.atan2(-sy,cy)/D};
}
let out=null;
for(let lift=-10;lift<=40;lift+=2){
 for(let ret=-10;ret<=30;ret+=2){
  const Bc=clavB(lift,ret);
  const S=ad(CLAV,mv(Bc,S0));
  const v=sub(T,S),d=len(v);
  if(d>L1+L2-1e-4||d<Math.abs(L1-L2)+1e-4)continue;
  const a=(L1*L1-L2*L2+d*d)/(2*d),h=Math.sqrt(Math.max(0,L1*L1-a*a));
  const u=nrm(v),C=ad(S,[u[0]*a,u[1]*a,u[2]*a]);
  let p=cross(u,[0,1,0]); if(len(p)<1e-6)p=cross(u,[1,0,0]); p=nrm(p);
  const q=cross(u,p);
  for(let th=0;th<360;th+=15){
   const c=Math.cos(th*D),s=Math.sin(th*D);
   const E=[C[0]+h*(p[0]*c+q[0]*s),C[1]+h*(p[1]*c+q[1]*s),C[2]+h*(p[2]*c+q[2]*s)];
   if(!(S[1]-E[1]>0.03&&E[2]-S[2]>0.02))continue;
   const d1=nrm(sub(E,S));
   const w=mv(T3(Bc),d1);
   const sol=solveDir(w);
   const Bcu=mul(Bc,yxz(0,-sol.t*D,-sol.ab*D));
   const el=ad(S,mv(Bcu,[0,-L1,0]));
   const v1=sub(S,E),v2=sub(T,E);
   const cosE=(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/(len(v1)*len(v2));
   const elb=Math.acos(Math.max(-1,Math.min(1,cosE)))/D;
   const hd=ad(el,mv(mul(Bcu,yxz(elb*D,0,0)),[0,-L2,0]));
   const err=len(sub(hd,T));
   const score=err*1000+Math.abs(lift-20)*0.3+Math.abs(ret)*0.2+Math.abs(sol.t-100)*0.05;
   if(!out||score<out.score)out={score,err,lift,ret,twist:sol.t,abd:sol.ab,elb,el,hd,S};
  }
 }}
if(!out){console.log('НЕТ РЕШЕНИЯ');process.exit(0);}
console.log('err mm',(out.err*1000).toFixed(2));
console.log('lift',out.lift,'ret',out.ret,'flex 0','twist',out.twist.toFixed(1),'abd',out.abd.toFixed(1),'elbow',out.elb.toFixed(1));
console.log('S',out.S.map(v=>v.toFixed(3)).join(','),'E',out.el.map(v=>v.toFixed(3)).join(','),'H',out.hd.map(v=>v.toFixed(3)).join(','));
