const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);
function rot(axis,ang){const c=Math.cos(ang),s=Math.sin(ang);
  if(axis==='x')return[1,0,0,0,c,-s,0,s,c];
  if(axis==='y')return[c,0,s,0,1,0,-s,0,c];
  return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];
  return R;}
function mv(M,v){return V(M[0]*v.x+M[1]*v.y+M[2]*v.z,M[3]*v.x+M[4]*v.y+M[5]*v.z,M[6]*v.x+M[7]*v.y+M[8]*v.z);}
const eulerYXZ=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const D=Math.PI/180;
const O_CLAV=V(-0.03,0.17,0.0),O_UPARM=V(-0.17,0.0,0.0);
const O_FORE=V(0.0,-0.30,0.0),O_HAND=V(0.0,-0.26,0.0),O_HANDMESH=V(0.0,-0.075,0.0);
function fk(cl,cb,f,a,t,e){
  const clavB=eulerYXZ(cl*D,0,cb*D);
  const upB=eulerYXZ(f*D,-t*D,-a*D);
  const foreB=eulerYXZ(e*D,0,0);
  let B=clavB,p=O_CLAV;
  p=add(p,mv(B,O_UPARM)); B=mm(B,upB);
  p=add(p,mv(B,O_FORE)); B=mm(B,foreB);
  p=add(p,mv(B,O_HAND)); p=add(p,mv(B,O_HANDMESH));
  return p;
}
const T=V(-0.30,0.24,0.10);
const LIM={cl:[0,45],cb:[0,40],f:[-20,100],a:[0,120],t:[-80,80],e:[60,165]};
const cl_=(v,r)=>Math.max(r[0],Math.min(r[1],v));
function E(cl,cb,f,a,t,e){
  cl=cl_(cl,LIM.cl);cb=cl_(cb,LIM.cb);f=cl_(f,LIM.f);a=cl_(a,LIM.a);t=cl_(t,LIM.t);e=cl_(e,LIM.e);
  return {d:len(sub(fk(cl,cb,f,a,t,e),T)),cl,cb,f,a,t,e};
}
let gb={d:1e9,cl:35,cb:20,f:80,a:100,t:-60,e:140};
let step=8;
while(step>0.02){
  let imp=false;
  for(const dv of [[step,0,0,0,0,0],[-step,0,0,0,0,0],[0,step,0,0,0,0],[0,-step,0,0,0,0],
                   [0,0,step,0,0,0],[0,0,-step,0,0,0],[0,0,0,step,0,0],[0,0,0,-step,0,0],
                   [0,0,0,0,step,0],[0,0,0,0,-step,0],[0,0,0,0,0,step],[0,0,0,0,0,-step]]){
    const r=E(gb.cl+dv[0],gb.cb+dv[1],gb.f+dv[2],gb.a+dv[3],gb.t+dv[4],gb.e+dv[5]);
    if(r.d<gb.d){gb=r;imp=true;}
  }
  if(!imp) step*=0.5;
}
console.log('УТОЧНЕНО:');
console.log(`  clavLift=${gb.cl.toFixed(1)} clavBack=${gb.cb.toFixed(1)}`);
console.log(`  flex=${gb.f.toFixed(1)} abd=${gb.a.toFixed(1)} twist=${gb.t.toFixed(1)} elbow=${gb.e.toFixed(1)}`);
console.log(`  зазор ${(gb.d*100).toFixed(2)} см`);
const p=fk(gb.cl,gb.cb,gb.f,gb.a,gb.t,gb.e);
console.log(`  кисть [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}]`);
