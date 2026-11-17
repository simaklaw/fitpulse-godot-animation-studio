// Где физически лежит гриф высокого приседа относительно Chest?
// Гриф опирается на трапеции — это ВЫШЕ плечевого сустава и СЗАДИ от него.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);

// Chest-локальные координаты плечевого сустава
const shoulder=V(-0.20,0.17,0.0);
// Трапеции: над плечом на ~4-6 см, сзади на ~4-8 см (гриф на полке из трапеций)
const BAR_ON_TRAPS=V(0.0, 0.24, 0.10);

console.log('Плечо:', `[${shoulder.x}, ${shoulder.y}, ${shoulder.z}]`);
console.log('Гриф на трапециях:', `[${BAR_ON_TRAPS.x}, ${BAR_ON_TRAPS.y}, ${BAR_ON_TRAPS.z}]`);
const d=len(sub(BAR_ON_TRAPS,shoulder));
console.log('Расстояние плечо→гриф:', d.toFixed(3),'м');
console.log('Рука до центра кисти: 0.635 м');
console.log('Свободный остаток (на сгиб локтя):', (0.635-d).toFixed(3),'м');
console.log('');

// При хвате кисть НЕ в центре грифа по X: она снаружи плеча.
// Полуширина хвата ~0.22 м (гриф 1.45 м, плечи 0.34 м).
for(const gripX of [0.18, 0.22, 0.26]){
  const target=V(gripX, BAR_ON_TRAPS.y, BAR_ON_TRAPS.z);
  const dd=len(sub(target,shoulder));
  console.log(`Хват X=${gripX}: расстояние от плеча ${dd.toFixed(3)} м, остаток на локоть ${(0.635-dd).toFixed(3)} м`);
}
