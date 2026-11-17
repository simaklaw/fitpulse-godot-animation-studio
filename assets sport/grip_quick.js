const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);

const O_CLAV=V(-0.03,0.17,0.0),O_UPARM=V(-0.17,0.0,0.0);
const SHOULDER=add(O_CLAV,O_UPARM);
const L1=0.30;                              // плечо
const L2=0.26+0.075;                        // предплечье + до центра кисти

console.log('Плечо:',`[${SHOULDER.x},${SHOULDER.y},${SHOULDER.z}]`);
console.log('L1(плечо)=',L1,'L2(локоть->кисть)=',L2.toFixed(3));
console.log('Мин. расстояние плечо->кисть:',Math.abs(L1-L2).toFixed(3));
console.log('Макс. расстояние плечо->кисть:',(L1+L2).toFixed(3));
console.log('');
console.log('Расстояния от плеча до кандидатов на гриф:');
for(const [name,p] of [
  ['Chest-локально (0,0.14,0.07)',V(0,0.14,0.07)],
  ['Трапеции (0,0.24,0.10)',V(0,0.24,0.10)],
  ['Хват слева (-0.22,0.24,0.10)',V(-0.22,0.24,0.10)],
  ['Хват слева (-0.30,0.24,0.12)',V(-0.30,0.24,0.12)],
  ['Хват слева (-0.34,0.22,0.14)',V(-0.34,0.22,0.14)],
]){
  const d=len(sub(p,SHOULDER));
  const ok = d>=Math.abs(L1-L2) && d<=L1+L2;
  console.log(`  ${name}: ${d.toFixed(3)} м ${ok?'ДОСТИЖИМО':'НЕДОСТИЖИМО'}`);
}
