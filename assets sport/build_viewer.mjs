import fs from 'node:fs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const mesh=fs.readFileSync(ROOT+'/web/mesh.js','utf8');

const html=`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>FitPulse — Lat Pulldown Trainer · 1904 tris</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden;background:#0b0d10;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e8ebef;-webkit-tap-highlight-color:transparent}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
  #c.dragging{cursor:grabbing}
  .hud{position:fixed;pointer-events:none;z-index:5}
  .title{top:16px;left:18px;font-size:14px;font-weight:600;letter-spacing:.02em}
  .title span{display:block;font-size:11px;font-weight:400;color:#7d8899;margin-top:3px;letter-spacing:.06em;text-transform:uppercase}
  .stats{top:16px;right:18px;text-align:right;font-size:11px;color:#7d8899;line-height:1.7;font-variant-numeric:tabular-nums}
  .stats b{color:#e8ebef;font-weight:600}
  .bar{position:fixed;bottom:0;left:0;right:0;z-index:6;display:flex;gap:8px;padding:14px 14px calc(14px + env(safe-area-inset-bottom));justify-content:center;flex-wrap:wrap;background:linear-gradient(to top,rgba(11,13,16,.92),rgba(11,13,16,0))}
  button{pointer-events:auto;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.11);color:#dfe4ea;padding:9px 15px;border-radius:10px;font-size:12.5px;font-weight:500;cursor:pointer;transition:.16s;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  button:hover{background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.2)}
  button.on{background:rgba(217,158,90,.22);border-color:rgba(217,158,90,.55);color:#f0c48e}
  button:active{transform:scale(.96)}
  #hint{position:fixed;bottom:calc(66px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:11px;color:#5c6675;pointer-events:none;transition:opacity .6s;z-index:5}
  #hint.gone{opacity:0}
  #load{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0b0d10;z-index:20;font-size:12px;color:#5c6675;letter-spacing:.08em;text-transform:uppercase;transition:opacity .4s}
  #load.gone{opacity:0;pointer-events:none}
  #err{position:fixed;left:12px;right:12px;top:80px;z-index:30;background:rgba(120,20,20,.92);color:#ffd7d7;padding:12px;border-radius:10px;font-size:11px;font-family:monospace;white-space:pre-wrap;display:none}
</style></head><body>
<canvas id="c"></canvas>
<div class="hud title">Lat Pulldown Trainer<span>FitPulse · LOD-3</span></div>
<div class="hud stats" id="stats"><b>1904</b> tris · 4 mats<br><b>4372</b> verts</div>
<div id="hint">перетащи — вращение · щипок / колесо — зум</div>
<div class="bar">
  <button id="bSpin" class="on">Авто-вращение</button>
  <button id="bWire">Каркас</button>
  <button id="bReset">Сброс вида</button>
  <button id="bShot">Скриншот</button>
</div>
<div id="load">Загрузка модели…</div>
<div id="err"></div>
<script>${mesh}</script>
<script>
(function(){
'use strict';
function fail(msg){const e=document.getElementById('err');e.style.display='block';e.textContent=String(msg);}
window.addEventListener('error',ev=>fail(ev.message+' @'+ev.lineno));
try{
const M=window.GYM_MESH;
const canvas=document.getElementById('c');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl');
if(!gl){document.getElementById('load').textContent='WebGL не поддерживается';return;}
const MATS=[
  {name:'steel',  base:[0.78,0.79,0.82], rough:0.34, metal:0.92},
  {name:'rubber', base:[0.15,0.16,0.18], rough:0.86, metal:0.02},
  {name:'accent', base:[0.86,0.61,0.33], rough:0.42, metal:0.65},
  {name:'leather',base:[0.56,0.50,0.45], rough:0.74, metal:0.04}
];

const bb=M.bbox, ctr=[(bb.min[0]+bb.max[0])/2,(bb.min[1]+bb.max[1])/2,(bb.min[2]+bb.max[2])/2];
const size=[bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]];
const radius=0.5*Math.hypot(size[0],size[1],size[2]);
const HOME={yaw:0.62,pitch:0.26,dist:radius*3.05,tgt:[ctr[0],ctr[1]+size[1]*0.02,ctr[2]]};
let cam={yaw:HOME.yaw,pitch:HOME.pitch,dist:HOME.dist,tgt:HOME.tgt.slice()};

const VS=[
'attribute vec3 aPos;',
'attribute vec3 aNrm;',
'attribute vec2 aUV;',
'attribute float aMat;',
'uniform mat4 uMVP;',
'uniform mat4 uMV;',
'uniform mat3 uNrmMat;',
'varying vec3 vN;',
'varying vec3 vWP;',
'varying vec2 vUV;',
'varying float vMat;',
'void main(){',
'  vec4 wp=vec4(aPos,1.0);',
'  vWP=wp.xyz;',
'  vN=normalize(uNrmMat*aNrm);',
'  vUV=aUV; vMat=aMat;',
'  gl_Position=uMVP*wp;',
'}'
].join('\n');

const FS=[
'precision highp float;',
'varying vec3 vN; varying vec3 vWP; varying vec2 vUV; varying float vMat;',
'uniform vec3 uBase[4]; uniform float uRough[4]; uniform float uMetal[4];',
'uniform vec3 uEye; uniform float uWire;',
'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
'  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
'void main(){',
'  int mi=int(vMat+0.5);',
'  vec3 base=vec3(0.5); float rough=0.5; float metal=0.0;',
'  if(mi==0){base=uBase[0];rough=uRough[0];metal=uMetal[0];}',
'  else if(mi==1){base=uBase[1];rough=uRough[1];metal=uMetal[1];}',
'  else if(mi==2){base=uBase[2];rough=uRough[2];metal=uMetal[2];}',
'  else {base=uBase[3];rough=uRough[3];metal=uMetal[3];}',
'  vec3 N=normalize(vN);',
'  vec3 V=normalize(uEye-vWP);',
'  if(dot(N,V)<0.0) N=-N;',
'  vec3 L1=normalize(vec3(0.55,0.85,0.45));',
'  vec3 L2=normalize(vec3(-0.65,0.22,-0.52));',
'  vec3 alb=base;',
'  if(mi==0){',
'    float s=noise(vec2(vWP.y*140.0, vWP.x*9.0+vWP.z*9.0));',
'    alb*=0.90+0.16*s;',
'    float pt=noise(vec2(vWP.x*38.0,vWP.z*38.0));',
'    alb*=0.97+0.06*pt;',
'  } else if(mi==1){',
'    float g=noise(vWP.xz*260.0+vWP.y*180.0);',
'    alb*=0.86+0.28*g;',
'  } else if(mi==2){',
'    float pe=noise(vWP.xy*90.0+vWP.z*70.0);',
'    alb*=0.94+0.12*pe;',
'  } else {',
'    float g1=noise(vWP.xy*120.0+vWP.z*40.0);',
'    float g2=noise(vWP.zy*150.0-vWP.x*40.0);',
'    alb*=0.88+0.10*g1+0.08*g2;',
'  }',
'  float NdotV=max(dot(N,V),1e-3);',
'  vec3 F0=mix(vec3(0.04),alb,metal);',
'  vec3 diff=alb*(1.0-metal);',
'  vec3 col=vec3(0.0);',
'  {',
'    vec3 L=L1; vec3 H=normalize(L+V);',
'    float NdotL=max(dot(N,L),0.0);',
'    float NdotH=max(dot(N,H),0.0);',
'    float a=max(rough*rough,0.002);',
'    float d=(NdotH*NdotH*(a*a-1.0)+1.0);',
'    float D=a*a/(3.14159*d*d);',
'    float k=a*0.5;',
'    float G=(NdotV/(NdotV*(1.0-k)+k))*(NdotL/(NdotL*(1.0-k)+k));',
'    vec3 F=F0+(1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);',
'    vec3 spec=D*G*F/(4.0*NdotV*NdotL+1e-3);',
'    col+=(diff/3.14159+spec)*NdotL*vec3(1.0,0.96,0.90)*2.6;',
'  }',
'  {',
'    vec3 L=L2; vec3 H=normalize(L+V);',
'    float NdotL=max(dot(N,L),0.0);',
'    float NdotH=max(dot(N,H),0.0);',
'    float a=max(rough*rough*1.6,0.004);',
'    float d=(NdotH*NdotH*(a*a-1.0)+1.0);',
'    float D=a*a/(3.14159*d*d);',
'    vec3 F=F0+(1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);',
'    col+=(diff/3.14159+D*F*0.25)*NdotL*vec3(0.52,0.62,0.86)*0.95;',
'  }',
'  {',
'    float rim=pow(1.0-NdotV,3.0);',
'    col+=vec3(0.34,0.46,0.68)*rim*0.75*(0.4+0.6*(1.0-rough));',
'  }',
'  vec3 sky=vec3(0.30,0.34,0.42), grd=vec3(0.06,0.06,0.07);',
'  col+=mix(grd,sky,N.y*0.5+0.5)*diff*0.55;',
'  float shadow=0.0;',
'  if(vWP.y<0.16){',
'    vec2 d2=vec2(vWP.x*1.15,(vWP.z-0.05)*0.95);',
'    float r=length(d2);',
'    shadow=exp(-r*r*3.2)*smoothstep(0.16,0.0,vWP.y)*0.55;',
'  }',
'  col*=1.0-shadow;',
'  col=col/(col+vec3(0.62));',
'  col=pow(max(col,0.0),vec3(1.0/2.2));',
'  col=mix(col,vec3(0.35,0.85,1.0),uWire*0.9);',
'  gl_FragColor=vec4(col,1.0);',
'}'
].join('\n');

function compile(type,src){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog=gl.createProgram();
gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));
gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const pos=new Float32Array(M.pos);
const uv=new Float32Array(M.uv);
const idxArr=new Uint32Array(M.idx);
const nTri=idxArr.length/3;
const nrm=new Float32Array(pos.length);
for(let i=0;i<nTri;i++){
  const a=idxArr[i*3]*3,b=idxArr[i*3+1]*3,c=idxArr[i*3+2]*3;
  const ax=pos[a],ay=pos[a+1],az=pos[a+2];
  const e1x=pos[b]-ax,e1y=pos[b+1]-ay,e1z=pos[b+2]-az;
  const e2x=pos[c]-ax,e2y=pos[c+1]-ay,e2z=pos[c+2]-az;
  const nx=e1y*e2z-e1z*e2y, ny=e1z*e2x-e1x*e2z, nz=e1x*e2y-e1y*e2x;
  for(const v of [a,b,c]){nrm[v]+=nx;nrm[v+1]+=ny;nrm[v+2]+=nz;}
}
for(let i=0;i<nrm.length;i+=3){
  const l=Math.hypot(nrm[i],nrm[i+1],nrm[i+2])||1;
  nrm[i]/=l;nrm[i+1]/=l;nrm[i+2]/=l;
}
const ePos=new Float32Array(nTri*9),eNrm=new Float32Array(nTri*9),eUV=new Float32Array(nTri*6),eMat=new Float32Array(nTri*3);
for(let i=0;i<nTri;i++){
  const m=idxArr[i*3+2];
  for(let k=0;k<3;k++){
    const vi=idxArr[i*3+k]*3;
    ePos[i*9+k*3]=pos[vi];ePos[i*9+k*3+1]=pos[vi+1];ePos[i*9+k*3+2]=pos[vi+2];
    eNrm[i*9+k*3]=nrm[vi];eNrm[i*9+k*3+1]=nrm[vi+1];eNrm[i*9+k*3+2]=nrm[vi+2];
    const ui=idxArr[i*3+k]*2;
    eUV[i*6+k*2]=uv[ui];eUV[i*6+k*2+1]=uv[ui+1];
    eMat[i*3+k]=m;
  }
}
function buffer(data,loc,size){
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  if(loc<0)return b;
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
  return b;
}
const aPos=gl.getAttribLocation(prog,'aPos'),aNrm=gl.getAttribLocation(prog,'aNrm'),aUV=gl.getAttribLocation(prog,'aUV'),aMat=gl.getAttribLocation(prog,'aMat');
buffer(ePos,aPos,3);buffer(eNrm,aNrm,3);buffer(eUV,aUV,2);buffer(eMat,aMat,1);

const uMVP=gl.getUniformLocation(prog,'uMVP'),uMV=gl.getUniformLocation(prog,'uMV'),uNrmMat=gl.getUniformLocation(prog,'uNrmMat');
const uBase=gl.getUniformLocation(prog,'uBase'),uRough=gl.getUniformLocation(prog,'uRough'),uMetal=gl.getUniformLocation(prog,'uMetal');
const uEye=gl.getUniformLocation(prog,'uEye'),uWire=gl.getUniformLocation(prog,'uWire');
gl.uniform3fv(uBase,new Float32Array([].concat(MATS[0].base,MATS[1].base,MATS[2].base,MATS[3].base)));
gl.uniform1fv(uRough,new Float32Array(MATS.map(m=>m.rough)));
gl.uniform1fv(uMetal,new Float32Array(MATS.map(m=>m.metal)));

function perspective(fov,asp,near,far){
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/asp,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function lookAt(eye,tgt,up){
  const zx=eye[0]-tgt[0],zy=eye[1]-tgt[1],zz=eye[2]-tgt[2];
  let l=Math.hypot(zx,zy,zz)||1;const z=[zx/l,zy/l,zz/l];
  let xx=up[1]*z[2]-up[2]*z[1], xy=up[2]*z[0]-up[0]*z[2], xz=up[0]*z[1]-up[1]*z[0];
  l=Math.hypot(xx,xy,xz)||1;const x=[xx/l,xy/l,xz/l];
  const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
    -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
    -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1
  ]);
}
function mul(a,b){
  const o=new Float32Array(16);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];
    o[i*4+j]=s;
  }
  return o;
}

let autoSpin=true,dragging=false,lastX=0,lastY=0,vyaw=0,vpitch=0,pinch=0;
const hint=document.getElementById('hint');
function setSize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.floor(canvas.clientWidth*dpr),h=Math.floor(canvas.clientHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}
canvas.addEventListener('pointerdown',e=>{
  dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.classList.add('dragging');
  try{canvas.setPointerCapture(e.pointerId);}catch(_){}
  hint.classList.add('gone');
});
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
  cam.yaw-=dx*0.008;cam.pitch=Math.max(-1.35,Math.min(1.35,cam.pitch+dy*0.008));
  vyaw=-dx*0.00035;vpitch=dy*0.00035;
});
canvas.addEventListener('pointerup',e=>{dragging=false;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointercancel',()=>{dragging=false;canvas.classList.remove('dragging');});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  cam.dist=Math.max(radius*1.25,Math.min(radius*7,cam.dist*(1+Math.sign(e.deltaY)*0.09)));
},{passive:false});
const pts=new Map();
canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches)pts.set(t.identifier,{x:t.clientX,y:t.clientY});},{passive:true});
canvas.addEventListener('touchmove',e=>{
  for(const t of e.changedTouches)pts.set(t.identifier,{x:t.clientX,y:t.clientY});
  if(pts.size===2){
    const v=[...pts.values()];
    const d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);
    if(pinch)cam.dist=Math.max(radius*1.25,Math.min(radius*7,cam.dist*(pinch/d)));
    pinch=d;dragging=false;
  }
},{passive:true});
canvas.addEventListener('touchend',e=>{for(const t of e.changedTouches)pts.delete(t.identifier);if(pts.size<2)pinch=0;},{passive:true});

document.getElementById('bSpin').onclick=function(){autoSpin=!autoSpin;this.classList.toggle('on',autoSpin);};
let wire=false;
document.getElementById('bWire').onclick=function(){wire=!wire;this.classList.toggle('on',wire);};
document.getElementById('bReset').onclick=()=>{cam={yaw:HOME.yaw,pitch:HOME.pitch,dist:HOME.dist,tgt:HOME.tgt.slice()};vyaw=vpitch=0;};
document.getElementById('bShot').onclick=()=>{
  const a=document.createElement('a');
  a.download='fitpulse_view_'+cam.yaw.toFixed(2)+'.png';
  a.href=canvas.toDataURL('image/png');a.click();
};

const fov=Math.PI/4.6;
let tt=0;
function frame(now){
  tt=now||0;
  setSize();
  if(autoSpin&&!dragging)cam.yaw+=0.0042;
  if(!dragging){cam.yaw+=vyaw;cam.pitch=Math.max(-1.35,Math.min(1.35,cam.pitch+vpitch));vyaw*=0.92;vpitch*=0.92;}
  const ce=Math.cos(cam.pitch);
  const eye=[cam.tgt[0]+Math.sin(cam.yaw)*ce*cam.dist, cam.tgt[1]+Math.sin(cam.pitch)*cam.dist, cam.tgt[2]+Math.cos(cam.yaw)*ce*cam.dist];
  const asp=canvas.width/Math.max(1,canvas.height);
  const proj=perspective(fov,asp,Math.max(0.01,cam.dist*0.02),cam.dist*8);
  const view=lookAt(eye,cam.tgt,[0,1,0]);
  const mvp=mul(proj,view);
  gl.clearColor(0.043,0.051,0.063,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  gl.uniformMatrix4fv(uMVP,false,mvp);
  gl.uniformMatrix4fv(uMV,false,view);
  gl.uniformMatrix3fv(uNrmMat,false,new Float32Array([view[0],view[1],view[2],view[4],view[5],view[6],view[8],view[9],view[10]]));
  gl.uniform3fv(uEye,new Float32Array(eye));
  gl.uniform1f(uWire,wire?0.28:0.0);
  gl.drawArrays(gl.TRIANGLES,0,nTri*3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(()=>{
  document.getElementById('load').classList.add('gone');
  requestAnimationFrame(frame);
});
}catch(err){fail(err&&err.stack||err);}
})();
</script></body></html>`;
fs.writeFileSync(ROOT+'/web/viewer.html',html);
console.log('viewer.html',(html.length/1024).toFixed(1)+'KB');
