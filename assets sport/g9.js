const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=v=>{const l=len(v)||1;return [v[0]/l,v[1]/l,v[2]/l];};
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
const L1=0.30,L2=0.335,CLAV=[-0.03,0.17,0],S0=[-0.17,0,0];
const T=[-0.30,0.14,0.07];
// ищем ТОЛЬКО на окружности локтя при фиксированных lift/ret
function solveLR(lift,ret){
 const Bc=yxz(0,-ret*D,-lift*D);
 const S=ad(CLAV,mv(Bc,S0));
 const v=sub(T,S),d=len(v);
 if(d>L1+L2-1e-4||d<Math.abs(L1-L2)+1e-4)return null;
 const a=(L1*L1-L2*L2+d*d)/(2*d);
 const h=Math.sqrt(Math.max(0,L1*L1-a*a));
 const u=nrm(v),C=ad(S,[u[0]*a,u[1]*a,u[2]*a]);
 let p=cross(u,[0,1,0]); if(len(p)<1e-6)p=cross(u,[1,0,0]); p=nrm(p);
 const q=cross(u,p);
 let best=null;
 for(let th=0;th<360;th+=5){
  const ct=Math.cos(th*D),st=Math.sin(th*D);
  const E=[C[0]+h*(p[0]*ct+q[0]*st),C[1]+h*(p[1]*ct+q[1]*st),C[2]+h*(p[2]*ct+q[2]*st)];
  // анатомия: локоть ниже плеча
  if(S[1]-E[1]<0.03)continue;
  // нужен базис плеча: Bc*Bu*(0,-L1,0)=E-S -> w=Bc^T*norm(E-S)
  const d1=nrm(sub(E,S));
  const w=mv([[Bc[0][0],Bc[1][0],Bc[2][0]],[Bc[0][1],Bc[1][1],Bc[2][1]],[Bc[0][2],Bc[1][2],Bc[2][2]]],d1);
  // решаем YXZ по w: w=(sz*cy, -cz*cx, -sz*sy-... ) — берём общий численный solver (2 DOF хватает)
  let bs=null;
  for(let f=-180;f<=180;f+=10)for(let t=-180;t<=180;t+=15){
   for(const ab of [0]){
    const g=mv(yxz(f*D,-t*D,-ab*D),[0,-1,0]);
    const e=len(sub(g,w));
    if(!bs||e<bs.e)bs={e,f,t,ab};
   }
  }
  // уточнение по трём осям
  for(const step of [5,2,1,0.4,0.15]){
   let imp=true;
   while(imp){imp=false;
    for(const k of ['f','t','ab'])for(const sg of [-1,1]){
     const c={...bs};c[k]+=sg*step;
     const g=mv(yxz(c.f*D,-c.t*D,-c.ab*D),[0,-1,0]);
     const e=len(sub(g,w));
     if(e<bs.e-1e-13){bs=c;imp=true;}
    }}}
  if(bs.e>0.01)continue;
  const Bcu=mul(Bc,yxz(bs.f*D,-bs.t*D,-bs.ab*D));
  const S2=ad(CLAV,mv(Bc,S0));
  const E2=ad(S2,mv(Bcu,[0,-L1,0]));
  const v1=sub(S2,E2),v2=sub(T,E2);
  const cs=(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/(len(v1)*len(v2));
  const elb=Math.acos(Math.max(-1,Math.min(1,cs)))/D;
  if(elb>155||elb<40)continue;
  const H=ad(E2,mv(mul(Bcu,yxz(elb*D,0,0)),[0,-L2,0]));
  const err=len(sub(H,T));
  if(!best||err<best.err)best={err,lift,ret,theta:th,flex:bs.f,twist:bs.t,abd:bs.ab,elb,S:S2,E:E2,H};
 }
 return best;
}
let out=null;
for(let lift=0;lift<=30;lift+=2)for(let ret=-10;ret<=10;ret+=2){
 const r=solveLR(lift,ret);
 if(r&&(!out||r.err<out.err))out=r;
}
if(!out){console.log('нет');process.exit(0);}
console.log('=== err mm',(out.err*1000).toFixed(2));
console.log('lift',out.lift,'ret',out.ret,'theta',out.theta);
console.log('flex',out.flex.toFixed(1),'twist',out.twist.toFixed(1),'abd',out.abd.toFixed(1),'elbow',out.elb.toFixed(1));
console.log('S',out.S.map(v=>v.toFixed(3)).join(','),'E',out.E.map(v=>v.toFixed(3)).join(','),'H',out.H.map(v=>v.toFixed(3)).join(','));
