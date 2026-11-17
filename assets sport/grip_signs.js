// Проверяем: какие комбинации знаков ЛЕВОЙ руки (в трактовке build_bone_rotations)
// реально попадают в гриф, и как связаны "угол" и "euler".
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
function fk(cE,uE,fE){
 let B=yxz(cE[0]*D,cE[1]*D,cE[2]*D);
 let p=add(O_C,mv(B,O_U));
 B=mm(B,yxz(uE[0]*D,uE[1]*D,uE[2]*D));
 const elb=add(p,mv(B,O_F));
 B=mm(B,yxz(fE[0]*D,fE[1]*D,fE[2]*D));
 return {hand:add(add(elb,mv(B,O_H)),mv(B,O_HM)),elb,sh:p};
}
// углы каналов желаемые: lift20 retr0 abd35 flex5 twist115 elbow140
// euler: clav=(0, ry=?, rz=?), ua=(rx=?, ry=?, rz=?)
// перебираем ТОЛЬКО знаки, величины фиксируем
for(const sl of [-1,1])for(const sr of [-1,1])for(const sf of [-1,1])for(const st of [-1,1])for(const sa of [-1,1])for(const se of [-1,1]){
 const cE=[0, sr*0, sl*20];
 const uE=[sf*5, st*115, sa*35];
 const fE=[se*140,0,0];
 const o=fk(cE,uE,fE);
 const g=d(o.hand,BAR);
 if(g<0.06) console.log('gap',(g*100).toFixed(1),'sm | clav rz',sl*20,'ua rx',sf*5,'ry',st*115,'rz',sa*35,'elbow rx',se*140,'| hand',`[${o.hand.x.toFixed(3)},${o.hand.y.toFixed(3)},${o.hand.z.toFixed(3)}]`,'elb',`[${o.elb.x.toFixed(2)},${o.elb.y.toFixed(2)},${o.elb.z.toFixed(2)}]`);
}
