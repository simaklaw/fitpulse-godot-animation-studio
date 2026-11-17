const D=Math.PI/180;
const thighLen=0.45, shinLen=0.40;
const ankleY=0.08, ankleZ=0, toeZ=-0.15;
const hipsRestY=0.95;
const thighOffset={y:-0.02,z:0};
const segHS={y:0.08,z:0};   // Hips->Spine
const segSC={y:0.20,z:0};   // Spine->Chest
const bar={y:0.14,z:0.07};
function rot(v,a){const c=Math.cos(a),s=Math.sin(a);return {y:v.y*c-v.z*s, z:v.y*s+v.z*c};}
function solve(ch){
  const pelvis=ch.pelvis||0, spine=ch.spine_lean||0, chest=ch.chest_lean||0;
  const torso=pelvis+spine+chest;
  const thigh=ch.thigh, knee=ch.knee;
  const tr=thigh*D, sr=(thigh-knee)*D;
  const hipY=ankleY+thighLen*Math.cos(tr)+shinLen*Math.cos(sr);
  const hipZ=ankleZ+thighLen*Math.sin(tr)+shinLen*Math.sin(sr);
  const kneeY=hipY-thighLen*Math.cos(tr);
  const ro=rot(thighOffset,-pelvis*D);
  const hipsY=hipY-ro.y, hipsZ=hipZ-ro.z;
  const hips={y:hipsY,z:hipsZ};
  const p1=rot(segHS,-pelvis*D);
  const p2=rot(segSC,-(pelvis+spine)*D);
  const p3=rot(bar,-torso*D);
  const barY=hipsY+p1.y+p2.y+p3.y;
  const barZ=hipsZ+p1.z+p2.z+p3.z;
  const midZ=(ankleZ+toeZ)/2;
  return {hipY,kneeY,hipsY,hipsZ,torso,barY,barZ,balance:barZ-midZ,
          depth:100*(hipsRestY-hipY)/hipsRestY, dorsi:knee-thigh};
}
const cases={
  'stand':   {thigh:2,knee:5,pelvis:6,spine:3},
  'setup':   {thigh:8,knee:14,pelvis:8,spine:4},
  'descent_top':{thigh:30,knee:52,pelvis:18,spine:7},
  'bottom':  {thigh:95,knee:129,pelvis:34,spine:8},
  'break':   {thigh:60,knee:90,pelvis:30,spine:9},
};
for(const [k,v] of Object.entries(cases)){
  const r=solve(v);
  console.log(k.padEnd(12), 'hip',r.hipY.toFixed(3),'depth',r.depth.toFixed(1)+'%',
   'kneeH',r.kneeY.toFixed(3),'torso',r.torso.toFixed(0),'dorsi',r.dorsi.toFixed(0),
   'barZ',r.barZ.toFixed(3),'bal',(r.balance*100).toFixed(1)+'cm');
}
