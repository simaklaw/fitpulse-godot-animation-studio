import fs from 'node:fs';
const dir = 'out/lod';
const s = fs.readFileSync(`${dir}/mesh.js`, 'utf8');
const mm = s.match(/triangles\s*:\s*(\d+)/);
console.log('mesh.js reported triangles:', mm ? mm[1] : 'n/a');
const obj = fs.readFileSync(`${dir}/model_lod.obj`, 'utf8');
let tris = 0;
for (const l of obj.split('\n')) {
  if (l.startsWith('f ')) {
    const n = l.trim().split(/\s+/).length - 1;
    if (n >= 3) tris += n - 2;
  }
}
console.log('OBJ effective triangles:', tris);
for (const f of ['albedo.png', 'normal.png', 'preview_hero.png', 'preview_sheet.png', 'viewer.html']) {
  const st = fs.statSync(`${dir}/${f}`);
  console.log(f, st.size, 'bytes');
}
