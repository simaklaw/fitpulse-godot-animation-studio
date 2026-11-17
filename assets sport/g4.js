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
function fk(l,r,f,t,ab,e){const Bc=yxz(0,-r*D,-l*D);const S=ad(CLAV,mv(Bc,S0));const Bcu=mul(Bc,yxz(f*D,-t*D,-ab*D));const E=ad(S,mv(Bcu,[0,-L1,0]));const H=ad(E,mv(mul(Bcu,yxz(e*D,0,0)),[0,-L2,0]));return {S,E,H};}
// быстрый перебор: сначала минимизируем расстояние, потом локально
let best={d:1e9};
for(let l=0;l<=35;l+=7)for(let r=-5;r<=25;r+=5)for(let f=-40;f<=120;f+=10)for(let t=0;t<=180;t+=15)for(let ab=-30;ab<=90;ab+=10)for(let e=40;e<=160;e+=10){
 const q=fk(l,r,f,t,ab,e);const dd=len(sub(q.H,T));
 if(dd<best.d)best={d:dd,l,r,f,t,ab,e};
}
console.log('coarse mm',(best.d*1000).toFixed(0),JSON.stringify(best));
for(const step of [5,2,1,0.4,0.15,0.05]){
 let imp=true;
 while(imp){imp=false;
  for(const k of ['l','r','f','t','ab','e'])for(const sg of [-1,1]){
   const c={...best};c[k]=best[k]+sg*step;
   if(c.e<10||c.e>170)continue;
   const q=fk(c.l,c.r,c.f,c.t,c.ab,c.e);const dd=len(sub(q.H,T));
   if(dd<best.d-1e-12){best={d:dd,...c};imp=true;}
  }}}
const q=fk(best.l,best.r,best.f,best.t,best.ab,best.e);
console.log('final mm',(best.d*1000).toFixed(2));
console.log('lift',best.l.toFixed(1),'ret',best.r.toFixed(1),'flex',best.f.toFixed(1),'twist',best.t.toFixed(1),'abd',best.ab.toFixed(1),'elbow',best.e.toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
