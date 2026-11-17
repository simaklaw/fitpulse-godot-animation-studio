const {fk,err,T}=require('./fk.js');
// Компромисс: строгая анатомия (E.x<=-0.13, E.z>=+0.08, ниже 5-25см) и минимум ошибки хвата.
function cost(l,r,f,t,ab,e){
 const q=fk(l,r,f,t,ab,e);
 const base=err(l,r,f,t,ab,e);
 const below=q.S[1]-q.E[1];
 const behind=q.E[2]-q.S[2];
 let pen=base*10; // ошибка хвата в приоритете
 if(below<0.05)pen+=(0.05-below);
 if(below>0.25)pen+=(below-0.25);
 if(behind<0.08)pen+=(0.08-behind);
 if(q.E[0]>-0.13)pen+=(q.E[0]+0.13);
 return pen;
}
let g={d:1e9};
for(let l=0;l<=40;l+=5)for(let r=-20;r<=20;r+=5)for(let f=-140;f<=60;f+=20)for(let t=-180;t<=180;t+=30)for(let ab=-40;ab<=80;ab+=10)for(let e=50;e<=150;e+=10){
 const d=cost(l,r,f,t,ab,e); if(d<g.d)g={d:d,p:[l,r,f,t,ab,e]};
}
console.log('grid',g.d.toFixed(4),g.p.join(','));
const arr=g.p.slice(); let bd=g.d;
for(const step of [4,2,1,0.5,0.2,0.08,0.03,0.01]){
 for(let it=0;it<150;it++){let imp=false;
  for(let ki=0;ki<6;ki++)for(let sg=-1;sg<=1;sg+=2){
   const old=arr[ki]; arr[ki]=old+sg*step;
   const d=cost(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
   if(d<bd-1e-13){bd=d;imp=true;}else{arr[ki]=old;}}
  if(!imp)break;}}
const q=fk(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
const E=err(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
console.log('=== cost',bd.toFixed(4),'err mm',(E*1000).toFixed(2));
console.log('lift',arr[0].toFixed(1),'ret',arr[1].toFixed(1),'flex',arr[2].toFixed(1),'twist',arr[3].toFixed(1),'abd',arr[4].toFixed(1),'elbow',arr[5].toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
console.log('below',(q.S[1]-q.E[1]).toFixed(3),'behind',(q.E[2]-q.S[2]).toFixed(3),'E.x',q.E[0].toFixed(3));
