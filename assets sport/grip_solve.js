// Проверка хвата: FK левой руки (Chest-локально), с лопаткой как отдельным звеном.
// Иерархия: Chest -> Clavicle_L (offset -0.03,0.17,0) -> UpperArm_L (offset -0.17,0,0)
//           -> Forearm_L (0,-0.30,0) -> Hand_L (0,-0.26,0), центр ладони (0,-0.075,0)
const D=Math.PI/180;
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return [[1,0,0],[0,c,-s],[0,s,c]];}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return [[c,0,s],[0,1,0],[-s,0,c]];}
function rotZ(a){const c=Math.cos(a),s=Math.sin(a);return [[c,-s,0],[s,c,0],[0,0,1]];}
function mul(A,B){const C=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<3;i++)for(let j=0;j<3;j++){let s=0;for(let k=0;k<3;k++)s+=A[i][k]*B[k][j];C[i][j]=s;}return C;}
function mv(A,v){return [A[0][0]*v[0]+A[0][1]*v[1]+A[0][2]*v[2],A[1][0]*v[0]+A[1][1]*v[1]+A[1][2]*v[2],A[2][0]*v[0]+A[2][1]*v[1]+A[2][2]*v[2]];}
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
// YXZ: R = Ry * Rx * Rz  (как Basis.from_euler(EULER_ORDER_YXZ))
function yxz(x,y,z){return mul(mul(rotY(y),rotX(x)),rotZ(z));}

// каналы -> локальные базисы (левая сторона, знаки из CHANNELS)
function fk(clavZ, clawY, shX, shY, shZ, elX){
  // Clavicle_L: scapula_lift axis2 sign -1, scapula_retraction axis1 sign -1
  const Bc = yxz(0, -clawY*D, -clavZ*D);
  // UpperArm_L: flexion axis0 sign +1, twist axis1 sign -1, abduction axis2 sign -1
  const Bu = yxz(shX*D, -shY*D, -shZ*D);
  // Forearm_L: elbow axis0 sign +1
  const Bf = yxz(elX*D,0,0);

  const chest=[0,0,0];
  const clav = add(chest, mv([[1,0,0],[0,1,0],[0,0,1]],[-0.03,0.17,0]));
  const shoulder = add(clav, mv(Bc,[-0.17,0,0]));
  const elbow = add(shoulder, mv(mul(Bc,Bu),[0,-0.30,0]));
  const wrist = add(elbow, mv(mul(mul(Bc,Bu),Bf),[0,-0.26,0]));
  const handc = add(wrist, mv(mul(mul(Bc,Bu),Bf),[0,-0.075,0]));
  return {shoulder,elbow,wrist,handc};
}

const TARGET=[-0.30,0.14+0.17+0.0,0.07]; // гриф в Chest-локальных (x=-0.30 точка хвата)
// Chest origin: Spine(0,0.08)+Chest(0,0.20) от Hips; гриф = Chest + (0,0.14,0.07) = (0,0.95+0.28+0.14,0.07)
const BAR=[0,0.95+0.08+0.20+0.14,0.07];
console.log('BAR chest-frame =', BAR);
console.log('grip left x=-0.30 ->', [-0.30,BAR[1],BAR[2]]);

// Ищем минимум расстояния центра ладони до точки хвата левой кисти.
const T=[-0.30,BAR[1],BAR[2]];
let best={d:1e9};
for(let clavZ=0;clavZ<=30;clavZ+=2)
for(let clawY=0;clawY<=25;clawY+=5)
for(let shX=-40;shX<=40;shX+=4)
for(let shY=0;shY<=130;shY+=10)
for(let shZ=0;shZ<=60;shZ+=5)
for(let elX=80;elX<=150;elX+=5){
  const r=fk(clavZ,clawY,shX,shY,shZ,elX);
  const d=Math.hypot(r.handc[0]-T[0],r.handc[1]-T[1],r.handc[2]-T[2]);
  if(d<best.d) best={d,clavZ,clawY,shX,shY,shZ,elX,r};
}
console.log('BEST', best.d.toFixed(3), 'cm=',(best.d*100).toFixed(1));
console.log('params clavZ',best.clavZ,'clawY',best.clawY,'shX',best.shX,'shY',best.shY,'shZ',best.shZ,'elX',best.elX);
console.log('shoulder',best.r.shoulder.map(v=>v.toFixed(3)).join(','));
console.log('elbow',best.r.elbow.map(v=>v.toFixed(3)).join(','));
console.log('hand',best.r.handc.map(v=>v.toFixed(3)).join(','));
