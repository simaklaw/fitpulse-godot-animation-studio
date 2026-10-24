"""Import each FBX in Blender and report its rig/action compatibility with the FitPulse retargeter."""
import bpy, json, sys
from pathlib import Path
argv=sys.argv[sys.argv.index("--")+1:]
sports_dir=Path(argv[0]); martial_dir=Path(argv[1]); output=Path(argv[2])
def norm(s):
    return s.lower().replace("mixamorig:","").replace("mixamorig_","").replace("mixamorig","").replace("_","").replace(".","").replace("-","")
aliases = {
 "Hips":["hips","pelvis"], "LeftUpLeg":["leftupleg","thighl","thigh_l"],
 "LeftLeg":["leftleg","calfl","calf_l"], "LeftFoot":["leftfoot","footl","foot_l"],
 "LeftArm":["leftarm","upperarml","upper_arm_l"], "LeftForeArm":["leftforearm","lowerarml","lower_arm_l"],
 "LeftHand":["lefthand","handl","hand_l"], "RightUpLeg":["rightupleg","thighr","thigh_r"],
 "RightLeg":["rightleg","calfr","calf_r"], "RightFoot":["rightfoot","footr","foot_r"],
 "RightArm":["rightarm","upperarmr","upper_arm_r"], "RightForeArm":["rightforearm","lowerarmr","lower_arm_r"],
 "RightHand":["righthand","handr","hand_r"], "Spine":["spine"], "Spine2":["spine2","spine_02"],
 "Neck":["neck"], "Head":["head"],
}
def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)
results=[]
motifect_map = {
 "pelvis":"Spine1", "spine":"Spine2", "chest":"Chest", "neck":"Neck1", "head":"Head",
 "thigh.L":"LeftLeg", "shin.L":"LeftShin", "foot.L":"LeftFoot",
 "upper_arm.L":"LeftArm", "forearm.L":"LeftForeArm", "hand.L":"LeftHand",
 "thigh.R":"RightLeg", "shin.R":"RightShin", "foot.R":"RightFoot",
 "upper_arm.R":"RightArm", "forearm.R":"RightForeArm", "hand.R":"RightHand",
}
sample_clips = {
 "weightlifting_press_overhead.fbx", "weightlifting_clean.fbx", "rowing_stroke.fbx",
 "marathon_pace_run.fbx", "boxing_stance_footwork.fbx", "muay_thai_combination.fbx",
 "muay_thai_roundhouse.fbx",
}
inspect_bones = ["Spine1","Spine2","Chest","Neck1","Neck2","Head","LeftShoulder","LeftArm",
 "LeftForeArm","LeftHand","LeftLeg","LeftShin","LeftFoot","RightShoulder","RightArm",
 "RightForeArm","RightHand","RightLeg","RightShin","RightFoot"]
for pack,folder in (("sports",sports_dir),("martial_arts",martial_dir)):
 for fbx in sorted(folder.rglob("*.fbx")):
  try:
   reset()
   bpy.ops.import_scene.fbx(filepath=str(fbx), use_anim=True, automatic_bone_orientation=False, ignore_leaf_bones=True)
   arms=[o for o in bpy.data.objects if o.type=="ARMATURE"]
   actions=list(bpy.data.actions); arm=arms[0] if arms else None
   bones=[b.name for b in arm.data.bones] if arm else []
   action=arm.animation_data.action if arm and arm.animation_data else None
   if action is None and actions: action=actions[0]
   lo,hi=(action.frame_range[0],action.frame_range[1]) if action else (0,0)
   norm_bones={norm(n) for n in bones}
   matched=[k for k,alts in aliases.items() if any(norm(a) in norm_bones for a in alts)]
   available=set(bones)
   map_matched={dst:src for dst,src in motifect_map.items() if src in available}
   hierarchy=[]
   if not any(row.get("boneHierarchy") for row in results if row["pack"]==pack) and arm:
    for bone in arm.data.bones:
     hierarchy.append({"name":bone.name,"parent":bone.parent.name if bone.parent else None,
      "headLocal":[round(v,5) for v in bone.head_local],"tailLocal":[round(v,5) for v in bone.tail_local],
      "length":round(bone.length,5)})
   motion_samples=[]
   if fbx.name in sample_clips and arm and action:
    for frame in sorted({int(round(lo)),int(round((lo+hi)/2)),int(round(hi))}):
     bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
     sample={"frame":frame,"armatureWorldLocation":[round(v,5) for v in arm.matrix_world.translation],
      "bones":{}}
     for name in inspect_bones:
      pb=arm.pose.bones.get(name)
      if pb:
       sample["bones"][name]={"headWorld":[round(v,5) for v in (arm.matrix_world @ pb.head)],
        "tailWorld":[round(v,5) for v in (arm.matrix_world @ pb.tail)],
        "rotationQuaternion":[round(v,5) for v in pb.rotation_quaternion]}
     motion_samples.append(sample)
   action_curves=[]
   if fbx.name in sample_clips and action:
    action_curves=[fc.data_path for fc in action.fcurves][:80]
   row={"pack":pack,"file":fbx.name,"import":"PASS","armatures":len(arms),"boneCount":len(bones),
    "action":action.name if action else None,"frameStart":round(lo,3),"frameEnd":round(hi,3),
    "frameCount":max(0,int(round(hi-lo))+1),"fps":bpy.context.scene.render.fps,
    "matchedCoreBones":len(matched),"coreBoneCoverage":round(len(matched)/len(aliases),3),
    "missingCoreBones":[k for k in aliases if k not in matched],"boneNames":bones[:80],
    "motifectCandidateMap":motifect_map,"motifectMapMatched":map_matched,
    "motifectMapCoverage":round(len(map_matched)/len(motifect_map),3)}
   if hierarchy: row["boneHierarchy"]=hierarchy
   if motion_samples: row["motionSamples"]=motion_samples; row["actionCurves"]=action_curves
   results.append(row)
  except Exception as e: results.append({"pack":pack,"file":fbx.name,"import":"FAIL","error":repr(e)[:1000]})
  if len(results)%10==0: print("BLENDER_AUDIT_PROGRESS",len(results),flush=True)
for pack in ("sports","martial_arts"):
 items=[x for x in results if x["pack"]==pack]
 print(f"BLENDER_AUDIT pack={pack} files={len(items)} pass={sum(x['import']=='PASS' for x in items)} fail={sum(x['import']=='FAIL' for x in items)}")
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({"format":"motifect-blender-audit/1","results":results},indent=2)+"\n")
for item in results:
 print("MOTIFECT_CLIP "+json.dumps({k:item.get(k) for k in ("pack","file","import","action","frameCount","coreBoneCoverage","missingCoreBones","error")},ensure_ascii=False))
