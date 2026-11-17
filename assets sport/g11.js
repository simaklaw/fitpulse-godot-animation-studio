const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=v=>Math.hypot(v[0],v[1],v[2]);
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
const L1=0.30,L2=0.335,CLAV=[-0.03,0.17,0],S0=[-0.17,0,0];
const T=[-0.30,0.14,0.07];
function fk(l,r,f,t,ab,e){const Bc=yxz(0,-r*D,-l*D);const S=ad(CLAV,mv(Bc,S0));const Bcu=mul(Bc,yxz(f*D,-t*D,-ab*D));const E=ad(S,mv(Bcu,[0,-L1,0]));const H=ad(E,mv(mul(Bcu,yxz(e*D,0,0)),[0,-L2,0]));return {S,E,H};}
function err(c){return len(sub(fk(c.l,c.r,c.f,c.t,c.ab,c.e).H,T));}
// найдём минимум по глобальной сетке и запомним лучшее
let gbest={d:1e9};
for(let l=0;l<=32;l+=4)for(let r=-12;r<=12;r+=4)for(let f=-70;f<=60;f+=10)for(let t=0;t<=150;t+=15)for(let ab=-15;ab<=60;ab+=8)for(let e=40;e<=150;e+=10){
 const c={l:l,r:r,f:f,t:t,ab:ab,e:e}; const d=err(c);
 if(d<gbest.d)gbest={d:d,c:c};
}
console.log('grid best mm',(gbest.d*1000).toFixed(2),JSON.stringify(gbest.c));
const q0=fk(gbest.c.l,gbest.c.r,gbest.c.f,gbest.c.t,gbest.c.ab,gbest.c.e);
console.log(' grid H',q0.H.map(function(v){return v.toFixed(3);}).join(','),'below',(q0.S[1]-q0.E[1]).toFixed(3));
// climbing из глобального лучшего
function climb(cur){
 let c=Object.assign({},cur); let bd=err(c);
 const steps=[3,1.5,0.7,0.3,0.12,0.05,0.02];
 for(let si=0;si<steps.length;si++){const step=steps[si];
  for(let it=0;it<100;it++){let imp=false;
   for(const k of ['l','r','f','t','ab','e'])for(const sg of [-1,1]){
    const n=Object.assign({},c);n[k]=n[k]+sg*step;
    const d=err(n);if(d<bd-1e-13){bd=d;c=n;imp=true;}}}
   if(!imp)break;}}
 return {bd:bd,c:c};}
let best=climb(gbest.c);
for(let l=0;l<=32;l+=8)for(let r=-12;r<=12;r+=8)for(let f=-70;f<=60;f+=20)for(let t=0;t<=150;t+=30)for(let e=40;e<=150;e+=20){
 const res=climb({l:l,r:r,f:f,t:t,ab:0,e:e});
 if(res.bd<best.bd)best=res;
}
const q=fk(best.c.l,best.c.r,best.c.f,best.c.t,best.c.ab,best.c.e);
console.log('=== err mm',(best.bd*1000).toFixed(2));
console.log('lift',best.c.l.toFixed(1),'ret',best.c.r.toFixed(1),'flex',best.c.f.toFixed(1),'twist',best.c.t.toFixed(1),'abd',best.c.ab.toFixed(1),'elbow',best.c.e.toFixed(1));
console.log('S',q.S.map(function(v){return v.toFixed(3);}).join(','),'E',q.E.map(function(v){return v.toFixed(3);}).join(','),'H',q.H.map(function(v){return v.toFixed(3);}).join(','));
console.log('below',(q.S[1]-q.E[1]).toFixed(3),'behind',(q.E[2]-q.S[2]).toFixed(3));
