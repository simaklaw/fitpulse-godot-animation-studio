const {fk,err,T}=require('./fk.js');
// та же цель, но требуем локоть СНАРУЖИ и СЗАДИ: E.x <= -0.15, E.z >= +0.10, E.y ниже S.y на 5-25 см
function cost(l,r,f,t,ab,e){
 const q=fk(l,r,f,t,ab,e);
 const base=err(l,r,f,t,ab,e);
 const below=q.S[1]-q.E[1];
 const behind=q.E[2]-q.S[2];
 let pen=base;
 if(below<0.05)pen+=(0.05-below)*4;
 if(below>0.25)pen+=(below-0.25)*4;
 if(behind<0.10)pen+=(0.10-behind)*4;
 if(q.E[0]>-0.15)pen+=(q.E[0]+0.15)*4;
 if(Math.abs(t)>150)pen+=(Math.abs(t)-150)*0.01;
 if(e>150)pen+=(e-150)*0.02;
 if(e<70)pen+=(70-e)*0.02;
 return pen;
}
let g={d:1e9};
for(let l=0;l<=36;l+=6)for(let r=-15;r<=15;r+=5)for(let f=-120;f<=60;f+=15)for(let t=-180;t<=180;t+=30)for(let ab=-40;ab<=80;ab+=10)for(let e=50;e<=150;e+=10){
 const d=cost(l,r,f,t,ab,e); if(d<g.d)g={d:d,p:[l,r,f,t,ab,e]};
}
console.log('grid cost',g.d.toFixed(4),'params',g.p.join(','));
const arr=g.p.slice(); let bd=g.d;
for(const step of [4,2,1,0.5,0.2,0.08,0.03]){
 for(let it=0;it<120;it++){let imp=false;
  for(let ki=0;ki<6;ki++)for(let sg=-1;sg<=1;sg+=2){
   const old=arr[ki]; arr[ki]=old+sg*step;
   const d=cost(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
   if(d<bd-1e-13){bd=d;imp=true;}else{arr[ki]=old;}}
  if(!imp)break;}}
const q=fk(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
console.log('=== cost',bd.toFixed(4),'err mm',(err(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5])*1000).toFixed(2));
console.log('lift',arr[0].toFixed(1),'ret',arr[1].toFixed(1),'flex',arr[2].toFixed(1),'twist',arr[3].toFixed(1),'abd',arr[4].toFixed(1),'elbow',arr[5].toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
console.log('below',(q.S[1]-q.E[1]).toFixed(3),'behind',(q.E[2]-q.S[2]).toFixed(3));
