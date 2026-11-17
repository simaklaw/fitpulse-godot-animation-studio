// Финальная проверка: воспроизводим ТОЧНО то, что делает HumanoidRig,
// с текущими осями/знаками из таблицы каналов и значениями из back_squat.gd.
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
// build_bone_rotations: для каждой кости euler (rx,ry,rz) = сумма (angle*sign) по каналам оси 0/1/2
// Clavicle_L: lift axis2 sign -1 -> rz=-20 ; retr axis1 sign -1 -> ry=-0
const clav={x:0*D, y:(-1*0)*D, z:(-1*20)*D};
// UpperArm_L: flexion axis0 sign +1 -> rx=+5 ; twist axis1 sign -1 -> ry=-(-115)=+115 ; abd axis2 sign -1 -> rz=-35
const ua={x:(1*5)*D, y:(-1*-115)*D, z:(-1*35)*D};
// Forearm_L: elbow axis0 sign +1 -> rx=140
const fa={x:(1*140)*D, y:0, z:0};
let B=yxz(clav.x,clav.y,clav.z);
let p=add(O_C,mv(B,O_U));
const sh=p;
B=mm(B,yxz(ua.x,ua.y,ua.z));
const elb=add(p,mv(B,O_F));
B=mm(B,yxz(fa.x,fa.y,fa.z));
const wrist=add(elb,mv(B,O_H));
const c=add(wrist,mv(B,O_HM));
console.log('shoulder',`[${sh.x.toFixed(3)},${sh.y.toFixed(3)},${sh.z.toFixed(3)}]`);
console.log('elbow   ',`[${elb.x.toFixed(3)},${elb.y.toFixed(3)},${elb.z.toFixed(3)}]`);
console.log('wrist   ',`[${wrist.x.toFixed(3)},${wrist.y.toFixed(3)},${wrist.z.toFixed(3)}]`);
console.log('hand ctr',`[${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)}]`,'| BAR',`[0.000,0.140,0.070]`,'gap',(d(c,BAR)*100).toFixed(2),'sm');
