// FK левой руки. Ключевое: гриф в МИРОВЫХ координатах, рука в Chest-локальных.
// Переводим гриф в систему Chest: bar_chest = BAR_LOCAL_POS (0,0.14,0.07) по коду.
// Значит точка хвата левой кисти в Chest-локальных = (-0.30, 0.14, 0.07).
const D=Math.PI/180;
const R=(a,ax)=>{const c=Math.cos(a),s=Math.sin(a);
 if(ax==0)return[[1,0,0],[0,c,-s],[0,s,c]];
 if(ax==1)return[[c,0,s],[0,1,0],[-s,0,c]];
 return[[c,-s,0],[s,c,0],[0,0,1]];};
const mul=(A,B)=>{const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;};
const mv=(A,v)=>[A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];
const ad=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const yxz=(x,y,z)=>mul(mul(R(y,1),R(x,0)),R(z,2));

function fk(clavLift,clavRet,shFlex,shTwist,shAbd,elbow){
 const Bc=yxz(0, -clavRet*D, -clavLift*D);
 const Bu=yxz(shFlex*D, -shTwist*D, -shAbd*D);
 const Bf=yxz(elbow*D,0,0);
 const clav=[-0.03,0.17,0];
 const shoulder=ad(clav, mv(Bc,[-0.17,0,0]));
 const Bcu=mul(Bc,Bu);
 const elbow_p=ad(shoulder, mv(Bcu,[0,-0.30,0]));
 const Bcue=mul(Bcu,Bf);
 const wrist=ad(elbow_p, mv(Bcue,[0,-0.26,0]));
 const hand=ad(wrist, mv(Bcue,[0,-0.075,0]));
 return {shoulder,elbow:elbow_p,wrist,hand};
}

// цель: центр ладони на грифе, левая сторона, Chest-локально
const T=[-0.30,0.14,0.07];
console.log('target',T);

let best={d:1e9};
for(let a=0;a<=35;a+=1)        // scapula_lift
for(let b=0;b<=30;b+=2)        // scapula_retraction
for(let c=-30;c<=60;c+=2)      // shoulder_flexion
for(let d=0;d<=150;d+=5)       // shoulder_twist
for(let e=0;e<=70;e+=2)        // shoulder_abduction
for(let f=60;f<=155;f+=3){     // elbow_flexion
 const r=fk(a,b,c,d,e,f);
 const dist=Math.hypot(r.hand[0]-T[0],r.hand[1]-T[1],r.hand[2]-T[2]);
 if(dist<best.d) best={d:dist,a,b,c,d,e,f,r};
}
console.log('BEST mm',(best.d*1000).toFixed(0));
console.log('lift',best.a,'ret',best.b,'flex',best.c,'twist',best.d,'abd',best.e,'elbow',best.f);
console.log('shoulder',best.r.shoulder.map(v=>v.toFixed(3)).join(','));
console.log('elbow',best.r.elbow.map(v=>v.toFixed(3)).join(','));
console.log('hand',best.r.hand.map(v=>v.toFixed(3)).join(','));
