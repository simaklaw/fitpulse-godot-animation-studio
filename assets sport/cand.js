const D=Math.PI/180;
const thighLen=0.45, shinLen=0.40;
const ankleY=0.08, ankleZ=0, toeZ=-0.15;
const hipsRestY=0.95;
const thighOffset={y:-0.02,z:0};
const segHS={y:0.08,z:0}, segSC={y:0.20,z:0};
const BAR={y:0.14,z:0.07};
function rot(v,a){const c=Math.cos(a),s=Math.sin(a);return {y:v.y*c-v.z*s, z:v.y*s+v.z*c};}
function solve(thigh,knee,pelvis,spine,bar=BAR){
  const torso=pelvis+spine;
  const tr=thigh*D, sr=(thigh-knee)*D;
  const hipY=ankleY+thighLen*Math.cos(tr)+shinLen*Math.cos(sr);
  const hipZ=ankleZ+thighLen*Math.sin(tr)+shinLen*Math.sin(sr);
  const kneeY=hipY-thighLen*Math.cos(tr);
  const ro=rot(thighOffset,-pelvis*D);
  const hipsY=hipY-ro.y, hipsZ=hipZ-ro.z;
  const p1=rot(segHS,-pelvis*D), p2=rot(segSC,-(pelvis+spine)*D), p3=rot(bar,-torso*D);
  const barY=hipsY+p1.y+p2.y+p3.y, barZ=hipsZ+p1.z+p2.z+p3.z;
  const midZ=(ankleZ+toeZ)/2;
  return {hipY,kneeY,barY,barZ,bal:(barZ-midZ)*100,dorsi:knee-thigh,depth:100*(hipsRestY-hipY)/hipsRestY,spine,torso};
}
// Предлагаемый профиль: больше наклона таза, поясница <=8
const prof={
 'stand':    [2,5,10,4],
 'setup':    [8,14,12,5],
 'descent_top':[30,52,24,7],
 'bottom':   [95,129,34,8],
 'break':    [60,90,30,8],
};
for(const [k,v] of Object.entries(prof)){
  const r=solve(...v);
  console.log(k.padEnd(12),`bal ${r.bal.toFixed(1).padStart(6)}cm  dorsi ${r.dorsi.toFixed(0).padStart(3)}  depth ${r.depth.toFixed(0).padStart(3)}%  spine ${r.spine}  torso ${r.torso.toFixed(0)}`);
}
console.log('--- bar.z needed to zero balance at bottom for pelvis 34/38/42 ---');
for(const p of [34,38,42,45]){
  for(const bz of [0.0,0.02,0.04,0.06,0.07,0.09]){
    const r=solve(95,129,p,8,{y:0.14,z:bz});
    if(Math.abs(r.bal)<3.5) console.log(`pelvis ${p} bar.z ${bz} -> bal ${r.bal.toFixed(1)}cm`);
  }
}
