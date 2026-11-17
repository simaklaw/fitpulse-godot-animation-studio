// Проверяем ТЕКУЩИЕ значения base_pose из back_squat.gd:
// scapula_lift 45, scapula_retraction 20, abd 97, flex 80, twist -68, elbow 142
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
// CHANNELS: scapula_lift axis X sign +1 (левая), scapula_retraction axis Z sign -1 (левая)
function fk(cl,cr,abd,flex,twist,elbow){
 let B=yxz(cl*D,0,-cr*D);
 let p=add(O_C,mv(B,O_U));
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 const elb=add(p,mv(B,O_F));
 B=mm(B,yxz(elbow*D,0,0));
 const wrist=add(elb,mv(B,O_H));
 const c=add(wrist,mv(B,O_HM));
 return {c,elb,sh:add(O_C,mv(yxz(cl*D,0,-cr*D),O_U))};
}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const cur=fk(45,20,97,80,-68,142);
console.log('ТЕКУЩАЯ base_pose: центр кисти',`[${cur.c.x.toFixed(3)},${cur.c.y.toFixed(3)},${cur.c.z.toFixed(3)}]`,'зазор',(d(cur.c,BAR)*100).toFixed(1),'см');
console.log('  плечо после лопатки:',`[${cur.sh.x.toFixed(3)},${cur.sh.y.toFixed(3)},${cur.sh.z.toFixed(3)}]`,'| локоть',`[${cur.elb.x.toFixed(2)},${cur.elb.y.toFixed(2)},${cur.elb.z.toFixed(2)}]`);
let best=null,cnt=0;
for(let cl=0;cl<=60;cl+=5)for(let cr=0;cr<=40;cr+=5)for(let a=40;a<=120;a+=3)for(let f=-20;f<=60;f+=3)for(let tw=-120;tw<=0;tw+=5)for(let e=80;e<=155;e+=3){
 const r=fk(cl,cr,a,f,tw,e);const err=d(r.c,BAR);
 if(err<0.02)cnt++;
 if(!best||err<best.err)best={err,cl,cr,a,f,tw,e,r};
}
console.log('\nрешений<2см с лопаткой:',cnt);
console.log('лучшее:',(best.err*100).toFixed(2),'см',JSON.stringify({clavLift:best.cl,clavBack:best.cr,abd:best.a,flex:best.f,twist:best.tw,elbow:best.e}));
console.log('  кисть',`[${best.r.c.x.toFixed(2)},${best.r.c.y.toFixed(2)},${best.r.c.z.toFixed(2)}]`,'| локоть',`[${best.r.elb.x.toFixed(2)},${best.r.elb.y.toFixed(2)},${best.r.elb.z.toFixed(2)}]`);
