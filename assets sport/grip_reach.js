// Геометрический анализ: докуда рука дотягивается В ПРИНЦИПЕ.
const V=(x,y,z)=>({x,y,z});
const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
const len=a=>Math.hypot(a.x,a.y,a.z);

const O_CLAV=V(-0.03,0.17,0.0);
const O_UPARM=V(-0.17,0.0,0.0);
const O_FORE=V(0.0,-0.30,0.0);
const O_HAND=V(0.0,-0.26,0.0);
const O_HANDMESH=V(0.0,-0.075,0.0);
const BAR=V(0.0,0.14,0.07);

// Плечевой сустав в Chest-локальных координатах
const shoulder=add(O_CLAV,O_UPARM);
console.log('Плечевой сустав (Chest-локально):', `[${shoulder.x}, ${shoulder.y}, ${shoulder.z}]`);

// Длина руки от плеча до ЦЕНТРА КИСТИ
const armLen = len(O_FORE)+len(O_HAND)+len(O_HANDMESH);
console.log('Длина руки плечо→центр кисти:', armLen.toFixed(3),'м');

// Расстояние от плеча до грифа
dist = len(sub(BAR,shoulder));
console.log('Расстояние плечо→гриф:', dist.toFixed(3),'м');
console.log('Запас:', (armLen-dist).toFixed(3),'м');
console.log('');

// Докуда достаёт рука: сфера радиуса armLen вокруг плеча.
// Ближайшая к грифу точка сферы — на прямой плечо→гриф.
const dir = sub(BAR,shoulder);
const closest = add(shoulder, V(dir.x/len(dir)*armLen, dir.y/len(dir)*armLen, dir.z/len(dir)*armLen));
console.log('Ближайшая достижимая точка:', `[${closest.x.toFixed(3)}, ${closest.y.toFixed(3)}, ${closest.z.toFixed(3)}]`);
console.log('Минимальный зазор в принципе:', len(sub(closest,BAR)).toFixed(3),'м');
