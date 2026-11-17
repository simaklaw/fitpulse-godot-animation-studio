// Чистая геометрия: сфера достижимости кисти вокруг плечевого сустава.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);

const shoulder=V(-0.20,0.17,0.0);
const TARGET=V(-0.22,0.24,0.10);
const d=len(sub(TARGET,shoulder));
console.log('Плечо:',`[${shoulder.x},${shoulder.y},${shoulder.z}]`);
console.log('Цель (хват):',`[${TARGET.x},${TARGET.y},${TARGET.z}]`);
console.log('Расстояние плечо→цель:',d.toFixed(3),'м');
console.log('');

// Рука: плечо(0.30) + предплечье(0.26) + до центра кисти(0.075) = 0.635
const L1=0.30, L2=0.26+0.075;
console.log('Плечо-локоть L1 =',L1,'| локоть-кисть L2 =',L2.toFixed(3));
console.log('Мин. достижимое расстояние (полностью согнут):',Math.abs(L1-L2).toFixed(3),'м');
console.log('Макс. достижимое расстояние (выпрямлен):',(L1+L2).toFixed(3),'м');
console.log('');

if(d>=Math.abs(L1-L2) && d<=L1+L2){
  // Теорема косинусов: угол в локте
  const cosElbow=(L1*L1+L2*L2-d*d)/(2*L1*L2);
  const elbowAngle=Math.acos(Math.max(-1,Math.min(1,cosElbow)))/Math.PI*180;
  const cosShoulder=(L1*L1+d*d-L2*L2)/(2*L1*d);
  const shoulderAngle=Math.acos(Math.max(-1,Math.min(1,cosShoulder)))/Math.PI*180;
  console.log('ЦЕЛЬ ДОСТИЖИМА.');
  console.log('  Угол в локте (внутренний):',elbowAngle.toFixed(1),'° -> сгиб локтя',(180-elbowAngle).toFixed(1),'°');
  console.log('  Угол плеча от линии на цель:',shoulderAngle.toFixed(1),'°');
}else{
  console.log('ЦЕЛЬ НЕДОСТИЖИМА. Зазор',(d>L1+L2?d-(L1+L2):Math.abs(L1-L2)-d).toFixed(3),'м');
}
