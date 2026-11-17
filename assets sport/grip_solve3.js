const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);
 if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];
 if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];
 return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));
function fk(lift,ret,flex,twist,abd,elb){
 const Bc=yxz(0,-ret*D,-lift*D);
 const Bu=yxz(flex*D,-twist*D,-abd*D);
 const Bf=yxz(elb*D,0,0);
 const clav=[-0.03,0.17,0];
 const sh=ad(clav,mv(Bc,[-0.17,0,0]));
 const Bcu=mul(Bc,Bu);
 const el=ad(sh,mv(Bcu,[0,-0.30,0]));
 const Bcue=mul(Bcu,Bf);
 const hd=ad(ad(el,mv(Bcue,[0,-0.26,0])),mv(Bcue,[0,-0.075,0]));
 return {sh,el,hd};
}
const T=[-0.30,0.14,0.07];
// грубая сетка: 9*7*10*6*8*7 = 211k -> ок
let best={d:1e9};
for(let a=0;a<=40;a+=5)
for(let b=0;b<=30;b+=5)
for(let c=-20;c<=60;c+=10)
for(let d=0;d<=150;d+=25)
for(let e=0;e<=70;e+=10)
for(let f=60;f<=155;f+=15){
 const r=fk(a,b,c,d,e,f);
 const dd=Math.hypot(r.hd[0]-T[0],r.hd[1]-T[1],r.hd[2]-T[2]);
 if(dd<best.d) best={d:dd,a,b,c,d,e,f};
}
console.log('coarse mm',(best.d*1000).toFixed(0),JSON.stringify(best));
// уточнение
let B={...best};
for(const step of [4,2,1,0.5]){
 const cur={...B};let improved=true;
 while(improved){improved=false;
  for(const k of ['a','b','c','d','e','f']){
   for(const sgn of [-1,1]){
    const trial={...cur};trial[k]=cur[k]+sgn*step;
    const r=fk(trial.a,trial.b,trial.c,trial.d,trial.e,trial.f);
    const dd=Math.hypot(r.hd[0]-T[0],r.hd[1]-T[1],r.hd[2]-T[2]);
    if(dd<B.d){B={d:dd,...trial};improved=true;}
   }}}
}
console.log('refined mm',(B.d*1000).toFixed(1));
console.log('lift',B.a,'ret',B.b,'flex',B.c.toFixed(1),'twist',B.d.toFixed(1),'abd',B.e.toFixed(1),'elbow',B.f.toFixed(1));
const r=fk(B.a,B.b,B.c,B.d,B.e,B.f);
console.log('shoulder',r.sh.map(v=>v.toFixed(3)).join(','));
console.log('elbow',r.el.map(v=>v.toFixed(3)).join(','));
console.log('hand',r.hd.map(v=>v.toFixed(3)).join(','));
