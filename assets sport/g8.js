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
function errOf(c){return len(sub(fk(c.l,c.r,c.f,c.t,c.ab,c.e).H,T));}
const LIM={l:[0,30],r:[-10,10],f:[-60,50],t:[0,140],ab:[-10,50],e:[40,150]};
const clamp=(c)=>{const o={};for(const k in c)o[k]=Math.max(LIM[k][0],Math.min(LIM[k][1],c[k]));return o;};
function climb(st){
 let cur=clamp(st); let bd=errOf(cur);
 for(const step of [5,2.5,1,0.5,0.2,0.08,0.03]){
  for(let it=0;it<120;it++){
   let imp=false;
   for(const k of ['l','r','f','t','ab','e'])for(const sg of [-1,1]){
    const c=Object.assign({},cur); c[k]=c[k]+sg*step;
    const cc=clamp(c);
    const dd=errOf(cc);
    if(dd<bd-1e-13){bd=dd;cur=cc;imp=true;}
   }
   if(!imp)break;
  }
 }
 return {bd:bd,cur:cur};
}
let best=null; let cnt=0;
for(let l=0;l<=30;l+=10)for(let r=-10;r<=10;r+=10)for(let f=-50;f<=40;f+=30)for(let t=0;t<=120;t+=40)for(let ab=-10;ab<=40;ab+=25)for(let e=60;e<=150;e+=30){
 const res=climb({l:l,r:r,f:f,t:t,ab:ab,e:e}); cnt++;
 if(!best||res.bd<best.bd)best=res;
}
console.log('starts tried',cnt);
const q=fk(best.cur.l,best.cur.r,best.cur.f,best.cur.t,best.cur.ab,best.cur.e);
console.log('=== BEST mm',(best.bd*1000).toFixed(2));
console.log('lift',best.cur.l.toFixed(1),'ret',best.cur.r.toFixed(1),'flex',best.cur.f.toFixed(1),'twist',best.cur.t.toFixed(1),'abd',best.cur.ab.toFixed(1),'elbow',best.cur.e.toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
console.log('elbow below shoulder:',(q.S[1]-q.E[1]).toFixed(3));
