// Итоговая проверка через ТУ ЖЕ трактовку, что в build_bone_rotations:
// euler-компоненты = angle * sign, затем Basis.from_euler(YXZ).
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
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0},O_F={x:0,y:-0.30,z:0},O_H={x:0,y:-0.26,z:0},O_HM={x:0,y:-0.075,z:0};
const BAR={x:0,y:0.14,z:0.07};
function fk(ch){
 // resolve_channel по CHANNELS: lift axis2 sign_l -1; retr axis1 sign_l -1;
 // flexion axis0 sign_l +1; abd axis2 sign_l -1; twist axis1 sign_l -1; elbow axis0 sign_l +1
 const cE=[0*D, (-1*ch.retr)*D, (-1*ch.lift)*D];
 const uE=[(1*ch.flex)*D, (-1*ch.twist)*D, (-1*ch.abd)*D];
 const fE=[(1*ch.elbow)*D, 0, 0];
 let B=yxz(cE[0],cE[1],cE[2]);
 const sh=add(O_C,mv(B,O_U));
 B=mm(B,yxz(uE[0],uE[1],uE[2]));
 const elb=add(sh,mv(B,O_F));
 B=mm(B,yxz(fE[0],0,0));
 const hand=add(add(elb,mv(B,O_H)),mv(B,O_HM));
 return {sh,elb,hand};
}
const ch={lift:20,retr:0,abd:35,flex:5,twist:115,elbow:140};
const o=fk(ch);
console.log('channels',JSON.stringify(ch));
console.log('shoulder',`[${o.sh.x.toFixed(3)},${o.sh.y.toFixed(3)},${o.sh.z.toFixed(3)}]`);
console.log('elbow   ',`[${o.elb.x.toFixed(3)},${o.elb.y.toFixed(3)},${o.elb.z.toFixed(3)}]`);
console.log('hand ctr',`[${o.hand.x.toFixed(3)},${o.hand.y.toFixed(3)},${o.hand.z.toFixed(3)}]`);
console.log('BAR     ',`[0.000,0.140,0.070]`,'gap',(d(o.hand,BAR)*100).toFixed(2),'sm');
console.log('elbow below shoulder?',(o.elb.y<o.sh.y));
console.log('elbow behind chest plane (z<0)?',(o.elb.z<0));
