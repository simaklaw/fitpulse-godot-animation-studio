// Tiny procedural mesh builder: positions, normals (auto from faces), uv, groups per material.
export class Mesh {
  constructor(){this.v=[];this.uv=[];this.n=[];this.groups=[];this.cur={name:'default',faces:[]};this.groups.push(this.cur);}
  use(name){ if(this.cur.name!==name){this.cur={name,faces:[]};this.groups.push(this.cur);} }
  _v(p,uv){this.v.push(p[0],p[1],p[2]);this.uv.push(uv?uv[0]:0,uv?uv[1]:0);return this.v.length/3-1;}
  // quad from 4 corner points CCW, uv rect [u0,v0,u1,v1]
  quad(a,b,c,d,rect,mat){this.use(mat);const r=rect||[0,0,1,1];
    const i0=this._v(a,[r[0],r[1]]),i1=this._v(b,[r[2],r[1]]),i2=this._v(c,[r[2],r[3]]),i3=this._v(d,[r[0],r[3]]);
    this.cur.faces.push([i0,i1,i2,i3]);}
  tri(a,b,c,rect,mat){this.use(mat);const r=rect||[0,0,1,1];
    const i0=this._v(a,[r[0],r[1]]),i1=this._v(b,[r[2],r[1]]),i2=this._v(c,[r[0],r[3]]);
    this.cur.faces.push([i0,i1,i2]);}
  // box centered on origin with size sx,sy,sz; rect per material quadrant
  box(cx,cy,cz,sx,sy,sz,mat,uvQuad){const hx=sx/2,hy=sy/2,hz=sz/2;
    const p=(x,y,z)=>[cx+x,cy+y,cz+z];const r=uvQuad||null;
    this.quad(p(-hx,hy,-hz),p(-hx,hy,hz),p(hx,hy,hz),p(hx,hy,-hz),r,mat); // +Y
    this.quad(p(-hx,-hy,-hz),p(hx,-hy,-hz),p(hx,-hy,hz),p(-hx,-hy,hz),r,mat); // -Y
    this.quad(p(-hx,-hy,hz),p(hx,-hy,hz),p(hx,hy,hz),p(-hx,hy,hz),r,mat); // +Z
    this.quad(p(hx,-hy,-hz),p(-hx,-hy,-hz),p(-hx,hy,-hz),p(hx,hy,-hz),r,mat); // -Z
    this.quad(p(hx,-hy,hz),p(hx,-hy,-hz),p(hx,hy,-hz),p(hx,hy,hz),r,mat); // +X
    this.quad(p(-hx,-hy,-hz),p(-hx,-hy,hz),p(-hx,hy,hz),p(-hx,hy,-hz),r,mat); // -X
  }
  cyl(cx,cy,cz,axis,r0,r1,h,seg,mat,uvQuad){ // axis: 'x'|'y'|'z'
    const r=uvQuad||null; const P=(u,v,w)=>{ if(axis==='y')return [cx+u,cy+w,cz+v]; if(axis==='x')return [cx+w,cy+u,cz+v]; return [cx+u,cy+v,cz+w]; };
    for(let i=0;i<seg;i++){const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
      const u0=Math.cos(a0),v0=Math.sin(a0),u1=Math.cos(a1),v1=Math.sin(a1);
      this.quad(P(u0*r0,v0*r0,-h/2),P(u1*r0,v1*r0,-h/2),P(u1*r1,v1*r1,h/2),P(u0*r1,v0*r1,h/2),r,mat);
    }
    // caps
    for(let i=0;i<seg;i++){const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
      const u0=Math.cos(a0),v0=Math.sin(a0),u1=Math.cos(a1),v1=Math.sin(a1);
      this.tri(P(0,0,h/2),P(u0*r1,v0*r1,h/2),P(u1*r1,v1*r1,h/2),r,mat);
      this.tri(P(0,0,-h/2),P(u1*r0,v1*r0,-h/2),P(u0*r0,v0*r0,-h/2),r,mat);
    }
  }
  toOBJ(name){const out=[];out.push('# FitPulse procedural mesh: '+name);
    for(let i=0;i<this.v.length;i+=3)out.push('v '+f(this.v[i])+' '+f(this.v[i+1])+' '+f(this.v[i+2]));
    for(let i=0;i<this.uv.length;i+=2)out.push('vt '+f(this.uv[i])+' '+f(this.uv[i+1]));
    for(const g of this.groups){ if(!g.faces.length)continue; out.push('g '+g.name); for(const fc of g.faces)out.push('f '+fc.map(k=>`${k+1}/${k+1}`).join(' ')); }
    return out.join('\n')+'\n';}
  stats(){let tris=0,quads=0;for(const g of this.groups)for(const fc of g.faces){if(fc.length===3)tris++;else quads++;}return {verts:this.v.length/3,faces:tris+quads,tris:tris+quads*2};}
}
const f=(n)=>{const r=Math.round(n*10000)/10000;return (Object.is(r,-0)?0:r).toString();};
// ---- extensions: rounded box, torus, tube along path, disc-with-hole, bolt
Mesh.prototype.rbox=function(cx,cy,cz,sx,sy,sz,r,mat,uvQuad,seg){
  // rounded box approximated by inset faces + chamfer strips (r small vs sizes)
  const hx=sx/2,hy=sy/2,hz=sz/2; r=Math.min(r,hx*0.9,hy*0.9,hz*0.9);
  const ix=hx-r, iy=hy-r, iz=hz-r;
  const p=(x,y,z)=>[cx+x,cy+y,cz+z];
  // main faces (inset)
  this.quad(p(-ix,hy,-iz),p(-ix,hy,iz),p(ix,hy,iz),p(ix,hy,-iz),uvQuad,mat);
  this.quad(p(-ix,-hy,-iz),p(ix,-hy,-iz),p(ix,-hy,iz),p(-ix,-hy,iz),uvQuad,mat);
  this.quad(p(-ix,-hy,iz),p(ix,-hy,iz),p(ix,hy,iz),p(-ix,hy,iz),uvQuad,mat);
  this.quad(p(ix,-hy,-iz),p(-ix,-hy,-iz),p(-ix,hy,-iz),p(ix,hy,-iz),uvQuad,mat);
  this.quad(p(ix,-hy,iz),p(ix,-hy,-iz),p(ix,hy,-iz),p(ix,hy,iz),uvQuad,mat);
  this.quad(p(-ix,-hy,-iz),p(-ix,-hy,iz),p(-ix,hy,iz),p(-ix,hy,-iz),uvQuad,mat);
  // chamfer strips (single quad per edge, bezier-ish by using mid-offset)
  const e=(a,b,c,d)=>this.quad(a,b,c,d,uvQuad,mat);
  // X edges (along X, at +-Y +-Z)
  for(const sy2 of [1,-1]) for(const sz2 of [1,-1]){
    e(p(-ix,sy2*hy,sz2*iz),p(ix,sy2*hy,sz2*iz),p(ix,sy2*iy,sz2*hz),p(-ix,sy2*iy,sz2*hz));
    e(p(ix,sy2*hy,sz2*iz),p(ix,sy2*hy,-sz2*iz),p(ix,sy2*iy,-sz2*hz),p(ix,sy2*iy,sz2*hz));
    e(p(-ix,sy2*hy,-sz2*iz),p(-ix,sy2*hy,sz2*iz),p(-ix,sy2*iy,sz2*hz),p(-ix,sy2*iy,-sz2*hz));
  }
  // Y edges (along Y)
  for(const sx2 of [1,-1]) for(const sz2 of [1,-1]){
    e(p(sx2*hx,-iy,sz2*iz),p(sx2*hx,iy,sz2*iz),p(sx2*ix,iy,sz2*hz),p(sx2*ix,-iy,sz2*hz));
  }
  // Z edges (along Z)
  for(const sx2 of [1,-1]) for(const sy2 of [1,-1]){
    e(p(sx2*ix,sy2*hy,-iz),p(sx2*ix,sy2*hy,iz),p(sx2*hx,sy2*iy,iz),p(sx2*hx,sy2*iy,-iz));
  }
  // corners: tri fan bridging chamfer ends
  for(const sx2 of [1,-1]) for(const sy2 of [1,-1]) for(const sz2 of [1,-1]){
    const A=p(sx2*ix,sy2*hy,sz2*iz), B=p(sx2*hx,sy2*iy,sz2*iz), C=p(sx2*ix,sy2*iy,sz2*hz);
    if(sx2*sy2*sz2>0) this.tri(A,B,C,uvQuad,mat); else this.tri(A,C,B,uvQuad,mat);
  }
  return this;
};
Mesh.prototype.torus=function(cx,cy,cz,axis,R,r,segU,segV,mat,uvQuad){
  const P=(u,v,w)=>{ if(axis==='y')return [cx+u,cy+w,cz+v]; if(axis==='x')return [cx+w,cy+u,cz+v]; return [cx+u,cy+v,cz+w]; };
  for(let i=0;i<segU;i++){
    const a0=i/segU*Math.PI*2,a1=(i+1)/segU*Math.PI*2;
    for(let j=0;j<segV;j++){
      const b0=j/segV*Math.PI*2,b1=(j+1)/segV*Math.PI*2;
      const pt=(a,b)=>P((R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b));
      this.quad(pt(a0,b0),pt(a1,b0),pt(a1,b1),pt(a0,b1),uvQuad,mat);
    }
  }
  return this;
};
Mesh.prototype.cylHole=function(cx,cy,cz,axis,R,r,h,seg,mat,uvQuad){
  // washer: outer wall, inner wall, two annular caps
  const P=(u,v,w)=>{ if(axis==='y')return [cx+u,cy+w,cz+v]; if(axis==='x')return [cx+w,cy+u,cz+v]; return [cx+u,cy+v,cz+w]; };
  for(let i=0;i<seg;i++){
    const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
    const c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
    this.quad(P(c0*R,s0*R,-h/2),P(c1*R,s1*R,-h/2),P(c1*R,s1*R,h/2),P(c0*R,s0*R,h/2),uvQuad,mat);
    this.quad(P(c1*r,s1*r,-h/2),P(c0*r,s0*r,-h/2),P(c0*r,s0*r,h/2),P(c1*r,s1*r,h/2),uvQuad,mat);
    this.quad(P(c0*R,s0*R,h/2),P(c1*R,s1*R,h/2),P(c1*r,s1*r,h/2),P(c0*r,s0*r,h/2),uvQuad,mat);
    this.quad(P(c1*R,s1*R,-h/2),P(c0*R,s0*R,-h/2),P(c0*r,s0*r,-h/2),P(c1*r,s1*r,-h/2),uvQuad,mat);
  }
  return this;
};
Mesh.prototype.tube=function(pts,rad,seg,mat,uvQuad){
  // polyline tube with simple frames
  const n=pts.length;
  const frames=[];
  for(let i=0;i<n;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];
    let t=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];const L=Math.hypot(...t)||1;t=t.map(x=>x/L);
    let up=[0,1,0]; if(Math.abs(t[1])>0.9)up=[1,0,0];
    const rt=[t[1]*up[2]-t[2]*up[1],t[2]*up[0]-t[0]*up[2],t[0]*up[1]-t[1]*up[0]];
    const rl=Math.hypot(...rt)||1;const R1=rt.map(x=>x/rl);
    const U=[t[1]*R1[2]-t[2]*R1[1],t[2]*R1[0]-t[0]*R1[2],t[0]*R1[1]-t[1]*R1[0]];
    frames.push([R1,U]);
  }
  const ring=(i,ang)=>{const [R1,U]=frames[i],c=Math.cos(ang),s=Math.sin(ang);const p=pts[i];
    return [p[0]+(R1[0]*c+U[0]*s)*rad,p[1]+(R1[1]*c+U[1]*s)*rad,p[2]+(R1[2]*c+U[2]*s)*rad];};
  for(let i=0;i<n-1;i++)for(let j=0;j<seg;j++){
    const a0=j/seg*Math.PI*2,a1=(j+1)/seg*Math.PI*2;
    this.quad(ring(i,a0),ring(i,a1),ring(i+1,a1),ring(i+1,a0),uvQuad,mat);
  }
  return this;
};
Mesh.prototype.bolt=function(cx,cy,cz,axis,r,h,mat,uvQuad){
  this.cyl(cx,cy,cz,axis,r*1.6,r*1.6,h,6,mat,uvQuad);
  return this;
};

// ---- LOD helpers -------------------------------------------------------
// Plain 6-quad box (12 tris) — no chamfers. Use where a sharp edge is fine.
Mesh.prototype.qbox=function(cx,cy,cz,sx,sy,sz,mat,uvQuad){
  this.box(cx,cy,cz,sx,sy,sz,mat,uvQuad);
  return this;
};
// Count triangles contributed since a marker (faces quads*2 + tris).
Mesh.prototype.mark=function(){this._m={v:this.v.length};return this._m;};
Mesh.prototype.sinceMark=function(){
  let tris=0;
  for(const g of this.groups){
    for(const f of g.faces){
      const isNew=f.some(i=>i*3>=this._m.v);
      if(!isNew)continue;
      tris+=f.length===3?1:f.length-2;
    }
  }
  return tris;
};
