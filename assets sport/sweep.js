const D=Math.PI/180;
const thighLen=0.45, shinLen=0.40;
const ankleY=0.08, ankleZ=0, toeZ=-0.15;
const hipsRestY=0.95;
const thighOffset={y:-0.02,z:0};
const segHS={y:0.08,z:0}, segSC={y:0.20,z:0};
const bar={y:0.14,z:0.07};
function rot(v,a){const c=Math.cos(a),s=Math.sin(a);return {y:v.y*c-v.z*s, z:v.y*s+v.z*c};}
function solve(thigh,knee,pelvis,spine){
  const torso=pelvis+spine;
  const tr=thigh*D, sr=(thigh-knee)*D;
  const hipY=ankleY+thighLen*Math.cos(tr)+shinLen*Math.cos(sr);
  const hipZ=ankleZ+thighLen*Math.sin(tr)+shinLen*Math.sin(sr);
  const ro=rot(thighOffset,-pelvis*D);
  const hipsY=hipY-ro.y, hipsZ=hipZ-ro.z;
  const p1=rot(segHS,-pelvis*D), p2=rot(segSC,-(pelvis+spine)*D), p3=rot(bar,-torso*D);
  const barZ=hipsZ+p1.z+p2.z+p3.z;
  const midZ=(ankleZ+toeZ)/2;
  return {hipY,barZ,bal:(barZ-midZ)*100,spine};
}
console.log('--- LOW BAR: pelvis 15..35, spine 5..15, thigh 95 knee 129 ---');
let best=[];
for(let p=10;p<=45;p+=1) for(let s=2;s<=14;s+=1){
  const r=solve(95,129,p,s);
  best.push({p,s,bal:r.bal,hip:r.hipY});
}
best.sort((a,b)=>Math.abs(a.bal)-Math.abs(b.bal));
for(const b of best.slice(0,10)) console.log(`pelvis ${b.p} spine ${b.s} -> bal ${b.bal.toFixed(1)}cm hip ${b.hip.toFixed(3)}`);
console.log('--- BAR LOCAL POS z sweep at bottom (pelvis 34, spine 8) ---');
for(const bz of [0.0,0.04,0.07,0.10,0.14]){
  bar.z=bz;
  const r=solve(95,129,34,8);
  console.log(`bar.z ${bz} -> bal ${r.bal.toFixed(1)}cm`);
}
