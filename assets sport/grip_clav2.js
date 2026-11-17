// Диагноз: в моей модели лопатки знак retraction даёт уход плеча ВПЕРЁД (+Z 0.041)
// хотя должен назад (-Z). Проверим: scapula_retraction axis Z, sign_l -1
// Значит поворот вокруг Z на -cr. Для левой руки (X отрицательный) это...
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
console.log('влияние scapula_lift (X,+1) и retraction (Z,-1) на плечо:');
for(const cl of [0,20,45])for(const cr of [0,20,40]){
 const B=yxz(cl*D,0,-cr*D);
 const sh=add(O_C,mv(B,O_U));
 console.log(`  lift ${String(cl).padStart(2)} retr ${String(cr).padStart(2)} -> плечо [${sh.x.toFixed(3)},${sh.y.toFixed(3)},${sh.z.toFixed(3)}]`);
}
