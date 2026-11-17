const {fk,err,T}=require('./fk.js');
// Анатомия левого хвата штанги на спине:
// локоть ниже плеча на 8-20 см, локоть сзади (+Z) от плеча, локоть НЕ перекрещивает
// midline (E.x <= -0.05), локоть не выше плеча и не дальше 0.45 от плеча.
function cost(l,r,f,t,ab,e){
 const q=fk(l,r,f,t,ab,e);
 const base=err(l,r,f,t,ab,e);
 const below=q.S[1]-q.E[1];
 const behind=q.E[2]-q.S[2];
 let pen=0;
 if(below<0.06)pen+=(0.06-below)*3;
 if(below>0.26)pen+=(below-0.26)*3;
 if(behind<0.02)pen+=(0.02-behind)*3;
 if(q.E[0]>-0.05)pen+=(q.E[0]+0.05)*3;   // локоть не должен уходить к центру/вправо
 if(q.S[1]-q.H[1]<0.0)pen+=0.5;          // кисть не выше плеча
 return base+pen;
}
let g={d:1e9};
for(let l=0;l<=36;l+=6)for(let r=-15;r<=15;r+=5)for(let f=-90;f<=60;f+=15)for(let t=-90;t<=180;t+=30)for(let ab=-30;ab<=70;ab+=10)for(let e=50;e<=150;e+=10){
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
