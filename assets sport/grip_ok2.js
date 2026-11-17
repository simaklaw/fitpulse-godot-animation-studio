// Ключевой результат: без ключицы решение СУЩЕСТВУЕТ (0.59 см).
// Найдём анатомически допустимое решение: abd <= 100, elbow <= 150, flex -60..30
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
function hand(flex,abd,twist,elbow){
 let B=yxz(0,0,0);
 let p=add(O_C,mv(B,O_U));
 B=mm(B,yxz(flex*D,-twist*D,-abd*D));
 p=add(p,mv(B,O_F));
 B=mm(B,yxz(elbow*D,0,0));
 p=add(p,mv(B,O_H));
 p=add(p,mv(B,O_HM));
 return p;
}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
let sols=[];
for(let f=-70;f<=30;f+=2)for(let a=20;a<=110;a+=2)for(let t=-90;t<=90;t+=5)for(let e=80;e<=155;e+=2){
 const p=hand(f,a,t,e);const err=d(p,BAR);
 if(err<0.035) sols.push({err,f,a,t,e,p});
}
sols.sort((x,y)=>x.err-y.err);
console.log('Решений (<3.5 см):',sols.length);
for(const s of sols.slice(0,12)){
 console.log(' ', (s.err*100).toFixed(2)+'см', JSON.stringify({flex:s.f,abd:s.a,twist:s.t,elbow:s.e}), `[${s.p.x.toFixed(2)},${s.p.y.toFixed(2)},${s.p.z.toFixed(2)}]`);
}
if(sols.length){
 // выберем самое "анатомичное": twist ближе к 0, elbow ближе к 130
 const best=sols.find(s=>Math.abs(s.t)<=40&&s.e>=110&&s.e<=145)||sols[0];
 console.log('\nРЕКОМЕНДАЦИЯ: flex',best.f,'abd',best.a,'twist',best.t,'elbow',best.e,'=>',(best.err*100).toFixed(2),'см');
}
