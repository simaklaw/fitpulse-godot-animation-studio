// НАЙДЕН БАГ: scapula_lift axis X даёт НОЛЬ смещения плеча, потому что
// UpperArm смещён вдоль -X от Clavicle, а вращение вокруг X не двигает точку на оси X.
// Значит lift обязан быть вокруг Z (подъём в фронтальной плоскости), а retraction — вокруг Y.
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
const O_C={x:-0.03,y:0.17,z:0},O_U={x:-0.17,y:0,z:0};
console.log('Z-ось (подъём), левая рука, знак -1:');
for(const cl of [0,15,30,45]){
 const B=yxz(0,0,-cl*D);
 const sh=add(O_C,mv(B,O_U));
 console.log(`  lift ${String(cl).padStart(2)} -> плечо [${sh.x.toFixed(3)},${sh.y.toFixed(3)},${sh.z.toFixed(3)}]`);
}
console.log('Y-ось (ретракция), левая рука:');
for(const cr of [0,15,30]){
 for(const sg of [-1,1]){
  const B=yxz(0,sg*cr*D,0);
  const sh=add(O_C,mv(B,O_U));
  console.log(`  retr ${String(cr).padStart(2)} sign ${sg>0?'+':'-'} -> плечо [${sh.x.toFixed(3)},${sh.y.toFixed(3)},${sh.z.toFixed(3)}]`);
 }
}
