const {fk,err,T}=require('./fk.js');
let g={d:1e9};
for(let l=0;l<=32;l+=4)
 for(let r=-12;r<=12;r+=4)
  for(let f=-70;f<=60;f+=10)
   for(let t=0;t<=150;t+=15)
    for(let ab=-15;ab<=60;ab+=8)
     for(let e=40;e<=150;e+=10){
      const d=err(l,r,f,t,ab,e);
      if(d<g.d)g={d:d,p:[l,r,f,t,ab,e]};
     }
console.log('grid best mm',(g.d*1000).toFixed(2),'params',g.p.join(','));
const arr=g.p.slice();
const ks=[0,1,2,3,4,5];
const steps=[3,1.5,0.7,0.3,0.12,0.05,0.02];
let bd=g.d;
for(let si=0;si<steps.length;si++){
 const step=steps[si];
 for(let it=0;it<100;it++){
  let imp=false;
  for(let ki=0;ki<6;ki++){
   for(let sg=-1;sg<=1;sg+=2){
    const old=arr[ki];
    arr[ki]=old+sg*step;
    const d=err(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
    if(d<bd-1e-13){bd=d;imp=true;} else {arr[ki]=old;}
   }
  }
  if(!imp)break;
 }
}
const q=fk(arr[0],arr[1],arr[2],arr[3],arr[4],arr[5]);
console.log('=== err mm',(bd*1000).toFixed(2));
console.log('lift',arr[0].toFixed(1),'ret',arr[1].toFixed(1),'flex',arr[2].toFixed(1),'twist',arr[3].toFixed(1),'abd',arr[4].toFixed(1),'elbow',arr[5].toFixed(1));
console.log('S',q.S.map(v=>v.toFixed(3)).join(','),'E',q.E.map(v=>v.toFixed(3)).join(','),'H',q.H.map(v=>v.toFixed(3)).join(','));
console.log('below',(q.S[1]-q.E[1]).toFixed(3),'behind',(q.E[2]-q.S[2]).toFixed(3));
