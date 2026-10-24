#!/usr/bin/env python3
"""Inventory the two supplied Motifect FBX/BVH archives without modifying them."""
from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path, PurePosixPath
CATEGORIES = {
    "sports": "motifect_sports_and_athletics_v1_0_fbx.zip",
    "martial_arts": "motifect_martial_arts_v1_0_fbx.zip",
}
def read_docs(archive, names):
    out=[]
    allowed={"readme.txt","readme.md","license.txt","licence.txt","license","license.md","terms.txt","notice.txt"}
    for n in names:
        if PurePosixPath(n).name.lower() in allowed:
            try: out.append({"path":n,"text":archive.read(n).decode("utf-8","replace")[:30000]})
            except Exception: pass
    return out
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",type=Path,default=Path("."))
    ap.add_argument("--out",type=Path,default=Path("build/motifect-audit"))
    args=ap.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    print("MOTIFECT_ARCHIVE_AUDIT_BEGIN", flush=True)
    result={"source":"Motifect","packs":{}}
    markdown=["# Motifect motion-pack audit","","> Inventory and import-compatibility checks only. No animation is marked production-ready until retargeted and reviewed on a FitPulse character.",""]
    for key,filename in CATEGORIES.items():
        path=args.root/filename
        if not path.is_file(): raise SystemExit(f"Missing expected source archive: {path}")
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        with zipfile.ZipFile(path) as z:
            infos=[i for i in z.infolist() if not i.is_dir()]
            names=[i.filename for i in infos]
            fbx=sorted(n for n in names if n.lower().endswith(".fbx"))
            bvh=sorted(n for n in names if n.lower().endswith(".bvh"))
            docs=read_docs(z,names)
            if not fbx: raise SystemExit(f"{filename}: no FBX files found")
            extract_root=args.out/"extracted"/key
            extracted=[]
            for member in fbx+bvh:
                rel=PurePosixPath(member)
                if rel.is_absolute() or ".." in rel.parts: raise SystemExit(f"Unsafe archive member path: {member}")
                dest=extract_root.joinpath(*rel.parts)
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(z.read(member))
                if member.lower().endswith(".fbx"): extracted.append(str(dest))
            result["packs"][key]={
                "archive":filename,"sha256":digest,"archiveFiles":len(infos),
                "uncompressedBytes":sum(i.file_size for i in infos),
                "fbxCount":len(fbx),"bvhCount":len(bvh),"fbx":fbx,"bvh":bvh,
                "documentation":docs,"extractedFbx":extracted,
            }
            markdown += [f"## {key.replace('_',' ').title()}","",
                f"- Archive: {filename}",f"- SHA-256: {digest}",
                f"- Files: {len(infos)}; FBX clips: {len(fbx)}; BVH clips: {len(bvh)}",
                f"- Uncompressed size: {sum(i.file_size for i in infos):,} bytes","","### FBX motion filenames",""]
            markdown += [f"- {PurePosixPath(n).name}" for n in fbx]
            markdown += ["","### BVH motion filenames",""]
            markdown += [f"- {PurePosixPath(n).name}" for n in bvh]
            markdown += ["","### Included documentation",""]
            for item in docs: markdown += [f"Source: {item['path']}","",item["text"].strip(),""]
            if not docs: markdown += ["No README/license text file found in the archive listing.",""]
    (args.out/"inventory.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    (args.out/"inventory.md").write_text("\n".join(markdown)+"\n")
    print("\n".join(markdown))
if __name__=="__main__": main()
