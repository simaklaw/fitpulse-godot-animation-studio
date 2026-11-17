// Аналитика: почему FK не попадает в гриф. Проверяем знак/порядок.
const D=Math.PI/180;
function rot(ax,a){const c=Math.cos(a),s=Math.sin(a);
 if(ax==='x')return[1,0,0,0,c,-s,0,s,c];
 if(ax==='y')return[c,0,s,0,1,0,-s,0,c];
 return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)
 R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return R;}
function mv(M,v){return{x:M[0]*v.x+M[1]*v.y+M[2]*v.z,y:M[3]*v.x+M[4]*v.y+M[5]*v.z,z:M[6]*v.x+M[7]*v.y+M[8]*v.z};}
const yxz=(ex,ey,ez)=>mm(mm(rot('y',ey),rot('x',ex)),rot('z',ez));
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0},O_F={x:0,y:-0.30,z:0},O_H={x:0,y:-0.26,z:0},O_HM={x:0,y:-0.075,z:0};
const BAR={x:0,y:0.14,z:0.07};
// левое плечо в Chest: Clavicle(-0.03,0.17)+UpperArm(-0.17,0,0)=(-0.20,0.17,0)
function hand(flex,abd,twist,elbow,cl,cf){
 let B=yxz(cl*D,0,cf*D);
 let p=add(O_C,mv(B,O_U));
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 p=add(p,mv(B,O_F));
 B=mm(B,yxz(elbow*D,0,0));
 p=add(p,mv(B,O_H));
 p=add(p,mv(B,O_HM));
 return p;
}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// Проверка: как влияет abd на подъём руки при flex=0
console.log('flex=0,twist=0,elbow=0: зависимость кисти от abd');
for(const a of [-90,-45,0,45,90,120]){
 const p=hand(0,a,0,0,0,0);
 console.log('  abd',String(a).padStart(4),'->',`[${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}]`);
}
console.log('\nflex зависимость (abd=0,twist=0,elbow=0)');
for(const f of [-90,-45,0,45,90]){
 const p=hand(f,0,0,0,0,0);
 console.log('  flex',String(f).padStart(4),'->',`[${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}]`);
}
console.log('\nПлечо (сустав) в Chest:', '[ -0.200, 0.170, 0.000 ]', '| гриф', JSON.stringify(BAR));
console.log('Расстояние плечо->гриф:', d({x:-0.20,y:0.17,z:0},BAR).toFixed(3),'м (полная рука 0.635)');
// Минимальный зазор при любых углах без ключицы: перебор грубый
let best=null;
for(let f=-180;f<=180;f+=5)for(let a=-90;a<=180;a+=5)for(let t=-180;t<=180;t+=15)for(let e=0;e<=160;e+=5){
 const p=hand(f,a,t,e,0,0);const err=d(p,BAR);
 if(!best||err<best.err)best={err,f,a,t,e,p};
}
console.log('\nБЕЗ ключицы лучший зазор:',(best.err*100).toFixed(2),'см',JSON.stringify({flex:best.f,a:best.a,t:best.t,e:best.e}),`[${best.p.x.toFixed(3)},${best.p.y.toFixed(3)},${best.p.z.toFixed(3)}]`);
