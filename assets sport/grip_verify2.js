// Расхождение: в поиске я использовал -abd и -twist напрямую в yxz.
// Здесь воспроизводим именно ТОТ путь, который дал решение, чтобы понять, какие
// знаки должны стоять в таблице каналов для ЛЕВОЙ руки.
const D=Math.PI/180;
function rot(ax,a){const c=Math.cos(a),s=Math.sin(a);
 if(ax===0)return[1,0,0,0,c,-s,0,s,c];
 if(ax===1)return[c,0,s,0,1,0,-s,0,c];
 return[c,-s,0,s,c,0,0,0,1];}
function mm(A,B){const R=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)
 R[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return R;}
function mv(M,v){return{x:M[0]*v.x+M[1]*v.y+M[2]*v.z,y:M[3]*v.x+M[4]*v.y+M[5]*v.z,z:M[6]*v.x+M[7]*v.y+M[8]*v.z};}
const yxz=(ex,ey,ez)=>mm(mm(rot(1,ey),rot(0,ex)),rot(2,ez));
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0},O_F={x:0,y:-0.30,z:0},O_H={x:0,y:-0.26,z:0},O_HM={x:0,y:-0.075,z:0};
const BAR={x:0,y:0.14,z:0.07};
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function run(label,clavE,uaE,faE){
 let B=yxz(clavE.x*D,clavE.y*D,clavE.z*D);
 let p=add(O_C,mv(B,O_U));
 B=mm(B,yxz(uaE.x*D,uaE.y*D,uaE.z*D));
 const elb=add(p,mv(B,O_F));
 B=mm(B,yxz(faE.x*D,faE.y*D,faE.z*D));
 const c=add(add(elb,mv(B,O_H)),mv(B,O_HM));
 console.log(label,'-> hand',`[${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)}]`,'gap',(d(c,BAR)*100).toFixed(2),'sm','| elbow',`[${elb.x.toFixed(2)},${elb.y.toFixed(2)},${elb.z.toFixed(2)}]`);
}
// A) поисковый вариант: клин euler(0,-retr,-lift), плечо euler(flex,-twist,-abd)
run('SEARCH lift20 retr0 abd35 flex5 tw115 el140', {x:0,y:0,z:-20}, {x:5,y:-115,z:-35}, {x:140,y:0,z:0});
// B) вариант из таблицы (twist sign_l -1 => +115)
run('TABLE  tw=-115 -> ry=+115            ', {x:0,y:0,z:-20}, {x:5,y:115,z:-35}, {x:140,y:0,z:0});
// C) вариант с twist напрямую
run('DIRECT ry=-115                       ', {x:0,y:0,z:-20}, {x:5,y:-115,z:-35}, {x:140,y:0,z:0});
// D) проверим abd знак наоборот
run('ABD FLIP rz=+35                      ', {x:0,y:0,z:-20}, {x:5,y:-115,z:35}, {x:140,y:0,z:0});
