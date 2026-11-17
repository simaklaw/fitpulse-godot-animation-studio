const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
const L1=0.30,L2=0.335,CLAV=[-0.03,0.17,0],S0=[-0.17,0,0];
function shoulder(lift,ret){const Bc=yxz(0,-ret*D,-lift*D);return ad(CLAV,mv(Bc,S0));}
const T=[-0.30,0.14,0.07];
let ok=0,best=null;
for(let lift=-10;lift<=40;lift++){
 for(let ret=-10;ret<=30;ret++){
  const S=shoulder(lift,ret);
  const d=len(sub(T,S));
  if(d>L1+L2-1e-4||d<Math.abs(L1-L2)+1e-4)continue;
  ok++;
  const score=Math.abs(lift-20)+Math.abs(ret-5);
  if(!best||score<best.score)best={score,lift,ret,S,d};
 }}
console.log('reachable lift/ret combos:',ok);
if(best){
 console.log('best lift',best.lift,'ret',best.ret,'S',best.S.map(v=>v.toFixed(3)).join(','),'d',best.d.toFixed(3));
 const d=best.d;
 const A=Math.acos(Math.max(-1,Math.min(1,(L1*L1+d*d-L2*L2)/(2*L1*d))));
 const E=Math.acos(Math.max(-1,Math.min(1,(L1*L1+L2*L2-d*d)/(2*L1*L2))));
 console.log('angle arm-chord deg',(A/D).toFixed(1),'inner elbow deg',(E/D).toFixed(1));
}
