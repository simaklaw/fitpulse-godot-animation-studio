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
function climb(st){
 let cur=Object.assign({},st); let bd=errOf(cur);
 for(const step of [6,3,1.5,0.7,0.3,0.1,0.04,0.02]){
  for(let it=0;it<200;it++){
   let imp=false;
   for(const k of ['l','r','f','t','ab','e']){
    for(const sg of [-1,1]){
     const c=Object.assign({},cur); c[k]=c[k]+sg*step;
     const dd=errOf(c);
     if(dd<bd-1e-12){bd=dd;cur=c;imp=true;}
    }
   }
   if(!imp)break;
  }
 }
 return {bd:bd,cur:cur};
}
const starts=[
 {l:20,r:5,f:20,t:110,ab:30,e:120},
 {l:20,r:0,f:0,t:120,ab:40,e:120},
 {l:25,r:10,f:-60,t:170,ab:-20,e:150},
 {l:30,r:10,f:-120,t:150,ab:0,e:150},
 {l:15,r:5,f:-30,t:160,ab:-30,e:140},
 {l:35,r:15,f:-40,t:180,ab:-20,e:140},
 {l:25,r:5,f:-140,t:180,ab:20,e:130}
];
let best=null;
for(const s of starts){
 const res=climb(s);
 if(!best||res.bd<best.bd)best=res;
 console.log('start',JSON.stringify(s),'-> mm',(res.bd*1000).toFixed(2));
}
const q=fk(best.cur.l,best.cur.r,best.cur.f,best.cur.t,best.cur.ab,best.cur.e);
console.log('=== BEST mm',(best.bd*1000).toFixed(3));
console.log('scapula_lift',best.cur.l.toFixed(1),'scapula_retraction',best.cur.r.toFixed(1));
console.log('shoulder_flexion',best.cur.f.toFixed(1),'shoulder_twist',best.cur.t.toFixed(1),'shoulder_abduction',best.cur.ab.toFixed(1));
console.log('elbow_flexion',best.cur.e.toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
