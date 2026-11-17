// ФИНАЛЬНЫЙ РЕШАТЕЛЬ с ИСПРАВЛЕННЫМИ осями лопатки:
//   scapula_lift -> axis Z, sign_l -1, sign_r +1
//   scapula_retraction -> axis Y, sign_l -1, sign_r +1 (отрицательный -> плечо назад -Z)
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
function fk(lift,retr,abd,flex,twist,elbow){
 // лопатка: euler (0, -retr, -lift) для левой
 let B=yxz(0,-retr*D,-lift*D);
 let p=add(O_C,mv(B,O_U));
 const sh=p;
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 const elb=add(p,mv(B,O_F));
 B=mm(B,yxz(elbow*D,0,0));
 const wrist=add(elb,mv(B,O_H));
 const c=add(wrist,mv(B,O_HM));
 return {c,elb,sh};
}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
let best=null,cnt=0;
for(let l=0;l<=45;l+=3)for(let r=0;r<=40;r+=3)for(let a=20;a<=120;a+=4)for(let f=-30;f<=70;f+=4)for(let tw=-140;tw<=140;tw+=5)for(let e=70;e<=155;e+=3){
 const o=fk(l,r,a,f,tw,e);const err=d(o.c,BAR);
 if(err<0.015)cnt++;
 if(!best||err<best.err)best={err,l,r,a,f,tw,e,o};
}
console.log('решений<1.5см:',cnt);
console.log('ЛУЧШЕЕ:',(best.err*100).toFixed(2),'см',JSON.stringify({scapula_lift:best.l,scapula_retraction:best.r,abd:best.a,flex:best.f,twist:best.tw,elbow:best.e}));
console.log('  кисть',`[${best.o.c.x.toFixed(3)},${best.o.c.y.toFixed(3)},${best.o.c.z.toFixed(3)}]`);
console.log('  локоть',`[${best.o.elb.x.toFixed(2)},${best.o.elb.y.toFixed(2)},${best.o.elb.z.toFixed(2)}]`,'(должен быть НИЖЕ плеча по Y)');
console.log('  плечо',`[${best.o.sh.x.toFixed(2)},${best.o.sh.y.toFixed(2)},${best.o.sh.z.toFixed(2)}]`);
