// Почему предыдущий перебор дал 0.59см, а этот 0 решений?
// Разница: в лучшем решении twist=120 (за пределами -90..90) и abd=75.
// Проверим границы: twist до 180, flex -90..60.
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
 let p=add(O_C,mv(yxz(0,0,0),O_U));
 let B=yxz(flex*D,-twist*D,-abd*D);
 p=add(p,mv(B,O_F));
 B=mm(B,yxz(elbow*D,0,0));
 p=add(p,mv(B,O_H));
 p=add(p,mv(B,O_HM));
 return p;
}
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// Проверим найденное ранее вручную
const t=hand(-5,75,120,140);
console.log('проверка flex-5 abd75 twist120 elbow140 ->',`[${t.x.toFixed(3)},${t.y.toFixed(3)},${t.z.toFixed(3)}]`,'зазор',(d(t,BAR)*100).toFixed(2),'см');
let best=null,cnt=0;
for(let f=-90;f<=60;f+=3)for(let a=20;a<=120;a+=3)for(let tw=-180;tw<=180;tw+=10)for(let e=60;e<=160;e+=3){
 const p=hand(f,a,tw,e);const err=d(p,BAR);
 if(err<0.04)cnt++;
 if(!best||err<best.err)best={err,f,a,tw,e,p};
}
console.log('решений<4см:',cnt,'| лучший:',(best.err*100).toFixed(2),'см',JSON.stringify({flex:best.f,abd:best.a,twist:best.tw,elbow:best.e}),`[${best.p.x.toFixed(2)},${best.p.y.toFixed(2)},${best.p.z.toFixed(2)}]`);
// Что происходит с twist=120: это фактически abd через другую ось
console.log('\nвлияние twist при abd=75,flex=-5,elbow=140:');
for(const tw of [0,30,60,90,120,150,180]){
 const p=hand(-5,75,tw,140);
 console.log(' twist',String(tw).padStart(4),'->',`[${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}]`,'gap',(d(p,BAR)*100).toFixed(1));
}
